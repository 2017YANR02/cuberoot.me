import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_BOOT_EARLY_SCRIPT,
  MIN_SUPPORTED_CHROMIUM_MAJOR,
} from '@/lib/app_boot_early';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('browser support policy', () => {
  it('keeps the Next 16 baseline instead of targeting an obsolete embedded simulator', () => {
    const pkg = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')) as {
      browserslist?: string[];
      dependencies?: { next?: string };
    };

    expect(pkg.dependencies?.next).toMatch(/^16\./);
    expect(pkg.browserslist).toEqual([
      'chrome 111',
      'edge 111',
      'firefox 111',
      'safari 16.4',
    ]);
    expect(MIN_SUPPORTED_CHROMIUM_MAJOR).toBe(111);
  });

  it('keeps the pre-hydration fallback parseable by obsolete engines', () => {
    expect(APP_BOOT_EARLY_SCRIPT).not.toMatch(/=>|\bconst\b|\blet\b|\?\./);
  });
});
