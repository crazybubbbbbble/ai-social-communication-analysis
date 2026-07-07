from __future__ import annotations

import argparse
import csv
import hashlib
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from config_loader import ROOT


COMMENT_COLUMNS = [
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
]


POST_FILES = [
    ROOT / "data/raw/raw_data_weibo.csv",
    ROOT / "data/raw/raw_data_xhs.csv",
    ROOT / "data/raw/raw_data_zhihu.csv",
    ROOT / "data/raw/raw_data_wechat.csv",
]


FIELD_CANDIDATES = {
    "comment_id": ["comment_id", "id"],
    "post_id": ["note_id", "content_id", "aweme_id", "video_id"],
    "parent_comment_id": ["parent_comment_id", "root_comment_id"],
    "publish_time": ["create_date_time", "create_time", "created_time", "time"],
    "author": ["creator_hash", "author_id_hash", "user_id_hash", "user_id", "nickname"],
    "text": ["content", "comment_content", "text"],
    "like": ["comment_like_count", "like_count", "liked_count"],
    "reply": ["sub_comment_count", "comment_reply_count", "reply_count"],
}


def first_value(row: dict[str, str], candidates: list[str]) -> str:
    lower_map = {key.lower(): value for key, value in row.items()}
    for candidate in candidates:
        value = lower_map.get(candidate.lower())
        if value not in (None, ""):
            return value
    return ""


def stable_id(platform: str, row_id: str, text: str = "", url: str = "") -> str:
    base = row_id or f"{url}|{text}"
    digest = hashlib.sha1(f"{platform}|{base}".encode("utf-8")).hexdigest()[:12]
    return f"{platform}_{digest}"


def load_parent_posts() -> dict[str, dict[str, str]]:
    posts: dict[str, dict[str, str]] = {}
    for path in POST_FILES:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                post_id = row.get("post_id") or row.get("data_id")
                if post_id:
                    posts[post_id] = row
    return posts


def normalize_parent_comment_id(raw_parent: str, comment_id: str) -> str:
    if not raw_parent or raw_parent == comment_id:
        return ""
    return raw_parent


def parse_date(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None
    if value.isdigit():
        number = int(value)
        if number > 10_000_000_000:
            number = number // 1000
        try:
            return datetime.fromtimestamp(number).date()
        except (OSError, OverflowError, ValueError):
            return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).date()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt).date()
        except ValueError:
            continue
    return None


def in_date_window(row: dict[str, str], parent_post: dict[str, str], start_date: date, end_date: date) -> bool:
    published = parse_date(first_value(row, FIELD_CANDIDATES["publish_time"])) or parse_date(parent_post.get("publish_time", ""))
    return published is not None and start_date <= published <= end_date


def normalize_row(
    row: dict[str, str],
    platform: str,
    keyword: str,
    input_path: Path,
    parent_posts: dict[str, dict[str, str]],
    rank_by_post: dict[str, int],
) -> dict[str, str]:
    raw_comment_id = first_value(row, FIELD_CANDIDATES["comment_id"])
    raw_post_id = first_value(row, FIELD_CANDIDATES["post_id"])
    text = first_value(row, FIELD_CANDIDATES["text"])
    comment_id = stable_id(platform, raw_comment_id, text)
    parent_post_id = stable_id(platform, raw_post_id)
    parent_comment_id = normalize_parent_comment_id(first_value(row, FIELD_CANDIDATES["parent_comment_id"]), raw_comment_id)
    parent_post = parent_posts.get(parent_post_id, {})

    rank_by_post[parent_post_id] += 1
    output = {column: "" for column in COMMENT_COLUMNS}
    output.update(
        {
            "comment_id": comment_id,
            "parent_post_id": parent_post_id,
            "parent_comment_id": parent_comment_id,
            "platform": platform,
            "keyword": row.get("source_keyword") or row.get("keyword") or parent_post.get("keyword") or keyword,
            "url": parent_post.get("url", ""),
            "publish_time": first_value(row, FIELD_CANDIDATES["publish_time"]),
            "crawl_time": datetime.now().isoformat(timespec="seconds"),
            "author_id_hash": first_value(row, FIELD_CANDIDATES["author"]),
            "comment_text_raw": text,
            "comment_level": "2" if parent_comment_id else "1",
            "comment_rank": str(rank_by_post[parent_post_id]),
            "comment_like_count": first_value(row, FIELD_CANDIDATES["like"]),
            "comment_reply_count": first_value(row, FIELD_CANDIDATES["reply"]),
            "source_type": "comment",
            "remark": f"imported_from={input_path.as_posix()};raw_post_id={raw_post_id};raw_comment_id={raw_comment_id}",
        }
    )
    return output


def append_rows(out_file: Path, rows: list[dict[str, str]]) -> int:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    file_exists = out_file.exists() and out_file.stat().st_size > 0
    existing_ids = set()
    if file_exists:
        with out_file.open("r", encoding="utf-8-sig", newline="") as f:
            existing_ids = {row.get("comment_id", "") for row in csv.DictReader(f)}

    new_rows = [row for row in rows if row["comment_id"] not in existing_ids]
    with out_file.open("a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COMMENT_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(new_rows)
    return len(new_rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import MediaCrawler comment CSV into project comment schema.")
    parser.add_argument("--input", required=True, help="MediaCrawler comment CSV file path")
    parser.add_argument("--platform", required=True, choices=["wb", "weibo", "xhs", "zhihu"])
    parser.add_argument("--keyword", default="", help="Keyword used for this crawl")
    parser.add_argument("--start-date", default="2024-01-01", help="Only import comments/posts on or after this date.")
    parser.add_argument("--end-date", default=date.today().isoformat(), help="Only import comments/posts on or before this date.")
    args = parser.parse_args()

    platform = "wb" if args.platform == "weibo" else args.platform
    input_path = Path(args.input)
    if not input_path.is_absolute():
        input_path = (ROOT / input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    parent_posts = load_parent_posts()
    rank_by_post: dict[str, int] = defaultdict(int)
    start_date = date.fromisoformat(args.start_date)
    end_date = date.fromisoformat(args.end_date)
    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = []
        for row in csv.DictReader(f):
            if not any((value or "").strip() for value in row.values()):
                continue
            raw_post_id = first_value(row, FIELD_CANDIDATES["post_id"])
            parent_post = parent_posts.get(stable_id(platform, raw_post_id), {})
            if in_date_window(row, parent_post, start_date, end_date):
                rows.append(normalize_row(row, platform, args.keyword, input_path, parent_posts, rank_by_post))

    out_file = ROOT / "data/raw/raw_comments_all_platforms.csv"
    imported = append_rows(out_file, rows)
    print(f"imported comments={imported}/{len(rows)} to {out_file.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
