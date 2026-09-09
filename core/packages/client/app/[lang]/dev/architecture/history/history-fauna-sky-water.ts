import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import { ellipsoid, eyes, joint, rod, type AnimalBuilder, type AnimalPoint } from './history-fauna-shapes';

type Point = AnimalPoint;

/** A folded feather has a raised quill and two paper faces, with no texture dependency. */
function feather(art: PaperScenery, root: T.Object3D, from: Point, to: Point, width: number, color: string) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to), axis = b.clone().sub(a).normalize();
  const across = new T.Vector3().crossVectors(axis, new T.Vector3(0, 1, 0));
  if (across.lengthSq() < .01) across.crossVectors(axis, new T.Vector3(0, 0, 1));
  across.normalize().multiplyScalar(width / 2);
  const normal = new T.Vector3().crossVectors(across, axis).normalize().multiplyScalar(.024);
  const middle = a.clone().lerp(b, .46);
  const vertices = [a, b, middle.clone().add(across), middle.clone().sub(across), middle.clone().add(normal), middle.clone().sub(normal)];
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices.flatMap(v => v.toArray()), 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute([0, .5, 1, .5, .46, 0, .46, 1, .46, .5, .46, .5], 2));
  geometry.setIndex([0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5]);
  const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
  return art.mesh(root, flat, color);
}

function finXY(art: PaperScenery, root: T.Object3D, points: [number, number][], color: string, depth = .038) {
  return art.shape(root, points, depth, color, [0, 0, -depth / 2]);
}

function finXZ(art: PaperScenery, root: T.Object3D, points: [number, number][], color: string, y = 0) {
  const fin = art.shape(root, points, .035, color, [0, y + .0175, 0]);
  fin.rotation.x = Math.PI / 2;
  return fin;
}

function toes(art: PaperScenery, root: T.Object3D, x: number, z: number, color: string, length = .23) {
  for (const spread of [-1, 0, 1]) rod(art, root, color, [x, .048, z], [x + length, .035, z + spread * .1], .032, .015);
  rod(art, root, color, [x, .05, z], [x - length * .48, .035, z], .027, .012);
}

/** Birds face +x; flight joints open away from the shoulders along ±z. */
export const SKY_WATER_ANIMALS = {
  eagle: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.clay, [-.12, .89, 0], [.77, .43, .34]);
    ellipsoid(art, root, p.limestone, [.1, .72, 0], [.42, .26, .29]);
    const head = joint(root, 'head', [.62, 1.06, 0]);
    ellipsoid(art, head, p.snow, [0, .05, 0], [.32, .29, .27]);
    finXY(art, head, [[.2, .13], [.54, .02], [.54, -.13], [.43, -.21], [.43, -.06], [.21, -.02]], p.gold, .16);
    eyes(art, head, [.14, .11, 0], .232, .044);
    for (const side of [-1, 1]) {
      feather(art, head, [-.13, .16, side * .23], [.23, .15, side * .25], .11, p.snow);
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.08, 1.02, side * .25]);
      finXZ(art, wing, [[.28, 0], [.18, side * .82], [-.16, side * 1.67], [-.67, side * 1.8], [-.77, side * .66], [-.38, 0]], p.clay);
      for (let i = 0; i < 7; i++) feather(art, wing, [.12 - i * .08, .025, side * (.4 + i * .11)], [-.44 - i * .11, .02, side * (1.05 + i * .13)], .27, i < 3 ? p.clay : p.ink);
      for (let i = 0; i < 4; i++) feather(art, wing, [.17 - i * .15, .045, side * .14], [-.12 - i * .14, .045, side * .91], .22, p.limestone);
      rod(art, root, p.gold, [.13, .69, side * .2], [.22, .09, side * .23], .065, .04);
      toes(art, root, .22, side * .23, p.gold);
    }
    const tail = joint(root, 'tail', [-.69, .89, 0]);
    for (let i = 0; i < 5; i++) feather(art, tail, [0, .02, (i - 2) * .075], [-.75, -.12, (i - 2) * .14], .19, p.snow);
  },

  crane: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.snow, [-.14, 1.79, 0], [.65, .39, .32]);
    art.line(root, [[.29, 1.89, 0], [.51, 2.29, 0], [.39, 2.89, 0], [.65, 3.17, 0]], .112, p.snow);
    const head = joint(root, 'head', [.69, 3.19, 0]);
    ellipsoid(art, head, p.snow, [0, 0, 0], [.24, .21, .19]);
    ellipsoid(art, head, p.vermilion, [-.015, .176, 0], [.16, .051, .125]);
    rod(art, head, p.gold, [.16, -.025, 0], [.71, -.06, 0], .081, .004);
    eyes(art, head, [.078, .038, 0], .175, .033);
    for (const side of [-1, 1]) {
      feather(art, root, [.36, 2.38, side * .081], [.21, 1.92, side * .19], .16, p.ink);
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.15, 1.94, side * .22]);
      finXZ(art, wing, [[.17, 0], [-.06, side * .7], [-.84, side * 1.27], [-1.05, side * .65], [-.51, 0]], p.snow);
      for (let i = 0; i < 6; i++) feather(art, wing, [-.05 - i * .085, .025, side * (.2 + i * .07)], [-.74 - i * .066, -.035, side * (.72 + i * .12)], .205, i > 2 ? p.ink : p.snow);
      rod(art, root, p.ink, [-.12, 1.54, side * .16], [.01, .78, side * .18], .042, .031);
      rod(art, root, p.ink, [.01, .78, side * .18], [-.09, .07, side * .2], .034, .026);
      toes(art, root, -.09, side * .2, p.ink, .26);
    }
    const tail = joint(root, 'tail', [-.62, 1.84, 0]);
    for (let i = 0; i < 3; i++) feather(art, tail, [0, 0, (i - 1) * .1], [-.57, -.25, (i - 1) * .13], .19, p.ink);
  },

  flamingo: (art, root) => {
    const p = art.palette, rose = art.mix(p.vermilion, p.paper, .48);
    ellipsoid(art, root, rose, [-.28, 1.92, 0], [.68, .39, .36]);
    art.line(root, [[.22, 2.04, 0], [.6, 2.38, 0], [.33, 2.95, 0], [.42, 3.39, 0], [.88, 3.51, 0]], .107, rose);
    const head = joint(root, 'head', [.93, 3.5, 0]);
    ellipsoid(art, head, rose, [0, 0, 0], [.24, .19, .18]);
    finXY(art, head, [[.16, .04], [.43, -.02], [.56, -.24], [.42, -.32], [.26, -.12], [.13, -.09]], p.paper, .13);
    finXY(art, head, [[.36, -.12], [.53, -.2], [.57, -.3], [.44, -.36], [.33, -.22]], p.ink, .14);
    eyes(art, head, [.045, .054, 0], .17, .031);
    for (const side of [-1, 1]) {
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.02, 2.02, side * .25]);
      finXZ(art, wing, [[.19, 0], [-.05, side * .49], [-.76, side * .93], [-.86, side * .28], [-.47, 0]], rose);
      for (let i = 0; i < 5; i++) feather(art, wing, [-.08 - i * .09, .025, side * .17], [-.49 - i * .08, -.02, side * (.46 + i * .105)], .205, i > 2 ? p.ink : p.vermilion);
      rod(art, root, rose, [-.2, 1.69, side * .16], [-.35, .89, side * .2], .044, .033);
      rod(art, root, rose, [-.35, .89, side * .2], [-.15, .075, side * .2], .033, .026);
      toes(art, root, -.15, side * .2, rose, .25);
    }
    const tail = joint(root, 'tail', [-.8, 1.94, 0]);
    for (let i = 0; i < 3; i++) feather(art, tail, [0, 0, (i - 1) * .08], [-.43, -.13, (i - 1) * .12], .19, rose);
  },

  swallow: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.forest, [-.12, .43, 0], [.6, .23, .22]);
    ellipsoid(art, root, p.snow, [.05, .32, 0], [.42, .13, .185]);
    const head = joint(root, 'head', [.46, .5, 0]);
    ellipsoid(art, head, p.forest, [0, 0, 0], [.25, .22, .2]);
    ellipsoid(art, head, p.vermilion, [.12, -.1, 0], [.14, .1, .165]);
    rod(art, head, p.ink, [.19, -.015, 0], [.41, -.05, 0], .063, .003);
    eyes(art, head, [.081, .068, 0], .18, .034);
    for (const side of [-1, 1]) {
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.06, .48, side * .17]);
      finXZ(art, wing, [[.24, 0], [.24, side * .52], [-.75, side * 1.61], [-.38, side * .7], [-.5, side * .15]], p.forest);
      for (let i = 0; i < 4; i++) feather(art, wing, [.14 - i * .11, .031, side * .24], [-.53 - i * .08, .031, side * (1.35 - i * .17)], .15, i % 2 ? p.ink : p.jade);
      rod(art, root, p.ink, [.05, .3, side * .1], [.12, .055, side * .15], .033, .022);
      toes(art, root, .12, side * .15, p.ink, .16);
    }
    const tail = joint(root, 'tail', [-.6, .43, 0]);
    finXZ(art, tail, [[0, -.16], [-1.02, -.45], [-.49, 0], [-1.02, .45], [0, .16]], p.forest);
    for (const side of [-1, 1]) feather(art, tail, [-.05, .035, side * .1], [-.94, .035, side * .4], .095, p.snow);
  },

  owl: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.clay, [-.08, .7, 0], [.48, .63, .44]);
    ellipsoid(art, root, p.paper, [.26, .58, 0], [.2, .45, .36]);
    const head = joint(root, 'head', [.13, 1.38, 0]);
    ellipsoid(art, head, p.limestone, [0, 0, 0], [.43, .44, .45]);
    for (const side of [-1, 1]) {
      ellipsoid(art, head, p.paper, [.344, .016, side * .235], [.088, .29, .218]);
      ellipsoid(art, head, p.gold, [.42, .042, side * .215], [.055, .125, .113]);
      ellipsoid(art, head, p.ink, [.46, .044, side * .215], [.029, .072, .062]);
      feather(art, head, [-.04, .29, side * .24], [.02, .72, side * .4], .21, p.clay);
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [-.02, .97, side * .35]);
      finXZ(art, wing, [[.13, 0], [-.1, side * .64], [-.59, side * .98], [-.82, side * .63], [-.51, 0]], p.clay);
      for (let i = 0; i < 5; i++) feather(art, wing, [-.05 - i * .07, .025, side * .08], [-.53 - i * .05, .018, side * (.41 + i * .12)], .215, i % 2 ? p.limestone : p.clay);
      rod(art, root, p.gold, [.05, .27, side * .23], [.15, .07, side * .25], .08, .04);
      toes(art, root, .15, side * .25, p.gold, .19);
      for (let i = 0; i < 3; i++) feather(art, root, [.42, .9 - i * .19, side * .14], [.435, .79 - i * .19, side * .14], .085, p.clay);
    }
    rod(art, head, p.gold, [.4, -.08, 0], [.57, -.25, 0], .09, .004);
    const tail = joint(root, 'tail', [-.4, .4, 0]);
    for (let i = 0; i < 3; i++) feather(art, tail, [0, 0, (i - 1) * .1], [-.54, -.2, (i - 1) * .13], .18, p.clay);
  },

  parrot: (art, root) => {
    const p = art.palette;
    const body = ellipsoid(art, root, p.jade, [-.09, .88, 0], [.45, .61, .35]); body.rotation.z = -.22;
    ellipsoid(art, root, p.gold, [.2, .89, 0], [.19, .37, .29]);
    const head = joint(root, 'head', [.29, 1.44, 0]);
    ellipsoid(art, head, p.jade, [0, 0, 0], [.3, .32, .275]);
    for (const side of [-1, 1]) ellipsoid(art, head, p.paper, [.12, .025, side * .21], [.14, .16, .08]);
    finXY(art, head, [[.22, .15], [.46, .09], [.49, -.08], [.37, -.24], [.36, -.055], [.23, -.035]], p.ink, .19);
    eyes(art, head, [.128, .07, 0], .28, .038);
    for (const side of [-1, 1]) {
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.03, 1.1, side * .27]);
      finXZ(art, wing, [[.13, 0], [-.07, side * .57], [-.71, side * .89], [-.62, side * .12]], p.jade);
      for (let i = 0; i < 5; i++) feather(art, wing, [-.03 - i * .075, .025, side * .13], [-.4 - i * .09, -.03, side * (.43 + i * .09)], .21, i < 2 ? p.gold : p.ocean);
      rod(art, root, p.ink, [.09, .43, side * .19], [.17, .07, side * .21], .049, .033);
      toes(art, root, .17, side * .21, p.ink, .2);
    }
    const tail = joint(root, 'tail', [-.38, .55, 0]);
    for (let i = 0; i < 5; i++) feather(art, tail, [0, 0, (i - 2) * .065], [-1.01 + Math.abs(i - 2) * .11, -.42, (i - 2) * .1], .18, i % 2 ? p.vermilion : p.ocean);
  },

  duck: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.limestone, [-.16, .46, 0], [.71, .35, .44]);
    ellipsoid(art, root, p.paper, [.07, .37, 0], [.52, .2, .38]);
    rod(art, root, p.paper, [.4, .59, 0], [.49, .86, 0], .2, .18);
    const head = joint(root, 'head', [.53, .96, 0]);
    ellipsoid(art, head, p.forest, [0, 0, 0], [.29, .29, .26]);
    ellipsoid(art, head, p.gold, [.36, -.075, 0], [.25, .07, .16]);
    rod(art, head, p.ink, [.33, -.086, -.14], [.53, -.09, -.095], .013, .009);
    eyes(art, head, [.105, .075, 0], .235, .038);
    for (const side of [-1, 1]) {
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.03, .59, side * .32]);
      finXZ(art, wing, [[.22, 0], [-.17, side * .61], [-.67, side * .65], [-.73, side * .12]], p.limestone);
      feather(art, wing, [.01, .037, side * .1], [-.46, .037, side * .51], .27, p.ocean);
      for (let i = 0; i < 4; i++) feather(art, wing, [-.14 - i * .09, .04, side * .1], [-.4 - i * .08, .018, side * .55], .145, i % 2 ? p.paper : p.limestone);
      rod(art, root, p.gold, [.04, .3, side * .21], [.08, .065, side * .28], .055, .04);
      finXZ(art, root, [[-.005, side * .29], [.29, side * .13], [.35, side * .3], [.25, side * .47]], p.gold, .023);
    }
    const tail = joint(root, 'tail', [-.76, .56, 0]);
    for (let i = 0; i < 4; i++) feather(art, tail, [0, 0, (i - 1.5) * .08], [-.36, .19, (i - 1.5) * .1], .16, i < 2 ? p.ink : p.paper);
  },

  gull: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.snow, [-.08, .62, 0], [.67, .3, .29]);
    const head = joint(root, 'head', [.52, .81, 0]);
    ellipsoid(art, head, p.snow, [0, 0, 0], [.26, .24, .22]);
    rod(art, head, p.gold, [.17, -.03, 0], [.53, -.08, 0], .066, .013);
    ellipsoid(art, head, p.vermilion, [.37, -.075, -.037], [.04, .024, .014]);
    eyes(art, head, [.103, .06, 0], .204, .035);
    for (const side of [-1, 1]) {
      const wing = joint(root, side < 0 ? 'wing-left' : 'wing-right', [.02, .73, side * .23]);
      finXZ(art, wing, [[.22, 0], [.32, side * .66], [-.49, side * 1.66], [-.29, side * .75], [-.58, side * .14]], p.mist);
      for (let i = 0; i < 5; i++) feather(art, wing, [.16 - i * .1, .035, side * (.18 + i * .085)], [-.31 - i * .067, .018, side * (1.6 - i * .13)], .18, i < 2 ? p.ink : p.snow);
      rod(art, root, p.gold, [.04, .4, side * .14], [.11, .065, side * .18], .042, .028);
      finXZ(art, root, [[.07, side * .18], [.29, side * .065], [.35, side * .23], [.21, side * .31]], p.gold, .023);
    }
    const tail = joint(root, 'tail', [-.64, .58, 0]);
    for (let i = 0; i < 5; i++) feather(art, tail, [0, 0, (i - 2) * .07], [-.5, .02, (i - 2) * .11], .17, p.snow);
  },

  fish: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.gold, [.03, 0, 0], [.89, .45, .26]);
    ellipsoid(art, root, p.paper, [.1, -.16, 0], [.68, .24, .23]);
    const head = joint(root, 'head', [.65, .015, 0]);
    ellipsoid(art, head, p.gold, [.02, 0, 0], [.34, .32, .25]);
    eyes(art, head, [.11, .08, 0], .233, .058);
    rod(art, head, p.clay, [.31, -.01, -.12], [.34, -.04, .12], .02);
    const tail = joint(root, 'tail', [-.76, 0, 0]);
    finXY(art, tail, [[.04, -.13], [-.84, -.62], [-.62, 0], [-.84, .62], [.04, .13]], p.vermilion, .052);
    for (const height of [-.48, -.23, .23, .48]) rod(art, tail, p.gold, [-.02, 0, 0], [-.73, height, 0], .012, .008);
    finXY(art, root, [[-.45, .28], [-.35, .78], [.25, .36]], p.vermilion);
    finXY(art, root, [[-.5, -.21], [-.51, -.63], [.14, -.32]], p.gold);
    for (const side of [-1, 1]) {
      const fin = joint(root, side < 0 ? 'fin-left' : 'fin-right', [.24, -.13, side * .22]);
      finXZ(art, fin, [[.03, 0], [-.48, side * .44], [-.39, side * .06]], p.vermilion);
      for (let i = 0; i < 3; i++) {
        const x = -.5 + i * .3;
        art.line(root, [[x + .04, .24, side * .208], [x - .055, .03, side * .264], [x + .015, -.2, side * .222]], .017, p.clay);
      }
      art.line(root, [[.52, .24, side * .17], [.43, .04, side * .26], [.53, -.22, side * .17]], .019, p.clay);
    }
  },

  dolphin: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.ocean, [-.1, 0, 0], [1.01, .34, .32]);
    ellipsoid(art, root, p.ice, [.2, -.11, 0], [.72, .2, .265]);
    const head = joint(root, 'head', [.75, .015, 0]);
    ellipsoid(art, head, p.ocean, [0, .04, 0], [.39, .32, .3]);
    ellipsoid(art, head, p.ocean, [.48, -.085, 0], [.46, .105, .13]);
    ellipsoid(art, head, p.ice, [.47, -.134, 0], [.4, .042, .106]);
    eyes(art, head, [.18, .055, 0], .255, .038);
    finXY(art, root, [[-.61, .23], [-.27, .73], [-.19, .61], [.16, .27]], p.ocean, .065);
    const tail = joint(root, 'tail', [-.98, -.025, 0]);
    rod(art, tail, p.ocean, [.12, 0, 0], [-.29, .075, 0], .18, .08);
    finXZ(art, tail, [[-.14, 0], [-.22, -.34], [-.62, -.73], [-.56, -.21], [-.65, 0], [-.56, .21], [-.62, .73], [-.22, .34]], p.ocean, .07);
    for (const side of [-1, 1]) {
      const fin = joint(root, side < 0 ? 'fin-left' : 'fin-right', [.31, -.17, side * .23]);
      finXZ(art, fin, [[.13, 0], [-.3, side * .64], [-.48, side * .7], [-.25, side * .19]], p.ocean);
      feather(art, fin, [.035, -.027, side * .07], [-.35, -.027, side * .56], .09, p.ice);
    }
    ellipsoid(art, root, p.ink, [.69, .315, 0], [.065, .018, .035]);
  },

  whale: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.ocean, [-.02, 0, 0], [1.24, .56, .52]);
    ellipsoid(art, root, p.ice, [.39, -.24, 0], [.91, .28, .43]);
    const head = joint(root, 'head', [.81, .01, 0]);
    ellipsoid(art, head, p.ocean, [.05, .025, 0], [.56, .49, .49]);
    ellipsoid(art, head, p.ice, [.21, -.26, 0], [.39, .2, .43]);
    eyes(art, head, [.17, -.055, 0], .475, .041);
    for (const side of [-1, 1]) {
      art.line(head, [[.48, -.14, side * .19], [.3, -.19, side * .37], [-.25, -.2, side * .47]], .018, p.ink);
      const fin = joint(root, side < 0 ? 'fin-left' : 'fin-right', [.16, -.3, side * .4]);
      finXZ(art, fin, [[.15, 0], [-.05, side * .38], [-.72, side * 1.1], [-.81, side * .94], [-.38, side * .16]], p.ocean, -.01);
      feather(art, fin, [.04, -.035, side * .08], [-.65, -.035, side * .87], .18, p.ice);
    }
    for (const z of [-.24, -.08, .08, .24]) art.line(root, [[1.06, -.32, z], [.61, -.49, z], [-.04, -.44, z]], .013, p.ocean);
    finXY(art, root, [[-.77, .28], [-.76, .56], [-.53, .34]], p.ocean, .07);
    const tail = joint(root, 'tail', [-1.03, .005, 0]);
    rod(art, tail, p.ocean, [.05, 0, 0], [-.23, .12, 0], .22, .11);
    finXZ(art, tail, [[-.14, 0], [-.19, -.43], [-.62, -.88], [-.53, -.34], [-.68, 0], [-.53, .34], [-.62, .88], [-.19, .43]], p.ocean, .12);
    ellipsoid(art, root, p.ink, [.76, .508, 0], [.083, .015, .05]);
  },

  seaTurtle: (art, root) => {
    const p = art.palette;
    ellipsoid(art, root, p.limestone, [-.07, -.13, 0], [.91, .18, .67]);
    ellipsoid(art, root, p.forest, [-.07, .015, 0], [.97, .4, .73]);
    // Seven individual hexagonal scutes follow the curvature of the domed carapace.
    for (const [x, z] of [[0, 0], [-.49, 0], [.49, 0], [-.245, -.42], [.245, -.42], [-.245, .42], [.245, .42]]) {
      const outline: Point[] = [];
      for (let i = 0; i < 6; i++) {
        const t = i * Math.PI / 3, px = x + Math.cos(t) * .273, pz = z + Math.sin(t) * .273;
        outline.push([px - .07, .025 + Math.sqrt(Math.max(.03, 1 - (px / .98) ** 2 - (pz / .76) ** 2)) * .405, pz]);
      }
      const center: Point = [x - .07, .049 + Math.sqrt(Math.max(.03, 1 - (x / .98) ** 2 - (z / .76) ** 2)) * .405, z];
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute([center, ...outline].flat(), 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute([[.5, .5], ...outline.map(v => [(v[0] - x + .35) / .7, (v[2] - z + .35) / .7])].flat(), 2));
      geometry.setIndex(Array.from({ length: 6 }, (_, i) => [0, (i + 1) % 6 + 1, i + 1]).flat());
      geometry.computeVertexNormals();
      art.mesh(root, geometry, x === 0 ? p.jade : art.mix(p.forest, p.jade, .57));
      for (let i = 0; i < 6; i++) rod(art, root, p.gold, outline[i], outline[(i + 1) % 6], .011);
    }
    const head = joint(root, 'head', [.8, -.01, 0]);
    rod(art, head, p.jade, [0, 0, 0], [.32, .025, 0], .18, .155);
    ellipsoid(art, head, p.jade, [.44, .035, 0], [.3, .205, .23]);
    eyes(art, head, [.53, .088, 0], .204, .036);
    rod(art, head, p.forest, [.66, -.02, -.115], [.68, -.027, .115], .014);
    for (const side of [-1, 1]) {
      const fin = joint(root, side < 0 ? 'fin-left' : 'fin-right', [.35, -.09, side * .5]);
      finXZ(art, fin, [[.19, 0], [.36, side * .37], [-.2, side * 1.09], [-.45, side * 1.04], [-.29, side * .38]], p.jade);
      feather(art, fin, [.08, .028, side * .05], [-.28, .028, side * .9], .18, p.forest);
      const rear = joint(root, side < 0 ? 'rear-fin-left' : 'rear-fin-right', [-.72, -.11, side * .42]);
      finXZ(art, rear, [[.13, 0], [-.34, side * .43], [-.54, side * .34], [-.22, side * .03]], p.jade);
      rod(art, rear, p.forest, [-.09, .027, side * .09], [-.38, .027, side * .31], .014, .008);
    }
    const tail = joint(root, 'tail', [-.91, -.09, 0]);
    rod(art, tail, p.jade, [0, 0, 0], [-.31, -.015, 0], .09, .006);
  },
} satisfies Record<string, AnimalBuilder>;
