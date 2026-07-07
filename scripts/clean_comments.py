from __future__ import annotations

import csv
import re
from datetime import datetime

from config_loader import ROOT, contains_any, load_top_level_list


IN_FILE = ROOT / "data/raw/raw_comments_all_platforms.csv"
OUT_FILE = ROOT / "data/clean/clean_comments_all_platforms.csv"
POST_CLEAN_FILE = ROOT / "data/clean/clean_all_platforms.csv"
KEYWORDS_FILE = ROOT / "config/keywords.yaml"

COMMENT_CLEAN_COLUMNS = [
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
    "is_ad",
    "relevance_score",
    "delete_reason",
    "manual_check",
    "remark",
]


def clean_text(text: str) -> str:
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"@\S+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chinese_len(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def score_comment(text: str, exclude_terms: list[str]) -> tuple[float, bool]:
    is_ad = bool(contains_any(text, exclude_terms))
    score = 1.0
    if contains_any(text, ["AI", "ChatGPT", "GPT", "DeepSeek", "回消息", "聊天记录", "代聊", "隐私", "AI 味"]):
        score += 2.0
    if contains_any(text, ["好用", "救命", "不真诚", "担心", "怎么回", "哈哈", "离谱"]):
        score += 1.0
    if is_ad:
        score -= 3.0
    if chinese_len(text) < 5:
        score -= 4.0
    return score, is_ad


def is_low_value_xhs_high_eq_comment(row: dict[str, str], text: str) -> bool:
    if row.get("platform") != "xhs" or row.get("keyword") != "AI 高情商回复":
        return False
    signal_terms = [
        "AI",
        "ai",
        "GPT",
        "gpt",
        "DeepSeek",
        "豆包",
        "人机",
        "回消息",
        "回复",
        "聊天",
        "领导",
        "老板",
        "同事",
        "crush",
        "对象",
        "翻车",
        "不真实",
        "AI味",
    ]
    return not contains_any(text, signal_terms)


def load_kept_parent_posts() -> set[str]:
    if not POST_CLEAN_FILE.exists():
        return set()
    with POST_CLEAN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        return {
            row.get("post_id") or row.get("data_id", "")
            for row in csv.DictReader(f)
            if not row.get("delete_reason") and (row.get("post_id") or row.get("data_id"))
        }


def main() -> int:
    exclude_terms = load_top_level_list(KEYWORDS_FILE, "exclude_terms")
    kept_parent_posts = load_kept_parent_posts()
    seen: set[str] = set()
    rows_out = []

    with IN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if not any((value or "").strip() for value in row.values()):
                continue
            text_clean = clean_text(row.get("comment_text_raw", ""))
            score, is_ad = score_comment(text_clean, exclude_terms)
            compact = re.sub(r"\s+", "", text_clean).lower()
            delete_reason = ""
            if is_ad:
                delete_reason = "ad"
            elif compact in seen:
                delete_reason = "duplicate"
            elif chinese_len(text_clean) < 5:
                delete_reason = "too_short"
            elif is_low_value_xhs_high_eq_comment(row, text_clean):
                delete_reason = "irrelevant"
            elif kept_parent_posts and row.get("parent_post_id") not in kept_parent_posts and score < 3:
                delete_reason = "irrelevant"
            elif score < 1:
                delete_reason = "irrelevant"
            elif re.fullmatch(r"[\W_]+", text_clean):
                delete_reason = "no_opinion"
            if compact:
                seen.add(compact)

            output = {column: row.get(column, "") for column in COMMENT_CLEAN_COLUMNS}
            output.update(
                {
                    "comment_text_clean": text_clean,
                    "crawl_time": row.get("crawl_time") or datetime.now().isoformat(timespec="seconds"),
                    "source_type": row.get("source_type") or "comment",
                    "is_ad": "1" if is_ad else "0",
                    "relevance_score": f"{score:.1f}",
                    "delete_reason": delete_reason,
                    "manual_check": row.get("manual_check") or "0",
                }
            )
            rows_out.append(output)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COMMENT_CLEAN_COLUMNS)
        writer.writeheader()
        writer.writerows(rows_out)

    kept = sum(1 for row in rows_out if not row["delete_reason"])
    print(f"wrote {OUT_FILE.relative_to(ROOT)} rows={len(rows_out)} kept={kept}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
