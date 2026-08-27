// High-confidence component reuse guard. This is intentionally rule-based rather
// than a vague similarity score: every rule points to one canonical catalog entry,
// has fixtures, a write-time hook, and a ratchet over existing source.
// Paired hook: .codex/hooks/block-component-reimplementation.ps1.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPONENT_REUSE_RULES,
  scanAlgCaseDetailLayout,
  scanNewBackHomePlacements,
  scanComponentReimplementations,
  violationsFromHookPayload,
} from '../scripts/hook-detect-component-reimplementation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..', '..');
const SCAN_DIRS = ['app', 'components'];
const BASELINE = 79; // 2026-08-07 legacy close/clear cross buttons; ratchet down only.
const BACK_HOME_ROOT_ALLOWLIST = new Set([
  'app/[lang]/calc/page.tsx',
  'app/[lang]/courses/TeachingClient.tsx',
  'app/[lang]/docs/page.tsx',
  'app/[lang]/forum/page.tsx',
  'app/[lang]/frame-count/FrameCountPage.tsx',
  'app/[lang]/icon/page.tsx',
  'app/[lang]/memo/page.tsx',
  'app/[lang]/mosaic/page.tsx',
  'app/[lang]/recon/page.tsx',
  'app/[lang]/scramble/page.tsx',
  'app/[lang]/sheets/page.tsx',
  'app/[lang]/teachers/page.tsx',
  'app/[lang]/wb/page.tsx',
  'app/[lang]/why-cube/page.tsx',
]);

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

  it('requires BackHome to belong to an explicit content-width container', () => {
    const directRoot = `
      <main className="demo-page">
        <BackHome />
        <h1>Demo</h1>
      </main>`;
    expect(scanComponentReimplementations(directRoot).map((hit) => hit.ruleId))
      .toContain('back-home-layout');
    expect(scanNewBackHomePlacements('<BackHome />').map((hit) => hit.ruleId))
      .toContain('back-home-layout');

    expect(scanComponentReimplementations(`
      <main className="demo-page">
        <header className="demo-header"><BackHome /></header>
      </main>`)).toEqual([]);
    expect(scanComponentReimplementations(
      '<div className="page-header"><BackHome /></div>',
    )).toEqual([]);
    expect(scanNewBackHomePlacements(`
      <div className="demo-back-row">
        <BackHome />
      </div>`)).toEqual([]);
    expect(scanComponentReimplementations(`
      <main className="demo-page">
        <BackHome className="demo-back" />
      </main>`)).toEqual([]);
  });

  it('keeps the named product surfaces on the shared PuzzlePicker', () => {
    const surfaces = [
      join(ROOT, 'components', 'RecentScrambles.tsx'),
      join(ROOT, 'app', '[lang]', 'predict', 'page.tsx'),
      join(ROOT, 'app', '[lang]', 'timer', '_shell', 'SoloView.tsx'),
      join(ROOT, 'app', '[lang]', 'sim', 'PlayerControls.tsx'),
      join(ROOT, 'app', '[lang]', 'scramble', '_components', 'SolveTabs.tsx'),
      join(ROOT, 'app', '[lang]', 'alg', '_components', 'AlgPuzzleSelect.tsx'),
      join(ROOT, 'app', '[lang]', 'alg', 'time-attack', 'page.tsx'),
      join(ROOT, 'app', '[lang]', 'site', 'page.tsx'),
    ];
    for (const file of surfaces) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(ROOT, file)).toContain("from '@/components/PuzzlePicker/PuzzlePicker'");
      expect(source, relative(ROOT, file)).toContain('<PuzzlePicker');
    }
  });

  it('keeps the shared selected-puzzle trigger icon-only by default and frameless', () => {
    const source = readFileSync(join(ROOT, 'components', 'PuzzlePicker', 'PuzzlePicker.tsx'), 'utf8');
    const siteSource = readFileSync(join(ROOT, 'app', '[lang]', 'site', 'page.tsx'), 'utf8');
    const css = readFileSync(join(ROOT, 'components', 'PuzzlePicker', 'puzzle_picker.css'), 'utf8');
    const triggerRule = css.match(/\.pp-trigger\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const activeRule = css.match(/\.pp-trigger--active\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(source).toContain('showTriggerIcon = true');
    expect(source).toContain('{showTriggerIcon && (selectedItem && showItemIcons');
    expect(source).toContain('(!selectedItem || !showItemIcons || !showTriggerIcon)');
    expect(siteSource.match(/showTriggerIcon=\{false\}/g)).toHaveLength(4);
    expect(source).not.toContain('iconOnlyTrigger');
    expect(triggerRule).toContain('border: 1px solid transparent');
    expect(triggerRule).toContain('background: transparent');
    expect(activeRule).not.toContain('border-color');
    expect(activeRule).not.toContain('background');
  });

  it('keeps WCA metrics and timer rolling statistics on CompactSelect', () => {
    const surfaces = [
      join(ROOT, 'components', 'wca-stats', 'WcaStatView.views.tsx'),
      join(ROOT, 'app', '[lang]', 'timer', '_components', 'RollingStatsPicker.tsx'),
    ];
    for (const file of surfaces) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(ROOT, file)).toContain("from '@/components/CompactSelect'");
      expect(source, relative(ROOT, file)).toContain('<CompactSelect');
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

  it('blocks an unowned BackHome write while allowing a named layout row', () => {
    const filePath = 'D:/cube/cuberoot.me/core/packages/client/app/demo/page.tsx';
    expect(violationsFromHookPayload({
      tool_input: { file_path: filePath, new_string: '<BackHome />' },
    }, new Set()).map((hit) => hit.ruleId)).toContain('back-home-layout');
    expect(violationsFromHookPayload({
      tool_input: {
        file_path: filePath,
        new_string: '<div className="demo-back-row"><BackHome /></div>',
      },
    }, new Set())).toEqual([]);
  });

  it('keeps every canonical case detail on the fixed shared player-and-list layout', () => {
    const filePath = 'D:/cube/cuberoot.me/core/packages/client/app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx';
    expect(scanAlgCaseDetailLayout(filePath, `
      {!multiOri && (
        <div className="alg-case-detail-lean-thumb"><CaseThumb /></div>
      )}
    `).map((hit) => hit.ruleId)).toContain('alg-case-detail-layout');
    expect(scanAlgCaseDetailLayout(filePath, `
      <div className="alg-case-detail-lean-thumb"><CaseThumb /></div>
    `)).toEqual([]);
    expect(scanAlgCaseDetailLayout(filePath, `
      <PlayableAlgRow inlinePlayer={!multiOri} />
    `).map((hit) => hit.ruleId)).toContain('alg-case-detail-layout');
    expect(scanAlgCaseDetailLayout(filePath, `
      {multiOri && selectedEntry && (
        <div className="alg-case-detail-ori-player"><AlgPlayer /></div>
      )}
      {dragAlgs ? withDnd(oi)(rows) : rows}
    `).map((hit) => hit.ruleId)).toContain('alg-case-detail-layout');
    expect(scanAlgCaseDetailLayout(filePath, `
      <div className="alg-case-detail-ori-main">
        <div className="alg-case-detail-ori-player"><AlgPlayer /></div>
        <div className="alg-case-detail-ori-algs">{rows}</div>
      </div>
    `)).toEqual([]);

    const metaPath = 'D:/cube/cuberoot.me/core/packages/client/components/AlgCaseMetaContent.tsx';
    expect(scanAlgCaseDetailLayout(metaPath, `
      {expandedAlg && (
        <AlgPlayer alg={alg} />
      )}
    `).map((hit) => hit.ruleId)).toContain('alg-case-detail-layout');
    expect(scanAlgCaseDetailLayout(metaPath, `
      <div className="alg-case-detail-ori-main">
        <div className="alg-case-detail-ori-player"><AlgPlayer /></div>
        <div className="alg-case-detail-ori-algs">{rows}</div>
      </div>
    `)).toEqual([]);

    const cssPath = 'D:/cube/cuberoot.me/core/packages/client/app/[lang]/alg/alg.css';
    expect(scanAlgCaseDetailLayout(cssPath, `
      .alg-case-detail-lean-algs.is-multi-ori {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    `).map((hit) => hit.ruleId)).toContain('alg-case-detail-layout');
  });

  it('pins the alg puzzle BackHome above the title inside the shared-width header', () => {
    const page = readFileSync(join(ROOT, 'app', '[lang]', 'alg', '[puzzle]', 'AlgPuzzleClient.tsx'), 'utf8');
    const css = readFileSync(join(ROOT, 'app', '[lang]', 'alg', 'alg.css'), 'utf8');
    expect(page).toMatch(
      /className="alg-cat-header alg-cat-header--puzzle">\s*<div className="alg-puzzle-back-row">\s*<BackHome \/>\s*<\/div>\s*<h1 className="alg-cat-title">/,
    );
    expect(css).toMatch(/\.alg-puzzle-back-row\s*\{[^}]*flex-basis:\s*100%;[^}]*\}/);
  });

  it('keeps source violations at or below the legacy baseline', () => {
    const counts = new Map<string, number>();
    const offenders: string[] = [];
    const backHomeRootFiles: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const hits = scanComponentReimplementations(readFileSync(file, 'utf8'));
        const filePath = relative(ROOT, file).replaceAll('\\', '/');
        if (hits.length) offenders.push(`${hits.map((hit) => hit.ruleId).join(',')}\t${filePath}`);
        if (hits.some((hit) => hit.ruleId === 'back-home-layout')) backHomeRootFiles.push(filePath);
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
    const unexpectedBackHomeRoots = backHomeRootFiles
      .filter((file) => !BACK_HOME_ROOT_ALLOWLIST.has(file));
    expect(
      unexpectedBackHomeRoots,
      `Bare BackHome must live inside a content-width header/topbar/wrap/back-row, not directly under a page root.\n` +
        `${unexpectedBackHomeRoots.join('\n')}`,
    ).toEqual([]);
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

    const catalog = readFileSync(join(ROOT, 'app', '[lang]', 'dev', 'components', '_catalog.tsx'), 'utf8');
    expect(catalog).toContain("name: 'ClearButton'");
    expect(catalog).toContain("import { ClearButton } from '@/components/ClearButton';");
    expect(catalog).toContain("name: 'PuzzlePicker'");
    expect(catalog).toContain("import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';");
    expect(catalog).toContain("name: 'BackHome'");
    expect(catalog).toContain('必须放进与正文同宽的 header/topbar/wrap');
  });
});
