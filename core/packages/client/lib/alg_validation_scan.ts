/**
 * 扫一批 alg set,把校验不过的公式挑出来 —— 全站唯一的扫描器。
 *
 * 三个消费方:set 页顶部的「校验」报告弹窗、case 卡片的红框、个人页给管理员的汇总。
 * 判据本身在 `alg_goals.ts`(每个 set 的目标态),这里只负责遍历 + 收集。
 *
 * **纯客户端**(cubing.js KPuzzle),后端没有批量校验接口。全库一遍 ≈ 1.6 万条,数秒。
 */
import { findDuplicateAlgs } from '@cuberoot/shared/alg-notation';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import { SET_GOAL } from '@/lib/alg_goals';
import { validateStoredAlgCase } from '@/lib/alg_validation';
import { loadAlg, commonCaseSetup, caseAlgIssue, caseCoepEntry } from '@/lib/alg_case_alignment';
import { alignScrambleToSetup } from '@/lib/alg_scramble';
import { tr } from '@/i18n/tr';

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

function metadataEntries(c: AlgCase): Array<{ label: string; alg: string; scramble: boolean }> {
  const entries = Object.entries(c.meta?.optimal ?? {}).flatMap(([metric, value]) => value.scramble
    ? [{ label: metric.toUpperCase(), alg: value.scramble, scramble: true }] : []);
  if (c.meta?.coep?.alg) entries.push({ label: 'COEP', alg: caseCoepEntry(c)?.alg ?? c.meta.coep.alg, scramble: false });
  if (c.meta?.coep?.scramble) entries.push({ label: 'COEP', alg: c.meta.coep.scramble, scramble: true });
  return entries;
}

async function scanMetadata(puzzle: AlgPuzzle, set: string, c: AlgCase): Promise<AlgFailure[]> {
  const setup = commonCaseSetup(puzzle, set, c);
  const failures: AlgFailure[] = [];
  for (const entry of metadataEntries(c)) {
    const result = entry.scramble
      ? { ok: alignScrambleToSetup(puzzle, entry.alg, setup) !== null,
          reason: tr({ zh: '原打乱无法对齐本图', en: 'Source scramble cannot be aligned to this case' }) }
      : await validateStoredAlgCase(setup, entry.alg, c.sticker, puzzle, set);
    if (!result.ok) failures.push({ puzzle, set, caseObj: c, oriIdx: 0, algIdx: -1,
      alg: `${entry.label}: ${entry.alg}`, reason: result.reason ?? 'unknown' });
  }
  return failures;
}

/** 全库的 (puzzle, set) 对。 */
export function allTargets(): ScanTarget[] {
  return Object.keys(SET_GOAL).map(key => {
    const [puzzle, set] = key.split('/');
    return { puzzle: puzzle as AlgPuzzle, set };
  });
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
      const setup = commonCaseSetup(puzzle, set, c, oi);
      for (let ai = 0; ai < c.algs[oi].length; ai++) {
        if (opts.shouldCancel?.()) return out;
        const entry = c.algs[oi][ai];
        const duplicate = findDuplicateAlgs(c.algs[oi]).find(d => d.index === ai);
        const issue = duplicate
          ? tr({ zh: `重复公式：忽略括号后与第 ${duplicate.first + 1} 条相同`, en: `Duplicate algorithm: identical to entry ${duplicate.first + 1}, ignoring parentheses` })
          : caseAlgIssue(entry);
        const r = issue ? { ok: false, reason: issue }
          : await validateStoredAlgCase(setup, entry.alg, c.sticker, puzzle, set);
        if (!r.ok) {
          out.push({ puzzle, set, caseObj: c, oriIdx: oi, algIdx: ai, alg: entry.alg, reason: r.reason ?? 'unknown' });
        }
      }
    }
    out.push(...await scanMetadata(puzzle, set, c));
  }
  return out;
}

/** 扫一批 set。先全部 load(才知道总条数,进度条才有分母),再逐条校验。 */
export async function scanTargets(targets: ScanTarget[], opts: ScanOpts = {}): Promise<AlgFailure[]> {
  const loaded: Array<{ puzzle: AlgPuzzle; set: string; cases: AlgCase[] }> = [];
  let total = 0;
  for (const t of targets) {
    if (opts.shouldCancel?.()) return [];
    // fresh —— 扫描只有 admin 跑,而 GET 带 1 小时 Cache-Control。拿缓存去扫,
    // 报告里就会挂着他刚删掉的那条公式,越修越不对。
    const data = await loadAlg(t.puzzle, t.set, { fresh: true });
    loaded.push({ ...t, cases: data.cases });
    for (const c of data.cases) total += c.algs.flat().length + metadataEntries(c).length;
  }
  opts.onProgress?.(0, total);

  const out: AlgFailure[] = [];
  let done = 0;
  for (const sd of loaded) {
    for (const c of sd.cases) {
      for (let oi = 0; oi < c.algs.length; oi++) {
        const setup = commonCaseSetup(sd.puzzle, sd.set, c, oi);
        for (let ai = 0; ai < c.algs[oi].length; ai++) {
          if (opts.shouldCancel?.()) return out;
          const entry = c.algs[oi][ai];
          const duplicate = findDuplicateAlgs(c.algs[oi]).find(d => d.index === ai);
          const issue = duplicate
            ? tr({ zh: `重复公式：忽略括号后与第 ${duplicate.first + 1} 条相同`, en: `Duplicate algorithm: identical to entry ${duplicate.first + 1}, ignoring parentheses` })
            : caseAlgIssue(entry);
          const r = issue ? { ok: false, reason: issue }
            : await validateStoredAlgCase(setup, entry.alg, c.sticker, sd.puzzle, sd.set);
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
      out.push(...await scanMetadata(sd.puzzle, sd.set, c));
      done += metadataEntries(c).length;
      opts.onProgress?.(done, total);
    }
  }
  opts.onProgress?.(done, total);
  return out;
}

/** 扫全库。 */
export function scanAll(opts: ScanOpts = {}): Promise<AlgFailure[]> {
  return scanTargets(allTargets(), opts);
}
