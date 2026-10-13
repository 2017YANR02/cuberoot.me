// Temporary, branch-scoped migration. Removed before merge; no subprocesses.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const touched = new Set<string>();
function edit(path: string, before: string, after: string) {
  const filename = resolve(root, path), source = readFileSync(filename, 'utf8');
  if (source.split(before).length !== 2) throw new Error(`Unexpected patch context: ${path}: ${before}`);
  writeFileSync(filename, source.replace(before, after));
  touched.add(path);
}
const geometry = 'core/packages/client/tests/native-mixed-puzzles-geometry.test.ts';
if (!readFileSync(resolve(root, geometry), 'utf8').includes("id: 'radioweb', faceNormals")) {
  edit(geometry, '\n];\n\nconst center =', `
  {
    // Independent source: Hyperspeedcube radio06, not a rounded Radio Jewel.
    id: 'radioweb', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [5 - 2 * Math.sqrt(5) + 0.02], order: 3 }],
    faces: 20, perFace: 22, raw: 480, visible: 440, pieces: 302,
    shapes: { 3: 12, 4: 6, 5: 3, 6: 1 }, unmarkedOrbit: 'CENTERS4',
    orbits: [['CENTERS', 60, 1], ['C5RNER', 12, 5], ['CENTERS2', 60, 1], ['EDGES', 60, 2], ['EDGES2', 30, 2], ['CENTERS3', 60, 1], ['CENTERS4', 20, 3]],
  },
];

const center =`);
  edit(geometry, "it.each(['heliskewb', 'cube3heli', 'radiojewel'] as const)", "it.each(['heliskewb', 'cube3heli', 'radiojewel', 'radioweb'] as const)");
  edit(geometry, "describe.each(CASES)('$id independent physical model', (spec) => {", `it('retains Radio Web wings, closes every face without gaps and distinguishes both neighboring designs', () => {
  const web = CASES.find(({ id }) => id === 'radioweb')!;
  const jewel = CASES.find(({ id }) => id === 'radiojewel')!;
  const cradle = { ...web, axes: [{ ...web.axes[0], cuts: [PHI ** 2 / (2 + PHI ** 2)] }] };
  const area = (polygon: Vector3[]) => polygon.reduce((sum, point, i) =>
    sum.add(point.clone().cross(polygon[(i + 1) % polygon.length])), new Vector3()).length() / 2;
  expect(Number(NATIVE_PUZZLES.radioweb.description.split(' ')[2])).toBeCloseTo(5 - 2 * Math.sqrt(5) + 0.02, 14);
  for (const normal of Object.values(icoNormals)) {
    const regions = expectedFace(web, normal);
    expect(regions).toHaveLength(22);
    expect(expectedFace(jewel, normal)).toHaveLength(16);
    expect(expectedFace(cradle, normal)).toHaveLength(19);
    const areas = regions.map(area);
    expect(areas.reduce((sum, value) => sum + value, 0)).toBeCloseTo(area(uncutFace(normal, Object.values(icoNormals))), 10);
    expect(Math.min(...areas)).toBeCloseTo(0.003561495853740537, 10);
  }
  const { stickers } = fixture(web);
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = sticker.orbit + ':' + sticker.ord;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(200);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
});

describe.each(CASES)('$id independent physical model', (spec) => {`);
}
const catalog = 'core/packages/client/tests/timer_event_catalog.test.ts';
if (readFileSync(resolve(root, catalog), 'utf8').includes('duplicate-free 76-event')) {
  edit(catalog, 'duplicate-free 76-event', 'duplicate-free 77-event');
  edit(catalog, 'expect(pickerIds).toHaveLength(76);', 'expect(pickerIds).toHaveLength(77);');
}
const registry = 'core/packages/puzzle-solvers/src/native-puzzles.ts';
const comment = "// Radio Web (Radiolarian 6): Jason Smith's original face-turning icosahedron.\n// Hyperspeedcube's idealized depth is 5 - 2 sqrt(5) + 0.02; unlike Radio Jewel,\n// its wing stickers remain visible. See the Radio Web skill reference.\n";
if (readFileSync(resolve(root, registry), 'utf8').includes(comment)) {
  edit(registry, comment, '');
  edit(registry, '  radioweb: {', "  // Jason Smith's Radiolarian 6. Hyperspeedcube radio06 uses 5 - 2 sqrt(5) + 0.02;\n  // unlike Radio Jewel, the wings remain visible. See references/radio-web.md.\n  radioweb: {");
}
mkdirSync(resolve(root, 'core/.tmp/radio-web-evidence'), { recursive: true });
writeFileSync(resolve(root, 'core/.tmp/radio-web-evidence/changed-paths.txt'), [...touched].join('\n') + '\n');
console.log(`Applied ${touched.size} explicit Radio Web oracle updates.`);
