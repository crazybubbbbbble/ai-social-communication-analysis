from __future__ import annotations

import csv
from pathlib import Path

from config_loader import ROOT, contains_any, load_nested_lists


IN_FILE = ROOT / "data/clean/clean_all_platforms.csv"
OUT_FILE = ROOT / "data/clean/labeled_all_platforms.csv"
LABELS_FILE = ROOT / "config/label_dict.yaml"

LABELED_COLUMNS = [
    "post_id",
    "data_id",
    "platform",
    "keyword",
    "url",
    "publish_time",
    "crawl_time",
    "author_id_hash",
    "title",
    "text_raw",
    "text_clean",
    "like_count",
    "comment_count",
    "repost_or_share_count",
    "collect_count",
    "source_type",
    "is_repost",
    "is_ad",
    "relevance_score",
    "student_relevance_label",
    "primary_scene_label",
    "scene_labels",
    "relation_labels",
    "motivation_labels",
    "usage_labels",
    "attitude_label",
    "primary_risk_label",
    "risk_labels",
    "sentiment_label",
    "primary_topic_label",
    "topic_labels",
    "label_confidence",
    "delete_reason",
    "manual_check",
    "remark",
]

MULTI_SECTIONS = {
    "scene_labels": "scene_labels",
    "relation_labels": "relation_labels",
    "motivation_labels": "motivation_labels",
    "usage_labels": "usage_labels",
    "risk_labels": "risk_labels",
    "topic_labels": "topic_labels",
}


def first_or_empty(values: list[str]) -> str:
    return values[0] if values else ""


def match_section(text: str, rules: dict[str, list[str]]) -> list[str]:
    matches = []
    for code, keywords in rules.items():
        if keywords and contains_any(text, keywords):
            matches.append(code)
    return matches


def confidence(row: dict[str, str], matched_count: int) -> str:
    if row.get("delete_reason"):
        return "low"
    if row.get("student_relevance_label") == "unclear":
        return "medium" if matched_count >= 3 else "low"
    if matched_count >= 5:
        return "high"
    if matched_count >= 2:
        return "medium"
    return "low"


def sentiment_from_text(text: str) -> str:
    positive = ["好用", "救命", "太会说", "学到了", "有用", "缓解焦虑"]
    negative = ["恶心", "可怕", "不真诚", "离谱", "担心", "反感", "隐私", "依赖"]
    pos = bool(contains_any(text, positive))
    neg = bool(contains_any(text, negative))
    if pos and neg:
        return "E4"
    if pos:
        return "E1"
    if neg:
        return "E3"
    return "E2"


def label_row(row: dict[str, str], rules: dict[str, dict[str, list[str]]]) -> dict[str, str]:
    text = f"{row.get('title', '')} {row.get('text_clean', '')}"
    output = {column: row.get(column, "") for column in LABELED_COLUMNS}
    matched_total = 0

    for field, section in MULTI_SECTIONS.items():
        matches = match_section(text, rules[section])
        matched_total += len(matches)
        output[field] = "|".join(matches)

    output["primary_scene_label"] = first_or_empty(output["scene_labels"].split("|") if output["scene_labels"] else [])
    output["primary_risk_label"] = first_or_empty(output["risk_labels"].split("|") if output["risk_labels"] else [])
    output["primary_topic_label"] = first_or_empty(output["topic_labels"].split("|") if output["topic_labels"] else [])

    attitude_matches = match_section(text, rules["attitude_labels"])
    output["attitude_label"] = first_or_empty(attitude_matches)
    if attitude_matches:
        matched_total += 1

    if not output["primary_risk_label"] and not row.get("delete_reason"):
        output["primary_risk_label"] = "K0"
        output["risk_labels"] = "K0"

    output["sentiment_label"] = sentiment_from_text(text)
    output["label_confidence"] = confidence(row, matched_total)
    return output


def main() -> int:
    rules = {
        section: load_nested_lists(LABELS_FILE, section)
        for section in [
            "scene_labels",
            "relation_labels",
            "motivation_labels",
            "usage_labels",
            "risk_labels",
            "attitude_labels",
            "topic_labels",
        ]
    }

    with IN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    labeled_rows = [label_row(row, rules) for row in rows]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=LABELED_COLUMNS)
        writer.writeheader()
        writer.writerows(labeled_rows)

    print(f"wrote {OUT_FILE.relative_to(ROOT)} rows={len(labeled_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
