import * as T from 'three';
import type { PaperScenery } from './history-scenery';

type Point = [number, number, number];
type Shore = [number, number];
type Landform = (art: PaperScenery, root: T.Group, day: number) => void;

/** Horizontal cut paper: the supplied height is the top, and thickness extends downward. */
function sheet(art: PaperScenery, root: T.Group, outline: Shore[], top: number, depth: number, color: string, holes: Shore[][] = []) {
  let mesh: T.Mesh;
  if (holes.length) {
    const shape = new T.Shape(outline.map(point => new T.Vector2(...point)));
    shape.holes = holes.map(hole => new T.Path(hole.map(point => new T.Vector2(...point))));
    mesh = art.mesh(root, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), color, [0, top, 0]);
  } else mesh = art.shape(root, outline, depth, color, [0, top, 0]);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function oval(x: number, z: number, rx: number, rz: number, count = 32): Shore[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count * Math.PI * 2;
    return [x + Math.cos(t) * rx, z + Math.sin(t) * rz];
  });
}

function pool(art: PaperScenery, root: T.Group, outline: Shore[], color = art.palette.water, holes: Shore[][] = []) {
  sheet(art, root, outline, .17, .12, art.palette.limestone, holes);
  sheet(art, root, outline, .205, .032, color, holes).castShadow = false;
}

/** A solid ribbon also supplies the exposed paper edge; water ribbons remain nearly flush. */
function ribbon(art: PaperScenery, root: T.Group, points: Point[], width: number | ((t: number) => number), depth: number, color: string, segments = 36) {
  const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  const vertices: number[] = [], uvs: number[] = [];
  const quad = (a: T.Vector3, b: T.Vector3, c: T.Vector3, d: T.Vector3) => {
    for (const [point, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [0, 1]], [c, [0, 1]], [b, [1, 0]], [d, [1, 1]]] as const) {
      vertices.push(...point.toArray()); uvs.push(...uv);
    }
  };
  let previous: T.Vector3[] | undefined;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t);
    const half = (typeof width === 'number' ? width : width(t)) / 2;
    const normal = new T.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(half);
    const left = center.clone().add(normal), right = center.clone().sub(normal);
    const below = new T.Vector3(0, -depth, 0);
    const current = [left, right, left.clone().add(below), right.clone().add(below)];
    if (previous) {
      quad(previous[0], current[0], previous[1], current[1]);
      quad(previous[2], previous[3], current[2], current[3]);
      quad(previous[0], previous[2], current[0], current[2]);
      quad(previous[1], current[1], previous[3], current[3]);
    } else quad(current[0], current[1], current[2], current[3]);
    if (i === segments) quad(current[0], current[2], current[1], current[3]);
    previous = current;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return art.mesh(root, geometry, color);
}

function channel(art: PaperScenery, root: T.Group, path: Shore[], width: number, color = art.palette.water) {
  const points = (y: number): Point[] => path.map(([x, z]) => [x, y, z]);
  ribbon(art, root, points(.255), width + .27, .1, art.mix(art.palette.limestone, art.palette.paper, .62));
  ribbon(art, root, points(.265), width, .015, color).castShadow = false;
}

function contour(art: PaperScenery, root: T.Group, path: Shore[], y: number, color: string, width = .045) {
  ribbon(art, root, path.map(([x, z]) => [x, y, z]), width, .012, color, 24);
}

function stone(art: PaperScenery, root: T.Group, position: Point, scale: Point, color: string) {
  const mesh = art.mesh(root, new T.DodecahedronGeometry(1, 0), color, position);
  mesh.scale.set(...scale);
  return mesh;
}

function cliff(art: PaperScenery, root: T.Group, x: number, z: number, rx: number, rz: number, height: number, color: string) {
  const perimeter: Shore[] = [[-1, -.52], [-.72, -.95], [-.05, -1], [.63, -.84], [1, -.23], [.87, .61], [.18, 1], [-.8, .72]];
  for (let layer = 0; layer < 7; layer++) {
    const scale = 1 - layer * .043;
    const outline: Shore[] = perimeter.map(([px, pz]) => [x + px * rx * scale + layer * .025, z + pz * rz * scale]);
    sheet(art, root, outline, .14 + height * (layer + 1) / 7, height / 7 + .01,
      art.mix(color, layer % 3 === 1 ? art.palette.paper : art.palette.limestone, .22 + layer * .035));
  }
}

function grass(art: PaperScenery, root: T.Group, x: number, z: number, base: number, color: string, size = 1) {
  for (let i = 0; i < 3; i++) {
    const leaf = art.shape(root, [[-.05, 0], [-.11 + i * .1, .68 * size], [.07, .22 * size], [.06, 0]], .035, color, [x + (i - 1) * .13, base, z]);
    leaf.rotation.y = i * .8;
  }
}

/** Each hydrological form is a separate miniature. The daily landmark keeps the central foreground. */
export const WATER_LANDFORMS = {
  meander: (art, root, _day) => {
    const p = art.palette;
    sheet(art, root, [[-12.2, -12.4], [-5.6, -12.8], [4.6, -12.4], [12, -11.4], [11.8, -6.55], [3.5, -6.25], [-5.3, -6.4], [-12, -7.1]], .22, .17, art.mix(p.jade, p.paper, .76));
    const river: Shore[] = [[-11.3, -10.9], [-7.4, -11.5], [-4.2, -9.65], [-1.5, -7.5], [2.2, -7.5], [4.5, -10], [7.6, -11.25], [11.3, -9.85]];
    channel(art, root, river, .98);
    const oxbow: Shore[] = Array.from({ length: 18 }, (_, i) => { const t = .3 + i / 17 * 4.85; return [-7.6 + Math.cos(t) * 1.8, -8 + Math.sin(t) * .9]; });
    channel(art, root, oxbow, .56, art.mix(p.water, p.jade, .2));
    for (let i = 0; i < 3; i++) contour(art, root, [[-4.7 + i * .18, -9.35], [-2.5 + i * .12, -7.25 + i * .2], [.9, -6.8 + i * .15], [2.7, -7.05 + i * .12]], .282 + i * .025, i % 2 ? p.limestone : p.paper, .1);
    for (const [x, z] of [[-10, -7.3], [-5.6, -6.9], [4.6, -7], [8.4, -8.1]]) grass(art, root, x, z, .23, p.jade, .8);
    stone(art, root, [-5.9, .4, -8], [.55, .15, .3], p.limestone);
  },

  braided: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-12.2, -10.7], [-8.5, -12.1], [-2.4, -12.35], [5.5, -11.9], [12.2, -10.6], [11.2, -7.2], [5, -6.45], [-4.7, -6.9], [-11.8, -8]], art.mix(p.water, p.paper, .21));
    const bars: { outline: Shore[]; y: number }[] = [
      { outline: [[-10.8, -9.6], [-8, -11.1], [-3.5, -10.5], [-6.8, -9.5]], y: .36 },
      { outline: [[-8.1, -8.2], [-4.4, -9.3], [-.7, -8.6], [-4.2, -7.6]], y: .42 },
      { outline: [[-1.8, -10.3], [1.9, -11.6], [6.4, -10.5], [2.3, -9.6]], y: .35 },
      { outline: [[1.6, -8.8], [6.4, -9.9], [10.8, -9], [6.3, -7.4]], y: .39 },
      { outline: [[-1.8, -7.3], [1, -8.15], [4.2, -7.6], [.8, -6.8]], y: .32 },
    ];
    for (const { outline, y } of bars) {
      sheet(art, root, outline, y, .13, p.limestone);
      const center = outline.reduce<Shore>((sum, [x, z]) => [sum[0] + x / 4, sum[1] + z / 4], [0, 0]);
      sheet(art, root, outline.map(([x, z]) => [center[0] + (x - center[0]) * .88, center[1] + (z - center[1]) * .82]), y + .045, .04, art.mix(p.sand, p.paper, .55));
      contour(art, root, [outline[0], center, outline[2]], y + .072, p.paper, .055);
    }
    for (let i = 0; i < 9; i++) stone(art, root, [-9.5 + i * 2.35, .31, -11.7 + (i % 3) * .28], [.18 + i % 2 * .06, .09, .13], i % 2 ? p.mist : p.limestone);
    contour(art, root, [[-11, -10], [-7.7, -9.1], [-3.9, -9.8], [0, -9], [4.3, -9.2], [10.7, -7.8]], .225, p.paper, .04);
  },

  delta: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-11.8, -10.1], [-5.7, -12.25], [4.9, -12.3], [11.8, -9.9], [12.1, -6.45], [-11.9, -6.35]], art.mix(p.ocean, p.water, .72));
    sheet(art, root, [[-2, -12.25], [1.7, -12.25], [4.8, -10.5], [10.9, -7], [7.1, -6.6], [3.6, -7.4], [1, -6.55], [-2.8, -7.4], [-7.6, -6.65], [-11, -7.1], [-5.6, -10.1]], .34, .125, art.mix(p.jade, p.paper, .49));
    const branches: Shore[][] = [
      [[-.5, -12.3], [0, -11], [-2.1, -9.7], [-5.6, -8.3], [-9.7, -6.8]],
      [[0, -11], [1.8, -9.65], [5.5, -8.4], [10.2, -6.9]],
      [[0, -11], [.15, -9.5], [-.7, -8], [.6, -6.55]],
      [[-2.1, -9.7], [-5.4, -9.6], [-10.8, -7.65]],
      [[1.8, -9.65], [4.8, -9.8], [8.8, -8.7], [11.5, -7.3]],
    ];
    for (const path of branches) {
      ribbon(art, root, path.map(([x, z]) => [x, .355, z]), .65, .025, p.water);
      contour(art, root, path, .374, art.mix(p.water, p.paper, .48), .08);
    }
    for (const [x, z] of [[-5.3, -8.8], [-7.3, -7.5], [-2.6, -8.2], [3.1, -8.6], [6.8, -7.6]]) grass(art, root, x, z, .36, p.forest, .7);
    for (let i = 0; i < 3; i++) contour(art, root, [[-10.6, -6.8 - i * .2], [-6.5, -6.5 - i * .2], [-3.7, -6.75 - i * .2]], .224, p.paper, .035);
  },

  mangrove: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-12.1, -11.8], [-5.5, -12.4], [4.6, -12.15], [12.1, -11.6], [12.1, -7.2], [6.2, -6.4], [-2.2, -6.6], [-11.9, -7.2]], art.mix(p.water, p.jade, .29));
    for (const [x, z, rx, rz] of [[-8.5, -9.55, 3.4, 1.55], [-2.4, -10.2, 2.7, 1.65], [4.1, -9.2, 3.4, 1.6], [9.25, -10.1, 2.65, 1.7]]) {
      sheet(art, root, oval(x, z, rx, rz), .3, .11, art.mix(p.clay, p.paper, .58));
      sheet(art, root, oval(x, z, rx * .86, rz * .88), .35, .05, art.mix(p.jade, p.limestone, .59));
    }
    const trees = [[-10, -9.8, 2.5], [-7.3, -10.5, 3.5], [-3.2, -10.8, 3.7], [-1.2, -9.8, 2.7], [3.1, -9.65, 3.3], [5.8, -8.8, 2.5], [8.4, -10.6, 3.4], [10.3, -9.8, 2.8]];
    for (const [x, z, height] of trees) {
      art.line(root, [[x, .85, z], [x - .15, height * .61, z], [x + .23, height, z]], .11, p.forest);
      for (let i = 0; i < 4; i++) {
        const t = .4 + i * Math.PI / 2, dx = Math.cos(t), dz = Math.sin(t) * .68;
        art.line(root, [[x - .04, 1.5, z], [x + dx * .63, .78, z + dz * .61], [x + dx, .28, z + dz]], .048, art.mix(p.forest, p.gold, .33));
      }
      for (const [dx, dz, rise] of [[-.65, -.15, -.18], [.58, .08, .1], [.12, -.37, .57]]) {
        art.line(root, [[x, height * .65, z], [x + dx, height + rise, z + dz]], .055, p.forest);
        const foliage = art.mesh(root, new T.IcosahedronGeometry(.87, 0), rise > 0 ? p.jade : p.forest, [x + dx, height + rise, z + dz]);
        foliage.scale.set(1.2, .48, .86);
        art.line(root, [[x + dx - .47, height + rise + .25, z + dz], [x + dx, height + rise + .38, z + dz], [x + dx + .47, height + rise + .25, z + dz]], .018, art.mix(p.jade, p.paper, .38));
      }
    }
    for (let i = 0; i < 15; i++) {
      const x = -10.8 + i * 1.5, z = -7.25 - (i % 3) * .16;
      art.mesh(root, new T.ConeGeometry(.065, .24 + i % 3 * .055, 5), p.forest, [x, .4, z]);
    }
  },

  seaarch: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-12.65, -12.3], [-3, -12.6], [7.2, -12.25], [12.5, -10.4], [12.55, -6.25], [3.9, -6.5], [-6.8, -6.25], [-12.55, -7.5]], p.ocean);
    const arch: Shore[] = [[-4, 0], [-4.2, 2.7], [-3.35, 5.1], [-1.8, 6.2], [.45, 6.5], [3.3, 5.1], [3.9, 2.5], [3.85, 0], [2.25, 0], [2.25, 2.1], [1.85, 3.3], [.55, 4.05], [-.8, 4.02], [-1.85, 3.2], [-2.2, 2], [-2.2, 0]];
    for (let layer = 0; layer < 6; layer++) art.shape(root, arch.map(([x, y]) => [x * (1 - layer * .015), y - (y > 4 ? layer * .03 : 0)]), .42,
      art.mix(p.limestone, layer % 2 ? p.paper : p.clay, layer % 2 ? .38 : .18), [-6, .23, -11.8 + layer * .4]);
    for (let i = 0; i < 4; i++) art.line(root, [[-9.5 + i * .12, 1 + i * .44, -9.35], [-9 + i * .13, 3.3 + i * .32, -9.35], [-7.8 + i * .34, 5.35 + i * .16, -9.35]], .024, p.paper);
    cliff(art, root, 5.3, -9.9, 1.35, 1.15, 5.4, p.limestone);
    cliff(art, root, 9.15, -8.7, .91, 1.03, 3.1, p.limestone);
    stone(art, root, [11.5, .55, -7.35], [.63, .4, .5], p.paper);
    for (let i = 0; i < 3; i++) contour(art, root, [[3.7 - i * .13, -9.1], [5.2, -8.65 + i * .2], [6.7 + i * .12, -9.15]], .224, p.paper, .045);
    sheet(art, root, [[-12, -7], [-10.1, -7.6], [-8.7, -6.8], [-10.6, -6.25]], .35, .15, art.mix(p.sand, p.paper, .62));
  },

  atoll: (art, root, _day) => {
    const p = art.palette, cx = 0, cz = -9.45;
    const innerWater = oval(cx, cz, 8.8, 2.27);
    pool(art, root, oval(cx, cz, 11.9, 3.22), p.ocean, [innerWater]);
    pool(art, root, innerWater, art.mix(p.water, p.paper, .24));
    const reef: Point[] = Array.from({ length: 49 }, (_, i) => { const t = -.12 + i / 48 * Math.PI * 1.86; return [Math.cos(t) * 9.65, .34, cz + Math.sin(t) * 2.58]; });
    ribbon(art, root, reef, .95, .13, p.limestone, 64);
    ribbon(art, root, reef.map(([x, y, z]) => [x, y + .05, z]), .64, .045, art.mix(p.sand, p.paper, .7), 64);
    ribbon(art, root, reef.map(([x, y, z]) => [x, y + .083, z]), .2, .03, art.mix(p.jade, p.paper, .36), 64);
    for (const t of [.23, 1.4, 2.4, 3.5, 4.6]) {
      const x = Math.cos(t) * 9.65, z = cz + Math.sin(t) * 2.58;
      grass(art, root, x, z, .43, p.jade, .65);
      stone(art, root, [x + .25, .48, z], [.26, .11, .17], p.paper);
    }
    for (let i = 0; i < 5; i++) {
      const x = -5.8 + i * 2.75, z = -9.5 + Math.sin(i * 1.7) * .55;
      const coral = art.mesh(root, new T.IcosahedronGeometry(.26, 0), art.mix(p.vermilion, p.paper, .59), [x, .27, z]); coral.scale.y = .22;
    }
    for (const offset of [-.45, .25]) contour(art, root, [[-4, cz + offset], [-1, cz + offset + .13], [2, cz + offset]], .225, art.mix(p.water, p.paper, .55), .035);
  },

  lagoon: (art, root, _day) => {
    const p = art.palette;
    const innerWater: Shore[] = [[-10.8, -10.5], [-5.1, -11.5], [2.8, -11.1], [9.2, -10.1], [8.5, -8.35], [2.9, -7.35], [-4.6, -7.8], [-9.9, -8.7]];
    pool(art, root, [[-12.4, -11.9], [-5.8, -12.55], [4.9, -12.2], [12.3, -10.9], [12.3, -6.45], [2.5, -6.35], [-6.7, -6.6], [-12.2, -8.1]], p.ocean, [innerWater]);
    sheet(art, root, [[-12.2, -12.05], [-5.6, -12.45], [3.5, -12.15], [11.7, -10.9], [10.3, -10.4], [3.4, -11.35], [-5.1, -11.55], [-11.8, -10.6]], .48, .29, art.mix(p.jade, p.paper, .55));
    pool(art, root, innerWater, art.mix(p.water, p.jade, .25));
    const spit: Point[] = [[-11.8, .44, -9], [-8.6, .44, -7.8], [-3.6, .44, -7.25], [1.3, .44, -7.35], [5.3, .44, -8.25], [7.6, .44, -8.25]];
    ribbon(art, root, spit, t => 1.05 - t * .58, .24, p.limestone);
    ribbon(art, root, spit.map(([x, y, z]) => [x, y + .08, z]), t => .75 - t * .49, .075, art.mix(p.sand, p.paper, .55));
    ribbon(art, root, [[9.3, .45, -8.5], [11.1, .45, -8.25], [12, .45, -7.2]], .63, .24, p.sand);
    for (const [x, z] of [[-9.8, -8.4], [-6.5, -7.45], [-3.3, -7.3], [0, -7.35]]) grass(art, root, x, z, .55, p.jade, .7);
    for (let i = 0; i < 3; i++) contour(art, root, [[-9, -7.35 + i * .14], [-4.1, -6.72 + i * .1], [1.5, -6.77 + i * .1]], .227, p.paper, .04);
    contour(art, root, [[9, -10], [8.7, -9.2], [8.4, -8.4], [9, -7.3]], .235, p.ice, .09);
  },

  fjord: (art, root, _day) => {
    const p = art.palette;
    // The main river already cuts in at ±9.3. These lips and falls meet those existing cuts.
    for (const side of [-1, 1]) {
      const x = side * 9.3;
      cliff(art, root, x, -8.35, 2.18, 2.75, side < 0 ? 7.6 : 8.7, p.forest);
      cliff(art, root, side * 11.75, -10.4, 1.35, 1.7, side < 0 ? 5.9 : 6.7, p.forest);
      const top = side < 0 ? 7.67 : 8.77;
      sheet(art, root, oval(x + .13, -8.6, 1.14, 1.32, 16), top + .025, .05, art.mix(p.jade, p.paper, .4));
      for (let i = 0; i < 3; i++) art.line(root, [[x - .17 + i * .16, top, -6.63], [x - .15 + i * .18, top * .68, -5.96], [x - .1 + i * .14, 2.3, -5.63], [x + i * .11, .22, -5.43]], .029 + i * .008, i % 2 ? p.ice : p.snow);
      for (let i = 0; i < 3; i++) {
        const splash = art.ring(root, .23 + i * .21, .018, [x + .12, .095, -5.42], p.ice);
        splash.rotation.x = -Math.PI / 2; splash.scale.y = .56;
      }
      for (let i = 0; i < 4; i++) art.line(root, [[x - 1.13 + i * .58, .4, -5.79], [x - 1.2 + i * .57, top * .48, -6.35], [x - .93 + i * .45, top - .08, -6.66]], .022, art.mix(p.forest, p.paper, .52));
      stone(art, root, [side * 12.2, .48, -5.95], [.68, .39, .61], p.limestone);
    }
    contour(art, root, [[-6.5, -11.9], [-3.3, -12.35], [.2, -11.9], [4, -12.2], [6.3, -11.7]], .25, art.mix(p.forest, p.paper, .6), .28);
  },

  glacier: (art, root, _day) => {
    const p = art.palette;
    for (const side of [-1, 1]) {
      cliff(art, root, side * 6.75, -10.2, 2.7, 2.35, side < 0 ? 5.75 : 6.65, p.limestone);
      cliff(art, root, side * 9.8, -8.5, 1.8, 1.7, side < 0 ? 3.4 : 4.2, p.limestone);
      art.shape(root, [[-2.1, 0], [-1.9, 1.25], [-.65, 2.3], [.2, 1.3], [1.6, 1.8], [2.15, .2]], 1.5, p.snow, [side * 6.75, side < 0 ? 4.5 : 5.4, -11.4]);
    }
    const flow: Point[] = [[0, 3.48, -12.2], [-.3, 2.55, -10.65], [.3, 1.63, -8.5], [-.2, .87, -6.35]];
    ribbon(art, root, flow, t => 6.2 - t * 1.9, .65, p.ice);
    ribbon(art, root, flow.map(([x, y, z]) => [x, y + .04, z]), t => 5.75 - t * 1.82, .055, p.snow);
    for (let i = 0; i < 7; i++) {
      const t = .1 + i * .12, z = -12.2 + t * 5.85, y = 3.52 - t * 2.61;
      const cut: Point[] = [[-2.25 + t * .7, y + .08, z], [-1.1, y + .035, z + .15], [.15, y + .1, z - .08], [2.25 - t * .7, y + .04, z + .18]];
      ribbon(art, root, cut, .085 + i % 2 * .025, .015, art.mix(p.ocean, p.ice, .2), 18);
    }
    for (const side of [-1, 1]) ribbon(art, root, [[side * 2.98, 3.48, -12.05], [side * 2.7, 2.58, -10.4], [side * 2.45, 1.5, -8.3], [side * 2.1, .9, -6.38]], .18, .055, p.limestone);
    for (let i = 0; i < 7; i++) stone(art, root, [-2.7 + i * .9, .49, -6.42], [.34, .21, .22], i % 2 ? p.ice : p.limestone);
  },

  cirque: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, oval(0, -9.2, 6.4, 2.5), art.mix(p.ocean, p.ice, .38));
    // Every stratum spans the entire amphitheatre: the headwall is one carved bowl.
    const wallPoint = (t: number, level: number, inner: boolean): Point => {
      const angle = t * Math.PI;
      const pass = 1.45 * Math.exp(-(((t - .68) / .052) ** 2));
      const crest = 2.25 + Math.sin(angle) ** .88 * 5.7 + Math.sin(angle * 3) * .36 - pass;
      const rx = inner ? 6.25 + level * 1.08 : 9.45 - level * .85;
      const rz = inner ? 3.2 + level * 1.3 : 5.42 - level * .22;
      return [-Math.cos(angle) * rx, .15 + crest * level, -7.2 - Math.sin(angle) * rz];
    };
    const stratum = (lower: number, upper: number, color: string) => {
      const vertices: number[] = [], uvs: number[] = [];
      const quad = (a: Point, b: Point, c: Point, d: Point) => {
        vertices.push(...a, ...b, ...c, ...c, ...b, ...d);
        uvs.push(0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1);
      };
      for (let segment = 0; segment < 48; segment++) {
        const from = segment / 48, to = (segment + 1) / 48;
        const a = wallPoint(from, lower, true), b = wallPoint(to, lower, true);
        const c = wallPoint(from, upper, true), d = wallPoint(to, upper, true);
        const e = wallPoint(from, lower, false), f = wallPoint(to, lower, false);
        const g = wallPoint(from, upper, false), h = wallPoint(to, upper, false);
        quad(a, b, c, d); quad(f, e, h, g);
        quad(c, d, g, h); quad(e, f, a, b);
        if (segment === 0) quad(e, a, g, c);
        if (segment === 47) quad(b, f, d, h);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals(); art.mesh(root, geometry, color);
    };
    for (let layer = 0; layer < 12; layer++) stratum(layer / 12, (layer + 1) / 12,
      art.mix(p.limestone, layer % 3 === 1 ? p.paper : p.ice, layer % 3 === 1 ? .4 : .19));
    stratum(1, 1.015, p.snow);
    // Ice abrasion follows the concave face; the lower lip opens toward the lake outlet.
    for (let groove = 0; groove < 11; groove++) {
      const t = .095 + groove * .079;
      const cut: Point[] = [.91, .7, .48, .21].map((level, i) => {
        const point = wallPoint(t + Math.sin(i * 1.3 + groove) * .006, level, true);
        return [point[0] * .996, point[1], point[2] + .035];
      });
      art.line(root, cut, groove % 3 === 0 ? .042 : .025, groove % 3 === 0 ? p.ice : p.paper);
    }
    for (const side of [-1, 1]) {
      const lip: Point[] = [[side * 6.4, .31, -7.45], [side * 4.8, .4, -6.98], [side * 2.6, .29, -6.63], [side * .82, .23, -6.58]];
      ribbon(art, root, lip, .34, .13, p.limestone, 28);
      ribbon(art, root, lip.map(([x, y, z]) => [x, y + .035, z]), .14, .03, p.snow, 28);
    }
    const snowPatch: Shore[] = [[-5.85, -9.28], [-4.84, -10.14], [-3.65, -10.58], [-3.87, -9.67], [-4.82, -8.96]];
    sheet(art, root, snowPatch, .29, .09, p.snow);
    contour(art, root, [[-3.7, -8.42], [-1.6, -8.1], [.8, -8.15], [3, -8.51]], .227, art.mix(p.ice, p.paper, .5), .055);
    contour(art, root, [[-1.3, -9.75], [.6, -9.62], [2.3, -9.87]], .225, p.ice, .035);
    for (const [x, z] of [[-9.4, -7.8], [9.3, -7.8], [-8.9, -6.65]]) stone(art, root, [x, .46, z], [.7, .32, .56], p.limestone);
  },

  moraine: (art, root, _day) => {
    const p = art.palette;
    const kettles = [[-8, -8.4, .9], [7.8, -9.4, .72], [2.1, -7.8, .54]];
    sheet(art, root, [[-12, -11.4], [-7, -12.5], [3.7, -12.45], [12, -11.15], [11.8, -6.6], [-11.7, -6.35]], .23, .17, art.mix(p.ice, p.limestone, .35),
      kettles.map(([x, z, rx]) => oval(x, z, rx, rx * .6, 16)));
    for (let ridge = 0; ridge < 4; ridge++) {
      const points: Point[] = Array.from({ length: 13 }, (_, i) => {
        const x = -10.6 + i / 12 * 21.2, t = x / 10.6;
        return [x, .63 + (1 - t * t) * (.75 - ridge * .12), -11.8 + ridge * 1.36 + (1 - t * t) * .65];
      });
      ribbon(art, root, points, .91 - ridge * .08, .53, ridge % 2 ? p.limestone : art.mix(p.limestone, p.ice, .33));
      ribbon(art, root, points.map(([x, y, z]) => [x, y + .04, z]), .28, .04, art.mix(p.paper, p.snow, .4));
      for (let i = 0; i < 8; i++) {
        const x = -9.8 + i * 2.8, t = x / 10.6;
        stone(art, root, [x, .78 + (1 - t * t) * (.75 - ridge * .12), -11.8 + ridge * 1.36 + (1 - t * t) * .65], [.21 + i % 3 * .045, .16, .21], i % 2 ? p.limestone : p.snow);
      }
    }
    for (const [x, z, rx] of kettles) pool(art, root, oval(x, z, rx, rx * .6, 16), p.water);
    stone(art, root, [10.7, .94, -6.6], [.83, .73, .57], p.limestone);
    art.line(root, [[10.2, 1.3, -6.26], [10.72, 1.52, -6.35], [11.07, 1.3, -6.36]], .022, p.paper);
  },

  tundra: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-12.25, -12.55], [11.95, -12.55], [12.3, -7.15], [8.9, -6.25], [-9.3, -6.25], [-12.3, -7.4]], art.mix(p.ice, p.ocean, .24));
    for (let row = 0; row < 2; row++) for (let col = 0; col < 7; col++) {
      const x = -10.05 + col * 3.32 + row * .32, z = -11.05 + row * 2.76;
      const outline: Shore[] = [[x - 1.47, z - .52], [x - .5, z - 1.18], [x + .84, z - 1.05], [x + 1.45, z + .08], [x + .66, z + 1.2], [x - .93, z + 1.05]];
      sheet(art, root, outline, .32, .115, p.limestone);
      const top: Shore[] = outline.map(([xx, zz]) => [x + (xx - x) * .84, z + (zz - z) * .82]);
      sheet(art, root, top, .4 + (col % 2) * .025, .08, (row + col) % 3 ? art.mix(p.jade, p.paper, .59) : art.mix(p.heather, p.paper, .44));
      if ((row + col) % 2) {
        grass(art, root, x - .3, z + .1, .42, p.heather, .45);
        grass(art, root, x + .32, z - .15, .42, p.jade, .32);
      } else sheet(art, root, oval(x + .15, z, .52, .3, 12), .415, .014, p.water);
    }
    for (const [x, z] of [[-11.2, -6.6], [-7.5, -6.4], [4.5, -6.5], [11.9, -6.9]]) stone(art, root, [x, .46, z], [.42, .25, .32], p.mist);
  },

  icecap: (art, root, _day) => {
    const p = art.palette;
    pool(art, root, [[-12.45, -12.6], [12.45, -12.6], [12.6, -6.45], [-12.6, -6.4]], p.ocean);
    for (let layer = 0; layer < 9; layer++) {
      const outline: Shore[] = oval(-.4, -10.4, 10.9 - layer * .69, 2.35 - layer * .145, 40);
      sheet(art, root, outline, .52 + layer * .36, .37, layer < 2 ? p.ice : art.mix(p.ice, p.snow, .49 + layer * .055));
    }
    sheet(art, root, [[-10.7, -9.5], [-6.4, -9.2], [-2.1, -9.55], [2.7, -9.1], [6.6, -9.4], [10.7, -8.8], [10.25, -7.1], [7.3, -7.3], [4.8, -6.95], [2.4, -7.45], [-.9, -7.1], [-3.3, -7.5], [-6.7, -7.1], [-10.4, -7.7]], .86, .64, p.ice);
    sheet(art, root, [[-10.6, -9.5], [-6.4, -9.2], [-2.1, -9.55], [2.7, -9.1], [6.6, -9.4], [10.6, -8.8], [10.13, -7.18], [7.3, -7.38], [4.8, -7.05], [2.4, -7.54], [-.9, -7.18], [-3.3, -7.59], [-6.7, -7.18], [-10.3, -7.78]], .95, .09, p.snow);
    for (let i = 0; i < 11; i++) {
      const x = -9.5 + i * 1.8;
      contour(art, root, [[x, -8.8], [x + .2, -8.25], [x - .13, -7.9]], .97, art.mix(p.ocean, p.ice, .35), .055);
      art.line(root, [[x, .84, -7.64], [x + .04, .5, -7.66], [x + .1, .27, -7.62]], .023, p.snow);
    }
    for (const [x, z, rx, rz] of [[-11.7, -7.5, .48, .65], [11.45, -7.3, .68, .53], [8.9, -6.55, .75, .3], [-6.1, -6.6, .52, .3]]) {
      sheet(art, root, oval(x, z, rx, rz, 5), .46, .23, p.ice);
      sheet(art, root, oval(x, z, rx * .91, rz * .89, 5), .52, .06, p.snow);
    }
  },
} satisfies Record<string, Landform>;
