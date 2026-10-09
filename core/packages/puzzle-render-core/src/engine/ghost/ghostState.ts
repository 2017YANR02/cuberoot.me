import * as THREE from 'three';
import { GHOST_CELLS, GHOST_CUT } from './ghostModel';

export const GHOST_FACES = ['U', 'D', 'R', 'L', 'F', 'B'] as const;
export type GhostFace = typeof GHOST_FACES[number];
export type GhostLayer = GhostFace | 'M' | 'E' | 'S';
export type GhostFamily = GhostLayer | `${GhostFace}w` | 'x' | 'y' | 'z';
/** Positive degrees are clockwise as seen from outside the named face. */
export interface GhostMove { family: GhostFamily; degrees: number }
export type GhostPose = readonly THREE.Quaternion[];
export const GHOST_ALIGN = 'U29° D35°';
export const GHOST_UNALIGN = "D35°' U29°'";
const EPS = 1e-5;
const AXES: Record<string, readonly [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
  M: [-1, 0, 0], E: [0, -1, 0], S: [0, 0, 1], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1],
};

export function ghostMoveFrame(move: GhostMove): { axis: THREE.Vector3; low: number; high: number } {
  const n = AXES[move.family[0]];
  if (!n || !/^([UDRLFB]w?|[MESxyz])$/.test(move.family) || !Number.isFinite(move.degrees) || !Number.isInteger(move.degrees) || move.degrees === 0 || Math.abs(move.degrees) >= 360) {
    throw new Error('Invalid Ghost move');
  }
  const whole = /^[xyz]$/.test(move.family), slice = /^[MES]$/.test(move.family);
  return { axis: new THREE.Vector3(...n), low: whole ? -Infinity : slice || move.family.endsWith('w') ? -GHOST_CUT : GHOST_CUT,
    high: slice ? GHOST_CUT : Infinity };
}

export function parseGhostMoves(text: string): GhostMove[] {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map(token => {
    const m = /^([UDRLFB]w?|[MESxyz])(?:(2)|([1-9]\d{0,2})°)?(['’])?$/.exec(token);
    if (!m || (m[3] && (!/^[UDRLFB]$/.test(m[1]) || Number(m[3]) >= 360))) {
      throw new Error(`Invalid Ghost token: ${token}`);
    }
    return { family: m[1] as GhostFamily, degrees: (m[3] ? Number(m[3]) : m[2] ? 180 : 90) * (m[4] ? -1 : 1) };
  });
}
export function ghostMoveToString(move: GhostMove): string {
  const d = Math.abs(move.degrees);
  return `${move.family}${d === 90 ? '' : d === 180 ? '2' : `${d}°`}${move.degrees < 0 ? "'" : ''}`;
}
export const ghostMovesToString = (moves: readonly GhostMove[]): string => moves.map(ghostMoveToString).join(' ');
export const invertGhostMoves = (moves: readonly GhostMove[]): GhostMove[] => [...moves].reverse().map(m => ({ ...m, degrees: -m.degrees }));
export function reduceGhostAlg(text: string): string {
  const out: GhostMove[] = [];
  for (const move of parseGhostMoves(text)) {
    const last = out[out.length - 1];
    if (last?.family !== move.family) { out.push({ ...move }); continue; }
    out.pop();
    const degrees = ((last.degrees + move.degrees + 540) % 360) - 180;
    if (degrees) out.push({ family: move.family, degrees });
  }
  return ghostMovesToString(out);
}
export const solvedGhostPose = (): THREE.Quaternion[] => GHOST_CELLS.map(() => new THREE.Quaternion());

/** Select WHOLE cells. A straddling cell means the proposed cut does not exist.
 * Separating planes are perpendicular to the rotation axis and invariant throughout
 * the sweep, proving moving/stationary ideal solids disjoint, not just at endpoints.
 */
export function ghostSelection(pose: GhostPose, move: GhostMove): number[] | null {
  const { axis, low, high } = ghostMoveFrame(move);
  const selected: number[] = [], v = new THREE.Vector3();
  for (let i = 0; i < GHOST_CELLS.length; i++) {
    let min = Infinity, max = -Infinity;
    for (const home of GHOST_CELLS[i].vertices) {
      const p = v.copy(home).applyQuaternion(pose[i]).dot(axis);
      min = Math.min(min, p); max = Math.max(max, p);
    }
    if (min >= low - EPS && max <= high + EPS) selected.push(i);
    else if (!(max <= low + EPS || min >= high - EPS)) return null;
  }
  return selected.length ? selected : null;
}
export function applyGhostMove(pose: THREE.Quaternion[], move: GhostMove): void {
  const selected = ghostSelection(pose, move);
  if (!selected) throw new Error(`Ghost layers are not aligned for ${ghostMoveToString(move)}`);
  const delta = new THREE.Quaternion().setFromAxisAngle(ghostMoveFrame(move).axis, -THREE.MathUtils.degToRad(move.degrees));
  for (const i of selected) pose[i].premultiply(delta).normalize();
}
export function ghostSequenceValid(text: string, initial: GhostPose = solvedGhostPose()): boolean {
  try {
    const pose = initial.map(q => q.clone());
    for (const move of parseGhostMoves(text)) applyGhostMove(pose, move);
    return true;
  } catch { return false; }
}

/** Next quarter-grid detent, including the exact 29/35 degree initial offsets. */
export function ghostDragMove(pose: GhostPose, family: GhostLayer, clockwise: boolean): GhostMove | null {
  const probe: GhostMove = { family, degrees: 90 };
  const selected = ghostSelection(pose, probe);
  if (!selected) return null;
  const { axis } = ghostMoveFrame(probe);
  const perpendicular = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
    .filter(n => Math.abs(n.dot(axis)) < 0.5);
  const alignedAt = (degrees: number) => {
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, -THREE.MathUtils.degToRad(degrees));
    return selected.every(i => {
      const q = delta.clone().multiply(pose[i]);
      return perpendicular.every(n => {
        const values = GHOST_CELLS[i].vertices.map(v => v.clone().applyQuaternion(q).dot(n));
        const min = Math.min(...values), max = Math.max(...values);
        return max <= -GHOST_CUT + EPS || min >= GHOST_CUT - EPS || (min >= -GHOST_CUT - EPS && max <= GHOST_CUT + EPS);
      });
    });
  };
  const sign = clockwise ? 1 : -1;
  if (alignedAt(0)) return { family, degrees: sign * 90 };
  for (let degree = 1; degree <= 90; degree++) if (alignedAt(sign * degree)) return { family, degrees: sign * degree };
  return null;
}

/** Align the currently movable caps without changing any already aligned cap. */
export function ghostAlignmentMoves(initial: GhostPose): GhostMove[] {
  const pose = initial.map(q => q.clone()), moves: GhostMove[] = [];
  for (const family of GHOST_FACES) {
    const move = ghostDragMove(pose, family, true);
    if (move && move.degrees !== 90) { applyGhostMove(pose, move); moves.push(move); }
  }
  return moves;
}
