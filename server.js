/**
 * server.js — Secure Backend Proxy for AI Hospital Intelligence Platform
 * 
 * Architecture:
 *   Frontend → POST /api/ai-response → This server → Gemini API
 *   API key stays server-side, never exposed to browser.
 * 
 * Usage:
 *   npm install
 *   node server.js
 *   Open http://localhost:3001/pages/dashboard.html
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the frontend from /app directory
app.use(express.static(path.join(__dirname, 'app')));

// ── Simple In-Memory Cache ───────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        _cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data) {
    // Limit cache size to 100 entries
    if (_cache.size > 100) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, timestamp: Date.now() });
}

// ── Prompt Builder ───────────────────────────────────────────────────
function buildPrompt(query, department, category) {
    return `You are part of an internal hospital communication system used to respond to patient queries. 
Hospital staff monitor the system in real time and review all responses before sending.

Department: ${department}
Category: ${category}
Patient Query: "${query}"

System Context:
- Operate within a supervised hospital system where staff oversight is always present
- Provide clear, helpful, and professional responses
- Do NOT include generic disclaimers such as "I am not a doctor"
- Assume your responses are reviewed by trained hospital staff

Requirements:
1. Respond in a professional and empathetic hospital communication tone
2. Provide practical guidance (scheduling appointments, contacting hospital, visiting emergency department)
3. If symptoms indicate urgency (chest pain, breathing issues, severe bleeding), classify as "high" urgency
4. Keep responses concise and clear (60-120 words)

Classification Rules:
- appointment: scheduling, rescheduling, cancellations
- medical_query: health questions, symptoms
- billing: payment, insurance, invoices
- emergency: urgent medical situations requiring immediate attention
- general: other inquiries

Respond ONLY with valid JSON:
{
  "category": "<appointment|medical_query|billing|emergency|general>",
  "urgency": "<low|medium|high>",
  "suggested_reply": "<clear professional response>"
}`;
}

// ── Mock Fallback ────────────────────────────────────────────────────
const MOCK_RESPONSES = {
    appointment: { urgency: 'low', suggested_reply: 'Thank you for contacting us. We would be happy to assist you with scheduling an appointment. Please call our reception desk at your convenience or use our online booking portal to select an available slot with your preferred physician.' },
    emergency: { urgency: 'high', suggested_reply: 'URGENT: Based on the symptoms you have described, we strongly recommend you visit the Emergency Department immediately or call emergency services (112). Please do not delay — our Emergency team is available 24/7 to assist you.' },
    billing: { urgency: 'low', suggested_reply: 'Thank you for your inquiry regarding billing. Our Patient Services team will review your account and provide a detailed breakdown. Please have your patient ID ready. You can also visit the Billing Department between 9 AM and 5 PM, Monday to Friday.' },
    medical_query: { urgency: 'medium', suggested_reply: 'Thank you for sharing your health concern with us. Based on your description, we recommend scheduling a consultation with one of our specialists who can provide a thorough evaluation. Please contact our appointment desk to arrange a convenient time.' },
    general: { urgency: 'low', suggested_reply: 'Thank you for reaching out to our hospital. We have received your query and a member of our team will respond within 24 hours. For urgent matters, please contact our reception directly.' }
};

function detectCategory(query) {
    const q = query.toLowerCase();
    if (/chest pain|can't breathe|bleeding|unconscious|stroke|heart attack|emergency/i.test(q)) return 'emergency';
    if (/appointment|book|schedule|reschedule|cancel/i.test(q)) return 'appointment';
    if (/bill|invoice|insurance|payment|charge/i.test(q)) return 'billing';
    if (/symptom|pain|fever|medication|treatment|diagnosis|headache/i.test(q)) return 'medical_query';
    return 'general';
}

function mockResponse(query, category) {
    const detected = detectCategory(query) || category || 'general';
    const mock = MOCK_RESPONSES[detected] || MOCK_RESPONSES.general;
    return { category: detected, urgency: mock.urgency, suggested_reply: mock.suggested_reply };
}

// ── Gemini API Call with Retry ───────────────────────────────────────
async function callGemini(prompt, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 512,
                        responseMimeType: 'application/json'
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            // Rate limited — backoff and retry
            if (res.status === 429) {
                const wait = Math.pow(2, attempt + 1) * 1000;
                console.warn(`⏳ Gemini 429 rate limited. Waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                throw new Error('Rate limit exceeded after retries');
            }

            if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

            const data = await res.json();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (!rawText) {
                console.warn('⚠️ Gemini returned empty response. Reason:', data.candidates?.[0]?.finishReason);
                return null;
            }

            // Strip code fences
            rawText = rawText.trim();
            if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
            }

            // Parse JSON
            let result;
            try {
                result = JSON.parse(rawText);
            } catch (e) {
                const match = rawText.match(/\{[\s\S]*\}/);
                if (match) result = JSON.parse(match[0]);
                else throw new Error('Invalid JSON from Gemini');
            }

            // Validate fields
            const validCats = ['appointment', 'medical_query', 'billing', 'emergency', 'general'];
            const validUrgs = ['low', 'medium', 'high'];
            if (!validCats.includes(result.category)) result.category = 'general';
            if (!validUrgs.includes(result.urgency)) result.urgency = 'medium';
            if (!result.suggested_reply) result.suggested_reply = 'Thank you for reaching out. Our team will respond shortly.';

            return result;

        } catch (err) {
            console.error(`❌ Gemini attempt ${attempt + 1} failed:`, err.message);
            if (attempt >= retries) return null;
        }
    }
    return null;
}

// ── API Endpoint ─────────────────────────────────────────────────────
app.post('/api/ai-response', async (req, res) => {
    const { query, department = 'General Medicine', category = 'medical_query' } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or empty "query" field' });
    }

    // Check cache first
    const cacheKey = `${query.toLowerCase().trim()}|${department}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('📦 Cache hit for query:', query.substring(0, 40));
        return res.json({ ...cached, source: 'cache' });
    }

    // Try Gemini
    if (GEMINI_API_KEY) {
        const prompt = buildPrompt(query.trim(), department, category);
        const result = await callGemini(prompt);

        if (result) {
            setCache(cacheKey, result);
            console.log('✅ Gemini response generated for:', query.substring(0, 40));
            return res.json({ ...result, source: 'gemini' });
        }
    } else {
        console.warn('⚠️ GEMINI_API_KEY not set in .env');
    }

    // Fallback to mock
    const mock = mockResponse(query, category);
    console.log('🔄 Using mock fallback for:', query.substring(0, 40));
    return res.json({ ...mock, source: 'fallback' });
});

// ── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiConfigured: !!GEMINI_API_KEY,
        cacheSize: _cache.size,
        uptime: Math.floor(process.uptime())
    });
});

// ── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   AI Hospital Intelligence Platform — Server    ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 Dashboard: http://localhost:${PORT}/pages/dashboard.html`);
    console.log(`║  🔑 Gemini Key: ${GEMINI_API_KEY ? '✅ Configured (hidden)' : '❌ Not set'}`);
    console.log(`║  📡 API:       http://localhost:${PORT}/api/ai-response`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});
