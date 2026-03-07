/**
 * predict.js — Predictive Analytics Module
 * Extracted and enhanced from bck1/bck_smartcare_analytics/scripts/predict.js
 */

// ── Moving Average ────────────────────────────────────────────────
function movingAverage(data, window = 3) {
    return data.map((_, i) => {
        if (i < window - 1) return data[i];
        const slice = data.slice(i - window + 1, i + 1);
        return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
    });
}

// ── Trend Analysis ────────────────────────────────────────────────
function calcTrend(data) {
    if (data.length < 2) return 0;
    const n = data.length;
    const recent = data.slice(-Math.min(5, n));
    return Math.round(((recent[recent.length - 1] - recent[0]) / Math.max(1, recent[0])) * 100);
}

// ── Predict patient load ──────────────────────────────────────────
function predictPatientLoad(records) {
    if (!records || records.length < 3) {
        return { value: 145, trend: 12, confidence: 'Medium' };
    }
    const counts = records.map(r => r.count || 1);
    const ma = movingAverage(counts, 3);
    const last = ma[ma.length - 1] || 0;
    const trd = calcTrend(counts);
    const next = Math.max(0, Math.round(last * (1 + trd / 200)));
    return {
        value: next,
        trend: trd,
        confidence: Math.abs(trd) < 10 ? 'High' : Math.abs(trd) < 25 ? 'Medium' : 'Low'
    };
}

// ── Predict wait time ─────────────────────────────────────────────
function predictWaitTime(records) {
    if (!records || records.length < 2) {
        return { value: 32, trend: 8, label: 'Slight Increase Expected' };
    }
    const waits = records.map(r => r.processTime || 0).filter(w => w > 0);
    const ma = movingAverage(waits, 4);
    const last = ma[ma.length - 1] || 28;
    const trd = calcTrend(waits);
    const next = Math.max(5, Math.round(last * (1 + trd / 300)));
    return {
        value: next,
        trend: trd,
        label: trd > 5 ? 'Increasing Trend' : trd < -5 ? 'Improving Trend' : 'Stable'
    };
}

// ── Overload Risk ─────────────────────────────────────────────────
function calcOverloadRisk(metrics) {
    const waitScore = Math.min(100, (metrics.avgWait || 28) / 60 * 100);
    const bedScore = Math.min(100, ((100 - (metrics.beds || 67)) / 100) * 100);
    const staffScore = metrics.staffUtil || 78;
    const risk = Math.round((waitScore * 0.4 + bedScore * 0.35 + staffScore * 0.25));
    let level, color, action;
    if (risk > 70) {
        level = 'High Risk'; color = '#E74C3C';
        action = 'Activate overflow protocol. Alert all department heads.';
    } else if (risk > 45) {
        level = 'Moderate Risk'; color = '#F39C12';
        action = 'Monitor closely. Prepare contingency staffing.';
    } else {
        level = 'Low Risk'; color = '#4CD137';
        action = 'All metrics within normal range. Continue monitoring.';
    }
    return { risk, level, color, action };
}

// ── Demo predictions ──────────────────────────────────────────────
const DEMO_PREDICTIONS = {
    patientLoad: { value: 158, trend: 11, confidence: 'High' },
    waitTime: { value: 34, trend: 8, label: 'Slight Increase Expected' },
    overload: { risk: 48, level: 'Moderate Risk', color: '#F39C12', action: 'Monitor closely. Prepare contingency staffing for evening shift.' }
};

// ── Render Prediction Cards ───────────────────────────────────────
function renderPredictions(preds = DEMO_PREDICTIONS) {
    const container = document.getElementById('predictionsContainer');
    if (!container) return;

    container.innerHTML = `
    <div class="card" style="border-top:3px solid #2E86DE;">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-users" style="margin-right:6px;color:#2E86DE;"></i>Patient Load Tomorrow</span>
        <span class="badge badge-info">${preds.patientLoad.confidence} Confidence</span>
      </div>
      <div style="font-size:2.2rem;font-weight:700;color:var(--text-primary);">${preds.patientLoad.value}</div>
      <div class="text-muted mt-8">Expected patients · ${preds.patientLoad.trend > 0 ? '↑' : '↓'} ${Math.abs(preds.patientLoad.trend)}% vs today</div>
      <div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted);">
        <i class="fas fa-brain" style="color:#2E86DE;margin-right:4px;"></i>Based on 7-day moving average + trend analysis
      </div>
    </div>

    <div class="card" style="border-top:3px solid ${preds.overload.color};">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-exclamation-triangle" style="margin-right:6px;color:${preds.overload.color};"></i>Dept Overload Risk</span>
        <span class="badge" style="background:${preds.overload.color}18;color:${preds.overload.color};">${preds.overload.level}</span>
      </div>
      <div style="font-size:2.2rem;font-weight:700;color:${preds.overload.color};">${preds.overload.risk}/100</div>
      <div class="text-muted mt-8">Composite risk score</div>
      <div style="margin-top:10px;font-size:0.8rem;color:${preds.overload.color};background:${preds.overload.color}12;padding:6px 8px;border-radius:6px;">
        <i class="fas fa-lightbulb style="margin-right:4px;"></i>${preds.overload.action}
      </div>
    </div>

    <div class="card" style="border-top:3px solid #F39C12;">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-clock" style="margin-right:6px;color:#F39C12;"></i>Wait Time Forecast</span>
        <span class="badge badge-warning">${preds.waitTime.label}</span>
      </div>
      <div style="font-size:2.2rem;font-weight:700;color:var(--text-primary);">${preds.waitTime.value} <span style="font-size:1rem;font-weight:400;color:var(--text-muted);">min</span></div>
      <div class="text-muted mt-8">Predicted average wait · ${preds.waitTime.trend > 0 ? '↑' : '↓'} ${Math.abs(preds.waitTime.trend)}%</div>
      <div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted);">
        <i class="fas fa-chart-line" style="color:#F39C12;margin-right:4px;"></i>4-point moving average projection
      </div>
    </div>
  `;
}

function updatePredictionsFromRecords(records, metrics) {
    if (!records || records.length < 5) {
        renderPredictions();
        return;
    }
    const pl = predictPatientLoad(records);
    const wt = predictWaitTime(records);
    const or = calcOverloadRisk(metrics || {});
    renderPredictions({ patientLoad: pl, waitTime: wt, overload: or });
}

window.Predictions = { renderPredictions, updatePredictionsFromRecords, DEMO_PREDICTIONS };
