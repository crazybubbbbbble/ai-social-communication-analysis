from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

from config_loader import ROOT


IN_FILE = ROOT / "data/clean/labeled_all_platforms.csv"
COMMENT_FILE = ROOT / "data/clean/labeled_comments_all_platforms.csv"
OUT_DIR = ROOT / "data/stats"


def read_rows() -> list[dict[str, str]]:
    if not IN_FILE.exists():
        return []
    with IN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_comment_rows() -> list[dict[str, str]]:
    if not COMMENT_FILE.exists():
        return []
    with COMMENT_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def post_topic_map(rows: list[dict[str, str]]) -> dict[str, str]:
    return {
        row.get("post_id") or row.get("data_id", ""): row.get("primary_topic_label", "")
        for row in rows
        if row.get("post_id") or row.get("data_id")
    }


def kept_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    return [row for row in rows if not row.get("delete_reason")]


def write_counts(path: Path, key_name: str, counts: Counter[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[key_name, "count"])
        writer.writeheader()
        for key, count in counts.most_common():
            writer.writerow({key_name: key, "count": count})


def count_single(rows: list[dict[str, str]], field: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for row in rows:
        value = row.get(field, "").strip()
        if value:
            counts[value] += 1
    return counts


def count_multi(rows: list[dict[str, str]], field: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for row in rows:
        for value in row.get(field, "").split("|"):
            value = value.strip()
            if value:
                counts[value] += 1
    return counts


def write_cross_table(path: Path, rows: list[dict[str, str]], row_field: str, col_field: str) -> None:
    row_values = sorted({row.get(row_field, "") for row in rows if row.get(row_field, "")})
    col_values = sorted({row.get(col_field, "") for row in rows if row.get(col_field, "")})
    table: dict[str, Counter[str]] = defaultdict(Counter)

    for row in rows:
        r = row.get(row_field, "")
        c = row.get(col_field, "")
        if r and c:
            table[r][c] += 1

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[row_field] + col_values)
        writer.writeheader()
        for r in row_values:
            out = {row_field: r}
            for c in col_values:
                out[c] = table[r][c]
            writer.writerow(out)


def write_long_cross_counts(path: Path, rows: list[dict[str, str]], row_field: str, col_field: str) -> None:
    counts: Counter[tuple[str, str]] = Counter()
    for row in rows:
        row_value = row.get(row_field, "")
        col_value = row.get(col_field, "")
        if row_value and col_value:
            counts[(row_value, col_value)] += 1

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[row_field, col_field, "count"])
        writer.writeheader()
        for (row_value, col_value), count in sorted(counts.items()):
            writer.writerow({row_field: row_value, col_field: col_value, "count": count})


def write_post_topic_comment_attitude(rows: list[dict[str, str]], comments: list[dict[str, str]]) -> None:
    topics = post_topic_map(rows)
    enriched_comments: list[dict[str, str]] = []
    for comment in comments:
        topic = topics.get(comment.get("parent_post_id", ""))
        if not topic:
            continue
        enriched = dict(comment)
        enriched["primary_topic_label"] = topic
        enriched_comments.append(enriched)

    write_long_cross_counts(
        OUT_DIR / "comment_topic_attitude_cross.csv",
        enriched_comments,
        "primary_topic_label",
        "comment_attitude_to_post",
    )


def write_high_interaction_comment_topics(comments: list[dict[str, str]]) -> None:
    def like_count(row: dict[str, str]) -> int:
        try:
            return int(float(row.get("comment_like_count", "") or 0))
        except ValueError:
            return 0

    ranked = sorted(comments, key=like_count, reverse=True)
    selected = [row for row in ranked[:30] if like_count(row) > 0] or ranked[:30]
    counts: Counter[str] = Counter()
    for row in selected:
        topics = [value.strip() for value in row.get("comment_topic_labels", "").split("|") if value.strip()]
        if not topics and row.get("comment_role_label"):
            topics = [row["comment_role_label"]]
        for topic in topics:
            counts[topic] += 1

    write_counts(OUT_DIR / "high_interaction_comment_topic_stat.csv", "comment_topic_labels", counts)


def main() -> int:
    rows = read_rows()
    comment_rows = read_comment_rows()
    rows_kept = kept_rows(rows)
    comment_rows_kept = kept_rows(comment_rows)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    write_counts(OUT_DIR / "platform_stat.csv", "platform", count_single(rows_kept, "platform"))
    write_counts(OUT_DIR / "keyword_stat.csv", "keyword", count_single(rows_kept, "keyword"))
    write_counts(OUT_DIR / "scene_stat.csv", "primary_scene_label", count_single(rows_kept, "primary_scene_label"))
    write_counts(OUT_DIR / "relation_stat.csv", "relation_label", count_multi(rows_kept, "relation_labels"))
    write_counts(OUT_DIR / "motivation_stat.csv", "motivation_label", count_multi(rows_kept, "motivation_labels"))
    write_counts(OUT_DIR / "usage_stat.csv", "usage_label", count_multi(rows_kept, "usage_labels"))
    write_counts(OUT_DIR / "topic_stat.csv", "primary_topic_label", count_single(rows_kept, "primary_topic_label"))
    write_counts(OUT_DIR / "attitude_stat.csv", "attitude_label", count_single(rows_kept, "attitude_label"))
    write_counts(OUT_DIR / "sentiment_stat.csv", "sentiment_label", count_single(rows_kept, "sentiment_label"))
    write_counts(OUT_DIR / "risk_stat.csv", "primary_risk_label", count_single(rows_kept, "primary_risk_label"))
    write_counts(OUT_DIR / "delete_reason_stat.csv", "delete_reason", count_single(rows, "delete_reason"))

    write_cross_table(
        OUT_DIR / "scene_risk_cross.csv",
        rows_kept,
        "primary_scene_label",
        "primary_risk_label",
    )
    write_cross_table(
        OUT_DIR / "scene_attitude_cross.csv",
        rows_kept,
        "primary_scene_label",
        "attitude_label",
    )
    write_cross_table(
        OUT_DIR / "platform_topic_cross.csv",
        rows_kept,
        "platform",
        "primary_topic_label",
    )
    write_counts(OUT_DIR / "comment_role_stat.csv", "comment_role_label", count_single(comment_rows_kept, "comment_role_label"))
    write_counts(OUT_DIR / "comment_attitude_stat.csv", "comment_attitude_to_post", count_single(comment_rows_kept, "comment_attitude_to_post"))
    write_counts(OUT_DIR / "post_comment_consistency_stat.csv", "post_comment_consistency", count_single(comment_rows_kept, "post_comment_consistency"))
    write_counts(OUT_DIR / "comment_delete_reason_stat.csv", "delete_reason", count_single(comment_rows, "delete_reason"))
    write_post_topic_comment_attitude(rows_kept, comment_rows_kept)
    write_high_interaction_comment_topics(comment_rows_kept)

    write_source_structure(rows, comment_rows)

    print(f"wrote stats rows={len(rows)} kept={len(rows_kept)} comments={len(comment_rows)} comment_kept={len(comment_rows_kept)} to {OUT_DIR.relative_to(ROOT)}")
    return 0


def write_source_structure(rows: list[dict[str, str]], comment_rows: list[dict[str, str]]) -> None:
    counts: Counter[tuple[str, str]] = Counter()
    for row in rows:
        if not row.get("delete_reason"):
            counts[(row.get("platform", ""), row.get("source_type", "post") or "post")] += 1
    for row in comment_rows:
        if not row.get("delete_reason"):
            counts[(row.get("platform", ""), "comment")] += 1

    path = OUT_DIR / "source_type_structure.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["platform_source_type", "platform", "source_type", "count"])
        writer.writeheader()
        for (platform, source_type), count in sorted(counts.items()):
            writer.writerow(
                {
                    "platform_source_type": f"{platform}_{source_type}",
                    "platform": platform,
                    "source_type": source_type,
                    "count": count,
                }
            )


if __name__ == "__main__":
    raise SystemExit(main())
