from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


SCHEMA = {
    "raw": [
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
        "like_count",
        "comment_count",
        "repost_or_share_count",
        "collect_count",
        "source_type",
        "is_repost",
        "remark",
    ],
    "clean": [
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
    ],
    "labeled": [
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
    ],
    "comment_raw": [
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
        "comment_level",
        "comment_rank",
        "comment_like_count",
        "comment_reply_count",
        "source_type",
        "remark",
    ],
    "comment_clean": [
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
    ],
    "comment_labeled": [
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
    ],
}


FILES = {
    ROOT / "data/raw/raw_data_weibo.csv": "raw",
    ROOT / "data/raw/raw_data_xhs.csv": "raw",
    ROOT / "data/raw/raw_data_zhihu.csv": "raw",
    ROOT / "data/raw/raw_data_wechat.csv": "raw",
    ROOT / "data/clean/clean_all_platforms.csv": "clean",
    ROOT / "data/clean/labeled_all_platforms.csv": "labeled",
    ROOT / "data/raw/raw_comments_all_platforms.csv": "comment_raw",
    ROOT / "data/clean/clean_comments_all_platforms.csv": "comment_clean",
    ROOT / "data/clean/labeled_comments_all_platforms.csv": "comment_labeled",
}


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        return next(reader)


def main() -> int:
    failed = False
    for path, schema_name in FILES.items():
        expected = SCHEMA[schema_name]
        if not path.exists():
            print(f"FAIL missing file: {path}")
            failed = True
            continue

        actual = read_header(path)
        if actual != expected:
            print(f"FAIL schema mismatch: {path}")
            print(f"  expected: {expected}")
            print(f"  actual:   {actual}")
            failed = True
            continue

        print(f"OK {path.relative_to(ROOT)}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
