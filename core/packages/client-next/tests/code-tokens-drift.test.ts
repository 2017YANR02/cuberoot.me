// /code/tokens drift guard: the design-tokens reference page (app/[lang]/code/
// tokens/_tokens.ts) hand-mirrors color values from app/globals.css. This test
// re-reads globals.css and asserts every value the page claims still matches the
// real token — so changing a token in globals.css without updating the page
// turns CI red. Pure read-only; no codegen to maintain.
//
// Fix when red: open app/[lang]/code/tokens/_tokens.ts and update the light/dark
// value(s) to match app/globals.css.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { GROUPS } from '@/app/[lang]/code/tokens/_tokens';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client-next
const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');

// Grab the body of the first `selector { ... }` block via brace matching.
function block(selector: string): string {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const m = re.exec(css);
  if (!m) throw new Error(`block not found: ${selector}`);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
  }
  return css.slice(start, i - 1);
}

const lightBlock = block(':root');
const darkBlock = block('html[data-theme=dark]');

function rawVal(name: string, theme: 'light' | 'dark'): string | null {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  if (theme === 'dark') {
    const m = re.exec(darkBlock);
    if (m) return m[1].trim();
  }
  const m = re.exec(lightBlock);
  return m ? m[1].trim() : null;
}

// Resolve a globals.css value to the same concrete form the page stores:
// plain hex → lowercased hex; bare var() → resolved base hex; color-mix(var) →
// color-mix with the base var expanded to its hex.
function resolve(raw: string, theme: 'light' | 'dark'): string {
  const v = raw.trim();
  if (/^#[0-9a-fA-F]+$/.test(v)) return v.toLowerCase();
  const varM = /var\(\s*(--[\w-]+)\s*\)/.exec(v);
  if (!varM) return v.toLowerCase().replace(/\s+/g, ' ');
  const baseRaw = rawVal(varM[1], theme);
  if (baseRaw == null) throw new Error(`base var not found: ${varM[1]}`);
  const baseHex = resolve(baseRaw, theme);
  if (v.includes('color-mix')) {
    const pct = /(\d+)%/.exec(v);
    if (!pct) throw new Error(`color-mix without percent: ${v}`);
    return `color-mix(in srgb, ${baseHex} ${pct[1]}%, transparent)`;
  }
  return baseHex; // bare var()
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

describe('/code/tokens stays in sync with app/globals.css', () => {
  it('parses both token blocks', () => {
    expect(lightBlock).toContain('--background');
    expect(darkBlock).toContain('--accent');
  });

  const cases = GROUPS.flatMap((g) =>
    g.tokens.flatMap((t) =>
      (['light', 'dark'] as const).map((theme) => ({ name: t.name, theme, page: t[theme].css })),
    ),
  );

  it.each(cases)('$name ($theme) matches globals.css', ({ name, theme, page }) => {
    const raw = rawVal(name, theme);
    expect(raw, `${name} is missing from app/globals.css`).not.toBeNull();
    expect(norm(page)).toBe(norm(resolve(raw as string, theme)));
  });
});
