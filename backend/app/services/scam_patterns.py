import re
from urllib.parse import urlparse


SCAM_CATEGORIES = [
    "Digital Arrest Scam",
    "Fake KYC Scam",
    "UPI Payment Fraud",
    "Job / Recruitment Scam",
    "Investment Scam",
    "Loan Scam",
    "Courier / Parcel Scam",
    "Bank Account Freeze Scam",
    "Lottery / Reward Scam",
    "Unknown Suspicious Message",
    "Safe / Normal Message",
]

JOB_RECOMMENDATION = (
    "Verify the recruiter through the company's official website or domain email. "
    "Do not pay registration, training, security, or document verification fees. "
    "Do not share Aadhaar, PAN, bank details, or OTP."
)

DEFAULT_RECOMMENDATIONS = {
    "Digital Arrest Scam": "Do not pay, join video calls, or share documents. Preserve screenshots and contact cybercrime authorities through official channels.",
    "Fake KYC Scam": "Do not click links or share OTP, Aadhaar, PAN, PIN, passwords, or bank details. Use only the official app or website.",
    "UPI Payment Fraud": "Do not approve collect requests, scan unknown QR codes, or transfer money to verify refunds, penalties, or fees.",
    "Job / Recruitment Scam": JOB_RECOMMENDATION,
    "Investment Scam": "Avoid guaranteed-return offers. Verify the business, registration, and official domain before sharing money or documents.",
    "Loan Scam": "Do not pay advance processing or verification fees. Verify lenders through official channels.",
    "Courier / Parcel Scam": "Verify parcel issues only through the courier's official website or app. Do not pay customs or penalty requests from messages.",
    "Bank Account Freeze Scam": "Do not use links or phone numbers in the message. Contact your bank through official support channels.",
    "Lottery / Reward Scam": "Do not pay claim, processing, tax, or delivery fees for unexpected rewards.",
    "Unknown Suspicious Message": "Verify the sender independently before responding, paying, clicking links, or sharing personal details.",
    "Safe / Normal Message": "No strong scam pattern was found. Continue to verify unexpected requests.",
}

SIGNALS = [
    {
        "label": "Digital arrest keywords",
        "points": 25,
        "scam_type": "Digital Arrest Scam",
        "red_flag": "Claims digital arrest, warrant, or remote investigation pressure.",
        "terms": ["digital arrest", "virtual arrest", "arrest warrant", "video call interrogation"],
    },
    {
        "label": "Law enforcement impersonation",
        "points": 20,
        "scam_type": "Digital Arrest Scam",
        "red_flag": "Impersonates police, CBI, ED, customs, court, or legal authority.",
        "terms": ["police", "cbi", "ed", "customs", "court", "warrant", "crime branch"],
    },
    {
        "label": "Urgency/threat language",
        "points": 15,
        "scam_type": "Unknown Suspicious Message",
        "red_flag": "Uses urgency, threats, penalties, blocking, or arrest pressure.",
        "terms": ["immediately", "last warning", "account blocked", "penalty", "legal action", "arrest", "urgent", "final notice"],
    },
    {
        "label": "Payment request",
        "points": 20,
        "scam_type": "UPI Payment Fraud",
        "red_flag": "Requests payment, transfer, QR scan, fee, penalty, or refundable deposit.",
        "terms": ["pay", "transfer", "upi", "qr", "fee", "penalty", "refundable deposit", "send money", "collect request"],
    },
    {
        "label": "Credential or KYC request",
        "points": 20,
        "scam_type": "Fake KYC Scam",
        "red_flag": "Requests OTP, PIN, password, KYC, Aadhaar, PAN, bank details, or identity verification.",
        "terms": ["otp", "pin", "password", "kyc", "aadhaar", "pan", "bank details", "verify account", "verification"],
    },
    {
        "label": "Unsolicited job offer",
        "points": 20,
        "scam_type": "Job / Recruitment Scam",
        "red_flag": "Unsolicited job offer from unknown sender.",
        "terms": ["came across your profile", "job offer", "position", "recruitment", "hiring", "linkedin"],
    },
    {
        "label": "Remote job pitch with attractive salary",
        "points": 15,
        "scam_type": "Job / Recruitment Scam",
        "red_flag": "Remote job pitch with attractive salary.",
        "terms": ["remote job", "remote customer", "work from home", "high salary", "salary is", "$", "per year"],
    },
    {
        "label": "Unknown sender / vague recruiter identity",
        "points": 10,
        "scam_type": "Job / Recruitment Scam",
        "red_flag": "Vague company/recruiter identity.",
        "terms": ["do you want to hear more", "hr whatsapp", "no interview", "easy work", "joining letter"],
    },
    {
        "label": "Job fee or deposit request",
        "points": 20,
        "scam_type": "Job / Recruitment Scam",
        "red_flag": "Job process mentions registration, training, security, or verification fee.",
        "terms": ["registration fee", "training fee", "security deposit", "document verification fee"],
    },
    {
        "label": "Investment scam keywords",
        "points": 20,
        "scam_type": "Investment Scam",
        "red_flag": "Promises guaranteed returns, double money, crypto profit, trading, or daily profit.",
        "terms": ["guaranteed returns", "double money", "crypto", "trading", "daily profit", "risk free"],
    },
    {
        "label": "Loan advance fee signal",
        "points": 20,
        "scam_type": "Loan Scam",
        "red_flag": "Loan offer asks for processing, approval, insurance, or verification fee.",
        "terms": ["instant loan", "loan approved", "processing fee", "approval fee", "loan verification"],
    },
    {
        "label": "Courier or parcel threat",
        "points": 20,
        "scam_type": "Courier / Parcel Scam",
        "red_flag": "Claims parcel held, customs clearance issue, illegal package, or delivery block.",
        "terms": ["parcel held", "customs clearance", "illegal package", "delivery blocked", "package seized", "parcel has drugs"],
    },
    {
        "label": "Bank account freeze threat",
        "points": 20,
        "scam_type": "Bank Account Freeze Scam",
        "red_flag": "Threatens account freeze, blocked banking, card block, or urgent bank update.",
        "terms": ["account frozen", "account freeze", "bank account blocked", "debit card blocked", "netbanking blocked"],
    },
    {
        "label": "Lottery or reward claim",
        "points": 20,
        "scam_type": "Lottery / Reward Scam",
        "red_flag": "Unexpected lottery, reward, prize, cashback, or claim message.",
        "terms": ["lottery", "reward", "prize", "winner", "claim now", "cashback"],
    },
]

PHISHING_URL_TERMS = ["verify", "login", "update", "claim", "secure", "bank", "rbi", "kyc"]


def analyze_content_patterns(text: str, urls: list[str] | None = None) -> dict:
    normalized_text = (text or "").lower()
    urls = urls or []
    matched_signals = []

    for signal in SIGNALS:
        if _has_any_term(normalized_text, signal["terms"]):
            matched_signals.append(signal)

    phishing_hits = [
        url for url in urls if _has_any_term(_domain_and_path(url), PHISHING_URL_TERMS)
    ]
    if phishing_hits:
        matched_signals.append(
            {
                "label": "Phishing link pattern",
                "points": 15,
                "scam_type": "Fake KYC Scam",
                "red_flag": "Link uses verification, login, update, claim, secure, bank, RBI, or KYC wording.",
                "terms": phishing_hits,
            }
        )

    risk_score_breakdown = _dedupe_breakdown(
        {"label": signal["label"], "points": signal["points"]}
        for signal in matched_signals
    )
    red_flags = _dedupe([signal["red_flag"] for signal in matched_signals])
    if _is_job_scam_match(matched_signals) and "do you want to hear more" in normalized_text:
        red_flags.append(
            "Conversation is being moved forward without formal application process."
        )

    scam_type = _select_scam_type(matched_signals, sum(item["points"] for item in risk_score_breakdown))
    content_score = min(75, sum(item["points"] for item in risk_score_breakdown))

    return {
        "scam_type": scam_type,
        "content_pattern_score": content_score,
        "risk_score_breakdown": risk_score_breakdown,
        "red_flags": red_flags,
        "recommendation": DEFAULT_RECOMMENDATIONS[scam_type],
        "ai_pattern_summary": {
            "content_risk_detected": scam_type not in ["Safe / Normal Message"],
            "primary_reason": _primary_reason(matched_signals, scam_type),
            "confidence": _confidence(content_score),
            "database_match_required": False,
        },
    }


def _select_scam_type(matched_signals: list[dict], score: int) -> str:
    if not matched_signals:
        return "Safe / Normal Message"

    totals = {}
    for signal in matched_signals:
        scam_type = signal["scam_type"]
        if scam_type == "Unknown Suspicious Message":
            continue
        totals[scam_type] = totals.get(scam_type, 0) + signal["points"]

    if totals:
        return max(totals.items(), key=lambda item: item[1])[0]

    if score >= 20:
        return "Unknown Suspicious Message"
    return "Safe / Normal Message"


def _is_job_scam_match(matched_signals: list[dict]) -> bool:
    return any(signal["scam_type"] == "Job / Recruitment Scam" for signal in matched_signals)


def _primary_reason(matched_signals: list[dict], scam_type: str) -> str:
    if not matched_signals:
        return "No strong scam behavior was detected in the message content."

    primary = max(matched_signals, key=lambda signal: signal["points"])
    return f"{primary['label']} matched content commonly seen in {scam_type}."


def _confidence(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    if score >= 20:
        return "low"
    return "very low"


def _has_any_term(text: str, terms: list[str]) -> bool:
    return any(_term_matches(text, term) for term in terms)


def _term_matches(text: str, term: str) -> bool:
    if term.isalnum() and len(term) <= 3:
        return re.search(rf"\b{re.escape(term)}\b", text) is not None
    return term in text


def _domain_and_path(url: str) -> str:
    parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
    return f"{parsed.netloc}{parsed.path}".lower()


def _dedupe(values: list[str]) -> list[str]:
    seen = set()
    deduped = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def _dedupe_breakdown(items) -> list[dict]:
    seen = set()
    deduped = []
    for item in items:
        if item["label"] in seen:
            continue
        seen.add(item["label"])
        deduped.append(item)
    return deduped
