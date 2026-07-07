from __future__ import annotations

import argparse
import csv
import hashlib
from datetime import date, datetime
from pathlib import Path

from config_loader import ROOT


RAW_COLUMNS = [
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
]

PLATFORM_TO_FILE = {
    "wb": ROOT / "data/raw/raw_data_weibo.csv",
    "weibo": ROOT / "data/raw/raw_data_weibo.csv",
    "xhs": ROOT / "data/raw/raw_data_xhs.csv",
    "zhihu": ROOT / "data/raw/raw_data_zhihu.csv",
    "wechat": ROOT / "data/raw/raw_data_wechat.csv",
}

FIELD_CANDIDATES = {
    "id": ["note_id", "content_id", "comment_id", "video_id", "aweme_id", "id"],
    "url": ["note_url", "content_url", "video_url", "url", "source_url"],
    "publish_time": ["publish_time", "create_date_time", "created_time", "create_time", "time", "last_modify_ts"],
    "author": ["creator_hash", "author_id_hash", "user_id", "user_id_hash", "nickname", "user_nickname"],
    "title": ["title", "display_title"],
    "text": ["desc", "content", "content_text", "text", "note_desc", "comment_content"],
    "like": ["liked_count", "like_count", "voteup_count"],
    "comment": ["comment_count", "comments_count", "sub_comment_count"],
    "share": ["share_count", "shared_count", "repost_count"],
    "collect": ["collected_count", "collect_count", "favorite_count"],
}


def first_value(row: dict[str, str], candidates: list[str]) -> str:
    lower_map = {key.lower(): value for key, value in row.items()}
    for candidate in candidates:
        value = lower_map.get(candidate.lower())
        if value not in (None, ""):
            return value
    return ""


def stable_id(platform: str, row_id: str, text: str, url: str) -> str:
    base = row_id or f"{url}|{text}"
    digest = hashlib.sha1(f"{platform}|{base}".encode("utf-8")).hexdigest()[:12]
    return f"{platform}_{digest}"


def infer_source_type(path: Path) -> str:
    name = path.name.lower()
    if "comment" in name:
        return "comment"
    if "article" in name:
        return "article"
    if "answer" in name:
        return "answer"
    return "post"


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


def in_date_window(row: dict[str, str], start_date: date, end_date: date) -> bool:
    published = parse_date(first_value(row, FIELD_CANDIDATES["publish_time"]))
    return published is not None and start_date <= published <= end_date


def normalize_row(row: dict[str, str], platform: str, keyword: str, source_type: str, input_path: Path) -> dict[str, str]:
    row_id = first_value(row, FIELD_CANDIDATES["id"])
    title = first_value(row, FIELD_CANDIDATES["title"])
    text = first_value(row, FIELD_CANDIDATES["text"])
    url = first_value(row, FIELD_CANDIDATES["url"])
    output = {column: "" for column in RAW_COLUMNS}
    source_keyword = row.get("source_keyword") or row.get("keyword") or keyword
    output.update(
        {
            "post_id": stable_id(platform, row_id, text, url),
            "data_id": stable_id(platform, row_id, text, url),
            "platform": platform,
            "keyword": source_keyword,
            "url": url,
            "publish_time": first_value(row, FIELD_CANDIDATES["publish_time"]),
            "crawl_time": datetime.now().isoformat(timespec="seconds"),
            "author_id_hash": first_value(row, FIELD_CANDIDATES["author"]),
            "title": title,
            "text_raw": text or title,
            "like_count": first_value(row, FIELD_CANDIDATES["like"]),
            "comment_count": first_value(row, FIELD_CANDIDATES["comment"]),
            "repost_or_share_count": first_value(row, FIELD_CANDIDATES["share"]),
            "collect_count": first_value(row, FIELD_CANDIDATES["collect"]),
            "source_type": source_type,
            "is_repost": "0",
            "remark": f"imported_from={input_path.as_posix()}",
        }
    )
    return output


def append_rows(out_file: Path, rows: list[dict[str, str]]) -> None:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    file_exists = out_file.exists() and out_file.stat().st_size > 0
    existing_ids = set()
    if file_exists:
        with out_file.open("r", encoding="utf-8-sig", newline="") as f:
            existing_ids = {row.get("data_id", "") for row in csv.DictReader(f)}

    rows = [row for row in rows if row["data_id"] not in existing_ids]
    with out_file.open("a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=RAW_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import MediaCrawler CSV into project raw schema.")
    parser.add_argument("--input", required=True, help="MediaCrawler CSV file path")
    parser.add_argument("--platform", required=True, choices=sorted(PLATFORM_TO_FILE))
    parser.add_argument("--keyword", default="", help="Keyword used for this crawl")
    parser.add_argument("--source-type", default="", help="post/comment/answer/article; inferred from filename if empty")
    parser.add_argument("--start-date", default="2024-01-01", help="Only import posts on or after this date.")
    parser.add_argument("--end-date", default=date.today().isoformat(), help="Only import posts on or before this date.")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.is_absolute():
        input_path = (ROOT / input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    source_type = args.source_type or infer_source_type(input_path)
    start_date = date.fromisoformat(args.start_date)
    end_date = date.fromisoformat(args.end_date)
    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = [
            normalize_row(row, args.platform, args.keyword, source_type, input_path)
            for row in csv.DictReader(f)
            if any((value or "").strip() for value in row.values()) and in_date_window(row, start_date, end_date)
        ]

    append_rows(PLATFORM_TO_FILE[args.platform], rows)
    print(f"imported rows={len(rows)} to {PLATFORM_TO_FILE[args.platform].relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
