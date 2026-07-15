'use client';

/**
 * /scramble/solver?event=8p — 8-Puzzle (八数码) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:8 数码状态空间只有 9!/2 = 181,440 个,整张图在浏览器里 BFS 一次
 * (memoized),每次求解都是 O(深度) 的最优最短路(上帝之数 31,均值约 21.97)。打乱来源复用
 * /scramble/gen 的 cstimer 桥(cstimerScramble('8p')),记号与 cstimer 完全一致(U D L R,空格
 * 滑动方向,可带次数 D2),保证它生成的打乱被正确求解。预览是数字格(非魔方网)。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSlide8, SLIDE8_GODS_NUMBER } from '@/lib/slide8-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const SLIDE8_TOKEN_RE = /^([UDLR])(\d+)?$/;

export default function Slide8SolverPage() {
  useDocumentTitle('八数码求解器', '8-Puzzle Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  // Synchronous BFS-table lookup. Only single (<=1 line); >=2 lines go through SolvePanel's batch solve.
  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveSlide8(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveSlide8(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '8p',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U R2 D L U',
      en: 'one scramble per line, e.g. U R2 D L U',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !SLIDE8_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveSlide8(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('8p'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="8p" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '八数码(8-Puzzle)在线求解:任意打乱的整解最优解(全空间 181,440 态精确表,上帝之数 31)。记号 U D L R 表示空格滑动方向,与 cstimer 一致。',
                en: "8-Puzzle online solver: the exact optimal solution for any scramble (full-space table over 181,440 states; God's number is 31). Notation U D L R = the direction the blank slides, matching cstimer.",
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="8p" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(应为 U D L R,可带次数如 D2)', en: 'Unrecognized notation (expected U D L R, optionally with a count like D2)' })}: <code>{result.error}</code>
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
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${SLIDE8_GODS_NUMBER}`, en: `God's number ${SLIDE8_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: '八数码只有 181,440 个状态(9 格排列 9! 的一半),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 31 步可还原,平均约 21.97 步。',
                en: 'The 8-Puzzle has only 181,440 states (half of all 9! cell permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 31 moves, ~21.97 on average.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
