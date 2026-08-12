/**
 * /alg/progress/cases 的纯数据层 —— 把「标记」和「记忆排期」两张表拍平成一份跨套的 case 清单。
 *
 * progress 页只给计数(「不熟 23」),点进来要的是那 23 个究竟是谁:哪张图、哪条公式、忘过几次。
 * 计数来自 `/v1/alg/marks` 的 GROUP BY,明细只能逐套拉 —— 所以这里收的是「已经拉回来的
 * 每套明细」,拉取本身在 store 层。
 *
 * 「未学」是补集不是集合:它 = 整套 case − 有状态的那些,必须先有整套 key 才算得出来。
 * 虚拟集(LSLL 57 万)给不出整套 key,它的未学一律不进清单 —— 见 `collectCases` 的 allKeys 缺省分支。
 */
import type { AlgPuzzle } from '@cuberoot/shared';
import type { CaseMarks, CaseMarkStatus } from './trainer-marks';
import { type SrsRec, type SrsRecs, isDue, weakness } from './alg-srs';

/** 清单页的筛选档。与 select 页 `?mark=` 的取值同名同义,链接可以互换。 */
export const CASE_FILTERS = ['learning', 'mastered', 'none'] as const;
export type CaseFilter = (typeof CASE_FILTERS)[number];

export const CASE_SORTS = ['weak', 'due', 'set'] as const;
export type CaseSort = (typeof CASE_SORTS)[number];

/** 清单里的一行。case 本体(图 / 公式)另按套懒加载,这里只带定位信息和记忆状态。 */
export interface ProgressCase {
  /** `${puzzle}/${set}`。 */
  ps: string;
  puzzle: AlgPuzzle;
  set: string;
  /** caseKey(`subgroup|name`)。 */
  key: string;
  /** 无 = 未学。 */
  status?: CaseMarkStatus;
  /** 没练过的 case 没有排期记录。 */
  rec?: SrsRec;
}

/** 每套的输入:标记明细 + 记忆明细 + 整套 case key(只有算「未学」时用得上)。 */
export interface SetCaseSource {
  puzzle: AlgPuzzle;
  set: string;
  marks: CaseMarks;
  recs?: SrsRecs;
  /** 整套 case key。缺省 = 这套的未学算不出来(虚拟集),它只贡献有标记的行。 */
  allKeys?: readonly string[];
}

/** 单条是否落进某一档。未学 = 没有状态,与 select 页 `?mark=none` 同义。 */
export function matchesFilter(c: ProgressCase, filter: CaseFilter): boolean {
  if (filter === 'none') return !c.status;
  return c.status === filter;
}

/**
 * 拍平成清单。墓碑不单独收集,会由 allKeys 的补集路径自然归入「未学」。
 */
export function collectCases(sources: readonly SetCaseSource[], filter: CaseFilter): ProgressCase[] {
  const out: ProgressCase[] = [];
  for (const src of sources) {
    const ps = `${src.puzzle}/${src.set}`;
    const recs = src.recs ?? {};
    const seen = new Set<string>();
    for (const key in src.marks) {
      const m = src.marks[key];
      if (!m.s) continue;                       // 墓碑
      seen.add(key);
      const c: ProgressCase = {
        ps, puzzle: src.puzzle, set: src.set, key,
        status: m.s, rec: recs[key],
      };
      if (matchesFilter(c, filter)) out.push(c);
    }
    // 未学:整套减去有状态的
    if (filter === 'none' && src.allKeys) {
      for (const key of src.allKeys) {
        if (seen.has(key)) continue;
        out.push({ ps, puzzle: src.puzzle, set: src.set, key, rec: recs[key] });
      }
    }
  }
  return out;
}

/** 一套是否算得出「未学」(虚拟集算不出:57 万个 case 枚举不了)。 */
export const canListUntouched = (src: SetCaseSource): boolean => !!src.allKeys;

/**
 * 排序。三档都是全序(末尾用 ps + key 兜底),否则同分项在两次渲染间会跳。
 *  - weak:最该回头看的在前(忘过次数 → EF 低 → 间隔短);没练过的排最后
 *  - due:快到期的在前;没练过的当「现在就该练」排最前
 *  - set:按套聚在一起,套内按 key
 */
export function sortCases(cases: readonly ProgressCase[], sort: CaseSort): ProgressCase[] {
  const tie = (a: ProgressCase, b: ProgressCase) =>
    a.ps === b.ps ? a.key.localeCompare(b.key) : a.ps.localeCompare(b.ps);
  const arr = [...cases];
  if (sort === 'set') return arr.sort(tie);
  if (sort === 'due') {
    return arr.sort((a, b) => {
      // 没记录 = 从没练过 = 现在就到期(与 isDue 对齐),排在所有有排期的前面
      const da = a.rec ? a.rec.d : -Infinity;
      const db = b.rec ? b.rec.d : -Infinity;
      return da === db ? tie(a, b) : da - db;
    });
  }
  return arr.sort((a, b) => {
    const wa = a.rec ? weakness(a.rec) : -Infinity;
    const wb = b.rec ? weakness(b.rec) : -Infinity;
    return wa === wb ? tie(a, b) : wb - wa;
  });
}

/**
 * 「专练不熟」的队列。分两层,先到先得,层内按薄弱度降序:
 *   ① 到期且忘过 —— 系统说你正在忘,而且以前就忘过
 *   ② 自己标的「不熟」
 * 已掌握且没到期的不进队列 —— 专练的意义就是不练已经会的。
 */
export function drillQueue(cases: readonly ProgressCase[], now: number): ProgressCase[] {
  const tier = (c: ProgressCase): number => {
    if (c.rec && c.rec.l > 0 && isDue(c.rec, now)) return 0;
    if (c.status === 'learning') return 1;
    return 2;
  };
  return cases
    .map(c => ({ c, t: tier(c) }))
    .filter(x => x.t < 2)
    .sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t;
      const wa = a.c.rec ? weakness(a.c.rec) : -Infinity;
      const wb = b.c.rec ? weakness(b.c.rec) : -Infinity;
      if (wa !== wb) return wb - wa;
      return a.c.ps === b.c.ps ? a.c.key.localeCompare(b.c.key) : a.c.ps.localeCompare(b.c.ps);
    })
    .map(x => x.c);
}

/** 队列按 puzzle 分组 —— 合练路由是 `/alg/<puzzle>/mix/`,跨 puzzle 组不成一场。 */
export function groupByPuzzle(cases: readonly ProgressCase[]): Map<AlgPuzzle, ProgressCase[]> {
  const out = new Map<AlgPuzzle, ProgressCase[]>();
  for (const c of cases) {
    const arr = out.get(c.puzzle) ?? [];
    arr.push(c);
    out.set(c.puzzle, arr);
  }
  return out;
}
