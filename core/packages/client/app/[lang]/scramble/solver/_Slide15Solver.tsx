'use client';

/**
 * /scramble/solver?event=15p — 15-Puzzle (数字华容道 / 十五数码) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。15 数码状态空间 ≈ 1.05×10¹³(16!/2),太大无法像 8 数码那样整图 BFS,
 * 所以每条打乱用 IDA*(迭代加深 A*)+ Walking-Distance 可采纳启发式现场求解,得到可证最短解(非近似)。
 * 上帝之数 80,随机态平均约 52.6 步。深态可能要一两秒,故求解放进 setTimeout 异步执行,期间显示
 * 「求解中」spinner,界面不会卡死。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('15p')),
 * 记号与 cstimer 完全一致(U D L R,空格滑动方向,可带次数 D2)。预览是 4×4 数字格(非魔方网)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSlide15, SLIDE15_GODS_NUMBER, type Slide15Solution } from '@/lib/slide15-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const SLIDE15_TOKEN_RE = /^([UDLR])(\d+)?$/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Slide15Solution }
  | { kind: 'error'; message: string };

export default function Slide15SolverPage() {
  useDocumentTitle('数字华容道求解器', '15-Puzzle Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const trimmed = scramble.trim();

  // Solve off the render path: deep states (≈ god-number) can cost a couple seconds, so we defer to a
  // macrotask and show a "solving" spinner so the UI never appears frozen.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveSlide15(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed]);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('15p');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '15p',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U R2 D L U',
      en: 'one scramble per line, e.g. U R2 D L U',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !SLIDE15_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveSlide15(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('15p'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="15p" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: '数字华容道(15-Puzzle)在线求解:每条打乱用 IDA* + Walking-Distance 启发式现场算出整解最优解(可证最短,非近似)。上帝之数 80,记号 U D L R 表示空格滑动方向,与 cstimer 一致。',
              en: "15-Puzzle online solver: each scramble is solved on demand by IDA* with the Walking-Distance heuristic, giving the provably shortest solution (not an approximation). God's number is 80; notation U D L R = the direction the blank slides, matching cstimer.",
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 U R2 D L U', en: 'Enter a scramble, e.g. U R2 D L U' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={() => void randomScramble()} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && (
            <div className="pos-result" aria-live="polite">
              {state.kind !== 'error' && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="15p" scramble={trimmed} size={64} />
                </div>
              )}
              {state.kind === 'solving' && (
                <p className="pos-result-solved">
                  <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {tr({ zh: '求解中(深态可能要一两秒)…', en: 'Solving (deep states can take a second or two)…' })}
                </p>
              )}
              {state.kind === 'error' && (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 U D L R,可带次数如 D2)', en: 'Unrecognized notation (expected U D L R, optionally with a count like D2)' })}: <code>{state.message}</code>
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
                      {tr({ zh: '步 最优解', en: state.result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })}
                    </span>
                    <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${SLIDE15_GODS_NUMBER}`, en: `God's number ${SLIDE15_GODS_NUMBER}` })}</span>
                  </div>
                  <div className="ivy-solbox">{state.result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: '15 数码有约 1.05×10¹³ 个状态(16! 的一半),太大无法像 8 数码那样整图 BFS,所以这里用 IDA* + Walking-Distance 可采纳启发式逐条求解 —— 启发式不超过真实距离,故返回的依然是可证的最短解,不是近似。任何打乱最多 80 步可还原,随机态平均约 52.6 步。',
              en: 'The 15-puzzle has ≈ 1.05×10¹³ states (half of all 16! permutations) — far too many to BFS like the 8-puzzle — so it is solved per-instance by IDA* with the admissible Walking-Distance heuristic. Since the heuristic never overestimates the true distance, the returned solution is still a provably shortest path, not an approximation. Any scramble solves in at most 80 moves, ~52.6 on average.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
