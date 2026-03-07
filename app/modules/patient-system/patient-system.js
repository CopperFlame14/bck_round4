/**
 * patient-system.js — Patient & Appointment Management
 * Adapted from bck2/BCK_TetherX_Round2 smart scheduler + no-show predictor
 */

const DEMO_APPOINTMENTS = [
    { id: 'APT-001', name: 'Vikram Anand', phone: '+91 98765 43210', department: 'Cardiology', date: '2026-03-10', time: 'Morning', status: 'confirmed', noShowRisk: 'Low', reason: 'Annual cardiac check' },
    { id: 'APT-002', name: 'Sita Sharma', phone: '+91 87654 32109', department: 'Neurology', date: '2026-03-11', time: 'Afternoon', status: 'pending', noShowRisk: 'Medium', reason: 'Recurring migraine' },
    { id: 'APT-003', name: 'Aakash Bose', phone: '+91 76543 21098', department: 'Orthopedics', date: '2026-03-09', time: 'Evening', status: 'confirmed', noShowRisk: 'High', reason: 'Knee surgery consult' },
    { id: 'APT-004', name: 'Kavitha Reddy', phone: '+91 65432 10987', department: 'Dermatology', date: '2026-03-12', time: 'Morning', status: 'pending', noShowRisk: 'Low', reason: 'Skin rash evaluation' },
];

let _appointments = [...DEMO_APPOINTMENTS];

// ── Smart Appointment Balancer (from bck2 scheduler.ts) ───────────
const DOCTOR_LOADS = {
    Cardiology: [{ name: 'Dr. Anand Raj', load: 8 }, { name: 'Dr. Priya M.', load: 12 }],
    Neurology: [{ name: 'Dr. Venkat R.', load: 6 }, { name: 'Dr. Aisha K.', load: 9 }],
    Orthopedics: [{ name: 'Dr. Suresh Kumar', load: 11 }, { name: 'Dr. Rekha V.', load: 7 }],
    Dermatology: [{ name: 'Dr. Meera N.', load: 4 }, { name: 'Dr. Arjun S.', load: 8 }],
    'General Medicine': [{ name: 'Dr. Ravi P.', load: 15 }, { name: 'Dr. Lake S.', load: 10 }],
    Emergency: [{ name: 'Dr. ON-CALL-1', load: 20 }, { name: 'Dr. ON-CALL-2', load: 18 }],
    Pediatrics: [{ name: 'Dr. Uma R.', load: 5 }, { name: 'Dr. Karan M.', load: 9 }],
};

function getBestDoctor(department) {
    const doctors = DOCTOR_LOADS[department];
    if (!doctors || doctors.length === 0) return 'Dr. Available';
    return doctors.reduce((best, d) => d.load < best.load ? d : best).name;
}

// ── No-Show Risk Prediction (from bck2 predictor.ts) ─────────────
function predictNoShowRisk(appointment) {
    const { date, time, department } = appointment;
    const daysUntil = Math.ceil((new Date(date) - Date.now()) / (86400000));
    let riskScore = 0;

    // Day-of-week factor
    const dow = new Date(date).getDay();
    if (dow === 1 || dow === 5) riskScore += 15; // Monday/Friday higher

    // Lead time factor
    if (daysUntil > 14) riskScore += 30;
    else if (daysUntil > 7) riskScore += 15;
    else if (daysUntil > 3) riskScore += 5;

    // Evening slots higher no-show
    if (time?.toLowerCase().includes('evening')) riskScore += 10;

    // Some depts have higher no-show rates
    if (['Psychiatry', 'Dermatology'].includes(department)) riskScore += 10;

    if (riskScore >= 35) return 'High';
    if (riskScore >= 15) return 'Medium';
    return 'Low';
}

// ── Load Appointments ─────────────────────────────────────────────
function loadAppointments() {
    try {
        const ref = window.FirebaseService?.getApptsRef?.();
        if (ref) {
            ref.orderBy('createdAt', 'desc').limit(30).onSnapshot(snap => {
                _appointments = snap.docs.length > 0
                    ? snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    : DEMO_APPOINTMENTS;
            });
            return;
        }
    } catch (e) { /* demo */ }

    const saved = JSON.parse(localStorage.getItem('demo_appointments') || '[]');
    _appointments = [...DEMO_APPOINTMENTS, ...saved];
}

// ── Book Appointment ──────────────────────────────────────────────
async function bookAppointment(data) {
    const doctor = getBestDoctor(data.department);
    const noShow = predictNoShowRisk(data);
    const id = 'APT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const appt = { id, ...data, assignedDoctor: doctor, noShowRisk: noShow, status: 'pending' };

    try {
        const ref = window.FirebaseService?.getApptsRef?.();
        if (ref) await window.FirebaseService.addDocument(ref, appt);
    } catch (e) {
        const saved = JSON.parse(localStorage.getItem('demo_appointments') || '[]');
        saved.unshift({ ...appt, createdAt: new Date().toISOString() });
        localStorage.setItem('demo_appointments', JSON.stringify(saved));
    }

    _appointments.unshift(appt);
    return appt;
}

// ── Cancel Appointment ────────────────────────────────────────────
async function cancelAppointment(id) {
    try {
        const ref = window.FirebaseService?.getApptsRef?.();
        if (ref) await ref.doc(id).update({ status: 'cancelled' });
    } catch (e) { /* demo */ }
    const a = _appointments.find(a => a.id === id);
    if (a) a.status = 'cancelled';
}

function getAppointments() { return _appointments; }

window.PatientSystem = { loadAppointments, bookAppointment, cancelAppointment, getBestDoctor, predictNoShowRisk, getAppointments };
