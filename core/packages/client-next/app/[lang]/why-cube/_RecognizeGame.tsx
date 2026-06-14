'use client';

// "识别 → 套公式" mini-game for the computational-thinking section. Show a
// last-layer case, pick the algorithm that solves it; a correct pick animates
// the case → solved in 3D. Reinforces "recognize the pattern, run the
// matching algorithm" (the if/then of solving).

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { Check, X, RotateCcw } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { useT } from '../../../hooks/useT';
import { invertAlg } from './_cube-util';
import './_RecognizeGame.css';

const VisualCube = dynamic(() => import('@/components/VisualCube').then((m) => m.VisualCube), {
  ssr: false,
  loading: () => <span className="wc-cube-ph" aria-hidden="true" />,
});

type Case = {
  label: string;            // ascii name — no CJK, so no Traditional needed
  view: 'oll' | 'pll';
  alg: string;              // the algorithm that solves this case
  choices: string[];        // shown as buttons; the one === alg is correct
};

const CASES: Case[] = [
  {
    label: 'Sune (OLL)',
    view: 'oll',
    alg: "R U R' U R U2 R'",
    choices: ["F R U R' U' F'", "R U R' U R U2 R'"],
  },
  {
    label: 'T-Perm (PLL)',
    view: 'pll',
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    choices: ["R U R' U' R' F R2 U' R' U' R U R' F'", 'M2 U M2 U2 M2 U M2'],
  },
  {
    label: 'Anti-Sune (OLL)',
    view: 'oll',
    alg: "R U2 R' U' R U' R'",
    choices: ["R U2 R' U' R U' R'", "F R U R' U' F'"],
  },
  {
    label: 'Ua-Perm (PLL)',
    view: 'pll',
    alg: "M2 U M U2 M' U M2",
    choices: ['M2 U M2 U2 M2 U M2', "M2 U M U2 M' U M2"],
  },
];

export default function RecognizeGame() {
  useTranslation();
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  const c = CASES[idx];
  const solved = picked === c.alg;
  const wrong = picked != null && picked !== c.alg;

  // Auto-play the case → solved animation once the answer is correct.
  useEffect(() => {
    if (!solved) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      tries += 1;
      if (p && typeof p.play === 'function') {
        try { p.background = 'none'; } catch { /* */ }
        try { p.timestamp = 0; } catch { /* */ }
        try { p.play(); } catch { /* */ }
        window.clearInterval(id);
      } else if (tries > 30) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [solved, idx]);

  function next() {
    setPicked(null);
    setIdx((i) => (i + 1) % CASES.length);
  }

  return (
    <div className="wc-rg">
      <div className="wc-rg-head">
        <span className="wc-rg-step">{t('练习', 'Try it')} {idx + 1}/{CASES.length}</span>
        <span className="wc-rg-q">{t('认出这是哪种情形,该用哪个公式?', 'Spot the case — which algorithm solves it?')}</span>
      </div>

      <div className="wc-rg-body">
        <div className="wc-rg-cube">
          {solved ? (
            <TwistySection
              puzzle="3x3x3"
              scramble={invertAlg(c.alg)}
              alg={c.alg}
              playerRef={playerRef}
              settings={{ scale: 54, viewAngle: 50, viewGradient: 30, speed: 58, hint: false }}
            />
          ) : (
            <VisualCube algorithm={c.alg} view={c.view} size={132} alt={`${c.label} case`} loading="lazy" />
          )}
        </div>

        <div className="wc-rg-choices">
          {c.choices.map((choice) => {
            const isPicked = picked === choice;
            const isRight = choice === c.alg;
            const state = isPicked ? (isRight ? 'right' : 'wrong') : (solved && isRight ? 'right' : '');
            return (
              <button
                key={choice}
                type="button"
                className={`wc-rg-choice${state ? ` is-${state}` : ''}`}
                onClick={() => setPicked(choice)}
                disabled={solved}
              >
                <code>{choice.replace(/'/g, '′')}</code>
                {state === 'right' && <Check size={16} className="wc-rg-mark" />}
                {state === 'wrong' && <X size={16} className="wc-rg-mark" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="wc-rg-foot">
        {solved ? (
          <>
            <span className="wc-rg-msg is-right">
              <Check size={15} />{t('对了!认出图案 → 套用公式 → 还原。', 'Right! Recognize the pattern → apply the algorithm → solved.')}
            </span>
            <button type="button" className="wc-rg-next" onClick={next}>
              <RotateCcw size={14} />{t('下一个', 'Next')}
            </button>
          </>
        ) : wrong ? (
          <span className="wc-rg-msg is-wrong">
            <X size={15} />{t('不是这个,再看看图案,换一个试试。', 'Not that one — look at the pattern again and try another.')}
          </span>
        ) : (
          <span className="wc-rg-msg">
            {t('这就是计算思维:先识别,再执行对应的步骤。', 'That’s computational thinking: recognize first, then run the matching steps.')}
          </span>
        )}
      </div>
    </div>
  );
}
