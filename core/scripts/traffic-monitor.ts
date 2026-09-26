import { createReadStream, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export type Source = "nginx" | "next" | "api" | "vercel";
export type RequestSample = {
  source: Source;
  clientAddress?: string;
  timestamp: number;
  path: string;
  status: number;
  method: string;
  referrer: string;
  userAgent: string;
  maintenance?: boolean;
  cnExempt?: boolean;
};

const NGINX_LINE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;
const NGINX_DATE = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/;
const MONTHS = new Map(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name, index) => [name, index + 1]));
const HOUR = 3_600_000;
const PUBLIC_ROOTS = new Set(["about", "account", "achievements", "alg", "alg-trainers", "auth", "calc", "calc-about", "comp-sim", "cstimer", "dev", "docs", "frame-count", "math", "membership", "memo", "mosaic", "music", "pets", "predict", "quiz", "recon", "recognize", "scramble", "sim", "site", "solver", "support", "timer", "tutorial", "wca", "wiki"]);
const PUBLIC_SUBROUTES: Record<string, Set<string>> = {
  wca: new Set(["results", "comp", "persons", "records", "fun-stats", "prediction"]),
  alg: new Set(["2x2", "3x3", "4x4", "5x5", "sq1", "fto", "megaminx", "pyraminx", "skewb"]),
  scramble: new Set(["gen", "solver", "analyzer", "stats", "batch-solver"]),
  math: new Set(["cube-graph", "group"]),
};

function timestampFromNginx(value: string): number | null {
  const match = NGINX_DATE.exec(value);
  if (!match) return null;
  const month = MONTHS.get(match[2]);
  if (!month) return null;
  const iso = `${match[3]}-${String(month).padStart(2, "0")}-${match[1]}T${match[4]}:${match[5]}:${match[6]}${match[7]}:${match[8]}`;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseNginxLine(line: string, source: "nginx" | "next" | "api" = "nginx"): RequestSample | null {
  const match = NGINX_LINE.exec(line);
  if (!match) return null;
  const timestamp = timestampFromNginx(match[2]);
  if (timestamp === null) return null;
  const [method, path] = match[3].split(" ");
  if (!method || !path) return null;
  const marker = /^ maintenance=([01])(?: cn_exempt=([01]))?\s*$/.exec(line.slice(match[0].length));
  return { source, clientAddress: match[1], timestamp, method, path, status: Number(match[4]), referrer: match[5], userAgent: match[6],
    ...(marker ? { maintenance: marker[1] === "1", ...(marker[2] ? { cnExempt: marker[2] === "1" } : {}) } : {}) };
}

export function isMaintenanceResponse(sample: RequestSample): boolean {
  return sample.maintenance === true && sample.status === 503;
}

export function parseVercelLine(line: string): (RequestSample & { id: string }) | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.schema === "cuberoot.traffic.v1") {
    if (typeof data.id !== "string" || typeof data.timestamp !== "number" || typeof data.path !== "string") return null;
    return {
      source: "vercel", id: data.id, timestamp: data.timestamp,
      method: typeof data.method === "string" ? data.method : "",
      path: data.path, status: typeof data.status === "number" ? data.status : 0,
      referrer: typeof data.referrer === "string" ? data.referrer : "",
      userAgent: typeof data.userAgent === "string" ? data.userAgent : "",
    };
  }
  if (data.environment && data.environment !== "production") return null;
  const proxy = data.proxy as Record<string, unknown> | undefined;
  if (!proxy || proxy.host !== "cuberoot.me" || typeof proxy.path !== "string" || typeof proxy.timestamp !== "number") return null;
  const agent = Array.isArray(proxy.userAgent) ? proxy.userAgent[0] : proxy.userAgent;
  const id = typeof proxy.vercelId === "string" ? proxy.vercelId : data.id;
  if (typeof id !== "string" || !id) return null;
  return {
    source: "vercel", id, timestamp: proxy.timestamp,
    method: typeof proxy.method === "string" ? proxy.method : "",
    path: proxy.path, status: typeof proxy.statusCode === "number" ? proxy.statusCode : 0,
    referrer: typeof proxy.referer === "string" ? proxy.referer : "",
    userAgent: typeof agent === "string" ? agent : "",
  };
}

export function routeGroup(raw: string): string {
  let pathname: string;
  try {
    pathname = new URL(raw, "https://cuberoot.me").pathname;
  } catch {
    return "/(invalid)";
  }
  const parts = pathname.split("/").filter(Boolean);
  const language = parts[0] === "zh" || parts[0] === "en" ? `/${parts.shift()}` : "";
  if (parts.length === 0) return language || "/";
  if (!PUBLIC_ROOTS.has(parts[0])) return `${language}/:other`;
  // Bounded route grouping prevents personal names and high-cardinality IDs in reports.
  if (parts[0] === "wca" && ["persons", "comp"].includes(parts[1] || "") && parts[2]) {
    return `${language}/wca/${parts[1]}/:id`;
  }
  if (parts.length === 1) return `${language}/${parts[0]}`;
  if (PUBLIC_SUBROUTES[parts[0]]?.has(parts[1])) {
    return `${language}/${parts[0]}/${parts[1]}${parts.length > 2 ? "/:detail" : ""}`;
  }
  return `${language}/${parts[0]}/:detail`;
}

export function apiRouteGroup(raw: string): string {
  let parts: string[];
  try { parts = new URL(raw, "https://api.cuberoot.me").pathname.split("/").filter(Boolean); }
  catch { return "/(invalid)"; }
  if (parts[0] !== "v1") return "/:other";
  if (parts[1] === "cubing-live") return "/v1/cubing-live/:id";
  if (parts[1] === "cubing-live-stream") return "/v1/cubing-live-stream/:id";
  if (parts[1] === "wca") return "/v1/wca/:endpoint";
  if (["nav", "alg", "timer", "visualcube.svg", "cn-comp-names", "page-notices"].includes(parts[1] || "")) return `/v1/${parts[1]}`;
  return "/v1/:other";
}

export function referrerDomain(raw: string): string {
  if (!raw || raw === "-") return "(none)";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "(none)";
    return url.hostname.toLowerCase().slice(0, 120);
  } catch {
    return "(none)";
  }
}

export function agentClass(raw: string): string {
  if (/bot|spider|crawler|slurp|headless|lightpanda|playwright|puppeteer|selenium/i.test(raw)) return "declared automation";
  if (!raw) return "unknown";
  return "browser claim or unknown client";
}

function browserClaim(raw: string): string {
  if (/lightpanda/i.test(raw)) return "Lightpanda";
  if (/Edg\//.test(raw)) return "Edge claim";
  if (/Firefox\//.test(raw)) return "Firefox claim";
  if (/Chrome\//.test(raw)) return "Chrome claim";
  if (!raw) return "missing User-Agent";
  return "other User-Agent";
}

export function isPageCandidate(sample: RequestSample): boolean {
  if (sample.method !== "GET" || sample.status < 200 || sample.status >= 400) return false;
  let path: string;
  try { path = new URL(sample.path, "https://cuberoot.me").pathname; } catch { return false; }
  if (/^\/(?:zh\/|en\/)?(?:_next|_vercel|api|v1|tools|stats)(?:\/|$)/.test(path)) return false;
  return !/\.[a-z0-9]{1,8}$/i.test(path);
}

type Counts = { requests: number; pageCandidates: number; errors5xx: number; rateLimited429: number;
  maintenanceBlocked503: number; unclassified503: number; unexpected5xx: number; denied403: number; successfulResponses: number };
type Bucket = Counts & { routes: Map<string, number>; referrers: Map<string, number>; agents: Map<string, number> };
type SourceEvidence = {
  requests: number;
  pageCandidates: number;
  routes: Map<string, number>;
  referrers: Map<string, number>;
  browsers: Map<string, number>;
  minutes: Map<number, number>;
  declaredAutomation: number;
};

function sourceEvidence(): SourceEvidence {
  return { requests: 0, pageCandidates: 0, routes: new Map(), referrers: new Map(), browsers: new Map(), minutes: new Map(), declaredAutomation: 0 };
}

function bucket(): Bucket {
  return { requests: 0, pageCandidates: 0, errors5xx: 0, rateLimited429: 0,
    maintenanceBlocked503: 0, unclassified503: 0, unexpected5xx: 0, denied403: 0, successfulResponses: 0,
    routes: new Map(), referrers: new Map(), agents: new Map() };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
}

function top(map: Map<string, number>, limit = 10): Array<{ name: string; count: number }> {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
}

export class TrafficAccumulator {
  private readonly end: number;
  private readonly start: number;
  private readonly sourceBuckets = new Map<string, Bucket>();
  private readonly inputs = new Set<Source>();
  private readonly vercelIds = new Set<string>();
  private readonly nginxSources = new Map<string, SourceEvidence>();
  private readonly maintenanceNow: boolean | null;

  constructor(now = Date.now(), maintenanceNow: boolean | null = null) {
    this.maintenanceNow = maintenanceNow;
    this.end = Math.floor(now / HOUR) * HOUR;
    this.start = this.end - HOUR;
  }

  addInput(source: Source): void { this.inputs.add(source); }

  add(sample: RequestSample & { id?: string }): void {
    const { start, end, sourceBuckets } = this;
    if (sample.timestamp < start - 7 * 24 * HOUR || sample.timestamp >= end) return;
    if (sample.source === "vercel" && sample.id) {
      if (this.vercelIds.has(sample.id)) return;
      this.vercelIds.add(sample.id);
    }
    const hour = Math.floor(sample.timestamp / HOUR) * HOUR;
    const key = `${sample.source}:${hour}`;
    let current = sourceBuckets.get(key);
    if (!current) { current = bucket(); sourceBuckets.set(key, current); }
    current.requests += 1;
    if (sample.status >= 500 && sample.status < 600) current.errors5xx += 1;
    if (isMaintenanceResponse(sample)) current.maintenanceBlocked503 += 1;
    else if (sample.status === 503 && sample.maintenance === undefined) current.unclassified503 += 1;
    else if (sample.status >= 500 && sample.status < 600) current.unexpected5xx += 1;
    if (sample.status === 429) current.rateLimited429 += 1;
    if (sample.status === 403) current.denied403 += 1;
    if (sample.status >= 200 && sample.status < 400) current.successfulResponses += 1;
    if (sample.source === "api") increment(current.routes, apiRouteGroup(sample.path));
    if (sample.source === "nginx" && sample.timestamp >= start && sample.clientAddress && sample.clientAddress !== "-") {
      let evidence = this.nginxSources.get(sample.clientAddress);
      if (!evidence) { evidence = sourceEvidence(); this.nginxSources.set(sample.clientAddress, evidence); }
      evidence.requests++;
      if (isPageCandidate(sample)) {
        evidence.pageCandidates++;
        increment(evidence.routes, routeGroup(sample.path));
        increment(evidence.referrers, referrerDomain(sample.referrer));
        increment(evidence.browsers, browserClaim(sample.userAgent));
        increment(evidence.minutes, Math.floor(sample.timestamp / 60_000));
        if (agentClass(sample.userAgent) === "declared automation") evidence.declaredAutomation++;
      }
    }
    if (isPageCandidate(sample)) {
      current.pageCandidates += 1;
      increment(current.routes, routeGroup(sample.path));
      increment(current.referrers, referrerDomain(sample.referrer));
      increment(current.agents, agentClass(sample.userAgent));
    }
  }

  report() {
    const { start, end, sourceBuckets } = this;
    const rankedSources = [...this.nginxSources.values()].sort((a, b) => b.pageCandidates - a.pageCandidates || b.requests - a.requests);
    const topSources = rankedSources.slice(0, 10).map((entry, index) => {
      const peakMinute = Math.max(0, ...entry.minutes.values());
      const signal = entry.declaredAutomation > 0 ? "declared_automation"
        : entry.pageCandidates >= 60 && (entry.routes.size >= 20 || peakMinute >= 20) ? "suspected_automation"
        : "unverified";
      return {
        source: `source-${index + 1}`, requests: entry.requests, pageCandidates: entry.pageCandidates,
        distinctRouteGroups: entry.routes.size, peakPageCandidatesPerMinute: peakMinute, signal,
        declaredAutomationPageCandidates: entry.declaredAutomation,
        topRoutes: top(entry.routes, 3), topReferrers: top(entry.referrers, 3), browserClaims: top(entry.browsers, 3),
      };
    });
    const lines = (["nginx", "vercel", "api", "next"] as Source[]).map((source) => {
      const current = sourceBuckets.get(`${source}:${start}`) || bucket();
      const history = Array.from({ length: 7 }, (_, i) => {
        const previous = sourceBuckets.get(`${source}:${start - (i + 1) * 24 * HOUR}`);
        return previous ? (source === "api" ? previous.requests : previous.pageCandidates) : null;
      });
      const observed = history.filter((value): value is number => value !== null).sort((a, b) => a - b);
      const baseline = observed.length ? observed[Math.floor(observed.length / 2)] : null;
      const alerts: string[] = [];
      if (source === "api") {
        if (baseline !== null && current.requests >= 500 && current.requests >= 4 * Math.max(baseline, 1) && current.requests - baseline >= 500) alerts.push("api_requests_spike");
        if (current.rateLimited429 >= 10) alerts.push("rate_limited_high");
      } else if (baseline !== null && current.pageCandidates >= 100 && current.pageCandidates >= 4 * Math.max(baseline, 1) && current.pageCandidates - baseline >= 100) alerts.push("page_candidates_spike");
      // Only confirmed maintenance responses are excluded. Never infer a past
      // response's cause from the switch's current state or hide real 502/503s.
      const nonMaintenanceRequests = current.requests - current.maintenanceBlocked503;
      if (nonMaintenanceRequests >= 100 && current.unexpected5xx / nonMaintenanceRequests >= 0.05) alerts.push("server_errors_high");
      if (current.requests >= 100 && current.unclassified503 / current.requests >= 0.05) alerts.push("unclassified_503_high");
      if (current.maintenanceBlocked503 >= 100) alerts.push("maintenance_traffic");
      return {
        source, coverage: !this.inputs.has(source) ? "not_connected" : sourceBuckets.has(`${source}:${start}`) ? "observed" : "no_matching_requests",
        requests: current.requests, pageCandidates: current.pageCandidates, errors5xx: current.errors5xx, rateLimited429: current.rateLimited429,
        maintenanceBlocked503: current.maintenanceBlocked503, unclassified503: current.unclassified503, unexpected5xx: current.unexpected5xx,
        denied403: current.denied403, successfulResponses: current.successfulResponses,
        blockedRequests: current.maintenanceBlocked503 + current.rateLimited429 + current.denied403,
        baselineSameHourDays: observed.length,
        baselinePageCandidates: source === "api" ? null : baseline,
        baselineRequests: source === "api" ? baseline : null,
        alerts,
        topRoutes: top(current.routes), topReferrers: top(current.referrers), agentClasses: top(current.agents),
        ...(source === "nginx" ? { attribution: {
          loggedSourceAddresses: this.nginxSources.size,
          leadingSourceShareOfPageCandidates: current.pageCandidates ? Number(((rankedSources[0]?.pageCandidates || 0) / current.pageCandidates).toFixed(3)) : 0,
          topSources,
          note: "Source labels are temporary and contain no IP. The logged address may be a proxy. Browser strings can be spoofed. Unverified does not mean human.",
        } } : {}),
      };
    });
    return { windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), maintenanceNow: this.maintenanceNow,
      note: "Request counts are not unique visitors; pageCandidates are a URL heuristic, not Analytics page views.", sources: lines };
  }
}

/** Operator notification, deliberately separate from the machine-readable report. */
export function formatTrafficNotification(report: ReturnType<TrafficAccumulator["report"]>) {
  if (!report.sources.some(source => source.alerts.length)) return null;
  const sources = report.sources.filter(source => source.coverage === "observed");
  const formatTime = (iso: string) => new Date(Date.parse(iso) + 8 * HOUR).toISOString().slice(5, 16).replace("T", " ");
  const names: Record<Source, string> = { nginx: "阿里云主站", next: "预览入口", api: "数据接口", vercel: "Vercel" };
  const hasErrors = sources.some(source => source.alerts.includes("server_errors_high"));
  const unknown = sources.some(source => source.alerts.includes("unclassified_503_high"));
  const lines = [
    `统计：${formatTime(report.windowStart)} 至 ${formatTime(report.windowEnd)}（北京时间，整小时，非实时）。`,
    report.maintenanceNow === null ? "阿里云当前维护开关：未读取。"
      : report.maintenanceNow ? "阿里云当前对非中国大陆 IP 开启维护；中国大陆 IP 豁免。" : "阿里云当前维护开关已关闭。",
  ];
  for (const source of sources) {
    const n = (value: number) => value.toLocaleString("en-US");
    lines.push(`${names[source.source]}：收到 ${n(source.requests)} 次请求，确认拦截 ${n(source.blockedRequests)} 次，成功响应 ${n(source.successfulResponses)} 次。`);
    lines.push(`拦截明细：维护 ${n(source.maintenanceBlocked503)} 次，限流 ${n(source.rateLimited429)} 次，拒绝访问 ${n(source.denied403)} 次。`);
    if (source.maintenanceBlocked503) lines.push("维护拦截的请求未进入应用。");
    if (source.unexpected5xx) lines.push(`${source.unexpected5xx.toLocaleString("en-US")} 次非维护的服务错误，需要排查。`);
    if (source.unclassified503) lines.push(`${source.unclassified503.toLocaleString("en-US")} 次旧日志 503 缺少维护标记，原因待核对，不能直接算作应用故障。`);
    const other = source.requests - source.blockedRequests - source.successfulResponses - source.unclassified503 - source.unexpected5xx;
    if (other) lines.push(`其他响应 ${n(other)} 次（含 404、连接中断等，未计入确认拦截）。`);
    if (source.alerts.includes("api_requests_spike")) lines.push("请求量超过过去同一时段基线的 4 倍；这不代表都已放行或都是攻击。");
    if (source.alerts.includes("page_candidates_spike")) lines.push("成功页面请求明显增加，需核对来源。");
    const route = source.topRoutes[0]?.name;
    if (route) lines.push(`主要路径：${route}。`);
  }
  if (report.sources.some(source => source.source === "vercel" && source.coverage === "not_connected")) lines.push("此报告不包含 Vercel 流量；请求次数不等于访问人数。");
  return { title: hasErrors ? "CubeRoot 服务异常" : unknown ? "CubeRoot 访问情况待核对" : "CubeRoot 访问量提醒", body: lines.join("\n") };
}

export function summarize(samples: RequestSample[], now = Date.now()) {
  const accumulator = new TrafficAccumulator(now);
  for (const sample of samples) { accumulator.addInput(sample.source); accumulator.add(sample); }
  return accumulator.report();
}

async function* readLines(file: string): AsyncGenerator<string> {
  const input = createReadStream(file);
  const stream = file.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) yield line;
}

async function main(args: string[]): Promise<void> {
  const files: Array<{ source: Source; path: string }> = [];
  let now = Date.now();
  let maintenanceNow: boolean | null = null;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (["--nginx", "--next", "--api", "--vercel", "--now", "--maintenance-state"].includes(flag) && !args[index + 1]) throw new Error(`${flag} needs a value`);
    if (flag === "--nginx" || flag === "--next" || flag === "--api" || flag === "--vercel") files.push({ source: flag.slice(2) as Source, path: args[++index] });
    else if (flag === "--now") { now = Date.parse(args[++index]); if (!Number.isFinite(now)) throw new Error("Invalid --now timestamp"); }
    else if (flag === "--maintenance-state") {
      const state = readFileSync(args[++index], "utf8").trim();
      if (state !== "default 0;" && state !== "default 1;") throw new Error("Invalid maintenance state");
      maintenanceNow = state === "default 1;";
    }
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (files.length === 0) throw new Error("At least one --nginx, --next, --api or --vercel file is required");
  const accumulator = new TrafficAccumulator(now, maintenanceNow);
  for (const file of files) {
    accumulator.addInput(file.source);
    for await (const line of readLines(file.path)) {
      const sample = file.source === "vercel" ? parseVercelLine(line) : parseNginxLine(line, file.source);
      if (!sample) continue;
      accumulator.add(sample);
    }
  }
  const report = accumulator.report();
  console.log(JSON.stringify({ ...report, notification: formatTrafficNotification(report) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
