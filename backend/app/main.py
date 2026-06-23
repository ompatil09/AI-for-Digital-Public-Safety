from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    DashboardResponse,
    HealthResponse,
)
from app.services.analyzer import analyze_message, verdict_for_score
from app.services.graph_db import get_graph_store


app = FastAPI(
    title="Sentinel AI API",
    description="Local API for the Sentinel AI hackathon prototype.",
    version="0.1.0",
)
graph_store = get_graph_store()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="Sentinel AI API")


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> dict:
    analysis = analyze_message(request.text, request.city)
    graph_match = graph_store.check_existing_entities(analysis["extracted_entities"])

    if graph_match["matched_reports_count"]:
        graph_boost = _graph_match_points(graph_match["repeated_entities"])
        analysis["risk_score_breakdown"].append(
            {
                "label": _graph_match_label(graph_match["repeated_entities"]),
                "points": graph_boost,
            }
        )
        analysis["risk_score"] = min(
            100, sum(item["points"] for item in analysis["risk_score_breakdown"])
        )
        analysis["verdict"] = verdict_for_score(analysis["risk_score"])
        analysis["red_flags"].append(
            "One or more extracted entities appeared in previous reports."
        )

    report = graph_store.save_report(
        {
            "input_text": request.text,
            "city": request.city or "Unknown",
            **analysis,
            **graph_match,
        }
    )
    return report


@app.get("/api/reports")
def get_reports() -> list[dict]:
    return graph_store.get_reports()


@app.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard() -> dict:
    return graph_store.get_dashboard()


@app.get("/api/graph")
def get_graph() -> dict:
    return graph_store.get_graph()


def _graph_match_points(repeated_entities: list[dict]) -> int:
    has_repeated_upi = any(
        entity.get("entity_type", "").lower() == "upi" for entity in repeated_entities
    )
    if has_repeated_upi:
        return 30
    return min(30, 15 + len(repeated_entities) * 5)


def _graph_match_label(repeated_entities: list[dict]) -> str:
    has_repeated_upi = any(
        entity.get("entity_type", "").lower() == "upi" for entity in repeated_entities
    )
    if has_repeated_upi:
        return "Known repeated UPI"
    return "Known repeated graph entity"
