/**
 * alerts.js — Smart Alert Engine
 * Extracted and enhanced from bck1/bck_smartcare_analytics/scripts/alerts.js
 */

const THRESHOLDS = {
    waitTime: 30,  // minutes
    bedAvailMin: 20,  // count
    deptCapacity: 80,  // % utilization
    effScore: 50,  // score minimum
};

// Active alerts store
let _alerts = [];

// ── Generate Alerts ──────────────────────────────────────────────
function checkAlerts({ avgWait, beds, score, deptData = [] }) {
    _alerts = [];

    if (avgWait > THRESHOLDS.waitTime) {
        _alerts.push({
            id: 'wait-' + Date.now(),
            type: avgWait > 45 ? 'critical' : 'warning',
            icon: 'fa-clock',
            title: avgWait > 45 ? 'Critical Wait Time Detected' : 'High Wait Time Warning',
            desc: `Average waiting time is ${avgWait} min (threshold: ${THRESHOLDS.waitTime} min).`,
            action: 'Deploy additional triage staff. Consider redirecting non-urgent cases.',
            dept: 'Hospital-Wide',
            timestamp: new Date().toLocaleTimeString(),
        });
    }

    if (beds < THRESHOLDS.bedAvailMin) {
        _alerts.push({
            id: 'beds-' + Date.now(),
            type: beds < 10 ? 'critical' : 'warning',
            icon: 'fa-bed',
            title: beds < 10 ? 'Bed Capacity Critical' : 'Low Bed Availability',
            desc: `Only ${beds} beds available. Capacity at ${100 - beds}%.`,
            action: 'Initiate discharge protocols for stable patients. Prepare overflow protocols.',
            dept: 'Bed Management',
            timestamp: new Date().toLocaleTimeString(),
        });
    }

    if (score < THRESHOLDS.effScore) {
        _alerts.push({
            id: 'eff-' + Date.now(),
            type: score < 35 ? 'critical' : 'warning',
            icon: 'fa-chart-line',
            title: 'Low Hospital Efficiency Score',
            desc: `Efficiency score dropped to ${score}/100. Performance degradation detected.`,
            action: 'Review department workloads and optimize resource allocation immediately.',
            dept: 'Operations',
            timestamp: new Date().toLocaleTimeString(),
        });
    }

    // Dept overload alerts
    deptData.forEach(d => {
        const pct = Math.min(100, (d.count / 50) * 100); // assuming 50 is dept capacity
        if (pct > THRESHOLDS.deptCapacity) {
            _alerts.push({
                id: 'dept-' + d.dept + '-' + Date.now(),
                type: pct > 95 ? 'critical' : 'warning',
                icon: 'fa-hospital',
                title: `${d.dept} Overloaded`,
                desc: `${d.dept} at ${Math.round(pct)}% capacity with ${d.count} active patients.`,
                action: `Route new ${d.dept} cases to alternative departments. Alert on-call staff.`,
                dept: d.dept,
                timestamp: new Date().toLocaleTimeString(),
            });
        }
    });

    // Info alert if all good
    if (_alerts.length === 0) {
        _alerts.push({
            id: 'ok-' + Date.now(),
            type: 'success',
            icon: 'fa-check-circle',
            title: 'All Systems Nominal',
            desc: 'All hospital metrics are within acceptable thresholds.',
            action: 'Continue monitoring. No action required.',
            dept: 'All Departments',
            timestamp: new Date().toLocaleTimeString(),
        });
    }

    renderAlertPanel();
    updateAlertBadge();
    return _alerts;
}

// ── Default demo alerts ───────────────────────────────────────────
function loadDemoAlerts() {
    _alerts = [
        {
            id: 'demo-1', type: 'critical',
            icon: 'fa-clock',
            title: 'Emergency Department Overcrowded',
            desc: 'Wait time in Emergency has reached 52 minutes. Threshold exceeded by 73%.',
            action: 'Alert: Deploy 2 additional triage nurses. Redirect non-critical patients to General Medicine.',
            dept: 'Emergency', timestamp: new Date(Date.now() - 300000).toLocaleTimeString()
        },
        {
            id: 'demo-2', type: 'warning',
            icon: 'fa-bed',
            title: 'Bed Availability Below 25%',
            desc: 'Only 18 beds remain available out of 100 total. ICU at 92% capacity.',
            action: 'Initiate discharge review board. Contact nearby facility for overflow capacity.',
            dept: 'Bed Management', timestamp: new Date(Date.now() - 600000).toLocaleTimeString()
        },
        {
            id: 'demo-3', type: 'warning',
            icon: 'fa-hospital',
            title: 'Cardiology Approaching Capacity',
            desc: 'Cardiology department handling 38 active patients (76% of capacity).',
            action: 'Monitor closely. Pre-alert on-call cardiologist team.',
            dept: 'Cardiology', timestamp: new Date(Date.now() - 900000).toLocaleTimeString()
        },
        {
            id: 'demo-4', type: 'info',
            icon: 'fa-robot',
            title: 'AI Prediction Update',
            desc: 'System predicts 18% increase in patient volume over next 2 hours based on historical patterns.',
            action: 'Recommend scheduling additional staff for the 6–8 PM shift.',
            dept: 'AI Analytics', timestamp: new Date(Date.now() - 1200000).toLocaleTimeString()
        },
    ];

    renderAlertPanel();
    updateAlertBadge();
}

// ── Render Alert Panel ────────────────────────────────────────────
function renderAlertPanel() {
    const container = document.getElementById('alertsContainer');
    if (!container) return;

    if (_alerts.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No Active Alerts</h3><p>All systems within acceptable thresholds.</p></div>`;
        return;
    }

    container.innerHTML = _alerts.map(a => `
    <div class="alert-card ${a.type}" id="alert-${a.id}">
      <div class="alert-icon"><i class="fas ${a.icon}"></i></div>
      <div class="alert-content" style="flex:1;">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-meta" style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:6px;font-size:0.76rem;">
          <i class="fas fa-lightbulb" style="margin-right:4px;"></i><strong>Action:</strong> ${a.action}
        </div>
        <div class="alert-meta"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${a.dept} · ${a.timestamp}</div>
      </div>
      <button onclick="dismissAlert('${a.id}')" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:0.9rem;padding:4px;align-self:flex-start;">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function updateAlertBadge() {
    const critical = _alerts.filter(a => a.type === 'critical').length;
    const badge = document.getElementById('alertsBadge');
    if (badge) {
        badge.textContent = critical > 0 ? critical : _alerts.length;
        badge.style.display = _alerts.length > 0 && _alerts[0].type !== 'success' ? 'flex' : 'none';
    }
}

// Global dismiss function
window.dismissAlert = function (id) {
    _alerts = _alerts.filter(a => a.id !== id);
    renderAlertPanel();
    updateAlertBadge();
};

function getAlerts() { return _alerts; }

window.Alerts = { checkAlerts, loadDemoAlerts, renderAlertPanel, getAlerts };
