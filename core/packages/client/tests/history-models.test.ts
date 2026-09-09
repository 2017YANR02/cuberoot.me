import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_PLACES } from '@/app/[lang]/dev/architecture/history/history-days';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { HISTORY_MODELS } from '@/app/[lang]/dev/architecture/history/history-models';
import { EARLY_DESIGNS } from '@/app/[lang]/dev/architecture/history/history-designs-early';
import { MIDDLE_DESIGNS } from '@/app/[lang]/dev/architecture/history/history-designs-middle';
import { LATE_DESIGNS } from '@/app/[lang]/dev/architecture/history/history-designs-late';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

// The renderer alone needs a canvas grain image; actual model construction and merging are pure Three geometry.
function paperArt(): PaperScenery {
  const grain = new T.Texture();
  return Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
    palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
  });
}

function dispose(root: T.Group, art: PaperScenery) {
  const geometries = new Set<T.BufferGeometry>();
  root.traverse(o => { if (o instanceof T.Mesh) geometries.add(o.geometry); });
  geometries.forEach(g => g.dispose()); art.dispose();
}

describe('individually authored history sculptures', () => {
  it('requires one explicit design and independent builder for every additional date', () => {
    const expected = HISTORY_PLACES.filter(place => !place.authored).map(place => place.date);
    const designDates = [EARLY_DESIGNS, MIDDLE_DESIGNS, LATE_DESIGNS].flatMap(part => Object.keys(part));
    expect(designDates.sort()).toEqual(expected);
    expect(Object.keys(HISTORY_MODELS).sort()).toEqual(expected);
    expect(new Set(Object.values(HISTORY_MODELS)).size).toBe(expected.length);
  });

  it('constructs and merges every date, without invalid vertices or duplicate sculpture geometry', () => {
    const fingerprints = new Map<string, string>();
    for (let day = 0; day < HISTORY_PLACES.length; day++) {
      const date = HISTORY_PLACES[day].date, art = paperArt(), root = art.buildLandmark(day);
      try {
        root.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(root, true), size = bounds.getSize(new T.Vector3());
        expect(bounds.isEmpty(), date).toBe(false);
        expect(bounds.min.x, `${date} extends into the preceding date`).toBeGreaterThan(-14);
        expect(bounds.max.x, `${date} extends into the following date`).toBeLessThan(14);
        expect(bounds.max.y, `${date} extends above the framed landscape`).toBeLessThan(14);
        const scale = Math.max(size.x, size.y, size.z), vertices = new Set<string>(), point = new T.Vector3();
        root.traverse(o => {
          if (!(o instanceof T.Mesh)) return;
          const positions = o.geometry.getAttribute('position');
          expect(o.geometry.getAttribute('normal'), `${date} missing normals`).toBeDefined();
          expect(o.geometry.getAttribute('uv'), `${date} missing UVs required by paper grain`).toBeDefined();
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
            if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`${date}: non-finite geometry`);
            point.sub(bounds.min).divideScalar(scale);
            vertices.add(`${Math.round(point.x * 10000)},${Math.round(point.y * 10000)},${Math.round(point.z * 10000)}`);
          }
        });
        // Ignore colour, material, mesh names, date placement, translation and overall scale.
        // This catches copied geometry; the complete contact sheet review also checks visual composition.
        const fingerprint = createHash('sha256').update([...vertices].sort().join(';')).digest('hex');
        expect(fingerprints.get(fingerprint), `${date} duplicates ${fingerprints.get(fingerprint)}`).toBeUndefined();
        fingerprints.set(fingerprint, date);
        art.flatten(root);
        const merged = new T.Box3().setFromObject(root, true);
        expect(merged.min.distanceTo(bounds.min), `${date} moved during merging`).toBeLessThan(.001);
        expect(merged.max.distanceTo(bounds.max), `${date} changed during merging`).toBeLessThan(.001);
      } finally { dispose(root, art); }
    }
    expect(fingerprints.size).toBe(HISTORY_PLACES.length);
  }, 60_000);
});
