import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import DAYS from '@/app/[lang]/dev/architecture/timeline_commits.json';
import { HISTORY_SECRETS } from '@/app/[lang]/dev/architecture/history/history-secrets';
import { buildHistorySecret } from '@/app/[lang]/dev/architecture/history/history-secret-models';
import { PaperScenery, type PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

describe('history scroll secrets', () => {
  it('links six distinct recorded events to existing, bare-path content routes', () => {
    expect(HISTORY_SECRETS.map(({ date, href }) => [date, href])).toEqual([
      ['2026-02-17', '/wca'], ['2026-05-19', '/sim'], ['2026-06-16', '/alg/3x3'],
      ['2026-07-09', '/forum'], ['2026-09-02', '/music'], ['2026-09-05', '/space'],
    ]);
    expect(new Set(HISTORY_SECRETS.map(secret => secret.id)).size).toBe(6);
    expect(new Set(HISTORY_SECRETS.map(secret => secret.day)).size).toBe(6);
    for (const secret of HISTORY_SECRETS) {
      expect(DAYS[secret.day].date).toBe(secret.date);
      expect(secret.zh.length).toBeGreaterThan(0);
      expect(secret.en.length).toBeGreaterThan(0);
      expect(secret.description.zh.length).toBeGreaterThan(0);
      expect(secret.description.en.length).toBeGreaterThan(0);
      const route = secret.href === '/alg/3x3' ? '/alg/[puzzle]' : secret.href;
      expect(existsSync(new URL(`../app/[lang]${route}/page.tsx`, import.meta.url)), secret.href).toBe(true);
    }
    const registry = readFileSync(new URL('../app/[lang]/dev/architecture/history/history-secrets.ts', import.meta.url), 'utf8');
    expect(registry).not.toMatch(/from ['"](?:three|.*history-(?:scenery|secret-models))['"]/);
  });

  it('builds every miniature within its local placement envelope and preserves it when merging', () => {
    for (const secret of HISTORY_SECRETS) {
      const grain = new T.Texture();
      const art = Object.assign(Object.create(PaperScenery.prototype) as PaperScenery, {
        palette, grain, materials: new Map(), textures: new Set([grain]), animations: [],
      });
      const root = new T.Group();
      buildHistorySecret(art, root, secret);
      root.updateMatrixWorld(true);
      expect(root.position.toArray(), secret.id).toEqual([0, 0, 0]);
      expect(root.scale.toArray(), secret.id).toEqual([1, 1, 1]);
      const bounds = new T.Box3().setFromObject(root, true), size = bounds.getSize(new T.Vector3());
      expect(bounds.isEmpty(), secret.id).toBe(false);
      expect(bounds.min.y, secret.id).toBeGreaterThanOrEqual(-.001);
      expect(bounds.max.y, secret.id).toBeLessThanOrEqual(3);
      expect(size.x, secret.id).toBeLessThanOrEqual(2.5);
      expect(size.z, secret.id).toBeLessThanOrEqual(2.5);
      let triangles = 0;
      root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        for (const attribute of ['position', 'normal', 'uv']) {
          const values = object.geometry.getAttribute(attribute);
          expect(values, `${secret.id}: ${attribute}`).toBeDefined();
          expect(Array.from(values.array).every(Number.isFinite), `${secret.id}: ${attribute}`).toBe(true);
        }
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      });
      expect(triangles, secret.id).toBeLessThanOrEqual(12_000);
      art.flatten(root);
      const merged = new T.Box3().setFromObject(root, true);
      expect(merged.min.distanceTo(bounds.min), secret.id).toBeLessThan(.001);
      expect(merged.max.distanceTo(bounds.max), secret.id).toBeLessThan(.001);
      root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
      art.dispose();
    }
  });
});
