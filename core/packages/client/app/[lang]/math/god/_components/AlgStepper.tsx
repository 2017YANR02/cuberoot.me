'use client';

/**
 * Single-track step-through solver visual: render a cube starting at `from`,
 * then walk forward through `solution` one HTM move at a time until solved.
 *
 * Shares the `.god-tp-*` interaction language already established by
 * TwoPhaseDemo.tsx (cube box + phase badge + play/step controls + move
 * track) — reused here for a single linear algorithm instead of a two-phase
 * split, so any place that needs "watch a specific solve happen" doesn't
 * reinvent its own stepper.
 */
import { useEffect, useMemo, useState } from 'react';
import { VisualCube } from '@/components/VisualCube';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, ChevronsRight } from 'lucide-react';

interface Props {
  /** state to render at step 0, applied forward from solved */
  from: string;
  /** moves to step through on top of `from`, one HTM move per step */
  solution: string;
  size?: number;
  isZh: boolean;
  doneLabel: { zh: string; en: string };
  progressLabel: { zh: string; en: string };
}

export default function AlgStepper({ from, solution, size = 180, isZh, doneLabel, progressLabel }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const tokens = useMemo(() => solution.trim().split(/\s+/).filter(Boolean), [solution]);
  const total = tokens.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const solved = step >= total;

  useEffect(() => { setStep(0); setPlaying(false); }, [from, solution]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(timer);
  }, [playing, step, total]);

  const setupAlg = useMemo(() => {
    const played = tokens.slice(0, step).join(' ');
    return [from.trim(), played].filter(Boolean).join(' ');
  }, [from, tokens, step]);

  const next = () => setStep((s) => Math.min(total, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const reset = () => { setStep(0); setPlaying(false); };
  const toEnd = () => { setStep(total); setPlaying(false); };

  return (
    <div className="god-tp-left" style={{ width: size + 60 }}>
      <div className="god-tp-cubebox">
        <VisualCube algorithm="" setup={setupAlg} view="iso" puzzleSize={3} size={size} alt={solved ? 'solved' : `step ${step}`} />
        <div className={`god-tp-phase-badge ${solved ? 'is-done' : 'is-p2'}`}>
          {solved ? t(doneLabel.zh, doneLabel.en) : <>{t(progressLabel.zh, progressLabel.en)} <span>· {step}/{total}</span></>}
        </div>
      </div>

      <div className="god-tp-controls">
        <button className="god-btn-secondary god-tp-iconbtn" onClick={reset} title={t('重置', 'reset')} disabled={step === 0}>
          <RotateCcw size={16} />
        </button>
        <button className="god-btn-secondary god-tp-iconbtn" onClick={prev} title={t('上一步', 'prev')} disabled={step === 0}>
          <SkipBack size={16} />
        </button>
        <button className="god-btn-primary god-tp-iconbtn" onClick={() => setPlaying((p) => !p)} title={playing ? t('暂停', 'pause') : t('播放', 'play')} disabled={solved}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="god-btn-secondary god-tp-iconbtn" onClick={next} title={t('下一步', 'next')} disabled={solved}>
          <SkipForward size={16} />
        </button>
        <button className="god-btn-secondary god-tp-iconbtn" onClick={toEnd} title={t('跳到最后', 'to end')} disabled={solved}>
          <ChevronsRight size={16} />
        </button>
      </div>

      <div className="god-tp-step-readout">
        <span>{t('步数', 'Step')}: <b>{step}</b> / {total} HTM</span>
      </div>

      <div className="god-tp-track">
        {tokens.map((m, i) => (
          <span key={i} className={`god-tp-move is-p2 ${i < step ? 'is-done' : ''} ${i === step ? 'is-cur' : ''}`}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
