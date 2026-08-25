import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALG_3X3_SETUP_REQUIRED_SETS, requires3x3AlgCaseSetup } from '@cuberoot/shared';
import { workspaceFixturePath } from './workspace-fixture-path';

const { validateRequiredAlgCaseSetup } = await import(pathToFileURL(workspaceFixturePath(
  '@cuberoot/server', 'src', 'utils', 'alg_case_setup.ts',
)).href) as {
  validateRequiredAlgCaseSetup: (puzzle: string, setSlug: string, setup: string) => Promise<string | null>;
};

const migration = readFileSync(workspaceFixturePath('@cuberoot/server', 'migrations', '0136_alg_f2l_setup_required.sql'), 'utf8');
const schema = readFileSync(workspaceFixturePath('@cuberoot/server', 'src', 'db', 'schema.pg.sql'), 'utf8');
const route = readFileSync(workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'alg_sets.ts'), 'utf8');
const thumbPlan = readFileSync(fileURLToPath(new URL(
  '../lib/alg_thumb_plan.ts',
  import.meta.url,
)), 'utf8');

describe('F2L setup guard', () => {
  it('classifies exactly F2L and Advanced F2L as setup-required', () => {
    expect(ALG_3X3_SETUP_REQUIRED_SETS).toEqual(['f2l', 'adv-f2l']);
    expect(requires3x3AlgCaseSetup('3x3', 'f2l')).toBe(true);
    expect(requires3x3AlgCaseSetup('3x3', 'adv-f2l')).toBe(true);
    expect(requires3x3AlgCaseSetup('3x3', 'oll')).toBe(false);
    expect(requires3x3AlgCaseSetup('4x4', 'f2l')).toBe(false);
  });

  it('rejects missing and unparseable setup at the API validation boundary', async () => {
    await expect(validateRequiredAlgCaseSetup('3x3', 'f2l', '')).resolves.toBe('f2l_setup_required');
    await expect(validateRequiredAlgCaseSetup('3x3', 'adv-f2l', 'RU')).resolves.toBe('f2l_setup_invalid');
    await expect(validateRequiredAlgCaseSetup('3x3', 'f2l', "F R' F' R")).resolves.toBeNull();
    await expect(validateRequiredAlgCaseSetup('3x3', 'oll', '')).resolves.toBeNull();
  });

  it('keeps the API and database guards aligned', () => {
    const sqlSetList = ALG_3X3_SETUP_REQUIRED_SETS.map(set => `'${set}'`).join(', ');
    for (const sql of [migration, schema]) {
      expect(sql).toContain('alg_cases_f2l_setup_required');
      expect(sql).toContain(`set_slug NOT IN (${sqlSetList})`);
      expect(sql).toContain("btrim(setup) <> ''");
    }
    expect(route).toContain('await validateRequiredAlgCaseSetup(puzzle, setSlug, body.setup)');
  });

  it('does not retain the incomplete five-face F2L conversion path', () => {
    expect(thumbPlan).not.toContain('speedCubeDbF2lFaceletColors');
    expect(thumbPlan).not.toMatch(/sticker\.fl/);
  });
});
