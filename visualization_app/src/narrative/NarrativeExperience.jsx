import React, { useEffect, useMemo, useRef, useState } from "react";
import { curveCatmullRomClosed, hierarchy, line, pack } from "d3";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowDown, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { buildNarrativeData, interactionScore } from "./selectors";
import "./narrative.css";

gsap.registerPlugin(useGSAP);

const sceneNames = ["开口之前", "数据聚合", "场景群岛", "评论争议", "证据聚焦", "研究结论"];
const islandPalette = [
  { fill: "#dfe3ff", stroke: "#3047ff" },
  { fill: "#f5d7cf", stroke: "#d8543f" },
  { fill: "#e2ebcf", stroke: "#71922f" },
  { fill: "#dceaf0", stroke: "#527f96" },
  { fill: "#e6e0ef", stroke: "#756490" },
  { fill: "#ece3dc", stroke: "#9b6957" },
];
const attitudeClass = {
  支持: "support",
  担忧: "concern",
  反对: "oppose",
  求助: "request",
  调侃: "joke",
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function excerpt(value, length = 48) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, [role='button'], [role='tab']"));
}

function islandSeed(value) {
  return [...String(value || "")].reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) % 997, 17);
}

function organicIslandPath(node, name, scale = 1, phaseOffset = 0) {
  const seed = islandSeed(name);
  const points = Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    const phase = seed * 0.013 + phaseOffset;
    const contour = 1 + Math.sin(angle * 3 + phase) * 0.045 + Math.cos(angle * 5 - phase * 0.7) * 0.026;
    const radius = node.r * scale * contour;
    return [node.x + Math.cos(angle) * radius, node.y + Math.sin(angle) * radius];
  });
  return line().curve(curveCatmullRomClosed.alpha(0.68))(points);
}

function SceneIslands({ scenes, total }) {
  const [selected, setSelected] = useState(scenes[0]?.name || "");
  const nodes = useMemo(() => {
    const root = hierarchy({ children: scenes }).sum((item) => item.count || 0);
    return pack().size([620, 520]).padding(10)(root).leaves().map((node) => {
      node.x += 35;
      node.y += 35;
      return node;
    });
  }, [scenes]);
  const active = scenes.find((item) => item.name === selected) || scenes[0];
  const activeIndex = Math.max(0, scenes.findIndex((item) => item.name === active?.name));
  const activeShare = active ? (active.count / total) * 100 : 0;

  return (
    <div className="island-layout">
      <svg className="island-map" viewBox="0 0 690 590" role="img" aria-label="沟通场景有机岛屿面积图，岛屿基础面积与帖子数量成比例">
        <g className="island-map-guides" aria-hidden="true">
          <path d="M20 112 C138 48 230 76 326 130 S526 214 668 116" />
          <path d="M6 438 C126 354 238 388 348 442 S554 522 684 430" />
          <path d="M118 18 C72 146 108 258 162 356 S210 518 178 578" />
          <circle cx="344" cy="296" r="238" />
        </g>
        {nodes.map((node, index) => {
          const item = node.data;
          const activeNode = item.name === selected;
          const palette = islandPalette[index % islandPalette.length];
          return (
            <g
              key={item.name}
              className={`island-node ${activeNode ? "selected" : ""}`}
              role="button"
              tabIndex="0"
              aria-label={`${item.name}，${item.count}篇，占${((item.count / total) * 100).toFixed(1)}%`}
              aria-pressed={activeNode}
              style={{ "--island-fill": palette.fill, "--island-stroke": palette.stroke }}
              onClick={() => setSelected(item.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(item.name);
                }
              }}
            >
              <path className="island-shoreline" d={organicIslandPath(node, item.name)} />
              <path className="island-contour contour-outer" d={organicIslandPath(node, item.name, 0.76, 0.18)} />
              <path className="island-contour contour-inner" d={organicIslandPath(node, item.name, 0.52, 0.34)} />
              <circle className="island-marker" cx={node.x} cy={node.y} r="3" />
              {node.r > 38 && <text x={node.x} y={node.y - 7}>{excerpt(item.name, node.r > 70 ? 8 : 6)}</text>}
              {node.r > 28 && <text className="island-count" x={node.x} y={node.y + 17}>{formatNumber(item.count)}</text>}
            </g>
          );
        })}
      </svg>
      <aside className="island-reading" aria-live="polite">
        <span>SCENE {String(activeIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
        <strong>{active?.name}</strong>
        <b>{formatNumber(active?.count)} 篇</b>
        <div className="island-share" aria-label={`占全部有效帖子的 ${activeShare.toFixed(1)}%`}><i style={{ width: `${activeShare}%` }} /></div>
        <p>占全部有效帖子的 {activeShare.toFixed(1)}%</p>
        <small>岛屿基础面积按帖子数量计算；有机轮廓仅用于区分场景。所有场景合计 {formatNumber(total)} 篇。</small>
      </aside>
    </div>
  );
}

function DebateScene({ debate }) {
  const comments = debate?.comments?.slice(0, 9) || [];
  const [selectedId, setSelectedId] = useState(comments[0]?.id || "");
  useEffect(() => setSelectedId(comments[0]?.id || ""), [debate?.post?.id]);
  const selected = comments.find((comment) => comment.id === selectedId) || comments[0];

  if (!debate) return <div className="narrative-empty">当前筛选下没有可关联的帖子与评论。</div>;

  return (
    <div className="debate-layout">
      <div className="debate-space" aria-label="真实帖子与关联评论争议图">
        <article className="debate-post">
          <span>原帖 · {debate.post.platformName}</span>
          <strong>{excerpt(debate.post.text, 54)}</strong>
          <b>{formatNumber(debate.post.likes)}赞 · {formatNumber(debate.comments.length)}条有效关联评论</b>
        </article>
        {comments.map((comment, index) => {
          const angle = -Math.PI / 2 + (index / Math.max(comments.length, 1)) * Math.PI * 2;
          const distance = index % 2 ? 39 : 45;
          const size = Math.min(68, 30 + Math.log1p(interactionScore(comment)) * 5.2);
          const attitude = comment.attitude || "中性观察";
          return (
            <button
              type="button"
              key={comment.id}
              className={`debate-node ${attitudeClass[attitude] || "neutral"} ${comment.id === selectedId ? "selected" : ""}`}
              style={{
                left: `${50 + Math.cos(angle) * distance}%`,
                top: `${50 + Math.sin(angle) * distance * 0.72}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
              aria-label={`${attitude}评论，${comment.likes || 0}赞：${excerpt(comment.text, 42)}`}
              aria-pressed={comment.id === selectedId}
              onClick={() => setSelectedId(comment.id)}
            >
              <i />
            </button>
          );
        })}
      </div>
      <aside className="debate-detail" aria-live="polite">
        <span>{selected?.attitude || "中性观察"} · {selected?.role || "评论作用未明确"}</span>
        <blockquote>“{excerpt(selected?.text, 120)}”</blockquote>
        <b>{formatNumber(selected?.likes)}赞 · {formatNumber(selected?.replies)}回复</b>
        <dl>
          <div><dt>节点大小</dt><dd>互动量</dd></div>
          <div><dt>节点颜色</dt><dd>评论态度</dd></div>
          <div><dt>节点归属</dt><dd>同一原帖</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function EvidenceScene({ cases }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [cases]);
  const item = cases[index];
  if (!item) return <div className="narrative-empty">当前筛选下没有可展示的关联案例。</div>;

  return (
    <div className="evidence-layout">
      <article className="evidence-post">
        <div className="evidence-meta">
          <b>POST / {item.post.id.slice(-6).toUpperCase()}</b>
          <span>{item.post.platformName} · {item.post.scene}</span>
          <span>{item.post.publishTime || "时间未记录"}</span>
        </div>
        <blockquote>“{excerpt(item.post.text, 210)}”</blockquote>
        <div className="evidence-numbers">
          <span><b>{formatNumber(item.post.likes)}</b>赞</span>
          <span><b>{formatNumber(item.post.comments)}</b>评论</span>
          <span><b>{formatNumber(item.comments.length)}</b>有效关联评论</span>
        </div>
      </article>
      <div className="evidence-comments">
        {item.comments.slice(0, 3).map((comment) => (
          <article key={comment.id} className={attitudeClass[comment.attitude] || "neutral"}>
            <span>{comment.attitude} · {comment.role}</span>
            <p>“{excerpt(comment.text, 76)}”</p>
            <b>{formatNumber(comment.likes)}赞</b>
          </article>
        ))}
      </div>
      <div className="evidence-filmstrip" role="list" aria-label="高互动关联案例">
        {cases.slice(0, 8).map((entry, caseIndex) => (
          <button
            type="button"
            role="listitem"
            key={entry.post.id}
            className={caseIndex === index ? "selected" : ""}
            aria-current={caseIndex === index ? "true" : undefined}
            onClick={() => setIndex(caseIndex)}
          >
            {String(caseIndex + 1).padStart(2, "0")}
            <small>{formatNumber(entry.post.likes)}赞</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NarrativeExperience({ data, onOpenAnalysis }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const narrative = useMemo(() => buildNarrativeData(data), [data]);
  const [scene, setScene] = useState(0);
  const wheelLock = useRef(false);
  const fragments = narrative.cases.slice(0, 5).map((item) => excerpt(item.post.text, 16));

  const goTo = (next) => {
    rootRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    setScene(Math.max(0, Math.min(sceneNames.length - 1, next)));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isInteractiveTarget(event.target)) return;
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        setScene((value) => Math.min(sceneNames.length - 1, value + 1));
      }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setScene((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useGSAP(() => {
    if (!stageRef.current || reduced) return;
    const sceneNode = stageRef.current.querySelector(".narrative-scene");
    const reveals = stageRef.current.querySelectorAll(".scene-reveal");
    const marks = stageRef.current.querySelectorAll(".data-mark");
    const orbits = stageRef.current.querySelectorAll(".ambient-orbit");
    const fragmentsInScene = stageRef.current.querySelectorAll(".language-fragment");
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (sceneNode) timeline.fromTo(sceneNode, { autoAlpha: 0, y: 20, scale: 0.992 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 });
    if (reveals.length) timeline.fromTo(reveals, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.56, stagger: 0.07 }, "<0.08");
    if (marks.length) timeline.fromTo(marks, { autoAlpha: 0, scale: 0.82 }, { autoAlpha: 1, scale: 1, duration: 0.44, stagger: { amount: 0.36, from: "random" } }, "<0.08");
    if (orbits.length) gsap.to(orbits, { rotation: 360, duration: 34, repeat: -1, ease: "none" });
    if (fragmentsInScene.length) gsap.to(fragmentsInScene, { y: -8, duration: 3.2, yoyo: true, repeat: -1, stagger: { amount: 2.4, from: "random" }, ease: "sine.inOut" });
  }, { scope: stageRef, dependencies: [scene], revertOnUpdate: true });

  const onWheel = (event) => {
    if (window.innerWidth < 780 || Math.abs(event.deltaY) < 24 || wheelLock.current) return;
    wheelLock.current = true;
    setScene((value) => Math.max(0, Math.min(sceneNames.length - 1, value + (event.deltaY > 0 ? 1 : -1))));
    window.setTimeout(() => { wheelLock.current = false; }, 620);
  };

  const activeScene = (() => {
    if (scene === 0) return (
      <div className="narrative-scene scene-before-send">
        {fragments.map((fragment, index) => <span key={`${fragment}-${index}`} className={`language-fragment fragment-${index + 1}`}>{fragment}</span>)}
        <div className="before-mark scene-reveal"><span>开口之前</span><i /><span>AI 介入</span></div>
        <h1 className="scene-reveal">一句话尚未发出，<br />关系已经开始计算。</h1>
        <p className="scene-reveal">我们不从“AI 能做什么”开始，而从人为什么在某一刻不敢直接表达开始。</p>
        <button className="narrative-primary scene-reveal" type="button" onClick={() => goTo(1)}>追踪这些表达 <ArrowRight size={17} /></button>
      </div>
    );
    if (scene === 1) return (
      <div className="narrative-scene scene-aggregation">
        <div className="aggregation-copy scene-reveal">
          <span>公开文本被收集、清洗、标注并建立帖子—评论关联</span>
          <h2>{formatNumber(narrative.totals.texts)} 个表达片段<br />形成同一个研究现场</h2>
          <p>统计范围：微博与小红书公开文本，更新于 {narrative.generatedAt}。</p>
        </div>
        <div className="aggregation-field data-mark">
          <i className="ambient-orbit orbit-one" /><i className="ambient-orbit orbit-two" /><i className="ambient-orbit orbit-three" />
          <div className="aggregation-core"><strong>{formatNumber(narrative.totals.texts)}</strong><span>关联文本</span></div>
          <b className="aggregation-metric metric-post">{formatNumber(narrative.totals.posts)}<small>有效帖子</small></b>
          <b className="aggregation-metric metric-comment">{formatNumber(narrative.totals.comments)}<small>有效评论</small></b>
          <b className="aggregation-metric metric-signal">{(narrative.totals.explicitRate * 100).toFixed(1)}%<small>{formatNumber(narrative.totals.explicitAttitudes)} / {formatNumber(narrative.totals.comments)} 条评论态度明确</small></b>
          <b className="aggregation-metric metric-interaction">{formatNumber(narrative.totals.interactions)}<small>帖文互动量</small></b>
        </div>
      </div>
    );
    if (scene === 2) return (
      <div className="narrative-scene scene-islands">
        <div className="scene-heading scene-reveal"><span>沟通场景</span><h2>需求不是一种，<br />而是一片按真实体量生成的群岛。</h2></div>
        <SceneIslands scenes={narrative.scenes} total={narrative.sceneTotal} />
      </div>
    );
    if (scene === 3) return (
      <div className="narrative-scene scene-debate">
        <div className="scene-heading scene-reveal"><span>帖子—评论争议结构</span><h2>同一条建议，在评论区形成不同方向。</h2></div>
        <DebateScene debate={narrative.debate} />
      </div>
    );
    if (scene === 4) return (
      <div className="narrative-scene scene-evidence">
        <div className="scene-heading scene-reveal"><span>从聚合图形回到具体的人</span><h2>证据不是表格中的一行，<br />而是一段有上下文的对话。</h2></div>
        <EvidenceScene cases={narrative.cases} />
      </div>
    );
    return (
      <div className="narrative-scene scene-synthesis">
        <div className="synthesis-field data-mark">
          <i /><i /><i />
          <strong>{(narrative.totals.explicitRate * 100).toFixed(1)}%</strong>
          <span>{formatNumber(narrative.totals.explicitAttitudes)} / {formatNumber(narrative.totals.comments)} 条评论</span>
        </div>
        <div className="synthesis-copy scene-reveal">
          <span>研究结论</span>
          <h2>AI 没有替代沟通。<br />它改变了人们<br />开口前的准备。</h2>
          <p>接受与担忧并存。人们需要表达支持，也持续追问：这句话还像不像我？这段关系究竟属于谁？</p>
          <div className="synthesis-notes">
            <button type="button" onClick={() => onOpenAnalysis("analysis")}><b>01</b><span>{narrative.scenes[0]?.name}是最大场景，{formatNumber(narrative.scenes[0]?.count)}篇</span></button>
            <button type="button" onClick={() => onOpenAnalysis("analysis")}><b>02</b><span>风险边界需结合主题、场景与评论态度共同解释</span></button>
            <button type="button" onClick={() => onOpenAnalysis("details")}><b>03</b><span>{formatNumber(narrative.totals.comments)}条评论构成第二层公共证据</span></button>
          </div>
          <button className="narrative-primary" type="button" onClick={() => onOpenAnalysis("workspace")}>进入完整数据分析 <ArrowDown size={17} /></button>
        </div>
      </div>
    );
  })();

  return (
    <section ref={rootRef} className="narrative-experience" id="top" onWheel={onWheel} aria-label="六幕研究叙事">
      <aside className="narrative-rail">
        <div className="narrative-brand"><i /><span>HUMAN<br />SIGNALS</span></div>
        <nav aria-label="研究叙事章节">
          {sceneNames.map((name, index) => (
            <button type="button" key={name} onClick={() => goTo(index)} aria-current={scene === index ? "step" : undefined} aria-label={`第${index + 1}幕：${name}`}>
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </nav>
        <span className="narrative-caption">AI × 人际沟通<br />文本分析研究</span>
      </aside>
      <div className="narrative-stage" ref={stageRef}>
        <div className="narrative-index">ACT {String(scene + 1).padStart(2, "0")} · {sceneNames[scene].toUpperCase()}</div>
        {activeScene}
        <div className="narrative-switch" aria-label="章节切换">
          <button type="button" disabled={scene === 0} onClick={() => goTo(scene - 1)} aria-label="上一幕"><ArrowLeft size={16} /></button>
          <span><b>{String(scene + 1).padStart(2, "0")}</b> / 06</span>
          <button type="button" disabled={scene === 5} onClick={() => goTo(scene + 1)} aria-label="下一幕"><ArrowRight size={16} /></button>
        </div>
        <a className="narrative-workspace-link" href="#workspace"><ExternalLink size={14} /> 数据分析</a>
      </div>
    </section>
  );
}
