// BLDDB (nbwzx/blddb) 三循环公式库的读取层 —— 给 /alg/3bld/3style 用。
//
// 数据是 fork 同步下来的那份人工整理集(`tools/blddb/data/*Manmade.json`,由
// _sync_blddb.ps1 落地),不入 client bundle,运行时按需拉。穷举生成的 Nightmare
// 集不在这里,那套只在 iframe 版 /blddb 里。
//
// ── 键是怎么编的 ────────────────────────────────────────────────────────────
// 键 = 三个贴纸的**彳亍(Chichu)默认编码**字母,但只存一个代表元。同一个三循环
// 有多种等价写法:
//   ① 循环移位:`(b t1 t2)` = `(t1 t2 b)` = `(t2 b t1)`,同一个置换;
//   ② 整体换贴纸:把三个字母**同时**换成同一块上的下一个贴纸(棱 2 个、角 3 个)。
//      这一步也保置换 —— σ 把每个**位置**映到同一块的另一面,"t1 归位到 b"
//      自动等价于"σt1 归位到 σb"。
// 所以候选键 = 棱 2×3 = 6 个 / 角 3×3 = 9 个,库里至多命中一个。
// 实例:UF-UB-RU → 彳亍 AEH → 换贴纸 BFG → 移位 GBF,库里就是 GBF。
// 与上游 `codeConverter.customCodeToVariantCode` 的等价性由
// tests/blddb_lookup.test.ts 拿上游源码当 oracle 逐个核对。
//
// 上游 license: GPL-3.0(见 tools/blddb/LICENSE)

import { staticUrl } from '@/lib/stats-base';
import { nearcorner, nearedge } from './lettering';
import { CHICHU_SCHEME, SPEFFZ_SCHEME, type SchemeId } from './scheme-presets';

export type BlddbPiece = 'corner' | 'edge';

/**
 * 库里一条记录:`[[公式...], [用这条的人...], [换位子...]]`。
 * 公式和换位子一一对应且**同一条公式的不同写法**(换手 / 转体),共用一份用者名单;
 * 换位子写不出来时上游填字符串 `"Not found."`。
 */
export type BlddbEntry = readonly [algs: string[], users: string[], comms: string[]];
export type BlddbSet = Readonly<Record<string, BlddbEntry[]>>;

/** 人名 → 各套公式表的公开链接(3 循环 / 5 循环等,按 codeType 分)。 */
export type SourceToUrl = Readonly<Record<string, Record<string, string>>>;
/** 人名 → WCA id 与盲拧成绩(百分秒)。 */
export type SourceToResult = Readonly<Record<string, { wca_id?: string; '3bld'?: number; '4bld'?: number }>>;

/** 上游给这条公式配的讲解视频。 */
export type AlgToUrl = Readonly<Record<string, { url: string; width: string; height: string }[]>>;

export const NO_COMMUTATOR = 'Not found.';

// ── 编码 ───────────────────────────────────────────────────────────────────

// 一块上"下一个贴纸"。彳亍默认串里的配对就是物理配对,与库里的编码同源
// (上游 tracer.ts 的 cornerChDefault / edgeChDefault 是同一组配对)。
const NEXT_STICKER: Record<BlddbPiece, (s: string) => string> = {
  corner: nearcorner,
  edge: nearedge,
};

/** 一块有几个贴纸 —— 也就是"整体换贴纸"能换几轮。 */
const STICKERS: Record<BlddbPiece, number> = { corner: 3, edge: 2 };

// scheme-presets 的两串都铺在同一套 48 个贴纸格上(每面 8 格,去掉中心),
// 所以同下标 = 同一个贴纸,可以直接对位翻译。每面 8 格里角在 [0,2,5,7]、
// 棱在 [1,3,4,6](3x3 的 1/3/7/9 与 2/4/6/8)。
// 正确性由 tests/blddb_lookup.test.ts 兜:两组下标取出的字母必须各自恰好是 24 个
// 角 / 棱字母的一个排列,错一个下标就红。
const SLOT_INDEXES: Record<BlddbPiece, number[]> = {
  corner: [0, 1, 2, 3, 4, 5].flatMap((f) => [0, 2, 5, 7].map((k) => f * 8 + k)),
  edge: [0, 1, 2, 3, 4, 5].flatMap((f) => [1, 3, 4, 6].map((k) => f * 8 + k)),
};

function buildSchemeMap(piece: BlddbPiece, from: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const i of SLOT_INDEXES[piece]) map[from[i]] = CHICHU_SCHEME[i];
  return map;
}

const SPEFFZ_TO_CHICHU: Record<BlddbPiece, Record<string, string>> = {
  corner: buildSchemeMap('corner', SPEFFZ_SCHEME),
  edge: buildSchemeMap('edge', SPEFFZ_SCHEME),
};

/** 该编码方案下这类块的合法字母(用来校验输入)。 */
export function schemeLetters(piece: BlddbPiece, scheme: SchemeId): string[] {
  const src = scheme === 'speffz' ? SPEFFZ_SCHEME : CHICHU_SCHEME;
  return [...new Set(SLOT_INDEXES[piece].map((i) => src[i]))].sort();
}

/** 用户编码 → 库里用的彳亍编码。彳亍本身原样返回。 */
export function toChichu(letters: string, piece: BlddbPiece, scheme: SchemeId): string {
  if (scheme !== 'speffz') return letters;
  const map = SPEFFZ_TO_CHICHU[piece];
  return [...letters].map((c) => map[c] ?? c).join('');
}

/** 两个字母是不是同一块上的贴纸(缓冲和目标撞块 = 这不是三循环)。 */
export function sameSticker(a: string, b: string, piece: BlddbPiece): boolean {
  let cur = a;
  for (let i = 0; i < STICKERS[piece]; i++) {
    if (cur === b) return true;
    cur = NEXT_STICKER[piece](cur);
  }
  return false;
}

/**
 * 一个三循环的全部等价键(彳亍编码)。见文件头注:整体换贴纸 × 循环移位。
 * 顺序不重要 —— 库里至多命中一个。
 */
export function variantKeys(chichu: string, piece: BlddbPiece): string[] {
  const next = NEXT_STICKER[piece];
  const out: string[] = [];
  let cur = chichu;
  for (let d = 0; d < STICKERS[piece]; d++) {
    for (let r = 0; r < cur.length; r++) out.push(cur.slice(r) + cur.slice(0, r));
    cur = [...cur].map(next).join('');
  }
  return out;
}

export interface BlddbLookup {
  /** 命中的库内键(彳亍编码,代表元)。 */
  key: string;
  entries: BlddbEntry[];
}

/** 查一个三循环。没有人工整理的公式就返回 null(不代表这个 case 不存在)。 */
export function lookupCase(
  set: BlddbSet,
  chichu: string,
  piece: BlddbPiece,
): BlddbLookup | null {
  for (const key of variantKeys(chichu, piece)) {
    const entries = set[key];
    if (entries) return { key, entries };
  }
  return null;
}

// ── 取数 ───────────────────────────────────────────────────────────────────

const BASE = '/tools/blddb/data';

// 同一份 JSON 全站只拉一次:2.4MB(角) / 3.5MB(棱),切来切去不该重拉。
// 存 promise 而不是结果,并发调用共用同一个请求。
const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = fetch(staticUrl(`${BASE}/${path}`)).then((r) => {
    if (!r.ok) throw new Error(`blddb ${path}: HTTP ${r.status}`);
    return r.json() as Promise<T>;
  }).catch((err) => {
    // 失败的不留在缓存里,否则一次网络抖动这页到刷新前都好不了。
    cache.delete(path);
    throw err;
  });
  cache.set(path, p);
  return p;
}

export function loadBlddbSet(piece: BlddbPiece): Promise<BlddbSet> {
  return fetchJson<BlddbSet>(`${piece}Manmade.json`);
}

export function loadSourceToUrl(): Promise<SourceToUrl> {
  return fetchJson<SourceToUrl>('sourceToUrl.json');
}

export function loadSourceToResult(): Promise<SourceToResult> {
  return fetchJson<SourceToResult>('sourceToResult.json');
}

export function loadAlgToUrl(): Promise<AlgToUrl> {
  return fetchJson<AlgToUrl>('algToUrl.json');
}
