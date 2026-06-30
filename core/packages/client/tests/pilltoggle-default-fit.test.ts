// PillToggle default-fit lock.
//
// Why: the common case for PillToggle is "hug the text". Historically the base
// CSS shipped `min-width: 110px`, so every consumer had to REMEMBER a page-scope
// `min-width: 0` override; forgetting it left a short toggle stretched into a long
// bar (the recurring bug). The fix made the base hug content by default AND reserve
// the width of the *longer* label (two invisible ghost spans) so toggling never
// jumps — no per-page override needed.
//
// This guard locks both pillars so a future edit can't silently regress them:
//   1. base `.pill-toggle` keeps `min-width: 0` (no fixed width re-added)
//   2. the component still renders the ghost sizers (the no-jump mechanism)
//
// Fix when red: don't re-add a fixed `min-width` to the base `.pill-toggle` rule
// (put fixed width on a per-instance className if one page truly needs it), and
// keep the two `pill-toggle-label-ghost` spans in PillToggle.tsx.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
// strip CSS comments so prose like "覆盖 min-width:0" inside a comment can't fool the matchers
const css = readFileSync(join(ROOT, 'components', 'PillToggle', 'PillToggle.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const tsx = readFileSync(join(ROOT, 'components', 'PillToggle', 'PillToggle.tsx'), 'utf8');

// Body of the base `.pill-toggle { ... }` rule (not .pill-toggle.is-on / -label / --switch).
function baseBlock(): string {
  const m = /\.pill-toggle\s*\{/.exec(css);
  if (!m) throw new Error('base .pill-toggle rule not found');
  let i = m.index + m[0].length;
  const start = i;
  let depth = 1;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
  }
  return css.slice(start, i - 1);
}

describe('PillToggle defaults to fit-content', () => {
  const base = baseBlock();

  it('base rule keeps min-width: 0 (hugs the text, no long bar)', () => {
    const mw = /min-width\s*:\s*([^;]+);/.exec(base);
    expect(mw, 'base .pill-toggle must declare an explicit min-width').not.toBeNull();
    expect((mw as RegExpExecArray)[1].trim()).toBe('0');
  });

  it('base rule does not re-introduce a fixed pixel/rem min-width', () => {
    expect(base).not.toMatch(/min-width\s*:\s*\d*\.?\d+\s*(px|rem|em)/);
  });

  it('component renders both label ghosts so toggling never jumps width', () => {
    const ghosts = tsx.match(/pill-toggle-label-ghost/g) ?? [];
    expect(ghosts.length).toBeGreaterThanOrEqual(2);
    // each ghost must hold one of the two labels (the width reservation)
    expect(tsx).toMatch(/pill-toggle-label-ghost[^>]*>\s*\{onLabel\}/);
    expect(tsx).toMatch(/pill-toggle-label-ghost[^>]*>\s*\{offLabel\}/);
  });
});
