import * as T from 'three';
import { ellipsoid, eyes, joint, rod, type AnimalBuilder, type AnimalPoint } from './history-fauna-shapes';
import type { PaperScenery } from './history-scenery';

/** Limb geometry hangs below its hip, leaving a useful pivot for the shared walking animation. */
function leg(art: PaperScenery, root: T.Group, name: string, hip: AnimalPoint, knee: AnimalPoint,
  footX: number, radius: number, color: string, footColor: string, hoof = false) {
  const limb = joint(root, name, hip), sole = hoof ? .13 : radius * .66;
  const ankle: AnimalPoint = [footX, -hip[1] + sole, 0];
  rod(art, limb, color, [0, 0, 0], knee, radius, radius * .8);
  rod(art, limb, color, knee, ankle, radius * .75, radius * .53);
  if (hoof) {
    art.box(limb, [radius * 2.0, sole * 2, radius * 1.75], [footX + radius * .18, -hip[1] + sole, 0], footColor);
    art.box(limb, [radius * .75, sole * 1.35, .018], [footX + radius * .82, -hip[1] + sole * .69, 0], art.palette.ink);
  } else ellipsoid(art, limb, footColor, [footX + radius * .24, -hip[1] + sole, 0], [radius * 1.15, sole, radius * .83]);
  return limb;
}

function ear(art: PaperScenery, root: T.Group, position: AnimalPoint, height: number, width: number, color: string, lining: string) {
  const base = joint(root, '', position);
  art.shape(base, [[-width, 0], [-width * .82, height * .47], [-width * .28, height], [width * .67, height * .6], [width, 0]], .075, color, [0, 0, -.04]);
  art.shape(base, [[-width * .61, height * .17], [-width * .3, height * .81], [width * .53, height * .24]], .018, lining, [0, 0, -.053]);
  return base;
}

function nose(art: PaperScenery, root: T.Group, position: AnimalPoint, size: number) {
  return ellipsoid(art, root, art.palette.ink, position, [size * .7, size * .65, size]);
}

function bear(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.clay, p.ink, .37), light = art.mix(p.clay, p.sand, .33);
  ellipsoid(art, root, fur, [-.23, 1.07, 0], [1.04, .67, .52]);
  ellipsoid(art, root, fur, [.52, 1.33, 0], [.54, .62, .55]);
  ellipsoid(art, root, light, [.65, 1.34, -.4], [.33, .39, .08]);
  const front = leg(art, root, 'leg-front-left', [.57, 1.08, -.37], [.05, -.44, 0], .12, .22, fur, fur);
  leg(art, root, 'leg-front-right', [.55, 1.08, .37], [-.04, -.47, 0], -.04, .22, fur, fur);
  leg(art, root, 'leg-back-left', [-.85, .98, -.36], [-.15, -.42, 0], -.09, .24, fur, fur);
  leg(art, root, 'leg-back-right', [-.85, .98, .36], [-.12, -.42, 0], .03, .24, fur, fur);
  const head = joint(root, 'head', [1, 1.53, 0]);
  ellipsoid(art, head, fur, [0, 0, 0], [.43, .39, .39]);
  ellipsoid(art, head, light, [.31, -.15, 0], [.3, .17, .24]);
  for (const side of [-1, 1]) {
    ellipsoid(art, head, fur, [-.12, .3, side * .28], [.16, .18, .11]);
    ellipsoid(art, head, light, [-.04, .31, side * .33], [.075, .095, .032]);
  }
  eyes(art, head, [.25, .07, 0], .31, .042); nose(art, head, [.56, -.12, 0], .095);
  const tail = joint(root, 'tail', [-1.18, 1.16, 0]);
  ellipsoid(art, tail, fur, [-.08, 0, 0], [.19, .15, .16]);
  for (let i = 0; i < 3; i++) rod(art, front, p.sand, [.18 + i * .045, -1.01, -.09 + i * .07], [.27 + i * .045, -1.035, -.09 + i * .07], .018);
}

function polarBear(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.snow, p.paper, .25), shade = art.mix(p.snow, p.ice, .18);
  ellipsoid(art, root, fur, [-.44, 1.1, 0], [1.02, .58, .43]);
  ellipsoid(art, root, shade, [.25, 1.17, 0], [.58, .46, .39]);
  ellipsoid(art, root, fur, [.65, 1.27, 0], [.66, .29, .29]).rotation.z = .14;
  leg(art, root, 'leg-front-left', [.47, 1.08, -.29], [.03, -.49, 0], .18, .19, fur, fur);
  leg(art, root, 'leg-front-right', [.47, 1.08, .29], [-.07, -.48, 0], -.06, .19, fur, fur);
  leg(art, root, 'leg-back-left', [-1.01, 1.02, -.3], [-.14, -.4, 0], -.03, .22, fur, fur);
  leg(art, root, 'leg-back-right', [-1.01, 1.02, .3], [-.13, -.4, 0], .09, .22, fur, fur);
  const head = joint(root, 'head', [1.13, 1.36, 0]);
  ellipsoid(art, head, fur, [.02, 0, 0], [.4, .24, .27]);
  ellipsoid(art, head, fur, [.33, -.045, 0], [.28, .145, .19]);
  for (const side of [-1, 1]) ellipsoid(art, head, shade, [-.17, .2, side * .18], [.09, .105, .07]);
  eyes(art, head, [.22, .05, 0], .23, .038); nose(art, head, [.58, -.02, 0], .079);
  const tail = joint(root, 'tail', [-1.4, 1.18, 0]);
  ellipsoid(art, tail, fur, [-.065, -.045, 0], [.14, .11, .105]);
}

function wolf(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.forest, p.mist, .58), dark = art.mix(p.ink, p.jade, .28);
  ellipsoid(art, root, fur, [-.2, 1.12, 0], [.89, .4, .32]);
  ellipsoid(art, root, dark, [.38, 1.37, 0], [.43, .51, .39]).rotation.z = -.25;
  ellipsoid(art, root, p.limestone, [.68, 1.25, 0], [.21, .32, .28]);
  leg(art, root, 'leg-front-left', [.45, 1.08, -.24], [.02, -.48, 0], .08, .115, fur, dark);
  leg(art, root, 'leg-front-right', [.43, 1.08, .24], [-.05, -.48, 0], -.09, .115, fur, dark);
  leg(art, root, 'leg-back-left', [-.83, 1.01, -.23], [.18, -.42, 0], -.12, .145, fur, dark);
  leg(art, root, 'leg-back-right', [-.83, 1.01, .23], [.14, -.43, 0], .05, .145, fur, dark);
  const head = joint(root, 'head', [.79, 1.68, 0]);
  ellipsoid(art, head, fur, [0, 0, 0], [.34, .29, .27]);
  ellipsoid(art, head, p.limestone, [.3, -.115, 0], [.33, .12, .17]);
  for (const side of [-1, 1]) ear(art, head, [-.12, .18, side * .2], .38, .13, dark, p.limestone);
  eyes(art, head, [.19, .035, 0], .24, .039); nose(art, head, [.61, -.09, 0], .07);
  const tail = joint(root, 'tail', [-1.01, 1.23, 0]);
  rod(art, tail, fur, [0, 0, 0], [-.42, -.31, 0], .18, .15);
  rod(art, tail, dark, [-.42, -.31, 0], [-.57, -.67, .05], .15, .025);
  for (const side of [-1, 1]) art.shape(head, [[-.3, -.01], [-.45, -.21], [-.19, -.15], [-.29, -.33], [.03, -.17]], .05, fur, [0, 0, side * .21]);
}

function fox(art: PaperScenery, root: T.Group) {
  const p = art.palette, red = art.mix(p.vermilion, p.clay, .15), cream = art.mix(p.snow, p.paper, .23);
  ellipsoid(art, root, red, [-.22, .77, 0], [.68, .3, .27]);
  ellipsoid(art, root, cream, [.36, .85, 0], [.24, .37, .235]);
  leg(art, root, 'leg-front-left', [.32, .76, -.18], [0, -.3, 0], .08, .085, red, p.ink);
  leg(art, root, 'leg-front-right', [.32, .76, .18], [-.03, -.3, 0], -.07, .085, red, p.ink);
  leg(art, root, 'leg-back-left', [-.64, .7, -.18], [.1, -.3, 0], -.05, .12, red, p.ink);
  leg(art, root, 'leg-back-right', [-.64, .7, .18], [.14, -.28, 0], .04, .12, red, p.ink);
  const head = joint(root, 'head', [.62, 1.1, 0]);
  ellipsoid(art, head, red, [0, 0, 0], [.3, .25, .25]);
  for (const side of [-1, 1]) {
    ear(art, head, [-.03, .18, side * .18], .43, .14, red, p.ink);
    art.shape(head, [[-.18, -.08], [.16, -.13], [.45, -.04], [.16, -.24]], .025, cream, [0, 0, side * .18]);
  }
  rod(art, head, cream, [.08, -.1, 0], [.46, -.11, 0], .15, .04);
  eyes(art, head, [.16, .025, 0], .215, .036); nose(art, head, [.49, -.09, 0], .049);
  const tail = joint(root, 'tail', [-.81, .85, 0]);
  ellipsoid(art, tail, red, [-.35, -.02, -.07], [.52, .28, .25]).rotation.z = .19;
  rod(art, tail, cream, [-.68, -.08, -.08], [-.94, -.27, -.1], .19, .015);
}

function deer(art: PaperScenery, root: T.Group) {
  const p = art.palette, coat = art.mix(p.clay, p.sand, .45), pale = art.mix(p.paper, p.snow, .4);
  ellipsoid(art, root, coat, [-.3, 1.22, 0], [.78, .4, .33]);
  ellipsoid(art, root, pale, [-.9, 1.25, 0], [.22, .27, .3]);
  ellipsoid(art, root, coat, [.41, 1.56, 0], [.25, .59, .25]).rotation.z = -.3;
  for (const side of [-1, 1]) {
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.27, 1.17, side * .22], [0, -.54, 0], side * .035, .085, coat, p.ink, true);
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-.81, 1.12, side * .23], [.13, -.48, 0], -.09 + side * .04, .1, coat, p.ink, true);
  }
  const head = joint(root, 'head', [.7, 2.0, 0]);
  ellipsoid(art, head, coat, [.07, 0, 0], [.36, .24, .23]);
  ellipsoid(art, head, pale, [.29, -.11, 0], [.21, .09, .16]);
  for (const side of [-1, 1]) {
    const e = ear(art, head, [-.15, .15, side * .19], .32, .16, coat, pale); e.rotation.x = side * .8;
    const base: AnimalPoint = [-.12, .2, side * .14];
    const mid: AnimalPoint = [-.29, .69, side * .27], tip: AnimalPoint = [-.49, 1.12, side * .44];
    rod(art, head, p.limestone, base, mid, .053, .035); rod(art, head, p.limestone, mid, tip, .035, .012);
    rod(art, head, p.limestone, [-.22, .5, side * .22], [.04, .73, side * .38], .032, .01);
    rod(art, head, p.limestone, [-.34, .81, side * .32], [-.08, 1.08, side * .5], .028, .01);
    rod(art, head, p.limestone, [-.44, 1.01, side * .4], [-.64, 1.22, side * .54], .021, .009);
  }
  eyes(art, head, [.16, .035, 0], .215, .035); nose(art, head, [.42, -.04, 0], .048);
  const tail = joint(root, 'tail', [-1.02, 1.28, 0]);
  rod(art, tail, coat, [0, 0, 0], [-.2, .11, 0], .105, .025);
}

function moose(art: PaperScenery, root: T.Group) {
  const p = art.palette, coat = art.mix(p.clay, p.ink, .47), muzzle = art.mix(p.clay, p.limestone, .4);
  ellipsoid(art, root, coat, [-.42, 1.43, 0], [.95, .49, .43]);
  ellipsoid(art, root, coat, [.38, 1.72, 0], [.43, .59, .46]);
  rod(art, root, coat, [.4, 1.68, 0], [.73, 1.92, 0], .3, .24);
  for (const side of [-1, 1]) {
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.36, 1.37, side * .29], [.01, -.64, 0], .06 + side * .05, .12, coat, p.ink, true);
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-1.03, 1.34, side * .28], [.19, -.55, 0], -.08 + side * .05, .13, coat, p.ink, true);
  }
  const head = joint(root, 'head', [.84, 2.04, 0]);
  ellipsoid(art, head, coat, [.1, -.05, 0], [.38, .28, .28]);
  ellipsoid(art, head, muzzle, [.37, -.19, 0], [.33, .3, .27]);
  rod(art, head, coat, [-.06, -.25, 0], [-.09, -.7, 0], .095, .045);
  for (const side of [-1, 1]) {
    const e = ear(art, head, [-.25, .09, side * .25], .34, .18, coat, muzzle); e.rotation.x = side * .95;
    rod(art, head, p.sand, [-.08, .17, side * .14], [-.24, .4, side * .47], .082, .065);
    const antler = joint(head, '', [-.24, .4, side * .45]); antler.rotation.x = side * .72;
    art.shape(antler, [[-.04, -.07], [-.48, .05], [-.68, .41], [-.61, .68], [-.52, .41], [-.41, .81], [-.31, .51], [-.13, .9], [-.07, .55], [.15, .76], [.12, .4], [.3, .5], [.2, .18]], .07, p.sand, [0, 0, -.035]);
    rod(art, antler, p.limestone, [-.03, .02, -.052], [-.35, .46, -.052], .019, .012);
  }
  eyes(art, head, [.14, .06, 0], .25, .038); nose(art, head, [.66, -.11, 0], .065);
  const tail = joint(root, 'tail', [-1.3, 1.43, 0]); rod(art, tail, coat, [0, 0, 0], [-.18, -.13, 0], .09, .04);
}

function rabbit(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.limestone, p.paper, .38), pale = art.mix(p.snow, p.paper, .2);
  ellipsoid(art, root, fur, [-.23, .57, 0], [.55, .44, .32]);
  ellipsoid(art, root, pale, [.19, .61, 0], [.3, .37, .25]);
  for (const side of [-1, 1]) {
    const back = joint(root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-.4, .46, side * .21]);
    ellipsoid(art, back, fur, [0, -.03, 0], [.3, .35, .2]);
    ellipsoid(art, back, fur, [.2, -.385, side * .035], [.38, .075, .13]);
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.26, .44, side * .16], [.045, -.2, 0], .15, .07, fur, pale);
  }
  const head = joint(root, 'head', [.4, .92, 0]);
  ellipsoid(art, head, fur, [0, 0, 0], [.3, .3, .26]);
  ellipsoid(art, head, pale, [.23, -.085, 0], [.17, .13, .185]);
  for (const side of [-1, 1]) {
    const e = ear(art, head, [-.07, .18, side * .135], .89 + side * .05, .12, fur, art.mix(p.heather, p.paper, .52));
    e.rotation.z = side < 0 ? -.13 : .1;
  }
  eyes(art, head, [.17, .07, 0], .225, .041);
  ellipsoid(art, head, p.heather, [.385, -.015, 0], [.045, .032, .047]);
  const tail = joint(root, 'tail', [-.72, .63, 0]); ellipsoid(art, tail, pale, [-.08, .035, 0], [.2, .19, .18]);
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) rod(art, head, p.limestone, [.27, -.09, side * .13], [.26 - i * .08, -.06 + i * .05, side * .36], .011, .005);
}

function squirrel(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.clay, p.vermilion, .27), chest = art.mix(p.sand, p.paper, .49);
  ellipsoid(art, root, fur, [-.12, .63, 0], [.44, .48, .27]).rotation.z = -.2;
  ellipsoid(art, root, chest, [.16, .76, -.035], [.21, .32, .23]);
  for (const side of [-1, 1]) {
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-.32, .48, side * .17], [.08, -.21, 0], .19, .13, fur, fur);
    const limb = joint(root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.22, .77, side * .19]);
    rod(art, limb, fur, [0, 0, 0], [.13, -.16, side * .015], .065, .043);
    rod(art, limb, fur, [.13, -.16, side * .015], [.23, -.23, -side * .08], .043, .03);
  }
  const head = joint(root, 'head', [.37, 1.08, 0]);
  ellipsoid(art, head, fur, [0, 0, 0], [.27, .25, .225]);
  ellipsoid(art, head, chest, [.22, -.07, 0], [.17, .105, .155]);
  for (const side of [-1, 1]) ear(art, head, [-.08, .15, side * .145], .27, .095, fur, chest);
  eyes(art, head, [.15, .055, 0], .195, .047); nose(art, head, [.38, -.055, 0], .033);
  const tail = joint(root, 'tail', [-.45, .48, 0]);
  const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(-.47, .36, 0), new T.Vector3(-.62, 1.0, 0), new T.Vector3(-.3, 1.38, 0), new T.Vector3(.08, 1.25, 0)]);
  art.mesh(tail, new T.TubeGeometry(curve, 13, .235, 7, false), fur);
  ellipsoid(art, tail, fur, [-.26, 1.31, 0], [.35, .24, .24]);
  for (let i = 0; i < 3; i++) {
    const strand = curve.getPoints(9).map(v => [v.x - .03, v.y + .01, -.16 - i * .024] as AnimalPoint);
    const hair = new T.CatmullRomCurve3(strand.map(point => new T.Vector3(...point)));
    art.mesh(tail, new T.TubeGeometry(hair, 18, .013, 3, false), art.mix(fur, chest, .23 + i * .1));
  }
  ellipsoid(art, root, p.gold, [.5, .63, 0], [.12, .145, .12]);
  ellipsoid(art, root, p.clay, [.5, .74, 0], [.13, .045, .13]);
}

function ibex(art: PaperScenery, root: T.Group) {
  const p = art.palette, coat = art.mix(p.clay, p.limestone, .58), horn = art.mix(p.gold, p.limestone, .52);
  ellipsoid(art, root, coat, [-.22, 1.02, 0], [.72, .37, .3]);
  ellipsoid(art, root, coat, [.36, 1.36, 0], [.29, .48, .29]).rotation.z = -.3;
  for (const side of [-1, 1]) {
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.28, 1, side * .2], [-.06, -.39, 0], .06 + side * .07, .105, coat, p.ink, true);
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-.73, .97, side * .2], [.14, -.39, 0], -.1 + side * .05, .12, coat, p.ink, true);
  }
  const head = joint(root, 'head', [.67, 1.7, 0]);
  ellipsoid(art, head, coat, [.06, -.02, 0], [.3, .24, .21]);
  ellipsoid(art, head, p.limestone, [.27, -.13, 0], [.2, .13, .17]);
  for (const side of [-1, 1]) {
    const e = ear(art, head, [-.19, .04, side * .17], .24, .12, coat, p.paper); e.rotation.x = side * 1.05;
    const points: AnimalPoint[] = [[-.08, .17, side * .14], [-.17, .57, side * .18], [-.48, .95, side * .22], [-.84, 1.04, side * .25], [-1.08, .81, side * .27]];
    for (let i = 1; i < points.length; i++) rod(art, head, horn, points[i - 1], points[i], .115 - (i - 1) * .025, .11 - i * .025);
    for (let i = 0; i < 8; i++) {
      const t = i / 8, x = -.11 - t * .66, y = .29 + Math.sin(t * 1.4) * .7;
      rod(art, head, p.sand, [x - .063, y, side * (.15 + t * .09)], [x + .055, y + .05, side * (.15 + t * .09)], .022);
    }
  }
  eyes(art, head, [.15, .035, 0], .185, .036); nose(art, head, [.44, -.12, 0], .045);
  art.shape(head, [[-.06, -.2], [.08, -.56], [.19, -.21]], .1, p.ink, [0, 0, -.05]);
  const tail = joint(root, 'tail', [-.91, 1.14, 0]); rod(art, tail, coat, [0, 0, 0], [-.21, .22, 0], .085, .025);
}

function yak(art: PaperScenery, root: T.Group) {
  const p = art.palette, fur = art.mix(p.ink, p.clay, .3), horn = art.mix(p.limestone, p.gold, .25);
  ellipsoid(art, root, fur, [-.32, 1.06, 0], [1.02, .56, .48]);
  ellipsoid(art, root, fur, [.33, 1.33, 0], [.49, .51, .45]);
  for (const side of [-1, 1]) {
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.4, .9, side * .29], [0, -.37, 0], .07, .15, fur, p.ink, true);
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-.98, .88, side * .29], [.12, -.34, 0], -.04, .155, fur, p.ink, true);
    for (let i = 0; i < 8; i++) {
      const x = -.99 + i * .195;
      art.shape(root, [[-.15, .99], [-.17, .59], [-.09, .21 + i % 3 * .05], [.045, .34], [.15, .26 + i % 2 * .05], [.12, 1.0]], .065, i % 2 ? fur : art.mix(fur, p.clay, .18), [x, 0, side * .39]);
    }
  }
  const head = joint(root, 'head', [.92, 1.17, 0]);
  ellipsoid(art, head, fur, [0, 0, 0], [.34, .35, .31]);
  ellipsoid(art, head, art.mix(fur, p.mist, .22), [.3, -.16, 0], [.27, .17, .24]);
  for (const side of [-1, 1]) {
    rod(art, head, horn, [-.12, .19, side * .2], [-.14, .31, side * .5], .085, .065);
    rod(art, head, horn, [-.14, .31, side * .5], [-.06, .67, side * .65], .065, .01);
    const e = ear(art, head, [-.17, -.03, side * .26], .19, .14, fur, p.limestone); e.rotation.x = side * 1.4;
  }
  eyes(art, head, [.17, .055, 0], .276, .039); nose(art, head, [.53, -.12, 0], .075);
  art.shape(head, [[-.17, .31], [.12, .43], [.3, .18], [.15, .1], [.02, .19], [-.09, .09]], .27, fur, [0, 0, -.135]);
  const tail = joint(root, 'tail', [-1.31, 1.23, 0]);
  rod(art, tail, fur, [0, 0, 0], [-.12, -.5, 0], .07, .08);
  ellipsoid(art, tail, fur, [-.13, -.63, 0], [.15, .26, .16]);
}

function camel(art: PaperScenery, root: T.Group) {
  const p = art.palette, coat = art.mix(p.sand, p.clay, .25), light = art.mix(p.sand, p.paper, .32);
  ellipsoid(art, root, coat, [-.41, 1.38, 0], [.93, .44, .4]);
  ellipsoid(art, root, coat, [-.86, 1.83, 0], [.35, .62, .35]);
  ellipsoid(art, root, coat, [-.05, 1.88, 0], [.36, .68, .36]);
  for (const side of [-1, 1]) {
    leg(art, root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.2, 1.34, side * .27], [-.06, -.6, 0], .1 + side * .045, .09, coat, light);
    leg(art, root, `leg-back-${side < 0 ? 'left' : 'right'}`, [-1.02, 1.3, side * .26], [.1, -.59, 0], -.15 + side * .035, .1, coat, light);
  }
  const neck = new T.CatmullRomCurve3([new T.Vector3(.29, 1.47, 0), new T.Vector3(.72, 1.25, 0), new T.Vector3(.87, 1.86, 0), new T.Vector3(.88, 2.51, 0)]);
  art.mesh(root, new T.TubeGeometry(neck, 10, .18, 7, false), coat);
  const head = joint(root, 'head', [.94, 2.56, 0]);
  ellipsoid(art, head, coat, [.1, -.02, 0], [.36, .2, .205]);
  ellipsoid(art, head, light, [.35, -.09, 0], [.22, .105, .16]);
  for (const side of [-1, 1]) ear(art, head, [-.11, .12, side * .14], .19, .085, coat, p.clay);
  eyes(art, head, [.2, .07, 0], .183, .034); nose(art, head, [.54, -.01, 0], .04);
  for (const side of [-1, 1]) rod(art, head, p.clay, [.29, -.07, side * .12], [.5, -.07, side * .115], .012);
  const tail = joint(root, 'tail', [-1.3, 1.49, 0]);
  rod(art, tail, coat, [0, 0, 0], [-.14, -.57, 0], .055, .038);
  ellipsoid(art, tail, p.clay, [-.14, -.65, 0], [.08, .145, .085]);
}

function penguin(art: PaperScenery, root: T.Group) {
  const p = art.palette, back = art.mix(p.ink, p.ocean, .25), cream = art.mix(p.snow, p.paper, .2);
  ellipsoid(art, root, back, [-.07, .97, 0], [.44, .83, .37]);
  ellipsoid(art, root, cream, [.26, .91, 0], [.18, .62, .31]);
  const head = joint(root, 'head', [.03, 1.69, 0]);
  ellipsoid(art, head, back, [0, 0, 0], [.31, .33, .29]);
  for (const side of [-1, 1]) {
    ellipsoid(art, head, p.gold, [.1, -.13, side * .23], [.14, .15, .048]);
    const wing = joint(root, `wing-${side < 0 ? 'left' : 'right'}`, [-.02, 1.38, side * .28]);
    wing.rotation.x = side * .34;
    art.shape(wing, [[-.09, .02], [-.26, -.26], [-.25, -.7], [-.12, -.96], [.045, -.8], [.08, -.3]], .1, back, [0, 0, -.05]);
    rod(art, wing, art.mix(back, p.mist, .36), [-.11, -.14, -.06], [-.17, -.73, -.06], .016, .008);
    const foot = joint(root, `leg-front-${side < 0 ? 'left' : 'right'}`, [.03, .24, side * .19]);
    rod(art, foot, p.gold, [0, 0, 0], [.06, -.13, 0], .048);
    ellipsoid(art, foot, p.gold, [.14, -.17, 0], [.25, .07, .125]);
    for (let toe = 0; toe < 2; toe++) rod(art, foot, p.clay, [.18, -.183, -.04 + toe * .08], [.32, -.183, -.04 + toe * .08], .012);
  }
  eyes(art, head, [.22, .06, 0], .22, .037);
  rod(art, head, p.gold, [.24, -.055, 0], [.58, -.08, 0], .1, .008);
  const tail = joint(root, 'tail', [-.38, .47, 0]);
  art.shape(tail, [[0, .12], [-.37, -.2], [-.05, -.1]], .23, back, [0, 0, -.115]);
}

export const WILDLAND_ANIMALS = {
  bear, polarBear, wolf, fox, deer, moose, rabbit, squirrel, ibex, yak, camel, penguin,
} satisfies Record<string, AnimalBuilder>;
