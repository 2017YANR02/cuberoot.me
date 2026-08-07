// High-confidence component reuse guard. This is intentionally rule-based rather
// than a vague similarity score: every rule points to one canonical catalog entry,
// has fixtures, a write-time hook, and a ratchet over existing source.
// Paired hook: .claude/hooks/block-component-reimplementation.ps1.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPONENT_REUSE_RULES,
  scanComponentReimplementations,
  violationsFromHookPayload,
} from '../scripts/hook-detect-component-reimplementation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..', '..');
const SCAN_DIRS = ['app', 'components'];
const BASELINE = 79; // 2026-08-07 legacy close/clear cross buttons; ratchet down only.

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of safeReaddir(dir)) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out = out.concat(walk(join(dir, entry.name)));
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe('component reuse rule registry', () => {
  it('recognizes a hand-written close cross and points to ClearButton', () => {
    const source = `
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>`;
    expect(scanComponentReimplementations(source)).toHaveLength(1);
    expect(COMPONENT_REUSE_RULES[0].component).toBe('ClearButton');
  });

  it('allows status crosses, text buttons, the shared component, and reasoned exceptions', () => {
    expect(scanComponentReimplementations('<span><X size={13} /> Unsolved</span>')).toEqual([]);
    expect(scanComponentReimplementations('<button onClick={onClose}>Close</button>')).toEqual([]);
    expect(scanComponentReimplementations('<ClearButton onClick={onClose} variant="standalone" />')).toEqual([]);
    expect(scanComponentReimplementations(`
      {/* allow-component-reimplementation: bespoke drag handle with close fallback */}
      <button className="modal-close" onClick={onClose}><X /></button>`)).toEqual([]);
  });

  it('reads both Claude Edit and Codex apply_patch payload shapes', () => {
    const block = '<button className="modal-close" onClick={onClose}><X /></button>';
    const edit = {
      tool_input: {
        file_path: 'D:/cube/cuberoot.me/core/packages/client/app/demo/page.tsx',
        new_string: block,
      },
    };
    const patch = {
      tool_input: {
        patch: `*** Begin Patch\n*** Update File: D:\\cube\\cuberoot.me\\core\\packages\\client\\app\\demo\\page.tsx\n@@\n+${block}\n*** End Patch`,
      },
    };
    expect(violationsFromHookPayload(edit, new Set())).toHaveLength(1);
    expect(violationsFromHookPayload(patch, new Set())).toHaveLength(1);
  });

  it('keeps source violations at or below the legacy baseline', () => {
    let count = 0;
    const offenders: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const hits = scanComponentReimplementations(readFileSync(file, 'utf8'));
        if (hits.length) offenders.push(`${hits.length}\t${relative(ROOT, file)}`);
        count += hits.length;
      }
    }
    expect(
      count,
      `Hand-written close/clear cross buttons = ${count} (baseline ${BASELINE}). ` +
        `Use <ClearButton variant="standalone"> and lower BASELINE; never raise it.\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(BASELINE);
  });

  it('is wired into both repository hook configurations and the component catalog', () => {
    const codex = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const preTool = codex.hooks?.PreToolUse ?? [];
    expect(preTool.some((group: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
      group.matcher?.includes('apply_patch')
      && group.hooks?.some((hook) => hook.command?.includes('block-component-reimplementation.ps1')),
    )).toBe(true);
    expect(existsSync(join(REPO_ROOT, '.claude', 'hooks', 'block-component-reimplementation.ps1'))).toBe(true);

    const catalog = readFileSync(join(ROOT, 'app', '[lang]', 'code', 'components', '_catalog.tsx'), 'utf8');
    expect(catalog).toContain("name: 'ClearButton'");
    expect(catalog).toContain("import { ClearButton } from '@/components/ClearButton';");
  });
});
