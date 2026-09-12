import { describe, expect, it } from 'vitest';
import { buildReconSubmitQuery, buildSimQuery, reconEventForSim, simPuzzleForReconEvent } from '@/lib/sim-recon-link';
import { decodeUrlAlg } from '@/lib/cubedb-url';
import { buildReconAttemptMap, buildReconPersonAttemptMap } from '@/lib/recon-attempt-lookup';
import { buildExternalLinks, getPuzzleId } from '@/lib/recon-utils';

describe('buildSimQuery', () => {
  it('hands a competition scramble to practice without claiming participation', () => {
    const scramble = "L B' U2 R B R' F' R B2 L2 U' R' U' L F' L2";
    const params = new URLSearchParams(buildReconSubmitQuery('3x3', scramble, '', {
      practice: true, optimal: true,
      competition: { ci: 'NorwegianChampionship2026', cn: 'Norwegian Championship 2026' },
    }));
    expect(params.get('official')).toBe('practice');
    expect(params.get('compWcaId')).toBe('NorwegianChampionship2026');
    expect(params.get('comp')).toBe('Norwegian Championship 2026');
    expect(decodeUrlAlg(params.get('optimal')!)).toBe(scramble);
    expect(params.has('scramble')).toBe(false);
    expect(params.has('personId')).toBe(false);
    expect(params.has('date')).toBe(false);
  });

  it('does not match practice on competition scrambles to official attempts', () => {
    const official = { id: 1, official: 'wca' as const, compWcaId: 'Test2026', event: '3x3', round: 'f', solveNum: 1, personId: '2017TEST01', person: 'Test' };
    const practice = { ...official, id: 2, official: 'practice' as const };
    expect([...buildReconAttemptMap([official, practice]).values()].map(r => r.id)).toEqual([1]);
    expect([...buildReconPersonAttemptMap([official, practice]).values()]).toEqual([1]);
    expect(buildReconAttemptMap([practice]).size).toBe(0);
  });
  it('anchors a solution-only reconstruction at the solved endpoint', () => {
    const puzzle = simPuzzleForReconEvent('oh');
    expect(puzzle).toBe('3');
    const solution = "D F L F' R D' R2 // W cross cancel into\nU' R' // RG";

    const query = new URLSearchParams(buildSimQuery(puzzle!, '', solution));

    expect(Object.fromEntries(query)).toEqual({
      puzzle: '3',
      alg: solution,
      anchor: 'end',
    });
  });

  it('keeps a reconstruction with a scramble anchored at its start', () => {
    const query = new URLSearchParams(buildSimQuery('3', "R U R'", "R U' R'"));

    expect(Object.fromEntries(query)).toEqual({
      puzzle: '3',
      setup: "R U R'",
      alg: "R U' R'",
    });
  });

  it('round-trips FTO between simulator and reconstruction', () => {
    expect(reconEventForSim('fto')).toBe('fto');
    expect(simPuzzleForReconEvent('fto')).toBe('fto');
    expect(getPuzzleId('fto')).toBe('fto');
    expect(buildExternalLinks('fto', 'R', "R'").cubedbUrl).toBeNull();
  });

  it('cleans reconstruction annotations without splitting FTO EIF roots', () => {
    const solution = "(Bl Rw)2 // first pair\nT’ Br' // finish";
    const query = new URLSearchParams(buildSimQuery('fto', '', solution));

    expect(Object.fromEntries(query)).toEqual({
      puzzle: 'fto',
      alg: "Bl Rw Bl Rw\nT’ Br'",
      anchor: 'end',
    });
  });
});
