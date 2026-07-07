from __future__ import annotations

import csv
import textwrap
from pathlib import Path

from config_loader import ROOT


STATS_DIR = ROOT / "data/stats"
FIG_DIR = ROOT / "figures/p0_core"
CROSS_FIG_DIR = ROOT / "figures/p1_cross_analysis"

TOKENS = {
    "surface": "#FCFCFD",
    "panel": "#FFFFFF",
    "ink": "#1F2430",
    "muted": "#6F768A",
    "grid": "#E6E8F0",
    "axis": "#D7DBE7",
}

BLUE = {"xlight": "#EAF1FE", "light": "#CEDFFE", "base": "#A3BEFA", "mid": "#5477C4", "dark": "#2E4780"}
ORANGE = {"xlight": "#FFEDDE", "light": "#FFBDA1", "base": "#F0986E", "mid": "#CC6F47", "dark": "#804126"}
OLIVE = {"xlight": "#D8ECBD", "light": "#BEEB96", "base": "#A3D576", "mid": "#71B436", "dark": "#386411"}
GOLD = {"xlight": "#FFF4C2", "light": "#FFEA8F", "base": "#FFE15B", "mid": "#B8A037", "dark": "#736422"}
PINK = {"xlight": "#FCDAD6", "light": "#F5BACC", "base": "#F390CA", "mid": "#BD569B", "dark": "#8A3A6F"}
FAMILIES = [BLUE, ORANGE, OLIVE, GOLD, PINK]

DISPLAY_NAMES = {
    "wb": "微博",
    "xhs": "小红书",
    "post": "帖子",
    "comment": "评论",
    "wb_post": "微博_帖子",
    "wb_comment": "微博_评论",
    "xhs_post": "小红书_帖子",
    "xhs_comment": "小红书_评论",
    "S1": "S1 聊天回复辅助",
    "S2": "S2 恋爱关系咨询",
    "S3": "S3 关系判断分析",
    "S4": "S4 情感表达生成",
    "S5": "S5 校园正式沟通",
    "S6": "S6 社交媒体表达",
    "S7": "S7 情绪倾诉陪伴",
    "S8": "S8 其他人际沟通",
    "R1": "R1 恋爱对象",
    "R2": "R2 朋友同辈",
    "R3": "R3 室友宿舍",
    "R4": "R4 师生校园",
    "R5": "R5 职场实习",
    "R6": "R6 家庭亲属",
    "R7": "R7 不明确对象",
    "M1": "M1 表达能力不足",
    "M2": "M2 社交焦虑规避",
    "M3": "M3 追求高情商表达",
    "M4": "M4 效率便利",
    "M5": "M5 关系不确定性",
    "M6": "M6 情绪支持",
    "M7": "M7 模仿学习",
    "M8": "M8 娱乐尝试",
    "M9": "M9 风险规避",
    "U1": "U1 直接复制",
    "U2": "U2 修改后使用",
    "U3": "U3 只作参考",
    "U4": "U4 多轮追问",
    "U5": "U5 上传聊天记录",
    "U6": "U6 角色扮演",
    "U7": "U7 反向检测",
    "A1": "A1 积极接受",
    "A2": "A2 谨慎接受",
    "A3": "A3 娱乐调侃",
    "A4": "A4 明显担忧",
    "A5": "A5 明确反对",
    "A6": "A6 经验分享",
    "A7": "A7 求助提问",
    "K0": "K0 无明显风险担忧",
    "K1": "K1 真实性下降",
    "K2": "K2 AI味与模板化",
    "K3": "K3 隐私泄露",
    "K4": "K4 关系误判",
    "K5": "K5 依赖风险",
    "K6": "K6 道德边界",
    "K7": "K7 情绪误导",
    "K8": "K8 平台与工具风险",
    "T1": "T1 表达困境",
    "T2": "T2 AI恋爱军师",
    "T3": "T3 高情商话术",
    "T4": "T4 正式沟通",
    "T5": "T5 情绪价值",
    "T6": "T6 AI味",
    "T7": "T7 聊天记录隐私",
    "T8": "T8 代聊伦理",
    "T9": "T9 依赖担忧",
    "T10": "T10 娱乐化使用",
    "C1": "C1 经验补充",
    "C2": "C2 支持认同",
    "C3": "C3 反对质疑",
    "C4": "C4 风险提醒",
    "C5": "C5 调侃玩梗",
    "C6": "C6 求助跟问",
    "C7": "C7 方法建议",
    "C8": "C8 无效评论",
    "support": "支持",
    "oppose": "反对",
    "concern": "担忧",
    "joke": "调侃",
    "ask": "求助",
    "PC1": "PC1 支持原帖",
    "PC2": "PC2 共同担忧",
    "PC3": "PC3 反对质疑",
    "PC4": "PC4 多元讨论",
    "PC5": "PC5 无法判断",
    "positive": "正向",
    "neutral": "中性",
    "negative": "负向",
    "mixed": "混合",
}


def display_label(label: str) -> str:
    return DISPLAY_NAMES.get(label, label)


def read_count_csv(path: Path, key_field: str, limit: int | None = None) -> tuple[list[str], list[int]]:
    if not path.exists():
        return [], []
    rows: list[tuple[str, int]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            label = row.get(key_field, "").strip()
            count = row.get("count", "0")
            if label:
                rows.append((label, int(float(count))))
    if limit:
        rows = rows[:limit]
    return [display_label(row[0]) for row in rows], [row[1] for row in rows]


def setup_matplotlib():
    import matplotlib.pyplot as plt

    plt.rcParams["font.sans-serif"] = [
        "Microsoft YaHei",
        "SimHei",
        "Noto Sans CJK SC",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = TOKENS["surface"]
    plt.rcParams["axes.facecolor"] = TOKENS["panel"]
    plt.rcParams["axes.edgecolor"] = TOKENS["axis"]
    plt.rcParams["axes.labelcolor"] = TOKENS["ink"]
    plt.rcParams["xtick.color"] = TOKENS["muted"]
    plt.rcParams["ytick.color"] = TOKENS["muted"]
    return plt


def add_header(fig, ax, title: str, subtitle: str) -> None:
    ax.set_title("")
    title = textwrap.fill(title, width=44, break_long_words=False)
    subtitle = textwrap.fill(subtitle, width=78, break_long_words=False)
    fig.subplots_adjust(top=0.82)
    left = ax.get_position().x0
    fig.text(left, 0.98, title, ha="left", va="top", fontsize=13, fontweight="semibold", color=TOKENS["ink"])
    fig.text(left, 0.91, subtitle, ha="left", va="top", fontsize=9, color=TOKENS["muted"])
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(TOKENS["axis"])
    ax.spines["bottom"].set_color(TOKENS["axis"])


def save(fig, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, bbox_inches="tight", facecolor=TOKENS["surface"])


def bar_chart(
    path: Path,
    key_field: str,
    title: str,
    subtitle: str,
    output: Path,
    *,
    horizontal: bool = False,
    limit: int | None = None,
    family: dict[str, str] = BLUE,
) -> None:
    labels, counts = read_count_csv(path, key_field, limit=limit)
    if not labels:
        return

    plt = setup_matplotlib()
    fig_width = 9.5 if horizontal else 7.5
    fig_height = max(4.8, 0.42 * len(labels) + 1.3) if horizontal else 5.2
    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=180)

    if horizontal:
        plot_labels = labels[::-1]
        plot_counts = counts[::-1]
        bars = ax.barh(plot_labels, plot_counts, color=family["base"], edgecolor=family["dark"], linewidth=0.8)
        ax.set_xlabel("数量")
        ax.grid(axis="x", color=TOKENS["grid"], linewidth=0.8)
        for bar, value in zip(bars, plot_counts):
            ax.text(value + max(counts) * 0.015, bar.get_y() + bar.get_height() / 2, str(value), va="center", fontsize=8, color=TOKENS["ink"])
        ax.set_xlim(0, max(counts) * 1.14)
    else:
        bars = ax.bar(labels, counts, color=family["base"], edgecolor=family["dark"], linewidth=0.8)
        ax.set_ylabel("数量")
        ax.grid(axis="y", color=TOKENS["grid"], linewidth=0.8)
        ax.tick_params(axis="x", rotation=25)
        for bar, value in zip(bars, counts):
            ax.text(bar.get_x() + bar.get_width() / 2, value + max(counts) * 0.015, str(value), ha="center", va="bottom", fontsize=8, color=TOKENS["ink"])
        ax.set_ylim(0, max(counts) * 1.16)

    add_header(fig, ax, title, subtitle)
    save(fig, output)
    plt.close(fig)


def pie_chart(path: Path, key_field: str, title: str, subtitle: str, output: Path) -> None:
    labels, counts = read_count_csv(path, key_field)
    if not labels:
        return

    plt = setup_matplotlib()
    fig, ax = plt.subplots(figsize=(7.5, 5.6), dpi=180)
    colors = [FAMILIES[i % len(FAMILIES)]["base"] for i in range(len(labels))]
    edge_colors = [FAMILIES[i % len(FAMILIES)]["dark"] for i in range(len(labels))]
    wedges, _ = ax.pie(counts, startangle=90, counterclock=False, colors=colors, wedgeprops={"linewidth": 0.8})
    total = sum(counts)
    for wedge, edge_color in zip(wedges, edge_colors):
        wedge.set_edgecolor(edge_color)
    legend_labels = [f"{label}: {count} ({count / total:.1%})" for label, count in zip(labels, counts)]
    ax.legend(wedges, legend_labels, loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False, fontsize=8)
    add_header(fig, ax, title, subtitle)
    save(fig, output)
    plt.close(fig)


def heatmap_chart(path: Path, row_field: str, col_field: str, value_field: str, title: str, subtitle: str, output: Path) -> None:
    if not path.exists():
        return

    records: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get(row_field) and row.get(col_field):
                records.append(row)
    if not records:
        return

    row_keys = sorted({row[row_field] for row in records})
    col_keys = sorted({row[col_field] for row in records})
    rows = [display_label(value) for value in row_keys]
    cols = [display_label(value) for value in col_keys]
    matrix = [[0 for _ in cols] for _ in rows]
    for record in records:
        row_index = row_keys.index(record[row_field])
        col_index = col_keys.index(record[col_field])
        matrix[row_index][col_index] = int(float(record.get(value_field, "0") or 0))

    plt = setup_matplotlib()
    fig, ax = plt.subplots(figsize=(max(7, len(cols) * 1.35), max(5, len(rows) * 0.58 + 1.4)), dpi=180)
    image = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(cols)), labels=cols, rotation=30, ha="right")
    ax.set_yticks(range(len(rows)), labels=rows)
    for i, row_values in enumerate(matrix):
        for j, value in enumerate(row_values):
            if value:
                ax.text(j, i, str(value), ha="center", va="center", color=TOKENS["ink"], fontsize=8)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    add_header(fig, ax, title, subtitle)
    save(fig, output)
    plt.close(fig)


def main() -> int:
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    CROSS_FIG_DIR.mkdir(parents=True, exist_ok=True)

    bar_chart(STATS_DIR / "platform_stat.csv", "platform", "平台数据来源分布", "有效帖子 n=922，展示主样本来自微博和小红书的构成。", FIG_DIR / "01_platform_distribution.png")
    bar_chart(STATS_DIR / "keyword_stat.csv", "keyword", "关键词命中数量 Top 20", "按清洗后有效帖子统计，用于复核哪些关键词贡献了主要样本。", FIG_DIR / "02_keyword_top.png", horizontal=True, limit=20, family=ORANGE)
    bar_chart(STATS_DIR / "word_freq_top30.csv", "word", "Top 30 高频词", "基于有效正文分词结果，词频只作为主题判断的辅助证据。", FIG_DIR / "03_word_freq_top30.png", horizontal=True, family=BLUE)
    bar_chart(STATS_DIR / "scene_stat.csv", "primary_scene_label", "使用场景分布", "每条帖子取主场景，观察 AI 介入人际沟通的主要入口。", FIG_DIR / "04_scene_distribution.png", family=OLIVE)
    bar_chart(STATS_DIR / "topic_stat.csv", "primary_topic_label", "主题分布", "每条帖子取主主题，用于支撑报告主线和典型案例抽取。", FIG_DIR / "05_topic_distribution.png", horizontal=True, family=ORANGE)
    bar_chart(STATS_DIR / "relation_stat.csv", "relation_label", "关系对象分布", "多标签展开统计，观察 AI 主要介入恋爱、师生、朋友、室友等关系。", FIG_DIR / "06_relation_distribution.png", horizontal=True, family=PINK)
    bar_chart(STATS_DIR / "motivation_stat.csv", "motivation_label", "使用动机分布", "多标签展开统计，解释用户为什么把沟通任务交给 AI。", FIG_DIR / "07_motivation_distribution.png", horizontal=True, family=GOLD)
    bar_chart(STATS_DIR / "usage_stat.csv", "usage_label", "AI 使用方式分布", "多标签展开统计，区分生成回复、润色表达、分析聊天记录等用法。", FIG_DIR / "08_usage_distribution.png", horizontal=True, family=BLUE)
    pie_chart(STATS_DIR / "attitude_stat.csv", "attitude_label", "态度倾向分布", "有效帖子 n=922，区分接受、谨慎、质疑和调侃等态度。", FIG_DIR / "09_attitude_distribution.png")
    pie_chart(STATS_DIR / "sentiment_stat.csv", "sentiment_label", "情感倾向分布", "情感仅作辅助判断，关键结论以主题、场景和风险标签为主。", FIG_DIR / "10_sentiment_distribution.png")
    bar_chart(STATS_DIR / "risk_stat.csv", "primary_risk_label", "风险担忧分布", "每条帖子取主要风险，观察隐私、AI 味、真实性、依赖等边界问题。", FIG_DIR / "11_risk_distribution.png", family=ORANGE)

    bar_chart(STATS_DIR / "source_type_structure.csv", "platform_source_type", "帖子与评论数量结构", "有效帖子 n=922，有效评论 n=1755，用于说明双层数据结构。", CROSS_FIG_DIR / "09_source_type_structure.png", family=BLUE)
    bar_chart(STATS_DIR / "comment_role_stat.csv", "comment_role_label", "评论作用分布", "有效评论 n=1755，统计经验补充、支持认同、风险提醒和方法建议等作用。", CROSS_FIG_DIR / "10_comment_role_distribution.png", horizontal=True, family=OLIVE)
    heatmap_chart(
        STATS_DIR / "comment_topic_attitude_cross.csv",
        "primary_topic_label",
        "comment_attitude_to_post",
        "count",
        "原帖主题 × 评论态度",
        "评论通过 parent_post_id 回连原帖，用于观察不同主题下支持、质疑和风险提醒结构。",
        CROSS_FIG_DIR / "11_topic_attitude_heatmap.png",
    )
    bar_chart(
        STATS_DIR / "high_interaction_comment_topic_stat.csv",
        "comment_topic_labels",
        "高互动评论主题分布",
        "按评论点赞数选取高互动评论，观察哪些评论主题更容易获得反馈。",
        CROSS_FIG_DIR / "12_high_interaction_comment_topics.png",
        horizontal=True,
        family=PINK,
    )
    bar_chart(
        STATS_DIR / "post_comment_consistency_stat.csv",
        "post_comment_consistency",
        "帖子-评论一致性分析",
        "有效评论 n=1755，展示评论区是延续原帖态度、提出反驳，还是形成分化。",
        CROSS_FIG_DIR / "13_post_comment_consistency.png",
        horizontal=True,
        family=ORANGE,
    )
    print(f"wrote figures to {FIG_DIR.relative_to(ROOT)} and {CROSS_FIG_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
