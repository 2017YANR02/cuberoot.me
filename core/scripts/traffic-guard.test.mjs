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
  const rows = [1, 2].flatMap(minute => Array.from({ length: 360 }, () => sample(minute, "nginx", "/zh/wca/comp/A")));
  assert.deepEqual(evaluate(rows, now).reasons, ["web_page_spike"]);
});

test("independent API overload closes the main site", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 1210 }, () => sample(minute, "api", "/v1/wca/comp")));
  assert.deepEqual(evaluate(rows, now).reasons, ["api_request_spike"]);
});

test("disabled Analytics proxy failures do not trigger a 5xx trip", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 150 }, () => sample(minute, "nginx", "/_vercel/insights/script.js", 502)));
  assert.deepEqual(evaluate(rows, now).reasons, []);
});
