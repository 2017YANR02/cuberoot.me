'use client';

// Animated pattern gallery: ONE shared 3D cube (single WebGL instance, mounted
// only when scrolled into view). Tap a pattern name and the solved cube turns
// into that pattern (plays the setup alg); drag to rotate.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import TwistySection from '@/components/TwistySection';
import { useInView } from './_hooks';
import { useT } from '../../../hooks/useT';
import { PATTERNS } from './_cube-util';
import './_PatternGallery.css';

export default function PatternGallery() {
  useTranslation();
  const t = useT();
  const [sel, setSel] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '250px' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Play solved → pattern whenever the selection changes (once mounted/in view).
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
    }, 200);
    return () => window.clearInterval(id);
  }, [sel, inView]);

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
          <TwistySection
            puzzle="3x3x3"
            scramble=""
            alg={PATTERNS[sel].setup}
            playerRef={playerRef}
            settings={{ scale: 52, viewAngle: 50, viewGradient: 32, speed: 62, hint: false }}
          />
        ) : (
          <div className="wc-cube-loading" aria-hidden style={{ minHeight: 260 }} />
        )}
      </div>

      <div className="wc-gallery-names">
        <Name i={0}>{t('棋盘', 'Checkerboard', "棋盤")}</Name>
        <Name i={1}>{t('六个圆点', 'Six Spots', "六個圓點")}</Name>
        <Name i={2}>{t('立方中立方', 'Cube in a Cube')}</Name>
        <Name i={3}>{t('驴桥', 'Pons Asinorum', "驢橋")}</Name>
        <Name i={4}>{t('礼物盒', 'Gift Box', "禮物盒")}</Name>
        <Name i={5}>{t('超级翻转', 'Superflip', "超級翻轉")}</Name>
      </div>

      <p className="wc-gallery-hint">
        {t(
          '点一个名字,看还原好的方块拧成这个图案 —— 拖动可以转着看。每个都只是那 4300 亿亿种状态里的一种。',
          'Tap a name and watch the solved cube turn into that pattern — drag to look around. Each is just one of those 43 quintillion states.', "點一個名字,看還原好的方塊擰成這個圖案 —— 拖動可以轉著看。每個都只是那 4300 億億種狀態裡的一種。"
        )}
      </p>
    </div>
  );
}
