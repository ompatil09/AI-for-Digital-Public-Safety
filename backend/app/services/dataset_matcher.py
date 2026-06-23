import csv
import math
import re
from collections import Counter
from pathlib import Path


DATASET_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "sentinel_ai_fraud_scam_messages_dataset.csv"
)
TOKEN_REGEX = re.compile(r"[a-zA-Z0-9@._-]+")


class DatasetMatcher:
    def __init__(self, dataset_path: Path = DATASET_PATH) -> None:
        self.dataset_path = dataset_path
        self.examples = self._load_examples()
        self.idf = self._build_idf()
        self.example_vectors = [
            self._tfidf_vector(example["message_text"]) for example in self.examples
        ]

    def match(self, text: str, top_k: int = 3) -> dict:
        if not text.strip() or not self.examples:
            return self._empty_summary()

        query_vector = self._tfidf_vector(text)
        scored_examples = []

        for example, vector in zip(self.examples, self.example_vectors):
            similarity = _cosine_similarity(query_vector, vector)
            if similarity <= 0:
                continue
            scored_examples.append((similarity, example))

        scored_examples.sort(key=lambda item: item[0], reverse=True)
        top_matches = scored_examples[:top_k]
        examples = [
            {
                "message_id": example["message_id"],
                "message_text": example["message_text"],
                "scam_type": example["scam_type"],
                "risk_score": example["risk_score"],
                "similarity": round(similarity, 3),
            }
            for similarity, example in top_matches
        ]

        best_match = examples[0] if examples else None
        is_risky_match = bool(
            best_match
            and best_match["similarity"] >= 0.28
            and best_match["scam_type"] != "Safe / Normal Message"
        )
        boost = _score_boost(best_match["similarity"] if is_risky_match else 0)

        return {
            "matched": is_risky_match,
            "best_similarity": best_match["similarity"] if best_match else 0,
            "suggested_scam_type": best_match["scam_type"] if best_match else "",
            "score_boost": boost,
            "primary_reason": _primary_reason(best_match),
            "matched_examples": examples,
        }

    def _load_examples(self) -> list[dict]:
        if not self.dataset_path.exists():
            return []

        with self.dataset_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            examples = []
            for row in reader:
                message_text = (row.get("message_text") or "").strip()
                if not message_text:
                    continue
                examples.append(
                    {
                        "message_id": (row.get("message_id") or "").strip(),
                        "message_text": message_text,
                        "scam_type": (row.get("scam_type") or "Unknown Suspicious Message").strip(),
                        "risk_score": _safe_int(row.get("risk_score")),
                    }
                )
            return examples

    def _build_idf(self) -> dict[str, float]:
        document_count = len(self.examples)
        if not document_count:
            return {}

        document_frequency = Counter()
        for example in self.examples:
            document_frequency.update(set(_tokenize(example["message_text"])))

        return {
            token: math.log((1 + document_count) / (1 + frequency)) + 1
            for token, frequency in document_frequency.items()
        }

    def _tfidf_vector(self, text: str) -> dict[str, float]:
        tokens = _tokenize(text)
        if not tokens:
            return {}

        counts = Counter(tokens)
        total = len(tokens)
        return {
            token: (count / total) * self.idf.get(token, 1.0)
            for token, count in counts.items()
        }

    @staticmethod
    def _empty_summary() -> dict:
        return {
            "matched": False,
            "best_similarity": 0,
            "suggested_scam_type": "",
            "score_boost": 0,
            "primary_reason": "No similar dataset examples found.",
            "matched_examples": [],
        }


def _tokenize(text: str) -> list[str]:
    return [
        token.lower()
        for token in TOKEN_REGEX.findall(text)
        if len(token) > 2
    ]


def _cosine_similarity(first: dict[str, float], second: dict[str, float]) -> float:
    if not first or not second:
        return 0

    shared_tokens = set(first) & set(second)
    numerator = sum(first[token] * second[token] for token in shared_tokens)
    first_norm = math.sqrt(sum(value * value for value in first.values()))
    second_norm = math.sqrt(sum(value * value for value in second.values()))
    if not first_norm or not second_norm:
        return 0
    return numerator / (first_norm * second_norm)


def _score_boost(similarity: float) -> int:
    if similarity >= 0.55:
        return 20
    if similarity >= 0.4:
        return 15
    if similarity >= 0.28:
        return 10
    return 0


def _primary_reason(best_match: dict | None) -> str:
    if not best_match or best_match["similarity"] < 0.28:
        return "No similar dataset examples found."
    if best_match["scam_type"] == "Safe / Normal Message":
        return (
            "Closest dataset examples are labeled Safe / Normal Message, "
            f"with similarity {best_match['similarity']}."
        )
    return (
        f"Closest dataset example is labeled {best_match['scam_type']} "
        f"with similarity {best_match['similarity']}."
    )


def _safe_int(value: str | None) -> int:
    try:
        return int(float(value or 0))
    except ValueError:
        return 0


_dataset_matcher = DatasetMatcher()


def get_dataset_matcher() -> DatasetMatcher:
    return _dataset_matcher
