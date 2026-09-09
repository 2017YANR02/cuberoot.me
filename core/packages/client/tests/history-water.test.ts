import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { HISTORY_LAST, HISTORY_SPACING } from '@/app/[lang]/dev/architecture/history/history-days';
import { riverZ } from '@/app/[lang]/dev/architecture/history/history-environment';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { buildHistoryLand } from '@/app/[lang]/dev/architecture/history/history-terrain';
import { PaperWater } from '@/app/[lang]/dev/architecture/history/history-water';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

describe('the continuous history river', () => {
  it('joins every date with identical banks, flow coordinates, colors and normals while sharing one material', () => {
    const water = new PaperWater(palette);
    let previous: number[][] | undefined, disposed = 0;
    water.material.addEventListener('dispose', () => disposed++);
    for (let day = 0; day <= HISTORY_LAST; day++) {
      const grain = new T.Texture();
      const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
        palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
      });
      const root = new T.Group();
      buildHistoryLand(art, root, day, water.material);
      const river = root.getObjectByName(`history-river-${day}`) as T.Mesh<T.BufferGeometry>;
      expect(river.material).toBe(water.material);
      const { position, uv, color, normal, riverWidth, riverCenter } = river.geometry.attributes;
      for (const attribute of [position, uv, color, normal, riverWidth, riverCenter]) {
        expect(Array.from(attribute.array).every(Number.isFinite), `finite attributes on day ${day}`).toBe(true);
      }
      // Every cross section stays level; widening a fjord cannot pull the current toward its inlet.
      const sections = new Map<number, { height: number; center: number }>();
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), height = position.getY(i), center = riverCenter.getX(i);
        const section = sections.get(x);
        if (section) {
          if (height !== section.height || center !== section.center) throw new Error(`Warped river cross section at ${x}`);
        } else {
          expect(center).toBe(Math.fround(riverZ(x)));
          sections.set(x, { height, center });
        }
      }
      const start = day === 0 ? -42 : (day - .5) * HISTORY_SPACING;
      const end = day === HISTORY_LAST ? day * HISTORY_SPACING + 42 : (day + .5) * HISTORY_SPACING;
      const edge = (x: number) => {
        const rows = new Map<number, number[]>();
        for (let i = 0; i < position.count; i++) if (position.getX(i) === x) {
          rows.set(uv.getY(i), [position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i),
            riverWidth.getX(i), riverCenter.getX(i), color.getX(i), color.getY(i), color.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i)]);
        }
        return [...rows].sort(([a], [b]) => a - b).map(([, values]) => values);
      };
      const left = edge(start), right = edge(end);
      expect(left.length).toBe(7); expect(right.length).toBe(7);
      if (previous) expect(left, `continuous seam before day ${day}`).toEqual(previous);
      previous = right;
      root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
      art.dispose();
      expect(disposed, 'unloading a passage must not release the shared river').toBe(0);
    }
    water.dispose();
    expect(disposed).toBe(1);
  });

  it('uses the supplied animation clock and reacts to rain, wind and night without allocating new uniforms', () => {
    const water = new PaperWater(palette);
    const shader = { ...T.ShaderLib.standard, uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms) } as Parameters<typeof water.material.onBeforeCompile>[0];
    water.material.onBeforeCompile(shader, {} as T.WebGLRenderer);
    const sky = new T.Color(palette.ice), light = new T.Color(palette.gold);
    const references = { ...shader.uniforms };
    water.update(12, 'storm', 1, sky, light);
    expect(shader.uniforms.riverTime.value).toBe(12);
    expect(shader.uniforms.riverRain.value).toBe(1);
    expect(shader.uniforms.riverWind.value).toBe(1);
    expect(shader.uniforms.riverNight.value).toBe(1);
    expect(shader.uniforms.riverSky.value.equals(sky)).toBe(true);
    for (const [weather, rain, wind] of [['monsoon', 1, 1], ['sunshower', .4, .12], ['frost', 0, .12], ['seaFog', 0, .12], ['heatHaze', 0, .12]] as const) {
      water.update(12, weather, 0, sky, light);
      expect(shader.uniforms.riverRain.value).toBe(rain);
      expect(shader.uniforms.riverWind.value).toBe(wind);
    }
    water.update(12, 'cloudy', 0, sky, light);
    expect(shader.uniforms.riverTime.value).toBe(12);
    expect(shader.uniforms.riverRain.value).toBe(0);
    expect(shader.uniforms.riverNight.value).toBe(0);
    for (const key of Object.keys(references)) expect(shader.uniforms[key]).toBe(references[key]);
    for (const time of [-1, NaN, Infinity]) {
      water.update(time, 'drizzle', 0, sky, light);
      expect(shader.uniforms.riverTime.value).toBe(0);
      expect(shader.uniforms.riverRain.value).toBe(.4);
    }
    water.dispose();
  });
});
