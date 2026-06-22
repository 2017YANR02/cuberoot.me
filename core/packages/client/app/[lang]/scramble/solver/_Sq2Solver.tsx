'use client';

/**
 * /scramble/solver?event=sq2 — Square-2 (方块二) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。Square-2 = Square-1 的角全部一切为二,12 个顶 + 12 个底全是等大 30° 楔块,
 * 任何 (u,d)/ 转动都合法(不会像 Square-1 那样卡角)。在 cstimer 的 (u,d)/ 记号下可达状态
 * 76,828,484,468,736,000(= 12·18!,Schreier-Sims 实算),太大无法整图 BFS,单阶段 IDA* 也会爆。
 * 策略 = 约简(归正奇偶 + 共轭 3-循环逐块归位),任何打乱都返回一条有界的**近最优**解(optimal:false)。
 *
 * 记号 = cstimer 同款 (u,d)/ 元组(u,d ∈ [-5,6],不同时为 0);每个 (u,d)/ 元组计 1 步。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomSq2Scramble, solveSq2, SQ2_STATE_COUNT_STR, type Sq2Solution } from '@/lib/sq2-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// random-scramble length for the buttons (cstimer sq2 default is 10 tuples).
const RANDOM_LEN = 10;
const HAS_TOKENS = /[\d/]/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Sq2Solution }
  | { kind: 'error'; message: string };

export default function Sq2SolverPage() {
  useDocumentTitle('方块二求解器', 'Square-2 Solver');

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
        next = { kind: 'done', result: solveSq2(trimmed) };
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
      void setScramble(randomSq2Scramble(RANDOM_LEN));
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'sq2',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 (1,0)/ (-3,3)/ (0,-3)/',
      en: 'one scramble per line, e.g. (1,0)/ (-3,3)/ (0,-3)/',
    },
    validate: (line) => (HAS_TOKENS.test(line.trim()) ? null : line.trim()),
    solveOne: async (s) => {
      const o = solveSq2(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomSq2Scramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="sq2" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: 'Square-2(方块二)在线求解:约简法给出一条有效且有界的解(非近最优)。记号 (u,d)/(u,d ∈ [-5,6]),每个元组计 1 步。',
              en: 'Square-2 online solver: a reduction method returns a valid, bounded solution (not near-optimal). Notation (u,d)/ (u,d ∈ [-5,6]); each tuple counts as one move.',
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 (1,0)/ (-3,3)/ (0,-3)/', en: 'Enter a scramble, e.g. (1,0)/ (-3,3)/ (0,-3)/' })}
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
                  <ScramblePreview2D event="sq2" scramble={trimmed} size={96} />
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
                  {tr({ zh: '打乱记号无法识别(应为 (u,d)/ 形式)', en: 'Unrecognized notation (expected (u,d)/)' })}: <code>{state.message}</code>
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
              zh: `Square-2 在 (u,d)/ 记号下有 ${SQ2_STATE_COUNT_STR} 个可达状态(= 12·18!,由 Schreier-Sims 实算),太大无法整图 BFS,单阶段 IDA* 在随机态上会爆,所以解**不是**最优。采用构造式约简(先归正奇偶,再用共轭 3-循环把每个楔块逐一归位):任何打乱都能解出一条**有效且有界**的解,但步数明显多于最短解(实测均值约 70 元组),标为「有界」而非近最优。`,
              en: `Under the (u,d)/ notation the Square-2 has ${SQ2_STATE_COUNT_STR} reachable states (= 12·18!, from Schreier-Sims) — far too many to BFS, and single-phase IDA* explodes on random states, so solutions are NOT optimal. The solver uses a constructive reduction (fix parity, then home each wedge with conjugated 3-cycles): ANY scramble returns a VALID, BOUNDED solution, but noticeably longer than the shortest (measured mean ≈ 70 tuples) — labeled "bounded", not near-optimal.`,
            })}
          </div>
        </>
      )}
    </div>
  );
}
