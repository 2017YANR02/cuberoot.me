import * as THREE from 'three';
import { stripComments, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { SIZE } from './engine/define';
import Cube from './engine/nxn/cube';
import { getRawCoreBorder, rawMaterial, setRawCoreBorder } from './engine/nxn/rawCore';
import { TwistAction } from './engine/nxn/twister';
import { HOME_SCENE_ROT } from './engine/viewControls';
import type { RenderWorld } from './headless-world';
import { exportSimSvg } from './scene-svg';

const VIEWPORT = 320;
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
 * Square, transparent SVG of the actual 26 sphere cubies, without WebGL or DOM.
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
    material.opacity = 1;
    material.transparent = false;
    // An independent cube starts solved. Instant turns avoid setup()/reset(),
    // whose global tween completion would interrupt a live simulator peer.
    for (const token of moves) {
      if (!cube.twister.twist(new TwistAction(token), true, false)) return null;
    }

    const scene = new THREE.Scene();
    scene.rotation.set(HOME_SCENE_ROT.x, HOME_SCENE_ROT.y, HOME_SCENE_ROT.z);
    scene.add(cube);
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.75));
    const directional = new THREE.DirectionalLight(0xffffff, Math.PI * 0.4);
    directional.position.set(SIZE, SIZE * 3, SIZE * 2);
    scene.add(directional);

    const camera = new THREE.PerspectiveCamera(38, 1, 1, SIZE * 32);
    camera.position.set(0, 0, SIZE * 8.75);
    camera.lookAt(0, 0, 0);
    const world: RenderWorld = { scene, camera, width: VIEWPORT, height: VIEWPORT };
    return exportSimSvg({ world, maxTriangles: 80_000 });
  } finally {
    material.color.copy(color);
    material.opacity = opacity;
    material.transparent = transparent;
    setRawCoreBorder(border);
    cube?.removeFromParent();
    cube?.dispose();
  }
}
