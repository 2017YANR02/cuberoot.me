// 求解器数据表的「住址」+ 那张大表(pt_cross_C4E0)的下载单例。
//
// 从 rust-cross-client 拆出来,因为下载这张表已经不再是「池」的事:
//  · 整站同一时刻只有一个活跃池,但表要跨池活着(切 need 再切回来不该重下);
//  · 预取要在**池还不存在时**就开始 —— 打开 /timer 那一刻解法面板可能还没展开
//    (手机上浮层默认关着),而那 21MB 正是切到 XCross 时唯一的等待。
// 这个模块零依赖,页面级组件可以直接 import 而不把 worker 池 / 打乱解析拖进首屏包。

const BASE = '/tools/solver/rust-cross';
// 表直接从 static 取:prod 下主域的 /tools/* 是一条 307 跳到 static(见
// app/tools/[...slug]/route.ts),每张表白付一个 RTT,而表本来就带 CORS:*。
// dev 仍走本地 Next catch-all(直接读仓库根 tools/)。
const TABLES_BASE = process.env.NODE_ENV === 'development'
  ? `${BASE}/tables`
  : 'https://static.cuberoot.me/tools/solver/rust-cross/tables';
// 表内容不变(重算表要改名或 bump 这里),故 URL 带一个长缓存版本号,配合 nginx 的
// immutable 头 → 一次下完永久命中,不再受启发式缓存窗口摆布。
const TV = 'tv=1';

export { BASE, TABLES_BASE, TV };

/** worker 侧拼表 URL 用的绝对前缀(SSR 下没有 location,给相对值即可 —— 那边用不到)。 */
export function tablesBaseUrl(): string {
  if (TABLES_BASE.startsWith('http')) return TABLES_BASE;
  return `${typeof location !== 'undefined' ? location.origin : ''}${TABLES_BASE}`;
}

/** 大表下载进度。total = Content-Length;个别代理会剥掉它,此时为 0(UI 应退回不确定态)。 */
export interface XCrossProgress {
  loaded: number;
  total: number;
}

// ——— 大表(pt_cross_C4E0,gz 21MB)只下一次 ———
//
// 原先是每个 worker 自己 fetch:ensureAllXCross 向已起的 N 路一起广播,N 个 fetch 同一 URL
// 同时出发,而浏览器**不会**把并发的同 URL 请求合成一次下载 —— 实测(计时器面板,手机宽度
// 2 路)真的是两条 21MB 的流并行抢带宽,42MB 过线,首次切到 XCross 要等 7~15 秒。
// 主线程取一次 gz,再把这份字节分发给每个 worker(各自解压进自己的 WASM 内存,那部分本来
// 就得一人一份)。

let gz: Promise<ArrayBuffer> | null = null;
/** 是否有池真的要用这张表(≠ 只是预取)。true 后不再自动松手。 */
let claimed = false;
/** 预取下完后字节在主线程留多久(见 prefetchXCrossTable)。 */
const PREFETCH_HOLD_MS = 120000;
let hold: ReturnType<typeof setTimeout> | undefined;

const progressFns = new Set<(p: XCrossProgress) => void>();
let progress: XCrossProgress | null = null;
function emit(p: XCrossProgress): void {
  progress = p;
  for (const fn of progressFns) fn(p);
}

/** 订阅大表下载进度(21MB 要走好几秒,只给转圈没有进度感)。返回退订函数;
 *  订阅时若已有进度会立刻回放一次当前值(预取途中切过去也能接着看)。 */
export function onXCrossProgress(fn: (p: XCrossProgress) => void): () => void {
  progressFns.add(fn);
  if (progress) fn(progress);
  return () => { progressFns.delete(fn); };
}

// 边下边报。整表要几秒,一次性 arrayBuffer() 期间 UI 只有一个转圈;读流才拿得到已下字节数。
// 注:表是**预压好的 .bin.gz 文件**、不带 Content-Encoding,所以 Content-Length 与这里读到的
// 字节同尺度(若哪天服务器再套一层编码,total 会偏小 → UI 侧钳到 100%)。
async function download(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body) { // 无可读流(老浏览器 / 某些代理):退回一次性读,只报首尾
    emit({ loaded: 0, total });
    const buf = await r.arrayBuffer();
    emit({ loaded: buf.byteLength, total: total || buf.byteLength });
    return buf;
  }
  emit({ loaded: 0, total });
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    emit({ loaded, total });
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  emit({ loaded, total: total || loaded });
  return out.buffer;
}

function fetchGz(): Promise<ArrayBuffer> {
  if (!gz) {
    const url = `${tablesBaseUrl()}/pt_cross_C4E0.bin.gz?${TV}`;
    gz = download(url).catch((e) => { gz = null; progress = null; throw e; });
  }
  return gz;
}

/** 池真的要这张表了(切到 XCross+)。取回字节,并从此不再自动松手。 */
export function claimXCrossGz(): Promise<ArrayBuffer> {
  claimed = true;
  clearTimeout(hold);
  return fetchGz();
}

/** 放掉主线程这份字节(worker 都拿到了 / 池终止 / 预取超时没人要)。不影响已 attach 的 worker;
 *  之后再要退回重新 fetch(prod 是 immutable 缓存命中)。 */
export function releaseXCrossGz(): void {
  clearTimeout(hold);
  gz = null;
  progress = null;
}

/** 后台预取:只把字节拿到手,不 attach 任何 worker,也不需要池存在。
 *  已在下 / 已被池认领时是 no-op。 */
export function prefetchXCrossTable(): void {
  if (claimed || gz) return;
  void fetchGz().then(
    () => {
      // 下完先攥一会儿再松手。松手只留 HTTP 缓存(prod:immutable 一年)本来也够,但那是
      // 「假设缓存留得住」—— 实测 dev 下第二次取又整整走了一遍 21MB(dev 是 chunked、
      // 无 Content-Length,浏览器没存)。真要用这张表的人几乎都在打开页面后不久就切过去,
      // 这段窗口内直接命中内存里的字节,零额外流量;过了窗口没人要就放掉,不让「顺手预取」
      // 变成常驻 21MB —— 大多数人根本不会切到 XCross。
      if (claimed) return;
      clearTimeout(hold);
      hold = setTimeout(() => { if (!claimed) releaseXCrossGz(); }, PREFETCH_HOLD_MS);
    },
    () => { progress = null; }, // 预取失败无所谓:真要用时再取,那时才报错给用户
  );
}

/** 这条连接值不值得为一张 21MB 的表花流量。省流量模式 / 慢网一律不预取 ——
 *  大多数人只用纯十字,那 21MB 对他们是纯浪费。connection API 缺席(Firefox / Safari)按可以算。 */
function prefetchAllowed(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !conn.effectiveType || conn.effectiveType === '4g';
}

/** 浏览器空闲时预取(见 prefetchXCrossTable)。返回取消函数 —— 只能取消「还没开跑」的那次,
 *  已经在下的拦不住。页面加载完成前不动手:别跟首屏 chunk / 打乱生成抢带宽。 */
export function prefetchXCrossTableWhenIdle(): () => void {
  if (typeof window === 'undefined' || !prefetchAllowed()) return () => {};
  let cancelled = false;
  let idleId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    if (cancelled) return;
    const ric = window.requestIdleCallback;
    if (!ric) { timer = setTimeout(prefetchXCrossTable, 2000); return; }
    idleId = ric(() => { if (!cancelled) prefetchXCrossTable(); }, { timeout: 10000 });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', start);
    if (idleId) window.cancelIdleCallback?.(idleId);
    clearTimeout(timer);
  };
}
