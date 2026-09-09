import * as T from 'three';
import type { PaperScenery } from './history-scenery';

type Point = [number, number, number];
type ReliefLandform = 'alpine' | 'folded' | 'fault' | 'plateau' | 'karst' | 'cave' | 'sinkhole' | 'volcano' | 'caldera' | 'lava' | 'basalt' | 'geothermal';
type Landform = (art: PaperScenery, root: T.Group, day: number) => void;

/** Faceted paper surfaces retain UVs and normals for PaperScenery's static merge. */
function skin(art: PaperScenery, root: T.Object3D, rows: Point[][], color: string, reverse = false) {
  const positions: number[] = [], uvs: number[] = [];
  const width = rows[0].length;
  for (let row = 0; row < rows.length - 1; row++) for (let column = 0; column < width - 1; column++) {
    const corners = [[row, column], [row + 1, column], [row, column + 1], [row, column + 1], [row + 1, column], [row + 1, column + 1]];
    if (reverse) { [corners[1], corners[2]] = [corners[2], corners[1]]; [corners[4], corners[5]] = [corners[5], corners[4]]; }
    for (const [r, c] of corners) { positions.push(...rows[r][c]); uvs.push(c / (width - 1), r / (rows.length - 1)); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return art.mesh(root, geometry, color);
}

/** A radial section can describe a mountain flank, open crater, rim or basin wall. */
function radial(art: PaperScenery, root: T.Object3D, center: Point, rx: number, rz: number,
  profile: [number, number][], color: string, start = 0, end = Math.PI * 2, roughness = .035) {
  const segments = Math.ceil((end - start) * 11);
  return skin(art, root, profile.map(([r, y]) => Array.from({ length: segments + 1 }, (_, i): Point => {
    const a = start + (end - start) * i / segments;
    const crinkle = 1 + roughness * (Math.sin(a * 5 + .8) + Math.sin(a * 9) * .35);
    return [center[0] + Math.cos(a) * rx * r * crinkle, center[1] + y, center[2] + Math.sin(a) * rz * r * crinkle];
  })), color);
}

function shard(art: PaperScenery, root: T.Object3D, point: Point, scale: Point, color: string, lean = 0) {
  const rock = art.mesh(root, new T.DodecahedronGeometry(1, 0), color, point);
  rock.scale.set(...scale); rock.rotation.set(.08, lean, .07);
  return rock;
}

function cone(art: PaperScenery, root: T.Object3D, position: Point, radius: number, height: number, color: string, hanging = false) {
  const stone = art.mesh(root, new T.ConeGeometry(radius, height, 9, 1), color, position);
  if (hanging) stone.rotation.z = Math.PI;
  return stone;
}

function pool(art: PaperScenery, root: T.Object3D, center: Point, rx: number, rz: number, color: string) {
  const surface = art.mesh(root, new T.CircleGeometry(1, 64), color, center);
  surface.rotation.x = -Math.PI / 2; surface.scale.set(rx, rz, 1);
  surface.castShadow = false;
  return surface;
}

/** Natural landforms frame the dated sculptures; their central display area remains open. */
export const RELIEF_LANDFORMS: Record<ReliefLandform, Landform> = {
  alpine(art, root, _day) {
    const p = art.palette;
    // An uneven knife-edge skyline, with separate rock faces instead of stacked cones.
    art.shape(root, [[-12.7, .15], [-11.3, 2.8], [-9.5, 3.4], [-7.8, 7.2], [-6.2, 10.3], [-5.5, 7.9], [-3.8, 5.3], [-1.2, 6.8],
      [1, 4.7], [3.1, 8], [4.5, 9.5], [5.5, 6.7], [7, 5.9], [9.2, 7.1], [11, 3], [12.5, .15]], 3.8,
    art.mix(p.jade, p.paper, .38), [0, 0, -12.8]);
    art.shape(root, [[-11.7, .2], [-7.8, 7.2], [-6.2, 10.3], [-6.8, 5.7], [-4.6, 3.4], [-2.6, .2]], .14,
      art.mix(p.forest, p.ice, .27), [0, 0, -8.94]);
    art.shape(root, [[1.2, .2], [3.1, 8], [4.5, 9.5], [4.4, 5.2], [7.4, 2.9], [10.4, .2]], .16,
      art.mix(p.forest, p.paper, .36), [0, 0, -8.92]);
    art.shape(root, [[-7.8, 7.2], [-6.2, 10.3], [-5.5, 7.9], [-4.7, 6.7], [-5.6, 7.3], [-6.15, 6.5], [-6.6, 8]], .15, p.snow, [0, .02, -8.76]);
    art.shape(root, [[2.7, 7], [4.5, 9.5], [5.5, 6.7], [4.6, 7.2], [4.1, 6.4], [3.8, 7.8]], .14, p.snow, [0, .02, -8.74]);
    // A glacial cirque: nested, scooped ledges with an exposed blue ice tongue.
    for (let i = 0; i < 5; i++) {
      const y = .25 + i * .27;
      art.line(root, [[-3.9 + i * .18, y, -7.6], [-3.4 + i * .16, y + .63, -8.1], [-1.5, y + 1, -8.5], [.6 - i * .17, y + .5, -8.1]], .1,
        art.mix(p.ice, p.paper, .28 + i * .13));
    }
    skin(art, root, [[[-2.9, .28, -6.7], [-2, .27, -6.45], [-1, .28, -6.6]], [[-2.6, 1.2, -8.15], [-1.9, 1.35, -8.4], [-1.3, 1.18, -8.2]]], p.ice, true);
    for (let i = 0; i < 7; i++) {
      const x = -11.7 + i * .54;
      shard(art, root, [x, .21 + i % 3 * .1, -7.35 + Math.sin(i) * .35], [.35, .2 + i % 3 * .1, .31], p.limestone, i * .43);
    }
    for (const points of [
      [[-6.2, 9.7, -8.57], [-6.9, 6.1, -8.55], [-9.3, 2.4, -8.55]],
      [[4.5, 9, -8.54], [4.1, 5.5, -8.54], [6.7, 2, -8.54]],
      [[9.2, 6.6, -8.78], [8.4, 4, -8.76], [10.4, 1.2, -8.73]],
    ] as Point[][]) art.line(root, points, .027, p.paper);
  },

  folded(art, root, _day) {
    const p = art.palette;
    const fold = (x: number) => 3.35 + 1.55 * Math.cos((x + 6.1) * .45) + .75 * Math.sin(x * .77);
    const xs = Array.from({ length: 81 }, (_, i) => -12.4 + i * .31);
    // The same sediment beds bend through anticlines and synclines without being cut apart.
    for (let layer = 0; layer < 10; layer++) {
      const points: [number, number][] = [
        ...xs.map((x): [number, number] => [x, fold(x) + layer * .29]),
        ...[...xs].reverse().map((x): [number, number] => [x, fold(x) + (layer + 1) * .29]),
      ];
      art.shape(root, points, 3.3, art.mix(layer % 3 === 0 ? p.clay : p.limestone, p.paper, .2 + layer * .055), [0, 0, -12]);
    }
    // Low toes close the rock mass while leaving the wavy beds legible on its cut face.
    art.shape(root, [[-12.4, .1], [12.4, .1], ...[...xs].reverse().map((x): [number, number] => [x, fold(x)])], 3.3,
      art.mix(p.jade, p.paper, .52), [0, 0, -12]);
    for (let layer = 1; layer < 10; layer += 2) {
      art.line(root, xs.filter((_, i) => i % 4 === 0).map((x): Point => [x, fold(x) + layer * .29, -8.65]), .025, p.paper);
    }
    for (const x of [-11, -3, 4.6, 10.7]) {
      art.line(root, [[x, fold(x) + 2.82, -11.4], [x + .45, fold(x + .45) + 2.86, -10.3], [x + .7, fold(x + .7) + 2.84, -9]], .034, p.jade);
    }
    for (let i = 0; i < 4; i++) {
      shard(art, root, [-11.5 + i * .6, .28, -7.5], [.49, .25, .34], art.mix(p.clay, p.paper, .55), i * .21);
    }
  },

  fault(art, root, _day) {
    const p = art.palette;
    const blocks = [
      { x: -12.3, w: 7.1, h: 7.3, lean: 1.25, z: -12.3, depth: 4.5 },
      { x: -3.3, w: 6, h: 3.55, lean: -.72, z: -11.9, depth: 4 },
      { x: 4.5, w: 7, h: 8.55, lean: .9, z: -12.5, depth: 4.5 },
    ];
    for (const { x, w, h, lean, z, depth } of blocks) {
      art.shape(root, [[0, .15], [w, .15], [w - .6, h - lean], [.65, h]], depth, art.mix(p.clay, p.paper, .48), [x, 0, z]);
      for (let layer = 0; layer < 9; layer++) {
        const y = .45 + layer * (h - .8) / 9, next = y + .19;
        art.shape(root, [[.65 * y / h, y], [w - .6 * y / h, y - lean * y / h], [w - .6 * next / h, next - lean * next / h], [.65 * next / h, next]], .07,
          art.mix(layer % 3 ? p.limestone : p.gold, p.paper, .45), [x, 0, z + depth + .015]);
      }
      art.shape(root, [[.65, h], [w - .6, h - lean], [w - .68, h - lean - .18], [.62, h - .18]], depth + .05,
        art.mix(p.jade, p.paper, .38), [x, 0, z - .015]);
      for (let i = 0; i < 3; i++) art.line(root, [[x + w - .15, .7 + i * .4, z + depth + .07], [x + w - .35, h * .45 + i * .2, z + depth + .08], [x + w - .59, h - lean - .1, z + depth + .08]], .022, p.ink);
    }
    // Exposed, inclined fault surfaces are deliberately separate from the horizontal strata.
    skin(art, root, [[[-4.8, .15, -7.8], [-4.8, .15, -11.5]], [[-5.3, 6.1, -7.8], [-5.3, 6.1, -11.5]]], art.mix(p.forest, p.paper, .3), true);
    for (let i = 0; i < 7; i++) {
      shard(art, root, [3.25 + Math.sin(i * 1.5) * .25, .24 + i % 2 * .06, -11.4 + i * .54], [.34, .18, .38], p.limestone, i);
    }
  },

  plateau(art, root, _day) {
    const p = art.palette;
    const outline: [number, number][] = [[-12.2, .15], [-11.6, 2.2], [-10.8, 2.4], [-10.2, 6.5], [-8.3, 6.5], [-7.1, 6.7],
      [1.8, 6.7], [3.2, 6.45], [4.8, 6.45], [5.2, 4], [6, 3.6], [6.9, .15]];
    art.shape(root, outline, 4.2, art.mix(p.clay, p.paper, .48), [0, 0, -12.4]);
    for (let i = 0; i < 10; i++) {
      const y = .42 + i * .57, left = -11.65 + i * .17, right = 6.55 - i * .19;
      art.shape(root, [[left, y], [right, y], [right - .06, y + .13], [left + .04, y + .13]], .08,
        art.mix(i % 3 ? p.limestone : p.clay, p.paper, .55), [0, 0, -8.15]);
    }
    art.box(root, [14.55, .12, 4.08], [-2.48, 6.53, -10.22], art.mix(p.jade, p.paper, .47));
    art.box(root, [8.8, .17, 3.8], [-2.7, 6.69, -10.33], art.mix(p.jade, p.paper, .6));
    for (const x of [-9.2, -7.6, -4.8, -.4, 2.4, 4.3]) {
      art.line(root, [[x, 6.5, -8.04], [x + .22, 4.5, -8.06], [x - .2, 2.9, -8.07]], .026, art.mix(p.forest, p.paper, .3));
    }
    // A detached butte and an incised dry stream explain how the plateau has been dissected.
    art.shape(root, [[7.95, .1], [8.6, 2.6], [8.9, 4.25], [10.9, 4.25], [11.6, 2.1], [12.5, .1]], 3.3, p.limestone, [0, 0, -11.2]);
    for (let i = 0; i < 6; i++) art.line(root, [[8.35 + i * .09, .65 + i * .55, -7.85], [9.8, .65 + i * .55, -7.83], [11.9 - i * .14, .65 + i * .55, -7.85]], .04, p.paper);
    art.line(root, [[-8, 6.64, -11.7], [-6, 6.83, -10.7], [-4, 6.83, -11.2], [-1.6, 6.83, -10], [1.9, 6.62, -8.35]], .075, p.limestone);
  },

  karst(art, root, _day) {
    const p = art.palette;
    const towers = [[-10.8, -9.2, 6.9, 1.6], [-6.7, -10.5, 9.4, 1.85], [-2.3, -10.6, 5.9, 1.3], [2, -10.7, 8.2, 1.65], [6.4, -9.8, 6.3, 1.7], [10.8, -8.9, 8.7, 1.6]];
    for (const [index, [x, z, h, r]] of towers.entries()) {
      const shape: [number, number][] = [[1.13, .1], [1, .8], [.81, h * .22], [.77, h * .52], [.68, h * .78], [.49, h * .94], [.2, h], [.02, h * .97]];
      radial(art, root, [x, 0, z], r, 1.33, shape, art.mix(p.limestone, p.jade, .15 + index % 3 * .06), 0, Math.PI * 2, .07);
      radial(art, root, [x, 0, z], r, 1.33, [[.52, h * .925], [.3, h * .99], [.015, h]], art.mix(p.jade, p.paper, .28), 0, Math.PI * 2, .07);
      for (let groove = 0; groove < 5; groove++) {
        const a = .35 + groove * .6, c = Math.cos(a), s = Math.sin(a);
        art.line(root, [[x + c * r * .84, .7, z + s * 1.14], [x + c * r * .79, h * .35, z + s * 1.13],
          [x + c * r * .76, h * .59, z + s * 1.05], [x + c * r * .59, h * .84, z + s * .91]], .023, art.mix(p.forest, p.paper, .37));
      }
      shard(art, root, [x + .5, .3, z + 1.7], [.55, .24, .4], art.mix(p.jade, p.paper, .45), index * .7);
    }
    art.line(root, [[-11.7, .12, -6.6], [-9.1, .13, -7], [-7.5, .13, -6.7]], .13, art.mix(p.water, p.paper, .3));
  },

  cave(art, root, _day) {
    const p = art.palette;
    const outside: [number, number][] = [[-11.8, .1], [-11.1, 3.5], [-9.6, 6.2], [-6.8, 8], [-2.8, 8.8], [1.2, 8.5], [5.8, 7.6], [8.2, 5.8], [10.3, .1]];
    const inside: [number, number][] = [[-7, .36], [-6.9, 2.9], [-5.8, 4.9], [-3.8, 6.25], [-1, 6.65], [2.2, 6.2], [4.7, 4.8], [5.9, 2.7], [6.15, .36]];
    const wall = new T.Shape(outside.map(([x, y]) => new T.Vector2(x, y)));
    wall.holes.push(new T.Path(inside.map(([x, y]) => new T.Vector2(x, y))));
    art.mesh(root, new T.ExtrudeGeometry(wall, { depth: 3.5, bevelEnabled: false }), art.mix(p.limestone, p.paper, .3), [0, 0, -12.6]);
    // Open arch strips follow the real opening; no dark disc or wall closes the passage.
    for (let layer = 0; layer < 3; layer++) {
      const outer = inside.map(([x, y]) => new T.Vector2(x * (1.075 + layer * .035), .12 + y * (1.07 + layer * .025)));
      const inner = inside.map(([x, y]) => new T.Vector2(x * (1.015 + layer * .035), .1 + y * (1.013 + layer * .025)));
      const arch = new T.Shape([...outer, ...inner.reverse()]);
      art.mesh(root, new T.ExtrudeGeometry(arch, { depth: .16, bevelEnabled: false }), layer % 2 ? p.paper : p.limestone, [0, 0, -9.1 + layer * .17]);
    }
    for (let i = 0; i < 9; i++) {
      const x = -5.4 + i * 1.1, roof = 6.45 - ((x + .4) / 6) ** 2 * 1.75, h = .85 + (i * 7 % 5) * .36;
      cone(art, root, [x, roof - h / 2, -9.6 - (i % 2) * .6], .19 + i % 3 * .08, h, i % 2 ? p.paper : p.limestone, true);
      if (i % 2 === 0) cone(art, root, [x + .35, .35 + (.95 + i * .14) / 2, -9.3], .28, .95 + i * .14, p.limestone);
    }
    art.line(root, [[-10.4, 1.4, -8.91], [-9.6, 3.8, -8.89], [-7.5, 6.4, -8.89], [-4.4, 7.7, -8.9]], .028, p.paper);
    art.line(root, [[3.5, 7.5, -8.88], [6.8, 6.1, -8.88], [8.6, 3.4, -8.89]], .029, p.paper);
    pool(art, root, [-1.4, .21, -8.5], 3.4, .85, art.mix(p.water, p.paper, .25));
    for (let i = 0; i < 5; i++) shard(art, root, [7.1 + i * .86, .29, -7.85 + Math.sin(i) * .3], [.46, .22, .38], p.limestone, i);
  },

  sinkhole(art, root, _day) {
    const p = art.palette, center: Point = [-1.9, 0, -9.45];
    // The near sector is removed to expose the vertical limestone throat and its low floor.
    const from = 2.03, to = Math.PI * 2 + 1.1;
    radial(art, root, center, 9.25, 2.85, [[1, .15], [1, 3.8], [.91, 4.05], [.68, 3.82]], art.mix(p.jade, p.paper, .42), from, to);
    for (let layer = 0; layer < 9; layer++) {
      const y = .32 + layer * .39, lower = .235 + layer * .052, upper = lower + .052;
      radial(art, root, center, 9.25, 2.85, [[upper, y + .39], [lower, y]], art.mix(layer % 3 ? p.limestone : p.clay, p.paper, .5), from, to);
      radial(art, root, center, 9.25, 2.85, [[upper + .012, y + .39], [upper, y + .36]], p.paper, from, to);
    }
    pool(art, root, [-1.9, .24, -9.45], 2.18, .69, p.forest);
    pool(art, root, [-1.9, .26, -9.45], 1.42, .48, p.water);
    for (const a of [from, to]) {
      const outerX = center[0] + Math.cos(a) * 9.25, outerZ = center[2] + Math.sin(a) * 2.85;
      const innerX = center[0] + Math.cos(a) * 2.18, innerZ = center[2] + Math.sin(a) * .69;
      skin(art, root, [[[innerX, .24, innerZ], [outerX, .15, outerZ]], [[innerX, .4, innerZ], [outerX, 3.8, outerZ]]], p.limestone, a === from);
      for (let i = 0; i < 6; i++) art.line(root, [[innerX, .32 + i * .018, innerZ], [outerX, .65 + i * .52, outerZ]], .026, p.paper);
    }
    for (let i = 0; i < 7; i++) {
      const a = 2.4 + i * .51;
      const x = center[0] + Math.cos(a) * 8.6, z = center[2] + Math.sin(a) * 2.58;
      shard(art, root, [x, 4.12, z], [.53, .23, .28], art.mix(p.jade, p.paper, .23), i * .4);
      if (i % 2 === 0) art.line(root, [[x, 4, z], [x * .86 + center[0] * .14, 2.8, z * .85 + center[2] * .15], [x * .72 + center[0] * .28, 1.8, z * .7 + center[2] * .3]], .031, p.jade);
    }
  },

  volcano(art, root, _day) {
    const p = art.palette, c: Point = [-3.4, 0, -9.5];
    radial(art, root, c, 8.2, 3.05, [[1, .1], [.88, .65], [.67, 2.6], [.46, 5.3], [.28, 7.8], [.235, 8.2]], art.mix(p.clay, p.paper, .26));
    radial(art, root, c, 8.2, 3.05, [[.235, 8.2], [.19, 8.12], [.13, 6.3]], art.mix(p.ink, p.clay, .42));
    radial(art, root, c, 8.2, 3.05, [[.247, 8.11], [.237, 8.26], [.196, 8.18]], art.mix(p.limestone, p.paper, .5));
    pool(art, root, [c[0], 6.33, c[2]], 1.1, .42, p.vermilion);
    pool(art, root, [c[0] - .11, 6.35, c[2]], .54, .23, p.gold);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12 + .12;
      art.line(root, [[c[0] + Math.cos(a) * 1.97, 7.85, c[2] + Math.sin(a) * .74], [c[0] + Math.cos(a + .07) * 3.75, 5.05, c[2] + Math.sin(a + .07) * 1.42],
        [c[0] + Math.cos(a - .04) * 5.5, 2.55, c[2] + Math.sin(a - .04) * 2.06], [c[0] + Math.cos(a) * 7.5, .56, c[2] + Math.sin(a) * 2.8]], .026,
      art.mix(p.limestone, p.clay, .42));
    }
    // A narrow breach drains down the visible flank; the summit remains an open crater.
    art.line(root, [[-2.6, 8, -8.94], [-2.1, 6.1, -8.36], [-1.1, 4.2, -7.84], [-.8, 2.7, -7.52], [.5, .63, -7.1]], .07, p.vermilion);
    for (let i = 0; i < 5; i++) shard(art, root, [6.7 + i * 1.2, .31 + i % 2 * .12, -8.1 + Math.sin(i) * .52], [.61, .27 + i % 2 * .12, .48], art.mix(p.ink, p.clay, .43), i * .72);
  },

  caldera(art, root, _day) {
    const p = art.palette, c: Point = [-.5, 0, -9.45];
    // A broad collapsed summit with a low near breach differs from the steep single cone.
    const from = 1.86, to = Math.PI * 2 + 1.23;
    radial(art, root, c, 11.65, 3.1, [[1, .15], [.89, 2], [.77, 3.8], [.71, 4.25], [.6, 3.7], [.49, .72]], art.mix(p.clay, p.paper, .5), from, to, .027);
    radial(art, root, c, 11.65, 3.1, [[.77, 3.82], [.71, 4.32], [.67, 4.16]], art.mix(p.jade, p.paper, .36), from, to, .027);
    for (let i = 0; i < 5; i++) {
      const r = .49 + i * .022, y = .73 + i * .49;
      radial(art, root, c, 11.65, 3.1, [[r + .023, y + .49], [r, y]], art.mix(p.limestone, p.paper, .24 + i * .11), from, to, .027);
    }
    pool(art, root, [-.5, .76, -9.45], 6, 1.64, art.mix(p.ocean, p.water, .45));
    radial(art, root, [-2.1, .74, -9.9], 1.85, .72, [[1, 0], [.62, .8], [.16, 1.4], [.01, 1.45]], art.mix(p.jade, p.paper, .23));
    for (let i = 0; i < 4; i++) {
      const x = 8.4 + i * .77;
      shard(art, root, [x, .39 + i % 2 * .17, -7.75 + Math.sin(i) * .48], [.62, .36, .43], p.limestone, i * .38);
    }
    art.line(root, [[.1, .78, -7.86], [.5, .5, -7.2], [1.25, .16, -6.32]], .19, art.mix(p.water, p.paper, .23));
    for (let i = 0; i < 3; i++) art.line(root, [[-6.9, 2.1 + i * .53, -7.59], [-6, 2.7 + i * .39, -7.38], [-4.7, 3.2 + i * .23, -7.13]], .027, p.paper);
  },

  lava(art, root, _day) {
    const p = art.palette;
    const crest: [number, number][] = [[-12.3, .1], [-11.4, 1.1], [-8.8, 1.8], [-4.2, 2.55], [1.7, 2.3], [6.2, 1.5], [11.9, .25]];
    const heightAt = (x: number) => {
      const right = crest.findIndex(([px]) => px >= x);
      if (right <= 0) return crest[right === 0 ? 0 : crest.length - 1][1];
      const [ax, ay] = crest[right - 1], [bx, by] = crest[right];
      return ay + (by - ay) * (x - ax) / (bx - ax);
    };
    // A low, spreading lava field has braided rope folds and broken crust, without a mountain cone.
    art.shape(root, [...crest, [11.9, .02], [-12.3, .02]], 4.4,
      art.mix(p.ink, p.clay, .47), [0, 0, -12.3]);
    for (let row = 0; row < 8; row++) {
      const x = -10.7 + row * 2.7;
      for (let cord = 0; cord < 5; cord++) {
        const points: Point[] = [];
        for (let i = 0; i < 11; i++) {
          const t = i / 10;
          const px = x + (t - .5) * 2.8;
          points.push([px, heightAt(px) + .085 + Math.sin(t * Math.PI) * .035, -11.1 + cord * .46 + Math.sin(t * Math.PI) * .46]);
        }
        art.line(root, points, .062 + cord * .006, art.mix(p.clay, p.limestone, .17 + cord * .085));
      }
    }
    const fissure: Point[] = [[-8.5, -10.6], [-5.7, -10.25], [-3.8, -9.65], [-.7, -9.77], [2.1, -9.1], [5.7, -8.57], [8.7, -8.25]].map(([x, z]) => [x, heightAt(x) + .065, z]);
    art.line(root, fissure, .115, p.vermilion);
    art.line(root, fissure.map(([x, y, z]): Point => [x, y + .065, z]), .032, p.gold);
    art.line(root, [[-.7, -9.77], [1, -10.45], [2.2, -11.5]].map(([x, z]): Point => [x, heightAt(x) + .07, z]), .072, p.vermilion);
    for (let i = 0; i < 9; i++) {
      const x = -11.6 + i * 2.6;
      shard(art, root, [x, .36 + i % 3 * .07, -7.34 + Math.sin(i * 1.6) * .22], [.76, .32, .48], art.mix(p.ink, p.clay, .3 + i % 3 * .08), i * .64);
    }
    for (let i = 0; i < 3; i++) radial(art, root, [-9.8 + i * 1.6, heightAt(-9.8 + i * 1.6) + .01, -11.7], .7, .47,
      [[1, 0], [.85, .38], [.6, .53], [.4, .35]], p.ink, 0, Math.PI * 2, .03);
  },

  basalt(art, root, _day) {
    const p = art.palette;
    // Interlocking hexagons rise in irregular organ-pipe clusters; horizontal joints cut each prism.
    for (let row = 0; row < 4; row++) for (let column = 0; column < 16; column++) {
      const x = -11.9 + column * 1.53 + (row % 2) * .76, z = -12.05 + row * 1.3;
      const h = 1.7 + Math.sin(column * .37 + .3) ** 2 * 4.8 + (3 - row) * .65 + Math.sin(column * 1.7 + row) * .35;
      const columnMesh = art.mesh(root, new T.CylinderGeometry(.83, .84, h, 6, 1), art.mix(p.ink, p.limestone, .39 + (row + column) % 4 * .085), [x, .12 + h / 2, z]);
      columnMesh.rotation.y = Math.PI / 6;
      const cap = art.mesh(root, new T.CylinderGeometry(.77, .8, .08, 6), art.mix(p.limestone, p.paper, .36), [x, h + .17, z]); cap.rotation.y = Math.PI / 6;
      for (let joint = 1; joint < Math.floor(h / .86); joint++) {
        const band = art.mesh(root, new T.CylinderGeometry(.846, .846, .024, 6), art.mix(p.ink, p.limestone, .26), [x, .12 + joint * .86, z]); band.rotation.y = Math.PI / 6;
      }
      if (row === 3 && column % 3 === 0) art.line(root, [[x + .41, .45, z + .73], [x + .42, h * .57, z + .73], [x + .4, h - .13, z + .72]], .016, p.paper);
    }
    for (let i = 0; i < 4; i++) {
      const fragment = art.mesh(root, new T.CylinderGeometry(.5, .53, 1.6 + i * .2, 6), art.mix(p.ink, p.limestone, .5), [-11.6 + i * 1.2, .61, -6.6]);
      fragment.rotation.set(0, .18 + i * .2, Math.PI / 2 - .12);
    }
  },

  geothermal(art, root, _day) {
    const p = art.palette;
    // Scalloped travertine bowls overlap down a diagonal slope, each with an inset water level.
    for (let tier = 0; tier < 8; tier++) {
      const c: Point = [-8.5 + tier * 2.55, .1 + tier * .3, -8.12 - tier * .37];
      const rx = 3.05 - tier % 3 * .17, rz = 1.33;
      // Broad, overlapping mineral toes meet the ground; only the shallow lip rises above the water.
      radial(art, root, c, rx, rz, [[1.27, .02 - c[1]], [1.08, .07], [.99, .2], [.89, .38], [.78, .34], [.74, .22]], art.mix(p.limestone, p.paper, .6), 0, Math.PI * 2, .045);
      radial(art, root, c, rx, rz, [[.945, .29], [.9, .4], [.8, .37]], p.paper, 0, Math.PI * 2, .045);
      pool(art, root, [c[0], c[1] + .26, c[2]], rx * .74, rz * .74, art.mix(tier > 4 ? p.gold : p.water, p.paper, .28));
      for (let band = 0; band < 3; band++) radial(art, root, c, rx, rz, [[1.06 - band * .05, .1 + band * .064], [1.047 - band * .05, .12 + band * .064]],
        art.mix(p.clay, p.paper, .61 + band * .1), .08, Math.PI - .08, .045);
      if (tier > 0) art.line(root, [[c[0] - rx * .75, c[1] + .28, c[2] + .22], [c[0] - rx * .89, c[1] + .1, c[2] + .47], [c[0] - rx * 1.04, c[1] - .035, c[2] + .57]], .048, p.ice);
    }
    // A separate silica cone has a visible vent and restrained, carved steam curls.
    radial(art, root, [-11.3, 0, -11.4], 1.55, .95, [[1, .12], [.8, .5], [.4, 1.8], [.3, 2.1], [.2, 2], [.16, 1.7]], art.mix(p.paper, p.gold, .2));
    for (let i = 0; i < 3; i++) art.line(root, [[-11.3 + i * .13, 2.04, -11.4], [-11.55 + i * .2, 2.9 + i * .2, -11.45],
      [-11.1 + i * .14, 3.6 + i * .3, -11.47], [-11.3 + i * .24, 4.3 + i * .3, -11.5]], .04 - i * .008, art.mix(p.mist, p.paper, .35));
    for (let i = 0; i < 5; i++) shard(art, root, [8.2 + i * .91, .22 + i % 2 * .07, -7.2 - i * .16], [.37, .16, .29], art.mix(p.gold, p.paper, .5), i);
  },
};
