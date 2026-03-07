/**
 * patient-portal.js — Integrated Patient Portal
 */

let selectedUrgency = 'low';

function switchTab(tab) {
    document.getElementById('queryPanel').style.display = tab === 'query' ? 'block' : 'none';
    document.getElementById('apptPanel').style.display = tab === 'appt' ? 'block' : 'none';
    document.getElementById('tab-query').classList.toggle('active', tab === 'query');
    document.getElementById('tab-appt').classList.toggle('active', tab === 'appt');
}

function selectUrgency(level, el) {
    selectedUrgency = level;
    document.querySelectorAll('.urgency-pill').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
}

function toggleChip(el) { el.classList.toggle('selected'); }

function getSelectedSymptoms() {
    return Array.from(document.querySelectorAll('.symptom-chip.selected')).map(c => c.textContent).join(', ');
}

// Character count event listener setup is called in init
function initPatientPortal() {
    const qmsg = document.getElementById('q-message');
    if (qmsg) {
        qmsg.addEventListener('input', function () {
            document.getElementById('charCount').textContent = `${this.value.length} / 1000 characters`;
        });
    }
    const adate = document.getElementById('a-date');
    if (adate) {
        adate.min = new Date().toISOString().split('T')[0];
    }
}

async function submitQuery() {
    const name = document.getElementById('q-name').value.trim();
    const message = document.getElementById('q-message').value.trim();
    const dept = document.getElementById('q-dept').value;

    if (!name || !message || !dept) {
        window.showToast?.('Please fill in all required fields.', 'error');
        return;
    }

    const id = 'QRY-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const data = {
        id, name,
        email: document.getElementById('q-email').value.trim(),
        phone: document.getElementById('q-phone').value.trim(),
        age: document.getElementById('q-age').value || null,
        department: dept,
        urgency: selectedUrgency,
        symptoms: getSelectedSymptoms(),
        message,
        status: 'pending',
        source: 'patient_portal'
    };

    try {
        const ref = window.FirebaseService?.getQueriesRef();
        if (ref) await window.FirebaseService.addDocument(ref, data);
    } catch (e) {
        console.warn('Firestore save failed (demo mode)');
    }

    const queries = JSON.parse(localStorage.getItem('demo_queries') || '[]');
    queries.unshift({ ...data, createdAt: new Date().toISOString() });
    localStorage.setItem('demo_queries', JSON.stringify(queries));
    window.dispatchEvent(new Event('demo_queries_updated'));

    document.getElementById('queryTrackingId').textContent = id;
    document.getElementById('queryForm').style.display = 'none';
    document.getElementById('querySuccess').style.display = 'block';
    window.showToast?.('Query submitted successfully!', 'success');
}

async function submitAppointment() {
    const name = document.getElementById('a-name').value.trim();
    const phone = document.getElementById('a-phone').value.trim();
    const dept = document.getElementById('a-dept').value;
    const date = document.getElementById('a-date').value;

    if (!name || !phone || !dept || !date) {
        window.showToast?.('Please fill in all required fields.', 'error');
        return;
    }

    const id = 'APT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const data = {
        id, name, phone,
        email: document.getElementById('a-email').value.trim(),
        dob: document.getElementById('a-dob').value,
        department: dept,
        date, time: document.getElementById('a-time').value,
        reason: document.getElementById('a-reason').value.trim(),
        status: 'pending',
        source: 'patient_portal',
        noShowRisk: calcNoShowRisk(date)
    };

    try {
        const ref = window.FirebaseService?.getApptsRef();
        if (ref) await window.FirebaseService.addDocument(ref, data);
    } catch (e) {
        console.warn('Firestore save failed (demo mode)');
    }

    const appts = JSON.parse(localStorage.getItem('demo_appointments') || '[]');
    appts.unshift({ ...data, createdAt: new Date().toISOString() });
    localStorage.setItem('demo_appointments', JSON.stringify(appts));

    document.getElementById('apptTrackingId').textContent = id;
    document.getElementById('apptForm').style.display = 'none';
    document.getElementById('apptSuccess').style.display = 'block';
    window.showToast?.('Appointment requested successfully!', 'success');
}

function calcNoShowRisk(dateStr) {
    const apptDate = new Date(dateStr);
    const today = new Date();
    const daysDiff = Math.ceil((apptDate - today) / (1000 * 60 * 60 * 24));
    if (daysDiff > 14) return 'High';
    if (daysDiff > 7) return 'Medium';
    return 'Low';
}

function resetQueryForm() {
    document.getElementById('queryForm').style.display = 'block';
    document.getElementById('querySuccess').style.display = 'none';
    document.getElementById('q-name').value = '';
    document.getElementById('q-message').value = '';
}

function resetApptForm() {
    document.getElementById('apptForm').style.display = 'block';
    document.getElementById('apptSuccess').style.display = 'none';
}

window.PatientPortal = { initPatientPortal, switchTab, selectUrgency, toggleChip, submitQuery, submitAppointment, resetQueryForm, resetApptForm };
