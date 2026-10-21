// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  generateIvyTimerScramble, ivyApplyStandard, ivyDisplayState, ivyScrambleToRlub,
  MOVE_CENTERS, parseIvyStandardMoves, IVY_U_FACE_MAP, IVY_U_CORNER_MAP,
} from '@cuberoot/puzzle-solvers/ivy';
import IvyCube from '@cuberoot/puzzle-render-core/engine/ivy/IvyCube';
import { applyAnimFrame } from '@cuberoot/puzzle-render-core/engine/pieceAnim';
import { renderIvyScrambleSvg } from '@cuberoot/puzzle-render-core/ivy-svg';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { getIvyMode, setIvyMode, onIvyModeChange } from '@/lib/scramble-ivy-mode';

const invert = (text: string) => text.split(/\s+/).reverse().map(t => t.endsWith("'") ? t.slice(0, -1) : `${t}'`).join(' ');
const faces = [
  [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [0, -1, 0],
];
const corners = [[1, 1, -1], [-1, 1, 1], [1, -1, 1], [-1, -1, -1]];

describe('Ivy UBL generating set', () => {
  it('switches generator types both ways without rewriting saved text', async () => {
    localStorage.removeItem('cuberoot.gen.ivy_mode');
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const changed = vi.fn();
    const unsubscribe = onIvyModeChange(changed);
    try {
      expect(getIvyMode()).toBe('rldb');
      const old = await cstimerScramble('ivy');
      setIvyMode('rlub');
      const current = await cstimerScramble('ivy');
      expect(current).toBe(ivyScrambleToRlub(old));
      expect(current).toMatch(/U/);
      setIvyMode('rldb');
      expect(await cstimerScramble('ivy')).toBe(old);
      expect(changed).toHaveBeenCalledTimes(2);
      expect(current).toBe(ivyScrambleToRlub(old));
    } finally {
      unsubscribe();
      random.mockRestore();
      localStorage.removeItem('cuberoot.gen.ivy_mode');
    }
  });

  it('uses the skewb UBL clockwise axis; DFR stays still', () => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 1, -1).normalize(), -2 * Math.PI / 3);
    faces.forEach((face, i) => {
      const actual = new THREE.Vector3(...face).applyQuaternion(rotation);
      expect(actual.distanceTo(new THREE.Vector3(...faces[IVY_U_FACE_MAP[i]]))).toBeLessThan(1e-10);
    });
    corners.forEach((corner, i) => {
      const actual = new THREE.Vector3(...corner).applyQuaternion(rotation);
      expect(actual.distanceTo(new THREE.Vector3(...corners[IVY_U_CORNER_MAP[i]]))).toBeLessThan(1e-10);
    });
    const u = ivyDisplayState('U');
    expect(u.centers).toEqual([3, 1, 2, 4, 0, 5]);
    expect(u.petals[2]).toEqual(ivyDisplayState('').petals[2]);
    expect(ivyDisplayState("U U'")).toEqual(ivyDisplayState(''));
    expect(ivyDisplayState('U U U')).toEqual(ivyDisplayState(''));
  });

  it('preserves existing RLDB states and transforms full sequences up to a rigid orientation', () => {
    for (let i = 0; i < 40; i++) {
      const text = generateIvyTimerScramble(() => (i + 0.5) / 40);
      const old = ivyApplyStandard(text);
      const state = ivyDisplayState(text);
      expect(state.centers).toEqual(old.centers);
      MOVE_CENTERS.forEach((tri, axis) => tri.forEach((face, p) => {
        expect(state.petals[axis][face]).toBe(tri[(p - old.corners[axis] + 3) % 3]);
      }));
      const converted = ivyScrambleToRlub(text);
      expect(converted).toMatch(/^[RLUB' ]+$/);
      const turns = parseIvyStandardMoves(text).filter(m => m.axis === 2).reduce((n, m) => n + m.times, 0) % 3;
      let faceMap: number[] = [0, 1, 2, 3, 4, 5];
      let cornerMap: number[] = [0, 1, 2, 3];
      for (let t = 0; t < turns; t++) {
        faceMap = faceMap.map(f => IVY_U_FACE_MAP[f]);
        cornerMap = cornerMap.map(a => IVY_U_CORNER_MAP[a]);
      }
      const actual = ivyDisplayState(converted);
      state.centers.forEach((color, f) => expect(actual.centers[faceMap[f]]).toBe(color));
      state.petals.forEach((row, a) => MOVE_CENTERS[a].forEach(f => {
        expect(actual.petals[cornerMap[a]][faceMap[f]]).toBe(row[f]);
      }));
      expect(ivyDisplayState(`${converted} ${invert(converted)}`)).toEqual(ivyDisplayState(''));
      expect(renderIvyScrambleSvg(converted).match(/<path /g)).toHaveLength(18);
    }
  });

  it('animates the six complementary pieces and selects live corners after U', () => {
    const cube = new IvyCube();
    try {
      const u = parseIvyStandardMoves('U')[0];
      const anims = cube.beginMove(u);
      expect(anims).toHaveLength(6);
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        applyAnimFrame(anims, progress);
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 1, -1).normalize(), -progress * 2 * Math.PI / 3);
        for (const anim of anims) expect(1 - Math.abs(anim.pivot.quaternion.dot(rotation))).toBeLessThan(1e-10);
      }
      cube.finishMove(anims, u);
      expect(cube.complete).toBe(false);
      expect(cube.cornerSlotForPiece(0)).toBe(1);
      const r = cube.beginMove(parseIvyStandardMoves('L')[0]);
      expect(r[0].pivot).toBe(anims[0].pivot);
      cube.applyMoveSilent(parseIvyStandardMoves("U'")[0]);
      expect(cube.complete).toBe(true);
      const text = "U R L' U' B R U";
      for (const move of parseIvyStandardMoves(`${text} ${invert(text)}`)) cube.applyMoveSilent(move);
      expect(cube.complete).toBe(true);
    } finally {
      cube.dispose();
    }
  }, 20000);
});
