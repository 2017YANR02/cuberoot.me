'use client';

/**
 * /scramble/solver?event=334 — 3×3×4 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。3×3×4 状态空间 ≈ 1.65×10¹⁷(facelet 群阶 2.64×10¹⁸,Schreier-Sims 实算),
 * 太大无法整图 BFS;且只用浏览器可现场构建的小启发表(5 个轨道 PDB,最深 13)不足以让搜索在交互时间内
 * 跑到上帝之数(~18-20),实测深态会爆炸。所以这里用混合策略:浅态(≤13 步)用 IDA* + max(轨道距离)
 * 可采纳启发式求**可证最优**解;深态退回快速贪心归约,给出**有效且有界**的解(通常较长 —— 这是该量级
 * 谜题在浏览器端可接受的结果)。求解放进 setTimeout 异步执行,期间显示「求解中」spinner。打乱来源复用
 * /scramble/gen 的 cstimer 桥(cstimerScramble('334')),记号与 cstimer 完全一致(U U' U2 u u' u2 R2 L2 M2 F2 B2 S2)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomCuboid334Scramble, solveCuboid334, CUBOID334_TOO_DEEP, type Cuboid334Solution } from '@/lib/cuboid334-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const CUBOID334_TOKEN_RE = /^(U['2]?|u['2]?|[RLMFBS]2)$/;

// random-scramble length for the buttons: short enough to always solve to a provable optimum fast.
const RANDOM_LEN = 10;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Cuboid334Solution }
  | { kind: 'too-deep' }
  | { kind: 'error'; message: string };

export default function Cuboid334SolverPage() {
  useDocumentTitle('3×3×4 求解器', '3×3×4 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const trimmed = scramble.trim();

  // Solve off the render path: a deep greedy reduction can take a moment (and the first call builds the
  // orbit pattern databases), so defer to a macrotask and show a "solving" spinner.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveCuboid334(trimmed) };
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        next = msg === CUBOID334_TOO_DEEP ? { kind: 'too-deep' } : { kind: 'error', message: msg };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed]);

  const randomScramble = () => {
    if (generating) return;
    setGenerating(true);
    try {
      void setScramble(randomCuboid334Scramble(RANDOM_LEN));
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '334',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U R2 u2 F2 U',
      en: 'one scramble per line, e.g. U R2 u2 F2 U',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CUBOID334_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCuboid334(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomCuboid334Scramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="334" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: '3×3×4 在线求解:用 IDA* + max(轨道距离)可采纳启发式现场算出**可证最优**解。「随机打乱」给 10 步短打乱(必能秒解最优);手输的深打乱若超出浏览器预算会提示。记号 U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2,与 cstimer 一致。',
              en: '3×3×4 online solver: IDA* with an admissible max(orbit-distance) heuristic computes a PROVABLY OPTIMAL solution. "Random" gives a short 10-move scramble (always solved optimally and instantly); a deep pasted scramble beyond the in-browser budget is reported. Notation U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2, matching cstimer.',
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 U R2 u2 F2 U', en: 'Enter a scramble, e.g. U R2 u2 F2 U' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={randomScramble} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && (
            <div className="pos-result" aria-live="polite">
              {state.kind !== 'error' && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="334" scramble={trimmed} size={64} />
                </div>
              )}
              {state.kind === 'solving' && (
                <p className="pos-result-solved">
                  <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {tr({ zh: '求解中…', en: 'Solving…' })}
                </p>
              )}
              {state.kind === 'error' && (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2)', en: 'Unrecognized notation (expected U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2)' })}: <code>{state.message}</code>
                </p>
              )}
              {state.kind === 'too-deep' && (
                <p className="pos-error">
                  {tr({
                    zh: '这个打乱太深,超出浏览器内求解预算(3×3×4 状态空间 ≈ 1.65×10¹⁷,无浏览器可建的强启发,深态无法在交互时间内求解)。试试「随机打乱」给的较短打乱,或减少手输步数。',
                    en: 'This scramble is too deep for the in-browser budget (the 3×3×4 has ≈1.65×10¹⁷ states with no browser-buildable strong heuristic, so deep states can\'t be solved interactively). Try the shorter "Random" scramble, or shorten the input.',
                  })}
                </p>
              )}
              {state.kind === 'done' && state.result.length === 0 && (
                <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
              )}
              {state.kind === 'done' && state.result.length > 0 && (
                <>
                  <div className="ivy-metric">
                    <span className="ivy-metric-num">{state.result.length}</span>
                    <span className="ivy-metric-label">
                      {state.result.optimal
                        ? tr({ zh: '步 最优解', en: state.result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })
                        : tr({ zh: '步 有效解', en: state.result.length === 1 ? 'move (valid)' : 'moves (valid)' })}
                    </span>
                  </div>
                  <div className="ivy-solbox">{state.result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: '3×3×4 有约 165,181,768,335,360,000 个状态(facelet 群阶 2,642,908,293,365,760,000,Schreier-Sims 实算),太大无法整图 BFS;能在浏览器现场构建的可采纳启发表最深只有 13,而上帝之数约 18-20,搜索到一定深度就会爆炸。所以浅态(≤13 步)给出可证最短解,深态退回快速贪心归约 —— 解一定有效、步数有界,但通常远非最优。',
              en: 'The 3×3×4 has about 165,181,768,335,360,000 states (facelet group order 2,642,908,293,365,760,000, computed by Schreier-Sims) — far too many to BFS. The strongest admissible heuristic buildable in the browser caps at depth 13 while God\'s number is ~18-20, so search explodes beyond a certain depth. Shallow states (≤13 moves) get a provably shortest solution; deeper states fall back to a fast greedy reduction — always valid and bounded, but usually far from optimal.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
