import { describe, expect, it } from 'vitest';
import { ALL_PUZZLE_TYPE_OPTIONS, groupSimPuzzleOptions } from '@/app/[lang]/sim/puzzleOptions';

describe('simulator puzzle families', () => {
  it('keeps every catalog option reachable exactly once with its original identity', () => {
    const groups = groupSimPuzzleOptions();
    const options = groups.flatMap(group => group.options);
    expect(options).toHaveLength(ALL_PUZZLE_TYPE_OPTIONS.length);
    expect(new Set(options.map(option => option.value)).size).toBe(options.length);
    expect(options.map(option => option.value).sort()).toEqual(ALL_PUZZLE_TYPE_OPTIONS.map(option => option.value).sort());
    for (const option of options) {
      expect(option).toBe(ALL_PUZZLE_TYPE_OPTIONS.find(source => source.value === option.value));
    }
  });

  it('pins current WCA choices in their existing order and groups the reviewed order series', () => {
    const groups = groupSimPuzzleOptions();
    expect(groups[0].id).toBe('wca');
    expect(groups[0].submenu).toBe(false);
    expect(groups[0].options.map(option => option.value)).toEqual(['nxn', 'sq1', 'pyraminx', 'skewb', 'megaminx', 'clock']);
    expect(groups.find(group => group.id === 'minx')?.options.slice(0, 7).map(option => option.value))
      .toEqual(['kilominx', 'gigaminx', 'teraminx', 'petaminx', 'examinx', 'zetaminx', 'yottaminx']);
    expect(groups.find(group => group.id === 'tetrahedron')?.options.slice(0, 4).map(option => option.value))
      .toEqual(['masterpyraminx', 'professorpyraminx', 'royalpyraminx', 'emperorpyraminx']);
    expect(groups.find(group => group.id === 'magic')?.options.map(option => option.value)).toEqual(['magic', 'mmagic']);
  });

  it('filters unavailable projects before building menus and removes empty categories', () => {
    const groups = groupSimPuzzleOptions(['clock', 'gigaminx', 'kilominx', 'hyperx', 'custom', 'not-a-puzzle']);
    expect(groups.map(group => group.id)).toEqual(['wca', 'minx', 'hybrid-cuts', 'other']);
    expect(groups.flatMap(group => group.options.map(option => option.value)))
      .toEqual(['clock', 'kilominx', 'gigaminx', 'hyperx', 'custom']);
    expect(groupSimPuzzleOptions([])).toEqual([]);
  });

  it('places each new native puzzle in its geometric family and keeps the FTO order sequence', () => {
    const groups = groupSimPuzzleOptions();
    for (const [puzzle, family] of [
      ['quadx', 'edge-turning'],
      ['dinoocta', 'octahedron'],
      ['fto5', 'octahedron'],
      ['eto', 'octahedron'],
      ['radiocrystal', 'icosahedron'],
      ['cube3skewb', 'hybrid-cuts'],
      ['heliskewb', 'hybrid-cuts'],
      ['comboctahedron', 'octahedron'],
      ['circoradiolarian', 'icosahedron'],
      ['icosababyface', 'icosahedron'],
      ['radiojewel', 'icosahedron'],
      ['radioweb', 'icosahedron'],
      ['radiojam', 'icosahedron'],
      ['catscradle', 'icosahedron'],
      ['cube2heli', 'hybrid-cuts'],
      ['cube3heli', 'hybrid-cuts'],
    ]) {
      const containing = groups.filter(group => group.options.some(option => option.value === puzzle));
      expect(containing.map(group => group.id)).toEqual([family]);
      expect(containing[0].submenu).toBe(true);
    }
    expect(groups.find(group => group.id === 'octahedron')?.options.slice(0, 4).map(option => option.value))
      .toEqual(['fto', 'masterfto', 'masterftov2', 'fto5']);
    expect(groups.find(group => group.id === 'icosahedron')?.options.slice(0, 2).map(option => option.value))
      .toEqual(['radiochop', 'radiocrystal']);
  });
});
