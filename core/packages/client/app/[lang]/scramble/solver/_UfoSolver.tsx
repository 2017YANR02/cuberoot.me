'use client';

/**
 * /scramble/solver?event=ufo — UFO(UFO 魔方)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:UFO 状态空间 60,480 个(3 球各 8 个八分体 = 24 件,6 位转盘),整张图
 * 在浏览器里 BFS 一次(memoized,<50ms),每次求解都是 O(深度) 的最优最短路(上帝之数 10)。打乱来源
 * 复用 /scramble/gen 的 cstimer 桥(cstimerScramble('ufo')),记号与 cstimer 完全一致(A B C U U' U2'
 * U2 U3),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveUfo, UFO_GODS_NUMBER } from '@/lib/ufo-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const UFO_TOKEN_RE = /^(A|B|C|U|U'|U2|U2'|U3)$/;

export default function UfoSolverPage() {
  useDocumentTitle('UFO 求解器', 'UFO Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveUfo(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveUfo(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'ufo',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 A U B U2 C',
      en: 'one scramble per line, e.g. A U B U2 C',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !UFO_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveUfo(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('ufo'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="ufo" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: 'UFO 在线求解:任意打乱的整解最优解(全空间 60,480 态精确表,上帝之数 10)。记号 A B C U U’ U2’ U2 U3,与 cstimer 一致。',
                en: "UFO online solver: the exact optimal solution for any scramble (full-space table over 60,480 states; God's number is 10). Notation A B C U U’ U2’ U2 U3, matching cstimer.",
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="ufo" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(应为 A B C U U’ U2’ U2 U3)', en: 'Unrecognized notation (expected A B C U U’ U2’ U2 U3)' })}: <code>{result.error}</code>
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
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${UFO_GODS_NUMBER}`, en: `God's number ${UFO_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: 'UFO 有 60,480 个状态(3 球各 8 个八分体 = 24 件,6 位转盘),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 7.74 步。',
                en: 'The UFO has 60,480 states (3 balls of 8 octants = 24 pieces, on a 6-position wheel), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~7.74 on average.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
