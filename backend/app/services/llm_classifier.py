import json
import os
import urllib.error
import urllib.request


def classify_with_llm(text: str) -> dict | None:
    if os.getenv("OPENAI_API_KEY"):
        return _classify_with_openai(text)
    if os.getenv("GEMINI_API_KEY"):
        return _classify_with_gemini(text)
    return None


def _classification_prompt(text: str) -> str:
    return (
        "Classify this message for fraud risk. Return JSON only with keys: "
        "scam_type, risk_score, red_flags, recommendation, confidence. "
        f"Message: {text}"
    )


def _classify_with_openai(text: str) -> dict | None:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    payload = {
        "model": model,
        "input": _classification_prompt(text),
        "text": {"format": {"type": "json_object"}},
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return _safe_parse_response(request, "openai")


def _classify_with_gemini(text: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": _classification_prompt(text),
                    }
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return _safe_parse_response(request, "gemini")


def _safe_parse_response(request: urllib.request.Request, provider: str) -> dict | None:
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    try:
        if provider == "openai":
            output_text = payload["output"][0]["content"][0]["text"]
        else:
            output_text = payload["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(output_text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None

    required_keys = {"scam_type", "risk_score", "red_flags", "recommendation", "confidence"}
    if not required_keys.issubset(parsed):
        return None
    return parsed
