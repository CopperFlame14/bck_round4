/**
 * analytics.js — KPI Cards, Chart.js Charts, Efficiency Gauge
 * Extracted and enhanced from bck1/bck_smartcare_analytics/scripts/dashboard.js + predict.js + insights.js
 */

// ── Mock Data for Demo Mode ───────────────────────────────────────
const MOCK_METRICS = {
    patientsToday: 142,
    avgWaitTime: 28,
    bedsAvailable: 67,
    bedsAvailable: 67,
    staffUtil: 78,
    efficiencyScore: 82
};

const MOCK_DEPT_DATA = [
    { dept: 'Emergency', count: 38, wait: 45 },
    { dept: 'Cardiology', count: 24, wait: 22 },
    { dept: 'Neurology', count: 18, wait: 31 },
    { dept: 'Orthopedics', count: 29, wait: 18 },
    { dept: 'Pediatrics', count: 21, wait: 14 },
    { dept: 'Dermatology', count: 12, wait: 20 },
];

const MOCK_WAIT_TREND = [18, 22, 31, 28, 25, 33, 29, 26, 34, 28, 24, 30, 27, 28, 26];

// Chart instances
let chartPatients = null, chartDept = null, chartWait = null;
let gaugeAnimFrame = null;

// ── KPI Cards ────────────────────────────────────────────────────
function renderKpiCards(metrics = MOCK_METRICS) {
    const container = document.getElementById('kpiGrid');
    if (!container) return;

    const cards = [
        {
            id: 'kpi-patients', icon: 'fa-users', color: '#2E86DE', bgOpacity: '12',
            label: 'Patients Today',
            value: metrics.patientsToday,
            delta: '↑ +12 from yesterday',
            deltaClass: 'delta-up', trend: 'rising'
        },
        {
            id: 'kpi-wait', icon: 'fa-clock', color: '#F39C12', bgOpacity: '12',
            label: 'Avg Wait Time',
            value: metrics.avgWaitTime + ' min',
            delta: 'Target: < 30 min',
            deltaClass: metrics.avgWaitTime > 30 ? 'delta-up' : 'delta-down', trend: ''
        },
        {
            id: 'kpi-beds', icon: 'fa-bed', color: '#4CD137', bgOpacity: '12',
            label: 'Available Beds',
            value: metrics.bedsAvailable,
            delta: `${100 - metrics.bedsAvailable} occupied of 100`,
            deltaClass: metrics.bedsAvailable < 20 ? 'delta-up' : 'delta-flat', trend: ''
        },

        {
            id: 'kpi-staff', icon: 'fa-user-md', color: '#8b5cf6', bgOpacity: '12',
            label: 'Staff Utilization',
            value: metrics.staffUtil + '%',
            delta: metrics.staffUtil > 90 ? '⚠ Overloaded' : 'Normal',
            deltaClass: metrics.staffUtil > 90 ? 'delta-up' : 'delta-flat', trend: ''
        },
        {
            id: 'kpi-score', icon: 'fa-chart-line', color: '#4CD137', bgOpacity: '12',
            label: 'Efficiency Score',
            value: metrics.efficiencyScore,
            delta: metrics.efficiencyScore > 70 ? '✓ Good' : metrics.efficiencyScore > 40 ? '⚠ Moderate' : '✗ Critical',
            deltaClass: metrics.efficiencyScore > 70 ? 'delta-down' : 'delta-up', trend: ''
        }
    ];

    container.innerHTML = cards.map(c => `
    <div class="kpi-card" id="${c.id}" style="--card-accent:${c.color};">
      <div class="kpi-icon" style="background:${c.color}${c.bgOpacity};color:${c.color};">
        <i class="fas ${c.icon}"></i>
      </div>
      <div class="kpi-value" id="${c.id}-val">${c.value}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-delta ${c.deltaClass}" id="${c.id}-delta">${c.delta}</div>
    </div>
  `).join('');
}

// ── Efficiency Gauge (Canvas) ─────────────────────────────────────
function renderEfficiencyGauge(score = MOCK_METRICS.efficiencyScore) {
    const canvas = document.getElementById('efficiencyGauge');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height * 0.7;
    const radius = Math.min(cx, cy) * 0.85;

    // Color based on score
    const color = score > 70 ? '#4CD137' : score > 40 ? '#F39C12' : '#E74C3C';

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background arc (full)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(200,200,200,0.15)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Foreground arc (score)
    const angle = Math.PI + (Math.PI * score / 100);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Score text
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1A202C';
    ctx.font = 'bold 2.6rem Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(score, cx, cy - 14);

    ctx.font = '500 0.9rem Inter, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Efficiency Score', cx, cy + 14);

    ctx.font = '500 0.75rem Inter, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(score > 70 ? 'Optimal' : score > 40 ? 'Moderate Load' : 'Critical', cx, cy + 34);
}

// ── Charts ───────────────────────────────────────────────────────
function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        text: isDark ? '#94a3b8' : '#475569',
        grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        palette: ['#2E86DE', '#4CD137', '#F39C12', '#E74C3C', '#8b5cf6', '#06b6d4', '#ec4899'],
    };
}

function chartDefaults() {
    const c = getChartColors();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: c.text, font: { family: 'Inter', size: 11 }, usePointStyle: true, padding: 14 },
                position: 'bottom'
            },
            tooltip: { backgroundColor: 'rgba(15,17,23,0.9)', titleColor: '#F1F5F9', bodyColor: '#94A3B8', padding: 10, cornerRadius: 8 }
        },
        scales: {
            x: { ticks: { color: c.text, font: { family: 'Inter', size: 10 } }, grid: { color: c.grid } },
            y: { beginAtZero: true, ticks: { color: c.text, font: { family: 'Inter', size: 10 } }, grid: { color: c.grid } }
        }
    };
}

function initCharts(deptData = MOCK_DEPT_DATA, waitTrend = MOCK_WAIT_TREND) {
    const c = getChartColors();
    const labels = deptData.map(d => d.dept);
    const counts = deptData.map(d => d.count);

    // Bar chart — Patient Volume
    const ctxP = document.getElementById('patientsChart')?.getContext('2d');
    if (ctxP) {
        if (chartPatients) { chartPatients.destroy(); }
        chartPatients = new Chart(ctxP, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Patients', data: counts, backgroundColor: c.palette.map(p => p + 'cc'), borderRadius: 8, borderSkipped: false }]
            },
            options: { ...chartDefaults() }
        });
    }

    // Doughnut chart — Dept workload
    const ctxD = document.getElementById('deptLoadChart')?.getContext('2d');
    if (ctxD) {
        if (chartDept) { chartDept.destroy(); }
        chartDept = new Chart(ctxD, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: counts, backgroundColor: c.palette, hoverOffset: 12, borderWidth: 0 }]
            },
            options: { ...chartDefaults(), cutout: '70%', scales: {} }
        });
    }

    // Line chart — Wait time trend
    const ctxW = document.getElementById('waitTimeChart')?.getContext('2d');
    if (ctxW) {
        if (chartWait) { chartWait.destroy(); }
        chartWait = new Chart(ctxW, {
            type: 'line',
            data: {
                labels: waitTrend.map((_, i) => `${i + 1}h`),
                datasets: [{
                    label: 'Wait Time (min)',
                    data: waitTrend,
                    borderColor: '#2E86DE',
                    backgroundColor: 'rgba(46,134,222,0.08)',
                    fill: true, tension: 0.4,
                    pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#2E86DE'
                }, {
                    label: 'Target (30 min)',
                    data: waitTrend.map(() => 30),
                    borderColor: 'rgba(231,76,60,0.5)',
                    borderDash: [6, 4], borderWidth: 1.5,
                    pointRadius: 0, fill: false
                }]
            },
            options: chartDefaults()
        });
    }
}

// ── Update from Firestore ─────────────────────────────────────────
function updateAnalyticsFromRecords(records) {
    if (!records || records.length === 0) {
        renderKpiCards();
        initCharts();
        renderEfficiencyGauge();
        return;
    }

    const active = records.filter(r => r.status !== 'discharged');
    const totalWait = active.reduce((s, r) => s + (r.processTime || 0), 0);
    const avgWait = active.length > 0 ? Math.round(totalWait / active.length) : 0;
    const bedsNeeded = active.filter(r => r.needsBed).length;
    const bedsAvail = Math.max(0, 100 - bedsNeeded);

    const waitPenalty = Math.min(40, (avgWait / 90) * 40);
    const bedPenalty = Math.min(25, (bedsNeeded / 100) * 25);
    const discharged = records.filter(r => r.status === 'discharged');
    const dischPct = records.length > 0 ? (discharged.length / records.length) * 100 : 50;
    const dischargeBonus = Math.min(15, (dischPct / 100) * 15);
    const longStay = active.filter(r => (r.processTime || 0) > 60).length;
    const overstayPen = Math.min(15, (longStay / Math.max(1, active.length)) * 15);
    const score = Math.max(0, Math.min(100, Math.round(100 - waitPenalty - bedPenalty - overstayPen + dischargeBonus)));

    // Dept breakdown
    const deptMap = {};
    records.forEach(r => {
        if (!deptMap[r.department]) deptMap[r.department] = { dept: r.department, count: 0, wait: 0 };
        deptMap[r.department].count++;
        deptMap[r.department].wait += r.processTime || 0;
    });
    const deptData = Object.values(deptMap);

    // Wait trend (last 15 records)
    const recent = records.slice(-15);
    const waitTrend = recent.map(r => r.processTime || 0);

    renderKpiCards({
        patientsToday: active.length,
        avgWaitTime: avgWait,
        bedsAvailable: bedsAvail,

        staffUtil: MOCK_METRICS.staffUtil,
        efficiencyScore: score
    });

    initCharts(deptData.length > 0 ? deptData : MOCK_DEPT_DATA, waitTrend.length > 5 ? waitTrend : MOCK_WAIT_TREND);
    renderEfficiencyGauge(score);
}

// ── Make globally accessible ──────────────────────────────────────
window.Analytics = { renderKpiCards, renderEfficiencyGauge, initCharts, updateAnalyticsFromRecords, MOCK_METRICS, MOCK_DEPT_DATA };
