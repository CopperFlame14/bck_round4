/**
 * gemini.js — AI Response Client (Secure Architecture)
 * 
 * This module calls the DEPLOYED backend on Render first (bck3 project),
 * then falls back to the local backend proxy at /api/ai-response,
 * and finally uses local mock responses if both are unreachable.
 * 
 * The API key is stored server-side — never exposed to the browser.
 */

// Primary: deployed bck3 backend on Render (working API key)
const RENDER_ENDPOINT = 'https://bck-round3.onrender.com/suggest-response';
// Secondary: local Node.js backend proxy
const LOCAL_ENDPOINT = '/api/ai-response';

/**
 * Generate AI-powered clinical response for a patient query.
 * Tries Render backend → local backend → local mock fallback.
 * Returns: { category, urgency, suggested_reply, source }
 */
async function generateAIResponse(query, department = 'General Medicine', category = 'medical_query') {
    // 1. Try the Render backend (bck3 — known working)
    try {
        const renderRes = await fetch(RENDER_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (renderRes.ok) {
            const data = await renderRes.json();
            console.log('✅ AI response from Render backend');
            return {
                category: data.category || category,
                urgency: data.urgency || 'medium',
                suggested_reply: data.suggested_reply || DEFAULT_REPLY,
                source: 'render'
            };
        }
    } catch (e) {
        console.warn('Render backend unreachable:', e.message);
    }

    // 2. Try the local Node.js backend proxy
    try {
        const localRes = await fetch(LOCAL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, department, category })
        });

        if (localRes.ok) {
            const result = await localRes.json();
            // If the backend returned a real Gemini response, use it
            if (result.source === 'gemini' || result.source === 'cache') {
                if (!result.suggested_reply) result.suggested_reply = DEFAULT_REPLY;
                console.log(`✅ AI response from local backend (source: ${result.source})`);
                return result;
            }
            // If backend returned a fallback, use our rich local draft instead
            console.log('Local backend returned fallback. Using rich clinical draft.');
        }
    } catch (e) {
        console.warn('Local backend unreachable:', e.message);
    }

    // 3. Fall back to local mock
    console.warn('All backends unavailable. Using local mock response.');
    window.showToast?.('AI backend unavailable — using smart fallback.', 'warning');
    return _mockResponse(query, department, category);
}

// Legacy no-ops (kept for backward compatibility)
function setGeminiApiKey(key) { /* no-op — key is server-side */ }
function getGeminiApiKey() { return '(server-side)'; }

const DEFAULT_REPLY = 'Thank you for reaching out. A member of our team will review your query and respond shortly.';

// ── Rich Clinical Draft Generator (ported from bck3) ─────────────
// Generates detailed, department-specific, tone-aware responses

function _detectCategory(query) {
    const q = query.toLowerCase();
    if (/chest pain|can't breathe|breathing|bleeding|unconscious|stroke|heart attack|emergency|faint/i.test(q)) return 'emergency';
    if (/appointment|book|schedule|reschedule|cancel/i.test(q)) return 'appointment';
    if (/bill|invoice|insurance|payment|charge|cost/i.test(q)) return 'billing';
    if (/symptom|pain|fever|medication|treatment|diagnosis|headache|nausea|dizz|cough|rash|infection/i.test(q)) return 'medical_query';
    return 'general';
}

function _detectUrgency(query) {
    const q = query.toLowerCase();
    if (/chest pain|can't breathe|bleeding|unconscious|stroke|heart attack|emergency|severe|unbearable|worst/i.test(q)) return 'high';
    if (/persistent|recurring|worsening|days|week|concerned|worried/i.test(q)) return 'medium';
    return 'low';
}

function _generateRichDraft(query, department, category) {
    const detectedCategory = _detectCategory(query) || category || 'general';
    const urgency = _detectUrgency(query);

    // Department-specific response bodies
    const deptResponses = {
        'General Medicine': {
            medical_query: `Based on your description, here is our preliminary assessment:\n\n1. We recommend scheduling routine blood work (CBC, metabolic panel) to establish baseline values.\n2. Monitoring your symptoms and noting any changes will be helpful for your upcoming consultation.\n3. If symptoms worsen or new symptoms develop, please don't hesitate to contact us or visit the emergency department.\n\nA follow-up appointment is recommended within the next week.`,
            emergency: `This situation requires immediate medical attention.\n\n1. Please call emergency services (112) or visit the nearest Emergency Department immediately.\n2. Do not drive yourself — have someone bring you or call an ambulance.\n3. If you are experiencing chest pain, take an aspirin (if not allergic) and remain calm.\n4. Our Emergency team is available 24/7 and will prioritize your case upon arrival.\n\nDo not delay seeking care.`,
            appointment: `We would be happy to assist you with scheduling.\n\n1. Our reception desk is available Monday through Saturday, 8:00 AM to 6:00 PM.\n2. You can also use our online booking portal to select a convenient time slot.\n3. Please bring any previous medical records or test results to your appointment.\n4. If you need to cancel or reschedule, please notify us at least 24 hours in advance.`,
            billing: `Thank you for your billing inquiry.\n\n1. Our Patient Services team will review your account and provide a detailed breakdown.\n2. Please have your patient ID and any relevant invoice numbers ready.\n3. We accept multiple payment methods including insurance, credit cards, and payment plans.\n4. You can visit the Billing Department between 9 AM and 5 PM, Monday to Friday.`,
            general: `We have received your query and will address it promptly.\n\n1. A member of our team will review your message and respond within 24 hours.\n2. For urgent medical matters, please contact our reception directly or visit the Emergency Department.\n3. You can also reach us via our patient portal for non-urgent communications.`
        },
        'Cardiology': {
            medical_query: `Regarding your cardiovascular concerns:\n\n1. We recommend an ECG (heart rhythm test) as a starting point for evaluation.\n2. Depending on the results, an echocardiogram (heart ultrasound) may be helpful.\n3. Regular blood pressure monitoring at home is recommended — please keep a log.\n4. Please note any episodes of chest discomfort, shortness of breath, or irregular heartbeat.\n\nPlease avoid strenuous activity until your consultation.`,
            emergency: `We take cardiac emergencies extremely seriously.\n\n1. Call emergency services (112) IMMEDIATELY if you are experiencing chest pain or difficulty breathing.\n2. If available, take an aspirin (325mg) unless you are allergic.\n3. Sit or lie down in a comfortable position and try to remain calm.\n4. Do NOT exert yourself. Have someone else call for help if possible.\n\nOur cardiac emergency team is on standby 24/7.`
        },
        'Orthopedics': {
            medical_query: `For your orthopedic concern:\n\n1. We recommend an X-ray of the affected area as a first step.\n2. Rest and ice application can help manage pain and swelling.\n3. Over-the-counter anti-inflammatory medication (ibuprofen) may provide relief.\n4. Avoid putting excessive strain on the affected area.\n\nWe may recommend further imaging (MRI) if needed after reviewing the X-ray.`,
            emergency: `For acute orthopedic injuries:\n\n1. Immobilize the affected area — do not attempt to move a potentially broken bone.\n2. Apply ice wrapped in a cloth to reduce swelling.\n3. Visit the Emergency Department for immediate evaluation and imaging.\n4. If there is visible deformity or loss of sensation, call emergency services immediately.`
        },
        'Pediatrics': {
            medical_query: `Thank you for reaching out about your child's health.\n\n1. Children's symptoms can change rapidly — please monitor temperature, appetite, and activity levels.\n2. We recommend scheduling a pediatric consultation for proper evaluation.\n3. Ensure adequate hydration with water, clear fluids, or oral rehydration solutions.\n4. If your child develops a high fever (>103°F / 39.5°C), difficulty breathing, or becomes lethargic, seek emergency care.\n\nOur pediatrics team is experienced in addressing these concerns with care and sensitivity.`
        }
    };

    // Get the department-specific or default response
    const dept = deptResponses[department] || deptResponses['General Medicine'];
    const body = dept[detectedCategory] || dept['medical_query'] || dept['general'] || deptResponses['General Medicine']['general'];

    // Urgency addendum
    const urgencyNotes = {
        high: '\n\n⚠️ PRIORITY NOTE: This query has been flagged as HIGH urgency. Expedited review and response is recommended. If you are experiencing a medical emergency, please call 112 or visit the nearest emergency room immediately.',
        medium: '\n\nPlease note: Your query has been assigned MEDIUM priority. We aim to provide a thorough response within 24-48 hours.',
        low: ''
    };

    // Build the full response
    let response = `Dear Patient,\n\nThank you for reaching out to the ${department || 'Medical'} department. We have carefully reviewed your query and prepared the following preliminary response.\n\n`;
    response += `Regarding your ${detectedCategory === 'medical_query' ? 'medical' : detectedCategory} query:\n\n`;
    response += body;
    response += urgencyNotes[urgency] || '';
    response += `\n\nThis response has been generated for preliminary guidance only. Final clinical recommendations will be provided after staff review.\n\nBest regards,\n${department || 'Medical'} Department\nAI Hospital Intelligence Platform`;

    return {
        category: detectedCategory,
        urgency: urgency,
        suggested_reply: response,
        source: 'local_draft'
    };
}

// Simple fallback (used when _generateRichDraft somehow fails)
function _mockResponse(query, department, category) {
    return _generateRichDraft(query, department || 'General Medicine', category);
}

// Make available globally
window.GeminiService = {
    generateAIResponse,
    setGeminiApiKey,
    getGeminiApiKey
};
