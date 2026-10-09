import { expect, it } from 'vitest';
import { getPuzzleGeometryByDesc, ExperimentalPGNotation } from 'cubing/puzzle-geometry';
import { KPuzzle } from 'cubing/kpuzzle';
import { PG_DEF_BY_ID } from '@/app/[lang]/sim/pgCatalog';
import { pgAlgError } from '@/lib/pg-alg-validation';

it('rejects the reported Astrominx + Big Chop alg before asynchronous player evaluation', () => {
  // Same geometry/options/notation mapping as the live TwistyPlayer loader.
  const pg = getPuzzleGeometryByDesc(PG_DEF_BY_ID.astrominxbigchop, {
    allMoves: true, orientCenters: true, addRotations: true,
  });
  const notation = new ExperimentalPGNotation(pg, pg.getOrbitsDef(true));
  const kpuzzle = new KPuzzle(notation.remapKPuzzleDefinition(pg.getKPuzzleDefinition(true)), {
    experimentalPGNotation: notation,
  });
  expect(pgAlgError(kpuzzle, "R' B PL PO'")).toBe('! full puzzle rotations must be specified with v suffix.');
  expect(pgAlgError(kpuzzle, 'R')).toBe('! full puzzle rotations must be specified with v suffix.');
  expect(pgAlgError(kpuzzle, "PL PO'")).toBe(null);
  expect(pgAlgError(kpuzzle, "Rv' Bv PL PO'")).toBe(null);
  expect(pgAlgError(kpuzzle, '')).toBe(null);
  expect(pgAlgError(kpuzzle, '(')).not.toBe(null);
  expect(pgAlgError(kpuzzle, 'NOT_A_MOVE')).not.toBe(null);
  // A rejected edit must not poison validation of the next valid edit.
  expect(pgAlgError(kpuzzle, "[PL, PO] (PL PO')2")).toBe(null);
});
