import { stripComments, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import Cube from './engine/nxn/cube';
import { getRawCoreBorder, rawMaterial, setRawCoreBorder } from './engine/nxn/rawCore';
import { TwistAction } from './engine/nxn/twister';
import { CUBE_FILL } from './support/cube-colors';
import { renderCubeNetSvg } from './support/cube-net-svg';

const MAX_SCRAMBLE_LENGTH = 16_384;
const MAX_MOVES = 1_024;

/** Validate the whole input before the NxN engine's permissive parser sees it. */
function sphereMoves(scramble: string): string[] | null {
  if (scramble.length > MAX_SCRAMBLE_LENGTH) return null;
  const { moves, junk } = tokenizeMoves(stripComments(scramble).replace(/[‘＇’]/g, "'"));
  if (junk.length || moves.length > MAX_MOVES) return null;
  const tokens: string[] = [];
  for (const move of moves) {
    if (!Number.isSafeInteger(move.amount)) return null;
    if (/^[xyzMESmse]$/.test(move.family)) {
      if (move.layer) return null;
    } else if (/^[RLUDFBrludfb]w?$/.test(move.family)) {
      if (move.layer) {
        const layers = move.layer.split('-').map(Number);
        if (layers.some((layer) => layer < 1 || layer > 3)
          || (layers.length === 2 && layers[0] > layers[1])) return null;
      }
    } else return null;

    // A static image needs only the final physical state. Reducing the amount
    // also bounds work for a valid token with a very large explicit turn count.
    const amount = move.amount % 4;
    if (!amount) continue;
    tokens.push(`${move.layer ?? ''}${move.family}${Math.abs(amount) === 1 ? '' : Math.abs(amount)}${amount < 0 ? "'" : ''}`);
  }
  return tokens;
}

/**
 * Six-face unfolded SVG, using the same layout and colors as the 3x3 preview.
 * Accepts 3x3 face, wide, slice and rotation tokens, plus line comments. Empty
 * input is solved; unsupported notation or malformed tokens return null.
 */
export function renderSphereScrambleSvg(scramble: string): string | null {
  const moves = sphereMoves(scramble);
  if (!moves) return null;
  // NxN raw material and its border uniform are shared with live simulators.
  // The synchronous thumbnail render must leave those peers' settings intact.
  const material = rawMaterial();
  const color = material.color.clone();
  const { opacity, transparent } = material;
  const border = getRawCoreBorder();
  let cube: Cube | undefined;
  try {
    cube = new Cube(3, 'sphere');
    // An independent cube starts solved. Instant turns avoid setup()/reset(),
    // whose global tween completion would interrupt a live simulator peer.
    for (const token of moves) {
      if (!cube.twister.twist(new TwistAction(token), true, false)) return null;
    }

    // Use the actual state so slice, rotation and layer-range notation keeps
    // working; the scramble-only net parser supports a narrower move set.
    return renderCubeNetSvg({ serialized: cube.serialize(), order: 3, faceColors: CUBE_FILL });
  } finally {
    material.color.copy(color);
    material.opacity = opacity;
    material.transparent = transparent;
    setRawCoreBorder(border);
    cube?.dispose();
  }
}
