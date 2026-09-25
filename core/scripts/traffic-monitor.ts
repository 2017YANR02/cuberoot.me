import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export type Source = "nginx" | "api" | "vercel";
export type RequestSample = {
  source: Source;
  clientAddress?: string;
  timestamp: number;
  path: string;
  status: number;
  method: string;
  referrer: string;
  userAgent: string;
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

export function parseNginxLine(line: string, source: "nginx" | "api" = "nginx"): RequestSample | null {
  const match = NGINX_LINE.exec(line);
  if (!match) return null;
  const timestamp = timestampFromNginx(match[2]);
  if (timestamp === null) return null;
  const [method, path] = match[3].split(" ");
  if (!method || !path) return null;
  return { source, clientAddress: match[1], timestamp, method, path, status: Number(match[4]), referrer: match[5], userAgent: match[6] };
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

type Counts = { requests: number; pageCandidates: number; errors5xx: number; rateLimited429: number };
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
  return { requests: 0, pageCandidates: 0, errors5xx: 0, rateLimited429: 0, routes: new Map(), referrers: new Map(), agents: new Map() };
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

  constructor(now = Date.now()) {
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
    if (sample.status === 429) current.rateLimited429 += 1;
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
    const lines = (["nginx", "vercel", "api"] as Source[]).map((source) => {
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
      if (current.requests >= 100 && current.errors5xx / current.requests >= 0.05) alerts.push("server_errors_high");
      return {
        source, coverage: !this.inputs.has(source) ? "not_connected" : sourceBuckets.has(`${source}:${start}`) ? "observed" : "no_matching_requests",
        requests: current.requests, pageCandidates: current.pageCandidates, errors5xx: current.errors5xx, rateLimited429: current.rateLimited429,
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
    return { windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), note: "Request counts are not unique visitors; pageCandidates are a URL heuristic, not Analytics page views.", sources: lines };
  }
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
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (["--nginx", "--api", "--vercel", "--now"].includes(flag) && !args[index + 1]) throw new Error(`${flag} needs a value`);
    if (flag === "--nginx" || flag === "--api" || flag === "--vercel") files.push({ source: flag.slice(2) as Source, path: args[++index] });
    else if (flag === "--now") { now = Date.parse(args[++index]); if (!Number.isFinite(now)) throw new Error("Invalid --now timestamp"); }
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (files.length === 0) throw new Error("At least one --nginx, --api or --vercel file is required");
  const accumulator = new TrafficAccumulator(now);
  for (const file of files) {
    accumulator.addInput(file.source);
    for await (const line of readLines(file.path)) {
      const sample = file.source === "vercel" ? parseVercelLine(line) : parseNginxLine(line, file.source);
      if (!sample) continue;
      accumulator.add(sample);
    }
  }
  console.log(JSON.stringify(accumulator.report(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
