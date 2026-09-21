import './_raf_stub';
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import { GHOST_CELLS, GHOST_SCALE } from '@cuberoot/puzzle-render-core/engine/ghost/ghostModel';
import {
  GHOST_ALIGN, GHOST_UNALIGN, GHOST_FACES, applyGhostMove, ghostAlignmentMoves,
  ghostDragMove, ghostMoveFrame, ghostMovesToString, ghostSelection, ghostSequenceValid,
  invertGhostMoves, parseGhostMoves, reduceGhostAlg, solvedGhostPose,
} from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import { applyAnimFrame } from '@cuberoot/puzzle-render-core/engine/pieceAnim';
import { exportSimSvgSchematic } from '@/app/[lang]/sim/sim_svg_export_schematic';
import { ghostPickHit, ghostResolveLive } from '@/app/[lang]/sim/engine/ghost/ghostDrag';
import { applyEngineBodyOverlay, HOLLOW_MAT } from '@/app/[lang]/sim/engine/debugColors';
import { applyHintFacelets } from '@/app/[lang]/sim/engine/hintFacelets';
import { CornerTurnGesture, type CornerGestureCtx } from '@/app/[lang]/sim/engine/cornerTurnGesture';

// Independent source-frame reconstruction: pairwise line intersections, not the
// production Sutherland-Hodgman clipper or its transformed planes/facet bases.
const B = [
  [0.7986354924797165, 0.6018150464650089, 1.5009330714450797e-9],
  [-0.3804722704578621, 0.504903723683713, 0.7747987359456397],
  [0.4662855365163283, -0.618781770625671, 0.6322079711432301],
];
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const area = (p: number[][]) => Math.abs(p.reduce((s, a, i) => {
  const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0];
}, 0)) / 2;
function sourceSticker(slot: readonly number[], face: number): THREE.Vector3[] {
  const axis = Math.floor(face / 2), sign = face % 2 ? 1 : -1;
  const dims = [0, 1, 2].filter(i => i !== axis), angle = [87, 52, 23][slot[1] + 1] * Math.PI / 180;
  const axes = [[Math.cos(angle), 0, Math.sin(angle)], [0, 1, 0], [-Math.sin(angle), 0, Math.cos(angle)]];
  const lines = [0, 1].flatMap(i => [-1, 1].map(s => ({ n: [i === 0 ? s : 0, i === 1 ? s : 0], d: 28.5 })));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    if (slot[i] === s) continue;
    const n = axes[i].map(v => v * s), projected = dims.map(j => dot(n, B[j]));
    lines.push({ n: projected, d: (slot[i] ? -9.5 : 9.5) - sign * 29 * dot(n, B[axis]) - 1 - 0.5 * Math.hypot(...projected) });
  }
  const points: number[][] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j], det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
    if (Math.abs(det) < 1e-10) continue;
    const p = [(a.d * b.n[1] - a.n[1] * b.d) / det, (a.n[0] * b.d - a.d * b.n[0]) / det];
    if (lines.every(l => dot(l.n, p) <= l.d + 1e-8) && !points.some(q => Math.hypot(...p.map((v, k) => v - q[k])) < 1e-8)) points.push(p);
  }
  if (points.length < 3) return [];
  const angle52 = 52 * Math.PI / 180;
  return points.map(p => {
    const src = B[axis].map((v, k) => sign * 29 * v + p[0] * B[dims[0]][k] + p[1] * B[dims[1]][k]);
    return new THREE.Vector3(src[0] * Math.cos(angle52) + src[2] * Math.sin(angle52), src[1],
      -src[0] * Math.sin(angle52) + src[2] * Math.cos(angle52)).multiplyScalar(GHOST_SCALE);
  });
}

const cube = new GhostCube();
afterAll(() => cube.dispose());
const setup = (text = '') => { cube.twister.setup(text); return cube; };

describe('Ghost original geometry', () => {
  it('locks all 27 cells, 59 facets and 55 source stickers, not an approximate 3x3 grid', () => {
    expect(GHOST_CELLS.length).toBe(27);
    expect(GHOST_CELLS.filter(c => c.facets.length).length).toBe(26);
    expect(GHOST_CELLS.flatMap(c => c.facets).length).toBe(59);
    const stickers = GHOST_CELLS.flatMap(c => c.facets).filter(f => f.sticker.length);
    expect(stickers.length).toBe(55);
    expect(Array.from({ length: 6 }, (_, face) => stickers.filter(f => f.face === face).length)).toEqual([10, 9, 10, 8, 9, 9]);
    let matched = 0;
    for (const cell of GHOST_CELLS) for (let face = 0; face < 6; face++) {
      const expected = sourceSticker(cell.slot, face);
      const f = cell.facets.find(facet => facet.face === face);
      const actual = f?.sticker.map(([u, v]) => f.origin.clone().addScaledVector(f.u, u).addScaledVector(f.v, v)) ?? [];
      expect(actual.length).toBe(expected.length);
      for (const p of expected) expect(Math.min(...actual.map(q => p.distanceTo(q))) / GHOST_SCALE).toBeLessThan(1e-8);
      if (actual.length) matched++;
    }
    expect(matched).toBe(55);
    expect(Math.min(...stickers.map(f => area(f.sticker) / GHOST_SCALE ** 2))).toBeCloseTo(1.52133631597, 10);
  });
  it('partitions exactly the 58 mm shell and keeps every displayed body inside its ideal cell', () => {
    let volume = 0;
    const coverage = Array<number>(6).fill(0);
    for (const [i, cell] of GHOST_CELLS.entries()) {
      const geo = new ConvexGeometry(cell.vertices.map(v => v.clone().divideScalar(GHOST_SCALE)));
      const p = geo.getAttribute('position');
      for (let k = 0; k < p.count; k += 3) volume += new THREE.Vector3().fromBufferAttribute(p, k).dot(
        new THREE.Vector3().fromBufferAttribute(p, k + 1).cross(new THREE.Vector3().fromBufferAttribute(p, k + 2))) / 6;
      geo.dispose();
      for (const f of cell.facets) coverage[f.face] += area(f.raw) / GHOST_SCALE ** 2;
      const body = cube.pieces[i].pivot.children[0] as THREE.Mesh;
      const verts = body.geometry.getAttribute('position');
      let excess = -Infinity;
      for (let k = 0; k < verts.count; k++) for (const plane of cell.planes) {
        excess = Math.max(excess, new THREE.Vector3().fromBufferAttribute(verts, k).dot(new THREE.Vector3(...plane.n)) - plane.d);
      }
      expect(excess).toBeLessThan(1e-4);
    }
    expect(volume).toBeCloseTo(195112, 1); // Three stores hull coordinates as float32.
    coverage.forEach(a => expect(a).toBeCloseTo(3364, 6));
  });
  it('has solid bodies, thick stickers, outward schematic polygons and a single core', () => {
    const roles: Record<string, number> = {};
    cube.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      const role = obj.userData.simRole;
      roles[role] = (roles[role] ?? 0) + 1;
      const pos = obj.geometry.getAttribute('position');
      expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
      if (role !== 'sticker') return;
      const outline: number[][] = obj.geometry.userData.simStickerOutline.pts;
      for (let i = 0; i < outline.length; i++) {
        const a = new THREE.Vector2().fromArray(outline[(i + outline.length - 1) % outline.length]);
        const b = new THREE.Vector2().fromArray(outline[i]);
        const c = new THREE.Vector2().fromArray(outline[(i + 1) % outline.length]);
        const incoming = b.clone().sub(a).normalize(), outgoing = c.sub(b).normalize();
        expect(THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing), -1, 1)))).toBeLessThan(50);
      }
      const poly: number[] = obj.userData.schematicPoly;
      const a = new THREE.Vector3().fromArray(poly, 0), b = new THREE.Vector3().fromArray(poly, 3), c = new THREE.Vector3().fromArray(poly, 6);
      const n: THREE.Vector3 = obj.userData.simStickerNormal;
      expect(b.sub(a).cross(c.sub(a)).dot(n)).toBeGreaterThan(0);
      const depths = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).dot(n));
      expect((Math.max(...depths) - Math.min(...depths)) / GHOST_SCALE).toBeCloseTo(0.1, 4);
    });
    expect(roles).toEqual({ body: 26, sticker: 55, core: 1 });
  });
});

describe('Ghost legality and notation', () => {
  it('locks the original signed U29/D35 offsets and all six aligned 9-piece layers', () => {
    const home = solvedGhostPose();
    expect(GHOST_FACES.map(family => ghostSelection(home, { family, degrees: 90 })?.length ?? 0)).toEqual([9, 9, 0, 0, 0, 0]);
    expect(ghostMovesToString(ghostAlignmentMoves(home))).toBe(GHOST_ALIGN);
    expect(ghostDragMove(home, 'U', true)?.degrees).toBe(29);
    expect(ghostDragMove(home, 'U', false)?.degrees).toBe(-61);
    expect(ghostDragMove(home, 'D', true)?.degrees).toBe(35);
    expect(ghostDragMove(home, 'D', false)?.degrees).toBe(-55);
    for (const m of parseGhostMoves(GHOST_ALIGN)) applyGhostMove(home, m);
    expect(GHOST_FACES.map(family => ghostSelection(home, { family, degrees: 90 })?.length ?? 0)).toEqual([9, 9, 9, 9, 9, 9]);
    expect(ghostAlignmentMoves(home)).toEqual([]);
    for (const family of ['M', 'E', 'S', 'Rw', 'Uw', 'Fw', 'x', 'y', 'z']) {
      expect(ghostSelection(home, parseGhostMoves(family)[0])?.length).toBe(family.length === 2 ? 18 : /[xyz]/.test(family) ? 27 : 9);
    }
  });
  it('blocks straddling cuts and illegal syntax without mutating the last valid state', () => {
    setup(GHOST_ALIGN);
    const before = cube.pose.map(q => q.toArray());
    for (const text of ['R', 'U28° D35° R', 'U0°', 'U360°', 'U1.5°', 'Q', 'R2°w', 'x29°']) {
      expect(ghostSequenceValid(text)).toBe(false);
      expect(() => cube.twister.setup(text)).toThrow();
      expect(cube.pose.map(q => q.toArray())).toEqual(before);
    }
    setup();
    expect(cube.twister.twist(parseGhostMoves('R')[0], false, false)).toBe(false);
    expect(cube.complete).toBe(true);
    expect(() => ghostMoveFrame({ family: 'Rubbish' as 'R', degrees: 90 })).toThrow();
  });
  it('roundtrips tokens, reduces turns and restores after a long deterministic scramble', () => {
    const text = "U29° D35° R U2 L' Fw M E2 S' x y2 z'";
    expect(ghostMovesToString(parseGhostMoves(text))).toBe(text);
    expect(reduceGhostAlg("U29° U61° D35° D35°' R R R R")).toBe('U');
    let seed = 17;
    const turns = Array.from({ length: 120 }, () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return `${GHOST_FACES[seed % 6]}${['', "'", '2'][(seed >>> 8) % 3]}`;
    }).join(' ');
    const moves = parseGhostMoves(`${GHOST_ALIGN} ${turns}`);
    setup();
    moves.forEach(m => cube.applyMoveInstant(m));
    expect(cube.complete).toBe(false);
    invertGhostMoves(moves).forEach(m => cube.applyMoveInstant(m));
    expect(cube.complete).toBe(true);
    setup('x y z2');
    expect(cube.complete).toBe(true);
    expect(ghostMovesToString(ghostAlignmentMoves(cube.pose))).not.toBe('');
  });
  it('rejects invalid batches and queue additions without changing state, history or the active queue', () => {
    setup(`${GHOST_ALIGN} R`);
    const before = cube.pose.map(q => q.toArray()), history = [...cube.history.moves];
    expect(() => cube.applyMovesInstant(parseGhostMoves('U29° R'))).toThrow();
    expect(cube.pose.map(q => q.toArray())).toEqual(before);
    expect(cube.history.moves).toEqual(history);
    setup();
    cube.twister.push(`${GHOST_ALIGN} R`);
    const live = cube.pose.map(q => q.toArray()), queue = [...cube.twister.queue];
    expect(() => cube.twister.push('U29° R')).toThrow();
    expect(cube.pose.map(q => q.toArray())).toEqual(live);
    expect(cube.twister.queue).toEqual(queue);
    expect(cube.history.moves).toEqual([]);
    expect(cube.twister.busy).toBe(true);
    cube.twister.push(`R' ${GHOST_UNALIGN}`);
    cube.twister.finish();
    expect(cube.complete).toBe(true);
  });
  it('preserves completion-gated playback, undo/redo and partial degree sweeps', () => {
    setup();
    const u = parseGhostMoves('U29°')[0];
    expect(cube.twister.twist(u, false, false)).toBe(true);
    expect(cube.twister.twist(u, false, false)).toBe(false);
    cube.twister.finish();
    expect(cube.history.moves).toEqual(['U29°']);
    cube.twister.undo(); expect(cube.complete).toBe(true);
    cube.twister.redo(); expect(cube.complete).toBe(false);
    setup();
    const anims = cube.beginMove(u);
    expect(anims.length).toBe(9);
    applyAnimFrame(anims, 0.5);
    expect(anims[0].pivot.quaternion.y).toBeCloseTo(-Math.sin(14.5 * Math.PI / 360), 12);
    applyAnimFrame(anims, 0);
    expect(cube.complete).toBe(true);
    cube.twister.push(`${GHOST_ALIGN} R U F2 F2 U' R' ${GHOST_UNALIGN}`);
    cube.twister.finish(); expect(cube.complete).toBe(true);
  });
});

describe('Ghost rendered interactions', () => {
  it('restores a fractional frozen cap before the next gesture resolves its detent', () => {
    setup();
    const frozen = cube.beginMove(parseGhostMoves('U29°')[0]);
    applyAnimFrame(frozen, 0.5);
    expect(ghostDragMove(cube.pose, 'U', true)).toBeNull();
    let restore: (() => void) | undefined = () => applyAnimFrame(frozen, 0);
    const ctx = {
      world: { cube, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), width: 100, height: 100, dirty: false },
      dom: { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: () => {}, releasePointerCapture: () => {} },
      settings: () => ({ holdPartialTurn: true, dragEmpty: 'rotate' }), pinching: () => false,
      emitMove: () => {}, orbit: () => { throw new Error('A valid restored cap must turn, not orbit'); },
      clearPartialFreeze: () => { restore?.(); restore = undefined; },
      setPartialSnapBack: (fn: () => void) => { restore = fn; },
    } as unknown as CornerGestureCtx;
    const gesture = new CornerTurnGesture({
      match: (c): c is GhostCube => c === cube,
      pickHit: () => { expect(cube.complete).toBe(true); return {}; },
      resolveLive: () => ({ move: ghostDragMove(cube.pose, 'U', true)!, tangentX: 1, tangentY: 0 }),
      resolveMove: () => ghostDragMove(cube.pose, 'U', true),
      beginMove: (c, m) => c.beginMove(m), moveToString: m => ghostMovesToString([m]), fullPx: 100, threshold: 6,
    }, ctx);
    const pointer = (x: number) => ({ clientX: x, clientY: 20, pointerId: 1, pointerType: 'mouse' }) as PointerEvent;
    gesture.begin(pointer(20));
    expect(gesture.onMove(pointer(70))).toBe(true);
    gesture.onUp(pointer(70));
    expect(cube.complete).toBe(false);
    restore?.();
    expect(cube.complete).toBe(true);
  });
  it('disposes owned cached overlay and hint materials, but preserves shared overlay singletons', () => {
    const disposable = new GhostCube();
    applyEngineBodyOverlay(disposable, false, false, true);
    applyEngineBodyOverlay(disposable, true, false, false);
    applyHintFacelets(disposable, true);
    let rawDisposed = 0, hintDisposed = 0, sharedDisposed = 0;
    disposable.traverse(obj => {
      obj.userData.simRawMat?.addEventListener('dispose', () => rawDisposed++);
      if (obj.userData.simHintGhost) ((obj as THREE.Mesh).material as THREE.Material).addEventListener('dispose', () => hintDisposed++);
    });
    const sharedListener = () => sharedDisposed++;
    HOLLOW_MAT.addEventListener('dispose', sharedListener);
    disposable.dispose();
    HOLLOW_MAT.removeEventListener('dispose', sharedListener);
    expect(rawDisposed).toBe(26);
    expect(hintDisposed).toBe(55);
    expect(sharedDisposed).toBe(0);
  });
  it('separates every rendered moving/stationary solid through five intermediate frames for all move families', () => {
    for (const text of ['U29°', 'D35°', ...parseGhostMoves('U D R L F B M E S Uw Dw Rw Lw Fw Bw').map(m => ghostMovesToString([m]))]) {
      setup(text.includes('°') ? '' : `${GHOST_ALIGN} R U F2`);
      const move = parseGhostMoves(text)[0], selected = new Set(ghostSelection(cube.pose, move)!);
      const { axis, low, high } = ghostMoveFrame(move), anims = cube.beginMove(move);
      for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
        applyAnimFrame(anims, progress);
        for (const [i, { pivot }] of cube.pieces.entries()) {
          let min = Infinity, max = -Infinity;
          for (const child of pivot.children as THREE.Mesh[]) {
            const positions = child.geometry.getAttribute('position');
            for (let k = 0; k < positions.count; k++) {
              const p = new THREE.Vector3().fromBufferAttribute(positions, k).applyQuaternion(pivot.quaternion).dot(axis);
              min = Math.min(min, p); max = Math.max(max, p);
            }
          }
          expect(selected.has(i) ? min >= low - 1e-4 && max <= high + 1e-4 : max <= low + 1e-4 || min >= high - 1e-4).toBe(true);
        }
      }
    }
  });
  it('projects matching solved and scrambled schematic facets and resolves raycast drags', () => {
    setup();
    const scene = new THREE.Scene(); scene.add(cube);
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
    camera.position.set(400, 300, 500); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const world = { scene, camera, width: 600, height: 600 };
    const svg = exportSimSvgSchematic({ world });
    expect(svg.match(/<path d="[^"]+" fill="[^"]+"\/>/g)?.length).toBe(26);
    const hit = ghostPickHit(cube, scene, camera, 300, 300, 600, 600);
    expect(hit).not.toBeNull();
    expect(ghostResolveLive(cube, hit!, scene, camera, 90, 20, 600, 600)?.move).toBeTruthy();
    expect(ghostPickHit(cube, scene, camera, 0, 0, 600, 600)).toBeNull();
    setup(`${GHOST_ALIGN} R U F2`);
    expect(exportSimSvgSchematic({ world })).not.toBe(svg);
    cube.setCarve(true); expect(cube.pieces.filter(p => !p.pivot.visible).length).toBe(9);
    cube.setCarve(false); expect(cube.pieces.every(p => p.pivot.visible)).toBe(true);
    scene.remove(cube);
  });
});
