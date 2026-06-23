import re
from collections import Counter
from urllib.parse import urlparse

from app.services.dataset_matcher import get_dataset_matcher
from app.services.llm_classifier import classify_with_llm
from app.services.scam_patterns import analyze_content_patterns
from app.services.threat_intel import check_entity


PHONE_REGEX = re.compile(r"(?:(?:\+?91[\s-]?)?[6-9]\d{9})")
UPI_REGEX = re.compile(r"\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b")
URL_REGEX = re.compile(
    r"(?<!@)\bhttps?://[^\s,]+|(?<!@)\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s,]*)?"
)
EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")


def analyze_message(message: str, city: str | None = None) -> dict:
    text = message or ""

    raw_entities = {
        "phone_numbers": PHONE_REGEX.findall(text),
        "upi_ids": UPI_REGEX.findall(text),
        "urls": URL_REGEX.findall(text),
        "emails": EMAIL_REGEX.findall(text),
    }
    raw_entities["upi_ids"] = [
        value for value in raw_entities["upi_ids"] if value not in raw_entities["emails"]
    ]

    extracted_entities = {
        key: _unique_preserve_order(_clean_entities(values))
        for key, values in raw_entities.items()
    }

    pattern_analysis = analyze_content_patterns(text, extracted_entities["urls"])
    llm_analysis = classify_with_llm(text)
    if llm_analysis:
        pattern_analysis = _merge_llm_analysis(pattern_analysis, llm_analysis)
    dataset_match_summary = get_dataset_matcher().match(text)
    if (
        dataset_match_summary["matched"]
        and dataset_match_summary["suggested_scam_type"]
        and pattern_analysis["scam_type"] in ["Safe / Normal Message", "Unknown Suspicious Message"]
    ):
        pattern_analysis["scam_type"] = dataset_match_summary["suggested_scam_type"]

    red_flags = list(pattern_analysis["red_flags"])
    if dataset_match_summary["matched"]:
        red_flags.append(
            f"Similar to known {dataset_match_summary['suggested_scam_type']} examples in the local dataset."
        )

    if extracted_entities["upi_ids"]:
        red_flags.append("Contains UPI IDs or payment handles.")
    if extracted_entities["urls"]:
        red_flags.append("Contains links that should be verified before opening.")
    if extracted_entities["phone_numbers"]:
        red_flags.append("Contains phone numbers asking for contact or verification.")

    threat_intel_matches = _check_threat_intel(extracted_entities)
    known_matches = [
        match for match in threat_intel_matches if match["is_known_suspect"]
    ]
    for match in known_matches:
        red_flags.append(
            f"{match['entity_type']} {match['value']} appears in the local suspect demo list."
        )

    entity_repeats = _count_repeated_entities(raw_entities)
    if entity_repeats:
        red_flags.append("Repeats the same contact, payment, or link entity multiple times.")

    entity_breakdown = _entity_score_breakdown(
        extracted_entities=extracted_entities,
        known_matches=known_matches,
        entity_repeats=entity_repeats,
    )
    dataset_breakdown = _dataset_score_breakdown(dataset_match_summary)
    risk_score_breakdown = (
        pattern_analysis["risk_score_breakdown"] + dataset_breakdown + entity_breakdown
    )
    risk_score = _score_from_breakdown(risk_score_breakdown)

    scam_type = pattern_analysis["scam_type"]

    return {
        "risk_score": risk_score,
        "risk_score_breakdown": risk_score_breakdown,
        "verdict": verdict_for_score(risk_score),
        "scam_type": scam_type,
        "red_flags": _unique_preserve_order(red_flags),
        "extracted_entities": extracted_entities,
        "threat_intel_matches": threat_intel_matches,
        "recommendation": pattern_analysis["recommendation"],
        "ai_pattern_summary": pattern_analysis["ai_pattern_summary"],
        "dataset_match_summary": dataset_match_summary,
    }


def _check_threat_intel(extracted_entities: dict) -> list[dict]:
    checks = []
    entity_map = {
        "phone_numbers": "phone_number",
        "upi_ids": "upi_id",
        "emails": "email",
    }

    for collection_name, entity_type in entity_map.items():
        for value in extracted_entities[collection_name]:
            result = check_entity(entity_type, value)
            if result["is_known_suspect"]:
                checks.append({"entity_type": entity_type, "value": value, **result})

    for url in extracted_entities["urls"]:
        domain = _domain_from_url(url)
        if not domain:
            continue
        result = check_entity("domain", domain)
        if result["is_known_suspect"]:
            checks.append({"entity_type": "domain", "value": domain, **result})

    return checks


def _entity_score_breakdown(
    extracted_entities: dict,
    known_matches: list[dict],
    entity_repeats: int,
) -> list[dict]:
    breakdown = []

    contact_points = min(
        10,
        len(extracted_entities["phone_numbers"]) * 4
        + len(extracted_entities["urls"]) * 4
        + len(extracted_entities["emails"]) * 4,
    )
    if contact_points:
        breakdown.append({"label": "Suspicious contact or link entity", "points": contact_points})

    if known_matches:
        breakdown.append(
            {
                "label": "Known suspect intelligence match",
                "points": min(25, sum(max(8, match["confidence"] // 10) for match in known_matches)),
            }
        )

    if entity_repeats:
        breakdown.append(
            {"label": "Repeated entity inside message", "points": min(10, entity_repeats * 3)}
        )

    return breakdown


def _dataset_score_breakdown(dataset_match_summary: dict) -> list[dict]:
    if not dataset_match_summary["matched"] or not dataset_match_summary["score_boost"]:
        return []
    return [
        {
            "label": "Pattern knowledge base match",
            "points": dataset_match_summary["score_boost"],
        }
    ]


def _score_from_breakdown(breakdown: list[dict]) -> int:
    return min(100, sum(item["points"] for item in breakdown))


def _merge_llm_analysis(pattern_analysis: dict, llm_analysis: dict) -> dict:
    llm_score = int(llm_analysis.get("risk_score", 0) or 0)
    if llm_score > pattern_analysis["content_pattern_score"]:
        pattern_analysis["scam_type"] = llm_analysis.get("scam_type") or pattern_analysis["scam_type"]
        pattern_analysis["recommendation"] = (
            llm_analysis.get("recommendation") or pattern_analysis["recommendation"]
        )
        pattern_analysis["red_flags"] = _unique_preserve_order(
            pattern_analysis["red_flags"] + list(llm_analysis.get("red_flags", []))
        )
        pattern_analysis["risk_score_breakdown"].append(
            {"label": "Optional LLM pattern classification", "points": min(30, llm_score)}
        )
        pattern_analysis["content_pattern_score"] = min(
            75, sum(item["points"] for item in pattern_analysis["risk_score_breakdown"])
        )

    pattern_analysis["ai_pattern_summary"] = {
        "content_risk_detected": pattern_analysis["scam_type"] != "Safe / Normal Message",
        "primary_reason": pattern_analysis["ai_pattern_summary"]["primary_reason"],
        "confidence": llm_analysis.get("confidence")
        or pattern_analysis["ai_pattern_summary"]["confidence"],
        "database_match_required": False,
    }
    return pattern_analysis


def verdict_for_score(score: int) -> str:
    if score >= 75:
        return "High Risk Scam"
    if score >= 45:
        return "Suspicious"
    if score >= 20:
        return "Low Risk Suspicious"
    return "No Clear Scam Detected"


def _count_repeated_entities(raw_entities: dict) -> int:
    repeat_count = 0
    for values in raw_entities.values():
        cleaned_values = _clean_entities(values)
        counts = Counter(cleaned_values)
        repeat_count += sum(count - 1 for count in counts.values() if count > 1)
    return repeat_count


def _clean_entities(values: list[str]) -> list[str]:
    return [value.strip().strip(".,;:!?)(") for value in values if value.strip()]


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen = set()
    unique_values = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_values.append(value)
    return unique_values


def _domain_from_url(url: str) -> str:
    parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
    return parsed.netloc.lower().removeprefix("www.")
