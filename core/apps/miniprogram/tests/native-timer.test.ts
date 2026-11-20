import { describe, expect, it, vi } from 'vitest';
import { NativeTimer } from '../src/lib/native-timer';
import { isTimedWcaEvent } from '@cuberoot/shared/timer/seeded/wca';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { createTimerStoreData, decodeTimerStoreData } from '@cuberoot/shared/timer/persistence';
import { nativeTimerPreview } from '../src/lib/native-timer-preview';
import { nativeTimerEvents } from '../src/lib/native-timer';
import { renderUnfoldedSvgForEvent } from '@cuberoot/shared/cube-unfolded-svg';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer/export-cstimer';
import { createWcaScramblePool } from '@cuberoot/shared/timer/wca-scramble-pool';
import { createTimerWcaDifficultyDataAdapter } from '@cuberoot/shared/timer/wca-difficulty-data';
import { timerGoalProgress, timerRoundProgress, timerTargetIndicator } from '@cuberoot/shared/timer/training-view';
import { timerAttemptSplitChips } from '@cuberoot/shared/timer/attempt-splits';

function fixture() {
  const data = new Map<string, unknown>();
  const storage = { getStorageSync: (key: string) => data.get(key), setStorageSync: (key: string, value: unknown) => { data.set(key, structuredClone(value)); }, removeStorageSync: (key: string) => { data.delete(key); } };
  let now = 1000;
  const timer = new NativeTimer(storage, () => now);
  timer.nextScramble();
  return { timer, storage, data, at: (time: number) => { now = time; } };
}

function start(timer: NativeTimer) { timer.down(); timer.dispatch({ type: 'hold-ready' }); timer.up(); }

describe('native timer adapter', () => {
  it('marks CFOP stages and blind memo on the attempt clock and saves them to history', () => {
    const { timer, at, storage } = fixture();
    const chips = () => timerAttemptSplitChips(timer.attemptSplitState, timer.attemptSplitOptions, 2, copy => copy.zh, true);
    timer.setManualScrambles('R U\nF2\nD2');
    timer.updateSettings({ multiStage: true });
    timer.markAttemptSplit('cross');
    start(timer);
    expect(chips().stages.map(chip => chip.label)).toEqual(['十字', 'F2L', 'OLL']);
    at(2000);
    timer.markAttemptSplit('cross');
    at(2900);
    timer.markAttemptSplit('cross');
    timer.markAttemptSplit('f2l');
    expect(chips().stages[0]).toMatchObject({ time: '1.00', action: false });
    at(4500);
    timer.markAttemptSplit('oll');
    at(6000);
    timer.down();
    expect(timer.records[0].stages).toEqual({ cross: 1000, f2l: 1900, oll: 3500, pll: 5000 });

    timer.selectEvent('333bld');
    timer.setManualScrambles('R U\nF2');
    at(10000);
    start(timer);
    expect(chips()).toMatchObject({ stages: [], memo: [{ key: 'memo', action: true }] });
    at(14000);
    timer.markAttemptSplit('memo');
    expect(chips().memo).toMatchObject([{ time: '4.00', action: false }, { key: 'executing' }]);
    at(19000);
    timer.down();
    expect(timer.attemptSplitState).toEqual({ stages: {} });
    const reopened = new NativeTimer(storage);
    expect(reopened.records.find(solve => solve.event === '333bld')).toMatchObject({ bld: { memoMs: 4000 }, timeMs: 9000 });
    expect(reopened.records.find(solve => solve.event === '333')).toMatchObject({ stages: { cross: 1000, pll: 5000 } });
    reopened.dispose();
    timer.dispose();
  });

  it('shows target, daily goals and round progress from actual timer history and keeps the new-round boundary', () => {
    const { timer, at, storage } = fixture();
    const zh = (copy: { zh: string }) => copy.zh;
    const panel = () => timerRoundProgress(timer.trainingRoundSolves, timer.settings.round, timer.settings.targetMsByEvent['333'] ?? null, '333', 2, zh);
    timer.setManualScrambles('R U\nF2\nD2\nL2');
    timer.updateSettings({ targetMsByEvent: { '333': 9500 }, dailySolveGoal: 2,
      round: { ...timer.settings.round, on: true, format: 'mo3', cutoffMs: 10000, cutoffAttempts: 1, limitMs: 30000, cumulative: true } });
    start(timer);
    at(11000);
    expect(timerTargetIndicator(9500, timer.displayMilliseconds(), zh)).toMatchObject({ overshot: true, delta: '-0.50s' });
    timer.down();
    expect(panel()).toMatchObject({ count: '1/3', status: '未过关', reset: '新一轮' });
    timer.startTrainingRound();
    expect(panel()).toMatchObject({ count: '0/3', status: '待开始' });
    timer.manualEntry('9');
    expect(panel()).toMatchObject({ count: '1/3', status: '进行中', budget: { label: '累计余额 21.00' } });
    expect(timerGoalProgress(timer.records, timer.settings.dailySolveGoal)).toMatchObject({ count: 2, reached: true, percent: 100 });
    const reopened = new NativeTimer(storage);
    expect(reopened.settings).toMatchObject({ targetMsByEvent: { '333': 9500 }, dailySolveGoal: 2, round: { on: true, format: 'mo3', cumulative: true } });
    expect(reopened.trainingRoundSolves).toHaveLength(2);
    reopened.dispose();
    timer.dispose();
  });

  it('shares the live clock and current group without exposing private notes', () => {
    const { timer, at } = fixture();
    try {
      timer.setManualScrambles('R U');
      const empty = timer.liveShareSnapshot();
      expect(empty).toMatchObject({ state: { scramble: 'R U', phase: 'idle' }, history: [] });
      start(timer);
      at(1680);
      expect(timer.liveShareSnapshot().state).toMatchObject({ phase: 'running', elapsedMs: 680 });
      timer.down();
      const completed = timer.liveShareSnapshot();
      const solve = timer.records[0];
      expect(completed.history).toMatchObject([{ id: solve.id, timeMs: 680 }]);
      expect(timer.liveShareSnapshot().history).toBe(completed.history);
      timer.updateComment(solve.id, 'private');
      expect(timer.liveShareSnapshot().history[0]).not.toHaveProperty('comment');
      expect(timer.liveShareDetail(solve.id, completed.state.context)).not.toHaveProperty('comment');
      timer.createSession('Second group');
      expect(timer.liveShareSnapshot()).toMatchObject({ state: { sessionName: 'Second group' }, history: [] });
      expect(timer.liveShareDetail(solve.id, completed.state.context)).toBeNull();
    } finally { timer.releaseLiveShare(); timer.dispose(); }
  });

  it('uses the same dated solve set for statistics and distribution without counting DNF as finite', () => {
    const { timer } = fixture();
    const now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, 'now');
    try {
      timer.setManualScrambles('R U');
      timer.updateSettings({ precision: 2 });
      clock.mockReturnValue(now - 10 * 86_400_000);
      timer.manualEntry('10');
      clock.mockReturnValue(now);
      for (const input of ['12+2', '15', '20', '25', '30']) expect(timer.manualEntry(input)).toBe(true);
      timer.updatePenalty(timer.records.at(-1)!.id, 'DNF');
      const stats = timer.statistics('all', now);
      expect(stats).toMatchObject({ count: 6, solved: 5, best: '10.00', worst: 'DNF', mean: 'DNF' });
      expect(stats.distribution.reduce((count, bin) => count + bin.count, 0)).toBe(5);
      expect(stats.rows.find(row => row.key === 'mo3')?.current).toBe('DNF');
      expect(timer.statistics('7d', now)).toMatchObject({ count: 5, solved: 4, best: '14.00', distribution: [] });
      expect(timer.records).toHaveLength(6);
    } finally { clock.mockRestore(); timer.dispose(); }
  });

  it('persists shared display settings and clamps typography through the shared contract', () => {
    const { timer, storage } = fixture();
    timer.updateSettings({ compactScramble: true, hideAllUiWhileRunning: true, timerFontScale: 3, scrambleFontScale: 0.1 });
    const reopened = new NativeTimer(storage);
    expect(reopened.settings).toMatchObject({ compactScramble: true, hideAllUiWhileRunning: true, timerFontScale: 2, scrambleFontScale: 0.6 });
    timer.dispose(); reopened.dispose();
  });

  it('navigates retained scrambles and moves the original solve without changing its fields', () => {
    const { timer } = fixture();
    timer.setManualScrambles('R U\nF2\nD2');
    timer.nextScramble(); timer.previousScramble(); expect(timer.scramble).toBe('R U');
    timer.nextScramble(); expect(timer.scramble).toBe('F2');
    timer.manualEntry('12.34'); const solve = timer.records[0];
    const source = timer.sessions.activeSessionId;
    timer.createSession('Destination'); const target = timer.sessions.activeSessionId;
    timer.selectSession(source); expect(timer.moveResult(solve.id, target)).toBe(true);
    expect(timer.records).toHaveLength(0); timer.selectSession(target); expect(timer.records).toEqual([solve]);
    expect(JSON.parse(timer.exportCloudBackup()).settings).toBeUndefined();
    timer.dispose();
  });

  it('ignores stale external results and saves exactly once for each observed run', () => {
    const { timer, at } = fixture();
    const stopped = { type: 'timer', event: { state: 'STOPPED', solveTime: 12345 } } as const;
    timer.receiveExternal(stopped); expect(timer.records).toHaveLength(0);
    timer.receiveExternal({ type: 'status', phase: 'connected', deviceName: 'GAN Timer' });
    timer.receiveExternal({ type: 'timer', event: { state: 'RUNNING' } });
    at(99999); timer.receiveExternal(stopped); timer.receiveExternal(stopped);
    expect(timer.records).toHaveLength(1); expect(timer.records[0].timeMs).toBe(12345);
    timer.hide(); timer.receiveExternal({ type: 'timer', event: { state: 'RUNNING' } }); timer.receiveExternal(stopped);
    expect(timer.records).toHaveLength(1); timer.dispose();
  });

  it('preserves a manual solve when a pending external link drops', () => {
    const { timer, at } = fixture();
    timer.setManualScrambles('R U');
    start(timer);
    timer.receiveExternal({ type: 'status', phase: 'disconnected' });
    timer.receiveExternal({ type: 'timer', event: { state: 'DISCONNECT' } });
    expect(timer.state.phase).toBe('running');
    at(4000);
    timer.down();
    expect(timer.records.map(result => [result.timeMs, result.penalty])).toEqual([[3000, 'ok']]);
    timer.dispose();
  });

  it('keeps late official responses out of a newly selected manual source', async () => {
    let deliver!: (value: { ok: boolean; status: number; json(): Promise<unknown> }) => void;
    const fetcher = () => new Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>(resolve => { deliver = resolve; });
    const pool = createWcaScramblePool({ apiUrl: p => p, fetcher, loadCompetition: async () => [], loadExamples: async () => null,
      difficulty: createTimerWcaDifficultyDataAdapter({ apiUrl: p => p, statsUrl: p => p, fetcher }), storage: () => null });
    const { storage } = fixture(); const timer = new NativeTimer(storage, () => 1000, pool);
    timer.useWcaScrambles(); expect(timer.loading).toBe(true); expect(timer.manualEntry('10')).toBe(false);
    timer.setManualScrambles('D2');
    deliver({ ok: true, status: 200, json: async () => ({ scrambles: [{ scramble: 'R U', ci: 'Fixture2026', cn: 'Fixture', e: '333', r: '1', g: 'A', n: 1, x: 0 }] }) });
    await vi.waitFor(() => expect(timer.loading).toBe(false));
    expect(timer.scramble).toBe('D2'); expect(timer.currentSource).toBe('manual');
    expect(timer.sourceLine).toBe(''); timer.dispose();
  });

  it('sends the selected cross difficulty to the official scramble pool', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true, status: 200, json: async () => ({
        scrambles: [{ scramble: 'R U', ci: 'Fixture2026', cn: 'Fixture', e: '333', r: '1', g: 'A', n: 1, x: 0 }],
      }),
    }));
    const pool = createWcaScramblePool({ apiUrl: path => path, fetcher, loadCompetition: async () => [], loadExamples: async () => null,
      difficulty: createTimerWcaDifficultyDataAdapter({ apiUrl: path => path, statsUrl: path => path, fetcher }), storage: () => null });
    const { storage } = fixture();
    const timer = new NativeTimer(storage, () => 1000, pool);
    try {
      timer.updateSettings({ wcaDifficultyOn: true, wcaDiffVariant: 'std', wcaDiffStage: 'cross', wcaDiffSteps: [4, 5, 6] });
      timer.useWcaScrambles();
      await vi.waitFor(() => expect(timer.scramble).toBe('R U'));
      const request = fetcher.mock.calls.find(([url]) => url.startsWith('/v1/wca/scrambles/random?'))?.[0];
      const query = new URL(request ?? '/', 'https://example.test').searchParams;
      expect(query.get('variant')).toBe('std');
      expect(query.get('stage')).toBe('cross');
      expect(query.get('steps')).toBe('4,5,6');
    } finally { timer.dispose(); }
  });

  it.each(nativeTimerEvents().filter(({ id }) => isTimedWcaEvent(id) || id === '333fm'))('draws $id locally', (event) => {
    const { timer } = fixture();
    try {
      timer.selectEvent(event.id);
      const svg = decodeURIComponent(nativeTimerPreview(event.id, timer.scramble).split(',').slice(1).join(','));
      expect(svg, event.id).toContain('<svg');
      expect(svg, event.id).toContain('</svg>');
    } finally { timer.dispose(); }
  });

  it('retains the canonical NxN image bytes', () => {
    expect(decodeURIComponent(nativeTimerPreview('333', "R U R'").split(',')[1])).toBe(renderUnfoldedSvgForEvent('333', "R U R'"));
  });

  it('keeps manual queue identities, session contents and precision across native edits', () => {
    const { timer, storage } = fixture();
    const first = timer.sessions.activeSessionId;
    timer.setManualScrambles("R U\nF2");
    expect(timer.scramble).toBe('R U');
    expect(timer.manualEntry('12.345+2')).toBe(true);
    expect(timer.scramble).toBe('F2');
    expect(timer.records[0]).toMatchObject({ timeMs: 12345, penalty: '+2', scramble: 'R U', scrambleSource: { kind: 'manual' } });
    const identity = timer.records[0].scrambleSource!.identity;
    timer.setManualScrambles('D2'); timer.manualEntry('1:02.34');
    expect(timer.records[1].scrambleSource!.identity).not.toBe(identity);
    timer.updateSettings({ precision: 2, showCubePreview: false });
    expect(timer.summary().rows[1].result).toBe('14.34');
    timer.createSession('Second'); expect(timer.records).toHaveLength(0);
    timer.manualEntry('5.67'); timer.selectSession(first);
    expect(timer.records).toHaveLength(2);
    expect(new NativeTimer(storage).settings.showCubePreview).toBe(false);
    expect(new NativeTimer(storage).records).toHaveLength(2);
  });

  it('imports into new groups, rejects invalid restoration, and preserves a pre-restore backup', () => {
    const { timer, data } = fixture();
    timer.manualEntry('12.34');
    const original = timer.exportBackup();
    const text = exportTimerCstimerJson({ '333': timer.records }).json;
    expect(timer.importCstimer(text)).toBe(true);
    expect(timer.sessions.sessions).toHaveLength(2);
    expect(timer.records).toHaveLength(1);
    expect(timer.restoreBackup('{broken')).toBe(false);
    expect(timer.sessions.sessions).toHaveLength(2);
    expect(timer.restoreBackup(original)).toBe(true);
    expect(timer.sessions.sessions).toHaveLength(1);
    expect(data.get('cuberoot:timer:before-restore')).toContain('import-');
  });

  it('projects live facelets through the shared tracker and clears stale images on disconnect', () => {
    const { timer } = fixture();
    timer.receiveCube({ type: 'status', phase: 'connecting' });
    timer.receiveCube({ type: 'state', facelets: smartCubeTargetFacelets('')! });
    timer.receiveCube({ type: 'status', phase: 'connected' });
    timer.receiveCube({ type: 'move', move: 'R', deviceTs: 100 });
    expect(timer.facelets).toBe(smartCubeTargetFacelets('R'));
    expect(nativeTimerPreview('333', '', timer.facelets)).not.toBe(nativeTimerPreview('333', ''));
    timer.receiveCube({ type: 'status', phase: 'disconnected' });
    expect(timer.facelets).toBeNull();
  });
  it('reads and updates the existing shared settings without a second preference store', () => {
    const { storage, data } = fixture();
    const original = createTimerStoreData(1000, 'existing', 'en');
    original.settings.inspectionSec = 15;
    original.settings.holdMs = 750;
    original.settings.scrambleClickAction = 'none';
    storage.setStorageSync('cuberoot:timer', original);
    const timer = new NativeTimer(storage);
    expect(timer.settings).toEqual(original.settings);
    timer.updateSettings({ holdMs: 900, scrambleClickAction: 'copy' });
    const saved = decodeTimerStoreData(data.get('cuberoot:timer'))!;
    expect(saved.settings).toEqual({ ...original.settings, holdMs: 900, scrambleClickAction: 'copy' });
    expect(data.has('cuberoot:native-timer:preferences')).toBe(false);
  });

  it('retires preview-only settings once without losing choices or overriding later edits', () => {
    const { storage, data } = fixture();
    storage.setStorageSync('cuberoot:native-timer:preferences', { event: '222', settings: { inspectionSec: 15, holdMs: 300, scrambleTap: 'next' } });
    const timer = new NativeTimer(storage);
    expect(timer.settings).toMatchObject({ event: '222', inspectionSec: 15, holdMs: 300, scrambleClickAction: 'next' });
    expect(data.has('cuberoot:native-timer:preferences')).toBe(false);
    timer.updateSettings({ scrambleClickAction: 'copy' });
    expect(new NativeTimer(storage).settings.scrambleClickAction).toBe('copy');
  });

  it('saves results on a fresh Douyin install even when reading an absent key would throw', () => {
    const data = new Map<string, unknown>();
    const timer = new NativeTimer({
      getStorageInfoSync: () => ({ keys: [...data.keys()] }),
      getStorageSync: () => { throw new Error('key not found'); },
      setStorageSync: (key, value) => { data.set(key, value); },
      removeStorageSync: key => { data.delete(key); },
    });
    timer.nextScramble(); start(timer); timer.down();
    expect(timer.error).toBe('');
    expect(data.has('cuberoot:timer')).toBe(true);
  });
  it('cancels a short touch; starts on release after ready and persists the original scramble once', () => {
    const { timer, storage, at } = fixture();
    const scramble = timer.scramble;
    timer.down(); timer.up();
    expect(timer.state.phase).toBe('idle');
    timer.down(); timer.dispatch({ type: 'hold-ready' }); timer.up();
    at(2234); timer.down(); timer.up();
    expect(timer.records).toHaveLength(1);
    expect(timer.records[0]).toMatchObject({ timeMs: 1234, scramble, penalty: 'ok' });
    expect(new NativeTimer(storage).records).toEqual(timer.records);
    timer.updatePenalty(timer.records[0].id, '+2');
    expect(new NativeTimer(storage).records[0].penalty).toBe('+2');
  });

  it('uses the shared inspection penalty when holding and releasing to start', () => {
    const { timer, at } = fixture();
    timer.settings.inspectionSec = 15;
    start(timer);
    expect(timer.state.phase).toBe('inspecting');
    at(17000); start(timer);
    expect(timer.state.phase).toBe('running');
    at(19000); timer.down();
    expect(timer.records[0]).toMatchObject({ timeMs: 2000, penalty: '+2' });
  });

  it('marks an interrupted run DNF and cannot record while the timer is hidden', () => {
    const { timer, at } = fixture();
    start(timer); at(2500); timer.hide();
    expect(timer.records[0]).toMatchObject({ timeMs: 1500, penalty: 'DNF' });
    timer.receiveCube({ type: 'state', facelets: smartCubeTargetFacelets(timer.scramble)! });
    expect(timer.state.phase).toBe('stopped');
  });

  it('arms only on matching cube state, starts on first move and stops on solved state', () => {
    const { timer, at } = fixture();
    timer.setManualScrambles('F R U');
    timer.updateSettings({ multiStage: true });
    timer.receiveCube({ type: 'move', move: 'R', deviceTs: 1000 });
    expect(timer.state.phase).toBe('idle');
    timer.receiveCube({ type: 'status', phase: 'connecting', brand: 'gan-v4' });
    timer.receiveCube({ type: 'state', facelets: smartCubeTargetFacelets(timer.scramble + " R'")! });
    timer.receiveCube({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    expect(timer.state.phase).toBe('idle');
    timer.receiveCube({ type: 'move', move: 'R', deviceTs: 1000 });
    expect(timer.state.phase).toBe('ready');
    const inverse = timer.scramble.split(/\s+/).reverse().map(m => m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'");
    inverse.forEach((move, index) => { at(2000 + index * 100); timer.receiveCube({ type: 'move', move, deviceTs: 2000 + index * 100 }); });
    expect(timer.records).toHaveLength(1);
    expect(timer.records[0].timeMs).toBe((inverse.length - 1) * 100);
    expect(timer.records[0].penalty).toBe('ok');
    expect(timer.records[0].moves?.map(m => m.m)).toEqual(inverse);
    expect(timer.records[0].moves?.[0].ts).toBe(0);
    expect(timer.records[0].stages).toEqual({ cross: 100, f2l: 100, oll: 100, pll: 200 });
  });

  it('uses device move time for batched BLE turns rather than notification arrival time', () => {
    const { timer, at } = fixture();
    timer.receiveCube({ type: 'status', phase: 'connected', brand: 'gan-v4', deviceName: 'GAN16' });
    timer.receiveCube({ type: 'state', facelets: smartCubeTargetFacelets(timer.scramble + " R'")! });
    timer.receiveCube({ type: 'move', move: 'R', deviceTs: 1000 });
    const inverse = timer.scramble.split(/\s+/).reverse().map(m => m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'");
    at(2500);
    inverse.forEach((move, i) => timer.receiveCube({ type: 'move', move, deviceTs: 1100 + i * 50 }));
    expect(timer.records[0].timeMs).toBe((inverse.length - 1) * 50);
    expect(timer.records[0].device).toEqual({ model: 'gan-v4', name: 'GAN16' });
    expect(timer.records[0].moves?.at(-1)?.ts).toBe((inverse.length - 1) * 50);
  });

  it('retains the original native database and other sessions when adding a result', () => {
    const { storage, data } = fixture();
    const original = createTimerStoreData(1000, 'original', 'zh');
    storage.setStorageSync('cuberoot:timer', original);
    const timer = new NativeTimer(storage);
    timer.nextScramble(); start(timer); timer.down();
    expect((data.get('cuberoot:timer') as typeof original).database.activeSessionId).toBe('original');
    expect(timer.records).toHaveLength(1);
  });

  it('never overwrites unreadable storage when saving its recovery copy fails', () => {
    let writes = 0;
    const timer = new NativeTimer({ getStorageSync: () => '{broken', setStorageSync: () => { ++writes; throw new Error('full'); }, removeStorageSync: () => {}  });
    timer.nextScramble(); start(timer); timer.down();
    expect(writes).toBe(1);
    expect(timer.error).toContain('不会被覆盖');
  });
});
