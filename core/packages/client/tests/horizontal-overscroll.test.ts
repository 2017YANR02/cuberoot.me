import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

it('disables horizontal boundary bounce for existing and future Web scroll containers', () => {
  const css = stripComments(readFileSync(join(root, 'app/globals.css'), 'utf8'));
  expect(css).toMatch(/(?:^|})\s*\*\s*\{\s*overscroll-behavior-x:\s*none\s*!important;\s*\}/);
});

it('does not allow component important declarations to restore horizontal bounce', () => {
  const violations: string[] = [];
  for (const file of ['app', 'components'].flatMap(dir => cssFiles(join(root, dir)))) {
    const css = stripComments(readFileSync(file, 'utf8'));
    for (const match of css.matchAll(/(?:^|[;{])\s*(overscroll-behavior(?:-x|-inline)?):\s*([^;{}]+)!important\s*(?=;|})/g)) {
      if (match[2].trim().split(/\s+/)[0] !== 'none') violations.push(`${file}: ${match[0]}`);
    }
  }
  expect(violations).toEqual([]);
});
