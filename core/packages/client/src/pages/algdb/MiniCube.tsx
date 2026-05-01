/**
 * Mini cube preview — renders a 3x3 sticker state as compact SVG.
 *
 * Two view modes:
 *   - "f2l": isometric-ish. Top-down view of D face + top rows of 4 side faces
 *     visible (bottom 2 rows of side faces — the F2L slot region). Empty U
 *     layer is shown as gaps so the F2L pair piece "on top" reads clearly.
 *   - "ll":  flat top-down view. U face (3x3) + 4 side strips of 3 (top row of
 *     each adjacent face). Standard OLL/PLL representation.
 *
 * State comes from cube3_sim. Colors use the WCA scheme (white U / yellow D).
 */
import type { CubeState, Face } from '../../utils/cube3_sim';

const FACE_HEX: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FCD314',
  F: '#1FA85A',
  B: '#1B6CD9',
  L: '#FF7A1F',
  R: '#D81C2F',
};

const STROKE = '#222';

interface Props {
  state: CubeState;
  /** "ll" for OLL/PLL (top-down with side strips), "f2l" for F2L (D-down isometric) */
  view: 'll' | 'f2l';
  /** Pixel size — width of the rendered SVG. Height auto-derived. */
  size?: number;
}

function Sq({ x, y, s, fill, opacity = 1 }: { x: number; y: number; s: number; fill: string; opacity?: number }) {
  return <rect x={x} y={y} width={s} height={s} fill={fill} stroke={STROKE} strokeWidth={1} rx={1.5} opacity={opacity} />;
}

/** OLL/PLL preview — U face on top + top row of each side face as a strip. */
function LlView({ state, size }: { state: CubeState; size: number }) {
  const s = size / 7; // each cell ≈ 1/7 of width (3 cells + side strips)
  const pad = 1;
  const u = state.U;
  // Place U face centered. Side strips: ub on top (above U), uf below, ul on left, ur on right.
  // This isn't the cleanest layout but OLL traditional is: top + back/front strips above/below + L/R on sides.
  const W = size;
  const H = size;
  const cx = W / 2 - 1.5 * s;
  const cy = H / 2 - 1.5 * s;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size} aria-hidden="true">
      {/* U face 3x3 */}
      {u.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        return <Sq key={`u-${i}`} x={cx + col * s} y={cy + r * s} s={s - pad} fill={FACE_HEX[c as Face]} />;
      })}
      {/* B strip: top row of B face (state.B[0..2]) above U */}
      {state.B.slice(0, 3).map((c, i) => (
        <Sq key={`b-${i}`} x={cx + (2 - i) * s} y={cy - s} s={s - pad} fill={FACE_HEX[c as Face]} />
      ))}
      {/* F strip: top row of F face below U */}
      {state.F.slice(0, 3).map((c, i) => (
        <Sq key={`f-${i}`} x={cx + i * s} y={cy + 3 * s} s={s - pad} fill={FACE_HEX[c as Face]} />
      ))}
      {/* L strip: top row of L face to the left of U (rotated 90° — appears as a vertical strip) */}
      {state.L.slice(0, 3).map((c, i) => (
        <Sq key={`l-${i}`} x={cx - s} y={cy + (2 - i) * s} s={s - pad} fill={FACE_HEX[c as Face]} />
      ))}
      {/* R strip: top row of R face to the right of U */}
      {state.R.slice(0, 3).map((c, i) => (
        <Sq key={`r-${i}`} x={cx + 3 * s} y={cy + i * s} s={s - pad} fill={FACE_HEX[c as Face]} />
      ))}
    </svg>
  );
}

/**
 * F2L preview — looking down at D face (white-cross/yellow-cross) as a 3x3,
 * with the bottom 2 rows of each side face wrapped around, AND the top row
 * of side faces (where the free pair piece sits) visible faded above.
 *
 * Layout: side faces flattened around D in 4 directions.
 */
function F2lView({ state, size }: { state: CubeState; size: number }) {
  const s = size / 9;
  const pad = 1;
  const W = size;
  const H = size;
  // Center the D face
  const cx = W / 2 - 1.5 * s;
  const cy = H / 2 - 1.5 * s;

  // For F2L: cross is on D (yellow if standard scheme). We show D face (3x3)
  // surrounded by 3-row strips of each adjacent face.
  // F face strip below D: rows 0,1,2 of F (top→bottom is U-side→D-side)
  // — but we want to show the 2 BOTTOM rows of each side face since that's
  // the F2L slot region. Plus 1 top row faded for the pair piece.

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size} aria-hidden="true">
      {/* D face (3x3) — bottom of cube viewed from below means we mirror */}
      {state.D.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        return <Sq key={`d-${i}`} x={cx + col * s} y={cy + r * s} s={s - pad} fill={FACE_HEX[c as Face]} />;
      })}
      {/* F face: 3 rows visible below D (closest to us). F[0..8] row-major. */}
      {state.F.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        // F-bottom (row 2) closest to D-bottom-row, F-top (row 0) faded out
        const opacity = r === 0 ? 0.55 : 1;
        return <Sq key={`f-${i}`} x={cx + col * s} y={cy + 3 * s + (2 - r) * s} s={s - pad} fill={FACE_HEX[c as Face]} opacity={opacity} />;
      })}
      {/* B face: 3 rows visible above D */}
      {state.B.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        // B is mirrored left-right when we look from D's perspective
        const opacity = r === 0 ? 0.55 : 1;
        return <Sq key={`b-${i}`} x={cx + (2 - col) * s} y={cy - (3 - r) * s} s={s - pad} fill={FACE_HEX[c as Face]} opacity={opacity} />;
      })}
      {/* L face: 3 rows visible left of D, rotated 90° */}
      {state.L.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        const opacity = r === 0 ? 0.55 : 1;
        // L's top-row is on top, L is rotated so columns become rows
        return <Sq key={`l-${i}`} x={cx - (3 - r) * s} y={cy + (2 - col) * s} s={s - pad} fill={FACE_HEX[c as Face]} opacity={opacity} />;
      })}
      {/* R face: 3 rows visible right of D */}
      {state.R.map((c, i) => {
        const r = Math.floor(i / 3), col = i % 3;
        const opacity = r === 0 ? 0.55 : 1;
        return <Sq key={`r-${i}`} x={cx + 3 * s + (2 - r) * s} y={cy + col * s} s={s - pad} fill={FACE_HEX[c as Face]} opacity={opacity} />;
      })}
    </svg>
  );
}

export function MiniCube({ state, view, size = 80 }: Props) {
  return view === 'll' ? <LlView state={state} size={size} /> : <F2lView state={state} size={size} />;
}
