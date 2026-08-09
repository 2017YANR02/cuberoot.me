import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wcaResultRowKey, type WcaResultRow } from '@/lib/wca-person-api';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESULT_TABLES: Array<{ path: string; forbidden: RegExp }> = [
  { path: 'components/persons/sections/results/ByEventView.tsx', forbidden: /key=\{r\.id\}/ },
  { path: 'components/persons/sections/results/ByCompList.tsx', forbidden: /key=\{r\.id\}/ },
  { path: 'components/persons/sections/RecordsTab.tsx', forbidden: /key=\{r\.id\}/ },
  {
    path: 'app/[lang]/recon/[id]/ReconDetailClient.tsx',
    forbidden: /key=\{r\.id\}\s+className=\{r\.live/,
  },
];

function row(round_type_id: string): WcaResultRow {
  return {
    competition_id: 'MaomingOpen2026',
    event_id: '333',
    round_type_id,
    format_id: 'a',
    best: 300,
    average: 400,
    pos: 1,
    attempts: [300, 400, 400, 400, 500],
  };
}

describe('WCA person result row identity', () => {
  it('is unique without relying on an optional database id', () => {
    expect(wcaResultRowKey(row('1'))).toBe('MaomingOpen2026|333|1');
    expect(wcaResultRowKey(row('f'))).toBe('MaomingOpen2026|333|f');
  });

  it('result tables never regress to key={r.id}', () => {
    const violations = RESULT_TABLES
      .filter(({ path, forbidden }) => forbidden.test(readFileSync(join(CLIENT, path), 'utf8')))
      .map(({ path }) => path);
    expect(violations).toEqual([]);
  });
});
