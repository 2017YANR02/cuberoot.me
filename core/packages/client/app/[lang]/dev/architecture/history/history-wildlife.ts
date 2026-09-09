import * as T from 'three';
import { HISTORY_SPACING } from './history-days';
import { environmentValue, groundY, pathZ, riverZ } from './history-environment';
import { HISTORY_FAUNA, type AnimalEncounter, type AnimalSpecies } from './history-fauna';
import { SAVANNA_ANIMALS } from './history-fauna-savanna';
import { WILDLAND_ANIMALS } from './history-fauna-wildlands';
import { SKY_WATER_ANIMALS } from './history-fauna-sky-water';
import type { AnimalBuilder } from './history-fauna-shapes';
import type { PaperScenery } from './history-scenery';

export const ANIMAL_BUILDERS = { ...SAVANNA_ANIMALS, ...WILDLAND_ANIMALS, ...SKY_WATER_ANIMALS } satisfies Record<AnimalSpecies, AnimalBuilder>;
type Joint = { object: T.Object3D; rotation: T.Euler };
type Foot = { object: T.Object3D; points: T.Vector3[]; scaleY: number };
type Resident = { root: T.Group; encounter: AnimalEncounter; x: number; z: number; phase: number; joints: Joint[]; feet: Foot[]; heading: T.Quaternion };

/** Cache sole support points once; raised forepaws stay raised instead of being stretched to the ground. */
function supportingFeet(root: T.Group, joints: Joint[]): Foot[] {
  root.updateMatrixWorld(true);
  const feet: Foot[] = [];
  for (const { object } of joints) {
    if (!object.name.startsWith('leg-')) continue;
    const bounds = new T.Box3().setFromObject(object, true);
    if (bounds.min.y > .12) continue;
    const inverse = object.matrixWorld.clone().invert(), candidates: T.Vector3[] = [];
    object.traverse(child => {
      if (!(child instanceof T.Mesh)) return;
      const positions = child.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
        if (point.y <= bounds.min.y + .12) candidates.push(point.applyMatrix4(inverse));
      }
    });
    const points: T.Vector3[] = [];
    // The centre plus eight shallow support directions also retain flat hoof corners.
    for (let i = 0; i < 9; i++) {
      const x = i ? Math.cos(i * Math.PI / 4) * .15 : 0, z = i ? Math.sin(i * Math.PI / 4) * .15 : 0;
      const point = candidates.reduce((best, next) => next.y + next.x * x + next.z * z < best.y + best.x * x + best.z * z ? next : best);
      if (!points.some(value => value.distanceToSquared(point) < 1e-10)) points.push(point);
    }
    feet.push({ object, points, scaleY: object.scale.y });
  }
  return feet;
}

/** Merge each articulated part independently: the silhouette keeps its joints, not dozens of draw calls. */
export function prepareAnimal(art: PaperScenery, root: T.Group) {
  const children = root.children.filter((child): child is T.Group => child instanceof T.Group);
  for (const child of children) { prepareAnimal(art, child); child.removeFromParent(); }
  art.flatten(root);
  children.forEach(child => root.add(child));
  // The static terrain shadow cache must not retain a moving animal's old silhouette.
  root.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = false; object.receiveShadow = true; } });
}

export class PaperWildlife {
  readonly root = new T.Group();
  private readonly residents: Resident[] = [];
  private readonly point = new T.Vector3();
  private readonly contact = new T.Vector3();
  private contactY = 0;
  private readonly up = new T.Vector3(0, 1, 0);
  private readonly across = new T.Vector3(0, 0, 1);
  private readonly sway = new T.Quaternion();
  constructor(art: PaperScenery, readonly day: number) {
    this.root.name = `history-wildlife-${day}`;
    let bank = 0;
    for (const [index, encounter] of HISTORY_FAUNA[day].entries()) {
      const root = new T.Group(); root.name = `animal-${encounter.species}`;
      ANIMAL_BUILDERS[encounter.species](art, root);
      prepareAnimal(art, root);
      const joints: Joint[] = [];
      root.traverse(object => { if (object !== root && object instanceof T.Group && object.name) joints.push({ object, rotation: object.rotation.clone() }); });
      const wader = encounter.species === 'crane' || encounter.species === 'flamingo';
      const feet = encounter.layer === 'bank' && !wader ? supportingFeet(root, joints) : [];
      const bounds = new T.Box3().setFromObject(root, true);
      const slot = bank++;
      const x = day * HISTORY_SPACING + (encounter.layer === 'air' ? -6.4 : encounter.layer === 'water' ? 3.8 : wader ? 2.7 : slot % 2 ? 9.1 : -9.1);
      let z = encounter.layer === 'air' ? -3.8 : wader ? -.15 : .92;
      const scale = encounter.species === 'whale' ? 1.15 : .95;
      root.scale.setScalar(scale);
      if (feet.length) {
        // Reserve the complete turning silhouette for the whole patrol, outside the red trail.
        const radius = Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))) * scale + .15;
        const reach = 1.6 + Math.hypot(radius, bounds.max.y * scale);
        let road = -Infinity;
        for (let i = 0; i <= 24; i++) road = Math.max(road, pathZ(x + (i / 12 - 1) * reach));
        z = road + radius + .65 + .48;
      }
      root.rotation.y = encounter.layer === 'bank' && slot % 2 ? Math.PI + .12 : -.15;
      const heading = root.quaternion.clone();
      this.root.add(root);
      this.residents.push({ root, encounter, x, z, phase: day * 1.7 + index * 2.3, joints, feet, heading });
    }
    this.update(0);
  }

  update(time: number) {
    for (const resident of this.residents) {
      const { root, encounter, x, z, phase, joints } = resident;
      const clock = time + phase, water = encounter.layer === 'water', air = encounter.layer === 'air';
      const wader = encounter.species === 'crane' || encounter.species === 'flamingo';
      const walking = !water && !air && !wader, patrol = clock * .34;
      // Small local loops cannot drift into neighbouring dates, even during long playback.
      const dx = walking ? Math.sin(patrol) * 1.6 : Math.sin(clock * (air ? .24 : .35)) * (air ? 2.2 : water ? .9 : .16);
      const xx = x + dx, elevation = groundY(xx), wave = Math.sin(clock * 3.4);
      if (air) {
        root.position.set(xx, elevation + 8.3 + Math.sin(clock * .8) * .42, z + Math.cos(clock * .24) * .8);
        root.rotation.z = Math.cos(clock * .8) * .035;
      } else if (water) {
        const surface = elevation - .11;
        root.position.set(xx, surface + (encounter.species === 'duck' ? -.28 : .05 + Math.max(0, Math.sin(clock * .8)) * .12), riverZ(xx) + Math.sin(clock * .35) * .45);
        root.rotation.y = -.12 + Math.cos(clock * .35) * .16;
      } else {
        root.position.set(xx, elevation + (wader ? -.12 : -.025), riverZ(xx) + environmentValue(xx, 'water') / 2 + z);
        if (!wader) {
          const slope = (groundY(xx + .7) - groundY(xx - .7)) / 1.4;
          // Follow a rounded turn at each end of the patrol instead of walking backwards.
          resident.heading.setFromAxisAngle(this.up, Math.atan2(.3 * Math.sin(patrol), Math.cos(patrol)));
          root.quaternion.setFromAxisAngle(this.across, Math.atan(slope)).multiply(resident.heading);
          if (encounter.species === 'penguin') root.quaternion.multiply(this.sway.setFromAxisAngle(this.across, wave * .035));
          root.position.z = z + Math.cos(patrol) * .48;
        }
      }
      for (const { object, rotation } of joints) {
        object.rotation.copy(rotation);
        const name = object.name;
        if (name.startsWith('wing-')) object.rotation.x += (name.endsWith('left') ? 1 : -1) * Math.sin(clock * (encounter.species === 'swallow' ? 7 : 3.4)) * (air ? .43 : .08);
        else if (name.startsWith('leg-') && !air && !water) {
          const diagonal = name === 'leg-front-left' || name === 'leg-back-right' ? 1 : -1;
          object.rotation.z += wave * (walking ? .035 + Math.abs(Math.cos(patrol)) * .16 : .065) * diagonal;
        } else if (name === 'tail') {
          if (water && encounter.species !== 'fish') object.rotation.z += wave * .12;
          else object.rotation.y += Math.sin(clock * 1.7) * .12;
        } else if (name.startsWith('fin-')) object.rotation.x += wave * .15 * (name.endsWith('left') ? 1 : -1);
        else if (name === 'head') object.rotation.z += Math.sin(clock * .75) * .045;
      }
      if (resident.feet.length) this.groundFeet(resident);
    }
  }

  private footGap(foot: Foot) {
    let gap = Infinity;
    for (const point of foot.points) {
      this.point.copy(point).applyMatrix4(foot.object.matrixWorld);
      const value = this.point.y - (groundY(this.point.x) - .03);
      if (value < gap) { gap = value; this.contact.copy(this.point); this.contactY = point.y; }
    }
    return gap;
  }

  private groundFeet({ root, feet }: Resident) {
    for (const foot of feet) foot.object.scale.y = foot.scaleY;
    root.updateWorldMatrix(true, false);
    let height = 0;
    for (const foot of feet) { foot.object.updateWorldMatrix(false, false); height += this.footGap(foot); }
    root.position.y += .003 - height / feet.length;
    root.updateWorldMatrix(false, false);
    for (const foot of feet) {
      // Tiny length adjustments keep the hip attached on curved slopes, without rebuilding geometry.
      for (let i = 0; i < 3; i++) {
        foot.object.updateWorldMatrix(false, false);
        const gap = this.footGap(foot);
        if (Math.abs(gap - .003) < .0001) break;
        const slope = (groundY(this.contact.x + .05) - groundY(this.contact.x - .05)) / .1;
        const matrix = foot.object.matrixWorld.elements;
        const derivative = (matrix[5] - slope * matrix[4]) * this.contactY / foot.object.scale.y;
        foot.object.scale.y -= (gap - .003) / derivative;
      }
    }
  }

  get species() { return HISTORY_FAUNA[this.day].map(({ species }) => species).join(','); }
}
