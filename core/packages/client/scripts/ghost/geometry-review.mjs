// SUPERSEDED exploratory approximation. Do not use these dimensions for the simulator.
// Canonical source-based pipeline: extract-reference.py -> analyze-reference.py -> render-reference.mjs.
// Offline review only: no simulator registration or engine implementation.
// Run from core/: pnpm --filter @cuberoot/client exec tsx scripts/ghost/geometry-review.mjs
// The mechanism is supported by the designer's archived description:
// https://www.cs.brandeis.edu/~storer/JimPuzzles/ZPAGES/zzzGhostCube.html
// Numeric dimensions below are a PROPOSAL, not measured Meffert's dimensions.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Euler, Quaternion, Vector3 } from 'three';
import { polytopeVerts } from '@cuberoot/puzzle-render-core/engine/polytopeCut';
import { layerThickness } from '@cuberoot/puzzle-render-core/engine/mirror/mirrorGeometry';

const OUT = fileURLToPath(new URL('../../../../../.tmp/png/', import.meta.url));
const RAD = Math.PI / 180;
const EPS = 1e-7;
const rotation = new Quaternion().setFromEuler(new Euler(-25 * RAD, 18 * RAD, 38 * RAD, 'XYZ'));
const pivot = new Vector3(0.04, -0.03, 0.02);
const halfCut = 0.35;
const homeDegrees = [-30, 0, 30];
const axis = (index) => new Vector3(...[0, 1, 2].map((i) => Number(i === index)));
const frameAxis = (index, layer) => axis(index)
  .applyAxisAngle(axis(1), homeDegrees[layer + 1] * RAD).applyQuaternion(rotation);
const plane = (n, d) => ({ n: n.toArray(), d });
const shell = [0, 1, 2].flatMap((index) => [-1, 1].map((sign) => plane(axis(index).multiplyScalar(sign), 1)));
const faces = [
  { label: '前面 F', normal: new Vector3(0, 0, 1), right: axis(0), up: axis(1) },
  { label: '右面 R', normal: axis(0), right: new Vector3(0, 0, -1), up: axis(1) },
  { label: '上面 U', normal: axis(1), right: axis(0), up: new Vector3(0, 0, -1) },
  { label: '后面 B', normal: new Vector3(0, 0, -1), right: new Vector3(-1, 0, 0), up: axis(1) },
  { label: '左面 L', normal: new Vector3(-1, 0, 0), right: axis(2), up: axis(1) },
  { label: '下面 D', normal: new Vector3(0, -1, 0), right: axis(0), up: axis(2) },
];

function layerPlanes(n, layer) {
  const center = n.dot(pivot);
  return [
    ...(layer < 1 ? [plane(n, center + (layer === -1 ? -halfCut : halfCut))] : []),
    ...(layer > -1 ? [plane(n.clone().negate(), -center + (layer === 1 ? -halfCut : halfCut))] : []),
  ];
}

function polygon(vertices, normal, distance) {
  const result = vertices.filter((v) => Math.abs(v.dot(normal) - distance) < EPS);
  if (result.length < 3) return [];
  const center = result.reduce((a, v) => a.add(v), new Vector3()).divideScalar(result.length);
  const u = result[0].clone().sub(center).normalize();
  const v = normal.clone().cross(u).normalize();
  return result.sort((a, b) => Math.atan2(a.clone().sub(center).dot(v), a.clone().sub(center).dot(u))
    - Math.atan2(b.clone().sub(center).dot(v), b.clone().sub(center).dot(u)));
}

function area(vertices) {
  const sum = new Vector3();
  for (let i = 0; i < vertices.length; i++) sum.add(vertices[i].clone().cross(vertices[(i + 1) % vertices.length]));
  return sum.length() / 2;
}

const cells = [];
for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
  const planes = [...shell, ...[x, y, z].flatMap((layer, index) => layerPlanes(frameAxis(index, y), layer))];
  const vertices = polytopeVerts(planes);
  assert.ok(vertices.length >= 4, `Empty cell ${x},${y},${z}`);
  assert.ok(vertices.every((v) => planes.every((p) => v.dot(new Vector3(...p.n)) <= p.d + EPS)), 'Invalid half-space vertex');
  const patches = faces.map((f) => polygon(vertices, f.normal, 1));
  let volume = 0;
  for (const p of planes) {
    const surface = polygon(vertices, new Vector3(...p.n), p.d);
    for (let i = 1; i + 1 < surface.length; i++) volume += surface[0].dot(surface[i].clone().cross(surface[i + 1])) / 6;
  }
  cells.push({ slot: [x, y, z], planes, vertices, patches, volume });
}

// Boundaries: 27 nonempty cells; one concealed core; every shell face fully covered.
const visible = cells.filter((cell) => cell.patches.some((p) => p.length));
assert.equal(visible.length, 26);
assert.deepEqual(cells.filter((cell) => !visible.includes(cell)).map((cell) => cell.slot), [[0, 0, 0]]);
assert.ok(Math.abs(cells.reduce((n, c) => n + c.volume, 0) - 8) < EPS, 'Volume partition');
for (let f = 0; f < faces.length; f++) assert.ok(Math.abs(visible.reduce((n, c) => n + area(c.patches[f]), 0) - 4) < EPS, `Face ${f} coverage`);
assert.equal(new Set(visible.map((c) => c.volume.toFixed(7))).size, 26, 'Proposal must have distinguishable piece volumes');

const svg = [];
const add = (s) => svg.push(s);
const line = (x1, y1, x2, y2, color, width = 2, extra = '') => add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`);
const text = (x, y, value, size = 17, color = '#202124', extra = '') => add(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${value}</text>`);
const square = (x, y, size, color, extra = '') => add(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" ${extra}/>`);
const GREEN = '#168443';
const BLUE = '#2769bf';
add('<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="970" viewBox="0 0 1300 970">');
add('<title>Ghost Cube 近似几何审核稿</title><desc>黑色为现有镜面方块基线，绿色为提议切线，蓝色为固定立方体边界，灰虚线为包络。提议参数未经实物测量，不是厂商工程图。</desc>');
add('<rect width="1300" height="970" fill="white"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">');
text(40, 58, 'Ghost Cube  幽灵魔方', 32, '#161616', 'font-weight="700"');
text(40, 94, '平面几何审核稿  /  近似提议，尚未接入模拟器', 19);
text(40, 126, '机制已查证；照片不足以反推精确切割角度，以下不是厂商工程尺寸。', 16, '#62666b');
[['#161616', '黑：现有镜面基线'], [GREEN, '绿：Ghost 提议切线'], [BLUE, '蓝：固定外轮廓'], ['#92979d', '灰虚线：约束包络']].forEach(([c, label], i) => {
  line(42 + i * 310, 158, 70 + i * 310, 158, c, 3, i === 3 ? 'stroke-dasharray="5 4"' : '');
  text(80 + i * 310, 164, label, 15);
});

// Existing mirror front-face baseline, sourced from the production thickness table.
text(40, 218, '现有镜面：直角切块', 20, '#161616', 'font-weight="600"');
const bx = 42, by = 244, bs = 218;
square(bx - 5, by - 5, bs + 10, '#92979d', 'stroke-dasharray="5 5"');
square(bx, by, bs, '#161616');
for (const [index, axisIndex] of [0, 1].entries()) {
  const widths = layerThickness(3, axisIndex);
  for (let cut = 1; cut <= 2; cut++) {
    const offset = widths.slice(0, cut).reduce((a, b) => a + b, 0) / 3 * bs;
    if (index === 0) line(bx + offset, by, bx + offset, by + bs, '#161616', 3);
    else line(bx, by + bs - offset, bx + bs, by + bs - offset, '#161616', 3);
  }
}
text(40, 496, '仅作现行几何对比', 16);
text(40, 522, '现有引擎中没有 Ghost Cube。', 15, '#62666b');
text(40, 574, '提议机制', 20, '#161616', 'font-weight="600"');
text(40, 609, '26 个可见块 + 1 个隐藏核心', 16);
text(40, 638, '错层闭合 → 对齐 → 三阶转动', 16);
text(40, 667, '完成后回到错层，闭成立方体', 16);
text(40, 712, '提议错层：上 +30° / 下 −30°', 15, GREEN);
text(40, 739, '角度可调，不是实物测量值', 15, '#62666b');
text(40, 787, '最终外观', 20, '#161616', 'font-weight="600"');
text(40, 820, '黑色本体 + 银白色贴片', 16);
text(40, 848, '图中绿色只用于审核切线', 15, '#62666b');

faces.forEach((face, f) => {
  const x = 370 + (f % 3) * 298;
  const y = 253 + Math.floor(f / 3) * 332;
  const size = 238;
  const project = (v) => [x + (v.dot(face.right) + 1) * size / 2, y + (1 - v.dot(face.up)) * size / 2];
  text(x, y - 24, face.label, 20, '#161616', 'font-weight="600"');
  square(x - 5, y - 5, size + 10, '#92979d', 'stroke-dasharray="5 5"');
  const segments = new Map();
  for (const cell of visible) {
    const patch = cell.patches[f];
    for (let i = 0; i < patch.length; i++) {
      const a = project(patch[i]);
      const b = project(patch[(i + 1) % patch.length]);
      // Fixed shell boundaries are drawn in blue, not overpainted in green.
      if ([0, 1].some((j) => Math.abs(a[j] - b[j]) < EPS && [j === 0 ? x : y, (j === 0 ? x : y) + size].some((edge) => Math.abs(a[j] - edge) < EPS))) continue;
      const key = [a, b].map((p) => p.map((v) => v.toFixed(5)).join(',')).sort().join('|');
      segments.set(key, [a, b]);
    }
  }
  for (const [a, b] of segments.values()) line(...a, ...b, GREEN, 2.8, 'stroke-linecap="round"');
  square(x, y, size, BLUE);
  text(x, y + size + 30, `${visible.filter((cell) => cell.patches[f].length).length} 个外表面分片`, 14, '#62666b');
});
text(40, 922, '已校验：26 个外块非空，核心隐藏；六面各完整覆盖；总体积等于立方体。', 16);
text(40, 949, '尚未验证：实物轮廓精确匹配、动态碰撞、拖拽与播放。确认轮廓后进入引擎实现。', 15, '#62666b');
add('</g></svg>');
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}ghost-approximate-review.svg`, svg.join('\n') + '\n');
const result = {
  status: 'proposal-awaiting-user-approval',
  parameters: { eulerXYZDegrees: [-25, 18, 38], pivot: pivot.toArray(), halfCut, homeDegrees },
  visiblePieces: visible.length,
  hiddenPieces: cells.length - visible.length,
  volume: cells.reduce((n, c) => n + c.volume, 0),
  faceAreas: faces.map((_, f) => visible.reduce((n, c) => n + area(c.patches[f]), 0)),
  patchesPerFace: faces.map((_, f) => visible.filter((c) => c.patches[f].length).length),
};
writeFileSync(`${OUT}ghost-approximate-review.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, svg: `${OUT}ghost-approximate-review.svg` }, null, 2));
