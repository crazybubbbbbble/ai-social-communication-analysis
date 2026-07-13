import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import * as d3 from "d3";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import NarrativeExperience from "./narrative/NarrativeExperience";
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
  ink: "#121412",
  muted: "#6f726b",
  faint: "#8a8c84",
  accent: "#3047ff",
  accentSoft: "#e7eaff",
  line: "#d3cec2",
  panel: "#fffdf8",
  page: "#f3efe5",
  blue: "#3047ff",
  green: "#91b940",
  purple: "#81759b",
  amber: "#ef684f",
  neutral: "#9a978f",
};

const chartPalette = [colors.accent, colors.amber, colors.green, colors.purple, colors.neutral];
const pageSize = 12;
const EDGE_DISCUSSION_LABEL = "边缘讨论";
const LOW_SIGNAL_LABELS = new Set(["低信号评论", "低信号归并", "未标注", "无法判断"]);

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

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

function semanticColor(label, index = 0) {
  const text = String(label || "");
  if (/风险|担忧|反对|质疑|隐私|依赖|不真诚/.test(text)) return colors.amber;
  if (/支持|认同|接受|经验补充|方法建议/.test(text)) return colors.green;
  if (/中性|调侃|边缘|其他|补充/.test(text)) return colors.purple;
  return chartPalette[index % chartPalette.length];
}

function useDashboardData() {
  const [state, setState] = useState({ data: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: "" });
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
  }, [attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

function normalizePayload(payload) {
  const cleanRow = (row) => ({
    ...row,
    rawName: row.name,
    rawSource: row.source,
    rawTarget: row.target,
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

function GenerativeField() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d", { alpha: true });
    let frame = 0;
    let width = 0;
    let height = 0;
    let particles = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(110, Math.max(48, Math.floor((width * height) / 15000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: ((index * 83) % 997) / 997 * width,
        y: ((index * 149) % 991) / 991 * height,
        age: (index * 17) % 120,
        speed: 0.28 + (index % 7) * 0.035,
      }));
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      particles.forEach((particle, index) => {
        const angle = Math.sin(particle.x * 0.006 + time * 0.00012) * 1.8
          + Math.cos(particle.y * 0.008 - time * 0.00009) * 1.25;
        if (!reduced) {
          particle.x += Math.cos(angle) * particle.speed;
          particle.y += Math.sin(angle) * particle.speed;
          particle.age += 1;
        }
        const alpha = 0.08 + (index % 5) * 0.018;
        context.strokeStyle = index % 4 === 0
          ? `rgba(98, 215, 230, ${alpha})`
          : `rgba(184, 240, 90, ${alpha})`;
        context.lineWidth = index % 9 === 0 ? 1.2 : 0.7;
        const trail = 7 + (index % 6) * 1.8;
        context.beginPath();
        context.moveTo(particle.x - Math.cos(angle) * trail, particle.y - Math.sin(angle) * trail);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        if (reduced && index % 3 === 0) {
          context.fillStyle = index % 4 === 0 ? "rgba(98, 215, 230, .22)" : "rgba(184, 240, 90, .2)";
          context.beginPath();
          context.arc(particle.x, particle.y, index % 9 === 0 ? 1.5 : 1, 0, Math.PI * 2);
          context.fill();
        }
        if (particle.x < -8 || particle.x > width + 8 || particle.y < -8 || particle.y > height + 8 || particle.age > 260) {
          particle.x = (index * 71 + time * 0.01) % Math.max(width, 1);
          particle.y = (index * 137) % Math.max(height, 1);
          particle.age = 0;
        }
      });
      if (!reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="generative-field" aria-hidden="true" />;
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
        { label: "明确信号", value: commentSignalRate, unit: "%", note: `${signalComments.length.toLocaleString()} / ${comments.length.toLocaleString()} 条评论作用明确`, icon: CircleDot },
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
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: colors.ink, fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif', fontSize: 12, lineHeight: 20 },
    extraCssText: "box-shadow: 0 12px 30px rgba(18,20,18,.10); border-radius: 2px;",
  };
}

function axis() {
  return {
    axisLabel: { color: colors.muted, fontSize: 11, fontFamily: '"Cascadia Mono", Consolas, monospace' },
    axisLine: { lineStyle: { color: "rgba(18, 20, 18, .28)", width: 1 } },
    axisTick: { lineStyle: { color: "rgba(18, 20, 18, .18)" } },
    splitLine: { lineStyle: { color: "rgba(18, 20, 18, .08)", type: "dashed" } },
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
      barWidth: 11,
      itemStyle: { color: colors.accent },
      emphasis: { itemStyle: { color: colors.amber } },
      label: { show: true, position: "right", color: colors.ink, fontSize: 10, fontFamily: '"Cascadia Mono", Consolas, monospace', formatter: `{c} ${unit}` },
    }],
  };
}

function donutOption(rows, { centeredTotal = false } = {}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    color: chartPalette,
    tooltip: { ...baseTooltip(), trigger: "item" },
    title: centeredTotal ? {
      text: total.toLocaleString(),
      subtext: "篇帖子",
      left: "center",
      top: "32%",
      textAlign: "center",
      textStyle: { color: colors.ink, fontSize: 22, fontWeight: 650, fontFamily: '"Cascadia Mono", Consolas, monospace' },
      subtextStyle: { color: colors.muted, fontSize: 10, lineHeight: 18 },
    } : undefined,
    legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: colors.muted, fontSize: 11 } },
    series: [{
      type: "pie",
      radius: ["57%", "73%"],
      center: ["50%", "41%"],
      label: centeredTotal ? { show: false } : { color: colors.ink, fontSize: 11, formatter: "{b}  {d}%" },
      labelLine: { lineStyle: { color: colors.line } },
      itemStyle: { borderColor: colors.panel, borderWidth: 2 },
      data: rows.map((row, index) => ({
        name: row.name,
        value: row.count,
        itemStyle: { color: semanticColor(row.name, index) },
      })),
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
      itemStyle: { borderColor: colors.panel, borderWidth: 2 },
      label: { color: colors.ink, fontSize: 10, width: 70, overflow: "truncate" },
      labelLine: { length: 10, length2: 8 },
      data: rows.map((row, index) => ({
        name: row.name,
        value: row.count,
        itemStyle: { color: semanticColor(row.name, index) },
      })),
    }],
  };
}

function radarOption(rows) {
  const list = rows.slice(0, 7);
  const max = Math.max(...list.map((row) => row.count), 1);
  const step = max > 500 ? 100 : max > 100 ? 50 : max > 20 ? 10 : 5;
  const scaleMax = Math.ceil(max / step) * step;
  return {
    color: [colors.blue],
    tooltip: baseTooltip(),
    radar: {
      radius: "68%",
      splitNumber: 4,
      indicator: list.map((row) => ({ name: row.name, max: scaleMax })),
      axisName: { color: colors.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(18,20,18,.12)" } },
      splitArea: { areaStyle: { color: ["rgba(48,71,255,.015)", "rgba(48,71,255,.04)"] } },
      axisLine: { lineStyle: { color: "rgba(18,20,18,.16)" } },
    },
    series: [{
      type: "radar",
      data: [{ value: list.map((row) => row.count), name: "讨论强度" }],
      areaStyle: { color: "rgba(48,71,255,.12)" },
      lineStyle: { width: 1.5, color: colors.accent },
      itemStyle: { color: colors.panel, borderColor: colors.accent, borderWidth: 2 },
      symbolSize: 6,
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
      symbolSize: 6,
      symbol: "circle",
      itemStyle: { color: colors.panel, borderColor: colors.accent, borderWidth: 2 },
      areaStyle: { color: "rgba(48,71,255,.07)" },
      lineStyle: { width: 2, color: colors.accent },
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
    visualMap: { show: false, min: 0, max: Math.max(...rows.map((row) => row.value), 1), inRange: { color: ["#ebe7dc", "#b9c0ee", colors.accent] } },
    series: [{
      type: "heatmap",
      data: rows.map((row) => [targets.indexOf(row.target), sources.indexOf(row.source), row.value]),
      label: { show: true, color: colors.ink, fontSize: 10 },
      itemStyle: { borderColor: colors.panel, borderWidth: 1 },
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

function evidenceStage(value) {
  const text = String(value || "");
  if (text.startsWith("场景|")) return "scene";
  if (text.startsWith("主题|")) return "topic";
  if (text.startsWith("风险|")) return "risk";
  return "topic";
}

function buildEvidencePathways(rows) {
  const edges = (rows || []).map((row) => ({
    source: displayLabel(row.source),
    target: displayLabel(row.target),
    sourceStage: evidenceStage(row.rawSource || row.source),
    targetStage: evidenceStage(row.rawTarget || row.target),
    value: Number(row.value) || 0,
  })).filter((row) => row.value > 0);

  const sceneTopic = edges.filter((row) => row.sourceStage === "scene" && row.targetStage === "topic");
  const topicRisk = edges.filter((row) => row.sourceStage === "topic"
    && row.targetStage === "risk"
    && !/无明显风险|无风险/.test(row.target));
  const topicMap = new Map();
  const getTopic = (name) => {
    if (!topicMap.has(name)) topicMap.set(name, { topic: name, scenes: [], risks: [] });
    return topicMap.get(name);
  };

  sceneTopic.forEach((row) => getTopic(row.target).scenes.push({ name: row.source, value: row.value }));
  topicRisk.forEach((row) => getTopic(row.source).risks.push({ name: row.target, value: row.value }));

  const pathways = [...topicMap.values()]
    .filter((row) => row.scenes.length && row.risks.length)
    .map((row) => {
      const scenes = row.scenes.sort((a, b) => b.value - a.value);
      const risks = row.risks.sort((a, b) => b.value - a.value);
      return {
        ...row,
        id: `${row.topic}-${scenes[0].name}-${risks[0].name}`,
        scenes,
        risks,
        sceneTotal: scenes.reduce((sum, item) => sum + item.value, 0),
        riskTotal: risks.reduce((sum, item) => sum + item.value, 0),
      };
    })
    .sort((a, b) => b.riskTotal - a.riskTotal || b.sceneTotal - a.sceneTotal)
    .slice(0, 6);

  return {
    pathways,
    maxScene: Math.max(...pathways.map((row) => row.sceneTotal), 1),
    maxRisk: Math.max(...pathways.map((row) => row.riskTotal), 1),
  };
}

function EvidencePathways({ rows }) {
  const [hovered, setHovered] = useState(null);
  const [locked, setLocked] = useState(null);
  const evidence = useMemo(() => buildEvidencePathways(rows), [rows]);
  const selectedId = hovered || locked;
  const selected = evidence.pathways.find((row) => row.id === selectedId) || evidence.pathways[0];

  if (!evidence.pathways.length) {
    return <div className="evidence-pathways-empty">当前筛选下没有足够的显性风险关联。</div>;
  }

  return (
    <div className="evidence-pathways">
      <div className="evidence-pathway-head" aria-hidden="true">
        <span><b>使用场景</b><small>表达需求从哪里发生</small></span>
        <span><b>讨论主题</b><small>连接经验与争议的桥梁</small></span>
        <span><b>显性风险</b><small>讨论最终触及的边界</small></span>
      </div>
      <div className="evidence-pathway-list" aria-label="场景、主题与显性风险关联路径">
        {evidence.pathways.map((pathway, index) => {
          const active = pathway.id === selectedId || (!selectedId && index === 0);
          return (
            <button
              type="button"
              className={`evidence-pathway-row ${active ? "active" : ""}`}
              key={pathway.id}
              aria-pressed={locked === pathway.id}
              onMouseEnter={() => setHovered(pathway.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(pathway.id)}
              onBlur={() => setHovered(null)}
              onClick={() => setLocked((current) => (current === pathway.id ? null : pathway.id))}
            >
              <span className="evidence-pathway-rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="evidence-pathway-stage scene">
                <strong>{pathway.scenes[0].name}</strong>
                <small>{formatNumber(pathway.sceneTotal)} 次场景—主题共现</small>
                <i><b style={{ width: `${(pathway.sceneTotal / evidence.maxScene) * 100}%` }} /></i>
                {pathway.scenes[1] && <em>其次：{pathway.scenes[1].name}</em>}
              </span>
              <span className="evidence-pathway-stage topic">
                <i aria-hidden="true" />
                <strong>{pathway.topic}</strong>
                <small>共享主题</small>
              </span>
              <span className="evidence-pathway-stage risk">
                <strong>{pathway.risks[0].name}</strong>
                <small>{formatNumber(pathway.riskTotal)} 次主题—风险共现</small>
                <i><b style={{ width: `${(pathway.riskTotal / evidence.maxRisk) * 100}%` }} /></i>
                {pathway.risks[1] && <em>其次：{pathway.risks[1].name}</em>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="evidence-pathway-reading" aria-live="polite">
        <span>当前路径</span>
        <strong>{selected.scenes[0].name} → {selected.topic} → {selected.risks[0].name}</strong>
        <small>左右数值分别统计“场景—主题”和“主题—风险”共现，不代表三者必然来自同一条文本。</small>
      </div>
    </div>
  );
}

function graphOption(rows) {
  const nodes = [...new Set(rows.flatMap((row) => [row.source, row.target]))].map((name, index) => ({
    name,
    symbolSize: 20 + Math.min(22, rows.filter((row) => row.source === name || row.target === name).length * 3),
    itemStyle: { color: semanticColor(name, index) },
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
      itemStyle: { borderColor: colors.panel, borderWidth: 2, gapWidth: 2 },
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
      itemStyle: { color: semanticColor(group, index), opacity: 0.5 },
      emphasis: { itemStyle: { opacity: 0.9, borderColor: colors.ink, borderWidth: 1.5 } },
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
    color: colors.accent,
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
              role="button"
              tabIndex="0"
              aria-label={`${node.label}，出现 ${node.value} 次`}
              onMouseEnter={() => setHovered(node)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(node)}
              onBlur={() => setHovered(null)}
              onClick={() => setActive((current) => (current === node.id ? null : node.id))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActive((current) => (current === node.id ? null : node.id));
                }
              }}
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

function AnalysisBridge({ derived, onOpenAnalysis }) {
  const signalRate = derived.comments.length
    ? ((derived.signalComments.length / derived.comments.length) * 100).toFixed(1)
    : "0.0";
  return (
    <section className="analysis-bridge" aria-labelledby="analysis-bridge-title">
      <div className="bridge-orbit" aria-hidden="true">
        <i className="bridge-line bridge-line-outer" />
        <i className="bridge-line bridge-line-inner" />
        <span />
      </div>
      <div className="bridge-copy">
        <p>从六幕叙事进入可复核证据</p>
        <h2 id="analysis-bridge-title">故事停在结论之前，<br />数据继续向下展开。</h2>
        <button type="button" onClick={() => onOpenAnalysis("overview")}>
          打开研究图版
          <ArrowDownToLine size={16} />
        </button>
      </div>
      <div className="bridge-stats" aria-label="当前研究样本">
        <article className="bridge-stat"><span>有效帖子</span><strong>{formatNumber(derived.posts.length)}</strong><small>篇</small></article>
        <article className="bridge-stat"><span>关联评论</span><strong>{formatNumber(derived.comments.length)}</strong><small>条</small></article>
        <article className="bridge-stat"><span>明确信号</span><strong>{signalRate}</strong><small>%</small></article>
      </div>
    </section>
  );
}

function ChartPanel({ title, unit, range, insight, children, wide = false, tall = false }) {
  return (
    <section className={`chart-panel chart-plate reveal-card ${wide ? "wide" : ""} ${tall ? "tall" : ""}`}>
      <header>
        <div className="chart-copy">
          <h3>{title}</h3>
          <p>{insight}</p>
        </div>
        <dl className="chart-meta">
          <div><dt>单位</dt><dd>{unit}</dd></div>
          <div><dt>范围</dt><dd>{range}</dd></div>
        </dl>
      </header>
      {children}
    </section>
  );
}

function TopicRiskMatrix({ rows }) {
  const [hovered, setHovered] = useState(null);
  const [locked, setLocked] = useState(null);
  const matrix = useMemo(() => {
    const meaningful = rows.filter((row) => row.value > 0 && !/无明显风险|无风险/.test(displayLabel(row.target)));
    const sourceRows = meaningful.length ? meaningful : rows.filter((row) => row.value > 0);
    const topicTotals = new Map();
    const riskTotals = new Map();
    sourceRows.forEach((row) => {
      const topic = displayLabel(row.source);
      const risk = displayLabel(row.target);
      topicTotals.set(topic, (topicTotals.get(topic) || 0) + row.value);
      riskTotals.set(risk, (riskTotals.get(risk) || 0) + row.value);
    });
    const topics = [...topicTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
    const risks = [...riskTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
    const lookup = new Map(sourceRows.map((row) => [`${displayLabel(row.source)}|${displayLabel(row.target)}`, row.value]));
    const cells = risks.flatMap((risk, riskIndex) => topics.map((topic) => ({
      id: `${topic}|${risk}`,
      topic,
      risk,
      riskIndex,
      value: lookup.get(`${topic}|${risk}`) || 0,
    })));
    const max = Math.max(...cells.map((cell) => cell.value), 1);
    const top = cells.reduce((best, cell) => (cell.value > best.value ? cell : best), cells[0] || { value: 0 });
    return { topics, risks, cells, max, top };
  }, [rows]);

  if (!matrix.topics.length || !matrix.risks.length) {
    return <EmptyState title="暂无显性风险共现" text="当前筛选下没有足够的主题—风险关联。" />;
  }

  const active = hovered || locked || matrix.top;
  return (
    <div className="topic-risk-matrix">
      <div className="risk-matrix-grid" style={{ "--topic-columns": matrix.topics.length }}>
        <div className="risk-matrix-corner">风险 / 主题</div>
        {matrix.topics.map((topic) => <div className="risk-matrix-topic" key={topic}>{topic}</div>)}
        {matrix.risks.map((risk, riskIndex) => (
          <React.Fragment key={risk}>
            <div className="risk-matrix-risk">
              <i style={{ background: chartPalette[(riskIndex + 1) % chartPalette.length] }} />
              <span>{risk}</span>
            </div>
            {matrix.cells.filter((cell) => cell.risk === risk).map((cell) => {
              const size = 16 + Math.sqrt(cell.value / matrix.max) * 40;
              const activeCell = active?.id === cell.id;
              return (
                <button
                  type="button"
                  className={activeCell ? "active" : ""}
                  key={cell.id}
                  aria-label={`${cell.topic}与${cell.risk}共现 ${cell.value} 次`}
                  aria-pressed={locked?.id === cell.id}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(cell)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setLocked((current) => current?.id === cell.id ? null : cell)}
                >
                  {cell.value > 0 && (
                    <i
                      className="risk-matrix-dot"
                      style={{
                        "--dot-size": `${size}px`,
                        "--risk-color": chartPalette[(cell.riskIndex + 1) % chartPalette.length],
                      }}
                    >
                      <b>{cell.value}</b>
                    </i>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="risk-matrix-reading" aria-live="polite">
        <span>当前关联</span>
        <strong>{active.topic} × {active.risk}</strong>
        <b>{formatNumber(active.value)} 次共现</b>
        <p>圆点面积表示同一帖子中主题与显性风险标签同时出现的次数。</p>
      </div>
    </div>
  );
}

function FilterBar({ data, derived, filters, setFilters, query, setQuery }) {
  const topicOptions = [...new Set(data.records.posts.map((row) => row.topic).filter(Boolean))].sort();
  const sceneOptions = [...new Set(data.records.posts.map((row) => row.scene).filter(Boolean))].sort();
  const riskOptions = [...new Set(data.records.posts.map((row) => row.risk).filter(Boolean))].sort();
  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length + (query.trim() ? 1 : 0);
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
      <div className="filter-summary" aria-live="polite">
        <span>当前观察范围</span>
        <strong>{formatNumber(derived.posts.length)} 篇帖子 · {formatNumber(derived.comments.length)} 条评论</strong>
        <small>{activeFilterCount ? `已启用 ${activeFilterCount} 项筛选` : "完整有效样本"}</small>
      </div>
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
      <div className="hero-field"><GenerativeField /></div>
      <div className="hero-copy">
        <p className="section-kicker"><i /> AI · HUMAN COMMUNICATION STUDY</p>
        <h1>当表达<br /><em>经过 AI</em></h1>
        <p>
          从一句“该怎么回”开始，观察生成式 AI 如何进入恋爱咨询、关系判断、道歉拒绝与正式沟通，
          以及效率、真实感、隐私和依赖如何在评论区形成新的讨论边界。
        </p>
        <div className="source-strip">
          <span>微博 × 小红书公开文本</span>
          <span>帖子—评论关联分析</span>
          <span>更新于 {data.meta.generatedAt}</span>
        </div>
      </div>
      <div className="hero-lens" aria-hidden="true">
        <div className="lens-ring"><span /><span /><span /></div>
        <div className="lens-core">
          <small>RESEARCH LENS</small>
          <strong>{derived.total.toLocaleString()}</strong>
          <span>条关联文本</span>
        </div>
        <div className="lens-stack">
          <article><b>POST</b><span>{derived.posts.length.toLocaleString()}</span></article>
          <article><b>COMMENT</b><span>{derived.comments.length.toLocaleString()}</span></article>
          <article><b>RISK SIGNAL</b><span>{derived.highRiskPosts.length.toLocaleString()}</span></article>
        </div>
        <div className="lens-thread">{Array.from({ length: 7 }).map((_, index) => <i key={index} />)}</div>
      </div>
      <div className="hero-kpis">
        {derived.metrics.map((item) => <KpiCard item={item} key={item.label} />)}
      </div>
    </section>
  );
}

function OverviewSection({ data, derived }) {
  return (
    <SectionFrame id="overview" label="01 / 数据全景" title={`从 ${derived.total.toLocaleString()} 条文本中，看见表达被重新组织`} text="先读样本结构，再沿着场景、主题和风险的连接进入研究。每个图形都响应上方筛选条件。">
      <div className="overview-composition">
        <div className="overview-flow">
          <ChartPanel title="场景—主题—风险路径谱" unit="共现次数" range="前 6 条显性风险路径" insight="以共享主题为桥梁，分别比较场景入口与显性风险的关联强度。" wide tall>
            <EvidencePathways rows={data.flows.sankey} />
          </ChartPanel>
        </div>
        <div className="overview-side">
          <ChartPanel title="讨论时间脉络" unit="帖子数" range="按月份" insight="识别持续议题与短期聚集。">
            <EChart option={timelineOption(derived.timeline)} />
          </ChartPanel>
          <ChartPanel title="样本从哪里来" unit="帖子数" range="当前筛选" insight="平台语境决定讨论的表达方式。">
            <EChart option={donutOption(derived.platform, { centeredTotal: true })} />
          </ChartPanel>
        </div>
        <div className="overview-pair">
          <ChartPanel title="主题 × 显性风险矩阵" unit="共现次数" range="前 5 主题 × 前 5 风险" insight="排除“无明显风险”后，观察真正需要解释的风险绑定。">
            <TopicRiskMatrix rows={derived.topicRisk} />
          </ChartPanel>
          <ChartPanel title="核心讨论主题" unit="帖子数" range="前 10 类" insight="排序决定后续报告的分析主线。">
            <EChart option={barOption(derived.topic)} />
          </ChartPanel>
        </div>
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
    { key: "comment", label: "评论结构", title: "评论区如何补充、支持或质疑原帖？" },
    { key: "keyword", label: "关键词分析", title: "网感词如何进入讨论？" },
    { key: "heat", label: "热度排行", title: "高互动样本集中在哪？" },
    { key: "anomaly", label: "异常与边界", title: "哪些风险样本值得复核？" },
    { key: "quality", label: "数据质量", title: "清洗和标签推断如何影响结论？" },
  ];

  useGSAP(() => {
    if (!panelRef.current) return;
    gsap.fromTo(panelRef.current.querySelectorAll(".tab-motion"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.04, ease: "power3.out" });
  }, { scope: panelRef, dependencies: [tab], revertOnUpdate: true });

  return (
    <SectionFrame id="analysis" label="02 / 多维切片" title="一份数据，八种观察距离" text="时间、场景、平台、评论、语言、热度、风险与数据质量彼此校验，避免用单一图表替复杂的人际经验下结论。">
      <div className="analysis-workbench">
      <div className="tabs" role="tablist" aria-label="多维分析维度">
        {tabs.map((item, index) => (
          <button key={item.key} role="tab" type="button" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
            <small>{String(index + 1).padStart(2, "0")}</small><span>{item.label}</span>
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
        {tab === "comment" && (
          <div className="comment-analysis tab-motion">
            <ChartPanel title="评论作用分布" unit="评论数" range="当前筛选" insight="经验补充、支持、质疑和风险提醒承担不同讨论功能。">
              <EChart option={barOption(derived.commentRole)} />
            </ChartPanel>
            <ChartPanel title="评论态度构成" unit="评论数" range="当前筛选" insight="态度比例以当前有效评论为分母。">
              <EChart option={donutOption(derived.commentAttitude)} />
            </ChartPanel>
            <ChartPanel title="原帖主题 × 评论态度" unit="关联评论" range="排除中性观察" insight="同一主题下的支持、担忧和反对可能同时存在。" wide>
              <EChart option={heatmapOption(derived.topicCommentAttitude)} className="large" />
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
        {tab === "quality" && <DataQualityPanel data={data} derived={derived} />}
      </div>
      </div>
    </SectionFrame>
  );
}

function ShowcaseSection({ derived }) {
  return (
    <SectionFrame id="showcase" label="03 / 评论星系" title="每条评论，都是原帖周围的一次靠近或偏离" text="节点位置呈现主题归属，颜色区分态度，亮度提示互动强度。放大、拖动或点选，查看争议如何聚合。">
      <div className="showcase-stage">
        <div className="showcase-brief">
          <p><strong>读图：</strong>越近，语义关联越强；越亮，互动越高。点击节点可追溯代表性评论。</p>
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

function DataQualityPanel({ data, derived }) {
  const meta = data.meta || {};
  const triage = meta.triage || {};
  const postRetention = meta.rawPostCount ? (meta.postCount / meta.rawPostCount) * 100 : 0;
  const commentRetention = meta.rawCommentCount ? (meta.commentCount / meta.rawCommentCount) * 100 : 0;
  const inferenceRows = [
    ["帖子主题补判", triage.postTopicInferred || 0, meta.postCount || 0],
    ["帖子场景补判", triage.postSceneInferred || 0, meta.postCount || 0],
    ["帖子态度补判", triage.postAttitudeInferred || 0, meta.postCount || 0],
    ["评论作用补判", triage.commentRoleInferred || 0, meta.commentCount || 0],
    ["评论态度补判", triage.commentAttitudeInferred || 0, meta.commentCount || 0],
    ["评论主题继承", triage.commentTopicInherited || 0, meta.commentCount || 0],
  ];
  return (
    <div className="quality-board tab-motion">
      <div className="quality-retention">
        <article>
          <span>帖子清洗保留率</span>
          <strong>{postRetention.toFixed(1)}%</strong>
          <p>{formatNumber(meta.postCount)} / {formatNumber(meta.rawPostCount)} 条原始帖子进入有效样本</p>
        </article>
        <article>
          <span>评论清洗保留率</span>
          <strong>{commentRetention.toFixed(1)}%</strong>
          <p>{formatNumber(meta.commentCount)} / {formatNumber(meta.rawCommentCount)} 条原始评论进入有效样本</p>
        </article>
        <article>
          <span>当前筛选样本</span>
          <strong>{formatNumber(derived.total)}</strong>
          <p>{formatNumber(derived.posts.length)} 篇帖子与 {formatNumber(derived.comments.length)} 条评论</p>
        </article>
      </div>
      <div className="quality-inference" aria-label="标签补判比例">
        <header><h3>标签推断记录</h3><p>补判不是删除；这些记录保留来源字段，便于人工复核。</p></header>
        {inferenceRows.map(([name, value, total]) => (
          <div className="quality-row" key={name}>
            <span>{name}</span>
            <i><b style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} /></i>
            <strong>{formatNumber(value)} / {formatNumber(total)}</strong>
          </div>
        ))}
      </div>
      <aside className="quality-method">
        <strong>口径说明</strong>
        <p>清洗保留率用于说明原始采集数据进入分析样本的比例；标签补判数量用于披露规则推断的影响范围，不等同于模型准确率。</p>
        <p>涉及多标签字段的统计显示“标签命中次数”，可能高于文本数量；帖子与评论通过 parentPostId 保持关联。</p>
      </aside>
    </div>
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
                    role="button"
                    tabIndex="0"
                    aria-label={`${point.topic}，${point.role}，${point.attitude}，点赞 ${point.likes}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.size}
                    fill={point.color}
                    onMouseEnter={() => setHovered(point)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(point)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setSelected(point)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(point);
                      }
                    }}
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
    <SectionFrame id="details" label="04 / 证据档案" title="每个结论，都能回到一条具体文本" text="搜索、排序、分页和导出完整保留，让聚合图形随时可以回溯到帖子与评论原始证据。">
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
    <SectionFrame id="conclusions" label="05 / 研究发现" title="AI 没有替代沟通，它改变了人们开口前的准备" text="以下判断均由当前样本支撑：它们是研究发现，也是继续追问人机关系的入口。">
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

function ErrorState({ message, onRetry }) {
  return <main className="state-page"><ShieldAlert size={28} /><strong>数据无法加载</strong><span>{message}</span><button type="button" onClick={onRetry}>重新加载</button></main>;
}

function App() {
  const { data, error, retry } = useDashboardData();
  const reduced = useReducedMotion();
  const shellRef = useRef(null);
  const [filters, setFilters] = useState({ platform: "all", topic: "all", scene: "all", risk: "all" });
  const [query, setQuery] = useState("");
  const filtered = useFilteredData(data, filters, query);
  const derived = useDerived(data, filtered);
  const narrativeData = useMemo(() => {
    if (!data || !filtered) return data;
    return { ...data, records: { ...data.records, posts: filtered.posts, comments: filtered.comments } };
  }, [data, filtered]);

  useGSAP(() => {
    if (!data || reduced) return undefined;
    const root = shellRef.current;
    if (!root) return undefined;
    gsap.to(".scroll-progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.35 },
    });

    const bridgeTimeline = gsap.timeline({
      scrollTrigger: { trigger: ".analysis-bridge", start: "top 78%", once: true },
    });
    bridgeTimeline
      .fromTo(".analysis-bridge .bridge-line", { autoAlpha: 0, scale: 0.82 }, { autoAlpha: 1, scale: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" })
      .fromTo(".analysis-bridge .bridge-copy > *", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.07, ease: "power3.out" }, "-=0.5")
      .fromTo(".analysis-bridge .bridge-stat", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08, ease: "power3.out" }, "-=0.38");

    ScrollTrigger.batch(".reveal-card", {
      start: "top 86%",
      once: true,
      batchMax: 6,
      onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.055, ease: "power3.out", overwrite: true }),
    });
    return () => ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }, { scope: shellRef, dependencies: [data, reduced] });

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || !derived) return <LoadingState />;

  const openAnalysis = (id = "workspace") => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="app-shell" ref={shellRef}>
      <a className="skip-link" href="#workspace">跳到完整数据分析</a>
      <NarrativeExperience data={narrativeData} onOpenAnalysis={openAnalysis} />
      <AnalysisBridge derived={derived} onOpenAnalysis={openAnalysis} />
      <main className="analysis-shell" id="workspace">
        <header className="site-header">
          <div className="scroll-progress" aria-hidden="true" />
          <a href="#top" className="brand-mark">
            <Sparkles size={18} />
            <span>生产实习-人工智能应用场景分析</span>
          </a>
          <nav aria-label="数据分析导航">
            <a href="#overview">数据全景</a>
            <a href="#analysis">多维分析</a>
            <a href="#showcase">评论星系</a>
            <a href="#details">证据档案</a>
            <a href="#conclusions">研究结论</a>
          </nav>
        </header>
        <FilterBar data={data} derived={derived} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} />
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
