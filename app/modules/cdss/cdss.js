/**
 * cdss.js — Clinical Decision Support System
 * Ported from cf2/insight-doctor-aid rule engine
 */

// ── Rule Engine ───────────────────────────────────────────────────
const CLINICAL_RULES = [
  {
    id: 'hypertension', name: 'Hypertension Risk',
    check: v => parseInt(v.systolic) > 140 || parseInt(v.diastolic) > 90,
    severity: 'warning', icon: 'fa-heart', dept: 'Cardiology',
    message: (v) => `BP reading of ${v.systolic}/${v.diastolic} mmHg exceeds normal range (120/80). Hypertension risk detected.`
  },
  {
    id: 'diabetes', name: 'Diabetes Risk',
    check: v => parseInt(v.bloodSugar) > 200,
    severity: 'warning', icon: 'fa-tint', dept: 'Endocrinology',
    message: (v) => `Blood glucose at ${v.bloodSugar} mg/dL. Severely elevated — possible hyperglycemia.`
  },
  {
    id: 'fever_infection', name: 'Possible Infection',
    check: v => parseFloat(v.temperature) > 102 && (v.symptoms || '').toLowerCase().includes('cough'),
    severity: 'warning', icon: 'fa-thermometer-full', dept: 'General Medicine',
    message: () => `High fever (>102°F) with cough — possible respiratory infection.`
  },
  {
    id: 'shock', name: 'Possible Shock — CRITICAL',
    check: v => parseInt(v.heartRate) > 120 && parseInt(v.systolic) < 90,
    severity: 'critical', icon: 'fa-heart-broken', dept: 'Emergency',
    message: (v) => `HR ${v.heartRate} BPM with low BP ${v.systolic}/${v.diastolic}. POSSIBLE SHOCK — immediate emergency intervention required.`
  },
  {
    id: 'hypoxia', name: 'Hypoxia Risk',
    check: v => parseInt(v.oxygenLevel) < 92,
    severity: 'critical', icon: 'fa-lungs', dept: 'Pulmonology',
    message: (v) => `SpO₂ at ${v.oxygenLevel}% — critically low. Supplemental oxygen required immediately.`
  },
  {
    id: 'tachycardia', name: 'Tachycardia Detected',
    check: v => parseInt(v.heartRate) > 100,
    severity: 'warning', icon: 'fa-heartbeat', dept: 'Cardiology',
    message: (v) => `Heart rate ${v.heartRate} BPM exceeds normal range (60–100 BPM).`
  },
  {
    id: 'grade3_hyp', name: 'Severe Hypertension',
    check: v => parseInt(v.systolic) > 180,
    severity: 'critical', icon: 'fa-exclamation-triangle', dept: 'Emergency',
    message: (v) => `BP ${v.systolic}/${v.diastolic} — Hypertensive crisis. Immediate medical attention required.`
  }
];

// ── Drug Interactions ─────────────────────────────────────────────
const DRUG_INTERACTIONS = [
  { drugs: ['warfarin', 'aspirin'], risk: 'HIGH', message: 'Warfarin + Aspirin significantly increases bleeding risk.' },
  { drugs: ['metformin', 'alcohol'], risk: 'HIGH', message: 'Metformin + Alcohol → risk of lactic acidosis.' },
  { drugs: ['ssri', 'tramadol'], risk: 'HIGH', message: 'SSRI + Tramadol → risk of serotonin syndrome.' },
  { drugs: ['ace inhibitor', 'potassium'], risk: 'MODERATE', message: 'ACE inhibitor + potassium supplements → hyperkalemia risk.' },
  { drugs: ['nsaid', 'anticoagulant'], risk: 'HIGH', message: 'NSAIDs + anticoagulants → significant bleeding risk.' },
];

// ── Department Recommendations ────────────────────────────────────
const DEPT_MAP = [
  { symptoms: ['chest pain', 'palpitations', 'hypertension'], dept: 'Cardiology' },
  { symptoms: ['headache', 'seizure', 'paralysis', 'vision'], dept: 'Neurology' },
  { symptoms: ['breathing', 'shortness of breath', 'cough', 'wheeze'], dept: 'Pulmonology' },
  { symptoms: ['rash', 'skin', 'acne', 'itch'], dept: 'Dermatology' },
  { symptoms: ['fracture', 'joint', 'bone', 'muscle', 'sprain'], dept: 'Orthopedics' },
  { symptoms: ['fever', 'fatigue', 'infection', 'virus'], dept: 'General Medicine' },
  { symptoms: ['stomach', 'abdomen', 'nausea', 'vomit', 'diarrhea'], dept: 'Gastroenterology' },
  { symptoms: ['child', 'infant', 'pediatric'], dept: 'Pediatrics' },
  { symptoms: ['emergency', 'unconscious', 'shock', 'bleeding'], dept: 'Emergency' },
];

// ── Run Analysis ──────────────────────────────────────────────────
function runCDSS(vitals) {
  const alerts = CLINICAL_RULES.filter(r => { try { return r.check(vitals); } catch { return false; } });
  const drugs = checkDrugInteractions(vitals.medications || '');
  const dept = suggestDepartment(vitals.symptoms || '');
  const riskScore = calcRiskScore(vitals);

  return { alerts, drugs, dept, riskScore, _vitals: vitals };
}

function checkDrugInteractions(meds) {
  if (!meds) return [];
  const m = meds.toLowerCase();
  return DRUG_INTERACTIONS.filter(i => i.drugs.some(d => m.includes(d)));
}

function suggestDepartment(symptomsText) {
  if (!symptomsText) return 'General Medicine';
  const s = symptomsText.toLowerCase();
  for (const entry of DEPT_MAP) {
    if (entry.symptoms.some(kw => s.includes(kw))) return entry.dept;
  }
  return 'General Medicine';
}

function calcRiskScore(v) {
  let score = 0;
  const sys = parseInt(v.systolic) || 0;
  const bs = parseInt(v.bloodSugar) || 0;
  const hr = parseInt(v.heartRate) || 0;
  const ox = parseInt(v.oxygenLevel) || 100;
  const age = parseInt(v.age) || 0;

  if (sys > 140) score += 20;
  if (sys > 180) score += 30;
  if (bs > 200) score += 25;
  if (hr > 100) score += 15;
  if (ox < 92) score += 40;
  if (age > 60) score += 10;
  return Math.min(100, score);
}

// ── Render CDSS Panel ─────────────────────────────────────────────
function renderCDSS(result) {
  const container = document.getElementById('cdssResultContainer');
  if (!container) return;
  if (!result) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🩺</div><h3>Enter Patient Vitals</h3><p>Fill in the form above and click "Analyze" to see clinical recommendations.</p></div>`;
    return;
  }

  const { alerts, drugs, dept, riskScore } = result;
  const riskColor = riskScore > 70 ? '#E74C3C' : riskScore > 40 ? '#F39C12' : '#4CD137';
  const riskLabel = riskScore > 70 ? 'High Risk' : riskScore > 40 ? 'Moderate' : 'Low Risk';

  container.innerHTML = `
    <!-- Risk Score -->
    <div class="card" style="border-top:3px solid ${riskColor};margin-bottom:16px;">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-chart-pie" style="margin-right:6px;color:${riskColor};"></i>Patient Risk Score</span>
        <span class="badge" style="background:${riskColor}18;color:${riskColor};">${riskLabel}</span>
      </div>
      <div style="font-size:2.5rem;font-weight:800;color:${riskColor};">${riskScore} <span style="font-size:1rem;font-weight:400;color:var(--text-muted);">/ 100</span></div>
      <div style="margin-top:10px;">
        <div style="height:6px;background:var(--bg-secondary);border-radius:10px;overflow:hidden;">
          <div style="height:100%;width:${riskScore}%;background:${riskColor};border-radius:10px;transition:width 1s;"></div>
        </div>
      </div>
      <div style="margin-top:12px;padding:8px;background:rgba(46,134,222,0.06);border-radius:8px;font-size:0.82rem;color:#2E86DE;">
        <i class="fas fa-hospital" style="margin-right:5px;"></i><strong>Recommended Department:</strong> ${dept}
      </div>
    </div>

    <!-- Clinical Alerts -->
    ${alerts.length > 0 ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><span class="card-title"><i class="fas fa-exclamation-triangle" style="margin-right:6px;color:#E74C3C;"></i>Clinical Alerts (${alerts.length})</span></div>
      ${alerts.map(a => `
        <div class="alert-card ${a.severity}" style="margin-bottom:8px;">
          <div class="alert-icon"><i class="fas ${a.icon}"></i></div>
          <div class="alert-content">
            <div class="alert-title">${a.name}</div>
            <div class="alert-desc">${a.message(result._vitals || {})}</div>
            <div class="alert-meta"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>Refer to: ${a.dept}</div>
          </div>
        </div>
      `).join('')}
    </div>` : '<div class="card" style="margin-bottom:16px;"><div style="text-align:center;color:#4CD137;padding:16px;"><i class="fas fa-check-circle" style="font-size:1.5rem;"></i><div style="margin-top:8px;font-weight:600;">No Critical Clinical Alerts</div></div></div>'}

    <!-- Drug Interactions -->
    ${drugs.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-top:3px solid #E74C3C;">
      <div class="card-header"><span class="card-title"><i class="fas fa-pills" style="margin-right:6px;color:#E74C3C;"></i>Drug Interaction Warnings</span></div>
      ${drugs.map(d => `
        <div style="padding:10px;background:rgba(231,76,60,0.06);border-radius:8px;margin-bottom:6px;border-left:3px solid ${d.risk === 'HIGH' ? '#E74C3C' : '#F39C12'}">
          <span class="badge ${d.risk === 'HIGH' ? 'badge-critical' : 'badge-warning'}" style="margin-right:8px;">${d.risk}</span>
          <span style="font-size:0.85rem;">${d.message}</span>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

window.CDSS = { runCDSS, renderCDSS };
