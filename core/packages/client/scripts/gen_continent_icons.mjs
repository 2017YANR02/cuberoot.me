// 一次性脚本:从 countries-110m.geojson 按 CONTINENT 分组,输出 6 个 SVG 剪影
// 给 RecordsPage RegionPicker 的大洲选项用,跟国旗并排显示
//
// 用法:
//   node core/packages/client/scripts/gen_continent_icons.mjs
//
// 输出:core/packages/client/public/_assets/continent-icons/{africa,asia,europe,northAmerica,oceania,southAmerica}.svg

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const GEOJSON = resolve(REPO_ROOT, 'countries-110m.geojson');
const OUT_DIR = resolve(__dirname, '../public/_assets/continent-icons');

const CONTINENT_SLUG = {
  'Africa':        'africa',
  'Asia':          'asia',
  'Europe':        'europe',
  'North America': 'northAmerica',
  'Oceania':       'oceania',
  'South America': 'southAmerica',
};

// SVG viewBox 设计:viewBox 高度固定 100,宽度按内容自然比例算出.
// CSS 侧用 height:1em + width:auto,各洲自然宽度差异(欧亚很宽,非洲/南美方正)直接体现.
const VIEW_H = 100;
const PADDING = 4;

// 简化:Douglas-Peucker 类似的距离阈值过滤(在投影前的经纬度坐标上)
const SIMPLIFY_TOL = 0.5;  // 度

function simplify(points, tol) {
  if (points.length < 4) return points;
  const out = [points[0]];
  let lastKept = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const dx = points[i][0] - lastKept[0];
    const dy = points[i][1] - lastKept[1];
    if (Math.hypot(dx, dy) >= tol) {
      out.push(points[i]);
      lastKept = points[i];
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function flatten(geom) {
  // 返回 [[ring], ...] —— 多边形/多重多边形展开,只保留外环
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates[0]];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map(p => p[0]);
  return [];
}

function continentRings(features, continent) {
  // 政治归属(WCA continent_id):Russia = Europe.整个俄罗斯算欧洲,
  // 跟 countries-110m.geojson 的 CONTINENT 标记本身一致,不另外覆盖.
  const rings = [];
  for (const f of features) {
    if (f.properties.CONTINENT !== continent) continue;
    for (const r of flatten(f.geometry)) {
      rings.push(simplify(r, SIMPLIFY_TOL));
    }
  }
  return rings;
}

function pathFromRings(rings, project) {
  return rings.map(ring => {
    const pts = ring.map(project);
    if (pts.length === 0) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
    return d + 'Z';
  }).filter(Boolean).join(' ');
}

function renderSvg(rings, color = '#a8b3cf') {
  // 计算该洲 bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // 跨日界线特例(Oceania 经度从 -180..180):若 X 范围 > 270,折叠负 X
  if (maxX - minX > 270) {
    const remap = ([x, y]) => [x < 0 ? x + 360 : x, y];
    rings = rings.map(r => r.map(remap));
    minX = Infinity; maxX = -Infinity;
    for (const r of rings) for (const [x] of r) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  const w = maxX - minX;
  const h = maxY - minY;
  // 高度填到 VIEW_H,宽度按等比缩放算出 → 各洲自然 aspect ratio
  const usableH = VIEW_H - 2 * PADDING;
  const scale = usableH / h;
  const viewW = Math.round(w * scale + 2 * PADDING);
  const offsetX = PADDING - minX * scale;
  const offsetY = PADDING + maxY * scale; // y 翻转
  const project = ([lng, lat]) => [lng * scale + offsetX, -lat * scale + offsetY];
  const d = pathFromRings(rings, project);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${VIEW_H}" preserveAspectRatio="xMidYMid meet"><path d="${d}" fill="${color}" stroke="none"/></svg>\n`;
}

function main() {
  const geo = JSON.parse(readFileSync(GEOJSON, 'utf8'));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [continent, slug] of Object.entries(CONTINENT_SLUG)) {
    const rings = continentRings(geo.features, continent);
    if (rings.length === 0) {
      console.warn(`[gen-continent-icons] WARN: ${continent} has 0 rings`);
      continue;
    }
    const svg = renderSvg(rings);
    const outPath = resolve(OUT_DIR, `${slug}.svg`);
    writeFileSync(outPath, svg);
    const bytes = Buffer.byteLength(svg);
    console.log(`[gen-continent-icons] ${slug}.svg ${rings.length} rings, ${(bytes / 1024).toFixed(1)} KB`);
  }
}

main();
