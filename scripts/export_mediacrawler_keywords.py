from __future__ import annotations

from pathlib import Path

from config_loader import ROOT, load_grouped_lists, load_top_level_list


KEYWORDS_FILE = ROOT / "config/keywords.yaml"
OUT_DIR = ROOT / "config/mediacrawler_keywords"


GROUPS = {
    "weibo_p0": [
        "weibo_required",
        "weibo_expansion",
        "weibo_risk",
        "weibo_campus",
        "internet_slang_keywords",
    ],
    "xhs_p1": [
        "xhs",
        "internet_slang_keywords",
    ],
    "zhihu_p1": [
        "zhihu",
        "internet_slang_keywords",
    ],
    "wechat_p2": [
        "wechat",
        "internet_slang_keywords",
    ],
}


def unique_preserve_order(values: list[str]) -> list[str]:
    seen = set()
    output = []
    for value in values:
        if value not in seen:
            seen.add(value)
            output.append(value)
    return output


def platform_keywords() -> dict[str, list[str]]:
    platform_groups = load_grouped_lists(KEYWORDS_FILE, "platform_keywords")
    slang = load_top_level_list(KEYWORDS_FILE, "internet_slang_keywords")
    result: dict[str, list[str]] = {}

    for output_name, source_groups in GROUPS.items():
        values: list[str] = []
        for source in source_groups:
            if source == "internet_slang_keywords":
                values.extend(slang)
            else:
                values.extend(platform_groups.get(source, []))
        result[output_name] = unique_preserve_order(values)

    return result


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, keywords in platform_keywords().items():
        txt_path = OUT_DIR / f"{name}.txt"
        csv_path = OUT_DIR / f"{name}_comma.txt"
        txt_path.write_text("\n".join(keywords) + "\n", encoding="utf-8")
        csv_path.write_text(",".join(keywords), encoding="utf-8")
        print(f"wrote {txt_path.relative_to(ROOT)} count={len(keywords)}")
        print(f"wrote {csv_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
