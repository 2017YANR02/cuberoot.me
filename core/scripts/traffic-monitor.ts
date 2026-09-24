import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export type Source = "nginx" | "vercel";
export type RequestSample = {
  source: Source;
  timestamp: number;
  path: string;
  status: number;
  method: string;
  referrer: string;
  userAgent: string;
};

const NGINX_LINE = /^\S+ \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;
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

export function parseNginxLine(line: string): RequestSample | null {
  const match = NGINX_LINE.exec(line);
  if (!match) return null;
  const timestamp = timestampFromNginx(match[1]);
  if (timestamp === null) return null;
  const [method, path] = match[2].split(" ");
  if (!method || !path) return null;
  return { source: "nginx", timestamp, method, path, status: Number(match[3]), referrer: match[4], userAgent: match[5] };
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
  if (/bot|spider|crawler|slurp|headless/i.test(raw)) return "self-declared bot";
  if (!raw) return "unknown";
  return "other";
}

export function isPageCandidate(sample: RequestSample): boolean {
  if (sample.method !== "GET" || sample.status < 200 || sample.status >= 400) return false;
  let path: string;
  try { path = new URL(sample.path, "https://cuberoot.me").pathname; } catch { return false; }
  if (/^\/(?:zh\/|en\/)?(?:_next|_vercel|api|v1|tools|stats)(?:\/|$)/.test(path)) return false;
  return !/\.[a-z0-9]{1,8}$/i.test(path);
}

type Counts = { requests: number; pageCandidates: number; errors5xx: number };
type Bucket = Counts & { routes: Map<string, number>; referrers: Map<string, number>; agents: Map<string, number> };

function bucket(): Bucket {
  return { requests: 0, pageCandidates: 0, errors5xx: 0, routes: new Map(), referrers: new Map(), agents: new Map() };
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
    if (isPageCandidate(sample)) {
      current.pageCandidates += 1;
      increment(current.routes, routeGroup(sample.path));
      increment(current.referrers, referrerDomain(sample.referrer));
      increment(current.agents, agentClass(sample.userAgent));
    }
  }

  report() {
  const { start, end, sourceBuckets } = this;
  const lines = (["nginx", "vercel"] as Source[]).map((source) => {
    const current = sourceBuckets.get(`${source}:${start}`) || bucket();
    const history = Array.from({ length: 7 }, (_, i) => sourceBuckets.get(`${source}:${start - (i + 1) * 24 * HOUR}`)?.pageCandidates ?? null);
    const observed = history.filter((value): value is number => value !== null).sort((a, b) => a - b);
    const baseline = observed.length ? observed[Math.floor(observed.length / 2)] : null;
    const alerts: string[] = [];
    if (baseline !== null && current.pageCandidates >= 100 && current.pageCandidates >= 4 * Math.max(baseline, 1) && current.pageCandidates - baseline >= 100) alerts.push("page_candidates_spike");
    if (current.requests >= 100 && current.errors5xx / current.requests >= 0.05) alerts.push("server_errors_high");
    return {
      source, coverage: !this.inputs.has(source) ? "not_connected" : sourceBuckets.has(`${source}:${start}`) ? "observed" : "no_matching_requests",
      requests: current.requests, pageCandidates: current.pageCandidates, errors5xx: current.errors5xx,
      baselineSameHourDays: observed.length, baselinePageCandidates: baseline, alerts,
      topRoutes: top(current.routes), topReferrers: top(current.referrers), agentClasses: top(current.agents),
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
    if (["--nginx", "--vercel", "--now"].includes(flag) && !args[index + 1]) throw new Error(`${flag} needs a value`);
    if (flag === "--nginx" || flag === "--vercel") files.push({ source: flag.slice(2) as Source, path: args[++index] });
    else if (flag === "--now") { now = Date.parse(args[++index]); if (!Number.isFinite(now)) throw new Error("Invalid --now timestamp"); }
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (files.length === 0) throw new Error("At least one --nginx or --vercel file is required");
  const accumulator = new TrafficAccumulator(now);
  for (const file of files) {
    accumulator.addInput(file.source);
    for await (const line of readLines(file.path)) {
      const sample = file.source === "nginx" ? parseNginxLine(line) : parseVercelLine(line);
      if (!sample) continue;
      accumulator.add(sample);
    }
  }
  console.log(JSON.stringify(accumulator.report(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
