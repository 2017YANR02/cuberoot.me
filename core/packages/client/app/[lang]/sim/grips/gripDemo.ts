import { AxesHelper, Vector3 } from 'three';
import type { AtlasOrder } from './catalog';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import type { ContactStroke } from './contactComparisons';
import { SIZE } from '../engine/define';
import { GestureContactTrace } from '../engine/hands/gestureContactTrace';
import { mountSimWorld } from '@/components/sim-embed/mountSimWorld';
import { attachEmbeddedSimInteraction } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { pushRule } from '@/lib/push-notation';
import { HOME_SCENE_ROT } from '../engine/viewControls';
import HandsRig, { planHomeStroke, simulateGrips, type Axis, type GripName, type HandGesture } from '../engine/hands/handsRig';
import { findGripMarks, stripGripMarks } from '@cuberoot/shared/alg-notation';
import { playbackFingerAnnotations, type FingerAnnotation } from '@/lib/alg-finger-marks';
import type Cube from '../engine/nxn/cube';
import { TwistAction } from '../engine/nxn/twister';

export type StrokeSample = ReturnType<GestureContactTrace['read']>[number];

export type DemoPhase = 'loading' | 'start' | 'regrip' | 'gripped' | 'prepare' | 'turn' | 'handoff' | 'settle' | 'end' | 'error' | 'unavailable';

export function mountGripDemo(host: HTMLElement, onPhase: (phase: DemoPhase) => void,
  options: { order?: AtlasOrder; onGesture?: (gesture: HandGesture | null) => void; showStrokeView?: boolean; comparePush?: boolean;
    regripDemo?: boolean; onGripStep?: (index: number) => void;
    upperRelayComparison?: 'relay' | 'two-singles'; onSecondStroke?: () => void;
    whenBothReady?: (advance: (atMs: number) => void) => void; onOrbit?: (dx: number, dy: number) => void; onContactCue?: (index: number) => void; onContact?: (sample: StrokeSample) => void } = {}) {
  let phase: DemoPhase = 'loading';
  let remaining = 0;
  let paused = false;
  let waitingForPeer = false;
  let startedTurns = 0;
  let releasedHandoff = false;
  let holdingHandoff = false;
  const relay = options.upperRelayComparison === 'relay';
  const twoSingles = options.upperRelayComparison === 'two-singles';
  // Cap the half turn at the handoff until the other index has returned to its starting slot.
  const relayProgress = (progress: number) => releasedHandoff ? progress : Math.min(.5, progress);
  function advanceTogether(advance: (atMs?: number) => void) {
    if (!options.whenBothReady) return advance();
    waitingForPeer = true;
    options.whenBothReady(atMs => { waitingForPeer = false; advance(atMs); });
  }
  let lastGesture: HandGesture | null = null;
  let workingGrips: ReturnType<HandsRig['gripNames']> | null = null;
  let entry: ReturnType<HandsRig['readHandGeometry']> = null;
  let seated: ReturnType<HandsRig['readHandGeometry']> = null;
  let candidates: HandsRig['strokeCandidates'];
  let geometryEnabled = false;
  let action = new TwistAction('U');
  let grips: ReturnType<typeof findGripMarks> = [];
  let gripIndex = 0;
  let waitingForGrip = false;
  let gripsReady = false;
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
  const mount = mountSimWorld({ host, puzzle: options.order ?? 3, interactive: true, preserveDrawingBuffer: false,
    onRendered(world) {
      if (!geometryEnabled) return;
      for (const { element, end } of axisLabels) {
        projected.copy(end).applyMatrix4(world.cube.matrixWorld).project(world.camera);
        element.style.left = (projected.x + 1) * 50 + '%';
        element.style.top = (1 - projected.y) * 50 + '%';
      }
    },
    onFrame(world, dt) {
      const rig = world.hands;
      if (!rig || paused || phase === 'error') return false;
      const dirty = rig.tick(dt);
      if (rig.getLoadState().hands === 'error') { enter('error'); return dirty; }
      if (rig.getLoadState().hands !== 'ready') return dirty;
      if (phase === 'loading') {
        if (!waitingForPeer) advanceTogether(() => enter('start'));
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
          options.onGripStep?.(gripIndex);
          gripIndex++;
          waitingForGrip = true;
          enter('regrip');
          return true;
        }
        // Keep the reference in its starting grip until the peer has completed
        // every written regrip. Both then prepare and start the same layer turn.
        if (options.regripDemo && options.whenBothReady && !gripsReady) {
          if (!waitingForPeer) advanceTogether(() => { gripsReady = true; });
          return dirty;
        }
        if (geometryEnabled && !entry) entry = rig.readHandGeometry();
        const { group, twist } = turns[0];
        if (rig.prepareTwist(group.axis as Axis, turns.map(turn => turn.group.layer), twist > 0 ? 1 : -1, Math.abs(twist), push, undefined, false, annotation)) {
          if (rig.getMarkedMotionProblem()) enter('unavailable');
          else enter(rig.isRegripping ? 'regrip' : 'prepare');
        } else if (!waitingForPeer) {
          // Keep polling prepareTwist while the other hand model is getting
          // into position so the selected finger hint stays current.
          if (geometryEnabled) seated = rig.readHandGeometry();
          advanceTogether(startMs => {
            const ticks = contactStroke || options.regripDemo || relay ? 120 : 60;
            const easing = relay ? relayProgress : contactStroke || options.regripDemo || twoSingles ? 'linear' : 'ease-out';
            if (cube.twister.twist(action, false, false, ticks, easing, startMs)) {
              startedTurns++;
              if (twoSingles && startedTurns === 2) options.onSecondStroke?.();
              enter('turn');
            }
          });
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
        if (relay && !releasedHandoff && !waitingForPeer && (!cube.busy || Math.abs(turns[0].group.angle) >= Math.PI / 2)) {
          holdingHandoff = true;
          enter('handoff');
          cube.twister.setAnimationPaused(true);
          advanceTogether(atMs => {
            holdingHandoff = false;
            releasedHandoff = true;
            cube.twister.setAnimationPaused(paused, atMs);
            enter('turn');
            options.onSecondStroke?.();
          });
        }
        if (!cube.busy && !waitingForPeer) {
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
    },
  });
  const { world } = mount;
  const cube = world.cube as Cube;
  let turns = cube.table.convert(action);
  const automaticView = world.scene.quaternion.clone();
  // Regrip comparisons need both wrists in frame, including on narrow paired canvases.
  if (options.regripDemo) world.scale = .60;
  world.handsFactory = () => new HandsRig();
  world.setHandsWanted(true);
  const rig = world.hands!;
  const detach = attachEmbeddedSimInteraction({ world, dom: mount.renderer.domElement, mode: 'view' });

  const orbit = world.controller.onOrbit;
  if (options.onOrbit && orbit) world.controller.onOrbit = (dx, dy) => {
    orbit(dx, dy);
    options.onOrbit?.(dx, dy);
  };

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
    orbitBy(dx: number, dy: number) {
      orbit?.(dx, dy);
      mount.invalidate();
    },
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
    play(left: GripName, right: GripName, move: string, markedHtml?: string, contact?: ContactStroke) {
      paused = false;
      waitingForPeer = false;
      cube.twister.setAnimationPaused(false);
      // Undo exactly the turns this canvas started, including a partially played quarter.
      if (startedTurns) {
        for (const { group } of turns) group.finish();
        const inverse = new TwistAction(action.sign, !action.reverse, action.times);
        for (let i = 0; i < startedTurns; i++) cube.twister.twist(inverse, true, false);
      }
      startedTurns = 0;
      holdingHandoff = releasedHandoff = false;
      const pose = simulateGrips([{ grip: left, side: 'L' }, { grip: right, side: 'R' }], cube.order);
      grips = findGripMarks(move);
      gripIndex = 0;
      gripsReady = false;
      waitingForGrip = false;
      const token = stripGripMarks(move).trim();
      push = !!pushRule(token);
      rig.setGrips(pose.R, pose.L, pose.wristAngles, push);
      const turn = push ? token.slice(0, -1) : token;
      annotation = markedHtml ? playbackFingerAnnotations(turn, markedHtml)[0] : undefined;
      action = new TwistAction(turn);
      turns = cube.table.convert(action);
      if (contact || contactStroke) {
        contactStroke = contact;
        showCue(0);
      }
      // Show the working surface on lower hooks. A viewer's own orbit takes
      // precedence and persists across replays and move selections.
      if ((contact || options.regripDemo || options.showStrokeView || options.comparePush || options.upperRelayComparison) && world.scene.quaternion.angleTo(automaticView) < .0001) {
        const [{ group, twist }] = turns;
        const stroke = !markedHtml && planHomeStroke(cube.order, { L: left, R: right }, group.axis as Axis,
          turns.map(t => t.group.layer), twist > 0 ? 1 : -1, Math.abs(twist));
        const comparison = options.comparePush && pushRule(turn + 'p');
        if (contact) {
          world.scene.rotation.set(...contact.view, 0);
        } else if (options.regripDemo) {
          world.scene.rotation.set(.24, -.24, 0);
        } else if (options.upperRelayComparison) {
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
      enter(!options.whenBothReady && rig.getLoadState().hands === 'ready' ? 'start' : 'loading');
      mount.invalidate();
    },
    pause(value: boolean, atMs?: number) {
      paused = value;
      cube.twister.setAnimationPaused(value || holdingHandoff, atMs);
    },
    dispose() {
      unsubscribe?.();
      if (axes) { axes.removeFromParent(); axes.dispose(); }
      for (const label of axisLabels) label.element.remove();
      detach();
      rig.dispose();
      mount.dispose();
    },
  };
}
