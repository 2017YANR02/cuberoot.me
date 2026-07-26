'use client';

/**
 * /scramble/sq1 — Square-1 在线求解器。
 *
 * 引擎 = **cs0x7f 的 sq12phase**(cstimer 自带,`tools/cstimer-scramble/scramble/
 * scramble_sq1_new.js`;上游只用它生成随机态打乱,我们在同一份搜索上加了一层
 * `solveScramble` 反过来求解,细节见该文件末尾的注释块),经 worker 调用,出**近最优**解,
 * 并对同一段解报三套计步口径(扭转 / WCA 12c4 / 面转)。真最优(单阶段 IDA*)与
 * WCA 12c4 口径的上帝之数详见 /math/sq1。
 *
 * 换引擎的原因(2026-07-26):原先用的是 timer/_lib/solver/sq1(cstimer gsolver 移植),
 * 它的状态串只把块分成 {顶棱/顶角/底棱/底角} 四类、也不跟踪赤道朝向,所以「排列」阶段
 * 根本分不出同层内的具体块 —— 出的解只还原形状与分层,单个层转 (1,0) 甚至被判成
 * 「已是还原态」。判据(tnoodle 件位模型独立复核)见 tests/sq1_solver_oracle.test.ts。
 *
 * 打乱的**输入**有两种视图(`?view=`):`flat` 静态展开图(默认,零 WebGL),
 * `board` 可拖立体转盘(`_InteractiveSq1Board`,拖出来的每一步写回打乱框)。
 * 斜转 / 金字塔 / 二阶那三块是平面涂色画板,SQ1 不能照做 —— 它的状态是形状 + 排列,
 * 不是 facelet 串,涂色表达不了(理由详见 `_InteractiveSq1Board` 头注)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ListSelect } from '@/components/ListSelect';
import { Spinner } from '@/components/Spinner/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { pooledScramble, prewarmScramble } from '@/lib/cubing-scramble';
import { cstimerSolveByKey } from '@/lib/cstimer-scramble';
import { sq1MoveCounts, type Sq1MoveCounts } from '@/lib/sq1-metrics';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import InteractiveSq1Board from './_InteractiveSq1Board';
import '../_components/puzzle_optimal_solver.css';
import './sq1_solver.css';

interface Outcome {
  scramble: string;
  solution: string;
  counts: Sq1MoveCounts;
}

const METRIC_CARDS = [
  { key: 'twist' as const, cls: 'is-twist', name: { zh: '扭转(切片)', en: 'Twist (slices)' }, rule: { zh: '只数 /', en: 'count only /' }, god: '13' },
  { key: 'wca' as const, cls: 'is-wca', name: { zh: 'WCA 12c4', en: 'WCA 12c4' }, rule: { zh: '(X,Y)=1,/=1', en: '(X,Y)=1, /=1' }, god: '?' },
  { key: 'face' as const, cls: 'is-face', name: { zh: '面转', en: 'Face-turn' }, rule: { zh: '双层=2', en: 'double=2' }, god: '31' },
];

async function solveScramble(scramble: string): Promise<Outcome> {
  const solution = await cstimerSolveByKey('sqrs', scramble);
  return { scramble, solution, counts: sq1MoveCounts(solution) };
}

type View = 'flat' | 'board';

export default function Sq1SolverPage() {
  const { i18n } = useTranslation();
  void i18n;
  const t = useT();
  useDocumentTitle('SQ1 求解器', 'Square-1 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['flat', 'board']).withDefault('flat'),
  );
  const [boardSize, setBoardSize] = useState(300);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void prewarmScramble('sq1');
      // 空串 = 还原态,秒回,但会让 worker 把形状 / 排列剪枝表建起来。
      void cstimerSolveByKey('sqrs', '').catch(() => { /* 预热失败不影响真求解报错 */ });
    }, 800);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const upd = () => setBoardSize(Math.min(320, Math.max(200, window.innerWidth - 64)));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';
  const hasTokens = useMemo(() => /[\d/]/.test(trimmed), [trimmed]);

  // 打乱变化 → 防抖求解。搜索在 worker 里(首次会建形状/排列剪枝表),主线程不冻。
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
      solveScramble(trimmed).then(
        (out) => {
          if (seq.current !== id) return;
          setResult(out);
          setSolving(false);
        },
        (e: unknown) => {
          if (seq.current !== id) return;
          // 引擎唯一的失败模式是「这串不是合法 SQ1 状态」(记号能解析但形状不可达)。
          setError((e as Error)?.message?.includes('no solution') ? 'illegal' : String((e as Error)?.message ?? e));
          setSolving(false);
        },
      );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [trimmed, hasTokens, lineCount]);

  const showResult = result && result.scramble === trimmed;

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'sq1',
    metricLabel: 'WCA 12c4',
    placeholder: {
      zh: '每行一条打乱,如 (1,0)/(-3,3)/(0,-3)/',
      en: 'one scramble per line, e.g. (1,0)/(-3,3)/(0,-3)/',
    },
    validate: (line) => (/[\d/]/.test(line.trim()) ? null : line.trim()),
    solveOne: (s) => solveScramble(s).then((out) => ({
      len: out.counts.wca,
      solution: out.solution,
    })),
    randomOne: () => pooledScramble('sq1'),
    // 一个 worker 一条搜索,并发没有意义(反而抢同一份剪枝表)。
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

            <div className="sq1s-view">
              <ListSelect
                clearable={false}
                value={view}
                onChange={(v) => void setView(v as View)}
                allLabel=""
                items={[
                  { value: 'flat', label: t('平面', '2D') },
                  { value: 'board', label: t('立体', '3D') },
                ]}
              />
            </div>

            {view === 'board' ? (
              <div className="sq1s-board">
                <InteractiveSq1Board
                  scramble={scramble}
                  onScrambleChange={(v) => void setScramble(v)}
                  pixelSize={boardSize}
                />
              </div>
            ) : trimmed && hasTokens ? (
              <div className="pos-preview">
                <ScramblePreview2D event="sq1" scramble={trimmed} size={96} />
              </div>
            ) : null}

            {trimmed && hasTokens && (
              <div className="pos-result" aria-live="polite">
                {solving && !showResult && (
                  <p className="pos-solving">
                    <Spinner size={14} />
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
                      <div className="sq1s-solbox">{result.solution}</div>
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
          zh: '这是 cs0x7f 的 sq12phase 两阶段近最优解(先归方块形再解排列,cstimer 生成随机态打乱用的就是它),不保证全局最少步;真最优要单阶段 IDA*。三个步数里,"/" 切片在任何度量都计 1,差异只在层转:同一段解满足 扭转 ≤ WCA 12c4 ≤ 面转。WCA 12c4 正是计时器报的打乱长度度量,而它的上帝之数至今没人算出来。',
          en: "This is cs0x7f's sq12phase two-phase near-optimal solution (cube shape, then permutation — the same search csTimer uses to generate random-state scrambles), not guaranteed minimal; true optimal needs single-phase IDA*. Across the three counts, a \"/\" slice always counts 1; the only divergence is layer turns, so twist ≤ WCA 12c4 ≤ face-turn. WCA 12c4 is the metric your timer reports as scramble length — and its God's number has never been computed.",
        })}
        {' '}
        <AppLink href="/math/god?event=sq1">
          {tr({ zh: 'Square-1 上帝之数', en: "Square-1's God number" })} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </AppLink>
      </div>
    </div>
  );
}
