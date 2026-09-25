import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "./traffic-guard.ts";

const now = Date.parse("2026-09-25T09:00:00Z");
const sample = (minute, source, path, status = 200) => ({
  timestamp: now - minute * 60_000 + 10_000,
  source, path, status, method: "GET", referrer: "-", userAgent: "test",
});

test("normal asset burst and one minute of pages do not close the site", () => {
  const rows = [
    ...Array.from({ length: 1200 }, () => sample(1, "nginx", "/_next/static/a.js")),
    ...Array.from({ length: 400 }, () => sample(1, "nginx", "/zh/wca/comp/A")),
    ...Array.from({ length: 200 }, () => sample(2, "nginx", "/zh/wca/comp/B")),
  ];
  assert.deepEqual(evaluate(rows, now).reasons, []);
});

test("sustained high-cost page requests close the site", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 800 }, () => sample(minute, "nginx", "/zh/wca/comp/A")));
  assert.deepEqual(evaluate(rows, now).reasons, ["web_page_spike"]);
});

test("page rate limit and burst headroom do not trigger emergency shutdown", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 631 }, () => sample(minute, "nginx", "/zh")));
  assert.deepEqual(evaluate(rows, now).reasons, []);
});

test("blocked requests remain counted without tripping request or 429 guards", () => {
  const rows = [1, 2].flatMap(minute => ["api", "nginx", "next"].flatMap(source =>
    Array.from({ length: 4100 }, () => sample(minute, source, "/zh/wca/comp/A", 429))));
  const result = evaluate(rows, now);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.window.api[0].limited, 4100);
  assert.equal(result.window.web[0].limited, 8200);
  assert.equal(result.window.web[0].pages, 0);
});

test("incident request counts with working rate limits no longer close the site", () => {
  const rows = [[2, 1419, 184], [1, 1057, 138]].flatMap(([minute, requests, limited]) =>
    Array.from({ length: requests }, (_, index) => sample(minute, "api", "/v1/cubing-live/A", index < limited ? 429 : 200)));
  assert.deepEqual(evaluate(rows, now).reasons, []);
});

test("real upstream failures still trip even with many blocked requests", () => {
  const rows = [1, 2].flatMap(minute => [
    ...Array.from({ length: 40 }, () => sample(minute, "api", "/v1/cubing-live/A", 502)),
    ...Array.from({ length: 4000 }, () => sample(minute, "api", "/v1/cubing-live/A", 429)),
  ]);
  assert.deepEqual(evaluate(rows, now).reasons, ["api_5xx_spike"]);
});

test("independent API overload closes the main site", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 1210 }, () => sample(minute, "api", "/v1/wca/comp")));
  assert.deepEqual(evaluate(rows, now).reasons, ["api_request_spike"]);
});

test("disabled Analytics proxy failures do not trigger a 5xx trip", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 150 }, () => sample(minute, "nginx", "/_vercel/insights/script.js", 502)));
  assert.deepEqual(evaluate(rows, now).reasons, []);
});
