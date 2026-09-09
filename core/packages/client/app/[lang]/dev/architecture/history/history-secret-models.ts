import * as T from 'three';
import type { PaperScenery } from './history-scenery';
import type { HistorySecret } from './history-secrets';

type Point = [number, number, number];
type SecretBuilder = (art: PaperScenery, root: T.Group) => void;

function rod(art: PaperScenery, root: T.Object3D, a: Point, b: Point, radius: number, color: string) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
  const mesh = art.mesh(root, new T.CylinderGeometry(radius, radius, direction.length(), 8), color);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function hoop(art: PaperScenery, root: T.Object3D, radius: number, tube: number, at: Point, color: string, arc = Math.PI * 2) {
  return art.mesh(root, new T.TorusGeometry(radius, tube, 5, 40, arc), color, at);
}

function bead(art: PaperScenery, root: T.Object3D, at: Point, radius: number, color: string) {
  return art.mesh(root, new T.IcosahedronGeometry(radius), color, at);
}

const SECRET_MODELS = {
  'laurel-cup': (art, root) => {
    const p = art.palette;
    art.box(root, [.92, .15, .72], [0, .075, 0], p.forest);
    art.box(root, [.8, .06, .62], [0, .18, 0], p.gold);
    art.mesh(root, new T.CylinderGeometry(.12, .27, .48, 12), p.gold, [0, .45, 0]);
    // A closed wall section leaves the bowl visibly open, including its inner paper surface.
    const section = [[0, 0], [.14, 0], [.25, .12], [.46, .36], [.59, .72], [.52, .74], [.41, .4], [.2, .18], [0, .16]];
    art.mesh(root, new T.LatheGeometry(section.map(([r, y]) => new T.Vector2(r, y)), 32), p.paper, [0, .67, 0]);
    hoop(art, root, .555, .028, [0, 1.4, 0], p.gold).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      art.line(root, [[side * .43, 1.33, 0], [side * .87, 1.38, 0], [side * .87, .92, 0], [side * .27, .83, 0]], .048, p.gold);
      art.line(root, [[side * .04, .85, .46], [side * .23, 1.03, .53], [side * .31, 1.26, .54]], .012, p.forest);
      for (let i = 0; i < 4; i++) {
        art.shape(root, [[0, 0], [side * .11, .035], [side * .17, .14], [side * .05, .12]], .012, p.jade, [side * (.06 + i * .055), .92 + i * .08, .55]);
      }
    }
    art.shape(root, [[0, .12], [.04, .035], [.13, .025], [.06, -.04], [.08, -.13], [0, -.08], [-.08, -.13], [-.06, -.04], [-.13, .025], [-.04, .035]], .025, p.gold, [0, 1.13, .575]);
  },
  'turning-gyroscope': (art, root) => {
    const p = art.palette;
    art.shape(root, [[-.68, 0], [.68, 0], [.42, .15], [.1, .23], [-.1, .23], [-.42, .15]], .5, p.forest, [0, 0, -.25]);
    for (const side of [-1, 1]) {
      rod(art, root, [side * .48, .13, 0], [side * .85, 1.18, 0], .038, p.gold);
      bead(art, root, [side * .85, 1.18, 0], .09, p.vermilion);
    }
    const frame = new T.Group(); frame.position.y = 1.2; root.add(frame);
    hoop(art, frame, .85, .038, [0, 0, 0], p.gold);
    const inner = hoop(art, frame, .69, .032, [0, 0, 0], p.jade); inner.rotation.set(.48, .88, .1);
    const core = hoop(art, frame, .53, .028, [0, 0, 0], p.vermilion); core.rotation.set(1.12, -.62, .15);
    rod(art, frame, [0, -.84, 0], [0, .84, 0], .022, p.gold);
    art.mesh(frame, new T.OctahedronGeometry(.28), p.paper);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      rod(art, frame, [Math.cos(a) * .78, Math.sin(a) * .78, .014], [Math.cos(a) * .83, Math.sin(a) * .83, .014], .012, p.forest);
    }
    bead(art, frame, [0, .84, 0], .064, p.gold);
  },
  'ribbon-book': (art, root) => {
    const p = art.palette;
    for (const side of [-1, 1]) {
      const cover = new T.Group(); cover.rotation.y = side * .34; root.add(cover);
      art.box(cover, [.96, 1.52, .12], [side * .5, .78, -.03], p.forest);
      for (let layer = 0; layer < 4; layer++) {
        art.box(cover, [.9 - layer * .018, 1.43 - layer * .012, .018], [side * .48, .79, .045 + layer * .021], layer % 2 ? p.paper : p.limestone);
      }
      for (let row = 0; row < 5; row++) {
        art.box(cover, [.46 + (row % 2) * .14, .015, .01], [side * .48, 1.3 - row * .16, .123], p.jade);
      }
      for (const y of [.16, 1.4]) {
        art.shape(cover, [[0, 0], [.14 * side, 0], [0, .14]], .02, p.gold, [side * .83, y, .12]);
      }
    }
    art.mesh(root, new T.CylinderGeometry(.095, .095, 1.52, 12), p.vermilion, [0, .78, -.04]);
    for (let i = 0; i < 4; i++) hoop(art, root, .105, .012, [0, .24 + i * .34, -.04], p.gold).rotation.x = Math.PI / 2;
    // A lifted corner and a hanging ribbon make the page silhouette visible from the scroll camera.
    art.shape(root, [[.48, 1.47], [.79, 1.48], [.93, 1.66], [.68, 1.64]], .024, p.paper, [0, 0, .4]);
    rod(art, root, [.48, 1.47, .4], [.93, 1.66, .4], .012, p.limestone);
    art.shape(root, [[-.48, 1.48], [-.32, 1.48], [-.32, .15], [-.4, .23], [-.48, .15]], .024, p.vermilion, [0, 0, .31]);
    art.box(root, [.19, .04, .03], [-.4, 1.44, .335], p.gold);
  },
  'sealed-letter': (art, root) => {
    const p = art.palette;
    art.box(root, [2.14, 1.3, .13], [0, .67, 0], p.limestone);
    art.shape(root, [[-1.05, 0], [0, .73], [1.05, 0]], .035, p.paper, [0, .02, .085]);
    art.shape(root, [[-1.05, 0], [-1.05, 1.28], [0, .58]], .035, p.paper, [0, .02, .1]);
    art.shape(root, [[1.05, 0], [0, .58], [1.05, 1.28]], .035, p.paper, [0, .02, .1]);
    art.shape(root, [[-1.05, 1.28], [0, .52], [1.05, 1.28]], .035, p.snow, [0, .02, .155]);
    rod(art, root, [-1.04, 1.31, .195], [0, .56, .195], .011, p.gold);
    rod(art, root, [0, .56, .195], [1.04, 1.31, .195], .011, p.gold);
    const seal = art.mesh(root, new T.CylinderGeometry(.19, .2, .07, 12), p.vermilion, [0, .6, .23]); seal.rotation.x = Math.PI / 2;
    hoop(art, root, .13, .014, [0, .6, .28], p.gold);
    art.shape(root, [[-.055, -.055], [.055, -.055], [.055, .055], [-.055, .055]], .014, p.gold, [0, .6, .284]).rotation.z = Math.PI / 4;
    art.box(root, [.15, .26, .02], [.78, 1.04, .205], p.jade);
    for (let i = 0; i < 3; i++) art.box(root, [.085, .018, .015], [.78, 1 + i * .045, .222], p.paper);
    art.line(root, [[-.91, .2, .16], [-.77, .23, .16], [-.62, .2, .16]], .011, p.jade);
  },
  'paper-gramophone': (art, root) => {
    const p = art.palette;
    for (const x of [-.51, .51]) for (const z of [-.39, .39]) {
      art.mesh(root, new T.CylinderGeometry(.075, .11, .17, 8), p.gold, [x, .085, z]);
    }
    art.box(root, [1.2, .38, .98], [0, .33, 0], p.forest);
    art.box(root, [1.27, .055, 1.04], [0, .535, 0], p.gold);
    art.box(root, [1.13, .03, .9], [0, .575, 0], p.paper);
    art.mesh(root, new T.CylinderGeometry(.39, .39, .035, 40), p.ink, [.12, .61, .1]);
    for (const radius of [.17, .23, .29, .35]) hoop(art, root, radius, .008, [.12, .632, .1], p.gold).rotation.x = Math.PI / 2;
    art.mesh(root, new T.CylinderGeometry(.105, .105, .025, 20), p.vermilion, [.12, .64, .1]);
    art.line(root, [[.48, .58, -.27], [.43, .82, -.23], [.31, .83, .08], [.23, .69, .14]], .034, p.gold);
    bead(art, root, [.23, .68, .14], .055, p.paper);
    const horn = new T.Group(); horn.position.set(-.36, .64, -.25); horn.rotation.set(.35, 0, .55); root.add(horn);
    const wall = [[.1, 0], [.1, .25], [.19, .47], [.39, .7], [.69, .9], [.7, .96], [.62, .97], [.34, .77], [.14, .51], [.055, .26], [.055, 0]];
    art.mesh(horn, new T.LatheGeometry(wall.map(([r, y]) => new T.Vector2(r, y)), 24), p.gold);
    hoop(art, horn, .66, .026, [0, .94, 0], p.paper).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      art.line(horn, [[Math.cos(a) * .11, .25, Math.sin(a) * .11], [Math.cos(a) * .2, .49, Math.sin(a) * .2], [Math.cos(a) * .4, .72, Math.sin(a) * .4], [Math.cos(a) * .69, .93, Math.sin(a) * .69]], .009, p.limestone);
    }
    art.box(root, [.53, .12, .025], [0, .33, .505], p.gold);
    for (let i = 0; i < 5; i++) art.box(root, [.025, .07, .01], [-.16 + i * .08, .33, .524], p.forest);
    rod(art, root, [.61, .32, .05], [.83, .32, .05], .025, p.gold);
    rod(art, root, [.83, .32, .05], [.83, .45, .05], .025, p.gold);
    bead(art, root, [.83, .48, .05], .065, p.vermilion);
  },
  'star-lantern': (art, root) => {
    const p = art.palette;
    art.mesh(root, new T.CylinderGeometry(.56, .65, .13, 6), p.forest, [0, .065, 0]);
    art.mesh(root, new T.CylinderGeometry(.61, .56, .06, 6), p.gold, [0, .16, 0]);
    art.mesh(root, new T.CylinderGeometry(.34, .61, .28, 6), p.forest, [0, 1.66, 0]);
    art.mesh(root, new T.CylinderGeometry(.19, .35, .1, 6), p.gold, [0, 1.85, 0]);
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i / 6 * Math.PI * 2;
      const x = Math.cos(angle) * .53, z = Math.sin(angle) * .53;
      rod(art, root, [x, .18, z], [x, 1.52, z], .027, p.gold);
      const next = angle + Math.PI / 3;
      rod(art, root, [x, 1.5, z], [Math.cos(next) * .53, 1.5, Math.sin(next) * .53], .022, p.gold);
      bead(art, root, [x, .23, z], .045, p.vermilion);
    }
    const star: [number, number][] = Array.from({ length: 10 }, (_, i) => {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .2 : .43;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    art.shape(root, star, .1, p.paper, [0, .94, -.05]);
    art.shape(root, star.map(([x, y]) => [x * .75, y * .75]), .018, p.gold, [0, .94, .056]);
    rod(art, root, [0, 1.35, 0], [0, 1.6, 0], .014, p.gold);
    const handle = hoop(art, root, .22, .026, [0, 2, 0], p.gold, Math.PI * 1.65); handle.rotation.z = -.325 * Math.PI;
    art.line(root, [[-.17, .24, .31], [.03, .39, .4], [.27, .46, .33]], .01, p.gold);
    for (const at of [[-.17, .24, .31], [.03, .39, .4], [.27, .46, .33]] as Point[]) bead(art, root, at, .044, p.snow);
  },
} satisfies Record<HistorySecret['id'], SecretBuilder>;

/** Local, material-owned miniatures; the scene owns placement, projection and interaction. */
export function buildHistorySecret(art: PaperScenery, root: T.Group, secret: HistorySecret) {
  SECRET_MODELS[secret.id](art, root);
}
