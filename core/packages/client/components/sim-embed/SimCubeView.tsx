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
 *   - It does not attach the /sim pointer Controller. A gyro view is driven by
 *     the physical cube; a drag handler would fight it for the same transform.
 *   - It does not put orientation on `world.scene.rotation`. That is the orbit
 *     channel, and the lights live under the scene — rotating it would drag the
 *     lighting around with the cube and kill every shading cue that makes the
 *     rotation readable. `scene.rotation` keeps the engine's fixed iso viewer
 *     tilt; the lights stay put; only the cube turns.
 *
 * Frame budget: this renders on the timing surface while the user is timing, so
 * a cube sitting still on the table must not burn 60 fps of GPU. The frame hook
 * marks the world dirty only when the smoothed quaternion actually moved past
 * ~1e-4 rad; a resting cube settles and the loop goes quiet within a few frames.
 *
 * Size comes from the host box, which `mountSimWorld` measures with a
 * ResizeObserver — see `.timer-live-cube-3d` in timer.css.
 *
 * The orientation math (calibration / sensor basis / mirror / smoothing) is
 * pure and lives in ../_lib/bluetooth/orientation.ts — read its header before
 * touching any of these props.
 */

import { useEffect, useRef, useState, type JSX } from 'react';

import { tr } from '@/i18n/tr';
import type World from '@/app/[lang]/sim/engine/world';
import type NxnCube from '@/app/[lang]/sim/engine/nxn/cube';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import { FRONT_SCENE_ROT, homeSceneRot } from '@/app/[lang]/sim/engine/viewControls';
import { planSimUpdate } from '@/app/[lang]/timer/_lib/cube/sim_log';
import {
  advanceStillMs,
  applyOrientation,
  calibrate,
  quatAngleTo,
  slerpTowards,
  snapWhenSettled,
  type Quat,
  type SensorBasisName,
} from '@/app/[lang]/timer/_lib/bluetooth/orientation';

/** Below this the pose is "unchanged" and we skip the render entirely. */
const STILL_EPS_RAD = 1e-4;

/** Turns allowed to be mid-flight before the next one snaps what is playing.
 *  Two is enough to keep a fast solve looking continuous and short enough that
 *  the mirror is never meaningfully behind the cube in the user's hands. */
const MAX_ANIM_QUEUE = 2;

export interface SimCubeViewProps {
  /** Moves since the cube was last known SOLVED — see the note above. */
  moves: string[];
  /**
   * A whole-cube rotation appended to the log for VIEWING only — the replay
   * uses it to put the cross face down without renaming (and recolouring) the
   * moves. It is a pose, not a turn, so it is passed separately: fold it into
   * `moves` and every new move lands BEFORE it, which is not an append and
   * costs you the animation. See _lib/cube/sim_log.ts.
   */
  pose?: string;
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
  /** Per-brand sensor axis remap. See orientation.ts — all brands currently
   *  default to 'identity' because we have verified none of them. */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix). Calibration cannot do
   *  this — see orientation.ts. */
  mirror?: boolean;
  /**
   * Play the turns instead of snapping to the new state.
   *
   * Only ever applies to a pure APPEND on the TURN log — anything else (a seek,
   * a rewind, a re-anchor, a changed `pose`) still snaps, because there is no
   * honest animation for "the state jumped". And an append longer than
   * `MAX_ANIM_QUEUE` finishes what is playing first: the point of the animation
   * is to make one turn readable, not to let the screen fall behind the hands.
   */
  animate?: boolean;
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
  view?: 'iso' | 'front';
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
    moves,
    pose = '',
    quat,
    quatRef,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
    animate = false,
    view = 'iso',
    onReady,
    ariaLabel,
    className = 'timer-live-cube-3d',
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<SimMount | null>(null);
  const [ready, setReady] = useState(false);

  // ── Live values the rAF hook reads. Refs, not state: the frame loop must not
  //    re-subscribe (and the component must not re-render) per BLE sample. ──
  const rawRef = useRef<Quat | null>(null);
  const referenceRef = useRef<Quat | null>(null);
  const smoothedRef = useRef<Quat | null>(null);
  const appliedRef = useRef<Quat | null>(null);
  // Settling: the last measured (un-smoothed, un-snapped) pose and how long it
  // has held still. See the snap block in orientation.ts.
  const measuredRef = useRef<Quat | null>(null);
  const stillMsRef = useRef(0);
  const pendingCalibrationRef = useRef(false);
  /** 挂载时读一次(避免先按等轴画一帧);之后的改动走下面的 effect。 */
  const viewRef = useRef(view);
  const basisRef = useRef<SensorBasisName>(sensorBasis);
  const mirrorRef = useRef(mirror);
  const onReadyRef = useRef(onReady);
  // A ref to the caller's ref — the mount effect runs once, so it must not
  // close over whichever box happened to be passed on the first render.
  const externalQuatRef = useRef(quatRef);

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
  });

  // Calibration: capture the live sample the moment the token changes. If none
  // has landed yet, stay armed so the first one that does becomes the reference.
  // The initial token value is not a calibration request.
  const seenTokenRef = useRef(calibrateToken);
  useEffect(() => {
    if (seenTokenRef.current === calibrateToken) return;
    seenTokenRef.current = calibrateToken;
    pendingCalibrationRef.current = true;
    // Re-derive from the new reference rather than easing out of a pose that no
    // longer means anything. The settle timer restarts with it: stillness
    // measured against the OLD reference says nothing about the new one.
    smoothedRef.current = null;
    measuredRef.current = null;
    stillMsRef.current = 0;
  }, [calibrateToken]);

  // ── Mount: lazy-load the shared embed lifecycle (which pulls in three + the
  //    /sim engine), then drive the cube's own transform every frame. ──
  useEffect(() => {
    let cancelled = false;
    let mount: SimMount | null = null;

    void (async () => {
      const { mountSimWorld } = await import('@/components/sim-embed/mountSimWorld');
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      mount = mountSimWorld({
        host,
        puzzle: 3,
        interactive: false, // gyro-driven: a pointer Controller would fight it
        faceHints: false,
        pixelRatioCap: 2,
        // 'iso' 就是引擎构造函数摆好的姿势,不用再写一遍。
        sceneRot: viewRef.current === 'front' ? FRONT_SCENE_ROT : undefined,
        onFrame: (world: World, dtMs: number): boolean => {
          const raw = externalQuatRef.current?.current ?? rawRef.current;
          if (!raw) return false;
          if (pendingCalibrationRef.current) {
            referenceRef.current = calibrate(raw);
            pendingCalibrationRef.current = false;
          }
          const measured = applyOrientation(raw, referenceRef.current, {
            basis: basisRef.current,
            mirror: mirrorRef.current,
          });
          // A cube that has stopped moving near a whole orientation IS at it;
          // the leftover few degrees are grip and sensor zero, and leaving them
          // in is what makes the cube on screen read as permanently crooked.
          // Stillness is measured on the MEASURED pose, never on the smoothed
          // one — the smoothed pose is still converging on the snap target and
          // would keep re-arming the timer against itself.
          stillMsRef.current = advanceStillMs(measuredRef.current, measured, stillMsRef.current, dtMs);
          measuredRef.current = measured;
          const target = snapWhenSettled(measured, stillMsRef.current);
          // BLE lands at 20-50 Hz, under the 60 fps loop — ease between samples
          // so the cube glides instead of stepping.
          const next = smoothedRef.current
            ? slerpTowards(smoothedRef.current, target, dtMs)
            : target;
          smoothedRef.current = next;
          const prev = appliedRef.current;
          if (prev && quatAngleTo(prev, next) <= STILL_EPS_RAD) return false;
          appliedRef.current = next;
          // three is x,y,z,w; our wire/math order is w-first.
          world.cube.quaternion.set(next.x, next.y, next.z, next.w);
          // cube.matrixAutoUpdate is false throughout the engine — without this
          // the write is invisible.
          world.cube.updateMatrix();
          return true;
        },
      });
      mountRef.current = mount;
      setReady(true);
      onReadyRef.current?.();
      if (cancelled) {
        mount.dispose();
        mount = null;
        mountRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      mount?.dispose();
      mountRef.current = null;
    };
  }, []);

  // 挂载后再换视角(调用方切换 iso ↔ front)。挂载时那一次由 sceneRot 摆好。
  useEffect(() => {
    viewRef.current = view;
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    const rot = view === 'front' ? FRONT_SCENE_ROT : homeSceneRot(world.puzzleKind);
    world.scene.rotation.set(rot.x, rot.y, rot.z);
    world.scene.updateMatrix();
    mountRef.current?.invalidate();
  }, [ready, view]);

  // ── Sticker state. ──
  //
  // Which engine entry point, and what exactly to hand it, is `planSimUpdate`'s
  // call — turns and pose are two axes and the plan is pure algebra over them.
  // Read _lib/cube/sim_log.ts; there is nothing to decide here.
  //
  // The queue is capped: fall more than MAX_ANIM_QUEUE behind and the pending
  // turns are finished instantly before the new one is pushed, so the screen
  // can drift a couple of turns behind the hands and no further.
  const turns = moves.join(' ');
  const shownRef = useRef({ turns: '', pose: '' });
  useEffect(() => {
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    const twister = (world.cube as NxnCube).twister;
    const plan = planSimUpdate(shownRef.current, { turns, pose }, animate);
    shownRef.current = { turns, pose };
    if (plan.mode === 'push') {
      if (twister.length > MAX_ANIM_QUEUE) twister.finish();
      twister.push(plan.exp);
    } else {
      twister.setup(plan.exp);
    }
    mountRef.current?.invalidate();
  }, [ready, turns, pose, animate]);

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label={ariaLabel ?? tr({
        zh: '智能魔方实时三维状态（跟随陀螺仪朝向）',
        en: 'Live 3D smart-cube state (follows the gyroscope orientation)',
      })}
    />
  );
}
