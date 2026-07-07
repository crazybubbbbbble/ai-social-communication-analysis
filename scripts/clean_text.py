from __future__ import annotations

import csv
import hashlib
import re
from datetime import datetime
from pathlib import Path

from config_loader import ROOT, contains_any, load_grouped_lists, load_nested_lists, load_top_level_list


RAW_FILES = [
    ROOT / "data/raw/raw_data_weibo.csv",
    ROOT / "data/raw/raw_data_xhs.csv",
    ROOT / "data/raw/raw_data_zhihu.csv",
    ROOT / "data/raw/raw_data_wechat.csv",
]

OUT_FILE = ROOT / "data/clean/clean_all_platforms.csv"
KEYWORDS_FILE = ROOT / "config/keywords.yaml"
LABELS_FILE = ROOT / "config/label_dict.yaml"

CLEAN_COLUMNS = [
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
    "delete_reason",
    "manual_check",
    "remark",
]


def clean_text(text: str) -> str:
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"@\S+", " ", text)
    text = re.sub(r"#([^#]+)#", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chinese_len(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def stable_id(platform: str, text: str, url: str) -> str:
    digest = hashlib.sha1(f"{platform}|{url}|{text}".encode("utf-8")).hexdigest()[:12]
    return f"{platform}_{digest}"


def load_relevance_terms() -> tuple[list[str], list[str], list[str], list[str]]:
    ai_terms = []
    communication_terms = []
    relationship_terms = []
    risk_terms = []

    for section in ["ai_terms", "communication_actions", "relationship_terms", "emotion_and_risk_terms"]:
        groups = load_grouped_lists(KEYWORDS_FILE, section)
        for group_name, values in groups.items():
            if section == "ai_terms":
                ai_terms.extend(values)
            elif section == "communication_actions":
                communication_terms.extend(values)
            elif section == "relationship_terms":
                relationship_terms.extend(values)
            elif group_name in {"risk", "anxiety", "emotion"}:
                risk_terms.extend(values)

    return ai_terms, communication_terms, relationship_terms, risk_terms


def score_relevance(text: str, exclude_terms: list[str]) -> tuple[float, bool]:
    ai_terms, communication_terms, relationship_terms, risk_terms = load_relevance_terms()
    score = 0.0
    score += 1.0 if contains_any(text, ai_terms) else 0.0
    score += 2.0 if contains_any(text, communication_terms) else 0.0
    score += 2.0 if contains_any(text, relationship_terms) else 0.0
    score += 1.0 if contains_any(text, risk_terms) else 0.0
    is_ad = bool(contains_any(text, exclude_terms))
    if is_ad:
        score -= 3.0
    if chinese_len(text) < 10:
        score -= 5.0
    return score, is_ad


def has_core_interpersonal_signal(text: str) -> bool:
    _, communication_terms, relationship_terms, risk_terms = load_relevance_terms()
    return bool(
        contains_any(text, communication_terms)
        or contains_any(text, relationship_terms)
        or contains_any(text, risk_terms)
    )


def student_relevance(text: str) -> str:
    terms = load_nested_lists(LABELS_FILE, "student_relevance")
    low_hits = contains_any(text, terms.get("low_exclusion_signals", []))
    high_hits = contains_any(text, terms.get("high", []))
    medium_hits = contains_any(text, terms.get("medium", []))
    if low_hits and not (high_hits or medium_hits):
        return "low"
    if high_hits:
        return "high"
    if medium_hits:
        return "medium"
    return "unclear"


def iter_raw_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in RAW_FILES:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if any((value or "").strip() for value in row.values()):
                    rows.append({key: value or "" for key, value in row.items()})
    return rows


def normalize_row(row: dict[str, str], seen_text: set[str], exclude_terms: list[str]) -> dict[str, str]:
    text_raw = row.get("text_raw", "")
    text_clean = clean_text(text_raw)
    platform = row.get("platform", "").strip() or "unknown"
    url = row.get("url", "").strip()
    data_id = row.get("data_id", "").strip() or stable_id(platform, text_clean, url)
    score, is_ad = score_relevance(text_clean, exclude_terms)
    student_label = student_relevance(text_clean)

    delete_reason = ""
    text_key = re.sub(r"\s+", "", text_clean).lower()
    if is_ad:
        delete_reason = "ad"
    elif text_key in seen_text:
        delete_reason = "duplicate"
    elif chinese_len(text_clean) < 10:
        delete_reason = "too_short"
    elif not has_core_interpersonal_signal(text_clean):
        delete_reason = "irrelevant"
    elif student_label == "low" and score < 4:
        delete_reason = "irrelevant"
    elif score < 2:
        delete_reason = "irrelevant"

    if text_key:
        seen_text.add(text_key)

    output = {column: "" for column in CLEAN_COLUMNS}
    for column in row:
        if column in output:
            output[column] = row[column]

    output.update(
        {
            "data_id": data_id,
            "text_clean": text_clean,
            "crawl_time": row.get("crawl_time", "").strip() or datetime.now().isoformat(timespec="seconds"),
            "is_ad": "1" if is_ad else "0",
            "relevance_score": f"{score:.1f}",
            "student_relevance_label": student_label,
            "delete_reason": delete_reason,
            "manual_check": row.get("manual_check", "").strip() or "0",
        }
    )
    return output


def main() -> int:
    exclude_terms = load_top_level_list(KEYWORDS_FILE, "exclude_terms")
    seen_text: set[str] = set()
    rows = [normalize_row(row, seen_text, exclude_terms) for row in iter_raw_rows()]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CLEAN_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    kept = sum(1 for row in rows if not row["delete_reason"])
    print(f"wrote {OUT_FILE.relative_to(ROOT)} rows={len(rows)} kept={kept}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
