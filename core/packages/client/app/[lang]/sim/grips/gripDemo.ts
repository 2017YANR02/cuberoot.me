import { AxesHelper, Vector3 } from 'three';
import type { AtlasOrder } from './catalog';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import type { ContactStroke } from './contactComparisons';
import { SIZE } from '../engine/define';
import { GestureContactTrace } from '../engine/hands/gestureContactTrace';
import { mountSimWorld, type SimMountOpts } from '@/components/sim-embed/mountSimWorld';
import { attachEmbeddedSimInteraction } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { elapsedMsToSimTicks } from '@/lib/sim_timing';
import { pushRule } from '@/lib/push-notation';
import { HOME_SCENE_ROT } from '../engine/viewControls';
import HandsRig, { planHomeStroke, simulateGrips, type Axis, type GripName, type HandGesture } from '../engine/hands/handsRig';
import { findGripMarks, stripGripMarks } from '@cuberoot/shared/alg-notation';
import { playbackFingerAnnotations, type FingerAnnotation } from '@/lib/alg-finger-marks';
import type World from '../engine/world';
import type Cube from '../engine/nxn/cube';
import { TwistAction } from '../engine/nxn/twister';

export type StrokeSample = ReturnType<GestureContactTrace['read']>[number];

export type DemoPhase = 'loading' | 'pose' | 'start' | 'regrip' | 'gripped' | 'prepare' | 'turn' | 'handoff' | 'settle' | 'end' | 'error' | 'unavailable';

export type GripDemoMount = (opts: SimMountOpts) => {
  world: World; invalidate(): void; dispose(): void;
  interactionTarget: HTMLElement;
};

export function mountGripDemo(host: HTMLElement, onPhase: (phase: DemoPhase) => void,
  options: { hands?: HandsRig; mountView?: GripDemoMount; lessonClock?: { rate(): number; progress(percent: number): void };
    order?: AtlasOrder; onGesture?: (gesture: HandGesture | null) => void; showStrokeView?: boolean;
    onSecondStroke?: () => void;
    onContactCue?: (index: number) => void; onContact?: (sample: StrokeSample) => void } = {}) {
  let phase: DemoPhase = 'loading';
  let remaining = 0;
  let paused = false;
  let startedTurns = 0;
  let secondStroke = false;
  let relay = false;
  let twoSingles = false;
  let poseOnly = false;
  let poseDrawn = false;
  let lastGesture: HandGesture | null = null;
  let workingGrips: ReturnType<HandsRig['gripNames']> | null = null;
  let entry: ReturnType<HandsRig['readHandGeometry']> = null;
  let seated: ReturnType<HandsRig['readHandGeometry']> = null;
  let candidates: HandsRig['strokeCandidates'];
  let geometryEnabled = false;
  let action = new TwistAction('U');
  let grips: readonly { side: 'L' | 'R'; grip: GripName }[] = [];
  let gripIndex = 0;
  let waitingForGrip = false;
  let push = false;
  let annotation: FingerAnnotation | undefined;
  let contactStroke: ContactStroke | undefined;
  let contactIndex = 0;
  function showCue(index: number) {
    const cue = contactStroke?.cues[index];
    cube.instancedRenderer.setStickerPreview(cue ? (id, face) => engineHomeSid(id, face, cube.order) === cue.sticker : null);
    contactIndex = index;
    options.onContactCue?.(index);
  }
  function enter(next: DemoPhase) {
    if (next !== phase) { phase = next; onPhase(next); }
  }

  const axisLabels: { element: HTMLSpanElement; end: Vector3 }[] = [];
  const projected = new Vector3();
  let seekTarget: number | null = null;
  let progress = 0;
  function updateProgress() {
    if (!options.lessonClock) return;
    let fraction = 0;
    if (startedTurns) {
      const turn = turns[0];
      const angle = cube.busy ? Math.abs(turn.group.angle) / (Math.abs(turn.twist) * Math.PI / 2) : 1;
      fraction = (startedTurns - 1 + angle) / (twoSingles ? 2 : 1);
    }
    const next = phase === 'end' ? 100 : Math.min(99, Math.round(fraction * 100));
    if (progress !== next) options.lessonClock.progress(next);
    progress = next;
  }
  function tick(world: World, dt: number) {
    if (options.lessonClock && !poseOnly) {
      for (const { group } of turns) group.advancePausedAnimation(elapsedMsToSimTicks(dt));
    }
    const rig = world.hands;
    if (!rig || phase === 'error' || phase === 'unavailable') return false;
    if (poseOnly && poseDrawn) return false;
    const dirty = rig.tick(dt, false, !poseOnly);
    if (rig.getLoadState().hands === 'error') { enter('error'); return dirty; }
    if (rig.getLoadState().hands !== 'ready') return dirty;
    if (poseOnly) {
      // Once the loaded mesh has faded in, keep the rendered pose until the next selection.
      poseDrawn = !dirty;
      enter('pose');
      return true;
    }
    if (phase === 'loading') {
      enter('start');
      return dirty;
    }
    const cube = world.cube as Cube;
    if (phase === 'start') {
      remaining -= dt;
      if (remaining <= 0) enter('prepare');
    }
    if (waitingForGrip) {
      if (rig.isRegripping) return dirty;
      waitingForGrip = false;
      remaining = 650;
      enter('gripped');
    }
    if (phase === 'gripped') {
      remaining -= dt;
      if (remaining > 0) return dirty;
      enter('prepare');
    }
    if (phase === 'prepare' || phase === 'regrip') {
      const nextGrip = grips[gripIndex];
      if (nextGrip) {
        rig.regrip(nextGrip.grip, nextGrip.side);
        gripIndex++;
        waitingForGrip = true;
        enter('regrip');
        return true;
      }
      if (geometryEnabled && !entry) entry = rig.readHandGeometry();
      const { group, twist } = turns[0];
      if (rig.prepareTwist(group.axis as Axis, turns.map(turn => turn.group.layer), twist > 0 ? 1 : -1, Math.abs(twist), push, undefined, false, annotation)) {
        if (rig.getMarkedMotionProblem()) enter('unavailable');
        else enter(rig.isRegripping ? 'regrip' : 'prepare');
      } else {
        if (geometryEnabled) seated = rig.readHandGeometry();
        const easing = contactStroke || relay || twoSingles ? 'linear' : 'ease-out';
        if (cube.twister.twist(action, false, false, 60, easing)) {
          startedTurns++;
          if (twoSingles && startedTurns === 2) options.onSecondStroke?.();
          enter('turn');
        }
      }
    } else if (phase === 'turn') {
      if (contactStroke) {
        const angle = cube.busy ? Math.abs(turns[0].group.angle) * 180 / Math.PI : Math.abs(turns[0].twist) * 90;
        const cues = contactStroke.cues;
        while (contactIndex + 1 < cues.length && angle >= cues[contactIndex + 1].degrees) showCue(contactIndex + 1);
      }
      const gesture = rig.activeGesture;
      if (gesture && gesture !== lastGesture) {
        lastGesture = gesture;
        workingGrips = rig.gripNames();
        candidates = rig.strokeCandidates;
        options.onGesture?.(gesture);
      }
      if (relay && !secondStroke && (!cube.busy || Math.abs(turns[0].group.angle) >= Math.PI / 2)) {
        secondStroke = true;
        options.onSecondStroke?.();
      }
      if (!cube.busy) {
        enter('settle');
        remaining = 350;
      }
    } else if (phase === 'settle') {
      remaining -= dt;
      if (remaining <= 0 && !rig.isRegripping && !rig.isReachRetreating) {
        enter(twoSingles && startedTurns === 1 ? 'prepare' : 'end');
      }
    }
    return dirty;
  }
  const mountView: GripDemoMount = options.mountView ?? (opts => {
    const view = mountSimWorld(opts);
    return { ...view, interactionTarget: view.renderer.domElement };
  });
  const mount = mountView({ host, puzzle: options.order ?? 3, interactive: true, preserveDrawingBuffer: false,
    onRendered(world) {
      if (!geometryEnabled) return;
      for (const { element, end } of axisLabels) {
        projected.copy(end).applyMatrix4(world.cube.matrixWorld).project(world.camera);
        element.style.left = (projected.x + 1) * 50 + '%';
        element.style.top = (1 - projected.y) * 50 + '%';
      }
    },
    onFrame(world, dt) {
      if (seekTarget !== null) {
        // Replay the authored hand preparation as well as the layer angle when seeking.
        // Bound each frame so slow or unavailable models remain interruptible.
        const until = performance.now() + 8;
        do {
          tick(world, 1000 / 120);
          updateProgress();
          if (progress >= seekTarget || phase === 'error' || phase === 'unavailable') seekTarget = null;
        } while (seekTarget !== null && phase !== 'loading' && performance.now() < until);
        return true;
      }
      if (paused) return false;
      const dirty = tick(world, dt * (options.lessonClock?.rate() ?? 1));
      updateProgress();
      return dirty;
    },
  });
  const { world } = mount;
  const cube = world.cube as Cube;
  let turns = cube.table.convert(action);
  const automaticView = world.scene.quaternion.clone();
  world.handsFactory = () => options.hands ?? new HandsRig();
  function releaseHands() {
    if (options.hands) {
      world.setHandsWanted(false);
      options.hands.removeFromParent();
    } else {
      world.hands?.dispose();
    }
  }
  let detach: () => void;
  try {
    world.setHandsWanted(true);
    detach = attachEmbeddedSimInteraction({ world, dom: mount.interactionTarget, mode: 'view' });
  } catch (error) {
    releaseHands();
    mount.dispose();
    throw error;
  }
  const rig = world.hands!;

  const trace = new GestureContactTrace();
  let axes: AxesHelper | undefined;
  let unsubscribe: (() => void) | undefined;

  function contactReview() {
    if (!geometryEnabled || phase !== 'end' || !lastGesture || lastGesture.kind !== 'flick') return null;
    const sampled = trace.read().filter(row => row.geometry.contact);
    const quarters = Math.abs(turns[0].twist);
    const missing = Array.from({ length: quarters }, (_, quarter) => quarter)
      .filter(quarter => !sampled.some(row => row.driving && row.quarter === quarter));
    const supportObserved = sampled.some(row => row.role === 'support');
    const relayObserved = lastGesture.finger2 ? [0, 1].every(quarter => sampled.some(row => row.role === 'active'
      && row.quarter === quarter && Math.abs(Math.abs(row.angle) - Math.PI / 2) <= Math.PI / 12)) : null;
    return { missing, supportObserved, relayObserved };
  }

  return {
    showGeometry(show: boolean) {
      geometryEnabled = show;
      unsubscribe?.();
      unsubscribe = undefined;
      if (show) {
        if (!axes) {
          const length = SIZE * cube.order * .8;
          axes = new AxesHelper(length);
          for (const material of Array.isArray(axes.material) ? axes.material : [axes.material]) {
            material.depthTest = false;
            material.depthWrite = false;
          }
          axes.renderOrder = 1000;
          cube.add(axes);
          for (const axis of ['x', 'y', 'z'] as const) {
            const end = new Vector3(), element = document.createElement('span');
            end[axis] = length;
            element.className = 'grip-atlas-axis';
            element.textContent = '+' + axis.toUpperCase();
            element.setAttribute('aria-hidden', 'true');
            host.appendChild(element);
            axisLabels.push({ element, end });
          }
        }
        unsubscribe = rig.subscribeDiagnostics(frame => {
          if (!frame.active) return;
          const before = trace.read().at(-1);
          trace.observe(frame, cube);
          const rows = trace.read();
          if (rows.at(-1) === before) return;
          const start = before ? rows.lastIndexOf(before) + 1 : 0;
          for (const sample of rows.slice(start)) {
            if (sample.driving && sample.geometry.contact) options.onContact?.(sample);
          }
        });
      }
      if (axes) axes.visible = show;
      for (const label of axisLabels) label.element.hidden = !show;
      mount.invalidate();
    },
    contactReview,
    recording: () => ({ review: contactReview(), unitsPerCubie: SIZE, order: cube.order, layers: turns.map(turn => turn.group.layer), entry, seated, gesture: lastGesture, candidates, samples: trace.read() }),
    candidateCount: () => candidates?.length ?? 0,
    workingGrips: () => workingGrips,
    play(left: GripName, right: GripName, move: string | null, markedHtml?: string, contact?: ContactStroke,
      lesson?: { relay?: 'relay' | 'two-singles'; keepView?: boolean; comparePush?: boolean; setup?: typeof grips }) {
      poseOnly = move === null;
      poseDrawn = false;
      relay = lesson?.relay === 'relay';
      twoSingles = lesson?.relay === 'two-singles';
      seekTarget = null;
      progress = 0;
      options.lessonClock?.progress(0);
      paused = false;
      cube.twister.setAnimationPaused(!!options.lessonClock);
      // Undo exactly the turns this canvas started, including a partially played quarter.
      if (startedTurns) {
        for (const { group } of turns) group.finish();
        const inverse = new TwistAction(action.sign, !action.reverse, action.times);
        for (let i = 0; i < startedTurns; i++) cube.twister.twist(inverse, true, false);
      }
      startedTurns = 0;
      secondStroke = false;
      const pose = simulateGrips([{ grip: left, side: 'L' }, { grip: right, side: 'R' }], cube.order);
      grips = lesson?.setup ?? (move ? findGripMarks(move) : []);
      gripIndex = 0;
      waitingForGrip = false;
      const token = move ? stripGripMarks(move).trim() : '';
      push = !!pushRule(token);
      rig.setGrips(pose.R, pose.L, pose.wristAngles, push);
      if (contact || contactStroke) {
        contactStroke = contact;
        showCue(0);
      }
      if (move === null) {
        turns = [];
        if (world.scene.quaternion.angleTo(automaticView) < .0001) {
          world.scene.rotation.set(HOME_SCENE_ROT.x, HOME_SCENE_ROT.y, HOME_SCENE_ROT.z);
          world.scene.updateMatrix();
          automaticView.copy(world.scene.quaternion);
        }
        enter(rig.getLoadState().hands === 'ready' ? 'pose' : 'loading');
        mount.invalidate();
        return;
      }
      const turn = push ? token.slice(0, -1) : token;
      annotation = markedHtml ? playbackFingerAnnotations(turn, markedHtml)[0] : undefined;
      action = new TwistAction(turn);
      turns = cube.table.convert(action);
      // Show the working surface on lower hooks. A viewer's own orbit takes
      // precedence and persists across replays and move selections.
      if (!lesson?.keepView && (contact || options.showStrokeView || lesson?.comparePush || relay || twoSingles) && world.scene.quaternion.angleTo(automaticView) < .0001) {
        const [{ group, twist }] = turns;
        const stroke = !markedHtml && planHomeStroke(cube.order, { L: left, R: right }, group.axis as Axis,
          turns.map(t => t.group.layer), twist > 0 ? 1 : -1, Math.abs(twist));
        const comparison = lesson?.comparePush && pushRule(turn + 'p');
        if (contact) {
          world.scene.rotation.set(...contact.view, 0);
        } else if (relay || twoSingles) {
          world.scene.rotation.set(.26, twist > 0 ? -2.4 : 2.4, 0);
        } else if (comparison) {
          // Keep the originating side and B visible in both versions of the turn.
          world.scene.rotation.set(comparison.layer === 'low' ? -.64 : .32,
            (comparison.hand === 'R' ? -1 : 1) * 2.25, 0);
        } else if (stroke && stroke.gesture.style === 'lowerHook') {
          const yaw = (stroke.gesture.hand === 'R' ? -1 : 1) * (Math.PI - .42);
          world.scene.rotation.set(group.axis === 'y' ? -.88 : -.20, yaw, 0);
        } else world.scene.rotation.set(HOME_SCENE_ROT.x, HOME_SCENE_ROT.y, HOME_SCENE_ROT.z);
        world.scene.updateMatrix();
        automaticView.copy(world.scene.quaternion);
      }
      entry = seated = null;
      candidates = undefined;
      trace.clear();
      lastGesture = null;
      workingGrips = null;
      options.onGesture?.(null);
      remaining = 500;
      enter(rig.getLoadState().hands === 'ready' ? 'start' : 'loading');
      mount.invalidate();
    },
    seek(percent: number) {
      if (!options.lessonClock) return;
      paused = true;
      seekTarget = Math.max(0, Math.min(100, percent));
    },
    pause(value: boolean, atMs?: number) {
      paused = value;
      cube.twister.setAnimationPaused(!!options.lessonClock || value, atMs);
    },
    dispose() {
      for (const { group } of turns) group.finish();
      unsubscribe?.();
      if (axes) { axes.removeFromParent(); axes.dispose(); }
      for (const label of axisLabels) label.element.remove();
      detach();
      releaseHands();
      mount.dispose();
    },
  };
}
