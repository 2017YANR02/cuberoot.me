import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_GAITS, HISTORY_LAST, HISTORY_SPACING, type HistoryGait } from '@/app/[lang]/dev/architecture/history/history-days';
import { groundY, pathY, pathZ } from '@/app/[lang]/dev/architecture/history/history-environment';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { HISTORY_WALK_SPEED, PaperTraveler } from '@/app/[lang]/dev/architecture/history/history-traveler';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

describe('history traveller beside the selected date', () => {
  let art: PaperScenery, traveler: PaperTraveler;

  beforeEach(() => {
    const grain = new T.Texture();
    art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
      palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
    });
    traveler = new PaperTraveler(art);
  });

  afterEach(() => {
    traveler.root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
    traveler.dispose(); art.dispose();
  });

  it.each([
    { viewport: 'desktop', width: 1024, height: 600, narrow: false },
    { viewport: 'narrow', width: 390, height: 680, narrow: true },
  ])('stays just left of every date on $viewport, including both endpoints', ({ width, height, narrow }) => {
    const viewHeight = Math.max(38, 30 * height / width);
    const camera = new T.OrthographicCamera(-viewHeight * width / height / 2, viewHeight * width / height / 2, viewHeight / 2, -viewHeight / 2, .1, 200);
    for (let day = 0; day <= HISTORY_LAST; day++) {
      const x = day * HISTORY_SPACING, elevation = groundY(x);
      traveler.update(day / 60, day, narrow);
      camera.position.set(x + 7.8, 29 + elevation, 38);
      camera.lookAt(x, 3.5 + elevation, .3); camera.updateMatrixWorld();
      const marker = new T.Vector3(x, pathY(x), pathZ(x)).project(camera);
      const person = traveler.root.position.clone().project(camera);
      expect(person.x, `day ${day} must project to the left of its marker`).toBeLessThan(marker.x);
      expect(traveler.root.position.x, `day ${day} must remain close to its marker`).toBeGreaterThan(x - HISTORY_SPACING / 8);
    }
    traveler.update(4, 0, narrow);
    expect(traveler.root.position.x).toBe(-1.5);
    traveler.update(5, HISTORY_LAST, narrow);
    expect(traveler.root.position.x).toBe(HISTORY_LAST * HISTORY_SPACING - 1.5);
  });

  it('keeps the resting offset when the requested date is clamped', () => {
    for (const position of [-100, NaN, Infinity]) {
      traveler.update(1, position, false);
      expect(traveler.root.position.x).toBe(-1.5);
    }
    traveler.update(2, HISTORY_LAST + 100, false);
    expect(traveler.root.position.x).toBe(HISTORY_LAST * HISTORY_SPACING - 1.5);
  });

  it('preserves forward and backward travel, facing, and the existing walk speed', () => {
    expect(HISTORY_WALK_SPEED).toBe(2.145);
    expect(HISTORY_GAITS.run.speed).toBe(4.29);
    const figure = traveler.root.children.find(object => object instanceof T.Group)!;
    traveler.update(0, 1, false);
    let previous = traveler.root.position.x;
    for (let step = 1; step <= 12; step++) {
      traveler.update(step * .08, 1 + step * .02, false);
      expect(traveler.root.position.x - previous).toBeCloseTo(.56, 10);
      previous = traveler.root.position.x;
    }
    expect(new T.Vector3(0, 0, 1).applyQuaternion(figure.quaternion).x).toBeGreaterThan(.9);
    for (let step = 1; step <= 12; step++) {
      traveler.update((step + 12) * .08, 1.24 - step * .02, false);
      expect(traveler.root.position.x - previous).toBeCloseTo(-.56, 10);
      previous = traveler.root.position.x;
    }
    expect(new T.Vector3(0, 0, 1).applyQuaternion(figure.quaternion).x).toBeLessThan(-.9);
  });

  it.each(['walk', 'run'] as HistoryGait[])('%s keeps shoes above the path and settles both feet when paused', gait => {
    const figure = traveler.root.children.find(object => object instanceof T.Group)!;
    const body = figure.children[0] as T.Group;
    const feet = figure.children.slice(1).map(hip => hip.children.find(child => child instanceof T.Group)!
      .children.find(child => child instanceof T.Group)!);
    let airborneHeight = 0;
    for (let frame = 0; frame <= 180; frame++) {
      traveler.update(frame / 60, 10 + frame / 60 * HISTORY_GAITS[gait].speed / HISTORY_SPACING, false, gait);
      traveler.root.updateMatrixWorld(true);
      const clearance = feet.map(foot => {
        const point = foot.getWorldPosition(new T.Vector3());
        return point.y - .0525 - groundY(point.x);
      });
      expect(Math.min(...clearance)).toBeGreaterThanOrEqual(-.001);
      airborneHeight = Math.max(airborneHeight, Math.min(...clearance));
    }
    if (gait === 'run') {
      expect(airborneHeight).toBeGreaterThan(.1);
      expect(body.rotation.x).toBeGreaterThan(.15);
    } else {
      expect(airborneHeight).toBeLessThan(.03);
      expect(body.rotation.x).toBe(0);
    }
    const pausedPosition = 10 + 3 * HISTORY_GAITS[gait].speed / HISTORY_SPACING;
    const pausedX = traveler.root.position.x;
    for (let frame = 181; frame <= 300; frame++) traveler.update(frame / 60, pausedPosition, false, gait);
    expect(traveler.root.position.x).toBe(pausedX);
    expect(figure.position.y).toBeCloseTo(0, 6);
    expect(body.rotation.x).toBeCloseTo(0, 6);
    traveler.root.updateMatrixWorld(true);
    for (const foot of feet) {
      const point = foot.getWorldPosition(new T.Vector3());
      expect(point.y - .0525 - groundY(point.x)).toBeCloseTo(.0225, 4);
    }
  });
});
