/**
 * 公式库那几套(COLL / ELL / ZBLL / 1LLL)的观察训练器 —— 题库不在前端静态 JSON 里,
 * 而是 `alg_cases` 表,走 `loadAlg` 现拉。除此之外和 PLL / OLL 完全同一条代码路径:
 * 题面、答题、摊牌全按 {@link RecognizeSet} 那份契约给,页面和 store 不认识「DB 集」这回事。
 *
 * ## 三处和 PLL / OLL 不同的地方
 *
 * - **不随机 AUF**。PLL / OLL 的 case 名对 AUF 不变(朝向是题面的一部分,名字不动);
 *   这四套的名字带角块换位 / 棱块排列,随手拧一下顶层就换了个 case —— 只能照 DB 里的
 *   `setup` 原样出题。
 * - **大套装答子组**。ZBLL 472 个 case、1LLL 3397 个,一个 case 一个按钮既排不下也不是
 *   人真正在做的事:ZBLL 答「顶层形状 + 角块换位」(40 个子组),1LLL 答 OLL 编号。
 *   答案映射走 `answerFor`,摊牌照样给完整 case 名和公式。
 * - **一轮抽题**。上面两套整套过一遍没人做得完,每轮随机抽 {@link ROUND_LIMIT} 题。
 *
 * 题图不自己拼参数:直接问 `cubeThumbParams` 要 —— 公式库列表里那张图和这里的题图必须
 * 是同一张(COLL 压灰棱、ELL / ZBLL 全彩俯视),两处各写一份迟早会分叉。
 */
import { loadAlg, type AlgCase } from '@cuberoot/shared';
import { cubeThumbParams } from '@/components/CaseThumb';
import { OLL_NAME_BY_NUMBER } from './alg_case_display';
import type { KeyStep, RecognizeButton, RecognizeImage, RecognizeSet } from './recognize-sets';
import { shuffle } from './pll-helpers';

/** ZBLL / 1LLL 一轮抽几题。整套过一遍是 472 / 3397 题,没人做得完。 */
export const ROUND_LIMIT = 60;

export type DbRecognizeSetId = 'coll' | 'ell' | 'zbll' | '1lll';

interface DbSpec {
  id: DbRecognizeSetId;
  /** `/alg/3x3/<slug>` 的那个 slug,同时也是 `loadAlg` 的 set 名。 */
  slug: string;
  /** 一轮抽几题;不给 = 整套。 */
  roundLimit?: number;
  /** case → 要答的东西。不给 = 答 case 名本身。 */
  answerFor?: (c: AlgCase) => string;
  /** 答案 → 按钮。不给 = 每个 case 一个按钮。 */
  buttonsFor?: (cases: AlgCase[]) => RecognizeButton[];
  /** 摊牌提示里怎么称呼那个答案;不给 = 答案原文。必须和按钮上的字对得上。 */
  answerLabelFor?: (answer: string) => string;
  /** 物理键盘输入(只有 1LLL 有:编号)。 */
  step?: (pending: string | null, key: string, answers: Set<string>) => KeyStep;
  /** 按钮文字长(ELL 的 `4 Flip Ua`)→ 键盘用宽轨道。 */
  wideKeys?: boolean;
  prompt: { zh: string; en: string };
}

const uniqueInOrder = (xs: string[]): string[] => [...new Set(xs)];

/** `1LLL` 的子组就是 OLL 编号(`'01'`..`'57'`,缺号的不出现)。 */
const ollNumberStep = (pending: string | null, key: string, answers: Set<string>): KeyStep => {
  const submit = (n: number): KeyStep => {
    const v = String(n).padStart(2, '0');
    return answers.has(v) ? { kind: 'answer', answer: v } : { kind: 'ignore' };
  };
  if (key === 'Enter') {
    const n = pending ? Number(pending) : NaN;
    return n >= 1 ? submit(n) : { kind: 'ignore' };
  }
  if (!/^[0-9]$/.test(key)) return { kind: 'ignore' };
  const next = (pending ?? '') + key;
  const n = Number(next);
  if (n < 1 || n > 57) return { kind: 'ignore' };
  // 6..9 开头当场唯一(没有 60+),1..5 还可能再接一位,停在 pending 等回车。
  if (next.length >= 2 || n > 5) return submit(n);
  return { kind: 'pending', pending: next };
};

const SPECS: Record<DbRecognizeSetId, DbSpec> = {
  coll: {
    id: 'coll',
    slug: 'coll',
    prompt: { zh: '这是哪个 COLL？', en: 'Which COLL is this?' },
  },
  ell: {
    id: 'ell',
    slug: 'ell',
    wideKeys: true,
    prompt: { zh: '这是哪个 ELL？', en: 'Which ELL is this?' },
  },
  zbll: {
    id: 'zbll',
    slug: 'zbll',
    roundLimit: ROUND_LIMIT,
    // 顶层形状 + 角块换位 = 选哪条公式真正要认的东西;棱块排列决定组内第几条,不进答案。
    answerFor: (c) => c.subgroup,
    // 按钮只写换位那半截(`U/UR` → `UR`):换位名本来就带着形状字母,不会重名,
    // 而 `AS/ASF` 这种全名在窄轨道里会被切掉。
    buttonsFor: (cases) => uniqueInOrder(cases.map((c) => c.subgroup)).map((v) => ({
      value: v, label: v.split('/').pop() ?? v,
    })),
    answerLabelFor: (a) => a.split('/').pop() ?? a,
    prompt: {
      zh: '这是哪个 ZBLL 子组？(顶层形状 + 角块换位)',
      en: 'Which ZBLL group is this? (OLL shape + corner permutation)',
    },
  },
  '1lll': {
    id: '1lll',
    slug: '1lll',
    roundLimit: ROUND_LIMIT,
    answerFor: (c) => c.subgroup,
    buttonsFor: (cases) => uniqueInOrder(cases.map((c) => c.subgroup))
      .sort()
      .map((v) => ({ value: v, label: OLL_NAME_BY_NUMBER[Number(v)] ?? v, sub: String(Number(v)) })),
    answerLabelFor: (a) => {
      const n = Number(a);
      return OLL_NAME_BY_NUMBER[n] ? `${OLL_NAME_BY_NUMBER[n]} (${n})` : a;
    },
    step: ollNumberStep,
    prompt: { zh: '这是哪个 OLL 形状？输入编号', en: 'Which OLL shape is this? Type its number' },
  },
};

interface Loaded {
  cases: AlgCase[];
  byName: Map<string, AlgCase>;
  buttons: RecognizeButton[];
  answers: Set<string>;
}

const loaded: Partial<Record<DbRecognizeSetId, Loaded>> = {};
const inFlight: Partial<Record<DbRecognizeSetId, Promise<void>>> = {};

const answerOf = (spec: DbSpec, c: AlgCase): string => (spec.answerFor ? spec.answerFor(c) : c.name);

/** 拉一次题库(已拉过 / 拉取中都不会重复发请求)。失败留空,页面照常渲染成 0 题。 */
export function ensureDbRecognizeCases(id: DbRecognizeSetId): Promise<void> {
  if (loaded[id]) return Promise.resolve();
  const pending = inFlight[id];
  if (pending) return pending;
  const spec = SPECS[id];
  const p = loadAlg('3x3', spec.slug)
    .then((file) => {
      const cases = file.cases;
      loaded[id] = {
        cases,
        byName: new Map(cases.map((c) => [c.name, c])),
        buttons: spec.buttonsFor
          ? spec.buttonsFor(cases)
          : cases.map((c) => ({ value: c.name, label: c.name.trim() })),
        answers: new Set(cases.map((c) => answerOf(spec, c))),
      };
    })
    .catch(() => { /* 网络挂了就是空题库,不炸页面 */ })
    .finally(() => { delete inFlight[id]; });
  inFlight[id] = p;
  return p;
}

const firstAlg = (c: AlgCase | undefined): string =>
  c?.algs.flat()[0]?.alg ?? c?.standard ?? '';

function makeSet(spec: DbSpec): RecognizeSet {
  const data = () => loaded[spec.id];
  const caseOf = (name: string) => data()?.byName.get(name);
  return {
    id: spec.id,
    storageKey: `cuberoot-session-store-${spec.id}`,
    load: () => ensureDbRecognizeCases(spec.id),
    allKeys: () => {
      const all = data()?.cases ?? [];
      const keys = all.map((c) => `${c.name}/`);
      return spec.roundLimit ? shuffle(keys).slice(0, spec.roundLimit) : keys;
    },
    // AUF 会换掉 case 名(见文件头注),所以只有「不 AUF」这一个选项。
    turnOptions: [''],
    includeNoAuf: true,
    image: (c): RecognizeImage => {
      const target = caseOf(c.name);
      const p = cubeThumbParams('3x3', spec.slug, target?.sticker ?? { kind: 'raw', tag: '', attrs: {} });
      return { setup: target?.setup ?? '', view: p.view, mask: p.mask, hideGreySides: p.hideGreySides, size: 260 };
    },
    label: (name) => name.trim(),
    answerLabel: (name) => {
      const target = caseOf(name);
      if (!target) return name.trim();
      const a = answerOf(spec, target);
      return spec.answerLabelFor ? spec.answerLabelFor(a) : a.trim();
    },
    solution: (name) => firstAlg(caseOf(name)),
    buttons: () => data()?.buttons ?? [],
    wideKeys: spec.wideKeys,
    prompt: spec.prompt,
    step: (pending, key) =>
      spec.step ? spec.step(pending, key, data()?.answers ?? new Set()) : { kind: 'ignore' },
    answerFor: (name) => {
      const target = caseOf(name);
      return target ? answerOf(spec, target) : name;
    },
  };
}

export const DB_RECOGNIZE_SETS: Record<DbRecognizeSetId, RecognizeSet> = {
  coll: makeSet(SPECS.coll),
  ell: makeSet(SPECS.ell),
  zbll: makeSet(SPECS.zbll),
  '1lll': makeSet(SPECS['1lll']),
};

export const isDbRecognizeSetId = (v: string): v is DbRecognizeSetId =>
  Object.prototype.hasOwnProperty.call(DB_RECOGNIZE_SETS, v);
