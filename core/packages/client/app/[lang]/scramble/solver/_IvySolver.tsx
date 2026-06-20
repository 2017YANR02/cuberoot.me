'use client';

/**
 * /scramble/solver?event=ivy — Ivy Cube (枫叶魔方) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Ivy 状态空间只有 29,160 个,整张图在浏览器里 BFS 一次(memoized),
 * 每次求解都是 O(深度) 的最优最短路(上帝之数 8)。打乱来源复用 /scramble/gen 的 cstimer 桥
 * (cstimerScramble('ivy')),记号与 cstimer 完全一致(R L D B,带 '),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveIvy, IVY_GODS_NUMBER } from '@/lib/ivy-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const IVY_TOKEN_RE = /^[RLDB]'?$/i;

export default function IvySolverPage() {
  useDocumentTitle('枫叶魔方求解器', 'Ivy Cube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);

  const trimmed = scramble.trim();

  // 同步求解(瞬时,表查):首次调用懒建整图(~几 ms)。
  const result = useMemo(() => {
    if (!trimmed) return null;
    try {
      const out = solveIvy(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed]);

  // 进页预热整图,让第一次求解也瞬时。
  useEffect(() => {
    const id = window.setTimeout(() => { try { solveIvy(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('ivy');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'ivy',
    metricLabel: 'turns',
    placeholder: {
      zh: "每行一条打乱,如 R L' D B' R'",
      en: "one scramble per line, e.g. R L' D B' R'",
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !IVY_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveIvy(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('ivy'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="ivy" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: '枫叶魔方在线求解:任意打乱的整解最优解(全空间 29,160 态精确表,每次转一个角 = 一步,上帝之数 8)。记号 R L D B,可带 \',与 cstimer 一致。',
              en: "Ivy Cube online solver: the exact optimal solution for any scramble (full-space table over 29,160 states; one corner twist = one move, God's number is 8). Notation R L D B with optional ', matching cstimer.",
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: "输入打乱,如 R L' D B' R'", en: "Enter a scramble, e.g. R L' D B' R'" })}
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
                  <ScramblePreview2D event="ivy" scramble={trimmed} size={64} />
                </div>
              )}
              {result.error ? (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 R L D B,可带 \')', en: "Unrecognized notation (expected R L D B with optional ')" })}: <code>{result.error}</code>
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
                    <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${IVY_GODS_NUMBER}`, en: `God's number ${IVY_GODS_NUMBER}` })}</span>
                  </div>
                  <div className="ivy-solbox">{result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: '枫叶魔方只有 29,160 个状态(81 角向 × 360 中心偶排列),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 8 步可还原,平均约 5.7 步。',
              en: 'The Ivy Cube has only 29,160 states (81 corner-orientations × 360 even center-permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 8 moves, ~5.7 on average.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
