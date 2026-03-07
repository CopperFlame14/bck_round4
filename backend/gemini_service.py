import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

_client = None

# Try newer models first; fall back if not available for the API key
GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

def _get_client():
    """Lazily initialise the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable is not set. "
                "Add it to a .env file in the project root or set it in your environment."
            )
        _client = genai.Client(api_key=api_key)
    return _client

async def generate_ai_response(
    query: str,
    department: str = "General Medicine",
    category: str = "medical_query",
) -> dict:
    """
    Sends a structured prompt to Google Gemini and returns a parsed JSON
    response containing category, urgency, and a suggested reply.
    Uses the SDK's async client to avoid blocking the FastAPI event loop.
    """

    prompt = f"""You are part of an internal hospital communication system used to respond to patient queries.
Hospital staff monitor the system in real time and review all responses before sending.

Department: {department}
Category: {category}
Patient Query: "{query}"

System Context:
- You are operating within a supervised hospital system where staff oversight is always present
- Focus on providing clear, helpful, and professional responses
- Do NOT include generic disclaimers such as "I am not a doctor" or similar statements
- Assume your responses are being reviewed by trained hospital staff

Your Requirements:
1. Respond in a professional and empathetic hospital communication tone
2. Provide practical guidance (scheduling appointments, contacting hospital, visiting emergency department)
3. CRITICAL — Urgency rules: The following MUST be classified as urgency "high" (never medium or low): chest pain, chest discomfort, difficulty breathing, shortness of breath, can't breathe, heart attack, stroke, severe bleeding, unconscious, collapse, choking, severe allergic reaction, overdose, suicide/self-harm, severe head injury, suspected stroke. If the patient query mentions any of these, set "urgency" to "high" and "category" to "emergency" when appropriate.
4. For other symptoms (e.g. mild headache, fever, appointment requests), use "medium" or "low" as appropriate.
5. Keep responses concise and clear (60-120 words)
6. Generate confident, professional responses suitable for direct patient communication

Classification Rules:
- emergency + high urgency: chest pain, breathing problems, heart attack, stroke, severe bleeding, unconscious, and similar life-threatening or urgent situations
- appointment: scheduling, rescheduling, cancellations
- medical_query: other health questions, symptoms (use medium or low urgency as appropriate)
- billing: payment, insurance, invoices
- general: other inquiries

Respond ONLY with valid JSON in this format:
{{
  "category": "<appointment|medical_query|billing|emergency|general>",
  "urgency": "<low|medium|high>",
  "suggested_reply": "<clear professional response suitable for hospital communication>"
}}"""

    last_error = None
    for model in GEMINI_MODELS:
        try:
            async with _get_client().aio as aclient:
                response = await aclient.models.generate_content(
                    model=model,
                    contents=prompt,
                )

            raw_text = (getattr(response, "text", None) or "").strip()
            if not raw_text:
                last_error = ValueError("Empty response from model")
                continue

            # Strip markdown code fences if Gemini wraps the JSON
            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`")
                if raw_text.lower().startswith("json"):
                    raw_text = raw_text[4:]
                raw_text = raw_text.strip()

            result = json.loads(raw_text)

            # Validate expected keys
            valid_categories = ["appointment", "medical_query", "billing", "emergency", "general"]
            valid_urgencies = ["low", "medium", "high"]

            if result.get("category") not in valid_categories:
                result["category"] = "general"
            if result.get("urgency") not in valid_urgencies:
                result["urgency"] = "medium"
            if "suggested_reply" not in result or not result["suggested_reply"]:
                result["suggested_reply"] = (
                    "Thank you for reaching out. A member of our team will get back to you shortly."
                )

            # Override: ensure critical symptoms are always high urgency (in case model misclassifies)
            query_lower = query.lower()
            critical_phrases = [
                "chest pain", "chest discomfort", "can't breathe", "can not breathe",
                "difficulty breathing", "shortness of breath", "heart attack", "stroke",
                "severe bleeding", "unconscious", "collapse", "choking", "overdose",
            ]
            if any(phrase in query_lower for phrase in critical_phrases):
                result["urgency"] = "high"
                if result.get("category") == "medical_query":
                    result["category"] = "emergency"

            return result

        except json.JSONDecodeError as e:
            last_error = e
            continue
        except Exception as e:
            last_error = e
            # Try next model (e.g. model not found or rate limit)
            continue

    # All models failed; return a safe fallback and let the caller handle it
    if last_error:
        raise RuntimeError(f"Gemini API error after trying all models: {last_error}") from last_error
    raise RuntimeError("Gemini API returned no valid response.")
