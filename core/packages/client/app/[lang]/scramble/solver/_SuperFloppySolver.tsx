'use client';

/**
 * /scramble/solver?event=sfl — Super Floppy Cube(超薄花型 / Super Floppy)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Super Floppy 状态空间 3,041,280 个(4 角在 12 位置的排列 11,880 ×
 * 4 个边各 4 朝向 256),整张图在浏览器里 BFS 一次(memoized,整数排名编码 ~0.6s),每次求解都是
 * O(深度) 的最优最短路(上帝之数 13)。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble
 * ('sfl')),记号与 cstimer 完全一致(R R2 R' L L2 L' U U2 U' D D2 D'),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSuperFloppy, SUPERFLOPPY_GODS_NUMBER } from '@/lib/superfloppy-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const SUPERFLOPPY_TOKEN_RE = /^([RLUD]['2]?)$/;

export default function SuperFloppySolverPage() {
  useDocumentTitle('Super Floppy 求解器', 'Super Floppy Solver');

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
      const out = solveSuperFloppy(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveSuperFloppy(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('sfl');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'sfl',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 R U2 L D R2',
      en: 'one scramble per line, e.g. R U2 L D R2',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !SUPERFLOPPY_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveSuperFloppy(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('sfl'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="sfl" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: 'Super Floppy 在线求解:任意打乱的整解最优解(全空间 3,041,280 态精确表,上帝之数 13)。记号 R R2 R’ L L2 L’ U U2 U’ D D2 D’,与 cstimer 一致。',
              en: "Super Floppy online solver: the exact optimal solution for any scramble (full-space table over 3,041,280 states; God's number is 13). Notation R R2 R’ L L2 L’ U U2 U’ D D2 D’, matching cstimer.",
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 R U2 L D R2', en: 'Enter a scramble, e.g. R U2 L D R2' })}
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
                  <ScramblePreview2D event="sfl" scramble={trimmed} size={64} />
                </div>
              )}
              {result.error ? (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 R R2 R’ L L2 L’ U U2 U’ D D2 D’)', en: 'Unrecognized notation (expected R R2 R’ L L2 L’ U U2 U’ D D2 D’)' })}: <code>{result.error}</code>
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
                    <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${SUPERFLOPPY_GODS_NUMBER}`, en: `God's number ${SUPERFLOPPY_GODS_NUMBER}` })}</span>
                  </div>
                  <div className="ivy-solbox">{result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: 'Super Floppy 有 3,041,280 个状态(4 角在 12 位置的排列 11,880 × 4 个边各 4 朝向 256),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 13 步可还原,平均约 9.00 步。',
              en: 'The Super Floppy has 3,041,280 states (11,880 placements of 4 corners over 12 positions × 256 edge orientations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 13 moves, ~9.00 on average.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
