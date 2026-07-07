from __future__ import annotations

import csv
from collections import Counter

from config_loader import ROOT, contains_any, load_nested_lists


IN_FILE = ROOT / "data/clean/clean_comments_all_platforms.csv"
POST_FILE = ROOT / "data/clean/labeled_all_platforms.csv"
OUT_FILE = ROOT / "data/clean/labeled_comments_all_platforms.csv"
LABELS_FILE = ROOT / "config/label_dict.yaml"

COMMENT_LABELED_COLUMNS = [
    "comment_id",
    "parent_post_id",
    "parent_comment_id",
    "platform",
    "keyword",
    "url",
    "publish_time",
    "crawl_time",
    "author_id_hash",
    "comment_text_raw",
    "comment_text_clean",
    "comment_level",
    "comment_rank",
    "comment_like_count",
    "comment_reply_count",
    "source_type",
    "comment_role_label",
    "comment_attitude_to_post",
    "comment_topic_labels",
    "post_comment_consistency",
    "is_ad",
    "relevance_score",
    "delete_reason",
    "manual_check",
    "remark",
]


def first_match(text: str, rules: dict[str, list[str]], default: str = "") -> str:
    for code, keywords in rules.items():
        if keywords and contains_any(text, keywords):
            return code
    return default


def all_matches(text: str, rules: dict[str, list[str]]) -> list[str]:
    return [code for code, keywords in rules.items() if keywords and contains_any(text, keywords)]


def load_post_attitudes() -> dict[str, str]:
    if not POST_FILE.exists():
        return {}
    with POST_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        attitudes: dict[str, str] = {}
        for row in csv.DictReader(f):
            attitude = row.get("attitude_label", "")
            for key in (row.get("post_id", ""), row.get("data_id", "")):
                if key:
                    attitudes[key] = attitude
        return attitudes


def consistency(post_attitude: str, comment_attitude: str) -> str:
    if not comment_attitude:
        return "PC5"
    if post_attitude in {"A1", "A6"} and comment_attitude == "support":
        return "PC1"
    if post_attitude in {"A4", "A5"} and comment_attitude == "concern":
        return "PC2"
    if comment_attitude == "oppose":
        return "PC3"
    if comment_attitude in {"support", "concern", "joke", "ask"}:
        return "PC4"
    return "PC5"


def role_from_attitude(attitude: str) -> str:
    return {
        "support": "C2",
        "oppose": "C3",
        "concern": "C4",
        "joke": "C5",
        "ask": "C6",
    }.get(attitude, "")


def attitude_from_role(role: str) -> str:
    return {
        "C2": "support",
        "C3": "oppose",
        "C4": "concern",
        "C5": "joke",
        "C6": "ask",
    }.get(role, "")


def main() -> int:
    role_rules = load_nested_lists(LABELS_FILE, "comment_role_labels")
    attitude_rules = load_nested_lists(LABELS_FILE, "comment_attitude_to_post")
    topic_rules = load_nested_lists(LABELS_FILE, "topic_labels")
    post_attitudes = load_post_attitudes()
    rows_out = []

    with IN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            text = row.get("comment_text_clean", "")
            role = first_match(text, role_rules, "C8" if row.get("delete_reason") else "")
            attitude = first_match(text, attitude_rules)
            if not role:
                role = role_from_attitude(attitude)
            if not attitude:
                attitude = attitude_from_role(role)
            topics = all_matches(text, topic_rules)
            parent_post_id = row.get("parent_post_id", "")
            output = {column: row.get(column, "") for column in COMMENT_LABELED_COLUMNS}
            output.update(
                {
                    "comment_role_label": role,
                    "comment_attitude_to_post": attitude,
                    "comment_topic_labels": "|".join(topics),
                    "post_comment_consistency": consistency(post_attitudes.get(parent_post_id, ""), attitude),
                }
            )
            rows_out.append(output)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COMMENT_LABELED_COLUMNS)
        writer.writeheader()
        writer.writerows(rows_out)

    kept = sum(1 for row in rows_out if not row["delete_reason"])
    roles = Counter(row["comment_role_label"] for row in rows_out if row["comment_role_label"])
    print(f"wrote {OUT_FILE.relative_to(ROOT)} rows={len(rows_out)} kept={kept} roles={dict(roles)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
