import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import type { EARLY_DESIGNS } from './history-designs-early';

type Art = PaperScenery;
type Point = [number, number, number];
type Model = (art: Art, root: T.Group) => void;

// Joinery is shared; the 74 primary sculptures below are individually composed.
function group(root: T.Object3D, position: Point = [0, 0, 0]) {
  const g = new T.Group(); g.position.set(...position); root.add(g); return g;
}
function rod(a: Art, r: T.Object3D, from: Point, to: Point, radius: number, color: string) {
  const start = new T.Vector3(...from), end = new T.Vector3(...to), direction = end.sub(start);
  const m = a.mesh(r, new T.CylinderGeometry(radius, radius, direction.length(), 8), color);
  m.position.copy(start.addScaledVector(direction, .5));
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()); return m;
}
function curve(a: Art, r: T.Object3D, points: Point[], radius: number, color: string) {
  return a.mesh(r, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v => new T.Vector3(...v))), Math.max(20, points.length * 3), radius, 5, false), color);
}
function orb(a: Art, r: T.Object3D, position: Point, radius: number, color: string, scale: Point = [1, 1, 1]) {
  const m = a.mesh(r, new T.SphereGeometry(radius, 16, 10), color, position); m.scale.set(...scale); return m;
}
function hoop(a: Art, r: T.Object3D, position: Point, radius: number, color: string, tube = .06) {
  return a.mesh(r, new T.TorusGeometry(radius, tube, 5, 48), color, position);
}
function disk(a: Art, r: T.Object3D, position: Point, radius: number, depth: number, color: string) {
  const m = a.cylinder(r, radius, depth, position, color); m.rotation.x = Math.PI / 2; return m;
}
function panel(a: Art, r: T.Object3D, position: Point, width: number, height: number, color: string, edge = a.palette.gold) {
  const g = group(r, position), d = .12;
  a.box(g, [width, height, d], [0, 0, 0], color);
  for (const s of [-1, 1]) {
    a.box(g, [width + .08, .055, d + .06], [0, s * height / 2, 0], edge);
    a.box(g, [.055, height, d + .06], [s * width / 2, 0, 0], edge);
  }
  return g;
}
function bolts(a: Art, r: T.Object3D, position: Point, radius: number, count = 12) {
  for (let i = 0; i < count; i++) {
    const t = i / count * Math.PI * 2;
    orb(a, r, [position[0] + Math.cos(t) * radius, position[1] + Math.sin(t) * radius, position[2]], .052, a.palette.gold);
  }
}
function arch(a: Art, r: T.Object3D, position: Point, radius: number, thickness: number, color: string, start = 0, end = Math.PI) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 32; i++) { const t = start + (end - start) * i / 32; pts.push([Math.cos(t) * radius, Math.sin(t) * radius]); }
  for (let i = 32; i >= 0; i--) { const t = start + (end - start) * i / 32; pts.push([Math.cos(t) * (radius - thickness), Math.sin(t) * (radius - thickness)]); }
  return a.shape(r, pts, .22, color, position);
}
function foot(a: Art, r: T.Object3D, position: Point, width: number, depth: number) {
  const p = a.palette;
  a.box(r, [width, .2, depth], position, p.limestone);
  a.box(r, [width - .2, .11, depth - .2], [position[0], position[1] + .16, position[2]], p.paper);
  a.box(r, [width - .4, .04, depth - .4], [position[0], position[1] + .24, position[2]], p.gold);
}
function ticks(a: Art, r: T.Object3D, center: Point, radius: number, count: number, start = 0, sweep = Math.PI * 2) {
  for (let i = 0; i < count; i++) {
    const t = start + sweep * i / count, length = i % 5 === 0 ? .27 : .12;
    rod(a, r, [center[0] + Math.cos(t) * (radius - length), center[1] + Math.sin(t) * (radius - length), center[2]], [center[0] + Math.cos(t) * radius, center[1] + Math.sin(t) * radius, center[2]], .022, a.palette.gold);
  }
}

export const EARLY_MODELS: Record<keyof typeof EARLY_DESIGNS, Model> = {
  '2025-12-13': (a, r) => {
    const p = a.palette;
    // The first, still empty HTML document stands like a folded paper monolith.
    a.shape(r, [[-3, 0], [2.8, 0], [2.8, 6.3], [1.6, 7.5], [-3, 7.5]], .2, p.paper, [-.8, .75, -1.5]);
    a.shape(r, [[0, 0], [1.2, 0], [0, 1.2]], .18, p.limestone, [.8, 7.05, -1.22]);
    rod(a, r, [-3.6, 1.2, -1.22], [-3.6, 7.7, -1.22], .035, p.gold);
    for (let i = 0; i < 3; i++) a.box(r, [2.8 - i * .45, .035, .04], [-.7, 5.6 - i * .35, -1.23], p.mist);
    a.shape(r, [[-2.3, 0], [2.9, 0], [4, .7], [-1.7, .7]], .18, p.limestone, [-.8, .77, -1.6]).rotation.x = Math.PI / 2;
    curve(a, r, [[.3, .8, .5], [.15, 1.7, .4], [.7, 2.8, .35]], .08, p.forest);
    for (const s of [-1, 1]) a.shape(r, [[0, 0], [s * 1.1, .25], [s * 1.45, 1], [s * .45, .85]], .08, p.jade, [.25, 1.7 + s * .12, .35]);
    orb(a, r, [.25, .96, .45], .35, p.gold, [1, .5, 1]);
    for (let i = 0; i < 7; i++) rod(a, r, [.25, .85, .45], [Math.sin(i * 2.1) * 1.4, .75, .45 + Math.cos(i * 2.1) * .8], .026, p.gold);
  },
  '2026-02-17': (a, r) => {
    const p = a.palette;
    // Seven weekly channels, a waterwheel, and a stepped receiving basin.
    for (let i = 0; i < 7; i++) {
      const x = -6.3 + i * 1.8;
      a.box(r, [.35, 4.2 - i * .28, .8], [x, 2.85 - i * .14, -2], p.limestone);
      if (i < 6) arch(a, r, [x + .9, 2.15 - i * .25, -1.85], .78, .2, p.paper);
      a.box(r, [1.75, .18, 1.5], [x, 5.02 - i * .28, -2], p.paper);
      a.box(r, [1.74, .05, .82], [x, 5.15 - i * .28, -2], p.water);
      for (const z of [-2.7, -1.3]) a.box(r, [1.8, .2, .12], [x, 5.21 - i * .28, z], p.gold);
    }
    const wheel = group(r, [5.3, 2.55, -.8]); hoop(a, wheel, [0, 0, 0], 1.7, p.forest, .13); hoop(a, wheel, [0, 0, .18], 1.5, p.gold);
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; rod(a, wheel, [0, 0, 0], [Math.cos(t) * 1.6, Math.sin(t) * 1.6, 0], .055, p.gold); const b = a.box(wheel, [.5, .18, .5], [Math.cos(t) * 1.7, Math.sin(t) * 1.7, 0], p.jade); b.rotation.z = t; }
    disk(a, wheel, [0, 0, .15], .26, .32, p.vermilion);
    foot(a, r, [4.9, .85, .1], 5, 2.5); a.box(r, [4.4, .07, 1.8], [4.9, 1.14, .1], p.water);
    curve(a, r, [[5.5, 3.35, -2], [6.2, 2.3, -.8], [6.5, 1.2, .1]], .12, p.water);
  },
  '2026-02-18': (a, r) => {
    const p = a.palette;
    // Two scripts meet on an asymmetrical six-leaf folding screen.
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 1.65, h = 4.7 + Math.sin(i / 5 * Math.PI) * 2;
      const g = panel(a, r, [x, .95 + h / 2, -1 + (i % 2) * .8], 1.85, h, i < 3 ? p.paper : p.jade); g.rotation.y = (i % 2 ? -.25 : .25);
      for (let j = 0; j < 4; j++) {
        const y = h * .3 - j * .9;
        if (i < 3) { a.box(g, [.7, .06, .08], [0, y, .12], p.forest); a.box(g, [.06, .5, .08], [0, y, .12], p.forest); }
        else { a.box(g, [.8 - j * .11, .045, .08], [0, y, .12], p.paper); a.box(g, [.55, .045, .08], [-.1, y - .2, .12], p.paper); }
      }
      for (const s of [-1, 1]) a.box(g, [.15, .55, .45], [s * .7, -h / 2 - .14, 0], p.forest);
      for (let j = 0; j < 3; j++) a.cylinder(g, .065, .35, [.92, -1.5 + j * 1.6, 0], p.gold);
    }
    curve(a, r, [[-5, .83, 1.3], [-1.5, .85, 1.8], [1.4, .85, 1.1], [5, .85, 1.8]], .055, p.vermilion);
  },
  '2026-02-19': (a, r) => {
    const p = a.palette;
    a.cylinder(r, 3.35, .4, [0, 1, -.6], p.paper); a.cylinder(r, 3.05, .12, [0, 1.28, -.6], p.gold);
    const crown = group(r, [0, 3.2, -.9]);
    for (let i = 0; i < 9; i++) { const t = Math.PI * 2 * i / 9; const q = group(crown, [Math.cos(t) * 2.6, 0, Math.sin(t) * 2.6]); q.rotation.y = -t + Math.PI / 2; a.shape(q, [[-.8, 0], [-.68, 1], [-.42, .5], [0, 2.3], [.42, .5], [.68, 1], [.8, 0]], .13, p.gold); orb(a, q, [0, 2.4, .03], .13, p.vermilion); }
    const rim = hoop(a, r, [0, 3.1, -.9], 2.65, p.gold, .17); rim.rotation.x = Math.PI / 2;
    for (const angle of [-.5, .5]) { const g = group(r, [0, 1.45, 0]); g.rotation.y = angle; a.box(g, [10, .16, .8], [0, 0, 0], p.forest); for (let i = 0; i < 9; i++) a.box(g, [.06, .03, .55], [i - 4, .1, 0], p.paper); }
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const t = .2 + i * .25; const x = s * (3.15 + Math.sin(t) * .5); a.shape(r, [[0, 0], [s * .7, .25], [s * .8, .6], [0, .45]], .06, p.jade, [x, 1.5 + i * .5, -.8]); }
  },
  '2026-02-20': (a, r) => {
    const p = a.palette, pivot: Point = [0, 1, 0];
    for (let i = 0; i < 11; i++) {
      const t = .17 + i * .28, x = Math.cos(t) * 6, y = 1 + Math.sin(t) * 6;
      const next = t + .27;
      a.shape(r, [[0, 0], [Math.cos(t) * 6, Math.sin(t) * 6], [Math.cos(next) * 6, Math.sin(next) * 6]], .11, i % 2 ? p.paper : p.jade, pivot);
      rod(a, r, pivot, [x, y, .1], .045, p.gold);
      const flag = a.shape(r, [[0, 0], [.72, -.05], [.6, -.45], [0, -.42]], .04, [p.vermilion, p.gold, p.forest][i % 3], [x, y, .14]); flag.rotation.z = t - Math.PI / 2;
    }
    disk(a, r, [0, 1.1, .25], .45, .18, p.gold); bolts(a, r, [0, 1.1, .4], .32, 8);
    a.box(r, [5.3, .18, 2.1], [0, .83, -.15], p.limestone);
    for (let i = 0; i < 5; i++) a.box(r, [.7, .08, .5], [i * .95 - 1.9, .96, 1], p.paper);
  },
  '2026-02-21': (a, r) => {
    const p = a.palette;
    for (const s of [-1, 1]) {
      const g = group(r, [s * 2.5, 3.1 + s * .65, -.4 + s]); g.rotation.z = s * .1;
      a.shape(g, [[-2.6, 0], [1.8, 2.5], [3, 1.9], [1, 1.7], [-.5, -.45]], .32, s < 0 ? p.jade : p.paper);
      a.shape(g, [[-2.6, 0], [-1.1, 1.4], [1.8, 2.5], [-.5, -.45]], .1, p.forest, [0, .03, -.12]);
      curve(a, g, [[-2.5, .1, .4], [-.5, .8, .4], [1.85, 2.3, .4]], .045, p.gold);
      for (let i = 0; i < 4; i++) rod(a, g, [-2.2 + i * .45, .08 + i * .26, .4], [-1.3 + i * .5, .2 + i * .44, .4], .025, p.gold);
      rod(a, r, [s * 3, .95, -.5 + s], [s * 2.5, 3.05 + s * .65, -.4 + s], .07, p.gold);
    }
    for (let i = 0; i < 5; i++) curve(a, r, [[-6, .9, .3 + i * .27], [-2, 1 + i * .1, .3 + i * .27], [5, 2 + i * .3, .3 + i * .27]], .025, p.gold);
  },
  '2026-02-22': (a, r) => {
    const p = a.palette;
    // A glass-card sculpture, with open centres and a coherent cube of loose particles.
    for (let i = 0; i < 3; i++) {
      const g = group(r, [-3.5 + i * 2.6, 3.5 + i * 1.1, -2.4 + i * .7]); g.rotation.z = -.24 + i * .2; g.rotation.y = -.12 + i * .11;
      const w = 3.9, h = 4.6;
      panel(a, g, [0, 0, 0], w, h, i === 1 ? p.ice : p.paper, p.gold);
      panel(a, g, [0, .25, .12], w - .4, h - 1.3, p.water, p.paper);
      a.box(g, [1.8, .07, .09], [-.65, -1.65, .13], p.gold);
      a.box(g, [.8, .07, .09], [-1.14, -1.95, .13], p.jade);
      for (const s of [-1, 1]) orb(a, g, [s * 1.7, 2.04, .16], .055, p.gold);
      a.shape(g, [[-1.7, 1.8], [-.8, 1.8], [1.5, -1.3], [.65, -1.3]], .02, p.paper, [0, 0, .21]);
      rod(a, r, [-3.5 + i * 2.6, .83, -2.4 + i * .7], [-3.5 + i * 2.6, 1.5 + i * 1.1, -2.4 + i * .7], .05, p.gold);
    }
    const dust = group(r, [3.5, 2.1, 1.2]); dust.rotation.set(.15, -.4, .05);
    // These are separate square grains, an abstract particle volume rather than a puzzle state.
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) {
      if (x > 0 && x < 3 && y > 0 && y < 3 && z > 0 && z < 3) continue;
      const spread = x === 3 && y > 1 ? (y - 1) * .17 : 0;
      a.box(dust, [.22, .22, .22], [(x - 1.5) * .48 + spread, (y - 1.5) * .48 + spread, (z - 1.5) * .48], [p.jade, p.gold, p.paper][(x + y + z) % 3]);
    }
    for (let i = 0; i < 15; i++) a.box(r, [.09, .09, .09], [3.8 + Math.sin(i * 1.9) * 2.1, 2.7 + i * .2, .9 + Math.cos(i * 2.4)], i % 3 ? p.gold : p.vermilion);
    a.animate(dust, 'leaf');
  },
  '2026-02-23': (a, r) => {
    const p = a.palette;
    for (const x of [-5.3, 5.3]) { foot(a, r, [x, .86, -1], 1.4, 2); a.cylinder(r, .13, 6, [x, 3.95, -1], p.forest); orb(a, r, [x, 7.1, -1], .23, p.gold); }
    curve(a, r, [[-5.3, 6.75, -1], [0, 7.45, -1], [5.3, 6.75, -1]], .13, p.gold);
    for (let i = 0; i < 7; i++) {
      const x = -4.2 + i * 1.4, y = 4.3 - Math.abs(i - 3) * .35;
      rod(a, r, [x, 7.15, -1], [x, y + 1, -1], .025, p.gold);
      const g = panel(a, r, [x, y, -1], 1.03, 1.7, i === 3 ? p.vermilion : p.paper);
      a.shape(g, [[-.28, .2], [.28, .2], [0, -.13]], .04, p.gold, [0, 0, .15]);
      a.cylinder(r, .07, .65, [x, y - 1.35, -1], p.gold);
    }
    for (let i = 0; i < 4; i++) a.box(r, [2.1, .28, 1.6], [-3.5 + i * 2.3, 1.05, .9], i === 1 ? p.jade : p.paper);
  },
  '2026-02-24': (a, r) => {
    const p = a.palette;
    // A raster pours down a curved lip, changing from solid paper to distinct pixels.
    for (let column = 0; column < 15; column++) {
      const x = (column - 7) * .58;
      const pts: Point[] = [[x, 6.7, -3.5], [x, 6.65, -1.9], [x, 5.9, -.8], [x, 3.4, -.2], [x, 1, 1]];
      curve(a, r, pts, .035, p.gold);
      for (let row = 0; row < 11; row++) {
        const t = row / 10, y = 6.5 - t * 5.4, z = -.9 + t * t * 1.9;
        if (row > 6 && (column + row) % 4 === 0) continue;
        const tile = a.box(r, [.47, .42, .1], [x, y, z], (column + row * 2) % 5 === 0 ? p.gold : row % 3 ? p.paper : p.jade); tile.rotation.x = -.12 - t * .2;
      }
    }
    for (const x of [-4.5, 4.5]) { rod(a, r, [x, .85, -3], [x, 6.8, -3], .13, p.forest); rod(a, r, [x, 6.8, -3], [x, 6.7, -.9], .13, p.forest); }
    a.box(r, [10, .18, 2], [0, .86, 1], p.limestone);
  },
  '2026-02-25': (a, r) => {
    const p = a.palette;
    a.shape(r, [[-4.2, .9], [-3.7, 2.6], [-1, 2.3], [0, 1.8], [1, 2.3], [3.7, 2.6], [4.2, .9], [2.8, 0], [1, .25], [0, .6], [-1, .25], [-2.8, 0]], .55, p.forest, [0, 3.8, -.7]);
    curve(a, r, [[-4.15, 4.7, -.08], [-2.5, 4.15, -.08], [0, 4.4, -.08], [2.5, 4.15, -.08], [4.15, 4.7, -.08]], .065, p.gold);
    for (const s of [-1, 1]) { curve(a, r, [[s * 4, 5, -.5], [s * 5.5, 4.3, -1], [s * 4.5, 2, -.7]], .14, p.jade); rod(a, r, [s * 2.8, .8, -1], [s * 2.8, 4.1, -.7], .06, p.gold); }
    const necklace: Point[] = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30 * Math.PI; necklace.push([Math.cos(t) * 5.2, 3.3 - Math.sin(t) * 2.05, .75]); }
    curve(a, r, necklace, .035, p.gold);
    for (let i = 0; i < 15; i++) { const t = (i + .5) / 15 * Math.PI; orb(a, r, [Math.cos(t) * 5.2, 3.3 - Math.sin(t) * 2.05, .75], .22, i % 5 === 0 ? p.vermilion : p.paper); }
    foot(a, r, [0, .83, -.7], 6.7, 2.6);
  },
  '2026-02-26': (a, r) => {
    const p = a.palette;
    const arrow = a.shape(r, [[-5, 0], [1.8, 0], [1.8, -1], [5.2, 1.2], [1.8, 3.4], [1.8, 2.3], [-5, 2.3]], .5, p.paper, [0, 3.4, -1.2]);
    arrow.rotation.z = .13;
    rod(a, r, [-3.8, .9, -1], [-3.8, 4, -1], .16, p.forest);
    for (let i = 0; i < 7; i++) {
      const g = panel(a, r, [-3.8 + i * .83, 4.65 + i * .108, -.58], .58, 1.35, i === 6 ? p.vermilion : p.jade, p.paper);
      for (let j = 0; j < 2; j++) a.box(g, [.08, .08, .05], [-.13 + j * .26, .35, .1], p.gold);
      a.box(g, [.32, .06, .05], [0, -.1, .1], p.gold);
    }
    for (let i = 0; i < 3; i++) { const sheet = panel(a, r, [.8 + i, 2.9 - i * .65, .1 + i * .45], 1.1, 1.1, p.paper); sheet.rotation.z = -.2 - i * .15; }
    foot(a, r, [-3.8, .86, -1], 2.6, 2.4);
  },
  '2026-02-27': (a, r) => {
    const p = a.palette;
    const key = group(r, [-1.9, 4.8, -.7]); hoop(a, key, [0, 0, 0], 2.45, p.gold, .34); hoop(a, key, [0, 0, .2], 2.07, p.paper, .065); bolts(a, key, [0, 0, .35], 2.44, 18);
    a.box(key, [5.7, .65, .6], [4.3, -.5, 0], p.gold);
    for (const x of [5.3, 6.6]) a.box(key, [.7, 1.1, .7], [x, -1.15, 0], p.gold);
    for (let i = 0; i < 5; i++) { const t = i * Math.PI * 2 / 5; disk(a, key, [Math.cos(t) * 1.23, Math.sin(t) * 1.23, -.12], .46, .12, p.jade); }
    disk(a, key, [0, 0, .1], .29, .4, p.vermilion);
    a.box(r, [6.2, .22, 3.1], [-1.2, .92, -.7], p.limestone);
    for (const x of [-3.6, -.4]) rod(a, r, [x, 1, -.7], [x, 3, -.7], .12, p.forest);
    const film = panel(a, r, [3.2, 1.8, 1], 3.6, 1.2, p.jade);
    for (let i = 0; i < 7; i++) for (const y of [-.45, .45]) a.box(film, [.15, .13, .05], [-1.45 + i * .48, y, .13], p.paper);
  },
  '2026-02-28': (a, r) => {
    const p = a.palette;
    a.cylinder(r, .3, 2.1, [0, 1.9, -.8], p.gold); a.cylinder(r, 2.3, .3, [0, .95, -.8], p.limestone);
    const drum = group(r, [0, 3.9, -.8]);
    for (const y of [-1.1, 1.2]) { const h = hoop(a, drum, [0, y, 0], 3.8, p.gold, .16); h.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 18; i++) {
      const t = i / 18 * Math.PI * 2, g = group(drum, [Math.cos(t) * 3.65, 0, Math.sin(t) * 3.65]); g.rotation.y = -t + Math.PI / 2;
      a.box(g, [1.02, 1.4, .12], [0, -.3, 0], i % 3 === 0 ? p.jade : p.paper);
      for (const s of [-1, 1]) a.box(g, [.27, .83, .12], [s * .36, .8, 0], p.forest);
      a.shape(g, [[-.28, -.3], [.28, -.3], [0, .27]], .04, p.gold, [0, -.3, -.09]);
    }
    a.cylinder(drum, 3.64, .16, [0, -1.12, 0], p.jade);
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; rod(a, drum, [0, -1.05, 0], [Math.cos(t) * 3.6, -1.05, Math.sin(t) * 3.6], .045, p.gold); }
    rod(a, r, [3.7, 2.8, -.8], [5.2, 2.8, -.8], .1, p.gold); rod(a, r, [5.2, 2.8, -.8], [5.2, 3.6, -.8], .1, p.gold); orb(a, r, [5.2, 3.65, -.8], .23, p.vermilion);
  },
  '2026-03-01': (a, r) => {
    const p = a.palette, g = group(r, [-1, 1.05, -.3]);
    // Sextant with a pierced sector, calibrated limb and adjustable sight.
    arch(a, g, [0, 5.5, 0], 5.1, .6, p.gold, Math.PI * 1.1, Math.PI * 1.9);
    for (const t of [Math.PI * 1.1, Math.PI * 1.5, Math.PI * 1.9]) rod(a, g, [0, 5.5, 0], [Math.cos(t) * 5, 5.5 + Math.sin(t) * 5, 0], .1, p.gold);
    ticks(a, g, [0, 5.5, .28], 4.98, 41, Math.PI * 1.1, Math.PI * .8);
    rod(a, g, [0, 5.5, .4], [3.3, 1.8, .4], .15, p.forest); disk(a, g, [0, 5.5, .5], .32, .15, p.gold);
    panel(a, g, [1, 4.3, .25], .85, 1.2, p.ice);
    const sight = a.cylinder(g, .28, 2, [-2.5, 4.4, .3], p.jade); sight.rotation.z = Math.PI / 2;
    for (const x of [-3.5, -1.5]) { const h = hoop(a, g, [x, 4.4, .3], .28, p.gold); h.rotation.y = Math.PI / 2; }
    foot(a, r, [-1, .84, -.2], 6, 2.3); rod(a, r, [-1, 1, -.2], [-1, 2.4, -.2], .18, p.forest);
    for (let i = 0; i < 4; i++) a.box(r, [1.5 - i * .15, .12, 1], [5.4, 1 + i * .13, -.5], p.paper);
  },
  '2026-03-02': (a, r) => {
    const p = a.palette, g = group(r, [0, 5.25, -1.1]); g.rotation.z = -.2;
    for (const s of [-1, 1]) rod(a, r, [s * 2.6, .8, -.9 + s], [0, 4.1, -.9], .11, p.forest);
    rod(a, r, [0, .8, -3.4], [0, 4.1, -.9], .11, p.forest);
    const barrel = a.cylinder(g, .8, 7.5, [0, 0, 0], p.jade, .55); barrel.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const h = hoop(a, g, [-3.7 + i * 1.35, 0, 0], .79 - i * .043, p.gold, .045); h.rotation.y = Math.PI / 2; }
    const glass = disk(a, g, [-3.82, 0, 0], .75, .05, p.ice); glass.rotation.y = Math.PI / 2;
    const eye = a.cylinder(g, .32, 1, [4.1, 0, 0], p.forest); eye.rotation.z = Math.PI / 2;
    hoop(a, r, [0, 4.15, -.2], .5, p.gold); rod(a, r, [0, 4.15, -.6], [0, 5, -.6], .16, p.gold);
    for (const s of [-1, 1]) { rod(a, r, [s * 2, 1.2, -.9 + s * .8], [0, 2.6, -.9], .04, p.gold); foot(a, r, [s * 2.6, .82, -.9 + s], .8, .8); }
    a.shape(r, [[-1, 0], [1, 0], [.7, 1.7], [-.7, 1.7]], .1, p.paper, [5.4, .85, .1]);
    for (let i = 0; i < 3; i++) a.box(r, [1.1, .05, .04], [5.4, 1.25 + i * .3, .23], p.gold);
  },
  '2026-03-03': (a, r) => {
    const p = a.palette;
    for (const x of [-2.8, 2.8]) for (const y of [2.2, 6.1]) { const spool = a.cylinder(r, .72, 2, [x, y, -.8], p.paper); spool.rotation.x = Math.PI / 2; for (const z of [-1.9, .3]) disk(a, r, [x, y, z], .8, .12, p.gold); }
    const pts: Point[] = [[-2.8, 6.8, .45], [-4, 5, .45], [-2, 3, .45], [2.8, 1.5, .45], [4, 3, .45], [2, 5, .45], [-2.8, 6.8, .45]];
    for (const z of [-.35, .55]) curve(a, r, pts.map(([x, y]) => [x, y, z]), .11, p.paper);
    const path = new T.CatmullRomCurve3(pts.map(v => new T.Vector3(...v)));
    for (let i = 0; i < 35; i++) { const v = path.getPoint(i / 35); const tangent = path.getTangent(i / 35); const card = a.box(r, [.65, .27, .8], [v.x, v.y, 0], i % 6 ? p.paper : p.jade); card.rotation.z = Math.atan2(tangent.y, tangent.x); a.box(r, [.23, .04, .08], [v.x, v.y, .47], p.gold); }
    for (const x of [-3, 3]) { a.box(r, [.2, 5.5, .4], [x, 3.8, -1.5], p.forest); foot(a, r, [x, .85, -.8], 1.8, 2); }
  },
  '2026-03-04': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 6; i++) { const leaf = a.box(r, [7 - i * .13, .12, 4], [-.9 + i * .08, 1 + i * .14, -.8], p.paper); leaf.rotation.y = (i - 2) * .017; }
    const wax = disk(a, r, [1.4, 2.6, 1], 1.8, .5, p.vermilion); wax.rotation.x = -.32;
    const rim = hoop(a, r, [1.4, 2.63, 1.27], 1.4, p.gold, .06); rim.rotation.x = -.32;
    rod(a, r, [.65, 2.2, 1.51], [1.2, 1.95, 1.62], .12, p.paper); rod(a, r, [1.2, 1.95, 1.62], [2.25, 3.03, 1.26], .12, p.paper);
    for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; orb(a, r, [1.4 + Math.cos(t) * 1.72, 2.6 + Math.sin(t) * 1.72, 1.28], .1, p.vermilion); }
    const quill = group(r, [-3.5, 2.1, -.7]); quill.rotation.z = -.38;
    rod(a, quill, [0, 0, 0], [0, 4.4, 0], .045, p.gold);
    for (let i = 0; i < 10; i++) { const w = Math.sin(i / 10 * Math.PI) * 1.1; a.shape(quill, [[0, 0], [-w, .3], [-w * .8, .8], [0, .5], [w * .9, 1], [w, .4]], .07, i % 2 ? p.paper : p.jade, [0, .7 + i * .3, 0]); }
    for (let i = 0; i < 4; i++) a.box(r, [2.8 - i * .3, .02, .035], [-1.4, 1.9, -.5 + i * .4], p.gold);
  },
  '2026-03-05': (a, r) => {
    const p = a.palette;
    // A cut-away coopered archive: exposed scrolls inside a cylinder of curved staves.
    for (let i = 0; i < 13; i++) { const t = Math.PI * .15 + i / 12 * Math.PI * 1.7; const g = group(r, [Math.cos(t) * 3.2, 3.5, -1.1 + Math.sin(t) * 2.2]); g.rotation.y = -t; a.box(g, [.34, 5.3, .86], [0, 0, 0], i % 2 ? p.paper : p.limestone); a.box(g, [.38, .05, .7], [.19, 1.8, 0], p.gold); }
    for (const y of [1.4, 5.7]) { const h = hoop(a, r, [0, y, -1.1], 3.18, p.gold, .12); h.rotation.x = Math.PI / 2; h.scale.y = .7; }
    a.cylinder(r, 3.3, .3, [0, .99, -1.1], p.limestone).scale.z = .7;
    for (let i = 0; i < 11; i++) { const x = (i % 4 - 1.5) * 1.05, y = 1.7 + Math.floor(i / 4) * 1.2; const scroll = a.cylinder(r, .44, 2.5, [x, y, -.8], p.paper); scroll.rotation.x = Math.PI / 2; hoop(a, r, [x, y, .51], .34, p.gold, .045); disk(a, r, [x, y, .55], .12, .07, p.jade); }
    const lid = a.cylinder(r, 3.3, .18, [-5.4, 1.5, -.3], p.jade); lid.rotation.z = -.4; lid.scale.z = .7;
    for (let i = 0; i < 4; i++) a.box(r, [.8, .06, .35], [4.6 + i * .3, 1.1 + i * .22, .5], p.paper);
  },
  '2026-03-06': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = -5 + t * 9, y = 6.2 - t * 4.6, z = -2.4 + t * 2.8;
      const g = panel(a, r, [x, y, z], 2.2, 1.3, i === 4 ? p.jade : p.paper); g.rotation.z = -.18 + t * .3; g.rotation.x = -.2;
      a.box(g, [.42, .45, .09], [-.66, .1, .15], p.gold);
      for (let j = 0; j < 3; j++) a.box(g, [.8 - j * .13, .04, .07], [.25, .28 - j * .21, .15], i === 4 ? p.paper : p.forest);
      rod(a, r, [x, .85, z - .2], [x, y - .55, z - .2], .04, p.gold);
    }
    const bank: [number, number][] = [[-6, 0], [6, 0], [5, .5], [2, 1], [-1, 2.1], [-4, 4.2], [-6, 4.5]];
    a.shape(r, bank, .3, p.limestone, [0, .8, -3]);
    curve(a, r, [[-5, 5.2, -2.75], [-2, 4, -2.75], [2, 2, -2.75], [5, 1.3, -2.75]], .035, p.gold);
  },
  '2026-03-07': (a, r) => {
    const p = a.palette;
    a.cylinder(r, .15, 7.1, [0, 4.35, -1], p.gold); orb(a, r, [0, 8, -1], .28, p.vermilion);
    for (const s of [-1, 1]) {
      const g = group(r, [s * 2.25, 4.9, -.6 + s * .3]); g.rotation.y = s * .3;
      a.shape(g, [[-1.8, 1.8], [1.8, 1.8], [1.8, -.6], [.9, -1.8], [0, -2.2], [-.9, -1.8], [-1.8, -.6]], .48, s < 0 ? p.paper : p.jade);
      for (const x of [-.75, .75]) { arch(a, g, [x, .35, .52], .44, .1, p.gold); a.box(g, [.5, .08, .1], [x, .31, .55], p.ink); }
      a.shape(g, [[-.19, .35], [.22, .35], [.35, -.65], [-.25, -.55]], .25, p.gold, [0, 0, .48]);
      curve(a, g, [[-.65, -1.04, .53], [0, -1.2, .53], [.65, -1.04, .53]], .045, s < 0 ? p.vermilion : p.paper);
      rod(a, r, [0, 6.5, -1], [s * 2.25, 6.5, -.6 + s * .3], .07, p.gold);
    }
    const ring = hoop(a, r, [0, 1.25, -1], 3.8, p.gold, .08); ring.rotation.x = Math.PI / 2; ring.scale.y = .55;
    for (const s of [-1, 1]) a.shape(r, [[0, 0], [s * .8, .4], [s * .2, .8]], .12, p.vermilion, [s * 3.6, 1.24, -1]);
    a.cylinder(r, 1.6, .4, [0, .95, -1], p.paper);
  },
  '2026-03-08': (a, r) => {
    const p = a.palette, nib = group(r, [-.8, 1.2, -.5]); nib.rotation.z = -.32;
    a.shape(nib, [[0, 0], [-2.1, 4.2], [-1.25, 6.1], [1.25, 6.1], [2.1, 4.2]], .35, p.gold);
    a.shape(nib, [[-.09, .7], [-.08, 4.1], [-.35, 4.6], [0, 4.95], [.35, 4.6], [.08, 4.1], [.09, .7]], .03, p.forest, [0, 0, .37]);
    for (const s of [-1, 1]) { curve(a, nib, [[s * .4, 1.55, .39], [s * 1.55, 4.1, .39], [s * .8, 5.5, .39]], .04, p.paper); for (let i = 0; i < 4; i++) rod(a, nib, [s * .65, 4.5 + i * .3, .4], [s * 1.3, 4.6 + i * .3, .4], .024, p.paper); }
    a.box(nib, [2.5, 1, .7], [0, 6.4, -.1], p.forest); a.box(nib, [2.7, .17, .75], [0, 5.93, -.1], p.gold);
    for (let i = 0; i < 5; i++) a.box(r, [8 - i * .1, .08, 3.7], [0, .85 + i * .1, .1], p.paper);
    curve(a, r, [[-3.6, 1.31, 1.25], [-1.2, 1.32, .9], [.8, 1.31, 1.5], [4.1, 1.31, 1]], .06, p.forest);
    a.cylinder(r, .6, .72, [-4.6, 1.2, -1.1], p.ink); a.cylinder(r, .52, .08, [-4.6, 1.6, -1.1], p.gold);
  },
  '2026-03-09': (a, r) => {
    const p = a.palette;
    for (const x of [-3.5, 3.5]) { a.box(r, [1.5, 4.2, 4.7], [x, 2.95, -1], p.limestone); for (let j = 0; j < 6; j++) a.box(r, [1.55, .045, 4.75], [x, 1.25 + j * .64, -1], p.paper); }
    a.box(r, [5.5, .08, 5.2], [0, 1, -.8], p.water);
    for (const s of [-1, 1]) {
      const g = group(r, [s * 2.7, 1.15, .3]); g.rotation.y = s * .18;
      for (let j = 0; j < 8; j++) a.box(g, [2.65, .38, .2], [-s * 1.28, .3 + j * .41, 0], p.forest);
      rod(a, g, [0, .1, .15], [-s * 2.5, 3.3, .15], .08, p.gold);
      a.cylinder(r, .09, 5.5, [s * 3.5, 3.6, -.9], p.gold);
      hoop(a, r, [s * 3.5, 6.35, -.9], .63, p.gold, .09); for (let i = 0; i < 4; i++) { const t = i * Math.PI / 2; rod(a, r, [s * 3.5, 6.35, -.9], [s * 3.5 + Math.cos(t) * .61, 6.35 + Math.sin(t) * .61, -.9], .05, p.gold); }
    }
    for (let i = 0; i < 5; i++) a.box(r, [5.4, .07, .05], [0, 1.08, -3 + i * .8], p.ice);
  },
  '2026-03-10': (a, r) => {
    const p = a.palette;
    for (const s of [-1, 1]) {
      const x = s * 2.7, h = s < 0 ? 5.6 : 4.4, y = .95 + h / 2;
      for (const v of [-1, 1]) { a.cylinder(r, 1.8, .22, [x, y + v * h / 2, -.8], p.forest); const cone = a.mesh(r, new T.ConeGeometry(1.4, h / 2 - .2, 24, 1, true), p.ice, [x, y + v * h / 4, -.8]); cone.rotation.z = v > 0 ? Math.PI : 0; }
      for (let j = 0; j < 4; j++) { const t = Math.PI / 4 + j * Math.PI / 2; rod(a, r, [x + Math.cos(t) * 1.65, .95, -.8 + Math.sin(t) * 1.65], [x + Math.cos(t) * 1.65, .95 + h, -.8 + Math.sin(t) * 1.65], .09, p.gold); }
      a.mesh(r, new T.ConeGeometry(1.25, 1.45, 24), p.gold, [x, 1.8, -.8]); rod(a, r, [x, 1.5, -.8], [x, y + 1, -.8], .035, p.gold);
      a.cylinder(r, .24, .18, [x, y, -.8], p.vermilion);
    }
    curve(a, r, [[-1.1, 1, 1.2], [0, 1.4, 1.4], [1.1, 1, 1.2]], .065, p.gold);
    for (let i = 0; i < 5; i++) a.box(r, [.6, .11, .45], [i * .8 - 1.6, .91, 2.1], i === 2 ? p.vermilion : p.paper);
  },
  '2026-03-11': (a, r) => {
    const p = a.palette;
    // A local messenger rises from an envelope, individual feathers folded into its wings.
    a.shape(r, [[-4, 0], [4, 0], [4, 2.4], [-4, 2.4]], .3, p.paper, [0, .9, -.5]);
    a.shape(r, [[-4, 2.4], [0, .3], [4, 2.4]], .1, p.limestone, [0, .9, -.16]);
    curve(a, r, [[-4, .95, -.11], [0, 3.15, -.11], [4, .95, -.11]], .04, p.gold);
    orb(a, r, [0, 4.35, -.5], 1, p.jade, [.6, 1.4, .75]); orb(a, r, [.3, 5.7, -.4], .6, p.paper);
    a.shape(r, [[0, 0], [.75, -.12], [0, -.4]], .27, p.gold, [.7, 5.75, -.3]);
    orb(a, r, [.59, 5.78, .08], .06, p.ink);
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const g = a.shape(r, [[0, 0], [s * (3.9 - i * .24), 2.3 - i * .2], [s * (4.6 - i * .25), 2.45 - i * .31], [s * .7, -.42]], .09, i % 2 ? p.paper : p.jade, [s * .3, 4.6 - i * .08, -.6 + i * .09]); g.rotation.y = s * .08;
    }
    for (const s of [-1, 1]) rod(a, r, [s * .2, 3.5, -.5], [s * .55, 3.2, -.25], .055, p.gold);
    for (let i = 0; i < 4; i++) a.box(r, [.07, .07, .7], [-5.7 + i * .38, 2.3 + i * .65, -.4], p.gold);
  },
  '2026-03-12': (a, r) => {
    const p = a.palette;
    foot(a, r, [0, .86, -1], 3.6, 3); a.cylinder(r, .23, 5.6, [0, 3.8, -1], p.forest, .14);
    a.shape(r, [[-.7, 0], [.7, 0], [0, 1]], .4, p.gold, [0, 5.95, -1.2]);
    rod(a, r, [-5, 6.75, -.9], [5, 5.65, -.9], .16, p.gold); orb(a, r, [0, 6.2, -.85], .3, p.vermilion);
    for (const s of [-1, 1]) {
      const x = s * 4.4, y = s < 0 ? 3.65 : 2.7;
      for (const z of [-1.9, .1]) rod(a, r, [x, 6.2 - s * .5, -.9], [x + s * .9, y, z], .03, p.gold);
      a.cylinder(r, 1.65, .18, [x + s * .6, y, -.9], p.paper).scale.z = .72;
      const lip = hoop(a, r, [x + s * .6, y + .11, -.9], 1.65, p.gold, .06); lip.rotation.x = Math.PI / 2; lip.scale.y = .72;
      for (let i = 0; i < 3; i++) { const h = .65 + (s < 0 ? i * .3 : (2 - i) * .4); a.cylinder(r, .25, h, [x + s * .6 + (i - 1) * .6, y + h / 2 + .15, -.9], i === 1 ? p.vermilion : p.jade); }
    }
    for (let i = 0; i < 9; i++) a.box(r, [.04, .15 + (i % 2) * .08, .08], [-.8 + i * .2, 4.5, -.72], p.gold);
  },
  '2026-03-13': (a, r) => {
    const p = a.palette;
    const base = group(r, [0, .95, -1.5]);
    a.shape(base, [[-4.5, 0], [4.5, 0], [3.5, 5.8], [-3.5, 5.8]], .5, p.forest);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      const x = (col - 1) * 2.25, y = 1 + row * 1.23, g = panel(a, base, [x, y, .65 + (3 - row) * .1], 1.65, .95, row === 0 && col === 2 ? p.vermilion : p.paper);
      const count = row === 0 ? col + 1 : (3 - row) * 3 + col + 1;
      for (let j = 0; j < count; j++) orb(a, g, [(j % 3 - 1) * .23, .19 - Math.floor(j / 3) * .2, .13], .045, p.gold);
    }
    for (let i = 0; i < 5; i++) a.box(r, [9 - i * .35, .2, .6], [0, .9 + i * .2, 2.1 - i * .48], p.limestone);
    for (const s of [-1, 1]) { rod(a, r, [s * 4.3, .85, -1.5], [s * 3.4, 6.4, -1.5], .08, p.gold); foot(a, r, [s * 3.4, .85, -2], 1.4, 2); }
  },
  '2026-03-14': (a, r) => {
    const p = a.palette;
    // Bell-curve sections create a hollow seashell with golden ribs.
    for (let rib = 0; rib < 13; rib++) {
      const z = -3.8 + rib * .35, scale = .6 + Math.sin(rib / 12 * Math.PI) * .4;
      const top: [number, number][] = [], bottom: [number, number][] = [];
      for (let j = 0; j <= 40; j++) { const x = (j / 40 - .5) * 11; const y = .55 + 5.3 * Math.exp(-x * x / 6.4); top.push([x * scale, y * scale]); bottom.unshift([x * scale, Math.max(.2, (y - .24) * scale)]); }
      a.shape(r, [...top, ...bottom], .13, rib % 3 ? p.paper : p.jade, [0, .8, z]);
      curve(a, r, top.filter((_, j) => j % 4 === 0).map(([x, y]) => [x, y + .8, z + .14]), .025, p.gold);
    }
    const pearl = orb(a, r, [.5, 1.65, .65], .7, p.gold); pearl.scale.set(1, .8, 1);
    a.cylinder(r, .9, .13, [.5, 1, .65], p.paper);
    for (let i = 0; i < 9; i++) a.box(r, [.04, .08, .22 + (i % 2) * .14], [-4 + i, .89, 1.7], p.gold);
  },
  '2026-03-15': (a, r) => {
    const p = a.palette;
    for (const s of [-1, 1]) {
      foot(a, r, [s * 4.2, .86, -1], 3, 3); a.box(r, [2.3, .5, 2.3], [s * 4.2, 1.35, -1], s < 0 ? p.jade : p.paper);
      const g = group(r, [s * 3.5, 2.3, -.3]); g.rotation.z = s * .55;
      a.shape(g, [[-.38, 0], [.38, 0], [.28, 5.1], [0, 6.2], [-.28, 5.1]], .16, p.paper, [0, 0, .1]);
      a.shape(g, [[-.38, 0], [0, 0], [0, 6.2], [-.28, 5.1]], .018, p.limestone, [0, 0, .272]);
      rod(a, g, [0, .2, .31], [0, 5.6, .31], .04, p.gold);
      for (const edge of [-1, 1]) rod(a, g, [edge * .34, .25, .29], [edge * .26, 5.08, .29], .022, p.gold);
      const guard = hoop(a, g, [0, 0, .1], .8, p.gold, .095); guard.scale.y = .6;
      a.cylinder(g, .14, 1.1, [0, -.65, .1], p.forest); for (let j = 0; j < 6; j++) { const h = hoop(a, g, [0, -.3 - j * .14, .1], .15, p.gold, .022); h.rotation.x = Math.PI / 2; }
      orb(a, g, [0, -1.3, .1], .25, p.vermilion);
    }
    for (let i = 0; i < 11; i++) a.box(r, [.3, .07, 1.3], [-5 + i, .88, 1.8], i === 5 ? p.vermilion : p.gold);
    curve(a, r, [[-5.3, 2, -2.5], [0, 2.8, -3.1], [5.3, 2, -2.5]], .045, p.gold);
  },
  '2026-03-16': (a, r) => {
    const p = a.palette;
    // A split victory arch opens into curling paper streamers.
    for (const s of [-1, 1]) {
      a.box(r, [1.4, 4.9, 1.8], [s * 4.1, 3.4, -1.2], p.paper); foot(a, r, [s * 4.1, .86, -1.2], 2.2, 2.6);
      for (let i = 0; i < 3; i++) arch(a, r, [0, 5.65 + i * .09, -1.8 + i * .35], 4.75 - i * .18, .25, i === 1 ? p.gold : p.jade, s < 0 ? Math.PI / 2 + .13 : 0, s < 0 ? Math.PI : Math.PI / 2 - .13);
      for (let i = 0; i < 4; i++) a.box(r, [1.45, .06, 1.85], [s * 4.1, 1.5 + i * 1.05, -1.2], p.gold);
    }
    for (let i = 0; i < 6; i++) { const x = -3 + i * 1.15; curve(a, r, [[x, 7.7 - Math.abs(i - 2.5) * .5, -.6], [x + .5, 6.5, -.3], [x - .35, 5.2, .2], [x + .65, 4, .4]], .045, i % 2 ? p.gold : p.vermilion); }
    for (let i = 0; i < 36; i++) { const q = a.box(r, [.15, .22, .03], [Math.sin(i * 2.1) * 4.4, 2.3 + (i % 13) * .45, Math.cos(i * 1.7) * 1.6], [p.gold, p.vermilion, p.paper][i % 3]); q.rotation.z = i * .7; }
    for (let i = 0; i < 3; i++) a.box(r, [5.4 - i * .6, .15, 2.6 - i * .4], [0, .85 + i * .15, 0], p.paper);
  },
  '2026-03-17': (a, r) => {
    const p = a.palette;
    const balloon = group(r, [0, 6, -1]);
    orb(a, balloon, [0, 0, 0], 2.6, p.paper, [1, 1.2, .9]);
    for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; curve(a, balloon, [[Math.cos(t) * .8, -2.5, Math.sin(t) * .7], [Math.cos(t) * 2.55, -.2, Math.sin(t) * 2.3], [Math.cos(t) * 1.8, 2.1, Math.sin(t) * 1.6], [0, 3.12, 0]], .045, i % 3 ? p.gold : p.jade); }
    a.cylinder(r, .7, .23, [0, 3.6, -1], p.gold);
    for (const x of [-1.1, 1.1]) for (const z of [-1.8, -.2]) rod(a, r, [x * .5, 3.65, -1 + (z + 1) * .5], [x, 1.9, z], .035, p.gold);
    a.box(r, [2.5, 1, 1.9], [0, 1.45, -1], p.jade);
    for (let i = 0; i < 7; i++) a.box(r, [.1, .86, .05], [-1.1 + i * .36, 1.45, -.01], p.gold);
    for (const x of [-.7, .65]) { orb(a, r, [x, 2.1, -.75], .25, p.paper); a.mesh(r, new T.ConeGeometry(.4, .7, 10), p.forest, [x, 1.63, -.75]); }
    for (let i = 0; i < 5; i++) orb(a, r, [4.2 + Math.sin(i * 1.7), 2.1 + Math.cos(i * 2) * .3, -1.5 + i * .3], .55, p.paper, [1.3, .65, 1]);
  },
  '2026-03-18': (a, r) => {
    const p = a.palette;
    for (const s of [-1, 1]) { a.shape(r, [[-.8, 0], [.8, 0], [.45, 4.8], [-.45, 4.8]], .8, p.paper, [s * 4.1, .85, -1.4]); a.box(r, [2, .18, 1.5], [s * 4.1, 5.7, -.95], p.gold); }
    const wire = curve(a, r, [[-4.1, 5.85, -.9], [0, 5.45, -.9], [4.1, 5.85, -.9]], .055, p.vermilion); wire.name = 'threshold';
    for (const s of [-1, 1]) a.shape(r, [[0, 0], [s * .85, -.15], [s * .4, -2.2], [-s * .4, -2.1]], .07, p.jade, [s * .55, 5.5, -.8]);
    a.medal(r, 0, 3.5, -.45, 1.4); bolts(a, r, [0, 3.5, -.2], 1.3, 16);
    for (let i = 0; i < 7; i++) { const h = .15 + i * .18; a.box(r, [1.05, h, 2], [-3.9 + i * 1.3, .84 + h / 2, .6], i === 6 ? p.jade : p.limestone); a.box(r, [.7, .03, .035], [-3.9 + i * 1.3, .86 + h, 1.15], p.gold); }
  },
  '2026-03-19': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 4; i++) { const h = [2.2, 3.4, 2.8, 4.1][i]; a.box(r, [1.35, h, 1.8], [-4.6 + i * 1.65, .9 + h / 2, -.4], p.paper); for (let j = 0; j < Math.floor(h / .5); j++) a.box(r, [1.4, .035, 1.85], [-4.6 + i * 1.65, 1.2 + j * .5, -.4], p.gold); }
    for (const z of [-2.6, -.9]) rod(a, r, [4.5, .85, z], [4.5, 7.1, z], .15, p.forest);
    rod(a, r, [2, 7.1, -1.75], [6.2, 7.1, -1.75], .17, p.gold);
    hoop(a, r, [3, 6.85, -1.3], .55, p.gold, .09); rod(a, r, [3, 6.4, -1.3], [3, 4.8, -1.3], .035, p.gold);
    a.box(r, [1.35, 2.7, 1.8], [3, 3.5, -.45], p.jade); for (const x of [2.3, 3.7]) rod(a, r, [x, 4.9, -.45], [3, 5.6, -.45], .035, p.gold);
    rod(a, r, [4.5, 3.1, -.65], [6.4, 2.8, .1], .09, p.gold); orb(a, r, [6.4, 2.8, .1], .27, p.vermilion);
    foot(a, r, [4.5, .85, -1.75], 3, 3);
    for (let i = 0; i < 8; i++) a.box(r, [.06, .025, .3], [2.6 + i * .22, .88, 1.1], p.gold);
  },
  '2026-03-20': (a, r) => {
    const p = a.palette;
    a.shape(r, [[-5, 0], [5, 0], [5, 1.4], [1, 7], [-1, 7], [-5, 1.4]], .45, p.forest, [0, .9, -1.2]);
    a.shape(r, [[-4.65, .4], [4.65, .4], [4.65, 1.4], [.8, 6.7], [-.8, 6.7], [-4.65, 1.4]], .1, p.paper, [0, .9, -.69]);
    for (let row = 0; row < 8; row++) for (let j = 0; j <= row; j++) disk(a, r, [(j - row / 2) * .88, 7 - row * .65, -.43], .09, .18, p.gold);
    for (let i = 0; i < 9; i++) { const h = .25 + 1.6 * Math.exp(-Math.pow(i - 4, 2) / 4.8); a.box(r, [.12, 1.4, .7], [-4 + i, 1.7, -.1], p.gold); for (let j = 0; j < Math.round(h / .18); j++) orb(a, r, [-3.52 + i, 1.15 + j * .16, -.07], .11, j % 4 ? p.jade : p.vermilion); }
    const path: Point[] = [[0, 7.7, -.37], [.44, 6.4, -.37], [0, 5.75, -.37], [-.44, 5.1, -.37], [0, 4.45, -.37], [.44, 3.8, -.37]]; curve(a, r, path, .035, p.vermilion);
    for (const x of [-4.5, 4.5]) foot(a, r, [x, .85, -1], 1.6, 2.8);
  },
  '2026-03-21': (a, r) => {
    const p = a.palette;
    // Contour ribs follow a violin waist: distribution becomes a resonant instrument.
    for (let layer = 0; layer < 9; layer++) {
      const s = 1 - layer * .055, points: [number, number][] = [];
      for (let j = 0; j < 64; j++) { const t = j / 64 * Math.PI * 2, waist = .62 + .38 * Math.abs(Math.sin(t)); points.push([Math.cos(t) * 3.6 * waist * s, Math.sin(t) * 3.1 * s]); }
      a.shape(r, points, .13, layer % 3 ? p.paper : p.jade, [-1, 4, -1.4 + layer * .14]);
    }
    a.box(r, [.8, 3, .4], [-1, 7.6, -.5], p.forest); a.box(r, [1.25, .85, .65], [-1, 9.15, -.5], p.gold);
    for (const x of [-1.28, -.72]) rod(a, r, [x, 1.5, -.04], [x, 9.25, -.04], .019, p.gold);
    a.box(r, [1.3, .3, .45], [-1, 3.3, -.1], p.gold);
    for (const s of [-1, 1]) curve(a, r, [[-1 + s * 1.1, 2.5, -.1], [-1 + s * 1.5, 3.2, -.1], [-1 + s * .9, 4.7, -.1], [-1 + s * 1.3, 5.5, -.1]], .065, p.forest);
    rod(a, r, [3.6, 1.1, .5], [5.7, 7.6, -.2], .1, p.forest); rod(a, r, [3.82, 1.1, .52], [5.93, 7.6, -.18], .027, p.gold);
    foot(a, r, [-1, .85, -.8], 4.4, 2.7);
  },
  '2026-03-22': (a, r) => {
    const p = a.palette;
    const heights = [.8, 1.1, 1.6, 2.5, 3.7, 4.8, 5.5, 5.9, 6.05];
    for (let i = 0; i < heights.length; i++) {
      const x = -5.6 + i * 1.4, h = heights[i];
      a.box(r, [1.32, h, 2.2], [x, .85 + h / 2, -1], i % 3 === 0 ? p.jade : p.paper);
      a.box(r, [1.36, .08, 2.3], [x, .9 + h, -1], p.gold);
      for (let j = 0; j < Math.floor(h / .6); j++) a.box(r, [1.3, .025, .025], [x, 1.2 + j * .6, .12], p.limestone);
    }
    const pts = heights.map((h, i): Point => [-5.6 + i * 1.4, h + 1.2, .3]); curve(a, r, pts, .075, p.vermilion);
    for (const i of [2, 5, 7]) { const x = -5.6 + i * 1.4; const g = panel(a, r, [x - .3, heights[i] + 2.3, -.1], 1.55, 1, p.paper); a.shape(g, [[-.3, -.5], [.2, -.5], [.1, -.85]], .1, p.gold); for (let j = 0; j < 2; j++) a.box(g, [1 - j * .25, .035, .04], [0, .2 - j * .28, .13], p.forest); }
  },
  '2026-03-23': (a, r) => {
    const p = a.palette, g = group(r, [0, 4.5, -.9]);
    // Three swept architectural wings interlock around a single shared core.
    for (let i = 0; i < 3; i++) {
      const wing = group(g); wing.rotation.z = i * Math.PI * 2 / 3;
      a.shape(wing, [[.6, -.4], [1.5, -.8], [4.8, .2], [4.4, 1.5], [2.4, 2.5], [.8, 2.1], [2.6, 1.4], [3.6, .8], [1.3, .3]], .75, [p.paper, p.jade, p.limestone][i]);
      curve(a, wing, [[1, -.05, .8], [3.7, .4, .8], [4, 1.15, .8], [2.5, 2, .8]], .05, p.gold);
      for (let j = 0; j < 5; j++) { const rib = a.box(wing, [.06, .68, .82], [1.8 + j * .43, .01 + j * .16, .38], p.gold); rib.rotation.z = -.5; }
    }
    a.mesh(g, new T.IcosahedronGeometry(.9, 0), p.vermilion, [0, 0, .3]);
    for (const s of [-1, 1]) rod(a, r, [s * 2.8, .9, -1.3], [s * 1.6, 2.5, -1.3], .17, p.forest);
    foot(a, r, [0, .84, -1], 7, 3.4);
    for (let i = 0; i < 3; i++) a.box(r, [1.2, .17, .9], [-1.7 + i * 1.7, 1.25, 1.15], [p.paper, p.jade, p.limestone][i]);
  },
  '2026-03-24': (a, r) => {
    const p = a.palette;
    // The tiny new backend is represented by a phoenix, cut feather by feather.
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * .66, h = [2.6, 3.3, 4.4, 6.1, 7.9, 6.3, 5.1, 3.6, 2.2][i];
      a.shape(r, [[-.55, 0], [-.72, h * .35], [x * .14, h], [.7, h * .62], [.55, 0]], .14, i % 3 === 0 ? p.vermilion : i % 2 ? p.gold : p.paper, [x, .95, -1.6 + i * .12]);
      curve(a, r, [[x, 1.1, -.3 + i * .02], [x - .2, 1 + h * .45, -.3 + i * .02], [x + x * .1, .95 + h * .85, -.3 + i * .02]], .025, p.gold);
    }
    orb(a, r, [.9, 6.55, -.15], .35, p.paper); a.shape(r, [[0, .2], [.75, -.05], [0, -.16]], .16, p.gold, [1.14, 6.45, -.13]); orb(a, r, [1.08, 6.61, .08], .055, p.ink);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) a.shape(r, [[0, 0], [s * (3.3 + i * .25), 2 - i * .2], [s * (2.8 + i * .25), 1.1 - i * .27]], .06, p.paper, [s * .4, 3.6 - i * .12, -.2 + i * .07]);
    for (let i = 0; i < 5; i++) a.box(r, [5.6 - i * .65, .16, 3.2 - i * .3], [0, .85 + i * .16, -.5], i % 2 ? p.limestone : p.paper);
  },
  '2026-03-25': (a, r) => {
    const p = a.palette;
    // Three independent recon pages pass through one shared transmission.
    for (let i = 0; i < 3; i++) {
      const x = -4.1 + i * 4.1, y = 3.6 + (i === 1 ? 1.1 : 0);
      for (const h of [y - 1.5, y + 1.5]) { const roll = a.cylinder(r, .45, 2.7, [x, h, -1], p.paper); roll.rotation.z = Math.PI / 2; for (const s of [-1, 1]) { const cap = disk(a, r, [x + s * 1.42, h, -1], .5, .13, p.gold); cap.rotation.y = Math.PI / 2; } }
      a.box(r, [2.2, 2.9, .08], [x, y, -.5], p.paper);
      for (let j = 0; j < 5; j++) { a.box(r, [1.6 - (j % 3) * .22, .045, .06], [x, y + 1 - j * .45, -.41], p.forest); a.box(r, [.13, .14, .06], [x - .87, y + 1 - j * .45, -.4], p.gold); }
      for (const s of [-1, 1]) rod(a, r, [x + s * 1.5, .9, -1.3], [x + s * 1.5, y + 1.5, -1.3], .07, p.forest);
      foot(a, r, [x, .86, -.8], 3.4, 2);
    }
    curve(a, r, [[-5.6, 1.6, .65], [-2, 1.7, .65], [0, 2.3, .65], [2, 1.7, .65], [5.6, 1.6, .65]], .09, p.gold);
    for (const x of [-3, 0, 3]) disk(a, r, [x, 1.8, .67], .32, .16, p.vermilion);
  },
  '2026-03-26': (a, r) => {
    const p = a.palette;
    // The unequal hanging intervals surround a tilted annulus, rather than lining up on a beam.
    const rim: Point[] = [], inner: Point[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48 * Math.PI * 2;
      rim.push([Math.cos(t) * 4.35, 7.45 + Math.sin(t) * .5, -1.2 + Math.sin(t) * 2.2]);
      inner.push([Math.cos(t) * 4.1, 7.36 + Math.sin(t) * .5, -1.2 + Math.sin(t) * 2.05]);
    }
    curve(a, r, rim, .15, p.jade); curve(a, r, inner, .05, p.gold);
    rod(a, r, [0, 1.13, -1.2], [0, 9.15, -1.2], .14, p.forest);
    orb(a, r, [0, 9.28, -1.2], .26, p.vermilion);
    for (let i = 0; i < 8; i++) {
      const t = i / 8 * Math.PI * 2, x = Math.cos(t) * 4.35, z = -1.2 + Math.sin(t) * 2.2, y = 7.45 + Math.sin(t) * .5;
      rod(a, r, [0, 9.05, -1.2], [x, y, z], .035, p.gold);
      orb(a, r, [x, y, z], .13, p.gold);
    }
    const heights = [3.4, 4.8, 3.9, 3, 4.3];
    for (let i = 0; i < 5; i++) {
      const t = .28 + i / 5 * Math.PI * 2, x = Math.cos(t) * 4.15, z = -1.2 + Math.sin(t) * 2.08, h = heights[i];
      rod(a, r, [x, 7.4 + Math.sin(t) * .5, z], [x, h + 1.13, z], .03, p.gold);
      const lantern = group(r, [x, h, z]); a.cylinder(lantern, .61, 1.85, [0, 0, 0], i === 2 ? p.vermilion : p.paper, .53);
      for (const y of [-.95, .95]) { const band = hoop(a, lantern, [0, y, 0], .63, p.gold); band.rotation.x = Math.PI / 2; }
      for (let j = 0; j < 8; j++) { const angle = j * Math.PI / 4; rod(a, lantern, [Math.cos(angle) * .6, -.92, Math.sin(angle) * .6], [Math.cos(angle) * .54, .92, Math.sin(angle) * .54], .025, p.gold); }
      for (let j = 0; j <= i; j++) a.box(lantern, [.13, .13, .06], [-.3 + j * .15, -.1, .63], p.jade);
      rod(a, lantern, [0, -.96, 0], [0, -1.35, 0], .025, p.gold);
      a.shape(lantern, [[-.28, 0], [.28, 0], [.2, -.58], [0, -.72], [-.2, -.58]], .055, p.jade, [0, -1.3, 0]);
    }
    for (let i = 0; i < 3; i++) {
      const t = i / 3 * Math.PI * 2, x = Math.cos(t) * 2, z = -1.2 + Math.sin(t) * 1.3;
      foot(a, r, [x, .84, z], 1.3, 1.2); rod(a, r, [x, 1.05, z], [0, 3, -1.2], .1, p.forest);
    }
    const collar = hoop(a, r, [0, 2.88, -1.2], .35, p.gold, .095); collar.rotation.x = Math.PI / 2;
  },
  '2026-03-27': (a, r) => {
    const p = a.palette;
    // Links become a delicate trussed footbridge, each bay carrying its own pennant.
    for (let i = 0; i < 15; i++) { const x = -6.1 + i * .87, y = 1.25 + Math.sin(i / 14 * Math.PI) * .9; a.box(r, [.85, .14, 2.3], [x, y, -.6], p.paper); if (i % 2 === 0) for (const z of [-1.7, .5]) { rod(a, r, [x, y, z], [x, y + 1.2, z], .04, p.gold); rod(a, r, [x, y, z], [x + 1.74, y + 1.2, z], .035, p.gold); } }
    for (const z of [-1.7, .5]) curve(a, r, [[-6.1, 2.45, z], [-3, 3.15, z], [0, 3.35, z], [3, 3.15, z], [6.1, 2.45, z]], .055, p.gold);
    for (let i = 0; i < 7; i++) { const x = -5.4 + i * 1.8, y = 4.5 + Math.sin(i / 6 * Math.PI) * .8; rod(a, r, [x, 2, -1.7], [x, y, -1.7], .035, p.gold); a.shape(r, [[0, 0], [.95, -.1], [.7, -.55], [.95, -.9], [0, -.8]], .045, [p.jade, p.paper, p.vermilion][i % 3], [x, y, -1.7]); }
    for (const x of [-6.1, 0, 6.1]) a.box(r, [.6, 1.2, 2.1], [x, .92, -.6], p.limestone);
  },
  '2026-03-28': (a, r) => {
    const p = a.palette;
    // A field triangulation frame holds a suspended plummet over an inlaid bearing.
    const peaks: Point[] = [[-5.2, .9, 1], [5.2, .9, 1], [0, 7.9, -1.8]];
    for (let i = 0; i < 3; i++) { rod(a, r, peaks[i], peaks[(i + 1) % 3], .16, p.paper); rod(a, r, [peaks[i][0], peaks[i][1], peaks[i][2] + .2], [peaks[(i + 1) % 3][0], peaks[(i + 1) % 3][1], peaks[(i + 1) % 3][2] + .2], .035, p.gold); }
    rod(a, r, [0, 7.7, -1.65], [0, 2, -.2], .025, p.gold); a.mesh(r, new T.ConeGeometry(.4, .9, 8), p.gold, [0, 1.75, -.15]).rotation.z = Math.PI;
    for (let i = 0; i < 13; i++) a.box(r, [.06, .2 + (i % 3 === 0 ? .15 : 0), .1], [-4.8 + i * .8, 1, 1.2], p.gold);
    for (const s of [-1, 1]) { foot(a, r, [s * 5.2, .86, 1], 1.7, 1.8); rod(a, r, [s * 5.2, .9, 1], [s * 2, .85, -3.3], .08, p.forest); }
    arch(a, r, [0, 7.6, -1.2], 2.3, .18, p.jade, Math.PI * 1.18, Math.PI * 1.82); ticks(a, r, [0, 7.6, -.95], 2.23, 27, Math.PI * 1.18, Math.PI * .64);
  },
  '2026-03-29': (a, r) => {
    const p = a.palette;
    const lens = group(r, [-.8, 4.2, -.8]); lens.rotation.y = -.18;
    disk(a, lens, [0, 0, 0], 3.05, .65, p.ice); hoop(a, lens, [0, 0, .4], 3.14, p.gold, .13); hoop(a, lens, [0, 0, -.4], 3.14, p.forest, .2); bolts(a, lens, [0, 0, .55], 3.13, 20);
    for (let i = 0; i < 7; i++) { const x = -2.1 + i * .7; const h = Math.sqrt(8 - x * x); rod(a, lens, [x, -h, .36], [x, h, .36], .013, p.paper); rod(a, lens, [-h, x, .36], [h, x, .36], .013, p.paper); }
    a.shape(lens, [[-1.9, 1.9], [-.8, 2.4], [2.4, -.7], [1.95, -1.9]], .018, p.paper, [0, 0, .4]);
    for (const s of [-1, 1]) { rod(a, r, [-.8 + s * 2.7, 1.1, -.9], [-.8 + s * 2.7, 4.2, -.9], .15, p.forest); disk(a, r, [-.8 + s * 3.3, 4.2, -.9], .3, .22, p.gold); }
    foot(a, r, [-.8, .86, -.7], 7.2, 2.8);
    const polishing = a.cylinder(r, .9, .4, [5.2, 1.2, -.5], p.jade); polishing.rotation.z = -.2; rod(a, r, [5.2, 1.4, -.5], [6.1, 3.1, -.5], .1, p.gold);
  },
  '2026-03-30': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 9; i++) {
      const t = Math.PI * .15 + i / 8 * Math.PI * .7, radius = 5.4;
      const g = group(r, [Math.cos(t) * radius, .85, -Math.sin(t) * 2.7]); g.rotation.y = Math.PI / 2 - t;
      const h = 3.1 + Math.sin(t) * 2.7;
      a.box(g, [1.6, h, .24], [0, h / 2, 0], i === 4 ? p.jade : p.paper);
      a.box(g, [.65, .45, .24], [-.4, h + .2, 0], i === 4 ? p.vermilion : p.gold);
      for (let row = 0; row < 6; row++) { a.box(g, [1.2, .025, .05], [0, 1 + row * .55, .17], p.gold); a.box(g, [.15, .18, .05], [-.47, 1.2 + row * .55, .17], p.forest); }
      a.box(g, [1.8, .17, 2], [0, .1, .4], p.limestone);
    }
    for (let i = 0; i < 5; i++) { const h = hoop(a, r, [0, .87 + i * .14, -.9], 4 - i * .4, p.paper, .13); h.rotation.x = Math.PI / 2; h.scale.y = .62; }
    for (const x of [-1.6, 0, 1.6]) a.box(r, [1.2, .25, 1], [x, 1.15, 1.25], p.jade);
  },
  '2026-03-31': (a, r) => {
    const p = a.palette;
    // Date leaves ride one open Archimedes screw instead of a repeated calendar panel.
    rod(a, r, [-4.8, 1.7, -1], [4.8, 6.7, -1], .2, p.forest);
    const axis = new T.Vector3(9.6, 5, 0).normalize(), side = new T.Vector3(-axis.y, axis.x, 0);
    const points: Point[] = [];
    for (let i = 0; i <= 128; i++) { const t = i / 128, phi = t * Math.PI * 8; points.push([-4.8 + t * 9.6 + side.x * Math.cos(phi) * 1.2, 1.7 + t * 5 + side.y * Math.cos(phi) * 1.2, -1 + Math.sin(phi) * 1.2]); }
    curve(a, r, points, .16, p.paper);
    for (let i = 0; i < 12; i++) { const t = (i + .5) / 12, phi = t * Math.PI * 8; const g = panel(a, r, [-4.8 + t * 9.6 + side.x * Math.cos(phi) * 1.2, 1.7 + t * 5 + side.y * Math.cos(phi) * 1.2, -.8 + Math.sin(phi) * 1.2], .9, .67, i === 8 ? p.vermilion : p.jade); g.rotation.z = .45; a.box(g, [.47, .04, .04], [0, 0, .12], p.gold); }
    for (const [x, y] of [[-4.8, 1.7], [4.8, 6.7]]) { rod(a, r, [x, .9, -1], [x, y, -1], .14, p.gold); foot(a, r, [x, .86, -1], 2, 2.7); }
    hoop(a, r, [5.4, 7.1, -.9], .65, p.gold); rod(a, r, [5.4, 7.1, -.9], [6, 7.45, -.9], .06, p.gold);
  },
  '2026-04-01': (a, r) => {
    const p = a.palette;
    const root = group(r, [0, .9, -1]);
    a.box(root, [.65, 6.3, .6], [0, 3.1, 0], p.forest);
    const branches: [number, number, number][] = [[-4.8, 2.1, 1.4], [4.3, 3.1, 2.2], [-3, 4.6, 3.8], [2.7, 5.7, 4.8], [0, 7.1, 6]];
    for (const [x, y, fork] of branches) {
      rod(a, root, [0, fork, 0], [x, y, 0], .15, p.gold);
      a.shape(root, [[-1.35, 0], [1.35, 0], [1.35, 1.45], [.2, 1.45], [-.05, 1.8], [-1.35, 1.8]], .65, p.paper, [x, y, -.3]);
      a.box(root, [2.3, 1.1, .12], [x, y + .65, .42], p.jade);
      for (let j = 0; j < 3; j++) a.box(root, [1.4 - j * .25, .035, .04], [x - .15, y + .9 - j * .25, .51], p.gold);
      orb(a, root, [0, fork, .35], .15, p.vermilion);
    }
    for (const x of [-3.5, -1.7, 1.7, 3.5]) curve(a, root, [[0, .5, 0], [x * .5, .17, .3], [x, -.02, 1.1]], .12, p.forest);
    a.box(root, [8.2, .15, 2.5], [0, -.05, .4], p.limestone);
  },
  '2026-04-02': (a, r) => {
    const p = a.palette;
    for (const lane of [-1, 1]) {
      const z = lane * 1.4 - .9, pts: Point[] = [];
      for (let i = 0; i <= 32; i++) { const x = -6.2 + i / 32 * 12.4, y = .95 + Math.pow(Math.sin(i / 32 * Math.PI), 2) * (lane < 0 ? 2.4 : 1.4); pts.push([x, y, z]); a.box(r, [.39, .14, .82], [x, y, z], lane < 0 ? p.paper : p.jade); }
      for (const side of [-1, 1]) curve(a, r, pts.map(([x, y, zz]) => [x, y + .13, zz + side * .48]), .04, p.gold);
      for (const i of [5, 12, 20, 27]) { const [x, y] = pts[i]; rod(a, r, [x, .9, z], [x, y, z], .09, p.forest); }
      const marker = a.mesh(r, new T.ConeGeometry(.3, .8, 8), p.vermilion, [lane < 0 ? 1.5 : -1.2, lane < 0 ? 4 : 2.9, z]); marker.rotation.z = -Math.PI / 2;
    }
    for (const x of [-6.6, 6.6]) { rod(a, r, [x, .85, -2.8], [x, 4.6, -2.8], .075, p.gold); a.shape(r, [[0, 0], [1, -.1], [.75, -.8], [0, -.65]], .04, p.paper, [x, 4.6, -2.8]); }
    for (let i = 0; i < 6; i++) a.box(r, [.38, .05, 4], [5.3 + i * .25, .96, -.9], i % 2 ? p.paper : p.forest);
  },
  '2026-04-03': (a, r) => {
    const p = a.palette;
    // An open book folds into a small writer's house, its spine becoming the ridge.
    a.box(r, [7, 3.5, 3.7], [0, 2.7, -1], p.paper);
    for (const s of [-1, 1]) for (let layer = 0; layer < 6; layer++) a.shape(r, [[0, 2.2], [s * 4.5, .5], [s * 4.2, 0], [0, 1.65]], 4.6, layer === 5 ? p.jade : p.paper, [0, 4.1 + layer * .07, -3.3 + layer * .035]);
    rod(a, r, [0, 6.7, -3.4], [0, 6.7, 1.35], .1, p.gold);
    panel(a, r, [0, 2.25, .94], 1.8, 2.4, p.forest); arch(a, r, [0, 3.4, 1.07], .9, .12, p.gold);
    for (const x of [-2.3, 2.3]) { const win = panel(a, r, [x, 3.05, .96], 1.2, 1.5, p.gold, p.forest); a.box(win, [.045, 1.4, .1], [0, 0, .15], p.paper); a.box(win, [1.1, .045, .1], [0, 0, .15], p.paper); }
    a.box(r, [.55, 1.5, .6], [2.3, 5.8, -1.6], p.limestone); for (let i = 0; i < 3; i++) a.box(r, [.6, .045, .65], [2.3, 5.3 + i * .5, -1.6], p.paper);
    for (let i = 0; i < 4; i++) a.box(r, [2.6 + i * .3, .15, .35], [0, 1.15 - i * .1, 1.15 + i * .31], p.paper);
  },
  '2026-04-04': (a, r) => {
    const p = a.palette;
    // Field maps are sheltered beneath an offset, hand-stitched expedition canopy.
    a.shape(r, [[-5, 0], [0, 5.8], [.8, 0]], 3.8, p.paper, [0, .9, -3]);
    a.shape(r, [[0, 5.8], [5.3, 0], [.8, 0]], 3.8, p.jade, [0, .9, -3]);
    for (const z of [-3.1, .9]) { rod(a, r, [-5, .9, z], [0, 6.8, z], .065, p.gold); rod(a, r, [0, 6.8, z], [5.3, .9, z], .065, p.gold); }
    a.shape(r, [[-.1, .15], [-2.5, .15], [-.1, 4.9]], .05, p.forest, [0, .92, .91]);
    a.shape(r, [[.2, 4.9], [2.6, .15], [.5, .15]], .07, p.paper, [0, .92, .98]);
    for (let i = 0; i < 12; i++) a.box(r, [.07, .14, .05], [-.2 - i * .37, 6.4 - i * .43, 1.02], p.gold);
    for (const s of [-1, 1]) { rod(a, r, [s * 3, 3.1, -1.8], [s * 6.5, .85, -2.2], .025, p.gold); a.box(r, [.1, .4, .1], [s * 6.5, .95, -2.2], p.forest); }
    const table = a.box(r, [2.9, .1, 1.5], [-1.2, 1.4, .3], p.gold); table.rotation.y = .16;
    for (let i = 0; i < 3; i++) a.box(r, [.65, .035, 1.1], [-2 + i * .75, 1.48, .3], p.paper);
  },
  '2026-04-05': (a, r) => {
    const p = a.palette;
    // An exploded calculator mechanism exposes five unlike precision layers.
    rod(a, r, [-6, 3.3, -.5], [6, 3.3, -.5], .11, p.gold);
    for (let i = 0; i < 5; i++) {
      const x = -4.6 + i * 2.3, radius = [1.9, 2.4, 1.4, 2.7, 1.6][i];
      const g = group(r, [x, 3.3, -.5]); g.rotation.y = Math.PI / 2;
      hoop(a, g, [0, 0, 0], radius, i % 2 ? p.paper : p.jade, .25); hoop(a, g, [0, 0, .2], radius - .15, p.gold);
      const n = [12, 16, 8, 18, 10][i];
      for (let j = 0; j < n; j++) { const t = j / n * Math.PI * 2; const tooth = a.box(g, [.34, .22, .6], [Math.cos(t) * radius, Math.sin(t) * radius, 0], p.gold); tooth.rotation.z = t; if (j % 3 === 0) rod(a, g, [0, 0, 0], [Math.cos(t) * (radius - .2), Math.sin(t) * (radius - .2), 0], .07, p.forest); }
      disk(a, g, [0, 0, 0], .35, .5, p.gold); foot(a, r, [x, .85, -.5], 1.5, 2.5); rod(a, r, [x, 1, -.5], [x, 3.3 - radius, -.5], .08, p.forest);
    }
    for (let i = 0; i < 5; i++) a.box(r, [.9, .2, .7], [-3.9 + i * 1.2, 1.05, 1.6], i === 4 ? p.vermilion : p.paper);
  },
  '2026-04-06': (a, r) => {
    const p = a.palette;
    a.box(r, [4.6, 2.8, 2.7], [-1.4, 3.4, -1.2], p.forest); panel(a, r, [-1.4, 3.4, .2], 4.2, 2.4, p.jade);
    for (const [x, y, radius] of [[-3.1, 6, 1.6], [.35, 5.7, 1.25]]) {
      disk(a, r, [x, y, -.6], radius, .27, p.paper); hoop(a, r, [x, y, -.38], radius * .9, p.gold);
      for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; disk(a, r, [x + Math.cos(t) * radius * .56, y + Math.sin(t) * radius * .56, -.39], radius * .19, .05, p.forest); }
      disk(a, r, [x, y, -.31], .2, .16, p.gold);
    }
    const lens = a.cylinder(r, .72, 2.2, [1.9, 3.65, -1.1], p.gold); lens.rotation.z = Math.PI / 2;
    const front = disk(a, r, [3.05, 3.65, -1.1], .57, .1, p.ice); front.rotation.y = Math.PI / 2;
    for (const x of [-3.1, .3]) rod(a, r, [x, 2.2, -1.1], [x * 1.2, .9, -.9], .15, p.gold);
    a.box(r, [6, .17, 3.5], [-1.3, .85, -1.2], p.paper);
    for (let i = 0; i < 8; i++) { const frame = panel(a, r, [3.1 + i * .4, 2.7 - i * .21, .5], .35, .65, p.paper); frame.rotation.z = -.3; }
  },
  '2026-04-07': (a, r) => {
    const p = a.palette;
    // A single exposed transport gear pulls a perforated film over a toothed cradle.
    const gear = group(r, [-1, 4.1, -.7]); disk(a, gear, [0, 0, 0], 2.8, .55, p.jade); hoop(a, gear, [0, 0, .35], 2.45, p.gold, .09);
    for (let i = 0; i < 24; i++) { const t = i * Math.PI / 12; const tooth = a.box(gear, [.42, .42, .8], [Math.cos(t) * 2.85, Math.sin(t) * 2.85, 0], p.gold); tooth.rotation.z = t; if (i % 4 === 0) { disk(a, gear, [Math.cos(t) * 1.5, Math.sin(t) * 1.5, .3], .43, .08, p.forest); rod(a, gear, [0, 0, .4], [Math.cos(t) * 2.4, Math.sin(t) * 2.4, .4], .055, p.paper); } }
    disk(a, gear, [0, 0, .45], .4, .2, p.vermilion); bolts(a, gear, [0, 0, .59], .28, 8);
    for (let i = 0; i < 15; i++) { const t = i / 14, x = -5.4 + t * 10.8, y = 1.2 + Math.sin(t * Math.PI) * 6; const film = panel(a, r, [x, y, .3], .63, 1.2, p.paper); film.rotation.z = Math.cos(t * Math.PI) * .75; for (const yy of [-.47, .47]) a.box(film, [.14, .12, .07], [0, yy, .15], p.ink); }
    for (const s of [-1, 1]) a.shape(r, [[0, 0], [2, 0], [1.3, 2.4], [.7, 2.4]], .8, p.limestone, [-1 + s * 1.9, .85, -1.5]);
  },
  '2026-04-08': (a, r) => {
    const p = a.palette;
    // Two optically aligned gate layers sit on rails; one missing frame is visibly caught.
    for (let i = 0; i < 2; i++) {
      const z = -2.8 + i * 2.7, x = -.8 + i * 1.8;
      for (const side of [-1, 1]) a.box(r, [.6, 5.8, .6], [x + side * 2.8, 3.8, z], i ? p.jade : p.paper);
      for (const y of [1.1, 6.5]) a.box(r, [6.2, .55, .6], [x, y, z], i ? p.jade : p.paper);
      for (let j = 0; j < 7; j++) for (const side of [-1, 1]) a.box(r, [.17, .32, .08], [x + side * 2.8, 1.7 + j * .65, z + .36], p.gold);
      for (const side of [-1, 1]) rod(a, r, [x + side * 2.2, 1.35, z + .1], [x + side * 2.2, 6.22, z + .1], .045, p.gold);
      const glass = panel(a, r, [x, 3.9, z], 3.8, 2.8, i ? p.ice : p.water, p.gold); glass.rotation.z = i ? .03 : -.03;
    }
    for (const x of [-4.3, 4.3]) a.box(r, [.18, .15, 6], [x, .95, -1.2], p.gold);
    for (let i = 0; i < 4; i++) a.box(r, [9.3, .08, .16], [0, .89, -3.6 + i * 1.6], p.forest);
    const frame = panel(a, r, [5.2, 2.4, .2], 1.4, 1.1, p.paper); frame.rotation.z = -.25; rod(a, r, [4.1, 1.1, -.1], [5.2, 2.4, .2], .045, p.gold);
  },
  '2026-04-09': (a, r) => {
    const p = a.palette;
    // A full nautical quadrant cabinet is distinct from the earlier open sextant.
    a.shape(r, [[-4, 0], [3.6, 0], [3.6, 6.7], [-4, 6.7]], .7, p.jade, [-.5, .9, -1.5]);
    a.shape(r, [[0, 0], [0, 6.1], [6.1, 6.1]], .12, p.paper, [-3.9, 1.2, -.72]);
    arch(a, r, [-3.9, 7.3, -.5], 6.05, .35, p.gold, -Math.PI / 2, 0);
    ticks(a, r, [-3.9, 7.3, -.24], 5.94, 41, -Math.PI / 2, Math.PI / 2);
    rod(a, r, [-3.9, 7.3, -.15], [.9, 3.65, -.15], .1, p.forest); disk(a, r, [-3.9, 7.3, -.05], .27, .17, p.gold);
    rod(a, r, [-3.9, 7.2, .05], [-3.9, 2.1, .05], .025, p.gold); a.mesh(r, new T.ConeGeometry(.3, .6, 8), p.vermilion, [-3.9, 1.85, .05]).rotation.z = Math.PI;
    for (let i = 0; i < 5; i++) panel(a, r, [1.9, 2 + i * .8, -.69], .8, .4, p.paper);
    for (const x of [-3.5, 2.5]) foot(a, r, [x, .85, -1.2], 2.2, 3);
  },
  '2026-04-10': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 3; i++) { const t = i * Math.PI * 2 / 3 + .4; const from: Point = [Math.cos(t) * 2.8, .9, -.9 + Math.sin(t) * 2]; rod(a, r, from, [0, 4.2, -.9], .13, p.forest); rod(a, r, [from[0] * .6, 2.2, -.9 + (from[2] + .9) * .6], [0, 2.9, -.9], .05, p.gold); }
    for (const y of [4.2, 4.5]) { const h = hoop(a, r, [0, y, -.9], 1.5, p.gold, .1); h.rotation.x = Math.PI / 2; }
    a.cylinder(r, 1.35, .2, [0, 4.4, -.9], p.paper);
    for (const x of [-1.1, 1.1]) a.shape(r, [[-.35, 0], [.35, 0], [.5, 1.9], [-.5, 1.9]], .35, p.jade, [x, 4.5, -1.1]);
    const scope = a.cylinder(r, .5, 3.8, [0, 6.25, -.9], p.paper); scope.rotation.x = Math.PI / 2; scope.rotation.z = -.08;
    hoop(a, r, [0, 6.25, 1.04], .53, p.gold, .11); disk(a, r, [0, 6.25, 1.08], .39, .07, p.ice);
    hoop(a, r, [-1.3, 5.8, -.85], .77, p.gold); ticks(a, r, [-1.3, 5.8, -.72], .74, 24);
    for (let i = 0; i < 6; i++) a.box(r, [.45, .16, .65], [4.2, 1 + i * .5, -.2], i % 2 ? p.paper : p.vermilion);
    rod(a, r, [4.2, .9, -.2], [4.2, 4.3, -.2], .04, p.gold);
  },
  '2026-04-11': (a, r) => {
    const p = a.palette;
    // A surveyor's measuring chain uncoils from a low wooden reel.
    for (const z of [-2.1, -.3]) { disk(a, r, [-2.8, 2.5, z], 1.7, .18, p.paper); hoop(a, r, [-2.8, 2.5, z + .13], 1.5, p.gold); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; rod(a, r, [-2.8, 2.5, z + .15], [-2.8 + Math.cos(t) * 1.45, 2.5 + Math.sin(t) * 1.45, z + .15], .045, p.forest); } }
    for (let i = 0; i < 11; i++) hoop(a, r, [-2.8, 2.5, -2 + i * .16], 1.14, p.gold, .1);
    const path: Point[] = [[-2.8, 1.3, -.1], [-1, 1, 1.3], [1, 1, .2], [3.2, 1.05, 1.7], [5.5, 1.1, .8], [6.2, 2.1, -.4]];
    const spline = new T.CatmullRomCurve3(path.map(v => new T.Vector3(...v)));
    for (let i = 0; i < 34; i++) { const v = spline.getPoint(i / 33), tangent = spline.getTangent(i / 33); const link = hoop(a, r, [v.x, v.y, v.z], .18, p.gold, .04); link.rotation.x = i % 2 ? Math.PI / 2 : 0; link.rotation.z = Math.atan2(tangent.y, tangent.x); link.scale.x = 1.55; }
    for (const z of [-2.1, -.3]) { rod(a, r, [-4.3, .85, z], [-2.8, 2.5, z], .08, p.forest); rod(a, r, [-1.3, .85, z], [-2.8, 2.5, z], .08, p.forest); }
    rod(a, r, [6.2, .9, -.4], [6.2, 4.9, -.4], .06, p.vermilion); for (let i = 0; i < 7; i++) a.box(r, [.23, .22, .12], [6.2, 1.3 + i * .5, -.4], p.paper);
  },
  '2026-04-12': (a, r) => {
    const p = a.palette;
    // An open beacon, guy wires and an eccentric stone cairn anchor a surveyed route.
    for (let level = 0; level < 4; level++) {
      const h = 1.4, y = .9 + level * h, w = 2.4 - level * .42;
      for (const s of [-1, 1]) { rod(a, r, [s * w, y, -1.5], [s * (w - .42), y + h, -1.5], .11, p.forest); rod(a, r, [s * w, y, -1.5], [-s * (w - .42), y + h, -1.5], .055, p.gold); }
      a.box(r, [w * 2, .16, 2.4 - level * .3], [0, y, -1.5], p.paper);
    }
    a.cylinder(r, 1.35, .2, [0, 6.65, -1.5], p.gold, 1.1);
    orb(a, r, [0, 7.45, -1.5], .65, p.paper, [1, 1.25, 1]);
    a.mesh(r, new T.ConeGeometry(1.3, 1, 8), p.jade, [0, 8.45, -1.5]);
    for (const x of [-5.8, 5.8]) { rod(a, r, [0, 7, -1.5], [x, .85, .6], .024, p.gold); a.box(r, [.2, .4, .2], [x, .97, .6], p.forest); }
    for (let i = 0; i < 5; i++) { const rock = a.mesh(r, new T.DodecahedronGeometry(1 - i * .13, 0), p.limestone, [-4.3 + Math.sin(i) * .18, 1.2 + i * .45, -.7]); rock.scale.set(1.5, .36, .8); }
    a.shape(r, [[0, 0], [.85, -.25], [0, -.65]], .07, p.vermilion, [0, 9.3, -1.5]); rod(a, r, [0, 8.9, -1.5], [0, 9.6, -1.5], .04, p.gold);
  },
  '2026-04-13': (a, r) => {
    const p = a.palette;
    foot(a, r, [0, .86, -.6], 9, 5);
    a.box(r, [.45, 6.7, .65], [-2.3, 4.35, -2.7], p.forest); for (let i = 0; i < 17; i++) a.box(r, [.15, .04, .08], [-2.01, 1.5 + i * .34, -2.7], p.gold);
    rod(a, r, [-2.3, 6.4, -2.7], [.5, 6.4, -1.1], .2, p.gold);
    a.box(r, [2.9, 1.3, 2.1], [.5, 6.25, -1.1], p.jade); a.cylinder(r, .65, .8, [.5, 5.3, -1.1], p.forest); a.cylinder(r, .75, .12, [.5, 4.85, -1.1], p.gold);
    for (let i = 0; i < 6; i++) a.box(r, [2.2, .12, 1.5], [.5, 5.38 + i * .13, -1.1], i % 2 ? p.limestone : p.paper);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
      const x = -2.7 + col * 1.75, z = -.8 + row * 1.5;
      a.box(r, [1.5, .06, 1.2], [x, 1.18, z], p.paper); a.box(r, [1.2, .025, .85], [x, 1.23, z], p.water);
      a.mesh(r, new T.ConeGeometry(.25, .32, 5), p.jade, [x - .2, 1.4, z]);
    }
    hoop(a, r, [4.6, 2.1, .4], .66, p.gold); rod(a, r, [4.25, 1.58, .4], [3.5, .95, .4], .13, p.forest);
  },
  '2026-04-14': (a, r) => {
    const p = a.palette;
    for (const s of [-1, 1]) { a.shape(r, [[-.35, 0], [.35, 0], [.6, 6.5], [-.6, 6.5]], .5, p.paper, [s * 3.9, .9, -1]); foot(a, r, [s * 3.9, .85, -.8], 2, 2.6); }
    a.box(r, [9, .35, 1.2], [0, 7.6, -1], p.forest); for (let i = 0; i < 11; i++) a.box(r, [.12, .2, .09], [-4 + i * .8, 7.65, -.33], p.gold);
    const pendulum = group(r, [0, 7.4, -.4]); pendulum.rotation.z = -.25;
    rod(a, pendulum, [0, 0, 0], [0, -4.9, 0], .075, p.gold); disk(a, pendulum, [0, -4.9, .1], .9, .3, p.vermilion); hoop(a, pendulum, [0, -4.9, .31], .69, p.paper);
    a.shape(pendulum, [[0, -5.5], [-.45, -4.8], [.45, -4.8]], .1, p.gold, [0, 0, .4]);
    for (let i = 0; i < 17; i++) { const x = -5.3 + i * .66; a.box(r, [.59, .08, 1.5], [x, 1.1, .65], i === 9 ? p.vermilion : p.paper); for (const z of [.07, 1.2]) a.box(r, [.12, .035, .16], [x, 1.17, z], p.forest); }
    curve(a, r, [[-5, 2.9, -.6], [-2.5, 1.8, -.6], [0, 1.5, -.6], [2.5, 1.8, -.6], [5, 2.9, -.6]], .035, p.gold);
  },
  '2026-04-15': (a, r) => {
    const p = a.palette;
    a.box(r, [8.5, 5.2, 2.6], [-.5, 3.6, -1.4], p.jade);
    panel(a, r, [-1.8, 3.7, -.01], 5.1, 3.9, p.forest, p.gold);
    for (let i = 0; i < 9; i++) a.box(r, [.018, 3.5, .04], [-4 + i * .55, 3.7, .12], p.jade);
    for (let i = 0; i < 7; i++) a.box(r, [4.7, .018, .04], [-1.8, 2 + i * .56, .12], p.jade);
    const wave: Point[] = [];
    for (let i = 0; i <= 72; i++) { const t = i / 72; const y = 3.7 + Math.sin(t * Math.PI * 8) * Math.exp(-Math.pow(t - .55, 2) * 6) * 1.3; wave.push([-4.1 + t * 4.7, y, .2]); }
    curve(a, r, wave, .05, p.gold);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) { const x = 2 + col * .95, y = 2.15 + row * 1.3; disk(a, r, [x, y, .07], .3, .23, row === 2 && col === 1 ? p.vermilion : p.paper); rod(a, r, [x, y, .24], [x + .1, y + .17, .24], .028, p.gold); }
    for (const x of [-3.8, 2.8]) a.box(r, [.8, .3, 2.2], [x, .9, -1.4], p.forest);
    curve(a, r, [[3, 1.3, .2], [5.4, 1, .7], [6, 1.6, -.5], [5, 2.2, -1]], .07, p.ink); rod(a, r, [5, 2.2, -1], [4.6, 3.3, -1.2], .13, p.gold);
  },
  '2026-04-16': (a, r) => {
    const p = a.palette, globe = group(r, [-.6, 4.55, -.9]); globe.rotation.set(.1, -.35, -.18);
    // A quarter section is removed to reveal layered oceans inside the first 3D globe.
    a.mesh(globe, new T.SphereGeometry(3.25, 40, 24, Math.PI / 2, Math.PI * 1.5), p.water);
    for (let i = 0; i < 5; i++) { const radius = 3.15 - i * .45; const section = disk(a, globe, [0, 0, .015 + i * .02], radius, .08, i % 2 ? p.paper : p.jade); section.rotation.y = -Math.PI / 2; }
    for (let lat = -2; lat <= 2; lat++) { const y = lat * .85, rad = Math.sqrt(3.3 * 3.3 - y * y); const h = hoop(a, globe, [0, y, 0], rad, p.gold, .028); h.rotation.x = Math.PI / 2; }
    for (let mer = 0; mer < 6; mer++) { const h = hoop(a, globe, [0, 0, 0], 3.3, p.gold, .03); h.rotation.y = mer * Math.PI / 6; }
    for (const [x, y, z] of [[-1.8, 1.6, 2.1], [.5, 2.4, 2], [-2.4, -.7, 2.1], [1.1, -.8, 2.9]]) { const land = a.mesh(globe, new T.DodecahedronGeometry(.65, 0), p.jade, [x, y, z]); land.scale.set(1.4, .9, .24); rod(a, globe, [x, y, z], [x, y + .7, z], .025, p.gold); orb(a, globe, [x, y + .75, z], .13, p.vermilion); }
    const cradle = arch(a, r, [-.6, 4.55, -1.1], 3.85, .2, p.gold, Math.PI, Math.PI * 2); cradle.rotation.z = -.15;
    a.cylinder(r, .28, 1.6, [-.6, 1.4, -1], p.forest); a.cylinder(r, 2.1, .25, [-.6, .92, -1], p.limestone);
  },
  '2026-04-17': (a, r) => {
    const p = a.palette;
    // A horizon court, not another sphere: meridian ribs frame an inlaid world floor.
    for (let i = 0; i < 7; i++) { const radius = 5.5 - i * .48; const h = hoop(a, r, [0, .9 + i * .15, -1], radius, p.paper, .22); h.rotation.x = Math.PI / 2; h.scale.y = .58; }
    for (let i = 0; i < 5; i++) {
      const z = -3.7 + i * .7, radius = 4.8 - Math.abs(i - 2) * .32;
      arch(a, r, [0, 1.6, z], radius, .11, i === 2 ? p.gold : p.jade);
      for (const s of [-1, 1]) rod(a, r, [s * radius, .9, z], [s * radius, 1.6, z], .1, p.gold);
    }
    a.cylinder(r, 2.8, .1, [0, 1.65, -.7], p.water).scale.z = .7;
    const land1 = a.shape(r, [[-1.6, -.4], [-1.1, .7], [-.2, 1], [.3, .3], [-.2, -.6], [-.7, -1]], .04, p.jade, [-.8, 1.75, -.5]); land1.rotation.x = Math.PI / 2;
    const land2 = a.shape(r, [[-.5, -.6], [.3, -.3], [.8, .6], [.2, 1], [-.5, .3]], .04, p.jade, [1.2, 1.75, -.5]); land2.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const t = i / 5 * Math.PI; rod(a, r, [Math.cos(t) * 5.35, 1, -1 + Math.sin(t) * 3.1], [Math.cos(t) * 5.35, 2, -1 + Math.sin(t) * 3.1], .035, p.gold); }
  },
  '2026-04-18': (a, r) => {
    const p = a.palette;
    const galaxy = group(r, [-.2, 5.6, -1]); galaxy.rotation.x = -.35;
    for (let arm = 0; arm < 3; arm++) {
      const points: Point[] = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60, theta = arm * Math.PI * 2 / 3 + t * Math.PI * 1.55, radius = .55 + t * 4.6; points.push([Math.cos(theta) * radius, Math.sin(theta) * radius, Math.sin(t * Math.PI) * .35]); }
      curve(a, galaxy, points, arm === 0 ? .18 : .14, [p.paper, p.gold, p.jade][arm]);
      for (let i = 0; i < 22; i++) { const t = i / 21, theta = arm * Math.PI * 2 / 3 + t * Math.PI * 1.55, radius = .55 + t * 4.6; orb(a, galaxy, [Math.cos(theta) * radius, Math.sin(theta) * radius, .26], i % 5 === 0 ? .21 : .11, i % 4 === 0 ? p.vermilion : p.paper); }
      for (let i = 0; i < 7; i++) {
        const t = .24 + i * .105, theta = arm * Math.PI * 2 / 3 + t * Math.PI * 1.55, radius = .55 + t * 4.6;
        const x = Math.cos(theta) * radius, y = Math.sin(theta) * radius;
        rod(a, galaxy, [x - .19, y, .4], [x + .19, y, .4], .033, p.gold);
        rod(a, galaxy, [x, y - .19, .4], [x, y + .19, .4], .033, p.gold);
      }
    }
    orb(a, galaxy, [0, 0, 0], .62, p.gold); hoop(a, galaxy, [0, 0, .15], .88, p.paper);
    for (const s of [-1, 1]) rod(a, r, [s * 2.5, .9, -1], [s * 1.7, 3.1, -1], .09, p.forest);
    const foundation = a.cylinder(r, 3.5, .28, [0, .95, -1], p.limestone); foundation.scale.z = .65;
    for (let i = 0; i < 5; i++) { const x = -2.6 + i * 1.3; a.box(r, [.6, .3, .7], [x, 1.23, .8], p.paper); rod(a, r, [x, 1.4, .8], [x, 2, .8], .025, p.gold); orb(a, r, [x, 2.04, .8], .09, p.vermilion); }
  },
  '2026-04-19': (a, r) => {
    const p = a.palette;
    // A narrow limnograph measures the water and writes its trace on a drum.
    a.box(r, [2.9, 6.5, 1.4], [-2.5, 4.15, -1.2], p.paper);
    a.box(r, [1.7, 5.8, .12], [-2.5, 4.2, -.41], p.water);
    for (let i = 0; i < 26; i++) a.box(r, [i % 5 === 0 ? .65 : .32, .035, .06], [-2.3, 1.5 + i * .21, -.28], p.gold);
    a.box(r, [1.6, 1.3, .14], [-2.5, 2.1, -.2], p.jade);
    orb(a, r, [-2.5, 2.88, -.04], .28, p.vermilion, [1.7, .4, .6]); rod(a, r, [-2.5, 2.9, -.1], [-2.5, 7.65, -.1], .025, p.gold);
    curve(a, r, [[-2.5, 7.65, -.1], [0, 7.9, -.1], [2.5, 6.7, -.1]], .04, p.gold);
    const drum = a.cylinder(r, 1.35, 2.5, [2.6, 3.9, -1], p.paper); drum.rotation.z = Math.PI / 2;
    for (const x of [1.3, 3.9]) { const rim = hoop(a, r, [x, 3.9, -1], 1.4, p.gold); rim.rotation.y = Math.PI / 2; }
    curve(a, r, [[1.4, 4.1, .32], [2, 4.6, .2], [2.6, 4, .35], [3, 4.45, .25], [3.8, 4.1, .32]], .035, p.vermilion);
    for (const x of [1.3, 3.9]) rod(a, r, [x, .9, -1], [x, 3.9, -1], .12, p.forest);
    a.box(r, [8.3, .15, 3.3], [0, .88, -1], p.limestone);
  },
  '2026-04-20': (a, r) => {
    const p = a.palette;
    const stars: Point[] = [[-5, 3.4, -.5], [-3.5, 5.7, -1.7], [-1.4, 4.8, -.8], [.1, 7.4, -2], [2.2, 6.4, -.7], [4.7, 4.7, -.6], [3.3, 2.7, .4], [-.2, 2.2, .8]];
    const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [2, 7], [2, 4]];
    for (const [i, j] of connections) rod(a, r, stars[i], stars[j], .065, p.gold);
    for (let i = 0; i < stars.length; i++) {
      const [x, y, z] = stars[i]; a.mesh(r, new T.OctahedronGeometry(i === 3 ? .42 : .23, 0), i === 3 ? p.vermilion : p.gold, stars[i]);
      rod(a, r, [x, y, z], [x, y + 1.15, z], .03, p.gold);
      const banner = a.shape(r, [[0, 0], [.8, -.05], [.62, -.35], [.8, -.66], [0, -.62]], .04, [p.paper, p.jade, p.vermilion][i % 3], [x, y + 1.12, z]); banner.rotation.y = i * .17;
      if (i % 2 === 0) rod(a, r, [x, .9, z - .2], [x, y, z], .05, p.forest);
    }
    for (let i = 0; i < 4; i++) a.box(r, [9 - i * 1.2, .12, 3.3 - i * .45], [0, .85 + i * .12, -.5], p.paper);
    a.medal(r, .05, 1.65, 1.3, .58);
  },
  '2026-04-21': (a, r) => {
    const p = a.palette;
    // A shared hinge joins a tall date leaf to a shorter flag leaf.
    const hinge = group(r, [-.4, .8, -1.8]);
    for (let i = 0; i < 12; i++) a.cylinder(hinge, .19, .43, [0, .28 + i * .49, 0], i % 2 ? p.paper : p.gold);
    orb(a, hinge, [0, 6.2, 0], .24, p.vermilion);
    const left = group(hinge); left.rotation.y = -.32;
    a.box(left, [4.5, 5.8, .2], [-2.4, 3, 0], p.paper);
    for (const y of [.2, 5.8]) a.box(left, [4.7, .1, .26], [-2.4, y, 0], p.gold);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
      const x = -4 + col * .97, y = 1.05 + row * .87;
      a.box(left, [.66, .55, .09], [x, y, .17], row === 2 && col > 0 ? p.jade : p.limestone);
      rod(a, left, [x - .2, y, .24], [x + .15, y, .24], .026, p.gold);
    }
    const right = group(hinge); right.rotation.y = .38;
    a.shape(right, [[.2, .2], [4.8, .2], [4.8, 4.7], [3.9, 5.5], [.2, 5.5]], .2, p.jade);
    for (let i = 0; i < 4; i++) {
      rod(a, right, [1.1, 1.1 + i * 1.05, .24], [1.1, 1.8 + i * 1.05, .24], .035, p.gold);
      a.shape(right, [[0, 0], [1.15, -.04], [.94, -.27], [1.15, -.52], [0, -.49]], .06, i % 2 ? p.paper : p.vermilion, [1.1, 1.8 + i * 1.05, .24]);
      a.box(right, [1.05, .05, .08], [3.43, 1.48 + i * 1.05, .26], p.paper);
    }
    for (const x of [-4.3, 4]) foot(a, r, [x, .85, -.8], 1.8, 2.3);
    curve(a, r, [[-3.8, .85, 1.5], [-1, 1, 1.6], [1.5, 1, .9], [3.8, .85, 1.2]], .06, p.gold);
  },
  '2026-04-22': (a, r) => {
    const p = a.palette;
    // A thick paper funnel has separate inside and outside faces, like a real vessel.
    a.mesh(r, new T.CylinderGeometry(3.6, .58, 3.7, 48, 1, true), p.paper, [0, 5.3, -1.2]);
    const inside = new T.CylinderGeometry(3.45, .43, 3.7, 48, 1, true);
    const indices = inside.index!;
    for (let i = 0; i < indices.count; i += 3) { const first = indices.getX(i); indices.setX(i, indices.getX(i + 2)); indices.setX(i + 2, first); }
    inside.computeVertexNormals();
    a.mesh(r, inside, p.jade, [0, 5.3, -1.2]);
    const lip = hoop(a, r, [0, 7.15, -1.2], 3.53, p.gold, .11); lip.rotation.x = Math.PI / 2;
    for (let i = 0; i < 16; i++) {
      const t = i / 16 * Math.PI * 2;
      rod(a, r, [Math.cos(t) * .59, 3.46, -1.2 + Math.sin(t) * .59], [Math.cos(t) * 3.61, 7.16, -1.2 + Math.sin(t) * 3.61], .035, p.gold);
      const innerT = t + Math.PI / 16;
      rod(a, r, [Math.cos(innerT) * .82, 3.96, -1.2 + Math.sin(innerT) * .82], [Math.cos(innerT) * 3.42, 7.15, -1.2 + Math.sin(innerT) * 3.42], .027, p.paper);
    }
    for (const radius of [1.05, 1.7, 2.4, 3.1]) {
      const height = 3.45 + (radius - .43) / (3.45 - .43) * 3.7;
      const contour = hoop(a, r, [0, height + .035, -1.2], radius, p.gold, .025); contour.rotation.x = Math.PI / 2;
    }
    a.cylinder(r, .6, .8, [0, 3.05, -1.2], p.jade);
    const routes: Point[][] = [ [[0, 2.8, -1.2], [-1.5, 2.2, -.7], [-4.2, 1.2, .5]], [[0, 2.8, -1.2], [.5, 2, -.2], [0, 1.2, 1.1]], [[0, 2.8, -1.2], [2, 2.5, -.8], [4.2, 1.2, .5]] ];
    routes.forEach((route, index) => {
      curve(a, r, route, .13, index === 1 ? p.vermilion : p.gold);
      const end = route[2]; a.box(r, [2.6, .2, 1.9], end, p.limestone);
      for (const dx of [-1.15, 1.15]) a.box(r, [.12, .65, 1.9], [end[0] + dx, 1.46, end[2]], p.paper);
      for (let j = 0; j < [4, 12, 6][index]; j++) orb(a, r, [end[0] - .75 + j % 4 * .5, 1.52 + Math.floor(j / 4) * .22, end[2]], .15, index === 1 ? p.gold : p.jade);
    });
    for (const x of [-2.8, 2.8]) rod(a, r, [x, .85, -2.7], [x * .9, 6.8, -2.7], .13, p.forest);
    for (let i = 0; i < 15; i++) { const t = i * 2.4, radius = 1.5 + i % 4 * .36; orb(a, r, [Math.cos(t) * radius, 6.45 + i % 3 * .22, -1.2 + Math.sin(t) * radius], .14, i % 3 === 0 ? p.vermilion : p.gold); }
  },
  '2026-04-23': (a, r) => {
    const p = a.palette;
    // A tutorial unfurls vertically, with each lesson a walkable paper stair.
    const back: [number, number][] = [[-4, 0], [-4, 5.9], [-3.1, 6.6], [2.4, 6.6], [3.4, 7.3], [4.4, 7.1], [4.9, 6.4], [4.4, 5.8], [3.7, 5.6], [3.1, 6], [-2.8, 6], [-3.2, 5.6], [-3.2, 0]];
    a.shape(r, back, .6, p.paper, [-.2, .9, -2]);
    for (let i = 0; i < 10; i++) {
      const x = -3.3 + i * .69, y = 1.2 + i * .46;
      a.box(r, [.8, .18, 2.45], [x, y, -.4], p.paper);
      a.box(r, [.82, .05, .16], [x, y + .13, .81], p.gold);
      rod(a, r, [x, .87, -1.6], [x, y, -1.6], .055, p.limestone);
      a.box(r, [.4, .035, .08], [x, y + .14, -.15], p.jade);
    }
    curve(a, r, [[-3.9, 2.1, .95], [-2, 3.3, .95], [.5, 4.8, .95], [3.1, 6.45, .95]], .045, p.gold);
    for (let i = 0; i < 6; i++) rod(a, r, [-3.3 + i * 1.18, 1.2 + i * .79, .92], [-3.3 + i * 1.18, 2.5 + i * .79, .92], .035, p.gold);
    for (let i = 0; i < 7; i++) a.box(r, [2.1 - i % 3 * .24, .045, .055], [-1.1, 3.25 + i * .37, -1.64], p.jade);
    const top = a.cylinder(r, .39, 2, [3.75, 7.4, -1.2], p.jade); top.rotation.x = Math.PI / 2;
    for (const z of [-2.3, -.1]) disk(a, r, [3.75, 7.4, z], .49, .12, p.gold);
  },
  '2026-04-24': (a, r) => {
    const p = a.palette;
    // Each feather is a tiled image; a peacock makes the mosaic feature tangible.
    for (let feather = 0; feather < 9; feather++) {
      const angle = -.99 + feather * .2475, g = group(r, [0, 2.3, -1.8]); g.rotation.z = angle;
      a.shape(g, [[-.17, 0], [-.72, 3.3], [-.78, 4.8], [0, 5.6], [.78, 4.8], [.72, 3.3], [.17, 0]], .12, feather % 2 ? p.paper : p.jade);
      rod(a, g, [0, .2, .17], [0, 5.2, .17], .035, p.gold);
      for (let row = 0; row < 5; row++) for (const s of [-1, 1]) {
        const tile = a.box(g, [.37, .37, .07], [s * .36, 3 + row * .39, .19], (row + feather) % 3 === 0 ? p.gold : p.water); tile.rotation.z = Math.PI / 4;
      }
      disk(a, g, [0, 4.97, .21], .23, .06, p.vermilion); hoop(a, g, [0, 4.97, .25], .31, p.gold, .035);
    }
    orb(a, r, [.1, 2.2, -.15], .95, p.jade, [1.2, 1.4, .65]);
    curve(a, r, [[.3, 2.3, .1], [.8, 3.3, .2], [.55, 4.2, .15], [.9, 4.5, .15]], .27, p.jade);
    orb(a, r, [.92, 4.45, .15], .43, p.jade); a.mesh(r, new T.ConeGeometry(.16, .7, 5), p.gold, [1.4, 4.43, .15]).rotation.z = -Math.PI / 2;
    for (let i = 0; i < 3; i++) { rod(a, r, [.82, 4.73, .15], [.55 + i * .25, 5.3, .15], .028, p.gold); orb(a, r, [.55 + i * .25, 5.3, .15], .08, p.vermilion); }
    orb(a, r, [1, 4.57, .5], .05, p.ink);
    for (const x of [-.35, .4]) { rod(a, r, [x, .85, .1], [x, 1.75, .1], .045, p.gold); for (const dx of [-.23, .23]) rod(a, r, [x, .85, .1], [x + dx, .79, .5], .035, p.gold); }
    a.shape(r, [[-6, 0], [-4.5, .7], [4.7, .4], [6.2, 0]], .12, p.limestone, [0, .82, -2.6]).rotation.x = Math.PI / 2;
  },
  '2026-04-25': (a, r) => {
    const p = a.palette;
    // A carved chess knight looks toward its distant rival's rating pennants.
    for (let i = 0; i < 4; i++) a.cylinder(r, 2.2 - i * .18, .25, [-1.2, .9 + i * .25, -.9], i % 2 ? p.paper : p.gold);
    const horse: [number, number][] = [[-1.4, 0], [1.4, 0], [1.15, 1.8], [.4, 3.2], [1.4, 3.6], [2.5, 3.5], [2.8, 4.2], [1.7, 5.2], [.7, 5.7], [.4, 6.5], [-.05, 6], [-.55, 6.4], [-.8, 5.7], [-1.6, 4.9], [-1.9, 3.7], [-1.4, 2.3]];
    a.shape(r, horse, 1.5, p.paper, [-1.2, 1.8, -1.7]);
    a.shape(r, [[-1.5, .3], [-1.2, 2.6], [-1.7, 3.8], [-1.4, 4.9], [-.65, 5.7], [-.2, 5.65], [-.95, 4.5], [-.95, 3.2], [-.2, .3]], .12, p.jade, [-1.2, 1.8, -.12]);
    for (let i = 0; i < 7; i++) rod(a, r, [-2.85 + i * .12, 4.8 + i * .37, .03], [-2.35 + i * .15, 5.02 + i * .37, .03], .038, p.gold);
    disk(a, r, [.32, 6.95, -.06], .12, .08, p.ink); hoop(a, r, [.32, 6.95, .01], .23, p.gold, .035);
    curve(a, r, [[.9, 5.68, .05], [.25, 6.45, .05], [-.35, 7.1, .05]], .05, p.gold);
    for (let i = 0; i < 4; i++) {
      const x = 3.35 + i * .8, y = 2.6 + i * .72;
      rod(a, r, [x, .85, -1.2], [x, y, -1.2], .055, p.gold);
      a.shape(r, [[0, 0], [.7, -.15], [.55, -.5], [0, -.55]], .07, i === 3 ? p.vermilion : p.jade, [x, y, -1.2]);
      a.cylinder(r, .36, .15, [x, .89, -1.2], p.limestone);
    }
  },
  '2026-04-26': (a, r) => {
    const p = a.palette, watch = group(r, [-.4, 4.4, -.8]); watch.rotation.set(-.14, -.12, -.2);
    // A pocket stopwatch has a milled case, recessed face and three separate hands.
    disk(a, watch, [0, 0, -.3], 3.5, .85, p.gold); disk(a, watch, [0, 0, .21], 3.26, .2, p.paper);
    hoop(a, watch, [0, 0, .36], 3.06, p.limestone, .08); ticks(a, watch, [0, 0, .41], 2.91, 60);
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; disk(a, watch, [Math.sin(t) * 2.52, Math.cos(t) * 2.52, .4], .075, .04, p.jade); }
    disk(a, watch, [0, -1.15, .39], .65, .06, p.limestone); ticks(a, watch, [0, -1.15, .47], .56, 20);
    rod(a, watch, [0, -1.15, .51], [.32, -.94, .51], .035, p.forest);
    a.shape(watch, [[-.08, -.35], [.08, -.35], [.16, 1.7], [0, 2.16], [-.16, 1.7]], .08, p.forest, [0, 0, .55]).rotation.z = -.72;
    rod(a, watch, [-.42, -.6, .68], [1.66, 2.25, .68], .035, p.vermilion); disk(a, watch, [0, 0, .73], .19, .1, p.gold);
    a.box(watch, [1, .58, .8], [0, 3.64, -.15], p.gold); for (let i = 0; i < 6; i++) a.box(watch, [.06, .5, .88], [-.36 + i * .14, 3.69, -.15], p.paper);
    const ring = hoop(a, watch, [0, 4.25, -.1], .53, p.gold, .1); ring.scale.x = .86;
    const button = a.cylinder(watch, .25, .65, [2.66, 2.69, -.1], p.vermilion); button.rotation.z = -.75;
    for (let i = 0; i < 6; i++) { const x = -4.5 + i * 1.7; a.box(r, [1.45, .11, .95], [x, .88, .55], p.paper); rod(a, r, [x - .4, .97, .55], [x + .4, .97, .55], .035, i === 4 ? p.vermilion : p.gold); }
    curve(a, r, [[-3.4, .98, -1.4], [-4.6, 1.7, -.2], [-5.6, 2.2, .3], [-6.5, 1.25, .9]], .08, p.gold);
  },
  '2026-04-27': (a, r) => {
    const p = a.palette;
    // Wireless motion is carved into a tall angular antenna, above an inspection bay.
    const spine: Point[] = [[-.9, 1.1, -1.7], [-.9, 8.4, -1.7], [2.1, 5.65, -1.7], [-3, 3, -1.7], [-3, 7, -1.7], [2.1, 4.35, -1.7], [-.9, 1.1, -1.7]];
    for (let i = 0; i < spine.length - 1; i++) rod(a, r, spine[i], spine[i + 1], .17, p.gold);
    for (const point of spine.slice(0, -1)) orb(a, r, point, .22, p.paper);
    for (let i = 0; i < 3; i++) {
      const wave = arch(a, r, [1.35, 5, -1.65], 2.7 + i * .64, .09, i === 1 ? p.jade : p.paper, -.74, .74); wave.scale.y = .9;
    }
    // The empty stage signifies a 3D preview without inventing a puzzle state.
    for (let i = 0; i < 3; i++) a.box(r, [5.8 - i * .42, .18, 3.3 - i * .34], [.1, .86 + i * .18, -.45], p.paper);
    a.box(r, [3.9, .07, 2.2], [.1, 1.36, -.45], p.water);
    for (let i = 0; i < 5; i++) { const t = i / 4 * Math.PI; const x = .1 + Math.cos(t) * 2.7; rod(a, r, [x, 1.2, .75], [x, 1.65, .75], .025, p.gold); }
    a.shape(r, [[-1.3, 0], [-.9, .7], [0, .55], [.9, .7], [1.3, 0], [.55, -.3], [0, -.13], [-.55, -.3]], .12, p.jade, [-4.7, 1.65, -.1]);
    curve(a, r, [[-5.9, 1.8, -.05], [-6.5, 1.55, -.7], [-6, 1.35, -1.2], [-4.8, 1.35, -1.35]], .045, p.gold);
  },
  '2026-04-28': (a, r) => {
    const p = a.palette;
    // Calendar pages turn around a horizontal binding, becoming a physical film.
    for (const x of [-3.8, 3.8]) {
      a.shape(r, [[-.4, 0], [.4, 0], [.6, 4.25], [0, 4.8], [-.6, 4.25]], .55, p.jade, [x, .85, -1.8]);
      foot(a, r, [x, .82, -1.5], 2.1, 2.8);
    }
    rod(a, r, [-4.3, 5.4, -1.5], [4.3, 5.4, -1.5], .12, p.gold);
    for (let i = 0; i < 12; i++) {
      const t = -.28 + i * .035, page = group(r, [0, 5.4, -1.5]); page.rotation.x = t;
      a.box(page, [6.4, 3.5, .07], [0, -1.8, 0], i === 0 ? p.paper : i % 3 ? p.limestone : p.jade);
      if (i === 0) {
        for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) a.box(page, [.46, .33, .05], [-2.5 + col * .83, -3 + row * .61, .075], row === 2 && col === 3 ? p.vermilion : p.gold);
        a.box(page, [5.6, .12, .07], [0, -.42, .08], p.forest);
      }
      for (const x of [-2.5, 2.5]) { const ring = hoop(a, page, [x, -.03, 0], .17, p.gold, .035); ring.rotation.y = Math.PI / 2; }
    }
    // A lifted leaf and its folded lower corner give the calendar an unmistakable turning-page profile.
    const lifted = group(r, [0, 5.4, -1.5]); lifted.rotation.x = -2.9; lifted.rotation.z = .045;
    a.shape(lifted, [[-3.2, -.08], [-3.2, -3.5], [2.2, -3.5], [3.2, -2.5], [3.2, -.08]], .085, p.paper, [0, 0, -.04]);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) a.box(lifted, [.38, .025, .025], [-2.5 + col * .83, -2.2 + row * .61, -.075], row === 1 && col === 3 ? p.vermilion : p.gold);
    a.box(lifted, [5.6, .12, .04], [0, -.42, -.075], p.forest);
    a.box(lifted, [4.7, .035, .025], [-.4, -3.28, -.075], p.gold);
    const folded = group(lifted, [2.2, -3.5, -.04]); folded.rotation.y = -.48;
    a.shape(folded, [[0, 0], [1, 1], [-.1, 1.15]], .065, p.jade, [0, 0, -.07]);
    rod(a, lifted, [2.2, -3.5, -.08], [3.2, -2.5, -.08], .035, p.gold);
    for (const x of [-2.5, 2.5]) { const ring = hoop(a, r, [x, 5.4, -1.5], .24, p.gold, .045); ring.rotation.y = Math.PI / 2; }
    for (let i = 0; i < 7; i++) {
      const x = -4.7 + i * 1.55; a.box(r, [1.37, .08, 1.25], [x, .96, 1.25], p.paper);
      a.box(r, [.91, .04, .65], [x, 1.02, 1.25], i === 5 ? p.vermilion : p.jade);
      for (const z of [.77, 1.73]) for (const dx of [-.4, 0, .4]) a.box(r, [.12, .025, .12], [x + dx, 1.06, z], p.gold);
    }
  },
  '2026-04-29': (a, r) => {
    const p = a.palette;
    // An origami draft boat has folded hull facets and its editing pencil as a mast.
    const hull = group(r, [0, 1, -.8]);
    a.shape(hull, [[-6, 2.8], [-3.4, 0], [3.3, 0], [6, 2.8], [0, 1.25]], .1, p.paper, [0, 0, 1.3]);
    a.shape(hull, [[-6, 2.8], [-3.4, 0], [3.3, 0], [6, 2.8], [0, 1.25]], .1, p.limestone, [0, 0, -1.3]);
    a.shape(hull, [[-6, 0], [0, -1.65], [6, 0], [0, 1.65]], .1, p.paper, [0, 2.8, 0]).rotation.x = Math.PI / 2;
    a.shape(hull, [[-4.1, 1.9], [.1, 6.45], [4.3, 1.9]], .1, p.paper, [0, 0, -.2]);
    a.shape(hull, [[-4.1, 1.9], [.1, 6.45], [.1, 2.1]], .12, p.jade, [0, 0, -.07]);
    for (const [from, to] of [ [[-6, 2.8, 1.43], [-3.4, .07, 1.43]], [[6, 2.8, 1.43], [3.3, .07, 1.43]], [[-6, 2.8, 1.43], [0, 1.26, 1.43]], [[6, 2.8, 1.43], [0, 1.26, 1.43]] ] as [Point, Point][]) rod(a, hull, from, to, .035, p.gold);
    rod(a, hull, [.1, 2.1, .11], [.1, 6.46, .11], .035, p.gold);
    for (let i = 0; i < 5; i++) a.box(hull, [1.1 + i * .18, .035, .035], [1.4, 3.05 + i * .37, .08], p.gold);
    const pencil = group(r, [-3.7, 1.4, -1.2]); pencil.rotation.z = -.27;
    a.mesh(pencil, new T.CylinderGeometry(.2, .2, 6.4, 6), p.vermilion, [0, 3.3, 0]);
    a.mesh(pencil, new T.ConeGeometry(.2, .75, 6), p.paper, [0, 6.88, 0]);
    a.mesh(pencil, new T.ConeGeometry(.07, .25, 6), p.ink, [0, 7.23, 0]);
    for (const y of [.3, .42]) a.cylinder(pencil, .22, .06, [0, y, 0], p.gold);
    for (let i = 0; i < 3; i++) curve(a, r, [[-6 + i * .4, .83, 1.9], [-2, .83, 2 + i * .13], [2, .83, 1.8 + i * .15], [6 - i * .3, .83, 1.9 + i * .15]], .035, p.water);
  },
  '2026-04-30': (a, r) => {
    const p = a.palette;
    // One continuous mountain is cut into horizontal geological beds, never chart columns.
    const outline: [number, number][] = [[-6.1, .82], [-5.4, 2.2], [-4.5, 1.9], [-3.8, 4.25], [-2.65, 4.9], [-1.85, 4.35], [.05, 7.9], [1.3, 8.8], [2.08, 7.25], [2.85, 7.85], [4.7, 4.2], [5.75, .82]];
    const slice = (points: [number, number][], height: number, above: boolean) => {
      const result: [number, number][] = [];
      for (let i = 0; i < points.length; i++) {
        const from = points[i], to = points[(i + 1) % points.length];
        const fromInside = above ? from[1] >= height : from[1] <= height, toInside = above ? to[1] >= height : to[1] <= height;
        if (fromInside) result.push(from);
        if (fromInside !== toInside) { const t = (height - from[1]) / (to[1] - from[1]); result.push([from[0] + (to[0] - from[0]) * t, height]); }
      }
      return result;
    };
    for (let layer = 0; layer < 13; layer++) {
      const low = .82 + layer * .63, band = slice(slice(outline, low, true), low + .615, false);
      if (band.length < 3) continue;
      const face = .87 + Math.sin(layer * 1.8) * .13;
      a.shape(r, band, 3.5 + face, layer === 3 || layer === 8 ? p.jade : layer % 3 === 0 ? p.limestone : p.paper, [0, 0, -3.5]);
      // Exposed fractures cross several beds without resembling repeated windows.
      if (layer > 1 && layer < 10) rod(a, r, [1.45 + layer * .095, low + .06, face + .04], [1.73 + layer * .085, low + .56, face + .04], .026, p.gold);
    }
    const route: Point[] = [[-5.55, 1.38, 1.3], [-2.5, 2.05, 1.3], [-3.6, 3.06, 1.3], [.22, 3.7, 1.3], [-1.5, 4.7, 1.3], [1.75, 5.42, 1.3], [.06, 6.53, 1.3], [1.24, 7.6, 1.3], [1.3, 8.81, 1.3]];
    for (let leg = 0; leg < route.length - 1; leg++) {
      rod(a, r, route[leg], route[leg + 1], .055, p.gold);
      const start = new T.Vector3(...route[leg]), end = new T.Vector3(...route[leg + 1]);
      for (let step = 1; step <= 5; step++) {
        const at = start.clone().lerp(end, step / 6);
        a.box(r, [.3, .065, .42], [at.x, at.y - .1, 1.18], p.paper);
      }
      orb(a, r, route[leg], .11, leg % 2 ? p.paper : p.vermilion);
      rod(a, r, [route[leg][0], route[leg][1], .88], route[leg], .03, p.gold);
    }
    const ideal: Point[] = [];
    for (let i = 0; i <= 36; i++) { const x = -6.5 + i / 36 * 12.4, h = 9.95 - 1.9 * Math.exp(-(x + 6.5) * .32); ideal.push([x, h, -3.55]); }
    curve(a, r, ideal, .045, p.gold);
    for (const x of [-6.5, 5.9]) { rod(a, r, [x, .85, -3.6], [x, 10, -3.6], .055, p.gold); a.box(r, [.6, .23, .8], [x, .91, -3.6], p.limestone); }
    rod(a, r, [-6.5, 10, -3.6], [5.9, 10, -3.6], .045, p.vermilion);
    for (let i = 0; i < 16; i++) a.box(r, [.23, .05, .13], [-6.1 + i * .77, 10.13, -3.6], p.gold);
    a.shape(r, [[0, 0], [.88, -.15], [.61, -.43], [.88, -.71], [0, -.6]], .055, p.vermilion, [5.9, 10.08, -3.6]);
  },
};
