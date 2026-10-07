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
  METHOD_REGISTRY,
  scheduleTimer333StepSolve,
  timer333MethodLabel,
  timer333StageLabel,
  type MethodId,
  type SolveResult,
} from '@cuberoot/puzzle-solvers/timer-333-step';
import SolverCompareModal from './TimerSolverCompareModal';
import CuberReconPlayer from './CuberReconPlayer';
import type { ReconPlayerHandle } from './recon/ReconPlayerBase';
import './TimerStepSolve.css';
function persistItem(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* optional preference */ } }


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
  onBlockingChange?(blocked: boolean): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
}

export default function TimerStepSolve({ scramble, isZh, onDismissChange, onBlockingChange }: Props) {
  const tr = (text: { en: string; zh: string }) => text[isZh ? 'zh' : 'en'];
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState<MethodId>('cfop');
  const [cache, setCache] = useState<{ scramble: string; values: typeof EMPTY }>({ scramble, values: { ...EMPTY } });
  const results = cache.scramble === scramble ? cache.values : EMPTY;
  const [computing, setComputing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  useEffect(() => { onBlockingChange?.(compareOpen); return () => onBlockingChange?.(false); }, [compareOpen, onBlockingChange]);
  const [selection, setSelection] = useState({ key: '', index: -1, revision: 0 });
  const selectionKey = `${methodId}\u0000${scramble}`;
  const selStage = selection.key === selectionKey ? selection.index : -1; // -1 = 完整解法,否则单阶段索引
  // 共享 3D 播放器句柄(CuberReconPlayer 回填),供阶段行 ▷ 跳到开头并播放。
  const playerRef = useRef<ReconPlayerHandle | null>(null);

  useEffect(() => { setMethodId(loadSavedMethod()); }, []);
  useEffect(() => {
    onDismissChange?.(() => { if (!compareOpen) return false; setCompareOpen(false); return true; });
    return () => onDismissChange?.(null);
  }, [compareOpen, onDismissChange]);

  // 展开后按需算当前方法(未缓存才算);BFS 推到微任务,首帧不卡。
  useEffect(() => {
    if (!open || results[methodId]) {
      setComputing(false);
      return;
    }
    const requestKey = `${methodId}\u0000${scramble}`;
    setComputing(true);
    setErrorKey(null);
    return scheduleTimer333StepSolve(
      { scramble, methodId },
      (outcome) => {
        setComputing(false);
        if (outcome.status === 'ready') {
          setCache(previous => ({ scramble, values: { ...(previous.scramble === scramble ? previous.values : EMPTY), [methodId]: outcome.result } }));
        } else {
          setErrorKey(requestKey);
        }
      },
      (run) => {
        const timer = window.setTimeout(run, 0);
        return () => window.clearTimeout(timer);
      },
    );
  }, [open, scramble, methodId, results]);

  const result = results[methodId];
  const requestKey = `${methodId}\u0000${scramble}`;
  const language = isZh ? 'zh' : 'en';

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

  const selectStage = (index: number) => setSelection(previous => ({ key: selectionKey, index, revision: previous.revision + 1 }));
  useEffect(() => {
    if (!open || !selection.revision || selection.key !== selectionKey) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        playerRef.current?.jumpToMoveCount(0);
        playerRef.current?.play();
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [open, selection, selectionKey]);

  return (
    <div className="stepsolve" data-no-timer>
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
                onClick={() => { setMethodId(m.id); persistItem(METHOD_LS_KEY, m.id); }}
              >
                {timer333MethodLabel(m, language)}
              </button>
            ))}
            <button type="button" className="stepsolve-compare" onClick={() => setCompareOpen(true)}>
              {tr({ zh: '对比全部', en: 'Compare all' })}
            </button>
          </div>

          {computing && !result && (
            <div className="stepsolve-status">{tr({ zh: '计算中…', en: 'Computing…' })}</div>
          )}

          {errorKey === requestKey && !result && (
            <div className="stepsolve-status" role="alert">
              {tr({ zh: '未能计算解法', en: 'Unable to compute solution' })}
            </div>
          )}

          {result && (
            <>
              <ol className="stepsolve-stages">
                {result.stages.map((s, i) => {
                  const playable = !s.failed && s.moves.length > 0;
                  return (
                    <li key={s.head}><button type="button" disabled={!playable}
                      className={`stepsolve-row${selStage === i ? ' is-active' : ''}${playable ? '' : ' is-static'}`}
                      onClick={playable ? () => selectStage(i) : undefined}
                    >
                      <span className="stepsolve-label">{timer333StageLabel(methodId, s.head, language)}</span>
                      <span className="stepsolve-count">{s.failed ? '—' : s.moves.length}</span>
                      <code className="stepsolve-alg">
                        {s.failed
                          ? tr({ zh: '未找到', en: 'no solution' })
                          : (s.moves.length === 0 ? tr({ zh: '(跳过)', en: '(skip)' }) : s.moves.join(' '))}
                      </code>
                      {playable && <Play size={11} className="stepsolve-play" />}
                    </button></li>
                  );
                })}
                <li><button type="button"
                  className={`stepsolve-row stepsolve-total${selStage < 0 ? ' is-active' : ''}`}
                  onClick={() => selectStage(-1)}
                >
                  <span className="stepsolve-label">{tr({ zh: '完整', en: 'Full' })}</span>
                  <span className="stepsolve-count">{result.totalMoves}</span>
                  <code className="stepsolve-alg">{tr({ zh: '演示整套还原', en: 'play whole solve' })}</code>
                  <Play size={11} className="stepsolve-play" />
                </button></li>
              </ol>

              {playerAlg && (
                <div className="stepsolve-player">
                  {/* 与上面 StageSolver 同一个播放器(/recon 那份,跑站内 /sim 引擎):
                      「打乱 + 一串步骤」正是它的输入形状,选中阶段的起手位就是 setup。
                      背面小窗关掉 —— 这里只有 300px 见方。 */}
                  <CuberReconPlayer key={selectionKey}
                    order={3}
                    scramble={playerSetup}
                    alg={playerAlg}
                    playerRef={playerRef}
                    backView={false}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {compareOpen && (
        <SolverCompareModal key={scramble} scramble={scramble} isZh={isZh} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
