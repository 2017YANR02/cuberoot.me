/**
 * LSLL 接进公用训练器 —— `/alg/3x3/lsll/run` 与 `/alg/3x3/zbll/run` 是同一个页面、
 * 同一套模式(训练 / 复习 / 记忆)、同一份进度标记。LSLL 这边只回答两件事:
 * 「本场有哪些 case」和「这个 case 的打乱长什么样」。
 *
 * 与库内公式集的两点不同,都由 `lib/alg-virtual-sets` 那层吸收:
 *  1. case 不在 PG,是按大类现场组合枚举的(583,284 个,建不了表也装不进一场)——
 *     所以一场只练一个范围:已收录公式的 305 个,或某个大类(可再按翻棱数细分)。
 *  2. 没有公式表,连打乱都得现算(cubing.js 两阶段解取逆,一条 ≈ 百毫秒)——
 *     case 进来时 `setup` 是空的,store 抽到哪条解哪条,解出来原地写回;
 *     顺带把解的逆当作该 case 的一条公式,记忆模式的「揭示」才有东西可揭。
 */
import type { AlgCase, AlgSticker } from '@cuberoot/shared';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';
import {
  categoryBySlug, classify, decodeKey, displayState, enumerateCategory,
  keyFromString, keyToString, unpackState,
} from './model';
import { ZBLS_COVERED_KEYS } from './zbls_overlay';

/** 全 LSLL case 共用一张贴纸描述 —— 图怎么画由 CaseThumb 按 set 决定(同 zbls:iso + vh 遮罩)。 */
const LSLL_STICKER: AlgSticker = Object.freeze({ kind: 'raw', tag: 'lsll', attrs: {} });

/**
 * 默认范围:站内 zbls 公式集覆盖到的那批 —— 唯一一批有人写公式可对照的。
 * 库里 305 条,这里练 302 条:O 组那 3 条对子已经在槽里、只差翻棱,合成出来的局面是纯顶层
 * (`model.LsllCategory.pureLL`),LSLL 一概不收。
 */
export const LSLL_SCOPE_COVERED = 'zbls';

export interface LsllScope {
  /** 大类 slug;已收录范围为 null。 */
  category: string | null;
  /** 翻棱数筛选(大类页的 EO 过滤带过来);不筛为 null。 */
  eoBad: number | null;
}

/**
 * `?scope=` 的写法:`zbls` = 已收录那批;`ap` = 大类 A+;`ap-eo2` = A+ 里翻 2 棱的。
 * 认不出的一律退回已收录 —— 只可能来自手改 URL,退回比空场好。
 */
export function parseLsllScope(scope: string | null | undefined): LsllScope {
  const s = (scope ?? '').trim().toLowerCase();
  if (!s || s === LSLL_SCOPE_COVERED) return { category: null, eoBad: null };
  const m = /^([a-z]+)(?:-eo(\d+))?$/.exec(s);
  const cat = m && categoryBySlug(m[1]);
  // `pureLL` 的那一类(O)是纯顶层,LSLL 不练它 —— 直链进来退回已收录那批
  if (!m || !cat || cat.pureLL) return { category: null, eoBad: null };
  return { category: m[1], eoBad: m[2] == null ? null : Number(m[2]) };
}

/** 反过来:大类(+ 翻棱数)→ `?scope=` 的值。 */
export function lsllScopeParam(category: string | null, eoBad?: number | null): string {
  if (!category) return LSLL_SCOPE_COVERED;
  return eoBad == null || eoBad < 0 ? category : `${category}-eo${eoBad}`;
}

/** 范围的人话名字(进训练页顶栏)。 */
export function lsllScopeLabel(scope: string | null): { en: string; zh: string } {
  const { category, eoBad } = parseLsllScope(scope);
  if (!category) return { en: 'with algs', zh: '已收录' };
  const letter = categoryBySlug(category)?.letter ?? category.toUpperCase();
  if (eoBad == null) return { en: letter, zh: letter };
  return { en: `${letter} · ${eoBad}EO`, zh: `${letter} 翻${eoBad}棱` };
}

/** 「选 case」按钮的去处 —— 虚拟集没有 select 页,回它自己的浏览页挑范围。 */
export function lsllSelectHref(scope: string | null): string {
  const { category, eoBad } = parseLsllScope(scope);
  if (!category) return '/alg/lsll';
  return eoBad == null ? `/alg/lsll/${category}` : `/alg/lsll/${category}?eo=${eoBad}`;
}

/** case 名 = `大类字母 + base36 canonical key`(`A+ 1x2y`)。键要稳(标记按它存),字母是给人看的。 */
function lsllCase(key: number, letter: string): AlgCase {
  return {
    name: `${letter} ${keyToString(key)}`,
    subgroup: letter,   // 与 zbls 库同一套组名(A+ / A- …),训练器的 case 树直接显示它
    setup: '',
    sticker: LSLL_STICKER,
    algs: [[]],
  };
}

/** 从 case 名取回 canonical key(`/alg/lsll/case?k=` 与现算打乱都要它)。 */
export function lsllCaseKeyString(c: AlgCase): string {
  return c.name.slice(c.name.lastIndexOf(' ') + 1);
}

/** 本场练哪一批。范围见 {@link parseLsllScope};大类最大 15,552 个,已收录 305 个。 */
export async function loadLsllCases(scope: string | null): Promise<AlgCase[]> {
  const { category, eoBad } = parseLsllScope(scope);
  if (!category) {
    // 已收录那批横跨多个大类 —— 各自 classify 一次拿到自己的大类,再按全站组名序排
    // (同字母 `+` 在 `-` 前),组内按 case 编号,免得 case 树是 JSON 的随机顺序。
    const out: { letter: string; key: number }[] = [];
    for (const s of ZBLS_COVERED_KEYS) {
      const key = keyFromString(s);
      if (key == null) continue;
      const cat = classify(unpackState(key)).category;
      if (cat.pureLL) continue;   // O 组:对子已归位,练的是顶层不是最后一槽
      out.push({ letter: cat.letter, key });
    }
    out.sort((a, b) => compareAlgGroupLabel(a.letter, b.letter) || a.key - b.key);
    return out.map(x => lsllCase(x.key, x.letter));
  }
  const cat = categoryBySlug(category)!;
  const keys = enumerateCategory(category);
  const picked = eoBad == null
    ? keys
    : keys.filter(k => classify(unpackState(k)).eoBad === eoBad);
  return picked.map(k => lsllCase(k, cat.letter));
}

/** 算过的打乱:一次两阶段解 ≈ 百毫秒,同一 case 换到第二遍不再付。`''` = 算失败,别反复重试。 */
const SETUP_CACHE = new Map<number, string>();

/**
 * 现算这个 case 的打乱,外加一条能解开它的公式(打乱取逆 —— 打乱本身就是两阶段解取的逆)。
 * 机器解:能解开,但没优化步数和指法,所以 {@link LSLL_TRAINER_NOTE} 要跟着一起说。
 */
export async function resolveLsllCase(c: AlgCase): Promise<{ setup: string; alg?: string } | null> {
  const key = keyFromString(lsllCaseKeyString(c));
  if (key == null) return null;
  const { setupForCase, solutionForSetup } = await import('./setup');
  const hit = SETUP_CACHE.get(key);
  if (hit !== undefined) return hit ? { setup: hit, alg: solutionForSetup(hit) } : null;
  const state = decodeKey(key);
  if (!state) return null;
  try {
    // 摆正相位再解 —— 打乱出来的对子位置必须与 case 图上的一致(model.pairDisplayTurn)
    const setup = await setupForCase(displayState(state));
    SETUP_CACHE.set(key, setup);
    return { setup, alg: solutionForSetup(setup) };
  } catch {
    SETUP_CACHE.set(key, '');
    return null;
  }
}

export const LSLL_TRAINER_NOTE = {
  zh: '打乱与公式都是现算的:两阶段机器解,能解开但没优化步数和指法。最优解与 MCC 推荐公式由后台管道逐步回填',
  en: 'Scrambles and algs are computed on the fly by a two-phase solver — valid, but not move- or fingertrick-optimised. Optimal / MCC algs are being backfilled',
};
