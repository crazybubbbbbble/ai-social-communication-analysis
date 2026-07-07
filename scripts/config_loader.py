from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def strip_yaml_value(value: str) -> str:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return value


def load_top_level_list(path: Path, key: str) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    values: list[str] = []
    collecting = False

    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0 and stripped == f"{key}:":
            collecting = True
            continue

        if collecting and indent == 0 and stripped.endswith(":"):
            break

        if collecting and stripped.startswith("- "):
            values.append(strip_yaml_value(stripped[2:]))

    return values


def load_nested_lists(path: Path, section: str) -> dict[str, list[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    result: dict[str, list[str]] = {}
    in_section = False
    current_key: str | None = None
    in_keywords = False

    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0 and stripped == f"{section}:":
            in_section = True
            continue

        if in_section and indent == 0 and stripped.endswith(":"):
            break

        if not in_section:
            continue

        if indent == 2 and stripped.endswith(":"):
            current_key = stripped[:-1]
            result.setdefault(current_key, [])
            in_keywords = False
            continue

        if current_key and indent == 4 and stripped == "keywords:":
            in_keywords = True
            continue

        if current_key and in_keywords and indent >= 6 and stripped.startswith("- "):
            result[current_key].append(strip_yaml_value(stripped[2:]))

    return result


def load_grouped_lists(path: Path, section: str) -> dict[str, list[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    result: dict[str, list[str]] = {}
    in_section = False
    current_key: str | None = None

    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0 and stripped == f"{section}:":
            in_section = True
            continue

        if in_section and indent == 0 and stripped.endswith(":"):
            break

        if not in_section:
            continue

        if indent == 2 and stripped.endswith(":"):
            current_key = stripped[:-1]
            result.setdefault(current_key, [])
            continue

        if current_key and indent >= 4 and stripped.startswith("- "):
            result[current_key].append(strip_yaml_value(stripped[2:]))

    return result


def load_nested_names(path: Path, section: str) -> dict[str, str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    result: dict[str, str] = {}
    in_section = False
    current_key: str | None = None

    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0 and stripped == f"{section}:":
            in_section = True
            continue

        if in_section and indent == 0 and stripped.endswith(":"):
            break

        if not in_section:
            continue

        if indent == 2 and stripped.endswith(":"):
            current_key = stripped[:-1]
            continue

        if current_key and indent == 4 and stripped.startswith("name:"):
            result[current_key] = strip_yaml_value(stripped.split(":", 1)[1])

    return result


def contains_any(text: str, keywords: list[str]) -> list[str]:
    normalized = text.lower()
    hits = []
    for keyword in keywords:
        if keyword and keyword.lower() in normalized:
            hits.append(keyword)
    return hits
