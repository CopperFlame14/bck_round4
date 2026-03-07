/**
 * ai-response.js — AI Response Assistant Module
 * Ported from bck3/bck_round3: staff-panel.html + ai.js + gemini_service.py
 */

let _queries = [];
let _currentQuery = null;
let _responses = [];

// ── Load Queries ──────────────────────────────────────────────────
function loadQueries() {
  // Try Firestore first
  try {
    const ref = window.FirebaseService?.getQueriesRef();
    if (ref) {
      ref.orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => {
        _queries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderQueryList();
        updateQueryBadge();
      }, err => {
        console.warn('Firestore queries listener error:', err);
        _queries = getDemoQueries();
        renderQueryList();
        updateQueryBadge();
      });
      return;
    }
  } catch (e) { /* demo fallback */ }

  // Demo fallback — load from localStorage + demo data
  _queries = getDemoQueries();
  renderQueryList();
  updateQueryBadge();
}

function getDemoQueries() {
  return JSON.parse(localStorage.getItem('demo_queries') || '[]');
}

// Infer urgency from message content so list/detail show correct priority before AI Suggest
function inferUrgencyFromMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const q = text.toLowerCase();
  if (/chest pain|can't breathe|breathing difficulty|shortness of breath|bleeding|unconscious|stroke|heart attack|emergency|severe pain|unbearable|worst pain|critical|urgent/.test(q)) return 'high';
  if (/persistent|recurring|worsening|several days|past week|concerned|worried|pain|fever|nausea|dizziness/.test(q)) return 'medium';
  return null;
}

function getDisplayUrgency(q) {
  return (q.aiUrgency || inferUrgencyFromMessage(q.message) || q.urgency || 'low').toLowerCase();
}

// ── Render Query List ─────────────────────────────────────────────
function renderQueryList(filter = 'all') {
  const container = document.getElementById('incomingQueriesContainer');
  if (!container) return;

  let filtered = _queries.filter(q => q.status !== 'resolved');
  if (filter !== 'all') filtered = filtered.filter(q => getDisplayUrgency(q) === filter);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📬</div><h3>No Queries</h3><p>All caught up! No pending queries.</p></div>`;
    return;
  }

  const urgencyColor = { high: '#E74C3C', medium: '#F39C12', low: '#4CD137' };
  const urgencyBg = { high: 'badge-critical', medium: 'badge-warning', low: 'badge-success' };

  container.innerHTML = filtered.map(q => {
    const urgency = getDisplayUrgency(q);
    const time = q.createdAt?.toDate ? q.createdAt.toDate().toLocaleString() : (q.createdAt ? new Date(q.createdAt).toLocaleString() : '—');
    return `
      <div class="query-card" onclick="window.AIResponse.openQuery('${q.id}')">
        <div class="query-card-header">
          <div>
            <strong style="color:var(--text-primary);">${q.name || 'Anonymous'}</strong>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px;">${q.department || 'General'}</span>
          </div>
          <span class="badge ${urgencyBg[urgency] || 'badge-muted'}">${urgency.toUpperCase()}</span>
        </div>
        <div class="query-card-body">${(q.message || '').substring(0, 120)}${q.message?.length > 120 ? '...' : ''}</div>
        <div class="query-card-footer">
          <span style="font-size:0.75rem;color:var(--text-muted);"><i class="fas fa-clock" style="margin-right:4px;"></i>${time}</span>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window.AIResponse.generateSuggestionById('${q.id}')">
              <i class="fas fa-robot"></i> AI Suggest
            </button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window.AIResponse.openQuery('${q.id}')">
              View Details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateQueryBadge() {
  const pending = _queries.filter(q => q.status === 'pending').length;
  const badge = document.getElementById('queriesBadge');
  if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'flex' : 'none'; }
}

// ── Open Query Detail ─────────────────────────────────────────────
function openQuery(id) {
  const q = _queries.find(q => q.id === id);
  if (!q) return;
  _currentQuery = q;

  // Switch to query detail section
  const detailEl = document.getElementById('queryDetailPanel');
  if (detailEl) {
    detailEl.style.display = 'block';
    document.getElementById('incomingListView').style.display = 'none';

    // Populate fields
    const setField = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val || '—'; };
    const displayUrgency = getDisplayUrgency(q).toUpperCase();
    setField('detail-name', q.name);
    setField('detail-email', q.email);
    setField('detail-phone', q.phone);
    setField('detail-dept', q.department);
    setField('detail-urgency', displayUrgency);
    setField('detail-category', q.category);
    setField('detail-message', q.message);
    setField('detail-symptoms', q.symptoms || 'Not specified');

    const textarea = document.getElementById('aiResponseTextarea');
    if (textarea) textarea.value = '';
  }
}

function closeQueryDetail() {
  document.getElementById('queryDetailPanel').style.display = 'none';
  document.getElementById('incomingListView').style.display = 'block';
  _currentQuery = null;
}

// ── Generate AI Suggestion ────────────────────────────────────────
async function generateSuggestion(query, dept) {
  const textarea = document.getElementById('aiResponseTextarea');
  const btn = document.getElementById('generateBtn');
  if (!textarea) return;

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; }
  textarea.value = '';
  textarea.placeholder = 'AI is generating a response...';

  try {
    const result = await window.GeminiService.generateAIResponse(query, dept);
    textarea.value = result.suggested_reply;

    // Use AI-inferred urgency so list and detail stay in sync
    if (_currentQuery && result.urgency) {
      _currentQuery.aiUrgency = result.urgency;
      const idx = _queries.findIndex(q => q.id === _currentQuery.id);
      if (idx !== -1) _queries[idx].aiUrgency = result.urgency;
      const el = document.getElementById('detail-urgency');
      if (el) el.textContent = result.urgency.toUpperCase();
      // Persist to demo_queries so list shows correct urgency after refresh
      const demo = JSON.parse(localStorage.getItem('demo_queries') || '[]');
      const qIdx = demo.findIndex(q => q.id === _currentQuery.id);
      if (qIdx !== -1) {
        demo[qIdx].aiUrgency = result.urgency;
        localStorage.setItem('demo_queries', JSON.stringify(demo));
      }
      renderQueryList();
    }

    // Show category/urgency
    const meta = document.getElementById('aiResponseMeta');
    if (meta) {
      meta.innerHTML = `Category: <strong>${result.category}</strong> · Urgency: <strong style="color:${result.urgency === 'high' ? '#E74C3C' : result.urgency === 'medium' ? '#F39C12' : '#4CD137'}">${result.urgency.toUpperCase()}</strong>`;
      meta.style.display = 'block';
    }
  } catch (e) {
    textarea.value = 'AI service unavailable. Please type a response manually.';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Regenerate'; }
    textarea.placeholder = 'AI suggestion will appear here...';
  }
}

async function generateSuggestionById(id) {
  const q = _queries.find(q => q.id === id);
  if (!q) return;
  openQuery(id);
  await generateSuggestion(q.message, q.department);
}

// ── Approve & Send ────────────────────────────────────────────────
async function approveResponse() {
  if (!_currentQuery) return;
  const textarea = document.getElementById('aiResponseTextarea');
  const text = textarea?.value?.trim();
  if (!text) { showToastGlobal('Please generate or write a response first.', 'warning'); return; }

  const responseData = {
    queryId: _currentQuery.id,
    patientName: _currentQuery.name,
    department: _currentQuery.department,
    response: text,
    approvedBy: localStorage.getItem('userName') || 'Staff',
    status: 'approved'
  };

  try {
    const ref = window.FirebaseService?.getResponsesRef();
    if (ref) await window.FirebaseService.addDocument(ref, responseData);

    // Update query status
    const qRef = window.FirebaseService?.getQueriesRef();
    if (qRef) await qRef.doc(_currentQuery.id).update({ status: 'resolved' });
  } catch (e) {
    // Demo mode
    const saved = JSON.parse(localStorage.getItem('demo_responses') || '[]');
    saved.unshift({ ...responseData, createdAt: new Date().toISOString() });
    localStorage.setItem('demo_responses', JSON.stringify(saved));
  }

  // Update local state
  const q = _queries.find(q => q.id === _currentQuery.id);
  if (q) q.status = 'resolved';

  showToastGlobal(`Response approved and sent to ${_currentQuery.name} ✓`, 'success');
  closeQueryDetail();
  renderQueryList();
}

// ── Response History ──────────────────────────────────────────────
function renderResponseHistory() {
  const container = document.getElementById('responseHistoryContainer');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('demo_responses') || '[]');
  const resolved = _queries.filter(q => q.status === 'resolved');

  const all = [...saved, ...resolved.map(q => ({
    patientName: q.name, department: q.department, status: 'approved',
    createdAt: q.createdAt?.toDate ? q.createdAt.toDate().toISOString() : q.createdAt
  }))];

  if (all.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No Response History</h3><p>Approved responses will appear here.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:10px 12px;font-size:0.8rem;color:var(--text-muted);">Patient</th>
          <th style="text-align:left;padding:10px 12px;font-size:0.8rem;color:var(--text-muted);">Department</th>
          <th style="text-align:left;padding:10px 12px;font-size:0.8rem;color:var(--text-muted);">Status</th>
          <th style="text-align:left;padding:10px 12px;font-size:0.8rem;color:var(--text-muted);">Date</th>
        </tr>
      </thead>
      <tbody>
        ${all.map(r => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px 12px;font-size:0.875rem;">${r.patientName || '—'}</td>
            <td style="padding:10px 12px;font-size:0.875rem;">${r.department || '—'}</td>
            <td style="padding:10px 12px;"><span class="badge badge-success">Approved</span></td>
            <td style="padding:10px 12px;font-size:0.8rem;color:var(--text-muted);">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showToastGlobal(msg, type = 'info') {
  window.showToast?.(msg, type);
}

window.addEventListener('demo_queries_updated', () => {
  _queries = getDemoQueries();
  renderQueryList();
  updateQueryBadge();
});

window.AIResponse = {
  loadQueries, renderQueryList, openQuery, closeQueryDetail,
  generateSuggestion, generateSuggestionById, approveResponse, renderResponseHistory
};
