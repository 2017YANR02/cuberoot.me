# Temporary transport for the isolated development environment; remove before PR.
from pathlib import Path
import difflib
root = Path('.')
original = {}
def edit(path, old, new, multiple=False):
    p = root / path
    text = p.read_text()
    original.setdefault(path, text)
    count = text.count(old)
    assert count >= 1 and (multiple or count == 1), (path, count, old[:80])
    p.write_text(text.replace(old, new))
def before(path, anchor, new):
    edit(path, anchor, new + anchor)

before('core/packages/puzzle-solvers/src/native-puzzles.ts', '  cube3heli: {', '''  // A planar 2x2 / Helicopter combination, not a curved retail reproduction.
  // Central face cuts add legal half-cube turns without new visible seams.
  cube2heli: {
    description: 'c f 0 e 0.7071067811865476',
    zh: '二阶＋直升机', en: '2×2 + Helicopter', textLabel: '2Heli',
    axes: [...CUBE_FACE_CORNER_AXES.slice(0, 3), ...CUBE_EDGE_AXES], order: 0,
    axisOrders: [4, 4, 4, 2, 2, 2, 2, 2, 2],
    layers: 2, axisLayers: [1, 1, 1, 2, 2, 2, 2, 2, 2],
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 48,
  },
''')
before('core/packages/client/components/NativePuzzleControls.tsx', '  cube3heli: [', "  cube2heli: ['二阶＋直升机：面转 90°，棱转 180°；第二层与宽转仅用于棱轴。当前仅支持保形转动，不含 jumbling。', '2×2 + Helicopter: 90° face turns and 180° edge turns. Inner and wide turns apply only to edge axes. Supports shape-preserving turns only, without jumbling.'],\n")
p = 'core/packages/shared/src/timer/types.ts'
edit(p, "  | 'cube3heli' | 'radiojewel'", "  | 'cube2heli' | 'cube3heli' | 'radiojewel'")
before(p, "  { id: 'cube3heli',", "  { id: 'cube2heli', nameEn: '2×2 + Helicopter', nameZh: '二阶＋直升机', group: 'nonwca' },\n")
before('core/packages/shared/src/timer/event-catalog.ts', "  { id: 'cube3heli',", "  { id: 'cube2heli', group: 'other', textLabel: '2Heli' },\n")
before('core/packages/shared/src/timer/scramble-runtime.ts', '  cube3heli:', "  cube2heli: { kind: 'shared', provider: 'native-random-move' },\n")
p = 'core/packages/shared/src/timer/export-cstimer.ts'
before(p, "  cube3heli: 'input',", "  cube2heli: 'input',\n")
before(p, '  cube3heli: CSTIMER_EVENT_FALLBACKS.cube3heli,', '  cube2heli: CSTIMER_EVENT_FALLBACKS.cube2heli,\n')
p = 'core/packages/shared/src/timer/import-cstimer.ts'
before(p, "  'cube3heli': 'cube3heli',", "  'cube2heli': 'cube2heli', '2heli': 'cube2heli',\n  '2×2+helicopter': 'cube2heli', '2x2+helicopter': 'cube2heli',\n  '二阶＋直升机': 'cube2heli', '二阶+直升机': 'cube2heli',\n")
before(p, '  for (const t of tokens) {', r'''  // Preserve the combined mechanism before an ordinary 2x2 token wins.
  if (/(?:^|[^a-z0-9])2[\s_-]*[x×][\s_-]*2[\s_-]*[+＋][\s_-]*helicopter(?:$|[^a-z0-9])|二阶[\s_-]*[+＋][\s_-]*直升机/i.test(name)) {
    return normalizeEventKey('cube2heli');
  }
''')
edit('core/packages/client/app/[lang]/sim/puzzleOptions.ts', "'heliskewb', 'cube3heli']", "'heliskewb', 'cube2heli', 'cube3heli']")
p = 'core/packages/client/scripts/native-puzzles/compare-outlines.mjs'
before(p, '  cube3heli: {', '''  cube2heli: {
    basename: 'cube2heli-outlines',
    rows: [{
      id: 'cube2heli', en: '2×2 + Helicopter',
      description: 'c f 0 e 0.7071067811865476', visibleFacelets: 48,
      prior: 'c e 0.7071067811865476', priorLabel: 'Helicopter (same visible seams)',
      notes: ['Central face cuts add 90-degree half-cube turns; edge cuts stay at sqrt(2)/2.', 'Eight triangles per face; 180-degree edge turns; shape-preserving, no jumbling.'],
    }],
  },
''')
before(p, '// --set=cube3heli:', '// --set=cube2heli: review the central face cuts added to a planar Helicopter.\n')
p = 'core/packages/client/tests/native-mixed-puzzles-geometry.test.ts'
before(p, "  {\n    id: 'cube3heli', faceNormals: cubeNormals,", '''  {
    id: 'cube2heli', faceNormals: cubeNormals,
    axes: [
      { pairs: cubeFacePairs, normals: cubeNormals, cuts: [0], order: 4 },
      { pairs: cubeEdgePairs, normals: cubeAxisNormals(cubeEdgePairs), cuts: [Math.SQRT1_2], order: 2 },
    ],
    faces: 6, perFace: 8, raw: 48, visible: 48, pieces: 32,
    shapes: { 3: 8 }, orbits: [['CORNERS', 8, 3], ['CENTERS', 24, 1]],
  },
''')
edit(p, "it('keeps 3x3 + Helicopter pieces rigid through interleaved face, edge, slice, wide and whole turns', () => {\n  const spec = CASES.find(({ id }) => id === 'cube3heli')!;", "it.each(['cube2heli', 'cube3heli'] as const)('keeps %s pieces rigid through interleaved face, edge, slice, wide and whole turns', (id) => {\n  const spec = CASES.find((candidate) => candidate.id === id)!;\n  const twoHalves = id === 'cube2heli';")
edit(p, "{ move: \"2R'\", family: 'R', axis: 0, first: 2, last: 2, amount: -1 }", "{ move: twoHalves ? \"R'\" : \"2R'\", family: 'R', axis: 0, first: twoHalves ? 1 : 2, last: twoHalves ? 1 : 2, amount: -1 }")
edit(p, "{ move: 'Fv', family: 'F', axis: 0, first: 1, last: 3, amount: 1 }", "{ move: 'Fv', family: 'F', axis: 0, first: 1, last: twoHalves ? 2 : 3, amount: 1 }")
edit(p, "{ move: \"Bw'\", family: 'B', axis: 0, first: 1, last: 2, amount: -1 }", "{ move: twoHalves ? \"B'\" : \"Bw'\", family: 'B', axis: 0, first: 1, last: twoHalves ? 1 : 2, amount: -1 }")
edit(p, "it.each(['heliskewb', 'cube3heli', 'radiojewel'] as const)", "it.each(['heliskewb', 'cube2heli', 'cube3heli', 'radiojewel'] as const)")
before(p, "it('derives Baby Face cuts", '''it('keeps the central 2x2 cut even though it adds no visible Helicopter seams', () => {
  const spec = CASES.find(({ id }) => id === 'cube2heli')!;
  const helicopter: Spec = { ...spec, axes: [spec.axes[1]] };
  for (const normal of Object.values(cubeNormals)) {
    expect(expectedFace(spec, normal).map(polygonKey).sort())
      .toEqual(expectedFace(helicopter, normal).map(polygonKey).sort());
  }
  const puzzle = nativePuzzleKPuzzle(spec.id);
  expect(puzzle.moveToTransformation('F').repetitionOrder()).toBe(4);
  expect(puzzle.moveToTransformation('DF').repetitionOrder()).toBe(2);
  expect(puzzle.algToTransformation('F DF').isIdentical(puzzle.algToTransformation('DF F'))).toBe(false);
  expect(() => parseNativePuzzleAlg(spec.id, 'Fw')).toThrow();
});

''')
before('core/packages/client/tests/native-puzzle-drag.test.ts', "  { id: 'cube3heli',", "  { id: 'cube2heli', stickers: 48, moves: 42, outer: 18, inner: 12, wide: 12 },\n")
before('core/packages/client/tests/native-puzzle-svg.test.ts', "  { id: 'cube3heli',", '''  { id: 'cube2heli', scramble: "F DF 2DF' FLw U2 2UB' Fv DFv", facelets: 48 },
''')
before('core/packages/client/tests/native-puzzle-manual-anchor.test.ts', "  { id: 'cube3heli',", '''  { id: 'cube2heli', setup: 'F', alg: "DF U'", moves: ['2DF', "FLw'"], invalid: 'Rw' },
''')
p = 'core/packages/client/tests/native-puzzle-sim-controls.test.ts'
before(p, "  { id: 'cube3heli', setup:", '''  { id: 'cube2heli', setup: 'F', alg: "DF U'", manual: '2DF', typed: "FLw' U", reducedTyped: 'FLw U' },
''')
edit(p, "id === 'heliskewb' || id === 'cube3heli'", "id === 'heliskewb' || id === 'cube2heli' || id === 'cube3heli'")
before(p, "    { id: 'cube3heli', move: 'F',", "    { id: 'cube2heli', move: 'F', order: 4 },\n    { id: 'cube2heli', move: 'DF', order: 2 },\n")
p = 'core/packages/client/tests/twisty_2d_fallback.test.ts'
before(p, "    {\n      id: 'cube3heli',", '''    {
      id: 'cube2heli', setup: 'F', alg: '2DF', move: 'DFw', order: 2,
      controls: [{ move: 'F', order: 4 }, { move: 'DF', order: 2 }, { move: '2FL', order: 2 }, { move: 'DBw', order: 2 }],
      invalid: 'Rw', absent: ['UFR', '2F', 'Fw', '3F', '3Fw', '3DF', '3DFw'],
    },
''')
p = 'core/packages/client/tests/native-puzzles-client-integration.test.ts'
edit(p, "it('mixes real face and edge turns in 3×3 + Helicopter practice scrambles without full-circle edge moves', () => {\n    const puzzle = nativePuzzleKPuzzle('cube3heli');", "it.each(['cube2heli', 'cube3heli'] as const)('mixes real face and edge turns in %s practice scrambles without full-circle edge moves', (id) => {\n    const puzzle = nativePuzzleKPuzzle(id);")
edit(p, "parseNativePuzzleAlg('cube3heli', generateNativePuzzleScramble('cube3heli', random))", 'parseNativePuzzleAlg(id, generateNativePuzzleScramble(id, random))')
edit(p, 'expect(moves).toHaveLength(60);', 'expect(moves).toHaveLength(NATIVE_PUZZLES[id].scrambleLength);')
for name in ['timer_persistence.test.ts', 'timer-scramble-preview-shared.test.ts', 'timer-scramble-source-bar.test.ts', 'timer_scramble_runtime.test.ts']:
    edit('core/packages/client/tests/' + name, "'cube3heli', 'radiojewel',", "'cube2heli', 'cube3heli', 'radiojewel',", multiple=True)
before('core/packages/client/tests/timer_scramble_runtime.test.ts', "  cube3heli: 'native-random-move',", "  cube2heli: 'native-random-move',\n")
before('core/packages/client/tests/timer-scramble-preview-shared.test.ts', "    { event: 'cube3heli',", "    { event: 'cube2heli', faces: 6 },\n")
before('core/packages/client/tests/sim-puzzle-menu.test.ts', "      ['cube3heli',", "      ['cube2heli', 'hybrid-cuts'],\n")
p = 'core/packages/client/tests/timer_cstimer_io.test.ts'
before(p, "  { event: 'cube3heli',", "  { event: 'cube2heli', nameEn: '2×2 + Helicopter', nameZh: '二阶＋直升机' },\n")
before(p, "    ['Session_3x3_+_Helicopter',", "    ['Session_2x2_+_Helicopter', 'cube2heli'],\n    ['2×2 + Helicopter_Practice', 'cube2heli'],\n    ['练习：二阶＋直升机', 'cube2heli'],\n    ['2Heli', 'cube2heli'],\n")
before('.agents/skills/sim-add-puzzle/SKILL.md', '- 对 Radio Jewel 等', '- 对二阶＋直升机等可见切缝重合的组合保留全部机制切面；分别核对 90° 面轴与 180° 棱轴、逐轴层数及交错转动，不以相同展开图或图标判定机制相同，见 [原生 PG 结构与接线](references/native-pg-puzzles.md#二阶直升机)。\n')
p = '.agents/skills/sim-add-puzzle/references/native-pg-puzzles.md'
old = (root / p).read_text()
original.setdefault(p, old)
(root / p).write_text(old + '''

## 二阶＋直升机

- 将 `cube2heli` 作为平面二阶／直升机组合，使用 `c f 0 e 0.7071067811865476`；不要称为某一曲面零售型号的尺寸复刻，不支持 jumbling。
- 核对标准直升机切面及实体：<https://www.jaapsch.net/puzzles/helicopter.htm>；实物组合的独立照片与原作者链接见 <https://robspuzzlepage.com/rearrangement.htm> 的 Helicopter+2x2 小节。使用立方体半边长 1：三张中心面切面为 x/y/z = 0，棱切深为 sqrt(2)/2。
- 保留每面八个三角形、六面 48 个可见贴片、8 个三色角块与 24 个单色面块；中心面切面与部分既有表面切缝重合，但添加了独立面转，不能从描述中删除 `f 0`。
- 按九对轴登记 `axisOrders = [4,4,4,2,2,2,2,2,2]` 与 `axisLayers = [1,1,1,2,2,2,2,2,2]`；面轴只提供两半外层，第二层与两层宽转只用于棱轴；完整转体采用 `Av`，拒绝面宽转 `Fw`。
- 生成 40 步练习打乱并交替面转／棱转，不声称 WCA 或均匀随机状态；复用原生 provider、完整六面 SVG、记号与手动历史，使用 `cube2heli` 保存计时记录，csTimer 导出用 `input` 并保留 `cuberootEvent`。
- 运行 `node core/packages/client/scripts/native-puzzles/compare-outlines.mjs --set=cube2heli` 重现平面对照；生成结构图标后运行共享图标映射生成器，不为重合切缝编造额外线条。
- 扩展现有独立半空间、交错转动与 PG3D 中间帧用例，并遍历手动选择、拖转层、二维回退、分享锚点、Timer 外层预览与双进口 round-trip；独立模型和 jsdom 中间帧均不等于浏览器 3D 拖拽实测。
''')
Path('/tmp/cube2heli-files.txt').write_text('\n'.join(original) + '\n')
for path, old in original.items():
    print(''.join(difflib.unified_diff(old.splitlines(True), (root / path).read_text().splitlines(True), fromfile='a/' + path, tofile='b/' + path)))
