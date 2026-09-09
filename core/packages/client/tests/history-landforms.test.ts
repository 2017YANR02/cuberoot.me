import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_PLACES, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { HISTORY_ENVIRONMENTS, environmentValue, pathZ, riverZ } from '@/app/[lang]/dev/architecture/history/history-environment';
import { HISTORY_LANDFORMS, LANDFORMS, type HistoryLandform } from '@/app/[lang]/dev/architecture/history/history-landforms';
import { LANDFORM_BUILDERS } from '@/app/[lang]/dev/architecture/history/history-landform-builders';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { buildDayTerrain, historyRidgeHeight, historyRiverEdge } from '@/app/[lang]/dev/architecture/history/history-terrain';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

describe('the natural history landscape', () => {
  it('keeps every coast and skyline continuous across passage boundaries and the walking bank dry', () => {
    for (let day = 0; day < HISTORY_PLACES.length; day++) {
      for (const offset of [-14, -11.1, -9.3, 0, 9.3, 11.1, 14]) {
        const x = day * HISTORY_SPACING + offset;
        const far = historyRiverEdge(x, -1), near = historyRiverEdge(x, 1);
        expect(Number.isFinite(far) && Number.isFinite(near)).toBe(true);
        expect(near - far).toBeGreaterThanOrEqual(environmentValue(x, 'water') - 1e-9);
        expect(pathZ(x)).toBeGreaterThan(near);
        expect(riverZ(x)).toBeGreaterThan(far);
        expect(riverZ(x)).toBeLessThan(near);
      }
      if (day === 0) continue;
      const seam = (day - .5) * HISTORY_SPACING;
      for (const side of [-1, 1]) expect(historyRiverEdge(seam - 1e-6, side)).toBeCloseTo(historyRiverEdge(seam + 1e-6, side), 4);
      for (let layer = 0; layer < 3; layer++) expect(historyRidgeHeight(seam - 1e-6, layer)).toBeCloseTo(historyRidgeHeight(seam + 1e-6, layer), 4);
    }
    for (const id of ['atoll', 'lagoon', 'saltpan'] as HistoryLandform[]) {
      const x = HISTORY_LANDFORMS.indexOf(id) * HISTORY_SPACING;
      for (let layer = 0; layer < 3; layer++) expect(historyRidgeHeight(x, layer), `${id}: an open horizon`).toBeLessThan(.3);
    }
  });

  it('supports every model on the same level while replacing the oval plinth with grounded terrain edges', () => {
    for (const id of Object.keys(LANDFORMS) as HistoryLandform[]) {
      const grain = new T.Texture();
      const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
        palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
      });
      const root = new T.Group();
      buildDayTerrain(art, root, HISTORY_LANDFORMS.indexOf(id));
      const shelves: T.Object3D[] = [];
      root.traverse(object => { if (object.name.startsWith('history-exhibit-ground-')) shelves.push(object); });
      expect(shelves.length === 2 || shelves.length === 4, id).toBe(true);
      root.updateMatrixWorld(true);
      const bounds = new T.Box3();
      for (const shelf of shelves) bounds.expandByObject(shelf, true);
      expect(bounds.min.y, id).toBeCloseTo(0, 6);
      expect(bounds.max.y, id).toBeCloseTo(.7, 6);
      expect(bounds.min.x, id).toBeGreaterThan(-14);
      expect(bounds.max.x, id).toBeLessThan(14);
      for (const [x, z] of [[0, -4.4], [-6, -2], [6, -2], [0, 1.2]]) {
        const hits = new T.Raycaster(new T.Vector3(x, 1, z), new T.Vector3(0, -1, 0)).intersectObjects(shelves, true);
        expect(hits[0]?.point.y, `${id}: model support at ${x},${z}`).toBeCloseTo(.7, 5);
      }
      root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
      art.dispose();
    }
  });

  it('places every major landform into the actual dated journey with an explicit builder and bilingual label', () => {
    const ids = Object.keys(LANDFORMS).sort();
    expect(ids.length).toBe(37);
    expect(Object.keys(LANDFORM_BUILDERS).sort()).toEqual(ids);
    expect([...new Set(HISTORY_LANDFORMS)].sort()).toEqual(ids);
    expect(HISTORY_LANDFORMS.length).toBe(HISTORY_PLACES.length);
    expect(new Set(Object.values(LANDFORM_BUILDERS)).size).toBe(ids.length);
    for (const [day, id] of HISTORY_LANDFORMS.entries()) {
      expect(LANDFORMS[id].zh.length).toBeGreaterThan(0);
      expect(LANDFORMS[id].en.length).toBeGreaterThan(0);
      expect(LANDFORMS[id].biome).toBe(HISTORY_PLACES[day].biome);
      if (id === 'atoll' || id === 'lagoon') {
        expect(HISTORY_ENVIRONMENTS[day].weather).not.toContain('sleet');
        expect(HISTORY_ENVIRONMENTS[day].ridge).toBeLessThan(1);
      }
    }
  });

  it('constructs finite, mergeable relief inside each passage, keeping the daily sculpture area clear', () => {
    for (const id of Object.keys(LANDFORMS) as HistoryLandform[]) {
      const grain = new T.Texture();
      const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
        palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
      });
      const root = new T.Group(), day = HISTORY_LANDFORMS.indexOf(id);
      LANDFORM_BUILDERS[id](art, root, day);
      root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(root, true), point = new T.Vector3();
      expect(bounds.isEmpty(), id).toBe(false);
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(-14);
      expect(bounds.max.x, id).toBeLessThanOrEqual(14);
      expect(bounds.max.y, id).toBeLessThanOrEqual(11.5);
      expect(bounds.min.y, id).toBeGreaterThanOrEqual(-.5);
      root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const position = object.geometry.getAttribute('position');
        expect(object.geometry.getAttribute('normal'), id).toBeDefined();
        expect(object.geometry.getAttribute('uv'), id).toBeDefined();
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`${id}: invalid geometry`);
          if (Math.abs(point.x) < 6.5 && point.z > -4.5 && point.z < 2.5 && point.y > 1) {
            throw new Error(`${id}: relief obstructs the central sculpture at ${point.toArray()}`);
          }
        }
      });
      art.flatten(root);
      const merged = new T.Box3().setFromObject(root, true);
      expect(merged.min.distanceTo(bounds.min), id).toBeLessThan(.001);
      expect(merged.max.distanceTo(bounds.max), id).toBeLessThan(.001);
      root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
      art.dispose();
    }
  }, 60_000);

  it('exposes kettle lakes through their ground and gives coastal pools one water surface', () => {
    const cases: { id: HistoryLandform; points: [number, number][] }[] = [
      { id: 'moraine', points: [[-8, -8.4], [7.8, -9.4], [2.1, -7.8]] },
      { id: 'atoll', points: [[0, -9.45], [10.8, -9.45]] },
      { id: 'lagoon', points: [[0, -9.45], [11.6, -10]] },
    ];
    for (const { id, points } of cases) {
      const grain = new T.Texture();
      const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
        palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
      });
      const root = new T.Group();
      LANDFORM_BUILDERS[id](art, root, HISTORY_LANDFORMS.indexOf(id));
      root.updateMatrixWorld(true);
      for (const [x, z] of points) {
        const hits = new T.Raycaster(new T.Vector3(x, 12, z), new T.Vector3(0, -1, 0)).intersectObject(root, true);
        expect(hits.length, `${id}: missing water at ${x},${z}`).toBeGreaterThan(0);
        expect(hits[0].point.y, `${id}: ground covers water at ${x},${z}`).toBeCloseTo(.205, 5);
        const surfaces = new Set(hits.filter(hit => Math.abs(hit.point.y - .205) < .00001).map(hit => hit.object));
        expect(surfaces.size, `${id}: overlapping water at ${x},${z}`).toBe(1);
      }
      root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
      art.dispose();
    }
  });
});
