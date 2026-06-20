'use client';

/**
 * /scramble/solver?event=223 — 2×2×3 Tower (2×2×3) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:2×2×3 状态空间只有 241,920 个(8 角排列 40,320 × 中层 3 排列 6),
 * 整张图在浏览器里 BFS 一次(memoized,~0.2s),每次求解都是 O(深度) 的最优最短路(上帝之数 14)。
 * 打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('223')),记号与 cstimer 完全一致
 * (U U' U2 D D' D2 R2 F2),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCuboid223, CUBOID223_GODS_NUMBER } from '@/lib/cuboid223-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const CUBOID223_TOKEN_RE = /^([UD]['2]?|[RF]2)$/;

export default function Cuboid223SolverPage() {
  useDocumentTitle('2×2×3 求解器', '2×2×3 Tower Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);

  const trimmed = scramble.trim();

  const result = useMemo(() => {
    if (!trimmed) return null;
    try {
      const out = solveCuboid223(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveCuboid223(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('223');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '223',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 U R2 F2 U2 D',
      en: 'one scramble per line, e.g. U R2 F2 U2 D',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CUBOID223_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCuboid223(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('223'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="223" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: '2×2×3 在线求解:任意打乱的整解最优解(全空间 241,920 态精确表,上帝之数 14)。记号 U U2 U’ D D2 D’ R2 F2,与 cstimer 一致。',
              en: "2×2×3 Tower online solver: the exact optimal solution for any scramble (full-space table over 241,920 states; God's number is 14). Notation U U2 U’ D D2 D’ R2 F2, matching cstimer.",
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 U R2 F2 U2 D', en: 'Enter a scramble, e.g. U R2 F2 U2 D' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={() => void randomScramble()} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && result && (
            <div className="pos-result" aria-live="polite">
              {!result.error && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="223" scramble={trimmed} size={64} />
                </div>
              )}
              {result.error ? (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 U U2 U’ D D2 D’ R2 F2)', en: 'Unrecognized notation (expected U U2 U’ D D2 D’ R2 F2)' })}: <code>{result.error}</code>
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
                    <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${CUBOID223_GODS_NUMBER}`, en: `God's number ${CUBOID223_GODS_NUMBER}` })}</span>
                  </div>
                  <div className="ivy-solbox">{result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: '2×2×3 只有 241,920 个状态(8 角自由排列 40,320 × 中层 3 个排列 6),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 14 步可还原,平均约 9.74 步。',
              en: 'The 2×2×3 Tower has only 241,920 states (8 freely-permuted corners × 6 middle-layer permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 14 moves, ~9.74 on average.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
