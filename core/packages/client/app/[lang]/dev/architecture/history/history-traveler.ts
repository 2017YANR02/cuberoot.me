import * as T from 'three';
import { clampHistoryPosition, HISTORY_SPACING, HISTORY_WALK_SPEED } from './history-days';
import { groundY, pathZ } from './history-environment';
import type { PaperScenery } from './history-scenery';

// Three times the previous stroll's fastest speed, now maintained throughout the walk.
export { HISTORY_WALK_SPEED } from './history-days';

/** A small paper traveller, built with the landscape's materials and animation clock. */
export class PaperTraveler {
  readonly root = new T.Group();
  private readonly figure = new T.Group();
  private readonly body = new T.Group();
  private readonly scarf = new T.Group();
  private readonly legs: { hip: T.Group; knee: T.Group; foot: T.Group }[] = [];
  private readonly arms: T.Group[] = [];
  private readonly shadowMaterial: T.MeshBasicMaterial;
  private previousX: number | undefined;
  private previousTime = 0;
  private phase = Math.PI / 2;
  private heading = Math.PI / 2;

  constructor(art: PaperScenery) {
    const p = art.palette;
    const cloth = art.mix(p.paper, p.jade, .28);
    this.root.name = 'history-traveler';
    this.root.add(this.figure); this.figure.add(this.body);

    this.shadowMaterial = new T.MeshBasicMaterial({ color: p.ink, transparent: true, opacity: .13, depthWrite: false });
    const shadow = new T.Mesh(new T.CircleGeometry(.55, 24), this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .65;
    shadow.position.y = .012; this.root.add(shadow);

    // A folded robe, unpainted face, broad straw hat, and one small travelling pack.
    art.mesh(this.body, new T.CylinderGeometry(.25, .42, .97, 8), cloth, [0, 1.24, 0]);
    art.mesh(this.body, new T.IcosahedronGeometry(.235, 1), p.limestone, [0, 1.88, .035]);
    art.mesh(this.body, new T.ConeGeometry(.64, .29, 16), p.sand, [0, 2.17, 0]);
    art.mesh(this.body, new T.CylinderGeometry(.65, .65, .035, 16), p.gold, [0, 2.015, 0]);
    art.mesh(this.body, new T.CylinderGeometry(.28, .28, .075, 12), p.vermilion, [0, 1.66, 0]);
    art.box(this.body, [.4, .45, .23], [0, 1.39, -.33], p.forest);
    const bedroll = art.cylinder(this.body, .105, .48, [0, 1.65, -.35], p.limestone);
    bedroll.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) art.box(this.body, [.035, .48, .025], [side * .18, 1.4, .245], p.gold);
    art.flatten(this.body);

    this.scarf.position.set(-.2, 1.64, -.15); this.body.add(this.scarf);
    art.shape(this.scarf, [[0, 0], [-.13, -.22], [-.04, -.56], [.1, -.51], [.035, -.22], [.13, -.015]], .025, p.vermilion);

    for (const side of [-1, 1]) {
      const arm = new T.Group(); arm.position.set(side * .31, 1.52, 0); this.body.add(arm);
      art.mesh(arm, new T.CylinderGeometry(.12, .16, .42, 6), cloth, [side * .04, -.2, 0]);
      art.mesh(arm, new T.IcosahedronGeometry(.095, 0), p.limestone, [side * .04, -.44, .025]);
      this.arms.push(arm);

      const hip = new T.Group(), knee = new T.Group();
      hip.position.set(side * .16, .76, 0); this.figure.add(hip);
      art.mesh(hip, new T.CylinderGeometry(.095, .075, .4, 6), p.forest, [0, -.2, 0]);
      knee.position.y = -.4; hip.add(knee);
      art.mesh(knee, new T.CylinderGeometry(.075, .065, .43, 6), p.forest, [0, -.215, 0]);
      const foot = new T.Group(); foot.position.y = -.43; knee.add(foot);
      art.box(foot, [.16, .105, .28], [0, 0, .06], p.ink);
      this.legs.push({ hip, knee, foot });
    }
    // The contact shadow moves with the traveller without redrawing the landscape's shadow map.
    this.root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
  }

  update(time: number, position: number, narrow: boolean) {
    // Apply the left-side resting offset after clamping, including at the first and last dates.
    const x = clampHistoryPosition(position) * HISTORY_SPACING - 1.5;
    const elapsed = Math.min(.08, Math.max(0, time - this.previousTime));
    const delta = this.previousX === undefined ? 0 : x - this.previousX;
    const scale = narrow ? 1.4 : 1;
    const slope = (pathZ(x + .08) - pathZ(x - .08)) / .16;
    if (Math.abs(delta) > .00001) {
      const direction = Math.sign(delta);
      const angle = Math.atan2(direction, slope * direction);
      const turn = Math.atan2(Math.sin(angle - this.heading), Math.cos(angle - this.heading));
      this.heading += turn * (elapsed ? 1 - Math.exp(-elapsed * 7) : 1);
      // Fast scrubbing should not make the legs flicker; normal steps follow distance travelled.
      this.phase += Math.min(Math.hypot(delta, slope * delta) / scale, elapsed * HISTORY_WALK_SPEED * 2) * 8;
    }
    this.root.position.set(x, groundY(x) + .02, pathZ(x) - .8);
    this.root.scale.setScalar(scale); this.figure.rotation.y = this.heading;
    this.body.position.y = Math.sin(this.phase * 2) * .018;
    this.body.rotation.z = Math.sin(this.phase) * .018;
    this.scarf.rotation.x = -.15 + Math.sin(time * 1.7) * .08;

    this.legs.forEach(({ hip, knee, foot }, i) => {
      const phase = this.phase + i * Math.PI;
      const forward = Math.sin(phase) * .21;
      const lift = Math.max(0, Math.cos(phase)) * .11;
      // Two short paper folds keep the planted shoe level instead of swinging through the ground.
      const footX = x + scale * (hip.position.x * Math.cos(this.heading) + forward * Math.sin(this.heading));
      const drop = .705 - lift - (groundY(footX) - groundY(x)) / scale;
      const distance = Math.hypot(forward, drop);
      hip.rotation.x = Math.atan2(-forward, drop) - Math.acos(T.MathUtils.clamp((.4 ** 2 + distance ** 2 - .43 ** 2) / (.8 * distance), -1, 1));
      knee.rotation.x = Math.PI - Math.acos(T.MathUtils.clamp((.4 ** 2 + .43 ** 2 - distance ** 2) / (.8 * .43), -1, 1));
      foot.rotation.x = -hip.rotation.x - knee.rotation.x;
      this.arms[i].rotation.x = Math.sin(phase) * .24;
    });
    this.previousX = x; this.previousTime = time;
  }

  dispose() { this.shadowMaterial.dispose(); }
}
