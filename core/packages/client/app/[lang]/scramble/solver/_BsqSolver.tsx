'use client';

/**
 * /scramble/solver?event=bsq — Bandaged Square-1(受限方块一,cstimer `bsq` = </,(1,0)>)在线求解器。
 *
 * 纯 TS,无 worker、无下载表。受限方块一就是一只物理 Square-1,但**只允许**顶层 `(x,0)` 转 + `/` 切片,
 * 底层永远不直接转(打乱由 cstimer 的 sq1_scramble(2,len) 生成,y 恒为 0)。可达状态是 Square-1 群的一个
 * 大子群(实测有界 BFS 在深度 24、1200 万态仍按 ~3×/层增长),无法整图枚举,故走**三阶段约简**直接解实际状态:
 * 先把形状归到方块形(399 形状 BFS),再解角排列(720 态 BFS),最后用「固定角」的宏解棱排列(720 态 BFS)。
 * 解里只出合法的 `(x,0)/`,绝不出 `(a,b)`(b≠0)那种在受限魔方上物理非法的转动。详见 lib/bsq-solver.ts。
 *
 * 记号 = cstimer 同款 `(x,0) /`:顶层转 x·30°,`/` 同时切上下两层;长度按 cstimer 的「切片数」口径计步。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomBsqScramble, solveBsq, BSQ_STATE_COUNT_STR, type BsqSolution } from '@/lib/bsq-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// random-scramble length for the buttons (cstimer bsq default is 10 slices).
const RANDOM_LEN = 10;
const HAS_TOKENS = /[\d/]/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: BsqSolution }
  | { kind: 'error'; message: string };

export default function BsqSolverPage() {
  useDocumentTitle('受限方块一求解器', 'Bandaged Square-1 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';
  const hasTokens = useMemo(() => HAS_TOKENS.test(trimmed), [trimmed]);

  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || !hasTokens || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveBsq(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed, hasTokens, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'bsq',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 (1,0) / (3,0) / (-5,0) /',
      en: 'one scramble per line, e.g. (1,0) / (3,0) / (-5,0) /',
    },
    validate: (line) => (HAS_TOKENS.test(line.trim()) ? null : line.trim()),
    solveOne: async (s) => {
      const o = solveBsq(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomBsqScramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="bsq" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '受限方块一(Bandaged Square-1)在线求解:只允许顶层 (x,0) 转 + / 切片(底层不直接转),三阶段形状+角+棱约简,给出一条有效且有界的解(非最优),长度随打乱难度变化。记号 (x,0) /(顶层转 x,/ 同切两层),按切片数计步。',
                en: 'Bandaged Square-1 online solver: only top `(x,0)` turns + `/` slices are allowed (the bottom never turns directly). A three-stage shape+corner+edge reduction returns a valid, bounded solution (not optimal); its length varies with the scramble. Notation (x,0) / (top turn x, / slices both); counted in slices.',
              })}
            </p>

            {trimmed && hasTokens && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="bsq" scramble={trimmed} size={96} />
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
                    {tr({ zh: '打乱记号无法识别(应为 (x,0)/ 形式)', en: 'Unrecognized notation (expected (x,0)/)' })}: <code>{state.message}</code>
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
                zh: `受限方块一(Bandaged Square-1)是一只物理 Square-1,但记号被限制成 < / , (1,0) >:只能转顶层 (x,0) 和切片 /,底层从不直接转。可达状态是 Square-1 群的一个**大子群**(${BSQ_STATE_COUNT_STR}),太大无法整图 BFS;单阶段搜索在随机态上会爆。求解器采用**三阶段约简**直接解实际状态(非打乱路径):先把形状归到方块形(399 种形状的 BFS),再解角块排列(720 态表),最后用「固定角」的宏解棱块排列(720 态表)——三段都只用合法的顶层转 + 切片。结果**有效且有界**(非最优),解里绝不出底层转;长度随打乱难度变化(真分布,非单一长度)。`,
                en: `The Bandaged Square-1 is a physical Square-1 whose notation is restricted to < / , (1,0) >: only top (x,0) turns and the / slice — the bottom never turns directly. Its reachable states form a LARGE SUBGROUP of the Square-1 group (${BSQ_STATE_COUNT_STR}) — far too many to BFS, and a single-phase search explodes on random states. The solver uses a genuine THREE-STAGE reduction of the actual STATE (not the scramble path): reduce SHAPE to cube shape (a 399-shape BFS), then CORNER permutation (a 720-state table), then EDGE permutation with corner-fixing macros (a 720-state table) — all three use only legal top-turns + slices. The result is VALID + BOUNDED (not optimal); it never emits a bottom turn, and its length VARIES with the scramble (a real distribution, not a single length).`,
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
