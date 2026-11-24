import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('./appearance.css', import.meta.url), 'utf8');
const rules = [...appearance.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
function declarations(selector: string) {
  return rules.filter(([, selectors]) => selectors.split(',').some(value => value.trim() === selector))
    .map(([, , declarations]) => declarations).join('\n');
}

describe('shared timer UI host theme contract', () => {
  it('loads the canonical appearance tokens instead of overriding them in the host', () => {
    expect(css).toContain("@import './appearance.css'");
    expect(css).not.toMatch(/--(?:popover|faint-foreground|border-strong):/);
  });

  it.each(['--popover', '--faint-foreground', '--border-strong'])(
    'defines %s for light, explicit dark, and system dark', (token) => {
      for (const selector of [':root', 'html[data-theme=dark]', 'html:not([data-theme=light])']) {
        expect(declarations(selector), selector).toMatch(new RegExp(`${token}:\\s*(?:#[0-9a-fA-F]+|var\\(--(?:secondary|muted-foreground)\\));`));
      }
      expect(appearance).toContain('@media (prefers-color-scheme: dark)');
    },
  );

  it.each(['--shell-chip', '--shell-divider', '--shell-hover'])(
    'gives %s a legacy-engine fallback and a supported foreground-derived enhancement', (token) => {
      const [fallback, enhancement] = css.split('@supports (color: color-mix(in srgb, black, white)) {');
      expect(fallback).toMatch(new RegExp(`${token}:\\s*var\\(--[\\w-]+\\);`));
      expect(enhancement).toMatch(new RegExp(`${token}:\\s*color-mix\\(in srgb, var\\(--foreground\\)`));
    },
  );
});
