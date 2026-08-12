// High-confidence component reuse guard. This is intentionally rule-based rather
// than a vague similarity score: every rule points to one canonical catalog entry,
// has fixtures, a write-time hook, and a ratchet over existing source.
// Paired hook: .codex/hooks/block-component-reimplementation.ps1.
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
    expect(COMPONENT_REUSE_RULES.find((rule) => rule.id === 'clear-button')?.component).toBe('ClearButton');
  });

  it('recognizes page-local project dropdowns and native project selects', () => {
    const dropdown = `
      function EventPickerDropdown() {
        const [open, setOpen] = useState(false);
        return <button onClick={() => setOpen(!open)}><EventIcon event="333" /></button>;
      }`;
    const nativeSelect = `
      <select aria-label={tr({ zh: '拼图', en: 'Puzzle' })}>
        {events.map((event) => <option value={event.id}>{event.name}</option>)}
      </select>`;
    expect(scanComponentReimplementations(dropdown).map((hit) => hit.ruleId)).toContain('puzzle-picker');
    expect(scanComponentReimplementations(nativeSelect).map((hit) => hit.ruleId)).toContain('puzzle-picker');
  });

  it('allows thin data wrappers around the shared project pickers', () => {
    expect(scanComponentReimplementations(`
      function PuzzleTypeSelect() {
        return <PuzzlePicker selectedEvent={event} groups={groups} onSelect={setEvent} />;
      }`)).toEqual([]);
    expect(scanComponentReimplementations(`
      function EventSelector() {
        return <WcaEventSelector availableEvents={events} selectedEvent={event} onSelect={setEvent} />;
      }`)).toEqual([]);
  });

  it('keeps the named product surfaces on the shared PuzzlePicker', () => {
    const surfaces = [
      join(ROOT, 'components', 'RecentScrambles.tsx'),
      join(ROOT, 'app', '[lang]', 'predict', 'page.tsx'),
      join(ROOT, 'app', '[lang]', 'timer', '_shell', 'SoloView.tsx'),
      join(ROOT, 'app', '[lang]', 'sim', 'PlayerControls.tsx'),
      join(ROOT, 'app', '[lang]', 'scramble', '_components', 'SolveTabs.tsx'),
    ];
    for (const file of surfaces) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(ROOT, file)).toContain("from '@/components/PuzzlePicker/PuzzlePicker'");
      expect(source, relative(ROOT, file)).toContain('<PuzzlePicker');
    }
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
    const exec = {
      tool_input: `const patch = "*** Begin Patch\\n*** Update File: D:\\\\cube\\\\cuberoot.me\\\\core\\\\packages\\\\client\\\\app\\\\demo\\\\page.tsx\\n@@\\n+${block.replaceAll('"', '\\"')}\\n*** End Patch"; await tools.apply_patch(patch);`,
    };
    expect(violationsFromHookPayload(edit, new Set())).toHaveLength(1);
    expect(violationsFromHookPayload(patch, new Set())).toHaveLength(1);
    expect(violationsFromHookPayload(exec, new Set())).toHaveLength(1);
  });

  it('keeps source violations at or below the legacy baseline', () => {
    const counts = new Map<string, number>();
    const offenders: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const hits = scanComponentReimplementations(readFileSync(file, 'utf8'));
        if (hits.length) offenders.push(`${hits.map((hit) => hit.ruleId).join(',')}\t${relative(ROOT, file)}`);
        for (const hit of hits) counts.set(hit.ruleId, (counts.get(hit.ruleId) ?? 0) + 1);
      }
    }
    expect(
      counts.get('clear-button') ?? 0,
      `Hand-written close/clear cross buttons = ${counts.get('clear-button') ?? 0} (baseline ${BASELINE}). ` +
        `Use <ClearButton variant="standalone"> and lower BASELINE; never raise it.\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(BASELINE);
    expect(
      counts.get('puzzle-picker') ?? 0,
      `Page-local project selectors must be consolidated into PuzzlePicker.\n${offenders.join('\n')}`,
    ).toBe(0);
  });

  it('is wired into the repository apply_patch hook and the component catalog', () => {
    const codex = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const preTool = codex.hooks?.PreToolUse ?? [];
    expect(preTool.some((group: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
      group.matcher === 'apply_patch'
      && group.hooks?.some((hook) => hook.command?.includes('adapt-codex-write-payload.mjs')
        && hook.command.includes('block-component-reimplementation.ps1')),
    ), 'missing adapted component-reuse hook for apply_patch').toBe(true);
    expect(existsSync(join(REPO_ROOT, '.codex', 'hooks', 'block-component-reimplementation.ps1'))).toBe(true);

    const catalog = readFileSync(join(ROOT, 'app', '[lang]', 'code', 'components', '_catalog.tsx'), 'utf8');
    expect(catalog).toContain("name: 'ClearButton'");
    expect(catalog).toContain("import { ClearButton } from '@/components/ClearButton';");
    expect(catalog).toContain("name: 'PuzzlePicker'");
    expect(catalog).toContain("import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';");
  });
});
