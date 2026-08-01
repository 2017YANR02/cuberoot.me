// BLDDB(nbwzx/blddb)人工整理公式集的读取层 —— 给 /alg/3bld/lookup 用。
//
// 数据是 fork 同步下来的那份(`tools/blddb/data/*Manmade.json` + `data/bigbld/*`,由
// _sync_blddb.ps1 落地),不入 client bundle,运行时按需拉。穷举生成的 Nightmare 全集
// (37MB)不在这里,那套只在 iframe 版 /blddb 里。
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

/** 库里的十个 case 类型。前六个是三阶,后四个是高阶盲拧。 */
export type BlddbType =
  | 'edge' | 'corner' | 'parity' | 'twists' | 'flips' | 'ltct'
  | 'wing' | 'xcenter' | 'tcenter' | 'midge';

/** 块类型 —— 决定"下一个贴纸"怎么走。 */
export type BlddbPiece = 'corner' | 'edge';

export const BLD3_TYPES: BlddbType[] = ['edge', 'corner', 'parity', 'twists', 'flips', 'ltct'];
/** 高阶盲拧四套。四阶只有翼棱 + X 中心,五阶四套都用得上。 */
export const BIGBLD_TYPES: BlddbType[] = ['wing', 'xcenter', 'tcenter', 'midge'];
export const BLDDB_TYPES: BlddbType[] = [...BLD3_TYPES, ...BIGBLD_TYPES];

export function isBigbld(type: BlddbType): boolean {
  return BIGBLD_TYPES.includes(type);
}

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
 * 字母表分档 —— 上游 codeTypeToPositions 那几档:
 *  - `corner` / `edge`:全部 24 个贴纸;
 *  - `corner1`:角块上不在 U/D 面的那 16 个贴纸(翻角只用得到这些);
 *  - `edge0`:每条棱选一个代表贴纸(U/D 面的 8 个 + FL/FR/BL/BR),共 12 个 —— 翻棱
 *    只认这一档,因为"这条棱翻了"跟用哪面贴纸称呼它无关;
 *  - `wing` / `xcenter` / `tcenter` / `midge`:高阶盲拧那四档,见下面 BIG_BASE。
 */
export type SlotKind = 'corner' | 'edge' | 'corner1' | 'edge0' | 'wing' | 'xcenter' | 'tcenter' | 'midge';

const EDGE0_EXTRA = new Set(['FL', 'FR', 'BL', 'BR']);

/**
 * 高阶那四档挂在三阶哪一套贴纸上 —— **编码完全共用三阶的字母**,只是块换了:
 *  - 中棱(midge)就是三阶的棱贴纸,连位置名都一样(`UB`);
 *  - T 中心贴在棱旁边,`UB` → `Ub`,字母跟那条棱同一个;
 *  - X 中心贴在角旁边,`UBL` → `Ubl`,字母跟那个角同一个;
 *  - 翼棱一条棱两片,只有一片被编码(见 wingName),`UB` → `UBl`。
 * 这也是为什么这里不需要单独一套 150 格的高阶编码表。
 */
const BIG_BASE: Partial<Record<SlotKind, BlddbPiece>> = {
  wing: 'edge', tcenter: 'edge', midge: 'edge', xcenter: 'corner',
};

function inKind(pos: string, kind: SlotKind): boolean {
  const big = BIG_BASE[kind];
  if (big) return pos.length === (big === 'corner' ? 3 : 2);
  if (kind === 'corner') return pos.length === 3;
  if (kind === 'edge') return pos.length === 2;
  if (kind === 'corner1') return pos.length === 3 && pos[0] !== 'U' && pos[0] !== 'D';
  return pos.length === 2 && (pos[0] === 'U' || pos[0] === 'D' || EDGE0_EXTRA.has(pos));
}

// ── 高阶位置名 ─────────────────────────────────────────────────────────────

/** 六个面的单位向量,右手系:x 向 R、y 向 U、z 向 F。 */
const FACE_VEC: Readonly<Record<string, readonly [number, number, number]>> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
};

/**
 * 从 X 面外侧看,绕着 X 逆时针数,Y 的下一个邻面 —— 就是叉积 X × Y。
 * (U × B = L:从上面看,B 的逆时针方向是 L。)
 */
function ccwFace(x: string, y: string): string {
  const a = FACE_VEC[x];
  const b = FACE_VEC[y];
  const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Object.keys(FACE_VEC).find((f) => FACE_VEC[f].every((c, i) => c === v[i])) ?? x;
}

/**
 * 三阶贴纸名 → 高阶那一档的位置名。
 *
 * 翼棱是唯一要动脑的:一条棱有两片翼,`UB` 这一侧的两片是 `UBl` / `UBr`,而 `UBl` 与
 * `BUl` 是**同一块**的两面。彳亍(和 Speffz)只给每块翼棱编一个字母,落在 `XY + ccw(X,Y)`
 * 那一片上 —— 于是 24 个棱贴纸名恰好一一对应 24 块翼棱,复用棱的字母表。
 */
function bigbldName(base: string, kind: SlotKind, wingAlt = false): string {
  switch (kind) {
    case 'tcenter': return base[0] + base[1].toLowerCase();
    case 'xcenter': return base[0] + base.slice(1).toLowerCase();
    // 非标准约定编在另一片上,那片正好是顺时针方向(叉积交换两项就变号)。
    case 'wing': return base + (wingAlt ? ccwFace(base[1], base[0]) : ccwFace(base[0], base[1])).toLowerCase();
    default: return base; // midge 与三阶棱同名
  }
}

/**
 * 高阶位置名 → 三阶贴纸名(中棱同名,不必登记)。翼棱两种约定的名字互不重叠
 * (一条棱四片:标准占两片,非标准占另两片),所以两套可以并存在同一张表里。
 */
const BASE_OF_BIG: Record<string, string> = {};
for (const kind of ['wing', 'tcenter', 'xcenter'] as const) {
  for (const p of POSITIONS_48) {
    if (!inKind(p, kind)) continue;
    BASE_OF_BIG[bigbldName(p, kind)] = p;
    if (kind === 'wing') BASE_OF_BIG[bigbldName(p, kind, true)] = p;
  }
}

/** 某一档的位置名(下拉选项用的顺序 = 48 格顺序)。 */
export function kindPositions(kind: SlotKind, wingAlt = false): string[] {
  return POSITIONS_48.filter((p) => inKind(p, kind)).map((p) => bigbldName(p, kind, wingAlt));
}

/** 某个位置在指定编码方案下的字母。高阶位置名先折回它挂着的三阶贴纸。 */
export function letterAtPosition(pos: string, scheme: SchemeId): string {
  const i = POSITIONS_48.indexOf(BASE_OF_BIG[pos] ?? pos);
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

const pieceOfKind = (kind: SlotKind): BlddbPiece =>
  kind === 'corner' || kind === 'corner1' || kind === 'xcenter' ? 'corner' : 'edge';

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
  // 高阶四套都是三循环,四套都带换位子列。
  wing: { slots: ['wing', 'wing', 'wing'], hasComm: true },
  xcenter: { slots: ['xcenter', 'xcenter', 'xcenter'], hasComm: true },
  tcenter: { slots: ['tcenter', 'tcenter', 'tcenter'], hasComm: true },
  midge: { slots: ['midge', 'midge', 'midge'], hasComm: true },
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

/**
 * 非标准翼棱约定 ↔ 库里的标准约定。上游把这个做成开关(`code.wingCodeSetting`:
 * 标准编在 `UFr`、非标准编在 `FUr`),两种约定下**一条棱的两块翼互换字母** ——
 * 选错不会报错,只会静默给出另一块翼的公式,所以这一步不能省。
 * 是对合,进出用同一个函数。
 */
function wingSwap(code: string, type: BlddbType): string {
  if (type !== 'wing') return code;
  return [...code].map((c) => (c === WILDCARD ? c : nearedge(c))).join('');
}

export function codeToChichu(code: string, type: BlddbType, scheme: SchemeId, wingAlt = false): string {
  const s = convertCode(code, type, (c, p) => toChichu(c, p, scheme));
  return wingAlt ? wingSwap(s, type) : s;
}

export function codeFromChichu(code: string, type: BlddbType, scheme: SchemeId, wingAlt = false): string {
  const s = wingAlt ? wingSwap(code, type) : code;
  return convertCode(s, type, (c, p) => fromChichu(c, p, scheme));
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
    case 'midge':
      // 中棱就是三阶的棱。
      return displaceAndRotate(code, 'edge');
    case 'wing':
    case 'xcenter':
    case 'tcenter':
      // 这三档一块只有一个被编码的贴纸,没有"换贴纸"这一步,只剩循环移位。
      return rotations(code);
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

/**
 * 两个字母是不是落在同一块上 —— 按档判,别一律拿棱 / 角的"换贴纸"去套:
 * 翼棱 / 中心那三档一块一个字母,`nearedge(E) = F` 指的是**另一块**翼棱,不是同一块。
 */
export function samePiece(a: string, b: string, kind: SlotKind): boolean {
  if (kind === 'wing' || kind === 'xcenter' || kind === 'tcenter') return a === b;
  return sameSticker(a, b, pieceOfKind(kind));
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
 * 所以想同时看两边的人可以顺手拿到。只有纯三循环那几套有意义 —— 奇偶 / 翻角 / 翻棱
 * 都是对合(自己就是自己的逆),奇偶带翻的逆不在同一套编码里。
 */
const INVERSE_TYPES = new Set<BlddbType>([
  'corner', 'edge', 'wing', 'xcenter', 'tcenter', 'midge',
]);

export function hasInverseCase(type: BlddbType): boolean {
  return INVERSE_TYPES.has(type);
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

/**
 * 位置名镜像到 M 平面另一侧 —— 面名里的 L / R 互换,其余不动(UFR→UFL、RU→LU)。
 * 高阶位置名里表示偏移方向的那位是小写面名(`Ul` / `UBl`),同样要换。
 */
export function mirrorPosition(pos: string): string {
  return pos.replace(/[LRlr]/gu, (c) => ({ L: 'R', R: 'L', l: 'r', r: 'l' })[c] ?? c);
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
      const kind = slotKind(type, i);
      const pos = POS_OF_LETTER[pieceOfKind(kind)][c];
      if (!pos) return c;
      const m = mirrorPosition(pos);
      // 翼棱:镜面把手性也翻了,`XY + ccw(X,Y)` 镜过去落在**没被编码**的那一片上
      // (ccw 是叉积,镜像反射行列式为 -1,叉积跟着变号)。同一块的另一片就是 `YX`。
      return LETTER_OF_POS[kind === 'wing' ? m[1] + m[0] : m] ?? c;
    })
    .join('');
}

/** 结果排序:按当前编码的字母,或按位置在 48 格里的顺序。 */
export type BlddbOrder = 'letter' | 'position';

/** 排序键 —— 拿命中写法的**第一个通配位**(没有就整串)去比。 */
export function orderKey(writing: string, type: BlddbType, scheme: SchemeId, order: BlddbOrder): string {
  if (order === 'position') {
    return positionsOf(writing, type)
      .map((p) => String(POSITIONS_48.indexOf(BASE_OF_BIG[p] ?? p)).padStart(2, '0'))
      .join('');
  }
  return codeFromChichu(writing, type, scheme);
}

// ── 位置描述 ───────────────────────────────────────────────────────────────

/** 一串彳亍码逐位翻成位置名(通配位给 `*`)。 */
export function positionsOf(code: string, type: BlddbType, wingAlt = false): string[] {
  // 非标准约定下这一位指的是同一条棱的另一块翼,先换回用户认的那块。
  const src = wingAlt ? wingSwap(code, type) : code;
  return [...src].map((c, i) => {
    if (c === WILDCARD) return WILDCARD;
    const kind = slotKind(type, i);
    const pos = POS_OF_LETTER[pieceOfKind(kind)][c];
    return pos ? bigbldName(pos, kind, wingAlt) : c;
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
  return fetchJson<BlddbSet>(`${isBigbld(type) ? 'bigbld/' : ''}${type}Manmade.json`);
}

/**
 * 按作者成绩筛公式时看哪一项 —— 高阶那四套看四盲单次(与上游 settings 的两个开关同)。
 * 只会三阶的人拿三盲成绩筛翼棱公式没有意义。
 */
export function resultKey(type: BlddbType): '3bld' | '4bld' {
  return isBigbld(type) ? '4bld' : '3bld';
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

/** 某人公开公式表的链接:先按 case 类型找,再退整套(3bld / bigbld),再退通用 bld。 */
export function sourceLink(sourceUrl: SourceToUrl | null, name: string, type: BlddbType): string | undefined {
  const row = sourceUrl?.[name];
  if (!row) return undefined;
  return row[type] ?? row[isBigbld(type) ? 'bigbld' : '3bld'] ?? row['bld'];
}
