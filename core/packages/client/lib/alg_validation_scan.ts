/**
 * 扫一批 alg set,把校验不过的公式挑出来 —— 全站唯一的扫描器。
 *
 * 三个消费方:set 页顶部的「校验」报告弹窗、case 卡片的红框、个人页给管理员的汇总。
 * 判据本身在 `alg_goals.ts`(每个 set 的目标态),这里只负责遍历 + 收集。
 *
 * **纯客户端**(cubing.js KPuzzle),后端没有批量校验接口。全库一遍 ≈ 1.6 万条,数秒。
 */
import { ALG_CATALOG, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { validateAlgCase, setupForCase } from '@/lib/alg_validation';

export interface AlgFailure {
  puzzle: AlgPuzzle;
  set: string;
  caseObj: AlgCase;
  /** 第几个朝向(f2l 类一个 case 四个槽) */
  oriIdx: number;
  algIdx: number;
  alg: string;
  reason: string;
}

export interface ScanTarget {
  puzzle: AlgPuzzle;
  set: string;
}

export interface ScanOpts {
  /** 已校验条数 / 总条数 —— 全库扫要几秒,不报进度像卡死。 */
  onProgress?: (done: number, total: number) => void;
  /** 组件卸载后立刻停 */
  shouldCancel?: () => boolean;
}

/** 全库的 (puzzle, set) 对。 */
export function allTargets(): ScanTarget[] {
  const out: ScanTarget[] = [];
  for (const pz of Object.keys(ALG_CATALOG) as AlgPuzzle[]) {
    for (const s of ALG_CATALOG[pz]) out.push({ puzzle: pz, set: s.slug });
  }
  return out;
}

/** 校验**已经加载好**的一批 case(set 页已有 data,别再拉一遍)。 */
export async function scanCases(
  puzzle: AlgPuzzle,
  set: string,
  cases: AlgCase[],
  opts: ScanOpts = {},
): Promise<AlgFailure[]> {
  const out: AlgFailure[] = [];
  for (const c of cases) {
    for (let oi = 0; oi < c.algs.length; oi++) {
      const setup = setupForCase(puzzle, c.setup, c.algs[0]?.[0]?.alg, oi);
      for (let ai = 0; ai < c.algs[oi].length; ai++) {
        if (opts.shouldCancel?.()) return out;
        const entry = c.algs[oi][ai];
        const r = await validateAlgCase(setup, entry.alg, c.sticker, puzzle, set);
        if (!r.ok) {
          out.push({ puzzle, set, caseObj: c, oriIdx: oi, algIdx: ai, alg: entry.alg, reason: r.reason ?? 'unknown' });
        }
      }
    }
  }
  return out;
}

/** 扫一批 set。先全部 load(才知道总条数,进度条才有分母),再逐条校验。 */
export async function scanTargets(targets: ScanTarget[], opts: ScanOpts = {}): Promise<AlgFailure[]> {
  const loaded: Array<{ puzzle: AlgPuzzle; set: string; cases: AlgCase[] }> = [];
  let total = 0;
  for (const t of targets) {
    if (opts.shouldCancel?.()) return [];
    const data = await loadAlg(t.puzzle, t.set);
    loaded.push({ ...t, cases: data.cases });
    for (const c of data.cases) for (const ori of c.algs) total += ori.length;
  }
  opts.onProgress?.(0, total);

  const out: AlgFailure[] = [];
  let done = 0;
  for (const sd of loaded) {
    for (const c of sd.cases) {
      for (let oi = 0; oi < c.algs.length; oi++) {
        const setup = setupForCase(sd.puzzle, c.setup, c.algs[0]?.[0]?.alg, oi);
        for (let ai = 0; ai < c.algs[oi].length; ai++) {
          if (opts.shouldCancel?.()) return out;
          const entry = c.algs[oi][ai];
          const r = await validateAlgCase(setup, entry.alg, c.sticker, sd.puzzle, sd.set);
          if (!r.ok) {
            out.push({
              puzzle: sd.puzzle, set: sd.set, caseObj: c,
              oriIdx: oi, algIdx: ai, alg: entry.alg, reason: r.reason ?? 'unknown',
            });
          }
          done++;
          if (done % 20 === 0 || done === total) opts.onProgress?.(done, total);
        }
      }
    }
  }
  opts.onProgress?.(done, total);
  return out;
}

/** 扫全库。 */
export function scanAll(opts: ScanOpts = {}): Promise<AlgFailure[]> {
  return scanTargets(allTargets(), opts);
}
