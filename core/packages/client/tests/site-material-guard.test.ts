// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSiteMaterial, violationsFromHookPayload } from '../scripts/hook-detect-site-material.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'app/[lang]/example/example.css';

describe('site materials have one definition and shared scenery tokens', () => {
  it.each([
    'background: var(--popover)',
    'background-color: #222',
    'background: color-mix(in srgb, var(--card) 90%, transparent)',
    'backdrop-filter: blur(20px)',
    '-webkit-backdrop-filter: blur(20px)',
  ])('rejects a page-specific material: %s', (declaration) => {
    expect(scanSiteMaterial(`@media screen { body[data-site-scenery] .menu { ${declaration}; } }`, PAGE)).toHaveLength(1);
  });

  it('rejects duplicate material definitions even outside scenery selectors', () => {
    expect(scanSiteMaterial('.page { --glass-popover-bg: transparent; --glass-new-material: red; }', PAGE)).toHaveLength(2);
    expect(scanSiteMaterial(':root { --glass-popover-bg: transparent; }', 'components/glass-material.css')).toEqual([]);
  });

  it('allows token consumers, semantic accents, unframed content, and regular non-scenery fills', () => {
    expect(scanSiteMaterial(`
      body[data-site-scenery] .panel { background: var(--glass-surface-bg); backdrop-filter: var(--glass-filter); }
      body[data-site-scenery] .menu { background: var(--glass-popover-bg); }
      body[data-site-scenery] .content { background: transparent; backdrop-filter: none; }
      body[data-site-scenery] .active { background: var(--accent-soft); }
      .menu { background: var(--popover); }
    `, PAGE)).toEqual([]);
  });

  it('keeps the existing diagnostic and homepage accessibility exceptions narrow', () => {
    expect(scanSiteMaterial('.page { --glass-filter: blur(6px) !important; }', 'components/scroll-diagnostics.css')).toEqual([]);
    expect(scanSiteMaterial('.page { --glass-filter: blur(8px) !important; }', 'components/scroll-diagnostics.css')).toHaveLength(1);
    expect(scanSiteMaterial('.page { --glass-filter: none; --glass-background: var(--card); }', 'app/[lang]/home-background.css')).toEqual([]);
  });

  it('keeps timer dialogs on the shared high-opacity reading layer', () => {
    const material = readFileSync(join(ROOT, 'components/glass-material.css'), 'utf8');
    const surfaces = readFileSync(join(ROOT, 'components/site-surfaces.css'), 'utf8');
    const timer = readFileSync(join(ROOT, 'app/[lang]/timer/timer.css'), 'utf8');
    const net = readFileSync(join(ROOT, 'app/[lang]/timer/_shell/net.css'), 'utf8');
    const battle = readFileSync(join(ROOT, 'app/[lang]/timer/_battle/battle.css'), 'utf8');

    expect(material).toContain('--glass-dialog-bg: color-mix(in srgb, var(--popover) 96%, transparent);');
    expect(timer).toMatch(/body\[data-site-scenery\] \.timer-modal\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(surfaces).toMatch(/body\[data-site-scenery\] \.solver-sheet\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(surfaces).toMatch(/:is\(\s*\.timer-history-compare-modal,\s*\.timer-solve-detail-modal\s*\)\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(net).toMatch(/body\[data-site-scenery\] \.net-stats-panel\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(battle).toMatch(/:is\(\s*\.settings-panel,\s*\.round-modal,\s*\.ao-detail-panel\s*\)\s*\{\s*background: var\(--glass-dialog-bg\);/);
  });

  it('requires a reason on the same declaration line for intentional exceptions', () => {
    expect(scanSiteMaterial('body[data-site-scenery] .swatch { background: #222; /* allow-site-material: exact color sample */ }', PAGE)).toEqual([]);
    expect(scanSiteMaterial('body[data-site-scenery] .menu { background: #222; /* allow-site-material: */ }', PAGE)).toHaveLength(1);
    expect(scanSiteMaterial('/* allow-site-material: unrelated sample */\nbody[data-site-scenery] .menu { background: #222; }', PAGE)).toHaveLength(1);
  });

  it('normalizes write payloads and ignores out-of-scope sources', () => {
    const content = 'body[data-site-scenery] .menu { background: var(--popover); }';
    expect(violationsFromHookPayload({ tool_input: { file_path: `D:\\cube\\cuberoot.me\\core\\packages\\client\\${PAGE}`, edits: [{ new_string: content }] } })).toHaveLength(1);
    expect(scanSiteMaterial(content, 'tests/fixture.css')).toEqual([]);
    expect(scanSiteMaterial('backdrop-filter: blur(20px);', PAGE)).toEqual([]); // Fragment lacks selector; CI checks the full file.
  });

  it('finds no unreviewed material overrides across all client CSS', () => {
    const violations = [];
    for (const dir of ['app', 'components']) {
      for (const file of readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('.css'))) {
        const path = `${dir}/${file}`;
        for (const hit of scanSiteMaterial(readFileSync(join(ROOT, path), 'utf8'), path)) violations.push({ path, ...hit });
      }
    }
    expect(violations).toEqual([]);
  });
});
