// Offline evidence sheet, not simulator registration.
// From core/: pnpm --filter @cuberoot/client exec tsx scripts/ghost/render-reference.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { layerThickness } from '@cuberoot/puzzle-render-core/engine/mirror/mirrorGeometry';

const OUT = fileURLToPath(new URL('../../../../../.tmp/png/', import.meta.url));
const data = JSON.parse(readFileSync(`${OUT}ghost-original-analysis.json`, 'utf8'));
// Fixed diagnostic colors mandated by sim-add-puzzle; this is not application CSS.
const BLACK = '#161616', GREEN = '#168443', BLUE = '#2769bf', GRAY = '#92979d';
const faces = [
  { name: '前面 F', axis: 2, sign: 1, u: [1, 0], v: [0, 1] },
  { name: '右面 R', axis: 0, sign: 1, u: [0, -1], v: [1, 0] },
  { name: '上面 U', axis: 1, sign: 1, u: [1, 0], v: [0, -1] },
  { name: '后面 B', axis: 2, sign: -1, u: [-1, 0], v: [0, 1] },
  { name: '左面 L', axis: 0, sign: -1, u: [0, 1], v: [1, 0] },
  { name: '下面 D', axis: 1, sign: -1, u: [1, 0], v: [0, 1] },
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const title = (w, h, text) => [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${text}</title><rect width="${w}" height="${h}" fill="white"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">`];
const text = (s, x, y, label, size = 18, color = BLACK) => s.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${label}</text>`);
const line = (s, a, b, color, width = 2, extra = '') => s.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" ${extra}/>`);
const square = (s, x, y, size, color, extra = '') => s.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" ${extra}/>`);
const projector = (f, x, y, size) => p => [x + (dot(p, f.u) + 29) / 58 * size, y + (29 - dot(p, f.v)) / 58 * size];
const patches = f => data.cells.flatMap(c => c.patches.filter(p => p.axis === f.axis && p.sign === f.sign));
const polygon = (s, points, color, width) => s.push(`<polygon points="${points.map(p => p.join(',')).join(' ')}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linejoin="round"/>`);
async function save(name, svg) {
  const content = [...svg, '</g></svg>'].join('\n') + '\n';
  writeFileSync(`${OUT}${name}.svg`, content);
  await sharp(Buffer.from(content)).png().toFile(`${OUT}${name}.png`);
}

const s = title(1500, 1120, 'Ghost Cube 原作者数据反推切割方案');
text(s, 42, 58, 'Ghost Cube  原作者数据反推切割方案', 32);
text(s, 42, 96, '依据 Adam Cowan 2009 年公开 3D PDF；已核对全部 55 块贴纸，不是照片估形。', 19);
text(s, 42, 130, '本稿只审核轮廓，未接入模拟器；58 mm 是反推模型边长，不是量产款尺寸声明。', 17);
[[BLACK, '黑：现有镜面基线'], [GREEN, '绿：反推理想切线'], [BLUE, '蓝：冻结外轮廓'], [GRAY, '灰虚线：原贴纸包络']].forEach(([c, t], i) => {
  line(s, [42 + i * 358, 170], [70 + i * 358, 170], c, 3, i === 3 ? 'stroke-dasharray="5 4"' : '');
  text(s, 80 + i * 358, 176, t, 16);
});
text(s, 42, 238, '现有镜面', 21);
square(s, 44, 266, 200, BLACK);
for (let axis = 0; axis < 2; axis++) {
  const widths = layerThickness(3, axis);
  for (let cut = 1; cut < 3; cut++) {
    const v = widths.slice(0, cut).reduce((a, b) => a + b, 0) / 3 * 200;
    line(s, axis === 0 ? [44 + v, 266] : [44, 466 - v], axis === 0 ? [44 + v, 466] : [244, 466 - v], BLACK);
  }
}
text(s, 42, 502, '仅作现行引擎对比', 16);
text(s, 42, 554, '反推参数', 23);
text(s, 42, 595, '理想外壳：58 × 58 × 58 mm', 16);
text(s, 42, 627, '切割深度：±9.5 mm', 17);
text(s, 42, 659, '源 +Y 层：+29°', 19, GREEN);
text(s, 42, 691, '源 −Y 层：−35°', 19, GREEN);
text(s, 42, 721, '相对中层，绕源 +Y 右手旋转', 14);
text(s, 42, 747, '转轴不等于外壳 U / D 面法线', 14);
text(s, 42, 777, '全量几何核对', 23);
text(s, 42, 813, '55 / 55 块原贴纸吻合', 17);
text(s, 42, 845, '26 个可见 + 1 个内部几何单元', 15);
text(s, 42, 877, '59 个理想表面分片', 17);
text(s, 42, 909, '4 个微小分片内缩后无贴纸', 15);
text(s, 42, 954, '数值残差 &lt; 0.000004 mm', 16);
text(s, 42, 982, '仅对原文件；不是实物精度', 14);

faces.forEach((f, i) => {
  const x = 370 + (i % 3) * 365, y = 266 + Math.floor(i / 3) * 386, size = 292;
  text(s, x, y - 28, f.name, 23);
  const envelopePad = (30.1 - 29) / 58 * size; // Source sticker top planes: |shell coordinate| <= 30.1 mm.
  square(s, x - envelopePad, y - envelopePad, size + 2 * envelopePad, GRAY, 'stroke-dasharray="5 5"');
  const project = projector(f, x, y, size);
  const unique = new Map();
  for (const p of patches(f)) for (let j = 0; j < p.polygon.length; j++) {
    const a = p.polygon[j], b = p.polygon[(j + 1) % p.polygon.length];
    if ([0, 1].some(k => Math.abs(a[k] - b[k]) < 1e-6 && Math.abs(Math.abs(a[k]) - 29) < 1e-6)) continue;
    const key = [a, b].map(v => v.map(c => c.toFixed(5)).join(',')).sort().join('|');
    unique.set(key, [project(a), project(b)]);
  }
  for (const [a, b] of unique.values()) line(s, a, b, GREEN, 2.5);
  square(s, x, y, size, BLUE);
  const row = data.checks.coverage.find(c => c.axis === f.axis && c.sign === f.sign);
  text(s, x, y + size + 32, `${row.patches} 个理想分片 / ${row.stickers} 块原贴纸`, 16);
});
text(s, 42, 1057, '准确性边界：原 PDF 只含贴纸实体；内部机构、真实倒角、动态碰撞，以及量产款的尺寸公差尚未验证。', 17);
text(s, 42, 1090, '来源：twistypuzzles.com 原作者主题 t=12042，附件 id=9936。量产款另参照 TORIBO 贴纸图，不能视作工程图。', 15);
await save('ghost-original-geometry-review', s);

const overlay = title(1800, 1390, 'Ghost Cube 原始贴纸与解析重建全量叠合');
text(overlay, 46, 56, '55 块原始贴纸与解析重建：全量叠合', 30);
text(overlay, 46, 97, '黑粗线：PDF 原顶点；绿细线：由切平面重新生成；蓝框：反推 58 mm 外壳。全部面从外侧看。', 19);
text(overlay, 46, 128, '绿色位于黑线正中表示吻合。原始数字模型最大顶点偏差 0.00000353 mm；不是实物公差。', 18);
faces.forEach((f, i) => {
  const x = 60 + (i % 3) * 590, y = 205 + Math.floor(i / 3) * 585, size = 500;
  text(overlay, x, y - 27, f.name, 25);
  const project = projector(f, x, y, size);
  for (const source of data.sourceStickers.filter(p => p.axis === f.axis && p.sign === f.sign)) polygon(overlay, source.polygon.map(project), BLACK, 4);
  for (const p of patches(f).filter(p => p.sticker.length)) polygon(overlay, p.sticker.map(project), GREEN, 1.6);
  square(overlay, x, y, size, BLUE);
});
text(overlay, 46, 1362, '未将原 PDF 的 1 mm 外移展示量当成模拟器贴纸高度；它仅是复原源文件的拟合参数。', 17);
await save('ghost-original-overlay', overlay);

// Enlarged exact corner evidence, generated directly from vectors rather than raster upscaling.
const zoom = title(1300, 850, 'Ghost Cube 最小原贴纸放大核对');
text(zoom, 40, 54, '最小贴纸放大核对：body 12', 28);
text(zoom, 40, 93, '黑：原始 PDF；绿：解析重建。直线 / 尖角忠实保留，尚未添加生产模型倒圆角。', 18);
const small = data.sourceStickers.find(p => p.body === 12);
const analytic = data.cells.flatMap(c => c.patches).find(p => p.sourceBody === 12);
const center = small.polygon.reduce((a, p) => [a[0] + p[0] / small.polygon.length, a[1] + p[1] / small.polygon.length], [0, 0]);
const projectZoom = p => [650 + (p[0] - center[0]) * 220, 475 - (p[1] - center[1]) * 220];
polygon(zoom, small.polygon.map(projectZoom), BLACK, 7);
polygon(zoom, analytic.sticker.map(projectZoom), GREEN, 2);
text(zoom, 40, 813, '放大显示的对象为真实来源中最小的贴纸，非手绘补形。', 17);
await save('ghost-original-detail', zoom);
console.log(JSON.stringify({ outputs: ['ghost-original-geometry-review', 'ghost-original-overlay', 'ghost-original-detail'] }));
