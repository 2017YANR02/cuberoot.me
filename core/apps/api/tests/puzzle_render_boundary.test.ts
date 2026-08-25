import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('non-cube render boundary', () => {
  it('uses the shared headless core as the only iso implementation', () => {
    const route = readFileSync(resolve(ROOT, 'src/routes/cube.ts'), 'utf8');
    const isoStart = route.indexOf("if (v === 'iso')");
    const topStart = route.indexOf('const svg = await renderSrPuzzlegenSVG', isoStart);
    const isoBranch = route.slice(isoStart, topStart);

    expect(route).toContain("from '@cuberoot/puzzle-render-core/iso-svg'");
    expect(isoStart).toBeGreaterThan(-1);
    expect(topStart).toBeGreaterThan(isoStart);
    expect(isoBranch).toContain('renderPuzzleIsoSvg(');
    expect(isoBranch).not.toContain('renderSrPuzzlegenSVG(');
    expect(isoBranch).toContain('Server-side engine render failed');
  });

  it('keeps the legacy renderer limited to the distinct top-view contract', () => {
    const source = readFileSync(resolve(ROOT, 'src/routes/sr_render.ts'), 'utf8');

    expect(source).toContain("type Variant = 'top';");
    expect(source).toContain("if (puzzle === 'megaminx') return 'megaminx-top';");
    expect(source).not.toContain("return 'megaminx';");
    expect(source).not.toContain("return 'skewb';");
  });
});
