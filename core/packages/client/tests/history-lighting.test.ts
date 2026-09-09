import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { HISTORY_LAST, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { groundY, historyDaylight } from '@/app/[lang]/dev/architecture/history/history-environment';
import { PaperLighting } from '@/app/[lang]/dev/architecture/history/history-lighting';
import type { PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';

describe('history daylight', () => {
  it('crosses dawn, noon, dusk and midnight in eight stops and respects route bounds', () => {
    expect([0, 2, 4, 6, 8].map(p => historyDaylight(p).hour)).toEqual([6, 12, 18, 0, 6]);
    expect([0, 2, 4, 6, 8].map(p => historyDaylight(p).phase)).toEqual(['dawn', 'day', 'dusk', 'night', 'dawn']);
    expect(historyDaylight(2).daylight).toBe(1);
    expect(historyDaylight(6).daylight).toBe(0);
    expect(historyDaylight(6).night).toBe(1);
    for (const position of [NaN, Infinity, -1]) expect(historyDaylight(position)).toEqual(historyDaylight(0));
    expect(historyDaylight(HISTORY_LAST + 1)).toEqual(historyDaylight(HISTORY_LAST));
  });

  it('changes light continuously across every date and cycle boundary, including reverse travel', () => {
    for (let position = 0; position <= HISTORY_LAST; position += .25) {
      const before = historyDaylight(position - .00001), after = historyDaylight(position + .00001);
      for (const key of ['daylight', 'night', 'twilight'] as const) {
        expect(after[key] >= 0 && after[key] <= 1).toBe(true);
        expect(Math.abs(after[key] - before[key]) < .0001).toBe(true);
      }
    }
    expect(historyDaylight(100)).toEqual(historyDaylight(108));
  });

  it('reveals stars and moon at night, preserves paper lighting, and releases its resources', () => {
    const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
    const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette & { night: string };
    const lighting = new PaperLighting(palette, palette.night), camera = new T.OrthographicCamera();
    const resources = new Set<T.BufferGeometry | T.Material>();
    lighting.root.traverse(object => {
      if (object instanceof T.Mesh || object instanceof T.Points) { resources.add(object.geometry); resources.add(object.material); }
    });
    let disposed = 0;
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed++));
    lighting.update(2, 0, 'cloudy', camera, false, 1);
    expect(lighting.root.getObjectByName('history-sun')!.visible).toBe(true);
    expect(lighting.root.getObjectByName('history-moon')!.visible).toBe(false);
    expect(lighting.root.getObjectByName('history-stars')!.visible).toBe(false);
    const rim = lighting.root.getObjectByName('history-moon-rim') as T.DirectionalLight;
    const moonHalo = lighting.root.getObjectByName('history-moon-halo') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
    expect(rim.intensity).toBe(0); expect(rim.castShadow).toBe(false);
    expect(moonHalo.visible).toBe(false);
    for (const narrow of [false, true]) {
      lighting.update(6, 0, 'cloudy', camera, narrow, 2);
      expect(lighting.root.getObjectByName('history-sun')!.visible).toBe(false);
      expect(lighting.root.getObjectByName('history-moon')!.visible).toBe(true);
      expect(lighting.root.getObjectByName('history-stars')!.visible).toBe(true);
      expect(lighting.ambient.intensity).toBe(.9);
      expect(rim.intensity).toBeCloseTo(.4536, 10);
      expect(moonHalo.material.uniforms.opacity.value).toBeCloseTo(.1134, 10);
      expect(moonHalo.visible).toBe(true);
      const height = narrow ? 620 : 720, width = narrow ? 390 : 1361;
      const viewHeight = Math.max(38, 30 * height / width);
      camera.left = -viewHeight * width / height / 2; camera.right = -camera.left;
      camera.top = viewHeight / 2; camera.bottom = -camera.top;
      camera.near = .1; camera.far = 150; camera.updateProjectionMatrix();
      for (let position = 0; position <= HISTORY_LAST; position++) {
        const x = position * HISTORY_SPACING, y = groundY(x);
        camera.position.set(x + 7.8, y + 29, 38);
        camera.lookAt(x, y + 3.5, .3); camera.updateMatrixWorld();
        lighting.update(position, 0, 'cloudy', camera, narrow, 1);
        lighting.root.updateMatrixWorld(true);
        for (const name of ['history-sun', 'history-moon']) {
          const body = lighting.root.getObjectByName(name)!;
          if (!body.visible) continue;
          const point = body.getWorldPosition(new T.Vector3()).project(camera);
          expect(Math.abs(point.x) < .8 && point.y > .65 && point.y < .92 && Math.abs(point.z) < 1,
            `${name} stays inside the sky at date ${position}, narrow=${narrow}`).toBe(true);
        }
      }
    }
    for (const position of [0, 8, 6, 99, 0]) lighting.update(position, 1, 'storm', camera, false, 1);
    lighting.dispose();
    expect(disposed).toBe(resources.size);
  });
});
