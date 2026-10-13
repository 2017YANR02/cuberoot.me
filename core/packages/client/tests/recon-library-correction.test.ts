import { describe, expect, it, vi } from 'vitest';
import { correctLibraryLine, correctReconFromLibrary } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { formattedReconMoves, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import type { AlgFile } from '@cuberoot/shared/alg';
import { reconstructedTrack } from '../../timer-ui/src/reconstruct/playback-track';
import { conjugateSequence, facePermFor } from '@cuberoot/shared/timer/reconstruct/gyro-orient';

const observed = "F R U' R' U' R U l' U' R B R' B' x' R' F R F'";
const body = "F R U' R' U' R U R' F' R U R' U' R' F R F'";
const library = "U (F R U' R' U' R U R' F') (R U R' U' R' F R F')";
function line(text: string, wasteGroups?: Array<number | null>): ReconTextLine {
  const moves = text.split(' ');
  let raw = 0;
  return { key: 'pll', kind: 'pll', label: 'PLL-Y', fromIdx: 0,
    toIdx: moves.filter(move => !/^[xyz]/.test(move)).length - 1,
    moves, wasteGroups, recognitionMs: 0, executionMs: 1800, stepMs: 1800,
    moveRanges: moves.map((token, i) => ({ token, ts: (i + 1) * 100, endTs: (i + 1) * 100,
      startIdx: raw, endIdx: /^[xyz]/.test(token) ? raw - 1 : raw++,
    })),
  };
}
async function equivalent(a: string[], b: string[]) {
  const kp = await getCube3();
  expect(kp.defaultPattern().applyAlg(a.join(' ')).isIdentical(kp.defaultPattern().applyAlg(b.join(' ')))).toBe(true);
}

describe('library-assisted notation correction', () => {
  it('excludes boundary AUF marked as waste while preserving its moves and grouping', async () => {
    const original = line(`U U U ${observed} U U U`);
    original.wasteGroups = original.moves.map((_, i) => i < 3 ? 1 : i >= original.moves.length - 3 ? 2 : null);
    const result = await correctLibraryLine(original, [{ alg: library }]);
    expect(result.moves.join(' ')).toBe(`U U U ${body} U U U`);
    expect(formattedReconMoves(result).join(' ')).toBe(`(U U U) ${library.slice(2)} (U U U)`);
    expect(result.moveRanges!.slice(0, 3)).toEqual(original.moveRanges!.slice(0, 3));
    expect(result.moveRanges!.slice(-3)).toEqual(original.moveRanges!.slice(-3));
    await equivalent(original.moves, result.moves);
  });

  it('extracts the implicit trailing AUF in the reported Gc without changing its transform', async () => {
    const original = line("R2' U' x l U' R U R' U R2 E B U' B' E'");
    const gc = "R2 U' R U' R U R' U R2 D' U R U' R' D";
    const result = await correctLibraryLine(original, [{ alg: `${gc} U'` }]);
    expect(result.moves.join(' ')).toBe(`${gc} U'`);
    expect(result.libraryCorrection).toBeDefined();
    expect(result.libraryCorrection?.implicitAuf).toEqual({ before: '', after: "U'" });
    await equivalent(original.moves, result.moves);
    const raw = original.moveRanges!.filter(range => range.endIdx >= range.startIdx).map(range => ({ m: range.token, ts: range.ts }));
    expect(reconstructedTrack([result], raw)).not.toBeNull();
  });

  it('selects Gc uniquely from the complete library pool with its hidden final AUF', async () => {
    // API PLL/Gc snapshot, 2026-10-13; retain competing fingertrick variants.
    const candidates = [
      "(R2' u' R U') (R U R' u) (R2 f R' f')",
      "R2 u' R U' R U z' U' R f2' U R' U' z'",
      "U2↑R2' F2 (R U2 R U2') R' F (R U R' U') R' F R2 U2",
      "U2 ↓L2' U' (L U' L U) (L' U L2' UD') (L U' L' D) U",
      "(R2 u' R U') (R U R' u) R2 y R U' R'",
      "U' L'R' U2 LR y L U' R U2 L' U R' U'",
      "R2' S2 U' R2 D R2' D' F2 U B2' r2",
      "U2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2 U' U'",
      "R2 U' R U' R U R' U R2 D' U R U' R' D U'",
      "D R2 U' R U' R U R' U R2 D' U R U' R' U'",
      "R2 u' R U' R U R' u R2 f R' f' U U'",
    ].map(alg => ({ alg }));
    const original = line("R2' U' x l U' R U R' U R2 E B U' B' E'");
    const result = await correctLibraryLine(original, candidates);
    expect(result.moves.join(' ')).toBe(candidates[8].alg);
    await equivalent(original.moves, result.moves);
  });

  it('infers AUF from the recording even when the library wrappers differ', async () => {
    const original = line("E D y R2' U' x l U' R U R' U R2 E B U' B' E'");
    const gc = "R2 U' R U' R U R' U R2 D' U R U' R' D";
    const result = await correctLibraryLine(original, [{ alg: `U2 ${gc} U` }]);
    expect(result.moves.join(' ')).toBe(`U ${gc} U'`);
    expect(result.libraryCorrection?.implicitAuf).toEqual({ before: 'U', after: "U'" });
    await equivalent(original.moves, result.moves);
  });

  it('keeps inspection/AUF wrappers and conjugates the library body into the execution frame', async () => {
    const perm = facePermFor('y');
    const source = conjugateSequence(observed.replace("l'", "Lw'"), perm)!;
    const expected = conjugateSequence(body, perm)!;
    const original = line(`z2 U2' ${source} U' y`);
    const result = await correctLibraryLine(original, [{ alg: library }]);
    expect(result.moves.join(' ')).toBe(`z2 U2' ${expected} U' y`);
    expect(result).not.toBe(original);
    await equivalent(original.moves, result.moves);
  });

  it('uses local equivalence evidence for slice decompositions with little literal overlap', async () => {
    const original = line("R L' x' U R L' x' U R L' x' U F");
    const result = await correctLibraryLine(original, [{ alg: '(M U)3 F' }]);
    expect(result.moves.join(' ')).toBe('M U M U M U F');
    await equivalent(original.moves, result.moves);
  });

  it('selects the supplied formula uniquely among the real PLL-Y library alternatives', async () => {
    // API /v1/alg/sets/3x3/pll, Y case snapshot, 2026-10-13. No network in tests.
    const alternatives = [
      "(f' U f R' U' R' U R2) (U R' U' R' F R F') U'",
      `${library} U'`,
      "U R2 U' (R' U R U') f' y' U' (R U' R' U') z U R x U'",
      "U (F R' F' R U R U') (R2' U' R U R B' R' f) z' U U'",
      "U R2 U' R' U R U' x' U' z' U' R U' R' U' z U R x U'",
      "U F R' F (R2 U' R' U') (R U R' F') (R U R' U') F' U'",
      "U' f U (R U R2' U'D') (R U R' D) R2 U2' B' z' U2 U'",
      "U F (R U' R' U') R d (R U R' B') R U' R2 U'",
      "U (R2 U' R2' U' R2 U) F U F' (R2' F U' F') U'",
      "U F R' F' R U R U' R2 U' R U R f' U' f U U'",
    ];
    const result = await correctLibraryLine(line(`U2' ${observed}`), alternatives.map(alg => ({ alg })));
    expect(result.moves.join(' ')).toBe(`U2' ${body}`);
    expect(result.libraryCorrection?.algorithm).toBe(`${library} U'`);
  });

  it('corrects the supplied PLL-Y, keeps recorded AUFs and library grouping', async () => {
    const original = line(`U2' ${observed} U'`);
    const snapshot = structuredClone(original);
    const result = await correctLibraryLine(original, [{ alg: `${library} U2` }]);
    expect(result).not.toBe(original);
    expect(result.moves.join(' ')).toBe(`U2' ${body} U'`);
    expect(formattedReconMoves(result).join(' ')).toBe(`U2' ${library.slice(2)} U'`);
    expect(original).toEqual(snapshot);
    expect(result.libraryCorrection?.originalMoves).toEqual(original.moves);
    await equivalent(original.moves, result.moves);
    const raw = original.moveRanges!.filter(range => range.endIdx >= range.startIdx).map(range => ({ m: range.token, ts: range.ts }));
    const playback = reconstructedTrack([result], raw);
    expect(playback).not.toBeNull();
    expect(playback!.map(move => move.m)).toEqual(result.moves);
    expect(result.moveRanges![0]).toEqual(original.moveRanges![0]);
    expect(result.moveRanges!.at(-1)).toEqual(original.moveRanges!.at(-1));
    expect(result.moveRanges!.every((range, i, all) => range.endTs >= range.ts && (!i || range.ts >= all[i - 1].ts))).toBe(true);
  });

  it('does not treat the supplied R3 fingertrick formula as removable waste', async () => {
    const formula = "U' R2' U (R U R' U') (R3 U' R' U R')";
    const original = line("U2 R2' U R U R' U' R R R U' R' U R'");
    const result = await correctLibraryLine(original, [{ alg: formula }]);
    expect(result.moves.join(' ')).toBe("U2 R2' U R U R' U' R3 U' R' U R'");
    expect(formattedReconMoves(result).join(' ')).toBe(`U2 ${formula.slice(3)}`);
    await equivalent(original.moves, result.moves);
  });

  it('preserves an extra identity loop at a proven intermediate state', async () => {
    const original = line(`U2' F R R' ${observed.split(' ').slice(1).join(' ')}`);
    original.wasteGroups = original.moves.map((_, i) => i === 2 || i === 3 ? 7 : null);
    const result = await correctLibraryLine(original, [{ alg: library }]);
    expect(result).not.toBe(original);
    expect(result.moves.join(' ')).toBe(`U2' F R R' ${body.split(' ').slice(1).join(' ')}`);
    expect(result.wasteGroups?.filter(group => group === 7)).toHaveLength(2);
    expect(result.moveRanges?.slice(2, 4)).toEqual(original.moveRanges?.slice(2, 4));
    await equivalent(original.moves, result.moves);
  });

  it('refuses to move waste through an unmatched intermediate state', async () => {
    const tokens = observed.split(' ');
    tokens.splice(9, 0, 'D', "D'");
    const original = line(tokens.join(' '));
    original.wasteGroups = tokens.map((_, i) => i === 9 || i === 10 ? 2 : null);
    expect(await correctLibraryLine(original, [{ alg: library }])).toBe(original);
  });

  it('does not accept similar but inequivalent formulas, including changed end orientation', async () => {
    const original = line(observed);
    expect(await correctLibraryLine(original, [{ alg: `${body} R` }])).toBe(original);
    const wrong = line(observed.replace("x'", 'x'));
    expect(await correctLibraryLine(wrong, [{ alg: library }])).toBe(wrong);
  });

  it('rejects ambiguous equal candidates but deduplicates AUF/grouping copies', async () => {
    const original = line(observed);
    // Half-turn travel direction is deliberately not silently collapsed.
    const first = `${body.slice(0, 2)}R R' ${body.slice(2)}`;
    const second = `${body.slice(0, 2)}L L' ${body.slice(2)}`;
    expect(await correctLibraryLine(original, [{ alg: first }, { alg: second }])).toBe(original);
    const result = await correctLibraryLine(original, [{ alg: library }, { alg: `U2 ${body} U'` }]);
    expect(result.moves.join(' ')).toBe(body);
  });

  it('leaves unsupported notation, absent timing maps and unmatched cases unchanged', async () => {
    const original = line(observed);
    expect(await correctLibraryLine(original, [{ alg: 'invalid' }])).toBe(original);
    const unmapped = { ...original, moveRanges: undefined };
    expect(await correctLibraryLine(unmapped, [{ alg: library }])).toBe(unmapped);
  });

  it('loads only the identified case, updates copied text, and tolerates library failure', async () => {
    const original = line(`U2' ${observed}`);
    const recon = { lines: [original], text: observed, inspection: 'z2' } as ReconTextResult;
    const load = vi.fn(async () => ({ cases: [{ name: 'Y', algs: [[{ alg: library }]] }] }) as AlgFile);
    const corrected = await correctReconFromLibrary(recon, load);
    expect(load).toHaveBeenCalledWith('pll');
    expect(corrected.text).toContain(`U2' ${library.slice(2)} // PLL-Y`);
    expect(corrected.text).toContain('z2 // insp');
    expect(await correctReconFromLibrary(recon, async () => { throw new Error('offline'); })).toBe(recon);
    const other = { ...recon, lines: [{ ...original, label: 'PLL-T' }] };
    expect(await correctReconFromLibrary(other, load)).toBe(other);
    const oll = { ...recon, lines: [{ ...original, kind: 'oll' as const, label: 'OLL-W+' }] };
    const ollLoad = vi.fn(async () => ({ cases: [{ name: 'OLL 38', algs: [[{ alg: library }]] }] }) as AlgFile);
    expect((await correctReconFromLibrary(oll, ollLoad)).lines[0].libraryCorrection).toBeDefined();
    expect(ollLoad).toHaveBeenCalledWith('oll');
  });

  it('bounds a stalled library fetch without withholding the original report', async () => {
    vi.useFakeTimers();
    try {
      const recon = { lines: [line(observed)], inspection: '', text: observed } as ReconTextResult;
      const result = correctReconFromLibrary(recon, () => new Promise(() => {}));
      await vi.advanceTimersByTimeAsync(2501);
      expect(await result).toBe(recon);
    } finally { vi.useRealTimers(); }
  });
});
