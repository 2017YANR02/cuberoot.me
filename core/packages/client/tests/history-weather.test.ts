import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_LAST, HISTORY_PLACES, HISTORY_SPACING, historyWindow } from '@/app/[lang]/dev/architecture/history/history-days';
import { groundY, HISTORY_ENVIRONMENTS, journeyWeather, WEATHER_LABELS, type JourneyWeather } from '@/app/[lang]/dev/architecture/history/history-environment';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { historyLightningPulse, PaperWeather } from '@/app/[lang]/dev/architecture/history/history-weather';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;
const instances: { art: PaperScenery; weather: PaperWeather }[] = [];

function createWeather(narrow = false) {
  const grain = new T.Texture();
  const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
    palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
  });
  const weather = new PaperWeather(art, narrow);
  instances.push({ art, weather });
  return weather;
}

function example(kind: JourneyWeather, interior = false) {
  const day = HISTORY_ENVIRONMENTS.findIndex((environment, index) =>
    (!interior || index > 0 && index < HISTORY_LAST) && environment.weather.includes(kind));
  if (day < 0) throw new Error(`No authored date offers ${kind}`);
  return { day, variation: HISTORY_ENVIRONMENTS[day].weather.indexOf(kind) };
}

function update(weather: PaperWeather, time: number, day: number, variation: number, animate = true, narrow = false) {
  const result = weather.update(time, day, variation, animate, 2, narrow);
  weather.root.updateMatrixWorld(true);
  return result;
}

afterEach(() => {
  for (const { art, weather } of instances.splice(0)) { weather.dispose(); art.dispose(); }
});

describe('authored history weather', () => {
  it('gives lightning a single readable strike and afterglow, followed by 8.4–10.5 second cycles', () => {
    // Twenty dates cover every combination of the four periods and five onset delays.
    for (let day = 0; day < 20; day++) {
      const period = 8.4 + day % 4 * .7, onset = 1.2 + day % 5 * .13;
      expect(historyLightningPulse(onset - .001, day)).toBe(0);
      expect(historyLightningPulse(onset + .0275, day)).toBeCloseTo(.5, 10);
      expect(historyLightningPulse(onset + .055, day)).toBeCloseTo(1, 10);
      let previous = 1;
      for (const age of [.06, .14, .28, .5, .7]) {
        const strength = historyLightningPulse(onset + age, day);
        expect(strength > 0 && strength < previous).toBe(true);
        previous = strength;
      }
      for (const quiet of [.73, 1, 3, 6, period - .01]) expect(historyLightningPulse(onset + quiet, day)).toBe(0);
      expect(historyLightningPulse(onset + period + .055, day)).toBeCloseTo(1, 10);
      expect(historyLightningPulse(onset + .055, day, false)).toBe(0);
    }
    for (const time of [-1, NaN, Infinity, -Infinity]) expect(historyLightningPulse(time, 0)).toBe(0);
    for (const day of [NaN, Infinity, -Infinity]) expect(historyLightningPulse(1.255, day)).toBe(0);
  });

  it.each(['storm', 'monsoon'] as const)('renders %s lightning as bright branching geometry and respects reduced motion', kind => {
    const weather = createWeather(), { day, variation } = example(kind);
    update(weather, 0, day, variation);
    const onset = 1.2 + day % 5 * .13;
    for (let time = .05; time < onset; time += .05) update(weather, time, day, variation);
    update(weather, onset + .055, day, variation);
    const lightning = weather.root.getObjectByName('history-lightning')!;
    expect(lightning.visible).toBe(true);
    expect(weather.lightningStrength).toBeCloseTo(1, 10);
    let tubes = 0, light = 0, lines = 0;
    lightning.traverseVisible(object => {
      if (object instanceof T.Line) lines++;
      if (object instanceof T.Mesh && object.geometry instanceof T.TubeGeometry) {
        tubes++;
        const material = object.material as T.MeshBasicMaterial;
        expect(material.opacity > 0 && material.toneMapped === false).toBe(true);
      }
      if (object instanceof T.PointLight) light = object.intensity;
    });
    expect(tubes).toBe(6);
    expect(lines).toBe(0);
    expect(light).toBeCloseTo(42, 10);
    update(weather, onset + .3, day, variation);
    expect(weather.lightningStrength > 0 && weather.lightningStrength < 1).toBe(true);
    update(weather, onset + .055, day, variation, false);
    expect(weather.lightningStrength).toBe(0);
    expect(lightning.visible).toBe(false);
  });

  it.each([
    { kind: 'storm', object: 'lightning' },
    { kind: 'monsoon', object: 'lightning' },
    { kind: 'mudslide', object: 'mud' },
    { kind: 'tornado', object: 'funnel' },
  ] as const)('keeps $kind fixed in its date while seeking forward and backward', ({ kind, object }) => {
    const weather = createWeather(), { day, variation } = example(kind, true);
    const group = (weather as unknown as Record<typeof object, T.Group>)[object];
    const positions: T.Vector3[] = [];
    for (const offset of [0, .4, -.4, 0]) {
      expect(update(weather, 2, day + offset, variation)).toBe(kind);
      positions.push(group.getWorldPosition(new T.Vector3()));
    }
    for (const position of positions) expect(position.distanceTo(positions[0])).toBeLessThan(1e-9);
    expect(Math.abs(positions[0].x - day * HISTORY_SPACING)).toBeLessThan(12);
    expect(Math.abs(positions[0].y - groundY(day * HISTORY_SPACING))).toBeLessThan(4);
  });

  it('retains each nearby rainbow in world space and unloads only its clones when the window moves', () => {
    const weather = createWeather(), { day, variation } = example('rainbow', true);
    const name = `rainbow-${HISTORY_PLACES[day].date}`;
    update(weather, 2, day, variation);
    const rainbow = weather.root.getObjectByName(name)!;
    expect(rainbow).toBeDefined();
    const anchor = rainbow.getWorldPosition(new T.Vector3());
    for (const offset of [.4, -.4, 0]) {
      update(weather, 2, day + offset, variation);
      expect(weather.root.getObjectByName(name)).toBe(rainbow);
      expect(rainbow.getWorldPosition(new T.Vector3()).distanceTo(anchor)).toBeLessThan(1e-9);
    }
    const geometry = (rainbow.children[0] as T.Mesh).geometry;
    let disposed = 0;
    geometry.addEventListener('dispose', () => disposed++);
    update(weather, 3, day > HISTORY_LAST / 2 ? 0 : HISTORY_LAST, variation);
    expect(weather.root.getObjectByName(name)).toBeUndefined();
    expect(disposed).toBe(0);
    update(weather, 4, day, variation);
    const replacement = weather.root.getObjectByName(name)!;
    expect((replacement.children[0] as T.Mesh).geometry).toBe(geometry);
    expect(replacement.getWorldPosition(new T.Vector3()).distanceTo(anchor)).toBeLessThan(1e-9);
  });

  it('distinguishes drizzle, rain, storms and monsoon while retaining separate snow, sleet and hail modes', () => {
    const weather = createWeather();
    const particles = weather.root.getObjectByName('history-precipitation') as T.Points<T.BufferGeometry, T.ShaderMaterial>;
    const profile = (kind: JourneyWeather) => {
      const { day, variation } = example(kind);
      update(weather, 2, day, variation, false);
      const uniforms = particles.material.uniforms;
      return {
        count: particles.geometry.drawRange.count, kind: uniforms.kind.value as number,
        amount: uniforms.amount.value as number, speed: uniforms.fallSpeed.value as number,
        wind: uniforms.wind.value as number, size: uniforms.size.value as number,
      };
    };
    const drizzle = profile('drizzle'), rain = profile('rain'), storm = profile('storm'), monsoon = profile('monsoon');
    expect([drizzle.kind, rain.kind, storm.kind, monsoon.kind]).toEqual([0, 0, 0, 0]);
    expect(drizzle.count < rain.count && rain.count < storm.count && storm.count < monsoon.count).toBe(true);
    expect(drizzle.amount < rain.amount && rain.amount < storm.amount).toBe(true);
    expect(drizzle.speed < rain.speed && rain.speed < monsoon.speed).toBe(true);
    expect(drizzle.size < rain.size && rain.size < monsoon.size).toBe(true);
    expect(rain.wind < storm.wind && storm.wind < monsoon.wind).toBe(true);
    const snow = profile('snow'), blizzard = profile('blizzard');
    expect([snow.kind, blizzard.kind, profile('sleet').kind, profile('hail').kind, profile('wind').kind]).toEqual([1, 1, 4, 3, 5]);
    expect(snow.count < blizzard.count && snow.speed < blizzard.speed && snow.wind < blizzard.wind).toBe(true);
    profile('sleet');
    expect(particles.material.uniforms.snowTint.value.equals(new T.Color(palette.snow))).toBe(true);
    expect(particles.material.uniforms.snowTint.value.equals(particles.material.uniforms.tint.value)).toBe(false);
  });

  it.each([[320, 680, 1], [1564, 820, 1], [2560, 800, .75], [1280, 720, 2]])(
    'covers every viewport edge in depth while seeking and resizing (%s x %s, zoom %s)', (width, height, zoom) => {
      const weather = createWeather(width < 700);
      const particles = weather.root.getObjectByName('history-precipitation') as T.Points<T.BufferGeometry, T.ShaderMaterial>;
      const geometry = particles.geometry;
      const viewHeight = Math.max(38, 30 * height / width);
      const camera = new T.OrthographicCamera(-viewHeight * width / height / 2, viewHeight * width / height / 2, viewHeight / 2, -viewHeight / 2, .1, 150);
      for (const position of [0, 95.4, HISTORY_LAST]) {
        update(weather, 2, position, 0, false, width < 700);
        const x = position * HISTORY_SPACING, elevation = groundY(x);
        camera.position.set(x + 7.8, elevation + 29, 38);
        camera.lookAt(x, elevation + 3.5, .3);
        camera.translateY(-2); // Narrow-screen annotation clearance also moves the frustum.
        camera.zoom = zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        weather.fitView(camera);
        const uniforms = particles.material.uniforms;
        const size = uniforms.viewSize.value as T.Vector2;
        const transform = uniforms.viewToLocal.value as T.Matrix4;
        // Both depth layers must cover all four corners; a fixed world-width rain box fails this.
        for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) for (const depth of [-19, 19]) {
          const point = new T.Vector3(horizontal * size.x / 2, vertical * size.y / 2, depth)
            .applyMatrix4(transform).applyMatrix4(weather.root.matrixWorld).project(camera);
          expect(point.x * horizontal).toBeGreaterThan(1);
          expect(point.y * vertical).toBeGreaterThan(1);
          expect(point.z > -1 && point.z < 1).toBe(true);
        }
        expect(particles.geometry).toBe(geometry);
        expect(particles.material.depthTest).toBe(true);
      }
    },
  );

  it.each([false, true])('keeps all 24 weather effects finite, bounded and owned across repeated switches (narrow=%s)', narrow => {
    const weather = createWeather(narrow);
    const particles = weather.root.getObjectByName('history-precipitation') as T.Points<T.BufferGeometry, T.ShaderMaterial>;
    expect(Object.keys(WEATHER_LABELS)).toHaveLength(24);
    expect(particles.geometry.getAttribute('seed').count).toBe(narrow ? 850 : 1600);
    const resources = new Map<T.BufferGeometry | T.Material, number>();
    const collect = () => weather.root.traverse(object => {
      if (!(object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Line)) return;
      const material = Array.isArray(object.material) ? object.material : [object.material];
      for (const resource of [object.geometry, ...material]) if (!resources.has(resource)) {
        resources.set(resource, 0);
        resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource)! + 1));
      }
    });
    let time = 0;
    for (let pass = 0; pass < 2; pass++) for (const kind of Object.keys(WEATHER_LABELS) as JourneyWeather[]) {
      const { day, variation } = example(kind);
      expect(update(weather, time, day, variation, true, narrow)).toBe(kind);
      for (let frame = 1; frame <= 12; frame++) update(weather, time + frame / 20, day, variation, true, narrow);
      time += .6;
      collect();
      expect(Number.isInteger(particles.geometry.drawRange.count)).toBe(true);
      expect(particles.geometry.drawRange.count <= particles.geometry.getAttribute('seed').count).toBe(true);
      expect(particles.material.uniforms.amount.value >= 0 && particles.material.uniforms.amount.value <= 1).toBe(true);
      expect(particles.material.uniforms.time.value).toBe(time);
      const expectedRainbows = historyWindow(day).filter(index => journeyWeather(index, variation) === 'rainbow').length;
      expect(weather.root.children.filter(child => child.name.startsWith('rainbow-'))).toHaveLength(expectedRainbows);
      weather.root.traverseVisible(object => {
        expect(object.matrixWorld.elements.every(Number.isFinite), `${kind}: finite effect transform`).toBe(true);
        if (!(object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Line)) return;
        for (const attribute of Object.values((object.geometry as T.BufferGeometry).attributes)) {
          expect(Array.from(attribute.array).every(Number.isFinite), `${kind}: finite geometry`).toBe(true);
        }
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld);
        expect(box.min.x >= day * HISTORY_SPACING - 90 && box.max.x <= day * HISTORY_SPACING + 90, `${kind}: local effect width`).toBe(true);
        expect(box.min.y >= -8 && box.max.y <= groundY(day * HISTORY_SPACING) + 35, `${kind}: local effect height`).toBe(true);
        expect(box.min.z >= -45 && box.max.z <= 25, `${kind}: local effect depth`).toBe(true);
      });
      const snapshot = () => {
        const transforms: (number | boolean)[][] = [];
        weather.root.traverse(object => {
          transforms.push([object.visible, ...object.matrixWorld.elements]);
          if (object instanceof T.InstancedMesh) transforms.push(Array.from(object.instanceMatrix.array));
        });
        return { transforms, uniforms: JSON.stringify(particles.material.uniforms), flash: weather.lightningStrength };
      };
      const before = snapshot();
      update(weather, time, day, variation, true, narrow);
      expect(snapshot(), `${kind}: the same clock cannot advance or translate an effect`).toEqual(before);
    }
    // The atmospheric owner releases shared prototypes once, after their last streamed clone.
    const instance = instances.pop()!;
    instance.weather.dispose(); instance.art.dispose();
    for (const [resource, count] of resources) expect(count, `${resource.type} released exactly once`).toBe(1);
  });
});
