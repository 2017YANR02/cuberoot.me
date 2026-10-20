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
