// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSiteMaterial, violationsFromHookPayload } from '../scripts/hook-detect-site-material.mjs';
import { unframedSurfaces } from '../scripts/site-surface-policy.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'app/[lang]/example/example.css';

describe('site materials have one definition and shared scenery tokens', () => {
  it.each(unframedSurfaces.filter(policy => policy.kind === 'scenery-content'))('protects the reviewed transparent section $selector', ({ selector }) => {
    for (const declaration of ['background: var(--glass-surface-bg)', 'border: 1px solid var(--border-default)', 'backdrop-filter: var(--glass-filter)']) {
      expect(scanSiteMaterial(`body[data-site-scenery] :is(${selector}, .other)::before { ${declaration}; }`, PAGE)).toContainEqual(expect.objectContaining({ reason: 'unframed-surface' }));
    }
    // Preserve the ordinary-theme fallback and meaningful child highlights.
    expect(scanSiteMaterial(`${selector} { background: var(--card); } body[data-site-scenery] ${selector} .selected { background: var(--accent-soft); }`, PAGE)).toEqual([]);
  });

  it('keeps every reviewed reading section in the transparent adapter', () => {
    const css = readFileSync(join(ROOT, 'components/site-surfaces.css'), 'utf8');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const { selector } of unframedSurfaces.filter(policy => policy.kind === 'scenery-content')) {
      expect(rules.some(([, selectors, declarations]) => selectors.includes('body[data-site-scenery]')
        && selectors.split(/[\s,()]+/).includes(selector)
        && /background:\s*transparent\s*;/.test(declarations)
        && /backdrop-filter:\s*none\s*;/.test(declarations)), selector).toBe(true);
    }
  });

  it.each([
    '.calendar-page .toolbar',
    'body[data-site-scenery] .calendar-page .toolbar::before',
    '.wca-stats-index-toolbar::after',
    ':is(.sor-race-bar, .unrelated)',
    '.viz-page .toolbar:hover',
    '.sim-header',
  ])('rejects reintroduced layout paint on %s', selector => {
    for (const declaration of ['background: var(--card)', 'background-image: linear-gradient(var(--card), transparent)', 'border: 1px solid var(--border-default)', 'box-shadow: 0 0 4px var(--card)']) {
      expect(scanSiteMaterial(`${selector} { ${declaration}; }`, PAGE)).toContainEqual(expect.objectContaining({ reason: 'unframed-surface' }));
    }
  });

  it('distinguishes decorative heading lines from controls, focus rings and resets', () => {
    expect(scanSiteMaterial('.wca-stats-index-section-header { border-bottom: 1px solid var(--border-default); }', PAGE)).toContainEqual(expect.objectContaining({ reason: 'unframed-surface' }));
    expect(scanSiteMaterial('.wca-stats-index-section-header::after { border-bottom: 1px solid var(--border-default); }', PAGE)).toContainEqual(expect.objectContaining({ reason: 'unframed-surface' }));
    expect(scanSiteMaterial(`
      .calendar-page .toolbar { background: transparent; border: 0; box-shadow: none; }
      .calendar-page .toolbar .region-picker-trigger { background: var(--card); border: 1px solid var(--input); }
      .other:not(.sim-header) { background: var(--card); }
      .other:has(.sim-header) { background: var(--card); }
      .sim-header-button { background: var(--card); }
      .wca-stats-index-section-header { background: var(--accent-soft); }
      .new-toolbar { background: var(--card); border: 1px solid var(--border-default); }
      .sim-header:focus-visible { outline: 2px solid var(--ring); }
      .sim-header { background: var(--card); /* allow-site-material: visual documentation sample */ }
    `, PAGE)).toEqual([]);
  });

  it('rejects a single-property restoration of the old toolbar rectangle', () => {
    const before = '.calendar-page .toolbar::before {\n  background: transparent;\n}';
    const patch = `*** Begin Patch\n*** Update File: core/packages/client/${PAGE}\n@@\n-  background: transparent;\n+  background: var(--glass-surface-bg);\n*** End Patch`;
    expect(violationsFromHookPayload({ tool_input: { command: patch } }, () => before)).toContainEqual(expect.objectContaining({ reason: 'unframed-surface' }));
  });

  it.each([
    '.calendar-page .toolbar',
    'body[data-site-scenery] .calendar-page :is(.calendar, .toolbar)',
    ':where(.sor-race-bar, .shell-topbar):hover',
    '.viz-page .toolbar:has(.wca-pp-results)',
    '.space-top-tools > *',
    '.space-top-tools > .space-row',
  ])('rejects a backdrop root on the menu host %s', selector => {
    for (const property of ['backdrop-filter', '-webkit-backdrop-filter']) {
      const hits = scanSiteMaterial(`${selector} { ${property}: var(--glass-filter); }`, 'components/site-surfaces.css');
      expect(hits).toEqual([expect.objectContaining({ reason: 'menu-backdrop-root' })]);
    }
  });

  it('allows sibling glass, menu glass, unrelated selectors and host resets', () => {
    expect(scanSiteMaterial(`
      .toolbar::before, .space-top-tools > *::before { backdrop-filter: var(--glass-filter); }
      .toolbar .region-picker-popup { backdrop-filter: var(--glass-filter); }
      .toolbar:has(.menu) { backdrop-filter: none !important; }
      .toolbar-button { backdrop-filter: var(--glass-filter); }
      .panel:not(.toolbar) { backdrop-filter: var(--glass-filter); }
    `, PAGE)).toEqual([]);
  });

  it('reconstructs a property-only edit from the original adapted patch', () => {
    const before = '.calendar-page .toolbar {\n  backdrop-filter: none;\n}';
    const patch = `*** Begin Patch\n*** Update File: core/packages/client/${PAGE}\n@@\n-  backdrop-filter: none;\n+  backdrop-filter: var(--glass-filter);\n*** End Patch`;
    expect(violationsFromHookPayload({
      original_tool_input: { command: patch },
      tool_input: { file_path: PAGE, content: '  backdrop-filter: var(--glass-filter);' },
    }, () => before)).toEqual([expect.objectContaining({ reason: 'menu-backdrop-root' })]);
  });

  it('does not block unrelated edits for a pre-existing violation', () => {
    const before = '.toolbar { backdrop-filter: var(--glass-filter); }';
    expect(violationsFromHookPayload({ tool_input: { file_path: `core/packages/client/${PAGE}`, content: `${before}\n.other { display: flex; }` } }, () => before)).toEqual([]);
    expect(violationsFromHookPayload({})).toEqual([]);
  });

  it('keeps layered simulator and OTP inputs transparent', () => {
    const css = readFileSync(join(ROOT, 'components/site-surfaces.css'), 'utf8');
    const transparentCompositeRule = css.match(
      /body\[data-site-scenery\] :is\(([^}]+)\) \{\s*background-color: transparent !important;\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;\s*\}/,
    );

    expect(transparentCompositeRule?.[1]).toContain('.sim-player-hlwrap .sim-player-input--hl');
    expect(transparentCompositeRule?.[1]).toContain('.auth-otp-native');
  });

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
    const battle = readFileSync(join(ROOT, 'app/[lang]/timer/_battle/battle.css'), 'utf8');

    expect(material).toContain('--glass-dialog-bg: color-mix(in srgb, var(--popover) 96%, transparent);');
    expect(timer).toMatch(/body\[data-site-scenery\] \.timer-modal\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(surfaces).toMatch(/body\[data-site-scenery\] \.solver-sheet\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(surfaces).toMatch(/:is\(\s*\.timer-history-compare-modal,\s*\.timer-solve-detail-modal,\s*\.timer-room-dialog\s*\)\s*\{\s*background: var\(--glass-dialog-bg\);/);
    expect(battle).toMatch(/body\[data-site-scenery\] \.ao-detail-panel\s*\{\s*background: var\(--glass-dialog-bg\);/);
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

  it.each(['data-tooltip', 'data-tip', 'title'])('rejects duplicate hover labels from %s in both CI and proposed writes', attribute => {
    const css = `.button::after { content: attr(${attribute}); }`;
    expect(scanSiteMaterial(css, PAGE)).toEqual([expect.objectContaining({ reason: 'tooltip-reimplementation' })]);
    const patch = `*** Begin Patch\n*** Add File: core/packages/client/${PAGE}\n+${css}\n*** End Patch`;
    expect(violationsFromHookPayload({ tool_input: { command: patch } }, () => '')).toEqual(scanSiteMaterial(css, PAGE));
  });

  it('allows unrelated generated labels and explicit material exceptions', () => {
    expect(scanSiteMaterial('.cell::before { content: attr(data-label); }', PAGE)).toEqual([]);
    expect(scanSiteMaterial('.input::before { content: attr(data-placeholder); }', PAGE)).toEqual([]);
    expect(scanSiteMaterial('.sample::after { content: attr(title); /* allow-site-material: educational CSS example */ }', PAGE)).toEqual([]);
  });

  it('reconstructs tooltip declaration edits without blocking unrelated legacy edits', () => {
    const before = '.button::after {\n  content: none;\n}';
    const patch = `*** Begin Patch\n*** Update File: core/packages/client/${PAGE}\n@@\n-  content: none;\n+  content: attr(data-tooltip);\n*** End Patch`;
    expect(violationsFromHookPayload({ original_tool_input: { command: patch } }, () => before)).toEqual([expect.objectContaining({ reason: 'tooltip-reimplementation' })]);
    const legacy = '.button::after { content: attr(data-tip); }';
    expect(violationsFromHookPayload({ tool_input: { file_path: `core/packages/client/${PAGE}`, content: legacy + '\n.other { display: flex; }' } }, () => legacy)).toEqual([]);
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
