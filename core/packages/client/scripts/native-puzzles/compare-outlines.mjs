// Reproducible pre-implementation face-cut review. Build puzzle-solvers first,
// then run this script from any directory; QA output stays outside watched src.
// No arguments: reproduce the original five-puzzle review.
// --set=2026-10: review the next five before their registry entries are built.
// --set=2026-10-12: review the mixed-axis and icosahedral additions.
// --set=cube2heli: review the central face cuts added to a planar Helicopter.
// --set=cube3heli: review the uniform 3x3 / Helicopter combination.
// --set=radiojewel: review Radio Jewel's exact face-cut depth.
// --set=catscradle: review Cat's Cradle's critical face-cut depth.
// --set=radiocanon: review Radio Canon's fixed-center face cuts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { Vector3 } from 'three';

const reviewSets = {
  radiojam: {
    basename: 'radiojam-outlines',
    rows: [{
      id: 'radiojam', en: 'Radio Jam (Radiolarian 8)',
      description: 'i f 0.4678640450004204', visibleFacelets: 440,
      prior: 'i f 0.5278640450004204', priorLabel: 'Radio Jewel (comparison, not retained cuts)',
      notes: ['Actual radio08 depth: 5 - 2 sqrt(5) - 0.06; not the unused radio8 constant.', '15 triangles + 6 pentagons + 1 hexagon per face; shape-preserving turns, no jumbling.'],
    }],
  },
  radiocanon: {
    basename: 'radiocanon-outlines',
    rows: [{
      id: 'radiocanon', en: 'Radio Canon (Radiolarian 1.5)',
      description: 'i f 0.77', visibleFacelets: 320,
      prior: 'i f 0.7453559924999299', priorLabel: 'Circo-Radiolarian (comparison; cuts are replaced)',
      notes: ['Face-normal depth h = 0.77; seven triangles and nine quadrilaterals per face.', 'Twenty fixed centers; shape-preserving 120-degree turns, without jumbling.'],
    }],
  },
  catscradle: {
    basename: 'catscradle-outlines',
    rows: [{
      id: 'catscradle', en: "Cat's Cradle (Radiolarian 5)",
      description: 'i f 0.566915270681799', visibleFacelets: 380,
      prior: 'i f 0.5478640450004204', priorLabel: 'Radio Web (comparison; cuts are replaced)',
      notes: ['Face-normal depth h = phi^2 / (2 + phi^2); 19 regions per face.', 'Fifteen triangles, three quadrilaterals and one hexagon; shape-preserving 120-degree turns.'],
    }],
  },
  radiojewel: {
    basename: 'radiojewel-outlines',
    rows: [
      {
        id: 'radiojewel', en: 'Radio Jewel (Radiolarian 7)',
        description: 'i f 0.5278640450004204', visibleFacelets: 320,
        prior: 'i f 0.3333333333333333', priorLabel: 'Radio Crystal (shape comparison; cuts are replaced)',
        notes: ['Exact face-normal depth h = 5 - 2 sqrt(5); fifteen triangles and one hexagon per face.', 'Shape-preserving 120-degree face turns; no jumbling or measured retail dimensions.'],
      },
    ],
  },
  cube2heli: {
    basename: 'cube2heli-outlines',
    rows: [{
      id: 'cube2heli', en: '2×2 + Helicopter',
      description: 'c f 0 e 0.7071067811865476', visibleFacelets: 48,
      prior: 'c e 0.7071067811865476', priorLabel: 'Helicopter (same visible seams)',
      notes: ['Central face cuts add 90-degree half-cube turns; edge cuts stay at sqrt(2)/2.', 'Eight triangles per face; 180-degree edge turns; shape-preserving, no jumbling.'],
    }],
  },
  cube3heli: {
    basename: 'cube3heli-outlines',
    rows: [
      {
        id: 'cube3heli', en: '3×3 + Helicopter',
        description: 'c f 0.333333333333333 e 0.7071067811865476', visibleFacelets: 168,
        prior: 'c f 0.333333333333333', priorLabel: '3×3',
        notes: ['Combine uniform face cuts at h = 1/3 with edge cuts at h = sqrt(2)/2.', '90-degree face turns and 180-degree edge turns; 28 regions per face.'],
      },
    ],
  },
  original: {
    basename: 'native-five-outlines',
    rows: [
      { id: 'lattice', prior: 'c v 0.577350269189626', priorLabel: 'Dino' },
      { id: 'hyperx', prior: 'c v 0.275', priorLabel: 'Master Skewb' },
      { id: 'latticex', prior: 'c v 0.577350269189626 v 1.154700538379252', priorLabel: 'Lattice' },
      { id: 'masterbrilic', prior: 'd f 0.447213595499989', priorLabel: 'Pyraminx Crystal' },
      { id: 'masterftov2', prior: 'o f 0 f 0.5', priorLabel: 'Master FTO' },
    ],
  },
  '2026-10': {
    basename: 'native-five-2026-10-outlines',
    // Proposal data intentionally precedes registry implementation. Once built,
    // a matching entry is checked below so this review cannot silently drift.
    rows: [
      {
        id: 'quadx', en: 'Quad-X',
        description: 'c e 0.47140452079103173', visibleFacelets: 126,
        prior: 'c e 0.7071067811865476', priorLabel: 'Helicopter (planar geometry reference)',
        notes: ['Edge-normal cuts at h = sqrt(2)/3, with cube half-edge 1.', 'Shape-preserving 180-degree edge turns; Helicopter is a geometric comparison.'],
      },
      {
        id: 'dinoocta', en: 'Dino Octa',
        description: 'o f 0.5', visibleFacelets: 80,
        prior: 'o f 0.333333333333333', priorLabel: 'FTO (three layers)',
        notes: ['Face-normal cuts at h = 1/2 give ten regions per triangular face.', 'Compared with the existing FTO; the black cuts are not retained.'],
      },
      {
        id: 'fto5', en: '5-layer FTO',
        description: 'o f 0.2 f 0.6', visibleFacelets: 200,
        prior: 'o f 0.333333333333333', priorLabel: 'FTO (three layers)',
        notes: ['Five equal edge divisions: cut depths h = 1/5 and 3/5.', 'Regular idealized construction; 25 triangles per face.'],
      },
      {
        id: 'eto', en: "Eitan's ETO",
        description: 'o e 0.6123724356957945', visibleFacelets: 104,
        prior: 'o f 0.333333333333333', priorLabel: 'FTO (shape reference)',
        notes: ['Edge-normal cuts at h = sqrt(6)/4, with shell inradius 1.', 'Shape-preserving 180-degree edge turns; no jumbling.'],
      },
      {
        id: 'radiocrystal', en: 'Radio Crystal',
        description: 'i f 0.3333333333333333', visibleFacelets: 300,
        prior: 'i f 0', priorLabel: 'Radio Chop',
        notes: ['Face-normal cuts at h = 1/3; 15 triangles per face.', 'Cut planes pass through six other face centers; no fixed face center.'],
      },
    ],
  },
  '2026-10-12': {
    basename: 'native-five-2026-10-12-outlines',
    rows: [
      {
        id: 'cube3skewb', en: '3×3 + Skewb',
        description: 'c f 0.333333333333333 v 0', visibleFacelets: 126,
        prior: 'c f 0.333333333333333', priorLabel: '3×3',
        notes: ['Combine uniform third-depth face cuts with four central Skewb planes.', 'Face turns: 90 degrees; corner turns: 120 degrees.'],
      },
      {
        id: 'heliskewb', en: 'Helicopter Skewb',
        description: 'c v 0 e 0.7071067811865476', visibleFacelets: 48,
        prior: 'c e 0.7071067811865476', priorLabel: 'Helicopter',
        notes: ['Add central corner cuts to the Helicopter edge cuts at h = sqrt(2)/2.', 'The visible face partition is unchanged; corner and edge turns are independent.'],
      },
      {
        id: 'comboctahedron', en: 'Comboctahedron',
        description: 'o f 0.333333333333333 v 0.5773502691896258 v 1.1547005383792517', visibleFacelets: 72,
        prior: 'o f 0.333333333333333', priorLabel: 'FTO',
        notes: ['Retain FTO face cuts; add the corner-axis cuts at h = 1/sqrt(3) and 2/sqrt(3).', 'Extra corner cuts follow existing face edges, retaining 72 visible triangles.'],
      },
      {
        id: 'circoradiolarian', en: 'Circo-Radiolarian',
        description: 'i f 0.7453559924999299', visibleFacelets: 300,
        prior: 'i f 0.61803398874989', priorLabel: "Eitan's Star",
        notes: ['Face-normal cuts at h = sqrt(5)/3 pass through adjacent face centers.', 'Nine triangles and six quadrilaterals per face; no central facelet.'],
      },
      {
        id: 'icosababyface', en: 'Deep-Cut Icosahedron',
        description: 'i v 0.562777422255239', visibleFacelets: 20,
        prior: 'i v 0.562777422255239 v 0.9105929973100289', priorLabel: 'Dogic',
        notes: ['Retain only the deep vertex-normal cut; its planes pass through adjacent vertices.', 'Twenty whole triangular facelets; rotate five around a vertex by 72 degrees.'],
      },
    ],
  },
};
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !args[0].startsWith('--set='))) {
  throw new Error(`Usage: node compare-outlines.mjs [--set=${Object.keys(reviewSets).join('|')}]`);
}
const setName = args[0]?.slice('--set='.length) ?? 'original';
if (!Object.hasOwn(reviewSets, setName)) throw new Error(`Unknown review set: ${setName}`);
const review = reviewSets[setName];
const pgOptions = { allMoves: true, orientCenters: true, addRotations: true };

function faceEdges(desc) {
  const pg = getPuzzleGeometryByDesc(desc, pgOptions);
  const data = pg.get3d();
  const face = data.faces[0];
  const vertices=Array.from({length:face.coords.length/3},(_,i)=>new Vector3().fromArray(face.coords,i*3));
  const center=vertices.reduce((sum,v)=>sum.add(v),new Vector3()).divideScalar(vertices.length);
  const u=vertices[1].clone().sub(vertices[0]).normalize();
  const v=vertices[2].clone().sub(vertices[0]).cross(u).normalize().cross(u).normalize();
  const projected=vertices.map(p=>[p.clone().sub(center).dot(u),p.clone().sub(center).dot(v)]);
  const half=Math.max(...projected.flat().map(Math.abs));
  const project=p=>[p.clone().sub(center).dot(u)/half,p.clone().sub(center).dot(v)/half];
  const edges = new Map();
  const key = p => p.map(x => Math.round(x * 1e7)).join(',');
  for (const s of data.stickers.filter(s => s.face === 0 && !s.isDup)) {
    const pts = Array.from({length:s.coords.length / 3},(_,i)=>project(new Vector3().fromArray(s.coords,i*3)));
    for(let i=0;i<pts.length;i++) {
      const a=pts[i], b=pts[(i+1)%pts.length];
      edges.set([key(a),key(b)].sort().join(';'),[a,b]);
    }
  }
  return { edges, pg, boundary:vertices.map(project), faces:data.faces.length, count: data.stickers.filter(s=>!s.isDup).length };
}

const escapeXml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
const text = (x, y, size, value, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
const page = (content, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}"><rect width="1200" height="${height}" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#222}</style>${content}</svg>`;
const legend = y => text(28, y, 15, 'Black: reference cuts   Green: proposed cuts   Blue: fixed shell boundary   Gray dashed: face envelope');

// Exact endpoint matching mislabels an existing cut when new intersections
// merely split its edge into shorter segments. Subtract collinear reference
// coverage so green marks only genuinely new parts of the partition.
function uncoveredEdge(a, b, reference) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
  const cross = p => dx * (p[1] - a[1]) - dy * (p[0] - a[0]);
  const project = p => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2;
  const tolerance = 1e-7;
  const intervals = [];
  for (const [c, d] of reference.values()) {
    if (Math.abs(cross(c)) > tolerance * Math.sqrt(length2) || Math.abs(cross(d)) > tolerance * Math.sqrt(length2)) continue;
    const start = Math.max(0, Math.min(project(c), project(d)));
    const end = Math.min(1, Math.max(project(c), project(d)));
    if (end - start > tolerance) intervals.push([start, end]);
  }
  intervals.sort((left, right) => left[0] - right[0]);
  let cursor = 0;
  const visible = [];
  const point = t => [a[0] + t * dx, a[1] + t * dy];
  for (const [start, end] of intervals) {
    if (start > cursor + tolerance) visible.push([point(cursor), point(start)]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1 - tolerance) visible.push([point(cursor), b]);
  return visible;
}

function renderRow(row) {
  const registered = NATIVE_PUZZLES[row.id];
  const spec = row.description ? row : registered;
  if (!spec) throw new Error(`Missing registry entry for ${row.id}; build puzzle-solvers first.`);
  if (row.description && registered && (row.description !== registered.description || row.visibleFacelets !== registered.visibleFacelets)) {
    throw new Error(`Proposal no longer matches the built registry: ${row.id}`);
  }
  const old = faceEdges(row.prior), next = faceEdges(spec.description);
  if (next.count !== spec.visibleFacelets) throw new Error(`${row.id}: expected ${spec.visibleFacelets} visible stickers, got ${next.count}`);
  const line = (a, b, color, width = 1.5) => `<line x1="${220 + a[0] * 166}" y1="${310 - a[1] * 166}" x2="${220 + b[0] * 166}" y2="${310 - b[1] * 166}" stroke="${color}" stroke-width="${width}"/>`;
  let svg = text(28, 34, 25, spec.en) + text(28, 61, 15, `${next.count / next.faces} regions per face / ${next.faces} faces / ${next.count} visible stickers`);
  svg += text(28, 87, 14, `Reference: ${row.priorLabel} (${row.prior})`);
  svg += text(28, 109, spec.description.length > 60 ? 12 : 14, `Proposal: ${spec.description}`);
  svg += '<rect x="44" y="134" width="352" height="352" fill="none" stroke="#999" stroke-dasharray="6 5"/>';
  for (const [a, b] of old.edges.values()) svg += line(a, b, '#111', 1.1);
  for (const [a, b] of next.edges.values()) {
    for (const [start, end] of uncoveredEdge(a, b, old.edges)) svg += line(start, end, '#12a348', 2);
  }
  svg += `<polygon points="${next.boundary.map(p => `${220 + p[0] * 166},${310 - p[1] * 166}`).join(' ')}" fill="none" stroke="#2869d8" stroke-width="2.2"/>`;
  svg += text(805, 117, 15, 'Complete solved net · actual PuzzleGeometry output', 'middle');
  // Preserve the engine's full SVG and viewBox, and namespace its IDs when
  // embedding several nets on one sheet. No face is substituted or redrawn.
  svg += next.pg.generatesvg()
    .replace('<svg ', '<svg x="438" y="128" width="734" height="390" ')
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${row.id}-${id}"`);
  const notes = row.notes ?? ['Idealized symmetric cut geometry.', 'Cut depths are not commercial measurements.'];
  notes.forEach((note, index) => { svg += text(28, 545 + index * 23, 15, note); });
  console.log(`${row.id}: ${next.faces} faces, ${next.count / next.faces} regions per face, ${next.count} visible stickers`);
  return svg;
}

const outputDir = new URL('../../../../.tmp/png/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
let content = text(28, 37, 27, 'Native puzzle cut review') + legend(69);
review.rows.forEach((row, index) => {
  const rendered = renderRow(row);
  content += `<g transform="translate(0 ${100 + index * 600})">${rendered}</g>`;
  writeFileSync(new URL(`${review.basename}-${row.id}.svg`, outputDir), page(`${legend(28)}<g transform="translate(0 50)">${rendered}</g>`, 650));
});
writeFileSync(new URL(`${review.basename}.svg`, outputDir), page(content, 100 + review.rows.length * 600));
console.log(`Wrote core/.tmp/png/${review.basename}.svg and one enlarged SVG per puzzle`);
