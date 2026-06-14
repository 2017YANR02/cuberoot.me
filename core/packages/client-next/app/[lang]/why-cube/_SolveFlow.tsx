'use client';

// Six-abilities intro band: one cube that plays the scramble → solve in place
// (auto-starts when scrolled into view), framed by the before/after idea and a
// move-count stat that ticks up. Illustrates "mental rotation" literally.

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Rotate3d } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { useInView, useCountUp } from './_hooks';
import { useT } from '../../../hooks/useT';
import { HERO_SCRAMBLE, HERO_SOLUTION } from './_cube-util';
import './_SolveFlow.css';

const MOVE_COUNT = HERO_SOLUTION.trim().split(/\s+/).filter(Boolean).length;

export default function SolveFlow() {
  useTranslation();
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '200px' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const moves = Math.round(useCountUp(MOVE_COUNT, inView, { duration: 1600 }));

  // auto-play the solve once the cube is mounted (in view)
  useEffect(() => {
    if (!inView) return;
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
    }, 220);
    return () => window.clearInterval(id);
  }, [inView]);

  return (
    <div className="wc-solveflow" ref={ref}>
      <div className="wc-solveflow-stage">
        {inView ? (
          <TwistySection
            puzzle="3x3x3"
            scramble={HERO_SCRAMBLE}
            alg={HERO_SOLUTION}
            playerRef={playerRef}
            settings={{ scale: 50, viewAngle: 50, viewGradient: 34, speed: 60, hint: false }}
          />
        ) : (
          <div className="wc-cube-loading" aria-hidden style={{ minHeight: 240 }} />
        )}
      </div>
      <div className="wc-solveflow-side">
        <div className="wc-solveflow-note">
          <Rotate3d size={22} />
          <span>{t('全程在脑中预演每一块的去向', 'Mentally rotating where every piece lands', "全程在腦中預演每一塊的去向")}</span>
        </div>
        <div className="wc-solveflow-stat">
          <span className="wc-solveflow-num">{moves}</span>
          <span className="wc-solveflow-unit">{t('步', 'moves')}</span>
        </div>
        <p className="wc-solveflow-cap">
          {t(
            '这条解法只有 20 步,是这个打乱的最优解 —— 几秒钟就能拧完。按播放再看一遍。',
            'This solution is just 20 moves — optimal for this scramble — done in seconds. Hit play to watch again.', "這條解法只有 20 步,是這個打亂的最優解 —— 幾秒鐘就能擰完。按播放再看一遍。"
          )}
        </p>
      </div>
    </div>
  );
}
