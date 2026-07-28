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
  canonicalKey, categoryBySlug, classify, composeState, decodeKey, displayState, enumerateCategory,
  keyFromString, keyToString, unpackState,
} from './model';
import { ZBLL_CASE_COUNT, zbllRoundKeys } from './class3';
import { ZBLS_COVERED_KEYS } from './zbls_overlay';

/**
 * 已收录范围一共几轮 = 494 个 ZBLL case。
 *
 * 每一轮都是那 302 条 ZBLS case,各自接上一个 ZBLL 收尾(`model.composeState`);
 * 走完 494 轮 = 302 × 494 = 149,188 条两步路线,一条不落。
 *
 * **一轮之内 302 个收尾各不相同**(见 {@link roundZbllIndex}):早先是「第 n 轮全体接第 n 个
 * ZBLL」,于是第 1 轮全体接的是「全解」顶层 —— 整轮都是纯 ZBLS,均值 9.28 步,而其余 493 轮
 * 全在 13.0 ~ 14.4 之间,第 1 轮成了唯一的异类,练起来也单调(一轮里翻来覆去只有一个顶层)。
 * 那 302 个纯 ZBLS 局面并没有丢:它们本来就是 zbls 公式集,`/alg/3x3/zbls/run` 有自己的入口。
 */
export const LSLL_ROUNDS = ZBLL_CASE_COUNT;

/**
 * 第 `round` 轮里,第 `i` 个 ZBLS case 配哪个 ZBLL(下标,0 起)。
 *
 * 错位对角:`(round - 1 + i) mod 494`。两条性质都要成立,缺一不可 ——
 *  - **轮内不重样**:i 走 0..301,302 < 494,同一轮里没有两个 ZBLS 撞到同一个 ZBLL;
 *  - **总量不漏**:固定 i,round 走 1..494 恰好把 494 个 ZBLL 各配一次 ⇒ 494 轮合起来仍是
 *    完整的 302 × 494 笛卡尔积,与旧排法覆盖同一批 canonical key(求解语料因此不受影响)。
 */
function roundZbllIndex(round: number, i: number): number {
  return (round - 1 + i) % LSLL_ROUNDS;
}

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
  /** 已收录范围的第几轮(1..494),见 {@link LSLL_ROUNDS};大类范围恒 1。 */
  round: number;
}

/**
 * `?scope=` 的写法:`zbls` = 已收录那批(第 1 轮);`zbls-r7` = 已收录那批的第 7 轮;
 * `ap` = 大类 A+;`ap-eo2` = A+ 里翻 2 棱的。
 * 认不出的一律退回已收录第 1 轮 —— 只可能来自手改 URL,退回比空场好。
 */
export function parseLsllScope(scope: string | null | undefined): LsllScope {
  const s = (scope ?? '').trim().toLowerCase();
  const covered = /^zbls(?:-r(\d+))?$/.exec(s);
  if (!s || covered) {
    const r = covered?.[1] ? Number(covered[1]) : 1;
    return { category: null, eoBad: null, round: r >= 1 && r <= LSLL_ROUNDS ? r : 1 };
  }
  const m = /^([a-z]+)(?:-eo(\d+))?$/.exec(s);
  const cat = m && categoryBySlug(m[1]);
  // `pureLL` 的那一类(O)是纯顶层,LSLL 不练它 —— 直链进来退回已收录那批
  if (!m || !cat || cat.pureLL) return { category: null, eoBad: null, round: 1 };
  return { category: m[1], eoBad: m[2] == null ? null : Number(m[2]), round: 1 };
}

/** 反过来:大类(+ 翻棱数)→ `?scope=` 的值。已收录范围的第 n 轮走 {@link lsllRoundScope}。 */
export function lsllScopeParam(category: string | null, eoBad?: number | null): string {
  if (!category) return LSLL_SCOPE_COVERED;
  return eoBad == null || eoBad < 0 ? category : `${category}-eo${eoBad}`;
}

/** 已收录范围第 n 轮的 `?scope=`(第 1 轮就是裸 `zbls`,链接短一点)。 */
export function lsllRoundScope(round: number): string {
  return round <= 1 ? LSLL_SCOPE_COVERED : `${LSLL_SCOPE_COVERED}-r${round}`;
}

/** 下一轮的 `?scope=`;已经是最后一轮(或不是已收录范围)返回 null。 */
export function lsllNextRoundScope(scope: string | null): string | null {
  const { category, round } = parseLsllScope(scope);
  if (category || round >= LSLL_ROUNDS) return null;
  return lsllRoundScope(round + 1);
}

/** 「第 n / 494 轮」—— 训练器进度徽章前面那一截。非已收录范围没有轮次,返回 null。 */
export function lsllRoundLabel(scope: string | null): { en: string; zh: string } | null {
  const { category, round } = parseLsllScope(scope);
  if (category) return null;
  return { zh: `第 ${round} / ${LSLL_ROUNDS} 轮`, en: `Round ${round}/${LSLL_ROUNDS}` };
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

/** 本场练哪一批。范围见 {@link parseLsllScope};大类最大 15,552 个,已收录每轮 302 个。 */
export async function loadLsllCases(scope: string | null): Promise<AlgCase[]> {
  const { category, eoBad, round } = parseLsllScope(scope);
  if (!category) {
    // 已收录那批横跨多个大类 —— 各自 classify 一次拿到自己的大类,再按全站组名序排
    // (同字母 `+` 在 `-` 前),组内按 case 编号,免得 case 树是 JSON 的随机顺序。
    // 收尾按 roundZbllIndex 错位分配:一轮之内 302 个 ZBLL 各不相同。下标 `i` 数的是
    // **过滤后**的名次(0..301),不是 ZBLS_COVERED_KEYS 里的原位置 —— 跳过的那 3 个不占号。
    const rounds = zbllRoundKeys();
    const out: { letter: string; key: number }[] = [];
    let i = 0;
    for (const s of ZBLS_COVERED_KEYS) {
      const key = keyFromString(s);
      if (key == null) continue;
      const cat = classify(unpackState(key)).category;
      if (cat.pureLL) continue;   // O 组:对子已归位,练的是顶层不是最后一槽
      const zbll = unpackState(rounds[roundZbllIndex(round, i++)]);
      out.push({ letter: cat.letter, key: canonicalKey(composeState(zbll, unpackState(key))) });
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

/** 现算过的打乱:一次两阶段解 ≈ 百毫秒,同一 case 换到第二遍不再付。`''` = 算失败,别反复重试。 */
const SETUP_CACHE = new Map<number, string>();

/**
 * 这个 case 的打乱,外加一条能解开它的公式。两条路,按这个顺序:
 *  1. 后台管道算好的**整方 HTM 最优解**(`./optimal`),取逆当打乱 —— ≈14 步,揭示出来的也是最优解;
 *  2. 还没回填到的 case 退回现算两阶段解(`./setup`)—— ≈20 步,能解开但没优化步数和指法。
 *
 * 两条都摆正相位再算:打乱出来的对子位置必须与 case 图上的一致(model.pairDisplayTurn)。
 */
export async function resolveLsllCase(c: AlgCase): Promise<{ setup: string; alg?: string } | null> {
  const key = keyFromString(lsllCaseKeyString(c));
  if (key == null) return null;
  const state = decodeKey(key);
  if (!state) return null;
  const want = displayState(state);

  const { lsllOptimal } = await import('./optimal');
  const opt = await lsllOptimal(key, want);
  if (opt) return { setup: opt.setup, alg: opt.alg };

  const { setupForCase, solutionForSetup } = await import('./setup');
  const hit = SETUP_CACHE.get(key);
  if (hit !== undefined) return hit ? { setup: hit, alg: solutionForSetup(hit) } : null;
  try {
    const setup = await setupForCase(want);
    SETUP_CACHE.set(key, setup);
    return { setup, alg: solutionForSetup(setup) };
  } catch {
    SETUP_CACHE.set(key, '');
    return null;
  }
}

export const LSLL_TRAINER_NOTE = {
  zh: '打乱与公式取自后台算好的整方 HTM 最优解;还没算到的 case 退回现算两阶段解 —— 能解开,但步数和指法都没优化',
  en: 'Scrambles and algs come from the backfilled whole-cube HTM optimum; cases not yet computed fall back to an on-the-fly two-phase solve — valid, but not move- or fingertrick-optimised',
};
