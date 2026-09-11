// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanModalDismiss, violationsFromHookPayload } from '../scripts/hook-detect-modal-dismiss.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('modal backdrop dismissal guard', () => {
  it('detects missing wiring, including native dialog layers', () => {
    for (const cls of ['modal-backdrop', 'sim-mask-admin-scrim', 'wca-teacher-dialog-layer']) {
      expect(scanModalDismiss(`<div className="${cls}"><dialog open /></div>`)).toHaveLength(1);
    }
    expect(scanModalDismiss('<div className="foo-overlay"><section role="dialog" /></div>')).toHaveLength(1);
    expect(scanModalDismiss('<div className="modal-backdrop" onClick={undefined} />')).toHaveLength(1);
    expect(scanModalDismiss('<div className="modal-backdrop" {...unrelated} />')).toHaveLength(1);
  });
  it('accepts shared backdrop wiring and existing explicit handlers', () => {
    for (const hook of ['useModalDismiss', 'useModalBackdrop']) {
      expect(scanModalDismiss(`const props = ${hook}(close, busy); <div className="modal-backdrop" {...props} />`)).toEqual([]);
    }
    expect(scanModalDismiss('<div className="modal-backdrop" onClick={close} />')).toEqual([]);
    expect(scanModalDismiss('<div className="modal-backdrop" onPointerDown={close} />')).toEqual([]);
    expect(scanModalDismiss('<div className="modal-backdrop" onMouseDown={close} />')).toEqual([]);
  });
  it('leaves non-modal loading, video and canvas layers alone', () => {
    expect(scanModalDismiss('<><div className="loading-overlay" role="status" /><canvas className="canvas-overlay" /><div className="sim-image-overlay" /></>')).toEqual([]);
  });
  it('checks reconstructed edits and keeps unrelated paths out of scope', () => {
    const file = 'D:/cube/cuberoot.me/core/packages/client/components/Demo.tsx';
    const source = '<div className="modal-backdrop" onClick={close} />';
    expect(violationsFromHookPayload({ tool_input: { file_path: file, old_string: ' onClick={close}', new_string: '' } }, () => source)).toHaveLength(1);
    expect(violationsFromHookPayload({ tool_input: { file_path: file.replace('/components/', '/tests/'), content: source.replace(' onClick={close}', '') } }, () => '')).toEqual([]);
  });
  it('finds no unwired recognizable modal backdrops across all client pages and components', () => {
    const hits = ['app', 'components'].flatMap(dir => walk(join(root, dir))).flatMap(file =>
      scanModalDismiss(readFileSync(file, 'utf8'), file).map(hit => `${relative(root, file)}:${hit.line} ${hit.className}`));
    expect(hits).toEqual([]);
  });
  it('is registered in both Codex command variants', () => {
    const config = JSON.parse(readFileSync(join(root, '../../../.codex/hooks.json'), 'utf8'));
    const hook = config.hooks.PreToolUse.find((entry: { matcher: string }) => entry.matcher === 'apply_patch').hooks[0];
    for (const field of ['command', 'commandWindows']) expect(hook[field]).toContain('hook-detect-modal-dismiss.mjs');
  });
});
