import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import type { LATE_DESIGNS } from './history-designs-late';

type P = [number, number, number];
type Build = (a: PaperScenery, r: T.Group) => void;

// Craft primitives only: each dated composition below has its own structure and silhouette.
function joint(a: PaperScenery, r: T.Object3D, p: P, size = .14) {
  return a.mesh(r, new T.SphereGeometry(size, 10, 7), a.palette.gold, p);
}
function rod(a: PaperScenery, r: T.Object3D, start: P, end: P, radius = .055, color = a.palette.gold) {
  return a.line(r, [start, end], radius, color);
}
function arc(a: PaperScenery, r: T.Object3D, radius: number, start: number, length: number, at: P, color = a.palette.gold, tube = .065) {
  const o = a.mesh(r, new T.TorusGeometry(radius, tube, 5, 44, length), color, at); o.rotation.z = start; return o;
}
function slab(a: PaperScenery, r: T.Object3D, at: P, w: number, d: number) {
  a.box(r, [w + .2, .16, d + .2], [at[0], at[1] - .12, at[2]], a.palette.limestone);
  a.box(r, [w, .16, d], at, a.palette.paper);
}
function rivets(a: PaperScenery, r: T.Object3D, from: P, to: P, count: number) {
  for (let i = 0; i < count; i++) { const t = i / (count - 1); joint(a, r, from.map((x, k) => x + (to[k] - x) * t) as P, .065); }
}
function card(a: PaperScenery, r: T.Object3D, at: P, w = 1.2, h = 1.6, color = a.palette.paper) {
  a.box(r, [w, h, .14], at, color);
  for (let i = 0; i < 3; i++) a.box(r, [w * (.65 - i * .1), .035, .025], [at[0] - w * .08, at[1] + h * .22 - i * .21, at[2] + .08], a.palette.gold);
}
function fin(a: PaperScenery, r: T.Object3D, points: [number, number][], at: P, color = a.palette.jade, depth = .2) {
  return a.shape(r, points, depth, color, at);
}

export const LATE_MODELS: Record<keyof typeof LATE_DESIGNS, Build> = {
  '2026-07-01': (a, r) => {
    // A cut seed exposes a suspended kernel, nested chambers and branching roots.
    const p = a.palette; slab(a, r, [0, .86, -.8], 7.2, 4.3);
    for (let i = 0; i < 6; i++) {
      const shell = arc(a, r, 3.7 - i * .34, -.15, Math.PI * 1.25, [-.7, 4.5, -2.5 + i * .3], i % 2 ? p.paper : p.jade, .12);
      shell.scale.x = .78;
    }
    const core = a.mesh(r, new T.DodecahedronGeometry(1.25, 0), p.vermilion, [-.6, 4.7, -.5]); core.rotation.z = .3;
    for (let i = 0; i < 7; i++) { const x = -3 + i; rod(a, r, [-.6, 3.5, -.5], [x, 1.05, .6], .045, p.gold); joint(a, r, [x, 1.05, .6]); }
    rod(a, r, [-.6, 5.9, -.5], [-.6, 7.8, -.5]);
    fin(a, r, [[0, 0], [1.9, 1.1], [1.25, 1.3], [.2, .65]], [-.6, 7.1, -.5], p.forest);
    a.box(r, [2.2, .18, 1.4], [4.1, 1.1, .4], p.paper); card(a, r, [4.1, 1.8, .6], 1.5, 1.2);
  },
  '2026-07-03': (a, r) => {
    const p = a.palette;
    // Bounded reservoirs: a stepped spillway returns overflow through a visible side channel.
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 2.2, y = 4.5 - i * 1.05;
      a.box(r, [2.1, y - .75, 3], [x, (y + .75) / 2, -1.2], p.limestone);
      slab(a, r, [x, y, -1.2], 2.15, 3.15);
      a.box(r, [1.75, .05, 2.4], [x, y + .1, -1.2], p.water);
      for (const z of [-2.7, .3]) a.box(r, [2.15, .34, .13], [x, y + .26, z], p.paper);
      for (let j = 0; j < 4; j++) a.box(r, [.08, .75, .08], [x - .7 + j * .45, y + .45, .4], p.gold);
      if (i < 3) a.box(r, [.22, 1.05, 2.3], [x + 1.03, y - .45, -1.2], p.water);
    }
    a.line(r, [[3.2, 1.1, 1.1], [5.4, 1.1, 1.1], [5.4, 5.8, -2], [-5.5, 5.8, -2], [-5.5, 4.8, -1]], .18, p.forest);
    for (const x of [-5.5, 5.4]) { a.cylinder(r, .25, .3, [x, 3.5, -2], p.gold); rivets(a, r, [x, 1, -2], [x, 5.5, -2], 7); }
    arc(a, r, .7, 0, Math.PI * 2, [5.4, 4.2, -1.75], p.vermilion);
  },
  '2026-07-04': (a, r) => {
    const p = a.palette; slab(a, r, [0, .9, -.8], 7, 4);
    // One tall key has an open flower bow, three different locking wards and identity tags.
    const bow = a.ring(r, 1.55, .24, [-1.4, 6.5, -.8], p.gold); bow.scale.x = .8;
    a.ring(r, 1.16, .045, [-1.4, 6.5, -.55], p.paper);
    a.box(r, [.42, 4.35, .42], [-1.4, 3.1, -.8], p.gold);
    for (let i = 0; i < 3; i++) { a.box(r, [1.35 + i * .35, .4, .45], [-.8 + i * .18, 1.2 + i * .75, -.8], p.gold); a.box(r, [.25, .7, .48], [.1 + i * .35, 1.4 + i * .75, -.8], p.gold); }
    for (let i = 0; i < 3; i++) { const x = 1.8 + i * 1.25; rod(a, r, [-.2, 6.9, -.7], [x, 5.3 - i, -.7], .027); card(a, r, [x, 4.55 - i, -.7], .86, 1.3, [p.jade, p.paper, p.vermilion][i]); joint(a, r, [x, 5.18 - i, -.59], .08); }
    for (let i = 0; i < 5; i++) a.box(r, [.08, .045, 2.7], [-3 + i * .45, 1.02, -.8], p.gold);
  },
  '2026-07-05': (a, r) => {
    const p = a.palette; slab(a, r, [0, .9, -.5], 7.5, 4.5);
    const palm = fin(a, r, [[-1.5, 0], [-1.7, 2], [-1.1, 2.6], [1.2, 2.5], [1.6, 1.4], [.9, 0]], [-.5, 2.5, -1.2], p.paper, .8);
    palm.rotation.z = -.12;
    a.cylinder(r, .6, 1.7, [-.5, 1.8, -.8], p.jade, .4);
    const heights = [2.2, 3.1, 3.45, 2.85];
    for (let i = 0; i < 4; i++) {
      const x = -1.7 + i * .85, h = heights[i];
      rod(a, r, [x, 4.8, -.8], [x - .15, 4.8 + h * .57, -.8], .2, p.paper);
      rod(a, r, [x - .15, 4.8 + h * .57, -.8], [x - .5, 4.8 + h, -.2], .16, p.paper);
      joint(a, r, [x, 4.8, -.8], .24); joint(a, r, [x - .15, 4.8 + h * .57, -.8], .21);
      a.line(r, [[x, 3.2, -.31], [x, 4.9, -.31], [x - .15, 4.8 + h * .57, -.31], [x - .5, 4.8 + h, .01]], .024, p.vermilion);
    }
    rod(a, r, [1, 3.3, -.8], [2.65, 4.3, -.1], .26, p.paper); rod(a, r, [2.65, 4.3, -.1], [2.9, 5.25, .3], .19, p.paper); joint(a, r, [2.65, 4.3, -.1], .29);
    a.ring(r, .47, .055, [-.5, 1.8, -.15], p.gold);
  },
  '2026-07-06': (a, r) => {
    const p = a.palette; slab(a, r, [0, .9, -.8], 10, 5);
    // Celluloid climbs through an open helical scaffold, each frame a separate physical plate.
    for(let i=0;i<11;i++){const t=i/10*Math.PI*1.4,x=-3.1+Math.cos(t)*1.55,y=1.3+i*.51,z=-1+Math.sin(t)*1.4; const frame=a.box(r,[1.15,.15,1.4],[x,y,z],p.jade);frame.rotation.y=-t;const picture=a.box(r,[.75,.025,.85],[x,y+.1,z],p.paper);picture.rotation.y=-t;for(const dz of [-.57,.57])joint(a,r,[x,y+.13,z+dz],.06);}
    a.line(r,[[-4.7,1,-1.7],[-4.3,4.1,-1.7],[-3.1,7.5,-1.7],[-1.4,4.4,-1.7],[-1.2,1,-1.7]],.09,p.gold);
    for (let i = 0; i < 23; i++) { const t = i / 22 * Math.PI * 1.7, x = 2.1 + Math.cos(t) * 2.2, y = 1.15 + i * .21, z = -1 + Math.sin(t) * 1.6; const strip = a.box(r, [.68, .12, 1.3], [x, y, z], p.paper); strip.rotation.y = -t; for (const dz of [-.5, .5]) { const dot = a.box(r, [.13, .025, .14], [x, y + .08, z + dz], p.ink); dot.rotation.y = -t; } }
    rod(a, r, [2.1, 1, -1], [2.1, 6, -1], .08, p.vermilion);
  },
  '2026-07-07': (a, r) => {
    const p = a.palette; slab(a, r, [-.6, .95, -.8], 6.2, 4.7);
    fin(a, r, [[-1.2, 0], [-.85, 5.9], [0, 7.6], [.8, 5.9], [1.15, 0]], [-.8, 1.05, -2.1], p.jade, 1.1);
    rod(a, r, [-.8, 1.2, -.96], [-.8, 7.8, -.96], .045);
    for (let i = 0; i < 5; i++) { const t = i * .8 - 1.6, x = Math.sin(t) * 3.6, y = 2.1 + i * 1.05, z = Math.cos(t) * 1.3 - 1.1; rod(a, r, [-.8, y + .25, -1], [x, y, z], .036); card(a, r, [x, y, z], 1.15, 1.5, i === 3 ? p.vermilion : p.paper); joint(a, r, [x, y + .57, z + .14], .12); }
    for (let i = 0; i < 5; i++) a.box(r, [1.5 + i * .3, .1, .6], [3.7, 1.02 + i * .11, .3], p.paper);
    a.ring(r, .55, .07, [-.8, 8.15, -1.4], p.gold);
  },
  '2026-07-08': (a, r) => {
    const p = a.palette; slab(a, r, [0, .9, -.8], 8.8, 4);
    // Three unlike collectors feed a graduated basin, a sculptural daily-data instrument.
    a.cylinder(r, 1.25, .38, [0, 1.2, -.5], p.paper); a.cylinder(r, 1.04, .04, [0, 1.41, -.5], p.water);
    for (let i = 0; i < 3; i++) { const x = -3.7 + i * 3.5, y = 4.4 + (i === 1 ? 1.8 : i * .4); a.cylinder(r, .16, y - 1, [x, (y + 1) / 2, -1.5], p.gold); a.cylinder(r, .32, 1.2, [x, y, -1.5], p.paper, 1.15 - i * .2); for (let j = 0; j < 8; j++) a.box(r, [.24, .035, .04], [x + .18, 1.5 + j * .38, -1.29], p.ink); a.line(r, [[x, y - .5, -1.5], [x + .7, 2, -1.5], [0, 1.7, -.5]], .09, p.jade); }
    for (let i = 0; i < 6; i++) { const drop = a.mesh(r, new T.SphereGeometry(.13, 8, 6), p.water, [-3.9 + i * 1.45, 6.5 + Math.sin(i) * .7, -1.5]); drop.scale.y = 1.7; }
    rod(a, r, [2.8, 1, 1.1], [2.8, 2.2, 1.1], .035); card(a, r, [2.8, 2.05, 1.1], 1.3, .8);
  },
  '2026-07-09': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 4; i++) {
      const x = -4.8 + i * 3, y = 1.65 + (i % 2) * 1.75;
      const bubble: [number, number][] = [[-1.25, 0], [-1.75, .7], [-1.75, 2.1], [-1.1, 2.75], [1.1, 2.75], [1.7, 2.1], [1.7, .7], [.7, .25], [.25, -.8], [-.05, 0]];
      fin(a, r, bubble, [x, y, -2.3 + i * .22], i % 2 ? p.paper : p.jade, .5);
      for (const dx of [-.8, .8]) rod(a, r, [x + dx, .9, -2.05 + i * .22], [x + dx, y + .45, -2.05 + i * .22], .08, p.forest);
      for (let j = 0; j < 3; j++) a.box(r, [1.8 - j * .2, .045, .04], [x - .1, y + 1.9 - j * .4, -1.75 + i * .22], p.gold);
      for (let j = 0; j < 3; j++) a.box(r, [2.4, .15, .45], [x, .95 + j * .15, -.5 + j * .42], p.paper);
    }
    a.line(r, [[-5, 5.2, -2.3], [-2, 7.5, -2.3], [2, 6.1, -2.3], [4.5, 7.3, -2.3]], .045, p.vermilion);
    for (let i = 0; i < 9; i++) joint(a, r, [-4.8 + i * 1.15, 1.02, 1.8], .095);
  },
  '2026-07-10': (a, r) => {
    const p = a.palette; slab(a, r, [0, .94, -.7], 9.8, 4.1);
    // An upright concertina carries five review measures, connected by brass scoring rails.
    for (let i = 0; i < 10; i++) { const x = -4.6 + i * .95, h = 3.3 + Math.sin(i * .75) * 1.1; const leaf = a.box(r, [1.2, h, .12], [x, 1.12 + h / 2, -1.3 + (i % 2) * .5], i % 2 ? p.paper : p.jade); leaf.rotation.y = i % 2 ? -.62 : .62; rod(a, r, [x, 1.14, -1], [x, 1.12 + h, -1], .035); if (i % 2 === 0) { a.ring(r, .29, .03, [x, h + .6, -.94], p.gold); for (let j = 0; j < 3; j++) a.box(r, [.5, .035, .035], [x, 2 + j * .4, -.72], p.gold); } }
    a.line(r, [[-5, 5.2, -1.3], [-2.6, 6.9, -1.3], [0, 6.2, -1.3], [2.3, 7.3, -1.3], [4.5, 6.5, -1.3]], .09, p.vermilion);
    for (let i = 0; i < 5; i++) joint(a, r, [-5 + i * 2.4, 5.2 + Math.sin(i * 1.7) * 1.2, -1.3], .18);
  },
  '2026-07-11': (a, r) => {
    const p = a.palette;
    // Five open wave channels expose phase differences like pages cut through moving water.
    for(let lane=0;lane<5;lane++){const pts:[number,number][]=[[-5,0]];for(let i=0;i<=24;i++){const x=-5+i/24*10;pts.push([x,2.4+Math.sin(i/24*Math.PI*2+lane*.65)*1.2+lane*.18]);}pts.push([5,0]);fin(a,r,pts,[0,1,-3.1+lane*.85],lane%2?p.paper:p.water,.18);const crest:P[]=[];for(let i=0;i<=24;i++)crest.push([-5+i/24*10,3.4+Math.sin(i/24*Math.PI*2+lane*.65)*1.2+lane*.18,-2.88+lane*.85]);a.line(r,crest,.035,p.gold);}
    for(const x of [-5.3,5.3]){a.box(r,[.4,.35,4.5],[x,1.15,-1.25],p.jade);rod(a,r,[x,1.3,-1.25],[x,6.7,-1.25],.07,p.forest);}
    rod(a,r,[-5.3,6.7,-1.25],[5.3,6.7,-1.25],.065,p.gold);
    for(let i=0;i<9;i++){const x=-4.5+i*1.1;rod(a,r,[x,6.7,-1.25],[x,5.8-(i%3)*.25,-1.25],.025,p.vermilion);joint(a,r,[x,5.8-(i%3)*.25,-1.25],.09);}
    card(a,r,[3.7,2,1.45],1.5,1.05);
  },
  '2026-07-12': (a, r) => {
    const p = a.palette; slab(a, r, [0, .91, -.8], 10, 4.5);
    // A folded forearm study is laid horizontally in an artisan's tensioning jig.
    for (const x of [-4.5, 4.5]) { a.box(r, [.3, 4.2, .4], [x, 3, -1], p.forest); slab(a, r, [x, 1.05, -1], 1.35, 2.2); }
    rod(a, r, [-4.5, 5.1, -1], [4.5, 5.1, -1], .1); rivets(a, r, [-4.4, 5.13, -.91], [4.4, 5.13, -.91], 15);
    const bends: P[] = [[-3.7, 3.7, -.6], [-1.6, 2.3, -.6], [1.35, 3.8, -.6]];
    for (let i = 0; i < 2; i++) {
      const start = new T.Vector3(...bends[i]), end = new T.Vector3(...bends[i + 1]);
      const limb = new T.Group(), length = start.distanceTo(end);
      limb.position.copy(start); limb.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize()); r.add(limb);
      a.cylinder(limb, i ? .49 : .64, length - .18, [0, length / 2, 0], p.paper, i ? .38 : .48);
      // Two folded shells leave a visible dark tendon channel between the radius and ulna.
      for (const side of [-1, 1]) {
        fin(a, limb, [[side * .12, .35], [side * .5, .63], [side * .36, length - .3], [side * .1, length - .2]], [0, 0, .46], side < 0 ? p.jade : p.paper, .14);
        rod(a, limb, [side * .24, .55, .66], [side * .2, length - .4, .54], .035, p.gold);
      }
      for (const y of [.35, length - .35]) { a.cylinder(limb, i ? .52 : .67, .15, [0, y, 0], p.gold); a.cylinder(limb, i ? .54 : .69, .06, [0, y, 0], p.jade); }
    }
    bends.forEach(([x, y, z], i) => {
      joint(a, r, [x, y, z], i === 1 ? .59 : .49);
      a.ring(r, i === 1 ? .44 : .35, .075, [x, y, z + .48], p.forest);
      rod(a, r, [x - .15, y, z + .57], [x + .15, y, z + .57], .04, p.gold);
    });
    const palm = new T.Group(); palm.position.set(2.12, 3.83, -.6); palm.rotation.z = -.14; r.add(palm);
    fin(a, palm, [[-.8, -.48], [.5, -.62], [1, -.32], [1.03, .42], [.6, .69], [-.8, .45]], [0, 0, -.45], p.paper, .9);
    fin(a, palm, [[-.55, -.3], [.46, -.41], [.8, -.18], [.8, .28], [.36, .43], [-.55, .28]], [0, 0, .47], p.jade, .09);
    for (let i = 0; i < 4; i++) {
      const z = -.56 + i * .36, reach = [1.45, 1.8, 1.66, 1.24][i];
      const knuckle: P = [.92, .12, z], middle: P = [1.52, .24 + i * .05, z], tip: P = [.92 + reach, .13 + i * .09, z];
      rod(a, palm, knuckle, middle, .135, p.paper); rod(a, palm, middle, tip, .105, p.paper);
      joint(a, palm, knuckle, .155); joint(a, palm, middle, .135);
      rod(a, palm, [.95, .29, z], [.86 + reach, .28 + i * .09, z], .024, p.vermilion);
    }
    rod(a, palm, [.15, -.45, .35], [.73, -1.02, .64], .19, p.paper); rod(a, palm, [.73, -1.02, .64], [1.46, -.88, .72], .14, p.paper); joint(a, palm, [.73, -1.02, .64], .2);
    for (const x of [-3.6, -.2, 2.4]) rod(a, r, [x, 5.05, -1], [x, x < 0 ? 3.7 : 3.3, -.6], .023, p.vermilion);
    a.ring(r, .8, .11, [-4.5, 5.9, -.9], p.gold); rod(a, r, [-5.2, 5.9, -.9], [-3.8, 5.9, -.9], .05);
    for (let i = 0; i < 7; i++) { const x = -3.2 + i * .9; a.box(r, [.05, .035, i % 2 ? .25 : .48], [x, 1.13, 1.2], p.gold); }
  },
  '2026-07-13': (a, r) => {
    const p = a.palette;
    const palette = a.mesh(r, new T.CylinderGeometry(3.8, 4, .28, 48), p.paper, [-.7, 1.3, -.8]); palette.scale.z = .64;
    const colors = [p.vermilion, p.gold, p.jade, p.ice, p.heather];
    for (let i = 0; i < 5; i++) { const t = i / 4 * Math.PI; const x = Math.cos(t) * 2.8 - .7, z = Math.sin(t) * 1.55 - 1.5; a.cylinder(r, .55, .16, [x, 1.55, z], p.gold); a.cylinder(r, .45, .17, [x, 1.61, z], colors[i]); const petal = fin(a, r, [[-.55, 0], [-1, 1.1], [-.5, 2.2], [0, 2.5], [.6, 1.9], [.75, .75]], [x, 2.1 + (i % 2) * .3, z], colors[i], .12); petal.rotation.z = (i - 2) * -.23; rod(a, r, [x, 1.7, z], [x, 4, z], .04); }
    rod(a, r, [4.2, 1.1, -.7], [2.7, 6.7, -.7], .18, p.forest);
    a.cylinder(r, .23, .65, [2.8, 6.4, -.7], p.gold);
    fin(a, r, [[-.28, 0], [-.33, .65], [0, 1.6], [.33, .65], [.28, 0]], [2.65, 6.55, -.7], p.vermilion, .2);
    for (let i = 0; i < 5; i++) a.box(r, [1.7, .05, 1.3], [4, 1.03 + i * .07, 1], i === 4 ? p.jade : p.paper);
  },
  '2026-07-14': (a, r) => {
    const p = a.palette;
    // A message tree is made of bent brass stems and distinctive folded swallow wings.
    slab(a, r, [0, .95, -1], 5.1, 3.3); rod(a, r, [0, 1, -1], [-.6, 7.8, -1], .18, p.forest);
    for (let i = 0; i < 5; i++) { const side = i % 2 ? 1 : -1, x = side * (2.2 + (i % 3) * .65), y = 3 + i; a.line(r, [[-.2, 2 + i * .5, -1], [side * 1.1, y, -1], [x, y + .35, -1]], .075, p.gold); const wing = [[-1.1, .8], [-.3, .3], [0, 0], [.3, .3], [1.15, .9], [.55, -.15], [0, -.35], [-.55, -.15]] as [number, number][]; fin(a, r, wing, [x, y + .45, -1], i % 2 ? p.jade : p.paper, .1); rod(a, r, [x, y + .1, -.9], [x, y - .75, -.9], .02); const letter = a.box(r, [.8, .5, .08], [x, y - 1, -.9], p.paper); letter.rotation.z = side * .13; a.line(r, [[x - .4, y - .75, -.84], [x, y - 1.07, -.84], [x + .4, y - .75, -.84]], .022, p.vermilion); }
    for (let i = 0; i < 7; i++) joint(a, r, [-1.9 + i * .65, 1.06, .25], .08);
  },
  '2026-07-15': (a, r) => {
    const p = a.palette;
    // An elliptical postal basket hangs under a ribbed kite canopy.
    const basket = a.cylinder(r, 2.1, 1.5, [0, 2.1, -1], p.jade, 2.6); basket.scale.z = .65;
    for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; rod(a, r, [Math.cos(t) * 2.1, 1.35, -1 + Math.sin(t) * 1.37], [Math.cos(t) * 2.6, 2.85, -1 + Math.sin(t) * 1.69], .035, p.gold); }
    for (let i = 0; i < 7; i++) { const z = -3 + i * .62; a.line(r, [[-4.2, 5.7, z], [-2, 7.45, z], [0, 8, z], [2, 7.45, z], [4.2, 5.7, z]], .055, p.gold); if (i < 6) fin(a, r, [[-4.2, 0], [-2, 1.75], [0, 2.3], [2, 1.75], [4.2, 0], [2, 1.5], [0, 2.1], [-2, 1.5]], [0, 5.7, z], i % 2 ? p.paper : p.jade, .62); }
    for (const x of [-2.2, 2.2]) for (const z of [-2, 0]) rod(a, r, [x, 2.8, z], [x * 1.7, 6.1, z], .027);
    for (let i = 0; i < 4; i++) card(a, r, [-1.35 + i * .9, 3.1 + (i % 2) * .3, -.1], .65, .95);
    rod(a, r, [0, 1.3, -1], [0, .8, -1], .12, p.vermilion);
  },
  '2026-07-16': (a, r) => {
    const p = a.palette; slab(a, r, [0, .94, -.8], 9.4, 4.2);
    // An open tooth arch makes the meshing contact visible, not a puzzle rendering.
    const wheels: [number, number, number][] = [[-2.5, 3.3, 2], [.8, 4.3, 1.4], [3.15, 3.55, 1]];
    for (const [x, y, radius] of wheels) {
      const disk = a.cylinder(r, radius, .28, [x, y, -1], p.jade); disk.rotation.x = Math.PI / 2;
      a.ring(r, radius * .7, .055, [x, y, -.8], p.gold);
      for (let i = 0; i < 16; i++) { const t = i * Math.PI / 8; const tooth = a.box(r, [.32, .4, .42], [x + Math.cos(t) * (radius + .13), y + Math.sin(t) * (radius + .13), -1], p.paper); tooth.rotation.z = t - Math.PI / 2; }
      for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; rod(a, r, [x, y, -.65], [x + Math.cos(t) * radius * .68, y + Math.sin(t) * radius * .68, -.65], .06); }
      joint(a, r, [x, y, -.57], .2); rod(a, r, [x, 1.1, -1.4], [x, y, -1.4], .16, p.forest);
    }
    fin(a, r, [[0, 0], [1.8, .3], [1.5, 1.7], [.3, 1.9]], [3.9, 5.3, -1], p.vermilion, .12);
    a.line(r, [[-4.9, 6.1, -1.5], [-2.3, 7.6, -1.5], [.2, 7.4, -1.5], [3.3, 6.2, -1.5]], .04, p.gold);
  },
  '2026-07-17': (a, r) => {
    const p = a.palette;
    // An ascending split stair grows a canopy of completed leaves, open treads below.
    for (let i = 0; i < 9; i++) { const x = -5.2 + i * 1.15, y = 1.1 + i * .46, z = Math.sin(i * .5) * .8 - 1; slab(a, r, [x, y, z], 1.22, 2.2); rod(a, r, [x, .8, z], [x, y, z], .075, p.forest); if (i % 2 === 0) { rod(a, r, [x, y, z - .7], [x, y + 2.2, z - .7], .045); const leaf = fin(a, r, [[0, 0], [-.6, .5], [-.45, 1.15], [0, 1.5], [.6, .8]], [x, y + 1.4, z - .7], p.jade, .12); leaf.rotation.z = -.3; } }
    a.line(r, [[-5.2, 1.8, .3], [-2, 3, .9], [1.2, 4.3, .7], [4.2, 5.4, -.2]], .045, p.gold);
    for (let i = 0; i < 9; i++) a.box(r, [.25, .055, .65], [-5.2 + i * 1.15, 1.21 + i * .46, -.6 + Math.sin(i * .5) * .8], i > 5 ? p.limestone : p.vermilion);
    a.mesh(r, new T.OctahedronGeometry(.5), p.gold, [4.15, 7.5, -1.6]);
  },
  '2026-07-18': (a, r) => {
    const p = a.palette;
    for (let i = 0; i < 7; i++) { const x = -5 + i * 1.55, h = 1.5 + (6 - i) * .6; a.box(r, [1.32, h, 2.3], [x, .8 + h / 2, -1], p.paper); a.box(r, [1.15, .1, 2.1], [x, .85 + h, -1], p.jade); rod(a, r, [x, .95 + h, -1], [x, 3 + h, -1], .035); fin(a, r, [[0, 0], [1, -.15], [.75, .25], [1, .65], [0, .75]], [x, 2.1 + h, -1], i === 0 ? p.vermilion : p.gold, .06); for (let j = 0; j <= i; j++) a.box(r, [.45, .03, .04], [x, 1.3 + j * .26, .18], p.gold); }
    a.line(r, [[-5.2, 1.2, 1.1], [-1, 1.2, 1.3], [3, 1.2, 1.3], [5.5, 2.5, 1]], .065, p.vermilion);
    a.ring(r, .4, .05, [5.5, 2.5, 1], p.gold);
  },
  '2026-07-19': (a, r) => {
    const p = a.palette; slab(a, r, [0, .96, -1], 10.5, 4.7);
    // Three distinct paths weave into one suspended knot and separate into reading stations.
    for (let thread = 0; thread < 3; thread++) { const pts: P[] = []; for (let i = 0; i <= 36; i++) { const t = i / 36 * Math.PI * 2; pts.push([Math.sin(t) * (2.7 + .6 * Math.cos(t * 3 + thread * 2.1)), 4.7 + Math.cos(t) * 2.5, -1 + Math.sin(t * 3 + thread * 2.1) * .9]); } a.line(r, pts, .115, [p.gold, p.vermilion, p.jade][thread]); const x = -4 + thread * 4; rod(a, r, [x, 1.05, .3], [x, 2.1, .3], .08, p.forest); const desk = a.box(r, [1.65, .12, 1.05], [x, 2.1, .3], p.paper); desk.rotation.x = -.2; card(a, r, [x, 2.55, .3], .95, .7); }
    rod(a, r, [-3.5, 1, -2.5], [-3.5, 7.5, -2.5], .08); rod(a, r, [3.5, 1, -2.5], [3.5, 7.5, -2.5], .08); rod(a, r, [-3.5, 7.5, -2.5], [3.5, 7.5, -2.5], .08);
    for (const x of [-1.8, 1.8]) rod(a, r, [x, 7.5, -2.5], [x, 6.6, -1], .023);
  },
  '2026-07-20': (a, r) => {
    const p = a.palette; slab(a, r, [0, 1, -.7], 12, 3.8);
    // A monumental slide rule spans a saddle, its moving cursor a narrow glazed cage.
    for (let rail = 0; rail < 3; rail++) { const z = -2 + rail * 1.1; a.box(r, [10.7, .4, .92], [rail === 1 ? 1.1 : 0, 2.6 + rail * .23, z], rail === 1 ? p.jade : p.paper); for (let i = 0; i < 31; i++) a.box(r, [.035, .025, i % 5 ? .23 : .5], [-5 + i / 3 + (rail === 1 ? 1.1 : 0), 2.82 + rail * .23, z], p.gold); }
    for (const x of [-3.5, 3.5]) fin(a, r, [[-1, 0], [-.6, 1.6], [.6, 1.6], [1, 0]], [x, 1.1, -2.3], p.forest, 2.8);
    for (const x of [-.15, 1.1]) { rod(a, r, [x, 2.45, -2.55], [x, 5.8, -2.55], .07); rod(a, r, [x, 2.45, .8], [x, 5.8, .8], .07); rod(a, r, [x, 5.8, -2.55], [x, 5.8, .8], .07); }
    a.box(r, [1.4, .15, 3.6], [.5, 5.85, -.85], p.paper); rod(a, r, [.5, 2.5, .85], [.5, 5.9, .85], .025, p.vermilion);
    a.ring(r, .55, .045, [.5, 6.6, -.8], p.gold);
  },
  '2026-07-21': (a, r) => {
    const p = a.palette; slab(a, r, [0, .97, -1], 7.8, 3.6);
    // A drawing physically unfolds into three perpendicular drafting planes.
    fin(a,r,[[-4,0],[-4,4.8],[-1.2,4.8],[-1.2,0]],[0,1.1,-2.1],p.paper,.16);
    const folded=a.box(r,[3.8,.15,3.1],[.65,3.15,-.65],p.jade);folded.rotation.z=.18;
    fin(a,r,[[-1.5,0],[-1.5,3.4],[1.5,3.4],[1.5,0]],[3.35,3.45,-.8],p.paper,.15);
    for(let i=0;i<5;i++){a.box(r,[2.1,.035,.025],[-2.6,2+i*.67,-1.9],p.gold);a.box(r,[.035,3.9,.025],[-3.65+i*.5,3.45,-1.9],p.gold);}
    const points:P[]=[[1.8,4.05,-.58],[3.35,5.8,-.58],[4.6,4.4,-.58]];a.line(r,points,.045,p.vermilion);points.forEach(pt=>joint(a,r,pt,.12));
    for(const x of [-1,1]){rod(a,r,[x,1,-1.2],[x,3.1,-1.2],.09,p.forest);}
    for(let i=0;i<6;i++){const x=-.8+i*.52;a.box(r,[.15,.025,.15],[x,3.25+x*.18,-.1],p.gold);}
    a.ring(r,.48,.05,[-2.6,6.7,-2],p.gold);
  },
  '2026-07-22': (a, r) => {
    const p = a.palette; slab(a, r, [0, .93, -.7], 10.2, 4.3);
    // Two unequal optical barrels face a shared split target, with adjustment racks underneath.
    for (const side of [-1, 1]) { const x = side * 3.35; a.box(r, [2.15, .3, 2.8], [x, 1.4, -1], p.jade); for (let i = 0; i < 8; i++) a.box(r, [.15, .17, 2.5], [x - .8 + i * .23, 1.64, -1], p.gold); rod(a, r, [x, 1.7, -1], [x, 4.1, -1], .19, p.forest); for (let i = 0; i < 4; i++) { const b = a.cylinder(r, 1 - i * .13, .38, [x - side * i * .3, 4.2, -1], i % 2 ? p.paper : p.gold); b.rotation.z = Math.PI / 2; } a.ring(r, .85, .06, [x, 4.2, -.45], p.jade); }
    fin(a, r, [[0, 0], [-1.4, 1.8], [0, 4], [1.4, 1.8]], [0, 2.15, -.9], p.paper, .18);
    rod(a, r, [0, 2.2, -.64], [0, 6.15, -.64], .033, p.vermilion);
    for (let i = 0; i < 5; i++) a.box(r, [1.25 - Math.abs(i - 2) * .32, .04, .04], [0, 3.1 + i * .48, -.64], p.gold);
    a.line(r, [[-4.8, 6.6, -2.1], [0, 7.5, -2.1], [4.8, 6.6, -2.1]], .045, p.gold);
  },
  '2026-07-23': (a, r) => {
    const p = a.palette; slab(a, r, [0, .9, -1], 10.8, 4.8);
    // Opposed bascule bridges rise in synchrony, with crossed pull cables and equal hinge marks.
    for(const side of [-1,1]){const x=side*4.3;for(const z of [-2.3,.3]){rod(a,r,[x,1,z],[x,6.2,z],.11,p.forest);a.cylinder(r,.24,.16,[x,6.2,z],p.gold);}const g=new T.Group();g.position.set(x,1.5,-1);g.rotation.z=-side*.56;r.add(g);for(let i=0;i<9;i++){const dx=-side*i*.46;a.box(g,[.5,.18,2.4],[dx,0,0],p.paper);for(const z of [-1.15,1.15]){rod(a,g,[dx,0,z],[dx,.65,z],.025,p.gold);}}for(const z of [-2.1,.1]){rod(a,r,[x,6.2,z],[side*.85,3.6,z],.035,p.gold);rod(a,r,[x,6.2,z],[-side*4.3,1.5,z],.024,p.vermilion);}a.ring(r,.42,.08,[x,1.5,.36],p.gold);}
    a.box(r,[1.4,1.1,1.2],[0,1.65,-1],p.jade);a.ring(r,.3,.045,[0,2.3,-.34],p.gold);rod(a,r,[-.2,2.3,-.27],[.2,2.3,-.27],.025,p.vermilion);
  },
  '2026-07-24': (a, r) => {
    const p = a.palette; slab(a, r, [0, 1, -1], 8.2, 4.1);
    a.line(r, [[-3, 1.5, -1], [-3.8, 4.5, -1], [-2.3, 7.6, -1], [-1.6, 7.2, -1]], .22, p.jade);
    a.line(r, [[3, 1.5, -1], [3.8, 4.5, -1], [2.3, 7.6, -1], [1.6, 7.2, -1]], .22, p.jade);
    a.box(r, [5.5, .3, 1.1], [0, 1.4, -1], p.paper); a.box(r, [5, .23, .55], [0, 6.7, -1], p.gold);
    for (let i = 0; i < 6; i++) { const x = -2 + i * .8; rod(a, r, [x, 1.6, -1], [x, 6.65, -1], .022, p.gold); joint(a, r, [x, 6.7, -.7], .1); }
    // The radio coil crosses the strings without filling the lyre's negative space.
    for (let i = 0; i < 3; i++) arc(a, r, .75 + i * .45, -.75, 1.5, [3.7, 5.5, -.8], p.vermilion, .055);
    fin(a, r, [[0, 0], [1, 1.1], [0, 2.2], [0, 0], [1, -.8]], [-.7, 3.35, -.66], p.paper, .18);
    for (let i = 0; i < 8; i++) a.box(r, [.12, .08, .75], [-2.5 + i * .7, 1.61, -.9], p.gold);
  },
  '2026-07-25': (a, r) => {
    const p = a.palette; slab(a, r, [0, 1, -1], 7, 3.8);
    a.box(r, [5.6, 5.7, 1.15], [0, 3.95, -1.4], p.jade);
    for (const x of [-2.95, 2.95]) a.box(r, [.18, 6, 1.4], [x, 4, -1.4], p.gold);
    for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 1.7, y = 2.2 + Math.floor(i / 3) * 1.7; const dial = a.cylinder(r, .64, .15, [x, y, -.7], p.paper); dial.rotation.x = Math.PI / 2; a.ring(r, .57, .035, [x, y, -.58], p.gold); for (let j = 0; j < 4; j++) { const t = j * Math.PI / 2; rod(a, r, [x + Math.cos(t) * .42, y + Math.sin(t) * .42, -.54], [x + Math.cos(t) * .5, y + Math.sin(t) * .5, -.54], .02, p.ink); } const t = i * .73; rod(a, r, [x, y, -.49], [x + Math.sin(t) * .4, y + Math.cos(t) * .4, -.49], .035, p.vermilion); joint(a, r, [x, y, -.47], .085); }
    for (const x of [-2, 2]) { a.ring(r, .26, .09, [x, 7.16, -1.4], p.gold); a.box(r, [.55, .3, .55], [x, 7, -1.4], p.paper); }
    fin(a, r, [[-2.7, 0], [0, 1.1], [2.7, 0]], [0, 7, -2], p.paper, 1.35);
  },
  '2026-07-26': (a, r) => {
    const p = a.palette; slab(a, r, [0, .95, -1], 10.5, 4.6);
    // A prism reveals a path before it is walked: a split beam and progressively revealed steps.
    const prism=a.mesh(r,new T.CylinderGeometry(2.1,2.1,3.4,3),p.ice,[-2.3,4.15,-1]);prism.rotation.x=Math.PI/2;prism.rotation.z=.2;
    const edges=new T.EdgesGeometry(prism.geometry);const position=edges.getAttribute('position');for(let i=0;i<position.count;i+=2){const s=new T.Vector3().fromBufferAttribute(position,i).applyEuler(prism.rotation).add(prism.position),e=new T.Vector3().fromBufferAttribute(position,i+1).applyEuler(prism.rotation).add(prism.position);rod(a,r,s.toArray() as P,e.toArray() as P,.055,p.gold);}edges.dispose();
    for(const x of [-3.7,-.9]){rod(a,r,[x,1.1,-1],[x,2.5,-1],.15,p.forest);slab(a,r,[x,1.05,-1],1.3,2.1);}
    a.line(r,[[-5.2,2.1,-.6],[-3.3,3.6,-.6],[-2.3,4.15,-.6]],.085,p.vermilion);
    for(let i=0;i<6;i++){const x=.5+i*.9,y=1.45+i*.55;slab(a,r,[x,y,-.2],.85,1.7);a.line(r,[[-2.3,4.15,-.6],[x*.5,5.7+i*.18,-.4],[x,y+.35,-.2]],.027,i%2?p.gold:p.jade);if(i<3)joint(a,r,[x,y+.18,-.2],.1);}
    fin(a,r,[[-.45,0],[0,.75],[.45,0]],[5,6.7,-.2],p.paper,.14);
  },
  '2026-07-27': (a, r) => {
    const p = a.palette;
    // A tessellated pointed vault, its open triangular faces standing for exhaustive coverage.
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) { const x = side * (4.5 - row * .72), y = 1.2 + row * 1.14; for (let j = 0; j < 5; j++) { const face = fin(a, r, [[-.65, 0], [0, 1.05], [.65, 0]], [x, y, -3.4 + j * .9], (j + row) % 3 === 0 ? p.jade : p.paper, .72); face.rotation.z = side * .38; rod(a, r, [x - .45, y + .2, -2.61 + j * .9], [x + .1, y + .8, -2.61 + j * .9], .022); } }
    for (let j = 0; j < 5; j++) a.mesh(r, new T.OctahedronGeometry(.62), p.gold, [0, 7.2, -3.15 + j * .9]);
    slab(a, r, [0, 1, -.7], 5.2, 4.2);
    for (let i = 0; i < 5; i++) a.box(r, [2.4 - i * .33, .13, 2 - i * .24], [0, 1.14 + i * .15, -.5], p.paper);
    a.mesh(r, new T.IcosahedronGeometry(.85, 0), p.vermilion, [0, 3.2, -.5]);
  },
  '2026-07-28': (a, r) => {
    const p = a.palette;
    // Three sail spars take radically different bends; only a light skeleton carries each sheet.
    const sails: [P, P, P][] = [[[-4.7, 1, -1.8], [-5.7, 5.7, -1.8], [-1.5, 3.5, -1.8]], [[-.7, 1, -.7], [1.1, 8.3, -.7], [4.1, 4.8, -.7]], [[-1, 1, 1], [3.3, 2.4, 1], [5.4, 5.4, 1]]];
    sails.forEach(([base, tip, edge], i) => { fin(a, r, [[0, 0], [tip[0] - base[0], tip[1] - base[1]], [edge[0] - base[0], edge[1] - base[1]]], base, i === 1 ? p.paper : p.jade, .1); rod(a, r, base, tip, .085, p.gold); rod(a, r, tip, edge, .035); rod(a, r, base, edge, .035); joint(a, r, base, .17); for (let j = 1; j <= 4; j++) { const t = j / 5; rod(a, r, [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, base[2] + .13], [base[0] + (edge[0] - base[0]) * t, base[1] + (edge[1] - base[1]) * t, base[2] + .13], .018, p.gold); } });
    for (let i = 0; i < 5; i++) a.box(r, [1.5, .15, 1], [-4.6 + i * 2.1, 1, 1.6], p.paper);
    a.line(r, [[-5, 1.3, 1.6], [-1.7, 1.65, 1.6], [1.6, 1.8, 1.6], [5.2, 1.45, 1.6]], .07, p.vermilion);
  },
  '2026-07-29': (a, r) => {
    const p = a.palette; slab(a, r, [0, 1, -1], 11.7, 4.6);
    const colors = [p.vermilion, p.jade, p.gold, p.ice, p.heather];
    for (let i = 0; i < 5; i++) { const x = -4.7 + i * 2.35, h = 2.4 + (i % 3) * 1.3; const column = a.mesh(r, new T.CylinderGeometry(.95, .95, h, 3), colors[i], [x, 1.1 + h / 2, -1]); column.rotation.y = .2 + i * .3; const cap = a.mesh(r, new T.CylinderGeometry(1.06, 1.06, .13, 3), p.paper, [x, 1.2 + h, -1]); cap.rotation.y = column.rotation.y; const plate = a.box(r, [1.5, .65, .1], [x, h + 2.15, -.65], colors[(i + 2) % 5]); plate.rotation.z = (i % 2 ? -1 : 1) * .15; rod(a, r, [x, h + 1.2, -1], [x, h + 2, -.65], .03); for (let j = 0; j < i % 3 + 1; j++) a.box(r, [.12, .23, .05], [x - .25 + j * .23, h + 2.15, -.56], p.paper); }
    a.line(r, [[-5.2, 1.15, 1.2], [-2.1, 1.15, .7], [1.8, 1.15, 1.6], [5.3, 1.15, 1.1]], .045, p.gold);
  },
  '2026-07-30': (a, r) => {
    const p = a.palette; slab(a, r, [0, .98, -.8], 8.7, 4.6);
    const drum = a.cylinder(r, 2.3, 1.7, [0, 4.3, -1.1], p.forest); drum.rotation.x = Math.PI / 2;
    a.ring(r, 2.55, .12, [0, 4.3, -.1], p.gold); a.ring(r, .65, .12, [0, 4.3, -.02], p.paper);
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; const g = new T.Group(); g.position.set(0, 4.3, -.13); g.rotation.z = t; r.add(g); fin(a, g, [[.65, -.06], [2.28, -.45], [2.38, -.03], [.7, .17]], [0, 0, 0], i % 3 === 0 ? p.vermilion : p.paper, .28); rivets(a, g, [.95, .05, .32], [2.15, -.17, .32], 4); }
    for (const x of [-2.9, 2.9]) { fin(a, r, [[-.8, 0], [-.35, 3.3], [.35, 3.3], [.8, 0]], [x, 1.08, -1.6], p.jade, 1.4); joint(a, r, [x, 4.3, -.15], .22); }
    for (let i = 0; i < 5; i++) card(a, r, [-4.4 + i * .12, 1.9 + i * .09, -.5 - i * .18], 1.4, 1.55);
  },
  '2026-07-31': (a, r) => {
    const p = a.palette; slab(a, r, [0, 1, -1], 7.1, 4.7);
    const profile = [[1.25, 0], [1.65, .35], [1.9, 1.3], [1.8, 2.4], [1.1, 3.15], [.7, 3.45], [.65, 4.4], [.95, 4.55]].map(([x,y]) => new T.Vector2(x, y));
    a.mesh(r, new T.LatheGeometry(profile, 28), p.paper, [0, 1.12, -1]);
    for (const side of [-1, 1]) { const h = arc(a, r, 1.1, side > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI, [side * 1.25, 4, -1], p.gold, .13); h.scale.x = .7; }
    for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; const strip = a.box(r, [.13, 1.65, .1], [Math.cos(t) * 1.84, 3.15, -1 + Math.sin(t) * 1.84], p.jade); strip.rotation.y = -t; }
    const question = new T.Group(); question.position.set(.1, 6.45, -.5); r.add(question); arc(a, question, .8, -.1, Math.PI * 1.5, [0, .35, 0], p.vermilion, .16); rod(a, question, [.78, .25, 0], [0, -.65, 0], .16, p.vermilion); joint(a, question, [0, -1.15, 0], .18);
    for (let i = 0; i < 3; i++) card(a, r, [3.2 + i * .25, 1.7 + i * .4, -.5], .8, 1.1);
  },
  '2026-08-01': (a, r) => {
    const p = a.palette;
    // A calendrical drum on its side, encircled by offset lunar bands rather than a clock face.
    const drum = a.cylinder(r, 2.4, 3.2, [-1.2, 3.6, -1], p.paper); drum.rotation.z = Math.PI / 2;
    for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; const tab = a.box(r, [2.75, .3, .1], [-1.2, 3.6 + Math.cos(t) * 2.43, -1 + Math.sin(t) * 2.43], i % 6 ? p.gold : p.vermilion); tab.rotation.x = -t; }
    for (const x of [-3.1, .7]) { const hoop = a.ring(r, 2.55, .11, [x, 3.6, -1], p.jade); hoop.rotation.y = Math.PI / 2; for (const z of [-2.4, .4]) rod(a, r, [x, .9, z], [x, 3.6, -1], .13, p.forest); }
    const lunar = arc(a, r, 2.3, -.6, Math.PI * 1.6, [3.2, 5.2, -1.8], p.gold, .15); lunar.rotation.y = .4;
    a.mesh(r, new T.SphereGeometry(.75, 16, 10), p.paper, [4.3, 7.1, -1]);
    for (let i = 0; i < 5; i++) { slab(a, r, [2.6 + i * .6, 1 + i * .18, .6], .72, 1); a.box(r, [.04, .045, .45], [2.6 + i * .6, 1.1 + i * .18, .6], p.gold); }
  },
  '2026-08-02': (a, r) => {
    const p = a.palette; slab(a, r, [0, .98, -1], 7.8, 4.3);
    // Recognition is a flared camera iris flower; overlapping leaves expose its optical core.
    const iris = new T.Group(); iris.position.set(0, 4.65, -.9); r.add(iris);
    for (let i = 0; i < 8; i++) { const g = new T.Group(); g.rotation.z = i * Math.PI / 4; iris.add(g); fin(a, g, [[.7, -.1], [1.9, -1.25], [3.15, -.8], [3.45, .15], [2.5, .65], [1.05, .6]], [0, 0, i * .035], i % 2 ? p.paper : p.jade, .12); rod(a, g, [1.2, .25, .32], [2.8, -.15, .32], .025); joint(a, g, [2.62, -.06, .35], .09); }
    for (let i = 0; i < 4; i++) { const lens = a.cylinder(iris, 1.02 - i * .13, .22, [0, 0, .1 + i * .24], i === 3 ? p.ice : p.gold); lens.rotation.x = Math.PI / 2; }
    rod(a, r, [0, 1, -1], [0, 3.1, -1], .27, p.forest);
    for (const x of [-2.2, 2.2]) { fin(a, r, [[0, 0], [x, .7], [x * .6, 1.35], [.2, .9]], [0, 1.6, -1], p.jade, .16); }
    a.box(r, [1.7, .25, 1.1], [4.35, 1.15, .1], p.paper); for (let i = 0; i < 3; i++) a.ring(r, .16, .035, [3.9 + i * .4, 1.4, .7], p.gold);
  },
  '2026-08-03': (a, r) => {
    const p = a.palette;
    // A long dated concertina folds around a low table, with a reversible import shuttle.
    for (let i = 0; i < 11; i++) { const x = -5.5 + i * 1.05, z = i % 2 ? -1.2 : -.2, h = 1.7 + Math.sin(i * .5) * .55; const leaf = a.box(r, [1.45, h, .12], [x, 1.1 + h / 2, z], i % 3 === 0 ? p.jade : p.paper); leaf.rotation.y = i % 2 ? -.7 : .7; for (let j = 0; j < 3; j++) a.box(r, [.12, .12, .035], [x - .3 + j * .3, 1.8 + h / 3, z + .17], p.gold); rod(a, r, [x, 1.1, z], [x, 1.1 + h, z], .035); }
    for (const x of [-4.6, 4.8]) { rod(a, r, [x, 1, -2.8], [x, 5.4, -2.8], .11, p.forest); a.cylinder(r, .25, .2, [x, 5.45, -2.8], p.gold); }
    a.line(r, [[-4.6, 5.4, -2.8], [0, 4.65, -2.8], [4.8, 5.4, -2.8]], .038, p.gold);
    a.box(r, [2.2, .85, .8], [1, 4.2, -2.8], p.vermilion); a.ring(r, .22, .06, [.35, 4.7, -2.7], p.gold); a.ring(r, .22, .06, [1.65, 4.7, -2.7], p.gold);
    for (let i = 0; i < 4; i++) a.box(r, [.12, .32, .08], [.45 + i * .35, 4.2, -2.34], p.paper);
  },
  '2026-08-04': (a, r) => {
    const p = a.palette;
    // A tensile meeting shelter has six inward-facing seats and a scalloped cable roof.
    const count = 6;
    for (let i = 0; i < count; i++) { const t = i / count * Math.PI * 2; const x = Math.cos(t) * 4, z = Math.sin(t) * 2.2 - 1; rod(a, r, [x, .85, z], [x * 1.03, 5.3 + (i % 2) * .5, z], .08, p.forest); joint(a, r, [x * 1.03, 5.3 + (i % 2) * .5, z], .15); rod(a, r, [x * 1.03, 5.3 + (i % 2) * .5, z], [0, 7.35, -1], .045); const shape = new T.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(2, .8, 4.15, 1.9); shape.lineTo(0, 3.9); const panel = a.mesh(r, new T.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: false }), i % 2 ? p.paper : p.jade, [0, 3.45, -1]); panel.rotation.y = -t; panel.rotation.z = .12; const seatX = x * .68, seatZ = (z + 1) * .68 - 1; a.cylinder(r, .62, .55, [seatX, 1.2, seatZ], p.paper); a.cylinder(r, .57, .09, [seatX, 1.52, seatZ], p.jade); }
    a.cylinder(r, 1.25, .18, [0, 1.65, -1], p.gold); a.cylinder(r, .22, .7, [0, 1.2, -1], p.forest);
    joint(a, r, [0, 7.35, -1], .3); a.ring(r, .4, .07, [0, 7.95, -1], p.gold);
  },
  '2026-08-05': (a, r) => {
    const p = a.palette; slab(a, r, [0, .95, -.8], 10.4, 4.9);
    a.box(r, [9.4, .35, 3.1], [0, 2.3, -1], p.paper);
    for (const x of [-3.7, 3.7]) for (const z of [-2.15, .15]) rod(a, r, [x, 1, z], [x, 2.2, z], .16, p.forest);
    // Two complementary tools: an open jaw vise and a raked hand-plane with curled shaving.
    for (const x of [-3.8, -1.8]) { a.box(r, [.6, 2.4, 1.6], [x, 3.4, -1], p.jade); a.box(r, [.7, .18, 1.8], [x, 4.7, -1], p.gold); }
    rod(a, r, [-4.8, 3.6, -1], [-.8, 3.6, -1], .12); a.ring(r, .65, .095, [-4.8, 3.6, -.8], p.paper); rod(a, r, [-5.3, 3.6, -.8], [-4.3, 3.6, -.8], .055);
    fin(a, r, [[-1.4, 0], [-1.1, .55], [.5, .55], [1.4, .1], [1.25, -.1]], [2.35, 2.65, -1.7], p.forest, 1.4);
    const blade = a.box(r, [1.15, 2.35, .17], [2.7, 3.85, -1], p.gold); blade.rotation.z = -.5;
    arc(a, r, .75, -.2, Math.PI * 1.65, [1.2, 3.6, -.9], p.paper, .14);
    for (let i = 0; i < 7; i++) a.box(r, [.14, .035, 2.3], [-.2 + i * .65, 2.5, -1], p.gold);
  },
  '2026-08-06': (a, r) => {
    const p = a.palette;
    // Award ribbons form three flying buttresses around one small gilded summit.
    for (let i = 0; i < 3; i++) { const g = new T.Group(); g.position.set(-2.8 + i * 2.9, 1, -1.8 + i * .35); r.add(g); const h = [4.2, 6.8, 5.1][i]; fin(a, g, [[-1.35, 0], [-1.1, h * .65], [-.25, h], [.65, h * .83], [1.25, .8], [.55, 1.25], [.25, h * .74], [-.25, h * .86], [-.5, h * .58], [-.7, 0]], [0, 0, 0], i === 1 ? p.vermilion : p.jade, .4); a.line(g, [[-1.05, .3, .43], [-.8, h * .6, .43], [-.25, h * .92, .43], [.47, h * .78, .43], [.91, 1, .43]], .038, p.gold); a.box(g, [2.6, .16, 2.2], [0, .06, .1], p.paper); }
    a.mesh(r, new T.OctahedronGeometry(.8), p.gold, [.1, 8.3, -1.4]);
    for (let i = 0; i < 9; i++) { const t = i / 8 * Math.PI; const leaf = fin(a, r, [[-.12, 0], [-.3, .4], [0, .8], [.3, .4]], [Math.cos(t) * 4.3, 1.4, Math.sin(t) * 1.5], p.gold, .07); leaf.rotation.z = t - Math.PI / 2; }
  },
  '2026-08-07': (a, r) => {
    const p = a.palette;
    // Seven differently shaped peaks share a common transverse measuring level.
    const hs = [2.1, 4.2, 3.1, 6.3, 4.9, 3.7, 2.5];
    hs.forEach((h, i) => { const x = -5.5 + i * 1.8; fin(a, r, [[-.85, 0], [-.55, h * .75], [-.2, h], [.35, h * .91], [.85, 0]], [x, .95, -2.1 + (i % 2) * .3], i === 3 ? p.jade : p.paper, 1.8); for (let j = 1; j < h / .45; j++) a.box(r, [1.45 - j * .045, .04, .035], [x, 1 + j * .45, -.21 + (i % 2) * .3], p.gold); });
    rod(a, r, [-6.2, 6.45, .6], [6.2, 6.45, .6], .055, p.vermilion);
    for (const x of [-6.2, 6.2]) { rod(a, r, [x, 1, .6], [x, 7.1, .6], .085, p.forest); joint(a, r, [x, 6.45, .6], .15); }
    a.box(r, [1.65, .6, .12], [4.8, 7.3, .6], p.paper); rivets(a, r, [4.2, 7.3, .7], [5.4, 7.3, .7], 5);
  },
  '2026-08-08': (a, r) => {
    const p = a.palette;
    // Two broad paper streams braid at different elevations, their engraved records readable above stone piers.
    for (let lane = 0; lane < 2; lane++) {
      const point = (t: number) => new T.Vector3(-5.7 + t * 11.4, lane === 0 ? 2.4 + Math.sin(t * Math.PI) * 1.75 + (1 - t) * .5 : 4.95 - Math.sin(t * Math.PI) * 1.3 - t * 1.25, -1.15 + Math.sin(t * Math.PI * 2) * .8 + lane * 1.1);
      for (let i = 0; i < 24; i++) {
        const t = i / 23, position = point(t), tangent = point(Math.min(1, t + .015)).sub(point(Math.max(0, t - .015))).normalize();
        const section = new T.Group(); section.position.copy(position); section.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), tangent); r.add(section);
        a.box(section, [.56, .22, lane ? 1.22 : 1.7], [0, 0, 0], p.paper);
        a.box(section, [.57, .055, lane ? 1.04 : 1.48], [0, .14, 0], lane ? p.jade : p.water);
        a.box(section, [.56, .07, .095], [0, .16, lane ? .59 : .82], p.gold);
        for (const x of [-.15, .08]) a.box(section, [.025, .018, i % 4 === 0 ? .68 : .34], [x, .18, -.1], p.paper);
        if (i % 8 === 0 || i === 23) {
          const [x, y, z] = position.toArray();
          for (const dz of [-.38, .38]) fin(a, r, [[-.45, 0], [-.29, y - 1.08], [.29, y - 1.08], [.45, 0]], [x, .91, z + dz], p.limestone, .22);
          a.box(r, [1.13, .19, 1.55], [x, y - .24, z], p.paper); slab(a, r, [x, 1, z], 1.35, 1.8);
          for (let mark = 0; mark < 3; mark++) a.box(r, [.34, .033, .035], [x, 1.35 + mark * .28, z + .64], p.gold);
        }
      }
    }
    for (let i = 0; i < 6; i++) { const tab = a.box(r, [2.05, .16, 1.35], [4.9, 1.12 + i * .23, 1.15 - i * .1], i === 5 ? p.jade : p.paper); tab.rotation.y = i * .045; }
    a.line(r, [[-5.5, 4.9, -2.8], [-5.5, 6.5, -2.8], [-2.4, 6.5, -2.8]], .07, p.gold); card(a, r, [-3.1, 5.8, -2.8], 1.9, 1.15);
  },
  '2026-08-09': (a, r) => {
    const p = a.palette; slab(a, r, [0, .96, -1], 8, 4.5);
    // A missing keystone is visibly lowered into an irregular tessellated repair wall.
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) { if (row === 3 && col === 2) continue; const x = -3.4 + col * 1.65, y = 1.15 + row * 1.23; const piece = [[-.74, 0], [-.65, .86], [-.2, 1.08], [.7, .94], [.77, .15], [.25, -.08]] as [number, number][]; fin(a, r, piece, [x + (row % 2) * .18, y, -1.8], (col + row) % 4 === 0 ? p.jade : p.paper, .55); for (let j = 0; j < 2; j++) a.box(r, [.68, .025, .03], [x, y + .4 + j * .2, -1.2], p.gold); }
    const cap = fin(a, r, [[-.74, 0], [-.65, .86], [-.2, 1.08], [.7, .94], [.77, .15], [.25, -.08]], [.18, 6.4, -1.8], p.vermilion, .55);
    cap.rotation.z = -.09;
    rod(a, r, [-4.4, 1, -2.3], [-4.4, 8.2, -2.3], .12, p.forest); rod(a, r, [-4.4, 8.2, -2.3], [1.7, 8.2, -2.3], .12, p.forest); rod(a, r, [.2, 8.2, -2.3], [.2, 7.25, -1.5], .025); a.ring(r, .25, .06, [.2, 7.5, -1.5], p.gold);
    a.box(r, [1.8, .16, 1.3], [4.8, 1.08, .4], p.paper); card(a, r, [4.8, 1.65, .5], 1.25, .9);
  },
  '2026-08-10': (a, r) => {
    const p = a.palette;
    // A taut survey quadrilateral is read by hanging plumb weights and a sloping baseline.
    const posts: P[] = [[-4.8, 6.6, -1.8], [-2, 4.8, .4], [4.6, 7.4, -1.8], [3.1, 3.9, .7]];
    posts.forEach(([x, y, z], i) => { slab(a, r, [x, .95, z], 1.45, 1.5); rod(a, r, [x, 1, z], [x, y, z], .1, p.forest); a.cylinder(r, .24, .24, [x, y, z], p.gold); for (let j = 0; j < 6; j++) a.box(r, [.24, .035, .08], [x + .16, 1.3 + j * .44, z + .08], p.paper); rod(a, r, posts[i], posts[(i + 1) % 4], .025, p.vermilion); });
    rod(a, r, posts[0], posts[2], .03); rod(a, r, posts[1], posts[3], .03);
    for (const [x, y, z] of [[-1.8, 6.9, -1.8], [1.3, 7.15, -1.8]] as P[]) { rod(a, r, [x, y, z], [x, 2.2, z], .02); a.mesh(r, new T.ConeGeometry(.23, .62, 8), p.gold, [x, 1.9, z]); }
    const ruler = a.box(r, [10.8, .16, .55], [0, 1.35, 1.6], p.paper); ruler.rotation.z = .07; for (let i = 0; i < 21; i++) a.box(r, [.03, .035, i % 5 ? .16 : .34], [-5 + i * .5, 1.47 + i * .035, 1.6], p.gold);
  },
  '2026-08-11': (a, r) => {
    const p = a.palette;
    // A giant segmented flower opens its proofs in four distinct elevation bands.
    a.cylinder(r, .37, 3.8, [0, 2.85, -1], p.forest, .2);
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2 + layer * .32; const g = new T.Group(); g.position.set(0, 3.9 + layer * .75, -1); g.rotation.y = t; g.rotation.z = .2 + layer * .22; r.add(g); fin(a, g, [[.2, 0], [1.1, -.15], [2.7 - layer * .3, .65], [3.2 - layer * .4, 1.6], [1.9, 1.15], [.4, .4]], [0, 0, 0], layer === 1 ? p.paper : p.jade, .15); a.line(g, [[.3, .2, .17], [1.4, .4, .17], [2.6 - layer * .3, 1.1, .17]], .03, p.gold); }
    a.mesh(r, new T.DodecahedronGeometry(.8), p.gold, [0, 6.8, -1]);
    for (let i = 0; i < 4; i++) { const x = -3.6 + i * 2.4; slab(a, r, [x, 1 + i * .13, .9], 1.9, 1.2); for (let j = 0; j <= i; j++) a.box(r, [.25, .12, .5], [x - .55 + j * .35, 1.17 + i * .13, .9], p.gold); }
    a.line(r, [[-4.1, 1.2, -1], [-1.6, 1.8, -1], [0, 2.7, -1], [2, 1.7, -1], [4.2, 1.3, -1]], .05, p.vermilion);
  },
  '2026-08-12': (a, r) => {
    const p = a.palette;
    // An offline traveling workshop, compact caravan with folding solar-paper awning.
    a.box(r, [6.6, .35, 3.1], [0, 1.55, -1], p.forest); a.box(r, [5.1, 3.8, 2.6], [-.5, 3.6, -1], p.paper);
    for (const x of [-2.3, 2.3]) for (const z of [-2.6, .6]) { const wheel = a.cylinder(r, .65, .22, [x, 1.45, z], p.jade); wheel.rotation.x = Math.PI / 2; a.ring(r, .52, .04, [x, 1.45, z + .14], p.gold); joint(a, r, [x, 1.45, z + .17], .13); }
    a.box(r, [1.3, 2.5, .1], [-1.3, 3.1, .35], p.jade); a.box(r, [1.5, 1.2, .1], [.7, 4.1, .35], p.ice);
    for (let i = 0; i < 4; i++) a.box(r, [.03, 1.2, .04], [.2 + i * .35, 4.1, .43], p.gold);
    for (let i = 0; i < 6; i++) { const roof = a.box(r, [.9, .1, 4], [-2.75 + i * .9, 5.8 - Math.abs(i - 2.5) * .12, -.5], i % 2 ? p.jade : p.paper); roof.rotation.z = i < 3 ? .15 : -.15; }
    for (const x of [-2.7, 2.5]) rod(a, r, [x, 1, 1.4], [x, 5.4, 1.4], .055, p.gold);
    a.line(r, [[3.3, 1.55, -1], [5.1, 1.55, -1], [5.5, 1.1, -1]], .1, p.gold); a.ring(r, .25, .06, [5.55, 1.1, -1], p.vermilion);
    for (let i = 0; i < 3; i++) a.box(r, [1.4, .17, .45], [-1.3, 1.2 + i * .18, .8 + i * .4], p.paper);
  },
  '2026-08-13': (a, r) => {
    const p = a.palette;
    // A learning quay of four unlike civic buildings with shared pedestrian colonnade.
    const buildings: [number, number, number][] = [[-4.7, 3.1, 2], [-1.7, 5.2, 2.4], [1.6, 3.8, 2.1], [4.4, 2.5, 1.8]];
    buildings.forEach(([x, h, w], i) => { a.box(r, [w, h, 2.2], [x, 1 + h / 2, -1.5], p.paper); if (i === 0) { const dome = a.mesh(r, new T.SphereGeometry(w * .63, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), p.jade, [x, h + 1, -1.5]); dome.scale.y = .65; } else if (i === 1) fin(a, r, [[-w * .65, 0], [0, 1.4], [w * .65, 0]], [x, h + 1, -2.7], p.jade, 2.4); else { for (let j = 0; j < 3; j++) a.box(r, [w + .35 - j * .2, .16, 2.5 - j * .12], [x, h + 1 + j * .2, -1.5], p.jade); } for (let j = 0; j < 3; j++) a.box(r, [.25, .6, .04], [x - .6 + j * .6, h + .2, -.36], p.gold); });
    for (let i = 0; i < 12; i++) { const x = -5.7 + i; rod(a, r, [x, 1, .6], [x, 2.5, .6], .045, p.forest); a.box(r, [.78, .14, .9], [x, 2.57, .6], p.paper); }
    a.box(r, [12.3, .24, 1.3], [0, 1, 1.1], p.limestone);
    a.ring(r, .46, .06, [-1.7, 5.6, -.3], p.gold); rod(a, r, [-1.7, 5.6, -.23], [-1.7, 5.92, -.23], .03);
  },
  '2026-08-14': (a, r) => {
    const p = a.palette;
    // Two folded reed-leaf beds meet through low crossing paper bridges, without an organ-pipe silhouette.
    for (const side of [-1, 1]) {
      const bed = a.cylinder(r, 2.1, .28, [side * 3.35, 1.03, -1.35], p.paper); bed.scale.z = .75;
      const inset = a.cylinder(r, 1.84, .055, [side * 3.35, 1.2, -1.35], p.water); inset.scale.z = .7;
      const leaves = side < 0 ? [[-.65, 4.55, -.32, -.45], [.15, 6.2, .14, .12], [.95, 4.9, .34, .57]] : [[-.85, 4.15, -.3, -.45], [0, 5.7, -.12, .3], [.85, 4.8, .32, .62]];
      leaves.forEach(([offset, h, tilt, turn], i) => {
        const leaf = new T.Group(); leaf.position.set(side * 3.35 + offset, 1.25, -1.6 + (i % 2) * .5); leaf.rotation.set(0, turn, tilt); r.add(leaf);
        const back = fin(a, leaf, [[0, 0], [-.66, h * .25], [-.87, h * .58], [-.5, h * .82], [0, h]], [0, 0, 0], side < 0 ? p.forest : p.jade, .095); back.rotation.y = -.32;
        const front = fin(a, leaf, [[0, 0], [.56, h * .25], [.81, h * .58], [.43, h * .83], [0, h]], [0, 0, 0], side < 0 ? p.jade : p.paper, .095); front.rotation.y = .38;
        rod(a, leaf, [0, .1, .13], [0, h - .06, .13], .038, p.gold);
        for (let vein = 0; vein < 5; vein++) { const y = h * (.25 + vein * .1), reach = .56 - Math.abs(vein - 2) * .07; rod(a, leaf, [0, y, .14], [reach, y + h * .095, -.04], .018, p.gold); rod(a, leaf, [0, y, .14], [-reach, y + h * .075, -.03], .018, p.gold); }
      });
    }
    for (const crossing of [-1, 1]) for (let i = 0; i < 15; i++) {
      const t = i / 14, x = -4.45 + t * 8.9, z = .2 + crossing * (t - .5) * 2.2, y = 1.5 + Math.sin(t * Math.PI) * (crossing < 0 ? 1.15 : .35);
      const bridge = new T.Group(); bridge.position.set(x, y, z); bridge.rotation.y = -crossing * .24; bridge.rotation.z = Math.cos(t * Math.PI) * (crossing < 0 ? .36 : .11); r.add(bridge);
      a.box(bridge, [.68, .15, .87], [0, 0, 0], p.paper); a.box(bridge, [.69, .025, .08], [0, .09, .39], crossing < 0 ? p.vermilion : p.gold);
      for (const dx of [-.15, .15]) a.box(bridge, [.02, .018, .44], [dx, .09, -.08], p.gold);
      if (i % 7 === 0) { a.box(r, [.66, y - 1, .5], [x, (y + 1) / 2 - .06, z], p.limestone); a.box(r, [.88, .12, .7], [x, 1.03, z], p.paper); }
    }
  },
  '2026-08-15': (a, r) => {
    const p = a.palette;
    // A radial quarry contains unequal wedges and a suspended cutting hoop, never cube stickers.
    for (let i = 0; i < 9; i++) { const start = i * .61, len = i % 2 ? .4 : .55, radius = 3.8 + (i % 3) * .4; const pts: [number, number][] = [[Math.cos(start) * 1.1, Math.sin(start) * 1.1]]; for (let j = 0; j <= 5; j++) pts.push([Math.cos(start + j / 5 * len) * radius, Math.sin(start + j / 5 * len) * radius * .62]); pts.push([Math.cos(start + len) * 1.1, Math.sin(start + len) * 1.1]); const wedge = a.shape(r, pts, 1 + (i % 3) * .55, i % 2 ? p.paper : p.jade, [0, 2.1 + (i % 3) * .55, -1]); wedge.rotation.x = Math.PI / 2; }
    const frame = a.ring(r, 2.8, .095, [.1, 5.1, -1], p.gold); frame.rotation.y = -.35;
    rod(a, r, [-4.5, 1, -2.4], [-4.5, 7.8, -2.4], .11, p.forest); rod(a, r, [-4.5, 7.8, -2.4], [2.9, 7.8, -2.4], .11, p.forest);
    for (const x of [-1.8, 1.8]) rod(a, r, [x, 7.8, -2.4], [x, 7.2, -1], .025);
    fin(a, r, [[-.6, 0], [-.8, 1.25], [.3, 1.55], [.7, .4]], [4.6, 1.1, .4], p.vermilion, .7);
    for (let i = 0; i < 5; i++) a.box(r, [.08, .05, .5], [3.85 + i * .35, 1.05, 1.4], p.gold);
  },
  '2026-08-16': (a, r) => {
    const p = a.palette;
    // A pocket-sized courtyard is held in a broad open handset, its walls folded outward.
    const phone = new T.Group(); phone.position.set(0, 1, -1.9); phone.rotation.x = -.18; r.add(phone);
    const outline: [number, number][] = [[-3.1, 0], [-3.5, .5], [-3.5, 6.4], [-3.1, 6.9], [3.1, 6.9], [3.5, 6.4], [3.5, .5], [3.1, 0]];
    fin(a, phone, outline, [0, 0, 0], p.forest, .46);
    fin(a, phone, outline.map(([x, y]) => [x * .979, .08 + y * .978]), [0, 0, .46], p.gold, .08);
    fin(a, phone, outline.map(([x, y]) => [x * .949, .16 + y * .955]), [0, 0, .54], p.jade, .12);
    fin(a, phone, [[-2.78, .8], [-3.03, 1.1], [-3.03, 5.98], [-2.78, 6.21], [2.78, 6.21], [3.03, 5.98], [3.03, 1.1], [2.78, .8]], [0, 0, .67], p.paper, .065);
    for (const side of [-1, 1]) {
      a.box(phone, [.09, 1.02, .24], [side * 3.52, side < 0 ? 4.2 : 4.7, .27], p.gold);
      a.box(phone, [.06, .4, .29], [side * 3.55, 3.45, .27], p.paper);
      for (const y of [.46, 6.45]) { a.ring(phone, .1, .027, [side * 3.12, y, .69], p.gold); rod(a, phone, [side * 3.12 - .045, y, .72], [side * 3.12 + .045, y, .72], .014, p.forest); }
    }
    a.box(phone, [1.55, .17, .055], [0, 6.49, .705], p.forest);
    for (let i = 0; i < 7; i++) a.box(phone, [.055, .1, .025], [-.59 + i * .195, 6.5, .75], p.gold);
    a.ring(phone, .15, .042, [1.27, 6.49, .73], p.gold); joint(a, phone, [1.27, 6.49, .74], .073);
    a.ring(phone, .24, .047, [0, .43, .715], p.gold);
    // Etched paths and paper panes give the recessed display depth behind the physical courtyard.
    for (let i = 0; i < 3; i++) {
      const x = -1.92 + i * 1.87, y = 4.4 + (i % 2) * .55;
      a.box(phone, [1.48, 1.08, .055], [x, y, .77], i === 1 ? p.jade : p.mist);
      a.box(phone, [1.15, .05, .035], [x, y + .3, .82], p.gold);
      for (let j = 0; j < 3; j++) a.box(phone, [.83 - j * .17, .028, .03], [x - .1, y + .1 - j * .16, .82], p.paper);
      a.line(phone, [[x, y - .6, .8], [x, 3.25, .8], [0, 3.25, .8]], .018, p.gold);
    }
    for (let i = 0; i < 4; i++) { const x = -2.3 + i * 1.5, h = 1.1 + (i % 2) * .6; a.box(r, [1.2, h, 1], [x, 2.1 + h / 2, -.35], p.paper); const roof = a.box(r, [1.4, .12, 1.2], [x, 2.18 + h, -.35], p.gold); roof.rotation.z = .16 * (i % 2 ? 1 : -1); a.box(r, [.28, .55, .04], [x, 2.6, .18], p.jade); }
    a.box(r, [6.6, .18, 2.2], [0, 2, -.2], p.paper);
    for (const x of [-3.3, 3.3]) { const wall = a.box(r, [2.8, 2.5, .15], [x, 3.3, -.2], p.paper); wall.rotation.y = x < 0 ? -.8 : .8; }
    a.ring(r, .28, .055, [0, 1.55, -1.25], p.gold);
    for (let i = 0; i < 5; i++) a.box(r, [.38, .12, .5], [-1.2 + i * .6, 2.17, 1], p.jade);
  },
  '2026-08-17': (a, r) => {
    const p = a.palette;
    // Learning flows down a branching aqueduct into differently shaped lesson basins.
    const paths: P[][] = [[[-4.8, 5.4, -2], [-2.3, 5.3, -2], [0, 4.6, -1.2], [0, 2.7, .6]], [[4.8, 6.5, -2], [2.4, 6, -2], [0, 4.6, -1.2]]];
    paths.forEach(points => { a.line(r, points, .35, p.paper); a.line(r, points.map(([x,y,z]) => [x,y+.25,z] as P), .15, p.water); });
    for (const [x, y, z] of [[-4.8, 5.4, -2], [-2.3, 5.3, -2], [2.4, 6, -2], [4.8, 6.5, -2]] as P[]) { for (const dx of [-.4, .4]) rod(a, r, [x + dx, .9, z], [x + dx, y, z], .1, p.forest); a.box(r, [1.25, .25, 1.3], [x, y, z], p.paper); a.ring(r, .32, .04, [x, y + .7, z], p.gold); }
    for (let i = 0; i < 3; i++) { const x = -3.6 + i * 3.6; const basin = a.cylinder(r, 1.15, .55 + i * .18, [x, 1.2, .9], p.jade, 1.3); basin.scale.z = .7; a.cylinder(r, .96, .04, [x, 1.51 + i * .09, .9], p.water); a.line(r, [[0, 2.7, .6], [x * .5, 2.1, .7], [x, 1.8, .9]], .16, p.paper); }
    for (let i = 0; i < 6; i++) a.box(r, [.045, .4, .06], [-5.2 + i * .5, 5.7, -1.55], p.gold);
  },
  '2026-08-18': (a, r) => {
    const p = a.palette; slab(a, r, [0, .96, -1], 10.6, 4.5);
    // A training loom has a steeply raked frame and a finished strip leaving the front roller.
    for (const x of [-4, 4]) { rod(a, r, [x, 1.1, .6], [x, 6.8, -2.3], .17, p.forest); rod(a, r, [x, 1.1, -3], [x, 6.8, -2.3], .12, p.forest); joint(a, r, [x, 6.8, -2.3], .2); }
    for (const [y,z] of [[6.8,-2.3],[1.8,.2]]) { const bar = a.cylinder(r, .25, 8.6, [0,y,z], p.gold); bar.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 19; i++) rod(a, r, [-3.7 + i * .41, 1.85, .2], [-3.7 + i * .41, 6.8, -2.3], .023, p.gold);
    for (let j = 0; j < 7; j++) { const y = 2.2 + j * .55, z = .2 - (y - 1.8) * .5; a.line(r, [[-3.7, y, z], [-1.8, y + .12, z + .1], [0, y, z], [1.8, y + .12, z + .1], [3.7, y, z]], .11, j % 3 === 0 ? p.vermilion : p.jade); }
    fin(a, r, [[-3.7, 0], [3.7, 0], [3.2, -.65], [-3, -.65]], [0, 1.8, .4], p.paper, 1.15);
    const shuttle = a.box(r, [2.4, .25, .48], [1.6, 4.3, -1], p.paper); shuttle.rotation.z = .13; a.ring(r, .25, .05, [1.6, 4.4, -.65], p.gold);
  },
  '2026-08-19': (a, r) => {
    const p = a.palette;
    // A broadcast shell: stepped scallop ribs surround a tiny presenter lectern.
    for (let i = 0; i < 13; i++) { const t = (i - 6) * .105, g = new T.Group(); g.position.set(0, 1.1, -2.8 + Math.abs(i - 6) * .12); g.rotation.z = t; r.add(g); const h = 6.6 - Math.abs(i - 6) * .28; fin(a, g, [[-.08,0],[-.5,h*.55],[-.65,h*.88],[0,h],[.65,h*.88],[.5,h*.55],[.08,0]], [0,0,0], i % 2 ? p.paper : p.limestone, .16); rod(a, g, [0,.5,.2], [0,h-.2,.2], .032, p.gold); }
    const stage = a.cylinder(r, 3.45, .25, [0, 1.1, -.8], p.paper); stage.scale.z = .65;
    a.box(r, [1.3, 1.35, .9], [0, 1.93, .1], p.jade); const top = a.box(r, [1.6, .1, 1.1], [0,2.7,.1], p.paper); top.rotation.x = -.2;
    a.line(r, [[.4,2.7,.1],[.5,3.45,.1],[.05,3.6,.1]], .04, p.ink); joint(a,r,[.05,3.6,.1],.09);
    for (const x of [-3.8,3.8]) { a.box(r,[.8,1.8,.7],[x,1.9,-.3],p.forest); for(let j=0;j<5;j++)a.box(r,[.55,.045,.05],[x,1.3+j*.27,.08],p.gold); }
  },
  '2026-08-20': (a, r) => {
    const p = a.palette;
    // A civic rotunda is cut open at the front, individual chambers around its service counter.
    for(let i=0;i<7;i++){ const t=Math.PI*.08+i/6*Math.PI*.86,x=Math.cos(t)*4.5,z=-1-Math.sin(t)*2.4,h=2.8+(i%3)*.75; a.box(r,[1.45,h,1.3],[x,1+h/2,z],p.paper); a.box(r,[1.65,.16,1.5],[x,h+1.1,z],p.jade); a.box(r,[.6,1.3,.08],[x,1.8,z+.7],p.gold); for(let j=0;j<3;j++)a.box(r,[.12,.25,.04],[x-.35+j*.35,h+.5,z+.7],p.jade); }
    const counter=arc(a,r,2.8,0,Math.PI,[0,1.8,-.6],p.paper,.32); counter.rotation.x=Math.PI/2;
    for(let i=0;i<9;i++){ const t=i/8*Math.PI,x=Math.cos(t)*2.8,z=-.6+Math.sin(t)*2.8; rod(a,r,[x,1,z],[x,1.8,z],.07,p.forest); }
    fin(a,r,[[-1.7,0],[-.8,1.3],[.8,1.3],[1.7,0]],[0,5,-3],p.gold,.4);
    a.box(r,[.2,1.8,.2],[0,4.15,-2.8],p.forest); a.ring(r,.48,.065,[0,6.8,-2.8],p.vermilion);
    for(let i=0;i<3;i++)slab(a,r,[-4.7+i*.15,1+i*.16,1.2+i*.28],1.5,.55);
  },
  '2026-08-21': (a, r) => {
    const p=a.palette;
    // Adjacent color streams meet at six petal-shaped fountain mouths.
    const colors=[p.vermilion,p.gold,p.jade,p.water,p.heather,p.paper];
    for(let i=0;i<6;i++){ const t=i/6*Math.PI*2,x=Math.cos(t)*3.4,z=-1+Math.sin(t)*1.9,h=1.4+(i%3)*.65; const basin=a.cylinder(r,.95,.3,[x,1.1,z],p.paper);basin.scale.z=.65; a.cylinder(r,.72,.05,[x,1.28,z],colors[i]); const g=new T.Group();g.position.set(x,1.3,z);g.rotation.y=-t;r.add(g);fin(a,g,[[-.5,0],[-.6,h],[0,h+.5],[.6,h],[.5,0]], [0,0,0],colors[i],.22); a.line(r,[[x,h+1.6,z],[x*.5,5.6,-1+(z+1)*.5],[0,6.2,-1]],.05,colors[i]); }
    a.cylinder(r,.28,4.6,[0,3.3,-1],p.gold); a.mesh(r,new T.DodecahedronGeometry(.7),p.paper,[0,6.35,-1]);
    for(let i=0;i<12;i++){const t=i/12*Math.PI*2; joint(a,r,[Math.cos(t)*1.3,1.02,-1+Math.sin(t)*.8],.085);}
    a.line(r,[[-5,1.1,1.7],[-1,1.1,1.7],[3,1.1,1.7],[5,1.1,1.7]],.035,p.gold);
  },
  '2026-08-22': (a, r) => {
    const p=a.palette;
    // Three unlike approaches unite in a broad elevated civic crossing.
    for(let i=0;i<13;i++){const x=-6+i,y=1.3+Math.sin(i/12*Math.PI)*2.6;slab(a,r,[x,y,-1],1.05,2.2);if(i%2===0){for(const z of [-1.8,-.2])rod(a,r,[x,.9,z],[x,y,z],.12,p.forest);}for(const z of [-2.1,.1]){rod(a,r,[x,y,z],[x,y+.85,z],.035);}}
    for(const z of [-2.1,.1]){const pts:P[]=[];for(let i=0;i<=12;i++)pts.push([-6+i,2.15+Math.sin(i/12*Math.PI)*2.6,z]);a.line(r,pts,.05,p.gold);}
    for(let i=0;i<7;i++)slab(a,r,[.1,1.1+i*.42,2.2-i*.46],2.1,.55);
    // A four-digit entry portal belongs to the join, distinct from the three-gallery gates.
    a.box(r,[4.4,.25,.9],[0,6.75,-1],p.paper);for(const x of [-2,2])rod(a,r,[x,3.65,-1],[x,6.75,-1],.095,p.jade);
    for(let i=0;i<4;i++){const o=a.ring(r,.27,.06,[-1.2+i*.8,6.05,-.9],p.vermilion);o.scale.y=1.3;}
    rivets(a,r,[-1.8,6.77,-.5],[1.8,6.77,-.5],9);
  },
  '2026-08-23': (a, r) => {
    const p=a.palette;slab(a,r,[0,.98,-1],9.5,4.3);
    // Calligraphic strokes become structural beams, a physical grammar one can walk through.
    fin(a,r,[[-4.4,0],[-3.8,5.5],[-3,6.8],[-2.35,6.25],[-3.1,4.9],[-3.55,0]],[0,1,-1.5],p.jade,.75);
    fin(a,r,[[2.7,0],[2.5,5.8],[3.2,6.6],[3.75,5.7],[3.65,0]],[0,1,-1.5],p.paper,.75);
    fin(a,r,[[-3.3,4.6],[-1.3,5.1],[1,4.7],[3.2,5.3],[3.4,4.65],[1,4],[-1.3,4.5],[-3.5,4]],[0,1,-1.5],p.gold,.6);
    a.line(r,[[-3.7,1.2,-.7],[-3.3,5.8,-.7],[-2.65,7.2,-.7]],.035,p.paper);
    for(let i=0;i<5;i++){const x=-1.8+i*.85;rod(a,r,[x,1.1,.2],[x,2.1+(i%2)*.3,.2],.045,p.gold);const mark=a.box(r,[.5,.65,.15],[x,2.5+(i%2)*.3,.2],i%2?p.jade:p.vermilion);mark.rotation.z=(i-2)*.2;}
    a.ring(r,.55,.075,[.2,7.6,-1.1],p.gold);rod(a,r,[.2,6.4,-1.1],[.2,7.05,-1.1],.035);
  },
  '2026-08-24': (a, r) => {
    const p=a.palette;
    // A playable notation ladder rises diagonally; hinged blades and pegs expose its mechanics.
    for(let i=0;i<8;i++){const x=-5+i*1.35,y=1.2+i*.55,z=-1+Math.sin(i*.55)*.3;const blade=a.box(r,[1.15,.17,2.8-i*.12],[x,y,z],i%2?p.paper:p.jade);blade.rotation.z=.08;for(const dz of [-.9,.9])joint(a,r,[x,y+.13,z+dz],.1);rod(a,r,[x,.85,z],[x,y,z],.07,p.forest);a.box(r,[.06,.045,.45],[x,y+.14,z],p.gold);}
    const rails:P[][]=[[],[]];for(let i=0;i<8;i++){rails[0].push([-5+i*1.35,1.5+i*.55,-2.35]);rails[1].push([-5+i*1.35,1.5+i*.55,.35]);}rails.forEach(v=>a.line(r,v,.055,p.gold));
    a.line(r,[[-4.4,7,-2.1],[-1.8,7.8,-2.1],[1.6,7.2,-2.1],[4.1,8.2,-2.1]],.04,p.vermilion);
    for(let i=0;i<4;i++){const x=-4.4+i*2.8;rod(a,r,[x,6.5,-2.1],[x,5.5-i*.15,-2.1],.03);const note=a.mesh(r,new T.SphereGeometry(.25,10,7),p.gold,[x,5.45-i*.15,-2.1]);note.scale.x=1.4;}
    a.box(r,[1.5,.16,1],[5,1.2,.6],p.paper);rod(a,r,[4.6,1.45,.8],[5.4,2.25,.8],.07,p.gold);joint(a,r,[5.4,2.25,.8],.22);
  },
  '2026-08-25': (a, r) => {
    const p=a.palette;
    // Three industrial workshops retain separate working boundaries and connect by a shared quay.
    for(let i=0;i<3;i++){const x=-4.5+i*4.5,w=[3.2,3.6,2.9][i],h=[3.2,4.5,2.6][i];slab(a,r,[x,1,-1.2],w+1,3.6);a.box(r,[w,h,2.5],[x,1.1+h/2,-1.5],p.paper);for(let j=0;j<3;j++)a.box(r,[.5,.8,.04],[x-.95+j*.95,2.1,-.21],p.jade);if(i===0){for(let j=0;j<3;j++)fin(a,r,[[-.6,0],[.6,.75],[.6,0]],[x-1.2+j*1.2,h+1.1,-2.8],p.jade,2.65);}else if(i===1){const roof=a.mesh(r,new T.CylinderGeometry(1.8,1.8,2.8,20,1,false,0,Math.PI),p.jade,[x,h+1.1,-1.5]);roof.rotation.x=Math.PI/2;roof.rotation.z=Math.PI/2;}else{a.box(r,[w+.3,.2,2.8],[x,h+1.2,-1.5],p.jade);a.cylinder(r,.32,2.3,[x+.6,h+1.8,-1.7],p.gold);}}
    for(let i=0;i<16;i++)a.box(r,[.72,.15,1.1],[-6+i*.8,1.1,1.2],p.paper);
    for(const x of [-2.3,2.3]){a.box(r,[.4,1.1,.4],[x,1.65,1.2],p.vermilion);a.ring(r,.15,.035,[x,2.35,1.2],p.gold);}
  },
  '2026-08-26': (a, r) => {
    const p=a.palette;slab(a,r,[0,.98,-1],8.5,4.2);
    // A botanical catalog opens diagonally, each drawer a different leaf-shaped tray.
    a.box(r,[2.8,5.7,1.9],[-1.8,3.9,-1.7],p.forest);for(let i=0;i<7;i++){const y=1.35+i*.75,x=-1.7+i*.52,z=-.65+i*.15;const tray=fin(a,r,[[-1.2,0],[-.8,.5],[.7,.55],[1.4,.15],[.7,-.25],[-.8,-.2]],[x,y,z],i%2?p.paper:p.jade,.4);tray.rotation.z=.06*i;a.box(r,[1.7,.05,.04],[x,y+.1,z+.44],p.gold);joint(a,r,[x+.45,y+.08,z+.5],.095);}
    fin(a,r,[[0,0],[1.5,1.3],[1.9,2.9],[.8,2.4],[.05,.8]],[2.8,4.9,-1.3],p.jade,.18);rod(a,r,[2.8,5,-1.08],[4.2,7.4,-1.08],.035);
    for(let i=0;i<4;i++){const y=5.4+i*.45;rod(a,r,[3.05+i*.2,y,-1.08],[3.8+i*.14,y+.1,-1.08],.024,p.gold);}
    a.box(r,[2.2,.17,1.5],[4.7,1.1,.6],p.paper);for(let i=0;i<5;i++)a.box(r,[.06,.04,.75],[4.05+i*.3,1.21,.6],p.gold);
  },
  '2026-08-27': (a, r) => {
    const p=a.palette;
    // Two porcelain anchor loops are joined by a broad, visibly interlocking friendship knot.
    for(const side of [-1,1]){const x=side*4.3;slab(a,r,[x,1,-1],2.3,3);const loop=a.ring(r,1.15,.26,[x,3.2,-1],p.paper);loop.scale.y=1.45;rod(a,r,[x,1.1,-1],[x,1.75,-1],.17,p.jade);for(let i=0;i<5;i++)joint(a,r,[x-.55+i*.27,1.12,.35],.07);}
    const first:P[]=[[-4.2,3.25,-1],[-2,4.3,-1],[.5,5.9,-.4],[2,4.4,.2],[.2,2.8,.6],[-1.4,4,-.2],[.3,5.15,-1.1],[2.4,4.4,-1.1],[4.2,3.25,-1]];
    const second:P[]=[[-4.2,3.25,-.75],[-2.3,2.5,-.3],[-.5,4.8,.8],[1.6,6.05,-.7],[2.5,4.3,-1.5],[.25,3.25,-1.6],[-1.45,4.7,-.8],[-.2,5.6,.6],[2.5,3.55,.5],[4.2,3.25,-.75]];
    a.line(r,first,.19,p.vermilion);a.line(r,second,.16,p.gold);
    for(let i=0;i<3;i++)card(a,r,[-1.7+i*1.7,1.8,.9],1.05,.95,i===1?p.jade:p.paper);
  },
  '2026-08-28': (a, r) => {
    const p=a.palette;
    // A four-faced posthouse with external pigeonholes and a folded address canopy.
    a.cylinder(r,2.1,3.7,[0,2.95,-1.1],p.paper,1.85);
    const roof=fin(a,r,[[-3.4,0],[-1.6,1.1],[0,.4],[1.6,1.1],[3.4,0],[1.5,.65],[0,.05],[-1.5,.65]],[0,5.1,-3],p.jade,3.8);
    roof.rotation.z=-.06;
    for(let i=0;i<4;i++){const side=i<2?-1:1,x=side*(2.5+(i%2)*1.5),y=1.8+(i%2)*1.6;rod(a,r,[side*1.5,y,-1],[x,y,-1],.11,p.gold);a.box(r,[1.3,.9,1.05],[x,y,-1],p.jade);a.box(r,[.8,.14,.06],[x,y+.16,-.44],p.ink);a.box(r,[.85,.1,.35],[x,y-.36,-.27],p.gold);}
    a.box(r,[1.2,2.1,.09],[0,2.1,1.02],p.forest);a.ring(r,.28,.04,[0,3.8,1.04],p.gold);
    for(let i=0;i<7;i++){const t=i/6*Math.PI;rod(a,r,[Math.cos(t)*2.8,.9,Math.sin(t)*1.3+.4],[Math.cos(t)*2.8,1.4,Math.sin(t)*1.3+.4],.045,p.gold);}
    fin(a,r,[[-.55,0],[0,.65],[.55,0],[0,-.18]],[.1,7.05,-1],p.vermilion,.1);rod(a,r,[.1,5.8,-1],[.1,7.05,-1],.045);
  },
  '2026-08-29': (a, r) => {
    const p=a.palette;
    // A cross-shaped training parterre with staggered hedge turns and a lifted target walkway.
    for(let i=0;i<9;i++){const x=-5.2+i*1.3;slab(a,r,[x,1,-1],1.32,1.3);if(i!==4){a.box(r,[1.05,.75,.35],[x,1.5,-1.85],p.jade);if(i%2===0)a.box(r,[1.05,.75,.35],[x,1.5,-.15],p.jade);}}
    for(let i=0;i<5;i++){const z=-3.6+i*1.3;slab(a,r,[0,1,z],1.3,1.35);for(const x of [-.85,.85])if(i!==2)a.box(r,[.3,.65,1.05],[x,1.45,z],p.forest);}
    const course:P[]=[[-5.2,1.2,-1],[-2.5,1.2,-1],[-2.5,2.8,-1],[0,4.2,-1],[2.5,2.8,-1],[2.5,1.2,-1],[5.2,1.2,-1]];a.line(r,course,.16,p.paper);a.line(r,course.map(([x,y,z])=>[x,y+.18,z] as P),.04,p.vermilion);
    const target=fin(a,r,[[-1.3,0],[0,1.5],[1.3,0],[0,-1.5]],[0,6,-1],p.paper,.25);target.rotation.z=.08;
    a.line(r,[[-.8,6,-.7],[0,6.9,-.7],[.8,6,-.7],[0,5.1,-.7],[-.8,6,-.7]],.05,p.gold);joint(a,r,[0,6,-.66],.16);
    for(const x of [-1.8,1.8])rod(a,r,[x,1,-2],[x,5.3,-2],.07,p.gold);
  },
  '2026-08-30': (a, r) => {
    const p=a.palette;
    // A resumable transfer is a monumental zipper: two unfinished runs join at a lifted slider.
    for(const side of [-1,1]){const pts:P[]=[];for(let i=0;i<11;i++){const t=i/10,x=side*(1.25+t*t*3.1),y=1.1+t*5.7,z=-1.2+Math.sin(t*Math.PI)*.4;pts.push([x,y,z]);const tooth=a.box(r,[.65,.24,.5],[x-side*.35,y,z+.16],p.gold);tooth.rotation.z=-side*t*.65;}a.line(r,pts,.27,side<0?p.jade:p.paper);}
    const slider=fin(a,r,[[-1.35,0],[-1.65,1.1],[-.7,1.8],[.7,1.8],[1.65,1.1],[1.35,0]], [0,2.5,-1.5],p.vermilion,.9);
    slider.rotation.z=-.08;
    const pull=a.ring(r,.6,.12,[0,4.05,-.45],p.gold);pull.scale.y=1.6;
    for(let i=0;i<4;i++){const x=(i%2?1:-1)*.45;a.box(r,[.65,.25,.5],[x,1.1+i*.35,-.9],p.gold);}
    for(let i=0;i<7;i++)a.box(r,[1.1,.12,1.1],[-4.3+i*1.45,1,-.8+(i%2)*.35],p.paper);
    a.line(r,[[3.6,6.8,-1],[4.9,7.1,-1],[5.6,6.5,-1]],.06,p.gold);joint(a,r,[5.6,6.5,-1],.17);
  },
  '2026-08-31': (a, r) => {
    const p=a.palette;
    // Five distinct product wings share a central structural spine; each wing is a unique folded shell.
    const wings:[number,number,number,number][]=[[-4.8,2.5,2,0],[-2.4,4.5,1.8,-.16],[0,6.8,2.1,0],[2.8,5.2,1.9,.2],[5.1,3.1,1.65,.12]];
    wings.forEach(([x,h,w,tilt],i)=>{const g=new T.Group();g.position.set(x,1,-1+(i%2)*.45);g.rotation.z=tilt;r.add(g);fin(a,g,[[-w/2,0],[-w*.6,h*.65],[-w*.3,h],[w*.45,h-.35],[w*.6,h*.38],[w/2,0]],[0,0,0],i%2?p.jade:p.paper,.55);rod(a,g,[0,.3,.61],[0,h-.45,.61],.045);for(let j=0;j<4;j++)a.box(g,[w*.55,.035,.03],[0,1+j*(h-1.5)/4,.62],p.gold);joint(a,g,[0,h-.45,.66],.115);slab(a,r,[x,.97,-1+(i%2)*.45],w+ .55,2.25);});
    a.line(r,[[-5.4,1.15,1.35],[-2.8,2,1.35],[0,3.45,1.35],[2.8,2,1.35],[5.4,1.15,1.35]],.18,p.gold);
    const heart=a.mesh(r,new T.DodecahedronGeometry(.8),p.vermilion,[0,3.65,1.35]);heart.rotation.z=.22;
    for(const x of [-1.2,1.2])rod(a,r,[x,1,-2.2],[0,6.6,-1],.055,p.forest);
  },
};
