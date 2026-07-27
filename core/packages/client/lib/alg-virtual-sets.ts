/**
 * 虚拟公式集 —— 不在 alg 库(PG `alg_cases`)里、case 由前端现算的集,但要用**同一个**
 * 训练器练:`/alg/<puzzle>/<slug>/run` 就是 `/alg/3x3/zbll/run` 那个页面,模式、计时、
 * 轮盘、标记、间隔重复全部照旧,不另起一套小训练页。
 *
 * 目前只有 LSLL(见 `lib/lsll/trainer-set`)。它与库内集的差别收敛成下面几个口子:
 * case 从哪来、「选 case」按钮去哪、打乱怎么现算。别的地方一律不认识「虚拟集」这回事。
 *
 * 注意:虚拟集**不进** `ALG_CATALOG` —— 进了 `/alg/<puzzle>/<slug>` 集详情页与合练
 * 「加一套」就会去 `loadAlg` 拉一个不存在的库表。只有 run 路由认它。
 */
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import {
  LSLL_TRAINER_NOTE, lsllCaseKeyString, lsllScopeLabel, lsllSelectHref, loadLsllCases,
  resolveLsllCase,
} from './lsll/trainer-set';

export interface VirtualAlgSet {
  puzzle: AlgPuzzle;
  slug: string;
  /** 顶栏集名。 */
  meta: { en: string; zh: string };
  /** 关于这批公式的实话(如「机器解,没优化步数」),进设置面板。 */
  note: { en: string; zh: string };
  /** 本场练哪一批。scope 取自 `?scope=`,认不出由各集自己兜底。 */
  loadCases: (scope: string | null) => Promise<AlgCase[]>;
  /** 「选 case」按钮的去处(虚拟集没有 select 页)。 */
  selectHref: (scope: string | null) => string;
  /** 范围名,接在顶栏集名后面。 */
  scopeLabel: (scope: string | null) => { en: string; zh: string };
  /** case 详情页地址(卡片上的 case 名点进去)。 */
  caseHref: (c: AlgCase) => string;
  /**
   * `setup` 空着的 case 现算打乱 + 一条解法;算不出返 null。
   * store 拿到后原地写回 case(见 trainer-store 的 `caseResolver`)。
   */
  resolveCase: (c: AlgCase) => Promise<{ setup: string; alg?: string } | null>;
}

const REGISTRY: VirtualAlgSet[] = [
  {
    puzzle: '3x3',
    slug: 'lsll',
    meta: { en: 'LSLL', zh: 'LSLL' },
    note: LSLL_TRAINER_NOTE,
    loadCases: loadLsllCases,
    selectHref: lsllSelectHref,
    scopeLabel: lsllScopeLabel,
    caseHref: c => `/alg/lsll/case?k=${lsllCaseKeyString(c)}`,
    resolveCase: resolveLsllCase,
  },
];

export function virtualAlgSet(puzzle: AlgPuzzle, slug: string): VirtualAlgSet | undefined {
  return REGISTRY.find(v => v.puzzle === puzzle && v.slug === slug);
}

/** run 路由的 `generateStaticParams` 要把虚拟集也预渲染出来(它们不在 ALG_CATALOG 里)。 */
export const VIRTUAL_ALG_SET_PARAMS: ReadonlyArray<{ puzzle: string; set: string }> =
  REGISTRY.map(v => ({ puzzle: v.puzzle, set: v.slug }));
