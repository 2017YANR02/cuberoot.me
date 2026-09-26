import { open, readFile, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseNginxLine, isPageCandidate, isMaintenanceResponse, type RequestSample } from "./traffic-monitor.ts";

const exec = promisify(execFile);
const MINUTE = 60_000;
const STATE = "/etc/nginx/cuberoot-maintenance-state.conf";
const LOGS = {
  nginx: "/www/wwwlogs/www.cuberoot.me.log",
  next: "/www/wwwlogs/next.cuberoot.me.log",
  api: "/www/wwwlogs/api.cuberoot.me.log",
} as const;

type Minute = { requests: number; pages: number; errors: number; limited: number; maintenance: number; denied: number; exempt: number };
const blank = (): Minute => ({ requests: 0, pages: 0, errors: 0, limited: 0, maintenance: 0, denied: 0, exempt: 0 });
type Window = { web: Minute[]; api: Minute[] };

export function evaluate(samples: RequestSample[], now = Date.now()): { window: Window; reasons: string[] } {
  const current = Math.floor(now / MINUTE) * MINUTE;
  const window: Window = { web: [blank(), blank()], api: [blank(), blank()] };
  const restricted: Window = { web: [blank(), blank()], api: [blank(), blank()] };
  for (const sample of samples) {
    const age = Math.floor((current - sample.timestamp - 1) / MINUTE);
    if (age < 0 || age > 1) continue;
    const item = (sample.source === "api" ? window.api : window.web)[age];
    if (sample.cnExempt) item.exempt++;
    const rows = sample.cnExempt ? [item] : [item, restricted[sample.source === "api" ? "api" : "web"][age]];
    for (const item of rows) {
      item.requests++;
      // A maintenance response in the previous minute remains expected even
      // after reopening. Keep its traffic count, but don't retrip the site.
      if (isMaintenanceResponse(sample)) { item.maintenance++; continue; }
      if (sample.status >= 500 && sample.status < 600 && !sample.path.startsWith("/_vercel/insights/")) item.errors++;
      if (sample.status === 429) item.limited++;
      if (sample.status === 403) item.denied++;
      if (sample.source !== "api" && isPageCandidate(sample)) item.pages++;
    }
  }
  const [webLast, webPrev] = restricted.web;
  const [apiLast, apiPrev] = restricted.api;
  const reasons: string[] = [];
  // Keep the emergency page threshold above nginx's 600/minute + 30 burst.
  // 429s remain visible in the report, but blocked requests alone must not
  // turn a working limiter into a whole-site shutdown.
  const webLastAdmitted = webLast.requests - webLast.limited - webLast.maintenance - webLast.denied;
  const webPrevAdmitted = webPrev.requests - webPrev.limited - webPrev.maintenance - webPrev.denied;
  const apiLastAdmitted = apiLast.requests - apiLast.limited - apiLast.maintenance - apiLast.denied;
  const apiPrevAdmitted = apiPrev.requests - apiPrev.limited - apiPrev.maintenance - apiPrev.denied;
  if (webLast.pages >= 1_000 || (webLast.pages >= 800 && webPrev.pages >= 800)) reasons.push("web_page_spike");
  if (webLastAdmitted >= 4_000 || (webLastAdmitted >= 1_500 && webPrevAdmitted >= 1_500)) reasons.push("web_request_spike");
  if (apiLastAdmitted >= 4_000 || (apiLastAdmitted >= 1_200 && apiPrevAdmitted >= 1_200)) reasons.push("api_request_spike");
  if (webLast.errors >= 100 || (webLast.errors >= 40 && webPrev.errors >= 40)) reasons.push("web_5xx_spike");
  if (apiLast.errors >= 100 || (apiLast.errors >= 40 && apiPrev.errors >= 40)) reasons.push("api_5xx_spike");
  return { window, reasons };
}

export function formatGuardAlert(result: ReturnType<typeof evaluate>, now = Date.now()): string {
  const labels: Record<string, string> = {
    web_page_spike: "成功页面请求过多", web_request_spike: "主站和预览入口未被拦截的请求过多",
    api_request_spike: "数据接口未被拦截的请求过多", web_5xx_spike: "主站或预览入口服务错误过多",
    api_5xx_spike: "数据接口服务错误过多",
  };
  const end = Math.floor(now / MINUTE) * MINUTE;
  const time = (value: number) => new Date(value + 8 * 3_600_000).toISOString().slice(5, 16).replace("T", " ");
  const lines = ["已将阿里云主站、预览入口和数据接口的非中国大陆访问切换为维护；中国大陆 IP 继续开放。",
    `原因：${result.reasons.map(reason => labels[reason] || "达到保护阈值").join("；")}。`,
    `停站前统计：${time(end - 2 * MINUTE)} 至 ${time(end)}（北京时间，两个完整分钟）。`];
  for (const [key, label] of [["web", "主站及预览入口"], ["api", "数据接口"]] as const) {
    const rows = result.window[key];
    const sum = (field: keyof Minute) => rows.reduce((n, row) => n + row[field], 0);
    lines.push(`${label}：收到 ${sum("requests")} 次，记录到拦截 ${sum("limited") + sum("maintenance") + sum("denied")} 次（维护 ${sum("maintenance")}、限流 ${sum("limited")}、拒绝访问 ${sum("denied")}），其他 5xx ${sum("errors")} 次；中国大陆豁免 ${sum("exempt")} 次。`);
  }
  lines.push("中国大陆豁免请求不参与自动停站判断。此操作不包含 Vercel；受限地区不会自动恢复，请核查后手动恢复。");
  return lines.join("\n");
}

async function tail(file: string, maxBytes = 32 * 1024 * 1024): Promise<string[]> {
  const handle = await open(file, "r");
  try {
    const size = (await handle.stat()).size;
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    const text = buffer.toString("utf8");
    return (start ? text.slice(text.indexOf("\n") + 1) : text).split("\n");
  } finally { await handle.close(); }
}

async function alert(message: string): Promise<void> {
  const key = process.env.BARK_KEY;
  if (!key) return;
  const body = new URLSearchParams({ title: "CubeRoot 自动停站", body: message, group: "cuberoot-monitor" });
  const response = await fetch(`https://api.day.app/${encodeURIComponent(key)}`, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Bark HTTP ${response.status}`);
}

async function trip(reasons: string[], message: string): Promise<void> {
  const previous = await readFile(STATE, "utf8");
  if (previous.trim() === "default 1;") return;
  if (previous.trim() !== "default 0;") throw new Error("Unexpected maintenance state; refusing to edit");
  const temporary = `${STATE}.${process.pid}.tmp`;
  await writeFile(temporary, "default 1;\n", { mode: 0o600 });
  await rename(temporary, STATE);
  try {
    await exec("nginx", ["-t"], { timeout: 10_000 });
    await exec("nginx", ["-s", "reload"], { timeout: 10_000 });
  } catch (error) {
    await writeFile(STATE, previous, { mode: 0o600 });
    throw error;
  }
  console.error(`traffic guard tripped: ${reasons.join(",")}`);
  await alert(message).catch(error => console.error(`alert failed: ${error}`));
}

async function main(): Promise<void> {
  const now = Date.now();
  const samples: RequestSample[] = [];
  for (const [source, file] of Object.entries(LOGS) as Array<[keyof typeof LOGS, string]>) {
    for (const line of await tail(file)) {
      const sample = parseNginxLine(line, source);
      if (sample && sample.timestamp >= now - 3 * MINUTE) samples.push(sample);
    }
  }
  const result = evaluate(samples, now);
  const maintenance = (await readFile(STATE, "utf8")).trim() === "default 1;";
  // Maintenance responses are expected 503s, not evidence of a new outage.
  if (maintenance) result.reasons = [];
  console.log(JSON.stringify({ at: new Date(now).toISOString(), maintenance, ...result }));
  if (!maintenance && process.argv.includes("--apply") && result.reasons.length) await trip(result.reasons, formatGuardAlert(result, now));
}

if (process.argv[1]?.endsWith("traffic-guard.ts")) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
