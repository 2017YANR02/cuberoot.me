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
