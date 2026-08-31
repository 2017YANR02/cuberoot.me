// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRawDateInputs, violationsFromHookPayload } from '../scripts/hook-detect-raw-date-input.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(HERE, '..');
const REPO_ROOT = resolve(CLIENT_ROOT, '../../../');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('date-only controls reuse DateInput / DateRangeInput', () => {
  it('keeps raw date inputs and text impostors out of app code', () => {
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of walk(join(CLIENT_ROOT, root))) {
        const count = scanRawDateInputs(readFileSync(file, 'utf8')).length;
        if (count) offenders.push(`${count}\t${relative(CLIENT_ROOT, file)}`);
      }
    }
    expect(offenders, `Use DateInput / DateRangeInput:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps the Web DateInput path as a thin shared-component wrapper', () => {
    const source = readFileSync(join(CLIENT_ROOT, 'components/DateInput.tsx'), 'utf8');
    expect(scanRawDateInputs(source)).toHaveLength(0);
    expect(source).toContain("from '@cuberoot/timer-ui'");
    expect(source).toContain('<SharedDateInput');
  });

  it('detects both raw and text-lookalike date controls in writes', () => {
    const payload = (content: string) => ({
      tool_input: {
        file_path: 'core/packages/client/app/[lang]/probe/page.tsx',
        content,
      },
    });
    expect(violationsFromHookPayload(payload('<input type="date" value={date} />'))).toHaveLength(1);
    expect(violationsFromHookPayload(payload("<input type={'date'} value={date} />"))).toHaveLength(1);
    expect(violationsFromHookPayload(payload('<input type="text" placeholder="yyyy-mm-dd" />'))).toHaveLength(1);
    expect(violationsFromHookPayload(payload('<DateInput value={date} onChange={setDate} />'))).toEqual([]);
  });

  it('registers the hook for Unix and Windows command fields', () => {
    const config = JSON.parse(readFileSync(join(REPO_ROOT, '.codex/hooks.json'), 'utf8'));
    const group = config.hooks.PreToolUse.find((entry: { matcher?: string }) => entry.matcher === 'apply_patch');
    expect(group.hooks.some((entry: { command?: string }) => entry.command?.includes('hook-detect-raw-date-input.mjs'))).toBe(true);
    expect(group.hooks.some((entry: { commandWindows?: string }) => entry.commandWindows?.includes('hook-detect-raw-date-input.mjs'))).toBe(true);
  });
});
