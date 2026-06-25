'use client';

/**
 * StepSolve — 计时器「分步解法」面板段(原 SolverHints 333 内联视图抽出,现常驻在
 * 解法提示面板里 StageSolver 之下)。按所选方法(CFOP/Roux/Petrus/ZZ/EODR/Thistle)
 * 给出逐阶段还原步骤,并配一个共享 3D 播放器:点某一阶段就从该阶段起手位演示那一段,
 * 点「完整」演示整套。计算(BFS,50-200ms)在展开后才跑,收起时不算。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import {
  solveByMethodId,
  METHOD_REGISTRY,
  type MethodId,
  type SolveResult,
} from '../_lib/solver/methods';
import SolverCompareModal from './SolverCompareModal';
import TwistySection from '@/components/TwistySection';
import { tr } from '@/i18n/tr';

const METHOD_LS_KEY = 'timer.solverHints.method';

function loadSavedMethod(): MethodId {
  try {
    const v = localStorage.getItem(METHOD_LS_KEY);
    if (v && METHOD_REGISTRY.some((m) => m.id === v)) return v as MethodId;
  } catch {
    /* ignore */
  }
  return 'cfop';
}

const EMPTY: Record<MethodId, SolveResult | null> = {
  cfop: null, roux: null, petrus: null, zz: null, eodr: null, thistle: null,
};

interface Props {
  scramble: string;
  isZh: boolean;
}

export default function StepSolve({ scramble, isZh }: Props) {
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState<MethodId>(loadSavedMethod);
  const [results, setResults] = useState<Record<MethodId, SolveResult | null>>(() => ({ ...EMPTY }));
  const [computing, setComputing] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selStage, setSelStage] = useState(-1); // -1 = 完整解法,否则单阶段索引
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    try { localStorage.setItem(METHOD_LS_KEY, methodId); } catch { /* ignore */ }
  }, [methodId]);

  // 打乱变了 → 清缓存(各方法重算)。
  useEffect(() => { setResults({ ...EMPTY }); }, [scramble]);
  // 切方法 / 打乱 → 演示回到「完整」。
  useEffect(() => { setSelStage(-1); }, [methodId, scramble]);

  // 展开后按需算当前方法(未缓存才算);BFS 推到微任务,首帧不卡。
  useEffect(() => {
    if (!open || results[methodId]) return;
    setComputing(true);
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const r = solveByMethodId(scramble, methodId);
        if (!cancelled) { setResults((p) => ({ ...p, [methodId]: r })); setComputing(false); }
      } catch {
        if (!cancelled) { setResults((p) => ({ ...p, [methodId]: { stages: [], totalMoves: 0 } })); setComputing(false); }
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, scramble, methodId, results]);

  const result = results[methodId];

  const fullMoves = useMemo(() => (result ? result.stages.flatMap((s) => s.moves) : []), [result]);
  // prefix[i] = 前 i 个阶段的全部步骤(该阶段动画的起手 setup)。
  const stagePrefix = useMemo(() => {
    const out: string[] = [];
    let acc: string[] = [];
    if (result) for (const s of result.stages) { out.push(acc.join(' ')); acc = acc.concat(s.moves); }
    return out;
  }, [result]);

  const playerSetup = selStage < 0 || !result
    ? scramble
    : `${scramble} ${stagePrefix[selStage] ?? ''}`.trim();
  const playerAlg = selStage < 0 ? fullMoves.join(' ') : (result?.stages[selStage]?.moves.join(' ') ?? '');

  const selectStage = (i: number) => {
    setSelStage(i);
    // 双 rAF 等新 alg/setup 流到播放器后再回到起点并自动播放(同 StageSolver 写法)。
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { playerRef.current?.jumpToStart?.(); } catch { /* */ }
      try { playerRef.current?.play?.(); } catch { /* */ }
    }));
  };

  return (
    <div className="stepsolve">
      <button
        type="button"
        className="stepsolve-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{tr({ zh: '分步解法', en: 'Step-by-step' })}</span>
        <ChevronRight size={13} className={`stepsolve-chevron${open ? ' is-open' : ''}`} />
      </button>

      {open && (
        <div className="stepsolve-body">
          <div className="stepsolve-tabs">
            {METHOD_REGISTRY.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`stepsolve-tab${methodId === m.id ? ' is-active' : ''}`}
                onClick={() => setMethodId(m.id)}
              >
                {isZh ? m.nameZh : m.nameEn}
              </button>
            ))}
            <button type="button" className="stepsolve-compare" onClick={() => setCompareOpen(true)}>
              {tr({ zh: '对比全部', en: 'Compare all' })}
            </button>
          </div>

          {computing && !result && (
            <div className="stepsolve-status">{tr({ zh: '计算中…', en: 'Computing…' })}</div>
          )}

          {result && (
            <>
              <ol className="stepsolve-stages">
                {result.stages.map((s, i) => {
                  const playable = !s.failed && s.moves.length > 0;
                  return (
                    <li
                      key={s.head}
                      className={`stepsolve-row${selStage === i ? ' is-active' : ''}${playable ? '' : ' is-static'}`}
                      onClick={playable ? () => selectStage(i) : undefined}
                    >
                      <span className="stepsolve-label">{s.head}</span>
                      <span className="stepsolve-count">{s.failed ? '—' : s.moves.length}</span>
                      <code className="stepsolve-alg">
                        {s.failed
                          ? tr({ zh: '未找到', en: 'no solution' })
                          : (s.moves.length === 0 ? tr({ zh: '(跳过)', en: '(skip)' }) : s.moves.join(' '))}
                      </code>
                      {playable && <Play size={11} className="stepsolve-play" />}
                    </li>
                  );
                })}
                <li
                  className={`stepsolve-row stepsolve-total${selStage < 0 ? ' is-active' : ''}`}
                  onClick={() => selectStage(-1)}
                >
                  <span className="stepsolve-label">{tr({ zh: '完整', en: 'Full' })}</span>
                  <span className="stepsolve-count">{result.totalMoves}</span>
                  <code className="stepsolve-alg">{tr({ zh: '演示整套还原', en: 'play whole solve' })}</code>
                  <Play size={11} className="stepsolve-play" />
                </li>
              </ol>

              {playerAlg && (
                <div className="stepsolve-player">
                  <TwistySection puzzle="3x3x3" scramble={playerSetup} alg={playerAlg} playerRef={playerRef} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {compareOpen && (
        <SolverCompareModal scramble={scramble} isZh={isZh} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
