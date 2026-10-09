import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { SVG_BY_KEY } from '@cuberoot/event-icon/maps';
import { SIM_FIXED_PUZZLE_OPTIONS } from '@/app/[lang]/sim/puzzleOptions';
import { PG_PUZZLES } from '@/app/[lang]/sim/pgCatalog';
import { ICON_GROUPS } from '@/app/[lang]/icon/_catalog';
import { PUZZLE_ICON_NAMES } from '@/app/[lang]/icon/_site-icons';

it('keeps every PG project on its structural artwork and exposes the same SVG for download', () => {
  const gallery = new Map(ICON_GROUPS.flatMap(g => g.entries.map(e => [e.key, e] as const)));
  for (const puzzle of PG_PUZZLES) {
    // Physical curves cannot be reconstructed from planar PG cuts.
    const key = puzzle.id === 'curvycopter' ? 'unofficial-curvycopter' : `puzzle-${puzzle.id}`;
    expect(puzzle.icon, puzzle.id).toBe(key);
    expect(SVG_BY_KEY[key], puzzle.id).toContain('<svg');
    expect(gallery.get(key)?.svg, puzzle.id).toBe(SVG_BY_KEY[key]);
    expect(PUZZLE_ICON_NAMES[key], puzzle.id).toEqual({ en: puzzle.en, zh: puzzle.zh });
  }
});

it('keeps generated maps current for all original SVGs and all fixed simulator choices resolvable', () => {
  for (const [key, svg] of Object.entries(SVG_BY_KEY).filter(([key]) => key.startsWith('puzzle-'))) {
    const source = readFileSync(resolve('../event-icon/svg/puzzle', `${key.slice(7)}.svg`), 'utf8').trim();
    expect(svg, key).toBe(source);
    expect(svg, key).not.toMatch(/NaN|Infinity|<text|<image/);
    expect(PUZZLE_ICON_NAMES[key], key).toBeDefined();
  }
  for (const option of SIM_FIXED_PUZZLE_OPTIONS) {
    if ('iconClass' in option) expect(SVG_BY_KEY[option.iconClass], option.iconClass).toContain('<svg');
    else expect(option.textLabel, option.value).toBe('Sphere');
  }
});
