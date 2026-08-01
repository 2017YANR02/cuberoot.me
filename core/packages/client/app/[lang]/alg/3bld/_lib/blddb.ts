// BLDDB(nbwzx/blddb)人工整理公式集的读取层 —— 给 /alg/3bld/lookup 用。
//
// 数据是 fork 同步下来的那份(`tools/blddb/data/*Manmade.json`,由 _sync_blddb.ps1
// 落地),不入 client bundle,运行时按需拉。穷举生成的 Nightmare 集、高阶盲拧(翼棱 /
// 中心块)不在这里,那两套只在 iframe 版 /blddb 里。
//
// ── 库键是怎么编的 ─────────────────────────────────────────────────────────
// 键 = 若干个贴纸的**彳亍(Chichu)默认编码**字母,而且同一个 case 只存一个代表元,
// 等价写法要自己算。两条产生等价写法的操作:
//   ① 循环移位:`(b t1 t2)` = `(t1 t2 b)` = `(t2 b t1)`,同一个置换;
//   ② 整体换贴纸:把所有字母**同时**换成同一块上的下一个贴纸(棱 2 个、角 3 个)。
//      这一步保置换 —— σ 把每个**位置**映到同一块的另一面,"t1 归位到 b"自动等价于
//      "σt1 归位到 σb"。
// 各类型的具体组合见下面 VARIANTS。实例:UF-UB-RU → 彳亍 AEH → 换贴纸 BFG →
// 移位 GBF,库里就是 GBF。正确性锁在 tests/blddb_lookup.test.ts(代表元唯一 +
// 覆盖计数),外加对着 iframe 版逐 case 实测。
//
// 上游 license: GPL-3.0(见 tools/blddb/LICENSE)。这里只读它的**数据**,编码逻辑
// 是本站按同一套记号自己实现的。

import { mirrorMoveString } from '@cuberoot/shared/alg-mirror';
import { staticUrl } from '@/lib/stats-base';
import { nearcorner, nearedge } from './lettering';
import { CHICHU_SCHEME, SPEFFZ_SCHEME, type SchemeId } from './scheme-presets';

/** 库里的十个 case 类型中,本站原生支持的六个(都是三阶)。 */
export type BlddbType = 'edge' | 'corner' | 'parity' | 'twists' | 'flips' | 'ltct';

/** 块类型 —— 决定"下一个贴纸"怎么走。 */
export type BlddbPiece = 'corner' | 'edge';

export const BLDDB_TYPES: BlddbType[] = ['edge', 'corner', 'parity', 'twists', 'flips', 'ltct'];

/**
 * 库里一条记录,定长四位:`[[公式...], [用这条的人...], [换位子...]|null, [起手...]]`。
 * 一条记录里的多个公式是**同一条公式的不同写法**(换手 / 转体),共用一份用者名单;
 * 换位子只有 corner / edge / flips / twists 有(其余为 null),写不出来时上游填
 * `"Not found."`。起手与公式一一对应,编码见 {@link THUMB_LABELS}。
 *
 * 定长化和起手都是 `.sync/blddb_postprocess.mjs` 在同步期做的 —— 起手那套算法是上游
 * GPL 的,只在构建期跑,结果入数据,不进 client bundle。
 */
export type BlddbEntry = readonly [
  algs: string[],
  users: string[],
  comms: string[] | null,
  fingers: string[],
];
export type BlddbSet = Readonly<Record<string, BlddbEntry[]>>;

/**
 * 起手拇指位置的编码 → 文案。大写 = 左手镜像那一侧(上游把左手的「中立」也叫中立)。
 * 一条公式可能有多个可行起手,数据里就是多个字符连写(如 `du`)。
 *
 * 短标签跟在每条公式后面显示(要够窄,不能把行撑开),长的挂 title 解释。
 */
export const THUMB_LABELS: Readonly<Record<string, { zh: string; en: string; fullZh: string; fullEn: string }>> = {
  h: { zh: '中', en: 'Home', fullZh: '中立握法', fullEn: 'Home grip' },
  H: { zh: '中', en: 'Home', fullZh: '中立握法', fullEn: 'Home grip' },
  u: { zh: '上', en: 'Up', fullZh: '右手拇指朝上', fullEn: 'Right thumb up' },
  d: { zh: '下', en: 'Down', fullZh: '右手拇指朝下', fullEn: 'Right thumb down' },
  U: { zh: '左上', en: 'L-up', fullZh: '左手拇指朝上', fullEn: 'Left thumb up' },
  D: { zh: '左下', en: 'L-down', fullZh: '左手拇指朝下', fullEn: 'Left thumb down' },
};

function joinThumb(code: string | undefined, pick: (v: (typeof THUMB_LABELS)[string]) => string): string | null {
  if (!code) return null;
  const parts = [...code].map((c) => THUMB_LABELS[c]).filter(Boolean);
  if (parts.length === 0) return null;
  // 去重:左右两侧的「中立」文案相同,连写成 hH 时别显示两遍。
  return [...new Set(parts.map(pick))].join(' / ');
}

/** 一条公式的起手编码 → 短标签(多个可行起手用 `/` 连)。算不出来给 null。 */
export function thumbLabel(code: string | undefined, isZh: boolean): string | null {
  return joinThumb(code, (v) => (isZh ? v.zh : v.en));
}

/** 同上,展开成完整说明 —— 挂 title 用。 */
export function thumbTitle(code: string | undefined, isZh: boolean): string | null {
  return joinThumb(code, (v) => (isZh ? v.fullZh : v.fullEn));
}

/** 人名 → 各套公式表的公开链接(按 codeType 分,带 3bld / bld 兜底)。 */
export type SourceToUrl = Readonly<Record<string, Record<string, string>>>;
/** 人名 → WCA id 与盲拧成绩(百分秒)。 */
export type SourceToResult = Readonly<Record<string, { wca_id?: string; '3bld'?: number; '4bld'?: number }>>;
/** 上游给某条公式配的讲解视频(bilibili / 抖音 / YouTube 内嵌页)。 */
export type AlgToUrl = Readonly<Record<string, { url: string; width: string; height: string }[]>>;

export const NO_COMMUTATOR = 'Not found.';
/** 输入里的通配符:一位任意字母,用来列出一整组 case。 */
export const WILDCARD = '*';

// ── 贴纸格 ─────────────────────────────────────────────────────────────────

/**
 * 48 个贴纸格的位置名,顺序 = scheme-presets 那两串编码方案的下标顺序
 * (面序 U D L R F B,每面 8 格按阅读序去掉中心)。角在每面的 0/2/5/7,棱在 1/3/4/6。
 *
 * 与库同源的证据:CHICHU_SCHEME 在 UF / UB / RU 三格上正好是 A / E / H,而上游页面
 * ?position=UF-UB-RU 的字母对就是彳亍 AEH。整表的自洽性(双射 + 角棱分类)锁在测试里。
 */
export const POSITIONS_48: readonly string[] = [
  'UBL', 'UB', 'UBR', 'UL', 'UR', 'UFL', 'UF', 'UFR',
  'DFL', 'DF', 'DFR', 'DL', 'DR', 'DBL', 'DB', 'DBR',
  'LUB', 'LU', 'LUF', 'LB', 'LF', 'LDB', 'LD', 'LDF',
  'RUF', 'RU', 'RUB', 'RF', 'RB', 'RDF', 'RD', 'RDB',
  'FUL', 'FU', 'FUR', 'FL', 'FR', 'FDL', 'FD', 'FDR',
  'BUR', 'BU', 'BUL', 'BR', 'BL', 'BDR', 'BD', 'BDL',
];

/** 每面 8 格里角 / 棱各占哪几个下标。 */
const CELL_INDEXES: Record<BlddbPiece, number[]> = { corner: [0, 2, 5, 7], edge: [1, 3, 4, 6] };

function slotIndexes(piece: BlddbPiece): number[] {
  return [0, 1, 2, 3, 4, 5].flatMap((f) => CELL_INDEXES[piece].map((k) => f * 8 + k));
}

const SLOT_INDEXES: Record<BlddbPiece, number[]> = {
  corner: slotIndexes('corner'),
  edge: slotIndexes('edge'),
};

/** 彳亍字母 → 位置名。角棱各一张表 —— 同一个字母在两类里都出现(A 既是 UFL 又是 UF)。 */
const POS_OF_LETTER: Record<BlddbPiece, Record<string, string>> = { corner: {}, edge: {} };
/** 位置名 → 彳亍字母。 */
const LETTER_OF_POS: Record<string, string> = {};

for (const piece of ['corner', 'edge'] as const) {
  for (const i of SLOT_INDEXES[piece]) {
    POS_OF_LETTER[piece][CHICHU_SCHEME[i]] = POSITIONS_48[i];
    LETTER_OF_POS[POSITIONS_48[i]] = CHICHU_SCHEME[i];
  }
}

/**
 * 字母表分档 —— 上游 codeTypeToPositions 的四档:
 *  - `corner` / `edge`:全部 24 个贴纸;
 *  - `corner1`:角块上不在 U/D 面的那 16 个贴纸(翻角只用得到这些);
 *  - `edge0`:每条棱选一个代表贴纸(U/D 面的 8 个 + FL/FR/BL/BR),共 12 个 —— 翻棱
 *    只认这一档,因为"这条棱翻了"跟用哪面贴纸称呼它无关。
 */
export type SlotKind = 'corner' | 'edge' | 'corner1' | 'edge0';

const EDGE0_EXTRA = new Set(['FL', 'FR', 'BL', 'BR']);

function inKind(pos: string, kind: SlotKind): boolean {
  if (kind === 'corner') return pos.length === 3;
  if (kind === 'edge') return pos.length === 2;
  if (kind === 'corner1') return pos.length === 3 && pos[0] !== 'U' && pos[0] !== 'D';
  return pos.length === 2 && (pos[0] === 'U' || pos[0] === 'D' || EDGE0_EXTRA.has(pos));
}

/** 某一档的位置名(下拉选项用的顺序 = 48 格顺序)。 */
export function kindPositions(kind: SlotKind): string[] {
  return POSITIONS_48.filter((p) => inKind(p, kind));
}

/** 某个位置在指定编码方案下的字母。 */
export function letterAtPosition(pos: string, scheme: SchemeId): string {
  const i = POSITIONS_48.indexOf(pos);
  if (i < 0) return '';
  return (scheme === 'speffz' ? SPEFFZ_SCHEME : CHICHU_SCHEME)[i];
}

/** 某一档在指定编码方案下的合法字母。 */
export function kindLetters(kind: SlotKind, scheme: SchemeId): string[] {
  const src = scheme === 'speffz' ? SPEFFZ_SCHEME : CHICHU_SCHEME;
  const out: string[] = [];
  for (let i = 0; i < 48; i++) if (inKind(POSITIONS_48[i], kind)) out.push(src[i]);
  return out;
}

/** 兼容旧签名:某类块在指定方案下的 24 个字母(排序后)。 */
export function schemeLetters(piece: BlddbPiece, scheme: SchemeId): string[] {
  return [...new Set(kindLetters(piece, scheme))].sort();
}

const pieceOfKind = (kind: SlotKind): BlddbPiece => (kind === 'corner' || kind === 'corner1' ? 'corner' : 'edge');

// ── 编码方案互译 ───────────────────────────────────────────────────────────

function buildSchemeMap(piece: BlddbPiece, from: string, to: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const i of SLOT_INDEXES[piece]) map[from[i]] = to[i];
  return map;
}

const SPEFFZ_TO_CHICHU: Record<BlddbPiece, Record<string, string>> = {
  corner: buildSchemeMap('corner', SPEFFZ_SCHEME, CHICHU_SCHEME),
  edge: buildSchemeMap('edge', SPEFFZ_SCHEME, CHICHU_SCHEME),
};
const CHICHU_TO_SPEFFZ: Record<BlddbPiece, Record<string, string>> = {
  corner: buildSchemeMap('corner', CHICHU_SCHEME, SPEFFZ_SCHEME),
  edge: buildSchemeMap('edge', CHICHU_SCHEME, SPEFFZ_SCHEME),
};

/** 用户编码的单个字母 → 库里用的彳亍编码。彳亍本身原样返回。 */
export function toChichu(letters: string, piece: BlddbPiece, scheme: SchemeId): string {
  if (scheme !== 'speffz') return letters;
  const map = SPEFFZ_TO_CHICHU[piece];
  return [...letters].map((c) => (c === WILDCARD ? c : (map[c] ?? c))).join('');
}

/** 彳亍 → 用户编码。 */
export function fromChichu(letters: string, piece: BlddbPiece, scheme: SchemeId): string {
  if (scheme !== 'speffz') return letters;
  const map = CHICHU_TO_SPEFFZ[piece];
  return [...letters].map((c) => (c === WILDCARD ? c : (map[c] ?? c))).join('');
}

// ── 类型规格 ───────────────────────────────────────────────────────────────

interface TypeSpec {
  /** 每一位字母属于哪一档(twists 是变长,单独标)。 */
  slots: SlotKind[];
  /** twists 那种"1~8 位、每位同一档"的变长码。 */
  variadic?: { kind: SlotKind; max: number };
  /** 这套数据带不带换位子列。 */
  hasComm: boolean;
}

const SPECS: Record<BlddbType, TypeSpec> = {
  edge: { slots: ['edge', 'edge', 'edge'], hasComm: true },
  corner: { slots: ['corner', 'corner', 'corner'], hasComm: true },
  parity: { slots: ['edge', 'edge', 'corner', 'corner'], hasComm: false },
  twists: { slots: [], variadic: { kind: 'corner1', max: 8 }, hasComm: true },
  flips: { slots: ['edge0', 'edge0'], hasComm: true },
  ltct: { slots: ['corner', 'corner', 'corner1'], hasComm: false },
};

/** 这个类型的码有多长(twists 变长,返回上限)。 */
export function codeLength(type: BlddbType): number {
  const spec = SPECS[type];
  return spec.variadic ? spec.variadic.max : spec.slots.length;
}

export function isVariadic(type: BlddbType): boolean {
  return SPECS[type].variadic !== undefined;
}

export function hasCommutators(type: BlddbType): boolean {
  return SPECS[type].hasComm;
}

/** 第 i 位属于哪一档。 */
export function slotKind(type: BlddbType, i: number): SlotKind {
  const spec = SPECS[type];
  return spec.variadic ? spec.variadic.kind : spec.slots[i];
}

/** 整串码逐位换编码方案(每位按自己那一档的块类型走)。 */
function convertCode(code: string, type: BlddbType, fn: (c: string, p: BlddbPiece) => string): string {
  return [...code].map((c, i) => fn(c, pieceOfKind(slotKind(type, i)))).join('');
}

export function codeToChichu(code: string, type: BlddbType, scheme: SchemeId): string {
  return convertCode(code, type, (c, p) => toChichu(c, p, scheme));
}

export function codeFromChichu(code: string, type: BlddbType, scheme: SchemeId): string {
  return convertCode(code, type, (c, p) => fromChichu(c, p, scheme));
}

// ── 等价写法 ───────────────────────────────────────────────────────────────

/** 同一块上的下一个贴纸。通配符原样穿过(它代表"任意",换贴纸也还是任意)。 */
function nextSticker(letter: string, piece: BlddbPiece): string {
  if (letter === WILDCARD) return WILDCARD;
  return piece === 'corner' ? nearcorner(letter) : nearedge(letter);
}

const displaceAll = (code: string, piece: BlddbPiece): string =>
  [...code].map((c) => nextSticker(c, piece)).join('');

const rotations = (s: string): string[] =>
  [...s].map((_, r) => s.slice(r) + s.slice(0, r));

/** 换贴纸 × 循环移位 —— 三循环 / 翻棱对 / 奇偶的半边都用这个。 */
function displaceAndRotate(code: string, piece: BlddbPiece): string[] {
  const out: string[] = [];
  let cur = code;
  for (let d = 0; d < (piece === 'corner' ? 3 : 2); d++) {
    out.push(...rotations(cur));
    cur = displaceAll(cur, piece);
  }
  return out;
}

/** 一个角贴纸所在角块的三个贴纸,从 U/D 面那个起。 */
function cornerTriple(letter: string): [string, string, string] {
  let c0 = letter;
  for (let i = 0; i < 3; i++) {
    const pos = POS_OF_LETTER.corner[c0];
    if (pos && (pos[0] === 'U' || pos[0] === 'D')) break;
    c0 = nearcorner(c0);
  }
  const c1 = nearcorner(c0);
  return [c0, c1, nearcorner(c1)];
}

/**
 * 翻角方向 —— 换一次贴纸到的是逆时针那面,换两次是顺时针。
 * (UFR 的三个贴纸 UFR → RUF → FUR,上游 twists 表里 RUF 记 ccw、FUR 记 cw。)
 */
export function twistDirection(letter: string): 'cw' | 'ccw' | null {
  const [, ccw, cw] = cornerTriple(letter);
  if (letter === ccw) return 'ccw';
  if (letter === cw) return 'cw';
  return null; // U/D 面那个贴纸不表示翻角
}

/** 翻角那 16 个字母:每个角一对(逆时针面 / 顺时针面)。 */
export function twistLetterOf(cornerPos: string, dir: 'cw' | 'ccw'): string {
  const [, ccw, cw] = cornerTriple(LETTER_OF_POS[cornerPos]);
  return dir === 'ccw' ? ccw : cw;
}

/** 八个角块的 U/D 面位置名 —— 翻角输入按这个顺序排。 */
export const TWIST_CORNERS: readonly string[] = POSITIONS_48.filter(
  (p) => p.length === 3 && (p[0] === 'U' || p[0] === 'D'),
);

function ltctVariants(code: string): string[] {
  const twisted = code[2];
  // 换贴纸的三种写法(不含移位)。
  const d: string[] = [code.slice(0, 2)];
  for (let i = 1; i < 3; i++) d.push(displaceAll(d[i - 1], 'corner'));

  // 翻角未知时退回"全部移位",与上游 cycle=0 分支一致。
  if (twisted === WILDCARD) {
    return d.flatMap(rotations).map((p) => p + twisted);
  }
  // 两个目标反着写时,换位子里的翻角会错开一格 —— 错开几格由翻角方向决定。
  const c = twistDirection(twisted) === 'ccw' ? 1 : 2;
  return [
    ...d,
    d[0][1] + d[c % 3][0],
    d[1][1] + d[(c + 1) % 3][0],
    d[2][1] + d[(c + 2) % 3][0],
  ].map((p) => p + twisted);
}

function cartesian(a: string[], b: string[]): string[] {
  return a.flatMap((x) => b.map((y) => x + y));
}

/**
 * 一个 case 的全部等价写法(彳亍编码)。库里至多命中一个。
 * 通配符 `*` 原样参与移位 / 换贴纸,所以带通配的码也能当模式用。
 */
export function variantKeys(code: string, type: BlddbType): string[] {
  switch (type) {
    case 'corner':
      return displaceAndRotate(code, 'corner');
    case 'edge':
      return displaceAndRotate(code, 'edge');
    case 'flips':
      return displaceAndRotate(code, 'edge');
    case 'parity':
      return cartesian(
        displaceAndRotate(code.slice(0, 2), 'edge'),
        displaceAndRotate(code.slice(2, 4), 'corner'),
      );
    case 'ltct':
      return ltctVariants(code);
    case 'twists':
      // 翻角不靠移位:哪个角朝哪转是一组无序事实,键就是排序后的字母。
      return [[...code].sort().join('')];
  }
}

/** 两个字母是不是同一块上的贴纸(缓冲和目标撞块 = 这不是三循环)。 */
export function sameSticker(a: string, b: string, piece: BlddbPiece): boolean {
  let cur = a;
  for (let i = 0; i < (piece === 'corner' ? 3 : 2); i++) {
    if (cur === b) return true;
    cur = nextSticker(cur, piece);
  }
  return false;
}

// ── 查表 ───────────────────────────────────────────────────────────────────

export interface BlddbHit {
  /** 命中的库内键(彳亍代表元)。 */
  key: string;
  /** 这个 case 对上输入的那种写法(彳亍编码,通配位已填实)。 */
  writing: string;
  entries: BlddbEntry[];
}

const matchesPattern = (pattern: string, s: string): boolean =>
  pattern.length === s.length && [...pattern].every((c, i) => c === WILDCARD || c === s[i]);

/**
 * 按彳亍编码的**模式**查库。不带 `*` 时至多一条(走等价写法直接命中键);
 * 带 `*` 时扫全表,列出该组的每个 case。
 */
export function findCases(set: BlddbSet, pattern: string, type: BlddbType): BlddbHit[] {
  if (!pattern.includes(WILDCARD)) {
    for (const key of variantKeys(pattern, type)) {
      const entries = set[key];
      if (entries) return [{ key, writing: pattern, entries }];
    }
    return [];
  }
  const out: BlddbHit[] = [];
  for (const key of Object.keys(set)) {
    for (const writing of variantKeys(key, type)) {
      if (matchesPattern(pattern, writing)) {
        out.push({ key, writing, entries: set[key] });
        break;
      }
    }
  }
  return out;
}

/** 旧签名(只查三循环、只返一条)—— 测试与外部调用还在用。 */
export function lookupCase(set: BlddbSet, chichu: string, piece: BlddbPiece): BlddbHit | null {
  return findCases(set, chichu, piece)[0] ?? null;
}

/**
 * 三循环的逆 case:换掉两个目标的先后。`(b t1 t2)` 的逆是 `(b t2 t1)`,公式就是倒着做,
 * 所以想同时看两边的人可以顺手拿到。只有 corner / edge 有意义 —— 奇偶 / 翻角 / 翻棱
 * 都是对合(自己就是自己的逆),奇偶带翻的逆不在同一套编码里。
 */
export function hasInverseCase(type: BlddbType): boolean {
  return type === 'corner' || type === 'edge';
}

export function inverseCode(code: string): string {
  return code.length === 3 ? code[0] + code[2] + code[1] : code;
}

/**
 * 一条公式(或换位子)镜像到 M 平面另一侧。规则表在 `@cuberoot/shared/alg-mirror`
 * (M / x 不取反那条坑写在它注释里),这里只负责**保住换位子的结构** ——
 * `[ ] , : / ( )` 原样穿过,只把中间的记号串交给它。
 */
export function mirrorAlgText(text: string): string {
  return text
    .split(/([[\],:/()])/u)
    .map((part) => {
      if (!/[A-Za-z]/u.test(part)) return part;
      try {
        return mirrorMoveString(part, 'M');
      } catch {
        return part; // 认不出来的写法就别改它,总比吐一条错公式强
      }
    })
    .join('');
}

/** 位置名镜像到 M 平面另一侧 —— 面名里的 L / R 互换,其余不动(UFR→UFL、RU→LU)。 */
export function mirrorPosition(pos: string): string {
  return pos.replace(/[LR]/gu, (c) => (c === 'L' ? 'R' : 'L'));
}

/**
 * 一整串彳亍码镜像。左右镜像不是「把查到的公式翻一下」那么简单:库里那条公式解的是
 * **镜像后的** case,所以要**先把查询镜过去**,再把查到的公式镜回来 —— 两次镜像抵消,
 * 拿到的才是解你这个 case 的左手写法。展示时把命中的写法再镜回去当标签(镜像是对合)。
 */
export function mirrorChichu(code: string, type: BlddbType): string {
  return [...code]
    .map((c, i) => {
      if (c === WILDCARD) return c;
      const pos = POS_OF_LETTER[pieceOfKind(slotKind(type, i))][c];
      if (!pos) return c;
      return LETTER_OF_POS[mirrorPosition(pos)] ?? c;
    })
    .join('');
}

/** 结果排序:按当前编码的字母,或按位置在 48 格里的顺序。 */
export type BlddbOrder = 'letter' | 'position';

/** 排序键 —— 拿命中写法的**第一个通配位**(没有就整串)去比。 */
export function orderKey(writing: string, type: BlddbType, scheme: SchemeId, order: BlddbOrder): string {
  if (order === 'position') {
    return positionsOf(writing, type)
      .map((p) => String(POSITIONS_48.indexOf(p)).padStart(2, '0'))
      .join('');
  }
  return codeFromChichu(writing, type, scheme);
}

// ── 位置描述 ───────────────────────────────────────────────────────────────

/** 一串彳亍码逐位翻成位置名(通配位给 `*`)。 */
export function positionsOf(code: string, type: BlddbType): string[] {
  return [...code].map((c, i) => {
    if (c === WILDCARD) return WILDCARD;
    return POS_OF_LETTER[pieceOfKind(slotKind(type, i))][c] ?? c;
  });
}

/** 翻角码 → 每个被翻的角 + 方向,按 TWIST_CORNERS 顺序。 */
export function twistTargets(code: string): { corner: string; dir: 'cw' | 'ccw' }[] {
  const out: { corner: string; dir: 'cw' | 'ccw' }[] = [];
  for (const corner of TWIST_CORNERS) {
    for (const dir of ['cw', 'ccw'] as const) {
      if (code.includes(twistLetterOf(corner, dir))) out.push({ corner, dir });
    }
  }
  return out;
}

// ── 取数 ───────────────────────────────────────────────────────────────────

const BASE = '/tools/blddb/data';

/**
 * 数据版本 —— **改了 JSON 的形状就必须 +1**。
 *
 * `/tools/*` 是按 24h `max-age` 发的(静态 fork 的资产,本来就该长缓存),所以形状一变,
 * 老浏览器会拿着旧结构的缓存渲染新代码,直接崩在读新字段那一行。带上 `?v=` 等于换了
 * 一个 URL,缓存自然失效。
 *
 * v2:每条记录补成定长四位 `[公式, 用者, 换位子|null, 起手]`(.sync/blddb_postprocess.mjs)。
 */
const DATA_VERSION = 2;

// 同一份 JSON 全站只拉一次(棱 1.6MB / 角 1.1MB,其余都在 200KB 以内),切来切去
// 不该重拉。存 promise 而不是结果,并发调用共用同一个请求。
const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = fetch(staticUrl(`${BASE}/${path}?v=${DATA_VERSION}`))
    .then((r) => {
      if (!r.ok) throw new Error(`blddb ${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    })
    .catch((err) => {
      // 失败的不留在缓存里,否则一次网络抖动这页到刷新前都好不了。
      cache.delete(path);
      throw err;
    });
  cache.set(path, p);
  return p;
}

export function loadBlddbSet(type: BlddbType): Promise<BlddbSet> {
  return fetchJson<BlddbSet>(`${type}Manmade.json`);
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

// ── 速查表(/alg/3bld/tables)────────────────────────────────────────────────

/** 「每个 case 一条推荐解」的表:库键(彳亍代表元)→ 公式。 */
export type NightmareSelected = Readonly<Record<string, string>>;

/** 上游 Nightmare 菜单里带推荐解网格的两套。 */
export const SELECTED_TYPES = ['corner', 'edge'] as const;
export type SelectedType = (typeof SELECTED_TYPES)[number];

export function loadNightmareSelected(type: SelectedType): Promise<NightmareSelected> {
  return fetchJson<NightmareSelected>(`${type}NightmareSelected.json`);
}

/**
 * 上游 Nightmare 菜单里那九张静态速查表(`data/nightmare/*.json`)。
 * 形状是原始的行数组:每行若干「标题, 公式」列,整行全空 = 分节。
 */
export const TABLE_NAMES = [
  '2e2e', '2c2c', '2flips', '4flips', '2twists', '3twists', 'parity', 'ltct', '5style',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export function loadNightmareTable(name: TableName): Promise<string[][]> {
  return fetchJson<string[][]>(`nightmare/${name}.json`);
}

/** 某人公开公式表的链接:先按 case 类型找,再退 3bld,再退通用 bld。 */
export function sourceLink(sourceUrl: SourceToUrl | null, name: string, type: BlddbType): string | undefined {
  const row = sourceUrl?.[name];
  if (!row) return undefined;
  return row[type] ?? row['3bld'] ?? row['bld'];
}
