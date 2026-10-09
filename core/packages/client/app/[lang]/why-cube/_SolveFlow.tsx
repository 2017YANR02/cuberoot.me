'use client';

// Six-abilities intro band: one cube that plays the scramble → solve in place
// (auto-starts when scrolled into view), framed by the before/after idea and a
// move-count stat that ticks up. Illustrates "mental rotation" literally.

import { useTranslation } from 'react-i18next';
import { Rotate3d } from 'lucide-react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useInView, useCountUp } from './_hooks';
import { useT } from '../../../hooks/useT';
import { HERO_SCRAMBLE, HERO_SOLUTION } from './_cube-util';
import './_SolveFlow.css';

const MOVE_COUNT = HERO_SOLUTION.trim().split(/\s+/).filter(Boolean).length;

export default function SolveFlow() {
  useTranslation();
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '200px' });
  const moves = Math.round(useCountUp(MOVE_COUNT, inView, { duration: 1600 }));

  return (
    <div className="wc-solveflow" ref={ref}>
      <div className="wc-solveflow-stage">
        {inView ? (
          <AlgPlayer
            puzzle="3x3"
            set=""
            engine="sim"
            alg={HERO_SOLUTION}
            setup={HERO_SCRAMBLE}
            autoPlay
            moveDurationMs={360}
            size={280}
          />
        ) : (
          <div className="wc-cube-loading" aria-hidden style={{ minHeight: 240 }} />
        )}
      </div>
      <div className="wc-solveflow-side">
        <div className="wc-solveflow-note">
          <Rotate3d size={22} />
          <span>{t('全程在脑中预演每一块的去向', 'Mentally rotating where every piece lands')}</span>
        </div>
        <div className="wc-solveflow-stat">
          <span className="wc-solveflow-num">{moves}</span>
          <span className="wc-solveflow-unit">{t('步', 'moves')}</span>
        </div>
        <p className="wc-solveflow-cap">
          {t(
            '这条解法只有 20 步,是这个打乱的最优解 —— 几秒钟就能拧完。按播放再看一遍。',
            'This solution is just 20 moves — optimal for this scramble — done in seconds. Hit play to watch again.'
          )}
        </p>
      </div>
    </div>
  );
}
