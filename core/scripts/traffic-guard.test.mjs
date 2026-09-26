import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, formatGuardAlert } from "./traffic-guard.ts";
import { parseNginxLine } from "./traffic-monitor.ts";

const now = Date.parse("2026-09-25T09:00:00Z");
const sample = (minute, source, path, status = 200) => ({
  timestamp: now - minute * 60_000 + 10_000,
  source, path, status, method: "GET", referrer: "-", userAgent: "test",
});

test("CN requests remain visible but cannot trip volume or error shutdown", () => {
  const rows = [1, 2].flatMap(minute => ["nginx", "api"].flatMap(source =>
    Array.from({ length: 5000 }, () => ({ ...sample(minute, source, "/zh", 502), cnExempt: true }))));
  const result = evaluate(rows, now);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.window.api[0].requests, 5000);
  assert.equal(result.window.api[0].exempt, 5000);
  assert.equal(result.window.api[0].errors, 5000);
  rows.push(...Array.from({ length: 100 }, () => sample(1, "api", "/v1/a", 502)));
  assert.deepEqual(evaluate(rows, now).reasons, ["api_5xx_spike"]);
});

test("CN exemption only comes from the server-owned log suffix", () => {
  const line = '1.0.1.1 - - [25/Sep/2026:08:59:00 +0000] "GET /zh HTTP/1.1" 200 10 "-" "cn_exempt=1"';
  assert.equal(parseNginxLine(line).cnExempt, undefined);
  assert.equal(parseNginxLine(`${line} maintenance=0 cn_exempt=1`).cnExempt, true);
  assert.equal(parseNginxLine(`${line} maintenance=1 cn_exempt=0`).maintenance, true);
  assert.equal(parseNginxLine(`${line} maintenance=0`).cnExempt, undefined);
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

test("previous maintenance traffic cannot retrip the guard after reopening", () => {
  const rows = [1, 2].flatMap(minute => Array.from({ length: 4100 }, () => ({
    ...sample(minute, "api", "/v1/cubing-live/A", 503), maintenance: true,
  })));
  const result = evaluate(rows, now);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.window.api[0].maintenance, 4100);
  assert.equal(result.window.api[0].limited, 0);
  assert.equal(result.window.api[0].errors, 0);
});

test("denied requests alone do not shut down the site", () => {
  const rows = Array.from({length: 4100}, () => sample(1, "nginx", "/zh/calc", 403));
  assert.deepEqual(evaluate(rows, now).reasons, []);
});

test("shutdown notification explains the reason and received/blocked counts", () => {
  const rows = [1,2].flatMap(minute => Array.from({length:1210}, () => sample(minute,"api","/v1/a")));
  rows.push(...Array.from({length:20}, () => sample(1,"api","/v1/a",429)));
  const message = formatGuardAlert(evaluate(rows,now),now);
  assert.match(message,/原因：数据接口未被拦截的请求过多/);
  assert.match(message,/数据接口：收到 2440 次，记录到拦截 20 次/);
  assert.match(message,/两个完整分钟/);
  assert.doesNotMatch(message,/api_request_spike/);
});
