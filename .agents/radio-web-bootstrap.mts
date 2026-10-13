// Temporary, branch-scoped migration. Removed before merge; no subprocesses.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const touched = new Set<string>();
function edit(path: string, before: string, after: string, count = 1) {
  const filename = resolve(root, path);
  const source = readFileSync(filename, 'utf8');
  if (source.split(before).length - 1 !== count) throw new Error(`Unexpected patch context: ${path}: ${before}`);
  writeFileSync(filename, source.replaceAll(before, after));
  touched.add(path);
}
function duplicate(path: string, needle: string, transform: (line: string) => string) {
  const matches = readFileSync(resolve(root, path), 'utf8').split(/(?<=\n)/).filter((line) => line.includes(needle));
  if (!matches.length || matches.length > 2) throw new Error(`Unexpected fixture count: ${path}`);
  for (const line of matches) edit(path, line, line + transform(line));
}
const c = (path: string) => `core/${path}`;
const rename = (line: string) => line.replaceAll('radiojewel', 'radioweb').replaceAll('Radio Jewel', 'Radio Web').replaceAll("'Jewel'", "'Web'");
if (!readFileSync(resolve(root, c('packages/puzzle-solvers/src/native-puzzles.ts')), 'utf8').includes('  radioweb: {')) {
  edit(c('packages/puzzle-solvers/src/native-puzzles.ts'), 'export const NATIVE_PUZZLES = {', "// Radio Web (Radiolarian 6): Jason Smith's original face-turning icosahedron.\n// Hyperspeedcube's idealized depth is 5 - 2 sqrt(5) + 0.02; unlike Radio Jewel,\n// its wing stickers remain visible. See the Radio Web skill reference.\nexport const NATIVE_PUZZLES = {");
  edit(c('packages/puzzle-solvers/src/native-puzzles.ts'), '    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 320,\n  },\n} as const;', "    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 320,\n  },\n  radioweb: {\n    description: 'i f 0.5478640450004204', zh: 'Radio Web', en: 'Radio Web', textLabel: 'Web',\n    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,\n    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 440,\n  },\n} as const;");
  edit(c('packages/client/components/NativePuzzleControls.tsx'), '\n};\n\n/** The same native tokens', "\n  radioweb: ['Radio Web（Radiolarian 6）：二十面体，每步面转 120°，支持外层、第二层与宽转。每面保留 22 个色块，包括细小翼块；当前仅支持保形转动，不含 jumbling。', 'Radio Web (Radiolarian 6): an icosahedron with 120° face turns and outer, second and wide layers. Each face retains 22 stickers, including the small wings. Supports shape-preserving turns only, without jumbling.'],\n};\n\n/** The same native tokens");
  edit(c('packages/client/app/[lang]/sim/puzzleOptions.ts'), "'radiochop', 'radiocrystal', 'radiojewel', 'circoradiolarian'", "'radiochop', 'radiocrystal', 'radiojewel', 'radioweb', 'circoradiolarian'");
  edit(c('packages/shared/src/timer/types.ts'), "| 'cube3heli' | 'radiojewel'", "| 'cube3heli' | 'radiojewel' | 'radioweb'");
  for (const [file, needle] of [
    ['types.ts', "{ id: 'radiojewel'"], ['event-catalog.ts', "{ id: 'radiojewel'"], ['scramble-runtime.ts', '  radiojewel:'],
  ]) duplicate(c(`packages/shared/src/timer/${file}`), needle, rename);
  for (const needle of ["  radiojewel: 'input',", '  radiojewel: CSTIMER_EVENT_FALLBACKS.radiojewel,']) duplicate(c('packages/shared/src/timer/export-cstimer.ts'), needle, rename);
  edit(c('packages/shared/src/timer/import-cstimer.ts'), "  'radiojewel': 'radiojewel', 'jewel': 'radiojewel',", "  'radiojewel': 'radiojewel', 'jewel': 'radiojewel',\n  'radioweb': 'radioweb', 'radiolarian6': 'radioweb',");
  edit(c('packages/shared/src/timer/import-cstimer.ts'), '  // Hybrid names must be recognized before the standalone Skewb/3x3 tokens.', "  if (tokens.some((token, index) =>\n    (token === 'radio' && tokens[index + 1] === 'web')\n    || (token === 'radiolarian' && tokens[index + 1] === '6'))) {\n    return normalizeEventKey('radioweb');\n  }\n  // Hybrid names must be recognized before the standalone Skewb/3x3 tokens.");
  for (const file of ['timer-sync-seed', 'timer_persistence', 'timer_event_catalog', 'timer-scramble-source-bar', 'timer-scramble-preview-shared', 'timer_scramble_runtime']) {
    const path = c(`packages/client/tests/${file}.test.ts`), before = "'cube3heli', 'radiojewel',";
    const count = readFileSync(resolve(root, path), 'utf8').split(before).length - 1;
    if (!count) throw new Error(`Missing timer fixture: ${path}`);
    edit(path, before, "'cube3heli', 'radiojewel', 'radioweb',", count);
  }
  for (const [file, needle] of [
    ['native-puzzle-svg', "{ id: 'radiojewel'"], ['native-puzzle-drag', "{ id: 'radiojewel'"],
    ['native-puzzle-sim-controls', "{ id: 'radiojewel'"], ['native-puzzle-manual-anchor', "{ id: 'radiojewel'"],
    ['timer-scramble-preview-shared', "{ event: 'radiojewel'"], ['timer_scramble_runtime', '  radiojewel:'],
    ['timer_cstimer_io', "{ event: 'radiojewel'"], ['timer_event_catalog', "['radiojewel', 'Radio Jewel'"],
    ['sim-puzzle-menu', "['radiojewel', 'icosahedron']"],
  ]) duplicate(c(`packages/client/tests/${file}.test.ts`), needle, (line) => rename(line).replaceAll('320', '440'));
  const fallbackPath = c('packages/client/tests/twisty_2d_fallback.test.ts');
  const fallback = readFileSync(resolve(root, fallbackPath), 'utf8');
  const start = fallback.indexOf("    {\n      id: 'radiojewel'");
  if (start < 0) throw new Error('Missing fallback fixture');
  const block = fallback.slice(start, fallback.indexOf('    },', start) + 7);
  edit(fallbackPath, block, block + rename(block));
  edit(c('packages/client/tests/timer_cstimer_io.test.ts'), "    ['Jewel practice', 'radiojewel'],", "    ['Jewel practice', 'radiojewel'],\n    ['Radio_Web_Practice', 'radioweb'],\n    ['Session_Radio-Web', 'radioweb'],\n    ['Radiolarian 6 practice', 'radioweb'],");
  edit('.agents/skills/sim-add-puzzle/SKILL.md', '- 对 Radio Jewel 等恰有小块消失的临界切深保留解析精度，', '- 制作 Radio Web（Radiolarian 6）时按 [Radio Web 几何与验收](references/radio-web.md) 保留临界切深上方的细小翼块；不能复用 Radio Jewel 的 320 片图示冒充本项目的 440 片。\n- 对 Radio Jewel 等恰有小块消失的临界切深保留解析精度，');
}
mkdirSync(resolve(root, 'core/.tmp/radio-web-evidence'), { recursive: true });
writeFileSync(resolve(root, 'core/.tmp/radio-web-evidence/changed-paths.txt'), [...touched].join('\n') + '\n');
console.log(`Applied ${touched.size} explicit Radio Web source/contract updates.`);
