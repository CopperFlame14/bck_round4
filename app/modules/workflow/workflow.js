/**
 * workflow.js — Inter-Department Workflow Management
 * Adapted from cf3/health-flow-pro's workflow automation system
 */

const DEMO_REQUESTS = [
    {
        id: 'WF-001', patientName: 'Ravi Kumar', department: 'Cardiology',
        assignedTo: 'Dr. Anand Raj', status: 'in_progress', stage: 'Doctor Review',
        priority: 'high', description: 'Cardiac consultation for chest pain complaint',
        timeline: ['10:02 - Request Created', '10:05 - Assigned to Cardiology', '10:12 - Doctor Review Started'],
        createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
        id: 'WF-002', patientName: 'Meera Nair', department: 'Laboratory',
        assignedTo: 'Lab Tech. Sunita', status: 'pending', stage: 'Awaiting Sample',
        priority: 'medium', description: 'Blood work: CBC, lipid panel, thyroid function',
        timeline: ['09:45 - Request Created', '09:47 - Forwarded to Laboratory'],
        createdAt: new Date(Date.now() - 5400000).toISOString()
    },
    {
        id: 'WF-003', patientName: 'Suresh Venkatesan', department: 'Pharmacy',
        assignedTo: 'Pharmacist Rekha', status: 'completed', stage: 'Dispensed',
        priority: 'low', description: 'Regular prescription dispensing — Metformin 500mg',
        timeline: ['08:30 - Prescription Received', '08:35 - Prepared', '08:42 - Dispensed'],
        createdAt: new Date(Date.now() - 10800000).toISOString()
    },
    {
        id: 'WF-004', patientName: 'Lakshmi Devi', department: 'Radiology',
        assignedTo: 'Dr. Priya Sharma', status: 'in_progress', stage: 'Scan in Progress',
        priority: 'high', description: 'Emergency CT scan — head trauma',
        timeline: ['11:20 - Emergency Request', '11:22 - Immediate Assignment', '11:25 - Scan Started'],
        createdAt: new Date(Date.now() - 1800000).toISOString()
    },
    {
        id: 'WF-005', patientName: 'Kiran Bose', department: 'Billing',
        assignedTo: 'Accounts Staff', status: 'pending', stage: 'Invoice Preparation',
        priority: 'low', description: 'Discharge billing settlement for 3-day stay',
        timeline: ['12:00 - Discharge Cleared', '12:05 - Billing Initiated'],
        createdAt: new Date(Date.now() - 900000).toISOString()
    },
    {
        id: 'WF-006', patientName: 'Divya Krishnan', department: 'Neurology',
        assignedTo: 'Dr. Venkat', status: 'completed', stage: 'Consultation Complete',
        priority: 'medium', description: 'Neurology consult for recurring migraine episodes',
        timeline: ['07:00 - Scheduled', '09:00 - Patient Arrived', '09:30 - Consultation Done', '09:45 - Report Sent'],
        createdAt: new Date(Date.now() - 14400000).toISOString()
    }
];

let _requests = [...DEMO_REQUESTS];

// ── Load Workflow ─────────────────────────────────────────────────
function loadWorkflow() {
    try {
        const ref = window.FirebaseService?.getWorkflowRef();
        if (ref) {
            ref.orderBy('createdAt', 'desc').onSnapshot(snap => {
                const fsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                _requests = fsData.length > 0 ? fsData : DEMO_REQUESTS;
                renderWorkflow();
            });
            return;
        }
    } catch (e) { /* demo */ }

    _requests = DEMO_REQUESTS;
    renderWorkflow();
}

// ── Render Kanban Board ───────────────────────────────────────────
function renderWorkflow() {
    const container = document.getElementById('workflowBoard');
    if (!container) return;

    const pending = _requests.filter(r => r.status === 'pending');
    const in_progress = _requests.filter(r => r.status === 'in_progress');
    const completed = _requests.filter(r => r.status === 'completed');

    const priColor = { high: '#E74C3C', medium: '#F39C12', low: '#4CD137' };

    const renderCard = (r) => `
    <div class="kanban-card" onclick="window.Workflow.openDetail('${r.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">${r.id}</span>
        <span style="width:8px;height:8px;border-radius:50%;background:${priColor[r.priority] || '#94A3B8'};flex-shrink:0;margin-top:3px;"></span>
      </div>
      <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);margin-bottom:4px;">${r.patientName}</div>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;">${r.description?.substring(0, 60)}${r.description?.length > 60 ? '...' : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.72rem;background:rgba(46,134,222,0.1);color:#2E86DE;padding:2px 8px;border-radius:20px;">${r.department}</span>
        <span style="font-size:0.7rem;color:var(--text-muted);">${r.stage}</span>
      </div>
      <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
        <i class="fas fa-user-md" style="margin-right:3px;"></i>${r.assignedTo}
      </div>
      <div style="display:flex;gap:4px;margin-top:8px;">
        ${r.status === 'pending' ? `<button class="btn btn-primary btn-sm" style="flex:1;padding:5px;" onclick="event.stopPropagation();window.Workflow.advance('${r.id}')"><i class="fas fa-play"></i> Start</button>` : ''}
        ${r.status === 'in_progress' ? `<button class="btn btn-success btn-sm" style="flex:1;padding:5px;" onclick="event.stopPropagation();window.Workflow.advance('${r.id}')"><i class="fas fa-check"></i> Complete</button>` : ''}
        ${r.status === 'completed' ? `<span style="font-size:0.72rem;color:#4CD137;"><i class="fas fa-check-circle"></i> Done</span>` : ''}
      </div>
    </div>
  `;

    container.innerHTML = `
    <div class="kanban-board">
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span style="width:8px;height:8px;border-radius:50%;background:#94A3B8;"></span>
          Pending <span style="margin-left:auto;background:#E2E8F0;color:#64748B;font-size:0.7rem;padding:2px 7px;border-radius:20px;">${pending.length}</span>
        </div>
        ${pending.map(renderCard).join('') || '<div class="empty-state" style="padding:20px;"><div class="empty-state-icon" style="font-size:1.5rem;">⏳</div><p>No pending requests</p></div>'}
      </div>
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span style="width:8px;height:8px;border-radius:50%;background:#F39C12;"></span>
          In Progress <span style="margin-left:auto;background:#FEF3C7;color:#F39C12;font-size:0.7rem;padding:2px 7px;border-radius:20px;">${in_progress.length}</span>
        </div>
        ${in_progress.map(renderCard).join('') || '<div class="empty-state" style="padding:20px;"><p>No active requests</p></div>'}
      </div>
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span style="width:8px;height:8px;border-radius:50%;background:#4CD137;"></span>
          Completed <span style="margin-left:auto;background:#DCFCE7;color:#27ae60;font-size:0.7rem;padding:2px 7px;border-radius:20px;">${completed.length}</span>
        </div>
        ${completed.map(renderCard).join('') || '<div class="empty-state" style="padding:20px;"><p>No completed today</p></div>'}
      </div>
    </div>
  `;
}

// ── Advance Status ────────────────────────────────────────────────
function advance(id) {
    const r = _requests.find(r => r.id === id);
    if (!r) return;
    if (r.status === 'pending') { r.status = 'in_progress'; r.stage = 'Processing'; }
    else if (r.status === 'in_progress') { r.status = 'completed'; r.stage = 'Completed'; }
    renderWorkflow();
    window.showToast?.(`Request ${id} status updated ✓`, 'success');
}

// ── New Request ───────────────────────────────────────────────────
function createRequest(data) {
    const id = 'WF-' + String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    const r = { id, status: 'pending', stage: 'Awaiting Assignment', timeline: [`${new Date().toLocaleTimeString()} - Request Created`], createdAt: new Date().toISOString(), ...data };
    _requests.unshift(r);
    renderWorkflow();
}

// ── Detail View ───────────────────────────────────────────────────
function openDetail(id) {
    const r = _requests.find(r => r.id === id);
    if (!r) return;
    const panel = document.getElementById('workflowDetailModal');
    if (!panel) return;
    document.getElementById('wf-detail-id').textContent = r.id;
    document.getElementById('wf-detail-patient').textContent = r.patientName;
    document.getElementById('wf-detail-dept').textContent = r.department;
    document.getElementById('wf-detail-staff').textContent = r.assignedTo;
    document.getElementById('wf-detail-status').textContent = r.status.replace('_', ' ').toUpperCase();
    document.getElementById('wf-detail-stage').textContent = r.stage;
    document.getElementById('wf-detail-desc').textContent = r.description;
    document.getElementById('wf-detail-timeline').innerHTML = (r.timeline || []).map(t => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text-secondary);">✓ ${t}</div>`).join('');
    panel.style.display = 'flex';
}

window.Workflow = { loadWorkflow, renderWorkflow, advance, createRequest, openDetail };
