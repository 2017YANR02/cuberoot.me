/** Pyraminx Duo net; state and face outlines are shared with the 3D simulator. */
import { duoApply, duoStickerColor, DUO_FACE_VERTICES } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { DUO_FACE_COLORS, DUO_FACE_HEIGHT as FACE_HEIGHT, DUO_FACE_PATCHES, duoFaceWeights, type DuoPoint2 } from './duo-face';

type Triangle = readonly [DuoPoint2, DuoPoint2, DuoPoint2];

const SIDE = 144;
const PADDING = 3;
const WIDTH = 2 * SIDE + 2 * PADDING;
const HEIGHT = 2 * FACE_HEIGHT * SIDE + 2 * PADDING;

export const DUO_SVG_ASPECT = WIDTH / HEIGHT;

// Each triangle follows DUO_FACE_VERTICES' local A/B/C order. Unfolding around
// front face 3 preserves shared U-L, U-R and L-R edges and all face windings:
// front [U,L,R], left [U,B,L], right [U,R,B], bottom [L,B,R].
const FACES: readonly { face: number; triangle: Triangle }[] = [
  { face: 3, triangle: [[1, 0], [0.5, FACE_HEIGHT], [1.5, FACE_HEIGHT]] },
  { face: 2, triangle: [[1, 0], [0, 0], [0.5, FACE_HEIGHT]] },
  { face: 1, triangle: [[1, 0], [1.5, FACE_HEIGHT], [2, 0]] },
  { face: 0, triangle: [[0.5, FACE_HEIGHT], [1, 2 * FACE_HEIGHT], [1.5, FACE_HEIGHT]] },
];

function fmt(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** Map normalized A=(.5,0), B=(0,√3/2), C=(1,√3/2) onto a net face. */
function mapPoint(point: DuoPoint2, [a, b, c]: Triangle): string {
  const [wa, wb, wc] = duoFaceWeights(point);
  return `${fmt(PADDING + SIDE * (wa * a[0] + wb * b[0] + wc * c[0]))},${fmt(PADDING + SIDE * (wa * a[1] + wb * b[1] + wc * c[1]))}`;
}

/** Empty notation draws solved. Invalid notation throws, so callers never show a fake state. */
export function renderPyraminxDuoSvg(scramble: string): string {
  const state = duoApply(scramble);
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${fmt(HEIGHT)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];
  for (const { face, triangle } of FACES) {
    for (const patch of DUO_FACE_PATCHES) {
      const corner = patch.vertex === null ? null : DUO_FACE_VERTICES[face][patch.vertex];
      const fill = DUO_FACE_COLORS[duoStickerColor(state, face, corner)];
      const path = patch.polygon.map((point, index) => `${index === 0 ? 'M' : 'L'}${mapPoint(point, triangle)}`).join(' ');
      out.push(`<path data-face="${face}" data-corner="${corner ?? 'center'}" d="${path} Z" fill="${fill}" stroke="#000" stroke-width="1.5" stroke-linejoin="round" />`);
    }
  }
  out.push('</svg>');
  return out.join('');
}
