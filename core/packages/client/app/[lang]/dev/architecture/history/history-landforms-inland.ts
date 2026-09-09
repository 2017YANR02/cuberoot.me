import * as T from 'three';
import type { PaperScenery } from './history-scenery';

type Point = [number, number, number];
type Plan = [number, number];
type Landform = (art: PaperScenery, root: T.Group, day: number) => void;

/** A cut paper sheet laid horizontally, with a real exposed edge and a grounded underside. */
function slab(art: PaperScenery, root: T.Group, outline: Plan[], y: number, thickness: number, color: string) {
  const sheet = art.shape(root, outline.map(([x, z]) => [x, -z]), thickness, color, [0, y, 0]);
  sheet.rotation.x = -Math.PI / 2;
  return sheet;
}

function oval(x: number, z: number, rx: number, rz: number, phase = 0, count = 48): Plan[] {
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    const edge = 1 + .055 * Math.sin(a * 3 + phase) + .026 * Math.cos(a * 5 - phase);
    return [x + Math.cos(a) * rx * edge, z + Math.sin(a) * rz * edge];
  });
}

/** Closed sides reach the common ground, so slopes and pools never read as suspended ribbons. */
function surface(art: PaperScenery, root: T.Group, sample: (u: number, v: number) => Point, columns: number, rows: number, color: string, bottom = .025) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    positions.push(...sample(column / columns, row / rows));
    uvs.push(column / columns, row / rows);
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const perimeter: number[] = [];
  for (let column = 0; column <= columns; column++) perimeter.push(column);
  for (let row = 1; row <= rows; row++) perimeter.push(row * (columns + 1) + columns);
  for (let column = columns - 1; column >= 0; column--) perimeter.push(rows * (columns + 1) + column);
  for (let row = rows - 1; row > 0; row--) perimeter.push(row * (columns + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i] * 3, b = perimeter[(i + 1) % perimeter.length] * 3, n = positions.length / 3;
    positions.push(positions[a], positions[a + 1], positions[a + 2], positions[b], positions[b + 1], positions[b + 2],
      positions[a], bottom, positions[a + 2], positions[b], bottom, positions[b + 2]);
    uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
    indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return art.mesh(root, geometry, color);
}

function ribbon(art: PaperScenery, root: T.Group, a: Point[], b: Point[], color: string) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i < a.length; i++) {
    positions.push(...a[i], ...b[i]); uvs.push(0, i / (a.length - 1), 1, i / (a.length - 1));
    if (i) { const n = i * 2; indices.push(n - 2, n, n - 1, n - 1, n, n + 1); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return art.mesh(root, geometry, color);
}

function stone(art: PaperScenery, root: T.Group, x: number, z: number, size: Point, color: string, base = .05, tilt = 0) {
  const rock = art.mesh(root, new T.DodecahedronGeometry(1, 0), color, [x, base + size[1], z]);
  rock.scale.set(...size); rock.rotation.y = tilt;
  return rock;
}

function grass(art: PaperScenery, root: T.Group, x: number, y: number, z: number, height: number, phase: number, dry = false) {
  const p = art.palette;
  for (let i = 0; i < 3; i++) {
    const blade = art.shape(root, [[-.025, 0], [-.045, height * .48], [.15, height], [.035, height * .46], [.025, 0]], .016,
      dry ? art.mix(p.gold, p.sand, i * .2) : art.mix(p.forest, p.jade, .4 + i * .2), [x, y, z]);
    blade.rotation.y = phase + i * 2.2;
  }
}

/** Uneven soil banks share the lake's floor; there is deliberately no decorative torus shoreline. */
function pool(art: PaperScenery, root: T.Group, x: number, z: number, rx: number, rz: number, phase: number, soil: string, water: string, level = .32) {
  const outline = oval(x, z, rx, rz, phase);
  slab(art, root, outline, .035, level - .035, art.mix(soil, art.palette.limestone, .3));
  slab(art, root, outline.map(([xx, zz]) => [x + (xx - x) * .78, z + (zz - z) * .76]), level, .025, water);
  surface(art, root, (u, v) => {
    const a = -u * Math.PI * 2, r = .765 + v * .235;
    const irregular = 1 + .055 * Math.sin(a * 3 + phase) + .026 * Math.cos(a * 5 - phase);
    const bank = Math.sin(v * Math.PI) * (.13 + .1 * (1 + Math.sin(a * 2 + phase)));
    return [x + Math.cos(a) * rx * r * irregular, level + .018 + bank, z + Math.sin(a) * rz * r * irregular];
  }, 48, 4, soil);
  return level + .025;
}

function stream(art: PaperScenery, root: T.Group, points: Point[], width: number, color: string, bed: string) {
  const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  for (const layer of [0, 1]) {
    const a: Point[] = [], b: Point[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, point = curve.getPoint(t), tangent = curve.getTangent(t);
      const length = Math.hypot(tangent.x, tangent.z) || 1;
      const w = width * (layer ? 1 : 1.65) * (.77 + .23 * t);
      const dx = -tangent.z / length * w / 2, dz = tangent.x / length * w / 2;
      const y = point.y + (layer ? .02 : -.006);
      a.push([point.x + dx, y, point.z + dz]); b.push([point.x - dx, y, point.z - dz]);
    }
    ribbon(art, root, a, b, layer ? color : bed);
  }
}

function dunes(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const dunes: [number, number, number, number, number][] = [[-7.6, -10.2, 4.5, 2.0, 3.0], [.3, -10.4, 4.8, 2.0, 4.5], [8.3, -10.0, 4.2, 2.0, 2.7], [-10.1, -3.2, 2.4, 2.5, 1.4]];
  dunes.forEach(([x, z, rx, rz, height], index) => {
    const sample = (u: number, v: number): Point => {
      const xx = u * 2 - 1, wind = v * 2 - 1;
      const sweep = Math.max(0, 1 - xx * xx);
      const cross = wind < .18 ? Math.pow((wind + 1) / 1.18, 1.45) : Math.pow((1 - wind) / .82, .82);
      return [x + xx * rx, .09 + height * Math.pow(sweep, .78) * Math.max(0, cross), z + wind * rz * (.38 + sweep * .62) + xx * xx * .75];
    };
    surface(art, root, sample, 36, 16, art.mix(p.sand, p.paper, .15 + index * .045));
    // Narrow paper seams follow the windward face and converge into the two low horns.
    for (let row = 0; row < 9; row++) {
      const points: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const point = sample(.06 + i / 8 * .88, .07 + row * .053);
        point[1] += .028; points.push(point);
      }
      art.line(root, points, .014, art.mix(p.sand, row % 3 ? p.paper : p.gold, row % 3 ? .43 : .15));
    }
    const crest: Point[] = [];
    for (let i = 0; i <= 14; i++) { const point = sample(i / 14, .59); point[1] += .025; crest.push(point); }
    art.line(root, crest, .025, art.mix(p.sand, p.paper, .7));
  });
  for (let i = 0; i < 7; i++) {
    const x = 9.5 + i % 3 * .52, z = -3.3 + Math.floor(i / 3) * .7;
    stone(art, root, x, z, [.11 + i % 2 * .05, .055, .08], art.mix(p.gold, p.sand, .5), .04, day * .1 + i);
  }
}

function yardang(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const ridges: [number, number, number, number][] = [[-10.7, .9, 2.7, -.2], [-6.9, 1.6, 5.7, .2], [-2.7, 1.25, 4.6, -.5], [1.1, 1.4, 3.4, .3], [5.5, 1.8, 6.2, -.15], [10.1, 1.0, 3.7, .25]];
  ridges.forEach(([x, width, height, offset], ridge) => {
    for (let layer = 0; layer < 12; layer++) {
      const t = layer / 12, shrink = 1 - t * .72, nose = -6.7 + offset - t * .7;
      const outline: Plan[] = [[x - width * .2 * shrink, -12.45 + t * .14], [x - width * .78 * shrink, -10.8],
        [x - width * shrink, -8.45 - t * .25], [x - width * .62 * shrink, nose - .1], [x + width * .04 * shrink, nose],
        [x + width * .64 * shrink, nose - .3], [x + width * .9 * shrink, -8.65], [x + width * .36 * shrink, -11.3]];
      slab(art, root, outline, .08 + height * t, height / 12 + .014, art.mix(p.clay, layer % 4 === 0 ? p.gold : p.sand, .38 + t * .26));
    }
    for (let i = 0; i < 3; i++) art.line(root, [[x - width * .5 + i * width * .42, .12, -6.5 + offset],
      [x - width * .38 + i * width * .32, .22, -5.95 + offset], [x - width * .18 + i * width * .25, .1, -5.4 + offset]], .028, art.mix(p.clay, p.sand, .48));
    stone(art, root, x + .4, -6.1 + offset, [.21, .15, .33], p.sand, .04, ridge + day * .04);
  });
  for (let side = 0; side < 2; side++) {
    const x = side ? 10.3 : -10.4;
    slab(art, root, [[x - .9, -3.7], [x - .45, -5.0], [x + .4, -4.6], [x + 1, -1.7], [x + .3, -.8], [x - .4, -2.0]], .04, .22, art.mix(p.sand, p.paper, .28));
    for (let i = 0; i < 4; i++) art.line(root, [[x - .5 + i * .25, .27, -3.5], [x - .4 + i * .23, .27, -2.6], [x - .16 + i * .18, .27, -1.7]], .017, p.gold);
  }
}

function mesa(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  for (const [x, z, rx, rz, height] of [[-6.8, -10, 4.8, 2.45, 6.2], [8.5, -9.7, 3.8, 2.4, 4.4]]) {
    const footprint: Plan[] = [[-.9, -.7], [-.32, -.95], [.48, -.88], [.93, -.45], [.87, .26], [.51, .86], [-.22, .78], [-.71, .93], [-1, .3]];
    for (let layer = 0; layer < 11; layer++) {
      const t = layer / 11, factor = layer === 10 ? .82 : 1 - t * .24;
      const outline = footprint.map(([a, b], i): Plan => [x + a * rx * factor + Math.sin(i * 2.4 + layer) * .055,
        z + b * rz * factor + Math.cos(i * 1.8 + layer) * .04]);
      slab(art, root, outline, .08 + height * t, height / 11 + .018,
        art.mix(layer === 10 ? p.sand : p.clay, layer % 4 === 1 ? p.gold : p.paper, .22 + layer % 3 * .085));
    }
    for (let i = 0; i < 5; i++) {
      const xx = x - rx * .57 + i * rx * .29;
      art.shape(root, [[-.46, 0], [-.24, .85], [.03, 1.1 + i % 2 * .5], [.27, .72], [.5, 0]], .5,
        art.mix(p.clay, p.sand, .6), [xx, .08, z + rz * .72]);
      art.line(root, [[xx, .55, z + rz * .82], [xx + .1, height * .42, z + rz * .82], [xx - .03, height * .68, z + rz * .64]], .023, art.mix(p.clay, p.ink, .15));
    }
    const crown = footprint.map(([a, b]): Plan => [x + a * rx * .68, z + b * rz * .67]);
    slab(art, root, crown, height + .1, .055, art.mix(p.sand, p.paper, .48));
  }
  for (let i = 0; i < 8; i++) stone(art, root, (i % 2 ? 10 : -10) + Math.sin(i * 2.1) * 1.2, -3.5 + Math.floor(i / 2) * .73,
    [.32 + i % 3 * .1, .19 + i % 2 * .08, .3], art.mix(p.clay, p.sand, .5), .03, day * .07 + i);
}

function badlands(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const sample = (u: number, v: number): Point => {
    const x = -12.4 + u * 24.8, z = -12.55 + v * 6.1;
    const skyline = 2.2 + 2.8 * Math.exp(-(((x + 7) / 3.2) ** 2)) + 3.1 * Math.exp(-(((x - 5.2) / 4.1) ** 2));
    const flutes = .27 + .73 * Math.abs(Math.sin(x * 1.7 + v * .65 + Math.sin(x * .7) * .4)) ** .75;
    return [x, .09 + skyline * Math.pow(1 - v, .7) * flutes, z];
  };
  surface(art, root, sample, 100, 24, art.mix(p.clay, p.paper, .3));
  for (let i = 0; i < 16; i++) {
    const u = .035 + i / 16 * .93, points: Point[] = [];
    for (let j = 0; j <= 9; j++) {
      const v = .17 + j / 9 * .82, point = sample(u + Math.sin(v * 3 + i) * .006, v);
      point[1] += .036; points.push(point);
    }
    art.line(root, points, .025, art.mix(p.clay, i % 3 ? p.sand : p.ink, i % 3 ? .52 : .1));
    for (const side of [-1, 1]) {
      const branch: Point[] = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5, point = sample(u + side * .024 * (1 - t), .37 + t * .27);
        point[1] += .035; branch.push(point);
      }
      art.line(root, branch, .014, art.mix(p.clay, p.sand, .48));
    }
  }
  for (const side of [-1, 1]) for (let layer = 0; layer < 5; layer++) {
    const x = side * 10.3, r = 1 - layer * .13;
    slab(art, root, [[x - 1.1 * r, -4.7], [x + .2 * r, -5.7 + layer * .12], [x + 1.2 * r, -4.1],
      [x + .7 * r, -2.6], [x - .4 * r, -3.1]], .06 + layer * .28, .3, art.mix(p.clay, p.sand, .25 + layer * .08));
  }
  stone(art, root, 11.4, -1.5, [.38, .17, .23], p.clay, .06, day * .09);
}

function saltpan(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const outline: Plan[] = [[-12.4, -10.7], [-10.6, -12.3], [-3.4, -12.55], [4.4, -12.3], [11.8, -11.1], [12.3, -8.0],
    [8.4, -6.1], [1.4, -6.5], [-5.5, -6.1], [-11.6, -7.5]];
  slab(art, root, outline, .025, .14, art.mix(p.clay, p.limestone, .68));
  for (let row = 0; row < 5; row++) for (let column = 0; column < 18; column++) {
    const x = -10.6 + column * 1.19 + row % 2 * .58, z = -11.5 + row * 1.01;
    if ((x > 5.3 && x < 10.7 && z > -11.6 && z < -8.3) || Math.abs(x) > 10.5 && (row === 0 || row === 4)) continue;
    const points: Plan[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6, radius = .63 + Math.sin(i * 2.1 + row + column * .7) * .045;
      points.push([x + Math.cos(a) * radius, z + Math.sin(a) * radius]);
    }
    slab(art, root, points, .165, .027 + (column + row) % 3 * .012, art.mix(p.snow, p.sand, .12 + (column * 3 + row) % 5 * .035));
  }
  pool(art, root, 8, -10, 2.3, 1.35, 2.3, art.mix(p.sand, p.snow, .68), art.mix(p.water, p.snow, .42), .18);
  for (let i = 0; i < 14; i++) {
    const x = -10.6 + Math.sin(i * 2.7) * 1.15, z = -3.5 + Math.cos(i * 2.1) * 1.1;
    const h = .18 + i % 5 * .16;
    const crystal = art.mesh(root, new T.CylinderGeometry(.13 + i % 3 * .025, .2, h, 4), i % 3 ? p.snow : p.ice, [x, .1 + h / 2, z]);
    crystal.rotation.y = i * .73 + day * .015;
    art.mesh(root, new T.ConeGeometry(.13 + i % 3 * .025, .12, 4), p.snow, [x, .1 + h + .06, z]).rotation.y = crystal.rotation.y;
  }
}

function palm(art: PaperScenery, root: T.Group, x: number, z: number, height: number, lean: number, phase: number) {
  const p = art.palette, top: Point = [x + lean, height, z + .2];
  const trunk = new T.CatmullRomCurve3([new T.Vector3(x, .12, z), new T.Vector3(x + lean * .2, height * .52, z - .06), new T.Vector3(...top)]);
  art.mesh(root, new T.TubeGeometry(trunk, 16, .13, 7, false), art.mix(p.clay, p.sand, .45));
  for (let i = 0; i < 13; i++) {
    const t = .04 + i / 14 * .91, point = trunk.getPoint(t);
    const ring = art.mesh(root, new T.TorusGeometry(.135, .022, 4, 10), art.mix(p.sand, p.paper, .33), point.toArray() as Point);
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), trunk.getTangent(t));
  }
  for (let frond = 0; frond < 7; frond++) {
    const a = phase + frond * Math.PI * 2 / 7, length = 1.6 + frond % 3 * .15;
    const left: Point[] = [], centre: Point[] = [], right: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, reach = length * t, width = Math.sin(t * Math.PI) * (i % 2 ? .21 : .32);
      const xx = top[0] + Math.cos(a) * reach, zz = top[2] + Math.sin(a) * reach;
      const y = height + Math.sin(t * Math.PI) * .43 - t * .55;
      centre.push([xx, y + .055 * Math.sin(t * Math.PI), zz]);
      left.push([xx - Math.sin(a) * width, y, zz + Math.cos(a) * width]);
      right.push([xx + Math.sin(a) * width, y, zz - Math.cos(a) * width]);
    }
    ribbon(art, root, left, centre, art.mix(p.jade, p.gold, .12));
    ribbon(art, root, centre, right, art.mix(p.forest, p.jade, .22));
    art.line(root, centre.filter((_, index) => index % 2 === 0), .018, art.mix(p.gold, p.jade, .62));
  }
  for (let i = 0; i < 3; i++) art.mesh(root, new T.IcosahedronGeometry(.13, 0), p.clay, [top[0] + Math.sin(i * 2.1) * .18, height - .14, top[2] + Math.cos(i * 2.1) * .17]);
}

function oasis(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  // The crescent shore occupies the left margin, while palms frame the rear spring.
  pool(art, root, -10.0, -4.2, 2.7, 3.35, 1.8, art.mix(p.sand, p.paper, .28), art.mix(p.water, p.jade, .18));
  for (const [x, z, h, lean] of [[-11.2, -7.9, 4.5, .65], [-9.0, -9.4, 5.2, .7], [8.7, -8.5, 4.6, -.5], [11.0, -6.7, 3.4, -.5]]) palm(art, root, x, z, h, lean, day * .018 + x);
  surface(art, root, (u, v) => {
    const x = -12.1 + u * 24.2, z = -12.4 + v * 4.2;
    return [x, .1 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (1.2 + .6 * Math.cos(u * 6)), z];
  }, 36, 10, art.mix(p.sand, p.paper, .34));
  for (let i = 0; i < 11; i++) {
    const a = -.2 + i / 10 * Math.PI * .96;
    grass(art, root, -10 + Math.cos(a) * 2.3, .34, -4.2 + Math.sin(a) * 2.75, .35 + i % 3 * .1, i * .8);
  }
  for (let i = 0; i < 4; i++) stone(art, root, 9.6 + Math.sin(i * 2.1) * .7, -3 + Math.cos(i * 2.1) * .6, [.36, .18, .27], p.sand, .04, i);
}

function grassland(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const sample = (u: number, v: number): Point => {
    const x = -12.6 + u * 25.2, taper = Math.max(0, Math.sin(u * Math.PI));
    const centre = -9.25 + Math.sin(u * Math.PI * 3 + .35) * .27;
    const breadth = 2.8 * taper ** .34 * (1 + Math.sin(u * 11 + .5) * .08);
    const z = centre + (v * 2 - 1) * breadth;
    const roll = Math.max(0, Math.sin(v * Math.PI)) ** 1.3 * taper ** .7;
    return [x, .06 + roll * (.58 + .72 * Math.sin(u * Math.PI * 2 + .7) ** 2), z];
  };
  surface(art, root, sample, 60, 20, art.mix(p.jade, p.paper, .53));
  for (let band = 0; band < 4; band++) {
    const a: Point[] = [], b: Point[] = [];
    for (let i = 0; i <= 42; i++) {
      const u = i / 42, v = .13 + band * .2 + Math.sin(u * 5 + band) * .035;
      const point = sample(u, v), next = sample(u, v + .024);
      point[1] += .022; next[1] += .022; a.push(point); b.push(next);
    }
    ribbon(art, root, b, a, art.mix(p.gold, p.jade, .72 + band * .04));
  }
  for (let i = 0; i < 44; i++) {
    const point = sample(.04 + (i * .381966) % .9, .07 + (i * .27183) % .86);
    grass(art, root, point[0], point[1] + .02, point[2], .25 + i % 4 * .075, .4 + day * .01);
  }
  for (const side of [-1, 1]) {
    // Low, wandering shoulders meet the rear meadow and taper into the riverbank.
    const shoulder = (u: number, v: number): Point => {
      const taper = Math.max(0, Math.sin(v * Math.PI));
      const centre = side * (10.05 + Math.sin(v * 5.3 + side * .4) * .28);
      const width = taper ** .42 * (1.72 + Math.sin(v * 8 + side) * .21);
      const roll = Math.max(0, Math.sin(u * Math.PI)) ** 1.35 * taper;
      return [centre + (u * 2 - 1) * width, .06 + roll * (.46 + Math.sin(v * 5 + side) ** 2 * .24), -9.7 + v * 10.8];
    };
    surface(art, root, shoulder, 20, 32, art.mix(p.jade, p.paper, .53));
    for (let i = 0; i < 9; i++) {
      const point = shoulder(.18 + (i * .381966) % .64, .24 + i * .078);
      grass(art, root, point[0], point[1] + .02, point[2], .27 + i % 3 * .06, i + day * .01);
    }
  }
}

function acacia(art: PaperScenery, root: T.Group, x: number, z: number, height: number, width: number, phase: number) {
  const p = art.palette;
  art.line(root, [[x, .1, z], [x - .16, height * .47, z], [x + .14, height * .77, z - .08]], .15, art.mix(p.ink, p.clay, .42));
  for (let i = 0; i < 5; i++) {
    const a = phase + i * 2.4, dx = Math.cos(a) * width * .5, dz = Math.sin(a) * width * .2;
    const y = height + Math.sin(a) * .13;
    art.line(root, [[x - .08, height * .48, z], [x + dx * .5, height * .77, z + dz * .5], [x + dx, y, z + dz]], .06, p.ink);
    for (let layer = 0; layer < 3; layer++) {
      const points = oval(x + dx, z + dz, width * (.39 - layer * .018), width * (.24 - layer * .012), i + phase, 24);
      slab(art, root, points, y + layer * .115, .13, art.mix(p.forest, p.jade, .2 + layer * .19));
    }
  }
}

function savanna(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  surface(art, root, (u, v) => [-12.5 + 25 * u, .1 + Math.sin(v * Math.PI) * (.18 + Math.sin(u * 6.1) ** 2 * .4), -12.4 + 6.3 * v], 40, 12, art.mix(p.gold, p.sand, .67));
  acacia(art, root, -8.6, -8.8, 4.4, 4.5, .2);
  acacia(art, root, 8.5, -10.2, 3.3, 3.7, 1.1);
  acacia(art, root, 10.2, -2.9, 2.6, 2.7, .6);
  for (let mound = 0; mound < 3; mound++) {
    const x = -10.8 + mound * .72, z = -3.7 + mound * .34, h = 1.3 + mound % 2 * .8;
    art.mesh(root, new T.ConeGeometry(.55 - mound * .06, h, 7), art.mix(p.clay, p.sand, .55), [x, .06 + h / 2, z]);
    for (let i = 0; i < 3; i++) art.line(root, [[x + Math.sin(i * 2) * .4, .13, z + Math.cos(i * 2) * .4], [x + Math.sin(i * 2) * .2, h * .57, z + Math.cos(i * 2) * .2], [x, h + .045, z]], .019, art.mix(p.sand, p.paper, .25));
  }
  for (let i = 0; i < 28; i++) {
    const x = -11.9 + (i * 2.71) % 23.4, z = -7.1 - (i * 1.17) % 4.8;
    const u = (x + 12.5) / 25, v = (z + 12.4) / 6.3;
    grass(art, root, x, .1 + Math.sin(v * Math.PI) * (.18 + Math.sin(u * 6.1) ** 2 * .4), z, .37 + i % 3 * .11, .7 + day * .008, true);
  }
  for (let i = 0; i < 5; i++) stone(art, root, 2.6 + i * .68, -8.9 + Math.sin(i) * .45, [.24, .14, .27], art.mix(p.clay, p.sand, .75), .1, i);
}

function hills(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const hills: [number, number, number, number, number][] = [[-8.1, -9.6, 4.2, 2.7, 3.5], [-.3, -10.0, 4.7, 2.4, 2.45], [8.0, -9.6, 4.3, 2.75, 3.0]];
  hills.forEach(([x, z, rx, rz, height], hill) => {
    const elevation = (xx: number, zz: number) => .09 + height * Math.max(0, 1 - ((xx - x) / rx) ** 2 - ((zz - z) / rz) ** 2) ** 1.45;
    surface(art, root, (u, v) => {
      const a = -u * Math.PI * 2, r = v;
      const xx = x + Math.cos(a) * rx * r, zz = z + Math.sin(a) * rz * r;
      return [xx, elevation(xx, zz), zz];
    }, 48, 13, art.mix(p.forest, p.jade, .5 + hill * .13));
    for (let layer = 0; layer < 4; layer++) {
      const r = .68 + layer * .077, points: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = .07 + i / 12 * Math.PI * .94, xx = x + Math.cos(a) * rx * r, zz = z + Math.sin(a) * rz * r;
        points.push([xx, elevation(xx, zz) + .018, zz]);
      }
      art.line(root, points, .025, art.mix(p.jade, p.paper, .28 + layer * .09));
    }
    for (let i = 0; i < 6; i++) {
      const xx = x + Math.sin(i * 2.399) * rx * .62, zz = z + Math.cos(i * 2.399) * rz * .53;
      art.tree(root, xx, zz, .62 + i % 3 * .11, i % 3 ? 'pine' : 'round', day * .02 + i, elevation(xx, zz));
    }
  });
  for (const side of [-1, 1]) {
    const x = side * 10.5;
    stone(art, root, x, -2.2, [.88, .42, .58], art.mix(p.limestone, p.jade, .15));
    for (let i = 0; i < 5; i++) grass(art, root, x + Math.sin(i * 2.4) * .94, .12, -2.2 + Math.cos(i * 2.4) * .6, .42, i);
  }
}

function basin(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  const x = .5, z = -9.35, rx = 11.9, rz = 3.15;
  slab(art, root, oval(x, z, rx, rz, 1.2), .025, .29, art.mix(p.jade, p.limestone, .62));
  pool(art, root, .2, -9.1, 5.8, 1.78, 1.5, art.mix(p.jade, p.paper, .56), art.mix(p.water, p.ocean, .2), .33);
  // A low fore-rim opens onto the model; the crescent's far wall exposes its nested catchment.
  const sample = (u: number, v: number): Point => {
    const a = -u * Math.PI * 2, r = .56 + .44 * v;
    const back = (1 - Math.sin(a)) / 2;
    const crest = Math.sin(v * Math.PI) ** .85;
    return [x + Math.cos(a) * rx * r, .31 + crest * (.3 + 3.3 * back ** 3) * (.86 + .14 * Math.sin(a * 5 + .2)), z + Math.sin(a) * rz * r];
  };
  surface(art, root, sample, 80, 16, art.mix(p.forest, p.jade, .58));
  for (let contour = 0; contour < 4; contour++) {
    const points: Point[] = [];
    for (let i = 0; i <= 44; i++) {
      const point = sample(.02 + i / 44 * .46, .43 + contour * .125);
      point[1] += .024; points.push(point);
    }
    art.line(root, points, .025, art.mix(p.jade, p.paper, .3 + contour * .1));
  }
  for (let i = 0; i < 5; i++) art.tree(root, -10.5 + i * .57, -8.0 - Math.sin(i) * .5, .37 + i % 2 * .09, 'pine', day + i, .7);
  for (let i = 0; i < 6; i++) stone(art, root, 8.9 + Math.sin(i * 2.4) * 1.4, -3.2 + Math.cos(i * 2.4) * .9, [.3, .18, .35], art.mix(p.limestone, p.jade, .27), .035, i);
}

function alluvial(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette, apex: Plan = [-5.1, -12.3], radius = 6.3;
  const fanPoint = (angle: number, distance: number): Point => [apex[0] + Math.sin(angle) * distance, .18 + (1 - distance / radius) ** 1.25 * 1.35, apex[1] + Math.cos(angle) * distance];
  surface(art, root, (u, v) => fanPoint((u - .5) * 2.6, .12 + v * (radius - .12)), 52, 22, art.mix(p.sand, p.clay, .32));
  for (let ring = 0; ring < 4; ring++) {
    const points: Point[] = [];
    for (let i = 0; i <= 36; i++) { const point = fanPoint(-1.25 + i / 36 * 2.5, 5.15 + ring * .25); point[1] += .025; points.push(point); }
    art.line(root, points, .028, art.mix(p.sand, p.paper, .43 + ring * .09));
  }
  for (let branch = 0; branch < 7; branch++) {
    const a = -.99 + branch * .33, points: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, angle = a * Math.pow(t, .7) + Math.sin(t * 7 + branch) * .027;
      const point = fanPoint(angle, .3 + t * 5.9); point[1] += .05; points.push(point);
    }
    stream(art, root, points, .14 + branch % 2 * .035, art.mix(p.water, p.sand, .12), art.mix(p.clay, p.limestone, .3));
    if (branch % 2) {
      const fork: Point[] = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5, point = fanPoint(a + .15 * t, 3.9 + t * 2.25); point[1] += .05; fork.push(point); }
      stream(art, root, fork, .085, p.water, art.mix(p.clay, p.limestone, .4));
    }
  }
  for (const side of [-1, 1]) {
    art.shape(root, [[-1.45, 0], [-.83, 2.45], [-.23, 3.3], [.23, 2.28], [1.48, 0]], .63,
      art.mix(p.clay, p.limestone, .51), [apex[0] + side * 2.0, .08, -12.7]);
    art.shape(root, [[-.62, 0], [-.26, 1.5], [.09, 1.87], [.75, 0]], .32,
      art.mix(p.clay, p.sand, .7), [apex[0] + side * 3.0, .07, -12.1]);
  }
  for (let i = 0; i < 14; i++) {
    const point = fanPoint(-1.17 + i / 13 * 2.34, 5.55 + i % 2 * .42);
    stone(art, root, point[0], point[2], [.09 + i % 3 * .025, .045, .1], art.mix(p.clay, p.limestone, .58), point[1], i + day * .02);
  }
  surface(art, root, (u, v) => {
    const taper = Math.max(0, Math.sin(v * Math.PI));
    const centre = 10.35 + Math.sin(v * 5 - .5) * .25;
    const width = (1.55 + Math.sin(v * 7) * .12) * taper ** .4;
    const bank = Math.min(1, Math.max(0, Math.sin(u * Math.PI)) * 4) * Math.min(1, taper * 5);
    return [centre + (u * 2 - 1) * width, .06 + bank * .22, -7.6 + v * 7.4];
  }, 18, 28, art.mix(p.sand, p.paper, .35));
  stream(art, root, [[10.2, .3, -7], [9.75, .3, -5.3], [10.9, .3, -3.8], [10.2, .3, -1.0]], .22, p.water, p.clay);
  stream(art, root, [[10.1, .3, -5.8], [11.3, .3, -4.7], [11.6, .3, -2.7], [10.2, .3, -1.0]], .13, p.water, p.clay);
}

function waterfall(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette;
  // A nearer gorge wall faces the falls, giving the viewer a framed view into the valley.
  for (let layer = 0; layer < 8; layer++) {
    const inset = layer * .055;
    slab(art, root, [[-13.1 + inset, -7.8], [-10.8, -8.3], [-8.6 - inset, -6.1],
      [-8.9 - inset, -3.4], [-10.4, -1.9 - inset], [-12.7 + inset, -3]],
    .06 + layer * .52, .54, art.mix(p.limestone, layer % 3 ? p.forest : p.jade, .24));
  }
  art.tree(root, -11.7, -5.2, .72, 'pine', day, 4.22);
  for (let i = 0; i < 3; i++) stone(art, root, -10.5 - i * .8, -1.3 + i * .12,
    [.43, .26 - i * .04, .37], p.limestone, .05, i * .6);
  const cliffs: [number, number, number, number, number][] = [[8.8, -10.7, 3.6, 2.0, 7.8], [9.35, -8.15, 2.5, 1.2, 4.45], [10, -6.5, 2.05, 1.0, 1.85]];
  cliffs.forEach(([x, z, rx, rz, h], cliff) => {
    for (let layer = 0; layer < 9; layer++) {
      const shift = layer % 3 * .07, factor = 1 - layer * .018;
      slab(art, root, [[x - rx * factor, z - rz * .74], [x - rx * .35, z - rz], [x + rx * .74, z - rz * .87],
        [x + rx * factor, z - rz * .15], [x + rx * .83, z + rz * .88], [x + rx * .2 + shift, z + rz], [x - rx * .75, z + rz * .8]],
      .06 + layer * h / 9, h / 9 + .02, art.mix(p.limestone, layer % 3 ? p.forest : p.jade, .22 + cliff * .045));
    }
    for (let i = 0; i < 3; i++) stone(art, root, x - rx * .6 + i * rx * .52, z - .3, [.33, .1, .25], art.mix(p.jade, p.forest, .2), h + .1, i);
  });
  const falls: Point[][] = [[[8.65, 7.95, -9.03], [8.65, 7.74, -8.59], [8.85, 4.63, -8.43], [9.05, 4.57, -7.22]],
    [[9.05, 4.58, -7.23], [9.15, 4.37, -6.83], [9.42, 2.05, -6.69], [9.75, 1.99, -5.63]],
    [[9.75, 2, -5.63], [9.8, 1.76, -5.43], [10, .45, -5.19], [10.15, .38, -4.7]]];
  falls.forEach((points, tier) => {
    const width = 1.2 - tier * .12;
    ribbon(art, root, points.map(([x, y, z]) => [x - width / 2, y, z]), points.map(([x, y, z]) => [x + width / 2, y, z]), art.mix(p.ice, p.water, .22));
    for (let i = 0; i < 7; i++) art.line(root, points.map(([x, y, z], index) => [x - width * .44 + i * width * .145 + Math.sin(index + i) * .019, y + .025, z + .035]),
      i % 2 ? .018 : .027, art.mix(p.snow, p.water, i % 3 * .14));
  });
  const level = pool(art, root, 10.25, -4.3, 2.3, 1.9, .8, art.mix(p.limestone, p.jade, .36), art.mix(p.water, p.ocean, .12), .34);
  for (let i = 0; i < 9; i++) {
    const x = 10.05 + Math.sin(i * 2.399) * (.18 + i * .065), z = -4.9 + Math.cos(i * 2.399) * .39;
    slab(art, root, oval(x, z, .1 + i % 3 * .035, .055, i, 12), level + .025, .014, art.mix(p.snow, p.water, .22));
  }
  for (let i = 0; i < 5; i++) grass(art, root, 12.1 + Math.sin(i) * .28, .31, -5.1 + i * .37, .47, day * .02 + i);
  art.shape(root, [[-2.7, 0], [-1.95, 1.2], [-.9, 3.4], [.25, 2.7], [1.15, 1.2], [2.4, 0]], 1.1, art.mix(p.forest, p.limestone, .61), [-9.3, .07, -11.7]);
  for (let i = 0; i < 4; i++) art.tree(root, -11 + i * 1.2, -8.3 + Math.sin(i) * .3, .55 + i % 2 * .13, 'pine', day + i, .12);
}

export const INLAND_LANDFORMS = {
  dunes, yardang, mesa, badlands, saltpan, oasis, grassland, savanna, hills, basin, alluvial, waterfall,
} satisfies Record<'dunes' | 'yardang' | 'mesa' | 'badlands' | 'saltpan' | 'oasis' | 'grassland' | 'savanna' | 'hills' | 'basin' | 'alluvial' | 'waterfall', Landform>;
