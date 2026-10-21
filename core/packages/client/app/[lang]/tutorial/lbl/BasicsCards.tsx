'use client';

import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Axis, type ICubeOptions } from '@cuberoot/visualcube';
import { COLORS } from '@cuberoot/puzzle-render-core/engine/define';
import { ArrowLeft, ArrowRight } from '@app-foundation/icons/lucide';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import { stickeringMaskFn, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import { LBL_BASICS, LBL_INITIAL_VIEW } from './content';
import BasicsGuide, { BASIC_GUIDE_TOPICS } from './BasicsGuide';

const cards = LBL_BASICS.map(card => ({ ...card, colors: stageStickerColors(3, stickeringMaskFn(3, card.mask), orientedCubeFaceColors('z2')) }));
const faceletColor = orientedCubeFaceColors('z2').F;
const facelet = { id: 'facelet', title: { zh: '格', en: 'Facelet' }, setup: '', colors: Array.from({ length: 54 }, (_, i) => i === 20 ? faceletColor : FM_FIXED_COLOR[FM_IGNORED]!) };
const topicGroups = [
  { title: { zh: '认识结构', en: 'The pieces' }, items: [facelet, ...cards] },
  { title: { zh: '楼层与转动', en: 'Layers and turns' }, items: BASIC_GUIDE_TOPICS },
];
const topics = [facelet, ...cards, ...BASIC_GUIDE_TOPICS];

export default function BasicsCards({ onStart, heading }: { onStart: () => void; heading: ReactNode }) {
  const [query, setQuery] = useQueryStates({
    topic: parseAsStringEnum(topics.map(item => item.id)).withDefault('facelet'),
    // Existing guide links may still use ?basics=moves. New selections use topic only.
    basics: parseAsStringEnum(BASIC_GUIDE_TOPICS.map(item => item.id)),
  }, { history: 'push' });
  const topic = query.basics ?? query.topic;
  const index = Math.max(0, topics.findIndex(item => item.id === topic));
  const card = cards.find(item => item.id === topic);
  const guide = BASIC_GUIDE_TOPICS.find(item => item.id === topic);
  const selectTopic = (id: string) => { void setQuery({ topic: id, basics: null }); };

  return <section className="lbl-basics-intro" aria-label={tr({ zh: '魔方基础知识', en: 'Cube basics' })}>
    <div className="lbl-basics-layout lbl-lesson">
      <aside className="lbl-visuals lbl-basics-sidebar">
    <div className="lbl-basics-heading" id="lbl-guide-title">{heading}</div>
    <select className="lbl-basics-mobile-select" aria-label={tr({ zh: '选择基础知识', en: 'Choose a topic' })} value={topic} onChange={event => selectTopic(event.target.value)}>
      {topicGroups.map(group => <optgroup key={group.title.en} label={tr(group.title)}>
        {group.items.map(item => <option key={item.id} value={item.id}>{tr(item.title)}</option>)}
      </optgroup>)}
    </select>
      <nav className="lbl-basics-topics" aria-label={tr({ zh: '选择基础知识', en: 'Choose a topic' })}>
        {topicGroups.map(group => <div className="lbl-basics-nav-group" key={group.title.en}>
          <p>{tr(group.title)}</p>
          {group.items.map(item => <button type="button" key={item.id} className="lbl-button lbl-topic" aria-pressed={topic === item.id} aria-controls="lbl-basics-panel" onClick={() => selectTopic(item.id)}>
            {'colors' in item && <VisualCube view="iso" setup={item.setup} stickerColors={item.colors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} size={52} alt={tr(item.title)} />}
            <span>{tr(item.title)}</span>
          </button>)}
        </div>)}
      </nav>
      </aside>
      <div className="lbl-basics-main">
        <div className="lbl-basics-panel" id="lbl-basics-panel">
          {topic === 'facelet' && <FaceletPanel />}
          {card && <StructurePanel card={card} />}
          {guide && <BasicsGuide section={guide.id} />}
        </div>
        <div className="lbl-basic-footer lbl-basics-footer">
          <button type="button" className="lbl-button lbl-basic-prev" disabled={index === 0} onClick={() => selectTopic(topics[index - 1].id)}><ArrowLeft size={16} /><T zh="上一项" en="Previous" /></button>
          <button type="button" className="lbl-button lbl-basic-next" onClick={() => { if (index === topics.length - 1) onStart(); else selectTopic(topics[index + 1].id); }}>
            {index === topics.length - 1 ? <T zh="开始做小花" en="Make the daisy" /> : tr(topics[index + 1].title)}<ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  </section>;
}

function FaceletPanel() {
  const container = useRef<HTMLDivElement>(null);
  const marker = useId();
  const [angle, setAngle] = useState(30);
  const rotations: NonNullable<ICubeOptions['viewportRotations']> = [[Axis.Y, angle], [Axis.X, -25]];
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let elapsed = 0;
    const timer = window.setInterval(() => {
      if (reduced.matches || document.hidden) return;
      elapsed += 80;
      setAngle(30 + 12 * Math.sin(elapsed / 10800 * Math.PI * 2));
    }, 80);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const root = container.current!;
    const update = () => {
      const sticker = root.querySelector<SVGPolygonElement>(`.lbl-facelet-cube polygon[fill="${faceletColor}"]`);
      const label = root.querySelector('.lbl-basic-hint span');
      const arrow = root.querySelector<SVGSVGElement>('.lbl-facelet-arrow');
      if (!sticker || !label || !arrow) return;
      const area = root.getBoundingClientRect(), text = label.getBoundingClientRect(), target = sticker.getBoundingClientRect();
      const tx = target.left - area.left + target.width / 2, ty = target.top - area.top + target.height / 2;
      const stacked = text.top >= root.querySelector('.lbl-facelet-cube')!.getBoundingClientRect().bottom;
      const sx = stacked ? text.left - area.left + text.width / 2 : text.left - area.left - 10;
      const sy = stacked ? text.top - area.top - 10 : text.top - area.top + text.height / 2;
      arrow.setAttribute('viewBox', `0 0 ${area.width} ${area.height}`);
      arrow.querySelector('.lbl-facelet-line')!.setAttribute('d', `M ${sx} ${sy} Q ${stacked ? sx : (sx + tx) / 2} ${stacked ? (sy + ty) / 2 : ty - 25} ${tx} ${ty}`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [angle]);
  return <div ref={container} className="lbl-basic-content lbl-facelet-content">
    <div className="lbl-basic-demo lbl-facelet-cube"><VisualCube local view="iso" stickerColors={facelet.colors} outlinedFacelets={[20]} viewportRotations={rotations} size={280} alt={tr({ zh: '粉色描边标出一个绿色的格', en: 'A pink outline marks one green facelet' })} /></div>
    <div className="lbl-basic-copy"><h3><T zh="表面一个彩色小方格，就是“一格”。" en="Each colored square on the surface is a facelet." /></h3><p className="lbl-basic-hint"><span><T zh="图中亮着的绿色小方格，叫“绿格”。" en="The highlighted green square is a green facelet." /></span></p></div>
    <svg className="lbl-facelet-arrow" style={{ color: COLORS.High }} aria-hidden="true"><defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs><path className="lbl-facelet-line" fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd={`url(#${marker})`} /></svg>
  </div>;
}

function StructurePanel({ card }: { card: typeof cards[number] }) {
  const player = useRef<AlgPlayerHandle>(null);
  const [orbitPlaying, setOrbitPlaying] = useState(false);
  const orbitTime = useRef(0);
  useEffect(() => {
    orbitTime.current = 0;
    setOrbitPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [card.id]);
  useEffect(() => {
    if (!orbitPlaying) return;
    // A continuous view-only tour: turn sideways, tilt to see underneath, return.
    const pose = (phase: number) => {
      const tilt = Math.sin(phase);
      // All piece types share the same extra 14° of underside visibility.
      const underside = tilt < 0 ? .24 * tilt * tilt : 0;
      return { x: .72 * tilt - underside, y: -phase + Math.sin(phase) };
    };
    // Traverse the existing path by angular distance so the combined tilt and
    // sideways rotation stay at a constant speed throughout each 27-second lap.
    const samples = [{ phase: 0, distance: 0 }];
    let previous = pose(0);
    for (let i = 1; i <= 2048; i++) {
      const phase = i / 2048 * Math.PI * 2;
      const next = pose(phase);
      samples.push({ phase, distance: samples[i - 1].distance + Math.hypot(next.x - previous.x, next.y - previous.y) });
      previous = next;
    }
    const pathLength = samples[samples.length - 1].distance;
    const poseAtTime = (time: number) => {
      const lap = Math.floor(time / 27000);
      const distance = time % 27000 / 27000 * pathLength;
      let low = 0;
      let high = samples.length - 1;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (samples[middle].distance <= distance) low = middle;
        else high = middle;
      }
      const start = samples[low];
      const end = samples[high];
      const fraction = (distance - start.distance) / (end.distance - start.distance);
      const position = pose(start.phase + (end.phase - start.phase) * fraction);
      return { x: position.x, y: position.y - lap * Math.PI * 2 };
    };
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      // Lazy-loaded players must be ready before the tour starts advancing.
      if (!player.current?.orbitView || player.current.isUserMovePending?.()) {
        last = undefined;
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = last === undefined ? 0 : Math.min(now - last, 50);
      last = now;
      const before = poseAtTime(orbitTime.current);
      orbitTime.current += elapsed;
      const after = poseAtTime(orbitTime.current);
      player.current?.orbitView?.(after.y - before.y, after.x - before.x);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [card.id, orbitPlaying]);
  return <div className="lbl-basic-content" id="lbl-basic-content">
    <div className="lbl-basic-demo">
      <div className="lbl-cube" onPointerDownCapture={() => setOrbitPlaying(false)}><AlgPlayer ref={player} key={card.id} puzzle="3x3" engine="sim" orientation="z2" sceneRot={LBL_INITIAL_VIEW} set={card.mask} setup={card.setup} startSolved={!card.setup} alg="" controlMode="none" hideResetView fillPane moveDurationMs={card.id === 'centers' ? 1800 : 1000} /></div>
    </div>
    <div className="lbl-basic-copy" aria-live="polite">
      <h3>{tr(card.headline)}</h3>{card.hint && <p className="lbl-basic-hint">{tr(card.hint)}</p>}
    </div>
  </div>;
}
