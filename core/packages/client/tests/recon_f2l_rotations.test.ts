import { findCheckoutRoot, readWorkbookCases } from '@/lib/recon-test-history.server';
const approvedCases = new Set(readWorkbookCases(findCheckoutRoot()!).filter(sample => sample.approved).map(sample => sample.id));
import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { compactCubeRotations, conjugateSequence, facePermFor } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { formatReconLine, simplifyF2lRotations, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';

function fixture(moves: string[], kind: ReconTextLine['kind'] = 'f2l'): ReconTextResult {
  const line: ReconTextLine = { kind, key: 'slot-FR', moves, fromIdx: 3, toIdx: 8,
    label: 'FR', recognitionMs: 20, executionMs: 400, stepMs: 420,
    moveRanges: moves.map((token, i) => ({ token, ts: i * 100, endTs: i * 100,
      startIdx: 3, endIdx: 2 })),
  };
  return { scramble: 'R U F', inspection: 'z2', lines: [line], text: `z2 // insp\n${formatReconLine(line)}`,
    turns: 6, stm: 6, seconds: 1, tps: 6, rotations: [], blindPairs: 0 };
}

it.each([
  ["U R2 R'", "x z y x'"],
  ["U R2 R'", "x'"],
  ["U R2 U' S' U2' S U' R2 U2", "x z y x'"],
  ["x R U R' x' U", 'y'],
])('omits only solved final regrips after %s', (body, tail) => {
  const recon = fixture(`${body} ${tail}`.split(' '), 'pll');
  recon.inspection = '';
  recon.scramble = new Alg(body).invert().toString();
  recon.text = formatReconLine(recon.lines[0]);
  const before = JSON.stringify(recon);
  const shown = simplifyF2lRotations(recon);
  expect(shown.lines[0].moves.join(' ')).toBe(body);
  expect(shown.lines[0].moveRanges).toHaveLength(body.split(' ').length);
  expect(shown.text).toBe(formatReconLine(shown.lines[0]));
  expect(JSON.stringify(recon)).toBe(before);
  const unfinished = { ...recon, scramble: `${recon.scramble} U` };
  expect(simplifyF2lRotations(unfinished)).toBe(unfinished);
});

it('keeps library bodies intact and maps synthetic y turns to empty encoder ranges', async () => {
  const recon = fixture("F U F' U F U' F'".split(' '));
  const library: ReconTextLine = { ...recon.lines[0], key: 'library', moves: "R U R' U R U' R'".split(' ') };
  library.libraryCorrection = { algorithm: library.moves.join(' '), originalMoves: library.moves,
    originalRanges: library.moveRanges! };
  recon.lines.push(library);
  const before = JSON.stringify(recon);
  const result = simplifyF2lRotations(recon);
  expect(result.inspection).not.toBe(recon.inspection);
  expect(result.lines[0].moves.some(move => /^[FB]/.test(move))).toBe(false);
  expect(result.lines[1].moves.slice(1)).toEqual(library.moves);
  const rotation = result.lines[1].moveRanges![0];
  expect(rotation.endIdx).toBe(rotation.startIdx - 1);
  expect(result.lines[1].algorithmGroups).toEqual(library.algorithmGroups);
  const cube = await getCube3();
  expect(cube.algToTransformation(`${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`)
    .isIdentical(cube.algToTransformation(`${recon.inspection} ${recon.lines.flatMap(line => line.moves).join(' ')}`))).toBe(true);
  expect(JSON.stringify(recon)).toBe(before);
});

it('restores a matched last-layer library yaw after cross-down changes the face names', async () => {
  const algorithm = "(R U R' F') (R U R' U') (R' F R2 U' R') U'";
  const canonical = "R U R' F' R U R' U' R' F R2 U' R'";
  const cube = await getCube3();
  for (const yaw of ['', 'y', 'y2', "y'"]) {
    const moves = conjugateSequence(`U ${canonical} U2`, facePermFor(yaw))!.split(' ');
    const recon = fixture(moves, 'pll');
    recon.inspection = '';
    const line = recon.lines[0];
    line.moveRanges = moves.map((token, i) => ({ token, ts: i * 100, endTs: i * 100,
      startIdx: 3 + i, endIdx: 3 + i }));
    line.libraryCorrection = { algorithm, originalMoves: moves, originalRanges: line.moveRanges! };
    line.algorithmGroups = [{ from: 1, to: 5 }, { from: 5, to: 9 }, { from: 9, to: 14 }];
    const before = JSON.stringify(recon);
    const shown = simplifyF2lRotations(recon);
    expect(shown.lines[0].moves.join(' '), yaw).toContain(`U ${canonical} U2`);
    expect(cube.algToTransformation(shown.lines[0].moves.join(' '))
      .isIdentical(cube.algToTransformation(moves.join(' '))), yaw).toBe(true);
    expect(shown.lines[0].moveRanges!.filter(range => range.endIdx >= range.startIdx)
      .map(({ token: _token, ...range }) => range))
      .toEqual(line.moveRanges!.map(({ token: _token, ...range }) => range));
    if (yaw) {
      expect(shown.lines[0].moveRanges![0].endIdx).toBe(shown.lines[0].moveRanges![0].startIdx - 1);
      expect(shown.lines[0].algorithmGroups).toEqual([{ from: 2, to: 6 }, { from: 6, to: 10 }, { from: 10, to: 15 }]);
    }
    expect(JSON.stringify(recon)).toBe(before);
  }
});

it('carries the F2L reading frame into an unmatched OLL instead of inventing a regrip', async () => {
  const recon = fixture("F U F' U F U' F'".split(' '));
  recon.inspection = '';
  const oll = { ...fixture("S B U B' U B U2' B' U S'".split(' '), 'oll').lines[0], key: 'oll' };
  const pll = { ...fixture("R U R' F' R U R' U' R' F R2 U' R'".split(' '), 'pll').lines[0], key: 'pll' };
  pll.libraryCorrection = { algorithm: pll.moves.join(' '), originalMoves: pll.moves, originalRanges: pll.moveRanges! };
  recon.lines.push(oll, pll);
  const before = JSON.stringify(recon);
  const shown = simplifyF2lRotations(recon);
  expect(shown.lines.find(line => line.key === 'oll')!.moves.some(token => /^[xyz]/.test(token))).toBe(false);
  const cube = await getCube3();
  expect(cube.algToTransformation(`${shown.inspection} ${shown.lines.flatMap(line => line.moves).join(' ')}`)
    .isIdentical(cube.algToTransformation(recon.lines.flatMap(line => line.moves).join(' ')))).toBe(true);
  expect(JSON.stringify(recon)).toBe(before);
});

it('cancels an empty reading-frame prefix when restoring the library yaw', async () => {
  const canonical = "R U R' F' R U R' U' R' F R2 U' R'";
  const moves = ["y'", ...conjugateSequence(canonical, facePermFor("y'"))!.split(' ')];
  const recon = fixture(moves, 'pll');
  recon.inspection = '';
  const line = recon.lines[0];
  line.moveRanges = moves.map((token, i) => ({ token, ts: i * 100, endTs: i * 100, startIdx: i, endIdx: i ? i : -1 }));
  line.libraryCorrection = { algorithm: canonical, originalMoves: moves, originalRanges: line.moveRanges };
  const shown = simplifyF2lRotations(recon);
  expect(shown.lines[0].moves.join(' ')).toBe(`${canonical} y'`);
  expect(shown.lines[0].moveRanges!.filter(range => range.endIdx >= range.startIdx).map(range => range.startIdx))
    .toEqual(line.moveRanges.slice(1).map(range => range.startIdx));
  const cube = await getCube3();
  expect(cube.algToTransformation(shown.lines[0].moves.join(' '))
    .isIdentical(cube.algToTransformation(moves.join(' ')))).toBe(true);
});

it('handles perpendicular long triggers within the same F2L stage', async () => {
  const recon = fixture("F U F' U F U' F' R U R' U R U' R'".split(' '));
  const result = simplifyF2lRotations(recon);
  expect(result.lines[0].moves.filter(move => /^[FB]/.test(move))).toEqual([]);
  expect(result.lines[0].moveRanges).toHaveLength(result.lines[0].moves.length);
  const cube = await getCube3();
  expect(cube.algToTransformation(`${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`)
    .isIdentical(cube.algToTransformation(`${recon.inspection} ${recon.lines.flatMap(line => line.moves).join(' ')}`))).toBe(true);
});

it('preserves the full cube transformation for every three-rotation combination', async () => {
  const cube = await getCube3();
  const tokens = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  for (const a of tokens) for (const b of tokens) for (const c of tokens) {
    const input = `${a} ${b} ${c}`;
    expect(cube.algToTransformation(input).isIdentical(cube.algToTransformation(compactCubeRotations(input))), input).toBe(true);
  }
});

it('cancels only contiguous F2L rotations, retaining source records and remapping annotations', () => {
  const recon = fixture(["x'", 'x', 'y', 'U', "x'", 'R', 'x']);
  recon.lines[0].algorithmGroups = [{ from: 3, to: 7 }];
  recon.lines[0].wasteGroups = [null, null, null, 1, 1, 1, 1];
  const original = JSON.stringify(recon);
  const result = simplifyF2lRotations(recon);
  expect(result.lines[0].moves).toEqual(['y', 'U', 'R']);
  expect(result.lines[0].moveRanges?.[0]).toMatchObject({ token: 'y', ts: 0, endTs: 200, startIdx: 3, endIdx: 2 });
  expect(result.lines[0].moveRanges?.[1]).toBe(recon.lines[0].moveRanges?.[3]);
  expect(result.lines[0].algorithmGroups).toEqual([{ from: 1, to: 3 }]);
  expect(result.lines[0].wasteGroups).toEqual([null, 1, 1]);
  expect(result.rotations).toBe(recon.rotations);
  expect(JSON.stringify(recon)).toBe(original);
});

it('handles identity and half turns without crossing stage or layer boundaries', () => {
  expect(simplifyF2lRotations(fixture(["x'", 'x'])).lines[0].moves).toEqual([]);
  expect(simplifyF2lRotations(fixture(['x', 'x', 'U'])).lines[0].moves).toEqual(['D']);
  for (const kind of ['cross', 'oll', 'pll'] as const) {
    const recon = fixture(["x'", 'x'], kind);
    expect(simplifyF2lRotations(recon)).toBe(recon);
  }
  const recon = fixture(['x']);
  recon.lines.push({ ...recon.lines[0], key: 'slot-BR', moves: ["x'"] });
  expect(simplifyF2lRotations(recon).lines.map(line => line.moves)).toEqual([[], []]);
  const layers = fixture(["x'", 'M', 'x', 'R', "x'"]);
  expect(simplifyF2lRotations(layers).lines[0].moves).toEqual(['M', 'R']);
});

it('rewrites E-wrapped BU/FU runs with equivalent outer turns and net rotation', async () => {
  const cube = await getCube3();
  const sample = fixture(['E', 'B', "U'", "B'", "E'"]);
  const saved = JSON.stringify(sample);
  const shown = simplifyF2lRotations(sample);
  expect(shown.lines[0].moves).toEqual(['U', "D'", 'R', "U'", "R'", "U'", 'D']);
  expect(shown.lines[0].moveRanges?.map(range => range.ts)).toEqual([0, 0, 100, 200, 300, 400, 400]);
  expect(JSON.stringify(sample)).toBe(saved);
  for (const a of ['E', "E'", 'E2', "E2'"]) {
    for (const b of ['E', "E'", 'E2', "E2'"]) {
      for (const face of ['B', 'F']) {
        const moves = ['R', a, face, 'U2', `${face}'`, "U'", b, "R'"];
        const output = simplifyF2lRotations(fixture(moves)).lines[0].moves.join(' ');
        expect(cube.algToTransformation(output).isIdentical(cube.algToTransformation(moves.join(' '))), output).toBe(true);
      }
    }
  }
  for (const moves of [['E', 'B', 'U', 'F', "E'"], ['E', 'R', 'U', "E'"], ['E', 'B', 'U']]) {
    const recon = fixture(moves);
    expect(simplifyF2lRotations(recon)).toBe(recon);
  }
});

it('expands isolated F2L wide turns while preserving closed triggers, library formulas and source ranges', async () => {
  const cube = await getCube3();
  for (const face of ['r', 'l', 'u', 'd', 'f', 'b', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw']) {
    for (const suffix of ['', "'", '2', "2'"]) {
      const token = face + suffix;
      const recon = fixture([token, 'U', "R'"]);
      const original = JSON.stringify(recon);
      const shown = simplifyF2lRotations(recon);
      const line = shown.lines[0];
      expect(line.moves.some(move => /^([rludfb]|[RLUDFB]w)/.test(move))).toBe(false);
      expect(cube.algToTransformation(shown.lines.flatMap(row => row.moves).join(' ')).isIdentical(cube.algToTransformation(recon.lines[0].moves.join(' '))), token).toBe(true);
      expect(line.moveRanges?.map(range => range.ts)).toEqual(/^[ud]/i.test(face) ? [0, 0, 100, 200] : [0, 100, 200]);
      expect(JSON.stringify(recon)).toBe(original);
      for (const kind of ['cross', 'oll', 'pll'] as const) {
        const other = fixture([token], kind);
        expect(simplifyF2lRotations(other)).toBe(other);
      }
      recon.lines[0].libraryCorrection = { algorithm: recon.lines[0].moves.join(' '),
        originalMoves: recon.lines[0].moves, originalRanges: recon.lines[0].moveRanges! };
      expect(simplifyF2lRotations(recon)).toBe(recon);
    }
  }
  expect(simplifyF2lRotations(fixture(['l', 'F', "l'", 'L', 'U', "L'"])).lines[0].moves)
    .toEqual(['l', 'F', "l'", 'L', 'U', "L'"]);
});

it('keeps the reported 12.99 solve cross down after every F2L row and carries its frame into OLL/PLL', async () => {
  const { solved } = await import('@cuberoot/shared/timer/reconstruct/state');
  const { applyOneToken } = await import('@cuberoot/shared/timer/reconstruct/apply-token');
  const { isCross } = await import('@cuberoot/shared/timer/reconstruct/cfop-detect');
  const cube = await getCube3();
  const recon = fixture([]);
  recon.scramble = "D U' B' F2 U2 B2 D2 L R D U2 L' U2 B' R2 F D2 B2 U2";
  recon.inspection = 'x2 y';
  const rows: Array<[ReconTextLine['kind'], string]> = [
    ['cross', "F' D R' F L B2 D D D"],
    ['f2l', "L' U' L"],
    ['f2l', "l F l' L U L'"],
    ['f2l', "U2 R' U2' R U' R' U R"],
    ['f2l', "U U U F' U F U l F R'"],
    ['oll', "R F2' R' F' R F' R'"],
    ['pll', "F2 R F R' F' R' D R2 F' R' F' R F l' F' U'"],
  ];
  recon.lines = rows.map(([kind, moves], i) => ({ ...fixture(moves.split(' '), kind).lines[0], key: `row-${i}` }));
  const original = JSON.stringify(recon);
  const shown = simplifyF2lRotations(recon);
  let state = solved(3);
  for (const token of `${recon.scramble} ${recon.inspection}`.split(' ')) state = applyOneToken(state, token);
  const down = state.D[4];
  for (const row of shown.lines) {
    for (const token of row.moves) state = applyOneToken(state, token);
    if (row.kind === 'f2l') {
      expect(row.moves.some(token => /^[xz]/.test(token))).toBe(false);
      if (row.key === 'row-2') expect(row.moves).toEqual(rows[2][1].split(' '));
      else expect(row.moves.some(token => /^[rludfb]/.test(token))).toBe(false);
      expect(state.D[4], row.key).toBe(down);
      expect(isCross(state), row.key).toBe(true);
    }
  }
  expect(shown.lines[4].moves).toEqual(['U', 'U', 'U', "F'", 'U', 'F', 'U', 'R', 'U', "R'"]);
  // Solved regrips are deliberately omitted; only the final whole-cube frame may differ.
  const target = cube.algToTransformation(recon.lines.flatMap(row => row.moves).join(' '));
  expect(['', 'x', "x'", 'x2', 'z', "z'"].some(tilt => ['', 'y', 'y2', "y'"].some(yaw =>
    cube.algToTransformation(`${shown.lines.flatMap(row => row.moves).join(' ')} ${tilt} ${yaw}`).isIdentical(target)))).toBe(true);
  expect([state.U, state.D, state.F, state.B, state.L, state.R]
    .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
  expect(JSON.stringify(recon)).toBe(original);
});

it('preserves full transforms when tilts cross F2L rows, y rotations and library formulas', async () => {
  const cube = await getCube3();
  for (const a of ['x', "x'", 'x2', 'z', "z'", 'z2']) {
    for (const b of ['x', "x'", 'x2', 'z', "z'", 'z2']) {
      const recon = fixture([a, 'F', 'y', 'U']);
      const next = fixture([b, 'R', 'y2', 'B']).lines[0];
      recon.lines.push({ ...next, key: 'slot-BR' });
      const library = fixture(['r', 'U', "r'", 'z', 'F']).lines[0];
      library.libraryCorrection = { algorithm: library.moves.join(' '), originalMoves: library.moves, originalRanges: library.moveRanges! };
      recon.lines.push({ ...library, key: 'slot-BL' });
      const output = simplifyF2lRotations(recon);
      expect(cube.algToTransformation(output.lines.flatMap(row => row.moves).join(' ')).isIdentical(
        cube.algToTransformation(recon.lines.flatMap(row => row.moves).join(' '))), `${a} ${b}`).toBe(true);
      for (const row of output.lines.filter(row => row.kind === 'f2l' && !row.libraryCorrection)) {
        expect(row.moves.some(token => /^[xz]/.test(token))).toBe(false);
      }
    }
  }
});

it('restores the cross after a slice-ending F2L even for library formulas, preserving later moves', async () => {
  const { solved } = await import('@cuberoot/shared/timer/reconstruct/state');
  const { applyOneToken } = await import('@cuberoot/shared/timer/reconstruct/apply-token');
  const { isCross } = await import('@cuberoot/shared/timer/reconstruct/cfop-detect');
  const { invertAlg } = await import('@cuberoot/shared/recon/cube3');
  const cube = await getCube3();
  for (const library of [false, true]) for (const kind of ['cross', 'f2l'] as const) {
    const moves = "U' R U R' L' B' R B M'".split(' ');
    const recon = fixture(moves, kind);
    recon.inspection = '';
    recon.scramble = await invertAlg(`${moves.join(' ')} x'`);
    if (library) recon.lines[0].libraryCorrection = { algorithm: moves.join(' '), originalMoves: moves,
      originalRanges: recon.lines[0].moveRanges! };
    recon.lines.push({ ...fixture(['U', 'U2', "U'"], 'oll').lines[0], key: 'oll' });
    const original = JSON.stringify(recon);
    const output = simplifyF2lRotations(recon);
    expect(output.lines[0].moves).toEqual([...moves, "x'"]);
    let state = applyOneToken(solved(3), recon.scramble);
    const down = state.D[4];
    state = applyOneToken(state, output.lines[0].moves.join(' '));
    expect(state.D[4]).toBe(down);
    expect(isCross(state)).toBe(true);
    expect(cube.algToTransformation(output.lines.flatMap(row => row.moves).join(' ')).isIdentical(
      cube.algToTransformation(recon.lines.flatMap(row => row.moves).join(' ')))).toBe(true);
    expect(JSON.stringify(recon)).toBe(original);
  }
});

it.skipIf(!approvedCases.has('QmqeMxJEBzA'))('keeps every cross/F2L boundary down in QmqeMxJEBzA, including its M-prime finish', async () => {
  const { solved } = await import('@cuberoot/shared/timer/reconstruct/state');
  const { applyOneToken } = await import('@cuberoot/shared/timer/reconstruct/apply-token');
  const { isCross } = await import('@cuberoot/shared/timer/reconstruct/cfop-detect');
  const cube = await getCube3();
  const recon = fixture([]);
  recon.scramble = "R2 U2 B2 R F' U R2 B' U F' D F2 L' D B2 F' D";
  recon.inspection = 'x2';
  const rows: Array<[ReconTextLine['kind'], string]> = [
    ['cross', "L D' R F' D L"],
    ['f2l', "U R U' R'"],
    ['f2l', "U y L U' L'"],
    ['f2l', "U' R U x' R' L' U' R U M'"],
    ['f2l', "R U2' R' U R U2' R' U y' R' U' R"],
    ['oll', "x' F2 x R U' r' F R' F L F L' F L"],
    ['pll', "x U' R2 U' x' y' E' R2' x S R' D2"],
  ];
  recon.lines = rows.map(([kind, moves], i) => ({ ...fixture(moves.split(' '), kind).lines[0], key: `row-${i}` }));
  const output = simplifyF2lRotations(recon);
  let state = applyOneToken(solved(3), `${recon.scramble} ${recon.inspection}`);
  const down = state.D[4];
  for (const row of output.lines) {
    state = applyOneToken(state, row.moves.join(' '));
    if (row.kind === 'cross' || row.kind === 'f2l') {
      expect(state.D[4], row.key).toBe(down);
      expect(isCross(state), row.key).toBe(true);
    }
  }
  expect(output.lines[3].moves.slice(-2)).toEqual(["M'", "x'"]);
  // Solved regrips are deliberately omitted; only the final whole-cube frame may differ.
  const target = cube.algToTransformation(recon.lines.flatMap(row => row.moves).join(' '));
  expect(['', 'x', "x'", 'x2', 'z', "z'"].some(tilt => ['', 'y', 'y2', "y'"].some(yaw =>
    cube.algToTransformation(`${output.lines.flatMap(row => row.moves).join(' ')} ${tilt} ${yaw}`).isIdentical(target)))).toBe(true);
  expect([state.U, state.D, state.F, state.B, state.L, state.R]
    .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
});

it('never leaves z in F2L, including library formulas and stage-end corrections', async () => {
  const cube = await getCube3();
  const { invertAlg } = await import('@cuberoot/shared/recon/cube3');
  const { solved } = await import('@cuberoot/shared/timer/reconstruct/state');
  const { applyOneToken } = await import('@cuberoot/shared/timer/reconstruct/apply-token');
  const { isCross } = await import('@cuberoot/shared/timer/reconstruct/cfop-detect');
  for (const suffix of ['', "'", '2', "2'"]) {
    const recon = fixture(['B2', 'y', `z${suffix}`, 'R', "U2'", "R2'", "U'", 'R']);
    recon.lines[0].libraryCorrection = { algorithm: recon.lines[0].moves.join(' '),
      originalMoves: recon.lines[0].moves, originalRanges: recon.lines[0].moveRanges! };
    recon.lines.push({ ...fixture(['U', "FS'", 'R'], 'oll').lines[0], key: 'oll' });
    const output = simplifyF2lRotations(recon);
    expect(output.lines.filter(row => row.kind === 'f2l').flatMap(row => row.moves).some(token => /^z/.test(token))).toBe(false);
    const tokens = (value: ReconTextResult) => value.lines.flatMap(row => row.moves)
      .flatMap(token => token.match(/[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g) ?? []).join(' ');
    expect(cube.algToTransformation(tokens(output)).isIdentical(cube.algToTransformation(tokens(recon)))).toBe(true);
  }
  // S moves the centres around z; restoring the cross must use x/y instead.
  const recon = fixture(['S']);
  recon.inspection = '';
  recon.scramble = await invertAlg("S z'");
  const output = simplifyF2lRotations(recon);
  expect(output.lines[0].moves).toEqual(['S', 'x', "y'", "x'"]);
  const state = applyOneToken(solved(3), `${recon.scramble} ${output.lines[0].moves.join(' ')}`);
  expect(state.D[4]).toBe('D');
  expect(isCross(state)).toBe(true);
  expect(cube.algToTransformation(output.lines.flatMap(row => row.moves).join(' ')).isIdentical(cube.algToTransformation('S'))).toBe(true);
});

it('preserves the reported closed wide F2L trigger without a library match', async () => {
  const moves = "R U' R' U2' f R f'".split(' ');
  const recon = fixture(moves);
  const original = JSON.stringify(recon);
  const shown = simplifyF2lRotations(recon);
  expect(shown.lines[0].moves).toEqual(moves);
  expect(shown.lines[0].moveRanges).toEqual(recon.lines[0].moveRanges);
  expect(JSON.stringify(recon)).toBe(original);
  const cube = await getCube3();
  expect(cube.algToTransformation(shown.lines[0].moves.join(' '))
    .isIdentical(cube.algToTransformation(moves.join(' ')))).toBe(true);
});
