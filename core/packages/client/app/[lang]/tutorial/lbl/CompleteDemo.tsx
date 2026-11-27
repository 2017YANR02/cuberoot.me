'use client';

import ReadingFit from '../components/ReadingFit';
import { CUBE_FRAMING_EDGE } from '../components/InteractiveTutorial';
import WalkthroughPane, { type WalkthroughStage } from '../components/WalkthroughPane';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { persistItem } from '@/lib/safe-storage';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolveSimMoveDurationScale } from '@/components/AlgPlayer/player-setup';
import AlgPlaybackControls from '@/components/AlgPlayer/AlgPlaybackControls';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { FM_OUTLINE, FM_REGULAR, mergeStickeringMaskFns, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { withBrightCenters } from './cross-display';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { T, tr } from '@/i18n/tr';
import { J_ALG, LBL_LEFT_VIEW_YAW, LBL_STEPS, LESSON_STICKERING, MIDDLE_LEFT, MIDDLE_RIGHT, lblDemoView, type LblExample } from './content';
import { usePlayerVisible } from './use-player-visible';
import { getLblAlgGroups, sideTurn } from './alg-cues';
import { SIDE_VIEW_PAUSE_MS, SIDE_VIEW_TURN_MS } from './schedule-demo-play';
import { LBL_LESSON_STAGE_IDS } from './lesson-runs';
import { buildBottomCrossFromDaisy, buildEdgePositionExample, completeDemoPool, yellowFaceTouchSticker, type CompleteDemoStage, type DemoContent, type DemoPhase, type DemoView, type CompleteDemo as Demo, walkthroughCompletionStickers } from './complete-demo-state';

const CAPTION_FADE_MS = 450;
const CAPTION_DURATION_MS = 3200;
const VIEW_OFFSETS: Record<DemoView, { x: number; y: number }> = {
  home: { x: 0, y: 0 }, bottom: { x: -Math.PI / 2, y: 0 },
  left: { x: 0, y: Math.PI / 2 }, right: { x: 0, y: -Math.PI / 2 }, back: { x: 0, y: -Math.PI },
  'slight-left': { x: 0, y: LBL_LEFT_VIEW_YAW },
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

function DemoToolbar({ onNext, index, total }: { onNext: () => void; index: number; total: number }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById('lbl-footer-actions')); }, []);
  return host ? createPortal(<div className="lbl-complete-toolbar"><button type="button" className="lbl-footer-button lbl-footer-next tutorial-example-button" aria-label={tr({ zh: `例${index + 1}/${total}，切换到下一个示例`, en: `Example ${index + 1} of ${total}, show next example` })} onClick={onNext}><T zh={`例${index + 1}/${total}`} en={`Ex. ${index + 1}/${total}`} /></button></div>, host) : null;
}

export function WhiteCrossCompleteDemo() {
  const [index, setIndex] = useState(0);
  const demo = useMemo<Demo>(() => {
    const example = LBL_STEPS.find(step => step.id === 'cross')!.examples[0];
    const setup = index === 0 ? example.setup! : `${example.setup!} U2`;
    const alg = buildBottomCrossFromDaisy(setup);
    const moves = alg.split(/\s+/);
    return { setup, alg,
      done: { zh: '白十字完成，四条侧面颜色也对齐中心', en: 'The white cross is solved and all four side colors match their centers.' },
      phases: moves.map((move, index) => ({ start: index, end: index + 1,
        act: { text: /^d/.test(move)
          ? { zh: '转下面两层，在前面对齐白棱与中心', en: 'Turn the lower two layers to align the white edge with the front center' }
          : /^U/.test(move) ? { zh: '转顶层，把白棱放到前方', en: 'Turn the top to bring a white edge to the front' }
          : /^y/.test(move)
            ? { zh: '转体，把已经对齐的白棱放到右侧', en: 'Rotate the cube to put the aligned white edge on the right' }
            : { zh: '做“上上”，让这条白棱归位', en: 'Turn the right face twice to insert this white edge.' }, alg: move } })),
    };
  }, [index]);
  return <div className="lbl-complete-demo">
    <DemoToolbar index={index} total={2} onNext={() => setIndex(value => (value + 1) % 2)} />
    <Demonstration key={index} stage="cross" demo={demo} onCaseCueChange={IGNORE_CASE_CUE} />
  </div>;
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
    <DemoToolbar index={index} total={pool.length} onNext={nextExample} />
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
  orbitDuration?: number;
};

export function Demonstration({ stage, demo, onCaseCueChange, walkthroughCase }: {
  stage: CompleteDemoStage | 'cross' | 'walkthrough'; demo: Demo;
  walkthroughCase?: { scramble: string; onRandomCase: () => void; loading: boolean; failed: boolean };
} & CueProps) {
  const walkthrough = stage === 'walkthrough';
  const [recognitionOutlines, setRecognitionOutlines] = useState<string[]>(NO_OUTLINES);
  const maskOutlines = stage === 'yellow-face' ? NO_OUTLINES : recognitionOutlines;
  const stickeringAtStep = useMemo(() => {
    if (walkthrough) return () => () => FM_REGULAR;
    const name = pickStickering('3x3', LESSON_STICKERING[stage], 'sim');
    const combined = mergeStickeringMaskFns([
      name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null,
      stage.startsWith('yellow-') || stage.endsWith('-position') ? stickeringMaskFn(3, 'F2L') : null,
    ]);
    const base = stage === 'cross' || stage === 'corners' ? withBrightCenters(combined) : combined;
    const outlined = new Set(maskOutlines);
    return () => (initial: number, face: number) => outlined.has(engineHomeSid(initial, face, 3))
      ? FM_OUTLINE : base?.(initial, face) ?? FM_REGULAR;
  }, [stage, maskOutlines, walkthrough]);
  const timeline = useMemo(() => {
    const frames: DemoFrame[] = [];
    const moves = demo.alg.split(/\s+/).filter(Boolean);
    demo.phases.forEach(phase => {
      if (phase.observe) {
        frames.push({ step: phase.start, duration: CAPTION_DURATION_MS, caption: 'observe', phase, view: phase.view });
      }
      if (phase.recognize) {
        frames.push({ step: phase.start, duration: CAPTION_DURATION_MS, caption: 'recognize', phase });
      }
      if (phase.returnView) {
        frames.push({ step: phase.start, duration: 900, caption: 'recognize', phase, view: phase.returnView });
      }
      if (phase.recognizeOnly) return;
      frames.push({ step: phase.start, duration: phase.holdMs ?? CAPTION_DURATION_MS, caption: 'act', phase, view: phase.view });
      const insertionSide = (phase.stage ?? stage) === 'middle' && (phase.act.alg === MIDDLE_RIGHT || phase.act.alg === MIDDLE_LEFT)
        ? sideTurn(moves[phase.start + 1]) : undefined;
      for (let move = phase.start; move < phase.end; move++) {
        const side = move === phase.start && insertionSide ? insertionSide : sideTurn(moves[move]);
        const previousView = frames.findLast(item => item.view)?.view;
        const view = side === 'L' && previousView !== 'slight-left' ? 'slight-left'
          : side === 'R' && previousView === 'slight-left' ? 'home' : undefined;
        if (view) {
          const precedingIndex = frames.findLastIndex(item => item.move !== undefined);
          const preceding = frames[precedingIndex];
          const onlyActionCaption = frames.slice(precedingIndex + 1).every(item => item.caption === 'act' && !item.view);
          if (preceding?.move === move - 1 && onlyActionCaption && /^y(?:2)?'?$/.test(moves[move - 1])) {
            preceding.view = view;
            preceding.orbitDuration = (walkthrough ? 1100 : 850) * resolveSimMoveDurationScale('3x3', moves[move - 1]);
          } else frames.push({ step: move, duration: SIDE_VIEW_PAUSE_MS, caption: 'act', phase, view, orbitDuration: SIDE_VIEW_TURN_MS });
        }
        frames.push({ step: move + 1, duration: 0, caption: 'act', phase, move, view: move === phase.start ? phase.moveView : undefined });
      }
    });
    const finalStep = moves.length;
    if (stage === 'cross') {
      const reveal: DemoPhase = { start: finalStep, end: finalStep, act: { text: { zh: '看看底面，白十字已经完成', en: 'Look underneath: the white cross is complete.' } } };
      frames.push({ step: finalStep, duration: 2700, caption: 'act', phase: reveal, view: 'bottom' });
      const alignedSides = { ...reveal, act: { text: demo.done } };
      for (const view of ['home', 'right', 'back', 'left', 'home'] as const) {
        frames.push({ step: finalStep, duration: 1800, caption: 'act', phase: alignedSides, view, orbitDuration: 1000 });
      }
    }
    frames.push({ step: finalStep, duration: 0, caption: 'done' });
    return frames;
  }, [demo, stage, walkthrough]);
  const player = useRef<AlgPlayerHandle>(null);
  const playerVisible = usePlayerVisible(player, demo.setup);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hiddenOutlines, setHiddenOutlines] = useState<string[] | null>(null);
  const lastBlinkedOutlines = useRef<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [revision, setRevision] = useState(0);
  const appliedFrame = useRef(-1);
  const playerStep = useRef(0);
  const viewOffset = useRef({ x: 0, y: 0 });
  const viewMotion = useRef<{ position: number; revision: number; elapsed: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const remaining = useRef({ position: -1, revision: -1, ms: 0 });
  const frame = timeline[position];
  const currentStage = frame.phase?.stage ?? stage;
  const total = timeline[timeline.length - 1].step;
  const { stages, phaseStarts } = useMemo(() => {
    const phaseStarts = new Map<DemoPhase, number>();
    const stages: WalkthroughStage[] = [];
    if (walkthrough) {
      timeline.forEach(({ phase }, id) => {
        if (phase && !phaseStarts.has(phase)) phaseStarts.set(phase, id);
      });
      for (const stage of LBL_LESSON_STAGE_IDS) {
        const steps = [...phaseStarts].filter(([phase]) => phase.stage === stage)
          .map(([phase, id]) => ({ id, title: phase.act.text }));
        if (stage === 'edge-position') steps.push({ id: timeline.length - 1, title: demo.done });
        stages.push({ title: LBL_STEPS.find(item => item.id === stage)!.title, steps });
      }
    }
    return { stages, phaseStarts };
  }, [timeline, walkthrough, demo.done]);
  const boundaries = useMemo(() => {
    if (demo.stageMarkers) return demo.stageMarkers;
    // Each R2 finishes one white edge; its preparation moves share the same segment.
    const ends = stage === 'cross'
      ? demo.alg.split(/\s+/).flatMap((move, index) => move === 'R2' ? [index + 1] : [])
      : demo.phases.map(item => item.end);
    return [...new Set(ends)].filter(step => step > 0 && (stage === 'cross' ? step <= total : step < total));
  }, [demo, stage, total]);

  const completionFocus = useMemo(() => walkthrough ? walkthroughCompletionStickers('edge-position', demo.setup + ' ' + demo.alg) : undefined, [walkthrough, demo]);
  const content: DemoContent = frame.caption === 'done' ? { text: demo.done, outlines: completionFocus }
    : frame.caption === 'observe' ? { text: frame.phase!.observe! }
      : frame.caption === 'recognize' ? frame.phase!.recognize! : frame.phase!.act;
  const walkthroughOutlines = content.outlines ?? NO_OUTLINES;
  useEffect(() => {
    if (!walkthrough) return;
    setHiddenOutlines(null);
    if (!playing || !walkthroughOutlines.length || lastBlinkedOutlines.current === walkthroughOutlines
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lastBlinkedOutlines.current = walkthroughOutlines;
    const timers = [180, 360, 540, 720].map((delay, index) => window.setTimeout(() => {
      setHiddenOutlines(index % 2 === 0 ? walkthroughOutlines : null);
    }, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [walkthrough, playing, walkthroughOutlines]);

  useEffect(() => {
    let id = 0;
    let timer = 0;
    const loaded = () => {
      if (!player.current || player.current.isUserMovePending?.()) id = requestAnimationFrame(loaded);
      else {
        setReady(true);
        if (!walkthrough) timer = window.setTimeout(() => setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden), 1000);
      }
    };
    id = requestAnimationFrame(loaded);
    return () => { cancelAnimationFrame(id); clearTimeout(timer); };
  }, [walkthrough]);

  // One paused/resumable timeline owns both captions and turns. A result is
  // described only after the preceding turn has actually finished.
  useEffect(() => {
    if (!ready || !playing) return;
    if (frame.caption === 'done') {
      const timer = window.setTimeout(() => setPlaying(false), walkthrough ? 3200 : CAPTION_FADE_MS * 2);
      return () => window.clearTimeout(timer);
    }
    let animationFrame = 0;
    // The player queues a requested move after React commits. An idle engine
    // before that commit does not mean the requested turn has finished.
    const turnPending = () => (frame.move !== undefined && playerStep.current !== frame.step)
      || player.current?.isUserMovePending?.();
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
        const orbitDuration = frame.orbitDuration ?? (frame.move === undefined ? 900
          : (walkthrough ? 1100 : 850) * resolveSimMoveDurationScale('3x3', demo.alg.split(/\s+/)[frame.move]));
        const progress = reducedMotion ? 1 : Math.min(motion.elapsed / orbitDuration, 1);
        const eased = frame.move === undefined ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 2;
        const desired = { x: motion.from.x + (motion.to.x - motion.from.x) * eased,
          y: motion.from.y + (motion.to.y - motion.from.y) * eased };
        // Same free-orbit operation as dragging empty space; no puzzle moves or setup changes.
        player.current?.orbitView?.(desired.y - viewOffset.current.y, desired.x - viewOffset.current.x);
        viewOffset.current = desired;
        if (motion.elapsed < (frame.move === undefined ? frame.duration : orbitDuration) || turnPending()) animationFrame = requestAnimationFrame(orbit);
        else {
          if (frame.view === 'home') {
            if (!walkthrough && stage !== 'edge-position') player.current?.resetView?.();
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
        if (turnPending()) animationFrame = requestAnimationFrame(settled);
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
  }, [ready, playing, frame, position, revision, stage, walkthrough, demo.alg]);

  const seekFrame = (index: number) => {
    setPlaying(false);
    appliedFrame.current = index;
    const control = player.current?.getPlayer();
    if (control) control.timestamp = timeline[index].step;
    const precedingView = timeline.slice(0, index).filter(item => item.view).at(-1)?.view ?? 'home';
    player.current?.resetView?.();
    const offset = VIEW_OFFSETS[precedingView];
    player.current?.orbitView?.(offset.y, offset.x);
    viewOffset.current = { ...offset };
    viewMotion.current = null;
    setPosition(index);
    setRevision(current => current + 1);
  };
  const seek = (step: number) => {
    const target = Math.max(0, Math.min(total, step));
    if (walkthrough && target > 0 && target < total) {
      const turn = timeline.findIndex(item => item.move === target - 1);
      if (turn >= 0) { seekFrame(turn); return; }
    }
    const next = target === 0 ? 0 : target === total ? timeline.length - 1
      : timeline.findIndex(item => item.step === target && item.move === undefined);
    seekFrame(next >= 0 ? next : timeline.findIndex(item => item.step === target));
  };
  // Classify the whole lesson, never the current caption or move.
  const layout = stage === 'middle' || stage === 'corner-position' ? 'B' : 'A';
  const message: ThoughtContent = { ...content, text: tr(content.text), detail: content.detail ? tr(content.detail) : undefined };
  const touchHighlight = useMemo(() => content.touchSticker
    ? [yellowFaceTouchSticker(`${demo.setup} ${demo.alg.split(' ').slice(0, frame.step).join(' ')}`)]
    : undefined, [content.touchSticker, demo, frame.step]);
  const cube = <AlgPlayer ref={player} puzzle="3x3" engine="sim" controlMode="none" hideResetView
      highlightDaisyAlignment={stage === 'cross'}
      daisyAlignmentFace={demo.alg.split(/\s+/)[frame.step] === 'R2' ? 'R' : 'F'}
      set={walkthrough ? '' : LESSON_STICKERING[stage]} additionalStickering={!walkthrough && (stage.startsWith('yellow-') || stage.endsWith('-position')) ? 'F2L' : undefined} orientation="z2"
      highlightedStickers={walkthrough ? (hiddenOutlines === walkthroughOutlines ? NO_OUTLINES : touchHighlight ?? walkthroughOutlines) : stage === 'yellow-face' ? touchHighlight ?? recognitionOutlines : undefined}
      sceneRot={lblDemoView()} setup={demo.setup} alg={demo.alg} stickeringAtStep={stickeringAtStep}
      onStepChange={step => { playerStep.current = step; }} fillPane maxFramingEdge={walkthrough ? CUBE_FRAMING_EDGE : undefined}
      moveDurationMs={walkthrough ? 1100 : 850} />;
  const transport = <AlgPlaybackControls step={frame.step} count={total} playing={playing} stepMarkers={boundaries}
        onScrub={seek} onStepBack={() => seek(frame.step - 1)} onStepForward={() => seek(frame.step + 1)}
        onTogglePlay={() => {
          if (frame.caption === 'done') seek(0);
          setPlaying(current => frame.caption === 'done' || !current);
        }} onResetView={() => {
          setPlaying(false);
          player.current?.resetView?.();
          viewOffset.current = { x: 0, y: 0 };
          viewMotion.current = null;
        }} />;
  if (walkthroughCase) {
    const phase = frame.phase;
    const turns = frame.caption === 'act' && phase ? demo.alg.split(' ').slice(phase.start, phase.end) : [];
    const algGroups = !turns.length ? [] : currentStage === 'corners' && content.alg
      ? getLblAlgGroups(currentStage, turns.join(' ')).map(group => ({ turns: group.map(item => item.notation), bracketed: group.length > 1 }))
      : [{ turns, bracketed: !!content.alg && turns.length > 1 && currentStage !== 'daisy' && currentStage !== 'cross' }];
    return <WalkthroughPane {...walkthroughCase} stages={stages} currentStep={phase ? phaseStarts.get(phase)! : timeline.length - 1}
      title={content.text} note={content.detail} algGroups={algGroups} activeTurn={phase && frame.move !== undefined ? frame.move - phase.start : -1}
      position={position} onSeek={seekFrame} seekDisabled={!playerVisible}
      cube={<div className="lbl-walkthrough-playback" data-player-ready={playerVisible} aria-busy={!playerVisible}>{cube}{transport}</div>} />;
  }

  return <div className="lbl-demo lbl-demo-split lbl-complete-player" data-tutorial-mode="teaching" data-tutorial-layout={layout} data-player-ready={playerVisible} aria-busy={!playerVisible}>
    <div className="lbl-cube" data-player-ready={playerVisible} aria-busy={!playerVisible}><div className="lbl-complete-playback">{cube}{transport}</div></div>
    <Thought {...message} layout={layout} stage={currentStage} playing={playing} revision={revision}
      onCaseCueChange={onCaseCueChange} onRecognitionOutlinesChange={setRecognitionOutlines} />
    {['corners', 'yellow-cross', 'yellow-face', 'edge-position'].includes(stage) && <div className="lbl-complete-legend-space" aria-hidden="true" />}
  </div>;
}

function Thought({ text, detail, alg, caseIndex, outlines, playing, revision, onCaseCueChange, onRecognitionOutlinesChange, stage, layout }: ThoughtContent & {
  layout: 'A' | 'B'; stage: string; playing: boolean; revision: number; onRecognitionOutlinesChange: (outlines: string[]) => void;
} & CueProps) {
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
  const bracketJFormula = stage === 'corner-position' && displayed.alg === J_ALG;
  return <div className={`lbl-complete-thought${layout === 'A' ? ' tutorial-single-caption' : ''}`} aria-live="polite">
    <ReadingFit pane>
    <p data-fading={fading}>
      <span>{displayed.text}</span>
      {displayed.alg ? <code className="lbl-complete-detail lbl-complete-alg">{getLblAlgGroups(stage, displayed.alg).map((group, index) => {
        const notation = group.map(move => move.notation).join(' ');
        return <span key={index}>{bracketJFormula && group.length > 1 ? `(${notation})` : notation}</span>;
      })}</code>
        : <span className="lbl-complete-detail">{displayed.detail}</span>}
    </p>
  </ReadingFit></div>;
}
