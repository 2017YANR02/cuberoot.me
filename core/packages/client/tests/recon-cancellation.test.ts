import { expect, it } from 'vitest';
import { expandReconCancellation } from '@/lib/recon-f2l-links';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { isCross } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';

it('restores the photographed F2L 3 boundary without changing the final state', () => {
  const scramble = "B2 U B2 L' D2 B2 U2 F2 R2 B2 L R2 U2 L2 D' L2 B U' F L' F'";
  const text = ["z2 y // Inspection", "D R' D2 B2' U' R' F R // W xcross (BR)", "U2 L' U' L U2 y R' U' R // F2L 2 (GR)", "U L U L' U L U // F2L 3 (GO) cancel into", "L2' U2 L U L' U' L // F2L 4 (OB)", "Fw R U R' U' Fw' // OLL", "R2 U' S' U2 S U' R2 U // PLL Ua"].join('\n');
  const expanded = expandReconCancellation(scramble, text, 3);
  expect(expanded).not.toBeNull();
  expect(expanded!.split('\n')[3]).toBe("U L U L' U L U L' // F2L 3 (GO) cancel into");
  const boundary = applyScramble(3, cleanForPlayer(`${scramble}\n${expanded!.split('\n').slice(0, 4).join('\n')}`));
  expect(isCross(boundary)).toBe(true);
  expect(['FR', 'FL', 'BR', 'BL'].filter(slot => isSlotSolved(boundary, slot as 'FR'))).toHaveLength(3);
  expect(applyScramble(3, cleanForPlayer(`${scramble}\n${expanded}`))).toEqual(applyScramble(3, cleanForPlayer(`${scramble}\n${text}`)));
});

it('does not invent an expansion for missing or unlabelled data', () => {
  expect(expandReconCancellation('', "R // F2L 1 cancel into\nU", 0)).toBeNull();
  expect(expandReconCancellation('R', 'R\nU', 0)).toBeNull();
});
