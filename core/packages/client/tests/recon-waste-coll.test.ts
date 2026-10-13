/** Regression coverage for visible waste notation and last-layer classification. */
import { describe, expect, it, vi } from 'vitest';
import { wastedDisplaySpans } from '@cuberoot/shared/timer/reconstruct/error-detect';
import { buildReconText, formattedReconMoves, reconTextForClipboard } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { computeStageSegments } from '@cuberoot/shared/timer';
import { patternFromAlg, invertAlg } from '@cuberoot/shared/recon/cube3';
import { buildCommentSuggestions } from '@cuberoot/shared/recon/popup-suggest';
import { detectStage, topEdgesOriented } from '@cuberoot/shared/recon/stage-detect';

// Case-name lookup is external data; stage/EO detection uses real cube states.
vi.mock('@cuberoot/shared/recon/oll-lookup', () => ({ lookupOllAlgs: async () => [{ caseName: 'OLL 27' }] }));
vi.mock('@cuberoot/shared/recon/pll-lookup', () => ({ lookupPllAlgs: async () => [{ caseName: 'Ua' }] }));

const timed = (tokens: string[]) => tokens.map((m, i) => ({ m, ts: 100 + i * 100 }));

describe.each(['cfop', 'roux', 'zz'] as const)('%s waste notation', method => {
  it.each([
    [["U'", "U'", "U'"], "(U' U' U')"],
    [['U', "U'"], "(U U')"],
    [['U', 'U'], 'U2'],
    [['R', 'U', "U'", "R'"], "(R U U' R')"],
  ])('preserves the performed turns in %j', async (tokens, expected) => {
    const moves = timed(tokens);
    const scramble = 'R F';
    const segs = computeStageSegments(scramble, moves, 1000)!;
    const result = await buildReconText({ method, scramble, moves, totalMs: 1000, segs, metrics: null, slots: null });
    const text = result.lines.map(line => formattedReconMoves(line).join(' ')).join(' ');
    expect(text.replace(/[()]/g, '')).toBe(expected.replace(/[()]/g, ''));
    expect(text.includes('(')).toBe(expected.includes('('));
    for (const line of result.lines) {
      const formatted = formattedReconMoves(line).join(' ');
      expect(reconTextForClipboard(result)).toContain(formatted);
      expect((formatted.match(/\(/g) ?? []).length).toBe((formatted.match(/\)/g) ?? []).length);
    }
    expect((await patternFromAlg(text)).patternData)
      .toEqual((await patternFromAlg(tokens.join(' '))).patternData);
    for (const line of result.lines) {
      expect(line.moves).toHaveLength(line.moveRanges!.length);
      expect(line.moves.every(move => !/[()]/.test(move))).toBe(true);
    }
    const ranges = result.lines.flatMap(line => line.moveRanges!);
    expect(ranges[0].startIdx).toBe(0);
    expect(ranges.at(-1)!.endIdx).toBe(tokens.length - 1);
    if (tokens.length === 3) expect(ranges.map(range => range.startIdx)).toEqual([0, 1, 2]);
  });

  it('does not classify normal double turns as waste', () => {
    expect(wastedDisplaySpans('', timed(['U', 'U']))).toEqual([]);
    expect(wastedDisplaySpans('', timed(["U'", "U'"]))).toEqual([]);
    expect(wastedDisplaySpans('', timed(["U'", "U'", "U'"]))).toEqual([{ fromIdx: 0, toIdx: 2 }]);
  });

  it('closes brackets at line boundaries and keeps adjacent waste groups distinct', () => {
    expect(formattedReconMoves({ moves: ['R', "R'", 'U', "U'"], wasteGroups: [0, 0, 1, 1] } as Parameters<typeof formattedReconMoves>[0]))
      .toEqual(['(R', "R')", '(U', "U')"]);
  });

  it('preserves the reduced HTM/STM counts when showing an over-turn', async () => {
    const moves = timed(["U'", "U'", "U'"]);
    const segs = computeStageSegments('R F', moves, 1000)!;
    const result = await buildReconText({ scramble: 'R F', moves, totalMs: 1000, segs, metrics: null, slots: null });
    expect(result.turns).toBe(1);
    expect(result.stm).toBe(1);
    expect(result.lines.flatMap(line => line.moves)).toEqual(["U'", "U'", "U'"]);
  });
});

describe('COLL versus OLL(CP)', () => {
  const epll = "R U' R U R U R U' R' U' R2";
  it.each([
    ["R U R' U R U2 R'", true, '// COLL'],
    ["F R U R' U' F'", false, '// OLL(CP)'],
  ])('classifies %s from its initial EO state', async (alg, eo, expected) => {
    const currPattern = await patternFromAlg(epll);
    const prevPattern = currPattern.applyAlg(invertAlg(alg));
    const prev = await detectStage(prevPattern);
    expect(prev.stage).toBe('f2l');
    expect(topEdgesOriented(prev.canonicalPattern)).toBe(eo);
    expect((await detectStage(currPattern)).stage).toBe('oll');
    const suggestions = await buildCommentSuggestions({ prevPattern, currPattern, lineMovesText: alg, moveCount: alg.split(' ').length, explicit: true });
    expect(suggestions[0]).toBe(expected);
  });
});
