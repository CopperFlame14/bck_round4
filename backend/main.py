import os
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root so it works regardless of cwd (e.g. uvicorn from backend/)
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.gemini_service import generate_ai_response

app = FastAPI(
    title="Hospital Response Suggestion System",
    description="Backend API that helps hospital staff draft responses, plus static file server.",
    version="1.0.0",
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Payload Model
class PatientQuery(BaseModel):
    query: str
    department: str = "General Medicine"
    category: str = "medical_query"

# Response Payload Model
class SuggestedResponse(BaseModel):
    category: str
    urgency: str
    suggested_reply: str
    source: str = "gemini"

# Simple cache dictionary
_cache = {}
CACHE_TTL = 300  # 5 minutes in seconds

# Mock fallbacks and category detection (same logic as before)
MOCK_RESPONSES = {
    'appointment': {'urgency': 'low', 'suggested_reply': 'Thank you for contacting us. We would be happy to assist you with scheduling an appointment. Please call our reception desk at your convenience or use our online booking portal to select an available slot with your preferred physician.'},
    'emergency': {'urgency': 'high', 'suggested_reply': 'URGENT: Based on the symptoms you have described, we strongly recommend you visit the Emergency Department immediately or call emergency services (112). Please do not delay — our Emergency team is available 24/7 to assist you.'},
    'billing': {'urgency': 'low', 'suggested_reply': 'Thank you for your inquiry regarding billing. Our Patient Services team will review your account and provide a detailed breakdown. Please have your patient ID ready. You can also visit the Billing Department between 9 AM and 5 PM, Monday to Friday.'},
    'medical_query': {'urgency': 'medium', 'suggested_reply': 'Thank you for sharing your health concern with us. Based on your description, we recommend scheduling a consultation with one of our specialists who can provide a thorough evaluation. Please contact our appointment desk to arrange a convenient time.'},
    'general': {'urgency': 'low', 'suggested_reply': 'Thank you for reaching out to our hospital. We have received your query and a member of our team will respond within 24 hours. For urgent matters, please contact our reception directly.'}
}

def detect_category(query: str) -> str:
    q = query.lower()
    if any(word in q for word in ['chest pain', "can't breathe", 'bleeding', 'unconscious', 'stroke', 'heart attack', 'emergency']):
        return 'emergency'
    if any(word in q for word in ['appointment', 'book', 'schedule', 'reschedule', 'cancel']):
        return 'appointment'
    if any(word in q for word in ['bill', 'invoice', 'insurance', 'payment', 'charge']):
        return 'billing'
    if any(word in q for word in ['symptom', 'pain', 'fever', 'medication', 'treatment', 'diagnosis', 'headache']):
        return 'medical_query'
    return 'general'

def mock_response(query: str, category: str) -> dict:
    detected = detect_category(query) or category or 'general'
    mock = MOCK_RESPONSES.get(detected, MOCK_RESPONSES['general'])
    return {'category': detected, 'urgency': mock['urgency'], 'suggested_reply': mock['suggested_reply']}


@app.post("/api/ai-response", response_model=SuggestedResponse)
async def generate_response(payload: PatientQuery):
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    query_text = payload.query.strip()
    cache_key = f"{query_text.lower()}|{payload.department}"
    
    # Check cache first
    cached_item = _cache.get(cache_key)
    if cached_item and time.time() - cached_item['timestamp'] < CACHE_TTL:
        print(f"📦 Cache hit for query: {query_text[:40]}...")
        result = cached_item['data']
        result['source'] = 'cache'
        return result

    try:
        # Attempt Gemini response
        gemini_result = await generate_ai_response(query_text, payload.department, payload.category)
        
        # Save to cache
        if len(_cache) > 100:
            # simple cache eviction
            oldest_key = min(_cache.keys(), key=lambda k: _cache[k]['timestamp'])
            del _cache[oldest_key]
            
        _cache[cache_key] = {'data': gemini_result, 'timestamp': time.time()}
        
        gemini_result['source'] = 'gemini'
        return gemini_result
        
    except Exception as e:
        print(f"⚠️ Gemini API failure or fallback triggered: {e}")
        # Fallback to mock logic
        mock = mock_response(query_text, payload.category)
        mock['source'] = 'fallback'
        return mock

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
        "cache_size": len(_cache)
    }


@app.get("/")
async def root():
    """Send visitors to the login page (app has no index.html)."""
    return RedirectResponse(url="/pages/login.html", status_code=302)


# Mount static files ONLY if the directory exists (protects against running in wrong directory)
app_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app")
if os.path.exists(app_dir):
    app.mount("/", StaticFiles(directory=app_dir, html=True), name="frontend")
else:
    print(f"⚠️ WARNING: Frontend app directory not found at {app_dir}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
