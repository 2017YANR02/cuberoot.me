/**
 * snap4k.ts — 4K 网格贴合 sidecar 生成 (dump 后处理, v2 多关键帧)。
 *
 * 正⑱系列确认 v1/v3 残差主因是晶格脱靶 (半格至一格半, 飘上外套/背景), 而 4K 原片
 * 连拧转中帧都保留锐利块边界 (100fps 快门; 无贴纸魔方无黑缝, 边界 = 颜色跳变,
 * 黑缝探针 960p/4K AUC 均 ≈0.5 的死因是特征前提不成立, 非分辨率/模糊墙)。
 * v1 (单中帧常量修正) 记分板 35/4/18/1/5, 首次全视频齐涨; v2 升级: 链内漂移是
 * 已知最大残余 (链尺度 |Δ|p50 0.5-1.0 格), 每链取 3-5 关键帧独立贴合, 中位数
 * 剔离群后输出 keys 序列, real-eval --snapfix 按帧线性插值。
 *
 * 贴合目标 (每关键帧): 8 条格线「跨线跳变中位数」均值 (中位数杀蹭剪影投机:
 * 真格线整条大部分点有跳变) + 九格 kNN 非毒率 (4K 域普查池, LOO, 专治外套绿
 * 破整格周期错位) − 轻离先验惩罚。粗搜 ±1.5 格步 0.15 → 细搜 ±0.12 步 0.03。
 * 普查相关性验证 (snap-probe): 毒0格帧 |Δ|p50≈0.22, 毒≥3格帧 |Δ|p50≈1.1, 单调。
 *
 * 帧提取 = ffmpeg 流式解码 (select=between → stdout rawvideo, 零磁盘缓存;
 * eq() 列表 ~100 项会解析崩, between 区间无此限)。普查池特征缓存
 * .tmp/snap4k-pool.json (--repool 强制重建)。
 *
 * 输出仅 sidecar: {name: [{f0,f1,cx,cy,keys:[[f,dx,dy],...]}]}, 不改 dump —
 * dump 直改 read 会让 gt/混淆失配 (gt 是按旧读数 bestAssign 拟合的对齐, 窗口
 * 挪过格后 facelet 映射已变, 实测新读 vs 旧 gt 假性 27-41%), 必须回 real-eval
 * 重拟合 (--hdres + --snapfix)。
 *
 * 用法: npx tsx scripts/snap4k.ts --sidecar .tmp/snap-side2.json
 *       [--dump .tmp/obs-geo.json] [--video 1] [--repool]
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const DUMP = argAt("--dump") ?? ".tmp/obs-geo.json";
const SIDE = argAt("--sidecar");
const ONLY = argAt("--video");
const REPOOL = process.argv.includes("--repool");
if (!SIDE) throw new Error("--sidecar <path> 必填 (v2 起只产 sidecar, 不改 dump)");
const W = 3840, H = 2160, SC = 4, FB = W * H * 3;
const ROOT = join(import.meta.dirname, "..");
const POOL_CACHE = join(ROOT, ".tmp", "snap4k-pool.json");

type Chain = {
  read: (string | null)[];
  basis: [number, number, number, number]; cx: number; cy: number; pitch: number;
  f0: number; f1: number;
};
const dump = JSON.parse(readFileSync(join(ROOT, DUMP), "utf8")) as {
  videos: { name: string; bounds: Chain[][] }[];
};

// ── 4K 帧流式提取 (升序 wanted, 逐帧回调; 帧缓冲复用, 回调内同步消费) ────────
async function streamFrames(
  name: string, wanted: Iterable<number>, cb: (f: number, fr: Uint8Array) => void,
): Promise<void> {
  const need = [...new Set(wanted)].sort((a, b) => a - b);
  if (!need.length) return;
  const f0 = need[0], f1 = need[need.length - 1];
  const needSet = new Set(need);
  const proc = spawn("ffmpeg", [
    "-hide_banner", "-v", "error", "-threads", "14",
    "-i", join(ROOT, "videos", name),
    "-vf", `select=between(n\\,${f0}\\,${f1}),scale=${W}:${H}`,
    "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  const fbuf = Buffer.allocUnsafe(FB);
  let fi = f0, off = 0;
  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    let cOff = 0;
    while (cOff < chunk.length) {
      const n = Math.min(FB - off, chunk.length - cOff);
      chunk.copy(fbuf, off, cOff, cOff + n);
      off += n; cOff += n;
      if (off === FB) {
        if (needSet.has(fi)) cb(fi, new Uint8Array(fbuf.buffer, fbuf.byteOffset, FB));
        fi++; off = 0;
      }
    }
  }
  await new Promise<void>((res, rej) => {
    proc.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code} on ${name}`))));
  });
  if (fi <= f1) throw new Error(`ffmpeg 流提前结束: ${name} 到帧 ${fi}, 需要 ${f1}`);
}

const midOf = (c: Chain) => (c.f0 + c.f1) >> 1;
// 默认只取中帧 (生产验证路径)。--multikey 开链内多关键帧 — 已测三变体全负
// (2026-07-12): 边缘键插值 v5 5→437, 缩进+中帧锚插值 v1 35→415, 内点均值常量
// v5 5→467; 机制 = ① 插值让链内采样位置亚格摆动, 跨 0.5 格舍入边界时链共识
// 混入错位窗口拼接读数 ("似是而非"毒); ② 非中帧本身贴合噪声 > 链内漂移信号
// (v5 最快把, 离中帧越远越糊)。链内漂移 p50≈0.5 格是真实的, 但当前目标函数
// 精度吃不到它 — 别再直接重试, 除非贴合目标本身先升级。
const MULTIKEY = process.argv.includes("--multikey");
// 仿射贴合: 平移最优后对 (θ, 缩放) 坐标下降 (M = s·R(θ) 作用于链基, 每链常量,
// 只在中帧测 — v2 教训: 时间维不可碰, 常量安全)。攻的是负⑪遗留的另一轴:
// 冷拟合基角/pitch 失配, 平移修不动
const AFFINE = process.argv.includes("--affine");
const keyframesOf = (c: Chain): number[] => {
  const span = c.f1 - c.f0, mid = midOf(c);
  if (!MULTIKEY || span < 6) return [mid];
  const inset = Math.max(1, Math.round(span * 0.22));
  const a = c.f0 + inset, b = c.f1 - inset;
  if (span < 14) return [...new Set([a, mid, b])];
  return [...new Set([a, (a + mid) >> 1, mid, (mid + b) >> 1, b])];
};

// ── 像素采样 ────────────────────────────────────────────────────────────────
const rgbAt = (fr: Uint8Array, x: number, y: number, out: number[]) => {
  let r = 0, g = 0, b = 0, n = 0;
  const xi = Math.round(x), yi = Math.round(y);
  for (let yy = yi - 1; yy <= yi + 1; yy++) {
    for (let xx = xi - 1; xx <= xi + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 3;
      r += fr[p]; g += fr[p + 1]; b += fr[p + 2]; n++;
    }
  }
  out[0] = n ? r / n : -1; out[1] = n ? g / n : -1; out[2] = n ? b / n : -1;
};
const med3: number[][] = [[], [], []];
const blockMedRGB = (fr: Uint8Array, x: number, y: number, rad: number, out: number[]) => {
  med3[0].length = med3[1].length = med3[2].length = 0;
  for (let yy = Math.round(y - rad); yy <= y + rad; yy += 4) {
    for (let xx = Math.round(x - rad); xx <= x + rad; xx += 4) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 3;
      med3[0].push(fr[p]); med3[1].push(fr[p + 1]); med3[2].push(fr[p + 2]);
    }
  }
  if (med3[0].length < 8) { out[0] = -1; return; }
  for (let c = 0; c < 3; c++) {
    med3[c].sort((a, b) => a - b);
    out[c] = med3[c][med3[c].length >> 1];
  }
};
const qa = [0, 0, 0], qb = [0, 0, 0];
const diffAt = (fr: Uint8Array, x1: number, y1: number, x2: number, y2: number) => {
  rgbAt(fr, x1, y1, qa); rgbAt(fr, x2, y2, qb);
  if (qa[0] < 0 || qb[0] < 0) return 0;
  return Math.min(150, Math.abs(qa[0] - qb[0]) + Math.abs(qa[1] - qb[1]) + Math.abs(qa[2] - qb[2]));
};

// ── kNN 池 (4K 域: 普查格按原格心在 4K 帧重采 RGB; 特征缓存跨 run 复用) ─────
const feat = (r: number, g: number, b: number): number[] => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const s = mx ? ((mx - mn) / mx) * 255 : 0;
  let h = 0;
  if (mx > mn) {
    if (mx === r) h = (60 * (g - b)) / (mx - mn);
    else if (mx === g) h = 120 + (60 * (b - r)) / (mx - mn);
    else h = 240 + (60 * (r - g)) / (mx - mn);
    if (h < 0) h += 360;
  }
  return [h / 2, s, mx, r, g, b];
};
type PoolRow = { v: string; bad: number; color: string | null; f: number[] };
let pool: PoolRow[] = [];

async function buildPool(): Promise<void> {
  // 输入指纹: census 源 + dump 路径/内容变了自动重建 (审查实锤的静默陈旧坑)
  const censusSrc = readFileSync(join(import.meta.dirname, "vlm-patch-dump.cjs"), "utf8");
  const sig = createHash("sha1")
    .update(censusSrc).update("\0").update(DUMP).update("\0")
    .update(readFileSync(join(ROOT, DUMP)))
    .digest("hex");
  if (!REPOOL && existsSync(POOL_CACHE)) {
    const c = JSON.parse(readFileSync(POOL_CACHE, "utf8")) as { sig?: string; rows?: PoolRow[] };
    if (c.sig === sig && c.rows?.length) { pool = c.rows; return; }
  }
  const censusOf = (vid: string): { bound: number; ci: number; cells: string }[] => {
    const block = censusSrc.split(`"${vid}": \``)[1]?.split("`")[0];
    if (!block) return [];
    const out: { bound: number; ci: number; cells: string }[] = [];
    for (const line of block.trim().split("\n")) {
      const m = line.match(/^g-(\d+)-(\d+)-f\d+\.png [A-E] (\S{9})/);
      if (m) out.push({ bound: +m[1], ci: +m[2], cells: m[3] });
    }
    return out;
  };
  for (const vid of ["1", "3"]) {
    const census = censusOf(vid);
    if (!census.length) continue;
    const v = dump.videos.find((x) => x.name.startsWith(vid));
    if (!v) throw new Error(`普查池需 v${vid} 在 dump 内 (用全 5 视频 dump 建池)`);
    // 中帧 → 该帧上的普查链列表
    const byFrame = new Map<number, { ch: Chain; cells: string }[]>();
    for (const { bound, ci, cells } of census) {
      const ch = v.bounds[bound]?.[ci];
      if (!ch) continue;
      const f = midOf(ch);
      (byFrame.get(f) ?? byFrame.set(f, []).get(f)!).push({ ch, cells });
    }
    await streamFrames(v.name, byFrame.keys(), (f, fr) => {
      for (const { ch, cells } of byFrame.get(f)!) {
        const [v1x, v1y, v2x, v2y] = ch.basis.map((z) => z * SC);
        for (let c = 0; c < 9; c++) {
          const lab = cells[c];
          const bad = lab === "J" || lab === "S" || lab === "." ? 1 : "WRGYOB".includes(lab) ? 0 : -1;
          if (bad < 0) continue;
          const a = (c % 3) - 1, b = ((c / 3) | 0) - 1;
          blockMedRGB(fr, ch.cx * SC + a * v1x + b * v2x, ch.cy * SC + a * v1y + b * v2y, ch.pitch * SC * 0.2, qa);
          if (qa[0] < 0) continue;
          pool.push({ v: vid, bad, color: bad ? null : lab, f: feat(qa[0], qa[1], qa[2]) });
        }
      }
    });
  }
  if (!pool.length) throw new Error("普查池为空 (dump 需含 v1/v3)");
  writeFileSync(POOL_CACHE, JSON.stringify({ sig, rows: pool }));
}

const D = 6;
const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
let zpool: PoolRow[] = [];
function normalizePool(): void {
  for (const s of pool) for (let d = 0; d < D; d++) mu[d] += s.f[d] / pool.length;
  for (const s of pool) for (let d = 0; d < D; d++) sd[d] += (s.f[d] - mu[d]) ** 2 / pool.length;
  for (let d = 0; d < D; d++) sd[d] = Math.sqrt(sd[d]) || 1;
  zpool = pool.map((p) => ({ ...p, f: p.f.map((x, d) => (x - mu[d]) / sd[d]) }));
}

// k=5 近邻; 返回 {poison 票率, 颜色多数}
function knn(vid: string, r: number, g: number, b: number): { poison: number; color: string | null } {
  const zf = feat(r, g, b).map((x, d) => (x - mu[d]) / sd[d]);
  const best: { d: number; row: PoolRow }[] = [];
  for (const p of zpool) {
    if (p.v === vid) continue;
    let dd = 0;
    for (let d = 0; d < D; d++) { const t = p.f[d] - zf[d]; dd += t * t; }
    if (best.length < 5) { best.push({ d: dd, row: p }); best.sort((x, y) => x.d - y.d); }
    else if (dd < best[4].d) { best[4] = { d: dd, row: p }; best.sort((x, y) => x.d - y.d); }
  }
  const poison = best.reduce((a, x) => a + x.row.bad, 0) / best.length;
  const tally = new Map<string, number>();
  for (const x of best) if (x.row.color) tally.set(x.row.color, (tally.get(x.row.color) ?? 0) + 1);
  const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  return { poison, color: top && top[1] >= 3 ? top[0] : null };
}

// ── 贴合评分 (格线中位跳变 + 内容项; 内容按像素位置量化记忆, 跨基有效) ──────
const lineDiffs: number[] = [];
type Snap = { dx: number; dy: number; m: [number, number, number, number] | null; s0: number; s1: number };
function snapChain(fr: Uint8Array, ch: Chain, vid: string): Snap {
  const [bv1x, bv1y, bv2x, bv2y] = ch.basis.map((z) => z * SC);
  const cx0 = ch.cx * SC, cy0 = ch.cy * SC;
  const pitch = ch.pitch * SC;
  const contMemo = new Map<number, number>();
  const contentAt = (px: number, py: number): number => {
    const key = Math.round(px / 5) * 8192 + Math.round(py / 5);
    let c = contMemo.get(key);
    if (c === undefined) {
      blockMedRGB(fr, px, py, pitch * 0.2, qa);
      c = qa[0] < 0 || Math.max(qa[0], qa[1], qa[2]) < 60 ? 0 : 1 - knn(vid, qa[0], qa[1], qa[2]).poison;
      contMemo.set(key, c);
    }
    return c;
  };
  const ev = (dx: number, dy: number, B: number[]): number => {
    const [v1x, v1y, v2x, v2y] = B;
    const cx = cx0 + dx * v1x + dy * v2x, cy = cy0 + dx * v1y + dy * v2y;
    let E = 0;
    for (const dir of [0, 1]) {
      for (const k of [-1.5, -0.5, 0.5, 1.5]) {
        lineDiffs.length = 0;
        for (let t = -1.45; t <= 1.451; t += 0.1) {
          lineDiffs.push(dir === 0
            ? diffAt(fr,
                cx + (k - 0.12) * v1x + t * v2x, cy + (k - 0.12) * v1y + t * v2y,
                cx + (k + 0.12) * v1x + t * v2x, cy + (k + 0.12) * v1y + t * v2y)
            : diffAt(fr,
                cx + t * v1x + (k - 0.12) * v2x, cy + t * v1y + (k - 0.12) * v2y,
                cx + t * v1x + (k + 0.12) * v2x, cy + t * v1y + (k + 0.12) * v2y));
        }
        lineDiffs.sort((a, b) => a - b);
        E += lineDiffs[lineDiffs.length >> 1];
      }
    }
    let C = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
      C += contentAt(cx + a * v1x + b * v2x, cy + a * v1y + b * v2y);
    return E / 8 / 150 + 0.5 * (C / 9) - 0.04 * (dx * dx + dy * dy);
  };
  const B0 = [bv1x, bv1y, bv2x, bv2y];
  const s0 = ev(0, 0, B0);
  let best = { dx: 0, dy: 0, s: s0 };
  for (let dx = -1.5; dx <= 1.51; dx += 0.15) {
    for (let dy = -1.5; dy <= 1.51; dy += 0.15) {
      const s = ev(dx, dy, B0);
      if (s > best.s) best = { dx, dy, s };
    }
  }
  const fineTrans = (B: number[], pen: number) => {
    for (let dx = best.dx - 0.12; dx <= best.dx + 0.121; dx += 0.03) {
      for (let dy = best.dy - 0.12; dy <= best.dy + 0.121; dy += 0.03) {
        const s = ev(dx, dy, B) - pen;
        if (s > best.s) best = { dx, dy, s };
      }
    }
  };
  fineTrans(B0, 0);
  let bestM: Snap["m"] = null, bestB = B0, bestPen = 0;
  if (AFFINE) {
    // (θ, s) 坐标下降 ≤2 轮; 轻离恒等惩罚 (θ=0,s=1 时 0) 防噪声拟合
    for (let round = 0; round < 2; round++) {
      let improved = false;
      for (let th = -6; th <= 6.01; th += 1.5) {
        for (let sc = 0.94; sc <= 1.0601; sc += 0.015) {
          const rad = (th * Math.PI) / 180, cs = Math.cos(rad) * sc, sn = Math.sin(rad) * sc;
          const B = [cs * bv1x - sn * bv1y, sn * bv1x + cs * bv1y, cs * bv2x - sn * bv2y, sn * bv2x + cs * bv2y];
          const pen = 0.02 * ((th / 6) ** 2 + ((sc - 1) / 0.06) ** 2);
          const s = ev(best.dx, best.dy, B) - pen;
          if (s > best.s) {
            best = { ...best, s };
            bestB = B; bestPen = pen;
            bestM = th === 0 && sc === 1 ? null : [cs, -sn, sn, cs];
            improved = true;
          }
        }
      }
      fineTrans(bestB, bestPen);
      if (!improved) break;
    }
  }
  return { dx: best.dx, dy: best.dy, m: bestM, s0, s1: best.s };
}

// ── 主流程: 每链关键帧独立贴合 → 中位剔离群 → keys sidecar ──────────────────
type SideRow = { f0: number; f1: number; cx: number; cy: number; keys: [number, number, number][]; m?: number[] };
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

async function main(): Promise<void> {
  await buildPool();
  normalizePool();
  console.log(`4K 普查池: ${pool.length} 格 (毒 ${pool.filter((p) => p.bad).length}, 颜色 ${pool.filter((p) => p.color).length})`);

  const sidecar: Record<string, SideRow[]> = {};
  for (const v of dump.videos) {
    if (ONLY && !v.name.startsWith(ONLY)) continue;
    const vid = v.name[0];
    type Res = { f: number; dx: number; dy: number; s1: number; m: Snap["m"] };
    const results = new Map<Chain, Res[]>();
    const byFrame = new Map<number, Chain[]>();
    for (const b of v.bounds) {
      for (const ch of b ?? []) {
        results.set(ch, []);
        for (const f of keyframesOf(ch))
          (byFrame.get(f) ?? byFrame.set(f, []).get(f)!).push(ch);
      }
    }
    const t0 = Date.now();
    await streamFrames(v.name, byFrame.keys(), (f, fr) => {
      for (const ch of byFrame.get(f)!) {
        const r = snapChain(fr, ch, vid);
        results.get(ch)!.push({ f, dx: r.dx, dy: r.dy, s1: r.s1, m: r.m });
      }
    });
    let snapped = 0, kept = 0, affN = 0;
    const moved: number[] = [], spread: number[] = [], degs: number[] = [];
    for (const [ch, keys] of results) {
      const ok = keys.filter((k) => k.s1 >= 0.55);
      if (!ok.length) { kept++; continue; }
      // 锚定剔离群: 中帧是 v1 验证过的行为, 在场时以它为信任锚; 其它关键帧偏离
      // 锚 >0.6 格的丢弃 (贴上邻格的 ±1 错误模态 + 糊帧假优都被拦, 最坏情形
      // 收敛回 v1 常量行为)。中帧缺席才退回中位中心。
      const mid = midOf(ch);
      const anchor = ok.find((k) => k.f === mid) ??
        { dx: median(ok.map((k) => k.dx)), dy: median(ok.map((k) => k.dy)) };
      const inliers = ok.filter((k) => Math.hypot(k.dx - anchor.dx, k.dy - anchor.dy) <= 0.6);
      if (!inliers.length) { kept++; continue; }
      inliers.sort((a, b) => a.f - b.f);
      // m 取离中帧最近的内点键 (默认 midonly 时即中帧自身)
      const mKey = [...inliers].sort((a, b) => Math.abs(a.f - mid) - Math.abs(b.f - mid))[0];
      (sidecar[v.name] ??= []).push({
        f0: ch.f0, f1: ch.f1, cx: ch.cx, cy: ch.cy,
        keys: inliers.map((k) => [k.f, Math.round(k.dx * 100) / 100, Math.round(k.dy * 100) / 100]),
        ...(mKey.m ? { m: mKey.m.map((z) => Math.round(z * 10000) / 10000) } : {}),
      });
      if (mKey.m) { affN++; degs.push(Math.abs((Math.atan2(mKey.m[2], mKey.m[0]) * 180) / Math.PI)); }
      snapped++;
      for (const k of inliers) moved.push(Math.hypot(k.dx, k.dy));
      if (inliers.length > 1) {
        let mx = 0;
        for (const a of inliers) for (const b of inliers)
          mx = Math.max(mx, Math.hypot(a.dx - b.dx, a.dy - b.dy));
        spread.push(mx);
      }
    }
    moved.sort((a, b) => a - b); spread.sort((a, b) => a - b); degs.sort((a, b) => a - b);
    console.log(
      `${v.name}: 贴合 ${snapped} 链 (弃 ${kept}), 关键帧 |Δ|p50=${moved[moved.length >> 1]?.toFixed(2) ?? "-"}` +
      (spread.length ? `, 链内漂移幅 p50=${spread[spread.length >> 1]?.toFixed(2)} p90=${spread[Math.floor(spread.length * 0.9)]?.toFixed(2)} (${spread.length} 多帧链)` : "") +
      (AFFINE ? `, 仿射 ${affN} 链 |θ|p50=${degs[degs.length >> 1]?.toFixed(1) ?? "-"}°` : "") +
      `, ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
  writeFileSync(join(ROOT, SIDE!), JSON.stringify(sidecar));
  console.log(`→ ${SIDE}`);
}

await main();
