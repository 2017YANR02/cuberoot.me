'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Color } from 'three';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import ChatBubble from '@/components/ChatBubble';
import ProgressSlider from '@/components/ProgressSlider';
import { type CubeFace } from '@/lib/cube-colors';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr } from '@/i18n/tr';
import { BLUE_RED_BOTTOM_CORNER_SETUP, bottomCornerPreview, middleEdgePreview } from './complete-demo-state';
import { RIGHT, LESSON_STICKERING, lblDemoView } from './content';
import { usePlayerVisible } from './use-player-visible';
import AlgSteps from './AlgSteps';

type PreludeScene = {
  setup: string;
  caption: { zh: string; en: string };
  duration: number;
  purpleStickers?: readonly string[];
  purple?: boolean;
  observation?: { zh: string; en: string };
  targetLayer?: 'top' | 'bottom';
};
export const cornerPreviews: PreludeScene[] = [
  { setup: '', purpleStickers: ['F2', 'R0', 'U8'], targetLayer: 'top', caption: { zh: '角块在顶层的三种状态我们已经学会', en: 'We’ve learned the three cases with the corner in the top layer' }, observation: { zh: '角在顶层', en: 'Corner in the top layer' }, duration: 5000 },
  { setup: '', purpleStickers: ['F8', 'R6', 'D2'], caption: { zh: '有时角块会出现在底层', en: 'Sometimes the corner is in the bottom layer' }, observation: { zh: '角在底层', en: 'Corner in the bottom layer' }, duration: 5000 },
  { setup: `(${RIGHT})2`, caption: { zh: '角在底层时\n朝向可能不对', en: 'When the corner is in the bottom layer\nit may be twisted' }, observation: { zh: '白色朝左', en: 'White faces left' }, duration: 5000 },
  { setup: `(${RIGHT})4`, caption: { zh: '角在底层时\n朝向可能不对', en: 'When the corner is in the bottom layer\nit may be twisted' }, observation: { zh: '白色朝右', en: 'White faces right' }, duration: 5000 },
  { setup: BLUE_RED_BOTTOM_CORNER_SETUP, caption: { zh: '角在底层时\n位置也可能不对', en: 'When the corner is in the bottom layer\nit may also be in the wrong slot' }, observation: { zh: '看侧面颜色', en: 'Check the side colors' }, duration: 5000 },
  { setup: BLUE_RED_BOTTOM_CORNER_SETUP, purple: true, caption: { zh: '无论哪种情况\n直接做右公式', en: 'In any of these cases\nuse the right trigger' }, duration: 5000 },
];
const fadeDuration = 450;
const colors = orientedCubeFaceColors('z2');

export default function SpecialCasePrelude({ scenes, piece, finalAlg, onDone }: {
  scenes: PreludeScene[];
  piece: 'corner' | 'edge'; finalAlg: string; onDone: () => void;
}) {
  const duration = scenes.reduce((sum, scene) => sum + scene.duration + 2 * fadeDuration, 0);
  const player = useRef<AlgPlayerHandle>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  let index = 0, elapsed = time;
  while (index < scenes.length - 1 && elapsed >= scenes[index].duration + 2 * fadeDuration) {
    elapsed -= scenes[index++].duration + 2 * fadeDuration;
  }
  const scene = scenes[index];
  const ready = usePlayerVisible(player, 'special-case-prelude');
  const preview = useMemo(() => scene.purpleStickers
    ? { highlights: scene.purpleStickers }
    : piece === 'corner' ? bottomCornerPreview(scene.setup) : middleEdgePreview(scene.setup), [scene.setup, scene.purpleStickers, piece]);
  const visibility = Math.max(0, Math.min(1, elapsed / fadeDuration, (scene.duration + 2 * fadeDuration - elapsed) / fadeDuration));
  const eased = visibility * visibility * (3 - 2 * visibility);
  const purple = !!(scene.purple || scene.purpleStickers);
  // Color overrides update in place; changing hiddenStickers would remount the renderer.
  const hidden = useMemo(() => [...'URFDLB'].flatMap(face => (piece === 'corner' ? [0, 2, 6, 8] : [1, 3, 5, 7]).map(i => `${face}${i}`))
    .filter(sticker => !(piece === 'edge' && ['D1', 'D3', 'D5', 'D7', 'F7', 'R7', 'B7', 'L7'].includes(sticker))), [piece]);
  const overrides = useMemo(() => Object.fromEntries([
    ...hidden.map(sticker => [sticker, FM_FIXED_COLOR[FM_IGNORED]!]),
    ...preview.highlights.map(sticker => [sticker,
      new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(purple ? '#a855f7' : colors[sticker[0] as CubeFace]), eased).getStyle(),
    ]),
  ]), [hidden, preview, purple, eased]);
  useEffect(() => { setToolbar(wrapper.current?.closest('.lbl-learning')?.querySelector('.lbl-demo-toolbar') ?? null); }, []);
  useEffect(() => {
    if (!ready || paused) return;
    let frame = 0, previous: number | undefined;
    const tick = (now: number) => {
      if (!document.hidden && !player.current?.isUserMovePending?.(false)) clock.current = Math.min(duration, clock.current + Math.min(now - (previous ?? now), 50));
      previous = now;
      setTime(clock.current);
      if (clock.current >= duration) { onDone(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, paused, onDone, duration]);
  const bubbleStage = ready ? wrapper.current?.querySelector('.sim-stage') : null;
  return <div ref={wrapper} className="lbl-content lbl-content-example lbl-special-case-prelude">
    <section className="lbl-demonstration">
      <div className="lbl-auto-player" data-visible={ready}>
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={piece === 'corner' ? LESSON_STICKERING.corners : LESSON_STICKERING.middle} additionalStickering="centers-only"
          setup={scene.setup} alg="" orientation="z2" sceneRot={lblDemoView()}
          stickerColorOverrides={overrides} controlMode="none" hideResetView lockView interactionMode="none" fillPane />
      </div>
      {bubbleStage && (scene.observation || piece === 'edge' && index < scenes.length - 1) && createPortal(<div className="lbl-left-thumb-overlay" style={{ opacity: eased }}>
        <ChatBubble tail={piece === 'edge' && scene.targetLayer === 'top' ? 'bottom' : 'left'} className="lbl-cube-callout lbl-special-case-bubble" data-piece={piece} data-layer={scene.targetLayer ?? 'bottom'} role="status">{tr(scene.observation ?? scene.caption)}</ChatBubble>
      </div>, bubbleStage)}
    </section>
    <section className="lbl-explanation">
      <p className="lbl-lead lbl-corner-case-caption" style={{ whiteSpace: 'pre-line', textAlign: 'center', opacity: eased }}>{tr(scene.caption)}</p>
      {index === scenes.length - 1 && <AlgSteps step={piece === 'corner' ? 'trigger-learning' : 'middle'} alg={finalAlg} />}
    </section>
    {toolbar && createPortal(<div className="lbl-cross-animation-progress">
      <ProgressSlider value={time} max={duration} keyboardStep={500}
        onChange={value => { clock.current = value; setTime(value); }}
        onInteractionStart={() => setPaused(true)} onInteractionEnd={() => setPaused(false)}
        formatValue={value => tr({ zh: `${(value / 1000).toFixed(1)} 秒`, en: `${(value / 1000).toFixed(1)} seconds` })}
        ariaLabel={tr({ zh: '演示进度', en: 'Animation progress' })} />
    </div>, toolbar)}
  </div>;
}
