import assert from "node:assert/strict";
import { test } from "node:test";
import { TrafficAccumulator, parseNginxLine, parseVercelLine, routeGroup, referrerDomain } from "./traffic-monitor.ts";

test("normalizes nginx requests without keeping query values or personal paths", () => {
  const line = '1.2.3.4 - - [23/Sep/2026:18:57:00 +0800] "GET /zh/calc?name0=Private HTTP/2.0" 200 123 "https://example.com/link?token=Secret" "Mozilla/5.0"';
  const sample = parseNginxLine(line);
  assert.equal(sample?.clientAddress, "1.2.3.4");
  assert.equal(sample?.timestamp, Date.parse("2026-09-23T10:57:00Z"));
  assert.equal(routeGroup(sample.path), "/zh/calc");
  assert.equal(referrerDomain(sample.referrer), "example.com");
  assert.equal(routeGroup("/wca/persons/2021PRIVATE01"), "/wca/persons/:id");
  assert.equal(routeGroup("/zh/recon/private-name/case"), "/zh/recon/:detail");
});

test("deduplicates Vercel request records and detects a same-hour spike", () => {
  const now = Date.parse("2026-09-23T12:07:00Z");
  const accumulator = new TrafficAccumulator(now);
  accumulator.addInput("vercel");
  const earlier = Date.parse("2026-09-23T11:15:00Z");
  for (let day = 1; day <= 7; day++) {
    for (let i = 0; i < 20; i++) accumulator.add({ source: "vercel", timestamp: earlier - day * 86_400_000, id: `past-${day}-${i}`, method: "GET", path: "/zh/calc", status: 200, referrer: "", userAgent: "Mozilla/5.0" });
  }
  for (let i = 0; i < 120; i++) {
    const record = parseVercelLine(JSON.stringify({ id: `event-${i}`, environment: "production", proxy: { timestamp: earlier, host: "cuberoot.me", path: "/zh/calc?name0=Private", method: "GET", statusCode: 200, userAgent: ["Reflectionbot/1.0"], referer: "", vercelId: `request-${i}` } }));
    assert.ok(record);
    accumulator.add(record);
    accumulator.add(record);
  }
  const [nginx, vercel] = accumulator.report().sources;
  assert.equal(nginx.coverage, "not_connected");
  assert.equal(vercel.requests, 120);
  assert.equal(vercel.baselinePageCandidates, 20);
  assert.deepEqual(vercel.alerts, ["page_candidates_spike"]);
  assert.deepEqual(vercel.topRoutes, [{ name: "/zh/calc", count: 120 }]);
  assert.deepEqual(vercel.agentClasses, [{ name: "declared automation", count: 120 }]);
});

test("attributes a page spike without publishing addresses or query values", () => {
  const now = Date.parse("2026-09-23T12:07:00Z");
  const accumulator = new TrafficAccumulator(now);
  accumulator.addInput("nginx");
  const current = Date.parse("2026-09-23T11:15:00Z");
  for (let day = 1; day <= 7; day++) {
    for (let i = 0; i < 20; i++) accumulator.add({ source: "nginx", clientAddress: "baseline-private-address", timestamp: current - day * 86_400_000, method: "GET", path: "/zh/calc", status: 200, referrer: "-", userAgent: "Mozilla/5.0" });
  }
  for (let i = 0; i < 120; i++) accumulator.add({ source: "nginx", clientAddress: "private-address-a", timestamp: current + (i % 60) * 1000, method: "GET", path: `/zh/calc?name0=private-${i}`, status: 200, referrer: "https://example.com/private/path?secret=1", userAgent: "Lightpanda/1.0" });
  for (let i = 0; i < 10; i++) accumulator.add({ source: "nginx", clientAddress: "private-address-b", timestamp: current, method: "GET", path: "/zh/wca/comp/private", status: 200, referrer: "-", userAgent: "Mozilla/5.0 Chrome/100" });
  const nginx = accumulator.report().sources[0];
  assert.deepEqual(nginx.alerts, ["page_candidates_spike"]);
  assert.equal(nginx.attribution.loggedSourceAddresses, 2);
  assert.equal(nginx.attribution.leadingSourceShareOfPageCandidates, 0.923);
  assert.deepEqual(nginx.attribution.topSources[0], {
    source: "source-1", requests: 120, pageCandidates: 120,
    distinctRouteGroups: 1, peakPageCandidatesPerMinute: 120, signal: "declared_automation",
    declaredAutomationPageCandidates: 120,
    topRoutes: [{ name: "/zh/calc", count: 120 }],
    topReferrers: [{ name: "example.com", count: 120 }],
    browserClaims: [{ name: "Lightpanda", count: 120 }],
  });
  const json = JSON.stringify(nginx);
  assert.doesNotMatch(json, /private-address|private-|secret|\/private\/path/);
});

test("reads sanitized drain records without restoring removed values", () => {
  const sample = parseVercelLine(JSON.stringify({ schema: "cuberoot.traffic.v1", id: "one", timestamp: 1,
    method: "GET", status: 200, path: "/zh/calc", referrer: "https://example.com/", userAgent: "self-declared bot" }));
  assert.equal(sample?.path, "/zh/calc");
  assert.equal(sample?.referrer, "https://example.com/");
});
