import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts: string[]) => readFileSync(join(CLIENT, ...parts), 'utf8');

describe('startup resilience policy', () => {
  it('installs the pre-hydration guard and both Next error boundaries', () => {
    expect(read('app', 'layout.tsx')).toContain('APP_BOOT_EARLY_SCRIPT');
    expect(read('app', '[lang]', 'error.tsx')).toContain('<AppFailure');
    expect(read('app', 'global-error.tsx')).toContain('<AppFailure');
  });

  it.each(['paint', 'alg/roux', 'sim', 'scramble/solver'])(
    'keeps a visible timeout fallback on /%s',
    (route) => {
      const source = read('app', '[lang]', ...route.split('/'), 'page.tsx');
      expect(source).toContain('ClientLoadStatus');
    },
  );
});
