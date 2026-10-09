import { describe, expect, it } from 'vitest';
import { computeAllStats } from '@/lib/recon-stats';

describe('reconstruction S moves', () => {
  it('does not count the ZBLS annotation in reconstruction 2795', () => {
    const solution = `x' z' // insp
U' r' R2 U' R2' D' R2 U R' U' D' // W xxcross (RG+OB)
R' U' R // OG
L' U' L // RB ZBLS
R' U R U R' U2 R U R D R' U2 R D' R' // ZBLL-U15`;
    const stats = computeAllStats(solution, 2.51, '3x3');
    expect(stats.sMove).toBe(0);
    expect(stats.stm).toBe(32);
  });

  it('retains actual S turns while ignoring annotations and summary labels', () => {
    const stats = computeAllStats("3STM/1=3TPS\nS S' S2 // ZBLS, S slice\n// S S2", 1, '3x3');
    expect(stats.sMove).toBe(3);
  });
});
