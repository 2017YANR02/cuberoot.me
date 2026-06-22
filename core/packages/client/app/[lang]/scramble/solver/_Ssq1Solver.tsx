'use client';

/**
 * /scramble/solver?event=ssq1 — Super Square-1(超级方块一)在线求解器。
 *
 * 纯 TS,无 worker、无下载表。Super Square-1 = 两个耦合的 Square-1(共享切片),可达状态约 1.15×10²⁵
 * (两个 Square-1 之积),太大无法整图 BFS,单阶段 IDA* 在随机态上也会爆;真 Square-1 含 60° 角 + 30° 棱,
 * 不存在 Square-2 那种短 3-循环约简。所以求解走构造式**逆约简**(解 = 打乱的逆):任何打乱都返回一条
 * **有效且有界**的解(约 打乱长度 + 1 个元组),optimal:false(非近最优)。
 *
 * 记号 = cstimer 同款 (a,b,c,d)/ 4 元组:a=外层顶转,b=内层顶转,c=内层底转,d=外层底转,/ 同时切两层;
 * 每个 (a,b,c,d)/ 元组计 1 步。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomSsq1Scramble, solveSsq1, SSQ1_STATE_COUNT_STR, type Ssq1Solution } from '@/lib/ssq1-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// random-scramble length for the buttons (cstimer ssq1t default is 10 tuples).
const RANDOM_LEN = 10;
const HAS_TOKENS = /[\d/]/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Ssq1Solution }
  | { kind: 'error'; message: string };

export default function Ssq1SolverPage() {
  useDocumentTitle('超级方块一求解器', 'Super Square-1 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const trimmed = scramble.trim();
  const hasTokens = useMemo(() => HAS_TOKENS.test(trimmed), [trimmed]);

  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || !hasTokens) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveSsq1(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed, hasTokens]);

  const randomScramble = () => {
    if (generating) return;
    setGenerating(true);
    try {
      void setScramble(randomSsq1Scramble(RANDOM_LEN));
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'ssq1',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 (1,0,0,-1)/ (3,-2,1,0)/ (0,4,-1,0)/',
      en: 'one scramble per line, e.g. (1,0,0,-1)/ (3,-2,1,0)/ (0,4,-1,0)/',
    },
    validate: (line) => (HAS_TOKENS.test(line.trim()) ? null : line.trim()),
    solveOne: async (s) => {
      const o = solveSsq1(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomSsq1Scramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="ssq1" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: 'Super Square-1(超级方块一)在线求解:逆约简法给出一条有效且有界的解(非近最优)。记号 (a,b,c,d)/(a=外顶,b=内顶,c=内底,d=外底,/ 同切两层),每个元组计 1 步。',
              en: 'Super Square-1 online solver: an inverse reduction returns a valid, bounded solution (not near-optimal). Notation (a,b,c,d)/ (a=outer top, b=inner top, c=inner bottom, d=outer bottom, / slices both); each tuple counts as one move.',
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 (1,0,0,-1)/ (3,-2,1,0)/', en: 'Enter a scramble, e.g. (1,0,0,-1)/ (3,-2,1,0)/' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={randomScramble} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && hasTokens && (
            <div className="pos-result" aria-live="polite">
              {state.kind !== 'error' && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="ssq1" scramble={trimmed} size={96} />
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
                  {tr({ zh: '打乱记号无法识别(应为 (a,b,c,d)/ 形式)', en: 'Unrecognized notation (expected (a,b,c,d)/)' })}: <code>{state.message}</code>
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
                        : tr({ zh: '步 有界解', en: state.result.length === 1 ? 'move (bounded)' : 'moves (bounded)' })}
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
              zh: `Super Square-1 是两个耦合的 Square-1,在 (a,b,c,d)/ 记号下有约 ${SSQ1_STATE_COUNT_STR} 个可达状态,太大无法整图 BFS,单阶段 IDA* 在随机态上会爆;且真 Square-1 含 60° 角 + 30° 棱,不存在 Square-2 那种短 3-循环约简(实测:深度 9 内无任何角/棱纯 3-循环)。所以解**不是**最优。求解器采用构造式**逆约简**(解 = 打乱的逆):任何打乱都能解出一条**有效且有界**的解(约 打乱长度 + 1 个元组),标为「有界」而非近最优。`,
              en: `The Super Square-1 is two coupled Square-1 mechanisms with ≈ ${SSQ1_STATE_COUNT_STR} reachable states — far too many to BFS, and single-phase IDA* explodes on random states; and a real Square-1 has 60° corners + 30° edges, so there is no Square-2-style short 3-cycle reduction (verified: zero corner/edge 3-cycles within depth 9). So solutions are NOT optimal. The solver uses a constructive INVERSE reduction (solution = the scramble inverse): ANY scramble returns a VALID, BOUNDED solution (≈ scramble length + 1 tuples) — labeled "bounded", not near-optimal.`,
            })}
          </div>
        </>
      )}
    </div>
  );
}
