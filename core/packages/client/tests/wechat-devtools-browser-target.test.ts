import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('WeChat DevTools browser target', () => {
  it('keeps the website bundle compatible with its Chromium 91 simulator', () => {
    const pkg = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')) as {
      browserslist?: string[];
    };

    expect(pkg.browserslist).toContain('chrome 91');
  });
});
