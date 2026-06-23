from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class AnalyzeRequest(BaseModel):
    text: str
    city: str | None = None


class ExtractedEntities(BaseModel):
    phone_numbers: list[str]
    upi_ids: list[str]
    urls: list[str]
    emails: list[str]


class ThreatIntelMatch(BaseModel):
    entity_type: str
    value: str
    is_known_suspect: bool
    confidence: int
    source: str
    notes: str


class RepeatedEntity(BaseModel):
    entity_type: str
    value: str
    matched_reports_count: int


class RiskScoreBreakdownItem(BaseModel):
    label: str
    points: int


class AiPatternSummary(BaseModel):
    content_risk_detected: bool
    primary_reason: str
    confidence: str
    database_match_required: bool


class DatasetMatchedExample(BaseModel):
    message_id: str
    message_text: str
    scam_type: str
    risk_score: int
    similarity: float


class DatasetMatchSummary(BaseModel):
    matched: bool
    best_similarity: float
    suggested_scam_type: str
    score_boost: int
    primary_reason: str
    matched_examples: list[DatasetMatchedExample]


class AnalyzeResponse(BaseModel):
    report_id: str
    risk_score: int
    risk_score_breakdown: list[RiskScoreBreakdownItem]
    verdict: str
    scam_type: str
    red_flags: list[str]
    extracted_entities: ExtractedEntities
    threat_intel_matches: list[ThreatIntelMatch]
    ai_pattern_summary: AiPatternSummary
    dataset_match_summary: DatasetMatchSummary
    matched_reports_count: int
    repeated_entities: list[RepeatedEntity]
    graph_match_summary: str
    recommendation: str
    created_at: str


class DashboardResponse(BaseModel):
    total_reports: int
    high_risk_count: int
    average_risk_score: float
    scam_type_counts: dict[str, int]
    city_counts: dict[str, int]
