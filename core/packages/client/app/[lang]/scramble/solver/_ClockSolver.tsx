'use client';

/**
 * /scramble/solver?event=clock —— 魔表求解器。
 *
 * 三个视图(魔表没有立体形态,`/sim` 与 twizzle 都是 2D,所以没有「立体」那一项):
 *   ?view=board    交互式 2D 魔表(默认):拖指针画状态,或切「拧」模式点针脚真拧
 *   ?view=scramble 打乱框(SolvePanel,含批量 + 统计)
 *   ?view=recon    复盘:输入一段解法,取逆同步到画板
 *
 * 解由 `lib/clock-solver` 现场算,**可证最优**(不是近似):纯 TS、零下载表、零 worker,
 * 约 17 ms/次。同时给出 WCA 规范 14 步分解 —— 那是 tnoodle 打乱串的形式,恒 ≤ 14 步但通常不最优。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { ListSelect } from '@/components/ListSelect';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import InteractiveClock, { type ClockBoardMode } from '@/components/InteractiveClock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  SOLVED_CLOCK, applyClockMoves, canonicalClockMoves, clockMovesToString,
  clockScrambleForState, clockStateFromAlg, isClockSolved, parseClockMoves,
  randomClockState, solveClock, type ClockState,
} from '@/lib/clock-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './clock_solver.css';

type View = 'board' | 'scramble' | 'recon';

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** 一条魔表算法的逆:招式可交换,所以只需把每步幅度取反(顺序无所谓)。 */
function invertAlg(alg: string) {
  return parseClockMoves(alg).map((m) => ({ ...m, amount: mod12(-m.amount) }));
}

interface Solved {
  optimal: string;
  length: number;
  canonical: string;
  canonicalLength: number;
}

function solveState(state: ClockState): Solved | null {
  try {
    const opt = solveClock(state);
    const canon = canonicalClockMoves(state);
    return {
      optimal: opt.notation,
      length: opt.length,
      canonical: clockMovesToString(canon),
      canonicalLength: canon.length,
    };
  } catch {
    return null;
  }
}

export default function ClockSolver() {
  const t = useT();
  useDocumentTitle('魔表求解器', "Rubik's Clock Solver");

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  // 带 ?scramble= 进来的链接(SolveTabs / 分享)不该被画板挡住 → 首屏落在打乱视图。
  const [scrambleFirst] = useState(() => scramble.trim().length > 0);
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['board', 'scramble', 'recon']).withDefault(scrambleFirst ? 'scramble' : 'board'),
  );

  const [state, setState] = useState<ClockState>(SOLVED_CLOCK);
  const [mode, setMode] = useState<ClockBoardMode>('edit');
  const [reconInput, setReconInput] = useState('');
  const [wrote, setWrote] = useState<string | null>(null);

  // 打乱框第一行 → 画板,三个视图看的是同一个魔表。WCA 打乱串中间带一个 y2,所以求值后
  // rightSideUp=false、两个 9 元块对调 —— 这正是打乱完手里那个姿势,画板照单全收(配色也跟着
  // 换面),与打乱图逐像素同形。半截 / 不认识的记号保持画板不动。
  //
  // 「求打乱」写回的那条不回流:它表示的是同一个物理构型,但按 WCA 起手姿势书写(末态翻面),
  // 回流会让画板凭空翻个个儿。记下自己写的那条、跳过它。
  const selfWrote = useRef<string | null>(null);
  useEffect(() => {
    const first = scramble.split('\n').map((s) => s.trim()).find(Boolean);
    if (!first) return;
    if (first === selfWrote.current) return;
    try {
      setState(clockStateFromAlg(first));
    } catch { /* 记号还没打完 */ }
  }, [scramble]);

  useEffect(() => { setWrote(null); }, [state]);

  // 复盘:输入的是解法,状态 = 对还原态施加它的逆。
  const recon = useMemo(() => {
    const raw = reconInput.trim();
    if (!raw) return { state: null as ClockState | null, err: null as string | null, moves: 0 };
    try {
      const inv = invertAlg(raw);
      return { state: applyClockMoves(SOLVED_CLOCK(), inv), err: null, moves: inv.length };
    } catch (e) {
      return { state: null, err: String((e as Error)?.message ?? e), moves: 0 };
    }
  }, [reconInput]);

  // 复盘视图里输入合法 → 同步到共享状态(切回画板还是同一个魔表)。
  useEffect(() => {
    if (view === 'recon' && recon.state) setState(recon.state);
  }, [view, recon.state]);

  const result = useMemo(() => solveState(state), [state]);
  const solved = isClockSolved(state);

  const deriveScramble = () => {
    const scr = clockScrambleForState(state);
    selfWrote.current = scr;
    void setScramble(scr);
    setWrote(scr);
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'clock',
    metricLabel: t('步(针脚组合)', 'moves (pin sets)'),
    placeholder: {
      zh: '每行一条打乱,如 UR3+ DR2- DL1+ UL4+ U2+ R5- D0+ L3+ ALL1- y2 U4+ R2- D6+ L0+ ALL3+',
      en: 'one scramble per line, e.g. UR3+ DR2- DL1+ UL4+ U2+ R5- D0+ L3+ ALL1- y2 U4+ R2- D6+ L0+ ALL3+',
    },
    validate: (line) => {
      try { parseClockMoves(line); return null; } catch (e) { return String((e as Error)?.message ?? line); }
    },
    solveOne: (s) => new Promise((resolve, reject) => {
      try {
        const out = solveClock(clockStateFromAlg(s));
        resolve({ len: out.length, solution: out.notation || '—' });
      } catch (e) { reject(e as Error); }
    }),
    // 魔表的 WCA 打乱就是均匀随机状态,所以直接用本地求解器的随机态反推,免起 worker。
    randomOne: async () => clockScrambleForState(randomClockState()),
    concurrency: 1,
  }), [t]);

  const resultBlock = (
    <div className="pos-result clocks-out" aria-live="polite">
      {solved ? (
        <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
      ) : result ? (
        <>
          <div className="pos-result-len">
            <span className="pos-result-num">{result.length}</span>
            <span className="pos-result-metric">{tr({ zh: '步', en: result.length === 1 ? 'move' : 'moves' })}</span>
            <span className="clocks-badge">{t('最优解', 'optimal')}</span>
          </div>
          <p className="pos-result-sol">{result.optimal}</p>
          <div className="clocks-canon">
            <span className="clocks-canon-head">
              {t(`WCA 规范 ${result.canonicalLength} 步`, `WCA canonical, ${result.canonicalLength} moves`)}
            </span>
            <code>{result.canonical}</code>
          </div>
        </>
      ) : (
        <p className="pos-error">{t('状态非法(角上的表盘正反必须互为相反数)。', 'Illegal state — each corner dial must be the negation of its partner on the other side.')}</p>
      )}

      <div className="clocks-actions">
        <button type="button" className="clocks-btn" onClick={() => setState(SOLVED_CLOCK())} title={t('回到还原态', 'Reset to solved')}>
          {t('还原', 'Reset')}
        </button>
        <button type="button" className="clocks-btn" onClick={() => setState(randomClockState())} title={t('均匀随机状态(= WCA 打乱的分布)', 'Uniform random state (the same distribution as a WCA scramble)')}>
          {t('随机', 'Random')}
        </button>
        <button
          type="button"
          className="clocks-btn"
          disabled={solved}
          onClick={deriveScramble}
          title={t('反推一条到达当前状态的 WCA 打乱,填进打乱框', 'Derive a WCA scramble that reaches this state and put it in the scramble box')}
        >
          {t('求打乱', 'Scramble')}
        </button>
      </div>
      {wrote !== null && (
        <p className="clocks-wrote">
          {t('已写入打乱框 ', 'Written to the scramble box: ')}<code>{wrote}</code>
        </p>
      )}
    </div>
  );

  return (
    <div className="pos-page">
      <SolveTabs puzzle="clock" mode="solve" />

      <p className="pos-lead">
        {tr({
          zh: '魔表在线求解:纯 TS 本地即时算出可证最优解(不是近似)。魔表群是阿贝尔群,状态数 12¹⁴ ≈ 1.28×10¹⁵,上帝之数 12。',
          en: "Rubik's Clock online solver: a provably optimal solution (not an approximation), computed locally in pure TS. The Clock group is abelian; 12¹⁴ ≈ 1.28×10¹⁵ states, God's number 12.",
        })}
      </p>

      <div className="clocks-view">
        <ListSelect
          clearable={false}
          value={view}
          onChange={(v) => void setView(v as View)}
          allLabel=""
          items={[
            { value: 'board', label: t('平面', '2D') },
            { value: 'scramble', label: t('打乱', 'Scramble') },
            { value: 'recon', label: t('复盘', 'Reconstruction') },
          ]}
        />
      </div>

      {view === 'scramble' ? (
        <SolvePanel
          spec={batchSpec}
          scramble={scramble}
          onScrambleChange={(v) => void setScramble(v)}
          renderSingle={(trimmed) => (
            <>
              {trimmed && (
                <div className="pos-preview">
                  <ScramblePreview2D event="clock" scramble={trimmed} size={200} />
                </div>
              )}
              {trimmed && resultBlock}
            </>
          )}
        />
      ) : (
        <>
          {view === 'board' ? (
            <InteractiveClock
              state={state}
              onChange={setState}
              mode={mode}
              onModeChange={setMode}
            />
          ) : (
            <div className="clocks-recon">
              <textarea
                className="clocks-recon-input"
                value={reconInput}
                onChange={(e) => setReconInput(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={t('输入一段复盘(解法,即打乱的逆),如 UR2+ U3- y2 ALL1+',
                  'Type a reconstruction (the solution — inverse of the scramble), e.g. UR2+ U3- y2 ALL1+')}
              />
              {recon.err ? (
                <div className="clocks-recon-err">{t('记号不认识:', 'Unrecognized notation: ')}{recon.err}</div>
              ) : recon.moves > 0 ? (
                <div className="clocks-recon-ok">
                  {t(`${recon.moves} 步复盘 → 打乱取逆,已同步到魔表`, `${recon.moves}-move reconstruction → the scramble is its inverse, synced to the clock`)}
                </div>
              ) : null}
              <InteractiveClock state={state} onChange={setState} mode="edit" hideControls />
            </div>
          )}
          {resultBlock}
        </>
      )}
    </div>
  );
}
