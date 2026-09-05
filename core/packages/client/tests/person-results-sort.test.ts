import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(
  dirname(fileURLToPath(import.meta.url)),
  '../components/persons/sections/results/ByEventView.tsx',
), 'utf8');

describe('person result column sorting', () => {
  it.each(['pos', 'single', 'average', 'aoxr'])(
    'wires the %s header to its displayed value',
    (key) => {
      expect(source).toContain(`toggleSort('${key}')`);
      expect(source).toContain(`key === '${key}'`);
    },
  );
});
