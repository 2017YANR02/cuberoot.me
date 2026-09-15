// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inScope, isAllowlisted, scanManualSearch, violationsFromHookPayload } from '../scripts/hook-detect-manual-search.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(CLIENT, 'components/SearchProbe.tsx');
const manual = `<SearchInput value={draft} onChange={setDraft} onKeyDown={e => { if (e.key === 'Enter') setQuery(draft); }} />`;

describe('live search guard', () => {
  it('detects Enter-only search, including named handlers and raw search inputs', () => {
    expect(scanManualSearch(manual).map(hit => hit.kind)).toEqual(['enter']);
    expect(scanManualSearch(`import { SearchInput as QueryField } from '@/components/SearchInput'; const View = () => <QueryField onKeyDown={e => e.key === 'Enter' && search()} />`)).toHaveLength(1);
    expect(scanManualSearch(`const onKey = e => { if (e.key === 'Enter') search(); }; const View = () => <input type="search" onKeyDown={onKey} />;`)).toHaveLength(1);
    expect(scanManualSearch(`<input placeholder="搜索用户" onKeyUp={e => e.key === 'Enter' && search()} />`)).toHaveLength(1);
  });

  it('detects submitted search forms and standalone search buttons', () => {
    expect(scanManualSearch(`<form onSubmit={search}><SearchInput value={draft} onChange={setDraft} /><button type="submit">Search</button></form>`).map(hit => hit.kind)).toEqual(['submit']);
    expect(scanManualSearch(`<div><input type="search" /><button onClick={search}><Search /></button></div>`).map(hit => hit.kind)).toEqual(['button']);
  });

  it('allows live search, clearing, ordinary forms and non-search Enter handlers', () => {
    for (const source of [
      '<SearchInput value={query} onChange={setQuery} debounceMs={300} />',
      '<div><input type="search" onChange={search} /><ClearButton onClick={clear} /></div>',
      '<form onSubmit={save}><input name="username" /><button>Save</button></form>',
      `<input type="number" onKeyDown={e => e.key === 'Enter' && commit()} />`,
      `<input type="search" onKeyDown={e => e.key === 'Escape' && close()} />`,
    ]) expect(scanManualSearch(source), source).toEqual([]);
  });

  it('requires a local exemption with a reason, without exempting adjacent controls', () => {
    expect(scanManualSearch(`<> {/* allow-manual-search: Enter opens the live result. */}${manual}</>`)).toEqual([]);
    expect(scanManualSearch(`<> {/* allow-manual-search: */}${manual}</>`)).toHaveLength(1);
    expect(scanManualSearch(`<> {/* allow-manual-search: Enter opens the live result. */}${manual}${manual}</>`)).toHaveLength(1);
    expect(scanManualSearch(`<> {/* allow-manual-search: Explicitly start an expensive solver. */}<form onSubmit={solve}><input type="search" /></form></>`)).toEqual([]);
  });

  it('reconstructs partial raw Codex command patches from the supplied cwd', () => {
    const before = '<form>\n<SearchInput value={draft} onChange={setDraft} />\n</form>';
    const payload = { cwd: CLIENT, tool_input: { command: '*** Begin Patch\n*** Update File: components/SearchProbe.tsx\n@@\n-<form>\n+<form onSubmit={search}>\n*** End Patch' } };
    expect(violationsFromHookPayload(payload, () => before).map(hit => hit.kind)).toEqual(['submit']);
    expect(violationsFromHookPayload({ tool_input: { file_path: path, old_string: '<form>', new_string: '<form onSubmit={search}>' } }, () => before)).toHaveLength(1);
  });

  it('allows repairs and ignores unrelated paths', () => {
    expect(violationsFromHookPayload({ tool_input: { file_path: path, content: '<SearchInput onChange={setQuery} />' } }, () => manual)).toEqual([]);
    expect(violationsFromHookPayload({ tool_input: { file_path: path, content: manual + '\n' } }, () => manual)).toEqual([]);
    expect(inScope('D:\\repo\\core\\packages\\client\\components\\Search.tsx')).toBe(true);
    expect(inScope('core/packages/client/tests/search.test.tsx')).toBe(false);
    expect(inScope('unrelated/Search.tsx')).toBe(false);
  });

  it('checks all client page and component TSX with the same scanner', () => {
    const violations: string[] = [];
    for (const directory of ['app', 'components']) {
      const base = join(CLIENT, directory);
      for (const entry of readdirSync(base, { recursive: true })) {
        const file = join(base, entry.toString());
        if (!inScope(file) || isAllowlisted(file)) continue;
        for (const hit of scanManualSearch(readFileSync(file, 'utf8'), file)) violations.push(`${relative(CLIENT, file)}:${hit.line} ${hit.kind}`);
      }
    }
    expect(violations, 'Search must update while typing. Explain intentional manual actions with allow-manual-search.').toEqual([]);
  });
});
