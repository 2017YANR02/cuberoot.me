// Temporary branch-only delivery helper. Removed before merging the feature.
import { readFileSync, writeFileSync } from 'node:fs';
function replace(path, old, next) {
  const text = readFileSync(path, 'utf8');
  if (text.split(old).length !== 2) throw new Error(`Unexpected base: ${path}: ${old}`);
  writeFileSync(path, text.replace(old, next));
}
function after(path, old, extra) { replace(path, old, old + extra); }
const registry = 'core/packages/puzzle-solvers/src/native-puzzles.ts';
if (readFileSync(registry, 'utf8').includes('  fto6: {')) {
  console.log('FTO6 implementation already applied');
} else {
  after(registry, ' * These are bounded random-move practice scrambles, not uniform random states.\n', ' * Six-layer FTO extends Jaap\'s equal-layer FTO by dividing each edge into sixths:\n * https://www.jaapsch.net/puzzles/octaface.htm . Its idealized cuts are\n * 0, +/-1/3 and +/-2/3 for body inradius 1 (not measured retail dimensions).\n');
  after(registry, `  fto5: {
    description: 'o f 0.2 f 0.6', zh: '五阶 FTO', en: '5-layer FTO', textLabel: 'FTO5',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 3, rangeWide: true,
    scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 200,
  },
`, `  fto6: {
    description: 'o f 0 f 0.3333333333333333 f 0.6666666666666666', zh: '六阶 FTO', en: '6-layer FTO', textLabel: 'FTO6',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 3, rangeWide: true,
    scrambleLength: 80, aspect: 4 / 3, visibleFacelets: 288,
  },
`);
  after('core/packages/client/components/NativePuzzleControls.tsx', "  fto5: ['五阶 FTO：每步面转 120°，支持外层、第二层、第三层和宽转。', '5-layer FTO: 120° face turns, with outer, second, third and wide layers.'],\n", "  fto6: ['六阶 FTO：每面 36 个三角形，每步面转 120°；支持外层、第二层、第三层和宽转。相对两面的第三层各自独立。', '6-layer FTO: 36 triangles per face and 120° face turns, with outer, second, third and wide layers. The third layers of opposite faces are independent.'],\n");
  const types = 'core/packages/shared/src/timer/types.ts';
  replace(types, "| 'quadx' | 'dinoocta' | 'fto5' | 'eto'", "| 'quadx' | 'dinoocta' | 'fto5' | 'fto6' | 'eto'");
  after(types, "  { id: 'fto5', nameEn: '5-layer FTO', nameZh: '五阶 FTO', group: 'nonwca' },\n", "  { id: 'fto6', nameEn: '6-layer FTO', nameZh: '六阶 FTO', group: 'nonwca' },\n");
  after('core/packages/shared/src/timer/event-catalog.ts', "  { id: 'fto5', group: 'other', textLabel: 'FTO5' },\n", "  { id: 'fto6', group: 'other', textLabel: 'FTO6' },\n");
  after('core/packages/shared/src/timer/scramble-runtime.ts', "  fto5: { kind: 'shared', provider: 'native-random-move' },\n", "  fto6: { kind: 'shared', provider: 'native-random-move' },\n");
  const exp = 'core/packages/shared/src/timer/export-cstimer.ts';
  after(exp, "  fto5: 'input',\n", "  fto6: 'input',\n");
  after(exp, '  fto5: CSTIMER_EVENT_FALLBACKS.fto5,\n', '  fto6: CSTIMER_EVENT_FALLBACKS.fto6,\n');
  const imp = 'core/packages/shared/src/timer/import-cstimer.ts';
  after(imp, "  'fto5': 'fto5', '5layerfto': 'fto5', '5×5fto': 'fto5', '5x5fto': 'fto5', '五阶fto': 'fto5',\n", "  'fto6': 'fto6', '6layerfto': 'fto6', '6×6fto': 'fto6', '6x6fto': 'fto6', '六阶fto': 'fto6',\n");
  replace(imp, '  // Preserve the FTO order before the standalone 5/FTO tokens resolve to 555/fto.\n', "  // Preserve the FTO order before standalone number/FTO tokens resolve to NxN/fto.\n  if (/(?:^|[^a-z0-9])6(?:[\\s_-]+layer|\\s*[x×]\\s*6)[\\s_-]+fto(?:$|[^a-z0-9])|六阶[\\s_-]*fto/i.test(name)) {\n    return normalizeEventKey('fto6');\n  }\n");
  const outlines = 'core/packages/client/scripts/native-puzzles/compare-outlines.mjs';
  after(outlines, '// --set=radiojewel: review Radio Jewel\'s exact face-cut depth.\n', '// --set=fto6: review six equal FTO layers, including the central cut.\n');
  after(outlines, 'const reviewSets = {\n', `  fto6: {
    basename: 'fto6-outlines',
    rows: [{
      id: 'fto6', en: '6-layer FTO',
      description: 'o f 0 f 0.3333333333333333 f 0.6666666666666666', visibleFacelets: 288,
      prior: 'o f 0.333333333333333', priorLabel: 'FTO (three layers; original cuts retained)',
      notes: ['Six equal edge divisions: 36 triangles per face; depths 0, +/-1/3, +/-2/3.', 'Opposite third layers are distinct. Idealized construction, not measured retail dimensions.'],
    }],
  },
`);
  for (const name of ['timer_scramble_runtime', 'timer_persistence', 'timer_event_catalog', 'timer_cstimer_io', 'timer-sync-seed', 'timer-scramble-preview-shared', 'timer-scramble-source-bar']) {
    const path = `core/packages/client/tests/${name}.test.ts`;
    let text = readFileSync(path, 'utf8');
    text = text.replaceAll("'quadx', 'dinoocta', 'fto5', 'eto'", "'quadx', 'dinoocta', 'fto5', 'fto6', 'eto'");
    text = text.replace("  fto5: 'native-random-move',", "  fto5: 'native-random-move',\n  fto6: 'native-random-move',");
    text = text.replace("      ['fto5', '5-layer FTO', '五阶 FTO', 'FTO5'],", "      ['fto5', '5-layer FTO', '五阶 FTO', 'FTO5'],\n      ['fto6', '6-layer FTO', '六阶 FTO', 'FTO6'],");
    text = text.replace("  { event: 'fto5', nameEn: '5-layer FTO', nameZh: '五阶 FTO' },", "  { event: 'fto5', nameEn: '5-layer FTO', nameZh: '五阶 FTO' },\n  { event: 'fto6', nameEn: '6-layer FTO', nameZh: '六阶 FTO' },");
    text = text.replace("    ['练习：五阶 FTO', 'fto5'],", "    ['练习：五阶 FTO', 'fto5'],\n    ['Session_6-layer_FTO', 'fto6'],\n    ['6-layer FTO_Practice', 'fto6'],\n    ['6x6 FTO_Practice', 'fto6'],\n    ['练习：六阶 FTO', 'fto6'],");
    text = text.replace("    { event: 'fto5', faces: 8 },", "    { event: 'fto5', faces: 8 },\n    { event: 'fto6', faces: 8 },");
    writeFileSync(path, text);
  }
  for (const name of ['native-puzzle-drag', 'native-puzzle-sim-controls', 'native-puzzle-manual-anchor', 'native-puzzle-svg']) {
    const path = `core/packages/client/tests/${name}.test.ts`, text = readFileSync(path, 'utf8');
    const lines = text.split('\n').filter(line => line.includes("{ id: 'fto5',"));
    if (lines.length !== 1) throw new Error(`Unexpected fixture: ${name}`);
    const next = lines[0].replace("'fto5'", "'fto6'").replace('stickers: 200', 'stickers: 288').replace('facelets: 200', 'facelets: 288');
    writeFileSync(path, text.replace(lines[0], lines[0] + '\n' + next));
  }
  after('.agents/skills/sim-add-puzzle/SKILL.md', '- 按注册表的逐轴层数派生混合转角与深度能力，保留第二／第三单层及宽转；让按钮、拖转和点击共用规范族名与层深元数据，按原生映射选择 `Aw` 或 `1-2A`，不要拼接不存在的面宽转。\n', '- 偶数阶 FTO 的穿心切面不能省略：六阶用 `0, ±1/3, ±2/3`，两侧第三层互不等价。独立核对每面等面积三角形、完整六层的相对面别名与三层宽转，不以五阶中层等价关系代替。轮廓复现见 `compare-outlines.mjs --set=fto6`。\n');
  const reference = '.agents/skills/sim-add-puzzle/references/native-pg-puzzles.md';
  const row = readFileSync(reference, 'utf8').split('\n').find(line => line.startsWith('| `fto5`'));
  if (!row) throw new Error('Missing FTO5 reference');
  after(reference, row + '\n', '| `fto6` | 六阶 FTO / 6-layer FTO | `o f 0 f 0.3333333333333333 f 0.6666666666666666` | 以 [Jaap 的等层 FTO](https://www.jaapsch.net/puzzles/octaface.htm) 为机制参考，独立将正八面体每条边六等分：内切球半径 1 时，切面为 `0, ±1/3, ±2/3`，每面 36 个等面积三角形，共 288 片可见贴片。中央切面保留，相对两面的第三层各自独立；只承诺保形 120° 面转，不宣称复刻特定量产品尺寸。 |\n');
}
