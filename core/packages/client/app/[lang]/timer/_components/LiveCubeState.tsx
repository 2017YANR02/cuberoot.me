'use client';

/**
 * LiveCubeState — the on-screen mirror of the user's smart cube.
 *
 * Renders the state the cube ITSELF reports, one of three ways:
 *
 *   mode 'net' (default) — the unfolded WCA net. Exact for any state the cube
 *     can be in, and the one you can check face-by-face against your hands.
 *   mode '2d'            — the isometric still: three faces visible, three not.
 *   mode '3d'            — a live 3D cube that turns as you turn (SimCubeView),
 *     posed by the cube's gyroscope when there is one. 3x3 only, and only
 *     while the state is expressible as an alg (see `moves` below).
 *
 * A gyro is NOT required for 3D, and used to be. The two are separate things:
 * the gyro says which way the cube is POINTING, the move log says what STATE it
 * is in, and only the second one is a claim about the cube. Without a pose the
 * view sits in the engine's own iso angle and does not pretend to follow the
 * hands — but it still plays each turn, which is the whole reason to be in 3D
 * while timing and something a flat net cannot do at all.
 *
 * The flat fallback stays for the things that ARE contract: no WebGL on phones,
 * and no 3D at all while the state is not reachable from solved, because that
 * one would be a cube drawing a position nobody verified.
 *
 * SIZE IS THE HOST'S. Every branch fills its container rather than carrying a
 * px number, because this now lives in the timing surface's centre slot — the
 * same box the scramble preview uses, sized by the `--cube-h` token. Two views
 * that swap in one box MUST agree on height or the content below them jumps
 * every time a cube connects. Giving the box one owner is how that is
 * guaranteed; see `.timer-live-cube` in timer.css for the rules this expects.
 *
 * HISTORY — what this component used to do, and why it was wrong: it rendered
 * `scramble + movesSinceTheScrambleChanged`. That is not the cube's state. With
 * a solved cube and no turns it drew the SCRAMBLED cube; once the user actually
 * applied the scramble it drew the scramble twice over. The badge above it read
 * the real tracked facelets, so the two disagreed on screen. Drive this from
 * facelets, never from an alg you reconstructed.
 *
 * The next/dynamic boundary lives HERE rather than in SoloView on purpose:
 * three.js + the /sim engine is a heavy chunk, and this is the single place
 * that knows whether it is actually going to be needed. Callers just pass props.
 */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type JSX } from 'react';

import { Spinner } from '@/components/Spinner/Spinner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import { CUBE_FILL } from '@/lib/cube-colors';
import { renderCubeNetSvg } from '@/lib/cube-net-svg';
import { readDevQuatSource, type Quat, type SensorBasisName } from '../_lib/bluetooth/orientation';

/** three + the /sim engine only load when a 3D view is actually mounted. */
const SimCubeView = dynamic(() => import('./SimCubeView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spinner size={16} label={tr({ zh: '加载中', en: 'Loading' })} />
    </div>
  ),
});

/** Synthetic-sample cadence, ms. ~30 Hz sits in the middle of the 20-50 Hz a
 *  real BLE gyro delivers, so the dev path exercises the same "samples arrive
 *  slower than frames" behaviour the smoothing exists for. */
const DEV_SAMPLE_MS = 33;

/**
 * Dev-only synthetic orientation source.
 *
 * We own no smart cube, so this is how the 3D path gets exercised at all —
 * `window.__cuberootFakeQuat` (a Quat or a `(tMs) => Quat`) is polled at BLE
 * cadence and fed in exactly where a real sample would go. Compiled out of
 * production builds; see orientation.ts for the shape and a usage snippet.
 */
function useSyntheticQuat(enabled: boolean): Quat | null {
  const [q, setQ] = useState<Quat | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (process.env.NODE_ENV === 'production') return;
    const id = setInterval(() => {
      const sample = readDevQuatSource(performance.now());
      if (sample) setQ(sample);
    }, DEV_SAMPLE_MS);
    return () => clearInterval(id);
  }, [enabled]);
  return q;
}

export interface LiveCubeStateProps {
  /**
   * The cube's tracked state as a 54-character facelet string, or null when
   * nothing is being tracked yet. This is the source of truth for the 2D view.
   */
  facelets: string | null;
  /**
   * Moves since the cube was last known to be SOLVED. The 3D view is alg-driven
   * (the /sim engine has no facelet setter), so it can only be shown when the
   * state is reachable from solved by replaying these — which is why the caller
   * anchors the log there rather than at connect time. Empty is fine (solved).
   */
  moves: string[];
  /**
   * False when the state is NOT expressible as `moves` from solved — i.e. the
   * cube was already turned when we started tracking it. The 3D view is
   * suppressed while this holds rather than drawing a state we made up.
   */
  algAnchored: boolean;
  /**
   * '3d'  gyro-driven cube;
   * 'net' the unfolded WCA net — six faces flat, which is what you compare
   *       face-by-face against the cube in your hands (csTimer only has this one);
   * '2d'  the isometric still, where three faces are visible and three are not.
   */
  mode?: '2d' | 'net' | '3d';
  /** Latest orientation sample from the cube, or null when none has arrived. */
  quat?: Quat | null;
  /**
   * Preferred over `quat`: a mutable box the owner writes each BLE sample into.
   * Samples land at 20-50 Hz and only the 3D frame loop reads them, so routing
   * them through props would re-render the whole timer shell for nothing.
   */
  quatRef?: { current: Quat | null };
  /** Bump to capture the current sample as the upright reference. */
  calibrateToken?: number;
  /** Per-brand sensor axis remap — see _lib/bluetooth/orientation.ts. */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix; calibration cannot do it). */
  mirror?: boolean;
  /**
   * Which view actually rendered. A '3d' REQUEST is not a promise: phones, a
   * cube whose gyro has not spoken yet and a state that isn't reachable from
   * solved all fall back to a flat view. The owner needs the answer because it
   * draws the calibrate button, which is meaningless over a flat net — asking
   * for the request instead of the outcome is how that button ended up showing
   * where it does nothing.
   */
  onViewChange?: (view: '2d' | 'net' | '3d') => void;
}

export default function LiveCubeState(props: LiveCubeStateProps): JSX.Element {
  const {
    facelets,
    moves,
    algAnchored,
    mode = 'net',
    quat = null,
    quatRef,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
    onViewChange,
  } = props;

  // No WebGL on phones. A three.js context rendering a cube that turns on every
  // notification, alongside a running timer, is a real cost on a phone GPU and
  // the timer is the thing that must not stutter. The flat net is exact, costs a
  // string of SVG, and is legible at this size — so phones get that instead.
  // This is a downgrade, never a hide: the view owns the centre slot now, so
  // returning nothing here would leave a hole where the scramble preview was.
  const phone = useIsMobile(480);
  const wants3d = mode === '3d' && !phone;
  const devQuat = useSyntheticQuat(wants3d);
  const liveQuat = quat ?? devQuat;

  // The single decision, taken once and reported, so the owner draws the
  // calibrate button against what is on screen rather than what was asked for.
  const view: '2d' | 'net' | '3d' =
    wants3d && algAnchored ? '3d' : mode === '2d' ? '2d' : 'net';
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  // 3D is alg-driven, so it can only run while the state is reachable from
  // solved by replaying `moves`. When it isn't, the flat view takes over — it
  // reads facelets and is always exact.
  if (view === '3d') {
    return (
      <SimCubeView
        moves={moves}
        quat={liveQuat}
        quatRef={quatRef}
        calibrateToken={calibrateToken}
        sensorBasis={sensorBasis}
        mirror={mirror}
        // 拧的时候屏幕上要看得见「转了哪一层」,而不是每一手瞬间变成另一个局面。
        // 只在「新日志是老日志 + 几手」时才播,别的情况(重新锚定 / 回填)照旧瞬切。
        animate
      />
    );
  }

  // Nothing tracked yet: hold the box open rather than collapsing it, so the
  // first facelet snapshot doesn't shove the rest of the column down.
  if (!facelets) return <span style={{ display: 'block', height: '100%' }} />;
  const alt = tr({ zh: '智能魔方当前状态', en: 'Current smart-cube state' });
  // Only an explicit '2d' asks for the isometric still. A '3d' request that got
  // this far is a phone or an un-anchored state, and the flat view it falls back
  // to is the net — the one that shows all six faces.
  if (view === '2d') return <FaceletsCube fd={facelets.toLowerCase()} alt={alt} fill />;
  return <CubeNet facelets={facelets} alt={alt} />;
}

/**
 * The unfolded net, drawn from the same renderer /sim exports and the scramble
 * previews use (`lib/cube-net-svg`), so a face here is byte-for-byte the face
 * the rest of the site draws.
 *
 * Height comes from the host box and the width follows from the viewBox — the
 * net is a wide cross, so matching HEIGHT with the views it swaps against is
 * what keeps the column steady (`.timer-live-cube` in timer.css).
 */
function CubeNet({ facelets, alt }: { facelets: string; alt: string }) {
  const svg = useMemo(
    () => renderCubeNetSvg({ serialized: facelets.toUpperCase(), order: 3, faceColors: CUBE_FILL }),
    [facelets],
  );
  return (
    <span
      role="img"
      aria-label={alt}
      className="timer-live-net"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
