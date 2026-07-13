const EXPLICIT_ATTITUDES = new Set(["支持", "担忧", "反对", "求助", "调侃"]);
const UNCLEAR_LABELS = new Set(["", "未标注", "无法判断", "场景未标注", "场景未明确"]);

function label(value, fallback) {
  const text = String(value || "").trim();
  return UNCLEAR_LABELS.has(text) ? fallback : text;
}

function interactionScore(row) {
  return Number(row.likes || 0)
    + Number(row.comments || 0) * 2
    + Number(row.replies || 0) * 2
    + Number(row.shares || 0) * 2
    + Number(row.collects || 0);
}

function relevanceScore(post) {
  const text = `${post.title || ""} ${post.text || ""} ${post.keyword || ""} ${post.topic || ""} ${post.scene || ""}`;
  const matches = text.match(/AI|AIGC|ChatGPT|GPT|人工智能|聊天记录|回消息|恋爱军师|高情商|代聊|提示词/gi) || [];
  return Math.min(8, matches.length) * 1800;
}

function countRecords(rows, field, fallback) {
  const counts = new Map();
  rows.forEach((row) => {
    const name = label(row[field], fallback);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildNarrativeData(data) {
  const posts = data?.records?.posts || [];
  const comments = data?.records?.comments || [];
  const commentsByPost = new Map();

  comments.forEach((comment) => {
    const list = commentsByPost.get(comment.parentPostId) || [];
    list.push(comment);
    commentsByPost.set(comment.parentPostId, list);
  });

  const explicitComments = comments.filter((comment) => EXPLICIT_ATTITUDES.has(label(comment.attitude, "中性观察")));
  const scenes = countRecords(posts, "scene", "场景未明确");
  const sceneTotal = scenes.reduce((sum, item) => sum + item.count, 0);
  const cases = posts
    .map((post) => {
      const linkedComments = (commentsByPost.get(post.id) || [])
        .slice()
        .sort((a, b) => interactionScore(b) - interactionScore(a));
      return {
        post,
        comments: linkedComments,
        score: interactionScore(post)
          + relevanceScore(post)
          + linkedComments.length * 18
          + linkedComments.slice(0, 12).reduce((sum, comment) => sum + interactionScore(comment), 0),
      };
    })
    .filter((item) => item.comments.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const debate = cases.find((item) => {
    const attitudes = new Set(item.comments.map((comment) => label(comment.attitude, "中性观察")));
    const relevant = /AI|AIGC|ChatGPT|GPT|人工智能|聊天记录|回消息|恋爱军师|高情商|代聊|提示词/i
      .test(`${item.post.title || ""} ${item.post.text || ""}`);
    return relevant && attitudes.has("支持") && (attitudes.has("担忧") || attitudes.has("反对"));
  }) || cases[0] || null;

  const platform = countRecords(posts, "platformName", "来源未记录");
  const risks = countRecords(posts, "risk", "风险未明确");
  const commentRoles = countRecords(comments, "role", "评论作用未明确");
  const totalInteractions = posts.reduce((sum, post) => sum + interactionScore(post), 0);

  return {
    totals: {
      posts: posts.length,
      comments: comments.length,
      texts: posts.length + comments.length,
      interactions: totalInteractions,
      explicitAttitudes: explicitComments.length,
      explicitRate: comments.length ? explicitComments.length / comments.length : 0,
    },
    scenes,
    sceneTotal,
    platforms: platform,
    risks,
    commentRoles,
    cases,
    debate,
    generatedAt: data?.meta?.generatedAt || "",
    triage: data?.meta?.triage || {},
  };
}

export { interactionScore };
