import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import type { MIDDLE_DESIGNS } from './history-designs-middle';

type P = [number, number, number];
type Art = PaperScenery;
type Build = (a: Art, r: T.Group) => void;
const TAU = Math.PI * 2;

// Construction details are shared; every dated composition below is drawn separately.
function beam(a: Art, r: T.Object3D, from: P, to: P, width: number, color: string, depth = width) {
  const v = new T.Vector3(...to).sub(new T.Vector3(...from));
  const m = a.box(r, [width, v.length(), depth], [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], color);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
  return m;
}
function disc(a: Art, r: T.Object3D, x: number, y: number, z: number, radius: number, color: string, thickness = .15) {
  const m = a.cylinder(r, radius, thickness, [x, y, z], color); m.rotation.x = Math.PI / 2; return m;
}
function rivet(a: Art, r: T.Object3D, x: number, y: number, z: number, size = .075) {
  a.mesh(r, new T.SphereGeometry(size, 8, 5), a.palette.gold, [x, y, z]);
}
function feet(a: Art, r: T.Object3D, x: number, z: number, width: number, depth: number) {
  a.box(r, [width, .16, depth], [x, .8, z], a.palette.limestone);
  a.box(r, [width - .18, .12, depth - .18], [x, .94, z], a.palette.paper);
}
function panel(a: Art, r: T.Object3D, x: number, y: number, z: number, w: number, h: number, color: string) {
  a.box(r, [w, h, .16], [x, y, z], color);
  for (const s of [-1, 1]) {
    a.box(r, [w + .06, .065, .075], [x, y + s * h / 2, z + .12], a.palette.gold);
    a.box(r, [.065, h, .075], [x + s * w / 2, y, z + .12], a.palette.gold);
  }
}
function gear(a: Art, r: T.Object3D, x: number, y: number, z: number, radius: number, teeth: number, color: string) {
  const points: [number, number][] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const t = i / (teeth * 4) * TAU, v = radius * (i % 4 < 2 ? 1 : .86);
    points.push([Math.cos(t) * v, Math.sin(t) * v]);
  }
  a.shape(r, points, .22, color, [x, y, z]);
  a.ring(r, radius * .66, .038, [x, y, z + .25], a.palette.paper);
  disc(a, r, x, y, z + .26, radius * .2, a.palette.gold);
  for (let j = 0; j < 6; j++) {
    const t = j * TAU / 6;
    beam(a, r, [x + Math.cos(t) * radius * .25, y + Math.sin(t) * radius * .25, z + .25], [x + Math.cos(t) * radius * .59, y + Math.sin(t) * radius * .59, z + .25], .065, a.palette.paper);
  }
}
function leaf(a: Art, r: T.Object3D, from: P, to: P, width: number, color: string) {
  const length = new T.Vector3(...to).distanceTo(new T.Vector3(...from));
  const m = a.shape(r, [[0, 0], [-width, length * .35], [-width * .65, length * .72], [0, length], [width * .65, length * .72], [width, length * .35]], .065, color, from);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...to).sub(new T.Vector3(...from)).normalize());
  beam(a, r, from, to, .026, a.palette.gold);
}

export const MIDDLE_MODELS: Record<keyof typeof MIDDLE_DESIGNS, Build> = {
  '2026-05-01': (a, r) => {
    const p = a.palette;
    // Formula index as a pierced harp: each suspended tab marks a retrievable passage.
    feet(a, r, -1, -1.2, 8.5, 3.4);
    a.shape(r, [[-4, 0], [-4.5, 5.8], [-3.5, 7.4], [-2.8, 7.2], [-3.5, 5.8], [-3.1, .7], [4.7, .7], [5, 0]], .5, p.forest, [-1, 1.05, -1.7]);
    a.line(r, [[-4.3, 8.3, -1.2], [-1.7, 7.7, -1.2], [1.1, 6.7, -1.2], [3.4, 5.7, -1.2]], .18, p.gold);
    for (let i = 0; i < 11; i++) {
      const x = -3.65 + i * .67, top = 8 - i * .235;
      beam(a, r, [x, 1.7, -1.1], [x, top, -1.1], .035, p.gold);
      panel(a, r, x, 3.1 + (i % 3) * .9, -.93, .42, .68, i === 6 ? p.vermilion : p.paper);
      for (let j = 0; j < 3; j++) a.box(r, [.23, .024, .03], [x, 3.04 + (i % 3) * .9 + j * .15, -.81], p.jade);
      rivet(a, r, x, top, -.9);
    }
    a.box(r, [1.1, .18, 1.4], [5.4, 1.15, .6], p.jade);
    a.line(r, [[4.1, 1.4, -1], [4.8, 2.5, 0], [5.4, 1.35, .6]], .045, p.gold);
  },
  '2026-05-02': (a, r) => {
    const p = a.palette;
    // Two unlike inlaid puzzle plates close around a single missing key.
    feet(a, r, -2.7, -1.2, 4.5, 2.8); feet(a, r, 3.2, -1.2, 3.7, 2.8);
    a.shape(r, [[-2, 0], [-2, 5.5], [1.4, 5.5], [1.4, 4.3], [.5, 4.3], [.5, 3], [1.4, 3], [1.4, 1.5], [.2, 1.5], [.2, 0]], .7, p.jade, [-2.7, 1, -1.6]);
    a.shape(r, [[-1.4, 0], [-1.4, 1.2], [-.3, 1.2], [-.3, 3.3], [-1.3, 3.3], [-1.3, 4], [0, 4], [0, 5.5], [2, 5.5], [2, 0]], .7, p.paper, [3, 1, -1.6]);
    const key = new T.Group(); key.position.set(.45, 4.2, -.6); r.add(key);
    a.shape(key, [[-.5, -1.1], [-.5, -.4], [-1, -.4], [-1, .4], [-.5, .4], [-.5, 1.1], [.5, 1.1], [.5, .4], [1, .4], [1, -.4], [.5, -.4], [.5, -1.1]], .22, p.vermilion);
    a.ring(key, .28, .035, [0, 0, .25], p.gold); a.animate(key, 'leaf');
    for (const x of [-4.35, -2.9, 3.7, 4.65]) for (let i = 0; i < 5; i++) rivet(a, r, x, 1.4 + i * 1.1, -.83);
    for (let j = 0; j < 7; j++) a.box(r, [.6, .035, .04], [-3.2, 2 + j * .5, -.84], p.gold);
    a.line(r, [[-4.8, .97, .4], [0, .97, 1.5], [5, .97, .4]], .045, p.gold);
  },
  '2026-05-03': (a, r) => {
    const p = a.palette;
    // Oversized tailoring shears trim an image sheet into a precise landscape.
    feet(a, r, 0, -.8, 9, 4.4);
    panel(a, r, -2.1, 3.4, -2.2, 4.5, 4.5, p.paper);
    a.shape(r, [[0, 0], [1.1, 2], [2.1, .9], [3.4, 2.9], [4.1, 0]], .035, p.jade, [-4.1, 1.4, -2.07]);
    disc(a, r, -3.3, 4.8, -2.03, .38, p.gold);
    for (const x of [-4.65, .45]) { beam(a, r, [x, 1.2, -1.8], [x, 2, -1.8], .09, p.vermilion); beam(a, r, [x, 1.2, -1.8], [x + (x < 0 ? .8 : -.8), 1.2, -1.8], .09, p.vermilion); }
    a.shape(r, [[0, 0], [-.25, 4.8], [.25, 6.2], [.65, 1], [.4, -.2]], .18, p.ice, [1.1, 2.3, .2]).rotation.z = -.48;
    a.shape(r, [[0, 0], [-.25, 4.8], [.25, 6.2], [.65, 1], [.4, -.2]], .18, p.paper, [1.1, 2.3, .5]).rotation.z = .32;
    a.ring(r, 1.1, .17, [-.3, 2.02, .6], p.gold); a.ring(r, .86, .17, [2.7, 1.8, .6], p.jade);
    beam(a, r, [-.05, 2.5, .6], [1.25, 3.4, .6], .24, p.gold); beam(a, r, [2.25, 2.35, .6], [1.25, 3.4, .6], .24, p.jade);
    disc(a, r, 1.25, 3.4, .84, .3, p.vermilion); rivet(a, r, 1.25, 3.4, 1.02, .13);
    for (let j = 0; j < 5; j++) a.box(r, [.8 + j * .15, .05, .45], [4.5 + j * .12, 1.02 + j * .05, -1 + j * .3], p.paper).rotation.y = j * .12;
  },
  '2026-05-04': (a, r) => {
    const p = a.palette;
    // A flat annular calendar suspended from a curved lantern arm, with one open date.
    feet(a, r, -4.7, -1, 2.1, 2.5);
    a.line(r, [[-4.7, 1, -1], [-4.7, 7, -1], [-3.8, 8.8, -1], [-.9, 9.3, -1], [1.4, 8.2, -1]], .15, p.forest);
    beam(a, r, [1.4, 8.2, -1], [1.4, 7.8, -1], .055, p.gold);
    a.ring(r, 2.85, .12, [1.4, 4.8, -1], p.gold); a.ring(r, 2.05, .07, [1.4, 4.8, -1], p.jade);
    for (let i = 0; i < 12; i++) {
      const t = i * TAU / 12, g = new T.Group(); g.position.set(1.4 + Math.sin(t) * 2.43, 4.8 + Math.cos(t) * 2.43, -.93); g.rotation.z = -t; r.add(g);
      panel(a, g, 0, 0, 0, .76, .54, i === 4 ? p.vermilion : p.paper);
      for (let k = 0; k <= i % 4; k++) a.box(g, [.055, .13, .04], [-.19 + k * .12, 0, .12], p.gold);
    }
    disc(a, r, 1.4, 4.8, -.95, .67, p.water); a.ring(r, .78, .035, [1.4, 4.8, -.85], p.paper);
    a.line(r, [[1.4, 2, -1], [1.4, 1.6, -1], [.95, 1.15, -1]], .04, p.gold);
    for (let j = 0; j < 5; j++) a.box(r, [.025, .55 + j * .06, .025], [.8 + j * .07, 1.05, -1], p.vermilion);
    a.box(r, [3.3, .15, 1.8], [3.9, .88, .7], p.paper).rotation.y = -.25;
  },
  '2026-05-05': (a, r) => {
    const p = a.palette;
    // A three-cup anemometer above a brass field desk, no clock or repeated globe.
    feet(a, r, -.8, -1.5, 2.4, 2.5);
    a.cylinder(r, .13, 6.3, [-.8, 4.1, -1.5], p.forest, .09);
    const head = new T.Group(); head.position.set(-.8, 7.2, -1.5); r.add(head);
    for (let i = 0; i < 3; i++) {
      const t = i * TAU / 3, x = Math.cos(t) * 2.3, z = Math.sin(t) * 2.3;
      beam(a, head, [0, 0, 0], [x, .1, z], .08, p.gold);
      const cup = a.mesh(head, new T.SphereGeometry(.62, 16, 8, 0, Math.PI), p.jade, [x, .1, z]); cup.rotation.y = -t;
      const lip = a.ring(head, .61, .035, [x, .1, z], p.gold); lip.rotation.y = -t;
    }
    a.animate(head, 'record');
    a.box(r, [4.6, .22, 2.7], [3.1, 2.55, -.2], p.paper).rotation.z = -.09;
    for (const x of [1.2, 5]) for (const z of [-1.1, .7]) beam(a, r, [x, .9, z], [x, 2.55, z], .12, p.jade);
    for (let i = 0; i < 7; i++) a.box(r, [.28, .07, 1.4], [1.6 + i * .48, 2.73, -.2], i === 3 ? p.vermilion : p.gold);
    a.line(r, [[-.8, 5.4, -1.5], [1.1, 5.7, -1.5], [2.5, 5.7, -1.5]], .08, p.gold);
    a.shape(r, [[0, 0], [1.3, .45], [0, .9]], .09, p.vermilion, [1.2, 5.25, -1.5]);
  },
  '2026-05-06': (a, r) => {
    const p = a.palette;
    // Three old channels merge into an elephant-trunk pipe manifold, a PostgreSQL allusion.
    feet(a, r, .6, -1.5, 10.5, 3.8);
    a.box(r, [4.3, 2.65, 2.8], [-1, 2.35, -1.6], p.jade);
    for (const x of [-2.4, .4]) a.box(r, [.6, 1.5, 1.8], [x, 1.7, -1.6], p.forest);
    disc(a, r, .3, 4, -.1, .9, p.paper); a.ring(r, .72, .055, [.3, 4, .04], p.gold);
    a.line(r, [[1.1, 3.9, -1.4], [2.25, 3.6, -1.4], [2.5, 2, -1.4], [3.2, 1.7, -1.4], [4, 2.5, -1.4]], .43, p.jade);
    for (let i = 0; i < 3; i++) {
      const x = -4 + i * 1.05;
      a.line(r, [[x, 5.2 + i * .5, -2.8], [x, 4.3, -2.8], [-1.5, 4.3, -2.8], [-1.5, 3.5, -1.4]], .16, p.gold);
      a.cylinder(r, .35, .18, [x, 5.2 + i * .5, -2.8], p.paper);
      for (let j = 0; j < 3; j++) a.cylinder(r, .29, .22, [x, 5.45 + i * .5 + j * .26, -2.8], j === 1 ? p.water : p.paper);
    }
    a.cylinder(r, 1.13, 1.4, [4.3, 1.7, -.6], p.paper);
    for (let i = 0; i < 4; i++) a.cylinder(r, 1.17, .075, [4.3, 1.13 + i * .35, -.6], p.gold);
    for (let j = 0; j < 7; j++) rivet(a, r, -2.8 + j * .62, 3.55, -.13);
    rivet(a, r, 1, 4.35, -.08, .095);
  },
  '2026-05-07': (a, r) => {
    const p = a.palette;
    // Nine individually voiced pipes on an asymmetrical organ chest.
    feet(a, r, 0, -1.3, 10.2, 3.2);
    a.box(r, [9.5, 1.3, 2.7], [0, 1.65, -1.2], p.forest);
    const heights = [3.2, 4.3, 5.5, 6.7, 7.8, 7.1, 5.9, 4.6, 3.6];
    heights.forEach((h, i) => {
      const x = -4 + i;
      a.cylinder(r, .27, h, [x, 2.1 + h / 2, -1.5], i % 3 ? p.paper : p.jade);
      for (const yy of [2.4, 2.1 + h - .24]) a.cylinder(r, .31, .1, [x, yy, -1.5], p.gold);
      a.box(r, [.24, .62, .04], [x, 2.8, -1.2], p.ink);
      a.shape(r, [[-.17, 0], [0, .18], [.17, 0]], .08, p.gold, [x, 3.13, -1.19]);
      rivet(a, r, x, 1.55, .22);
    });
    a.box(r, [6.1, .18, 1.2], [0, 1.95, .6], p.gold);
    for (let i = 0; i < 18; i++) {
      a.box(r, [.29, .12, .94], [-2.87 + i * .337, 2.1, .72], p.paper);
      if (i % 3 !== 2) a.box(r, [.13, .15, .54], [-2.71 + i * .337, 2.23, .52], p.forest);
    }
  },
  '2026-05-08': (a, r) => {
    const p = a.palette;
    // A mnemonic abacus curls from a drawer chest into an ascending memory trail.
    feet(a, r, -1.8, -1.3, 6.3, 3.5);
    a.box(r, [5.8, 3.7, 2.8], [-1.8, 2.9, -1.5], p.jade);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      panel(a, r, -3.62 + col * 1.83, 1.55 + row * .87, -.02, 1.64, .69, p.paper);
      a.ring(r, .1, .025, [-3.62 + col * 1.83, 1.55 + row * .87, .15], p.gold);
    }
    for (let j = 0; j < 5; j++) {
      const z = -2.45 + j * .48;
      a.line(r, [[-4.15, 4.85, z], [-3.5, 6.3, z], [-.8, 6.8, z], [1.1, 5.1, z], [3.3, 5.7, z], [4.8, 7.9, z]], .037, p.gold);
      for (let k = 0; k < 4; k++) {
        const x = -2.9 + k * .58, y = 6.5 + Math.sin(k * .65) * .17;
        a.mesh(r, new T.SphereGeometry(.21, 10, 6), (j + k) % 4 ? p.paper : p.vermilion, [x, y, z]);
      }
    }
    a.box(r, [1.15, .17, 1.5], [4.8, .86, -1.5], p.limestone);
    beam(a, r, [4.8, .9, -1.5], [4.8, 8, -1.5], .12, p.forest);
    a.mesh(r, new T.OctahedronGeometry(.4), p.gold, [4.8, 8.3, -1.5]);
  },
  '2026-05-09': (a, r) => {
    const p = a.palette;
    // Ribbon printer with a curved paper output, toothed rollers, and folded folios.
    feet(a, r, -1.8, -1.7, 6.5, 3.6);
    a.box(r, [5.8, 2.3, 3], [-1.8, 2.1, -1.8], p.jade);
    a.box(r, [4.9, .3, 3.3], [-1.8, 3.5, -1.8], p.paper);
    for (const x of [-4.3, .7]) {
      const end = new T.Group(); end.position.set(x, 3.65, -.1); end.rotation.y = Math.PI / 2; r.add(end);
      gear(a, end, 0, 0, 0, .94, 12, p.gold);
      a.box(r, [.4, 1.7, 1.9], [x, 2.8, -.1], p.jade);
    }
    const roller = a.cylinder(r, .78, 4.8, [-1.8, 3.65, -.1], p.forest); roller.rotation.z = Math.PI / 2;
    for (const x of [-3.9, -2.65, -1.4, -.15]) {
      const band = a.ring(r, .795, .045, [x, 3.65, -.1], p.gold); band.rotation.y = Math.PI / 2;
    }
    a.shape(r, [[0, 0], [1.7, .2], [3, 1.1], [4.1, 2.6], [4.7, 2.8], [5.4, 2.4], [5.5, 2.25], [4.7, 2.62], [4.2, 2.42], [3.1, .95], [1.7, .04], [0, -.15]], 2.5, p.paper, [.2, 3.65, -.2]);
    for (const z of [-.21, 2.31]) a.line(r, [[.2, 3.65, z], [1.9, 3.85, z], [3.2, 4.75, z], [4.3, 6.25, z], [4.9, 6.45, z], [5.6, 6.05, z]], .055, p.gold);
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * .48, y = i < 2 ? 3.78 + i * .07 : 3.92 + (i - 1) * .33;
      beam(a, r, [x, y + .04, .2], [x, y + .04, 1.8], .045, i === 2 ? p.vermilion : p.jade);
    }
    for (let i = 0; i < 10; i++) a.box(r, [.12, .025, 1.4], [-3.9 + i * .45, 3.69, -1.5], p.gold);
    panel(a, r, -2, 2.3, -.22, 2.2, .72, p.paper);
    for (let i = 0; i < 3; i++) rivet(a, r, -.4 + i * .3, 2.3, -.12, .095);
    for (let i = 0; i < 6; i++) a.box(r, [3.4, .085, 2.4], [4.6 + i * .07, 1 + i * .09, -.8], i % 2 ? p.paper : p.limestone).rotation.y = .12;
  },
  '2026-05-10': (a, r) => {
    const p = a.palette;
    // A commutator separated into a vertical chain of open, interlocking links.
    feet(a, r, -.5, -1.2, 8.1, 3.7);
    const links: P[] = [[-3.2, 2.3, -.5], [-1.7, 3.9, -.9], [.2, 5.2, -.4], [2.25, 6.6, -.8]];
    links.forEach(([x, y, z], i) => {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.z = -.6; g.rotation.y = i % 2 ? .9 : -.3; r.add(g);
      a.line(g, [[-.6, .8, 0], [-.8, .4, 0], [-.8, -.6, 0], [0, -1.1, 0], [.8, -.6, 0], [.8, .4, 0], [.5, .9, 0]], .18, i % 2 ? p.gold : p.jade);
      for (const s of [-1, 1]) disc(a, g, s * .54, .8, 0, .23, p.paper);
      if (i < 3) beam(a, r, [x, 1.1, z - .4], [x, y - .7, z - .4], .075, p.forest);
    });
    a.line(r, [[-4.2, 1.05, 1], [-1.9, 1.05, 1.4], [1.3, 1.05, 1.4], [4.4, 1.05, -.5]], .055, p.gold);
    a.shape(r, [[0, 0], [-.6, -.3], [-.45, .1], [-.85, .6]], .1, p.vermilion, [4.4, 1.05, -.5]).rotation.x = -Math.PI / 2;
    for (let j = 0; j < 4; j++) a.box(r, [.7, .1, .7], [3.7 + j * .23, 1.07 + j * .18, -2], p.paper);
  },
  '2026-05-11': (a, r) => {
    const p = a.palette;
    // A survey capstan lifts three brass specimen weights from separate chart wells.
    a.cylinder(r, 2.5, .27, [-1.8, .95, -1.4], p.paper);
    a.cylinder(r, 1.1, 2.9, [-1.8, 2.45, -1.4], p.jade);
    for (let i = 0; i < 7; i++) a.cylinder(r, 1.15, .06, [-1.8, 1.25 + i * .4, -1.4], p.gold);
    a.cylinder(r, 1.5, .22, [-1.8, 4.02, -1.4], p.paper);
    for (let j = 0; j < 4; j++) {
      const t = j * Math.PI / 2 + .3;
      beam(a, r, [-1.8, 4.2, -1.4], [-1.8 + Math.cos(t) * 3.15, 4.2, -1.4 + Math.sin(t) * 3.15], .13, p.gold);
    }
    for (let k = 0; k < 3; k++) {
      const x = 2.4 + k * 1.3, y = 2 + k * 1.6;
      a.cylinder(r, .65, .16, [x, .9, .1], p.jade);
      a.line(r, [[-1.4, 3.8, -1.4], [x, 6.5 + k * .4, -1.4], [x, y, .1]], .03, p.gold);
      a.cylinder(r, .42, .6, [x, y, .1], p.paper, .2);
      a.ring(r, .31, .04, [x, y + .46, .1], p.gold);
      beam(a, r, [x, .95, -1.5], [x, 6.5 + k * .4, -1.5], .08, p.forest);
    }
  },
  '2026-05-12': (a, r) => {
    const p = a.palette;
    // Eighteen folded compiler leaves open between two decorated concertina ends.
    feet(a, r, 0, -1.3, 10.2, 3.9);
    panel(a, r, -4.7, 3.7, -.2, 1.1, 5.3, p.jade); panel(a, r, 4.7, 3.7, -.2, 1.1, 5.3, p.vermilion);
    for (let i = 0; i < 18; i++) {
      const x = -4.1 + i * .48, z = i % 2 ? -.4 : -2.5, h = 4.5 + Math.sin(i * Math.PI / 17) * 2.2;
      const piece = a.box(r, [.065, h, 2.15], [x, 1.1 + h / 2, -1.42], i % 2 ? p.paper : p.limestone); piece.rotation.y = i % 2 ? -.2 : .2;
      beam(a, r, [x, 1.1, z], [x, 1.1 + h, z], .035, p.gold);
      rivet(a, r, x, 1.32, z + .09);
    }
    for (let j = 0; j < 8; j++) a.box(r, [.5, .23, .15], [-4.7, 1.8 + j * .53, -.02], j % 3 ? p.paper : p.gold);
    for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) rivet(a, r, 4.51 + k * .32, 2.2 + j * .85, -.01, .11);
    a.line(r, [[-4.7, 6.5, -.2], [-5.6, 6, -.2], [-5.6, 3, -.2], [-4.7, 2.5, -.2]], .1, p.gold);
  },
  '2026-05-13': (a, r) => {
    const p = a.palette;
    // A faceted navigational kite carries a single clean, unbroken address ribbon.
    feet(a, r, -2.4, -1, 2.2, 2.2);
    beam(a, r, [-2.4, 1, -1], [-.3, 7.7, -1.6], .12, p.forest);
    a.shape(r, [[0, 0], [-3, 2.4], [0, 5.3]], .12, p.jade, [0, 3.2, -1]);
    a.shape(r, [[0, 0], [3, 2.4], [0, 5.3]], .12, p.paper, [0, 3.2, -1]);
    beam(a, r, [0, 3.2, -.82], [0, 8.5, -.82], .055, p.gold); beam(a, r, [-3, 5.6, -.82], [3, 5.6, -.82], .055, p.gold);
    for (const s of [-1, 1]) a.line(r, [[0, 8.5, -.8], [s * 3, 5.6, -.8], [0, 3.2, -.8]], .045, p.gold);
    a.line(r, [[0, 3.2, -.8], [2, 2.1, -.6], [4, 2.6, -.4], [5.4, 1.5, -.2]], .045, p.vermilion);
    for (let i = 0; i < 5; i++) {
      const x = .8 + i * .9, y = 2.3 + Math.sin(i * .8) * .25;
      a.shape(r, [[0, 0], [-.45, .3], [-.45, -.3]], .055, p.paper, [x, y, -.4]); a.shape(r, [[0, 0], [.45, .3], [.45, -.3]], .055, p.gold, [x, y, -.4]);
    }
    a.ring(r, .65, .08, [4.8, 1.5, .4], p.jade); beam(a, r, [4.2, 1.2, .4], [5.4, 1.8, .4], .06, p.gold);
  },
  '2026-05-14': (a, r) => {
    const p = a.palette;
    // Two offset half-discs share a gnomon, making light and shade visible in profile.
    a.cylinder(r, 3.8, .25, [0, .95, -1.1], p.paper);
    const left = a.mesh(r, new T.CircleGeometry(3.3, 48, Math.PI / 2, Math.PI), p.forest, [0, 4.4, -1.5]); left.material = a.material(p.forest); left.material.side = T.DoubleSide;
    const right = a.mesh(r, new T.CircleGeometry(3.3, 48, -Math.PI / 2, Math.PI), p.paper, [.5, 4.4, -.8]); right.material = a.material(p.paper); right.material.side = T.DoubleSide;
    a.ring(r, 3.3, .07, [0, 4.4, -1.5], p.gold); a.ring(r, 3.3, .07, [.5, 4.4, -.8], p.gold);
    a.shape(r, [[0, 0], [0, 5.4], [3.6, 0]], .16, p.jade, [.25, 1.1, .05]).rotation.y = Math.PI / 2;
    disc(a, r, 1.7, 5.7, -.58, .66, p.gold);
    const moon = a.shape(r, [[0, -.85], [-.65, -.5], [-.95, .15], [-.7, .8], [-.15, 1], [-.4, .45], [-.3, -.2]], .1, p.paper, [-1.7, 5.4, -1.3]); moon.rotation.z = -.3;
    for (let i = 0; i < 24; i++) { const t = i * TAU / 24; beam(a, r, [Math.cos(t) * 3, 1.12, -1.1 + Math.sin(t) * 3], [Math.cos(t) * 3.4, 1.12, -1.1 + Math.sin(t) * 3.4], .03, p.gold); }
  },
  '2026-05-15': (a, r) => {
    const p = a.palette;
    // A flared broadcast horn leans over a score ribbon and a quiet breathing seat.
    feet(a, r, -2.2, -1, 3.3, 3);
    beam(a, r, [-3.3, 1, -1.5], [-2.4, 5.3, -1.5], .22, p.forest); beam(a, r, [-1.1, 1, -1.5], [-2.4, 5.3, -1.5], .22, p.forest);
    const horn = new T.Group(); horn.position.set(-2.4, 5.3, -.9); horn.rotation.z = -.75; r.add(horn);
    const profile = [[.3, 0], [.36, .6], [.52, 1.3], [.88, 2], [1.55, 2.8], [2.35, 3.3]].map(([x, y]) => new T.Vector2(x, y));
    a.mesh(horn, new T.LatheGeometry(profile, 32), p.gold).material.side = T.DoubleSide;
    const lip = a.ring(horn, 2.35, .085, [0, 3.3, 0], p.paper); lip.rotation.x = Math.PI / 2;
    a.line(r, [[-2.4, 5.3, -1], [-3.3, 4.4, -1], [-2.7, 3.1, -1], [-1.5, 2.5, -1]], .13, p.gold);
    for (let i = 0; i < 5; i++) panel(a, r, 1.5 + i * .8, 2.1 + Math.sin(i * .8) * .5, -.1, .62, 1.2, i === 2 ? p.vermilion : p.paper);
    a.box(r, [2.3, .25, 1.1], [3.2, 1.5, 1.1], p.jade); for (const x of [2.3, 4.1]) a.box(r, [.16, .65, .7], [x, 1.1, 1.1], p.forest);
    for (let j = 0; j < 4; j++) a.box(r, [.03, .025, .65], [2.6 + j * .4, 1.65, 1.1], p.gold);
  },
  '2026-05-16': (a, r) => {
    const p = a.palette;
    // A walk-through magnifier rests on a carved handle; eleven catalogue niches face it.
    beam(a, r, [-4.9, 1, -.4], [-1.5, 4.8, -.4], .65, p.forest, .55);
    for (let i = 0; i < 5; i++) beam(a, r, [-4.6 + i * .32, 1.55 + i * .36, -.08], [-4.3 + i * .32, 1.27 + i * .36, -.08], .04, p.gold);
    a.ring(r, 2.6, .24, [.3, 6.1, -.65], p.gold); a.ring(r, 2.33, .055, [.3, 6.1, -.65], p.paper);
    a.shape(r, [[-2.1, 0], [-1.3, .9], [-.3, .4], [.7, 1.8], [1.7, .7], [2.2, 0]], .18, p.water, [.3, 4.25, -.9]);
    for (let i = 0; i < 11; i++) {
      const x = 2.5 + (i % 3) * 1.45, y = 1.35 + Math.floor(i / 3) * 1.05;
      a.box(r, [1.22, .92, 1.4], [x, y, -1.8], p.paper);
      a.box(r, [.84, .49, .045], [x, y + .07, -1.06], p.forest);
      a.box(r, [.3, .065, .08], [x, y - .28, -1], p.gold);
    }
    for (const x of [-4.9, 3.7, 5.2]) a.box(r, [1.25, .2, 1.4], [x, .88, -.5], p.limestone);
    a.line(r, [[-.5, 1.1, 1.1], [1.2, 1.1, .6], [2.1, 1.1, -.3]], .045, p.vermilion);
  },
  '2026-05-17': (a, r) => {
    const p = a.palette;
    // A tall dogleg periscope peers beyond two stepped depth screens.
    feet(a, r, -2.4, -1.3, 3.4, 3.3);
    a.box(r, [1.25, 6.2, 1.2], [-2.4, 4.2, -1.3], p.jade);
    a.box(r, [3.45, 1.4, 1.4], [-1.2, 7.6, -1.3], p.paper);
    a.box(r, [2.5, 1.15, 1.4], [-3.1, 1.75, -1.3], p.paper);
    for (const y of [2.4, 4.1, 5.8, 7]) { a.box(r, [1.37, .075, 1.32], [-2.4, y, -1.3], p.gold); rivet(a, r, -2.4, y, -.6); }
    disc(a, r, -4.15, 1.8, -.42, .39, p.water); a.ring(r, .43, .07, [-4.15, 1.8, -.36], p.gold);
    disc(a, r, .15, 7.6, -.54, .48, p.ice); a.ring(r, .54, .07, [.15, 7.6, -.48], p.gold);
    a.shape(r, [[0, 0], [0, 2.2], [1.3, 2.2], [1.3, 3.8], [2.7, 3.8], [2.7, 5.3], [4.3, 5.3], [4.3, 0]], .4, p.limestone, [.8, .9, -3.1]);
    for (let j = 0; j < 3; j++) { const x = 1.4 + j * 1.4; a.box(r, [.65, .12, .9], [x, 3.14 + j * 1.55, -3], p.gold); beam(a, r, [x, 1.1, -2.65], [x, 2.8 + j * 1.5, -2.65], .035, p.paper); }
    a.line(r, [[-2.3, 6.3, -.53], [-.4, 6.8, -.53], [2, 7.5, -.53], [4.4, 8.1, -.53]], .025, p.gold);
  },
  '2026-05-18': (a, r) => {
    const p = a.palette;
    // The expanded simulator as a gently terraced cabinet of unlike mathematical specimens.
    a.shape(r, [[-5, 0], [-5, 2.1], [-2, 2.1], [-2, 4.3], [1, 4.3], [1, 6], [4.4, 6], [4.4, 0]], 2.3, p.paper, [0, .85, -2.5]);
    const solids: [T.BufferGeometry, P, string][] = [
      [new T.TetrahedronGeometry(1.3), [-3.5, 4.1, -1.3], p.jade],
      [new T.DodecahedronGeometry(1.25), [-.5, 6.25, -1.3], p.gold],
      [new T.IcosahedronGeometry(1.2), [2.7, 8.2, -1.3], p.forest],
      [new T.CylinderGeometry(.7, 1.25, 1.1, 6), [5.4, 1.5, .2], p.vermilion],
    ];
    solids.forEach(([geometry, point, color]) => { a.mesh(r, geometry, color, point); a.cylinder(r, .6, .13, [point[0], Math.max(.9, point[1] - 1.25), point[2]], p.gold); });
    for (let i = 0; i < 3; i++) {
      const x = -3.5 + i * 3.1, y = 1.55 + i * 1.75;
      panel(a, r, x, y, -.1, 1.5, .65, p.jade);
      for (let j = 0; j < 4; j++) a.box(r, [.05, .22, .03], [x - .43 + j * .28, y, .06], p.gold);
    }
    for (let i = 0; i < 9; i++) a.box(r, [.8, .16 + i * .13, .72], [-5.25 + i * .28, .92 + i * .065, .5], p.limestone);
  },
  '2026-05-19': (a, r) => {
    const p = a.palette;
    // A tilting cradle exposes three rotation axes without rendering a puzzle state.
    for (const x of [-3.6, 3.6]) {
      feet(a, r, x, -1.1, 2, 2.6); beam(a, r, [x, 1, -1.1], [x, 4.4, -1.1], .32, p.forest);
      disc(a, r, x, 4.4, -.92, .5, p.gold); rivet(a, r, x, 4.4, -.76, .13);
    }
    const cradle = new T.Group(); cradle.position.set(0, 4.4, -1.1); cradle.rotation.x = .45; r.add(cradle);
    const outer = a.ring(cradle, 3.45, .15, [0, 0, 0], p.paper); outer.rotation.y = Math.PI / 2;
    a.ring(cradle, 2.75, .14, [0, 0, 0], p.jade);
    const inner = a.ring(cradle, 2.1, .095, [0, 0, 0], p.gold); inner.rotation.x = Math.PI / 2;
    a.mesh(cradle, new T.CylinderGeometry(1.15, 1.55, .65, 8), p.paper);
    for (let i = 0; i < 8; i++) { const t = i * TAU / 8; rivet(a, cradle, Math.cos(t) * 1.38, .34, Math.sin(t) * 1.38, .09); }
    beam(a, r, [-4.8, 1.2, .1], [-3.4, 4.4, .1], .07, p.gold);
    gear(a, r, -4.65, 1.75, .25, .7, 12, p.jade); beam(a, r, [-4.65, 1.75, .5], [-5.7, 2.15, .5], .1, p.gold); rivet(a, r, -5.7, 2.15, .5, .14);
  },
  '2026-05-20': (a, r) => {
    const p = a.palette;
    // A faceted mirror quarry rises from a dense, precisely ruled 300-layer sample.
    const facets = [[-3.7, 1.8, 2.1, 3.8], [-1.4, 2.4, 1.5, 6.6], [.5, 1.7, 2, 4.8], [2.8, 2.2, 1.5, 7.6]];
    facets.forEach(([x, w, d, h], i) => {
      a.box(r, [w + .2, .2, d + .3], [x, .88, -1.5], p.limestone);
      const g = new T.Group(); g.position.set(x, 1, -1.5); g.rotation.y = (i % 2 ? .28 : -.23); r.add(g);
      a.shape(g, [[-w / 2, 0], [-w / 2, h - .6], [w / 2, h], [w / 2, 0]], d, i % 2 ? p.ice : p.jade, [0, 0, -d / 2]);
      beam(a, g, [-w / 2, 0, d / 2 + .02], [-w / 2, h - .6, d / 2 + .02], .045, p.gold);
      beam(a, g, [w / 2, 0, d / 2 + .02], [w / 2, h, d / 2 + .02], .045, p.gold);
      for (let j = 0; j < 7; j++) a.box(g, [w - .15, .033, .035], [0, .8 + j * (h - 1.3) / 7, d / 2 + .03], p.paper);
    });
    for (let i = 0; i < 30; i++) a.box(r, [3.2, .025, 1.6], [4.9, 1 + i * .047, 1.05], i % 10 === 0 ? p.gold : p.paper);
    a.line(r, [[-4.5, 1, .9], [-.9, 1, 1.2], [2.9, 1, .9]], .035, p.gold);
  },
  '2026-05-21': (a, r) => {
    const p = a.palette;
    // A phone rests in a folded cradle with two visible thin host shells.
    a.shape(r, [[-4, 0], [-2, 1.7], [0, .55], [2, 1.7], [4, 0], [2, .6], [0, .2], [-2, .6]], 3.3, p.paper, [0, .85, -2.2]);
    const phone = new T.Group(); phone.position.set(0, 1.4, -1.1); phone.rotation.z = -.12; phone.rotation.x = -.12; r.add(phone);
    panel(a, phone, 0, 3.15, 0, 3.65, 6.4, p.jade);
    a.box(phone, [3.08, 4.98, .08], [0, 3.25, .17], p.paper);
    a.box(phone, [.75, .085, .06], [0, 6.05, .2], p.gold); a.ring(phone, .21, .035, [0, .44, .2], p.gold);
    a.shape(phone, [[-1.1, 0], [0, 1.25], [1.1, 0], [0, -.4]], .055, p.water, [0, 3.2, .25]);
    for (let i = 0; i < 3; i++) a.box(phone, [1.6 - i * .22, .08, .04], [0, 2.1 - i * .35, .25], p.jade);
    for (const s of [-1, 1]) {
      const g = new T.Group(); g.position.set(s * 3.1, 1.25, -1.4); g.rotation.z = -s * .32; r.add(g);
      panel(a, g, 0, 2, 0, 1.25, 3.9, p.limestone); a.box(g, [.75, 2.7, .08], [0, 2.1, .13], p.water);
      rivet(a, g, 0, .45, .23);
    }
  },
  '2026-05-22': (a, r) => {
    const p = a.palette;
    // A broad comb sorts four independent streams into a common reading tray.
    for (const x of [-4.7, 4.7]) { feet(a, r, x, -1.4, 1.4, 3); beam(a, r, [x, 1, -1.4], [x, 6.6, -1.4], .22, p.forest); }
    a.shape(r, [[-5, 0], [-5, 1.1], [-3, 1.7], [3, 1.7], [5, 1.1], [5, 0]], .48, p.jade, [0, 5.3, -1.6]);
    for (let i = 0; i < 15; i++) {
      const x = -4.25 + i * .61;
      a.box(r, [.13, 3.1 + (i % 3) * .21, .17], [x, 4.2, -1.1], p.gold);
      rivet(a, r, x, 6.25, -.98);
    }
    for (let i = 0; i < 4; i++) {
      const x = -3.25 + i * 2.15;
      a.shape(r, [[-.7, 0], [-.7, .45], [0, .2], [.7, .45], [.7, 0]], 2.5, p.paper, [x, 1.25, -1.8]);
      for (let j = 0; j < 3; j++) a.box(r, [1.13, .075, 1.2], [x, 1.63 + j * .12, -.2 + j * .13], i === 1 ? p.water : p.paper);
      a.line(r, [[x, 2.4, -1.1], [x * .5, 1.7, .8], [0, 1.45, 1.8]], .025, p.vermilion);
    }
    a.box(r, [3.4, .2, .9], [0, 1.1, 1.9], p.jade);
  },
  '2026-05-23': (a, r) => {
    const p = a.palette;
    // A ribbon microphone, visibly woven grille, and three rising speech sails.
    feet(a, r, -2.5, -.8, 2.6, 2.8);
    a.cylinder(r, .1, 3.3, [-2.5, 2.6, -.8], p.gold);
    a.shape(r, [[-1.2, 0], [-1.7, .5], [-1.7, 3.3], [-1.2, 3.8], [1.2, 3.8], [1.7, 3.3], [1.7, .5], [1.2, 0]], .75, p.forest, [-2.5, 4.1, -1.2]);
    panel(a, r, -2.5, 6, -.4, 2.65, 3.05, p.paper);
    for (let j = 0; j < 14; j++) a.box(r, [2.35, .055, .055], [-2.5, 4.69 + j * .2, -.26], p.gold);
    for (const x of [-3.2, -2.5, -1.8]) a.box(r, [.035, 2.9, .07], [x, 6, -.22], p.jade);
    a.line(r, [[-4.3, 6.2, -.8], [-4.3, 3.9, -.8], [-2.5, 3.5, -.8], [-.7, 3.9, -.8], [-.7, 6.2, -.8]], .12, p.gold);
    for (let i = 0; i < 3; i++) {
      const x = 1.2 + i * 1.7, h = 2.2 + i * 1.25;
      a.shape(r, [[0, 0], [-.7, h * .25], [-.4, h], [.55, h * .75], [.75, h * .2]], .13, i === 1 ? p.water : p.paper, [x, 1.3, -1.4]);
      beam(a, r, [x, .85, -1.4], [x, h + 1.3, -1.4], .045, p.gold);
      a.box(r, [.85, .13, .9], [x, .92, -1.4], p.limestone);
    }
  },
  '2026-05-24': (a, r) => {
    const p = a.palette;
    // An opened double credential locket stands on a narrow clasped hinge.
    feet(a, r, 0, -1.3, 3.3, 3.2);
    a.cylinder(r, .22, 6.2, [0, 4.1, -1.3], p.gold);
    for (const s of [-1, 1]) {
      const g = new T.Group(); g.position.set(s * 2.3, 4.5, -1.3); g.rotation.y = s * .34; r.add(g);
      const casing = a.mesh(g, new T.SphereGeometry(1, 24, 12), s < 0 ? p.jade : p.paper); casing.scale.set(2.1, 2.9, .28);
      const rim = a.ring(g, 1.91, .08, [0, 0, .18], p.gold); rim.scale.y = 1.38;
      const inner = a.ring(g, 1.65, .035, [0, 0, .3], p.paper); inner.scale.y = 1.38;
      if (s < 0) { disc(a, g, 0, .55, .34, .62, p.gold); a.shape(g, [[-1.05, -1], [-.6, -.35], [.6, -.35], [1.05, -1]], .1, p.gold, [0, 0, .35]); }
      else { beam(a, g, [-1.1, -.1, .36], [-.35, -.85, .36], .17, p.jade); beam(a, g, [-.35, -.85, .36], [1.1, 1, .36], .17, p.jade); }
      for (let j = 0; j < 8; j++) rivet(a, g, Math.cos(j * TAU / 8) * 1.8, Math.sin(j * TAU / 8) * 2.5, .25, .065);
    }
    for (let i = 0; i < 5; i++) a.cylinder(r, .32, .2, [0, 2.1 + i * 1.05, -1.3], i % 2 ? p.paper : p.jade);
    a.ring(r, .72, .09, [0, 8.1, -1.3], p.gold);
  },
  '2026-05-25': (a, r) => {
    const p = a.palette;
    // A square bellows camera rests on a splayed wooden tripod beside dry snapshot plates.
    for (const foot of [[-3.5, 1, .6], [-.2, 1, .6], [-1.8, 1, -3.6]] as P[]) beam(a, r, foot, [-1.8, 4.1, -1.1], .17, p.forest);
    a.box(r, [3.8, .23, 3.5], [-1.8, 4.12, -1.2], p.gold);
    for (let i = 0; i < 9; i++) {
      const size = 2.25 + (i % 2) * .3;
      a.box(r, [size, size, .18], [-1.8, 5.55, -2.8 + i * .33], i % 2 ? p.forest : p.jade);
    }
    panel(a, r, -1.8, 5.55, .15, 3.1, 3.1, p.paper);
    disc(a, r, -1.8, 5.55, .44, .9, p.gold, .42); disc(a, r, -1.8, 5.55, .69, .7, p.water); a.ring(r, .58, .045, [-1.8, 5.55, .8], p.paper);
    a.box(r, [.75, .32, .8], [-1.8, 7.25, -1.4], p.jade);
    for (const x of [-3.05, -.55]) for (const y of [4.3, 6.8]) rivet(a, r, x, y, .27);
    for (let i = 0; i < 4; i++) {
      const g = new T.Group(); g.position.set(3.35 + i * .35, 2.4 + i * .17, -1.6 - i * .35); g.rotation.z = -.1 + i * .07; r.add(g);
      panel(a, g, 0, 0, 0, 2.4, 2.8, p.paper); a.shape(g, [[-1, -.9], [-.3, .7], [.2, .1], [.9, .8], [1, -.9]], .025, p.jade, [0, 0, .14]);
    }
  },
  '2026-05-26': (a, r) => {
    const p = a.palette;
    // The complete page migration travels on a broad paper ferry with twin outriggers.
    for (const z of [-2.8, 1.1]) a.shape(r, [[-5, .65], [-3.9, 0], [3.9, 0], [5, .65], [3.6, .4], [-3.6, .4]], .55, p.forest, [0, .9, z]);
    for (let i = 0; i < 9; i++) a.box(r, [.85, .1, 4.2], [-3.8 + i * .95, 1.6, -.7], i % 3 ? p.paper : p.gold);
    for (let i = 0; i < 7; i++) {
      const x = -3.2 + i * 1.07, h = 3.2 + Math.sin(i * Math.PI / 6) * 2.3;
      a.shape(r, [[-1.7, 0], [-1.7, h - .6], [0, h], [1.7, h - .6], [1.7, 0], [1.52, 0], [1.52, h - .76], [0, h - .2], [-1.52, h - .76], [-1.52, 0]], .15, p.paper, [x, 1.7, -2.4]).rotation.y = Math.PI / 2;
      beam(a, r, [x, 1.7, -2.4], [x, 1.7 + h - .6, -2.4], .04, p.gold);
    }
    a.line(r, [[-4.6, 2, 1.65], [-1.8, 2.2, 1.65], [1.8, 2.2, 1.65], [4.6, 2, 1.65]], .045, p.gold);
    for (const x of [-4.5, 4.5]) beam(a, r, [x, 1.45, 1.65], [x, 2.4, 1.65], .07, p.vermilion);
    for (let j = 0; j < 4; j++) a.box(r, [.8, .09, 1.1], [-4.1, 1.8 + j * .11, -.7], p.paper).rotation.y = .18;
  },
  '2026-05-27': (a, r) => {
    const p = a.palette;
    // A single faceted keystone anchors several routed foundations into the new main entrance.
    a.shape(r, [[-2.5, 0], [-3.3, 5.8], [-1.7, 7.5], [1.7, 7.5], [3.3, 5.8], [2.5, 0]], 2.2, p.paper, [0, .9, -2.5]);
    a.shape(r, [[-1.65, 0], [-2.15, 4.65], [0, 6.2], [2.15, 4.65], [1.65, 0]], .07, p.jade, [0, 1.55, -.22]);
    a.shape(r, [[-.6, 0], [-.6, 3.6], [0, 4.5], [.6, 3.6], [.6, 0]], .075, p.paper, [0, 1.55, -.12]);
    for (let i = 0; i < 5; i++) {
      const x = -5.1 + i * 2.55;
      beam(a, r, [x, .95, 1.2], [x * .23, 1.2, -.5], .29, p.limestone, .24);
      for (let j = 0; j < 3; j++) a.box(r, [.33, .14, .32], [x * (1 - j * .2), 1.03 + j * .04, 1.2 - j * .38], p.gold);
    }
    for (const s of [-1, 1]) a.line(r, [[s * 2.6, 1.2, -.12], [s * 3, 6.6, -.12], [s * 1.5, 8.05, -.12]], .045, p.gold);
    a.box(r, [7.1, .22, 3.4], [0, .81, -1.4], p.limestone);
  },
  '2026-05-28': (a, r) => {
    const p = a.palette;
    // A small paper companion rides a large wind-toy balance, paired with an open route key.
    feet(a, r, 0, -1, 3.4, 2.8); beam(a, r, [0, 1, -1], [0, 5.1, -1], .24, p.forest);
    a.cylinder(r, .82, .3, [0, 1.23, -1], p.jade); a.cylinder(r, .6, .7, [0, 1.65, -1], p.paper);
    for (const y of [1.4, 1.92]) a.cylinder(r, .65, .09, [0, y, -1], p.gold);
    for (const s of [-1, 1]) beam(a, r, [s * 1.3, 1.08, -1], [0, 3.3, -1], .12, p.gold);
    gear(a, r, 0, 3.8, -.73, .47, 9, p.jade); beam(a, r, [0, 3.8, -.4], [.65, 3.35, -.4], .1, p.gold); rivet(a, r, .65, 3.35, -.33, .12);
    const toy = new T.Group(); toy.position.set(0, 5.1, -1); r.add(toy);
    a.line(toy, [[-4, -.9, 0], [-2.3, .2, 0], [0, 0, 0], [2.5, .2, 0], [4, -.9, 0]], .085, p.gold);
    const creature = new T.Group(); creature.position.set(-2.7, .4, 0); toy.add(creature);
    a.mesh(creature, new T.SphereGeometry(1.06, 16, 10), p.paper).scale.set(1.1, .72, .75);
    a.mesh(creature, new T.SphereGeometry(.79, 16, 10), p.jade, [-.62, 1.05, .16]);
    for (const x of [-1.08, -.15]) {
      a.shape(creature, [[-.26, 0], [-.05, .78], [.3, 0]], .23, p.jade, [x, 1.58, .07]);
      a.shape(creature, [[-.13, 0], [-.025, .43], [.16, 0]], .035, p.paper, [x, 1.7, .315]);
    }
    for (const x of [-.83, -.4]) a.mesh(creature, new T.SphereGeometry(.105, 10, 6), p.ink, [x, 1.2, .86]);
    a.mesh(creature, new T.SphereGeometry(.24, 12, 8), p.paper, [-.62, .87, .91]).scale.set(1.35, .66, .35);
    a.mesh(creature, new T.ConeGeometry(.085, .13, 3), p.vermilion, [-.62, .99, 1.02]).rotation.z = Math.PI;
    a.line(creature, [[-.83, .77, .99], [-.63, .71, 1], [-.42, .77, .99]], .024, p.forest);
    for (const x of [-.65, .58]) for (const z of [-.4, .42]) {
      beam(a, creature, [x, -.3, z], [x, -.83, z], .17, p.jade);
      a.mesh(creature, new T.SphereGeometry(.19, 10, 6), p.paper, [x - .07, -.82, z + .05]).scale.set(1.2, .6, 1);
    }
    a.line(creature, [[.95, .15, 0], [1.6, .7, -.1], [1.52, 1.5, -.1], [1.12, 1.65, 0]], .17, p.jade);
    a.line(creature, [[-1.2, .47, .35], [-.65, .4, .73], [-.02, .46, .42]], .065, p.gold);
    a.shape(creature, [[0, 0], [.3, -.57], [.6, -.37], [.24, .12]], .07, p.vermilion, [-.4, .42, .74]);
    a.shape(toy, [[0, 0], [1.1, .5], [.1, 2.2], [-.5, 1.4]], .09, p.vermilion, [2.6, .1, 0]);
    beam(a, toy, [2.6, -.2, 0], [2.6, 2.3, 0], .045, p.gold); a.animate(toy, 'leaf');
    a.line(r, [[-3.2, 1.2, .7], [-3.2, 2.5, .7], [-1.4, 2.5, .7], [-1.4, 1.2, .7], [1.4, 1.2, .7], [1.4, 2.5, .7], [3.2, 2.5, .7]], .13, p.jade);
  },
  '2026-05-29': (a, r) => {
    const p = a.palette;
    // A branching rail viaduct exposes three viable routes and a mechanical switch lever.
    const routes: P[][] = [
      [[-5.5, 1.8, 1.3], [-2.6, 2.4, .3], [0, 3, -.5], [4.8, 4.2, -3]],
      [[-5.5, 1.8, 1.3], [-2.6, 2.4, .3], [0, 4.8, -.3], [4.8, 6.3, -1]],
      [[-5.5, 1.8, 1.3], [-2.6, 2.4, .3], [0, 2, 1.2], [4.8, 2.3, 1.5]],
    ];
    routes.forEach((points, route) => {
      const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
      for (const side of [-1, 1]) a.line(r, points.map(([x, y, z]) => [x, y + .08, z + side * .27] as P), .095, p.gold);
      for (let j = route === 0 ? 0 : 6; j < 18; j++) {
        const point = curve.getPoint(j / 17), tangent = curve.getTangent(j / 17), { x, y, z } = point;
        const sleeper = a.box(r, [.24, .16, 1.02], [x, y - .04, z], p.forest); sleeper.rotation.y = -Math.atan2(tangent.z, tangent.x);
        if (j < 17) {
          const next = curve.getPoint((j + 1) / 17);
          beam(a, r, [x, y - .19, z], [next.x, next.y - .19, next.z], .17, p.paper, .87);
        }
        if (j % 4 === 1) {
          a.box(r, [.8, .16, 1.2], [x, .91, z], p.limestone);
          beam(a, r, [x, 1, z], [x, y - .28, z], .24, p.jade);
          a.box(r, [.6, .16, 1.02], [x, y - .3, z], p.gold);
          if (y > 3) beam(a, r, [x, 1.5, z], [x - .8, y - .35, z], .09, p.gold);
        }
      }
    });
    a.box(r, [1.5, .23, 1.4], [-2.6, 1.02, -.9], p.paper); beam(a, r, [-2.6, 1.2, -.9], [-3.4, 3.7, -.9], .12, p.forest); disc(a, r, -3.4, 3.7, -.75, .32, p.vermilion);
    for (let i = 0; i < 3; i++) { const y = [4.4, 6.55, 2.5][i], z = [-3, -1, 1.5][i]; a.box(r, [.75, .4, .64], [4.6, y, z], i === 1 ? p.vermilion : p.jade); }
  },
  '2026-05-30': (a, r) => {
    const p = a.palette;
    // A news bell in a forked belfry, with thin curling announcement banners.
    for (const x of [-3.1, 3.1]) {
      feet(a, r, x, -1.5, 1.6, 2.5); a.box(r, [.55, 5.9, .7], [x, 3.95, -1.5], p.forest);
      a.box(r, [.85, .22, .94], [x, 6.9, -1.5], p.gold);
    }
    beam(a, r, [-3.4, 7.2, -1.5], [3.4, 7.2, -1.5], .35, p.paper);
    a.shape(r, [[-3.9, 0], [0, 2], [3.9, 0], [3.5, -.2], [0, 1.5], [-3.5, -.2]], .65, p.jade, [0, 7.2, -1.8]);
    a.cylinder(r, .13, 1.05, [0, 6.85, -1.5], p.gold);
    const bell = new T.Group(); bell.position.set(0, 4.4, -1.5); r.add(bell);
    const profile = [[1.9, 0], [1.85, .2], [1.3, .6], [.95, 1.3], [.8, 2.1], [.35, 2.35]].map(([x, y]) => new T.Vector2(x, y));
    a.mesh(bell, new T.LatheGeometry(profile, 32), p.gold).material.side = T.DoubleSide;
    for (const yy of [.08, .25, 1.7]) { const rr = yy < .3 ? 1.86 : .9; const ring = a.ring(bell, rr, .045, [0, yy, 0], p.paper); ring.rotation.x = Math.PI / 2; }
    a.mesh(bell, new T.SphereGeometry(.25, 12, 8), p.vermilion, [0, -.08, 0]);
    a.line(r, [[0, 4.3, -1.5], [.4, 2.7, -.8], [.2, 1.1, .1]], .04, p.gold);
    for (const s of [-1, 1]) {
      a.shape(r, [[0, 0], [s * 2, -.4], [s * 3.2, -1.7], [s * 2.5, -1.2], [s * 1.4, -.15], [0, .6]], .075, p.paper, [s * 3.1, 5.6, -.7]);
      // The belfry has real depth: mortised braces support the bell axle and news banners.
      beam(a, r, [s * 3.1, 4.9, -1.5], [s * 1.2, 7.2, -1.5], .14, p.gold);
      beam(a, r, [s * 3.1, 1.05, -3.1], [s * 3.1, 5.9, -1.5], .18, p.forest);
      disc(a, r, s * 3.1, 6.55, -.98, .3, p.gold);
      for (let j = 0; j < 3; j++) beam(a, r, [s * (3.55 + j * .65), 5.48 - j * .25, -.59], [s * (4.1 + j * .65), 5.34 - j * .29, -.59], .04, p.jade);
    }
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12;
      a.line(bell, [[Math.cos(angle) * 1.72, .32, Math.sin(angle) * 1.72], [Math.cos(angle) * 1.16, .92, Math.sin(angle) * 1.16], [Math.cos(angle) * .85, 1.8, Math.sin(angle) * .85]], .025, p.paper);
    }
    const striker = a.cylinder(r, .22, 3.5, [1.1, 4.9, .8], p.forest); striker.rotation.z = Math.PI / 2;
    for (const x of [-.15, 2.35]) {
      a.line(r, [[x, 7.2, -1.5], [x, 6.1, .4], [x, 4.9, .8]], .025, p.gold);
      const binding = a.ring(r, .235, .055, [x, 4.9, .8], p.gold); binding.rotation.y = Math.PI / 2;
    }
  },
  '2026-05-31': (a, r) => {
    const p = a.palette;
    // A visible crankshaft joins separate cylinders into one compact engine bed.
    feet(a, r, 0, -1.2, 10.3, 3.9);
    a.box(r, [9.8, .65, 3.2], [0, 1.35, -1.2], p.jade);
    for (let i = 0; i < 3; i++) {
      const x = -2.8 + i * 2.7;
      a.cylinder(r, .8, 2.65, [x, 3, -1.7], p.paper);
      for (let j = 0; j < 5; j++) a.cylinder(r, .85, .075, [x, 1.9 + j * .53, -1.7], p.gold);
      beam(a, r, [x, 4.35, -1.7], [x + .5, 5.5, -.65], .16, p.forest);
      disc(a, r, x + .5, 5.5, -.65, .43, p.gold);
      rivet(a, r, x + .5, 5.5, -.36, .13);
    }
    const crank = a.cylinder(r, .14, 8.5, [0, 5.5, -.6], p.gold); crank.rotation.z = Math.PI / 2;
    gear(a, r, 4.1, 4.25, -.55, 1.35, 18, p.forest);
    gear(a, r, -4, 2.7, .35, .7, 10, p.gold);
    a.line(r, [[-3.5, 4.3, -1.7], [-4.5, 4.8, -1.7], [-4.5, 7, -1.7], [-3.8, 7.4, -1.7]], .2, p.jade);
    for (let i = 0; i < 7; i++) rivet(a, r, -4.3 + i * 1.4, 1.45, .45);
  },
  '2026-06-01': (a, r) => {
    const p = a.palette;
    // Two unequal race metronomes share a fine timing rail but keep independent pendulums.
    for (const [x, h, tilt] of [[-2.8, 6.5, -.32], [2.6, 5.3, .36]]) {
      feet(a, r, x, -1.2, 3.3, 3.1);
      a.shape(r, [[-1.55, 0], [-.72, h], [.72, h], [1.55, 0]], 1.7, p.jade, [x, 1, -2]);
      a.shape(r, [[-1.12, 0], [-.5, h - .7], [.5, h - .7], [1.12, 0]], .05, p.paper, [x, 1.4, -.24]);
      const g = new T.Group(); g.position.set(x, 2, -.02); g.rotation.z = tilt; r.add(g);
      beam(a, g, [0, -.5, 0], [0, h - .65, 0], .055, p.gold);
      a.box(g, [.55, .65, .16], [0, h * .52, .05], p.vermilion);
      disc(a, r, x, 2, .07, .3, p.gold); rivet(a, r, x, 2, .23, .09);
      for (let i = 0; i < 9; i++) a.box(r, [.3 + (i % 3 === 0 ? .2 : 0), .025, .045], [x, 2.65 + i * (h - 2) / 9, -.12], p.forest);
      a.box(r, [1.1, .22, .07], [x, 1.45, -.14], p.gold);
    }
    beam(a, r, [-4.5, .97, 1], [4.5, .97, 1], .05, p.gold);
    for (let j = 0; j < 16; j++) a.box(r, [.045, .08, .4], [-4.3 + j * .57, 1.03, 1], j % 4 ? p.paper : p.vermilion);
  },
  '2026-06-02': (a, r) => {
    const p = a.palette;
    // A tall laurel ladder records years as brass rungs, rising from a low archive bench.
    for (const s of [-1, 1]) {
      a.line(r, [[s * 2.8, .9, -.5], [s * 2.6, 3, -1], [s * 2.1, 6, -1.5], [s * .9, 8.4, -2]], .13, p.forest);
      for (let j = 0; j < 6; j++) {
        const y = 1.8 + j * .98, x = s * (2.8 - j * .18);
        leaf(a, r, [x, y, -.9 - j * .13], [x + s * (1.3 - j * .08), y + .78, -.7 - j * .13], .36, j % 2 ? p.jade : p.gold);
      }
    }
    for (let i = 0; i < 8; i++) {
      const y = 1.4 + i * .86, w = 4.8 - i * .25, z = -.7 - i * .15;
      a.box(r, [w, .13, .5], [0, y, z], p.paper);
      panel(a, r, 0, y + .25, z + .3, .7, .3, i === 7 ? p.vermilion : p.jade);
    }
    a.box(r, [7.7, .25, 2.3], [0, .87, -.5], p.limestone);
    for (const x of [-4.8, 4.8]) {
      a.box(r, [1.1, .9, 1.5], [x, 1.4, -.1], p.paper);
      for (let i = 0; i < 5; i++) a.box(r, [.8, .025, .03], [x, 1.15 + i * .14, .68], p.gold);
    }
  },
  '2026-06-03': (a, r) => {
    const p = a.palette;
    // An asymmetric four-sail windmill turns over a small tray of today's lucky draw.
    a.shape(r, [[-1.8, 0], [-1.05, 5.3], [.8, 5.7], [1.65, 0]], 2.4, p.paper, [-1.3, .9, -2.6]);
    a.box(r, [1.05, 1.8, .06], [-1.3, 1.82, -.14], p.jade);
    a.line(r, [[-3.3, 1, -.08], [-2.5, 4.4, -.08], [-2.15, 6.2, -.08]], .055, p.gold);
    const sails = new T.Group(); sails.position.set(-1.3, 5.3, .02); sails.rotation.z = .25; r.add(sails);
    for (let i = 0; i < 4; i++) {
      const g = new T.Group(); g.rotation.z = i * Math.PI / 2; sails.add(g);
      beam(a, g, [0, 0, 0], [0, 3.6, 0], .065, p.gold);
      a.shape(g, [[.1, 1], [.95, 1.45], [.95, 3.6], [.1, 3.1]], .075, i % 2 ? p.paper : p.jade);
      for (let j = 0; j < 5; j++) beam(a, g, [.1, 1.32 + j * .39, .1], [.94, 1.76 + j * .39, .1], .025, p.gold);
    }
    disc(a, r, -1.3, 5.3, .24, .32, p.vermilion);
    a.box(r, [3.2, .35, 2.2], [3.5, 1.12, -.5], p.jade);
    for (let j = 0; j < 5; j++) a.box(r, [.5, .13, 1.5], [2.3 + j * .57, 1.4, -.5], j === 2 ? p.gold : p.paper).rotation.z = j === 2 ? .3 : 0;
    for (const z of [-1.4, .4]) a.box(r, [3.4, .1, .08], [3.5, 1.4, z], p.gold);
  },
  '2026-06-04': (a, r) => {
    const p = a.palette;
    // An old serpentine ribbon is cleanly released from an empty winding spindle.
    const path: P[] = [];
    for (let i = 0; i <= 42; i++) { const t = i / 42 * Math.PI * 3.5; path.push([-1.5 + Math.cos(t) * (2.8 - i * .035), 1.35 + i * .11, -1.2 + Math.sin(t) * 1.15]); }
    a.line(r, path, .26, p.jade);
    const end = path[path.length - 1];
    a.shape(r, [[-.5, 0], [-.55, .45], [0, .9], [.55, .45], [.5, 0]], .35, p.jade, [end[0], end[1], end[2] - .1]);
    rivet(a, r, end[0] - .2, end[1] + .48, end[2] + .3, .055); rivet(a, r, end[0] + .2, end[1] + .48, end[2] + .3, .055);
    for (let i = 2; i < path.length; i += 4) a.ring(r, .29, .027, path[i], p.gold).rotation.y = i * .17;
    a.cylinder(r, .16, 5.6, [3.6, 3.8, -1.6], p.forest);
    for (const y of [1.1, 6.5]) a.cylinder(r, 1.15, .17, [3.6, y, -1.6], p.paper);
    a.shape(r, [[0, 0], [.8, .5], [1.3, 1.6], [1.8, 1.2], [2.5, 1.4], [2.9, 1], [2.3, 1.1], [1.7, .9], [1.3, 1.3], [.9, .2]], .9, p.paper, [.7, 1.3, -.3]);
    a.box(r, [2.5, .16, 2.7], [3.6, .87, -1.6], p.limestone);
  },
  '2026-06-05': (a, r) => {
    const p = a.palette;
    // A large open daily folio displays two different paper landscapes across its gutter.
    for (let i = 0; i < 9; i++) {
      const d = i * .075;
      a.shape(r, [[-5, .3], [-2.8, .7], [0, 0], [2.8, .7], [5, .3], [5, .42], [2.8, .84], [0, .14], [-2.8, .84], [-5, .42]], 4, i % 3 ? p.paper : p.limestone, [0, 1.1 + d, -2.9]);
    }
    beam(a, r, [0, 1.85, -3], [0, 1.85, 1.3], .1, p.gold);
    a.shape(r, [[0, 0], [.9, 1.6], [1.6, .8], [2.6, 2.5], [3.6, 0]], .45, p.jade, [-4.2, 2.07, -1.8]);
    disc(a, r, -3.7, 4.5, -1.8, .48, p.gold);
    for (let j = 0; j < 5; j++) {
      const x = 1.1 + j * .72;
      a.box(r, [.5, .35 + j * .34, .85], [x, 2.25 + j * .17, -1.9], j % 2 ? p.water : p.paper);
      a.box(r, [.53, .07, .9], [x, 2.46 + j * .34, -1.9], p.gold);
    }
    for (let i = 0; i < 6; i++) a.box(r, [2.65, .018, .055], [-2.5, 2.14 - i * .022, -.3 + i * .2], p.gold);
    a.shape(r, [[-.17, 0], [-.17, -1.5], [0, -1.2], [.17, -1.5], [.17, 0]], .05, p.vermilion, [.1, 1.95, 1.2]);
  },
  '2026-06-06': (a, r) => {
    const p = a.palette;
    // An open horseshoe forum has many individual seats and a shared low speaking stage.
    for (let tier = 0; tier < 4; tier++) {
      const radius = 3.1 + tier * .72;
      for (let i = 0; i < 14; i++) {
        const t = Math.PI * .08 + i / 13 * Math.PI * .84, x = Math.cos(t) * radius, z = -Math.sin(t) * radius + .9;
        const seat = a.box(r, [.83, .35 + tier * .55, .67], [x, 1.05 + tier * .275, z], tier % 2 ? p.paper : p.limestone); seat.rotation.y = -t;
        if (i % 2 === 0) { const cap = a.box(r, [.65, .075, .56], [x, 1.29 + tier * .55, z], p.jade); cap.rotation.y = -t; }
      }
    }
    a.cylinder(r, 1.65, .25, [0, 1.03, .4], p.paper);
    a.shape(r, [[-.6, 0], [-1.1, 1.4], [-.8, 2.1], [.8, 2.1], [1.1, 1.4], [.6, 0]], .65, p.jade, [0, 1.2, .1]);
    a.box(r, [1.5, .16, 1], [0, 3.35, .45], p.gold).rotation.x = -.15;
    for (const s of [-1, 1]) {
      beam(a, r, [s * 5.7, .95, -.6], [s * 5.7, 5.8, -.6], .12, p.forest);
      a.shape(r, [[0, 0], [s * 1.5, -.3], [s * 1.1, -1.7], [0, -1.4]], .07, p.vermilion, [s * 5.7, 5.5, -.6]);
    }
    for (let j = 0; j < 3; j++) a.box(r, [1.5, .12, .42], [0, 1 + j * .12, 2 - j * .4], p.paper);
  },
  '2026-06-07': (a, r) => {
    const p = a.palette;
    // An angled copy stamp leaves two crisp identical imprints on an unrolled receipt.
    feet(a, r, -2.3, -1.2, 4.5, 3.1);
    const stamp = new T.Group(); stamp.position.set(-2.3, 2.2, -1.2); stamp.rotation.z = -.28; r.add(stamp);
    a.box(stamp, [3.4, .34, 2.3], [0, 0, 0], p.gold); a.box(stamp, [3.1, .14, 2.1], [0, -.23, 0], p.vermilion);
    a.cylinder(stamp, .52, 2.2, [0, 1.2, 0], p.jade, .36);
    a.mesh(stamp, new T.SphereGeometry(1, 20, 10), p.forest, [0, 2.6, 0]).scale.set(1.15, .62, .8);
    for (let i = 0; i < 6; i++) a.cylinder(stamp, .5 - i * .016, .035, [0, .4 + i * .23, 0], p.gold);
    a.shape(r, [[0, 0], [0, .2], [5.5, .2], [6.2, .8], [6.6, .65], [6.9, .3], [6.8, .1], [6.5, .45], [6.2, .56], [5.6, 0]], 2.6, p.paper, [-.4, .99, -1.9]);
    for (let k = 0; k < 2; k++) {
      const x = 1.1 + k * 2.3;
      a.box(r, [1.6, .03, 1.65], [x, 1.22, -.6], p.vermilion);
      a.box(r, [1.37, .035, 1.42], [x, 1.24, -.6], p.paper);
      for (let j = 0; j < 4; j++) a.box(r, [1.02 - (j % 2) * .27, .04, .085], [x, 1.27, -.98 + j * .25], p.vermilion);
    }
    a.box(r, [2, .15, 1.4], [4.8, 1, -3.2], p.jade); a.box(r, [1.7, .04, 1.1], [4.8, 1.1, -3.2], p.forest);
    // Copying results is legible as a working stamp: carved die, fastening screws and hinged ink lid.
    for (const x of [-1.33, 1.33]) for (const z of [-.82, .82]) rivet(a, stamp, x, .2, z, .1);
    for (let j = 0; j < 4; j++) a.box(stamp, [2.15 - (j % 2) * .5, .075, .09], [0, -.34, -.66 + j * .42], p.paper);
    for (const z of [-1.1, 1.1]) a.box(stamp, [3.5, .12, .08], [0, .14, z], p.paper);
    const lid = new T.Group(); lid.position.set(4.8, 1.15, -3.9); lid.rotation.x = .95; r.add(lid);
    a.box(lid, [2, .14, 1.45], [0, 0, -.72], p.jade);
    a.box(lid, [1.64, .05, 1.08], [0, .1, -.72], p.paper);
    for (const x of [-.6, .6]) {
      const hinge = a.cylinder(r, .12, .36, [4.8 + x, 1.16, -3.9], p.gold); hinge.rotation.z = Math.PI / 2;
    }
    a.line(r, [[-.2, 1.27, .85], [2.3, 1.27, .85], [5.4, 1.27, .85]], .025, p.gold);
  },
  '2026-06-08': (a, r) => {
    const p = a.palette;
    // A high straight truss bridge, intentionally distinct from the landscape's arched footbridges.
    for (const x of [-4.7, 4.7]) {
      a.box(r, [2.7, 2.5, 3.7], [x, 2.05, -1.3], p.limestone);
      for (let i = 0; i < 4; i++) a.box(r, [2.8, .045, 3.75], [x, 1.15 + i * .6, -1.3], p.paper);
    }
    for (let i = 0; i < 24; i++) a.box(r, [.47, .18, 2.5], [-5.4 + i * .47, 3.4, -1.3], p.paper);
    for (const z of [-2.6, 0]) {
      beam(a, r, [-5.6, 3.55, z], [5.6, 3.55, z], .16, p.jade);
      beam(a, r, [-5.6, 5.75, z], [5.6, 5.75, z], .16, p.jade);
      for (let i = 0; i < 7; i++) {
        const x = -5.5 + i * 1.83;
        beam(a, r, [x, 3.55, z], [x, 5.75, z], .105, p.gold);
        if (i < 6) beam(a, r, [x, i % 2 ? 5.75 : 3.55, z], [x + 1.83, i % 2 ? 3.55 : 5.75, z], .09, p.gold);
        for (const y of [3.55, 5.75]) rivet(a, r, x, y, z + .11, .08);
      }
    }
    for (const x of [-5.5, 5.5]) beam(a, r, [x, 5.75, -2.6], [x, 5.75, 0], .15, p.paper);
    for (let i = 0; i < 5; i++) a.box(r, [1.45, .6 - i * .1, .55], [-6.3, 1.15 + (4 - i) * .5, -1.3 + i * .55], p.paper);
  },
  '2026-06-09': (a, r) => {
    const p = a.palette;
    // A core-sampling mast probes through exposed strata, showing depth as physical layers.
    for (const x of [-2.3, 2.3]) beam(a, r, [x, .95, -1.5], [x * .55, 8.7, -1.5], .2, p.forest);
    beam(a, r, [-1.3, 8.7, -1.5], [1.3, 8.7, -1.5], .25, p.gold);
    for (let j = 0; j < 6; j++) {
      const y = 1.25 + j * .48, width = 5.2 - j * .3;
      a.box(r, [width, .36, 2.2], [0, y, -1.5], j % 2 ? p.paper : p.limestone);
      a.box(r, [.6, .39, 2.3], [0, y, -1.5], p.forest);
    }
    a.cylinder(r, .18, 5.9, [0, 5.4, -1.35], p.gold);
    const spiral: P[] = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80 * TAU * 6; spiral.push([Math.cos(t) * .47, 3.1 + i * .045, -1.35 + Math.sin(t) * .47]); }
    a.line(r, spiral, .065, p.paper);
    a.cylinder(r, .58, .9, [0, 7.8, -1.35], p.jade);
    gear(a, r, 2.1, 5.2, -.3, .92, 14, p.gold);
    a.line(r, [[0, 8.3, -1.35], [2.1, 8.3, -1.35], [2.1, 5.2, -.3]], .035, p.gold);
    for (let i = 0; i < 3; i++) a.cylinder(r, .35, 1 + i * .55, [4.4 + i * .75, 1.35 + i * .275, -.4], [p.clay, p.sand, p.jade][i]);
  },
  '2026-06-10': (a, r) => {
    const p = a.palette;
    // Five differently cut wards branch from one large solver key laid across a trestle.
    for (const x of [-3.3, 3.4]) {
      beam(a, r, [x - .6, .9, -.4], [x, 3.4, -1.4], .2, p.jade); beam(a, r, [x + .6, .9, -2.4], [x, 3.4, -1.4], .2, p.jade);
      a.box(r, [1.8, .2, 2.8], [x, 3.35, -1.4], p.paper);
    }
    a.ring(r, 1.75, .28, [-4.2, 4.4, -.7], p.gold);
    beam(a, r, [-2.8, 4.4, -.7], [5.1, 4.4, -.7], .34, p.gold);
    const wards = [2.4, 3.5, 2.9, 4.3, 3.3];
    wards.forEach((h, i) => {
      const x = -.9 + i * 1.35;
      a.shape(r, [[-.18, 0], [-.18, h], [.75, h], [.75, h - .45], [.2, h - .45], [.2, h - 1.05], [.6, h - 1.05], [.6, h - 1.45], [.18, h - 1.45], [.18, 0]], .28, i % 2 ? p.jade : p.paper, [x, 4.4, -.83]);
      rivet(a, r, x, 4.4, -.38, .11);
    });
    for (let j = 0; j < 7; j++) a.box(r, [.05, .055, .5], [-2.4 + j * .31, 4.62, -.7], p.paper);
  },
  '2026-06-11': (a, r) => {
    const p = a.palette;
    // A half-toothed escapement makes the half-turn subgroup visible as a mechanism.
    feet(a, r, 0, -1.4, 8.7, 3.5);
    for (const x of [-2.8, 2.8]) { a.box(r, [.5, 3.3, 1.1], [x, 2.65, -1.4], p.jade); a.box(r, [1, .2, 1.4], [x, 4.4, -1.4], p.gold); }
    a.ring(r, 3.1, .19, [0, 4.55, -.9], p.paper);
    for (let i = 0; i < 18; i++) {
      const t = Math.PI * i / 17;
      const tooth = a.box(r, [.34, .45, .27], [Math.cos(t) * 3.17, 4.55 + Math.sin(t) * 3.17, -.9], p.gold); tooth.rotation.z = t - Math.PI / 2;
    }
    for (const t of [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI]) beam(a, r, [0, 4.55, -.9], [Math.cos(t) * 2.9, 4.55 + Math.sin(t) * 2.9, -.9], .13, p.jade);
    a.shape(r, [[-2.85, 0], [-2.2, -1.7], [0, -2.8], [2.2, -1.7], [2.85, 0]], .35, p.jade, [0, 4.55, -1.1]);
    disc(a, r, 0, 4.55, -.56, .62, p.gold); rivet(a, r, 0, 4.55, -.34, .18);
    gear(a, r, 3.8, 6.6, -.7, .85, 12, p.vermilion);
    beam(a, r, [3.8, 6.6, -.5], [5.2, 7.5, -.5], .1, p.gold);
    a.box(r, [1.4, .2, 1.2], [-4.3, 1.06, .2], p.paper);
  },
  '2026-06-12': (a, r) => {
    const p = a.palette;
    // Five carefully folded fingers hold one small light: a sculpture of support.
    const palm: [number, number][] = [[-1.15, 0], [-1.28, 1.9], [-2.05, 2.65], [-2.25, 3.85], [-1.65, 4.25], [1.85, 4.25], [2.35, 3.8], [1.95, 2.6], [1.05, 1.7], [1.08, 0]];
    a.shape(r, palm, .9, p.jade, [-.2, 1.02, -1.75]);
    a.shape(r, palm, .16, p.paper, [-.2, 1.02, -.85]);
    for (const y of [1.4, 1.65, 1.9]) a.box(r, [2.25, .06, 1.13], [-.22, y, -1.21], p.gold);
    const fingers = [
      { x: -1.57, h: 3.45, w: .8, tilt: .16 },
      { x: -.43, h: 4.1, w: .84, tilt: .025 },
      { x: .72, h: 3.82, w: .8, tilt: -.085 },
      { x: 1.75, h: 2.93, w: .7, tilt: -.2 },
    ];
    for (const { x, h, w, tilt } of fingers) {
      const finger = new T.Group(); finger.position.set(x, 4.75, -1.75); finger.rotation.z = tilt; r.add(finger);
      const outline: [number, number][] = [[-w / 2, 0], [-w / 2, h - .36], [-w * .3, h - .06], [0, h], [w * .3, h - .06], [w / 2, h - .36], [w / 2, 0]];
      a.shape(finger, outline, .63, p.limestone);
      a.shape(finger, outline, .13, p.paper, [0, 0, .63]);
      for (const y of [h * .33, h * .65]) {
        a.box(finger, [w * .86, .06, .035], [0, y, .79], p.gold);
        a.box(finger, [w * .69, .035, .035], [0, y + .14, .79], p.jade);
      }
      a.shape(finger, [[-w * .28, 0], [-w * .28, .45], [-w * .12, .61], [w * .12, .61], [w * .28, .45], [w * .28, 0]], .035, p.limestone, [0, h - .86, .78]);
    }
    const thumb = new T.Group(); thumb.position.set(-1.78, 3.38, -.6); thumb.rotation.z = .71; r.add(thumb);
    const thumbEdge: [number, number][] = [[-.55, 0], [-.51, 2.35], [-.33, 2.98], [.05, 3.18], [.38, 2.93], [.51, 2.42], [.48, .45], [.28, 0]];
    a.shape(thumb, thumbEdge, .55, p.limestone);
    a.shape(thumb, thumbEdge, .14, p.paper, [0, 0, .55]);
    for (const y of [1.1, 2.05]) a.box(thumb, [.84, .065, .04], [0, y, .73], p.gold);
    a.shape(thumb, [[-.23, 0], [-.22, .48], [0, .63], [.23, .48], [.23, 0]], .04, p.limestone, [0, 2.35, .72]);
    a.line(r, [[-1.78, 4.36, -.62], [-.85, 4.05, -.61], [.42, 4.24, -.61], [1.55, 4.71, -.61]], .055, p.gold);
    a.line(r, [[-1.3, 3.75, -.61], [-.55, 3.25, -.61], [.96, 3.4, -.61]], .035, p.jade);
    a.line(r, [[-1.48, 4.17, -.61], [-1.13, 3.45, -.61], [-1.06, 2.7, -.61]], .045, p.gold);
    a.cylinder(r, 1, .18, [-.3, 5.28, .6], p.gold);
    a.cylinder(r, .78, .1, [-.3, 5.42, .6], p.jade);
    for (let i = 0; i < 6; i++) { const t = i * TAU / 6; beam(a, r, [-.3 + Math.cos(t) * .64, 5.46, .6 + Math.sin(t) * .64], [-.3 + Math.cos(t) * .48, 7.03, .6 + Math.sin(t) * .48], .07, p.gold); }
    a.cylinder(r, .66, .1, [-.3, 7.04, .6], p.gold);
    a.mesh(r, new T.ConeGeometry(.76, .8, 6), p.jade, [-.3, 7.48, .6]);
    a.mesh(r, new T.SphereGeometry(.28, 12, 8), p.vermilion, [-.3, 6.22, .6]).scale.y = 1.8;
    a.ring(r, .19, .045, [-.3, 8.04, .6], p.gold);
    feet(a, r, -.2, -1.2, 3.8, 3.1);
  },
  '2026-06-13': (a, r) => {
    const p = a.palette;
    // Change monitoring as a weather vane with three suspended before-and-after slates.
    a.cylinder(r, .15, 7.2, [-1.5, 4.55, -1.5], p.forest);
    feet(a, r, -1.5, -1.5, 2.3, 2.4);
    beam(a, r, [-4.9, 7.5, -1.5], [2.4, 7.5, -1.5], .08, p.gold);
    a.shape(r, [[0, 0], [-1.1, -.5], [-.8, 0], [-1.1, .5]], .08, p.vermilion, [-4.9, 7.5, -1.5]);
    a.shape(r, [[0, 0], [1.6, -.6], [1.4, .6]], .07, p.jade, [.8, 7.5, -1.5]);
    a.shape(r, [[0, 0], [-.5, .8], [-1.6, .7], [-.5, 1.2], [.1, 2.1], [.3, 1.1], [1.5, .65], [.45, .7], [.1, 0]], .13, p.paper, [-1.5, 7.6, -1.5]);
    a.ring(r, .45, .06, [-1.5, 6.75, -1.5], p.gold);
    for (let i = 0; i < 3; i++) {
      const x = 1.2 + i * 1.5, y = 2 + i * 1.1;
      beam(a, r, [x, y + .9, -1], [x, 6.25, -1], .03, p.gold);
      panel(a, r, x, y, -1, 1.25, 1.75, p.paper);
      a.box(r, [.7, .075, .04], [x, y + .32, -.84], p.jade); a.box(r, [.85, .075, .04], [x, y - .25, -.84], p.vermilion);
    }
    beam(a, r, [-1.5, 6.25, -1], [4.9, 6.25, -1], .1, p.gold);
    a.box(r, [7.5, .1, 1.3], [1, .9, -.6], p.limestone);
  },
  '2026-06-14': (a, r) => {
    const p = a.palette;
    // A broad two-pronged tuning fork releases the discarded third reed at its base.
    feet(a, r, -.5, -1.3, 4.7, 3.5);
    a.shape(r, [[-.35, 0], [-.35, 2.1], [-2.2, 3], [-2.6, 4.2], [-2.6, 8], [-1.75, 8], [-1.75, 4.5], [-1.2, 3.7], [1.2, 3.7], [1.75, 4.5], [1.75, 8], [2.6, 8], [2.6, 4.2], [2.2, 3], [.35, 2.1], [.35, 0]], .6, p.jade, [-.5, .95, -1.6]);
    for (const x of [-2.68, 1.68]) {
      a.box(r, [.86, .16, .7], [x, 8.63, -1.3], p.gold);
      for (let j = 0; j < 5; j++) a.box(r, [.44, .045, .04], [x, 5.2 + j * .55, -.95], p.paper);
    }
    a.cylinder(r, .58, .15, [-.5, 1.15, -1.3], p.gold);
    a.box(r, [4.3, .3, .6], [4, 1.25, -.5], p.limestone).rotation.y = -.32;
    for (let j = 0; j < 4; j++) a.box(r, [.6, .055, .65], [2.7 + j * .74, 1.42, -.5 + (j - 1.5) * .22], p.paper).rotation.y = -.32;
    a.line(r, [[-3.6, 5.1, -.6], [-4, 6, -.6], [-3.6, 6.9, -.6]], .035, p.gold);
    a.line(r, [[2.8, 5.1, -.6], [3.2, 6, -.6], [2.8, 6.9, -.6]], .035, p.gold);
    // Two language voices share an open resonating chamber; its front is a cavity, not a solid block.
    a.box(r, [3.65, .16, 3.6], [-.5, 1.35, .1], p.forest);
    a.box(r, [3.65, .16, 3.6], [-.5, 2.65, .1], p.jade);
    for (const x of [-2.24, 1.24]) a.box(r, [.18, 1.3, 3.6], [x, 2, .1], p.jade);
    a.box(r, [3.3, 1.3, .16], [-.5, 2, -1.6], p.forest);
    for (const x of [-1.7, -.9, -.1, .7]) a.box(r, [.045, .035, 3.35], [x, 2.75, .1], p.gold);
    for (const x of [-2.24, 1.24]) for (const y of [1.52, 2.48]) rivet(a, r, x, y, 1.98);
    beam(a, r, [-.5, 2.73, -.2], [-.5, 3.6, -1.3], .18, p.gold);
  },
  '2026-06-15': (a, r) => {
    const p = a.palette;
    // A pantograph drawing table carries a real articulated pen over a cut paper curve.
    for (const x of [-4.3, 4.3]) for (const z of [-2.8, .9]) beam(a, r, [x, .9, z], [x, 2.1, z], .17, p.forest);
    a.box(r, [10.1, .24, 4.6], [0, 2.2, -1], p.jade);
    a.box(r, [8.9, .06, 3.7], [0, 2.37, -1], p.paper);
    for (let i = 0; i < 17; i++) a.box(r, [.025, .025, i % 4 === 0 ? .35 : .18], [-4 + i * .5, 2.42, 1], p.gold);
    a.cylinder(r, .24, 2.3, [-4.1, 3.4, -2.5], p.gold);
    const arm: P[] = [[-4.1, 4.55, -2.5], [-.8, 5.7, -2.5], [2.8, 4.15, -.1], [-.5, 3, -.1]];
    for (let i = 0; i < 4; i++) beam(a, r, arm[i], arm[(i + 1) % 4], .12, p.forest, .09);
    beam(a, r, [-2.5, 5.12, -2.5], [1.15, 3.55, -.1], .07, p.gold);
    for (const [x, y, z] of arm) { disc(a, r, x, y, z + .07, .2, p.gold); rivet(a, r, x, y, z + .22); }
    a.cylinder(r, .14, 2.1, [2.8, 3.5, -.1], p.vermilion, .09);
    a.mesh(r, new T.ConeGeometry(.14, .45, 12), p.gold, [2.8, 2.23, -.1]).rotation.x = Math.PI;
    a.line(r, [[-2.9, 2.44, -.1], [-1.8, 2.44, -1.5], [.1, 2.44, -.5], [1.5, 2.44, -1.6], [2.8, 2.44, -.1]], .04, p.jade);
    for (const [x, z] of [[-2.9, -.1], [-1.8, -1.5], [.1, -.5], [1.5, -1.6], [2.8, -.1]]) a.box(r, [.18, .06, .18], [x, 2.46, z], p.gold);
  },
  '2026-06-16': (a, r) => {
    const p = a.palette;
    // An opened octagonal vessel reveals the square-to-circle construction of a new solver.
    a.cylinder(r, 3.15, .22, [-.7, 1.02, -1.3], p.paper);
    for (let i = 0; i < 8; i++) {
      const t = i * TAU / 8, h = i < 4 ? 2.6 : 4.5;
      const g = new T.Group(); g.position.set(-.7 + Math.sin(t) * 2.45, 1.2, -1.3 + Math.cos(t) * 2.45); g.rotation.y = t; r.add(g);
      a.shape(g, [[-.96, 0], [-1.06, h], [1.06, h], [.96, 0], [.79, 0], [.89, h - .18], [-.89, h - .18], [-.79, 0]], .24, i % 2 ? p.paper : p.jade);
      for (let j = 0; j < 3; j++) a.box(g, [1.94, .055, .32], [0, .6 + j * .6, .14], p.gold);
    }
    const square = new T.Group(); square.position.set(-.7, 5.9, -1.3); square.rotation.y = Math.PI / 4; r.add(square);
    for (const s of [-1, 1]) { a.box(square, [3.1, .15, .18], [0, 0, s * 1.45], p.gold); a.box(square, [.18, .15, 3.1], [s * 1.45, 0, 0], p.gold); }
    beam(a, r, [-.7, 1.1, -1.3], [-.7, 5.9, -1.3], .07, p.gold);
    a.mesh(r, new T.OctahedronGeometry(.6), p.vermilion, [-.7, 6.4, -1.3]);
    for (let i = 0; i < 3; i++) {
      const g = new T.Group(); g.position.set(4.3 + i * .3, 1.5 + i * .4, -.4); g.rotation.z = -.35 - i * .13; r.add(g);
      a.shape(g, [[-.6, 0], [-.6, 2.6], [.6, 2.6], [.6, 0]], .18, p.paper); a.box(g, [1.22, .08, .25], [0, 2.6, .1], p.gold);
    }
  },
  '2026-06-17': (a, r) => {
    const p = a.palette;
    // A horizontal micrometer uses a visible helical screw and a hairline measuring gap.
    feet(a, r, -.8, -1.3, 8.2, 3.5);
    a.shape(r, [[2.6, 0], [-2.5, 0], [-3.9, 1.2], [-4.1, 3.7], [-3.1, 5.2], [-.7, 5.8], [1.6, 5.1], [2.3, 4.1], [1.4, 3.7], [.8, 4.4], [-.7, 4.9], [-2.5, 4.4], [-3.1, 3.3], [-2.9, 1.8], [-1.8, .9], [2.6, .9]], .7, p.jade, [-.5, 1.2, -1.5]);
    a.box(r, [7.4, .36, .4], [.5, 3.9, -1.15], p.gold);
    a.box(r, [.4, 1, .85], [-3.7, 3.9, -1.15], p.paper);
    a.cylinder(r, .6, 2.5, [3.1, 3.9, -1.15], p.paper).rotation.z = Math.PI / 2;
    const spiral: P[] = [];
    for (let i = 0; i <= 72; i++) { const t = i / 72 * TAU * 8; spiral.push([1.8 + i * .034, 3.9 + Math.cos(t) * .63, -1.15 + Math.sin(t) * .63]); }
    a.line(r, spiral, .035, p.gold);
    a.cylinder(r, .72, .4, [4.7, 3.9, -1.15], p.forest).rotation.z = Math.PI / 2;
    for (let j = 0; j < 12; j++) { const t = j * TAU / 12; beam(a, r, [4.45, 3.9 + Math.cos(t) * .71, -1.15 + Math.sin(t) * .71], [4.93, 3.9 + Math.cos(t) * .71, -1.15 + Math.sin(t) * .71], .04, p.gold); }
    for (let j = 0; j < 14; j++) a.box(r, [.035, j % 5 ? .18 : .33, .045], [-.9 + j * .18, 4.18, -.87], p.forest);
    a.box(r, [.15, 1.6, .5], [-3.05, 3.6, -1.15], p.vermilion);
  },
  '2026-06-18': (a, r) => {
    const p = a.palette;
    // A flared precision sieve: 280 cells minus two sealed cells leaves 278 apertures.
    feet(a, r, 0, -1.4, 5.5, 3);
    const y0 = 1.55, step = .34;
    for (let row = 0; row <= 20; row++) {
      const half = 2.1 + row * .1, y = y0 + row * step;
      beam(a, r, [-half, y, -1.4], [half, y, -1.4], .055, row % 5 === 0 ? p.gold : p.paper);
    }
    for (let col = 0; col <= 14; col++) {
      const x = (col / 14 * 2 - 1);
      beam(a, r, [x * 2.1, y0, -1.4], [x * 4.1, y0 + 20 * step, -1.4], col % 7 === 0 ? .09 : .055, p.jade);
    }
    for (const [row, col] of [[0, 0], [0, 13]]) {
      const half = 2.1 + (row + .5) * .1, x = ((col + .5) / 14 * 2 - 1) * half;
      a.box(r, [half * 2 / 14, step, .12], [x, y0 + (row + .5) * step, -1.4], p.gold);
    }
    for (const s of [-1, 1]) {
      beam(a, r, [s * 2.1, 1, -1.4], [s * 4.15, 8.4, -1.4], .14, p.gold);
      beam(a, r, [s * 3.4, .95, -3.1], [s * 3.1, 5, -1.4], .1, p.forest);
    }
    a.shape(r, [[-2.6, 0], [-2.6, .5], [0, .16], [2.6, .5], [2.6, 0]], 2.1, p.paper, [0, 1, -.8]);
    for (let i = 0; i < 7; i++) a.mesh(r, new T.OctahedronGeometry(.16), i % 3 ? p.gold : p.vermilion, [-1.8 + i * .57, 1.4, .25 + (i % 2) * .3]);
  },
  '2026-06-19': (a, r) => {
    const p = a.palette;
    // City names become physical signboards at a small three-way stone junction.
    a.box(r, [1.35, .6, 1.4], [-1.3, 1.1, -1.5], p.limestone);
    a.cylinder(r, .2, 7.3, [-1.3, 4.8, -1.5], p.forest, .13);
    const boards = [[-1, 7.65, 3.3], [1, 6.45, 4.5], [-1, 5.25, 2.7], [1, 4.1, 3.5], [-1, 2.95, 3.9]];
    boards.forEach(([s, y, w], i) => {
      a.shape(r, [[0, -.34], [s * (w - .6), -.34], [s * w, 0], [s * (w - .6), .34], [0, .34]], .2, i % 2 ? p.jade : p.paper, [-1.3, y, -1.45]);
      for (let j = 0; j < 5; j++) a.box(r, [.13, .21, .04], [-1.3 + s * (.45 + j * (w - 1.1) / 5), y, -1.19], p.gold);
      rivet(a, r, -1.3 + s * .2, y, -1.17);
      // Raised place-name rails and a folded back edge make a sign, rather than a flat arrow icon.
      for (const dy of [-.27, .27]) beam(a, r, [-1.3 + s * .3, y + dy, -1.12], [-1.3 + s * (w - .68), y + dy, -1.12], .035, p.gold);
      beam(a, r, [-1.3, y, -1.62], [-1.3 + s * .95, y - .18, -1.62], .11, p.forest);
    });
    for (const end of [[-5.9, 1, .9], [5.1, 1, .6], [2.7, 1, -4]] as P[]) {
      beam(a, r, [-1.3, 1, -1.4], end, .35, p.paper, .55);
      a.box(r, [1, .15, .8], end, p.gold);
      for (let j = 1; j < 5; j++) {
        const t = j / 5, x = -1.3 + (end[0] + 1.3) * t, z = -1.4 + (end[2] + 1.4) * t;
        const stone = a.box(r, [.62, .09, .85], [x, 1.04, z], j % 2 ? p.limestone : p.paper);
        stone.rotation.y = Math.atan2(end[0] + 1.3, end[2] + 1.4);
      }
    }
    for (let i = 0; i < 4; i++) {
      a.box(r, [.62, .6 + i * .3, .72], [3.9 + (i % 2) * .8, 1.25 + i * .15, -2.7 + Math.floor(i / 2) * .9], p.paper);
      a.box(r, [.68, .07, .78], [3.9 + (i % 2) * .8, 1.58 + i * .3, -2.7 + Math.floor(i / 2) * .9], p.jade);
    }
  },
  '2026-06-20': (a, r) => {
    const p = a.palette;
    // A two-level balancing mobile collects eight unlike mechanical forms, not puzzle states.
    feet(a, r, -4.3, -1.8, 2.1, 2.7);
    a.line(r, [[-4.3, 1, -1.8], [-4.8, 6.6, -1.8], [-3, 9, -1.8], [.6, 9.2, -1.8]], .16, p.forest);
    beam(a, r, [.6, 9.2, -1.8], [.6, 8.1, -1.8], .025, p.gold);
    beam(a, r, [-2.9, 8.1, -1.8], [4.4, 8.1, -1.8], .06, p.gold);
    const points: P[] = [[-3.2, 5.6, -1.2], [-1.7, 4.7, -.4], [0, 5.8, -1.2], [1.5, 4.1, -.7], [3.1, 5.5, -1.3], [4.9, 3.5, -.2], [-.7, 2.5, .8], [2.6, 2.1, .7]];
    points.forEach(([x, y, z], i) => { a.line(r, [[Math.max(-2.9, Math.min(4.4, x)), 8.1, -1.8], [x, y + .8, z]], .024, p.gold); if (i !== 7) rivet(a, r, x, y + .75, z); });
    a.mesh(r, new T.ConeGeometry(.65, 1.2, 4), p.paper, points[0]);
    const torus = a.ring(r, .64, .16, points[1], p.jade); torus.rotation.y = .4;
    a.mesh(r, new T.CylinderGeometry(.7, .4, 1.2, 6), p.gold, points[2]);
    a.shape(r, [[-.7, 0], [0, .85], [.7, 0], [0, -.85]], .35, p.paper, points[3]);
    a.mesh(r, new T.SphereGeometry(.7, 12, 6), p.water, points[4]).scale.y = .5;
    gear(a, r, ...points[5], .65, 10, p.vermilion);
    a.shape(r, [[-.6, -.6], [-.6, .6], [.1, .6], [.1, .05], [.6, .05], [.6, -.6]], .4, p.jade, points[6]);
    const g = new T.Group(); g.position.set(...points[7]); r.add(g); for (let i = 0; i < 3; i++) a.box(g, [1.25 - i * .25, .18, .8], [0, i * .25, 0], p.paper);
  },
  '2026-06-21': (a, r) => {
    const p = a.palette;
    // An extended measuring prism telescopes sideways out of an open rectangular sleeve.
    for (const x of [-4.4, 2.7]) {
      feet(a, r, x, -1.3, 2.4, 3.3);
      beam(a, r, [x - .55, 1.04, -.2], [x, 2.6, -1.3], .22, p.forest); beam(a, r, [x + .55, 1.04, -2.4], [x, 2.6, -1.3], .22, p.forest);
      a.box(r, [1.7, .16, 2.8], [x, 2.6, -1.3], p.gold);
    }
    for (const z of [-2.45, -.15]) {
      beam(a, r, [-5.25, 2.42, z], [5.95, 2.42, z], .16, p.gold);
      for (const x of [-4.5, -.7, 3.7]) a.box(r, [.6, .43, .45], [x, 2.43, z], p.jade);
    }
    a.box(r, [10.75, .34, .2], [.13, 2.4, .15], p.paper);
    for (let j = 0; j < 29; j++) a.box(r, [.035, j % 4 ? .13 : .26, .045], [-4.91 + j * .36, 2.43, .274], p.forest);
    const sizes = [[-3.7, 3.1, 3.5], [-1.5, 2.6, 2.8], [.6, 2.1, 2.2], [2.55, 1.6, 1.6], [4.4, 1.1, 1.1]];
    sizes.forEach(([x, h, d], i) => {
      const y = 4.2, front = -1.3 + d / 2, back = -1.3 - d / 2;
      // Cutaway front and roof expose the smaller nested sleeves, while square brass collars retain the cuboid outline.
      a.box(r, [2.5, .14, d * .51], [x, y + h / 2, back + d * .25], p.paper);
      a.box(r, [2.5, .17, d], [x, y - h / 2, -1.3], p.jade);
      a.box(r, [2.5, h, .13], [x, y, back], p.paper);
      a.box(r, [2.5, h * .24, .13], [x, y - h * .38, front], p.paper);
      a.box(r, [2.35, .07, d - .22], [x, y - h / 2 + .14, -1.3], p.limestone);
      for (const z of [front, back]) {
        beam(a, r, [x - 1.28, y - h / 2, z], [x + 1.3, y - h / 2, z], .11, p.gold);
        beam(a, r, [x - 1.28, y + h / 2, z], [x + 1.3, y + h / 2, z], .11, p.gold);
        beam(a, r, [x + 1.22, y - h / 2, z], [x + 1.22, y + h / 2, z], .16, p.gold);
        for (const sy of [-1, 1]) rivet(a, r, x + 1.22, y + sy * h / 2, z + .075, .1);
      }
      for (const sy of [-1, 1]) beam(a, r, [x + 1.22, y + sy * h / 2, back], [x + 1.22, y + sy * h / 2, front], .16, p.gold);
      a.box(r, [.27, .2, d * .54], [x + .62, y - h / 2 + .27, -1.3], p.vermilion);
      if (i > 0) beam(a, r, [x, 2.67, -.15], [x, y - h / 2 - .08, -.15], .15, p.forest);
    });
    a.box(r, [.2, 1.3, 1.3], [5.7, 4.2, -1.3], p.jade);
    a.box(r, [.23, .25, .65], [5.86, 4.2, -1.3], p.gold);
    a.ring(r, .53, .105, [-4.67, 3.67, .7], p.gold);
    for (let i = 0; i < 4; i++) { const t = i * Math.PI / 2; beam(a, r, [-4.67, 3.67, .7], [-4.67 + Math.cos(t) * .47, 3.67 + Math.sin(t) * .47, .7], .09, p.jade); }
    disc(a, r, -4.67, 3.67, .74, .19, p.gold);
    beam(a, r, [-4.25, 3.97, .7], [-4.25, 3.97, 1.11], .13, p.vermilion);
    for (let j = 0; j < 4; j++) a.box(r, [1.1, .11, .8], [-4.5, 1.1 + j * .16, .5], p.paper);
  },
  '2026-06-22': (a, r) => {
    const p = a.palette;
    // Four dissimilar reading leaves open around a quadripartite central pier.
    a.shape(r, [[-1.3, 0], [-1.3, 2.8], [-.45, 4.1], [.45, 4.1], [1.3, 2.8], [1.3, 0]], 1.8, p.jade, [0, 1, -2]);
    const leaves = [
      { x: -2.5, y: 4.3, z: -.7, rot: -.65, w: 2.8, h: 3.1 },
      { x: 2.7, y: 4.6, z: -1.1, rot: .7, w: 2.4, h: 3.4 },
      { x: -.8, y: 6, z: -2.9, rot: -.18, w: 1.9, h: 2.9 },
      { x: .7, y: 3.6, z: .7, rot: 2.7, w: 2.3, h: 2.3 },
    ];
    leaves.forEach(({ x, y, z, rot, w, h }, i) => {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.z = rot; r.add(g);
      a.shape(g, [[0, 0], [-w * .45, h * .15], [-w / 2, h * .62], [-w * .28, h], [0, h * 1.07], [w * .28, h], [w / 2, h * .62], [w * .45, h * .15]], .17, i % 2 ? p.paper : p.limestone);
      beam(a, g, [0, .2, .2], [0, h * .92, .2], .04, p.gold);
      for (let j = 0; j < 4; j++) for (const s of [-1, 1]) beam(a, g, [0, .6 + j * .4, .2], [s * w * .35, .82 + j * .4, .2], .025, p.jade);
      beam(a, r, [0, 4.4, -1.1], [x, y, z], .13, p.gold);
    });
    for (let i = 0; i < 4; i++) a.box(r, [5.4 - i * .55, .15, 3.5 - i * .35], [0, .85 + i * .15, -1], p.paper);
  },
  '2026-06-23': (a, r) => {
    const p = a.palette;
    // A freestanding mechanical iris chooses a narrow opening with six offset sliding blades.
    for (const x of [-2.7, 2.7]) { feet(a, r, x, -1.5, 1.6, 2.5); beam(a, r, [x, 1, -1.5], [x * .7, 4.3, -1.5], .24, p.forest); }
    a.ring(r, 3.35, .18, [0, 5.1, -1.1], p.gold); a.ring(r, 3.08, .09, [0, 5.1, -.94], p.paper);
    for (let i = 0; i < 6; i++) {
      const g = new T.Group(); g.position.set(0, 5.1, -.85 + i * .035); g.rotation.z = i * TAU / 6; r.add(g);
      a.shape(g, [[1.05, -.25], [2.72, -.85], [3.04, .4], [2.15, 1.55], [.65, .78]], .1, i % 2 ? p.paper : p.jade);
      beam(a, g, [1.1, -.16, .13], [2.67, -.66, .13], .035, p.gold);
      rivet(a, g, 2.4, .3, .15, .095);
    }
    for (let j = 0; j < 18; j++) { const t = j * TAU / 18; rivet(a, r, Math.cos(t) * 3.34, 5.1 + Math.sin(t) * 3.34, -.82, .06); }
    beam(a, r, [2.5, 2.9, -.7], [4.9, 1.6, -.7], .1, p.gold);
    disc(a, r, 4.9, 1.6, -.55, .39, p.vermilion);
    a.box(r, [1.4, .15, 1.5], [4.9, .94, -.7], p.paper);
    a.shape(r, [[0, 0], [1.8, .9], [2.6, 0]], .15, p.gold, [-1.2, 1.15, .6]);
  },
  '2026-06-24': (a, r) => {
    const p = a.palette;
    // A permutation loom exchanges crossing warp threads through a visibly lifted heddle.
    for (const x of [-4, 4]) for (const z of [-2.6, .8]) {
      a.box(r, [.22, 5.9, .22], [x, 3.9, z], p.forest);
      a.box(r, [.6, .15, .6], [x, .9, z], p.paper);
    }
    for (const y of [2.1, 6.7]) for (const z of [-2.6, .8]) a.box(r, [8.4, .2, .25], [0, y, z], p.gold);
    for (const z of [-2.5, .7]) { const roller = a.cylinder(r, .38, 7.8, [0, 2.7, z], p.paper); roller.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 12; i++) {
      const x = -3.5 + i * .635, shift = (i % 3 - 1) * .56;
      a.line(r, [[x, 2.8, .75], [x + shift, i % 2 ? 5 : 4.4, -.9], [x, 2.8, -2.5]], .035, i % 3 ? p.paper : p.vermilion);
      a.box(r, [.12, .65, .09], [x + shift, i % 2 ? 5 : 4.4, -.9], p.gold);
    }
    for (let j = 0; j < 9; j++) a.box(r, [7.5, .034, .055], [0, 2.97 + j * .025, .5 - j * .12], j % 2 ? p.jade : p.gold);
    a.shape(r, [[-1.6, 0], [-.9, .28], [.9, .28], [1.6, 0], [.9, -.28], [-.9, -.28]], .35, p.jade, [0, 3.55, .65]);
    a.ring(r, .3, .045, [0, 3.55, 1.05], p.gold);
    gear(a, r, 4.15, 2.7, .95, .6, 10, p.gold);
    beam(a, r, [-2.1, 1.1, .8], [-2.1, 2.7, -2.5], .12, p.forest); a.box(r, [2.1, .13, .6], [-2.1, 1.18, 1.1], p.paper);
  },
  '2026-06-25': (a, r) => {
    const p = a.palette;
    // A great eight-faced lantern is held by a staggered pair of thin arched brackets.
    for (const [x, z, height] of [[-4.3, -2, 8.6], [4.3, -.6, 7.4]]) {
      feet(a, r, x, z, 1.6, 2);
      a.line(r, [[x, 1, z], [x, height - 1, z], [x * .5, height, z], [0, height, -1.2]], .13, p.forest);
      a.box(r, [.5, .15, .5], [x, 2, z], p.gold);
    }
    beam(a, r, [0, 8.6, -1.2], [0, 7.5, -1.2], .04, p.gold);
    const center: P = [0, 4.8, -1.2], radius = 2.65;
    a.mesh(r, new T.OctahedronGeometry(radius), p.paper, center);
    const v: P[] = [[0, radius, 0], [0, -radius, 0], [radius, 0, 0], [-radius, 0, 0], [0, 0, radius], [0, 0, -radius]];
    const g = new T.Group(); g.position.set(...center); r.add(g);
    for (const pole of [0, 1]) for (const rim of [2, 3, 4, 5]) beam(a, g, v[pole], v[rim], .055, p.gold);
    for (const i of [2, 3]) for (const j of [4, 5]) beam(a, g, v[i], v[j], .055, p.gold);
    for (let i = 0; i < 4; i++) {
      const t = i * Math.PI / 2;
      leaf(a, g, [Math.cos(t) * .42, .5, Math.sin(t) * .42], [Math.cos(t) * 1.5, .1, Math.sin(t) * 1.5], .18, p.jade);
    }
    a.cylinder(r, .33, .22, [0, 2.05, -1.2], p.gold);
    for (let i = 0; i < 7; i++) beam(a, r, [(i - 3) * .09, 1.98, -1.2], [(i - 3) * .13, 1.03 + Math.abs(i - 3) * .07, -1.2], .024, p.vermilion);
  },
  '2026-06-26': (a, r) => {
    const p = a.palette;
    // An exposed turning core sits between individually separated cut strata and a cutting carriage.
    for (const x of [-4.2, 3.5]) {
      feet(a, r, x, -1.4, 1.5, 3); a.box(r, [.7, 2.6, 1.9], [x, 2.35, -1.4], p.jade);
      a.cylinder(r, .45, .8, [x, 3.5, -1.4], p.gold).rotation.z = Math.PI / 2;
    }
    a.cylinder(r, .27, 9.5, [0, 3.5, -1.4], p.gold).rotation.z = Math.PI / 2;
    for (let i = 0; i < 9; i++) {
      const x = -3.1 + i * .69, radius = 1.4 + Math.sin(i * .49) * .6;
      const slice = a.mesh(r, new T.CylinderGeometry(radius, radius, .32, 12), i % 2 ? p.paper : p.limestone, [x, 3.5, -1.4]); slice.rotation.z = Math.PI / 2;
      const trim = a.ring(r, radius * .88, .035, [x + .18, 3.5, -1.4], p.jade); trim.rotation.y = Math.PI / 2;
    }
    a.box(r, [8.4, .15, .3], [0, 1.4, .8], p.forest);
    a.box(r, [1.5, .7, 1.2], [.9, 1.8, .65], p.jade);
    beam(a, r, [.9, 2.15, .65], [.9, 4.6, .1], .14, p.gold);
    a.shape(r, [[0, 0], [1, .25], [1, -.3]], .08, p.paper, [.85, 4.6, -.05]).rotation.y = Math.PI / 2;
    gear(a, r, .9, 1.8, 1.3, .48, 10, p.gold);
    for (let i = 0; i < 6; i++) a.shape(r, [[0, 0], [.3, .12], [.9, .15], [1.25, .02], [.9, .08], [.3, .05]], .07, p.paper, [-2.2 + i * .6, .96, .4 + (i % 2) * .45]);
  },
  '2026-06-27': (a, r) => {
    const p = a.palette;
    // A faceted mirror on a working easel is edited by a pivoting cutting guide.
    for (const foot of [[-3.7, .9, .4], [1.9, .9, .4], [-.8, .9, -3.5]] as P[]) beam(a, r, foot, [-.8, 8.1, -1.9], .18, p.forest);
    a.box(r, [6.7, .22, 1.1], [-.8, 2.35, -.8], p.gold);
    const outline: [number, number][] = [[-2.9, 0], [-3.2, 3.7], [-1.5, 5], [.2, 4.5], [2.1, 5.5], [3, 2.1], [2.4, 0]];
    a.shape(r, outline, .28, p.paper, [-.8, 2.5, -1.5]);
    const facets: [number, number][][] = [
      [[-2.75, .2], [-2.95, 3.6], [-1.4, 4.7], [-.8, 2.3]],
      [[-2.75, .2], [-.8, 2.3], [.4, .2]],
      [[-1.4, 4.7], [.2, 4.2], [1.95, 5.15], [1.1, 2.9], [-.8, 2.3]],
      [[.4, .2], [-.8, 2.3], [1.1, 2.9], [2.7, 2.1], [2.2, .2]],
    ];
    facets.forEach((points, i) => a.shape(r, points, .035, i % 2 ? p.ice : p.jade, [-.8, 2.5, -1.17]));
    const edges: P[] = outline.map(([x, y]) => [x - .8, y + 2.5, -1.07]); edges.push(edges[0]); a.line(r, edges, .04, p.gold);
    beam(a, r, [3.5, 1.3, -.8], [3.5, 6.1, -.8], .13, p.gold);
    beam(a, r, [3.5, 6.1, -.8], [-2.3, 3.1, -.6], .09, p.forest); disc(a, r, 3.5, 6.1, -.58, .22, p.gold);
    for (const [x, y] of [[-2.3, 3.1], [-.2, 4.2], [1.8, 5.25]]) a.box(r, [.17, .17, .14], [x, y, -.46], p.vermilion);
    a.box(r, [2.2, .18, 1.7], [4.3, 1.03, -.8], p.limestone);
  },
  '2026-06-28': (a, r) => {
    const p = a.palette;
    // Six orthogonal sighting arms meet at one neutral hub, with no privileged bottom face.
    feet(a, r, -.2, -1.3, 3.6, 3.1);
    a.cylinder(r, .44, 3.1, [-.2, 2.65, -1.3], p.forest);
    for (let i = 0; i < 3; i++) a.cylinder(r, .55, .1, [-.2, 1.4 + i * 1.12, -1.3], p.gold);
    const hub = new T.Group(); hub.position.set(-.2, 5.1, -1.3); hub.rotation.z = .35; hub.rotation.y = .5; r.add(hub);
    a.mesh(hub, new T.DodecahedronGeometry(.63), p.gold);
    const dirs: P[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    dirs.forEach((d, i) => {
      const end = d.map(v => v * 3.2) as P;
      beam(a, hub, d.map(v => v * .5) as P, end, .24, i % 2 ? p.jade : p.paper);
      const head = a.mesh(hub, new T.ConeGeometry(.5, .94, 4), i % 3 ? p.gold : p.vermilion, d.map(v => v * 3.5) as P);
      head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d));
      for (const offset of [1.2, 2.85]) {
        const marker = a.cylinder(hub, .32, .18, d.map(v => v * offset) as P, p.gold);
        marker.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d));
      }
    });
    for (let i = 0; i < 6; i++) {
      const t = i * TAU / 6;
      a.shape(r, [[-.17, 0], [0, .7], [.17, 0]], .065, p.gold, [Math.cos(t) * 3.8, 1, -1.3 + Math.sin(t) * 2.8]).rotation.x = -Math.PI / 2;
    }
  },
  '2026-06-29': (a, r) => {
    const p = a.palette;
    // A tall authoritative scroll passes through two rollers and an exacting small press.
    for (const x of [-3.2, 3.2]) { feet(a, r, x, -1.7, 1.5, 2.3); beam(a, r, [x, 1, -1.7], [x, 8.3, -1.7], .17, p.forest); }
    for (const y of [2.1, 8]) { const roll = a.cylinder(r, .4, 6.8, [0, y, -1.7], p.gold); roll.rotation.z = Math.PI / 2; }
    a.shape(r, [[0, 0], [.12, 0], [.12, 6.1], [-.15, 6.35], [-.65, 6.35], [-.92, 6.1], [-.8, 5.9], [-.75, 6.04], [-.56, 6.2], [-.2, 6.2], [0, 6]], 5.7, p.paper, [-2.85, 1.9, -1.45]).rotation.y = Math.PI / 2;
    // The broad front folio is separate from the rolled edge so small rules stay crisp.
    a.box(r, [5.7, 5.85, .1], [0, 4.95, -1.36], p.paper);
    for (let row = 0; row < 15; row++) {
      a.box(r, [4.6 - (row % 4 === 3 ? 1.1 : 0), .045, .035], [-.13, 2.4 + row * .36, -1.27], row % 5 === 0 ? p.gold : p.jade);
      if (row % 5 === 0) a.box(r, [.18, .18, .05], [-2.53, 2.4 + row * .36, -1.23], p.vermilion);
    }
    a.box(r, [3, .2, 2.2], [4.8, 1.25, -.7], p.jade);
    for (const x of [3.8, 5.8]) beam(a, r, [x, 1.3, -.7], [x, 3.5, -.7], .13, p.gold);
    a.box(r, [2.3, .2, .8], [4.8, 3.5, -.7], p.paper);
    a.cylinder(r, .12, 2.1, [4.8, 3, -.7], p.gold); a.box(r, [1.8, .13, 1.45], [4.8, 1.92, -.7], p.paper);
    beam(a, r, [4.1, 4, -.7], [5.5, 4, -.7], .09, p.forest);
  },
  '2026-06-30': (a, r) => {
    const p = a.palette;
    // A lifted portcullis records explicit constraints in its visible pins and locking teeth.
    for (const x of [-3.6, 3.6]) {
      a.box(r, [1.5, 6.2, 2.3], [x, 4, -1.5], p.paper);
      for (let j = 0; j < 7; j++) a.box(r, [1.56, .055, 2.36], [x, 1.1 + j * .88, -1.5], p.limestone);
      a.box(r, [1.9, .2, 2.7], [x, 7.25, -1.5], p.gold);
      a.mesh(r, new T.ConeGeometry(.65, .75, 4), p.jade, [x, 7.7, -1.5]).rotation.y = Math.PI / 4;
    }
    a.box(r, [8.5, .65, 1.6], [0, 6.9, -1.5], p.forest);
    for (let i = 0; i < 9; i++) {
      const x = -2.6 + i * .65;
      a.box(r, [.12, 4.7, .16], [x, 4.75, -1], p.jade);
      a.mesh(r, new T.ConeGeometry(.17, .55, 4), p.gold, [x, 2.15, -1]).rotation.x = Math.PI;
      for (let j = 0; j < 4; j++) rivet(a, r, x, 3.05 + j * .97, -.88, .065);
    }
    for (let j = 0; j < 4; j++) a.box(r, [5.8, .11, .14], [0, 3.05 + j * .97, -.95], p.gold);
    for (const x of [-2.8, 2.8]) a.line(r, [[x, 6.8, -1], [x, 8.3, -1.5], [x + (x < 0 ? -.8 : .8), 8.3, -2.4], [x + (x < 0 ? -.8 : .8), 4.4, -2.4]], .035, p.gold);
    gear(a, r, 5, 2.7, -.3, .78, 12, p.gold);
    beam(a, r, [5, 2.7, -.08], [5.9, 3.3, -.08], .08, p.forest); rivet(a, r, 5.9, 3.3, -.08, .14);
    a.box(r, [8.2, .18, 3.2], [0, .88, -1.2], p.limestone);
    for (let j = 0; j < 3; j++) a.box(r, [4.3, .13, .45], [0, 1.07 + j * .13, .95 - j * .4], p.paper);
  },
};
