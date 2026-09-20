import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('shared algorithm list settings', () => {
  it('keeps the view and numeric-ID preferences in the shared settings popover', () => {
    const settings = read('components/AlgListSettings.tsx');
    const shared = read('components/TrainingSettings.tsx');

    expect(settings).toContain("const ALG_CASE_NUMBERS_KEY = 'alg-show-case-numbers'");
    expect(settings).toContain('useSyncExternalStore');
    expect(settings).toContain('<SettingsPopover');
    expect(shared).toContain('export function SettingsPopover');
    expect(shared).toContain('usePanelClamp(open, panelRef)');
    expect(shared).toContain('usePopoverDismiss(open, () => setOpen(false), panelRef, triggerRef)');
    expect(settings).toContain('<AlgViewModeToggle value={view} onChange={onViewChange} />');
    expect(settings).toContain("localStorage.getItem(ALG_CASE_NUMBERS_KEY) === 'true'");
    expect(settings).toContain("label={tr({ zh: '数字编号', en: 'Numeric IDs' })}");
  });

  it('uses the shared settings on regular and generated case lists', () => {
    const category = read('components/AlgCategoryView.tsx');
    const lsll = read('app/[lang]/alg/lsll/[group]/LsllGroupClient.tsx');

    expect(category).toContain('<AlgListSettings');
    expect(category).toContain('showCaseNumbers && c.number != null');
    expect(lsll).toContain('<AlgListSettings');
    expect(lsll).toContain('showCaseNumbers && <span className="lsll-case-label">');
  });
});
