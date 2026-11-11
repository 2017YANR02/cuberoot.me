import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { Alg } from 'cubing/alg';
import type { AlgFile } from '@cuberoot/shared/alg';
import { invert } from '@cuberoot/shared/skewb-notation';
import { applySq1Move, applySq1Scramble, parseSq1Tokens, isSq1Solved } from '@cuberoot/shared/sq1-notation';
import { COLOR_RGB, type CubeColor } from '@cuberoot/shared/cube-photo/recognize';
import { completePhotoColors, findPuzzlePhotoAlgs, photoPuzzleSolved, recoverPhotoSq1, puzzlePhotoAdjustment } from '@/lib/cube-photo/puzzle-lookup';
import { initialPhotoBounds, puzzlePhotoCells, projectPhotoPoint, samplePuzzlePhoto, type PhotoPuzzle } from '@/lib/cube-photo/puzzle-geometry';
import fixtures from './fixtures/cube-photo-puzzles.json';

import { skewbColors, pyraColors, sq1Colors, alignedSq1 } from './fixtures/cube-photo-puzzle-states';
const files = fixtures as AlgFile[];
const home = applySq1Scramble('');

describe('non-NxN photo lookup', () => {
  for (const file of files) for (const c of file.cases) it(`${file.puzzle}/${file.set}/${c.name}: recovers and verifies the catalog solution`, () => {
    const entry = c.algs.flat()[0];
    const puzzle = file.puzzle as PhotoPuzzle;
    const sq1 = puzzle === 'sq1' ? alignedSq1(entry.alg) : null;
    const colors = puzzle === 'skewb' ? skewbColors(invert(entry.alg)) : puzzle === 'pyraminx' ? pyraColors(new Alg(entry.alg).invert().toString()) : sq1Colors(sq1!);
    expect(completePhotoColors(puzzle, colors)).toBe(true);
    if (sq1) expect(recoverPhotoSq1(colors)).toEqual(sq1);
    const result = findPuzzlePhotoAlgs(puzzle, colors, { ...file, cases: [c] });
    expect(result.status).toBe('found');
    expect(result.match?.href).toMatch(new RegExp(`/alg/${puzzle}/`));
    for (const match of [result.match!, ...result.alternatives!]) {
      if (puzzle === 'skewb') {
        expect(photoPuzzleSolved(puzzle, skewbColors(`${invert(entry.alg)} ${match.alg}`))).toBe(true);
      } else if (puzzle === 'pyraminx') {
        expect(photoPuzzleSolved(puzzle, pyraColors(`${new Alg(entry.alg).invert()} ${match.alg}`))).toBe(true);
      } else {
        let state = sq1!;
        for (const token of parseSq1Tokens(match.alg)) {
          if (token.kind === 'slice') expect([0, 5, 12, 17].every((i, index) => state.pieces[i] !== state.pieces[[11, 6, 23, 18][index]])).toBe(true);
          state = applySq1Move(state, token);
        }
        expect(isSq1Solved(state)).toBe(true);
      }
    }
  });

  it('does not return algorithms for incomplete or corrupted observations', () => {
    const file = files[0], colors = skewbColors(invert(file.cases[0].algs.flat()[0].alg));
    const incomplete = { ...colors }; delete incomplete.B;
    expect(findPuzzlePhotoAlgs('skewb', incomplete, file).status).toBe('missing');
    colors.F[0] = colors.F[0] === 'white' ? 'yellow' : 'white';
    expect(findPuzzlePhotoAlgs('skewb', colors, file).status).toBe('missing');
    const sq1 = sq1Colors(home); sq1.U[0] = 'green';
    expect(recoverPhotoSq1(sq1)).toBeNull();
    expect(photoPuzzleSolved('sq1', sq1)).toBe(false);
  });

  it('handles tip-only and AUF-only states without loading a library', () => {
    const tips = "u l' r b'", pyra = puzzlePhotoAdjustment('pyraminx', pyraColors(tips));
    expect(pyra?.status).toBe('found');
    expect(photoPuzzleSolved('pyraminx', pyraColors(`${tips} ${pyra!.match!.alg}`))).toBe(true);
    const state = applySq1Scramble('(3, -3)'), sq1 = puzzlePhotoAdjustment('sq1', sq1Colors(state));
    expect(sq1?.status).toBe('found');
    expect(isSq1Solved(parseSq1Tokens(sq1!.match!.alg).reduce(applySq1Move, state))).toBe(true);
    expect(puzzlePhotoAdjustment('pyraminx', pyraColors(''))).toBeNull();
  });

  it('appends independently verified tip moves to a Pyraminx case', () => {
    const file = files.find(f => f.puzzle === 'pyraminx')!, alg = file.cases[0].algs.flat()[0].alg;
    const setup = `${new Alg(alg).invert()} u l' b`;
    const result = findPuzzlePhotoAlgs('pyraminx', pyraColors(setup), file);
    expect(result.status).toBe('found');
    expect(photoPuzzleSolved('pyraminx', pyraColors(`${setup} ${result.match!.alg}`))).toBe(true);
  });

  it('rejects malformed notation instead of silently dropping unknown moves', () => {
    for (const file of files.slice(0, 3)) {
      const puzzle = file.puzzle as 'skewb' | 'pyraminx', c = file.cases[0];
      const colors = puzzle === 'skewb' ? skewbColors(invert(c.algs.flat()[0].alg)) : pyraColors(new Alg(c.algs.flat()[0].alg).invert().toString());
      expect(findPuzzlePhotoAlgs(puzzle, colors, { ...file, cases: [{ ...c, algs: [[{ alg: `${c.algs.flat()[0].alg} nonsense` }]] }] }).status).toBe('missing');
    }
  });

  for (const puzzle of ['skewb', 'pyraminx', 'sq1'] as const) for (const face of puzzle === 'sq1' ? ['F', 'B', 'U', 'D'] : ['F']) it(`${puzzle}/${face}: samples every polygon through a photo`, async () => {
    const cells = puzzlePhotoCells(puzzle, face), bounds = initialPhotoBounds(puzzle, 600, 600);
    const palette: CubeColor[] = ['white', 'green', 'red', 'yellow', 'orange', 'blue'];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">${cells.map((cell, i) => `<polygon points="${cell.map(p => projectPhotoPoint(bounds, p)).map(p => `${p.x},${p.y}`).join(' ')}" fill="rgb(${COLOR_RGB[palette[i % 6]].join(',')})" stroke="black" stroke-width="3"/>`).join('')}</svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    const samples = samplePuzzlePhoto(pixels, bounds, cells);
    expect(samples.map(s => s.color)).toEqual(cells.map((_, i) => palette[i % 6]));
    expect(samples.every(s => s.reliable)).toBe(true);
    expect(samplePuzzlePhoto(pixels, bounds, cells, { 0: 'blue' })[0]).toMatchObject({ color: 'blue', corrected: true, reliable: true });
  });
});
