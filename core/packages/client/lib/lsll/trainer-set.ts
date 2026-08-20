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
import { caseKey } from '@/lib/trainer-case-key';
import {
  canonicalKey, categoryBySlug, classify, composeState, decodeKey, displayState, enumerateCategory,
  keyFromString, keyToString, rotateU, unpackState, type LsllState,
} from './model';
import { ZBLL_CASE_COUNT, zbllRoundKeys } from './class3';
import { ZBLS_COVERED_KEYS } from './zbls_overlay';

/**
 * 已收录范围一共几轮 = 494 个 ZBLL case。
 *
 * 每一轮都是那 302 条 ZBLS case,各自接上一个 ZBLL 收尾(`model.composeState`);
 * 走完 494 轮 = 302 × 494 = 149,188 条两步路线,一条不落。
 *
 * 路线定了还差一步:两半之间那个 mid-AUF 插几下,决定整条落在哪个 LSLL case 上 ——
 * 由 {@link routeVariants} 摊开 ≤4 种,{@link shortestVariant} 取整方最优最短的那个。
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

/**
 * 一条两步路线 (ZBLS φ, ZBLL ζ) 的 mid-AUF 变体 —— 做完 ZBLS、开始 ZBLL 之前插 `U^n`。
 *
 * 那一下 AUF 是**免费的**(不是解法的一部分,识别顶层本来就要转到位),所以 n 取 0..3 得到的
 * 4 个局面是同一条路线的 4 种走法,而**不是** 4 条路线。它们:
 *  - 第一眼完全一样 —— 槽对构型、槽角朝向、顶层翻棱都只由 φ 决定,`U^n` 只动 ZBLL 那半;
 *  - 收尾的 ZBLL case 也完全一样 —— `rotateU` 走的是 canonicalKey 里的 `a` 分量,ζ 不变;
 *  - 但**整条**落在不同的 LSLL case 上,最优步数可以差好几步。
 *
 * 返回按 n = 0,1,2,3 去重后的 canonical key,所以下标 0 恒为「不插 AUF」那个 ——
 * 挑最短时并列取它,口径与 2026-07-28 之前一致。变体数只由 ζ 决定:480 个 ZBLL 满 4 个、
 * 10 个塌成 2 个、4 个(含全解顶层)塌成 1 个,普查见 `/alg/lsll/PLAN.md`。
 */
export function routeVariants(zbll: LsllState, zbls: LsllState): number[] {
  const out: number[] = [];
  for (let n = 0; n < 4; n++) {
    const k = canonicalKey(composeState(rotateU(zbll, n), zbls));
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/**
 * 这一轮全部路线的全部变体,一次问完最优步数(`./optimal` 的批量口子,内部按 256 切并发)。
 *
 * 拿不到就返空表 —— 调用方退回「不插 AUF」,与 2026-07-28 之前的口径一模一样,
 * 训练器照常开场。这一层**绝不能**因为后端不在就把整场打掉。
 */
async function routeHtm(routes: { variants: number[] }[]): Promise<Map<number, number>> {
  try {
    const { lsllHtmBatch } = await import('./optimal');
    return await lsllHtmBatch(routes.flatMap(r => r.variants));
  } catch {
    return new Map();
  }
}

/**
 * ≤4 个 mid-AUF 变体里练哪一个:**最优步数最短**的那个。
 *
 * 并列、以及一个都没回填时取 `variants[0]`(= 不插 AUF)——「谁都没查到」和「本来就该走 0」
 * 走同一条路,所以后端不在时这一整层是恒等变换。
 */
function shortestVariant(variants: number[], htm: Map<number, number>): number {
  return variants.reduce((best, k) =>
    (htm.get(k) ?? Infinity) < (htm.get(best) ?? Infinity) ? k : best);
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

/** Rebuild one virtual LSLL case from the key persisted by alg progress. */
export function lsllCaseFromStoredKey(storedKey: string): AlgCase | null {
  const split = storedKey.indexOf('|');
  if (split <= 0) return null;

  const name = storedKey.slice(split + 1);
  const space = name.lastIndexOf(' ');
  if (space <= 0) return null;

  const key = keyFromString(name.slice(space + 1));
  if (key == null) return null;
  const state = decodeKey(key);
  if (!state || canonicalKey(state) !== key) return null;

  const category = classify(state).category;
  if (category.pureLL) return null;

  const c = lsllCase(key, category.letter);
  return caseKey(c) === storedKey ? c : null;
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
    const routes: { letter: string; variants: number[] }[] = [];
    let i = 0;
    for (const s of ZBLS_COVERED_KEYS) {
      const key = keyFromString(s);
      if (key == null) continue;
      const cat = classify(unpackState(key)).category;
      if (cat.pureLL) continue;   // O 组:对子已归位,练的是顶层不是最后一槽
      const zbll = unpackState(rounds[roundZbllIndex(round, i++)]);
      routes.push({ letter: cat.letter, variants: routeVariants(zbll, unpackState(key)) });
    }
    const htm = await routeHtm(routes);
    const out = routes.map(r => ({ letter: r.letter, key: shortestVariant(r.variants, htm) }));
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
 *  1. 后台管道算好的**整方 HTM 最优解**(`./optimal`),取逆当打乱 —— ≈13 步,揭示出来的也是最优解;
 *  2. 还没回填到的 case 退回现算两阶段解(`./setup`)—— ≈20 步,能解开但没优化步数和指法。
 *
 * **训练器这边不摆相位**:第 1 条走 `optimalSetup`,拿的是最短的那个 AUF 像,落在哪个相位随缘;
 * case 是同一个(canonical key 逐条验过),而训练器各处的图都从实际打乱渲染,跟着一起转 ——
 * 何况出题本来就带随机 post-AUF,相位早就是随机的。要钉相位的是 case 页,走 `setupForPhase`。
 * 第 2 条现算没有最优解可用,仍照展示相位算(`setupForCase` 的既有约定)。
 */
export async function resolveLsllCase(c: AlgCase): Promise<{ setup: string; alg?: string } | null> {
  const key = keyFromString(lsllCaseKeyString(c));
  if (key == null) return null;
  const state = decodeKey(key);
  if (!state) return null;

  const { lsllOptimal } = await import('./optimal');
  const opt = await lsllOptimal(key);
  if (opt) return { setup: opt.setup, alg: opt.alg };

  const want = displayState(state);
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

/** Load only persisted LSLL cases instead of enumerating the whole virtual set. */
export async function loadLsllCasesByKeys(keys: readonly string[]): Promise<AlgCase[]> {
  const cases = [...new Set(keys)]
    .map(lsllCaseFromStoredKey)
    .filter((c): c is AlgCase => c !== null);
  let cursor = 0;

  const worker = async () => {
    while (cursor < cases.length) {
      const c = cases[cursor++];
      try {
        const resolved = await resolveLsllCase(c);
        if (!resolved) continue;
        c.setup = resolved.setup;
        if (resolved.alg) c.algs = [[{ alg: resolved.alg }]];
      } catch {
        // Keep the recognizable case available even when its formula cannot resolve.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(4, cases.length) }, () => worker()),
  );
  return cases;
}

export const LSLL_TRAINER_NOTE = {
  zh: '打乱与公式取自后台算好的整方 HTM 最优解;还没算到的 case 退回现算两阶段解 —— 能解开,但步数和指法都没优化。'
    + '已收录范围按两步路线出题,ZBLS 与 ZBLL 之间那下 AUF 取让整条最短的那个',
  en: 'Scrambles and algs come from the backfilled whole-cube HTM optimum; cases not yet computed fall back to an '
    + 'on-the-fly two-phase solve — valid, but not move- or fingertrick-optimised. The "with algs" scope drills '
    + 'two-look routes, with the AUF between ZBLS and ZBLL chosen to make the whole route as short as possible',
};
