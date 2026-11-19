import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alg } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { tr } from '@/i18n/tr';
import ReadingFit from '../components/ReadingFit';
import TutorialCubeCallout from '../components/TutorialCubeCallout';
import VideoProgress from '../components/VideoProgress';
import { edgeDirectionObservation, wallScanPhases, type DemoView } from './complete-demo-state';
import { lblDemoView, LESSON_STICKERING, type LblExample } from './content';
import { usePlayerVisible } from './use-player-visible';

const NO_OUTLINES: string[] = [];
const VIEW_YAW: Partial<Record<DemoView, number>> = { home: 0, right: -Math.PI / 2, back: -Math.PI, left: Math.PI / 2 };
const TURN_DURATION = 2200;
const FLASH_INTERVAL = 650;

function observationPlan(example: LblExample, caseIndex: number) {
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
  const scans = wallScanPhases(setup, 0, caseIndex);
  const hasWall = caseIndex !== 2;
  const left = caseIndex === 0;
  const preparation = new Alg(example.alg).expand().toString().split(/\s+/).find(move => /^y/.test(move)) ?? '';
  const scanDuration = 2600;
  const foundAt = (scans.length - 1) * scanDuration;
  const placeWallAt = foundAt + 3500;
  const turnAt = placeWallAt + 1200;
  const observeAt = turnAt + TURN_DURATION + 1400;
  const targetAt = observeAt + 4900;
  const returnAt = targetAt + 4200;
  const duration = hasWall ? returnAt + 1400 : foundAt + TURN_DURATION;
  const camera = scans.slice(0, -1).map((scan, index) => ({
    at: index * scanDuration,
    duration: scanDuration * .65,
    yaw: !hasWall && scan.view === 'left' ? -3 * Math.PI / 2 : VIEW_YAW[scan.view ?? 'home'] ?? 0,
  }));
  if (hasWall) {
    camera.push(
      { at: turnAt, duration: TURN_DURATION, yaw: 0 },
      { at: observeAt, duration: 1700, yaw: left ? -.6 : .85 },
      { at: observeAt + 2400, duration: 2500, yaw: left ? 1.05 : -.3 },
      // Return to the same front view used by the formula player.
      { at: returnAt, duration: duration - returnAt, yaw: 0 },
    );
  } else {
    // Finish the full orbit at the formula player's front view.
    camera.push({ at: foundAt, duration: TURN_DURATION, yaw: -2 * Math.PI });
  }

  return { setup, preparation, camera, hasWall, foundAt, placeWallAt, turnAt, observeAt, targetAt, returnAt, duration,
    wall: scans.at(-1)?.act.outlines ?? NO_OUTLINES,
    direction: hasWall ? edgeDirectionObservation(`${setup} ${preparation}`, left) : NO_OUTLINES };
}

export default function EdgeObservation({ example, caseIndex, onDone }: {
  example: LblExample; caseIndex: number; onDone: () => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const visible = usePlayerVisible(player, example.alg);
  const yaw = useRef(0);
  const clock = useRef(0);
  const turnApplied = useRef(false);
  const seekFrame = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  const plan = useMemo(() => observationPlan(example, caseIndex), [example, caseIndex]);
  const { hasWall } = plan;
  const finished = visible && time >= plan.duration;
  const lookingAtTarget = time >= plan.targetAt && time < plan.returnAt;

  useEffect(() => {
    setToolbar(root.current?.closest('.lbl-learning')?.querySelector('.lbl-demo-toolbar') ?? null);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => {
      preference.removeEventListener('change', update);
      cancelAnimationFrame(seekFrame.current);
    };
  }, []);

  const updateView = useCallback((at: number) => {
    const index = plan.camera.findLastIndex(view => at >= view.at);
    const view = plan.camera[index];
    if (!view) return;
    const from = plan.camera[index - 1]?.yaw ?? 0;
    const progress = reduced ? 1 : Math.min((at - view.at) / view.duration, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const nextYaw = from + (view.yaw - from) * eased;
    if (nextYaw !== yaw.current) player.current?.orbitView?.(nextYaw - yaw.current, 0);
    yaw.current = nextYaw;
  }, [plan, reduced]);

  useEffect(() => {
    if (!visible || !playing || finished) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      const elapsed = previous === undefined || document.hidden ? 0 : Math.min(now - previous, 50);
      previous = now;
      if (seekFrame.current) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const next = Math.min(plan.duration, clock.current + elapsed);
      if (!turnApplied.current && plan.preparation && next >= plan.turnAt) {
        const handle = player.current;
        if (reduced) {
          const adapter = handle?.getPlayer();
          if (adapter) adapter.timestamp = 1;
        } else handle?.playMove?.(0);
        turnApplied.current = true;
      }
      const turning = turnApplied.current && player.current?.isUserMovePending?.(false);
      clock.current = turning ? Math.min(next, plan.observeAt - 1) : next;
      updateView(clock.current);
      setTime(clock.current);
      if (clock.current < plan.duration) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, playing, finished, plan, reduced, updateView]);

  const seek = (value: number) => {
    if (!visible) return;
    const handle = player.current;
    const adapter = handle?.getPlayer();
    const turned = Boolean(plan.preparation) && value >= plan.turnAt;
    const waitForTurn = turned && turnApplied.current && handle?.isUserMovePending?.(false);
    cancelAnimationFrame(seekFrame.current);
    seekFrame.current = 0;
    // The sim steps by whole turns when seeking, while normal playback animates the turn.
    handle?.setAnimationPaused?.(false);
    if (adapter) adapter.timestamp = turned ? 1 : 0;
    turnApplied.current = turned;
    const apply = () => {
      if (waitForTurn && handle?.isUserMovePending?.(false)) {
        seekFrame.current = requestAnimationFrame(apply);
        return;
      }
      seekFrame.current = 0;
      updateView(value);
      clock.current = value;
      setTime(value);
      if (value >= plan.duration) setPlaying(false);
    };
    apply();
  };

  useEffect(() => {
    if (!finished) return;
    function onKey(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable], [role="slider"]')) return;
      event.preventDefault();
      onDone();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finished, onDone]);

  const flashHidden = (start: number) => {
    const beat = Math.floor((time - start) / FLASH_INTERVAL);
    return !reduced && beat < 4 && beat % 2 === 1;
  };
  const outlines = time >= plan.foundAt && time < plan.observeAt && !flashHidden(plan.foundAt)
    ? plan.wall
    : lookingAtTarget && !flashHidden(plan.targetAt) ? plan.direction : NO_OUTLINES;

  const caption = finished
    ? !hasWall ? { zh: '四面都没有墙\n先做公式造墙', en: 'No wall on any side\nUse the algorithm to make one' }
      : caseIndex === 0 ? { zh: '对色在左边', en: 'The opposite color is on the left' }
        : { zh: '对色在右边', en: 'The opposite color is on the right' }
    : !hasWall || time < plan.foundAt ? { zh: '找“墙”\n侧面顶层三个格同色', en: 'Find a wall\nLook for three matching stickers in a top row' }
      : time < plan.placeWallAt ? { zh: '找到墙了', en: 'Found a wall' }
        : time < plan.observeAt ? { zh: '把墙转到后面', en: 'Turn the cube to put the wall at the back' }
          : { zh: '观察对色在哪一边', en: 'Look for the opposite color on either side' };
  const bubbleStage = visible && hasWall && lookingAtTarget ? root.current?.querySelector('.sim-stage') : null;

  return <div ref={root} className="lbl-content lbl-content-example lbl-special-case-prelude" data-tutorial-mode="timeline" data-tutorial-layout="A">
    <section className="lbl-demonstration">
      <div className="lbl-auto-player lbl-notation-player" data-visible={visible}>
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" alg={plan.preparation} setup={plan.setup}
          moveDurationMs={TURN_DURATION} set={LESSON_STICKERING['edge-position']} additionalStickering="F2L" orientation="z2"
          sceneRot={lblDemoView()} highlightedStickers={outlines}
          controlMode="none" hideResetView lockView interactionMode="none" fillPane />
      </div>
    </section>
    <section className="lbl-explanation tutorial-single-caption"><ReadingFit pane>
      <p className="lbl-lead" aria-live="polite">{tr(caption)}</p>
      {finished && <button type="button" className="lbl-guide-continue lbl-guide-continue-hint" onClick={onDone}>{tr({ zh: '点击继续', en: 'Click to continue' })}</button>}
    </ReadingFit></section>
    {toolbar && createPortal(<div className="lbl-cross-animation-progress">
      <VideoProgress time={time} duration={plan.duration} playing={playing} onSeek={seek}
        onPlayingChange={next => {
          if (!seekFrame.current) player.current?.setAnimationPaused?.(!next);
          setPlaying(next);
        }} onReplay={() => seek(0)} />
    </div>, toolbar)}
    {bubbleStage && createPortal(
      <div className="lbl-left-thumb-overlay">
        <TutorialCubeCallout side={caseIndex === 1 ? 'left' : 'right'} player={player} targetStickers={plan.direction} className="lbl-cube-callout" role="status">
          {tr({ zh: '红色和橙色是对色', en: 'Red and orange are opposite colors' })}
        </TutorialCubeCallout>
      </div>, bubbleStage,
    )}
  </div>;
}
