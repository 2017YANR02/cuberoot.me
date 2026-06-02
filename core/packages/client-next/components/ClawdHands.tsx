'use client';

// Articulated clawd arm/hand overlay for the PLL performer (design sections 3,4,5,8).
//
// Pure SVG, pixel-art clawd palette (#DE886D limb, #000 ink, image-rendering:pixelated).
// Two forward-kinematic arm chains (LEFT + RIGHT), each a nested <g> skeleton with a
// transform-origin at every proximal joint so a parent rotation cascades to children:
//
//   shoulder → elbow → wrist → palm → { thumb, index(2-seg), coupled-fingers F2(2-seg) }
//
// The coupled F2 group holds middle/ring/pinky scaled 1.0 / 0.85 / 0.70 (flexor coupling).
// Every joint <g> has a STABLE id so the imperative setPose handle can write transforms
// with g.setAttribute('transform', …) — NO React re-render per frame (mirrors the proven
// `applyEye` pattern in DeskPet.tsx:363-371).
//
// FINGER RIG (round-2 keystone fix): each finger is a 2-segment chain — a PROXIMAL phalange
// rooted at the palm top, and a DISTAL sub-<g> hinged at the proximal tip. Positive "curl"
// flexes BOTH joints FORWARD over the cube edge (the proximal swings the finger off the palm
// plane, the distal hooks the tip down) so HOME reads as a closed cup gripping a face, NOT a
// splayed peace-sign V. The fingers wrap, they do not fan.
//
// Identity: the clawd body / eyes / legs primitives are reproduced VERBATIM from the
// DeskPet inline idle SVG (DeskPet.tsx:828-840) including the clawddp-breathe / clawddp-blink
// animation classes and shadow rect y=15, so the performer clawd is as "alive" as the idle
// pet. The arms are a NEW additive overlay layer only, rooted at clawd's two torso side-bumps.
//
// LAYERING (the key to "holding the cube"): the component renders TWO SVGs over the same
// stage box. The BODY svg is rendered BEHIND the cube canvas (z-index 0) so the cube
// occludes clawd's torso and reads as "held in front of the chest"; clawd's head/eyes peek
// out just below the cube. The ARMS svg is rendered IN FRONT of the cube canvas (z-index 2)
// so the claws visibly wrap the cube's lower-left / lower-right faces. The caller positions
// the cube canvas at z-index 1 between the two.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { HandPose } from '@/lib/pll-fingertricks';
import { HOME, CH, F2_COUPLING } from '@/lib/pll-fingertricks';

// ─────────────────────────────────────────────────────────────────────────────
// Public ref handle
// ─────────────────────────────────────────────────────────────────────────────

export interface ClawdHandsHandle {
  /** Write both hands' poses imperatively (no React re-render). Pass HOME to rest. */
  setPose: (left: HandPose, right: HandPose) => void;
  /** Snap both hands back to the neutral HOME grip. */
  reset: () => void;
  /**
   * Translate one hand's WRIST group so the fingertip lands on a projected anchor
   * point (viewport→stage coords already converted by the caller). Used by the
   * driver's fingertip-anchoring step (design section 5.6). dx/dy in stage units.
   */
  anchor: (which: 'left' | 'right', dx: number, dy: number) => void;
  /** The arms <svg> element (for sizing / ResizeObserver). */
  readonly svg: SVGSVGElement | null;
}

export interface ClawdHandsProps {
  /** Stage square viewBox edge (stage is square). Default 100 → "0 0 100 100". */
  size?: number;
  /** className for the FRONT (arms) svg. */
  className?: string;
  /** className for the BACK (body) svg. */
  bodyClassName?: string;
  /** Show the clawd body behind the arms (default true). */
  showBody?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry constants (stage coordinate space, 0..size)
//
// The cube (measured live via canvas-alpha bbox in stage units, cubeBoxFraction 0.60)
// now FLOATS ABOVE clawd's head: it spans roughly x ∈ [30, 70], y ∈ [16, 60], center
// ≈ (50, 38). Clawd's body sits in open space BELOW the cube; the arms reach UP-and-IN
// from the two torso side-bumps to GRIP the cube's lower-left / lower-right faces with
// a visible bent-elbow reach. Hands separate L/R — no center overlap.
// ─────────────────────────────────────────────────────────────────────────────

const LIMB = '#DE886D';
const INK = '#000';
const KEYLINE = 0.6; // ink outline thickness (stage units) for legibility over stickers

// Cube anchor reference (stage units), MEASURED live from the rendered canvas bbox at
// cubeBoxFraction 0.60 + translateY(-12%): the 3D cube spans roughly x ∈ [27,73],
// y ∈ [16,68], center ≈ (50, 42), lower-left corner ≈ (29,66), lower-right ≈ (71,66).
// The rig grips those two lower corners from below.
const CUBE = { cx: 50, cy: 42, left: 29, right: 71, bottom: 68 } as const;

// Body block: native 15-wide pixel grid, placed + scaled so the head/eyes sit in open
// space BELOW the cube with ~8 units of breathing room under the cube bottom.
const BODY = {
  scale: 1.95,
  // centered under the cube center.
  get tx() {
    return CUBE.cx - (15 * this.scale) / 2;
  },
  // place the body top (local y=6) ~9 units below the cube bottom (68) → head floats free
  // and the legs land near the stage floor (~96) for a grounded composition.
  get ty() {
    return CUBE.bottom + 9 - 6 * this.scale;
  },
};

// Socket points (stage coords) where each arm roots — clawd's torso side bumps. Pushed
// LATERALLY OUTWARD (beyond the body bumps) so each arm sweeps UP-and-IN to its OWN lower
// corner of the cube (no midline crossing/overlap). Right arm → cube lower-RIGHT, left →
// cube lower-LEFT.
function socket(side: 'left' | 'right') {
  const bx = side === 'right' ? 14 : 1;
  const by = 10;
  // small extra lateral splay so the shoulders sit wider than the torso.
  const splay = side === 'right' ? 3 : -3;
  return { x: BODY.tx + bx * BODY.scale + splay, y: BODY.ty + by * BODY.scale };
}

// Arm segment lengths (stage units). LONGER than round-1: the socket (~y 80) is now ~20
// units below the cube's lower corners (cube floated up), so the arm must bridge a real
// gap with a visible upper-arm + forearm + bent elbow. Chunky thickness so each hand reads
// as a mitt spanning ~1.5 stickers, not a thin noodle.
const SEG = {
  upperArm: 14,
  forearm: 15,
  palm: 8,
  // 2-segment fingers: proximal + distal phalange.
  thumbProx: 4,
  thumbDist: 3.5,
  indexProx: 5,
  indexDist: 4.5,
  fingerProx: 5,
  fingerDist: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Channel → transform mapping (HOME-delta poses arrive already absolute, in degrees)
// ─────────────────────────────────────────────────────────────────────────────

// SVG note: a segment rect is authored pointing DOWN (+y) from its joint at local (0,0).
// rotate(θ) is clockwise for +θ. To make an arm reach UP we rotate the down-pointing
// upper-arm by ~±200° so it points up-and-out; the elbow then bends the forearm back
// toward the cube. Right arm reaches up-LEFT (toward cube), left up-RIGHT — mirror via `s`.
//
// FINGER CURL (the fix): a finger's PROXIMAL <g> points +y off the palm top. The palm top
// faces the cube (the wrist base tilts it in), so rotating the proximal toward the cube
// (sign `-s` so both hands flex inward toward the shared cube) plus a larger DISTAL hook
// makes the tip wrap OVER the cube edge. Curl is split ~45% proximal / ~100% distal so the
// whole finger arcs into a hook instead of fanning sideways as a rigid spoke.
function jointTransforms(pose: HandPose, side: 'left' | 'right') {
  const s = side === 'right' ? 1 : -1;

  // Base resting angles (degrees) that put HOME hands at the cube's lower-side faces.
  // Upper arm points DOWN at 0°. Rotate ~±205° so it points UP-and-OUTWARD (elbow out to
  // the side, away from midline → arms never cross). The elbow then folds the forearm back
  // UP-and-IN so the hand lands on the cube's lower-side face on its OWN side.
  const shoulderBase = s * 210;
  // GENTLER inward elbow fold than round-1 (-76 → -44) so each hand stays on its OWN
  // outer side of the cube (lower-left / lower-right) rather than meeting at center.
  const elbowBase = s * -44;

  const shoulder = shoulderBase + s * pose[CH.shoulderPitch];
  const elbowAngle = elbowBase - s * pose[CH.elbowFlex];

  // wrist: flex = push rotate toward the cube; ulnarDev = sideways flick (amplified for the
  // visible U-flick); pronation = palm roll (visible flip via scaleX squash + rotate).
  const wristBase = s * 22;
  const pron = pose[CH.wristPronation];
  // ulnarDev gain raised 0.4 → 0.85 so the U-flick reads at a glance.
  const wristRot = wristBase + s * (pose[CH.wristFlex] + 0.85 * pose[CH.wristUlnarDev]);
  const ulnar = s * pose[CH.wristUlnarDev];
  // Pronation as a VISIBLE palm flip: deeper scaleX squash (cube-roll look) + bigger rotate.
  const palmSquash = Math.max(0.12, Math.cos((pron * 1.4 * Math.PI) / 180));
  const pronRot = 0.55 * pron * s; // raised 0.25 → 0.55 for a clear roll on F/x/y/z

  // Finger curls: split each curl across proximal + distal joints so the finger HOOKS.
  // Sign `-s`: both hands flex their fingertips toward the shared cube center (inward).
  const idx = pose[CH.indexCurl];
  const fng = pose[CH.fingersCurl];
  const thmb = pose[CH.thumbCurl] + 0.6 * pose[CH.thumbOppose];

  return {
    shoulder,
    elbow: elbowAngle,
    wristRot,
    ulnar,
    palmSquash,
    pronRot,
    thumbProx: -s * (0.45 * thmb),
    thumbDist: -s * (1.0 * thmb),
    indexProx: -s * (0.45 * idx),
    indexDist: -s * (1.0 * idx),
    fingersProx: -s * (0.45 * fng),
    fingersDist: -s * (1.0 * fng),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ClawdHands = forwardRef<ClawdHandsHandle, ClawdHandsProps>(function ClawdHands(
  { size = 100, className, bodyClassName, showBody = true },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  // anchor offsets per hand (set by the driver via .anchor()); composed onto wrist.
  const anchorRef = useRef({ left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } });

  const writePose = (side: 'left' | 'right', pose: HandPose) => {
    const svg = svgRef.current;
    if (!svg) return;
    const j = jointTransforms(pose, side);
    const a = anchorRef.current[side];
    const get = (id: string) => svg.querySelector<SVGGElement>(`#${id}`);

    get(`ch-${side}-shoulder`)?.setAttribute('transform', `rotate(${j.shoulder})`);
    get(`ch-${side}-elbow`)?.setAttribute(
      'transform',
      `translate(0,${SEG.upperArm}) rotate(${j.elbow})`,
    );
    get(`ch-${side}-wrist`)?.setAttribute(
      'transform',
      `translate(${a.dx},${SEG.forearm + a.dy}) rotate(${j.wristRot})`,
    );
    get(`ch-${side}-palm`)?.setAttribute(
      'transform',
      `rotate(${j.ulnar}) scale(${j.palmSquash.toFixed(4)},1) rotate(${j.pronRot.toFixed(3)})`,
    );
    // 2-segment fingers: proximal <g> swings off the palm, distal <g> hooks the tip.
    get(`ch-${side}-thumb`)?.setAttribute('transform', `rotate(${j.thumbProx.toFixed(2)})`);
    get(`ch-${side}-thumb-d`)?.setAttribute('transform', `rotate(${j.thumbDist.toFixed(2)})`);
    get(`ch-${side}-index`)?.setAttribute('transform', `rotate(${j.indexProx.toFixed(2)})`);
    get(`ch-${side}-index-d`)?.setAttribute('transform', `rotate(${j.indexDist.toFixed(2)})`);
    get(`ch-${side}-fingers`)?.setAttribute('transform', `rotate(${j.fingersProx.toFixed(2)})`);
    // coupled F2 distal hooks, scaled per finger (flexor coupling).
    get(`ch-${side}-f2a-d`)?.setAttribute('transform', `rotate(${(j.fingersDist * F2_COUPLING[0]).toFixed(2)})`);
    get(`ch-${side}-f2b-d`)?.setAttribute('transform', `rotate(${(j.fingersDist * F2_COUPLING[1]).toFixed(2)})`);
    get(`ch-${side}-f2c-d`)?.setAttribute('transform', `rotate(${(j.fingersDist * F2_COUPLING[2]).toFixed(2)})`);
  };

  useImperativeHandle(
    ref,
    (): ClawdHandsHandle => ({
      setPose: (left, right) => {
        writePose('left', left);
        writePose('right', right);
      },
      reset: () => {
        anchorRef.current = { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } };
        writePose('left', HOME);
        writePose('right', HOME);
      },
      anchor: (which, dx, dy) => {
        anchorRef.current[which] = { dx, dy };
      },
      get svg() {
        return svgRef.current;
      },
    }),
    [],
  );

  return (
    <>
      {/* BACK layer: clawd body — VERBATIM primitives from DeskPet.tsx:828-840, including
          the clawddp-breathe / clawddp-blink classes + shadow rect y=15 (alive like idle).
          Rendered BEHIND the cube canvas so the cube occludes the torso (held). */}
      {showBody && (
        <svg
          className={bodyClassName}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${size} ${size}`}
          style={{ imageRendering: 'pixelated', pointerEvents: 'none', overflow: 'visible' }}
          aria-hidden
        >
          <defs>
            <style>{`
              .clawdhands-breathe{transform-origin:7.5px 13px;animation:clawdhands-breathe 3.2s infinite ease-in-out;}
              .clawdhands-blink{transform-origin:7.5px 9px;animation:clawdhands-blink 4s infinite ease-in-out;}
              @keyframes clawdhands-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,.98) translate(0,.5px)}}
              @keyframes clawdhands-blink{0%,10%,100%{transform:scaleY(1)}5%{transform:scaleY(.1)}}
            `}</style>
          </defs>
          <g transform={`translate(${BODY.tx},${BODY.ty}) scale(${BODY.scale})`}>
            <g id="clawdhands-shadow">
              <rect x="3" y="15" width="9" height="1" fill={INK} opacity=".5" />
            </g>
            <g id="clawdhands-legs" fill={LIMB}>
              <rect x="3" y="11" width="1" height="4" />
              <rect x="5" y="11" width="1" height="4" />
              <rect x="9" y="11" width="1" height="4" />
              <rect x="11" y="11" width="1" height="4" />
            </g>
            <g id="clawdhands-body">
              <g className="clawdhands-breathe">
                <rect x="2" y="6" width="11" height="7" fill={LIMB} />
                <rect x="0" y="9" width="2" height="2" fill={LIMB} />
                <rect x="13" y="9" width="2" height="2" fill={LIMB} />
                <g id="clawdhands-eyes" fill={INK}>
                  <g className="clawdhands-blink">
                    <rect x="4" y="8" width="1" height="2" />
                    <rect x="10" y="8" width="1" height="2" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>
      )}

      {/* FRONT layer: the two articulated arms, rendered IN FRONT of the cube so the
          claws wrap the cube faces. Rooted at the torso side-bump sockets. A 1px INK
          keyline (stroke) keeps the salmon paws legible over green/orange stickers. */}
      <svg
        ref={svgRef}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${size} ${size}`}
        style={{ imageRendering: 'pixelated', pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden
      >
        <Arm side="right" />
        <Arm side="left" />
      </svg>
    </>
  );
});

export default ClawdHands;

// ─────────────────────────────────────────────────────────────────────────────
// One articulated arm chain. Each joint <g> is authored with its pivot at local (0,0);
// the next segment is pre-translated by the segment length so a parent rotate() pivots
// the whole distal chain about the proximal joint. setPose overwrites these transforms.
//
// Fingers are 2-segment: a PROXIMAL phalange rect with a DISTAL sub-<g> hinged at its tip.
// All limb/finger rects carry an INK stroke keyline for contrast over busy stickers.
// ─────────────────────────────────────────────────────────────────────────────

function Arm({ side }: { side: 'left' | 'right' }) {
  const sk = socket(side);
  const w = 5.4; // limb thickness (chunky pixel-art mitt — spans ~1.5 stickers)
  const fw = 2.6; // finger thickness
  // inner edge of the palm (the side facing the cube) — thumb roots there.
  const innerX = side === 'right' ? -w / 2 - 1 : w / 2 + 1;

  // A 2-segment finger: proximal phalange + distal hooking sub-<g>.
  const Finger = ({
    id,
    x,
    prox,
    dist,
    fwid = fw,
  }: {
    id: string;
    x: number;
    prox: number;
    dist: number;
    fwid?: number;
  }) => (
    <g id={`ch-${side}-${id}`} transform={`translate(${x},0)`}>
      <rect
        x={-fwid / 2}
        y={0}
        width={fwid}
        height={prox}
        rx={0.8}
        fill={LIMB}
        stroke={INK}
        strokeWidth={KEYLINE}
      />
      {/* DISTAL segment, hinged at the proximal tip */}
      <g id={`ch-${side}-${id}-d`} transform={`translate(0,${prox})`}>
        <rect
          x={-fwid / 2}
          y={0}
          width={fwid}
          height={dist}
          rx={0.8}
          fill={LIMB}
          stroke={INK}
          strokeWidth={KEYLINE}
        />
      </g>
    </g>
  );

  return (
    <g id={`ch-${side}-root`} transform={`translate(${sk.x},${sk.y})`}>
      {/* SHOULDER: rotates the whole arm */}
      <g id={`ch-${side}-shoulder`}>
        {/* upper arm segment */}
        <rect x={-w / 2} y={0} width={w} height={SEG.upperArm + 1} rx={1.5} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
        {/* ELBOW: pre-translated to the end of the upper arm */}
        <g id={`ch-${side}-elbow`}>
          <rect x={-w / 2} y={0} width={w} height={SEG.forearm + 1} rx={1.5} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
          {/* WRIST: at end of forearm */}
          <g id={`ch-${side}-wrist`}>
            {/* PALM: pronation squash / ulnar tilt applied here */}
            <g id={`ch-${side}-palm`}>
              {/* palm block (the mitt body) */}
              <rect x={-w / 2 - 1} y={0} width={w + 2} height={SEG.palm} rx={2} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
              {/* THUMB — proximal at palm base inner edge, 2-segment */}
              <g transform={`translate(${innerX},1.5)`}>
                <Finger id="thumb" x={0} prox={SEG.thumbProx} dist={SEG.thumbDist} fwid={fw + 0.6} />
              </g>
              {/* INDEX (F1 — the R/L pusher) + COUPLED F2 group, all at palm top.
                  They sit CLOSE together (small x spread) so curling them flexes the
                  whole hand into a cup over the cube edge — NOT a fanned V. */}
              <g transform={`translate(0,${SEG.palm})`}>
                {/* INDEX — slightly forward (inner) of the F2 group */}
                <Finger id="index" x={side === 'right' ? -1.6 : 1.6} prox={SEG.indexProx} dist={SEG.indexDist} />
                {/* COUPLED F2 (middle/ring/pinky) — proximal shares one curl, distal scaled */}
                <g id={`ch-${side}-fingers`}>
                  <g id={`ch-${side}-f2a`} transform="translate(1.3,0)">
                    <rect x={-fw / 2} y={0} width={fw} height={SEG.fingerProx} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    <g id={`ch-${side}-f2a-d`} transform={`translate(0,${SEG.fingerProx})`}>
                      <rect x={-fw / 2} y={0} width={fw} height={SEG.fingerDist} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    </g>
                  </g>
                  <g id={`ch-${side}-f2b`} transform="translate(3.4,0)">
                    <rect x={-fw / 2} y={0} width={fw * 0.95} height={SEG.fingerProx * 0.92} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    <g id={`ch-${side}-f2b-d`} transform={`translate(0,${SEG.fingerProx * 0.92})`}>
                      <rect x={-fw / 2} y={0} width={fw * 0.95} height={SEG.fingerDist * 0.92} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    </g>
                  </g>
                  <g id={`ch-${side}-f2c`} transform="translate(5.3,0)">
                    <rect x={-fw / 2} y={0} width={fw * 0.85} height={SEG.fingerProx * 0.8} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    <g id={`ch-${side}-f2c-d`} transform={`translate(0,${SEG.fingerProx * 0.8})`}>
                      <rect x={-fw / 2} y={0} width={fw * 0.85} height={SEG.fingerDist * 0.8} rx={0.8} fill={LIMB} stroke={INK} strokeWidth={KEYLINE} />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}
