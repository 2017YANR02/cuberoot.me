import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import config from '../next.config';

it('keeps team and management under admin without workspace route redirects', async () => {
  const redirects = await config.redirects!();
  for (const path of ['/admin', '/admin/users', '/zh/admin/releases', '/workspace', '/zh/workspace/admin']) {
    expect(redirects.some(rule => Boolean(getPathMatch(rule.source)(path))), path).toBe(false);
  }
  expect(existsSync(new URL('../app/[lang]/admin/team/page.tsx', import.meta.url))).toBe(true);
  expect(existsSync(new URL('../app/[lang]/workspace/page.tsx', import.meta.url))).toBe(false);
  expect(existsSync(new URL('../app/[lang]/workspace/admin/page.tsx', import.meta.url))).toBe(false);
});
