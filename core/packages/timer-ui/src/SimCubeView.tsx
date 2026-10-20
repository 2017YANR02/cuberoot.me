'use client';

/**
 * SimCubeView — a real 3D cube built by the /sim engine, driven by a move log,
 * optionally posed by the cube's gyroscope.
 *
 * Three callers, one component, because they are the same picture:
 *   - the LIVE mirror while timing (LiveCubeState), posed by the BLE gyro feed;
 *   - the post-solve REPLAY (PlaybackPanel), where the gyro track is optional —
 *     with a pose it shows how the cube sat in the hands, without one it just
 *     shows the state, which is still the /sim cube and not a second renderer;
 *   - the alg trainer's drill mirror (_trainer/TrainerLiveCube), which is the
 *     live mirror again with the case's own scramble as the log's anchor.
 *
 * It lives in components/sim-embed/ rather than under /timer because of that
 * third caller: the smart-cube stack grew up inside the timer, but this one is
 * a /sim embed like its neighbours here, and page-local is the wrong shelf for
 * something two pages render.
 *
 * `quat = null` is not an error state: the frame hook simply never writes an
 * orientation, and the engine's own iso view is what you see.
 *
 * Stickers come from the move log the caller maintains; orientation comes from
 * the quaternion feed. The two are independent channels and they stay
 * independent here:
 *
 *   - STICKERS  → the engine's twister — layer twists applied to child
 *     CubeGroups and per-instance matrices. `setup()` snaps the whole log;
 *     `push()` plays the new turns. Which one, and what exactly gets pushed,
 *     is decided by `planSimUpdate` (_lib/cube/sim_log.ts) — read its header
 *     before touching the effect at the bottom of this file.
 *
 * The engine is alg-driven — it has no facelet setter — so the move log MUST
 * be anchored at a solved cube for this to be truthful. LiveCubeState owns
 * that rule (`algAnchored`) and falls back to the flat facelet view when the
 * anchor is missing; do not paper over it with a synthetic setup alg here.
 *   - POSE      → `world.cube.quaternion` — the cube group's own transform,
 *     which the engine never writes, so it is ours to own outright.
 *
 * Two things this deliberately does NOT do:
 *   - It does not attach the /sim pointer Controller unless the caller opts in
 *     to view dragging. The live virtual cube uses that opt-in with layer turns
 *     locked, so dragging adjusts the view without changing cube state.
 *   - It does not put orientation on `world.scene.rotation`. That is the orbit
 *     channel, and the lights live under the scene — rotating it would drag the
 *     lighting around with the cube and kill every shading cue that makes the
 *     rotation readable. `scene.rotation` keeps the engine's fixed iso viewer
 *     tilt; the lights stay put; only the cube turns.
 *
 * Frame budget: this renders on the timing surface while the user is timing, so
 * a cube sitting still on the table must not burn 60 fps of GPU. The frame hook
 * marks the world dirty only when the smoothed quaternion actually moved past
 * ~1e-4 rad; a resting cube stops drawing after settling. Its frame subscription
 * still polls the passive quatRef so a new BLE sample cannot be missed.
 *
 * Size comes from the host box, which `mountSimWorld` measures with a
 * ResizeObserver — see `.timer-live-cube-3d` in timer.css.
 *
 * The orientation math (calibration / sensor basis / mirror / smoothing) is
 * pure and lives in app/[lang]/timer/_lib/bluetooth/orientation.ts — read its
 * header before touching any of these props. In particular the delta is
 * BODY-frame, which is what keeps the sensor's power-on heading off the screen;
 * that header records what it cost to learn.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import './live-cube.css';
import type World from '@cuberoot/puzzle-render-core/engine/world';
import type NxnCube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import type Controller from '@cuberoot/puzzle-render-core/engine/nxn/controller';
import type { SimMount } from '@cuberoot/puzzle-render-core/sim/mountSimWorld';
import { liveCubeSceneRotation as sceneRotation, ORBIT_K, orbitScene } from '@cuberoot/puzzle-render-core/engine/viewControls';
import {
  appendedSlicePair,
  planLiveSimUpdate,
  planSimUpdate,
  LiveTurnCadence,
  liveSimNeedsCatchUp,
  LIVE_VISUAL_BUDGET_MS,
} from '@cuberoot/shared/timer/sim-log';
import type { LiveSmartCubeDisplaySource, LiveSmartCubeDisplayEvent } from '@cuberoot/shared/smart-cube/anchor';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import {
  applyOrientation,
  calibrate,
  mirrorForBrand,
  quatAngleTo,
  quatConjugate,
  quatMul,
  QUAT_IDENTITY,
  sensorBasisForBrand,
  SLICE_ORIENTATION_FOLLOW_MS,
  SLICE_ORIENTATION_TAU_MS,
  slerpTowards,
  type Quat,
  type SensorBasisName,
} from '@cuberoot/shared/smart-cube/orientation';
import { rotationQuaternionForToken } from '@cuberoot/shared/timer/reconstruct/rotation-detect';

/** Below this the pose is "unchanged" and we skip the render entirely. */
const STILL_EPS_RAD = 1e-4;

/** Live mirrors receive completed BLE turns, not continuous layer angles. Keep
 *  one turn readable without replaying half-second-old history. These values
 *  alter motion timing only; geometry, materials and render cadence are intact. */
const LIVE_TICKS_PER_MS = 60 / 1000;

type CubeView = 'iso' | 'front' | 'smart';

/** DCTimer-BLE cameras look at the origin from (0,4.1,7.2) with gyro,
 *  or (4.8,4.1,7.2) without. Our fixed camera uses the inverse scene orbit. */
function hasValidOrientation(q: Quat | null | undefined): q is Quat {
  return !!q && [q.w, q.x, q.y, q.z].every(Number.isFinite)
    && Math.hypot(q.w, q.x, q.y, q.z) > 1e-6;
}

function attachPointerController(host: HTMLElement, controller: Controller, preview?: { start(): void; end(): void }): () => void {
  let activePointerId: number | null = null;
  const previousTouchAction = host.style.touchAction;
  host.style.touchAction = 'none';

  const send = (type: 'mousedown' | 'mousemove' | 'mouseup', event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    controller.touch({
      type,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      shift: event.shiftKey,
      button: event.button,
      alt: event.altKey,
    });
  };

  const release = (pointerId: number) => {
    try { host.releasePointerCapture(pointerId); } catch { /* already released */ }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (activePointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    activePointerId = event.pointerId;
    preview?.start();
    try { host.setPointerCapture(event.pointerId); } catch { /* unsupported WebView */ }
    send('mousedown', event);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    send('mousemove', event);
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    send('mouseup', event);
    activePointerId = null;
    preview?.end();
    release(event.pointerId);
    event.preventDefault();
  };

  host.addEventListener('pointerdown', onPointerDown, { passive: false });
  host.addEventListener('pointermove', onPointerMove, { passive: false });
  host.addEventListener('pointerup', onPointerUp, { passive: false });
  host.addEventListener('pointercancel', onPointerUp, { passive: false });
  host.addEventListener('lostpointercapture', onPointerUp);

  return () => {
    host.removeEventListener('pointerdown', onPointerDown);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerup', onPointerUp);
    host.removeEventListener('pointercancel', onPointerUp);
    host.removeEventListener('lostpointercapture', onPointerUp);
    if (activePointerId !== null) { preview?.end(); release(activePointerId); }
    host.style.touchAction = previousTouchAction;
    activePointerId = null;
  };
}

export interface SimCubeViewProps {
  language?: 'en' | 'zh';
  /** Allow dragging the cube area to orbit the view without turning layers. */
  allowViewDrag?: boolean;
  /** Temporarily orbit while held, restoring the viewer angle on release. */
  resetViewOnRelease?: boolean;
  /** Moves since the cube was last known SOLVED — see the note above. */
  moves: readonly string[];
  liveSource?: LiveSmartCubeDisplaySource;
  /**
   * A whole-cube rotation appended to the log for VIEWING only — the replay
   * uses it to put the cross face down without renaming (and recolouring) the
   * moves. It is a pose, not a turn, so it is passed separately: fold it into
   * `moves` and every new move lands BEFORE it, which is not an append and
   * costs you the animation. See _lib/cube/sim_log.ts.
   */
  pose?: string;
  /** Fixed grip already applied to the model; express gyro axes in that grip. */
  gyroOrientation?: string;
  /** Latest orientation sample, or null/omitted when none has arrived. */
  quat?: Quat | null;
  /**
   * Preferred over `quat` when given: a mutable box the owner writes each BLE
   * sample into. Orientation lands at 20-50 Hz; routing it through props would
   * re-render whoever owns the timer that often, for a value only this
   * component's frame loop ever reads. `quat` stays for the synthetic/dev feed
   * and for tests, where the re-render cost is irrelevant.
   */
  quatRef?: { current: Quat | null };
  /** Bump to capture the current sample as the upright reference. */
  calibrateToken?: number;
  /** Exact host sample shared with the replay reference; avoids a later-frame capture. */
  calibrationReference?: Quat | null;
  /**
   * Per-brand sensor axis remap — see orientation.ts.
   *
   * Omitting it does NOT mean 'identity'. Every cube measured so far has a Z-up
   * IMU, so `identity` is the one value known to be wrong for all of them; a
   * caller that forgets this prop should get the table's `unknown` row, not the
   * 「实际做 y，屏幕做 z」bug. `sensorBasisForBrand(null)` is that row.
   */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix). Calibration cannot do
   *  this — see orientation.ts. */
  mirror?: boolean;
  /**
   * Play the turns instead of snapping to the new state.
   *
   * Only ever applies to a pure APPEND on the TURN log — anything else (a seek,
   * a rewind, a re-anchor, a changed `pose`) still snaps, because there is no
   * honest animation for "the state jumped". Real-time catch-up is opt-in via
   * `realtime`; replay callers keep the ordinary /sim animation contract.
   */
  animate?: boolean;
  /**
   * Duration of the next appended move in the engine's nominal 60 Hz ticks.
   * Replay caps this at normal turn speed and shortens it for dense moves;
   * live mirrors leave it unset and use their own catch-up timings.
   */
  moveDurationTicks?: number;
  /**
   * Use linear turns with an adaptive duration and a millisecond backlog budget.
   * Emergency catch-up applies every stale turn and animates the newest one.
   * Replay callers leave this off and retain /sim timing.
   */
  realtime?: boolean;
  /**
   * Optional /sim stickering preset. The orientation is the same whole-cube
   * rotation prefix accepted by /sim's stickering control (for example `x2`
   * moves the canonical D-stage mask onto U).
   */
  stickering?: string;
  stickeringOrientation?: string;
  /**
   * 镜头角度。
   *
   *   'iso'   引擎自己的等轴视角(上下 30° / 左右 −33.75°),三个面都露一点 —— 看状态用。
   *   'front' 正对 F 面(左右 0° / 上下 0°,= /sim 的 `?img_r=y0x0`)—— 校准用:
   *           实体魔方摆正时屏幕上的绿面才是正方形,歪一点立刻看得出来,等轴视角下
   *           那点偏差混在三个面的透视里根本读不出来。
   *
   * 摆的是 `scene.rotation`(镜头轨道),不是 `cube.quaternion`(魔方自身姿态,陀螺仪
   * 独占的那条通道)—— 两条通道在这个组件里从不互相写。
   */
  /** 'smart' uses an elevated front view with gyro, an oblique view without. */
  view?: CubeView;
  /** Fired once the WebGL context is up and the first cube state is applied. */
  onReady?: () => void;
  /** Screen-reader label. Defaults to the live-mirror wording; the replay
   *  passes its own, since "实时" is a lie there. */
  ariaLabel?: string;
  /**
   * 宿主 class。尺寸必须由调用方钉死两边(见 `.timer-live-cube-3d` 的注释:
   * mountSimWorld 量这个盒子再把结果写回 canvas,让内容决定宽度会锁死第一次量到的值)。
   */
  className?: string;
}

export default function SimCubeView(props: SimCubeViewProps): JSX.Element {
  const {
    language = 'en',
    allowViewDrag = false,
    resetViewOnRelease = false,
    moves,
    liveSource,
    pose = '',
    gyroOrientation = '',
    quat,
    quatRef,
    calibrateToken = 0,
    calibrationReference,
    sensorBasis = sensorBasisForBrand(null),
    mirror = mirrorForBrand(null),
    animate = false,
    moveDurationTicks,
    realtime = false,
    stickering = '',
    stickeringOrientation = '',
    view = 'iso',
    onReady,
    ariaLabel,
    className = 'timer-live-cube-3d',
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<SimMount | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tr = (copy: { en: string; zh: string }) => copy[language];

  // ── Live values the rAF hook reads. Refs, not state: the frame loop must not
  //    re-subscribe (and the component must not re-render) per BLE sample. ──
  const rawRef = useRef<Quat | null>(null);
  const referenceRef = useRef<Quat | null>(calibrationReference ? calibrate(calibrationReference) : null);
  const smoothedRef = useRef<Quat | null>(null);
  const appliedRef = useRef<Quat | null>(null);
  const pendingCalibrationRef = useRef(false);
  // M/E/S turns rotate the sensor-bearing core, unlike outer-layer turns. The
  // matching opposite-face BLE pair temporarily accelerates only orientation
  // follow; layer timing and every rendering-quality setting remain unchanged.
  const sliceFollowUntilRef = useRef(0);
  const cadenceRef = useRef(new LiveTurnCadence());
  /** 挂载时读一次(避免先按等轴画一帧);之后的改动走下面的 effect。 */
  const viewRef = useRef(view);
  const gyroViewActiveRef = useRef(false);
  const basisRef = useRef<SensorBasisName>(sensorBasis);
  const mirrorRef = useRef(mirror);
  const onReadyRef = useRef(onReady);
  // A ref to the caller's ref — the mount effect runs once, so it must not
  // close over whichever box happened to be passed on the first render.
  const externalQuatRef = useRef(quatRef);
  const gyroFrame = useMemo(() => gyroOrientation.trim().split(/\s+/).reduce((q, token) => {
    const rotation = rotationQuaternionForToken(token);
    // The renderer uses clockwise (negative right-handed) notation and applies
    // successive written rotations in world order, unlike the detector's table.
    return rotation ? quatMul(quatConjugate(rotation), q) : q;
  }, QUAT_IDENTITY), [gyroOrientation]);
  const gyroFrameRef = useRef(gyroFrame);

  // Effect order matters and follows declaration order: the sample lands before
  // the calibration arming below can consume it.
  useEffect(() => {
    // A null sample means "nothing new" (e.g. the cube went quiet), not "reset";
    // keep showing the last known pose rather than snapping back to solved.
    if (quat) rawRef.current = quat;
  }, [quat]);

  useEffect(() => {
    basisRef.current = sensorBasis;
    mirrorRef.current = mirror;
    onReadyRef.current = onReady;
    externalQuatRef.current = quatRef;
    gyroFrameRef.current = gyroFrame;
  });

  // Calibration: capture the live sample the moment the token changes. If none
  // has landed yet, stay armed so the first one that does becomes the reference.
  // The initial token value is not a calibration request.
  const seenTokenRef = useRef(calibrateToken);
  useEffect(() => {
    if (seenTokenRef.current === calibrateToken) return;
    seenTokenRef.current = calibrateToken;
    if (calibrationReference) referenceRef.current = calibrate(calibrationReference);
    pendingCalibrationRef.current = !calibrationReference;
    // Re-derive from the new reference rather than easing out of a pose that no
    // longer means anything.
    smoothedRef.current = null;
    sliceFollowUntilRef.current = 0;
  }, [calibrateToken, calibrationReference]);

  // ── Mount: lazy-load the shared embed lifecycle (which pulls in three + the
  //    /sim engine), then drive the cube's own transform every frame. ──
  useEffect(() => {
    let cancelled = false;
    let mount: SimMount | null = null;
    setReady(false);
    setFailed(false);
    appliedRef.current = null;
    shownRef.current = { turns: '', pose: '' };
    hasShownRef.current = false;

    void (async () => {
      const { mountSimWorld } = await import('@cuberoot/puzzle-render-core/sim/mountSimWorld');
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;
      gyroViewActiveRef.current = hasValidOrientation(externalQuatRef.current?.current ?? rawRef.current);

      let cachedInput: { raw: Quat; reference: Quat | null; basis: SensorBasisName;
        mirror: boolean; frame: Quat; target: Quat } | null = null;

      const nextMount = mountSimWorld({
        host,
        puzzle: 3,
        interactive: allowViewDrag,
        faceHints: false,
        pixelRatioCap: 2,
        preserveDrawingBuffer: !realtime,
        sceneRot: sceneRotation(viewRef.current, gyroViewActiveRef.current),
        onFrame: (world: World, dtMs: number): boolean => {
          const raw = externalQuatRef.current?.current ?? rawRef.current;
          if (!hasValidOrientation(raw)) return false;
          let cameraChanged = false;
          if (!gyroViewActiveRef.current) {
            gyroViewActiveRef.current = true;
            if (viewRef.current === 'smart') {
              const rot = sceneRotation('smart', true);
              world.scene.rotation.set(rot.x, rot.y, rot.z);
              world.scene.updateMatrix();
              cameraChanged = true;
            }
          }
          if (pendingCalibrationRef.current) {
            referenceRef.current = calibrate(raw);
            pendingCalibrationRef.current = false;
          }
          // Match DCTimer-BLE: always follow the latest measured pose and use
          // SLERP only to bridge the gaps between BLE samples. Snapping gradual
          // motion to a whole orientation makes the live cube feel stuck.
          // The child model already contains O. Applying Q directly produces
          // Q·O and reverses X/Y under z2. Use O·Q·O⁻¹ so the result is O·Q.
          const frame = gyroFrameRef.current;
          if (!cachedInput || cachedInput.raw.w !== raw.w || cachedInput.raw.x !== raw.x
            || cachedInput.raw.y !== raw.y || cachedInput.raw.z !== raw.z
            || cachedInput.reference !== referenceRef.current || cachedInput.basis !== basisRef.current
            || cachedInput.mirror !== mirrorRef.current || cachedInput.frame !== frame) {
            const measured = applyOrientation(raw, referenceRef.current, {
              basis: basisRef.current, mirror: mirrorRef.current,
            });
            cachedInput = { raw: { ...raw }, reference: referenceRef.current, basis: basisRef.current,
              mirror: mirrorRef.current, frame,
              target: quatMul(quatMul(frame, measured), quatConjugate(frame)) };
          }
          const target = cachedInput.target;
          // BLE lands at 20-50 Hz, under the 60 fps loop — ease between samples
          // so the cube glides instead of stepping. A slice turn is the one
          // exception that moves the sensor-bearing core itself; keep SLERP but
          // let that large jump finish alongside its layer animation.
          const orientationTauMs = performance.now() < sliceFollowUntilRef.current
            ? SLICE_ORIENTATION_TAU_MS
            : undefined;
          const next = smoothedRef.current
            ? slerpTowards(smoothedRef.current, target, dtMs, orientationTauMs)
            : target;
          smoothedRef.current = next;
          const prev = appliedRef.current;
          if (prev && quatAngleTo(prev, next) <= STILL_EPS_RAD) return cameraChanged;
          appliedRef.current = next;
          // three is x,y,z,w; our wire/math order is w-first.
          world.cube.quaternion.set(next.x, next.y, next.z, next.w);
          // cube.matrixAutoUpdate is false throughout the engine — without this
          // the write is invisible.
          world.cube.updateMatrix();
          return true;
        },
      });
      if (allowViewDrag) {
        const controller = nextMount.world.controller;
        controller.turnsLocked = true;
        controller.dragEmpty = 'view';
        controller.onOrbit = (dx, dy) => orbitScene(nextMount.world, dx, dy, ORBIT_K);
        let savedView: { x: number; y: number; z: number } | null = null;
        const detachPointerController = attachPointerController(host, controller, resetViewOnRelease ? {
          start() {
            const { x, y, z } = nextMount.world.scene.rotation;
            savedView = { x, y, z };
          },
          end() {
            if (!savedView) return;
            nextMount.world.scene.rotation.set(savedView.x, savedView.y, savedView.z);
            nextMount.world.scene.updateMatrix();
            nextMount.invalidate();
            savedView = null;
          },
        } : undefined);
        const originalDispose = nextMount.dispose;
        nextMount.dispose = () => {
          detachPointerController();
          originalDispose();
        };
      }
      mount = nextMount;
      mountRef.current = mount;
      setReady(true);
      onReadyRef.current?.();
      if (cancelled) {
        mount.dispose();
        mount = null;
        mountRef.current = null;
      }
    })().catch(() => {
      mount?.dispose();
      mount = null;
      if (cancelled) return;
      mountRef.current = null;
      setReady(false);
      setFailed(true);
    });

    return () => {
      cancelled = true;
      mount?.dispose();
      mountRef.current = null;
    };
  }, [allowViewDrag, resetViewOnRelease, attempt, realtime]);

  // Update the viewing angle without remounting the cube or altering its moves.
  useEffect(() => {
    viewRef.current = view;
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    const rot = sceneRotation(view, gyroViewActiveRef.current);
    world.scene.rotation.set(rot.x, rot.y, rot.z);
    world.scene.updateMatrix();
    mountRef.current?.invalidate();
  }, [ready, view]);

  // ── /sim stage mask. ──
  // Keep the visualcube bridge out of the ordinary live-cube bundle: most
  // callers show every sticker, so only stage-aware embeds pay for the mask.
  useEffect(() => {
    const mount = mountRef.current;
    const world = mount?.world;
    if (!ready || !mount || !world) return;
    let cancelled = false;

    if (!stickering || stickering === 'full') {
      (world.cube as NxnCube).instancedRenderer.setStickering(null);
      mount.invalidate();
      return;
    }

    void Promise.all([
      import('@cuberoot/puzzle-render-core/engine/nxn/stickering'),
      import('@cuberoot/puzzle-render-core/engine/nxn/vcStageMask'),
    ]).then(([engine, visualcube]) => {
      if (cancelled || mountRef.current !== mount) return;
      const cube = world.cube as NxnCube;
      const mask = engine.stickeringMaskFn(cube.order, stickering, stickeringOrientation)
        ?? visualcube.resolveStageMaskFn(cube.order, stickering, stickeringOrientation);
      cube.instancedRenderer.setStickering(mask);
      mount.invalidate();
    }).catch(() => {
      if (cancelled || mountRef.current !== mount) return;
      mount.dispose();
      mountRef.current = null;
      setReady(false);
      setFailed(true);
    });

    return () => { cancelled = true; };
  }, [ready, stickering, stickeringOrientation]);

  // ── Sticker state. ──
  //
  // Which engine entry point, and what exactly to hand it, is `planSimUpdate`'s
  // call — turns and pose are two axes and the plan is pure algebra over them.
  // Read _lib/cube/sim_log.ts; there is nothing to decide here.
  //
  // Prop-driven callers retain the canonical log planner, with a millisecond
  // budget in live mode. Timestamped physical subscriptions take the path below.
  const turns = useMemo(() => liveSource && realtime ? '' : moves.join(' '), [moves, liveSource, realtime]);
  const shownRef = useRef({ turns: '', pose: '' });
  const hasShownRef = useRef(false);
  useEffect(() => {
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    if (liveSource && realtime) return;
    const twister = (world.cube as NxnCube).twister;
    const next = { turns, pose };
    const durationMs = cadenceRef.current.durationMs(undefined, performance.now());
    const durationTicks = durationMs * LIVE_TICKS_PER_MS;
    if (realtime) twister.accelerateRealtime(durationTicks);
    if (!realtime || turns === '') {
      sliceFollowUntilRef.current = 0;
    } else if (hasShownRef.current && appendedSlicePair(shownRef.current.turns, turns)) {
      sliceFollowUntilRef.current = performance.now() + SLICE_ORIENTATION_FOLLOW_MS;
    }
    const plan = realtime
      ? planLiveSimUpdate(shownRef.current, next, animate, twister.backlog, hasShownRef.current,
        { remainingMs: twister.remainingTicks / LIVE_TICKS_PER_MS, durationMs })
      : planSimUpdate(shownRef.current, next, animate);
    shownRef.current = { turns, pose };
    hasShownRef.current = true;
    if (plan.mode === 'push') {
      twister.push(
        plan.exp,
        false,
        1,
        realtime
          ? durationTicks
          : moveDurationTicks,
        realtime ? 'linear' : 'ease-out',
      );
    } else if (plan.mode === 'catch-up') {
      twister.catchUpRealtime(plan.exp, plan.fallbackExp, durationTicks, 'linear');
    } else {
      twister.setup(plan.exp);
    }
    mountRef.current?.invalidate();
  }, [ready, turns, pose, animate, realtime, liveSource]);

  // Physical commands arrive here before the parent React commit. A resync uses
  // a verified complete anchor; ordinary turns never reparse the whole history.
  useEffect(() => {
    const mount = mountRef.current;
    if (!ready || !mount || !realtime || !liveSource) return;
    const twister = (mount.world.cube as NxnCube).twister;
    let verified = false;
    let previousMove = '';
    const oriented = (exp: string): string => gyroOrientation
      ? normalizeWcaScramble(`${invertAlg(gyroOrientation)} ${exp}`) ?? exp : exp;
    const fullExpression = (event: LiveSmartCubeDisplayEvent): string =>
      `${gyroOrientation} ${oriented(event.snapshot.moves.join(' '))} ${pose}`.trim();
    const apply = (event: LiveSmartCubeDisplayEvent): void => {
      if (!event.snapshot.algAnchored) { verified = false; return; }
      if (!verified || !event.move || !animate || pose) {
        twister.setup(fullExpression(event));
        cadenceRef.current.reset();
        previousMove = '';
        sliceFollowUntilRef.current = 0;
      } else {
        const now = performance.now();
        if (appendedSlicePair(previousMove, `${previousMove} ${event.move}`.trim())) {
          sliceFollowUntilRef.current = now + SLICE_ORIENTATION_FOLLOW_MS;
        }
        previousMove = event.move;
        const durationMs = cadenceRef.current.durationMs(event.timestamp, now);
        const ticks = durationMs * LIVE_TICKS_PER_MS;
        twister.accelerateRealtime(ticks);
        const exp = oriented(event.move);
        const count = exp.split(/\s+/).filter(Boolean).length;
        const ageMs = event.timestamp === undefined ? 0 : Math.max(0, now - event.timestamp);
        if (ageMs > LIVE_VISUAL_BUDGET_MS || liveSimNeedsCatchUp(twister.remainingTicks / LIVE_TICKS_PER_MS, count, durationMs)) {
          twister.catchUpRealtime(exp, fullExpression(event), ticks, 'linear');
        } else {
          twister.push(exp, false, 1, ticks, 'linear');
        }
      }
      verified = true;
      mount.invalidate();
    };
    apply({ snapshot: liveSource.getSnapshot() });
    return liveSource.subscribe(apply);
  }, [ready, liveSource, realtime, gyroOrientation, pose, animate]);

  return (
    <div
      ref={hostRef}
      className={className}
      role={failed ? undefined : 'img'}
      aria-label={failed ? undefined : ariaLabel ?? tr({ en: 'Live 3D smart-cube state', zh: '智能魔方实时三维状态' })}
      style={failed ? { display: 'grid', placeContent: 'center', textAlign: 'center', lineHeight: 1.5 } : undefined}
    >
      {failed && <>
        <p role="status">{tr({ en: 'Could not load the 3D view.', zh: '三维视图加载失败。' })}</p>
        <button type="button" className="live-cube-calibrate" onClick={() => setAttempt((value) => value + 1)}>
          {tr({ en: 'Retry', zh: '重试' })}
        </button>
      </>}
    </div>
  );
}
