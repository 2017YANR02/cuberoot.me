'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Shuffle } from '@app-foundation/icons/lucide';
import { Tooltip } from '@/components/Tooltip';
import ProgressSlider from '@/components/ProgressSlider';
import { tr, T } from '@/i18n/tr';
import PairEditor from '../components/PairEditor';
import { freePlacementKey, placeFreePiece, SOLVED_FREE_PLACEMENT, type FreePracticeCase } from '../lib/free-practice';
import './free-practice-guide.css';

const scenes = [
  { position: 25, click: false, text: { zh: '先选择棱块的位置。可以选择顶层或 FR 槽；非标态先按“非标转化”一章处理。', en: 'First choose the edge position, on the top layer or in the FR slot. For other slots, follow the nonstandard-case lesson first.' } },
  { position: 25, click: true, text: { zh: '点击一个棱位，目标棱块就会放到这里。', en: 'Click an edge position to place the target edge there.' } },
  { position: 25, click: true, text: { zh: '再次点击同一个棱位，棱块翻转，切换到另一种朝向。', en: 'Click the same edge again to flip it to its other orientation.' } },
  { position: 26, click: true, text: { zh: '再点击一个角位，放入与它对应的角块。', en: 'Next, click a corner position to place the matching corner.' } },
  { position: 26, click: true, text: { zh: '再次点击同一个角位，角块切换朝向。', en: 'Click the same corner again to change its orientation.' } },
  { position: 26, click: true, text: { zh: '角块共有三种朝向。继续点击，可以循环切换，直到与手中的魔方一致。', en: 'A corner has three orientations. Keep clicking to cycle through them until it matches your cube.' } },
  { position: 26, click: false, text: { zh: '摆好棱角后，右侧显示对应的打乱和复原公式。按打乱公式，可以在手中的魔方上摆出相同情况。', en: 'The matching scramble and solution appear on the right. Use the scramble to recreate this case on your own cube.' } },
  { position: 26, click: false, text: { zh: '点击“演示复原”观看解法；点击“重新摆放”回到点选。拖动魔方旁的空白区域可以调整视角。', en: 'Choose “Play the solution” to watch the moves, or “Edit the case” to return to picking pieces. Drag the background beside the cube to adjust the view.' } },
];
const sceneDuration = 6000;
const clickAt = 1800;
const total = scenes.length * sceneDuration;
const ignorePiece = () => {};

export default function FreePracticeGuide({ table, orientation, onClose }: {
  table: Map<string, FreePracticeCase>; orientation: string; onClose: () => void;
}) {
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const index = Math.min(scenes.length - 1, Math.floor(time / sceneDuration));
  const elapsed = time - index * sceneDuration;
  const clicked = elapsed >= clickAt;
  const scene = scenes[index];
  const exercise = useMemo(() => {
    let placement = SOLVED_FREE_PLACEMENT;
    for (let i = 0; i <= index; i++) if (scenes[i].click && (i < index || clicked)) placement = placeFreePiece(placement, scenes[i].position);
    return table.get(freePlacementKey(placement));
  }, [index, clicked, table]);
  useEffect(() => {
    if (!ready || !playing) return;
    let frame = 0, previous: number | undefined;
    const tick = (now: number) => {
      clock.current = Math.min(total, clock.current + (document.hidden ? 0 : Math.min(now - (previous ?? now), 50)));
      previous = now;
      setTime(clock.current);
      if (clock.current >= total) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing]);
  const seek = (value: number) => { clock.current = value; setTime(value); };
  return <div className="f2l-free-guide">
    <div className="f2l-lesson f2l-study-lesson">
      <section className="f2l-demo" aria-label={tr({ zh: '使用方法演示', en: 'How to use free practice' })}>
        <div className="f2l-cube f2l-free-guide-cube">
          <PairEditor setup={exercise?.setup ?? ''} orientation={orientation} onPiece={ignorePiece} onReady={() => setReady(true)}
            guide={{ position: scene.position, clicking: scene.click && elapsed >= clickAt - 150 && elapsed < clickAt + 450 }} />
        </div>
      </section>
      <section className="f2l-guidance">
        <p className="f2l-caption"><T zh="使用方法" en="How to use" /></p>
        <p aria-live="polite">{tr(scene.text)}</p>
        {index >= 6 && exercise?.alg && <div className="f2l-free-guide-algs">
          <p className="f2l-free-guide-scramble"><Tooltip content={tr({ zh: '打乱', en: 'Scramble' })}>{tip =>
            <span {...tip} className="f2l-teaching-alg-icon" tabIndex={0} role="img" aria-label={tr({ zh: '打乱', en: 'Scramble' })}><Shuffle size={19} aria-hidden="true" /></span>
          }</Tooltip><code>{exercise.setup}</code></p>
          <p><T zh="公式" en="Algorithm" /> · {exercise.name}</p><code>{exercise.alg}</code>
        </div>}
        <button type="button" className="f2l-restart" onClick={onClose}><T zh="开始练习" en="Start practicing" /></button>
      </section>
    </div>
    <div className="f2l-free-guide-progress">
      <ProgressSlider value={time} max={total} disabled={!ready} keyboardStep={1000}
        onChange={seek} onInteractionStart={() => setPlaying(false)} onInteractionEnd={() => setPlaying(true)}
        ariaLabel={tr({ zh: '使用方法演示进度', en: 'Guide progress' })} />
      <div className="f2l-free-guide-controls">
        <Tooltip content={tr(playing ? { zh: '暂停', en: 'Pause' } : { zh: '播放', en: 'Play' })}>{tip =>
          <button {...tip} type="button" className="f2l-restart" aria-label={tr(playing ? { zh: '暂停', en: 'Pause' } : { zh: '播放', en: 'Play' })} disabled={!ready} onClick={() => { if (time >= total) seek(0); setPlaying(value => !value); }}>
            {playing ? <Pause size={21} aria-hidden="true" /> : <Play size={21} aria-hidden="true" />}
          </button>
        }</Tooltip>
        <Tooltip content={tr({ zh: '重播', en: 'Replay' })}>{tip =>
          <button {...tip} type="button" className="f2l-restart" aria-label={tr({ zh: '重播', en: 'Replay' })} onClick={() => { seek(0); setPlaying(true); }}><RotateCcw size={21} aria-hidden="true" /></button>
        }</Tooltip>
      </div>
    </div>
  </div>;
}
