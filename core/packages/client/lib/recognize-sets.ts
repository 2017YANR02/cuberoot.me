/**
 * `/recognize/<set>` 的观察训练器,差异全在这一份定义里:题库、题图、答题输入、摊牌
 * 文案。页面和 store 只读这里,所以每个集合走的是同一条代码路径 —— 之前 OLL 那半截是
 * 「PLL 页面里塞了个 else 分支」,队列还是 PLL 的,查 OLL 公式表查不到,题图恒为还原态。
 *
 * ## 两处刻意不对称
 *
 * - **AUF 用什么招**:PLL 转 `d`(底两层),因为题图是等距全彩,底层转了侧面配色才会变;
 *   OLL 题图只有顶面 + 顶排一圈,`U` 就够了,而且 `U` 正是解法里真会遇到的那个 AUF。
 * - **一轮多少题**:PLL 把 21 个 case 按对称性展开成 73 个朝向(H 只有 1 个,N/E/Z 各 2 个);
 *   OLL 57 个 case 各出一次、AUF 随机,再展开成 228 就没人做得完了。
 *
 * COLL / ELL / ZBLL / 1LLL 的题库在 `alg_cases` 表里,定义在 `recognize-db-sets`,
 * 按同一份契约拼出来,这里只把它们并进 {@link RECOGNIZE_SETS}。
 */
import ollMap from '@cuberoot/shared/data/oll.json';
import pllMap from '@cuberoot/shared/data/pll.json';
import { inverseScramble, scrambleForCase, type PllCaseInstance } from './scramble-generator';
import {
  allPllKeys, isPllLetter, isSingleLetterPll, isTwoLetterPllPrefix, validPllSuffixes,
  D_TURN_OPTIONS,
} from './pll-helpers';
import { displayOllName, displayPllName, OLL_NAME_BY_NUMBER } from './alg_case_display';
import { DB_RECOGNIZE_SETS, isDbRecognizeSetId, type DbRecognizeSetId } from './recognize-db-sets';

const typedOllMap = ollMap as Record<string, { name: string; alg: string }>;
const typedPllMap = pllMap as Record<string, Record<string, string>>;

export type RecognizeSetId = 'pll' | 'oll' | DbRecognizeSetId;

/** 敲一下键之后该干嘛。`pending` 是还没凑齐的前缀(`G_` / `1_`),显示在提示行上。 */
export type KeyStep =
  | { kind: 'ignore' }
  | { kind: 'pending'; pending: string }
  | { kind: 'answer'; answer: string };

export interface RecognizeButton {
  /** 提交的答案 —— 必须等于 case 的 DB 名(`Aa` / `OLL 27`)。 */
  value: string;
  label: string;
  /** 副标(OLL 的编号);没有就不渲染。 */
  sub?: string;
}

export interface RecognizeImage {
  setup: string;
  view: 'iso' | 'plan' | 'pll-iso' | 'oll' | 'pll' | 'f2l';
  size: number;
  /** visualcube 遮罩(COLL 压灰棱块)。 */
  mask?: string;
  hideGreySides?: boolean;
}

export interface RecognizeSet {
  id: RecognizeSetId;
  /** localStorage key。两个集合各存各的,换一边不会把另一边的进度冲掉。 */
  storageKey: string;
  /** 一轮评估的全部题面键(`case 名/整体旋转`)。 */
  allKeys: () => string[];
  /** 每题从中随机取一个的 AUF;`''` = 不 AUF,排在第一个(`includeNoAuf` 靠位置切掉它)。 */
  turnOptions: string[];
  includeNoAuf: boolean;
  /** 题图。`mistake` 时可以换一张更好认的(PLL 摊牌用彩色等距图)。 */
  image: (c: PllCaseInstance, mistake: boolean) => RecognizeImage;
  /** 人看的 case 名:`OLL 27` → `S+ (27)`。 */
  label: (name: string) => string;
  /**
   * 该 case 的正确答案(默认 = case 名)。答子组的集合(ZBLL / 1LLL)在这里把
   * case 名折成子组 —— 判定和摊牌提示都走它,`label` 仍给完整 case 名。
   */
  answerFor?: (name: string) => string;
  /** 摊牌提示里要按的那个东西;不给 = `label`。 */
  answerLabel?: (name: string) => string;
  /** 摊牌时给的公式。 */
  solution: (name: string) => string;
  /** 函数而非常量:DB 题库的按钮要等 {@link load} 拉完才知道。 */
  buttons: () => RecognizeButton[];
  /** 题库要现拉的集合(DB 集)在这里拉;拉完才有 `allKeys` / `buttons`。 */
  load?: () => Promise<void>;
  prompt: { zh: string; en: string };
  step: (pending: string | null, key: string) => KeyStep;
}

// ---------------------------------------------------------------- PLL

const PLL_BUTTONS: RecognizeButton[] = [
  'Aa', 'Ab', 'E', 'F', 'Ga', 'Gb', 'Gc', 'Gd', 'H', 'Ja', 'Jb',
  'Na', 'Nb', 'Ra', 'Rb', 'T', 'Ua', 'Ub', 'V', 'Y', 'Z',
].map((value) => ({ value, label: value }));

const pllStep = (pending: string | null, key: string): KeyStep => {
  if (pending) {
    const suffixes = validPllSuffixes[pending];
    const suffix = key.toLowerCase();
    if (suffixes?.includes(suffix)) return { kind: 'answer', answer: pending + suffix };
    return { kind: 'ignore' };
  }
  const letter = key.toUpperCase();
  if (!isPllLetter(letter)) return { kind: 'ignore' };
  if (isSingleLetterPll(letter)) return { kind: 'answer', answer: letter };
  if (isTwoLetterPllPrefix(letter)) return { kind: 'pending', pending: letter };
  return { kind: 'ignore' };
};

export const PLL_SET: RecognizeSet = {
  id: 'pll',
  // 改名会把老用户的训练记录变成孤儿 —— 这个 key 是 PLL 训练器从 Vite 时代用到现在的。
  storageKey: 'cuberoot-session-store',
  allKeys: () => allPllKeys(typedPllMap),
  turnOptions: D_TURN_OPTIONS,
  includeNoAuf: false,
  image: (c, mistake) => ({
    setup: scrambleForCase(c, typedPllMap),
    view: mistake ? 'pll-iso' : 'iso',
    size: 350,
  }),
  label: displayPllName,
  solution: (name) => typedPllMap[name]?.noAuf ?? '',
  buttons: () => PLL_BUTTONS,
  prompt: { zh: '这是哪个 PLL？输入公式名字', en: 'Which PLL is this? Type the algorithm name' },
  step: pllStep,
};

// ---------------------------------------------------------------- OLL

export const OLL_COUNT = 57;

/** `27` → `OLL 27`,也就是 DB / oll.json 里的 case 名。 */
export const ollCaseName = (n: number): string => `OLL ${n}`;

/** `OLL 27` → 27;不是这个格式返 null。 */
export const ollCaseNumber = (name: string): number | null => {
  const m = /^OLL\s+(\d+)$/.exec(name.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= OLL_COUNT ? n : null;
};

const OLL_BUTTONS: RecognizeButton[] = Array.from({ length: OLL_COUNT }, (_, i) => {
  const n = i + 1;
  return { value: ollCaseName(n), label: OLL_NAME_BY_NUMBER[n] ?? String(n), sub: String(n) };
});

/**
 * 编号输入。57 个 case,只有 1..5 开头的可能还要再接一位(10..57),6..9 开头当场就唯一,
 * 所以那四个直接交卷,不用等回车。1..5 停在 pending,回车按一位数交卷。
 */
const ollStep = (pending: string | null, key: string): KeyStep => {
  if (key === 'Enter') {
    const n = pending ? Number(pending) : NaN;
    return n >= 1 && n <= OLL_COUNT ? { kind: 'answer', answer: ollCaseName(n) } : { kind: 'ignore' };
  }
  if (!/^[0-9]$/.test(key)) return { kind: 'ignore' };
  const next = (pending ?? '') + key;
  const n = Number(next);
  if (n < 1 || n > OLL_COUNT) return { kind: 'ignore' };
  if (next.length >= 2 || n > 5) return { kind: 'answer', answer: ollCaseName(n) };
  return { kind: 'pending', pending: next };
};

export const OLL_SET: RecognizeSet = {
  id: 'oll',
  storageKey: 'cuberoot-session-store-oll',
  // 57 个 case 各一次;朝向不进 key,交给 turnOptions 每轮随机。
  allKeys: () => Array.from({ length: OLL_COUNT }, (_, i) => `${ollCaseName(i + 1)}/`),
  turnOptions: ['', 'U', 'U2', "U'"],
  includeNoAuf: true,
  image: (c) => ({
    // oll.json 存的是解法,题面是它的逆;AUF 接在最后 = 摆好之后再拧一下顶层。
    setup: `${inverseScramble(typedOllMap[c.name]?.alg ?? '')} ${c.dTurn}`.replace(/\s+/g, ' ').trim(),
    view: 'oll',
    size: 240,
    // 侧面那圈灰格只是「这里不是黄」的占位,和 /alg 库里的 OLL 图同一观感。
    hideGreySides: true,
  }),
  label: displayOllName,
  solution: (name) => typedOllMap[name]?.alg ?? '',
  buttons: () => OLL_BUTTONS,
  prompt: { zh: '这是哪个 OLL？输入编号', en: 'Which OLL is this? Type its number' },
  step: ollStep,
};

export const RECOGNIZE_SETS: Record<RecognizeSetId, RecognizeSet> = {
  pll: PLL_SET,
  oll: OLL_SET,
  ...DB_RECOGNIZE_SETS,
};

export const isRecognizeSetId = (v: string): v is RecognizeSetId =>
  v === 'pll' || v === 'oll' || isDbRecognizeSetId(v);

/** 不认识的 set 一律当 PLL —— 路由只预渲染 RECOGNIZE_SETS 里那几个,兜底不该炸页面。 */
export const recognizeSetFor = (id: string): RecognizeSet =>
  isRecognizeSetId(id) ? RECOGNIZE_SETS[id] : PLL_SET;
