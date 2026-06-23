import json
import os
from datetime import UTC, datetime
from uuid import uuid4

try:
    from neo4j import GraphDatabase
except ImportError:
    GraphDatabase = None


ENTITY_DEFINITIONS = {
    "phone_numbers": ("Phone", "HAS_PHONE"),
    "upi_ids": ("UPI", "HAS_UPI"),
    "urls": ("URL", "HAS_URL"),
    "emails": ("Email", "HAS_EMAIL"),
}


class InMemoryGraphStore:
    def __init__(self) -> None:
        self.reports: list[dict] = []
        self.entity_index: dict[tuple[str, str], set[str]] = {}

    def check_existing_entities(self, extracted_entities: dict) -> dict:
        matched_report_ids = set()
        repeated_entities = []

        for collection_name, (entity_label, _) in ENTITY_DEFINITIONS.items():
            for value in extracted_entities.get(collection_name, []):
                key = (entity_label, _normalize_entity_value(entity_label, value))
                report_ids = self.entity_index.get(key, set())
                if report_ids:
                    matched_report_ids.update(report_ids)
                    repeated_entities.append(
                        {
                            "entity_type": entity_label,
                            "value": value,
                            "matched_reports_count": len(report_ids),
                        }
                    )

        return _match_result(matched_report_ids, repeated_entities)

    def save_report(self, report: dict) -> dict:
        saved_report = {
            **report,
            "report_id": report.get("report_id") or str(uuid4()),
            "created_at": report.get("created_at") or _now_iso(),
        }
        self.reports.append(saved_report)

        for collection_name, (entity_label, _) in ENTITY_DEFINITIONS.items():
            for value in saved_report["extracted_entities"].get(collection_name, []):
                key = (entity_label, _normalize_entity_value(entity_label, value))
                self.entity_index.setdefault(key, set()).add(saved_report["report_id"])

        return saved_report

    def get_reports(self) -> list[dict]:
        return sorted(self.reports, key=lambda item: item["created_at"], reverse=True)

    def get_dashboard(self) -> dict:
        reports = self.reports
        total_reports = len(reports)
        risk_scores = [report["risk_score"] for report in reports]

        return {
            "total_reports": total_reports,
            "high_risk_count": sum(1 for report in reports if report["risk_score"] >= 75),
            "average_risk_score": round(sum(risk_scores) / total_reports, 2)
            if total_reports
            else 0,
            "scam_type_counts": _count_by(reports, "scam_type"),
            "city_counts": _count_by(reports, "city"),
        }

    def get_graph(self) -> dict:
        nodes = {}
        edges = []

        for report in self.reports:
            report_id = f"report:{report['report_id']}"
            nodes[report_id] = {
                "id": report_id,
                "label": report["scam_type"],
                "type": "Report",
                "risk_score": report["risk_score"],
            }

            _add_property_node_and_edge(
                nodes,
                edges,
                report_id,
                "City",
                report.get("city") or "Unknown",
                "FROM_CITY",
            )
            _add_property_node_and_edge(
                nodes,
                edges,
                report_id,
                "ScamType",
                report["scam_type"],
                "SCAM_TYPE",
            )

            for collection_name, (entity_label, relationship) in ENTITY_DEFINITIONS.items():
                for value in report["extracted_entities"].get(collection_name, []):
                    _add_property_node_and_edge(
                        nodes,
                        edges,
                        report_id,
                        entity_label,
                        value,
                        relationship,
                    )

        return {"nodes": list(nodes.values()), "edges": edges}


class Neo4jGraphStore:
    def __init__(self, uri: str, username: str, password: str) -> None:
        self.driver = GraphDatabase.driver(uri, auth=(username, password))
        self._ensure_constraints()

    def check_existing_entities(self, extracted_entities: dict) -> dict:
        matched_report_ids = set()
        repeated_entities = []

        with self.driver.session() as session:
            for collection_name, (entity_label, relationship) in ENTITY_DEFINITIONS.items():
                for value in extracted_entities.get(collection_name, []):
                    normalized_value = _normalize_entity_value(entity_label, value)
                    records = session.run(
                        f"""
                        MATCH (r:Report)-[:{relationship}]->(e:{entity_label} {{normalized_value: $normalized_value}})
                        RETURN collect(DISTINCT r.report_id) AS report_ids
                        """,
                        normalized_value=normalized_value,
                    ).single()
                    report_ids = records["report_ids"] if records else []
                    if report_ids:
                        matched_report_ids.update(report_ids)
                        repeated_entities.append(
                            {
                                "entity_type": entity_label,
                                "value": value,
                                "matched_reports_count": len(report_ids),
                            }
                        )

        return _match_result(matched_report_ids, repeated_entities)

    def save_report(self, report: dict) -> dict:
        saved_report = {
            **report,
            "report_id": report.get("report_id") or str(uuid4()),
            "created_at": report.get("created_at") or _now_iso(),
        }

        with self.driver.session() as session:
            session.execute_write(self._save_report_tx, saved_report)

        return saved_report

    def get_reports(self) -> list[dict]:
        with self.driver.session() as session:
            records = session.run(
                """
                MATCH (r:Report)
                OPTIONAL MATCH (r)-[:HAS_PHONE]->(phone:Phone)
                OPTIONAL MATCH (r)-[:HAS_UPI]->(upi:UPI)
                OPTIONAL MATCH (r)-[:HAS_URL]->(url:URL)
                OPTIONAL MATCH (r)-[:HAS_EMAIL]->(email:Email)
                RETURN r,
                       collect(DISTINCT phone.value) AS phone_numbers,
                       collect(DISTINCT upi.value) AS upi_ids,
                       collect(DISTINCT url.value) AS urls,
                       collect(DISTINCT email.value) AS emails
                ORDER BY r.created_at DESC
                """
            )
            reports = []
            for record in records:
                report = dict(record["r"])
                report["extracted_entities"] = {
                    "phone_numbers": _clean_collection(record["phone_numbers"]),
                    "upi_ids": _clean_collection(record["upi_ids"]),
                    "urls": _clean_collection(record["urls"]),
                    "emails": _clean_collection(record["emails"]),
                }
                report["repeated_entities"] = _json_loads(
                    report.get("repeated_entities_json"), []
                )
                report["matched_reports_count"] = report.get("matched_reports_count", 0)
                report["graph_match_summary"] = report.get("graph_match_summary", "")
                reports.append(report)
            return reports

    def get_dashboard(self) -> dict:
        reports = self.get_reports()
        total_reports = len(reports)
        risk_scores = [report["risk_score"] for report in reports]

        return {
            "total_reports": total_reports,
            "high_risk_count": sum(1 for report in reports if report["risk_score"] >= 75),
            "average_risk_score": round(sum(risk_scores) / total_reports, 2)
            if total_reports
            else 0,
            "scam_type_counts": _count_by(reports, "scam_type"),
            "city_counts": _count_by(reports, "city"),
        }

    def get_graph(self) -> dict:
        with self.driver.session() as session:
            records = session.run(
                """
                MATCH (r:Report)-[rel]->(n)
                WHERE type(rel) IN ['HAS_PHONE', 'HAS_UPI', 'HAS_URL', 'HAS_EMAIL', 'FROM_CITY', 'SCAM_TYPE']
                RETURN r.report_id AS report_id,
                       r.scam_type AS report_label,
                       r.risk_score AS risk_score,
                       type(rel) AS relationship,
                       labels(n)[0] AS node_type,
                       coalesce(n.value, n.name) AS node_label
                LIMIT 300
                """
            )

            nodes = {}
            edges = []
            for record in records:
                report_id = f"report:{record['report_id']}"
                nodes[report_id] = {
                    "id": report_id,
                    "label": record["report_label"],
                    "type": "Report",
                    "risk_score": record["risk_score"],
                }

                node_id = _node_id(record["node_type"], record["node_label"])
                nodes[node_id] = {
                    "id": node_id,
                    "label": record["node_label"],
                    "type": record["node_type"],
                }
                edges.append(
                    {
                        "id": f"{report_id}->{record['relationship']}->{node_id}",
                        "source": report_id,
                        "target": node_id,
                        "label": record["relationship"],
                    }
                )

            return {"nodes": list(nodes.values()), "edges": edges}

    def close(self) -> None:
        self.driver.close()

    def _ensure_constraints(self) -> None:
        constraints = [
            "CREATE CONSTRAINT report_id_unique IF NOT EXISTS FOR (r:Report) REQUIRE r.report_id IS UNIQUE",
            "CREATE CONSTRAINT phone_value_unique IF NOT EXISTS FOR (n:Phone) REQUIRE n.normalized_value IS UNIQUE",
            "CREATE CONSTRAINT upi_value_unique IF NOT EXISTS FOR (n:UPI) REQUIRE n.normalized_value IS UNIQUE",
            "CREATE CONSTRAINT url_value_unique IF NOT EXISTS FOR (n:URL) REQUIRE n.normalized_value IS UNIQUE",
            "CREATE CONSTRAINT email_value_unique IF NOT EXISTS FOR (n:Email) REQUIRE n.normalized_value IS UNIQUE",
            "CREATE CONSTRAINT city_name_unique IF NOT EXISTS FOR (n:City) REQUIRE n.name IS UNIQUE",
            "CREATE CONSTRAINT scam_type_name_unique IF NOT EXISTS FOR (n:ScamType) REQUIRE n.name IS UNIQUE",
        ]
        with self.driver.session() as session:
            for statement in constraints:
                session.run(statement)

    @staticmethod
    def _save_report_tx(tx, report: dict) -> None:
        tx.run(
            """
            CREATE (r:Report {
              report_id: $report_id,
              input_text: $input_text,
              city: $city,
              scam_type: $scam_type,
              verdict: $verdict,
              risk_score: $risk_score,
              red_flags: $red_flags,
              recommendation: $recommendation,
              matched_reports_count: $matched_reports_count,
              graph_match_summary: $graph_match_summary,
              repeated_entities_json: $repeated_entities_json,
              created_at: $created_at
            })
            WITH r
            MERGE (city:City {name: $city})
            MERGE (scamType:ScamType {name: $scam_type})
            MERGE (r)-[:FROM_CITY]->(city)
            MERGE (r)-[:SCAM_TYPE]->(scamType)
            """,
            **_report_params(report),
        )

        entity_queries = {
            "phone_numbers": ("Phone", "HAS_PHONE"),
            "upi_ids": ("UPI", "HAS_UPI"),
            "urls": ("URL", "HAS_URL"),
            "emails": ("Email", "HAS_EMAIL"),
        }
        for collection_name, (entity_label, relationship) in entity_queries.items():
            for value in report["extracted_entities"].get(collection_name, []):
                tx.run(
                    f"""
                    MATCH (r:Report {{report_id: $report_id}})
                    MERGE (e:{entity_label} {{normalized_value: $normalized_value}})
                    ON CREATE SET e.value = $value
                    MERGE (r)-[:{relationship}]->(e)
                    """,
                    report_id=report["report_id"],
                    value=value,
                    normalized_value=_normalize_entity_value(entity_label, value),
                )


def get_graph_store():
    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")

    if uri and username and password and GraphDatabase:
        try:
            return Neo4jGraphStore(uri, username, password)
        except Exception:
            return InMemoryGraphStore()

    return InMemoryGraphStore()


def _match_result(matched_report_ids: set[str], repeated_entities: list[dict]) -> dict:
    matched_reports_count = len(matched_report_ids)
    if matched_reports_count:
        summary = (
            f"Found {matched_reports_count} previous report(s) connected to "
            f"{len(repeated_entities)} repeated entity/entities."
        )
    else:
        summary = "No previous reports matched the extracted entities."

    return {
        "matched_reports_count": matched_reports_count,
        "repeated_entities": repeated_entities,
        "graph_match_summary": summary,
    }


def _count_by(reports: list[dict], key: str) -> dict:
    counts = {}
    for report in reports:
        value = report.get(key) or "Unknown"
        counts[value] = counts.get(value, 0) + 1
    return counts


def _report_params(report: dict) -> dict:
    return {
        **report,
        "matched_reports_count": report.get("matched_reports_count", 0),
        "graph_match_summary": report.get("graph_match_summary", ""),
        "repeated_entities_json": json.dumps(report.get("repeated_entities", [])),
    }


def _json_loads(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _clean_collection(values: list) -> list:
    return [value for value in values if value]


def _normalize_entity_value(entity_label: str, value: str) -> str:
    normalized = value.strip().lower()
    if entity_label == "Phone":
        return "".join(char for char in normalized if char.isdigit())
    return normalized.removeprefix("http://").removeprefix("https://").removeprefix("www.")


def _node_id(node_type: str, value: str) -> str:
    return f"{node_type.lower()}:{_normalize_entity_value(node_type, value)}"


def _add_property_node_and_edge(
    nodes: dict,
    edges: list[dict],
    report_id: str,
    node_type: str,
    value: str,
    relationship: str,
) -> None:
    node_id = _node_id(node_type, value)
    nodes[node_id] = {"id": node_id, "label": value, "type": node_type}
    edges.append(
        {
            "id": f"{report_id}->{relationship}->{node_id}",
            "source": report_id,
            "target": node_id,
            "label": relationship,
        }
    )


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
