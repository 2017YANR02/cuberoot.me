import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import { ellipsoid, eyes, joint, rod, type AnimalBuilder, type AnimalPoint } from './history-fauna-shapes';

type Point = AnimalPoint;

/** Tapered, faceted curves retain a paper edge on trunks, horns and tails. */
function taper(art: PaperScenery, parent: T.Object3D, color: string, points: Point[], radii: number[]) {
  for (let i = 1; i < points.length; i++) rod(art, parent, color, points[i - 1], points[i], radii[i - 1], radii[i]);
}

function hoofLeg(art: PaperScenery, root: T.Group, name: string, start: Point, length: number, width: number, color: string, hoof: string, bend = 0) {
  const leg = joint(root, name, start), knee: Point = [bend, -length * .56, 0];
  rod(art, leg, color, [0, 0, 0], knee, width, width * .67);
  rod(art, leg, color, knee, [0, -length + .09, 0], width * .67, width * .5);
  art.box(leg, [width * 1.65, .11, width * 1.65], [.025, -length + .055, 0], hoof);
  return leg;
}

function ear(art: PaperScenery, parent: T.Object3D, position: Point, size: Point, color: string, inner: string, lean = 0) {
  const group = joint(parent, '', position); group.rotation.x = lean;
  ellipsoid(art, group, color, [0, 0, 0], size);
  ellipsoid(art, group, inner, [size[0] * .48, 0, 0], [size[0] * .65, size[1] * .7, size[2] * .7]);
}

/** Thin markings follow the ellipsoid itself, rather than floating flat beside it. */
function marking(art: PaperScenery, parent: T.Object3D, color: string, center: Point, scale: Point, longitude: number, latitude: number, width: number, height: number, angular = false) {
  const vertices: number[] = [], uv: number[] = [], count = angular ? 6 : 10;
  const point = (a: number, b: number): Point => [center[0] + Math.sin(b) * scale[0] * 1.012,
    center[1] + Math.cos(b) * Math.sin(a) * scale[1] * 1.012,
    center[2] + Math.cos(b) * Math.cos(a) * scale[2] * 1.012];
  const mid = point(longitude, latitude);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
    const p = point(longitude + Math.cos(a) * height, latitude + Math.sin(a) * width);
    const q = point(longitude + Math.cos(b) * height, latitude + Math.sin(b) * width);
    for (const v of [mid, q, p]) { vertices.push(...v); uv.push(0, 0); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  art.mesh(parent, g, color);
}

function stripe(art: PaperScenery, parent: T.Object3D, center: Point, scale: Point, latitude: number, width: number, color: string) {
  const vertices: number[] = [], uv: number[] = [];
  const point = (a: number, b: number): Point => [center[0] + Math.sin(b) * scale[0] * 1.016,
    center[1] + Math.cos(b) * Math.sin(a) * scale[1] * 1.016,
    center[2] + Math.cos(b) * Math.cos(a) * scale[2] * 1.016];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, b = (i + 1) / 18 * Math.PI * 2;
    const offset = Math.sin(a * 3 + latitude * 4) * .06, next = Math.sin(b * 3 + latitude * 4) * .06;
    const p = point(a, latitude + offset - width), q = point(a, latitude + offset + width);
    const r = point(b, latitude + next - width), s = point(b, latitude + next + width);
    for (const v of [p, q, r, q, s, r]) { vertices.push(...v); uv.push(0, 0); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); art.mesh(parent, g, color);
}

export const SAVANNA_ANIMALS = {
  elephant: (art, root) => {
    const p = art.palette, skin = art.mix(p.mist, p.limestone, .52), fold = art.mix(skin, p.ink, .2);
    ellipsoid(art, root, skin, [-.12, 1.22, 0], [.9, .65, .5]);
    for (const [name, x, z] of [['front-left', .47, -.32], ['front-right', .47, .32], ['back-left', -.64, -.32], ['back-right', -.64, .32]] as const) {
      const leg = joint(root, `leg-${name}`, [x, 1.09, z]);
      rod(art, leg, skin, [0, 0, 0], [0, -.98, 0], .2, .17);
      ellipsoid(art, leg, skin, [.025, -1, 0], [.21, .09, .2]);
      for (let i = 0; i < 3; i++) art.box(leg, [.05, .065, .065], [.19, -1.038, (i - 1) * .11], p.paper);
    }
    const head = joint(root, 'head', [.78, 1.54, 0]);
    ellipsoid(art, head, skin, [0, 0, 0], [.4, .46, .37]);
    for (const side of [-1, 1]) {
      const flap = art.shape(head, [[-.3, .18], [-.21, .51], [.09, .4], [.29, .12], [.2, -.35], [-.04, -.47], [-.27, -.22]], .04, skin, [-.15, -.04, side * .34]);
      flap.rotation.y = side * .4;
      rod(art, head, fold, [-.3, .23, side * .4], [-.22, -.3, side * .5], .012);
      taper(art, head, p.paper, [[.2, -.24, side * .24], [.44, -.29, side * .26], [.59, -.16, side * .28]], [.065, .045, .006]);
    }
    taper(art, head, skin, [[.32, .01, 0], [.46, -.33, 0], [.5, -.72, 0], [.69, -.96, 0], [.87, -.83, 0]], [.17, .14, .11, .078, .035]);
    for (let i = 0; i < 3; i++) rod(art, head, fold, [.5 + i * .028, -.42 - i * .13, -.1 + i * .01], [.53 + i * .028, -.42 - i * .13, .1 - i * .01], .008);
    eyes(art, head, [.22, .1, 0], .305, .033);
    const tail = joint(root, 'tail', [-.93, 1.37, 0]);
    taper(art, tail, skin, [[0, 0, 0], [-.18, -.23, 0], [-.16, -.6, 0]], [.055, .038, .02]);
    ellipsoid(art, tail, fold, [-.16, -.6, 0], [.055, .13, .055]);
  },

  giraffe: (art, root) => {
    const p = art.palette, coat = art.mix(p.sand, p.gold, .18), spot = art.mix(p.clay, p.gold, .13);
    const body: Point = [-.14, 1.95, 0], size: Point = [.69, .4, .32];
    ellipsoid(art, root, coat, body, size);
    for (const [name, x, z] of [['front-left', .38, -.23], ['front-right', .38, .23], ['back-left', -.65, -.23], ['back-right', -.65, .23]] as const)
      hoofLeg(art, root, `leg-${name}`, [x, 1.86, z], 1.86, .092, coat, p.ink, name.startsWith('back') ? -.12 : .035);
    rod(art, root, coat, [.38, 1.98, 0], [.94, 3.38, 0], .24, .135);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) marking(art, root, spot, body, size, side < 0 ? Math.PI + (i % 2 ? .38 : -.18) : (i % 2 ? .38 : -.18), -.97 + i * .27, .14, .23, true);
      for (let i = 0; i < 6; i++) art.shape(root, [[-.075, -.1], [.08, -.075], [.075, .08], [-.05, .105]], .008,
        spot, [.51 + i * .068, 2.2 + i * .19, side * (.205 - i * .012)]);
    }
    rod(art, root, spot, [.24, 2.06, 0], [.8, 3.33, 0], .038);
    const head = joint(root, 'head', [1.02, 3.43, 0]);
    ellipsoid(art, head, coat, [0, 0, 0], [.26, .19, .155]);
    ellipsoid(art, head, coat, [.22, -.065, 0], [.26, .13, .14]);
    ellipsoid(art, head, p.limestone, [.38, -.1, 0], [.12, .08, .13]);
    for (const side of [-1, 1]) {
      ear(art, head, [-.16, .11, side * .21], [.045, .14, .12], coat, p.paper, side * -.65);
      rod(art, head, coat, [-.015, .11, side * .085], [-.055, .34, side * .09], .035, .025);
      ellipsoid(art, head, spot, [-.055, .35, side * .09], [.048, .05, .045]);
    }
    eyes(art, head, [.075, .035, 0], .145, .028);
    const tail = joint(root, 'tail', [-.78, 1.96, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.27, -.27, 0], [-.3, -.64, 0]], [.035, .025, .018]);
    ellipsoid(art, tail, spot, [-.3, -.65, 0], [.07, .17, .065]);
  },

  zebra: (art, root) => {
    const p = art.palette, coat = p.paper, dark = art.mix(p.ink, p.mist, .18);
    const body: Point = [-.1, 1.15, 0], size: Point = [.76, .43, .34];
    ellipsoid(art, root, coat, body, size);
    for (let i = 0; i < 8; i++) stripe(art, root, body, size, -.99 + i * .28, .062, dark);
    for (const [name, x, z] of [['front-left', .4, -.24], ['front-right', .4, .24], ['back-left', -.64, -.24], ['back-right', -.64, .24]] as const) {
      const leg = hoofLeg(art, root, `leg-${name}`, [x, .98, z], .98, .092, coat, dark, name.startsWith('back') ? -.1 : .015);
      for (let i = 0; i < 3; i++) rod(art, leg, dark, [0, -.51 - i * .12, 0], [0, -.545 - i * .12, 0], .067 - i * .006);
    }
    const neck: Point = [.5, 1.44, 0], neckSize: Point = [.24, .49, .24];
    ellipsoid(art, root, coat, neck, neckSize);
    for (let i = 0; i < 4; i++) stripe(art, root, neck, neckSize, -.85 + i * .49, .09, dark);
    art.shape(root, [[.2, 1.2], [.25, 1.91], [.39, 1.96], [.52, 1.56]], .075, dark, [0, 0, -.035]);
    const head = joint(root, 'head', [.77, 1.73, 0]);
    ellipsoid(art, head, coat, [.02, 0, 0], [.27, .2, .18]);
    ellipsoid(art, head, coat, [.26, -.16, 0], [.3, .17, .17]);
    ellipsoid(art, head, dark, [.45, -.25, 0], [.15, .115, .145]);
    for (const side of [-1, 1]) ear(art, head, [-.13, .23, side * .115], [.06, .18, .065], coat, dark, side * .1);
    eyes(art, head, [.14, .04, 0], .17, .026);
    const tail = joint(root, 'tail', [-.8, 1.32, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.27, -.21, 0], [-.32, -.5, 0]], [.035, .027, .018]);
    ellipsoid(art, tail, dark, [-.32, -.55, 0], [.065, .17, .065]);
  },

  lion: (art, root) => {
    const p = art.palette, coat = art.mix(p.sand, p.gold, .23), mane = art.mix(p.clay, p.ink, .27);
    ellipsoid(art, root, coat, [-.2, .81, 0], [.76, .32, .3]);
    for (const [name, x, z] of [['front-left', .36, -.23], ['front-right', .36, .23], ['back-left', -.71, -.22], ['back-right', -.71, .22]] as const) {
      const leg = hoofLeg(art, root, `leg-${name}`, [x, .72, z], .72, .105, coat, coat, name.startsWith('back') ? -.13 : .025);
      ellipsoid(art, leg, coat, [.1, -.64, 0], [.16, .08, .12]);
    }
    const head = joint(root, 'head', [.6, 1.02, 0]);
    const ruff = art.mesh(head, new T.IcosahedronGeometry(1, 1), mane); ruff.scale.set(.34, .5, .44);
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      art.mesh(head, new T.ConeGeometry(.11, .29, 4), mane, [-.13, Math.sin(a) * .34, Math.cos(a) * .31]).rotation.z = Math.PI / 2;
    }
    ellipsoid(art, head, coat, [.24, .035, 0], [.26, .26, .26]);
    for (const side of [-1, 1]) {
      ellipsoid(art, head, coat, [.14, .26, side * .21], [.065, .095, .085]);
      ellipsoid(art, head, p.paper, [.44, -.09, side * .075], [.12, .085, .1]);
      rod(art, head, mane, [.48, -.11, side * .08], [.38, -.13, side * .19], .009);
    }
    ellipsoid(art, head, p.ink, [.535, -.04, 0], [.055, .04, .06]);
    eyes(art, head, [.4, .11, 0], .183, .032);
    const tail = joint(root, 'tail', [-.89, .92, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.34, -.06, .05], [-.58, .12, .08], [-.63, .38, .07]], [.035, .029, .023, .02]);
    ellipsoid(art, tail, mane, [-.63, .4, .07], [.09, .12, .075]);
  },

  gazelle: (art, root) => {
    const p = art.palette, coat = art.mix(p.sand, p.clay, .22), dark = art.mix(p.ink, p.clay, .23);
    ellipsoid(art, root, coat, [-.12, 1.14, 0], [.64, .29, .23]);
    ellipsoid(art, root, p.paper, [-.13, 1.02, 0], [.51, .19, .22]);
    for (const side of [-1, 1]) rod(art, root, dark, [-.64, 1.09, side * .19], [.38, 1.1, side * .2], .028);
    for (const [name, x, z] of [['front-left', .35, -.16], ['front-right', .35, .16], ['back-left', -.61, -.16], ['back-right', -.61, .16]] as const)
      hoofLeg(art, root, `leg-${name}`, [x, 1.03, z], 1.03, .048, coat, dark, name.startsWith('back') ? -.11 : .04);
    rod(art, root, coat, [.33, 1.18, 0], [.67, 1.66, 0], .145, .085);
    const head = joint(root, 'head', [.74, 1.67, 0]);
    ellipsoid(art, head, coat, [.04, 0, 0], [.2, .15, .12]);
    ellipsoid(art, head, p.paper, [.23, -.075, 0], [.16, .1, .09]);
    ellipsoid(art, head, dark, [.35, -.1, 0], [.045, .05, .065]);
    for (const side of [-1, 1]) {
      ear(art, head, [-.06, .12, side * .18], [.035, .11, .14], coat, p.paper, side * -.7);
      taper(art, head, dark, [[-.065, .105, side * .065], [-.18, .38, side * .12], [-.15, .58, side * .1], [-.03, .7, side * .065]], [.037, .029, .022, .003]);
      rod(art, head, dark, [.1, .035, side * .12], [.27, -.055, side * .082], .018);
    }
    eyes(art, head, [.12, .045, 0], .112, .024);
    const tail = joint(root, 'tail', [-.71, 1.2, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.22, .14, 0], [-.3, .07, 0]], [.036, .025, .008]);
    ellipsoid(art, tail, dark, [-.27, .11, 0], [.08, .045, .045]);
  },

  rhino: (art, root) => {
    const p = art.palette, skin = art.mix(p.mist, p.limestone, .6), seam = art.mix(skin, p.ink, .2);
    const body: Point = [-.2, .91, 0], size: Point = [.85, .54, .44];
    ellipsoid(art, root, skin, body, size);
    for (const [name, x, z] of [['front-left', .34, -.3], ['front-right', .34, .3], ['back-left', -.76, -.3], ['back-right', -.76, .3]] as const) {
      const leg = hoofLeg(art, root, `leg-${name}`, [x, .64, z], .64, .17, skin, seam, -.02);
      for (let i = 0; i < 3; i++) art.box(leg, [.07, .065, .075], [.15, -.598, (i - 1) * .09], p.limestone);
    }
    stripe(art, root, body, size, .52, .026, seam); stripe(art, root, body, size, -.62, .018, seam);
    const head = joint(root, 'head', [.66, .81, 0]);
    ellipsoid(art, head, skin, [.11, -.05, 0], [.45, .3, .3]);
    ellipsoid(art, head, skin, [.43, -.16, 0], [.25, .19, .26]);
    for (const side of [-1, 1]) ear(art, head, [-.12, .29, side * .18], [.08, .17, .085], skin, seam, side * -.3);
    taper(art, head, p.limestone, [[.49, .01, 0], [.59, .31, 0], [.66, .55, 0]], [.135, .07, .005]);
    taper(art, head, p.limestone, [[.21, .17, 0], [.25, .39, 0]], [.085, .004]);
    eyes(art, head, [.21, .09, 0], .26, .03);
    for (const side of [-1, 1]) ellipsoid(art, head, seam, [.59, -.13, side * .135], [.035, .025, .048]);
    const tail = joint(root, 'tail', [-.98, 1.03, 0]); taper(art, tail, skin, [[0, 0, 0], [-.17, -.18, 0], [-.15, -.43, 0]], [.04, .028, .016]);
  },

  hippo: (art, root) => {
    const p = art.palette, skin = art.mix(p.clay, p.mist, .63), muzzle = art.mix(skin, p.paper, .17), dark = art.mix(skin, p.ink, .43);
    ellipsoid(art, root, skin, [-.21, .72, 0], [.89, .52, .55]);
    for (const [name, x, z] of [['front-left', .35, -.34], ['front-right', .35, .34], ['back-left', -.77, -.34], ['back-right', -.77, .34]] as const) {
      const leg = hoofLeg(art, root, `leg-${name}`, [x, .43, z], .43, .16, skin, skin);
      for (let i = 0; i < 4; i++) art.box(leg, [.06, .05, .057], [.14, -.394, (i - 1.5) * .071], p.limestone);
    }
    const head = joint(root, 'head', [.7, .71, 0]);
    ellipsoid(art, head, skin, [0, 0, 0], [.36, .31, .36]);
    ellipsoid(art, head, muzzle, [.33, -.08, 0], [.42, .235, .37]);
    rod(art, head, dark, [.61, -.17, -.24], [.65, -.17, .24], .011);
    for (const side of [-1, 1]) {
      ellipsoid(art, head, skin, [-.09, .31, side * .28], [.085, .095, .07]);
      ellipsoid(art, head, skin, [.13, .25, side * .26], [.105, .1, .085]);
      ellipsoid(art, head, dark, [.6, .035, side * .17], [.05, .025, .045]);
    }
    eyes(art, head, [.19, .29, 0], .31, .033);
    const tail = joint(root, 'tail', [-1.05, .78, 0]); taper(art, tail, skin, [[0, 0, 0], [-.19, -.03, 0], [-.27, -.17, 0]], [.07, .045, .008]);
  },

  buffalo: (art, root) => {
    const p = art.palette, coat = art.mix(p.ink, p.clay, .3), horn = art.mix(p.limestone, p.sand, .34), muzzle = art.mix(coat, p.mist, .3);
    ellipsoid(art, root, coat, [-.22, 1.06, 0], [.76, .46, .4]);
    ellipsoid(art, root, coat, [.31, 1.26, 0], [.37, .4, .35]);
    for (const [name, x, z] of [['front-left', .34, -.27], ['front-right', .34, .27], ['back-left', -.71, -.27], ['back-right', -.71, .27]] as const)
      hoofLeg(art, root, `leg-${name}`, [x, .86, z], .86, .105, coat, p.ink, name.startsWith('back') ? -.12 : 0);
    const head = joint(root, 'head', [.69, 1.04, 0]);
    ellipsoid(art, head, coat, [.05, 0, 0], [.31, .33, .28]);
    ellipsoid(art, head, muzzle, [.26, -.2, 0], [.21, .14, .22]);
    for (const side of [-1, 1]) {
      taper(art, head, horn, [[.015, .28, side * .06], [-.015, .21, side * .32], [.015, .08, side * .59], [.1, .22, side * .72], [.15, .48, side * .68]], [.125, .1, .072, .043, .004]);
      ellipsoid(art, head, coat, [-.09, .045, side * .33], [.13, .06, .15]);
      ellipsoid(art, head, p.ink, [.42, -.18, side * .105], [.028, .025, .033]);
    }
    eyes(art, head, [.2, .035, 0], .247, .027);
    const tail = joint(root, 'tail', [-.91, 1.22, 0]); taper(art, tail, coat, [[0, 0, 0], [-.24, -.28, 0], [-.22, -.63, 0]], [.04, .025, .019]);
    ellipsoid(art, tail, p.ink, [-.22, -.64, 0], [.055, .13, .055]);
  },

  wildebeest: (art, root) => {
    const p = art.palette, coat = art.mix(p.mist, p.clay, .37), mane = art.mix(p.ink, p.clay, .18), horn = art.mix(p.paper, p.limestone, .35);
    ellipsoid(art, root, coat, [-.19, 1.06, 0], [.68, .36, .3]);
    ellipsoid(art, root, coat, [.28, 1.29, 0], [.35, .45, .33]);
    for (const [name, x, z] of [['front-left', .33, -.22], ['front-right', .33, .22], ['back-left', -.66, -.21], ['back-right', -.66, .21]] as const)
      hoofLeg(art, root, `leg-${name}`, [x, .98, z], .98, .075, coat, mane, name.startsWith('back') ? -.16 : .02);
    art.shape(root, [[-.32, 1.34], [.15, 1.82], [.48, 1.7], [.42, 1.2]], .065, mane, [0, 0, -.033]);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++)
      rod(art, root, mane, [-.18 + i * .12, 1.39 - i * .035, side * .268], [-.26 + i * .15, 1.01, side * .28], .018);
    const head = joint(root, 'head', [.72, 1.15, 0]);
    ellipsoid(art, head, coat, [.01, 0, 0], [.24, .29, .21]);
    ellipsoid(art, head, mane, [.23, -.21, 0], [.23, .19, .19]);
    art.shape(head, [[-.18, -.1], [.14, -.19], [-.01, -.55], [-.16, -.35]], .14, mane, [0, 0, -.07]);
    for (const side of [-1, 1]) {
      taper(art, head, horn, [[-.065, .19, side * .13], [-.08, .14, side * .41], [-.02, .3, side * .48], [.07, .44, side * .37]], [.065, .048, .033, .003]);
      ellipsoid(art, head, coat, [-.14, .025, side * .275], [.15, .05, .115]);
    }
    eyes(art, head, [.13, .05, 0], .19, .026);
    const tail = joint(root, 'tail', [-.81, 1.2, 0]); taper(art, tail, coat, [[0, 0, 0], [-.24, -.14, 0], [-.37, -.43, 0]], [.035, .026, .017]);
    ellipsoid(art, tail, mane, [-.37, -.47, 0], [.085, .24, .075]);
  },

  ostrich: (art, root) => {
    const p = art.palette, feather = art.mix(p.ink, p.mist, .15), skin = art.mix(p.clay, p.paper, .55);
    ellipsoid(art, root, feather, [-.18, 1.31, 0], [.58, .4, .42]);
    for (const side of [-1, 1]) {
      const leg = joint(root, side < 0 ? 'leg-front-left' : 'leg-front-right', [-.13, 1.08, side * .19]);
      taper(art, leg, skin, [[0, 0, 0], [-.17, -.49, 0], [.05, -.99, 0]], [.075, .045, .03]);
      rod(art, leg, skin, [.05, -.99, 0], [.27, -1.055, side * .025], .035, .013);
      rod(art, leg, skin, [.075, -1.015, 0], [.19, -1.055, -side * .07], .022, .009);
      ellipsoid(art, leg, skin, [.22, -1.062, side * .025], [.1, .018, .028]);
      for (let i = 0; i < 5; i++) {
        const wing = ellipsoid(art, root, i < 2 ? feather : p.paper, [-.16 - i * .085, 1.37 - i * .045, side * (.36 + i * .015)], [.32, .065, .105]);
        wing.rotation.z = .22 + i * .1;
      }
    }
    taper(art, root, skin, [[.23, 1.45, 0], [.48, 1.71, 0], [.36, 2.12, 0], [.52, 2.49, 0]], [.13, .09, .063, .065]);
    const head = joint(root, 'head', [.62, 2.49, 0]);
    ellipsoid(art, head, skin, [0, 0, 0], [.16, .14, .13]);
    rod(art, head, p.gold, [.1, -.025, 0], [.31, -.045, 0], .07, .018);
    eyes(art, head, [.03, .035, 0], .12, .03);
    const tail = joint(root, 'tail', [-.65, 1.43, 0]);
    for (let i = 0; i < 5; i++) {
      const plume = ellipsoid(art, tail, p.paper, [-.14, .06 + Math.abs(i - 2) * .015, (i - 2) * .09], [.28, .07, .075]);
      plume.rotation.y = (i - 2) * .16; plume.rotation.z = -.24;
    }
  },

  meerkat: (art, root) => {
    const p = art.palette, coat = art.mix(p.sand, p.clay, .21), dark = art.mix(p.ink, p.clay, .33);
    ellipsoid(art, root, coat, [-.08, .7, 0], [.23, .57, .21]);
    ellipsoid(art, root, p.paper, [.09, .76, 0], [.08, .38, .15]);
    for (const side of [-1, 1]) {
      const leg = joint(root, side < 0 ? 'leg-back-left' : 'leg-back-right', [-.1, .32, side * .16]);
      rod(art, leg, coat, [0, 0, 0], [.03, -.25, 0], .085, .06);
      ellipsoid(art, leg, dark, [.105, -.265, 0], [.15, .055, .075]);
      const arm = joint(root, side < 0 ? 'leg-front-left' : 'leg-front-right', [.055, 1.02, side * .18]);
      taper(art, arm, coat, [[0, 0, 0], [.18, -.2, side * -.03], [.21, -.36, side * -.05]], [.052, .038, .024]);
      for (let i = 0; i < 3; i++) rod(art, arm, dark, [.21, -.35, side * -.05 + (i - 1) * .027], [.26, -.405, side * -.05 + (i - 1) * .027], .009, .002);
    }
    const head = joint(root, 'head', [.055, 1.32, 0]);
    ellipsoid(art, head, coat, [0, .04, 0], [.23, .24, .19]);
    ellipsoid(art, head, coat, [.2, -.035, 0], [.19, .105, .12]);
    ellipsoid(art, head, dark, [.34, -.025, 0], [.045, .04, .055]);
    for (const side of [-1, 1]) {
      ellipsoid(art, head, dark, [.125, .08, side * .163], [.095, .068, .026]);
      ellipsoid(art, head, coat, [-.15, .115, side * .18], [.07, .075, .045]);
    }
    eyes(art, head, [.15, .085, 0], .19, .026);
    const tail = joint(root, 'tail', [-.22, .38, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.26, -.24, 0], [-.56, -.32, 0], [-.77, -.34, 0]], [.085, .055, .027, .007]);
    for (let i = 0; i < 3; i++) rod(art, root, dark, [-.25, .68 + i * .13, -.08], [-.27, .68 + i * .13, .08], .013);
  },

  warthog: (art, root) => {
    const p = art.palette, coat = art.mix(p.clay, p.mist, .43), mane = art.mix(p.ink, p.clay, .35), tusk = p.paper;
    ellipsoid(art, root, coat, [-.17, .72, 0], [.65, .34, .3]);
    for (const [name, x, z] of [['front-left', .27, -.2], ['front-right', .27, .2], ['back-left', -.62, -.2], ['back-right', -.62, .2]] as const)
      hoofLeg(art, root, `leg-${name}`, [x, .59, z], .59, .071, coat, mane, name.startsWith('back') ? -.065 : .025);
    art.shape(root, [[-.73, .9], [-.48, 1.15], [-.05, 1.22], [.41, .96], [.3, .88]], .055, mane, [0, 0, -.028]);
    const head = joint(root, 'head', [.58, .68, 0]);
    ellipsoid(art, head, coat, [.08, -.01, 0], [.36, .24, .26]);
    ellipsoid(art, head, coat, [.42, -.11, 0], [.22, .145, .21]);
    for (const side of [-1, 1]) {
      ear(art, head, [-.08, .27, side * .17], [.055, .17, .07], coat, mane, side * -.5);
      ellipsoid(art, head, coat, [.06, .005, side * .265], [.11, .095, .07]);
      ellipsoid(art, head, coat, [.26, -.075, side * .24], [.08, .065, .065]);
      taper(art, head, tusk, [[.28, -.11, side * .22], [.4, -.04, side * .33], [.43, .17, side * .34], [.36, .29, side * .29]], [.06, .045, .027, .003]);
      taper(art, head, tusk, [[.45, -.2, side * .17], [.54, -.15, side * .2], [.54, -.04, side * .19]], [.03, .019, .003]);
      ellipsoid(art, head, mane, [.61, -.08, side * .085], [.025, .026, .035]);
    }
    eyes(art, head, [.05, .135, 0], .21, .027);
    const tail = joint(root, 'tail', [-.78, .84, 0]);
    taper(art, tail, coat, [[0, 0, 0], [-.21, .27, 0], [-.24, .58, 0]], [.034, .025, .016]);
    ellipsoid(art, tail, mane, [-.24, .61, 0], [.055, .1, .045]);
  },
} satisfies Record<string, AnimalBuilder>;
