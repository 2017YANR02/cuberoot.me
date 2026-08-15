import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalize3x3AlgFile, type AlgFile } from '@cuberoot/shared';

const migration = readFileSync(fileURLToPath(new URL(
  '../../server/migrations/0135_alg_3x3_lowercase_wide.sql',
  import.meta.url,
)), 'utf8');
const schema = readFileSync(fileURLToPath(new URL(
  '../../server/src/db/schema.pg.sql',
  import.meta.url,
)), 'utf8');
const canonicalRoute = readFileSync(fileURLToPath(new URL(
  '../../server/src/routes/alg_sets.ts',
  import.meta.url,
)), 'utf8');
const submissionRoute = readFileSync(fileURLToPath(new URL(
  '../../server/src/routes/alg.ts',
  import.meta.url,
)), 'utf8');

function fixture(puzzle: string): AlgFile {
  return {
    scrapedAt: '',
    source: 'test',
    puzzle,
    set: 'test',
    cases: [{
      name: 'case',
      subgroup: '',
      setup: "Fw Rw'",
      standard: 'Uw2',
      sticker: { kind: 'raw', tag: 'test', attrs: {} },
      algs: [[{
        alg: "Rw U Rw'",
        setup: 'Lw',
        algHtml: '<u>Bw2</u>',
      }]],
      meta: {
        no: 1,
        ollcp: '',
        subset: '',
        oll: '',
        cp: '',
        scramble: 'Dw',
        optimal: { stm: { len: 1, scramble: 'Fw' } },
        coep: { alg: 'Rw', scramble: 'Bw' },
      },
    }],
  };
}

describe('3x3 lowercase wide notation guard', () => {
  it('normalizes every formula-bearing case field at the shared read boundary', () => {
    const file = canonicalize3x3AlgFile(fixture('3x3'));
    expect(file.cases[0].setup).toBe("f r'");
    expect(file.cases[0].standard).toBe('u2');
    expect(file.cases[0].algs[0][0]).toMatchObject({
      alg: "r U r'",
      setup: 'l',
      algHtml: '<u>b2</u>',
    });
    expect(file.cases[0].meta).toMatchObject({
      scramble: 'd',
      optimal: { stm: { scramble: 'f' } },
      coep: { alg: 'r', scramble: 'b' },
    });
  });

  it('does not change notation for larger cubes', () => {
    const file = canonicalize3x3AlgFile(fixture('4x4'));
    expect(file.cases[0].setup).toBe("Fw Rw'");
    expect(file.cases[0].algs[0][0].alg).toBe("Rw U Rw'");
  });

  it('normalizes both API write paths before persistence', () => {
    expect(canonicalRoute).toContain('canonicalize3x3CaseInput(puzzle');
    expect(submissionRoute).toContain("puzzle === '3x3' ? canonicalize3x3WideMoves");
  });

  it('cleans existing rows and guards both tables at the database boundary', () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain('alg_canonicalize_3x3_wide_moves');
      expect(sql).toContain('CREATE TRIGGER alg_cases_canonicalize_3x3_wide');
      expect(sql).toContain('CREATE TRIGGER alg_submissions_canonicalize_3x3_wide');
    }
    expect(migration).toContain('UPDATE alg_cases');
    expect(migration).toContain('UPDATE alg_submissions');
  });
});
