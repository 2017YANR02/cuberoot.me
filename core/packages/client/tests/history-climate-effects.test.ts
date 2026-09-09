import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { PaperClimateEffects } from '@/app/[lang]/dev/architecture/history/history-climate-effects';
import { HISTORY_LAST, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { groundY, WEATHER_LABELS, type JourneyWeather } from '@/app/[lang]/dev/architecture/history/history-environment';
import { PaperLighting } from '@/app/[lang]/dev/architecture/history/history-lighting';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette & { night: string };
function paper() {
  const grain = new T.Texture();
  return Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
    palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
  });
}
function shaders(root: T.Object3D) {
  const found = new Set<T.ShaderMaterial>();
  root.traverse(object => {
    if ((object instanceof T.Mesh || object instanceof T.Points) && object.material instanceof T.ShaderMaterial) found.add(object.material);
  });
  return [...found];
}

describe('the auxiliary paper climates', () => {
  it('switches distinct effects, uses fewer mobile particles, and keeps all live geometry finite at route boundaries', () => {
    const art = paper(), climate = new PaperClimateEffects(art, false);
    const visibleFor: Partial<Record<JourneyWeather, string>> = {
      seaFog: 'history-sea-fog', heatHaze: 'history-heat-haze', frost: 'history-frost',
      diamondDust: 'history-diamond-dust', pollen: 'history-pollen',
    };
    for (const weather of Object.keys(WEATHER_LABELS) as JourneyWeather[]) {
      climate.update(0, 2, weather, false, 1, false);
      expect(climate.root.children.filter(child => child.visible).map(child => child.name), weather).toEqual(visibleFor[weather] ? [visibleFor[weather]] : []);
    }
    const dust = climate.root.getObjectByName('history-diamond-dust') as T.Points;
    const pollen = climate.root.getObjectByName('history-pollen') as T.Points;
    climate.update(0, 2, 'pollen', false, 1, false);
    expect([dust.geometry.drawRange.count, pollen.geometry.drawRange.count]).toEqual([86, 34]);
    climate.update(0, 2, 'pollen', false, 2, true);
    expect([dust.geometry.drawRange.count, pollen.geometry.drawRange.count]).toEqual([52, 20]);
    for (const position of [NaN, Infinity, -12, 0, .49, .51, 5.6, HISTORY_LAST, HISTORY_LAST + 5]) {
      climate.update(Infinity, position, 'frost', false, NaN, false);
      climate.root.updateMatrixWorld(true);
      expect(climate.root.position.toArray().every(Number.isFinite)).toBe(true);
      const bounds = new T.Box3().setFromObject(climate.root, true);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      climate.root.traverse(object => {
        if (!(object instanceof T.Mesh || object instanceof T.Points)) return;
        for (const attribute of Object.values((object.geometry as T.BufferGeometry).attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
        if (object instanceof T.InstancedMesh) expect([...object.instanceMatrix.array].every(Number.isFinite)).toBe(true);
      });
      for (const material of shaders(climate.root)) {
        for (const uniform of Object.values(material.uniforms)) {
          if (typeof uniform.value === 'number') expect(Number.isFinite(uniform.value)).toBe(true);
        }
      }
    }
    climate.dispose(); art.dispose();
  });

  it('holds every animated shader during reduced motion and resumes without replaying the paused interval', () => {
    const art = paper(), climate = new PaperClimateEffects(art, false);
    climate.update(0, 2, 'diamondDust', true, 1, false);
    climate.update(.08, 2, 'diamondDust', true, 1, false);
    const materials = shaders(climate.root);
    expect(materials.every(material => material.uniforms.time.value === .08)).toBe(true);
    climate.update(1, 2, 'diamondDust', false, 1, false);
    climate.update(22, 2, 'seaFog', false, 1, false);
    expect(materials.every(material => material.uniforms.time.value === .08)).toBe(true);
    expect(climate.root.getObjectByName('history-sea-fog')!.visible).toBe(true);
    climate.update(22.05, 2, 'heatHaze', true, 1, false);
    for (const material of materials) expect(material.uniforms.time.value).toBeCloseTo(.13, 8);
    climate.dispose(); art.dispose();
  });

  it('anchors frost crystals to the same bank points through forward, reverse and date-boundary travel', () => {
    const art = paper(), climate = new PaperClimateEffects(art, false), followingWeather = new T.Group();
    followingWeather.add(climate.root);
    const crystals = climate.root.getObjectByName('history-ground-crystals') as T.InstancedMesh;
    const matrix = new T.Matrix4(), point = new T.Vector3();
    const sample = (position: number) => {
      const x = position * HISTORY_SPACING;
      followingWeather.position.set(x, groundY(x), 0);
      climate.update(0, position, 'frost', false, 1, false);
      climate.root.position.sub(followingWeather.position);
      followingWeather.updateMatrixWorld(true);
      const found = new Map<number, number[]>();
      for (let i = 0; i < crystals.count; i++) {
        crystals.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix).applyMatrix4(crystals.matrixWorld);
        found.set(point.x, [point.y, point.z]);
        // The front bank is groundY(x) - .03; the shallow crystal remains directly on it.
        expect(point.y - (groundY(point.x) - .03)).toBeCloseTo(.007, 4);
      }
      return found;
    };
    const before = sample(5.2);
    for (const position of [5.49, 5.51, 5.4, 4.9]) {
      const after = sample(position);
      let common = 0;
      for (const [x, value] of before) {
        const found = after.get(x);
        if (!found) continue;
        common++;
        expect(found[0]).toBeCloseTo(value[0], 8); expect(found[1]).toBeCloseTo(value[1], 8);
      }
      expect(common).toBeGreaterThanOrEqual(36);
    }
    climate.dispose(); art.dispose();
  });

  it('disposes geometry, materials and instance buffers once without taking ownership of the scenery palette resources', () => {
    const art = paper(), borrowed = art.material(palette.paper), parent = new T.Group();
    const climate = new PaperClimateEffects(art, false); parent.add(climate.root);
    const resources = new Set<T.BufferGeometry | T.Material>(), events = new Map<object, number>();
    climate.root.traverse(object => {
      if (!(object instanceof T.Mesh || object instanceof T.Points)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    });
    for (const resource of [...resources, borrowed, art.grain]) {
      events.set(resource, 0); resource.addEventListener('dispose', () => events.set(resource, events.get(resource)! + 1));
    }
    const crystals = climate.root.getObjectByName('history-ground-crystals') as T.InstancedMesh;
    let instanceDisposals = 0;
    crystals.addEventListener('dispose', () => instanceDisposals++);
    climate.dispose(); climate.dispose(); climate.update(10, 0, 'frost', true, 1, false);
    expect(instanceDisposals).toBe(1); expect(parent.children).toHaveLength(0); expect(climate.root.children).toHaveLength(0);
    for (const resource of resources) expect(events.get(resource)).toBe(1);
    expect(events.get(borrowed)).toBe(0); expect(events.get(art.grain)).toBe(0);
    art.dispose();
    expect(events.get(borrowed)).toBe(1); expect(events.get(art.grain)).toBe(1);
  });
});

describe('weather pigment in the paper daylight', () => {
  it('distinguishes cool downpours, maritime mist and warm desert light without losing the sunshower or readable moonlight', () => {
    const lighting = new PaperLighting(palette, palette.night), camera = new T.OrthographicCamera(-25, 25, 19, -19, .1, 150);
    camera.position.set(7.8, 29, 38); camera.lookAt(0, 3.5, .3); camera.updateMatrixWorld();
    const sample = (weather: JourneyWeather, position = 2) => {
      lighting.update(position, 0, weather, camera, false, 1);
      return { color: lighting.horizonColor.clone(), sun: lighting.sun.intensity, ambient: lighting.ambient.intensity };
    };
    const clear = sample('clear'), storm = sample('storm'), monsoon = sample('monsoon');
    const heat = sample('heatHaze'), mist = sample('seaFog'), frost = sample('frost'), sunshower = sample('sunshower');
    expect(storm.sun).toBeLessThan(clear.sun * .7); expect(monsoon.sun).toBeLessThan(storm.sun);
    expect(heat.color.r / heat.color.b).toBeGreaterThan(mist.color.r / mist.color.b);
    expect(frost.color.b / frost.color.r).toBeGreaterThan(clear.color.b / clear.color.r);
    expect(sunshower.sun).toBeGreaterThan(storm.sun);
    expect(lighting.root.getObjectByName('history-sun')!.visible).toBe(true);
    for (const weather of Object.keys(WEATHER_LABELS) as JourneyWeather[]) {
      const dark = sample(weather, 6);
      expect(dark.ambient).toBe(.9); expect(dark.sun).toBeGreaterThan(.35);
      expect(dark.color.r + dark.color.g + dark.color.b).toBeLessThan(sample(weather, 2).color.toArray().reduce((sum, channel) => sum + channel, 0));
      const before = sample(weather, 8 - .000001), after = sample(weather, 8 + .000001);
      expect(before.color.toArray().every((channel, i) => Math.abs(channel - after.color.toArray()[i]) < .0001), weather).toBe(true);
      expect(Math.abs(before.sun - after.sun), weather).toBeLessThan(.0001);
    }
    lighting.dispose();
  });
});
