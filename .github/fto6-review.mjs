// Branch-only delivery helper; removed before the feature is merged.
import { readFileSync, writeFileSync } from 'node:fs';
const catalog = 'core/packages/client/tests/timer_event_catalog.test.ts';
writeFileSync(catalog, readFileSync(catalog, 'utf8').replace('76-event partition', '77-event partition').replace('toHaveLength(76)', 'toHaveLength(77)'));
const path = 'core/packages/client/tests/native-five-geometry.test.ts';
let text = readFileSync(path, 'utf8');
if (!text.includes("id: 'fto6', faceNormals")) {
  text = text.replace('// FTO5 is a uniform five-layer FTO, not a dimensional copy of a particular toy.\n// With body inradius 1, its equally spaced cuts are +/-1/5 and +/-3/5.', '// FTO5/FTO6 are uniform FTO extensions, not dimensional copies of particular toys.\n// For FTO6, divide each edge into sixths: cuts 0, +/-1/3, +/-2/3.\n// The original equal-layer FTO mechanism is documented by Jaap:\n// https://www.jaapsch.net/puzzles/octaface.htm\n// With body inradius 1, FTO5\'s equally spaced cuts are +/-1/5 and +/-3/5.');
  text = text.replace('] as const;\ntype Spec = typeof CASES[number];', `  {
    id: 'fto6', faceNormals: octaNormals, turnNormals: octaNormals, pairs: octaPairs,
    cuts: [0, 1 / 3, 2 / 3], boundaries: [2 / 3, 1 / 3, 0, -1 / 3, -2 / 3], layers: 3, rangeWide: true, order: 3,
    faces: 8, perFace: 36, raw: 288, visible: 288, pieces: 222, shapes: { 3: 36 }, unmarkedOrbit: '',
    faceOrbits: [['CENTERS', 3, 3], ['EDGES', 3, 6], ['CENTERS2', 3, 3], ['EDGES2', 3, 6], ['CENTERS3', 3, 3], ['CENTERS4', 3, 3], ['CENTERS5', 3, 3], ['CENTERS6', 3, 3], ['CENTERS7', 3, 3], ['C4RNER', 3, 3]],
    orbits: [['CENTERS', 24, 1], ['EDGES', 24, 2], ['CENTERS2', 24, 1], ['EDGES2', 24, 2], ['CENTERS3', 24, 1], ['CENTERS4', 24, 1], ['CENTERS5', 24, 1], ['CENTERS6', 24, 1], ['CENTERS7', 24, 1], ['C4RNER', 6, 4]],
  },
] as const;
type Spec = typeof CASES[number];`);
  const marker = "it('places Radio Crystal cuts at exactly six other face centers and removes the central facelet', () => {";
  const extra = "it('keeps all sixth-grid stickers congruent and the opposite third layers independent', () => {\n  const spec = CASES.find((entry) => entry.id === 'fto6')!;\n  const { stickers, puzzle } = fixture(spec);\n  // Shell edge sqrt(6), face area 3*sqrt(3)/2, divided into 36 congruent triangles.\n  for (const { vertices: [a, b, c] } of stickers) {\n    expect(b.clone().sub(a).cross(c.clone().sub(a)).length() / 2).toBeCloseTo(Math.sqrt(3) / 24, 10);\n    expect(a.distanceTo(b)).toBeCloseTo(Math.sqrt(6) / 6, 10);\n    expect(b.distanceTo(c)).toBeCloseTo(Math.sqrt(6) / 6, 10);\n    expect(c.distanceTo(a)).toBeCloseTo(Math.sqrt(6) / 6, 10);\n  }\n  for (const [a, b] of octaPairs) {\n    expect(puzzle.moveToTransformation(`3${a}`).isIdentical(puzzle.moveToTransformation(`3${b}'`))).toBe(false);\n    expect(puzzle.algToTransformation(`1-3${a} 1-3${b}'`).isIdentical(puzzle.moveToTransformation(`${a}v`))).toBe(true);\n  }\n});\n\n";
  if (!text.includes(marker)) throw new Error('Missing independent test anchor');
  text = text.replace(marker, extra + marker);
  writeFileSync(path, text);
}
