import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import * as d3 from "d3";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowDownToLine,
  ArrowUpDown,
  BarChart3,
  CircleDot,
  Database,
  Filter,
  Layers3,
  MessageSquareText,
  Orbit,
  Search,
  ShieldAlert,
  Sparkles,
  Table2,
} from "lucide-react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const colors = {
  ink: "#262320",
  muted: "#69625b",
  faint: "#958c83",
  accent: "#de7d53",
  accentSoft: "#ffe5d7",
  line: "#e5e0da",
  panel: "#ffffff",
  page: "#f8f7f4",
  blue: "#6f9fb7",
  green: "#91ad87",
  purple: "#a996c7",
  amber: "#d7ad5f",
};

const chartPalette = ["#de7d53", "#6f9fb7", "#91ad87", "#a996c7", "#d7ad5f", "#d78aa6", "#837d76", "#b8c7a5"];
const pageSize = 12;
const EDGE_DISCUSSION_LABEL = "边缘讨论";
const LOW_SIGNAL_LABELS = new Set(["低信号评论", "低信号归并", "未标注", "无法判断"]);

function removeCode(value) {
  return String(value || "")
    .replace(/^(场景|主题|风险|评论|态度)\|/g, "")
    .replace(/^(S|T|K|A|M|U|R|C|PC)\d+\s*/g, "")
    .replace(/^风险K\d+\s*/g, "")
    .trim();
}

function displayLabel(value, fallback = EDGE_DISCUSSION_LABEL) {
  const cleaned = removeCode(value);
  if (!cleaned || LOW_SIGNAL_LABELS.has(cleaned)) return fallback;
  return cleaned;
}

function useDashboardData() {
  const [state, setState] = useState({ data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/dashboard.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setState({ data: normalizePayload(payload), error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function normalizePayload(payload) {
  const cleanRow = (row) => ({
    ...row,
    name: displayLabel(row.name),
    source: displayLabel(row.source),
    target: displayLabel(row.target),
  });
  const counts = Object.fromEntries(Object.entries(payload.counts || {}).map(([key, rows]) => [key, rows.map(cleanRow)]));
  const flows = Object.fromEntries(Object.entries(payload.flows || {}).map(([key, rows]) => [key, rows.map(cleanRow)]));
  const records = {
    posts: (payload.records?.posts || []).map((post) => ({
      ...post,
      platformName: removeCode(post.platformName),
      topic: removeCode(post.topic),
      scene: removeCode(post.scene),
      risk: removeCode(post.risk),
      attitude: removeCode(post.attitude),
      motivation: removeCode(post.motivation),
      usage: removeCode(post.usage),
    })),
    comments: (payload.records?.comments || []).map((comment) => ({
      ...comment,
      platformName: removeCode(comment.platformName),
      role: displayLabel(comment.role),
      attitude: displayLabel(comment.attitude, "中性观察"),
      topic: displayLabel(comment.topic, "其他沟通主题"),
      consistency: displayLabel(comment.consistency),
    })),
  };
  return { ...payload, counts, flows, records, keywordCloud: payload.keywordCloud || [] };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function countBy(rows, field, limit = 12) {
  const map = new Map();
  rows.forEach((row) => {
    const name = displayLabel(row[field]);
    map.set(name, (map.get(name) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

function crossBy(rows, sourceField, targetField, limit = 100) {
  const map = new Map();
  rows.forEach((row) => {
    const source = displayLabel(row[sourceField]);
    const target = displayLabel(row[targetField]);
    const key = `${source}__${target}`;
    map.set(key, { source, target, value: (map.get(key)?.value || 0) + 1 });
  });
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

function useFilteredData(data, filters, query) {
  return useMemo(() => {
    if (!data) return null;
    const term = query.trim().toLowerCase();
    const posts = data.records.posts.filter((post) => {
      const platform = filters.platform === "all" || post.platform === filters.platform;
      const topic = filters.topic === "all" || post.topic === filters.topic;
      const scene = filters.scene === "all" || post.scene === filters.scene;
      const risk = filters.risk === "all" || post.risk === filters.risk;
      const text = `${post.title}${post.text}${post.keyword}${post.topic}${post.scene}${post.risk}${post.attitude}`.toLowerCase();
      return platform && topic && scene && risk && (!term || text.includes(term));
    });
    const postIds = new Set(posts.map((post) => post.id));
    const narrowsByPost = filters.topic !== "all" || filters.scene !== "all" || filters.risk !== "all";
    const comments = data.records.comments.filter((comment) => {
      const platform = filters.platform === "all" || comment.platform === filters.platform;
      const parent = !narrowsByPost || postIds.has(comment.parentPostId);
      const text = `${comment.text}${comment.topic}${comment.role}${comment.attitude}`.toLowerCase();
      return platform && parent && (!term || text.includes(term) || postIds.has(comment.parentPostId));
    });
    return { posts, comments, postIds };
  }, [data, filters, query]);
}

function useDerived(data, filtered) {
  return useMemo(() => {
    if (!data || !filtered) return null;
    const posts = filtered.posts;
    const comments = filtered.comments;
    const monthMap = new Map();
    posts.forEach((post) => {
      const month = post.publishTime?.slice(0, 7) || "时间未记录";
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });
    const timeline = [...monthMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
    const signalComments = comments.filter((comment) => comment.role !== EDGE_DISCUSSION_LABEL);
    const highValueComments = [...comments].sort((a, b) => b.likes + b.replies * 2 - (a.likes + a.replies * 2)).slice(0, 80);
    const topPost = [...posts].sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2))[0];
    const linkedComments = topPost ? comments.filter((comment) => comment.parentPostId === topPost.id).sort((a, b) => b.likes - a.likes).slice(0, 5) : [];
    const totalInteractions = posts.reduce((sum, post) => sum + post.likes + post.comments + post.shares + post.collects, 0);
    const total = posts.length + comments.length;
    const positiveComments = comments.filter((comment) => comment.attitude === "支持").length;
    const concernComments = comments.filter((comment) => ["担忧", "反对"].includes(comment.attitude)).length;
    const commentSignalRate = comments.length ? Math.round((signalComments.length / comments.length) * 100) : 0;
    const debateRate = comments.length ? Math.round(((concernComments + positiveComments) / comments.length) * 100) : 0;

    return {
      total,
      posts,
      comments,
      timeline,
      topPost,
      linkedComments,
      signalComments,
      highValueComments,
      triage: data.meta?.triage || {},
      metrics: [
        { label: "分析文本", value: total, unit: "条", note: "帖子与评论合计", icon: Database },
        { label: "有效帖子", value: posts.length, unit: "条", note: "清洗后主文本", icon: BarChart3 },
        { label: "有效评论", value: comments.length, unit: "条", note: "保留评论区态度", icon: MessageSquareText },
        { label: "互动量", value: totalInteractions, unit: "次", note: "赞评转藏合计", icon: Sparkles },
        { label: "明确信号", value: commentSignalRate, unit: "%", note: "评论中可解释信号比例", icon: CircleDot },
      ],
      platform: countBy(posts, "platformName", 6),
      scene: countBy(posts, "scene", 8),
      topic: countBy(posts, "topic", 10),
      risk: countBy(posts, "risk", 8),
      attitude: countBy(posts, "attitude", 8),
      motivation: countBy(posts, "motivation", 8),
      usage: countBy(posts, "usage", 8),
      commentRole: countBy(comments, "role", 8),
      commentAttitude: countBy(comments, "attitude", 8),
      commentSignalAttitude: countBy(signalComments, "attitude", 8),
      consistency: countBy(comments, "consistency", 8),
      sceneRisk: crossBy(posts, "scene", "risk"),
      topicRisk: crossBy(posts, "topic", "risk"),
      sceneAttitude: crossBy(posts, "scene", "attitude"),
      topicCommentAttitude: crossBy(comments.filter((comment) => comment.attitude !== "中性观察"), "topic", "attitude"),
      platformTopic: crossBy(posts, "platformName", "topic"),
      highRiskPosts: [...posts].filter((post) => post.risk !== "无明显风险担忧").sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2)).slice(0, 80),
      cases: [...posts].sort((a, b) => b.likes + b.comments * 2 + b.linkedComments * 2 - (a.likes + a.comments * 2 + a.linkedComments * 2)),
      conclusions: [
        {
          title: "AI 首先缓解的是表达压力",
          value: countBy(posts, "scene", 1)[0]?.count || 0,
          unit: "条",
          text: "恋爱咨询、聊天回复和情感表达集中出现，说明学生常把 AI 当作开口前的缓冲层。",
        },
        {
          title: "隐私和真实感是主要边界",
          value: posts.filter((post) => post.risk !== "无明显风险担忧").length,
          unit: "条",
          text: "风险讨论不是边缘噪声，尤其围绕聊天记录上传、AI 味、代聊真实性形成持续争议。",
        },
        {
          title: "评论区把单一案例变成公共讨论",
          value: signalComments.length,
          unit: "条",
          text: "经验补充、方法建议、风险提醒和反对质疑共同构成帖子之外的第二层证据。",
        },
        {
          title: "平台语境影响讨论形态",
          value: countBy(posts, "platformName", 1)[0]?.name || "-",
          unit: "",
          text: "平台来源决定文本语气：公共态度、经验求助和方法建议不能混为同一种声音。",
        },
        {
          title: "接受不是无条件接受",
          value: debateRate,
          unit: "%",
          text: "支持、担忧、求助和调侃并存，说明 AI 辅助沟通被接受的同时也持续受到边界审视。",
        },
      ],
    };
  }, [data, filtered]);
}

function baseTooltip() {
  return {
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    textStyle: { color: colors.ink, fontFamily: "Inter, system-ui, sans-serif" },
    extraCssText: "box-shadow: 0 18px 44px rgba(38,35,32,.12); border-radius: 12px;",
  };
}

function axis() {
  return {
    axisLabel: { color: colors.muted, fontSize: 11 },
    axisLine: { lineStyle: { color: "#e7e1da" } },
    splitLine: { lineStyle: { color: "#efebe6" } },
  };
}

function barOption(rows, unit = "条") {
  const list = rows.slice().reverse();
  return {
    color: [colors.accent],
    grid: { left: 128, right: 28, top: 16, bottom: 28 },
    tooltip: { ...baseTooltip(), trigger: "axis" },
    xAxis: { type: "value", ...axis() },
    yAxis: { type: "category", data: list.map((row) => row.name), ...axis() },
    series: [{
      type: "bar",
      data: list.map((row) => row.count),
      barWidth: 14,
      itemStyle: { borderRadius: 6, color: colors.accent },
      label: { show: true, position: "right", color: colors.muted, fontSize: 10, formatter: `{c} ${unit}` },
    }],
  };
}

function donutOption(rows) {
  return {
    color: chartPalette,
    tooltip: { ...baseTooltip(), trigger: "item" },
    legend: { bottom: 0, textStyle: { color: colors.muted, fontSize: 11 } },
    series: [{
      type: "pie",
      radius: ["50%", "72%"],
      center: ["50%", "42%"],
      label: { color: colors.ink, formatter: "{b}\n{d}%" },
      itemStyle: { borderColor: "#fff", borderWidth: 3 },
      data: rows.map((row) => ({ name: row.name, value: row.count })),
    }],
  };
}

function roseOption(rows) {
  return {
    color: chartPalette,
    tooltip: { ...baseTooltip(), trigger: "item" },
    legend: { bottom: 0, type: "scroll", itemWidth: 10, itemHeight: 8, textStyle: { color: colors.muted, fontSize: 10 }, pageIconSize: 9 },
    series: [{
      type: "pie",
      radius: [12, "57%"],
      center: ["50%", "39%"],
      roseType: "area",
      itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
      label: { color: colors.ink, fontSize: 10, width: 70, overflow: "truncate" },
      labelLine: { length: 10, length2: 8 },
      data: rows.map((row) => ({ name: row.name, value: row.count })),
    }],
  };
}

function radarOption(rows) {
  const list = rows.slice(0, 7);
  const max = Math.max(...list.map((row) => row.count), 1);
  return {
    color: [colors.blue],
    tooltip: baseTooltip(),
    radar: {
      radius: "68%",
      indicator: list.map((row) => ({ name: row.name, max })),
      axisName: { color: colors.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: "#e9e2db" } },
      splitArea: { areaStyle: { color: ["rgba(222,125,83,.04)", "rgba(111,159,183,.06)"] } },
      axisLine: { lineStyle: { color: "#e9e2db" } },
    },
    series: [{
      type: "radar",
      data: [{ value: list.map((row) => row.count), name: "讨论强度" }],
      areaStyle: { color: "rgba(111,159,183,.18)" },
      lineStyle: { width: 2 },
      symbolSize: 5,
    }],
  };
}

function timelineOption(rows) {
  return {
    color: [colors.accent],
    grid: { left: 46, right: 24, top: 22, bottom: 42 },
    tooltip: { ...baseTooltip(), trigger: "axis" },
    xAxis: { type: "category", data: rows.map((row) => row.name), ...axis() },
    yAxis: { type: "value", ...axis() },
    series: [{
      type: "line",
      smooth: true,
      symbolSize: 7,
      areaStyle: { color: "rgba(222,125,83,.13)" },
      lineStyle: { width: 3 },
      data: rows.map((row) => row.count),
    }],
  };
}

function heatmapOption(rows) {
  const sources = [...new Set(rows.map((row) => row.source))];
  const targets = [...new Set(rows.map((row) => row.target))];
  return {
    tooltip: baseTooltip(),
    grid: { left: 132, right: 24, top: 24, bottom: 84 },
    xAxis: { type: "category", data: targets, axisLabel: { color: colors.muted, rotate: 32, fontSize: 10 }, axisLine: { show: false } },
    yAxis: { type: "category", data: sources, axisLabel: { color: colors.muted, fontSize: 10 }, axisLine: { show: false } },
    visualMap: { show: false, min: 0, max: Math.max(...rows.map((row) => row.value), 1), inRange: { color: ["#f5efea", "#f2bf9d", "#de7d53"] } },
    series: [{
      type: "heatmap",
      data: rows.map((row) => [targets.indexOf(row.target), sources.indexOf(row.source), row.value]),
      label: { show: true, color: colors.ink, fontSize: 10 },
      itemStyle: { borderColor: "#fff", borderWidth: 1, borderRadius: 4 },
    }],
  };
}

function sankeyOption(rows) {
  const links = rows.slice(0, 70).map((row) => ({ source: row.source, target: row.target, value: row.value }));
  return {
    color: chartPalette,
    tooltip: { ...baseTooltip(), trigger: "item" },
    series: [{
      type: "sankey",
      left: 6,
      right: 34,
      top: 8,
      bottom: 8,
      nodeWidth: 12,
      nodeGap: 13,
      draggable: true,
      label: { color: colors.ink, fontSize: 11 },
      lineStyle: { color: "gradient", opacity: 0.24, curveness: 0.5 },
      data: [...new Set(links.flatMap((link) => [link.source, link.target]))].map((name) => ({ name })),
      links,
    }],
  };
}

function graphOption(rows) {
  const nodes = [...new Set(rows.flatMap((row) => [row.source, row.target]))].map((name, index) => ({
    name,
    symbolSize: 20 + Math.min(22, rows.filter((row) => row.source === name || row.target === name).length * 3),
    itemStyle: { color: chartPalette[index % chartPalette.length] },
  }));
  return {
    tooltip: baseTooltip(),
    series: [{
      type: "graph",
      layout: "force",
      roam: true,
      force: { repulsion: 120, edgeLength: 84 },
      data: nodes,
      links: rows.slice(0, 90).map((row) => ({ source: row.source, target: row.target, value: row.value })),
      label: { show: true, color: colors.ink, fontSize: 10 },
      lineStyle: { color: "source", opacity: 0.22, width: 1.2 },
    }],
  };
}

function treemapOption(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const list = groups.get(row.source) || [];
    list.push({ name: row.target, value: row.value });
    groups.set(row.source, list);
  });
  return {
    color: chartPalette,
    tooltip: baseTooltip(),
    series: [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { color: colors.ink, formatter: "{b}" },
      upperLabel: { show: true, height: 24, color: "#fff" },
      itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
      data: [...groups.entries()].map(([name, children]) => ({ name, children, value: children.reduce((sum, item) => sum + item.value, 0) })),
    }],
  };
}

function scatterOption(rows, yField = "replies", yName = "回复") {
  const groups = [...new Set(rows.map((row) => row.attitude || row.risk || "中性观察"))];
  return {
    color: chartPalette,
    grid: { left: 52, right: 22, top: 26, bottom: 48 },
    tooltip: {
      ...baseTooltip(),
      formatter: (params) => {
        const row = params.data.raw;
        return `<strong>${row.attitude || row.risk || "样本"}</strong><br/>${row.topic || ""}<br/>${row.text}<br/>赞 ${row.likes} · ${yName} ${row[yField] || 0}`;
      },
    },
    xAxis: { name: "点赞", type: "value", ...axis() },
    yAxis: { name: yName, type: "value", ...axis() },
    legend: { bottom: 0, textStyle: { color: colors.muted, fontSize: 10 }, type: "scroll" },
    series: groups.map((group, index) => ({
      name: group,
      type: "scatter",
      data: rows
        .filter((row) => (row.attitude || row.risk || "中性观察") === group)
        .map((row) => ({
          value: [row.likes, row[yField] || 0],
          symbolSize: 5 + Math.min(16, Math.sqrt(row.likes + (row[yField] || 0) * 2 + 1) * 1.05),
          raw: row,
        })),
      itemStyle: { color: chartPalette[index % chartPalette.length], opacity: 0.58 },
      emphasis: { itemStyle: { opacity: 0.9, borderColor: "#fff", borderWidth: 1.5 } },
    })),
  };
}

function EChart({ option, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current, null, { renderer: "canvas" });
    chart.setOption(option, true);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} className={`echart ${className}`} />;
}

function buildBubbleNodes(rows) {
  const width = 760;
  const height = 360;
  const list = rows.slice(0, 42);
  const max = d3.max(list, (d) => d.value) || 1;
  const total = d3.sum(list, (d) => d.value) || 1;
  const nodes = list.map((row, index) => ({
    ...row,
    id: `${removeCode(row.text)}-${index}`,
    label: removeCode(row.text),
    share: row.value / total,
    r: 13 + Math.sqrt(row.value / max) * 42,
    color: chartPalette[index % chartPalette.length],
  }));
  const simulation = d3.forceSimulation(nodes)
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX((d, index) => width * (0.2 + (index % 5) * 0.15)).strength(0.035))
    .force("y", d3.forceY((d, index) => height * (0.26 + (index % 4) * 0.15)).strength(0.035))
    .force("charge", d3.forceManyBody().strength(5))
    .force("collide", d3.forceCollide((d) => d.r + 5))
    .stop();
  for (let index = 0; index < 220; index += 1) simulation.tick();
  return nodes.map((node) => ({
    ...node,
    x: clamp(node.x, node.r + 4, width - node.r - 4),
    y: clamp(node.y, node.r + 4, height - node.r - 4),
  }));
}

function BubbleCloud({ rows }) {
  const [hovered, setHovered] = useState(null);
  const [active, setActive] = useState(null);
  const nodes = useMemo(() => buildBubbleNodes(rows || []), [rows]);
  const maxValue = Math.max(...nodes.map((node) => node.value), 1);
  return (
    <div className="bubble-cloud interactive-bubbles">
      <svg viewBox="0 0 760 360" role="img" aria-label="高频关键词互动气泡">
        <defs>
          <filter id="bubbleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {nodes.map((node) => {
          const isActive = !active || active === node.id || node.label.includes(active) || active.includes(node.label);
          const isHover = hovered?.id === node.id;
          return (
            <g
              key={node.id}
              className={`bubble-node ${isActive ? "" : "muted"} ${isHover ? "hovered" : ""}`}
              onMouseEnter={() => setHovered(node)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setActive((current) => (current === node.id ? null : node.id))}
            >
              <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} stroke={node.color} />
              <circle className="bubble-ring" cx={node.x} cy={node.y} r={node.r + 4} stroke={node.color} />
              <text x={node.x} y={node.y} fontSize={Math.max(10, Math.min(16, node.r / 2.55))}>{node.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="bubble-hint">
        <span>悬浮看词频</span>
        <span>点击锁定相关词</span>
        <button type="button" onClick={() => setActive(null)} disabled={!active}>复位</button>
      </div>
      {hovered && (
        <div
          className="bubble-tooltip"
          style={{ left: `${(hovered.x / 760) * 100}%`, top: `${(hovered.y / 360) * 100}%` }}
        >
          <strong>{hovered.label}</strong>
          <span>出现 {hovered.value.toLocaleString()} 次</span>
          <small>约为最高频词的 {Math.round((hovered.value / maxValue) * 100)}%</small>
        </div>
      )}
    </div>
  );
}

function KpiCard({ item }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useGSAP(() => {
    const node = ref.current;
    if (!node) return;
    const value = Number(item.value) || 0;
    if (reduced) {
      node.textContent = value.toLocaleString();
      return;
    }
    const counter = { value: 0 };
    gsap.to(counter, {
      value,
      duration: 1.15,
      ease: "power4.out",
      onUpdate: () => {
        node.textContent = Math.round(counter.value).toLocaleString();
      },
    });
  }, { dependencies: [item.value, reduced] });
  const Icon = item.icon;
  return (
    <article className="kpi-card reveal-card">
      <Icon size={18} />
      <span>{item.label}</span>
      <strong><b ref={ref}>{Number(item.value).toLocaleString()}</b>{item.unit}</strong>
      <p>{item.note}</p>
    </article>
  );
}

function ChartPanel({ title, unit, range, insight, children, wide = false, tall = false }) {
  return (
    <section className={`chart-panel reveal-card ${wide ? "wide" : ""} ${tall ? "tall" : ""}`}>
      <header>
        <div>
          <h3>{title}</h3>
          <p>{insight}</p>
        </div>
        <dl>
          <div><dt>单位</dt><dd>{unit}</dd></div>
          <div><dt>范围</dt><dd>{range}</dd></div>
        </dl>
      </header>
      {children}
    </section>
  );
}

function FilterBar({ data, filters, setFilters, query, setQuery }) {
  const topicOptions = [...new Set(data.records.posts.map((row) => row.topic).filter(Boolean))].sort();
  const sceneOptions = [...new Set(data.records.posts.map((row) => row.scene).filter(Boolean))].sort();
  const riskOptions = [...new Set(data.records.posts.map((row) => row.risk).filter(Boolean))].sort();
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <section className="filter-bar" aria-label="筛选条件">
      <label className="search-box">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索关键词、案例文本、评论内容" />
      </label>
      <SelectBox label="平台" value={filters.platform} onChange={(value) => update("platform", value)} options={data.counts.platform.map((row) => ({ value: row.code, label: row.name }))} />
      <SelectBox label="主题" value={filters.topic} onChange={(value) => update("topic", value)} options={topicOptions.map((name) => ({ value: name, label: name }))} />
      <SelectBox label="场景" value={filters.scene} onChange={(value) => update("scene", value)} options={sceneOptions.map((name) => ({ value: name, label: name }))} />
      <SelectBox label="风险" value={filters.risk} onChange={(value) => update("risk", value)} options={riskOptions.map((name) => ({ value: name, label: name }))} />
      <button type="button" onClick={() => setFilters({ platform: "all", topic: "all", scene: "all", risk: "all" })}>
        <Filter size={16} />
        重置
      </button>
    </section>
  );
}

function SelectBox({ label, value, onChange, options }) {
  return (
    <label className="select-box">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">全部</option>
        {options.map((item) => (
          <option value={item.value} key={item.value}>{item.label}</option>
        ))}
      </select>
    </label>
  );
}

function Hero({ data, derived }) {
  return (
    <section className="hero-section" id="top">
      <div className="hero-lens" aria-hidden="true">
        <div className="lens-ring">
          <span />
          <span />
          <span />
        </div>
        <div className="lens-stack">
          <article>
            <b>post</b>
            <span>{derived.posts.length.toLocaleString()}</span>
          </article>
          <article>
            <b>comment</b>
            <span>{derived.comments.length.toLocaleString()}</span>
          </article>
          <article>
            <b>risk signal</b>
            <span>{derived.highRiskPosts.length.toLocaleString()}</span>
          </article>
        </div>
        <div className="lens-thread">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="hero-copy">
        <p className="section-kicker">crawler text analytics · post-comment linked evidence</p>
        <h1><span>看见</span>大学生把一句话交给 AI 之前的犹豫</h1>
        <p>
          这个平台把爬虫文本、评论区态度、风险边界和典型案例放到同一条分析链里，
          用可解释的数据说明生成式 AI 如何进入恋爱咨询、聊天回复、道歉拒绝和正式沟通。
        </p>
        <div className="source-strip">
          <span>数据来源：微博、小红书公开文本</span>
          <span>帖子 {data.meta.postCount.toLocaleString()} 条</span>
          <span>评论 {data.meta.commentCount.toLocaleString()} 条</span>
          <span>生成时间 {data.meta.generatedAt}</span>
        </div>
      </div>
      <div className="hero-kpis">
        {derived.metrics.map((item) => <KpiCard item={item} key={item.label} />)}
      </div>
    </section>
  );
}

function OverviewSection({ data, derived }) {
  return (
    <SectionFrame id="overview" label="数据总览" title="先确认样本结构，再解释图表结论" text="总览区把数据体量、来源结构、时间趋势、主题风险和关键词放在一起，避免只看单一图形造成误读。">
      <div className="chart-grid">
        <ChartPanel title="证据流向" unit="条" range="当前筛选" insight="场景、主题和风险的连接决定后续解释路径。" wide tall>
          <EChart option={sankeyOption(data.flows.sankey)} className="large" />
        </ChartPanel>
        <ChartPanel title="讨论时间趋势" unit="帖子数" range="按月份" insight="时间线用于判断讨论是否集中爆发。">
          <EChart option={timelineOption(derived.timeline)} />
        </ChartPanel>
        <ChartPanel title="平台来源占比" unit="帖子数" range="当前筛选" insight="不同平台提供不同语气和讨论密度。">
          <EChart option={donutOption(derived.platform)} />
        </ChartPanel>
        <ChartPanel title="主题与风险面积" unit="共现次数" range="当前筛选" insight="面积越大，说明主题和风险绑定越强。">
          <EChart option={treemapOption(derived.topicRisk)} />
        </ChartPanel>
        <ChartPanel title="Top 主题排行" unit="帖子数" range="前 10 类" insight="主题排行帮助确定报告主线。">
          <EChart option={barOption(derived.topic)} />
        </ChartPanel>
      </div>
    </SectionFrame>
  );
}

function MultiAnalysisSection({ data, derived }) {
  const [tab, setTab] = useState("trend");
  const panelRef = useRef(null);
  const tabs = [
    { key: "trend", label: "时间趋势", title: "讨论何时集中出现？" },
    { key: "category", label: "类别对比", title: "哪些场景和动机最突出？" },
    { key: "source", label: "来源分布", title: "平台语境如何影响讨论？" },
    { key: "keyword", label: "关键词分析", title: "网感词如何进入讨论？" },
    { key: "heat", label: "热度排行", title: "高互动样本集中在哪？" },
    { key: "anomaly", label: "异常与边界", title: "哪些风险样本值得复核？" },
  ];

  useGSAP(() => {
    if (!panelRef.current) return;
    gsap.fromTo(panelRef.current.querySelectorAll(".tab-motion"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.04, ease: "power3.out" });
  }, { scope: panelRef, dependencies: [tab], revertOnUpdate: true });

  return (
    <SectionFrame id="analysis" label="多维分析" title="同一批数据，要从不同角度反复验证" text="切换不同维度时保留同一套筛选条件，便于观察结论是否稳定。">
      <div className="tabs" role="tablist" aria-label="多维分析维度">
        {tabs.map((item) => (
          <button key={item.key} role="tab" type="button" className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="tab-stage" ref={panelRef}>
        {tab === "trend" && (
          <div className="analysis-feature tab-motion">
            <ChartPanel title="月度帖子趋势" unit="帖子数" range="按月份" insight="用于判断讨论高峰，不直接代表社会总体趋势。">
              <EChart option={timelineOption(derived.timeline)} className="large" />
            </ChartPanel>
            <InsightList title="趋势读法" items={["月份聚集意味着平台事件或关键词带来短期扩散。", "如果筛选某一主题后趋势仍稳定，说明它不是单次热点。", "时间缺失样本被单独归并，不参与日期解释。"]} />
          </div>
        )}
        {tab === "category" && (
          <div className="analysis-mosaic tab-motion">
            <ChartPanel title="场景玫瑰图" unit="帖子数" range="当前筛选" insight="面积展示不同沟通场景的相对体量。">
              <EChart option={roseOption(derived.scene)} />
            </ChartPanel>
            <ChartPanel title="动机雷达" unit="帖子数" range="当前筛选" insight="动机维度组成表达压力画像。">
              <EChart option={radarOption(derived.motivation)} />
            </ChartPanel>
            <ChartPanel title="使用方式排行" unit="帖子数" range="当前筛选" insight="区分直接生成、上传聊天记录和参考建议。">
              <EChart option={barOption(derived.usage)} />
            </ChartPanel>
          </div>
        )}
        {tab === "source" && (
          <div className="analysis-feature tab-motion">
            <ChartPanel title="平台与主题热力" unit="共现次数" range="当前筛选" insight="不同平台承载的主题重心不同。">
              <EChart option={heatmapOption(derived.platformTopic)} className="large" />
            </ChartPanel>
            <ChartPanel title="平台主题面积图" unit="共现次数" range="当前筛选" insight="用面积快速观察来源结构。">
              <EChart option={treemapOption(derived.platformTopic)} />
            </ChartPanel>
          </div>
        )}
        {tab === "keyword" && (
          <div className="analysis-feature tab-motion">
            <ChartPanel title="高频关键词气泡" unit="出现次数" range="Top 30" insight="词云只辅助发现热点，不能代替标签解释。">
              <BubbleCloud rows={data.keywordCloud} />
            </ChartPanel>
            <InsightList title="关键词解释" items={["网感词提高召回率，但必须和语义标签交叉验证。", "聊天记录、crush、军师、AI 味等词共同指向表达中介化。", "词频偏高不等于态度强，需要结合评论区。"]} />
          </div>
        )}
        {tab === "heat" && (
          <div className="analysis-feature tab-motion">
            <ChartPanel title="高互动评论散点" unit="点赞/回复" range="前 80 条评论" insight="高赞评论常暴露公众态度和争议点。">
              <EChart option={scatterOption(derived.highValueComments)} className="large" />
            </ChartPanel>
            <TopList title="高互动案例" rows={derived.cases.slice(0, 3)} />
          </div>
        )}
        {tab === "anomaly" && (
          <div className="tab-grid tab-motion">
            <ChartPanel title="风险边界散点" unit="点赞/评论" range="显性风险帖子" insight="高互动风险样本优先进入人工复核。">
              <EChart option={scatterOption(derived.highRiskPosts, "comments", "评论")} />
            </ChartPanel>
            <ChartPanel title="场景与风险热力" unit="共现次数" range="当前筛选" insight="风险在不同场景中的强度不同。">
              <EChart option={heatmapOption(derived.sceneRisk)} />
            </ChartPanel>
          </div>
        )}
      </div>
    </SectionFrame>
  );
}

function ShowcaseSection({ derived }) {
  return (
    <SectionFrame id="showcase" label="可视化亮点" title="把评论区看成围绕原帖展开的争议场" text="星图只保留读图所需的编码：主题、评论作用、态度和高互动证据，避免把解释文字堆成第二篇报告。">
      <div className="showcase-stage">
        <div className="showcase-brief">
          <p><strong>读图方式：</strong>节点越大代表关联越多，距离越近代表共同出现越频繁；点击节点后右侧只展示当前焦点和 3 条高互动证据。</p>
          <div className="showcase-metrics" aria-label="星图补充说明">
            <span>补判态度 <b>{Number(derived.triage.commentAttitudeInferred || 0).toLocaleString()}</b></span>
            <span>继承主题 <b>{Number(derived.triage.commentTopicInherited || 0).toLocaleString()}</b></span>
            <span>证据样本 <b>{derived.highValueComments.length.toLocaleString()}</b></span>
          </div>
        </div>
        <CommentConstellation comments={derived.comments} />
      </div>
    </SectionFrame>
  );
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function attitudeColor(attitude) {
  const map = {
    支持: colors.accent,
    中性观察: colors.blue,
    调侃: colors.green,
    求助: colors.purple,
    担忧: colors.amber,
    反对: "#d78aa6",
  };
  return map[attitude] || chartPalette[hashText(attitude) % chartPalette.length];
}

function buildCommentGalaxy(comments) {
  const hotScore = (comment) => (comment.likes || 0) + (comment.replies || 0) * 2;
  const hot = [...comments].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 180);
  const used = new Set(hot.map((comment) => comment.id));
  const step = Math.max(1, Math.ceil(comments.length / 760));
  const sampled = comments.filter((comment, index) => !used.has(comment.id) && index % step === 0);
  const sample = [...hot, ...sampled].slice(0, 980);
  const topics = countBy(comments, "topic", 9);
  const topicNames = topics.map((row) => row.name);
  const topicIndex = new Map(topicNames.map((name, index) => [name, index]));
  const center = { x: 460, y: 250 };
  const centers = topics.map((topic, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, topics.length)) * Math.PI * 2;
    const ring = index % 2 ? 225 : 178;
    return {
      ...topic,
      angle,
      x: center.x + Math.cos(angle) * ring,
      y: center.y + Math.sin(angle) * ring * 0.56,
      spread: 38 + Math.min(62, Math.sqrt(topic.count) * 3.2),
    };
  });
  const maxHot = Math.max(...sample.map(hotScore), 1);
  const points = sample.map((comment, index) => {
    const topic = displayLabel(comment.topic, "其他沟通主题");
    const attitude = displayLabel(comment.attitude, "中性观察");
    const clusterIndex = topicIndex.has(topic) ? topicIndex.get(topic) : hashText(topic) % Math.max(1, centers.length);
    const cluster = centers[clusterIndex] || { ...center, angle: 0, spread: 180 };
    const seed = hashText(`${comment.id}-${comment.text}`);
    const spin = ((seed % 1000) / 1000 - 0.5) * 1.8 + (index % 37) * 0.018;
    const distance = 10 + Math.pow(((seed >>> 8) % 1000) / 1000, 0.68) * cluster.spread;
    const score = hotScore(comment);
    const x = clamp(cluster.x + Math.cos(cluster.angle + spin) * distance, 22, 898);
    const y = clamp(cluster.y + Math.sin(cluster.angle + spin) * distance * 0.68, 28, 472);
    return {
      id: comment.id,
      topic,
      role: displayLabel(comment.role),
      attitude,
      text: comment.text,
      likes: comment.likes || 0,
      replies: comment.replies || 0,
      platformName: comment.platformName,
      score,
      x,
      y,
      color: attitudeColor(attitude),
      size: 1.35 + Math.min(4.6, Math.sqrt(score + 1) / 18),
      hot: score > maxHot * 0.18,
      raw: comment,
    };
  });
  return { points, clusters: centers, total: comments.length };
}

function CommentConstellation({ comments }) {
  const cardRef = useRef(null);
  const dragRef = useRef(null);
  const [focus, setFocus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const source = useMemo(() => {
    if (focus === "signal") return comments.filter((comment) => comment.role !== EDGE_DISCUSSION_LABEL);
    if (focus === "hot") return [...comments].sort((a, b) => b.likes + b.replies * 2 - (a.likes + a.replies * 2)).slice(0, 620);
    return comments;
  }, [comments, focus]);
  const galaxy = useMemo(() => buildCommentGalaxy(source), [source]);
  const summary = useMemo(() => {
    const by = (field) => countBy(source, field, 4);
    return {
      roles: by("role"),
      attitudes: by("attitude"),
      topics: by("topic"),
      total: source.length,
    };
  }, [source]);

  useEffect(() => {
    setSelected(null);
    setHovered(null);
    setView({ x: 0, y: 0, k: 1 });
  }, [focus]);

  useGSAP(() => {
    if (!cardRef.current) return;
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .fromTo(".galaxy-ring, .galaxy-cluster-label", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38, stagger: 0.04 })
      .fromTo(".galaxy-pixel", { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.58, stagger: { amount: 0.72, from: "center" } }, "<0.08")
      .fromTo(".constellation-stat, .constellation-path li", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.04 }, "<0.18");
  }, { scope: cardRef, dependencies: [focus, selected?.id], revertOnUpdate: true });

  const selectedRows = selected
    ? [...source].filter((comment) => comment.id === selected.id || comment.topic === selected.topic || comment.attitude === selected.attitude).sort((a, b) => b.likes + b.replies * 2 - (a.likes + a.replies * 2)).slice(0, 3)
    : [...source].sort((a, b) => b.likes + b.replies * 2 - (a.likes + a.replies * 2)).slice(0, 3);
  const updateZoom = (nextScale, origin = { x: 460, y: 250 }) => {
    setView((current) => {
      const k = clamp(nextScale, 0.72, 5.2);
      const ratio = k / current.k;
      return {
        k,
        x: origin.x - (origin.x - current.x) * ratio,
        y: origin.y - (origin.y - current.y) * ratio,
      };
    });
  };
  const resetView = () => setView({ x: 0, y: 0, k: 1 });
  const handleWheel = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = {
      x: ((event.clientX - rect.left) / rect.width) * 920,
      y: ((event.clientY - rect.top) / rect.height) * 500,
    };
    updateZoom(view.k * (event.deltaY > 0 ? 0.88 : 1.14), origin);
  };
  const handlePointerDown = (event) => {
    if (event.target.closest?.(".galaxy-pixel")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: view.x, y: view.y };
  };
  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setView((current) => ({
      ...current,
      x: drag.x + ((event.clientX - drag.clientX) / rect.width) * 920,
      y: drag.y + ((event.clientY - drag.clientY) / rect.height) * 500,
    }));
  };
  const handlePointerUp = (event) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  return (
    <div className="constellation-card reveal-card" ref={cardRef}>
      <div className="constellation-toolbar">
        <div>
          <h3>评论争议星图</h3>
          <p>每个发光像素代表一条评论，主题决定星团位置，颜色表示态度。</p>
        </div>
        <nav aria-label="星图筛选">
          {[
            ["all", "全部"],
            ["signal", "明确信号"],
            ["hot", "高互动"],
          ].map(([key, label]) => (
            <button key={key} type="button" className={focus === key ? "active" : ""} onClick={() => setFocus(key)}>{label}</button>
          ))}
        </nav>
      </div>
      <div className="constellation-body">
        <div className="constellation-stage">
          <svg
            className="constellation galaxy-map"
            viewBox="0 0 920 500"
            role="img"
            aria-label="评论争议像素星系"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={resetView}
          >
            <defs>
              <filter id="pixelGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <ellipse className="galaxy-ring" cx="460" cy="250" rx="395" ry="184" />
              <ellipse className="galaxy-ring" cx="460" cy="250" rx="268" ry="126" />
              <ellipse className="galaxy-ring" cx="460" cy="250" rx="132" ry="64" />
              {galaxy.clusters.map((cluster) => (
                <g key={cluster.name} className="galaxy-cluster-label">
                  <line x1="460" y1="250" x2={cluster.x} y2={cluster.y} />
                  <text x={cluster.x} y={cluster.y - 10}>{cluster.name}</text>
                </g>
              ))}
              {galaxy.points.map((point) => {
                const active = !selected || point.id === selected.id || point.topic === selected.topic || point.attitude === selected.attitude;
                return (
                  <circle
                    key={point.id}
                    className={`galaxy-pixel ${point.hot ? "hot" : ""} ${selected && !active ? "dim" : ""} ${selected?.id === point.id ? "selected" : ""}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.size}
                    fill={point.color}
                    onMouseEnter={() => setHovered(point)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(point)}
                  />
                );
              })}
              </g>
          </svg>
          {hovered && (
            <div
              className="galaxy-tooltip"
              style={{ left: `${((hovered.x * view.k + view.x) / 920) * 100}%`, top: `${((hovered.y * view.k + view.y) / 500) * 100}%` }}
            >
              <strong>{hovered.topic}</strong>
              <span>{hovered.role} · {hovered.attitude}</span>
              <small>赞 {hovered.likes} · 回复 {hovered.replies}</small>
            </div>
          )}
          <div className="constellation-legend" aria-label="节点图例">
            <span><i className="topic" />主题星团</span>
            <span><i className="role" />评论像素</span>
            <span><i className="attitude" />高互动亮点</span>
          </div>
          <div className="galaxy-controls" aria-label="星图缩放控制">
            <button type="button" onClick={() => updateZoom(view.k * 1.22)}>放大</button>
            <button type="button" onClick={() => updateZoom(view.k * 0.82)}>缩小</button>
            <button type="button" onClick={resetView}>复位</button>
            <span>{Math.round(view.k * 100)}%</span>
          </div>
        </div>
        <aside className="constellation-inspector">
          <div className="constellation-stat">
            <span>当前样本</span>
            <strong>{summary.total.toLocaleString()}</strong>
            <small>{focus === "all" ? "全部评论" : focus === "signal" ? "排除边缘讨论" : "高互动评论"}</small>
          </div>
          <div className="constellation-stat">
            <span>焦点评论</span>
            <strong>{selected?.topic || "未选择"}</strong>
            <small>{selected ? `${selected.role} · ${selected.attitude} · 赞 ${selected.likes}` : "点击任意像素点查看详情"}</small>
          </div>
          <div className="constellation-bars">
            <h4>态度构成</h4>
            {summary.attitudes.map((row) => (
              <label key={row.name}>
                <span>{row.name}</span>
                <meter min="0" max={summary.attitudes[0]?.count || 1} value={row.count} />
                <b>{row.count}</b>
              </label>
            ))}
          </div>
          <ol className="constellation-path">
            {selectedRows.map((row) => (
              <li key={row.id}>
                <strong>{row.role} · {row.attitude}</strong>
                <p>{row.text}</p>
                <span>赞 {row.likes} · 回复 {row.replies}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <div className="constellation-note">
        <Orbit size={16} />
        <span>{selected ? `${selected.topic}：${selected.role} / ${selected.attitude}` : `当前显示 ${galaxy.points.length.toLocaleString()} 个评论像素；切换筛选会重排星系`}</span>
      </div>
    </div>
  );
}

function DetailsSection({ derived }) {
  const [kind, setKind] = useState("post");
  const [sortKey, setSortKey] = useState("hot");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rows = kind === "post" ? derived.posts : derived.comments;
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const score = {
      hot: (row) => (row.likes || 0) + (row.comments || row.replies || 0) * 2 + (row.linkedComments || 0) * 2,
      likes: (row) => row.likes || 0,
      comments: (row) => row.comments || row.replies || 0,
      recent: (row) => new Date(row.publishTime || "1970-01-01").getTime(),
    }[sortKey];
    return [...rows]
      .filter((row) => !term || `${row.text}${row.topic}${row.scene}${row.role}${row.platformName}${row.risk}`.toLowerCase().includes(term))
      .sort((a, b) => score(b) - score(a));
  }, [rows, search, sortKey]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [kind, sortKey, search]);

  const exportCsv = () => {
    const headers = kind === "post" ? ["platformName", "topic", "scene", "risk", "likes", "comments", "text"] : ["platformName", "topic", "role", "attitude", "likes", "replies", "text"];
    const csv = [headers.join(","), ...filteredRows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-communication-${kind}-details.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SectionFrame id="details" label="数据明细" title="从图表回到具体文本证据" text="明细区保留搜索、排序、分页和导出，便于把图表结论追溯到帖子或评论样本。">
      <div className="table-shell reveal-card">
        <div className="table-tools">
          <div className="segmented">
            <button type="button" className={kind === "post" ? "active" : ""} onClick={() => setKind("post")}>帖子</button>
            <button type="button" className={kind === "comment" ? "active" : ""} onClick={() => setKind("comment")}>评论</button>
          </div>
          <label className="table-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索明细文本或标签" />
          </label>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            <option value="hot">综合热度</option>
            <option value="likes">点赞优先</option>
            <option value="comments">评论/回复优先</option>
            <option value="recent">时间优先</option>
          </select>
          <button type="button" onClick={exportCsv}>
            <ArrowDownToLine size={16} />
            导出 CSV
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>来源</th>
                <th>主题</th>
                <th>{kind === "post" ? "场景/风险" : "作用/态度"}</th>
                <th><ArrowUpDown size={13} />互动</th>
                <th>文本摘要</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.platformName}</td>
                  <td>{row.topic || "其他沟通主题"}</td>
                  <td>{kind === "post" ? `${row.scene} · ${row.risk}` : `${row.role} · ${row.attitude}`}</td>
                  <td>{row.likes || 0} 赞 / {kind === "post" ? row.comments || 0 : row.replies || 0}</td>
                  <td>{row.text}</td>
                </tr>
              )) : (
                <tr><td colSpan="5"><EmptyState title="没有匹配明细" text="放宽筛选或清空搜索词后再查看。" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
          <span>{page} / {pageCount} · {filteredRows.length.toLocaleString()} 条</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button>
        </div>
      </div>
    </SectionFrame>
  );
}

function ConclusionsSection({ derived }) {
  return (
    <SectionFrame id="conclusions" label="分析结论" title="把图表收束成可以写进报告的发现" text="结论卡只保留可由当前数据支撑的表述，每条都给出依据数据和解释。">
      <div className="conclusion-grid">
        {derived.conclusions.map((item) => (
          <article className="conclusion-card reveal-card" key={item.title}>
            <span>{item.title}</span>
            <strong>{typeof item.value === "number" ? item.value.toLocaleString() : item.value}{item.unit}</strong>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}

function SectionFrame({ id, label, title, text, children }) {
  return (
    <section className="section-frame" id={id}>
      <div className="section-heading reveal-card">
        <span>{label}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {children}
    </section>
  );
}

function InsightList({ title, items }) {
  return (
    <aside className="insight-list reveal-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </aside>
  );
}

function TopList({ title, rows }) {
  return (
    <aside className="top-list reveal-card">
      <h3>{title}</h3>
      <ol>
        {rows.map((row) => (
          <li key={row.id}>
            <strong>{row.topic || row.role || "样本"}</strong>
            <p>{row.text}</p>
            <span>{row.platformName} · 赞 {(row.likes || 0).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Table2 size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LoadingState() {
  return <main className="state-page"><div className="skeleton" /><div className="skeleton small" /></main>;
}

function ErrorState({ message }) {
  return <main className="state-page"><ShieldAlert size={28} /><strong>数据无法加载</strong><span>{message}</span></main>;
}

function App() {
  const { data, error } = useDashboardData();
  const reduced = useReducedMotion();
  const shellRef = useRef(null);
  const [filters, setFilters] = useState({ platform: "all", topic: "all", scene: "all", risk: "all" });
  const [query, setQuery] = useState("");
  const filtered = useFilteredData(data, filters, query);
  const derived = useDerived(data, filtered);

  useGSAP(() => {
    if (!data || reduced) return undefined;
    const root = shellRef.current;
    if (!root) return undefined;
    const intro = gsap.timeline({ defaults: { duration: 0.72, ease: "power4.out" } });
    intro
      .from(".site-header", { autoAlpha: 0, y: -18 })
      .from(".hero-copy > *", { autoAlpha: 0, y: 28, stagger: 0.08 }, "<0.08")
      .from(".hero-kpis .kpi-card", { autoAlpha: 0, y: 24, stagger: 0.07 }, "<0.16")
      .from(".hero-lens", { autoAlpha: 0, scale: 0.88, rotate: -2 }, "<0.1")
      .from(".lens-stack article", { autoAlpha: 0, y: 18, stagger: 0.08 }, "<0.12")
      .from(".lens-thread i", { autoAlpha: 0, scale: 0.6, stagger: 0.05 }, "<0.1");

    gsap.to(".scroll-progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.35 },
    });

    gsap.to(".hero-lens", {
      y: 36,
      scale: 1.06,
      rotate: 2,
      ease: "none",
      scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 0.8 },
    });
    gsap.to(".lens-ring", {
      rotate: 18,
      ease: "none",
      scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 1 },
    });
    gsap.to(".lens-stack article", {
      yPercent: -18,
      stagger: 0.08,
      ease: "none",
      scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 1.1 },
    });
    gsap.to(".section-frame", {
      backgroundPosition: "55% 45%",
      ease: "none",
      scrollTrigger: { trigger: "main", start: "top top", end: "bottom bottom", scrub: 1.2 },
    });
    gsap.to(".ambient-shape", {
      x: (index) => [24, -32, 18][index % 3],
      y: (index) => [-18, 26, 20][index % 3],
      rotation: (index) => [4, -5, 3][index % 3],
      duration: 10,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: 0.9,
    });
    gsap.to(".ambient-path", {
      strokeDashoffset: -180,
      duration: 18,
      repeat: -1,
      ease: "none",
      stagger: 1.4,
    });
    gsap.to(".ambient-dot", {
      y: -10,
      autoAlpha: 0.42,
      duration: 3.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: { amount: 4, from: "random" },
    });

    ScrollTrigger.batch(".reveal-card", {
      start: "top 86%",
      once: true,
      batchMax: 6,
      onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.055, ease: "power3.out", overwrite: true }),
    });
    return () => ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }, { scope: shellRef, dependencies: [data, reduced] });

  if (error) return <ErrorState message={error} />;
  if (!data || !derived) return <LoadingState />;

  return (
    <div className="app-shell" ref={shellRef}>
      <div className="ambient-layer" aria-hidden="true">
        <i className="ambient-shape shape-one" />
        <i className="ambient-shape shape-two" />
        <i className="ambient-shape shape-three" />
        <svg viewBox="0 0 1440 980" preserveAspectRatio="none">
          <path className="ambient-path" d="M-80 210 C210 100 360 350 620 230 S1030 85 1510 190" />
          <path className="ambient-path" d="M-100 650 C260 760 430 560 720 665 S1110 820 1510 610" />
          <path className="ambient-path" d="M130 950 C300 730 480 790 680 610 S960 390 1340 470" />
          {Array.from({ length: 18 }).map((_, index) => (
            <circle key={index} className="ambient-dot" cx={90 + ((index * 83) % 1280)} cy={140 + ((index * 137) % 700)} r={index % 4 === 0 ? 2.4 : 1.5} />
          ))}
        </svg>
      </div>
      <a className="skip-link" href="#overview">跳到主要内容</a>
      <header className="site-header">
        <div className="scroll-progress" aria-hidden="true" />
        <a href="#top" className="brand-mark">
          <Sparkles size={18} />
          <span>生产实习-人工智能应用场景分析</span>
        </a>
        <nav aria-label="页面导航">
          <a href="#overview">总览</a>
          <a href="#analysis">多维分析</a>
          <a href="#showcase">可视化亮点</a>
          <a href="#details">明细</a>
          <a href="#conclusions">结论</a>
        </nav>
      </header>
      <main>
        <Hero data={data} derived={derived} />
        <FilterBar data={data} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} />
        <OverviewSection data={data} derived={derived} />
        <MultiAnalysisSection data={data} derived={derived} />
        <ShowcaseSection derived={derived} />
        <DetailsSection derived={derived} />
        <ConclusionsSection derived={derived} />
      </main>
    </div>
  );
}

export default App;
