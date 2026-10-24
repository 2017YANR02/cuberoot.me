import { describe, expect, it, vi } from 'vitest';
import { correctLibraryLine, correctReconFromLibrary, identifyLibraryCase, strictOuterForm } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { formattedReconMoves, originalReconNotation, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import type { AlgFile } from '@cuberoot/shared/alg';
import { reconstructedTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { conjugateSequence, facePermFor } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';

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
  it('displays transformed wide turns like the library without changing playback ranges', async () => {
    const original = line("x' F Rw F R' F' Rw' D R D' x");
    const snapshot = JSON.stringify(original);
    const displayed = formattedReconMoves(original);
    expect(displayed.join(' ')).toBe("x' F r F R' F' r' D R D' x");
    expect(displayed).toHaveLength(original.moveRanges!.length);
    await equivalent(original.moves, displayed);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it('matches the same executed formula in all 24 holding frames, including local AUF', async () => {
    const formula = "(R U R' U') (R' F R2 U R' U' F')";
    const executions = ["R U R' U' R' F R R U R' U' F'", "U R U R' U' R' F R R U R' U' F' U2"];
    for (const execution of executions) for (const { value } of CUBE_ORIENTATIONS) {
      const original = line(conjugateSequence(execution, facePermFor(value))!);
      const snapshot = JSON.stringify(original);
      const result = await correctLibraryLine(original, [{ alg: formula }]);
      expect(result.libraryCorrection?.algorithm, value || 'UF').toBe(formula);
      await equivalent(original.moves, result.moves);
      expect(JSON.stringify(original)).toBe(snapshot);
      expect(originalReconNotation({ lines: [result] } as ReconTextResult).lines[0]).toEqual(original);
      if (/[xz]/.test(value)) expect(result.moves.some(move => /^[xyz]/.test(move)), value).toBe(false);
    }
  });
  it('prefers an exact case orientation over another case reachable by AUF, but rejects exact ambiguity', async () => {
    const alg = "F R U R' U' R F' r U R' U' r'";
    const cases = [
      { name: 'OLLCP56 1', algs: [[{ alg: `U2 ${alg} U2` }]] },
      { name: 'OLLCP56 3', algs: [[{ alg }]] },
    ] as AlgFile['cases'];
    expect(await identifyLibraryCase({ moves: alg.split(' ') }, cases, 'ollcp')).toBe(cases[1]);
    expect(await identifyLibraryCase({ moves: `U2 ${alg} U2`.split(' ') }, cases, 'ollcp')).toBe(cases[0]);
    expect(await identifyLibraryCase({ moves: alg.split(' ') }, [...cases, { ...cases[1], name: 'duplicate' }], 'ollcp')).toBeUndefined();
  });
  it('uses PLL library primary names even without an algorithm correction', async () => {
    for (const [legacy, name, primary] of [['Jb', 'Jb', 'PLL-J'], ['Ja', 'L', 'PLL-L'], ['Ua', 'Ua', 'PLL-U-']]) {
      const original = { ...line('R U'), label: `PLL-${legacy}` };
      const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
      const result = await correctReconFromLibrary(recon, async () => ({
        cases: [{ name, meta: { ollcp: primary }, algs: [] }],
      }) as unknown as AlgFile);
      expect(result.lines[0].label).toBe(primary);
      expect(result.text).toContain(`// ${primary}`);
      expect(result.lines[0].moves).toBe(original.moves);
      expect(result.lines[0].libraryCorrection).toBeUndefined();
    }
  });

  it('marks an unchanged library formula so F2L keeps its wide-turn notation', async () => {
    const original = { ...line("l F l' L U L'"), kind: 'f2l' as const, key: 'slot-FR' };
    const result = await correctLibraryLine(original, [{ alg: "l F l' L U L'" }]);
    expect(result.moves).toEqual(original.moves);
    expect(result.libraryCorrection?.algorithm).toBe("l F l' L U L'");
    expect(result.libraryCorrection?.originalLine).toBe(original);
  });

  it('matches F2L wide formulas through the shared library pipeline without changing pair labels', async () => {
    const formula = "U r' U R U' R' U' r y";
    const original = { ...line("U r' U R U' R' U' r"), kind: 'f2l' as const, key: 'slot-FR', label: 'GO' };
    const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
    const load = vi.fn(async () => ({ cases: [{ name: 'W+', algs: [[{ alg: formula }]] }] }) as AlgFile);
    const result = await correctReconFromLibrary(recon, load);
    expect(load).toHaveBeenCalledWith('f2l');
    expect(result.lines[0].moves).toEqual(original.moves);
    expect(result.lines[0].label).toBe('GO');
    expect(result.lines[0].libraryCorrection?.algorithm).toBe(formula);
    await equivalent(original.moves, result.lines[0].moves);
    expect(await correctReconFromLibrary(recon, async () => { throw new Error('offline'); })).toBe(recon);
  });

  it('does not replace recorded F2L turns with an equivalent wide-turn fingertrick', async () => {
    const original = { ...line("U2 L' U' L y' U' R U R'"), kind: 'f2l' as const, label: 'BR' };
    const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
    const result = await correctReconFromLibrary(recon, async () => ({
      cases: [{ name: 'V-', algs: [[{ alg: "U L' U' L d' L U L'" }]] }],
    }) as AlgFile);
    expect(result).toBe(recon);
  });

  it('excludes boundary AUF marked as waste while preserving its moves and grouping', async () => {
    const original = line(`U U U ${observed} U U U`);
    original.wasteGroups = original.moves.map((_, i) => i < 3 ? 1 : i >= original.moves.length - 3 ? 2 : null);
    const result = await correctLibraryLine(original, [{ alg: library }]);
    expect(result.moves.join(' ')).toBe(`U U U ${body} U U U`);
    expect(formattedReconMoves(result).join(' ')).toBe(`(U U U) ${body} (U U U)`);
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
    const expected = `y' ${body} y`;
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
    expect(formattedReconMoves(result).join(' ')).toBe(`U2' ${body} U'`);
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
    expect(formattedReconMoves(result).join(' ')).toBe("U2 R2' U R U R' U' R3 U' R' U R'");
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

  it('matches Y75NNSz_o-w Gd when a waste bracket includes a useful net R', async () => {
    const original = line("U' R R' R U R' E' F2 U' F U' F' U F' U F2 E U");
    original.wasteGroups = original.moves.map((_, i) => i >= 1 && i <= 3 ? 1 : null);
    const snapshot = structuredClone(original);
    const result = await correctLibraryLine(original, [{ alg: "U (R U R' U'D) (R2 U' R U') (R' U R' U) R2 D'" }]);
    expect(result.libraryCorrection).toBeDefined();
    expect(result.moves.join(' ')).toBe("U' R R' R U R' U' D R2 U' R U' R' U R' U R2 D' U U");
    expect(result.moveRanges?.slice(0, 4)).toEqual(original.moveRanges?.slice(0, 4));
    expect(original).toEqual(snapshot);
    await equivalent(original.moves, result.moves);
  });

  it('waits for a normal three-second library response instead of silently abandoning correction', async () => {
    vi.useFakeTimers();
    try {
      const original = line(observed);
      const recon = { inspection: '', lines: [original], text: '' } as ReconTextResult;
      let settled = false;
      const job = correctReconFromLibrary(recon, () => new Promise(resolve => {
        setTimeout(() => resolve({ cases: [] } as unknown as AlgFile), 3000);
      })).then(result => { settled = true; return result; });
      await vi.advanceTimersByTimeAsync(2501);
      expect(settled).toBe(false);
      await vi.runAllTimersAsync();
      expect(await job).toBe(recon);
      expect(settled).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('does not accept similar but inequivalent formulas, including changed end orientation', async () => {
    const original = line(observed);
    expect(await correctLibraryLine(original, [{ alg: `${body} R` }])).toBe(original);
    const wrong = line(observed.replace("x'", 'x'));
    expect(await correctLibraryLine(wrong, [{ alg: library }])).toBe(wrong);
  });

  it('uses library order for strictly identical normalized variants', async () => {
    const original = line(observed);
    // These local identity pairs are equal under the agreed strict normalization.
    const first = `${body.slice(0, 2)}R R' ${body.slice(2)}`;
    const second = `${body.slice(0, 2)}L L' ${body.slice(2)}`;
    expect((await correctLibraryLine(original, [{ alg: first }, { alg: second }])).libraryCorrection?.algorithm).toBe(first);
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
    expect(corrected.text).toContain(`U2' ${body} // PLL-Y`);
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
      await vi.advanceTimersByTimeAsync(15001);
      expect(await result).toBe(recon);
    } finally { vi.useRealTimers(); }
  });
});


it('matches the reported PLL-E to the library and retains its actual final frame and replay', async () => {
  const source = line("R B' R' F R B R' F' R B R' F l U' R' D'");
  source.label = 'PLL-E';
  const formula = "x'· (R U' R' D) (R U R' D') (R U R' D) (R U' R' D') x";
  const result = await correctLibraryLine(source, [{ alg: formula }]);
  expect(formattedReconMoves(result).join(' ')).toBe("x' R U' R' D R U R' D' R U R' D R U' R' D'");
  expect(result.libraryCorrection?.algorithm).toBe(formula);
  await equivalent(source.moves, result.moves);
  const raw = source.moves.map((m, i) => ({ m, ts: (i + 1) * 100 }));
  expect(reconstructedTrack([result], raw)?.map(move => move.m)).toEqual(result.moves);
  const restored = originalReconNotation({ lines: [result], inspection: '', text: '' } as ReconTextResult);
  expect(restored.lines[0]).toBe(source);
  expect(restored.text).toContain(source.moves.join(' '));
});

it('rejects a globally equivalent algorithm with a different execution path', async () => {
  const original = line(body);
  const alternative = `${body} ${Array(6).fill("R U R' U'").join(' ')}`;
  await equivalent(original.moves, alternative.split(' '));
  expect(await correctLibraryLine(original, [{ alg: alternative }])).toBe(original);
});

it('normalizes opposite-face order, slice/wide expansion, half turns and local cancellation', () => {
  expect(strictOuterForm(['L', 'R', "R'", 'R', 'U', 'U']).key).toBe(strictOuterForm(['R', 'L', 'U2']).key);
  expect(strictOuterForm(['M', 'U', 'r', 'F']).key).toBe(strictOuterForm(['R', "L'", "x'", 'U', 'x', 'L', 'F']).key);
});

it.each(['oll', 'pll', 'zbll', 'coll', 'ollcp', '1lll', 'ell', 'zbls', 'vls', 'wv', 'sv'])(
  'routes %s through the same strict matcher and retains unmatched text', async set => {
    const original = { ...line(observed), kind: 'oll' as const, label: set.toUpperCase() };
    const recon = { lines: [original], inspection: '', text: observed } as ReconTextResult;
    const load = vi.fn(async () => ({ cases: [{ name: 'test', algs: [[{ alg: library }]] }] }) as AlgFile);
    const result = await correctReconFromLibrary(recon, load);
    expect(load).toHaveBeenCalledWith(set);
    expect(result.lines[0].libraryCorrection?.algorithm).toBe(library);
    expect(await correctReconFromLibrary(recon, async () => ({ cases: [{ name: 'other', algs: [[{ alg: 'R U' }]] }] }) as AlgFile)).toBe(recon);
  });

it('accepts library grouping and glued opposite faces without discarding the grouping', async () => {
  const formula = "M(R U R' U R U2' R') U M'";
  const original = line("L' R2 B R' B R B2 R' B L R'");
  const result = await correctLibraryLine(original, [{ alg: formula }]);
  expect(result.libraryCorrection?.algorithm).toBe(formula);
  expect(formattedReconMoves(result).join(' ')).toBe("M R U R' U R U2' R' U M'");
  await equivalent(original.moves, result.moves);
  expect((await correctLibraryLine(line('R L U'), [{ alg: 'LR U' }])).moves).toEqual(['L', 'R', 'U']);
});

it('checks outer expansion and residual orientation against cubing.js for all primitive pairs', async () => {
  const kp = await getCube3();
  const tokens = [...'URFDLBMESxyzurfdlb'].flatMap(face => [face, `${face}'`, `${face}2`]);
  const state = (text: string) => {
    const { EDGES, CORNERS, CENTERS } = kp.defaultPattern().applyAlg(text).patternData;
    return JSON.stringify([EDGES, CORNERS, CENTERS.pieces]);
  };
  for (const a of tokens) for (const b of tokens) {
    const form = strictOuterForm([a, b]);
    expect(state([form.key, ...form.rotation].join(' ')), `${a} ${b}`).toBe(state(`${a} ${b}`));
  }
});

it('closes groups correctly when a library final rotation cancels with the recorded frame', async () => {
  const source = line("R B' R' F R B R' F' R B R' F l U' R' D'");
  const formula = "(x' R U' R' D R U R' D' R U R' D R U' R' D' x)";
  const result = await correctLibraryLine(source, [{ alg: formula }]);
  expect(result.algorithmGroups).toEqual([{ from: 0, to: 17 }]);
  expect(formattedReconMoves(result).join(' ')).toBe("x' R U' R' D R U R' D' R U R' D R U' R' D'");
});

it.each(['oll', 'pll', 'zbll', 'coll', 'ollcp', '1lll', 'ell', 'zbls', 'vls', 'wv', 'sv'])(
  'uses %s library primary names in displayed, copied and original notation', async set => {
    const original = { ...line(observed), label: `${set.toUpperCase()}-legacy/PLL Skip` };
    const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
    const result = await correctReconFromLibrary(recon, async () => ({ cases: [{
      name: 'legacy', meta: { ollcp: `${set.toUpperCase()}-Canonical` }, algs: [[{ alg: library }]],
    }] }) as unknown as AlgFile);
    const expected = `${set.toUpperCase()}-Canonical/PLL Skip`;
    expect(result.lines[0].label).toBe(expected);
    expect(result.text).toContain(`// ${expected}`);
    expect(originalReconNotation(result).lines[0].label).toBe(expected);
    expect(originalReconNotation(result).lines[0].moves).toEqual(original.moves);
  },
);

it('names an unlabelled recognized family only from the uniquely matched library case', async () => {
  const recon = { lines: [{ ...line(observed), label: 'OLL' }], inspection: '', text: '' } as ReconTextResult;
  const result = await correctReconFromLibrary(recon, async () => ({ cases: [
    { name: 'wrong', meta: { ollcp: 'OLL-Wrong' }, algs: [[{ alg: 'R U' }]] },
    { name: 'right', meta: { ollcp: 'OLL-Right' }, algs: [[{ alg: library }]] },
  ] }) as unknown as AlgFile);
  expect(result.lines[0].label).toBe('OLL-Right');
});

it('recognizes last-slot ZBLS without moving the recorded mid-formula regrip', async () => {
  const original = { ...line("U R U R' U y' R' U' R"), kind: 'f2l' as const, label: 'RB/ZBLS' };
  const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
  const result = await correctReconFromLibrary(recon, async () => ({
    cases: [{ name: 'V T', algs: [[{ alg: "U' (R U R' U) F' U' F" }]] }],
  }) as AlgFile);
  expect(result.lines[0].label).toBe('RB/ZBLS-V T');
  expect(result.lines[0].libraryCorrection).toBeDefined();
  expect(result.lines[0].moves).toEqual(original.moves);
  expect(result.lines[0].moveRanges).toEqual(original.moveRanges);
  await equivalent(result.lines[0].moves, original.moves);
});

it('keeps a measured last-slot wide gesture instead of substituting a front-face library path', async () => {
  const original = { ...line("y d U R' U2' R U' R' U R"), kind: 'f2l' as const, label: "OB/ZBLS-Q T'" };
  const recon = { lines: [original], inspection: '', text: '' } as ReconTextResult;
  const result = await correctReconFromLibrary(recon, async () => ({
    cases: [{ name: "Q T'", algs: [[{ alg: "U2 F' U2 F U' F' U F" }]] }],
  }) as AlgFile);
  expect(result.lines[0].moves).toEqual(original.moves);
  expect(result.lines[0].moveRanges).toEqual(original.moveRanges);
  expect(result.lines[0].label).toBe(original.label);
  expect(result.lines[0].libraryCorrection).toBeUndefined();
});

it('loads independent reconstruction libraries concurrently and shares F2L requests', async () => {
  const pending = new Map<string, (file: AlgFile) => void>();
  const load = vi.fn((set: string) => new Promise<AlgFile>(resolve => pending.set(set, resolve)));
  const recon = { inspection: '', text: '', lines: [
    { ...line('R U'), kind: 'f2l' as const, label: 'FR' },
    { ...line('L U'), kind: 'f2l' as const, label: 'FL' },
    { ...line('R U'), label: 'OLL' },
    { ...line('R U'), label: 'PLL' },
  ] } as ReconTextResult;
  const result = correctReconFromLibrary(recon, load);
  await Promise.resolve();
  expect([...pending.keys()]).toEqual(['f2l', 'oll', 'pll']);
  for (const resolve of pending.values()) resolve({ cases: [] } as unknown as AlgFile);
  expect(await result).toBe(recon);
  expect(load).toHaveBeenCalledTimes(3);
});

it('fingerprint reuse respects changed library contents and current case identity', async () => {
  const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const cases = [{ name: 'first', algs: [[{ alg }]] }] as AlgFile['cases'];
  expect(await identifyLibraryCase({ moves: alg.split(' ') }, cases, 'pll')).toBe(cases[0]);
  const refreshed = [{ name: 'renamed', algs: [[{ alg }]] }] as AlgFile['cases'];
  expect(await identifyLibraryCase({ moves: alg.split(' ') }, refreshed, 'pll')).toBe(refreshed[0]);
  refreshed[0].algs[0][0].alg = 'R U';
  expect(await identifyLibraryCase({ moves: alg.split(' ') }, refreshed, 'pll')).toBeUndefined();
});
