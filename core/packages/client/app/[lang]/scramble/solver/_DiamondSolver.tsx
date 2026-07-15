'use client';

/**
 * /scramble/solver?event=dmd — Diamond(钻石,八面体面转)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Diamond 是八面体面转(8 个三角面、每面 4 个三角小贴纸 = 32 贴纸,
 * 状态 = 32 位置换排列),4 个面转每个 order 3。可达状态空间 138,240 个,整张图在浏览器里 BFS
 * 一次(memoized),每次求解都是 O(深度) 的最优最短路(cstimer 计步上帝之数 10,平均约 6.69 步)。
 * 打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('dmd')),记号与 cstimer 完全一致
 *(U U' R R' L L' F F'),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveDiamond, DIAMOND_GODS_NUMBER } from '@/lib/diamond-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const DIAMOND_TOKEN_RE = /^[URLF]'?$/;
const DIAMOND_NOTE = "U U' R R' L L' F F'";

export default function DiamondSolverPage() {
  useDocumentTitle('钻石求解器', 'Diamond Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveDiamond(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveDiamond(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'dmd',
    metricLabel: 'turns',
    placeholder: {
      zh: "每行一条打乱,如 U R' F L'",
      en: "one scramble per line, e.g. U R' F L'",
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !DIAMOND_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveDiamond(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('dmd'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="dmd" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: `钻石(八面体)在线求解:任意打乱的整解最优解(全空间 138,240 态精确表,上帝之数 10)。记号 ${DIAMOND_NOTE},与 cstimer 一致。`,
                en: `Diamond (octahedron) online solver: the exact optimal solution for any scramble (full-space table over 138,240 states; God's number is 10). Notation ${DIAMOND_NOTE}, matching cstimer.`,
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="dmd" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: `打乱记号无法识别(应为 ${DIAMOND_NOTE})`, en: `Unrecognized notation (expected ${DIAMOND_NOTE})` })}: <code>{result.error}</code>
                  </p>
                ) : result.length === 0 ? (
                  <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                ) : (
                  <>
                    <div className="ivy-metric">
                      <span className="ivy-metric-num">{result.length}</span>
                      <span className="ivy-metric-label">
                        {tr({ zh: '步 最优解', en: result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })}
                      </span>
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${DIAMOND_GODS_NUMBER}`, en: `God's number ${DIAMOND_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: '钻石是八面体面转(8 个三角面、每面 4 个三角小贴纸 = 32 贴纸,4 个 90° 面转每个 order 3),可达状态共 138,240 个,整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 6.69 步。',
                en: 'The Diamond is an octahedron face-turner (8 triangular faces, 4 triangular sub-stickers each = 32 stickers, 4 face turns each of order 3) with 138,240 reachable states, so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~6.69 on average.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
