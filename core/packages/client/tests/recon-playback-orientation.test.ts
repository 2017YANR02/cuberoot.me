import { describe, expect, it } from 'vitest';
import { reconPlaybackOrientation } from '@/lib/recon-alg-utils';
import { orientedFaceColors } from '@/lib/cube-orientation';
import { CUBE_COLOR_LETTER_FOR_FACE } from '@/lib/cube-colors';

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
