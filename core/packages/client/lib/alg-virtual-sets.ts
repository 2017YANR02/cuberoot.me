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
import { LISTED_CASES } from './lsll/model';
import {
  LSLL_ROUNDS, LSLL_TRAINER_NOTE, lsllCaseKeyString, lsllNextRoundScope, lsllRoundLabel, lsllRoundScope,
  lsllScopeLabel, lsllSelectHref, loadLsllCases, parseLsllScope, resolveLsllCase,
} from './lsll/trainer-set';

export interface VirtualAlgSet {
  puzzle: AlgPuzzle;
  slug: string;
  /** 顶栏集名。 */
  meta: { en: string; zh: string };
  /** 关于这批公式的实话(如「机器解,没优化步数」),进设置面板。 */
  note: { en: string; zh: string };
  /**
   * 这一套一共几个 case —— 进度页那条进度条的分母。
   *
   * 库内集的分母来自 `/v1/alg/sets` 的 `count`(数 `alg_cases` 的行);虚拟集在库里
   * 没有行,所以必须自己报,否则进度页只剩一个孤零零的分子。数的是**标记 / 排期
   * 落在哪个 key 空间**:LSLL 的 case key 是一步局面,所以是 579,368,不是两步路线
   * 那个 149,188(同一个局面走两步路线到达,key 仍是同一个)。
   */
  totalCases: number;
  /** 本场练哪一批。scope 取自 `?scope=`,认不出由各集自己兜底。 */
  loadCases: (scope: string | null) => Promise<AlgCase[]>;
  /** 「选 case」按钮的去处(虚拟集没有 select 页)。 */
  selectHref: (scope: string | null) => string;
  /** 范围名,接在顶栏集名后面。 */
  scopeLabel: (scope: string | null) => { en: string; zh: string };
  /**
   * 这个范围是「一轮一轮往下走」的吗?是就给轮次名(贴在复习进度前面:第 3 / 494 轮 12/302),
   * 并给出下一轮的 `?scope=`(最后一轮返回 null)。不分轮的范围两个都返 null。
   */
  roundLabel?: (scope: string | null) => { en: string; zh: string } | null;
  nextRoundScope?: (scope: string | null) => string | null;
  /** 当前轮次与轮次 → scope 映射;两者齐备时训练页显示轮次选择器。 */
  roundNumber?: (scope: string | null) => number | null;
  scopeForRound?: (round: number) => string;
  /**
   * 一共几轮。进度页拿它当「过完 N / 494 轮」的分母 —— 57 万个 case 的进度条永远是一条
   * 细线,轮次才是这套集里唯一看得见的进度。不分轮的虚拟集不填。
   */
  totalRounds?: number;
  /**
   * 这套集**默认不开**首尾随机 AUF(开关照旧在,想开随时开)。
   *
   * LSLL 打的就是「这个 case 的最短打乱」—— 库里那条是整方 HTM 最优解,取逆得到的打乱
   * 长度恰好等于最优步数,没有更短的。再随机接首尾 AUF 会让它凭空长 0~2 步,而这条管道
   * 五天的算力买的就是那几步。
   */
  noAufDefault?: boolean;
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
    totalCases: LISTED_CASES,
    loadCases: loadLsllCases,
    selectHref: lsllSelectHref,
    scopeLabel: lsllScopeLabel,
    roundLabel: lsllRoundLabel,
    nextRoundScope: lsllNextRoundScope,
    roundNumber: scope => {
      const parsed = parseLsllScope(scope);
      return parsed.category ? null : parsed.round;
    },
    scopeForRound: lsllRoundScope,
    totalRounds: LSLL_ROUNDS,
    noAufDefault: true,
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
