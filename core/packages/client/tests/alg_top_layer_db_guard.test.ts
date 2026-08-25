import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALG_3X3_TOP_LAYER_SET } from '@cuberoot/shared';
import { workspaceFixturePath } from './workspace-fixture-path';

const migration = readFileSync(workspaceFixturePath('@cuberoot/server', 'migrations', '0132_alg_top_layer_no_leading_y.sql'), 'utf8');
const schema = readFileSync(workspaceFixturePath('@cuberoot/server', 'src', 'db', 'schema.pg.sql'), 'utf8');

function sqlTopLayerSets(source: string): string[] {
  const block = source.match(
    /CREATE OR REPLACE FUNCTION alg_is_3x3_top_layer_set[\s\S]*?\$\$;/,
  )?.[0];
  if (!block) throw new Error('missing alg_is_3x3_top_layer_set SQL function');
  return [...block.matchAll(/'([^']+)'/g)]
    .map(match => match[1])
    .filter(value => value !== '3x3')
    .sort();
}

describe('top-layer database guard', () => {
  const sharedSets = Object.entries(ALG_3X3_TOP_LAYER_SET)
    .filter(([, isTopLayer]) => isTopLayer)
    .map(([set]) => set)
    .sort();

  it('keeps migration and schema classifications equal to the exhaustive shared map', () => {
    expect(sqlTopLayerSets(migration)).toEqual(sharedSets);
    expect(sqlTopLayerSets(schema)).toEqual(sharedSets);
  });

  it('guards both canonical cases and community submissions at the database boundary', () => {
    expect(migration).toContain('CREATE TRIGGER alg_cases_no_leading_y');
    expect(migration).toContain('CREATE TRIGGER alg_submissions_no_leading_y');
    expect(schema).toContain('CREATE TRIGGER alg_cases_no_leading_y');
    expect(schema).toContain('CREATE TRIGGER alg_submissions_no_leading_y');
  });
});
