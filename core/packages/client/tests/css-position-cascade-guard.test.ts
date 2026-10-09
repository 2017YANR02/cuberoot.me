// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inScope, positionViolationsFromHookPayload, scanCssPosition, type Source } from '../scripts/css-position-guard.mts';
import { workspaceFixturePath } from './workspace-fixture-path';

const ROOT = resolve(import.meta.dirname, '..');
const REPO = resolve(ROOT, '../../..');
const CSS = join(ROOT, 'components/position-probe.css');
const JSX = join(ROOT, 'components/PositionProbe.tsx');
const source = (filePath: string, content: string): Source => ({ filePath, content });
const defaults = source(join(ROOT, 'components/training-settings.css'), `
  .settings-popover { position: relative; }
  .settings-popover-panel { position: absolute; right: 0; top: 100%; }
`);
const usage = source(JSX, '<SettingsPopover className="trainer-opts trainer-opts--top" panelClassName="trainer-panel" />');
const sources = [defaults, usage];

describe('CSS position cascade guard', () => {
  it('catches the trainer regression regardless of stylesheet ordering', () => {
    const css = source(CSS, '.trainer-opts--top { position: absolute; left: 50%; top: 50%; }');
    for (const entries of [[...sources, css], [css, ...sources]]) {
      expect(scanCssPosition(entries).map(hit => hit.kind)).toEqual(['shared-position']);
    }
    expect(scanCssPosition([...sources, source(CSS, `
      .settings-popover.trainer-opts--top { position: absolute; left: 50%; top: 50%; }
      @media (max-width: 768px) {
        .settings-popover.trainer-opts--top { position: relative; left: auto; top: auto; transform: none; }
      }
    `)])).toEqual([]);
  });

  it('recognizes aliased control imports, panel props and native shared-class markup', () => {
    const jsx = source(JSX, `
      import { SettingsPopover as Options } from '@/components/TrainingSettings';
      <Options panelClassName="panel-role" />
      <button className="clear-btn clear-btn--standalone remove-role" />
    `);
    const shared = source(CSS, '.clear-btn { position: absolute; top: 50%; } .clear-btn--standalone { position: static; transform: none; }');
    const css = source(join(ROOT, 'components/probe.css'), '.panel-role { top: 50%; } .remove-role { position: absolute; }');
    expect(scanCssPosition([defaults, jsx, shared, css]).map(hit => hit.selector)).toEqual(['.panel-role', '.remove-role']);
  });

  it('requires offsets to be explicit when switching into relative positioning', () => {
    const css = '.tool { position: absolute; left: 50%; top: 30px; transform: translateX(-50%); }';
    expect(scanCssPosition([source(CSS, css + '@media screen { .tool { position: relative; } }')])
      .map(hit => hit.detail)).toEqual(['从 absolute/fixed 切到 relative 时需显式重置 left, top, transform；偏移用 auto，transform/translate 用 none。static 下未生效的 inset 不报错。']);
    expect(scanCssPosition([source(CSS, css + '@media screen { .tool { position: relative; inset: auto; transform: none; } }')])).toEqual([]);
  });

  it('does not call inert static offsets a bug, but catches a remaining transform', () => {
    expect(scanCssPosition([source(CSS, '.tool { position: absolute; left: 50%; } .tool { position: static; }')])).toEqual([]);
    expect(scanCssPosition([source(CSS, '.tool { position: fixed; transform: translateX(-50%); } .tool { position: static; }')])
      .map(hit => hit.kind)).toEqual(['position-reset']);
  });

  it('requires a local reason for exceptions and does not exempt neighboring rules', () => {
    expect(scanCssPosition([...sources, source(CSS, '.trainer-opts--top { position: absolute; /* allow-css-position: isolated embedded host owns cascade */ }')])).toEqual([]);
    for (const css of [
      '.trainer-opts--top { position: absolute; /* allow-css-position: */ }',
      '.other { /* allow-css-position: isolated widget */ } .trainer-opts--top { position: absolute; }',
      '/* allow-css-position: unrelated preceding comment */ .trainer-opts--top { position: absolute; }',
    ]) expect(scanCssPosition([...sources, source(CSS, css)])).toHaveLength(1);
  });

  it('reconstructs one-line changes in complete CSS and checks all files of a patch', () => {
    const before = '.trainer-opts--top {\n  color: inherit;\n}\n';
    const patch = `*** Begin Patch\n*** Update File: ${CSS}\n@@\n-  color: inherit;\n+  position: absolute;\n*** End Patch`;
    expect(positionViolationsFromHookPayload({ original_tool_input: { command: patch }, tool_input: { file_path: CSS, content: 'position: absolute;' } }, [...sources, source(CSS, before)])).toHaveLength(1);
    const multiPatch = patch.replace('*** End Patch', `*** Update File: ${JSX}\n@@\n-${usage.content}\n+<div />\n*** End Patch`);
    expect(positionViolationsFromHookPayload({ tool_input: { command: multiPatch } }, [...sources, source(CSS, before)])).toEqual([]);
  });

  it('checks JSX-only adoption of a role defined in an unchanged stylesheet', () => {
    const patch = `*** Begin Patch\n*** Add File: ${JSX}\n+${usage.content}\n*** End Patch`;
    expect(positionViolationsFromHookPayload({ tool_input: { command: patch } }, [defaults, source(CSS, '.trainer-opts--top { position: absolute; }')])).toHaveLength(1);
  });

  it('uses the payload cwd and fails open for unmatched patches and missing inputs', () => {
    const patch = '*** Begin Patch\n*** Add File: packages/client/components/position-probe.css\n+.trainer-opts--top { position: absolute; }\n*** End Patch';
    expect(positionViolationsFromHookPayload({ cwd: join(REPO, 'core'), tool_input: { command: patch } }, sources)).toHaveLength(1);
    expect(positionViolationsFromHookPayload({ tool_input: { command: patch.replace('Add File', 'Update File') } }, sources)).toEqual([]);
    for (const payload of [{}, { tool_input: null }, { tool_input: { file_path: CSS, new_string: 'position: absolute;' } }]) {
      expect(positionViolationsFromHookPayload(payload, sources)).toEqual([]);
    }
  });

  it('keeps fixtures and generated source outside the scope', () => {
    expect(inScope('C:\\repo\\core\\packages\\client\\components\\input.css')).toBe(true);
    for (const filePath of [join(ROOT, 'tests/fixture.css'), join(ROOT, 'components/example.test.tsx'), join(ROOT, '.next/output.css')]) {
      expect(inScope(filePath)).toBe(false);
    }
  });

  it('scans all active Web/shared UI source with no remaining violations', () => {
    const dirs = [join(ROOT, 'app'), join(ROOT, 'components'),
      ...['@cuberoot/app-ui', '@cuberoot/timer-ui', '@cuberoot/shared'].map(name => workspaceFixturePath(name, 'src'))];
    const all = dirs.flatMap(dir => readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .map(entry => join(dir, entry)).filter(inScope)
      .map(filePath => source(filePath, readFileSync(filePath, 'utf8'))));
    expect(all.filter(file => file.filePath.endsWith('.css')).length).toBeGreaterThan(400);
    expect(scanCssPosition(all), 'Scope a shared-control override with its base class; reset offsets when changing positioning.').toEqual([]);
  });
});
