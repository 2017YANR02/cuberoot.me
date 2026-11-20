// /dev/tokens drift guard: the design-tokens reference page (app/[lang]/dev/
// tokens/_tokens.ts) hand-mirrors color values from app-ui/src/appearance.css. This test
// reads appearance.css and its shared classic colors, then asserts every value the page claims still matches the
// real token — so changing a token in appearance.css without updating the page
// turns CI red. Pure read-only; no codegen to maintain.
//
// Fix when red: open app/[lang]/dev/tokens/_tokens.ts and update the light/dark
// value(s) to match app-ui/src/appearance.css.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { GROUPS } from '@/app/[lang]/dev/tokens/_tokens';

const require = createRequire(import.meta.url);
const appearance = readFileSync(require.resolve('@cuberoot/app-ui/appearance.css'), 'utf8');
const classicPath = '@cuberoot/shared/timer/classic-appearance.css';
const css = appearance.replace(`@import "${classicPath}";`, () => readFileSync(require.resolve(classicPath), 'utf8'));

// Find the exact selector within a list (tokens also style the native preview).
function block(selector: string): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
  const m = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(',').some((entry) => entry.trim() === selector));
  if (!m.length) throw new Error(`block not found: ${selector}`);
  return m.map(match => match[2]).join("\n");
}

const lightBlock = block(':root');
const darkBlock = block('html[data-theme=dark]');

function rawVal(name: string, theme: 'light' | 'dark'): string | null {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g');
  if (theme === 'dark') {
    const m = [...darkBlock.matchAll(re)].at(-1);
    if (m) return m[1].trim();
  }
  const m = [...lightBlock.matchAll(re)].at(-1);
  return m ? m[1].trim() : null;
}

// Follow the same aliases as the browser, including those inside color-mix().
function resolve(raw: string, theme: 'light' | 'dark', seen = new Set<string>()): string {
  return raw.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, name: string) => {
    if (seen.has(name)) throw new Error(`circular token alias: ${name}`);
    const base = rawVal(name, theme);
    if (base == null) throw new Error(`base var not found: ${name}`);
    return resolve(base, theme, new Set([...seen, name]));
  });
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

describe('/dev/tokens stays in sync with app-ui/src/appearance.css', () => {
  it('parses both token blocks', () => {
    expect(lightBlock).toContain('--background');
    expect(darkBlock).toContain('--accent');
  });

  const cases = GROUPS.flatMap((g) =>
    g.tokens.flatMap((t) =>
      (['light', 'dark'] as const).map((theme) => ({ name: t.name, theme, page: t[theme].css })),
    ),
  );

  it.each(cases)('$name ($theme) matches appearance.css', ({ name, theme, page }) => {
    const raw = rawVal(name, theme);
    expect(raw, `${name} is missing from app-ui/src/appearance.css`).not.toBeNull();
    expect(norm(page)).toBe(norm(resolve(raw as string, theme)));
  });
});
