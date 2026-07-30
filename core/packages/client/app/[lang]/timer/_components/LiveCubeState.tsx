'use client';

/**
 * LiveCubeState — corner mirror of the user's smart cube.
 *
 * Renders the state the cube ITSELF reports, one of two ways:
 *
 *   mode '2d' (default) — the tracked facelets, drawn directly. Exact for any
 *     state the cube can be in.
 *   mode '3d'           — a live 3D cube whose orientation follows the cube's
 *     gyroscope (LiveCubeGyroView). 3x3 only, only once a real orientation
 *     sample has arrived, and only while the state is expressible as an alg
 *     (see `moves` below).
 *
 * The 2D fallback is not a nicety, it is the contract: a 3D cube that is not
 * being told which way it is pointing is worse than no 3D cube at all, because
 * it looks alive while being wrong. So we stay flat until the first quaternion
 * lands, and the caller can drop `mode` back to '2d' at any time.
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
const LiveCubeGyroView = dynamic(() => import('./LiveCubeGyroView'), {
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

/** How often to check whether the first `quatRef` sample has landed. Only ever
 *  runs before the 2D→3D switch, so it can afford to be lazy. */
const LATCH_POLL_MS = 250;

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
  /** 2D only: rendered edge in px. */
  size?: number;
  /**
   * '3d'  gyro-driven cube;
   * 'net' the unfolded WCA net — six faces flat, which is what you compare
   *       face-by-face against the cube in your hands (csTimer only has this one);
   * '2d'  the isometric still, where three faces are visible and three are not.
   */
  mode?: '2d' | 'net' | '3d';
  /** 3D only: rendered edge in px. */
  size3d?: number;
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
}

export default function LiveCubeState(props: LiveCubeStateProps): JSX.Element {
  const {
    facelets,
    moves,
    algAnchored,
    size = 96,
    mode = '2d',
    size3d = 140,
    quat = null,
    quatRef,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
  } = props;

  // timer.css hides .timer-live-cube outright below 480px. Mirror that here so
  // the 3D branch is never mounted at all — a display:none host has a zero
  // client box, which would leave a live WebGL context rendering into nothing.
  // Keep this breakpoint in sync with the @media rule in timer.css.
  const hiddenByViewport = useIsMobile(480);
  const wants3d = mode === '3d' && !hiddenByViewport;
  const devQuat = useSyntheticQuat(wants3d);
  const liveQuat = quat ?? devQuat;

  // Latch: once any sample has landed we stay in 3D even across momentary
  // gaps in the feed (the view holds its last pose rather than flickering
  // between renderers).
  const [everOriented, setEverOriented] = useState(false);
  useEffect(() => {
    if (liveQuat && !everOriented) setEverOriented(true);
  }, [liveQuat, everOriented]);

  // `quatRef` deliberately does not re-render on each sample, so nothing would
  // ever trip the latch above. Poll it — slowly, and only until the first
  // sample lands. A cube with no gyro simply never satisfies this and we stay
  // on the net, which is the intended outcome rather than a failure mode.
  useEffect(() => {
    if (!wants3d || everOriented || !quatRef) return;
    if (quatRef.current) { setEverOriented(true); return; }
    const id = setInterval(() => {
      if (quatRef.current) setEverOriented(true);
    }, LATCH_POLL_MS);
    return () => clearInterval(id);
  }, [wants3d, everOriented, quatRef]);

  // 3D is alg-driven, so it can only run while the state is reachable from
  // solved by replaying `moves`. When it isn't, the flat view takes over — it
  // reads facelets and is always exact.
  if (wants3d && everOriented && algAnchored) {
    return (
      <div style={{ width: size3d, height: size3d, lineHeight: 0 }}>
        <LiveCubeGyroView
          moves={moves}
          quat={liveQuat}
          quatRef={quatRef}
          size={size3d}
          calibrateToken={calibrateToken}
          sensorBasis={sensorBasis}
          mirror={mirror}
        />
      </div>
    );
  }

  if (!facelets) return <span style={{ display: 'inline-block', width: size, height: size }} />;
  const alt = tr({ zh: '智能魔方当前状态', en: 'Current smart-cube state' });
  // Only an explicit '2d' asks for the isometric still. A '3d' request that got
  // this far had no orientation to draw with, and the flat view it falls back to
  // is the net — the one that shows all six faces.
  if (mode === '2d') return <FaceletsCube fd={facelets.toLowerCase()} size={size} alt={alt} />;
  return <CubeNet facelets={facelets} size={size} alt={alt} />;
}

/**
 * The unfolded net, drawn from the same renderer /sim exports and the scramble
 * previews use (`lib/cube-net-svg`), so a face here is byte-for-byte the face
 * the rest of the site draws.
 *
 * `size` is the HEIGHT, not the width: the net is a wide cross, and matching the
 * height of the isometric view it replaces keeps the corner plate the same size
 * on screen while making each sticker bigger — which is the entire reason to
 * show a net. Width follows from the viewBox (`.timer-live-net` in timer.css).
 */
function CubeNet({ facelets, size, alt }: { facelets: string; size: number; alt: string }) {
  const svg = useMemo(
    () => renderCubeNetSvg({ serialized: facelets.toUpperCase(), order: 3, faceColors: CUBE_FILL }),
    [facelets],
  );
  return (
    <span
      role="img"
      aria-label={alt}
      className="timer-live-net"
      style={{ height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
