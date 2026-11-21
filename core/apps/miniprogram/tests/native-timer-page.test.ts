import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeTimer } from '../src/lib/native-timer';
import { createNativeTimerPageOptions } from '../src/lib/native-timer-page';
import { loadNativeCompetitionScrambles, nativeCompetitionCatalog } from '../src/lib/native-timer-wca';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { renderCubeSVG } from '@cuberoot/visualcube/render';
import { timer333StepNotation } from '@cuberoot/puzzle-solvers/timer-333-step';

const clipboard = vi.hoisted(() => ({
  write: vi.fn<(options: { data: string; success?: () => void; fail?: () => void }) => void>(),
  toast: vi.fn(),
}));

vi.mock('../src/lib/native-timer-wca', () => ({
  createNativeWcaPool: vi.fn(),
  loadNativeCompetitionCountry: vi.fn(async () => ''),
  loadNativeCompetitionScrambles: vi.fn(),
  nativeCompetitionCatalog: { load: vi.fn() },
  nativeWcaDifficulty: {
    loadCatalog: vi.fn(async () => ({ distribution: null, eventLengths: null, layout: null })),
    probeCompetitionCoverage: vi.fn(async () => null),
  },
}));
vi.mock('../src/lib/platform', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/platform')>(), miniProgramApi: () => ({
    openBluetoothAdapter: vi.fn(), setClipboardData: clipboard.write, showToast: clipboard.toast,
  }),
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
function fixture(useWca = false) {
  const pool = useWca ? {
    sourceKey: () => 'test-wca', isWcaCompUnindexed: () => false, cancelSource: vi.fn(),
    startNext: () => ({ cancel: vi.fn(), result: new Promise(() => {}) }),
  } as unknown as ConstructorParameters<typeof NativeTimer>[2] : undefined;
  const timer = new NativeTimer({ getStorageSync: () => undefined, setStorageSync: vi.fn(), removeStorageSync: vi.fn() }, undefined, pool);
  timer.settings.wcaComp = 'Test2026';
  const options = createNativeTimerPageOptions() as {
    data: Record<string, unknown>;
    openSheet(event: WechatMiniprogram.TouchEvent): void;
    clearWca(event: WechatMiniprogram.TouchEvent): void;
    closeSheet(): void;
    chooseSource(event: WechatMiniprogram.TouchEvent): void;
    selectProject(event: WechatMiniprogram.TouchEvent): void;
    inputManualScrambles(event: WechatMiniprogram.Input): void;
    finishManualScrambles(): void;
    changeManualEntry(event: WechatMiniprogram.Input): void;
    selectSettingsCategory(event: WechatMiniprogram.PickerChange): void;
    openSettingsAction(event: WechatMiniprogram.TouchEvent): void;
    changeStatistics(event: WechatMiniprogram.TouchEvent): void;
    chooseStatisticsMode(event: WechatMiniprogram.PickerChange): void;
    switchResultsTab(event: WechatMiniprogram.TouchEvent): void;
    searchHistory(event: WechatMiniprogram.Input): void;
    onResize(event: WechatMiniprogram.Page.IResizeOption | { windowWidth: number; windowHeight?: number }): void;
    inputBulkCount(event: WechatMiniprogram.Input): void;
    generateBulkScrambles(): void;
    toggleBulkProjectMenu(): void;
    toggleLayout(): void;
    startLayoutDrag(event: WechatMiniprogram.TouchEvent): void;
    moveLayoutDrag(event: WechatMiniprogram.TouchEvent): void;
    endLayoutDrag(event: WechatMiniprogram.TouchEvent): void;
    cancelLayoutDrag(): void;
    hideLayoutRegion(event: WechatMiniprogram.TouchEvent): void;
    resetLayout(): void;
    difficultyTrackDown(event: WechatMiniprogram.TouchEvent): void;
    updateDifficultyTrack(event: WechatMiniprogram.TouchEvent): void;
    toggleDifficultyMenu(event: WechatMiniprogram.TouchEvent): void;
    chooseDifficultyColor(event: WechatMiniprogram.TouchEvent): void;
    chooseDifficultyMethod(event: WechatMiniprogram.TouchEvent): void;
    chooseDifficultyStage(event: WechatMiniprogram.TouchEvent): void;
    saveDifficulty(): void;
    timerUp(): void;
    stageTouch(event: WechatMiniprogram.TouchEvent): void;
    editResult(event: WechatMiniprogram.TouchEvent): void;
    changeDetailPenalty(event: WechatMiniprogram.PickerChange): void;
    resultAction(event: WechatMiniprogram.TouchEvent): void;
    draftInput(event: WechatMiniprogram.Input): void;
    saveDraft(): void;
    seekSolverStep(event: WechatMiniprogram.TouchEvent): void;
    copySolverScramble(): void;
    copySolverSteps(): void;
    changeSetting(event: WechatMiniprogram.PickerChange | WechatMiniprogram.SwitchChange | WechatMiniprogram.SliderChange): void;
  };
  const page = {
    ...options, data: { ...options.data }, active: true, nativeTimer: timer,
    setData(data: Record<string, unknown>) { Object.assign(this.data, data); },
  };
  return { page, timer };
}
const event = (dataset: Record<string, string>) => ({ currentTarget: { dataset } }) as WechatMiniprogram.TouchEvent;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function selectSettingsCategory(page: ReturnType<typeof fixture>['page'], id: string) {
  const categories = page.data.settingsCategories as { id: string }[];
  const value = String(categories.findIndex(category => category.id === id));
  page.selectSettingsCategory({ detail: { value } } as WechatMiniprogram.PickerChange);
}

it('copies shared step notation and reports a denied clipboard write without moving playback', () => {
  vi.useFakeTimers();
  try {
    const { page } = fixture();
    const scramble = 'R F';
    const notation = timer333StepNotation({ totalMoves: 2, stages: [
      { head: 'Cross', moves: ["F'"] }, { head: 'F2L-1', moves: ["R'"] },
    ] }, 'cfop', 'en');
    Object.assign(page, { sheet: 'solver', solverScramble: scramble, solverStepNotation: notation,
      solverPlayback: { setup: scramble, moves: notation.moves }, solverPausedByUser: true });
    page.data.solverView = 1;
    clipboard.write.mockImplementation(({ success }) => success?.());

    page.copySolverScramble();
    expect(clipboard.write.mock.lastCall?.[0].data).toBe('R F');
    page.seekSolverStep(event({ index: '1' }));
    expect(clipboard.write.mock.lastCall?.[0].data).toBe("R' // F1");
    expect(page.data.playback).toMatchObject({ frame: 1 });
    expect(page.data.playing).toBe(false);
    page.copySolverSteps();
    expect(clipboard.write.mock.lastCall?.[0].data).toBe("R F\n\nF' // Cross\nR' // F1");
    expect(page.data.solverNotationCopied).toBe(true);
    vi.advanceTimersByTime(1500);
    clipboard.write.mockImplementation(({ fail }) => fail?.());
    page.copySolverSteps();
    expect(clipboard.toast).toHaveBeenCalledWith({ title: expect.any(String), icon: 'none' });
    expect(page.data.solverNotationCopied).toBe(false);
    expect(page.data.playback).toMatchObject({ frame: 1 });
  } finally {
    clipboard.write.mockReset();
    vi.useRealTimers();
  }
});

describe('native timer source sheet lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativeCompetitionCatalog.load).mockResolvedValue([]);
  });

  it('opens the inline manual queue and accepts its first line without a second submit', () => {
    const { page, timer } = fixture();
    page.openSheet(event({ sheet: 'source' }));
    page.closeSheet();
    expect(timer.currentSource).toBe('random');
    page.openSheet(event({ sheet: 'source' }));
    page.chooseSource(event({ source: 'manual' }));
    expect(page.data).toMatchObject({ sheet: '', manualEditing: true });
    expect(timer.currentSource).toBe('manual');
    expect(timer.scramble).toBe('');
    page.inputManualScrambles({ detail: { value: 'R U\nR2 F2' } } as WechatMiniprogram.Input);
    expect(timer.scramble).toBe('R U');
    page.finishManualScrambles();
    expect(page.data.manualEditing).toBe(false);
    timer.nextScramble();
    expect(timer.scramble).toBe('R2 F2');
  });

  it('uses the canonical special project score formats during native entry', () => {
    vi.useFakeTimers();
    try {
      const { page, timer } = fixture();
      for (const [eventId, fields, expected] of [
        ['333fm', { fmcMoveCount: '26' }, { event: '333fm', timeMs: 26000 }],
        ['333mbld', { mbldAttempted: '5', mbldSolved: '4', time: '58:02' }, { event: '333mbld', timeMs: 3482000, mbld: { solved: 4, attempted: 5 } }],
      ] as const) {
        page.openSheet(event({ sheet: 'project' }));
        page.selectProject(event({ id: eventId }));
        vi.advanceTimersByTime(20);
        page.openSheet(event({ sheet: 'manual' }));
        for (const [field, value] of Object.entries(fields)) {
          page.changeManualEntry({ currentTarget: { dataset: { field } }, detail: { value } } as unknown as WechatMiniprogram.Input);
        }
        page.saveDraft();
        expect(page.data.formError, eventId).toBe('');
        expect(page.data.sheet).toBe('');
        expect(timer.solves[0]).toMatchObject(expected);
      }
    } finally { vi.useRealTimers(); }
  });

  it('groups settings and hides only surrounding controls during a run', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U');
    page.openSheet(event({ sheet: 'settings' }));
    selectSettingsCategory(page, 'appearance');
    expect(page.data.settingsCategory).toBe('appearance');
    page.changeSetting({ currentTarget: { dataset: { setting: 'hideAllUiWhileRunning', kind: 'switch' } }, detail: { value: true } } as unknown as WechatMiniprogram.SwitchChange);
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

  it('uses empty stage space to time while ignoring controls and cancelling a swipe', () => {
    vi.useFakeTimers();
    try {
      const { page, timer } = fixture();
      timer.setManualScrambles('R U\nF R');
      page.data.generating = false;
      const touch = (type: string, y = 20, timerSurface?: string) => {
        const point = { identifier: 1, clientX: 20, clientY: y, pageX: 20, pageY: y };
        const target = { id: '', offsetTop: 0, offsetLeft: 0, dataset: { timerSurface } };
        page.stageTouch({ type, detail: {}, timeStamp: 0, target, currentTarget: target,
          touches: type === 'touchend' ? [] : [point], changedTouches: [point] });
      };
      touch('touchstart');
      expect(timer.state.phase).toBe('idle');
      touch('touchstart', 20, 'stage');
      expect(timer.state.phase).toBe('holding');
      touch('touchmove', 70);
      vi.advanceTimersByTime(timer.settings.holdMs);
      touch('touchend', 70);
      expect(timer.state.phase).toBe('idle');
      touch('touchstart', 20, 'stage');
      vi.advanceTimersByTime(timer.settings.holdMs);
      touch('touchend');
      expect(timer.state.phase).toBe('running');
      vi.advanceTimersByTime(1234);
      touch('touchstart', 20, 'stage');
      touch('touchend');
      expect(timer.state.phase).toBe('stopped');
      expect(timer.solves).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it('switches the native live image with the same connected cube state and updates it after a move', () => {
    const { page, timer } = fixture();
    const facelets = smartCubeTargetFacelets('R U')!;
    timer.receiveCube({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    timer.receiveCube({ type: 'state', facelets });
    page.openSheet(event({ sheet: 'settings' }));
    selectSettingsCategory(page, 'smart-cube');
    const choose = (index: number) => page.changeSetting({
      currentTarget: { dataset: { setting: 'liveCubeView', kind: 'picker' } }, detail: { value: String(index) },
    } as unknown as WechatMiniprogram.PickerChange);
    const svg = () => decodeURIComponent(String(page.data.livePreview).split(',')[1]);
    const expected = (value: string, view?: 'q2look') => renderCubeSVG({
      cubeSize: 3, width: 88, height: 88, facelets: value.toLowerCase().split(''), ...(view ? { view } : {}),
    });
    const net = svg();
    choose(1);
    expect(timer.settings.liveCubeView).toBe('q2look');
    expect(svg()).toBe(expected(facelets, 'q2look'));
    choose(3);
    expect(svg()).toBe(expected(facelets));
    choose(2);
    expect(svg()).toBe(net);
    choose(1);
    page.closeSheet();
    const after = smartCubeTargetFacelets('R U F')!;
    timer.receiveCube({ type: 'move', move: 'F', deviceTs: 1000 });
    page.timerUp();
    expect(svg()).toBe(expected(after, 'q2look'));
    timer.receiveCube({ type: 'status', phase: 'disconnected' });
    page.timerUp();
    expect(page.data.livePreview).toBe('');
    timer.dispose();
  });

  it('opens the shared data tools from the native gear category', () => {
    const { page } = fixture();
    page.openSheet(event({ sheet: 'settings' }));
    page.openSettingsAction(event({ action: 'more.manual-entry' }));
    expect(page.data.sheet).toBe('settings');
    selectSettingsCategory(page, 'data');
    expect(page.data.settingsCategory).toBe('data');
    expect(page.data.settingsActions).toMatchObject([
      { id: 'more.stats-mobile', category: 'data' }, { id: 'more.manual-entry', category: 'data' },
      { id: 'more.replay', category: 'training' }, { id: 'more.bulk', category: 'scramble' },
    ]);
    page.openSettingsAction(event({ action: 'more.manual-entry' }));
    expect(page.data.sheet).toBe('manual');
    page.openSheet(event({ sheet: 'settings' }));
    page.openSettingsAction(event({ action: 'more.stats-mobile' }));
    expect(page.data.sheet).toBe('statistics');
  });

  it('keeps the full statistics range across tabs and starts fresh on reopening', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U\nF2\nL U');
    timer.manualEntry('12.88');
    timer.manualEntry('10.50');
    page.openSheet(event({ sheet: 'statistics' }));
    expect(page.data.statistics).toMatchObject({ tab: 'overview', range: 'all', count: 2,
      overview: { pb: { scramble: 'F2', result: '10.50' } } });
    page.changeStatistics(event({ action: 'metrics' }));
    expect(page.data.statisticsExpanded).toBe(true);
    page.changeStatistics(event({ action: 'range', value: '7d' }));
    page.changeStatistics(event({ action: 'tab', value: 'charts' }));
    expect(page.data.statistics).toMatchObject({ tab: 'charts', range: '7d', overview: null,
      charts: { scatter: { visible: true } } });
    page.changeStatistics(event({ action: 'tab', value: 'daily' }));
    page.chooseStatisticsMode({ detail: { value: '1' } } as WechatMiniprogram.PickerChange);
    expect(page.data.statistics).toMatchObject({ daily: { practice: { total: true } } });
    page.onResize({ windowWidth: 800 });
    expect(page.data.statistics).toMatchObject({ wide: true, overview: { rows: expect.any(Array) },
      daily: { practice: { total: true } }, charts: { scatter: { visible: true } }, cases: { cfop: expect.any(Array) } });
    page.onResize({ windowWidth: 768 });
    expect(page.data.statistics).toMatchObject({ wide: false, overview: null, charts: null, cases: null,
      daily: { practice: { total: true } } });
    page.closeSheet();
    page.openSheet(event({ sheet: 'statistics' }));
    expect(page.data.statistics).toMatchObject({ tab: 'overview', range: 'all' });
    expect(page.data.statisticsExpanded).toBe(false);
  });

  it('keeps original solve numbers and rolling columns when switching the results tabs or searching', () => {
    const { page, timer } = fixture();
    timer.setManualScrambles('R U');
    for (const value of ['10.00', '11.00', '12.00', '13.00', '14.00']) timer.manualEntry(value);
    page.openSheet(event({ sheet: 'history' }));
    const summary = () => page.data.summary as { rows: Array<{ number: number; rolling: { key: string; value: string }[] }> };
    expect(summary().rows[0]).toMatchObject({ number: 5, rolling: expect.arrayContaining([{ key: 'ao5', value: '12.00', isPb: true }]) });
    page.searchHistory({ detail: { value: '10.00' } } as WechatMiniprogram.Input);
    expect(summary().rows.map(row => row.number)).toEqual([1]);
    page.switchResultsTab(event({ sheet: 'statistics' }));
    expect(page.data).toMatchObject({ sheet: 'statistics', resultsWorkspace: true });
    page.switchResultsTab(event({ sheet: 'history' }));
    expect(summary().rows.map(row => row.number)).toEqual([1]);
  });

  it('preserves roomy spacing and compacts the preview and stats independently on resize', () => {
    const { page, timer } = fixture();
    const savedGap = timer.settings.soloLayout.scrambleGap;
    page.onResize({ windowWidth: 800, windowHeight: 600 });
    expect(page.data).toMatchObject({ soloCompactStage: false, soloScrambleGap: savedGap });
    page.onResize({ windowWidth: 800, windowHeight: 516 });
    expect(page.data).toMatchObject({ soloCompactStage: true, soloScrambleGap: 4, soloTightFooter: false });
    page.onResize({ windowWidth: 800, windowHeight: 406 });
    expect(page.data).toMatchObject({ soloTightFooter: true, soloHorizontalStats: false });
    page.onResize({ windowWidth: 800, windowHeight: 296 });
    expect(page.data.soloHorizontalStats).toBe(true);
    page.onResize({ windowWidth: 393, windowHeight: 658 });
    expect(page.data).toMatchObject({ soloCompactStage: false, soloScrambleGap: savedGap, soloTightFooter: false });
  });

  it('generates an independent native bulk batch and drops scheduled work on close', async () => {
    vi.useFakeTimers();
    try {
      const { page, timer } = fixture();
      timer.setManualScrambles('R U');
      page.openSheet(event({ sheet: 'settings' }));
      page.selectSettingsCategory({ detail: { value: '2' } } as WechatMiniprogram.PickerChange);
      page.openSettingsAction(event({ action: 'more.bulk' }));
      expect(page.data.sheet).toBe('bulk');
      expect(page.data.bulkCount).toBe('12');
      page.toggleBulkProjectMenu();
      page.selectProject(event({ id: 'custom' }));
      expect(page.data.bulkProjectMenu).toBeTruthy();
      page.selectProject(event({ id: '222' }));
      expect(page.data.bulkProjectMenu).toBeNull();
      expect(timer.event).toBe('333');
      page.toggleBulkProjectMenu();
      page.selectProject(event({ id: '333' }));

      page.inputBulkCount({ detail: { value: '101' } } as WechatMiniprogram.Input);
      expect(page.data.bulkCount).toBe('100');

      page.inputBulkCount({ detail: { value: '2' } } as WechatMiniprogram.Input);
      page.generateBulkScrambles();
      await vi.runAllTimersAsync();
      expect(page.data.bulkBatch).toMatchObject({ filename: 'cuberoot-scrambles-333-2.txt', rows: [{ number: '1)' }, { number: '2)' }] });
      expect((page.data.bulkBatch as { text: string }).text.split('\n')).toEqual([
        expect.stringMatching(/^1\) (?:[UDLRFB](?:['2])? ?){20}$/),
        expect.stringMatching(/^2\) (?:[UDLRFB](?:['2])? ?){20}$/),
      ]);
      expect(timer.scramble).toBe('R U');
      expect(timer.records).toEqual([]);

      page.generateBulkScrambles();
      page.inputBulkCount({ detail: { value: '3' } } as WechatMiniprogram.Input);
      await vi.runAllTimersAsync();
      expect(page.data.bulkBatch).toBeNull();
      expect(page.data.bulkGenerating).toBe(false);
      page.generateBulkScrambles();
      page.closeSheet();
      page.openSheet(event({ sheet: 'bulk' }));
      await vi.runAllTimersAsync();
      expect(page.data.bulkBatch).toBeNull();
      expect(page.data.bulkGenerating).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('previews an independent offset, discards cancelled touches, and commits the latest bounded drag', () => {
    const { page, timer } = fixture();
    const original = { ...timer.settings.soloLayout };
    const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 10, right: 200 });
    const bounds = [rect(80, 120), rect(20, 200), rect(30, 55), null, rect(155, 195)];
    let measure: ((rows: typeof bounds) => void) | undefined;
    Object.assign(page, { createSelectorQuery: () => ({
      select: () => ({ boundingClientRect: vi.fn() }),
      exec: (done: NonNullable<typeof measure>) => { measure = done; },
    }) });
    const touch = (clientY: number) => ({
      ...event({ region: 'timerGap', mode: 'move' }), touches: [{ identifier: 3, clientY }],
      changedTouches: [{ identifier: 3, clientY }],
    }) as WechatMiniprogram.TouchEvent;
    page.toggleLayout();
    page.startLayoutDrag(touch(100));
    page.moveLayoutDrag(touch(125));
    measure?.(bounds);
    expect(page.data.timerLayout).toEqual({ ...original, timerOffsetY: 25 });
    expect(timer.settings.soloLayout).toEqual(original);
    page.cancelLayoutDrag();
    expect(page.data.timerLayout).toEqual(original);
    page.startLayoutDrag(touch(100));
    page.moveLayoutDrag(touch(160));
    page.endLayoutDrag(touch(160));
    expect(timer.settings.soloLayout).toEqual(original);
    measure?.(bounds);
    expect(timer.settings.soloLayout).toEqual({ ...original, timerOffsetY: 35 });
    page.toggleLayout();
    expect(page.data.layoutEditing).toBe(false);
  });

  it('hides solo layout regions until reset without disabling the preview setting', () => {
    const { page, timer } = fixture();
    page.chooseSource(event({ source: 'manual' }));
    page.inputManualScrambles({ detail: { value: 'R U' } } as WechatMiniprogram.Input);
    page.finishManualScrambles();
    page.toggleLayout();
    expect(page.data.preview).toBeTruthy();
    page.hideLayoutRegion(event({ region: 'sourceGap' }));
    page.hideLayoutRegion(event({ region: 'cubeGap' }));
    expect(timer.settings.soloLayout).toMatchObject({ hideCompetitionInfo: true, hideCubePreview: true });
    expect(timer.settings.showCubePreview).toBe(true);
    expect(page.data.preview).toBe('');
    page.resetLayout();
    expect(timer.settings.soloLayout).toMatchObject({ hideCompetitionInfo: false, hideCubePreview: false });
    expect(page.data.preview).toBeTruthy();
  });

  it('applies the whole new cross difficulty range only on save', () => {
    const { page, timer } = fixture(true);
    const track = { left: 20, width: 140 };
    Object.assign(page, { createSelectorQuery: () => ({
      select: () => ({ boundingClientRect: vi.fn() }),
      exec: (done: (bounds: typeof track[]) => void) => done([track]),
    }) });
    page.openSheet(event({ sheet: 'difficulty' }));
    const range = page.data.difficultySlider as { min: number; max: number; low: number };
    const gesture = (type: string, value: number, identifier = 1) => ({
      type, changedTouches: [{ identifier, clientX: track.left + track.width * (value - range.min) / (range.max - range.min) }],
    }) as WechatMiniprogram.TouchEvent;
    page.difficultyTrackDown(gesture('touchstart', range.low));
    page.updateDifficultyTrack(gesture('touchmove', 5, 2));
    expect(page.data.difficultySlider).toMatchObject({ low: 4, high: 6 });
    page.updateDifficultyTrack(gesture('touchend', 5));
    expect(page.data.difficultySlider).toMatchObject({ low: 5, high: 6 });
    expect(timer.settings.wcaDifficultyOn).toBe(false);
    page.saveDifficulty();
    expect(timer.settings).toMatchObject({ wcaDifficultyOn: true, wcaDiffVariant: 'std', wcaDiffStage: 'cross', wcaDiffSteps: [5, 6] });
  });

  it('keeps difficulty method browsing and selected colors separate from the saved settings', () => {
    const { page, timer } = fixture(true);
    page.openSheet(event({ sheet: 'difficulty' }));
    page.toggleDifficultyMenu(event({ field: 'method' }));
    expect(page.data.difficultyOptionMethod).toBe('std');
    expect(page.data.difficultyStageOptions).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'cross' })]));
    page.chooseDifficultyMethod(event({ method: 'eo' }));
    expect(page.data.difficultyOptionMethod).toBe('eo');
    expect(page.data.difficultySelectedMethod).toBe('std');
    page.chooseDifficultyStage(event({ stage: 'eo' }));
    expect(page.data).toMatchObject({ difficultySelectedMethod: 'eo', difficultySelectedStage: 'eo', difficultyOptionPanel: '' });
    page.toggleDifficultyMenu(event({ field: 'colors' }));
    page.chooseDifficultyColor(event({ key: 'W' }));
    expect(page.data.difficultyColorKey).toBe('W');
    expect(timer.settings).toMatchObject({ wcaDifficultyOn: false, wcaDiffVariant: 'std', wcaDiffStage: 'cross' });
    page.saveDifficulty();
    expect(timer.settings).toMatchObject({ wcaDifficultyOn: true, wcaDiffVariant: 'eoline', wcaDiffStage: 'eo', wcaDiffColors: 'W' });
  });

  it('preserves a restored font scale between slider increments until explicitly changed', () => {
    const { page, timer } = fixture();
    timer.updateSettings({ timerFontScale: 1.23 });
    page.openSheet(event({ sheet: 'settings' }));
    const rows = page.data.settingRows as { key: string; value: number; valueText: string }[];
    const row = rows.find(row => row.key === 'timerFontScale')!;
    expect(row).toMatchObject({ value: 1.23, valueText: '123%' });
    expect(timer.settings.timerFontScale).toBe(1.23);
    selectSettingsCategory(page, 'appearance');
    page.changeSetting({ currentTarget: { dataset: { setting: row.key, kind: 'number-range' } }, detail: { value: 125 } } as unknown as WechatMiniprogram.SliderChange);
    expect(timer.settings.timerFontScale).toBe(1.25);
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
