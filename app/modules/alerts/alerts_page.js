/**
 * alerts_page.js - Logic for the dedicated Alerts Dashboard
 */

window.AlertsPage = (function () {
    let db = null;
    let unsubscribe = null;
    let allAlerts = [];
    const DEPARTMENTS = ['Emergency', 'ICU', 'Radiology', 'Cardiology', 'Internal Medicine', 'Bed Management'];

    // ── Database Init ───────────────────────────────────────────────
    function init() {
        if (!window.FirebaseService) {
            console.error('Firebase Service not loaded');
            return;
        }

        const hospitalRef = window.FirebaseService.getHospitalRef();
        if (hospitalRef) {
            db = hospitalRef.collection('system_alerts');
            listenToAlerts();
        } else {
            console.warn('Using LocalDemo for Alerts Page');
            loadLocalDemo();
        }
    }

    // ── Firestore Listener ──────────────────────────────────────────
    function listenToAlerts() {
        // Query active, acknowledged, resolved within last 24h
        const yesterday = new Date(Date.now() - 86400000).toISOString();

        unsubscribe = db.where('timestamp', '>=', yesterday)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snap => {
                allAlerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderUI();
            }, err => {
                console.error("Alerts listener error:", err);
                loadLocalDemo();
            });
    }

    // ── Local Demo Fallback ─────────────────────────────────────────
    function loadLocalDemo() {
        allAlerts = JSON.parse(localStorage.getItem('alerts_page_demo') || '[]');
        if (allAlerts.length === 0) simulateIncident();
        else renderUI();
    }

    function saveLocal() {
        if (!db) localStorage.setItem('alerts_page_demo', JSON.stringify(allAlerts));
    }

    // ── Simulate Incident Data ──────────────────────────────────────
    function simulateIncident() {
        const _id = () => Math.random().toString(36).substr(2, 6).toUpperCase();

        const incidents = [
            {
                severity: 'critical', title: 'Code STEMI Activation: ER Inbound',
                dept: 'Emergency', icon: 'fa-ambulance',
                desc: 'Inbound EMS: 58M with acute chest pain, ST elevation on requested 12-lead. ETA 4 mins.',
                action: 'Activate Cath Lab team immediately. Clear Trauma Bay 1. Notify on-call Cardiologist.'
            },
            {
                severity: 'warning', title: 'Critical Lab Result: Potassium 6.8',
                dept: 'Internal Medicine', icon: 'fa-vials',
                desc: 'Patient ID #88392 (Bed 4A). STAT Potassium level critically high at 6.8 mEq/L.',
                action: 'Notify attending physician STAT. Prepare Calcium Gluconate and ECG.'
            },
            {
                severity: 'warning', title: 'ICU Capacity Reached 95%',
                dept: 'ICU', icon: 'fa-bed',
                desc: 'Only 1 ICU bed currently available. 4 patients in ER holding awaiting transfer.',
                action: 'Initiate Step-Down Unit triage. Expedite pending discharges.'
            },
            {
                severity: 'info', title: 'No-Show Probability Detected',
                dept: 'Radiology', icon: 'fa-calendar-times',
                desc: 'Predictive model identified 3 upcoming MRI appointments with >85% no-show probability.',
                action: 'Automated SMS reminders sent. Overbooking approved for 14:00 window.'
            }
        ];

        const stamp = new Date().toISOString();

        const newAlerts = incidents.map(inc => ({
            id: `ALR-${_id()}`,
            severity: inc.severity,
            title: inc.title,
            department: inc.dept,
            description: inc.desc,
            suggested_action: inc.action,
            icon: inc.icon,
            timestamp: stamp,
            status: 'active'
        }));

        if (db) {
            newAlerts.forEach(a => db.doc(a.id).set(a));
        } else {
            allAlerts.unshift(...newAlerts);
            saveLocal();
            renderUI();
        }
    }

    // ── Actions ─────────────────────────────────────────────────────
    function acknowledgeAlert(id) {
        if (db) {
            db.doc(id).update({ status: 'acknowledged', ack_time: new Date().toISOString() });
        } else {
            const a = allAlerts.find(x => x.id === id);
            if (a) { a.status = 'acknowledged'; saveLocal(); renderUI(); }
        }
    }

    function resolveAlert(id) {
        const userName = localStorage.getItem('userName') || 'Admin';
        if (db) {
            db.doc(id).update({ status: 'resolved', resolved_time: new Date().toISOString(), resolved_by: userName });
        } else {
            const a = allAlerts.find(x => x.id === id);
            if (a) { a.status = 'resolved'; a.resolved_time = new Date().toISOString(); a.resolved_by = userName; saveLocal(); renderUI(); }
        }
    }

    // ── UI Rendering ────────────────────────────────────────────────
    function filterUI() {
        renderUI();
    }

    function renderUI() {
        const searchTerm = (document.getElementById('searchAlerts')?.value || '').toLowerCase();
        const severityFilter = document.getElementById('filterSeverity')?.value || 'all';
        const deptFilter = document.getElementById('filterDept')?.value || 'all';

        // Filter list
        let filtered = allAlerts.filter(a => {
            const matchSearch = a.title.toLowerCase().includes(searchTerm) || a.description.toLowerCase().includes(searchTerm);
            const matchSev = severityFilter === 'all' || a.severity === severityFilter;
            const matchDept = deptFilter === 'all' || a.department === deptFilter;
            return matchSearch && matchSev && matchDept;
        });

        const activeAlerts = filtered.filter(a => a.status === 'active' || a.status === 'acknowledged');
        const resolvedAlerts = filtered.filter(a => a.status === 'resolved');

        renderSummaryCards();
        renderActivePanel(activeAlerts);
        renderHeatmap();
        renderHistoryTable(resolvedAlerts);
    }

    // 1. Summary Cards
    function renderSummaryCards() {
        const container = document.getElementById('alertsKpiGrid');
        if (!container) return;

        let critical = 0, warning = 0, info = 0, resolved = 0;
        allAlerts.forEach(a => {
            if (a.status === 'resolved') resolved++;
            else {
                if (a.severity === 'critical') critical++;
                if (a.severity === 'warning') warning++;
                if (a.severity === 'info') info++;
            }
        });

        const cards = [
            { label: 'Critical Alerts', val: critical, icon: 'fa-radiation', color: 'var(--alert-critical)', bg: 'rgba(231,76,60,0.15)' },
            { label: 'Warning Alerts', val: warning, icon: 'fa-exclamation-triangle', color: 'var(--alert-warning)', bg: 'rgba(243,156,18,0.15)' },
            { label: 'Info Alerts', val: info, icon: 'fa-info-circle', color: 'var(--alert-info)', bg: 'rgba(46,134,222,0.15)' },
            { label: 'Resolved (24h)', val: resolved, icon: 'fa-check-double', color: '#4CD137', bg: 'rgba(76,209,55,0.15)' }
        ];

        container.innerHTML = cards.map(c => `
            <div class="kpi-card-alert">
                <div class="kpi-alert-icon" style="background:${c.bg}; color:${c.color}">
                    <i class="fas ${c.icon}"></i>
                </div>
                <div class="val">${c.val}</div>
                <div class="lbl">${c.label}</div>
            </div>
        `).join('');
    }

    // 2. Active Panel
    function renderActivePanel(activeList) {
        const container = document.getElementById('activeAlertsList');
        const badge = document.getElementById('activeAlertCount');
        if (!container) return;

        if (badge) badge.innerText = activeList.length;

        if (activeList.length === 0) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="fas fa-check-circle" style="font-size:2rem; margin-bottom:10px; color:#4CD137;"></i><br>No active alerts matching criteria.</div>`;
            return;
        }

        container.innerHTML = activeList.map(a => {
            const isAck = a.status === 'acknowledged';
            const timeStr = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="alert-row-card severity-${a.severity} ${isAck ? 'acknowledged' : ''}">
                <div class="severity-bar"></div>
                <div class="alert-icon-wrap"><i class="fas ${a.icon || 'fa-bell'}"></i></div>
                <div class="alert-body">
                    <div class="alert-hd">
                        <div>
                            ${isAck ? `<div class="ack-badge">ACKNOWLEDGED</div>` : ''}
                            <div class="alert-title">${a.title}</div>
                            <div class="alert-meta"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${a.department} • Detected: ${timeStr}</div>
                        </div>
                    </div>
                    <div class="alert-desc">${a.description}</div>
                    
                    ${a.suggested_action ?
                    `<div class="alert-action"><i class="fas fa-lightbulb"></i> <strong>Action:</strong> ${a.suggested_action}</div>`
                    : ''}
                    
                    <div class="alert-buttons">
                        <button class="btn-ack" onclick="window.AlertsPage.acknowledgeAlert('${a.id}')"><i class="fas fa-user-check"></i> Acknowledge</button>
                        <button class="btn-res" onclick="window.AlertsPage.resolveAlert('${a.id}')"><i class="fas fa-check"></i> Resolve</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // 3. Heatmap
    function renderHeatmap() {
        const container = document.getElementById('heatmapGrid');
        if (!container) return;

        const activeOnly = allAlerts.filter(a => a.status !== 'resolved');

        container.innerHTML = DEPARTMENTS.map(dept => {
            const deptAlerts = activeOnly.filter(a => a.department === dept);
            let state = 'normal'; // normal, warning, critical
            if (deptAlerts.some(a => a.severity === 'critical')) state = 'critical';
            else if (deptAlerts.some(a => a.severity === 'warning')) state = 'warning';

            return `
            <div class="heatmap-tile heatmap-${state}">
                <div class="heatmap-bg"></div>
                <div class="dept-name">${dept}</div>
                <div class="dept-stat">${deptAlerts.length} Active Alerts</div>
            </div>
            `;
        }).join('');
    }

    // 4. History Table
    function renderHistoryTable(resList) {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        if (resList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px;">No resolved alerts matching criteria.</td></tr>`;
            return;
        }

        const sevBadge = (sev) => {
            const map = { critical: 'badge-critical', warning: 'badge-warning', info: 'badge-success' };
            return `<span class="badge ${map[sev] || 'badge-muted'}">${sev}</span>`;
        };

        tbody.innerHTML = resList.map(a => {
            const dForm = new Date(a.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const rForm = new Date(a.resolved_time).toLocaleString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <tr>
                <td style="font-family:monospace; color:var(--text-muted);">${a.id}</td>
                <td>${sevBadge(a.severity)}</td>
                <td>${a.department}</td>
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.title}</td>
                <td>${dForm}</td>
                <td>${rForm}</td>
                <td>${a.resolved_by || 'System'}</td>
            </tr>
            `;
        }).join('');
    }

    return {
        init,
        simulateIncident,
        acknowledgeAlert,
        resolveAlert,
        filterUI
    };
})();
