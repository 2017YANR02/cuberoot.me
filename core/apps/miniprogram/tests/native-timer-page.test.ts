import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeTimer } from '../src/lib/native-timer';
import { createNativeTimerPageOptions } from '../src/lib/native-timer-page';
import { loadNativeCompetitionScrambles, nativeCompetitionCatalog } from '../src/lib/native-timer-wca';

vi.mock('../src/lib/native-timer-wca', () => ({
  createNativeWcaPool: vi.fn(),
  loadNativeCompetitionScrambles: vi.fn(),
  nativeCompetitionCatalog: { load: vi.fn() },
}));
vi.mock('../src/lib/auth', () => ({ getStoredSessionSnapshot: () => ({ session: null }), requestJson: vi.fn() }));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
vi.mock('../src/lib/external-timer/session', () => ({ disconnectExternalTimer: vi.fn(), startExternalTimer: vi.fn() }));
vi.mock('../src/lib/smart-cube/session', () => ({ getSmartCubeSession: () => ({ stopLocal: vi.fn() }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const timer = new NativeTimer({ getStorageSync: () => undefined, setStorageSync: vi.fn(), removeStorageSync: vi.fn() });
  timer.settings.wcaComp = 'Test2026';
  const options = createNativeTimerPageOptions() as {
    data: Record<string, unknown>;
    openSheet(event: WechatMiniprogram.TouchEvent): void;
    clearWca(event: WechatMiniprogram.TouchEvent): void;
    closeSheet(): void;
    selectSource(event: WechatMiniprogram.PickerChange): void;
    selectSettingsCategory(event: WechatMiniprogram.PickerChange): void;
    toggleSetting(event: WechatMiniprogram.SwitchChange): void;
    timerUp(): void;
    editResult(event: WechatMiniprogram.TouchEvent): void;
    changeDetailPenalty(event: WechatMiniprogram.PickerChange): void;
    resultAction(event: WechatMiniprogram.TouchEvent): void;
    draftInput(event: WechatMiniprogram.Input): void;
    saveDraft(): void;
    changeSetting(event: WechatMiniprogram.PickerChange): void;
  };
  const page = {
    ...options, data: { ...options.data }, active: true, nativeTimer: timer,
    setData(data: Record<string, unknown>) { Object.assign(this.data, data); },
  };
  return { page, timer };
}
const event = (dataset: Record<string, string>) => ({ currentTarget: { dataset } }) as WechatMiniprogram.TouchEvent;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('native timer source sheet lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativeCompetitionCatalog.load).mockResolvedValue([]);
  });

  it('opens manual source editing without changing the source on cancel', () => {
    const { page, timer } = fixture();
    page.selectSource({ detail: { value: '1' } } as WechatMiniprogram.PickerChange);
    expect(page.data.sheet).toBe('scrambles');
    expect(timer.currentSource).toBe('random');
    page.closeSheet();
    expect(timer.currentSource).toBe('random');
  });

  it('groups settings and hides only surrounding controls during a run', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U');
    page.openSheet(event({ sheet: 'settings' }));
    page.selectSettingsCategory({ detail: { value: '3' } } as WechatMiniprogram.PickerChange);
    expect(page.data.settingsCategory).toBe('appearance');
    page.toggleSetting({ currentTarget: { dataset: { setting: 'hideAllUiWhileRunning' } }, detail: { value: true } } as unknown as WechatMiniprogram.SwitchChange);
    expect(timer.settings.hideAllUiWhileRunning).toBe(true);
    expect(page.data.hideChrome).toBe(false);
    page.closeSheet();
    timer.down(); timer.dispatch({ type: 'hold-ready' }); page.timerUp();
    expect(page.data.phase).toBe('running');
    expect(page.data.hideChrome).toBe(true);
    timer.down(); page.timerUp();
    expect(page.data.phase).toBe('stopped');
    expect(page.data.hideChrome).toBe(false);
  });

  it('preserves a restored font scale between standard picker increments', () => {
    const { page, timer } = fixture();
    timer.updateSettings({ timerFontScale: 1.23 });
    page.openSheet(event({ sheet: 'settings' }));
    const rows = page.data.settingRows as { key: string; index: number; value: string }[];
    const row = rows.find(row => row.key === 'timerFontScale')!;
    expect(row.value).toBe('123%');
    page.changeSetting({ currentTarget: { dataset: { setting: row.key } }, detail: { value: String(row.index) } } as unknown as WechatMiniprogram.PickerChange);
    expect(timer.settings.timerFontScale).toBe(1.23);
  });

  it('updates penalties in place while preserving the raw result and source', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U');
    timer.updateSettings({ precision: 2 });
    timer.manualEntry('12.34');
    const original = structuredClone(timer.records[0]);
    page.editResult(event({ id: original.id }));
    page.changeDetailPenalty({ detail: { value: '1' } } as WechatMiniprogram.PickerChange);
    expect(page.data.sheet).toBe('detail');
    expect(page.data.detail).toMatchObject({ result: '14.34', rawTime: '12.34', scramble: 'R U' });
    expect(timer.records[0]).toEqual({ ...original, penalty: '+2' });
    page.changeDetailPenalty({ detail: { value: '3' } } as WechatMiniprogram.PickerChange);
    expect(page.data.detail).toMatchObject({ result: 'DNS', rawTime: '12.34' });
    page.closeSheet();
    expect(page.data.sheet).toBe('history');
  });

  it('returns to the same detail after saving or cancelling a comment', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U'); timer.manualEntry('12');
    const id = timer.records[0].id;
    page.editResult(event({ id }));
    page.resultAction(event({ action: 'history.quick.comment' }));
    page.draftInput({ detail: { value: 'Saved note' } } as WechatMiniprogram.Input);
    page.saveDraft();
    expect(page.data.sheet).toBe('detail');
    expect(page.data.detail).toMatchObject({ id, comment: 'Saved note' });
    page.resultAction(event({ action: 'history.quick.comment' }));
    page.draftInput({ detail: { value: 'Discarded note' } } as WechatMiniprogram.Input);
    page.closeSheet();
    expect(page.data.sheet).toBe('detail');
    expect(timer.records[0].comment).toBe('Saved note');
  });

  it('projects recorded split and device metadata without mutating the solve', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U'); timer.manualEntry('12');
    timer.updateSettings({ precision: 2 });
    const solve = timer.records[0];
    solve.inspectionMs = 9000;
    solve.device = { model: 'gan-v4', name: 'GAN16' };
    solve.stages = { cross: 2000, f2l: 7000, oll: 9000, pll: 12000 };
    const original = structuredClone(solve);
    page.editResult(event({ id: solve.id }));
    expect(page.data.detail).toMatchObject({
      rawTime: '12.00', inspection: '9.00', deviceName: 'GAN16',
      stages: [
        { id: 'cross', duration: '2.00', cumulative: '2.00' },
        { id: 'f2l', duration: '5.00', cumulative: '7.00' },
        { id: 'oll', duration: '2.00', cumulative: '9.00' },
        { id: 'pll', duration: '3.00', cumulative: '12.00' },
      ],
    });
    expect(timer.records[0]).toEqual(original);
  });

  it('shows the current competition rounds and groups', async () => {
    vi.mocked(loadNativeCompetitionScrambles).mockResolvedValue([
      { eventId: '333', roundTypeId: '1', groupId: 'A', scramble: 'R U', scrambleNumber: 1, isExtra: false, optimalScramble: null },
    ]);
    const { page } = fixture();
    page.openSheet!(event({ sheet: 'wca' }));
    await flush();
    expect(page.data.rounds).toEqual(['', '1']);
    expect(page.data.groups).toEqual(['', 'A']);
  });

  it('does not repopulate rounds after clearing the selected competition', async () => {
    const pending = deferred<Awaited<ReturnType<typeof loadNativeCompetitionScrambles>>>();
    vi.mocked(loadNativeCompetitionScrambles).mockReturnValue(pending.promise);
    const { page } = fixture();
    page.openSheet!(event({ sheet: 'wca' }));
    page.clearWca!(event({ setting: 'comp' }));
    pending.resolve([{ eventId: '333', roundTypeId: '1', groupId: 'A', scramble: 'R U', scrambleNumber: 1, isExtra: false, optimalScramble: null }]);
    await flush();
    expect(page.data.rounds).toEqual(['']);
    expect(page.data.groups).toEqual(['']);
  });

  it('ignores an older request when the same competition is reopened', async () => {
    const old = deferred<Awaited<ReturnType<typeof loadNativeCompetitionScrambles>>>();
    vi.mocked(loadNativeCompetitionScrambles).mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
    const { page } = fixture();
    page.openSheet!(event({ sheet: 'wca' }));
    page.closeSheet!();
    page.openSheet!(event({ sheet: 'wca' }));
    await flush();
    old.reject(new Error('stale rounds'));
    await flush();
    expect(page.data.formError).toBe('');
  });

  it('does not show a late catalog failure in another sheet', async () => {
    const catalog = deferred<Awaited<ReturnType<typeof nativeCompetitionCatalog.load>>>();
    vi.mocked(nativeCompetitionCatalog.load).mockReturnValue(catalog.promise);
    vi.mocked(loadNativeCompetitionScrambles).mockResolvedValue([]);
    const { page } = fixture();
    page.openSheet!(event({ sheet: 'wca' }));
    page.closeSheet!();
    page.openSheet!(event({ sheet: 'settings' }));
    catalog.reject(new Error('offline'));
    await flush();
    expect(page.data.sheet).toBe('settings');
    expect(page.data.formError).toBe('');
  });
});
