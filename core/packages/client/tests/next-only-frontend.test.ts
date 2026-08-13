// 网站前端只允许 Next.js App Router。Vitest 是测试运行器，Capacitor mobile 是独立应用，
// 都不属于本守卫范围。
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(CLIENT, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib'];
const HISTORICAL_SOURCE_ALLOWLIST = new Set([
  'app/[lang]/code/stack/_tools/vite.tsx',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.next' && entry.name !== 'node_modules') out.push(...walk(path));
    } else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe('website frontend is Next-only', () => {
  const pkg = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it('uses Next for development, build, and production start', () => {
    expect(pkg.scripts?.dev).toContain('next dev');
    expect(pkg.scripts?.build).toContain('next build');
    expect(pkg.scripts?.start).toContain('next start');
  });

  it('has no retired website package or Vite configuration', () => {
    expect(existsSync(join(PACKAGES, 'client-vite'))).toBe(false);
    for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']) {
      expect(existsSync(join(CLIENT, name)), name).toBe(false);
    }
  });

  it('has no Vite runtime dependencies in the website package', () => {
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const forbidden = Object.keys(dependencies).filter((name) => (
      name === 'vite'
      || name.startsWith('@vitejs/')
      || name === '@tailwindcss/vite'
      || name.startsWith('vite-plugin-')
      || name === 'react-router-dom'
    ));
    expect(forbidden).toEqual([]);
  });

  it('does not reintroduce Vite environment access into current website code', () => {
    const violations: string[] = [];
    for (const file of SOURCE_DIRS.flatMap((dir) => walk(join(CLIENT, dir)))) {
      const rel = relative(CLIENT, file).split(sep).join('/');
      if (HISTORICAL_SOURCE_ALLOWLIST.has(rel)) continue;
      if (/\bimport\.meta\.env\b/.test(readFileSync(file, 'utf8'))) violations.push(rel);
    }
    expect(violations).toEqual([]);
  });
});
