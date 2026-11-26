import { describe, expect, it } from 'vitest';
import { reconPlaybackOrientation } from '@/lib/recon-alg-utils';
import { orientedFaceColors } from '@/lib/cube-orientation';
import { CUBE_COLOR_LETTER_FOR_FACE } from '@/lib/cube-colors';

import { reviewAlg, reviewCamera, reviewColorPrefix, reviewSlotYaw, recordingRotation, reconstructedReviewPoses } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { conjugateSequence, facePermFor } from '@cuberoot/shared/timer/reconstruct/orient';
import { computeF2lSlots, isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import workbook from './fixtures/recon-workbook/4a6aW4XJ_5E.json';

const bottom = (text: string) => CUBE_COLOR_LETTER_FOR_FACE[orientedFaceColors(reconPlaybackOrientation(text)).D];

describe('reconstruction playback bottom color', () => {
  it('uses each annotated cross color instead of the default yellow bottom', () => {
    for (const color of ['W', 'Y', 'R', 'O', 'B', 'G']) {
      expect(bottom(`R U // ${color} xcross`)).toBe(color);
    }
  });
  it('recognizes the pseudo-cross in reconstruction 2795', () => {
    expect(bottom("x' z' // insp\nU' r' R2 U' R2' D' R2 // W psxcross (OB) cancel into\nU R' U'D' // xxcross (RG)")).toBe('W');
  });
  it('falls back to initial grip but ignores later solving rotations', () => {
    expect(bottom('z2 // insp\nR U // cross')).toBe('W');
    expect(bottom("x' R U x2")).toBe('G');
    expect(bottom('R U z2')).toBe('Y');
    expect(bottom('')).toBe('Y');
  });
});

describe('CFOP teaching view', () => {
  it('faces the viewer with each real pair and preserves every facelet at both stage boundaries', () => {
    const recording = workbook.recording;
    const rotation = recordingRotation(recording);
    const slots = computeF2lSlots(recording.scramble, recording.moves, recording.timeMs)!;
    const pairs = slots.slots;
    let start = slots.segments.crossEndIdx! + 1;
    expect(pairs).toHaveLength(4);
    for (const pair of pairs) {
      const yaw = reviewSlotYaw[pair.slot];
      const perm = facePermFor(yaw);
      expect([...pair.slot].map(f => perm[f as 'F'|'R'|'L'|'B']).sort()).toEqual(['F','R']);
      const view = reviewCamera(pair.slot);
      // A y turn is a negative quarter turn around Three's +Y axis.
      const expected = {FR:0, FL:1, BR:-1, BL:2}[pair.slot] * Math.PI / 2;
      expect(view.y - reviewCamera().y).toBeCloseTo(expected);
      const setup = [recording.scramble, ...recording.moves.slice(0, start).map(m => m.m)].join(' ');
      const moves = recording.moves.slice(start, pair.endIdx! + 1).map(m => m.m);
      for (const length of [0, moves.length]) {
        const raw = moves.slice(0, length).join(' ');
        const formula = reviewAlg(setup, raw, rotation, true);
        const fromCard = applyScramble(3, [formula.setup, formula.alg, yaw].join(' '));
        const fromLog = applyScramble(3, [reviewColorPrefix(rotation), setup, raw, rotation, yaw].join(' '));
        expect(fromCard).toEqual(fromLog);
        expect(fromCard.D[4]).toBe('U');
        expect(fromCard.U[4]).toBe('D');
        if (length) expect(isSlotSolved(fromCard, 'FR')).toBe(true);
      }
      start = pair.endIdx! + 1;
    }
    expect(reviewCamera(undefined, 'OLL').x).toBeGreaterThan(reviewCamera().x);
    expect(reviewCamera(undefined, 'PLL')).toBe(reviewCamera(undefined, 'OLL'));
  });

  it('matches the recorded and reference views for every possible cross colour', () => {
    for (const rotation of ['', 'z2', 'z', "z'", 'x', "x'"]) {
      const start = "R U F' L";
      const alg = "F R' U2";
      const perm = facePermFor(rotation);
      const normalizedSetup = [rotation, conjugateSequence(start, perm)].join(' ').trim();
      const reference = reviewAlg(normalizedSetup, conjugateSequence(alg, perm)!, rotation);
      const state = applyScramble(3, reference.setup + ' ' + reference.alg);
      expect(state.D[4]).toBe('U');
      expect(state).toEqual(applyScramble(3, [reviewColorPrefix(rotation), start, alg, rotation].join(' ')));
    }
  });

  it('keeps the teaching frame when reconstructed gestures change the centres', () => {
    const inspection = 'z2 y';
    const moves = ['x', 'R', "r'", 'M', 'U2', "z'", 'S2'];
    const poses = reconstructedReviewPoses(inspection, moves.map(m => ({m})), 'z2');
    for (let i = 0; i <= moves.length; i++) {
      const state = applyScramble(3, [inspection, ...moves.slice(0,i), poses[i]].join(' '));
      expect([state.D[4], state.U[4], state.F[4]]).toEqual(['U', 'D', 'F']);
    }
  });
});
