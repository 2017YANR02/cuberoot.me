// Temporary branch-only source application. Removed before the PR is finalized.
import { readFileSync, writeFileSync } from 'node:fs';
function replace(path, before, after) {
  const s = readFileSync(path, 'utf8');
  if (s.split(before).length !== 2) throw new Error(`Expected one edit anchor: ${path}: ${before.slice(0,80)}`);
  writeFileSync(path, s.replace(before, after));
}
function cloneRow(path, target = 'radioweb') {
  const s = readFileSync(path, 'utf8');
  const out = [];
  for (const line of s.split(/(?<=\n)/)) {
    out.push(line);
    if (!line.includes(target)) continue;
    if (line.includes("'cube2heli', 'cube3heli', 'radiojewel', 'radioweb'") || line.trimStart().startsWith('|')) {
      out[out.length - 1] = line.replace("'radioweb'", "'radioweb', 'radiojam'");
      if (line.trimStart().startsWith('|')) out[out.length - 1] = line.replace("| 'radioweb'", "| 'radioweb' | 'radiojam'");
    } else out.push(line.replaceAll('radioweb', 'radiojam').replaceAll('Radio Web', 'Radio Jam').replaceAll('Radio_Web', 'Radio_Jam').replaceAll('Radio-Web', 'Radio-Jam').replaceAll('Radiolarian 6', 'Radiolarian 8').replaceAll("'Web'", "'Jam'"));
  }
  writeFileSync(path, out.join(''));
}
replace('core/packages/puzzle-solvers/src/native-puzzles.ts', '} as const;\n\nexport type NativePuzzleId', `  // Radio Jam (Radiolarian 8): Hyperspeedcube radio08 uses radio7 - 0.06.
  // The unused radio8 constant in that source is NOT this model's cut depth.
  radiojam: {
    description: 'i f 0.4678640450004204', zh: 'Radio Jam', en: 'Radio Jam', textLabel: 'Jam',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 440,
  },
} as const;

export type NativePuzzleId`);
for (const name of ['event-catalog.ts', 'types.ts', 'scramble-runtime.ts', 'export-cstimer.ts']) cloneRow(`core/packages/shared/src/timer/${name}`);
replace('core/packages/shared/src/timer/import-cstimer.ts', "  'radioweb': 'radioweb', 'radiolarian6': 'radioweb',", "  'radioweb': 'radioweb', 'radiolarian6': 'radioweb',\n  'radiojam': 'radiojam', 'radiolarian8': 'radiojam',");
replace('core/packages/shared/src/timer/import-cstimer.ts', '  // Hybrid names must be recognized', `  if (tokens.some((token, index) =>
    (token === 'radio' && tokens[index + 1] === 'jam')
    || (token === 'radiolarian' && tokens[index + 1] === '8'))) {
    return normalizeEventKey('radiojam');
  }
  // Hybrid names must be recognized`);
replace('core/packages/client/app/[lang]/sim/puzzleOptions.ts', "'radiojewel', 'radioweb',", "'radiojewel', 'radioweb', 'radiojam',");
replace('core/packages/client/components/NativePuzzleControls.tsx', '  radioweb:', "  radiojam: ['Radio Jam（Radiolarian 8）：深切面转二十面体，每步 120°，支持外层、第二层与宽转。每面保留 22 个色块，包括细小三角块；当前仅支持保形转动，不含 jumbling。', 'Radio Jam (Radiolarian 8): a deep-cut face-turning icosahedron with 120° outer, second and wide turns. Each face retains 22 stickers, including small triangles. Supports shape-preserving turns only, without jumbling.'],\n  radioweb:");
for (const name of ['sim-puzzle-menu', 'native-puzzle-drag', 'native-puzzle-manual-anchor', 'native-puzzle-sim-controls', 'native-puzzle-svg', 'timer-scramble-preview-shared', 'timer-scramble-source-bar', 'timer-sync-seed', 'timer_cstimer_io', 'timer_event_catalog', 'timer_persistence', 'timer_scramble_runtime']) cloneRow(`core/packages/client/tests/${name}.test.ts`);
cloneRow('core/packages/app-ui/src/scramble-source-matrix.audit.test.ts');
const fallback = `    {
      id: 'radioweb', setup: 'R', alg: '2R', move: 'Rw', order: 3,
      controls: [{ move: 'R', order: 3 }, { move: '2R', order: 3 }, { move: 'Rw', order: 3 }],
      invalid: '4R', absent: ['3R', '3Rw'],
    },`;
replace('core/packages/client/tests/twisty_2d_fallback.test.ts', fallback, fallback + '\n' + fallback.replace('radioweb', 'radiojam'));
const geometry = 'core/packages/client/tests/native-mixed-puzzles-geometry.test.ts';
replace(geometry, '\n];', `
  {
    // Read radio08's axes:add expression, not the unused radio8 constant.
    id: 'radiojam', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [5 - 2 * Math.sqrt(5) - 0.06], order: 3 }],
    faces: 20, perFace: 22, raw: 480, visible: 440, pieces: 302,
    shapes: { 3: 15, 5: 6, 6: 1 }, unmarkedOrbit: 'CENTERS4',
    orbits: [['EDGES', 60, 2], ['C5RNER', 12, 5], ['CENTERS', 60, 1], ['CENTERS2', 60, 1], ['EDGES2', 30, 2], ['CENTERS3', 60, 1], ['CENTERS4', 20, 3]],
  },
];`);
replace(geometry, "'radiojewel', 'radioweb'] as const)", "'radiojewel', 'radioweb', 'radiojam'] as const)");
replace(geometry, 'describe.each(CASES)', `it('distinguishes Radio Jam from same-count Radio Web and preserves all of its small triangles', () => {
  const jam = CASES.find(({ id }) => id === 'radiojam')!;
  const web = CASES.find(({ id }) => id === 'radioweb')!;
  // Hyperspeedcube declares radio8 = 1/phi^2 but does NOT use it for radio08.
  // That alternative has the same number of pieces and a different silhouette.
  const unusedConstant = { ...jam, axes: [{ ...jam.axes[0], cuts: [1 / PHI ** 2] }] };
  const area = (polygon: Vector3[]) => polygon.reduce((sum, point, i) =>
    sum.add(point.clone().cross(polygon[(i + 1) % polygon.length])), new Vector3()).length() / 2;
  expect(Number(NATIVE_PUZZLES.radiojam.description.split(' ')[2])).toBeCloseTo(5 - 2 * Math.sqrt(5) - 0.06, 14);
  for (const normal of Object.values(icoNormals)) {
    const regions = expectedFace(jam, normal);
    expect(shapeCounts(regions)).toEqual({ 3: 15, 5: 6, 6: 1 });
    expect(shapeCounts(expectedFace(web, normal))).toEqual({ 3: 12, 4: 6, 5: 3, 6: 1 });
    expect(shapeCounts(expectedFace(unusedConstant, normal))).toEqual({ 3: 15, 4: 3, 5: 3, 6: 1 });
    expect(regions.map(area).reduce((sum, a) => sum + a, 0))
      .toBeCloseTo(area(uncutFace(normal, Object.values(icoNormals))), 10);
  }
  const { stickers } = fixture(jam);
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = sticker.orbit + ':' + sticker.ord;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(200);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
});

describe.each(CASES)`);
const outlines = 'core/packages/client/scripts/native-puzzles/compare-outlines.mjs';
replace(outlines, "// --set=radiojewel: review Radio Jewel's exact face-cut depth.", "// --set=radiojewel: review Radio Jewel's exact face-cut depth.\n// --set=radiojam: review Radio Jam's actual radio08 cut and small triangles.");
replace(outlines, 'const reviewSets = {', `const reviewSets = {
  radiojam: {
    basename: 'radiojam-outlines',
    rows: [{
      id: 'radiojam', en: 'Radio Jam (Radiolarian 8)',
      description: 'i f 0.4678640450004204', visibleFacelets: 440,
      prior: 'i f 0.5278640450004204', priorLabel: 'Radio Jewel (comparison, not retained cuts)',
      notes: ['Actual radio08 depth: 5 - 2 sqrt(5) - 0.06; not the unused radio8 constant.', '15 triangles + 6 pentagons + 1 hexagon per face; shape-preserving turns, no jumbling.'],
    }],
  },`);
const browser = 'core/packages/client/scripts/radio-web-browser-acceptance.mts';
replace(browser, ' * BASE_URL may', ' * NATIVE_PUZZLE_ID=radiojam also verifies Radio Jam with the same actual controls.\n * BASE_URL may');
replace(browser, "const out = resolve(import.meta.dirname, '../../../.tmp/radio-web-evidence');", "const id = process.env.NATIVE_PUZZLE_ID ?? 'radioweb';\nif (id !== 'radioweb' && id !== 'radiojam') throw new Error('Unsupported acceptance target');\nconst puzzleName = { radioweb: 'Radio Web', radiojam: 'Radio Jam' }[id];\nconst puzzleLabel = new RegExp(`^${puzzleName}$`);\nconst out = resolve(import.meta.dirname, `../../../.tmp/${id}-evidence`);");
let b = readFileSync(browser, 'utf8');
for (const route of ["'/zh/sim?puzzle=radioweb&anchor=start'", "'/sim?puzzle=radioweb&anchor=start&alg=R'", "'/zh/timer?event=radioweb'"]) b = b.replaceAll(route, '`' + route.slice(1,-1).replace('radioweb', '${id}') + '`');
b = b.replaceAll(".toBe('radioweb')", '.toBe(id)').replaceAll("event: 'radioweb'", 'event: id')
  .replaceAll("'svg[aria-label=\"radioweb\"]'", '`svg[aria-label="${id}"]`')
  .replaceAll("'.gen-tn-attempt-preview svg[aria-label=\"radioweb\"]:visible'", '`.gen-tn-attempt-preview svg[aria-label="${id}"]:visible`')
  .replaceAll('chooseWeb', 'choosePuzzle').replaceAll('hasText: /^Radio Web$/', 'hasText: puzzleLabel')
  .replaceAll("'radio-web-scrambles.pdf'", '`${id}-scrambles.pdf`')
  .replaceAll('JSON.stringify({ base, checks, errors }', 'JSON.stringify({ base, puzzle: id, checks, errors }')
  .replaceAll('const web = menu.locator', 'const target = menu.locator').replaceAll('await web.', 'await target.').replaceAll('expect(web)', 'expect(target)');
writeFileSync(browser, b);
replace('.agents/skills/sim-add-puzzle/SKILL.md', '- 制作 Radio Web', '- 制作 Radio Jam（Radiolarian 8）时按 [Radio Jam 几何与验收](references/radio-jam.md) 核对实际 `radio08` 构造式，不误用未被引用的 `radio8` 常量；用逐面形状与切深区分同为 440 片的 Radio Web。\n- 制作 Radio Web');
const ref = '.agents/skills/sim-add-puzzle/references/native-pg-puzzles.md';
const r = readFileSync(ref, 'utf8');
const index = r.indexOf('\n', r.indexOf('| `radiojewel`'));
if (index < 0) throw new Error('Missing native puzzle table');
writeFileSync(ref, r.slice(0,index+1) + '| `radiojam` | Radio Jam / Radio Jam | `i f 0.4678640450004204` | 按 [Radio Jam 几何与验收](radio-jam.md)取实际 `radio08` 构造式 `5 − 2√5 − 0.06`，不误用未引用的 `radio8 = 1/φ²` 常量；每面十五个三角形、六个五边形和一个六边形，仅保形 120° 面转，不含 jumbling。 |\n' + r.slice(index+1));
console.log('Applied scoped Radio Jam implementation and existing regression matrices.');
