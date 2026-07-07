from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path

from config_loader import ROOT


IN_FILE = ROOT / "data/clean/labeled_all_platforms.csv"
STOPWORDS_FILE = ROOT / "config/stopwords.txt"
KEEPWORDS_FILE = ROOT / "config/keepwords.txt"
OUT_FILE = ROOT / "data/stats/word_freq_top30.csv"


def load_words(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def tokenize(text: str, keepwords: list[str]) -> list[str]:
    try:
        import jieba  # type: ignore

        for word in keepwords:
            jieba.add_word(word)
        return [token.strip() for token in jieba.lcut(text) if token.strip()]
    except Exception:
        tokens = []
        for word in keepwords:
            if word in text:
                tokens.append(word)
        tokens.extend(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_+-]{1,}", text))
        return tokens


def main() -> int:
    stopwords = set(load_words(STOPWORDS_FILE))
    keepwords = load_words(KEEPWORDS_FILE)
    counter: Counter[str] = Counter()

    with IN_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("delete_reason"):
                continue
            for token in tokenize(row.get("text_clean", ""), keepwords):
                if token in stopwords:
                    continue
                if len(token) < 2 and token.upper() != "AI":
                    continue
                counter[token] += 1

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["word", "count"])
        writer.writeheader()
        for word, count in counter.most_common(30):
            writer.writerow({"word": word, "count": count})

    print(f"wrote {OUT_FILE.relative_to(ROOT)} words={len(counter)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
