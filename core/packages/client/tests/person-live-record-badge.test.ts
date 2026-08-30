import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('person live record badges', () => {
  it('expands a Russian CR to the European record label', () => {
    const html = renderToStaticMarkup(createElement(RecordBadge, {
      record: 'CR',
      iso2: 'RU',
      variant: 'inline',
    }));

    expect(html).toContain('>ER<');
    expect(html).not.toContain('>CR<');
  });

  it('waits for live regional-record info before falling back to PR', () => {
    for (const path of [
      'components/persons/sections/results/ByCompList.tsx',
      'components/persons/sections/results/ByEventView.tsx',
    ]) {
      const source = readFileSync(join(CLIENT, path), 'utf8');
      expect(source).toContain('const liveInfoReady = !r.live || livePrRanks.has(rowKey)');
      expect(source).toMatch(/const singleRank = liveInfoReady \?/);
      expect(source).toMatch(/<RecordBadge record=\{singleRecord\} iso2=/);
    }
  });

  it('passes the country to average and per-attempt record badges', () => {
    const average = readFileSync(join(CLIENT, 'components/persons/sections/results/AverageValueCell.tsx'), 'utf8');
    const attempts = readFileSync(join(CLIENT, 'components/persons/sections/results/AttemptsList.tsx'), 'utf8');

    expect(average).toMatch(/<RecordBadge record=\{averageRecord\} iso2=\{personCountry\}/);
    expect(attempts).toMatch(/<RecordBadge record=\{tag\} iso2=\{personCountry\}/);
  });
});
