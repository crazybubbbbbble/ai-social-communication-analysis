from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from config_loader import ROOT, load_nested_names


LABELS_FILE = ROOT / "config/label_dict.yaml"
POST_FILE = ROOT / "data/clean/labeled_all_platforms.csv"
COMMENT_FILE = ROOT / "data/clean/labeled_comments_all_platforms.csv"
STATS_DIR = ROOT / "data/stats"
OUT_FILE = ROOT / "visualization_app/public/data/dashboard.json"
ALLOWED_PLATFORMS = {"wb", "xhs"}
EXCLUDED_SOURCE_TERMS = ("知乎", "公众号", "微信公众")

NAME_SECTIONS = {
    "scene": "scene_labels",
    "relation": "relation_labels",
    "motivation": "motivation_labels",
    "usage": "usage_labels",
    "risk": "risk_labels",
    "attitude": "attitude_labels",
    "topic": "topic_labels",
    "commentRole": "comment_role_labels",
    "commentAttitude": "comment_attitude_to_post",
}

EXTRA_NAMES = {
    "wb": "微博",
    "xhs": "小红书",
    "post": "帖子",
    "comment": "评论",
    "positive": "正向",
    "neutral": "中性",
    "negative": "负向",
    "mixed": "混合",
    "PC1": "支持原帖",
    "PC2": "共同担忧",
    "PC3": "反对质疑",
    "PC4": "多元讨论",
    "PC5": "低信号保留",
    "support": "支持",
    "oppose": "反对",
    "concern": "担忧",
    "joke": "调侃",
    "ask": "求助",
    "neutral": "中性观察",
    "C0": "低信号评论",
    "T0": "其他沟通主题",
    "S0": "其他沟通场景",
    "M0": "动机未显性",
    "U0": "使用方式未显性",
    "A0": "中性观察",
}

SCENE_RULES = [
    ("S3", ["分析聊天记录", "聊天记录", "判断态度", "潜台词", "是不是", "冷淡", "敷衍"]),
    ("S2", ["恋爱", "crush", "暧昧", "对象", "男朋友", "女朋友", "前任", "分手", "表白", "恋爱军师", "赛博军师", "追人", "哄对象"]),
    ("S1", ["怎么回", "回消息", "回复", "嘴替", "高情商回复", "让 gpt 回", "让GPT回"]),
    ("S5", ["老师", "辅导员", "请假", "社团", "室友", "舍友", "组员", "班委", "实验课", "导师"]),
    ("S4", ["道歉", "安慰", "感谢", "祝福", "拒绝", "解释", "哄", "劝", "阴阳怪气"]),
    ("S7", ["倾诉", "树洞", "陪我聊天", "安慰我", "情绪价值", "emo", "孤独", "焦虑"]),
    ("S6", ["朋友圈", "文案", "配文", "小红书", "个签", "评论区", "发帖"]),
]

TOPIC_RULES = [
    ("T7", ["聊天记录", "截图", "隐私", "上传", "发给ai", "发给 AI", "泄露", "记录发给"]),
    ("T2", ["恋爱军师", "赛博军师", "crush", "喜欢的人", "暧昧", "对象", "男朋友", "女朋友", "追人", "哄对象", "军师 gpt"]),
    ("T1", ["不会回", "怎么回", "回消息", "回复", "嘴替", "帮我回", "代回"]),
    ("T4", ["老师", "辅导员", "请假", "hr", "面试", "领导", "老板", "同事", "导师", "邮件"]),
    ("T6", ["ai味", "AI味", "一眼 ai", "一眼AI", "模板", "不像人", "机械", "去ai味", "去 AI 味"]),
    ("T8", ["代聊", "替我聊", "欺骗", "不真诚", "边界", "翻车", "不是本人"]),
    ("T9", ["依赖", "不会聊天", "不会自己", "能力退化", "上瘾", "离不开"]),
    ("T5", ["情绪价值", "安慰", "陪我聊天", "emo", "倾诉", "难过", "焦虑", "治愈"]),
    ("T3", ["高情商", "话术", "委婉", "得体", "道歉", "拒绝", "阴阳怪气", "会说话"]),
    ("T10", ["哈哈", "笑死", "玩梗", "整活", "离谱", "绷不住", "乐"]),
]

ROLE_RULES = [
    ("C4", ["隐私", "泄露", "依赖", "误判", "风险", "边界", "ai味", "AI味", "不怕", "聊天记录", "别发"]),
    ("C3", ["不同意", "不应该", "不真诚", "欺骗", "反感", "太假", "假的", "不真实", "代聊", "没真心", "伪人"]),
    ("C6", ["怎么回", "怎么办", "求", "能不能", "可以帮", "问一下", "该怎么", "救救", "?"]),
    ("C7", ["提示词", "建议", "推荐", "试试", "可以这样", "先", "再", "让它", "教程", "方法"]),
    ("C1", ["我也", "我用过", "我试过", "亲测", "之前", "我就是", "真的用", "经历", "实践"]),
    ("C2", ["好用", "救命", "确实", "有用", "支持", "同意", "厉害", "很准", "说得对", "真好", "有帮助"]),
    ("C5", ["哈哈", "笑死", "绷不住", "绝了", "离谱", "乐", "整活", "玩梗"]),
]

ATTITUDE_RULES = [
    ("concern", ["担心", "隐私", "泄露", "依赖", "误判", "风险", "边界", "上瘾", "不怕", "过度依赖", "聊天记录", "ai味", "AI味"]),
    ("oppose", ["不同意", "不应该", "不能接受", "不真诚", "欺骗", "反感", "太假", "假的", "不真实", "代聊", "没真心"]),
    ("support", ["同意", "支持", "确实", "好用", "有用", "救命", "厉害", "很准", "说得对", "真好", "有帮助", "贴心"]),
    ("ask", ["怎么回", "怎么办", "求", "能不能", "问一下", "该怎么", "?"]),
    ("joke", ["哈哈", "笑死", "绷不住", "绝了", "离谱", "乐", "整活"]),
]

POST_ATTITUDE_RULES = [
    ("A4", ["担心", "隐私", "泄露", "风险", "不怕", "不敢", "边界", "依赖", "误判", "ai味", "AI味"]),
    ("A5", ["不同意", "不应该", "不真诚", "欺骗", "反感", "太假", "假的", "不真实", "代聊"]),
    ("A1", ["好用", "救命", "有用", "支持", "厉害", "很准", "说得对", "真好", "方便", "省事"]),
    ("A6", ["哈哈", "笑死", "绷不住", "绝了", "离谱", "整活", "玩梗"]),
    ("A7", ["怎么回", "怎么办", "求", "能不能", "问一下", "该怎么"]),
    ("A2", ["我也", "我用过", "我试过", "亲测", "之前", "经历", "实践"]),
]

MOTIVATION_RULES = [
    ("M5", ["判断", "喜不喜欢", "态度", "潜台词", "关系", "暧昧", "crush"]),
    ("M3", ["高情商", "委婉", "得体", "礼貌", "体面", "话术"]),
    ("M6", ["安慰", "鼓励", "陪我", "情绪价值", "emo", "焦虑"]),
    ("M1", ["不会说", "不会写", "嘴笨", "不知道怎么回", "不知道怎么说", "表达困难"]),
    ("M2", ["社恐", "怕尴尬", "怕冒犯", "怕被讨厌", "怕冷场"]),
    ("M9", ["怕说错", "避免冲突", "别得罪", "不冒犯"]),
    ("M4", ["省时间", "快速", "懒得想", "直接生成"]),
    ("M7", ["学习", "模板", "参考", "话术"]),
    ("M8", ["玩一下", "试试", "整活", "哈哈", "离谱"]),
]

USAGE_RULES = [
    ("U5", ["聊天记录", "截图", "发给 ai", "发给AI", "上传", "记录发给"]),
    ("U6", ["扮演", "恋爱军师", "赛博军师", "心理咨询师"]),
    ("U7", ["像 ai", "像AI", "ai味", "AI味", "去 ai 味", "去AI味"]),
    ("U4", ["再改", "多问", "换个语气", "重写"]),
    ("U3", ["参考", "建议", "看看"]),
    ("U2", ["改一改", "润色", "自己的语气"]),
    ("U1", ["直接复制", "照抄", "原封不动"]),
]

RISK_RULES = [
    ("K3", ["隐私", "聊天记录", "截图", "泄露", "上传", "读聊天记录", "发给ai", "发给 AI"]),
    ("K2", ["ai味", "AI味", "一眼 ai", "一眼AI", "模板", "模板化", "太假", "去ai味", "去 AI 味"]),
    ("K6", ["代聊", "欺骗", "边界", "不真实", "伪人", "不是本人"]),
    ("K1", ["不像自己", "不真诚", "没感情", "真实感", "没真心", "套路"]),
    ("K4", ["误判", "分析错", "判断错", "翻车", "认知偏差"]),
    ("K5", ["依赖", "离不开", "不会自己表达", "不会聊天", "上瘾"]),
    ("K7", ["误导", "迎合", "上头", "冲动", "瞎编"]),
    ("K8", ["工具记录", "账号数据", "第三方"]),
]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_counts(path: Path, key: str) -> list[dict[str, int | str]]:
    rows = []
    for row in read_csv(path):
        code = row.get(key, "")
        if not code:
            continue
        rows.append({"code": code, "name": display_name(code), "count": int(float(row.get("count", 0) or 0))})
    return rows


def has_excluded_source_term(row: dict[str, str]) -> bool:
    text = " ".join(
        [
            row.get("title", ""),
            row.get("text_raw", ""),
            row.get("text_clean", ""),
            row.get("comment_text_raw", ""),
            row.get("comment_text_clean", ""),
            row.get("keyword", ""),
        ]
    )
    return any(term in text for term in EXCLUDED_SOURCE_TERMS)


def actual_platform_counts(posts: list[dict[str, str]]) -> list[dict[str, int | str]]:
    counts = Counter(row.get("platform", "") for row in posts if row.get("platform"))
    return [
        {"code": code, "name": display_name(code), "count": count}
        for code, count in counts.most_common()
    ]


def display_name(code: str) -> str:
    name = NAMES.get(code) or EXTRA_NAMES.get(code) or code
    return name


def parse_int(value: str) -> int:
    try:
        return int(float(value or 0))
    except ValueError:
        return 0


def normalize_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if value.isdigit():
        number = int(value)
        if number > 10_000_000_000:
            number = number / 1000
        if number > 946_684_800:
            try:
                return datetime.fromtimestamp(number, tz=timezone.utc).strftime("%Y-%m-%d")
            except (OSError, OverflowError, ValueError):
                return ""
    if len(value) >= 10 and value[4:5] in {"-", "/"}:
        return value[:10].replace("/", "-")
    return ""


def multi_values(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split("|") if item.strip()]


def match_rule(text: str, rules: list[tuple[str, list[str]]]) -> str:
    lowered = (text or "").lower()
    for code, keywords in rules:
        for keyword in keywords:
            if keyword.lower() in lowered:
                return code
    return ""


def infer_topic(row: dict[str, str], fallback: str = "") -> tuple[str, str]:
    original = (row.get("primary_topic_label") or row.get("comment_topic_labels", "").split("|")[0]).strip()
    if original:
        return original, "人工/规则初标"
    text = " ".join(
        [
            row.get("title", ""),
            row.get("keyword", ""),
            row.get("text_clean", ""),
            row.get("comment_text_clean", ""),
        ]
    )
    inferred = match_rule(text, TOPIC_RULES)
    if inferred:
        return inferred, "关键词二次推断"
    if fallback:
        return fallback, "继承原帖主题"
    text_length = len((row.get("text_clean") or row.get("comment_text_clean") or "").strip())
    if text_length >= 8:
        return "T0", "低信号主题归并"
    return "", "未识别"


def combined_post_text(row: dict[str, str]) -> str:
    return " ".join([row.get("title", ""), row.get("keyword", ""), row.get("text_clean", "")])


def infer_post_field(row: dict[str, str], field: str, rules: list[tuple[str, list[str]]], fallback_code: str, fallback_source: str) -> tuple[str, str]:
    original = (row.get(field) or "").split("|")[0].strip()
    if original:
        return original, "人工/规则初标"
    inferred = match_rule(combined_post_text(row), rules)
    if inferred:
        return inferred, "关键词二次推断"
    return fallback_code, fallback_source


def infer_scene(row: dict[str, str]) -> tuple[str, str]:
    return infer_post_field(row, "primary_scene_label", SCENE_RULES, "S0", "低信号场景归并")


def infer_risk(row: dict[str, str]) -> tuple[str, str]:
    return infer_post_field(row, "primary_risk_label", RISK_RULES, "K0", "未出现显性风险")


def infer_post_attitude(row: dict[str, str]) -> tuple[str, str]:
    return infer_post_field(row, "attitude_label", POST_ATTITUDE_RULES, "A0", "低信号中性保留")


def infer_motivation(row: dict[str, str]) -> tuple[str, str]:
    return infer_post_field(row, "motivation_labels", MOTIVATION_RULES, "M0", "动机未显性")


def infer_usage(row: dict[str, str]) -> tuple[str, str]:
    return infer_post_field(row, "usage_labels", USAGE_RULES, "U0", "使用方式未显性")


def infer_comment_role(row: dict[str, str]) -> tuple[str, str]:
    original = (row.get("comment_role_label") or "").strip()
    text = row.get("comment_text_clean", "")
    inferred = match_rule(text, ROLE_RULES)
    if original and original != "C8":
        return original, "人工/规则初标"
    if inferred:
        return inferred, "关键词二次推断"
    if len(text.strip()) >= 5:
        return "C0", "低信号评论保留"
    return original or "C8", "无效或过短"


def infer_comment_attitude(row: dict[str, str], role_code: str) -> tuple[str, str]:
    original = (row.get("comment_attitude_to_post") or "").strip()
    if original:
        return original, "人工/规则初标"
    inferred = match_rule(row.get("comment_text_clean", ""), ATTITUDE_RULES)
    if inferred:
        return inferred, "关键词二次推断"
    if role_code == "C4":
        return "concern", "由评论作用推断"
    if role_code == "C3":
        return "oppose", "由评论作用推断"
    if role_code in {"C1", "C2", "C7"}:
        return "support", "由评论作用推断"
    if role_code == "C6":
        return "ask", "由评论作用推断"
    if role_code == "C5":
        return "joke", "由评论作用推断"
    return "neutral", "低信号中性保留"


def infer_consistency(attitude_code: str, role_code: str) -> tuple[str, str]:
    if role_code == "C8":
        return "PC5", "无效或过短"
    if attitude_code == "support":
        return "PC1", "由评论态度推断"
    if attitude_code == "concern":
        return "PC2", "由评论态度推断"
    if attitude_code == "oppose":
        return "PC3", "由评论态度推断"
    return "PC4", "由评论态度推断"


def top_examples(posts: list[dict[str, str]], comments: list[dict[str, str]]) -> list[dict[str, object]]:
    comment_count_by_post = Counter(c["parent_post_id"] for c in comments if not c.get("delete_reason") and c.get("parent_post_id"))
    ranked = sorted(
        posts,
        key=lambda row: parse_int(row.get("like_count", "")) + parse_int(row.get("comment_count", "")) * 3 + comment_count_by_post[row.get("post_id", "")] * 2,
        reverse=True,
    )
    examples = []
    for row in ranked[:80]:
        text = row.get("text_clean", "")
        topic_code, _ = infer_topic(row)
        scene_code, _ = infer_scene(row)
        risk_code, _ = infer_risk(row)
        attitude_code, _ = infer_post_attitude(row)
        examples.append(
            {
                "id": row.get("post_id"),
                "platform": row.get("platform"),
                "platformName": display_name(row.get("platform", "")),
                "keyword": row.get("keyword"),
                "scene": display_name(scene_code),
                "topic": display_name(topic_code),
                "risk": display_name(risk_code),
                "attitude": display_name(attitude_code),
                "likes": parse_int(row.get("like_count", "")),
                "comments": parse_int(row.get("comment_count", "")),
                "linkedComments": comment_count_by_post[row.get("post_id", "")],
                "text": text[:180] + ("..." if len(text) > 180 else ""),
            }
        )
    return examples


def sankey_links(posts: list[dict[str, str]]) -> list[dict[str, object]]:
    counts: Counter[tuple[str, str]] = Counter()
    for row in posts:
        scene, _ = infer_scene(row)
        topic, _ = infer_topic(row)
        risk, _ = infer_risk(row)
        if scene and topic:
            counts[(f"场景|{display_name(scene)}", f"主题|{display_name(topic)}")] += 1
        if topic and risk:
            counts[(f"主题|{display_name(topic)}", f"风险|{display_name(risk)}")] += 1
    return [{"source": source, "target": target, "value": count} for (source, target), count in counts.items() if count >= 2]


def network(posts: list[dict[str, str]], comments: list[dict[str, str]]) -> dict[str, list[dict[str, object]]]:
    nodes: dict[str, dict[str, object]] = {}
    links: list[dict[str, object]] = []

    def add_node(node_id: str, name: str, group: str, value: int = 1) -> None:
        if not node_id:
            return
        existing = nodes.get(node_id)
        if existing:
            existing["value"] = int(existing["value"]) + value
            return
        nodes[node_id] = {"id": node_id, "name": name, "group": group, "value": value}

    for row in posts:
        post_id = row.get("post_id", "")
        topic, _ = infer_topic(row)
        risk, _ = infer_risk(row)
        scene, _ = infer_scene(row)
        add_node(post_id, (row.get("text_clean", "")[:38] or row.get("keyword", "")), "post", 1)
        for code, group in [(topic, "topic"), (risk, "risk"), (scene, "scene")]:
            if code:
                node_id = f"{group}:{code}"
                add_node(node_id, display_name(code), group, 3)
                links.append({"source": post_id, "target": node_id, "value": 1})

    for row in comments:
        parent = row.get("parent_post_id", "")
        role = row.get("comment_role_label", "")
        attitude = row.get("comment_attitude_to_post", "")
        if parent:
            for code, group in [(role, "commentRole"), (attitude, "commentAttitude")]:
                if code:
                    node_id = f"{group}:{code}"
                    add_node(node_id, display_name(code), group, 1)
                    links.append({"source": parent, "target": node_id, "value": 1})

    top_nodes = sorted(nodes.values(), key=lambda row: int(row["value"]), reverse=True)
    keep = {row["id"] for row in top_nodes[:220]}
    filtered_links = [link for link in links if link["source"] in keep and link["target"] in keep]
    return {"nodes": [row for row in top_nodes if row["id"] in keep], "links": filtered_links[:700]}


def cooccurrence(posts: list[dict[str, str]]) -> list[dict[str, object]]:
    counts: Counter[tuple[str, str]] = Counter()
    fields = ["scene_labels", "topic_labels", "risk_labels", "usage_labels"]
    for row in posts:
        values = []
        for field in fields:
            values.extend(multi_values(row.get(field, "")))
        values = sorted(set(values))
        for i, source in enumerate(values):
            for target in values[i + 1 :]:
                counts[(source, target)] += 1
    return [
        {"source": display_name(source), "target": display_name(target), "value": count}
        for (source, target), count in counts.most_common(120)
        if count >= 4
    ]


def cross_rows(path: Path, row_field: str) -> list[dict[str, object]]:
    rows = []
    for row in read_csv(path):
        source = row.get(row_field, "")
        for key, value in row.items():
            if key == row_field or not value:
                continue
            count = parse_int(value)
            if count:
                rows.append({"source": display_name(source), "target": display_name(key), "value": count})
    return rows


def long_cross(path: Path, row_field: str, col_field: str) -> list[dict[str, object]]:
    rows = []
    for row in read_csv(path):
        rows.append(
            {
                "source": display_name(row.get(row_field, "")),
                "target": display_name(row.get(col_field, "")),
                "value": parse_int(row.get("count", "")),
            }
        )
    return [row for row in rows if row["source"] and row["target"] and row["value"]]


def keyword_cloud() -> list[dict[str, object]]:
    rows = read_counts(STATS_DIR / "word_freq_top30.csv", "word")
    return [{"text": row["name"], "value": row["count"]} for row in rows]


def compact_posts(posts: list[dict[str, str]], comments: list[dict[str, str]]) -> list[dict[str, object]]:
    comment_count_by_post = Counter(c["parent_post_id"] for c in comments if not c.get("delete_reason") and c.get("parent_post_id"))
    rows = []
    for row in posts:
        text = row.get("text_clean", "")
        topic_code, topic_source = infer_topic(row)
        scene_code, scene_source = infer_scene(row)
        risk_code, risk_source = infer_risk(row)
        attitude_code, attitude_source = infer_post_attitude(row)
        motivation_code, motivation_source = infer_motivation(row)
        usage_code, usage_source = infer_usage(row)
        rows.append(
            {
                "id": row.get("post_id"),
                "platform": row.get("platform"),
                "platformName": display_name(row.get("platform", "")),
                "keyword": row.get("keyword"),
                "publishTime": normalize_date(row.get("publish_time", "")),
                "title": row.get("title"),
                "text": text[:260] + ("..." if len(text) > 260 else ""),
                "likes": parse_int(row.get("like_count", "")),
                "comments": parse_int(row.get("comment_count", "")),
                "shares": parse_int(row.get("repost_or_share_count", "")),
                "collects": parse_int(row.get("collect_count", "")),
                "scene": display_name(scene_code),
                "sceneCode": scene_code,
                "sceneSource": scene_source,
                "topic": display_name(topic_code),
                "topicCode": topic_code,
                "topicSource": topic_source,
                "risk": display_name(risk_code),
                "riskCode": risk_code,
                "riskSource": risk_source,
                "attitude": display_name(attitude_code),
                "attitudeCode": attitude_code,
                "attitudeSource": attitude_source,
                "motivation": display_name(motivation_code),
                "motivationCode": motivation_code,
                "motivationSource": motivation_source,
                "usage": display_name(usage_code),
                "usageCode": usage_code,
                "usageSource": usage_source,
                "sentiment": display_name(row.get("sentiment_label", "")),
                "linkedComments": comment_count_by_post[row.get("post_id", "")],
                "confidence": row.get("label_confidence", ""),
            }
        )
    return rows


def compact_comments(comments: list[dict[str, str]], posts: list[dict[str, str]]) -> list[dict[str, object]]:
    parent_topic: dict[str, str] = {}
    for post in posts:
        topic_code, _ = infer_topic(post)
        parent_topic[post.get("post_id", "")] = topic_code
    rows = []
    ranked = sorted(comments, key=lambda row: parse_int(row.get("comment_like_count", "")), reverse=True)
    for row in ranked:
        text = row.get("comment_text_clean", "")
        role_code, role_source = infer_comment_role(row)
        attitude_code, attitude_source = infer_comment_attitude(row, role_code)
        topic_code, topic_source = infer_topic(row, parent_topic.get(row.get("parent_post_id", ""), ""))
        original_consistency = row.get("post_comment_consistency", "").strip()
        consistency_code, consistency_source = (
            (original_consistency, "人工/规则初标") if original_consistency and original_consistency != "PC5" else infer_consistency(attitude_code, role_code)
        )
        rows.append(
            {
                "id": row.get("comment_id"),
                "parentPostId": row.get("parent_post_id"),
                "parentCommentId": row.get("parent_comment_id"),
                "platform": row.get("platform"),
                "platformName": display_name(row.get("platform", "")),
                "keyword": row.get("keyword"),
                "publishTime": normalize_date(row.get("publish_time", "")),
                "text": text[:180] + ("..." if len(text) > 180 else ""),
                "level": parse_int(row.get("comment_level", "")),
                "rank": parse_int(row.get("comment_rank", "")),
                "likes": parse_int(row.get("comment_like_count", "")),
                "replies": parse_int(row.get("comment_reply_count", "")),
                "role": display_name(role_code),
                "roleCode": role_code,
                "roleSource": role_source,
                "attitude": display_name(attitude_code),
                "attitudeCode": attitude_code,
                "attitudeSource": attitude_source,
                "topic": display_name(topic_code),
                "topicCode": topic_code,
                "topicSource": topic_source,
                "consistency": display_name(consistency_code),
                "consistencyCode": consistency_code,
                "consistencySource": consistency_source,
            }
        )
    return rows


NAMES: dict[str, str] = {}
for section in NAME_SECTIONS.values():
    NAMES.update(load_nested_names(LABELS_FILE, section))


def main() -> int:
    raw_posts = read_csv(POST_FILE)
    raw_comments = read_csv(COMMENT_FILE)
    posts = [
        row for row in raw_posts
        if not row.get("delete_reason") and row.get("platform") in ALLOWED_PLATFORMS and not has_excluded_source_term(row)
    ]
    allowed_post_ids = {row.get("post_id") for row in posts}
    comments = [
        row for row in raw_comments
        if (
            not row.get("delete_reason")
            and row.get("platform") in ALLOWED_PLATFORMS
            and row.get("parent_post_id") in allowed_post_ids
            and not has_excluded_source_term(row)
        )
    ]
    compacted_posts = compact_posts(posts, comments)
    compacted_comments = compact_comments(comments, posts)
    triage = {
        "postTopicInferred": sum(1 for row in compacted_posts if row.get("topicSource") != "人工/规则初标"),
        "postSceneInferred": sum(1 for row in compacted_posts if row.get("sceneSource") != "人工/规则初标"),
        "postRiskInferred": sum(1 for row in compacted_posts if row.get("riskSource") != "人工/规则初标"),
        "postAttitudeInferred": sum(1 for row in compacted_posts if row.get("attitudeSource") != "人工/规则初标"),
        "postMotivationInferred": sum(1 for row in compacted_posts if row.get("motivationSource") != "人工/规则初标"),
        "postUsageInferred": sum(1 for row in compacted_posts if row.get("usageSource") != "人工/规则初标"),
        "commentRoleInferred": sum(1 for row in compacted_comments if row.get("roleSource") != "人工/规则初标"),
        "commentAttitudeInferred": sum(1 for row in compacted_comments if row.get("attitudeSource") != "人工/规则初标"),
        "commentTopicInherited": sum(1 for row in compacted_comments if row.get("topicSource") == "继承原帖主题"),
        "commentStillUnclear": sum(1 for row in compacted_comments if row.get("consistencyCode") == "PC5"),
    }

    payload = {
        "meta": {
            "generatedAt": "2026-07-06",
            "postCount": len(posts),
            "commentCount": len(comments),
            "rawPostCount": len(raw_posts),
            "rawCommentCount": len(raw_comments),
            "triage": triage,
        },
        "counts": {
            "platform": actual_platform_counts(posts),
            "scene": read_counts(STATS_DIR / "scene_stat.csv", "primary_scene_label"),
            "topic": read_counts(STATS_DIR / "topic_stat.csv", "primary_topic_label"),
            "risk": read_counts(STATS_DIR / "risk_stat.csv", "primary_risk_label"),
            "relation": read_counts(STATS_DIR / "relation_stat.csv", "relation_label"),
            "motivation": read_counts(STATS_DIR / "motivation_stat.csv", "motivation_label"),
            "usage": read_counts(STATS_DIR / "usage_stat.csv", "usage_label"),
            "attitude": read_counts(STATS_DIR / "attitude_stat.csv", "attitude_label"),
            "commentRole": read_counts(STATS_DIR / "comment_role_stat.csv", "comment_role_label"),
            "commentAttitude": read_counts(STATS_DIR / "comment_attitude_stat.csv", "comment_attitude_to_post"),
            "consistency": read_counts(STATS_DIR / "post_comment_consistency_stat.csv", "post_comment_consistency"),
            "sourceStructure": read_counts(STATS_DIR / "source_type_structure.csv", "platform_source_type"),
            "highInteractionCommentTopics": read_counts(STATS_DIR / "high_interaction_comment_topic_stat.csv", "comment_topic_labels"),
        },
        "flows": {
            "sceneRisk": cross_rows(STATS_DIR / "scene_risk_cross.csv", "primary_scene_label"),
            "sceneAttitude": cross_rows(STATS_DIR / "scene_attitude_cross.csv", "primary_scene_label"),
            "platformTopic": cross_rows(STATS_DIR / "platform_topic_cross.csv", "platform"),
            "topicCommentAttitude": long_cross(STATS_DIR / "comment_topic_attitude_cross.csv", "primary_topic_label", "comment_attitude_to_post"),
            "sankey": sankey_links(posts),
            "cooccurrence": cooccurrence(posts),
        },
        "examples": top_examples(posts, comments),
        "keywordCloud": keyword_cloud(),
        "network": network(posts[:260], comments[:900]),
        "records": {
            "posts": compacted_posts,
            "comments": compacted_comments,
        },
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
