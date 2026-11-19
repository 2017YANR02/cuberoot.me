'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VisualCube } from '@/components/VisualCube';
import { cubeThumbParams } from '@/lib/alg_thumb_plan';
import { T, tr } from '@/i18n/tr';
import ReadingFit from '../components/ReadingFit';
import VideoProgress from '../components/VideoProgress';
import { J_ALG } from './content';

const purposeEnd = 5500;
const openingEnd = purposeEnd + 7000;
const duration = openingEnd + 6000;
const leftCorners = [36, 38];
// Reuse the canonical corner mask and grey-side filtering while retaining the
// tutorial's exact state and animated facelet outlines.
const cornerDiagram = cubeThumbParams('3x3', 'coll', { kind: 'raw', tag: '', attrs: {} });
const purpose = { zh: 'J 公式用来调整顶角位置', en: 'The J algorithm repositions the top corners' };
const segments = { zh: '开头 → 右公式（学过） → 收尾', en: 'Opening → Right trigger (already learned) → Finish' };
const alignment = { zh: '做公式前若有眼，把眼放左', en: 'Before the J algorithm, put any headlights on the left' };
const result = { zh: '做完 J 公式，顶角的位置会改变', en: 'After the J algorithm, some top corners change positions' };

export default function JFormulaPrelude({ setup, onContinue }: { setup: string; onContinue: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const finished = time >= duration;
  const showingHeadlights = time >= openingEnd && !finished;
  const caption = tr(finished ? result : showingHeadlights ? alignment : time >= purposeEnd ? segments : purpose);

  useEffect(() => {
    setToolbar(root.current?.closest('.lbl-learning')?.querySelector('.lbl-demo-toolbar') ?? null);
  }, []);
  useEffect(() => {
    if (!toolbar || !playing || finished) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (!document.hidden) clock.current = Math.min(duration, clock.current + Math.min(now - (previous ?? now), 50));
      previous = now;
      setTime(clock.current);
      if (clock.current < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [toolbar, playing, finished]);

  const seek = (value: number) => {
    clock.current = value;
    setTime(value);
  };

  return <div ref={root} className="lbl-content" data-tutorial-mode="timeline" data-tutorial-layout="A">
    <section className="lbl-demonstration lbl-headlights-demonstration">
      <div className="lbl-headlights-diagram">
        <VisualCube {...cornerDiagram} local view="plan" scheme="yogwrb" size={320}
          setup={finished ? `${setup} ${J_ALG}` : setup}
          outlinePlanSides outlinedFacelets={showingHeadlights ? leftCorners : undefined}
          alt={caption} />
      </div>
    </section>
    <section className="lbl-explanation tutorial-single-caption"><ReadingFit pane>
      <p className="lbl-lead" aria-live="polite">
        {time < purposeEnd ? <span>{caption}<br />
          <T zh={<>分为<span className="lbl-direction-emphasis">三段</span></>}
            en={<>Split into <span className="lbl-direction-emphasis">three parts</span></>} />
        </span> : time < openingEnd ? <>
          {tr({ zh: '三段分别是：', en: 'The three parts are:' })}<br />{caption}
        </> : caption}
      </p>
      {finished && <button type="button" className="lbl-guide-continue lbl-guide-continue-hint" onClick={onContinue}>
        {tr({ zh: '点击继续', en: 'Click to continue' })}
      </button>}
    </ReadingFit></section>
    {toolbar && createPortal(<div className="lbl-cross-animation-progress">
      <VideoProgress time={time} duration={duration} playing={playing}
        onPlayingChange={setPlaying} onSeek={seek} onReplay={() => seek(0)} />
    </div>, toolbar)}
  </div>;
}
