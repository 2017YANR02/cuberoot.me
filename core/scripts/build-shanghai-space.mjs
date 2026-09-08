// Build the local Huangpu scene from cached OSM API JSON, never from live requests.
// Usage (core/): node scripts/build-shanghai-space.mjs .tmp/png/shanghai-osm
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cache = process.argv[2];
assert(cache, 'Supply a directory of cached OSM JSON responses');
const bounds = [121.425, 31.14, 121.525, 31.26];
const origin = [121.4991, 31.2534];
const scale = Math.PI / 180 * 6378137;
const project = ([lon, lat]) => [Math.round((lon - origin[0]) * scale * Math.cos(origin[1] * Math.PI / 180) * 10) / 10, Math.round((origin[1] - lat) * scale * 10) / 10];
const inside = ([x, y]) => x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3];
const elements = new Map(), snapshots = [];
for (const file of readdirSync(cache).filter(f => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(resolve(cache, file), 'utf8'));
  assert(Array.isArray(data.elements), `Invalid OSM response: ${file}`);
  snapshots.push({ file, timestamp: data.osm3s?.timestamp_osm_base ?? data.elements.reduce((latest, e) => e.timestamp > latest ? e.timestamp : latest, ''), bounds: data.bounds });
  for (const e of data.elements) elements.set(`${e.type}/${e.id}`, e);
}
const coords = ids => ids.map(id => elements.get(`node/${id}`)).filter(Boolean).map(n => [n.lon, n.lat]);
// Clip closed rings to the surveyed envelope. No generated river bank or city grid.
function clipRing(input) {
  let ring = input.slice(0, -1);
  for (const [axis, boundary, sign] of [[0, bounds[0], 1], [0, bounds[2], -1], [1, bounds[1], 1], [1, bounds[3], -1]]) {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const ai = (a[axis] - boundary) * sign >= 0, bi = (b[axis] - boundary) * sign >= 0;
      if (ai) out.push(a);
      if (ai !== bi) { const t = (boundary - a[axis]) / (b[axis] - a[axis]); out.push(a.map((v, j) => v + (b[j] - v) * t)); }
    }
    ring = out;
  }
  return ring.length >= 3 ? [...ring, ring[0]] : [];
}
function joinRings(members) {
  const lines = members.map(m => elements.get(`way/${m.ref}`)?.nodes?.slice()).filter(Boolean), rings = [];
  while (lines.length) {
    const chain = lines.pop();
    while (chain[0] !== chain.at(-1)) {
      const i = lines.findIndex(l => l[0] === chain.at(-1) || l.at(-1) === chain.at(-1));
      if (i < 0) break;
      const next = lines.splice(i, 1)[0]; if (next[0] !== chain.at(-1)) next.reverse();
      chain.push(...next.slice(1));
    }
    if (chain[0] === chain.at(-1)) rings.push(coords(chain));
  }
  return rings;
}
function contains(point, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function kind(tags) {
  if (tags['building:part'] && tags['building:part'] !== 'no' || tags.building && tags.building !== 'no') return 'building';
  if (tags.natural === 'water' || tags.waterway === 'riverbank') return 'water';
  if (['park', 'garden', 'pitch'].includes(tags.leisure) || ['grass', 'forest', 'recreation_ground', 'meadow'].includes(tags.landuse) || ['wood', 'grassland', 'scrub'].includes(tags.natural)) return 'green';
  return null;
}
const polygons = [], roads = [], consumed = new Set();
const counts = { height: 0, levels: 0, fallback: 0, incompleteRelations: 0 };
function addPolygon(e, ring, holes = []) {
  const tags = e.tags ?? {}, k = kind(tags); if (!k) return;
  const clipped = clipRing(ring); if (!clipped.length) return;
  const area = Math.abs(clipped.reduce((sum, p, i) => { const b = clipped[(i + 1) % clipped.length]; return sum + p[0] * b[1] - b[0] * p[1]; }, 0)) * scale * scale * .5 * Math.cos(origin[1] * Math.PI / 180);
  if (area < (k === 'building' ? 18 : 50)) return;
  const number = text => { const n = Number.parseFloat(text); return Number.isFinite(n) && n >= 0 ? n : null; };
  const rawHeight = number(tags.height), levels = number(tags['building:levels']);
  const heightSource = rawHeight !== null ? 'height' : levels !== null ? 'levels' : 'fallback';
  // ponytail: OSM lacks many heights; a documented fixed 12 m fallback, never claimed surveyed.
  const height = Math.min(650, rawHeight ?? (levels !== null ? levels * 3.2 : 12));
  const minHeight = Math.min(height, number(tags.min_height) ?? (number(tags['building:min_level']) ?? 0) * 3.2);
  if (k === 'building') counts[heightSource]++;
  polygons.push({ id: `${e.type}/${e.id}`, kind: k, points: clipped.map(project),
    ...(holes.length ? { holes: holes.map(clipRing).filter(h => h.length).map(h => h.map(project)) } : {}),
    ...(k === 'building' ? { height, minHeight, heightSource, use: tags.building ?? tags['building:part'] } : {}),
    ...(tags.name ? { name: tags.name } : {}) });
}
for (const e of elements.values()) {
  if (e.type !== 'relation' || e.tags?.type !== 'multipolygon' || !kind(e.tags)) continue;
  const ways = e.members.filter(m => m.type === 'way');
  if (ways.some(m => !elements.has(`way/${m.ref}`))) { counts.incompleteRelations++; continue; }
  const outers = joinRings(ways.filter(m => m.role !== 'inner')), holes = joinRings(ways.filter(m => m.role === 'inner'));
  if (!outers.length) continue;
  for (const outer of outers) addPolygon(e, outer, holes.filter(h => contains(h[0], outer)));
  ways.forEach(m => consumed.add(m.ref));
}
const widths = { motorway: 20, trunk: 18, primary: 14, secondary: 11, tertiary: 9, residential: 6, unclassified: 6, service: 4, pedestrian: 5, footway: 2, cycleway: 2, path: 1.5, steps: 2 };
for (const e of elements.values()) {
  if (e.type !== 'way') continue;
  const tags = e.tags ?? {}, points = coords(e.nodes);
  if (points.length !== e.nodes.length) continue;
  if (kind(tags) && !consumed.has(e.id) && e.nodes[0] === e.nodes.at(-1)) addPolygon(e, points);
  if (widths[tags.highway] && tags.tunnel !== 'yes' && !tags.area && points.some(inside)) {
    // Split at envelope crossings instead of dragging off-map road vertices into the scene.
    let segment = [];
    const lanes = Number(tags.lanes), recordedWidth = Number.parseFloat(tags.width), layer = Number(tags.layer);
    const width = recordedWidth > 0 && recordedWidth <= 100 ? recordedWidth : Number.isInteger(lanes) && lanes > 0 && lanes <= 12 ? lanes * 3.5 + 1 : widths[tags.highway];
    const add = () => { if (segment.length > 1) roads.push({ id: e.id, kind: tags.highway, width, bridge: tags.bridge === 'yes' || tags.bridge === 'viaduct', ...(Number.isInteger(layer) && Math.abs(layer) <= 5 ? { layer } : {}), ...(tags.name ? { name: tags.name } : {}), points: segment.map(project) }); segment = []; };
    for (const p of points) { if (inside(p)) segment.push(p); else add(); } add();
  }
}
const riverWay = elements.get('way/47088277'); assert(riverWay, 'Huangpu centerline missing');
const river = coords(riverWay.nodes).filter(([lon, lat]) => lat >= 31.144 && lat <= 31.251 && lon < 121.519).reverse().map(project);
assert(river.length > 30 && polygons.filter(p => p.kind === 'water').length > 5, 'Incomplete Huangpu data');
assert(polygons.filter(p => p.kind === 'building').length > 500, 'Incomplete building coverage');
const water = polygons.filter(p => p.kind === 'water');
for (let i = 1; i < river.length; i++) {
  const a = river[i - 1], b = river[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 50);
  for (let j = 0; j <= steps; j++) {
    const p = a.map((v, axis) => v + (b[axis] - v) * j / steps);
    assert(water.some(w => contains(p, w.points) && !w.holes?.some(h => contains(p, h))), `River crosses missing water at ${p}; fetch the complete OSM relation before exporting`);
  }
}
const result = { version: 1, origin, bounds, source: 'OpenStreetMap contributors', license: 'ODbL-1.0', acquired: '2026-09-07', counts, river, polygons, roads };
const dest = resolve('packages/client/public/assets/space/shanghai-v1'); mkdirSync(dest, { recursive: true });
writeFileSync(resolve(dest, 'huangpu.json'), JSON.stringify(result) + '\n');
writeFileSync(resolve(dest, 'SOURCE.json'), JSON.stringify({ source: 'https://www.openstreetmap.org/copyright', license: 'ODbL-1.0', api: 'https://api.openstreetmap.org/api/0.6/map', acquired: result.acquired, bounds, origin, counts, snapshots,
  textures: [{ file: 'waternormals.jpg', source: 'https://raw.githubusercontent.com/mrdoob/three.js/r183/examples/textures/waternormals.jpg', license: 'MIT', sha256: 'add9912b158a4fe9c12421745babe68c44c8af75631ac4837236cb2a03bc373f' }],
}, null, 2) + '\n');
console.log(JSON.stringify({ polygons: polygons.length, buildings: polygons.filter(p => p.kind === 'building').length, water: polygons.filter(p => p.kind === 'water').length, roads: roads.length, riverPoints: river.length, counts, bytes: Buffer.byteLength(JSON.stringify(result)) }));
