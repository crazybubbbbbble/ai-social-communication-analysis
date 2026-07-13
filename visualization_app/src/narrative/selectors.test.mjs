import assert from "node:assert/strict";
import fs from "node:fs";
import { buildNarrativeData } from "./selectors.js";

const dashboard = JSON.parse(fs.readFileSync(new URL("../../public/data/dashboard.json", import.meta.url), "utf8"));
const narrative = buildNarrativeData(dashboard);

assert.equal(narrative.totals.posts, 2052, "post total must match dashboard records");
assert.equal(narrative.totals.comments, 6354, "comment denominator must match dashboard records");
assert.equal(narrative.sceneTotal, narrative.totals.posts, "scene areas must reconcile to all posts");
assert.ok(narrative.totals.explicitAttitudes <= narrative.totals.comments, "explicit attitudes cannot exceed the denominator");
assert.ok(narrative.cases.length > 0, "at least one linked post-comment case is required");
narrative.cases.forEach(({ post, comments }) => {
  assert.ok(comments.every((comment) => comment.parentPostId === post.id), "case comments must remain linked to their post");
});

console.log(JSON.stringify({
  posts: narrative.totals.posts,
  comments: narrative.totals.comments,
  explicitAttitudes: narrative.totals.explicitAttitudes,
  explicitRate: Number((narrative.totals.explicitRate * 100).toFixed(1)),
  sceneTotal: narrative.sceneTotal,
  cases: narrative.cases.length,
}, null, 2));
