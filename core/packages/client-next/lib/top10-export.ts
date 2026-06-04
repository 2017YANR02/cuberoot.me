// NOTE: Top 10 History 视频导出 — WebCodecs (H.264) + OffscreenCanvas + mp4-muxer
//   1080p / 30fps / 12Mbps,avc1.640033 (H.264 High Profile Level 5.1)
//   渲染逻辑独立于 React,纯 Canvas2D 重画 stage(banner / axis / 10 行 bars)
import { displayCuberName } from '@/lib/name-utils';
import { compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { formatWcaResult } from '@/lib/wca-format-result';
import { axisFor, tickLabel, type Metric } from '@/lib/top10-axis';
import { EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { COUNTRY_TO_CONTINENT, type Continent } from '@/lib/country-continents';

export type { Metric };

export interface PbEvent { d: string; p: string; v: number; c: string }
export interface PersonInfo { name: string; country: string; iso2: string | null }
export interface CompInfo { name: string }

const SHOW_N = 10;
const DAY_MS = 86400000;
const BAR_FRAC = 0.60;
const W = 1920;
const H = 1080;
const FPS = 30;
const BITRATE = 12_000_000;
const MAX_FRAMES = 30 * 60 * FPS; // 30 min hard cap

// === 颜色:rank 1 金色,其余按大洲 hue + 选手 ID 抖动亮度/饱和度(与页面一致) ===
const RANK1_COLOR = '#e9b341';
const CONTINENT_HUE: Record<Continent, number> = {
  'Asia': 0, 'Europe': 220, 'Africa': 30,
  'North America': 140, 'South America': 280, 'Oceania': 180,
  'Multiple Continents': 0,
};
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function colorForRow(pid: string, country: string | null | undefined, isRank1: boolean): string {
  if (isRank1) return RANK1_COLOR;
  const ph = hashStr(pid);
  const continent = country ? COUNTRY_TO_CONTINENT[country] : undefined;
  if (!continent || continent === 'Multiple Continents') {
    return `hsl(0 0% ${42 + ((ph >>> 0) % 16)}%)`;
  }
  const hue = CONTINENT_HUE[continent];
  const lightness = 42 + ((ph >>> 0) % 16);
  const saturation = 55 + ((ph >>> 4) % 20);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function isoToMs(iso: string): number { return new Date(iso + 'T00:00:00Z').getTime(); }
function msToIso(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

function findEventIdxByDate(events: PbEvent[], dateIso: string): number {
  let lo = 0, hi = events.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].d <= dateIso) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}


// === 国旗预加载 ===
//   Chromium 的 createImageBitmap 对 inline SVG data URL 不稳定(InvalidStateError)。
//   Image() 对某些 SVG(US/JP 等带 <use>/<defs>)在 await decode() 后仍可能 drawImage 是 no-op。
//   终极方案:fetch 文本 → 注入 width/height → 放进 HTMLImageElement(从 blob URL)→
//     立即光栅化到 HTMLCanvasElement(200×150) 作为 cache。
//   后续 OffscreenCanvas drawImage(HTMLCanvasElement) 100% 稳定。
const FLAG_RASTER_W = 256;
const FLAG_RASTER_H = 192;
async function loadFlagImages(isos: string[]): Promise<Map<string, HTMLCanvasElement>> {
  const cache = new Map<string, HTMLCanvasElement>();
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;width:1px;height:1px;';
  document.body.appendChild(probe);

  const urlByIso = new Map<string, string>();
  for (const raw of isos) {
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (urlByIso.has(lower)) continue;
    if (lower === 'tw') {
      urlByIso.set('tw', '/tools/assets/images/ChineseTaipei.svg');
      continue;
    }
    const span = document.createElement('span');
    span.className = `fi fi-${lower}`;
    span.style.cssText = 'display:inline-block;width:16px;height:12px;';
    probe.appendChild(span);
    const bg = getComputedStyle(span).backgroundImage;
    probe.removeChild(span);
    const m = bg.match(/url\(["']?(.+?)["']?\)/);
    if (m) urlByIso.set(lower, m[1]);
  }
  document.body.removeChild(probe);

  // Hidden DOM container — 把 Image 附加到 DOM,确保 SVG 的 <use>/<defs> 被解析
  const flagHost = document.createElement('div');
  flagHost.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;';
  document.body.appendChild(flagHost);

  const tasks = [...urlByIso.entries()].map(async ([iso, url]) => {
    let revoke: string | null = null;
    let img: HTMLImageElement | null = null;
    try {
      let finalUrl = url;
      if (url.startsWith('data:image/svg')) {
        const r = await fetch(url);
        let txt = await r.text();
        if (!/<svg[^>]*\swidth\s*=/.test(txt)) {
          const vb = txt.match(/viewBox\s*=\s*["']([^"']+)["']/);
          let w = 640, h = 480;
          if (vb) {
            const parts = vb[1].split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
              w = parts[2]; h = parts[3];
            }
          }
          txt = txt.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
        }
        // NOTE: Chromium 的 Image() decode SVG 时不支持 clip-path 引用(已知 bug),
        //   导致 JP/某些 KR/亚洲国旗变白。直接去掉 clip-path attr —
        //   国旗内容在 viewBox 外的部分会自然被 SVG 视口裁掉
        txt = txt.replace(/\sclip-path\s*=\s*["'][^"']*["']/g, '');
        const blob = new Blob([txt], { type: 'image/svg+xml' });
        finalUrl = URL.createObjectURL(blob);
        revoke = finalUrl;
      }
      img = new Image();
      img.src = finalUrl;
      img.style.cssText = `width:${FLAG_RASTER_W}px;height:${FLAG_RASTER_H}px;`;
      flagHost.appendChild(img);
      try { await img.decode(); } catch { /* fallback to load */ }
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise<void>((res, rej) => {
          img!.onload = () => res();
          img!.onerror = () => rej(new Error('img load fail'));
        });
      }
      // 给浏览器一帧时间完成 SVG <use> 引用解析
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const cv = document.createElement('canvas');
      cv.width = FLAG_RASTER_W;
      cv.height = FLAG_RASTER_H;
      const c = cv.getContext('2d');
      if (!c) return;
      c.drawImage(img, 0, 0, FLAG_RASTER_W, FLAG_RASTER_H);
      const px = c.getImageData(FLAG_RASTER_W >> 1, FLAG_RASTER_H >> 1, 1, 1).data;
      const empty = px[3] === 0 && px[0] === 0 && px[1] === 0 && px[2] === 0;
      if (empty) return;
      cache.set(iso, cv);
    } catch {
      // 单个国旗失败不阻断整体导出
    } finally {
      if (img) img.remove();
      if (revoke) URL.revokeObjectURL(revoke);
    }
  });
  await Promise.all(tasks);
  flagHost.remove();
  return cache;
}

// === Canvas2D 渲染 ===
type Ctx2D = OffscreenCanvasRenderingContext2D;

interface Top10Row { pid: string; v: number; c: string; d: string }
interface FrameParams {
  top10: Top10Row[];
  axis: { max: number; step: number; hideAxis: boolean };
  ticks: number[];
  top1Person: PersonInfo | null;
  top1DurationDays: number;
  dateIso: string;
  eventId: string;
  metric: Metric;
  metricLabel?: string;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
  isZh: boolean;
  flagCache: Map<string, HTMLCanvasElement>;
}

const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

function truncateText(ctx: Ctx2D, text: string, maxW: number): string {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function drawFlag(ctx: Ctx2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.drawImage(img, x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// NOTE: Chromium 对 flag-icons 部分 SVG(clipPath/use 引用)decode 失败,
//   draw 出来是空白。fallback:用低饱和灰底 + 大写 ISO2 占位
function drawFlagFallback(ctx: Ctx2D, iso2: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(h * 0.65)}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((iso2 || '').toUpperCase().slice(0, 2), x + w / 2, y + h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// NOTE: 所有像素尺寸按 1080p 设计,banner+axis+10行 = 1080 - 上下 padding
const PAD_TOP = 56;
const PAD_LEFT = 56;
const PAD_RIGHT = 56;
const RANK_W = 96;
const ROW_H = 76;
const BANNER_H = 150;
const BANNER_GAP = 28;
const AXIS_H = 36;
const HOLDER_FW = 150;
const HOLDER_FH = 100;
const BAR_H = 52;
const FLAG_W = 32;
const FLAG_H = 24;

function renderFrame(ctx: Ctx2D, p: FrameParams): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const stageX = PAD_LEFT;
  const stageW = W - PAD_LEFT - PAD_RIGHT;

  // === BANNER ===
  const bannerY = PAD_TOP;

  const hfx = stageX;
  const hfy = bannerY + (BANNER_H - HOLDER_FH) / 2;
  if (p.top1Person?.iso2) {
    const fimg = p.flagCache.get(p.top1Person.iso2.toLowerCase());
    if (fimg) drawFlag(ctx, fimg, hfx, hfy, HOLDER_FW, HOLDER_FH);
    else drawFlagFallback(ctx, p.top1Person.iso2, hfx, hfy, HOLDER_FW, HOLDER_FH);
  }

  // bigtitle 在右,先量它的宽度,再决定 holder text 可用宽度
  const tr = stageX + stageW;
  const eventNameZh = EVENT_ZH[p.eventId] || p.eventId;
  const eventNameEn = EVENT_EN[p.eventId] || p.eventId;
  const fallbackZh = p.metric === 'single' ? '单次'
    : p.metric === 'average' ? '平均'
    : p.metric.toUpperCase();
  const fallbackEn = p.metric === 'single' ? 'Singles'
    : p.metric === 'average' ? 'Avgs'
    : p.metric.toUpperCase();
  const ml = p.metricLabel ?? (p.isZh ? fallbackZh : fallbackEn);
  const titleText = p.isZh ? `${eventNameZh}${ml}` : `${eventNameEn} ${ml}`;

  ctx.fillStyle = '#ccc';
  ctx.font = `600 30px ${FONT_SANS}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(titleText, tr, bannerY + 12);

  ctx.fillStyle = '#fff';
  ctx.font = `700 88px ${FONT_MONO}`;
  ctx.fillText(p.dateIso, tr, bannerY + 56);
  const dateW = ctx.measureText(p.dateIso).width;
  const titleW = (() => {
    ctx.font = `600 30px ${FONT_SANS}`;
    return ctx.measureText(titleText).width;
  })();
  const rightBlockW = Math.max(dateW, titleW);

  // holder text
  const tx = stageX + HOLDER_FW + 24;
  const nameMaxW = (tr - rightBlockW - 48) - tx;
  if (p.top1Person) {
    const name = displayCuberName(p.top1Person.name, p.isZh);
    ctx.fillStyle = '#fff';
    ctx.font = `700 38px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, name, nameMaxW), tx, hfy + 16);

    const sub = p.isZh
      ? `保持纪录 ${p.top1DurationDays} 天`
      : `World record holder for ${p.top1DurationDays} days`;
    ctx.fillStyle = '#bbb';
    ctx.font = `400 22px ${FONT_SANS}`;
    ctx.fillText(truncateText(ctx, sub, nameMaxW), tx, hfy + 16 + 50);
  }

  // === AXIS ===
  const axisY = bannerY + BANNER_H + BANNER_GAP;
  const barsX = stageX + RANK_W;
  const barsAreaW = stageX + stageW - barsX;
  const barFracW = barsAreaW * BAR_FRAC;

  if (!p.axis.hideAxis) {
    ctx.fillStyle = '#999';
    ctx.font = `400 20px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of p.ticks) {
      const x = barsX + (v / p.axis.max) * barFracW;
      ctx.fillText(tickLabel(v, p.eventId, p.metric), x, axisY);
    }
  }

  // === BARS ===
  const barsY = axisY + AXIS_H;
  const barsTotalH = SHOW_N * ROW_H;

  // grid 无条件画(MBLD 等 hideAxis 也保留 0/25/50/75/100% 等分线)
  ctx.lineWidth = 1;
  for (const v of p.ticks) {
    const x = barsX + (v / p.axis.max) * barFracW;
    ctx.strokeStyle = v === 0 ? '#777' : '#444';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, barsY);
    ctx.lineTo(x + 0.5, barsY + barsTotalH);
    ctx.stroke();
  }

  for (let i = 0; i < p.top10.length; i++) {
    const row = p.top10[i];
    const rank = i;
    const isRank1 = rank === 0;
    const person = p.persons[row.pid];
    const comp = p.comps[row.c];
    const compNameRaw = comp?.name ?? row.c;
    const compName = localizeCompName(row.c, compNameRaw, p.isZh);
    const personName = person ? displayCuberName(person.name, p.isZh) : row.pid;
    const widthPx = (row.v / p.axis.max) * barFracW;
    const color = colorForRow(row.pid, person?.country, isRank1);
    const compIso = compFlagIso2(row.c);

    const rowY = barsY + rank * ROW_H;
    const rowCy = rowY + ROW_H / 2;

    // rank 数字
    ctx.fillStyle = '#fff';
    ctx.font = `800 36px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank + 1), barsX - 20, rowCy);

    // bar
    const barY = rowCy - BAR_H / 2;
    ctx.fillStyle = color;
    ctx.fillRect(barsX, barY, Math.max(0, widthPx), BAR_H);

    // bar 内右对齐:flag + name
    ctx.font = `700 22px ${FONT_SANS}`;
    const padR = 14;
    const gap = 10;
    const nameWidth = ctx.measureText(personName).width;
    const innerNeed = padR + FLAG_W + gap + nameWidth + padR;

    let barContentEndX: number;

    if (widthPx >= innerNeed) {
      // 内容能塞进 bar
      const nameRightX = barsX + widthPx - padR;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(personName, nameRightX, rowCy);
      const flagX = nameRightX - nameWidth - gap - FLAG_W;
      const flagY = rowCy - FLAG_H / 2;
      if (person?.iso2) {
        const fimg = p.flagCache.get(person.iso2.toLowerCase());
        if (fimg) drawFlag(ctx, fimg, flagX, flagY, FLAG_W, FLAG_H);
        else drawFlagFallback(ctx, person.iso2, flagX, flagY, FLAG_W, FLAG_H);
      }
      barContentEndX = barsX + widthPx;
    } else {
      // bar 太短,内容画在 bar 外右侧
      const startX = barsX + widthPx + 10;
      const flagY = rowCy - FLAG_H / 2;
      let cur = startX;
      if (person?.iso2) {
        const fimg = p.flagCache.get(person.iso2.toLowerCase());
        if (fimg) drawFlag(ctx, fimg, cur, flagY, FLAG_W, FLAG_H);
        else drawFlagFallback(ctx, person.iso2, cur, flagY, FLAG_W, FLAG_H);
        cur += FLAG_W + gap;
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(personName, cur, rowCy);
      barContentEndX = cur + nameWidth;
    }

    // value(bar 之后)
    let cursorX = barContentEndX + 14;
    ctx.fillStyle = '#fff';
    ctx.font = `700 22px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const valueText = formatWcaResult(row.v, p.eventId, p.metric === 'single' ? 'single' : 'average');
    ctx.fillText(valueText, cursorX, rowCy);
    cursorX += ctx.measureText(valueText).width + 16;

    // comp
    if (compIso) {
      const cimg = p.flagCache.get(compIso.toLowerCase());
      if (cimg) drawFlag(ctx, cimg, cursorX, rowCy - FLAG_H / 2, FLAG_W, FLAG_H);
      else drawFlagFallback(ctx, compIso, cursorX, rowCy - FLAG_H / 2, FLAG_W, FLAG_H);
      cursorX += FLAG_W + 12;
    }
    ctx.fillStyle = '#ddd';
    ctx.font = `400 20px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxCompW = stageX + stageW - cursorX;
    ctx.fillText(truncateText(ctx, compName, maxCompW), cursorX, rowCy);
  }
}

// === 主导出函数 ===
export interface ExportProgress {
  phase: string;
  pct: number;
  framesDone: number;
  framesTotal: number;
}
export interface ExportOptions {
  events: PbEvent[];
  eventId: string;
  metric: Metric;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
  startMs: number;
  endMs: number;
  mode: 'time' | 'pb';
  speed: number;
  rankChangeDates: string[];
  isZh: boolean;
  abortRef: { aborted: boolean };
  onProgress?: (p: ExportProgress) => void;
  /** 可选:实时预览画布 — 每帧编码后会同步绘制到此 canvas */
  previewCanvas?: HTMLCanvasElement | null;
  /** 父组件传入的 metric 短名(与左侧 metric selector 一致),如 "BAo5"/"中位数" */
  metricLabel?: string;
}

export async function exportTop10Video(opts: ExportOptions): Promise<void> {
  const { events, eventId, metric, persons, comps, startMs, endMs, mode, speed,
    rankChangeDates, isZh, abortRef, onProgress, previewCanvas, metricLabel } = opts;

  // 预览 ctx(每 N 帧 drawImage 到外部 canvas,UX + 调试用)
  let previewCtx: CanvasRenderingContext2D | null = null;
  if (previewCanvas) {
    previewCanvas.width = W;
    previewCanvas.height = H;
    previewCtx = previewCanvas.getContext('2d');
  }

  if (typeof VideoEncoder === 'undefined') {
    throw new Error(isZh ? '浏览器不支持 WebCodecs(需 Chrome / Edge / Safari 16.4+)' : 'Browser does not support WebCodecs');
  }
  if (events.length === 0) throw new Error('no events');

  // 1. 帧数
  let totalFrames: number;
  if (mode === 'time') {
    const days = (endMs - startMs) / DAY_MS;
    totalFrames = Math.max(1, Math.ceil(days / speed * FPS));
  } else {
    totalFrames = Math.max(1, rankChangeDates.length * FPS);
  }
  if (totalFrames > MAX_FRAMES) totalFrames = MAX_FRAMES;

  // 2. 国旗预加载 — 收集所有 events 涉及的 iso2 并 fetch SVG → ImageBitmap
  onProgress?.({ phase: isZh ? '加载国旗...' : 'Loading flags...', pct: 0, framesDone: 0, framesTotal: totalFrames });
  const isoSet = new Set<string>();
  for (const e of events) {
    const pi = persons[e.p];
    if (pi?.iso2) isoSet.add(pi.iso2.toLowerCase());
    const ci = compFlagIso2(e.c);
    if (ci) isoSet.add(ci.toLowerCase());
  }
  const flagCache = await loadFlagImages([...isoSet]);
  if (abortRef.aborted) throw new Error('aborted');

  // 3. mp4-muxer + VideoEncoder
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e instanceof Error ? e : new Error(String(e)); },
  });
  encoder.configure({
    codec: 'avc1.640033',
    width: W,
    height: H,
    bitrate: BITRATE,
    framerate: FPS,
  });

  // 4. 渲染 + 编码循环
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    try { encoder.close(); } catch { /* ignore */ }
    throw new Error('OffscreenCanvas 2d unavailable');
  }

  // 增量推进 state(避免每帧 O(events) 重 replay)
  const state = new Map<string, { v: number; c: string; d: string }>();
  let curIdx = -1;
  let top1Pid: string | null = null;
  let top1V = Infinity;
  let top1Since: string | null = null;

  const advanceTo = (target: number) => {
    while (curIdx < target) {
      curIdx++;
      const e = events[curIdx];
      state.set(e.p, { v: e.v, c: e.c, d: e.d });
      if (e.v < top1V) {
        if (e.p !== top1Pid) top1Since = e.d;
        top1Pid = e.p;
        top1V = e.v;
      }
    }
  };

  const encodeStartTs = performance.now();
  let lastProgressTs = encodeStartTs;

  try {
    for (let f = 0; f < totalFrames; f++) {
      if (abortRef.aborted) throw new Error('aborted');
      if (encoderError) throw encoderError;

      // 帧 → 日期
      let frameDateMs: number;
      if (mode === 'time') {
        frameDateMs = startMs + (f / FPS) * speed * DAY_MS;
        if (frameDateMs > endMs) frameDateMs = endMs;
      } else {
        const idx = Math.min(rankChangeDates.length - 1, Math.floor(f / FPS));
        frameDateMs = isoToMs(rankChangeDates[idx]);
      }
      const dateIso = msToIso(Math.floor(frameDateMs));
      const targetEvIdx = findEventIdxByDate(events, dateIso);
      if (targetEvIdx >= 0) advanceTo(targetEvIdx);

      // top10
      const top10 = [...state.entries()]
        .map(([pid, st]) => ({ pid, ...st }))
        .sort((a, b) => a.v - b.v || a.d.localeCompare(b.d))
        .slice(0, SHOW_N);

      const axisMaxV = top10.length > 0 ? top10[top10.length - 1].v : 1000;
      const axis = axisFor(eventId, metric, axisMaxV);
      const ticks: number[] = [];
      if (axis.hideAxis) {
        // MBLD 等隐藏文字刻度的项目仍画 0/25/50/75/100% 等分 grid
        for (let i = 0; i <= 4; i++) ticks.push((i * axis.max) / 4);
      } else {
        for (let v = 0; v <= axis.max; v += axis.step) ticks.push(v);
      }

      const top1Person = top1Pid ? persons[top1Pid] ?? null : null;
      const top1DurationDays = top1Since
        ? Math.max(0, Math.floor((isoToMs(dateIso) - isoToMs(top1Since)) / DAY_MS))
        : 0;

      renderFrame(ctx, {
        top10, axis, ticks, top1Person, top1DurationDays,
        dateIso, eventId, metric, metricLabel, persons, comps, isZh, flagCache,
      });

      const ts = Math.round(f * 1e6 / FPS);
      const vf = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / FPS) });
      const isKey = f % 60 === 0;
      encoder.encode(vf, { keyFrame: isKey });
      vf.close();

      // 预览(每 5 帧一次,避免阻塞)
      if (previewCtx && (f % 5 === 0 || f === totalFrames - 1)) {
        previewCtx.drawImage(canvas, 0, 0);
      }

      // backpressure:encoder 队列满时让步
      while (encoder.encodeQueueSize > 4 && !abortRef.aborted) {
        await new Promise<void>(r => setTimeout(r, 0));
      }

      // 进度
      const now = performance.now();
      if (now - lastProgressTs > 200 || f === totalFrames - 1) {
        lastProgressTs = now;
        const elapsed = (now - encodeStartTs) / 1000;
        const fps = (f + 1) / Math.max(0.1, elapsed);
        const eta = (totalFrames - f - 1) / Math.max(1, fps);
        const pct = (f + 1) / totalFrames;
        const pctTxt = (pct * 100).toFixed(0);
        onProgress?.({
          phase: isZh
            ? `编码中 ${pctTxt}% · ${fps.toFixed(0)} fps · 剩 ${eta.toFixed(0)}s`
            : `Encoding ${pctTxt}% · ${fps.toFixed(0)} fps · ETA ${eta.toFixed(0)}s`,
          pct, framesDone: f + 1, framesTotal: totalFrames,
        });
        await new Promise<void>(r => setTimeout(r, 0));
      }
    }

    onProgress?.({
      phase: isZh ? '正在封装 mp4...' : 'Finalizing mp4...',
      pct: 1, framesDone: totalFrames, framesTotal: totalFrames,
    });
    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();
  } catch (e) {
    try { encoder.close(); } catch { /* ignore */ }
    throw e;
  }

  if (abortRef.aborted) throw new Error('aborted');

  // 5. 下载
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tsTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `top10_${eventId}_${metric}_${mode}_${tsTag}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
