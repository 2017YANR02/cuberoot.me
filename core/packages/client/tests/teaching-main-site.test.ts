import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(CLIENT, '..', '..', '..');

function readClient(path: string): string {
  return readFileSync(join(CLIENT, path), 'utf8');
}

describe('main-site teaching architecture', () => {
  it('keeps the main client as the only teaching frontend', () => {
    const plan = readFileSync(join(REPO, 'docs', 'platform-unification-plan.md'), 'utf8');
    expect(plan).toContain('`core/packages/client` 是唯一 Web 前端');
    expect(plan).toContain('旧 Platform 计时历史不迁移');
    expect(plan).toContain('`core/packages/platform` 只作为迁移期来源');
  });

  it('links teaching users to canonical main-site tools', () => {
    const overview = readClient('app/[lang]/org/[orgSlug]/page.tsx');
    for (const href of ['/timer', '/predict', '/alg', '/sim']) {
      expect(overview).toContain(`['${href}'`);
    }
    expect(overview).toContain('<AppLink');
    expect(overview).not.toContain('packages/platform');
  });

  it('exposes the workspace from the existing account page and supports narrow screens', () => {
    expect(readClient('app/[lang]/account/page.tsx')).toContain("href: '/org'");
    const css = readClient('app/[lang]/org/org.css');
    expect(css).toContain('@media (max-width: 479px)');
    expect(css).toContain('var(--signal-success)');
    expect(css).not.toContain('var(--success)');
  });
});
