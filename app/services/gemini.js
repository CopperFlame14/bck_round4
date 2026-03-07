/**
 * gemini.js — AI Response Client (Secure Architecture)
 * 
 * This module calls the BACKEND PROXY at /api/ai-response
 * instead of calling Google Gemini directly.
 * 
 * The API key is stored server-side in .env — never exposed to the browser.
 * Falls back to local mock responses if the backend is unreachable.
 */

// Backend proxy endpoint (relative URL — works when served by server.js)
const AI_ENDPOINT = '/api/ai-response';

/**
 * Generate AI-powered clinical response for a patient query.
 * Calls the secure backend proxy which handles Gemini API + caching + retry.
 * Returns: { category, urgency, suggested_reply, source }
 */
async function generateAIResponse(query, department = 'General Medicine', category = 'medical_query') {
    try {
        const res = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, department, category })
        });

        if (!res.ok) {
            console.warn(`Backend proxy returned ${res.status}. Using local fallback.`);
            return _mockResponse(query, department, category);
        }

        const result = await res.json();

        // Validate response structure
        if (!result.suggested_reply) {
            result.suggested_reply = DEFAULT_REPLY;
        }

        console.log(`✅ AI response received (source: ${result.source || 'backend'})`);
        return result;

    } catch (err) {
        // Network error — backend unreachable (e.g. running from file://)
        console.warn('Backend proxy unreachable. Using local mock response.', err.message);
        window.showToast?.('AI backend unavailable — using smart fallback.', 'warning');
        return _mockResponse(query, department, category);
    }
}

// Legacy no-ops (kept for backward compatibility)
function setGeminiApiKey(key) { /* no-op — key is server-side */ }
function getGeminiApiKey() { return '(server-side)'; }

const DEFAULT_REPLY = 'Thank you for reaching out. A member of our team will review your query and respond shortly.';

// ── Mock Responses (fallback when backend is unreachable) ─────────────
const MOCK_RESPONSES = {
    appointment: {
        urgency: 'low',
        suggested_reply: 'Thank you for contacting us. We would be happy to assist you with scheduling an appointment. Please call our reception desk at your convenience or use our online booking portal to select an available slot with your preferred physician.'
    },
    emergency: {
        urgency: 'high',
        suggested_reply: 'URGENT: Based on the symptoms you have described, we strongly recommend you visit the Emergency Department immediately or call emergency services (112). Please do not delay — our Emergency team is available 24/7 to assist you.'
    },
    billing: {
        urgency: 'low',
        suggested_reply: 'Thank you for your inquiry regarding billing. Our Patient Services team will review your account and provide a detailed breakdown. Please have your patient ID ready. You can also visit the Billing Department between 9 AM and 5 PM, Monday to Friday.'
    },
    medical_query: {
        urgency: 'medium',
        suggested_reply: 'Thank you for sharing your health concern with us. Based on your description, we recommend scheduling a consultation with one of our specialists who can provide a thorough evaluation. Please contact our appointment desk to arrange a convenient time.'
    },
    general: {
        urgency: 'low',
        suggested_reply: 'Thank you for reaching out to our hospital. We have received your query and a member of our team will respond within 24 hours. For urgent matters, please contact our reception directly.'
    }
};

function _detectCategory(query) {
    const q = query.toLowerCase();
    if (/chest pain|can't breathe|bleeding|unconscious|stroke|heart attack|emergency/i.test(q)) return 'emergency';
    if (/appointment|book|schedule|reschedule|cancel/i.test(q)) return 'appointment';
    if (/bill|invoice|insurance|payment|charge/i.test(q)) return 'billing';
    if (/symptom|pain|fever|medication|treatment|diagnosis|headache/i.test(q)) return 'medical_query';
    return 'general';
}

function _mockResponse(query, department, category) {
    const detectedCategory = _detectCategory(query) || category || 'general';
    const mock = MOCK_RESPONSES[detectedCategory] || MOCK_RESPONSES.general;
    return {
        category: detectedCategory,
        urgency: mock.urgency,
        suggested_reply: mock.suggested_reply,
        source: 'local_fallback'
    };
}

// Make available globally
window.GeminiService = {
    generateAIResponse,
    setGeminiApiKey,
    getGeminiApiKey
};
