'use client';

// Animated pattern gallery: ONE shared 3D cube (single WebGL instance, mounted
// only when scrolled into view). Tap a pattern name and the solved cube turns
// into that pattern (plays the setup alg); drag to rotate.

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useInView } from './_hooks';
import { useT } from '../../../hooks/useT';
import { PATTERNS } from './_cube-util';
import './_PatternGallery.css';

export default function PatternGallery() {
  useTranslation();
  const t = useT();
  const [sel, setSel] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '250px' });

  const Name = ({ i, children }: { i: number; children: ReactNode }) => (
    <button
      type="button"
      className={`wc-gallery-name${i === sel ? ' is-active' : ''}`}
      aria-pressed={i === sel}
      onClick={() => setSel(i)}
    >{children}</button>
  );

  return (
    <div className="wc-gallery" ref={ref}>
      <div className="wc-gallery-stage">
        {inView ? (
          <AlgPlayer
            puzzle="3x3"
            set=""
            engine="sim"
            alg={PATTERNS[sel].setup}
            startSolved
            autoPlay
            playRequest={sel}
            moveDurationMs={300}
            size={280}
          />
        ) : (
          <div className="wc-cube-loading" aria-hidden style={{ minHeight: 260 }} />
        )}
      </div>

      <div className="wc-gallery-names">
        <Name i={0}>{t('棋盘', 'Checkerboard')}</Name>
        <Name i={1}>{t('六个圆点', 'Six Spots')}</Name>
        <Name i={2}>{t('立方中立方', 'Cube in a Cube')}</Name>
        <Name i={3}>{t('驴桥', 'Pons Asinorum')}</Name>
        <Name i={4}>{t('礼物盒', 'Gift Box')}</Name>
        <Name i={5}>{t('超级翻转', 'Superflip')}</Name>
      </div>

      <p className="wc-gallery-hint">
        {t(
          '点一个名字,看还原好的方块拧成这个图案 —— 拖动可以转着看。每个都只是那 4300 亿亿种状态里的一种。',
          'Tap a name and watch the solved cube turn into that pattern — drag to look around. Each is just one of those 43 quintillion states.'
        )}
      </p>
    </div>
  );
}
