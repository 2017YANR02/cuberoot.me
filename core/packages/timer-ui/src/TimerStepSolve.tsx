'use client';

/**
 * 按需挂载的分步解法视图，复用智能魔方复盘的公式列表和共享播放器。
 * 阶段边界只用于定位；回放始终使用原始打乱与完整动作序列。
 */

import { browserClipboardTransport } from './browser-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  METHOD_REGISTRY,
  scheduleTimer333StepSolve,
  TIMER_333_STEP_COPY,
  timer333StepNotation,
  type MethodId,
  type SolveResult,
} from '@cuberoot/puzzle-solvers/timer-333-step';
import SolverCompareModal from './TimerSolverCompareModal';
import CuberReconPlayer from './CuberReconPlayer';
import type { ReconPlayerHandle } from './recon/ReconPlayerBase';
import StepMoveList from './reconstruct/StepMoveList';
import { ReconstructHostContext, useReconstructHost } from './reconstruct/ReconstructHost';
import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import './reconstruct/reconstruct.css';
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
  const host = useReconstructHost();
  const notationHost = useMemo(() => ({
    ...host,
    localize: <T,>(text: { en: T; zh: T }) => text[isZh ? 'zh' : 'en'],
    writeClipboardText: browserClipboardTransport,
  }), [host, isZh]);
  const [methodId, setMethodId] = useState<MethodId>('cfop');
  const [cache, setCache] = useState<{ scramble: string; values: typeof EMPTY }>({ scramble, values: { ...EMPTY } });
  const results = cache.scramble === scramble ? cache.values : EMPTY;
  const [computing, setComputing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [notationToolbar, setNotationToolbar] = useState<HTMLDivElement | null>(null);
  useEffect(() => { onBlockingChange?.(compareOpen); return () => onBlockingChange?.(false); }, [compareOpen, onBlockingChange]);
  const selectionKey = `${methodId}\u0000${scramble}`;
  // Shared player handle for seeking from notation lines.
  const playerRef = useRef<ReconPlayerHandle | null>(null);

  useEffect(() => { setMethodId(loadSavedMethod()); }, []);
  useEffect(() => {
    onDismissChange?.(() => { if (!compareOpen) return false; setCompareOpen(false); return true; });
    return () => onDismissChange?.(null);
  }, [compareOpen, onDismissChange]);

  // Compute only the selected method; unmounting cancels pending work.
  useEffect(() => {
    if (results[methodId]) {
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
  }, [scramble, methodId, results]);

  const result = results[methodId];
  const requestKey = `${methodId}\u0000${scramble}`;
  const language = isZh ? 'zh' : 'en';

  const notation = useMemo(() => result && timer333StepNotation(result, methodId, language), [result, methodId, language]);
  const recon = useMemo<ReconTextResult | null>(() => {
    if (!result || !notation) return null;
    return {
      scramble, inspection: '',
      lines: notation.lines.map(({ key, label, moves, fromIdx, toIdx }) => ({
        key, label, moves, fromIdx, toIdx, kind: 'training',
        recognitionMs: null, executionMs: null, stepMs: null,
      })),
      turns: result.totalMoves, stm: notation.moves.length,
      seconds: 0, tps: null, rotations: [], blindPairs: 0,
      text: notation.text,
    };
  }, [result, scramble, notation]);

  return (
    <div className="stepsolve" data-no-timer>
        <div className="stepsolve-body">
          <div className="stepsolve-tabs">
            <label className="sa-method">
            <select className="sa-method-select stepsolve-method" value={methodId}
              aria-label={tr(TIMER_333_STEP_COPY.method)}
              onChange={event => {
                const method = event.target.value as MethodId;
                setMethodId(method);
                persistItem(METHOD_LS_KEY, method);
              }}>
            {METHOD_REGISTRY.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEn}
              </option>
            ))}
            </select>
            </label>
            <button type="button" className="stepsolve-compare" onClick={() => setCompareOpen(true)}>
              {tr(TIMER_333_STEP_COPY.compare)}
            </button>
            <div className="stepsolve-notation-actions" ref={setNotationToolbar} />
          </div>

          {computing && !result && (
            <div className="stepsolve-status">{tr(TIMER_333_STEP_COPY.loading)}</div>
          )}

          {errorKey === requestKey && !result && (
            <div className="stepsolve-status" role="alert">
              {tr(TIMER_333_STEP_COPY.failed)}
            </div>
          )}

          {result && (
            <>
              <ReconstructHostContext.Provider value={notationHost}>
                <StepMoveList method="training" recon={recon} reference={null} slotReference={null}
                  toolbar={notationToolbar}
                  clipboardText={`${scramble}\n\n${recon?.text ?? ''}`}
                  onSeek={index => playerRef.current?.jumpToMoveCount(index, true)} />
              </ReconstructHostContext.Provider>

              {!!notation?.moves.length && (
                <div className="stepsolve-player">
                  {/* Keep the lossless sequence independent of notation formatting. */}
                  <CuberReconPlayer key={selectionKey}
                    order={3}
                    scramble={scramble}
                    alg={notation.moves.join(' ')}
                    playerRef={playerRef}
                    backView={false}
                  />
                </div>
              )}
            </>
          )}
        </div>

      {compareOpen && (
        <SolverCompareModal key={scramble} scramble={scramble} isZh={isZh} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
