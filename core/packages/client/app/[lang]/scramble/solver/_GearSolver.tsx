'use client';

/**
 * /scramble/solver?event=gear — 齿轮魔方(Gear Cube)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:齿轮魔方虽是 3×3 外形,但棱块是齿轮、随面转联动,可达状态坍缩到
 * 4 角 + 3 个轴向齿轮棱坐标([corner, e0, e1, e2]),整个空间只有 41,472 个状态。整张图在浏览器里
 * BFS 一次(memoized),每次求解都是 O(深度) 的最优最短路(cstimer 计步上帝之数 6,平均约 4.30 步)。
 * 打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('gear')),记号与 cstimer 完全一致
 *(33 个 token = 3 轴 × 11 次幂,如 R2 U' F3),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveGear, GEAR_GODS_NUMBER } from '@/lib/gear-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// 33 token = 3 轴(U/R/F)× 11 次幂(如 U' U2' … U6 U5 … U2 U)。
const GEAR_TOKEN_RE = /^[URF](?:[2-6]?'|[2-6])?$/;
const GEAR_NOTE = "R2 U' F3";

export default function GearSolverPage() {
  useDocumentTitle('齿轮魔方求解器', 'Gear Cube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveGear(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveGear(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'gear',
    metricLabel: 'turns',
    placeholder: {
      zh: "每行一条打乱,如 R2 U' F3 U6",
      en: "one scramble per line, e.g. R2 U' F3 U6",
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !GEAR_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveGear(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('gear'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="gear" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: `齿轮魔方在线求解:任意打乱的整解最优解(全空间 41,472 态精确表,上帝之数 6)。记号 ${GEAR_NOTE} 等,与 cstimer 一致。`,
                en: `Gear Cube online solver: the exact optimal solution for any scramble (full-space table over 41,472 states; God's number is 6). Notation like ${GEAR_NOTE}, matching cstimer.`,
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="gear" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(记号与 cstimer 一致)', en: 'Unrecognized notation (matches cstimer)' })}: <code>{result.error}</code>
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
                      <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${GEAR_GODS_NUMBER}`, en: `God's number ${GEAR_GODS_NUMBER}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: '齿轮魔方虽是 3×3 外形,但棱块是齿轮、随面转联动,可达状态坍缩到 4 角 + 3 个轴向齿轮棱坐标,共 41,472 个,整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 6 步可还原,平均约 4.30 步。记号(33 个 token = 3 轴 × 11 次幂)与 cstimer 一致。',
                en: 'The Gear Cube has a 3×3 shell, but its edges are gears that rotate with the faces, so its reachable space collapses to 4 corners + 3 gear-edge coordinates = 41,472 states. The whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 6 moves, ~4.30 on average. Notation (33 tokens = 3 axes × 11 powers) matches cstimer.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
