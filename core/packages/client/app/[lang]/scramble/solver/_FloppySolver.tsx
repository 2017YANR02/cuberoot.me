'use client';

/**
 * /scramble/solver?event=133 — 1×3×3 Floppy Cube (1×3×3 花型) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Floppy 状态空间只有 192 个,整张图在浏览器里 BFS 一次(memoized),
 * 每次求解都是 O(深度) 的最优最短路(上帝之数 8)。打乱来源复用 /scramble/gen 的 cstimer 桥
 * (cstimerScramble('133')),记号与 cstimer 完全一致(R L F B,180° 单转无 '),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveFloppy, FLOPPY_GODS_NUMBER } from '@/lib/floppy-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const FLOPPY_TOKEN_RE = /^[RLFB]$/i;

export default function FloppySolverPage() {
  useDocumentTitle('1×3×3 花型求解器', '1×3×3 Floppy Cube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveFloppy(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveFloppy(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '133',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 R L F B R',
      en: 'one scramble per line, e.g. R L F B R',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !FLOPPY_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveFloppy(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('133'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="133" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '1×3×3 花型在线求解:任意打乱的整解最优解(全空间 192 态精确表,每转一面 180° = 一步,上帝之数 8)。记号 R L F B,与 cstimer 一致。',
                en: "1×3×3 Floppy Cube online solver: the exact optimal solution for any scramble (full-space table over 192 states; one 180° face turn = one move, God's number is 8). Notation R L F B, matching cstimer.",
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="133" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(应为 R L F B)', en: 'Unrecognized notation (expected R L F B)' })}: <code>{result.error}</code>
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
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${FLOPPY_GODS_NUMBER}`, en: `God's number ${FLOPPY_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: '1×3×3 花型只有 192 个状态(4 角排列与 4 面翻转绑定),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 8 步可还原,平均约 4.4 步。',
                en: 'The 1×3×3 Floppy Cube has only 192 states (4 corner permutations bound to 4 face flips), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 8 moves, ~4.4 on average.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
