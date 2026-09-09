import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_PLACES, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { environmentValue, groundY, pathZ, riverZ } from '@/app/[lang]/dev/architecture/history/history-environment';
import { ANIMALS, HISTORY_FAUNA, type AnimalSpecies } from '@/app/[lang]/dev/architecture/history/history-fauna';
import { ANIMAL_BUILDERS, PaperWildlife, prepareAnimal } from '@/app/[lang]/dev/architecture/history/history-wildlife';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;
function scenery() {
  const grain = new T.Texture();
  return Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
    palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
  });
}
function dispose(root: T.Group, art: PaperScenery) {
  root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
  art.dispose();
}

describe('wildlife in the history scroll', () => {
  it('actually distributes all 36 independently built species across the recorded dates and all three realms', () => {
    const species = Object.keys(ANIMALS).sort();
    expect(species.length).toBe(36);
    expect(Object.keys(ANIMAL_BUILDERS).sort()).toEqual(species);
    expect(new Set(Object.values(ANIMAL_BUILDERS)).size).toBe(36);
    expect([...new Set(HISTORY_FAUNA.flat().map(animal => animal.species))].sort()).toEqual(species);
    expect(HISTORY_FAUNA.length).toBe(HISTORY_PLACES.length);
    expect([...new Set(Object.values(ANIMALS).map(animal => animal.realm))].sort()).toEqual(['air', 'land', 'water']);
    for (const encounters of HISTORY_FAUNA) {
      expect(encounters.length).toBe(2);
      expect(new Set(encounters.map(animal => animal.species)).size).toBe(encounters.length);
      for (const animal of encounters) {
        expect(ANIMALS[animal.species].en).toBeTruthy();
        expect(ANIMALS[animal.species].zh).toBeTruthy();
      }
    }
  });

  it('keeps 36 distinct finite silhouettes and articulation after merging their static parts', () => {
    const hashes = new Set<string>();
    for (const species of Object.keys(ANIMALS) as AnimalSpecies[]) {
      const art = scenery(), root = new T.Group();
      ANIMAL_BUILDERS[species](art, root);
      root.updateMatrixWorld(true);
      const before = new T.Box3().setFromObject(root, true), point = new T.Vector3(), hash = createHash('sha256');
      const joints: T.Object3D[] = [];
      let triangles = 0;
      root.traverse(object => {
        if (object instanceof T.Group && object.name) joints.push(object);
        if (!(object instanceof T.Mesh)) return;
        const geometry = object.geometry, position = geometry.getAttribute('position');
        triangles += (geometry.index?.count ?? position.count) / 3;
        for (const attribute of ['position', 'normal', 'uv']) {
          const values = geometry.getAttribute(attribute);
          expect(values, `${species} ${attribute}`).toBeDefined();
          if (!Array.from(values.array).every(Number.isFinite)) throw new Error(`${species}: invalid ${attribute}`);
        }
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          hash.update(point.toArray().map(value => value.toFixed(5)).join(','));
        }
      });
      expect(triangles, species).toBeLessThanOrEqual(3500);
      expect(before.min.x, species).toBeGreaterThanOrEqual(-1.85);
      expect(before.max.x, species).toBeLessThanOrEqual(1.85);
      expect(before.max.y, species).toBeLessThanOrEqual(4);
      expect(joints.length, species).toBeGreaterThanOrEqual(2);
      hashes.add(hash.digest('hex'));
      prepareAnimal(art, root);
      const after = new T.Box3().setFromObject(root, true);
      expect(after.min.distanceTo(before.min), species).toBeLessThan(.0001);
      expect(after.max.distanceTo(before.max), species).toBeLessThan(.0001);
      for (const joint of joints) expect(root.getObjectById(joint.id), species).toBe(joint);
      dispose(root, art);
    }
    expect(hashes.size).toBe(36);
  }, 30_000);

  it('animates in bounded world habitats and freezes exactly when the scene clock is paused', () => {
    for (let day = 0; day < HISTORY_PLACES.length; day++) {
      const art = scenery(), wildlife = new PaperWildlife(art, day);
      const snapshot = () => {
        wildlife.root.updateMatrixWorld(true);
        const values: number[] = [];
        wildlife.root.traverse(object => { if (object instanceof T.Group) values.push(...object.matrixWorld.elements); });
        return values;
      };
      wildlife.update(3.25); const frozen = snapshot();
      for (const encounter of HISTORY_FAUNA[day]) {
        const animal = wildlife.root.getObjectByName(`animal-${encounter.species}`)!;
        if (encounter.layer === 'air') expect(animal.rotation.z, encounter.species).not.toBe(0);
        if (encounter.species === 'penguin') expect(animal.rotation.z).not.toBe(0);
      }
      wildlife.update(3.25); expect(snapshot(), String(day)).toEqual(frozen);
      wildlife.update(200_000);
      for (const animal of wildlife.root.children) {
        expect(Math.abs(animal.position.x - day * HISTORY_SPACING), String(day)).toBeLessThan(12);
        expect(animal.position.toArray().every(Number.isFinite)).toBe(true);
      }
      expect(snapshot(), String(day)).not.toEqual(frozen);
      expect(wildlife.species.split(','), String(day)).toEqual(HISTORY_FAUNA[day].map(animal => animal.species));
      dispose(wildlife.root, art);
    }
  }, 60_000);

  it('keeps every supporting foot on its slope and the complete patrol outside the walking trail across all dates', () => {
    const point = new T.Vector3(), forward = new T.Vector3(), velocity = new T.Vector3();
    let lowestFoot = Infinity, highestFoot = -Infinity, nearestTrail = Infinity;
    for (let day = 0; day < HISTORY_PLACES.length; day++) {
      const art = scenery(), wildlife = new PaperWildlife(art, day);
      const land = HISTORY_FAUNA[day].filter(({ species, layer }) => layer === 'bank' && ANIMALS[species].realm === 'land');
      const extents = new Map(land.map(({ species }) => [species, { min: Infinity, max: -Infinity }]));
      // A full patrol, including both turns, plus a long-running clock. Read actual merged vertices,
      // independently of the runtime's small cached contact set.
      for (let step = 0; step < 33; step++) {
        const time = step === 32 ? 200_000 : step * (Math.PI * 2 / .34) / 32;
        wildlife.update(time); wildlife.root.updateMatrixWorld(true);
        const poses = land.map(({ species }) => {
          const animal = wildlife.root.getObjectByName(`animal-${species}`)!;
          const label = `${HISTORY_PLACES[day].date} ${species} at ${time.toFixed(2)}`;
          const extent = extents.get(species)!;
          if (step < 32) { extent.min = Math.min(extent.min, animal.position.x); extent.max = Math.max(extent.max, animal.position.x); }
          let trail = Infinity, groundMargin = Infinity;
          animal.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const positions = object.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
              point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
              trail = Math.min(trail, point.z - pathZ(point.x));
              // The open foreground bank extends 16 units from the river's paper edge.
              groundMargin = Math.min(groundMargin, riverZ(point.x) + environmentValue(point.x, 'water') / 2 + .2 + 16 - point.z);
            }
          });
          nearestTrail = Math.min(nearestTrail, trail);
          expect(trail, `${label} red trail`).toBeGreaterThan(.6);
          expect(groundMargin, `${label} supported bank`).toBeGreaterThan(0);
          const bounds = new T.Box3().setFromObject(animal, true);
          expect(bounds.min.x - day * HISTORY_SPACING, label).toBeGreaterThan(-14);
          expect(bounds.max.x - day * HISTORY_SPACING, label).toBeLessThan(14);
          // Upright meerkats/squirrels keep their forepaws raised; penguins/ostriches have two feet.
          const pairs = species === 'meerkat' || species === 'squirrel' ? ['back']
            : species === 'penguin' || species === 'ostrich' ? ['front'] : ['front', 'back'];
          for (const pair of pairs) for (const side of ['left', 'right']) {
            const foot = animal.getObjectByName(`leg-${pair}-${side}`)!;
            expect(foot, label).toBeDefined();
            let gap = Infinity;
            foot.traverse(object => {
              if (!(object instanceof T.Mesh)) return;
              const positions = object.geometry.getAttribute('position');
              for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                gap = Math.min(gap, point.y - (groundY(point.x) - .03));
              }
            });
            lowestFoot = Math.min(lowestFoot, gap); highestFoot = Math.max(highestFoot, gap);
            expect(gap, `${label} ${foot.name} buried sole`).toBeGreaterThan(-.005);
            expect(gap, `${label} ${foot.name} floating sole`).toBeLessThan(.012);
            expect(foot.scale.y, `${label} attached leg`).toBeGreaterThan(.85);
            expect(foot.scale.y, `${label} attached leg`).toBeLessThan(1.15);
          }
          return { animal, label, position: animal.position.clone(), heading: animal.quaternion.clone() };
        });
        wildlife.update(time + .04);
        for (const { animal, label, position, heading } of poses) {
          forward.set(1, 0, 0).applyQuaternion(heading); forward.y = 0; forward.normalize();
          velocity.copy(animal.position).sub(position); velocity.y = 0; velocity.normalize();
          expect(forward.dot(velocity), `${label} walks forwards`).toBeGreaterThan(.98);
          expect(heading.angleTo(animal.quaternion), `${label} continuous turn`).toBeLessThan(.07);
        }
      }
      for (const [species, extent] of extents) expect(extent.max - extent.min, `${day} ${species} visible patrol`).toBeGreaterThan(3.18);
      dispose(wildlife.root, art);
    }
    // Baselines in thousandths of a scene unit make changed soles, terrain, or patrols reviewable.
    expect({ lowestFoot: Math.round(lowestFoot * 1000), highestFoot: Math.round(highestFoot * 1000), nearestTrail: Math.round(nearestTrail * 1000) })
      .toEqual({ lowestFoot: -4, highestFoot: 3, nearestTrail: 1321 });
  }, 60_000);
});
