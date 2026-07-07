from __future__ import annotations

from clean_text import normalize_row
from config_loader import ROOT, load_nested_lists, load_top_level_list
from label_rules import label_row


def main() -> int:
    sample = {
        "data_id": "",
        "platform": "weibo",
        "keyword": "把聊天记录发给 AI",
        "url": "https://example.com/post/1",
        "publish_time": "2026-07-01 12:00:00",
        "crawl_time": "2026-07-05 23:30:00",
        "author_id_hash": "anon_001",
        "title": "",
        "text_raw": "把聊天记录发给 AI 分析 crush，感觉挺好用，但又怕隐私泄露和关系误判。",
        "like_count": "10",
        "comment_count": "2",
        "repost_or_share_count": "1",
        "collect_count": "0",
        "source_type": "post",
        "is_repost": "0",
        "remark": "",
    }

    exclude_terms = load_top_level_list(ROOT / "config/keywords.yaml", "exclude_terms")
    clean = normalize_row(sample, set(), exclude_terms)
    rules = {
        section: load_nested_lists(ROOT / "config/label_dict.yaml", section)
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
    labeled = label_row(clean, rules)

    checks = {
        "scene S2": "S2" in labeled["scene_labels"],
        "scene S3": "S3" in labeled["scene_labels"],
        "usage U5": "U5" in labeled["usage_labels"],
        "risk K3": "K3" in labeled["risk_labels"],
        "risk K4": "K4" in labeled["risk_labels"],
        "topic T2": "T2" in labeled["topic_labels"],
        "topic T7": "T7" in labeled["topic_labels"],
    }

    for name, passed in checks.items():
        print(f"{'OK' if passed else 'FAIL'} {name}")

    if not all(checks.values()):
        print(labeled)
        return 1

    print("smoke test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
