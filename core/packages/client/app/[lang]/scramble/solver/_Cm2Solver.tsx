'use client';

/**
 * /scramble/solver?event=cm2 — Cmetrick Mini(Cmetrick Mini)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Cmetrick Mini 状态空间 165,888 个(4 个球各 24 种朝向,齿轮联动有
 * 奇偶限制 = 24⁴/2),整张图在浏览器里 BFS 一次(memoized),每次求解都是 O(深度) 的最优最短路
 *(cstimer 计步上帝之数 10)。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('cm2')),
 * 记号与 cstimer 完全一致(U< U> U2 D< D> D2 R^ Rv R2 L^ Lv L2),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCm2, CM2_GODS_NUMBER } from '@/lib/cm2-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const CM2_TOKEN_RE = /^(U<|U>|U2|D<|D>|D2|R\^|Rv|R2|L\^|Lv|L2)$/;
const CM2_NOTE = 'U< U> U2 D< D> D2 R^ Rv R2 L^ Lv L2';

export default function Cm2SolverPage() {
  useDocumentTitle('Cmetrick Mini 求解器', 'Cmetrick Mini Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveCm2(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveCm2(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'cm2',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 U< R^ D2 L>',
      en: 'one scramble per line, e.g. U< R^ D2 L>',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CM2_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCm2(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('cm2'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="cm2" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: `Cmetrick Mini 在线求解:任意打乱的整解最优解(全空间 165,888 态精确表,上帝之数 10)。记号 ${CM2_NOTE},与 cstimer 一致。`,
                en: `Cmetrick Mini online solver: the exact optimal solution for any scramble (full-space table over 165,888 states; God's number is 10). Notation ${CM2_NOTE}, matching cstimer.`,
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="cm2" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: `打乱记号无法识别(应为 ${CM2_NOTE})`, en: `Unrecognized notation (expected ${CM2_NOTE})` })}: <code>{result.error}</code>
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
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${CM2_GODS_NUMBER}`, en: `God's number ${CM2_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: 'Cmetrick Mini 有 165,888 个状态(4 个球各 24 种朝向,齿轮联动有奇偶限制 = 24⁴/2),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 7.33 步。',
                en: 'The Cmetrick Mini has 165,888 states (4 balls of 24 orientations each, halved by the gears’ parity restriction = 24⁴/2), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~7.33 on average.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
