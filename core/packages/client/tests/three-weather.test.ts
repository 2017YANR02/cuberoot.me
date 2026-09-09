import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { debrisFlowSample, precipitationGeometry } from '@/lib/three-weather';
import { HISTORY_PLACES, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { environmentBlend, groundY, historyDaylight, HISTORY_ENVIRONMENTS, journeyWeather, LANDFORM_WEATHER, pathY, pathZ, riverZ, WEATHER_LABELS } from '@/app/[lang]/dev/architecture/history/history-environment';
import { HISTORY_LANDFORMS, LANDFORMS, type HistoryLandform } from '@/app/[lang]/dev/architecture/history/history-landforms';
import { PaperWeather } from '@/app/[lang]/dev/architecture/history/history-weather';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';

describe('shared weather motion', () => {
  it('uses reproducible independent seeds without disturbing Three’s random stream', () => {
    THREE.MathUtils.seededRandom(123);
    const expected = THREE.MathUtils.seededRandom();
    THREE.MathUtils.seededRandom(123);
    const a = precipitationGeometry(3), b = precipitationGeometry(3);
    expect(THREE.MathUtils.seededRandom()).toBe(expected);
    expect(a.getAttribute('position').count).toBe(3);
    expect(Array.from(a.getAttribute('seed').array).slice(0, 4)).toEqual([0.05861229822039604, 0.8740885853767395, 0.5498812198638916, 0.2580598294734955]);
    expect(a.getAttribute('seed').array).toEqual(b.getAttribute('seed').array);
    a.dispose(); b.dispose();
  });

  it('bounds particle allocations and supports an empty effect', () => {
    for (const count of [-1, .5, NaN, Infinity, 24_001]) expect(() => precipitationGeometry(count)).toThrow(RangeError);
    for (const count of [0, 24_000]) {
      const geometry = precipitationGeometry(count);
      expect(geometry.getAttribute('seed').count).toBe(count); geometry.dispose();
    }
  });

  it('preserves the existing space rock trajectory when scaled back to its ravine', () => {
    for (const [index, elapsed] of [[0, 0], [4, 19.25], [27, 600]]) {
      const t = (index * .61803398875 + elapsed * .045) % 1;
      const point = debrisFlowSample(index, elapsed);
      const originalX = -42 + Math.sin(t * 5) * 3 + Math.sin(index * 3.1) * 5 * (.45 + t * .75);
      expect(-42 + point.x * 15).toBeCloseTo(originalX, 12);
      expect(point.y * 18 + .7).toBe((1 - t) ** 3 * 18 + .7);
      expect(-20 + point.z * 75).toBe(-20 + t * 75);
    }
    for (const [index, elapsed] of [[-1, 1], [.5, 1], [0, NaN], [0, -1], [0, Infinity]]) expect(() => debrisFlowSample(index, elapsed)).toThrow(RangeError);
  });
});

describe('continuous history terrain', () => {
  it('anchors each rainbow to its landscape while the traveler crosses dates, including reverse seeks', () => {
    const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
    const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;
    // Weather needs palette mixing only; no DOM or WebGL renderer is needed to verify world transforms.
    const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, { palette });
    const weather = new PaperWeather(art, false);
    const day = HISTORY_PLACES.findIndex(place => place.date === '2026-09-02');
    const expected = [day * HISTORY_SPACING + 2, groundY(day * HISTORY_SPACING) + 3, -13];
    for (const offset of [0, .25, .51, .9, 1.25, -.25, 0]) {
      weather.update(4, day + offset, 0, false, 1, false);
      weather.root.updateMatrixWorld(true);
      const rainbow = weather.root.getObjectByName('rainbow-2026-09-02')!;
      expect(rainbow, `rainbow missing at ${offset}`).toBeDefined();
      rainbow.getWorldPosition(new THREE.Vector3()).toArray().forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 10));
      expect(weather.root.children.filter(child => child.name.startsWith('rainbow-')).length <= 5).toBe(true);
    }
    weather.update(4, 0, 0, false, 1, true);
    expect(weather.root.getObjectByName('rainbow-2026-09-02')).toBeUndefined();
    weather.dispose();
  });

  it('gives every landform four to six distinct localized choices and every date the correct catalog', () => {
    expect(HISTORY_ENVIRONMENTS.length).toBe(HISTORY_PLACES.length);
    expect(Object.keys(LANDFORM_WEATHER).sort()).toEqual(Object.keys(LANDFORMS).sort());
    expect(Object.keys(WEATHER_LABELS).length).toBe(24);
    const seen = new Set<string>();
    HISTORY_ENVIRONMENTS.forEach((environment, i) => {
      const choices = environment.weather;
      expect([4, 5, 6]).toContain(choices.length);
      expect(new Set(choices).size).toBe(choices.length);
      expect([...choices].sort()).toEqual([...LANDFORM_WEATHER[HISTORY_LANDFORMS[i]]].sort());
      environment.weather.forEach((weather, variant) => {
        seen.add(weather);
        expect(journeyWeather(i, variant)).toBe(weather);
        for (const cycles of [1, 2, 3]) expect(journeyWeather(i, variant + choices.length * cycles)).toBe(weather);
        expect(journeyWeather(i, variant + .99)).toBe(weather);
        expect(WEATHER_LABELS[weather].zh.length > 0 && WEATHER_LABELS[weather].en.length > 0).toBe(true);
      });
    });
    expect([...seen].sort()).toEqual(Object.keys(WEATHER_LABELS).sort());
  });

  it('shows all 24 effects by default, rotates repeat landscapes, and reserves auroras for night', () => {
    const defaults = HISTORY_PLACES.map((_, i) => journeyWeather(i, 0));
    expect([...new Set(defaults)].sort()).toEqual(Object.keys(WEATHER_LABELS).sort());
    for (const id of Object.keys(LANDFORMS) as HistoryLandform[]) {
      const weather = defaults.filter((_, i) => HISTORY_LANDFORMS[i] === id);
      expect(new Set(weather).size > 1, `${id} needs changing default weather`).toBe(true);
    }
    defaults.forEach((weather, i) => {
      if (weather === 'aurora') expect(historyDaylight(i).phase).toBe('night');
    });
    expect(defaults[HISTORY_PLACES.findIndex(place => place.date === '2026-09-02')]).toBe('rainbow');
  });

  it('keeps frozen weather out of tropical coasts, savannas, and deserts', () => {
    const warm: HistoryLandform[] = ['atoll', 'lagoon', 'mangrove', 'savanna', 'dunes', 'yardang', 'mesa', 'badlands', 'saltpan', 'oasis'];
    const frozen = new Set(['snow', 'blizzard', 'sleet', 'frost', 'diamondDust', 'aurora']);
    HISTORY_ENVIRONMENTS.forEach((environment, i) => {
      if (warm.includes(HISTORY_LANDFORMS[i])) {
        for (const weather of environment.weather) expect(frozen.has(weather), `${HISTORY_PLACES[i].date}: ${weather}`).toBe(false);
      }
    });
  });

  it('normalizes invalid indices and preserves local cycling across every date boundary', () => {
    HISTORY_ENVIRONMENTS.forEach((environment, i) => {
      for (const variation of [NaN, Infinity, -Infinity, -1, -999, -.5]) expect(journeyWeather(i, variation)).toBe(environment.weather[0]);
      expect(journeyWeather(i, Number.MAX_SAFE_INTEGER)).toBe(environment.weather[Number.MAX_SAFE_INTEGER % environment.weather.length]);
      expect(journeyWeather(i + .49, 0)).toBe(environment.weather[0]);
      const next = Math.min(i + 1, HISTORY_ENVIRONMENTS.length - 1);
      expect(journeyWeather(i + .5, 0)).toBe(HISTORY_ENVIRONMENTS[next].weather[0]);
      for (const variation of [0, 4, 5, 6, 11]) {
        expect(journeyWeather(next, variation)).toBe(HISTORY_ENVIRONMENTS[next].weather[variation % HISTORY_ENVIRONMENTS[next].weather.length]);
      }
    });
    expect(journeyWeather(NaN, Infinity)).toBe('clear');
    for (const position of [NaN, Infinity, -Infinity, -999, -.5]) expect(journeyWeather(position, 0)).toBe('clear');
    expect(journeyWeather(999, -1)).toBe(HISTORY_ENVIRONMENTS.at(-1)!.weather[0]);
    expect(environmentBlend(-1)).toEqual({ left: 0, right: 1, t: 0 });
  });

  it('joins raised terrain without gaps or a jump at any date or transition boundary', () => {
    HISTORY_ENVIRONMENTS.forEach((environment, i) => {
      const x = i * HISTORY_SPACING;
      expect(groundY(x)).toBe(environment.elevation);
      for (const offset of [0, .18, .82, 1]) {
        const edge = x + offset * HISTORY_SPACING;
        for (const sample of [groundY, pathY, pathZ, riverZ]) expect(Math.abs(sample(edge - .0001) - sample(edge + .0001)) < .0001).toBe(true);
      }
    });
    expect(groundY(HISTORY_PLACES.findIndex(day => day.date === '2026-09-05') * HISTORY_SPACING)).toBe(4.5);
    expect(groundY(HISTORY_PLACES.findIndex(day => day.date === '2026-09-02') * HISTORY_SPACING)).toBe(0);
    for (let x = -35; x < HISTORY_PLACES.length * HISTORY_SPACING; x += .7) {
      expect(pathY(x) - groundY(x)).toBeCloseTo(.12, 12);
      expect(pathZ(x) > riverZ(x)).toBe(true);
    }
  });
});
