'use client';

/**
 * Clawd PLL Performer — native clawd presents a real 3D cube turning a PLL alg.
 *
 * An enlarged focused modal overlay that renders a real 3x3 with the existing
 * /sim `sim-cuber-three` WebGL engine (app/[lang]/sim/cuber/*), floats the cube
 * in the UPPER part of the stage, and sits clawd's EXACT native body (no arms,
 * no fingers — only its two static pincer nubs, four legs, two eyes) at the
 * bottom-center "presenting" the cube. Plays a chosen PLL case move-by-move and
 * lets the user pick any of the 21 cases. The turning cube is the only motion;
 * clawd only breathes + blinks (native keyframes).
 *
 * Lazy-loads three + the cuber engine on open so first paint / the ~128 SSG
 * pages are untouched. Exactly ONE WebGLRenderer exists while open; disposed on
 * close. Driven purely by `window.dispatchEvent(new CustomEvent('clawd:perform'))`
 * — DeskPet renders this when that fires.
 *
 * Engine gotchas honoured (see .tmp/deskpet-pll-design.md §2):
 *  1. scene.matrixAutoUpdate === false → call scene.updateMatrix() after every
 *     rotation write.
 *  2. NO force during playback — serialize one move at a time, chaining the next
 *     off the world.callbacks completion hook. force=true only for instant setup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
// three is type-only at module scope — the runtime instance is dynamically
// imported inside the open effect so the ~1.2MB three bundle never ships with
// the desk pet island.
import type * as THREE from 'three';
import { Play, Pause, RotateCcw, X } from 'lucide-react';
import { loadAlg, type AlgCase } from '@cuberoot/shared';
import type World from '@/app/[lang]/sim/cuber/world';
import type Cube from '@/app/[lang]/sim/cuber/cube';
import type { TwistAction as TwistActionT } from '@/app/[lang]/sim/cuber/twister';
import {
  tokenizeAlg,
  invertAlg,
  liveEngineFrames,
} from '@/lib/pll-fingertricks';
import './PllPerformerOverlay.css';

type Lang = 'zh' | 'en';

const SPEEDS = [0.5, 1, 1.5] as const;
type Speed = typeof SPEEDS[number];

/** mainAlg = first variant's first entry's plain alg. */
function mainAlgOf(c: AlgCase): string {
  return c.algs?.[0]?.[0]?.alg ?? '';
}

export default function PllPerformerOverlay({
  lang,
  initialCaseName,
  onClose,
}: {
  lang: Lang;
  initialCaseName?: string;
  onClose: () => void;
}) {
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Engine ctor handles, captured once after the dynamic import resolves.
  const twistActionCtorRef = useRef<typeof TwistActionT | null>(null);
  // Sets CubeGroup.frames (global tween length) so the speed chips change tempo.
  const setFramesRef = useRef<((f: number) => void) | null>(null);
  const readyRef = useRef(false);

  const [cases, setCases] = useState<AlgCase[]>([]);
  const [caseIdx, setCaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  // Driver state lives in refs so the rAF/callback chain reads fresh values
  // without re-binding the render loop.
  const playingRef = useRef(false);
  const speedRef = useRef<Speed>(1);
  const movesRef = useRef<string[]>([]);
  const moveIdxRef = useRef(0);
  const loopTimerRef = useRef<number | null>(null);
  // True while twister.setup() runs — its synchronous cube.callback() must NOT
  // be treated as a move completion (would double-start the chain on loop).
  const settingUpRef = useRef(false);
  // Live ref to the selected case for the (one-time) world-init closure.
  const caseRef = useRef<AlgCase | undefined>(undefined);
  // Late-bound driver fns so the world-init closure reaches the latest closures.
  const stepNextRef = useRef<(() => void) | null>(null);
  const finishAndLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const currentCase = cases[caseIdx];
  useEffect(() => { caseRef.current = currentCase; }, [currentCase]);
  // Bump after world init so play controls re-evaluate against a live world.
  const [worldReady, setWorldReady] = useState(0);

  // Load the 21 PLL cases once.
  useEffect(() => {
    let cancelled = false;
    void loadAlg('3x3', 'pll').then((file) => {
      if (cancelled) return;
      const cs = file.cases ?? [];
      setCases(cs);
      if (initialCaseName) {
        const i = cs.findIndex((c) => c.name === initialCaseName);
        if (i >= 0) setCaseIdx(i);
      }
    }).catch(() => { /* offline: dropdown stays empty, stage still renders */ });
    return () => { cancelled = true; };
  }, [initialCaseName]);

  // Apply a case's setup-as-scramble instantly (solved → setup, un-animated),
  // then arm the move list. `force`d setup snaps any in-flight tween (fine — the
  // cube must show the pattern before play).
  const applyCase = useCallback((c: AlgCase | undefined) => {
    const world = worldRef.current;
    const TwistAction = twistActionCtorRef.current;
    if (!world || !TwistAction || !c) return;
    if (loopTimerRef.current != null) { window.clearTimeout(loopTimerRef.current); loopTimerRef.current = null; }

    const main = mainAlgOf(c);
    // Always seed from inverse-of-alg so playing the alg returns to solved by
    // construction (invertAlg doc — case.setup is not a reliable inverse; verified
    // via Playwright that Gc / Ja / Z do NOT end solved from `setup` but all 21 do
    // from inverse-of-alg).
    const scramble = invertAlg(main);
    // twister.setup() resets to solved then applies the whole expression
    // instantly (fast+force semantics internally) — handles rotations too. Its
    // synchronous cube.callback() must not be mistaken for a move completion.
    settingUpRef.current = true;
    (world.cube as Cube).twister.setup(scramble);
    settingUpRef.current = false;

    movesRef.current = tokenizeAlg(main);
    moveIdxRef.current = 0;
    world.dirty = true;
  }, []);

  // ── World init: dynamic-import three + the cuber engine, mount ONE
  //    transparent renderer, set the PLL framing, own render loop. ──────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [THREE, worldMod, twisterMod, groupMod] = await Promise.all([
        import('three'),
        import('@/app/[lang]/sim/cuber/world'),
        import('@/app/[lang]/sim/cuber/twister'),
        import('@/app/[lang]/sim/cuber/group'),
      ]);
      if (cancelled) return;

      const World = worldMod.default;
      const { TwistAction } = twisterMod;
      const CubeGroup = groupMod.default;
      twistActionCtorRef.current = TwistAction;
      setFramesRef.current = (f: number) => { CubeGroup.frames = f; };

      const world = new World();
      world.setPuzzle(3);
      worldRef.current = world;

      const renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, preserveDrawingBuffer: true,
      });
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      rendererRef.current = renderer;

      stage.appendChild(renderer.domElement);
      renderer.domElement.style.outline = 'none';
      renderer.domElement.style.display = 'block';
      // Cube canvas sits in the vertical CENTER of the stage (CSS) so clawd's
      // native body hugs it from behind — eyes peeking above, claws gripping the
      // lower corners in front.
      renderer.domElement.classList.add('pll-perf-cube-canvas');

      // Near-front PLL-recognition framing: U on top, white front, slight
      // viewer-above tilt — NOT the /sim default iso angle. matrixAutoUpdate is
      // false (gotcha #1), so updateMatrix() must follow the rotation writes.
      world.scene.rotation.x = Math.PI / 8;   // tilt down so the U face reads
      world.scene.rotation.y = -Math.PI / 16; // tiny yaw for depth
      world.scene.rotation.z = 0;
      world.scene.updateMatrix();

      // Slightly tighter framing than /sim so the cube fills the stage.
      world.perspective = 4;

      // Cube canvas edge as a fraction of the stage edge. Mirrors the CSS
      // --cube-size custom property (kept in sync so the claws/body math lines
      // up with the rendered canvas). ~52% → prominent but leaves clawd's eyes
      // peeking above and its claws gripping the lower corners.
      const cubeBoxFraction = 0.52;

      const resize = () => {
        const stageEdge = Math.min(stage.clientWidth, stage.clientHeight);
        const w = Math.round(stageEdge * cubeBoxFraction);
        const h = w;
        world.width = w;
        world.height = h;
        world.resize();
        renderer.setSize(w, h, true); // updateStyle=true: canvas is its own ~60% box
        world.dirty = true;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(stage);

      // Move-completion chain: world.callbacks fires on cube.callback() at each
      // move drop. Advance to the next move only when the cube confirms (hands
      // can never outrun the cube). The settingUp guard ignores the synchronous
      // callback fired by twister.setup().
      //
      // CRITICAL: cube.callback() fires from group.drop() *inside* the tweener
      // singleton's update loop (tweener.ts:62 iterates+splices this.tweens).
      // Starting the next move synchronously here pushes a new tween mid-loop
      // and the move is silently dropped (verified). Defer the next step to the
      // next rAF so it runs after the tweener loop unwinds.
      const onMoveDone = () => {
        if (settingUpRef.current) return;
        if (!playingRef.current) return;
        const moves = movesRef.current;
        const i = moveIdxRef.current;
        if (i >= moves.length) {
          requestAnimationFrame(() => finishAndLoopRef.current?.());  // end → hold, loop
          return;
        }
        requestAnimationFrame(() => { if (playingRef.current) stepNextRef.current?.(); });
      };
      world.callbacks.push(onMoveDone);

      readyRef.current = true;
      // Verification handle — lets a Playwright script reach the live world +
      // TwistAction to confirm all 21 cases end solved.
      (window as unknown as { __pllPerf?: object }).__pllPerf = {
        world, TwistAction,
      };
      // Arm the initial / currently-selected case now that the engine exists.
      applyCase(caseRef.current);
      setWorldReady((n) => n + 1);

      let raf = 0;
      const loop = () => {
        if (world.dirty || world.cube.dirty) {
          renderer.clear();
          renderer.render(world.scene, world.camera);
          world.dirty = false;
          world.cube.dirty = false;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer.dispose();
        worldRef.current = null;
        rendererRef.current = null;
        readyRef.current = false;
        delete (window as unknown as { __pllPerf?: object }).__pllPerf;
      };
      if (cancelled) cleanup();
    })();

    return () => {
      cancelled = true;
      if (loopTimerRef.current != null) window.clearTimeout(loopTimerRef.current);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Driver: start one move; let onMoveDone chain the rest. ───────────────
  const startMove = useCallback(() => {
    const world = worldRef.current;
    const TwistAction = twistActionCtorRef.current;
    if (!world || !TwistAction) return;
    const moves = movesRef.current;
    const i = moveIdxRef.current;
    if (i >= moves.length) return;
    const token = moves[i];
    moveIdxRef.current = i + 1;

    // Tempo: CubeGroup.frames is the global tween length. liveEngineFrames(speed)
    // is the SINGLE source of truth driving the per-move tempo. SHOWCASE_FRAMES=42
    // ≈ 0.7s/quarter-turn @ 60Hz so the turning cube is legible (spec §5.8).
    setFramesRef.current?.(liveEngineFrames(speedRef.current));

    const action = new TwistAction(token);
    // NO force during playback (gotcha #2) — one move at a time, animated.
    const ok = (world.cube as Cube).twister.twist(action, false, false);
    if (!ok) {
      // Layer was locked by an in-flight tween — retry on next frame.
      window.setTimeout(() => { moveIdxRef.current = i; startMove(); }, 16);
      return;
    }
  }, []);

  const finishAndLoop = useCallback(() => {
    // Final solve reached — brief hold then re-arm + replay.
    if (loopTimerRef.current != null) window.clearTimeout(loopTimerRef.current);
    loopTimerRef.current = window.setTimeout(() => {
      loopTimerRef.current = null;
      if (!playingRef.current) { setPlaying(false); return; }
      applyCase(caseRef.current);
      // small beat after reset so the pattern is visible before replay
      loopTimerRef.current = window.setTimeout(() => {
        loopTimerRef.current = null;
        if (playingRef.current) startMove();
      }, 350);
    }, 1300);
  }, [applyCase, startMove]);

  useEffect(() => { stepNextRef.current = startMove; }, [startMove]);
  useEffect(() => { finishAndLoopRef.current = finishAndLoop; }, [finishAndLoop]);

  // Autoplay ONCE on open (it's a showcase). We wait until the world is ready and a
  // case is armed, show the static PLL pattern + grip for a short beat, then start the
  // serialized move chain. Subsequent case changes intentionally do NOT autoplay (the
  // case-change effect pauses); the user drives those with Play. The chain itself is
  // serialized on world.callbacks so there is no race (design §2.3 / §5.5).
  const autoplayedRef = useRef(false);
  useEffect(() => {
    if (!worldReady || autoplayedRef.current) return;
    if (!caseRef.current) return; // cases not loaded yet — wait for the next bump
    autoplayedRef.current = true;
    const id = window.setTimeout(() => {
      if (!readyRef.current) return;
      setPlaying(true);
      playingRef.current = true;
      startMove();
    }, 700);
    return () => window.clearTimeout(id);
  }, [worldReady, startMove]);

  // Re-arm whenever the selected case changes (and the engine is ready).
  useEffect(() => {
    if (!readyRef.current) return;
    setPlaying(false);
    playingRef.current = false;
    applyCase(currentCase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIdx, applyCase]);

  const handlePlayPause = useCallback(() => {
    if (!readyRef.current) return;
    setPlaying((p) => {
      const next = !p;
      playingRef.current = next;
      if (next) {
        // If at the end, restart from the armed setup.
        if (moveIdxRef.current >= movesRef.current.length) applyCase(caseRef.current);
        startMove();
      }
      // Pause: cube tween finishes its current move on its own (world.callbacks
      // will see playing=false and not advance).
      return next;
    });
  }, [applyCase, startMove]);

  const handleRestart = useCallback(() => {
    if (!readyRef.current) return;
    setPlaying(false);
    playingRef.current = false;
    if (loopTimerRef.current != null) { window.clearTimeout(loopTimerRef.current); loopTimerRef.current = null; }
    applyCase(caseRef.current);
  }, [applyCase]);

  // Esc to close + cleanup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const main = currentCase ? mainAlgOf(currentCase) : '';

  return (
    <div
      className="pll-perf-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pll-perf-panel">
        <div className="pll-perf-head">
          <h2 className="pll-perf-title">{t('PLL 表演', 'PLL Show')}</h2>
          {currentCase && <span className="pll-perf-badge">{currentCase.name}</span>}
          <button
            type="button"
            className="pll-perf-close"
            onClick={onClose}
            title={t('关闭', 'Close')}
            aria-label={t('关闭', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <select
          className="pll-perf-picker"
          value={caseIdx}
          onChange={(e) => setCaseIdx(Number(e.target.value))}
          aria-label={t('选择 PLL', 'Select PLL')}
        >
          {cases.map((c, i) => (
            <option key={c.id ?? c.name} value={i}>{c.name}</option>
          ))}
        </select>

        {main && <p className="pll-perf-alg">{main}</p>}

        {/* Stage: clawd HOLDS the real cube. Z-order:
              clawd body+face (z0, BEHIND — cube occludes the lower torso)
              → transparent 3D cube canvas (z1, JS-appended, vertically centered)
              → clawd's two native salmon pincer claws (z2, FRONT — gripping the
                cube's lower-left / lower-right corners).
            The cube is the only motion; clawd only breathes + blinks. Tapping
            the stage toggles play/pause (mobile convenience). All key positions
            are CSS custom properties on .pll-perf-stage for fine-tuning. */}
        <div
          className="pll-perf-stage"
          ref={stageRef}
          onClick={(e) => { if (e.target === stageRef.current || (e.target as HTMLElement).tagName === 'CANVAS') handlePlayPause(); }}
        >
          {/* Native clawd body — copied VERBATIM from DeskPet.tsx (same viewBox,
              coords, colors #DE886D / #000, .clawddp-breathe / .clawddp-blink).
              NO arms, NO fingers; just the two static pincer nubs, 4 legs, 2 eyes.
              Sits BEHIND the cube (z0); positioned so the eyes peek above the
              cube's top edge and the legs peek below. */}
          <svg className="pll-perf-clawd" xmlns="http://www.w3.org/2000/svg" viewBox="-15 -25 45 45" aria-hidden>
            <g id="clawddp-shadow"><rect x="3" y="15" width="9" height="1" fill="#000" opacity=".5" /></g>
            <g id="clawddp-legs" fill="#DE886D">
              <rect x="3" y="11" width="1" height="4" /><rect x="5" y="11" width="1" height="4" />
              <rect x="9" y="11" width="1" height="4" /><rect x="11" y="11" width="1" height="4" />
            </g>
            <g id="clawddp-body"><g className="clawddp-breathe">
              <rect x="2" y="6" width="11" height="7" fill="#DE886D" />
              <rect x="0" y="9" width="2" height="2" fill="#DE886D" />
              <rect x="13" y="9" width="2" height="2" fill="#DE886D" />
              <g id="clawddp-eyes" fill="#000"><g className="clawddp-blink">
                <rect x="4" y="8" width="1" height="2" /><rect x="10" y="8" width="1" height="2" />
              </g></g>
            </g></g>
          </svg>

          {/* clawd's TWO native crab claws — salmon #DE886D pixel blocks gripping
              the cube's lower-LEFT and lower-RIGHT front corners, rendered IN
              FRONT of the cube (z2). Each is a blocky pincer (palm block + a top
              prong with a notch) — pixel art, image-rendering pixelated. NO
              fingers, NO arm segments, NO joints: just clawd's own claw blocks.
              Positions/size driven by CSS vars on .pll-perf-stage. */}
          {/* Left claw — base block on the OUTER (left) side, two blocky prongs
              extending inward (right) with a pixel gap between them: a crab
              pincer opening toward the cube corner. */}
          <svg
            className="pll-perf-claw pll-perf-claw-left"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 10 10"
            aria-hidden
          >
            {/* outer base block */}
            <rect x="0" y="2" width="5" height="6" fill="#DE886D" />
            {/* upper prong reaching inward */}
            <rect x="5" y="2" width="4" height="2" fill="#DE886D" />
            {/* lower prong reaching inward (gap between = the pincer mouth) */}
            <rect x="5" y="6" width="4" height="2" fill="#DE886D" />
          </svg>
          {/* Right claw — same geometry as the left; mirrored via CSS scaleX(-1)
              so its pincer mouth faces inward toward the cube corner. */}
          <svg
            className="pll-perf-claw pll-perf-claw-right"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 10 10"
            aria-hidden
          >
            {/* outer base block */}
            <rect x="0" y="2" width="5" height="6" fill="#DE886D" />
            {/* upper prong reaching inward */}
            <rect x="5" y="2" width="4" height="2" fill="#DE886D" />
            {/* lower prong reaching inward (gap between = the pincer mouth) */}
            <rect x="5" y="6" width="4" height="2" fill="#DE886D" />
          </svg>
        </div>

        <div className="pll-perf-controls">
          <button
            type="button"
            className="pll-perf-btn"
            onClick={handlePlayPause}
            title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
            aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            className="pll-perf-btn"
            onClick={handleRestart}
            title={t('重播', 'Restart')}
            aria-label={t('重播', 'Restart')}
          >
            <RotateCcw size={18} />
          </button>
          <div className="pll-perf-speeds" role="group" aria-label={t('速度', 'Speed')}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`pll-perf-chip${speed === s ? ' is-active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
