import { readFileSync, readdirSync } from 'node:fs';
import { workspaceFixturePath } from './workspace-fixture-path';
import { expect, it } from 'vitest';
import { SVG_BY_KEY } from '@cuberoot/event-icon/maps';
import { TIMER_EVENT_PICKER_ITEMS } from '@cuberoot/shared/timer/event-catalog';
import { eventInfo } from '@cuberoot/shared/timer/types';
import { SIM_FIXED_PUZZLE_OPTIONS } from '@/app/[lang]/sim/puzzleOptions';
import { PG_PUZZLES } from '@/app/[lang]/sim/pgCatalog';
import { ICON_GROUPS } from '@/app/[lang]/icon/_catalog';
import { PUZZLE_ICON_NAMES, PUZZLE_ICON_SEARCH_TERMS } from '@/app/[lang]/icon/_site-icons';
import { eventIconClass } from '@/components/EventIcon/EventIcon';
import { CSTIMER_EVENTS } from '@/lib/cstimer-scramble';
import { NATIVE_SCRAMBLE_EVENTS } from '@/lib/native-scramble';
import { SHAPE_MOD_EVENTS } from '@/lib/shape-mod-scramble';

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
  const sourceKeys = readdirSync(workspaceFixturePath('@cuberoot/event-icon', 'svg/puzzle'))
    .filter(name => name.endsWith('.svg')).map(name => `puzzle-${name.slice(0, -4)}`).sort();
  expect(Object.keys(SVG_BY_KEY).filter(key => key.startsWith('puzzle-')).sort()).toEqual(sourceKeys);
  for (const [key, svg] of Object.entries(SVG_BY_KEY).filter(([key]) => key.startsWith('puzzle-'))) {
    const source = readFileSync(workspaceFixturePath('@cuberoot/event-icon', 'svg/puzzle', `${key.slice(7)}.svg`), 'utf8').trim();
    expect(svg, key).toBe(source);
    expect(svg, key).not.toMatch(/NaN|Infinity|<text|<image/);
    expect(PUZZLE_ICON_NAMES[key], key).toBeDefined();
  }
  for (const option of SIM_FIXED_PUZZLE_OPTIONS) {
    expect(SVG_BY_KEY[option.iconClass], option.value).toContain('<svg');
  }
});

it('keeps every physical scramble project on a named gallery SVG and the same result-header icon', () => {
  const gallery = new Map(ICON_GROUPS.flatMap(group => group.entries.map(entry => [entry.key, entry] as const)));
  for (const project of [...CSTIMER_EVENTS, ...SHAPE_MOD_EVENTS, ...NATIVE_SCRAMBLE_EVENTS]) {
    expect(project.iconClass, project.id).toBeTruthy();
    expect(SVG_BY_KEY[project.iconClass], project.id).toContain('<svg');
    expect(gallery.get(project.iconClass)?.svg, project.id).toBe(SVG_BY_KEY[project.iconClass]);
    expect(PUZZLE_ICON_NAMES[project.iconClass], project.id).toBeDefined();
    for (const alias of [project.id, project.en, project.zh]) {
      expect(PUZZLE_ICON_SEARCH_TERMS[project.iconClass], project.id).toContain(alias.toLowerCase());
    }
    expect(eventIconClass(project.id), project.id).toBe(project.iconClass);
  }
  for (const item of TIMER_EVENT_PICKER_ITEMS) {
    if (!item.iconClass) {
      // Only semantic modes may keep text; a new physical puzzle must fail here.
      expect(['cfop', 'll', 'relay', 'misc'], item.id).toContain(eventInfo(item.id).group);
      expect(item.textLabel, item.id).toBeTruthy();
      continue;
    }
    expect(SVG_BY_KEY[item.iconClass], item.id).toContain('<svg');
    expect(gallery.get(item.iconClass)?.svg, item.id).toBe(SVG_BY_KEY[item.iconClass]);
    expect(eventIconClass(item.id), item.id).toBe(item.iconClass);
  }
});
