'use client';

/**
 * /scramble/sq1 — Square-1 在线求解器。
 *
 * 用站内现有的 TS 两阶段引擎(timer/_lib/solver/sq1 的 solveSq1,Cube Shape → Permutation)
 * 求一个**近最优**解,并对结果同时报三套计步口径(扭转 / WCA 12c4 / 面转)。
 * 引擎的 BFS 最小化的是「顶转 + 底转 + 切片」token 数,约等于面转口径下的近最优;
 * 真最优(单阶段 IDA*)与 WCA 12c4 口径的上帝之数详见 /math/sq1。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, ArrowRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { pooledScramble, prewarmScramble } from '@/lib/cubing-scramble';
import { sq1MoveCounts, type Sq1MoveCounts } from '@/lib/sq1-metrics';
import { solveSq1 } from '../../timer/_lib/solver/sq1';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './sq1_solver.css';

interface StageView { head: string; moves: string; raw: number; }
interface Outcome {
  scramble: string;
  solution: string;
  stages: StageView[];
  counts: Sq1MoveCounts;
  ok: boolean;
}

const METRIC_CARDS = [
  { key: 'twist' as const, cls: 'is-twist', name: { zh: '扭转(切片)', en: 'Twist (slices)' }, rule: { zh: '只数 /', en: 'count only /' }, god: '13' },
  { key: 'wca' as const, cls: 'is-wca', name: { zh: 'WCA 12c4', en: 'WCA 12c4' }, rule: { zh: '(X,Y)=1,/=1', en: '(X,Y)=1, /=1' }, god: '?' },
  { key: 'face' as const, cls: 'is-face', name: { zh: '面转', en: 'Face-turn' }, rule: { zh: '双层=2', en: 'double=2' }, god: '31' },
];

function solveScramble(scramble: string): Outcome {
  const res = solveSq1(scramble);
  const ok = res.stages.length === 2 && !res.stages.some((s) => s.failed);
  const stages: StageView[] = res.stages.map((s) => ({
    head: s.head,
    moves: s.moves.join(' '),
    raw: s.rawMoves.length,
  }));
  const solution = res.stages.flatMap((s) => s.moves).join(' ');
  return { scramble, solution, stages, counts: sq1MoveCounts(solution), ok };
}

export default function Sq1SolverPage() {
  const { i18n } = useTranslation();
  void i18n;
  useDocumentTitle('SQ1 求解器', 'Square-1 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => prewarmScramble('sq1'), 800);
    return () => window.clearTimeout(id);
  }, []);

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';
  const hasTokens = useMemo(() => /[\d/]/.test(trimmed), [trimmed]);

  // 打乱变化 → 防抖求解。引擎是同步 BFS,首次会懒建剪枝表(≤100k),用 timeout 让出主线程。
  // 仅单条(≤1 行)时跑,≥2 行交给 SolvePanel 的批量求解。
  useEffect(() => {
    const id = ++seq.current;
    setError(null);
    if (!trimmed || !hasTokens || lineCount > 1) {
      setResult(null);
      setSolving(false);
      return;
    }
    setSolving(true);
    const timer = window.setTimeout(() => {
      try {
        const out = solveScramble(trimmed);
        if (seq.current !== id) return;
        setResult(out);
        if (!out.ok) setError('illegal');
        setSolving(false);
      } catch (e) {
        if (seq.current !== id) return;
        setError(String((e as Error)?.message ?? e));
        setSolving(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [trimmed, hasTokens, lineCount]);

  const showResult = result && result.scramble === trimmed && result.ok;

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'sq1',
    metricLabel: 'WCA 12c4',
    placeholder: {
      zh: '每行一条打乱,如 (1,0)/(-3,3)/(0,-3)/',
      en: 'one scramble per line, e.g. (1,0)/(-3,3)/(0,-3)/',
    },
    validate: (line) => (/[\d/]/.test(line.trim()) ? null : line.trim()),
    solveOne: (s) => new Promise((resolve, reject) => {
      // 同步 BFS,setTimeout 让出主线程让进度更新 + 不冻 UI。
      window.setTimeout(() => {
        try {
          const out = solveScramble(s);
          if (!out.ok) { reject(new Error('illegal')); return; }
          resolve({ len: out.counts.wca, solution: out.solution });
        } catch (e) { reject(e as Error); }
      }, 0);
    }),
    randomOne: () => pooledScramble('sq1'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="sq1" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: 'Square-1 在线求解:两阶段近最优解,并对同一段解给出三套度量的步数。',
                en: 'Square-1 online solver: a two-phase near-optimal solution, with the move count under all three metrics.',
              })}
            </p>

            {trimmed && hasTokens && (
              <div className="pos-preview">
                <ScramblePreview2D event="sq1" scramble={trimmed} size={96} />
              </div>
            )}

            {trimmed && hasTokens && (
              <div className="pos-result" aria-live="polite">
                {solving && !showResult && (
                  <p className="pos-solving">
                    <LoaderCircle size={14} className="pos-spin" aria-hidden />
                    {tr({ zh: '求解中(首次建表约 1 秒)…', en: 'Solving (first run builds tables, ~1s)…' })}
                  </p>
                )}

                {error === 'illegal' && !solving && (
                  <p className="pos-error">
                    {tr({ zh: '打乱不合法或无法求解,请检查记号(应为 (a,b)/ 形式)。', en: 'Scramble is illegal or unsolvable — check the notation (expects (a,b)/).' })}
                  </p>
                )}
                {error && error !== 'illegal' && !solving && (
                  <p className="pos-error">{tr({ zh: '求解失败', en: 'Solve failed' })}: {error}</p>
                )}

                {showResult && (
                  <>
                    <div className="sq1s-metrics">
                      {METRIC_CARDS.map((m) => (
                        <div key={m.key} className={`sq1s-mcard ${m.cls}`}>
                          <div className="sq1s-mname">{tr(m.name)}</div>
                          <div className="sq1s-mrule">{tr(m.rule)}</div>
                          <div className="sq1s-mval">{result.counts[m.key]}</div>
                          <div className="sq1s-mgod">
                            {m.god === '?'
                              ? tr({ zh: '上帝之数 未知', en: "God's number unknown" })
                              : tr({ zh: `上帝之数 ${m.god}`, en: `God's number ${m.god}` })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {result.counts.turns + result.counts.slices === 0 ? (
                      <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                    ) : (
                      <>
                        <div className="sq1s-solbox">{result.solution}</div>
                        <div className="sq1s-stages">
                          {result.stages.map((s) => (
                            <div key={s.head} className="sq1s-stage">
                              <div className="sq1s-stage-head">
                                {s.head === 'Shape' ? tr({ zh: '方块形', en: 'Cube shape' }) : tr({ zh: '排列', en: 'Permutation' })}
                              </div>
                              <div className="sq1s-stage-moves">
                                {s.moves || tr({ zh: '(无)', en: '(none)' })}
                                <span className="sq1s-stage-count"> {tr({ zh: `${s.raw} 面转`, en: `${s.raw} face turns` })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      />

      <div className="sq1s-caveat">
        <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
        {tr({
          zh: '这是两阶段近最优解(先归方块形再解排列),不保证全局最少步;真最优要单阶段 IDA*。三个步数里,"/" 切片在任何度量都计 1,差异只在层转:同一段解满足 扭转 ≤ WCA 12c4 ≤ 面转。WCA 12c4 正是计时器报的打乱长度度量,而它的上帝之数至今没人算出来。',
          en: 'This is a two-phase near-optimal solution (cube shape, then permutation) — not guaranteed minimal; true optimal needs single-phase IDA*. Across the three counts, a "/" slice always counts 1; the only divergence is layer turns, so twist ≤ WCA 12c4 ≤ face-turn. WCA 12c4 is the metric your timer reports as scramble length — and its God\'s number has never been computed.',
        })}
        {' '}
        <AppLink href="/math/god?event=sq1">
          {tr({ zh: 'Square-1 上帝之数', en: "Square-1's God number" })} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </AppLink>
      </div>
    </div>
  );
}
