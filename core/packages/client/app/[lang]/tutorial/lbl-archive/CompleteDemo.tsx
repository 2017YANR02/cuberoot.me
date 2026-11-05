'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import AlgPlaybackControls from '@/components/AlgPlayer/AlgPlaybackControls';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { FM_OUTLINE, FM_REGULAR, mergeStickeringMaskFns, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { T, tr } from '@/i18n/tr';
import { LESSON_STICKERING, type LblExample } from './content';
import { usePlayerVisible } from './use-player-visible';
import { buildEdgePositionExample, completeDemoPool, yellowFaceTouchSticker, type CompleteDemoStage, type DemoContent, type DemoPhase, type DemoView, type CompleteDemo as Demo } from './complete-demo-state';

const DEMO_VIEW = { x: 25 * Math.PI / 180, y: -25 * Math.PI / 180, z: 0 };
const CAPTION_FADE_MS = 450;
const CAPTION_DURATION_MS = 3200;
const VIEW_OFFSETS: Record<DemoView, { x: number; y: number }> = {
  home: { x: 0, y: 0 }, bottom: { x: -Math.PI / 2, y: 0 },
  left: { x: 0, y: Math.PI / 2 }, right: { x: 0, y: -Math.PI / 2 }, back: { x: 0, y: -Math.PI },
};
export type DemoCaseCue = { index: number; playing: boolean } | null;
type CueProps = { onCaseCueChange: (cue: DemoCaseCue) => void };
type ThoughtContent = { text: string; detail?: string; alg?: string; caseIndex?: number; outlines?: string[] };
const NO_OUTLINES: string[] = [];
const IGNORE_CASE_CUE = () => {};
const EXAMPLE_CHANGE = 'lbl-demo-example-change';
const visitExamples = new Map<string, string>();
function readExample(key: string): string | null {
  if (visitExamples.has(key)) return visitExamples.get(key)!;
  try { return localStorage.getItem(key); } catch { return null; }
}
function subscribeExamples(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === null) visitExamples.clear();
    else visitExamples.delete(event.key);
    notify();
  };
  window.addEventListener(EXAMPLE_CHANGE, notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(EXAMPLE_CHANGE, notify);
    window.removeEventListener('storage', sync);
  };
}

export function EdgePositionExample({ example, index }: { example: LblExample; index: number }) {
  const demo = useMemo(() => buildEdgePositionExample(example, index), [example, index]);
  return <Demonstration stage="edge-position" demo={demo} onCaseCueChange={IGNORE_CASE_CUE} />;
}

export default function CompleteDemo({ stage, onCaseCueChange }: CueProps & { stage: CompleteDemoStage }) {
  const pool = useMemo(() => completeDemoPool(stage), [stage]);
  const storageKey = `lbl-demo-example:${stage}`;
  const savedSetup = useSyncExternalStore(subscribeExamples, () => readExample(storageKey), () => null);
  const index = Math.max(0, pool.findIndex(demo => demo.setup === savedSetup));
  const nextExample = () => {
    const next = pool[(index + 1) % pool.length].setup;
    if (persistItem(storageKey, next)) visitExamples.delete(storageKey);
    else visitExamples.set(storageKey, next);
    window.dispatchEvent(new Event(EXAMPLE_CHANGE));
  };
  return <div className="lbl-complete-demo">
    <div className="lbl-complete-toolbar">
      <button type="button" className="lbl-button" onClick={nextExample}><T zh="下一个例子" en="Next example" /></button>
    </div>
    <Demonstration key={`${stage}:${index}`} stage={stage} demo={pool[index]} onCaseCueChange={onCaseCueChange} />
  </div>;
}

type DemoFrame = {
  step: number;
  duration: number;
  caption: 'observe' | 'recognize' | 'act' | 'done';
  phase?: DemoPhase;
  move?: number;
  view?: DemoView;
};

function Demonstration({ stage, demo, onCaseCueChange }: { stage: CompleteDemoStage; demo: Demo } & CueProps) {
  const [recognitionOutlines, setRecognitionOutlines] = useState<string[]>(NO_OUTLINES);
  const maskOutlines = stage === 'yellow-face' ? NO_OUTLINES : recognitionOutlines;
  const stickeringAtStep = useMemo(() => {
    const name = pickStickering('3x3', LESSON_STICKERING[stage], 'sim');
    const base = mergeStickeringMaskFns([
      name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null,
      stage.startsWith('yellow-') || stage.endsWith('-position') ? stickeringMaskFn(3, 'F2L') : null,
    ]);
    const outlined = new Set(maskOutlines);
    return () => (initial: number, face: number) => outlined.has(engineHomeSid(initial, face, 3))
      ? FM_OUTLINE : base?.(initial, face) ?? FM_REGULAR;
  }, [stage, maskOutlines]);
  const timeline = useMemo(() => {
    const frames: DemoFrame[] = [];
    demo.phases.forEach(phase => {
      if (phase.observe) {
        frames.push({ step: phase.start, duration: CAPTION_DURATION_MS, caption: 'observe', phase });
      }
      if (phase.recognize) {
        frames.push({ step: phase.start, duration: CAPTION_DURATION_MS, caption: 'recognize', phase });
      }
      if (phase.returnView) {
        frames.push({ step: phase.start, duration: 900, caption: 'recognize', phase, view: phase.returnView });
      }
      if (phase.recognizeOnly) return;
      frames.push({ step: phase.start, duration: CAPTION_DURATION_MS, caption: 'act', phase, view: phase.view });
      for (let move = phase.start; move < phase.end; move++) {
        frames.push({ step: move + 1, duration: 0, caption: 'act', phase, move, view: move === phase.start ? phase.moveView : undefined });
      }
    });
    frames.push({ step: demo.alg.split(' ').length, duration: 0, caption: 'done' });
    return frames;
  }, [demo]);
  const player = useRef<AlgPlayerHandle>(null);
  const playerVisible = usePlayerVisible(player, demo.setup);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [revision, setRevision] = useState(0);
  const appliedFrame = useRef(-1);
  const viewOffset = useRef({ x: 0, y: 0 });
  const viewMotion = useRef<{ position: number; revision: number; elapsed: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const remaining = useRef({ position: -1, revision: -1, ms: 0 });
  const frame = timeline[position];
  const total = timeline[timeline.length - 1].step;
  const boundaries = useMemo(() => [...new Set(demo.phases.map(item => item.end))].filter(step => step > 0), [demo]);

  useEffect(() => {
    let id = 0;
    const loaded = () => {
      if (!player.current || player.current.isUserMovePending?.()) id = requestAnimationFrame(loaded);
      else {
        setReady(true);
        setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    };
    id = requestAnimationFrame(loaded);
    return () => cancelAnimationFrame(id);
  }, []);

  // One paused/resumable timeline owns both captions and turns. A result is
  // described only after the preceding turn has actually finished.
  useEffect(() => {
    if (!ready || !playing) return;
    if (frame.caption === 'done') {
      const timer = window.setTimeout(() => setPlaying(false), CAPTION_FADE_MS * 2);
      return () => window.clearTimeout(timer);
    }
    let animationFrame = 0;
    if (frame.view) {
      if (frame.move !== undefined && appliedFrame.current !== position) {
        player.current?.playMove?.(frame.move);
        appliedFrame.current = position;
      }
      if (viewMotion.current?.position !== position || viewMotion.current.revision !== revision) {
        const target = VIEW_OFFSETS[frame.view];
        const turn = Math.atan2(Math.sin(target.y - viewOffset.current.y), Math.cos(target.y - viewOffset.current.y));
        viewMotion.current = { position, revision, elapsed: 0, from: { ...viewOffset.current },
          to: { x: target.x, y: viewOffset.current.y + turn } };
      }
      const motion = viewMotion.current;
      let last = performance.now();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const orbit = (now: number) => {
        motion.elapsed += now - last;
        last = now;
        const orbitDuration = frame.move === undefined ? 900 : 850;
        const progress = reducedMotion ? 1 : Math.min(motion.elapsed / orbitDuration, 1);
        const eased = progress * progress * (3 - 2 * progress);
        const desired = { x: motion.from.x + (motion.to.x - motion.from.x) * eased,
          y: motion.from.y + (motion.to.y - motion.from.y) * eased };
        // Same free-orbit operation as dragging empty space; no puzzle moves or setup changes.
        player.current?.orbitView?.(desired.y - viewOffset.current.y, desired.x - viewOffset.current.x);
        viewOffset.current = desired;
        if (motion.elapsed < (frame.move === undefined ? frame.duration : orbitDuration) || player.current?.isUserMovePending?.()) animationFrame = requestAnimationFrame(orbit);
        else {
          if (frame.view === 'home') {
            if (stage !== 'edge-position') player.current?.resetView?.();
            viewOffset.current = { x: 0, y: 0 };
          }
          setPosition(current => current + 1);
        }
      };
      animationFrame = requestAnimationFrame(orbit);
      return () => cancelAnimationFrame(animationFrame);
    }
    if (frame.move !== undefined) {
      if (appliedFrame.current !== position) {
        player.current?.playMove?.(frame.move);
        appliedFrame.current = position;
      }
      const settled = () => {
        if (player.current?.isUserMovePending?.()) animationFrame = requestAnimationFrame(settled);
        else setPosition(current => current + 1);
      };
      animationFrame = requestAnimationFrame(settled);
      return () => cancelAnimationFrame(animationFrame);
    }
    const duration = remaining.current.position === position && remaining.current.revision === revision
      ? remaining.current.ms : frame.duration;
    const started = performance.now();
    const timer = window.setTimeout(() => setPosition(current => current + 1), duration);
    return () => {
      window.clearTimeout(timer);
      remaining.current = { position, revision, ms: Math.max(0, duration - (performance.now() - started)) };
    };
  }, [ready, playing, frame, position, revision, stage]);

  const seek = (step: number) => {
    setPlaying(false);
    const target = Math.max(0, Math.min(total, step));
    const next = target === 0 ? 0 : target === total ? timeline.length - 1
      : timeline.findIndex(item => item.step === target && item.move === undefined);
    const index = next >= 0 ? next : timeline.findIndex(item => item.step === target);
    appliedFrame.current = index;
    const control = player.current?.getPlayer();
    if (control) control.timestamp = target;
    const precedingView = timeline.slice(0, index).filter(item => item.view).at(-1)?.view ?? 'home';
    player.current?.resetView?.();
    const offset = VIEW_OFFSETS[precedingView];
    player.current?.orbitView?.(offset.y, offset.x);
    viewOffset.current = { ...offset };
    viewMotion.current = null;
    setPosition(index);
    setRevision(current => current + 1);
  };
  const content: DemoContent = frame.caption === 'done' ? { text: demo.done }
    : frame.caption === 'observe' ? { text: frame.phase!.observe! }
      : frame.caption === 'recognize' ? frame.phase!.recognize! : frame.phase!.act;
  const message: ThoughtContent = { ...content, text: tr(content.text), detail: content.detail ? tr(content.detail) : undefined };
  const touchHighlight = useMemo(() => content.touchSticker
    ? [yellowFaceTouchSticker(`${demo.setup} ${demo.alg.split(' ').slice(0, frame.step).join(' ')}`)]
    : undefined, [content.touchSticker, demo, frame.step]);

  return <div className="lbl-demo lbl-demo-split lbl-complete-player" data-player-ready={playerVisible} aria-busy={!playerVisible}>
    <div className="lbl-cube" data-player-ready={playerVisible} aria-busy={!playerVisible}><div className="lbl-complete-playback"><AlgPlayer ref={player} puzzle="3x3" engine="sim" controlMode="none" hideResetView
      set={LESSON_STICKERING[stage]} additionalStickering={stage.startsWith('yellow-') || stage.endsWith('-position') ? 'F2L' : undefined} orientation="z2"
      highlightedStickers={stage === 'yellow-face' ? touchHighlight ?? recognitionOutlines : undefined}
      sceneRot={DEMO_VIEW} setup={demo.setup} alg={demo.alg} stickeringAtStep={stickeringAtStep} fillPane moveDurationMs={850} />
      <AlgPlaybackControls step={frame.step} count={total} playing={playing} stepMarkers={boundaries}
        onScrub={seek} onStepBack={() => seek(frame.step - 1)} onStepForward={() => seek(frame.step + 1)}
        onTogglePlay={() => {
          if (frame.caption === 'done') seek(0);
          setPlaying(current => frame.caption === 'done' || !current);
        }} onResetView={() => {
          setPlaying(false);
          player.current?.resetView?.();
          viewOffset.current = { x: 0, y: 0 };
          viewMotion.current = null;
        }} />
    </div></div>
    <Thought {...message} playing={playing} revision={revision} onCaseCueChange={onCaseCueChange} onRecognitionOutlinesChange={setRecognitionOutlines} />
    {['corners', 'yellow-cross', 'yellow-face', 'edge-position'].includes(stage) && <div className="lbl-complete-legend-space" aria-hidden="true" />}
  </div>;
}

function Thought({ text, detail, alg, caseIndex, outlines, playing, revision, onCaseCueChange, onRecognitionOutlinesChange }: ThoughtContent & { playing: boolean; revision: number; onRecognitionOutlinesChange: (outlines: string[]) => void } & CueProps) {
  const key = `${text}\n${detail ?? ''}\n${alg ?? ''}\n${caseIndex ?? ''}\n${outlines?.join(',') ?? ''}`;
  const [displayed, setDisplayed] = useState({ key, text, detail, alg, caseIndex, outlines, revision });
  useEffect(() => {
    onRecognitionOutlinesChange(displayed.outlines ?? NO_OUTLINES);
  }, [displayed.outlines, onRecognitionOutlinesChange]);
  useEffect(() => {
    onCaseCueChange(displayed.caseIndex !== undefined ? { index: displayed.caseIndex, playing } : null);
    return () => onCaseCueChange(null);
  }, [displayed.caseIndex, playing, onCaseCueChange]);
  const fading = playing && displayed.key !== key;
  useEffect(() => {
    if (displayed.revision !== revision) { setDisplayed({ key, text, detail, alg, caseIndex, outlines, revision }); return; }
    if (!playing) return;
    if (displayed.key === key) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : CAPTION_FADE_MS;
    const timer = window.setTimeout(() => setDisplayed({ key, text, detail, alg, caseIndex, outlines, revision }), delay);
    return () => window.clearTimeout(timer);
  }, [key, text, detail, alg, caseIndex, outlines, playing, revision, displayed.key, displayed.revision]);
  return <div className="lbl-complete-thought" aria-live="polite">
    <p data-fading={fading}>
      <span>{displayed.text}</span>
      {displayed.alg ? <code className="lbl-complete-detail">{displayed.alg}</code>
        : <span className="lbl-complete-detail">{displayed.detail}</span>}
    </p>
  </div>;
}
