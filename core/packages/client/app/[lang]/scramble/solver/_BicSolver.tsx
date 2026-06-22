'use client';

/**
 * /scramble/solver?event=bic — Bicube(联体魔方)整解最优在线求解器。TIER B(离线精确距离表)。
 *
 * 纯 TS:Bicube(Uwe Meffert 受限 3×3×3)可达态恰 1,108,800 个,但浏览器现场 BFS 整图实测 ~6.4s/~510MB
 * 峰值 → 移动端必崩。故改 TIER B:离线 BFS 一次,把每态精确最优距离按确定性 rank 索引,gzip 成 ~1.8MB 的
 * opt_bic.bin.gz;首次求解时 fetch+inflate(DecompressionStream)→ 常驻 ~10MB 类型化数组(Float64 sorted
 * ranks + Uint8 dist),再梯度下降出可证最短解。无现场 BFS、无 510MB Map。打乱来源复用 /scramble/gen 的
 * cstimer 桥(cstimerScramble('bic')),记号与 cstimer 完全一致(U U' U2 F F' F2 L L' L2 R R' R2,
 * 受 bandaging 门控)。上帝之数 28(面转计步;出处 jaapsch.net)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveBic, BIC_GODS_NUMBER, type BicSolution } from '@/lib/bicube-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const BIC_TOKEN_RE = /^[UFLR](2|')?$/;
const BIC_NOTE = "U U' U2 F F' F2 L L' L2 R R' R2";

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: BicSolution }
  | { kind: 'error'; message: string; tableError?: boolean };

export default function BicSolverPage() {
  useDocumentTitle('联体魔方求解器', 'Bicube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const trimmed = scramble.trim();

  // Async solve: solveBic lazily fetches + inflates the ~1.8MB table on first call (then it's cached), and
  // solves by gradient descent. Guard with a request counter so a stale resolve can't overwrite a newer one.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    let cancelled = false;
    solveBic(trimmed).then(
      (result) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'done', result }); },
      (e) => {
        if (cancelled || reqRef.current !== myReq) return;
        const message = String((e as Error)?.message ?? e);
        // a parse error starts with "bad:" (BIC_TOKEN_RE rejected); anything else = table fetch/inflate failure.
        setState({ kind: 'error', message, tableError: !message.startsWith('bad:') });
      },
    );
    return () => { cancelled = true; };
  }, [trimmed]);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('bic');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'bic',
    metricLabel: 'moves',
    placeholder: {
      zh: "每行一条打乱,如 U F2 L' R",
      en: "one scramble per line, e.g. U F2 L' R",
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !BIC_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = await solveBic(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('bic'),
    concurrency: 1, // single shared table fetch (cached after the first solve)
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="bic" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: `联体魔方在线求解:任意打乱的整解最优解(全空间 1,108,800 态离线精确距离表,上帝之数 28,面转计步)。记号 ${BIC_NOTE},与 cstimer 一致(受 bandaging 门控)。`,
              en: `Bicube online solver: the exact optimal solution for any scramble (offline exact-distance table over all 1,108,800 states; God's number is 28 in the face-turn metric). Notation ${BIC_NOTE}, matching cstimer (gated by bandaging).`,
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: "输入打乱,如 U F2 L' R", en: "Enter a scramble, e.g. U F2 L' R" })}
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
                  <ScramblePreview2D event="bic" scramble={trimmed} size={64} />
                </div>
              )}
              {state.kind === 'solving' && (
                <p className="pos-result-solved">
                  <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {tr({ zh: '求解中(首次会加载约 1.8MB 距离表)…', en: 'Solving (the first call loads the ~1.8MB distance table)…' })}
                </p>
              )}
              {state.kind === 'error' && state.tableError && (
                <p className="pos-error">
                  {tr({ zh: '距离表加载失败,请检查网络后重试', en: 'Failed to load the distance table — check your connection and retry' })}: <code>{state.message}</code>
                </p>
              )}
              {state.kind === 'error' && !state.tableError && (
                <p className="pos-error">
                  {tr({ zh: `打乱记号无法识别(应为 ${BIC_NOTE})`, en: `Unrecognized notation (expected ${BIC_NOTE})` })}: <code>{state.message}</code>
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
                    <span className="ivy-metric-god">{tr({ zh: `上帝之数 ${BIC_GODS_NUMBER}`, en: `God's number ${BIC_GODS_NUMBER}` })}</span>
                  </div>
                  <div className="ivy-solbox">{state.result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: 'Bicube(Uwe Meffert 的受限 3×3×3,角与棱被粘成 2×1×1 块,多数面被 bandaging 锁住)的可达状态恰为 1,108,800 个,每态的精确最优距离已离线算好、压成约 1.8MB 的距离表;浏览器首次求解时加载它(常驻约 10MB),再沿表梯度下降,所以这里给出的是真正的最短解,不是近似。任何打乱最多 28 步可还原(面转计步,出处 jaapsch.net),平均约 18.80 步。',
              en: 'The Bicube (Uwe Meffert\'s bandaged 3×3×3 — a corner and an edge glued into 2×1×1 blocks, most faces locked by bandaging) has exactly 1,108,800 reachable states; the exact optimal distance of every state is precomputed offline into a ~1.8MB table. The browser loads it on the first solve (~10MB resident) and follows it by gradient descent, so every solution here is a true shortest path, not an approximation. Any scramble solves in at most 28 moves (face-turn metric, figure from jaapsch.net), ~18.80 on average.',
            })}
          </div>
        </>
      )}
    </div>
  );
}
