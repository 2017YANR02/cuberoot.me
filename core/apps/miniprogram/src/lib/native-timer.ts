import { initialTimerMachineState, transitionTimer, type TimerMachineAction } from '@cuberoot/shared/timer/machine';
import { formatTimerTimingDisplay } from '@cuberoot/shared/timer/timing-display';
import { activeTimerSolves, serializeTimerStoreData, parseTimerStoreJson, type TimerStoreData, type TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';
import { planTimerImport, appendTimerImportSessions } from '@cuberoot/shared/timer/import-timer';
import { createTimerSourceRevision, advanceTimerSourceRevision, timerManualSourceIdentity } from '@cuberoot/shared/timer/source-revision';
import { updateTimerHistorySolve, deleteTimerHistorySolve, filterTimerHistorySolves, createTimerHistoryFilters } from '@cuberoot/shared/timer/history';
import { histPush, histBack, histForward, type ScrambleHistory } from '@cuberoot/shared/timer/scramble-history';
import { rollingStatCurrent, rollingStatBest, ROLLING_STAT_PRESETS } from '@cuberoot/shared/timer/rolling-stats';
import type { createWcaScramblePool, WcaSourceSpec, WcaDispensedScramble } from '@cuberoot/shared/timer/wca-scramble-pool';
import { timerWcaScrambleSourceLine, resolveTimerWcaSourceCore, normalizeTimerWcaSourceCoreSettings } from '@cuberoot/shared/timer/wca-source-config';
import { localizeCompName } from '@cuberoot/shared/comp-localize';
import { normalizeTimerTimingSettings, normalizeTimerScrambleClickAction, normalizeTimerScramblePreviewSettings } from '@cuberoot/shared/timer/settings-contract';
import { normalizeTimerDisplaySettings } from '@cuberoot/shared/timer/display-settings';
import { normalizeTimerTypography } from '@cuberoot/shared/timer/typography';
import { timerCanSwitchScramble, timerCanHandleAttemptPress } from '@cuberoot/shared/timer/input-contract';
import { activateTimerSession, createAndActivateTimerSession, renameTimerSession, deleteTimerSession, clearTimerSession, timerSessionSnapshot, timerSessionSelectedEvent, TIMER_SESSION_UI_COPY, type TimerSessionMutationResult, selectTimerEventSession, moveTimerSolveToSession } from '@cuberoot/shared/timer/session';
import { parseTimerEntry } from '@cuberoot/shared/timer/manual-entry';
import { parseManualScrambleQueue, takeManualScramble } from '@cuberoot/shared/timer/manual-scramble-queue';
import { averageOfN, bestSingle, meanOfAll, meanOfN, worstSingle, stdDev, formatMs, formatSolveResult, buildTimerHistogramBuckets } from '@cuberoot/shared/timer/stats';
import { filterSolvesByStatsDateRange, type TimerStatsDateRange } from '@cuberoot/shared/timer/stats-buckets';
import { EVENTS, effectiveMs, type Penalty, type Solve } from '@cuberoot/shared/timer/types';
import { generateTimedWcaScramble, isTimedWcaEvent, type TimedWcaEvent } from '@cuberoot/shared/timer/seeded/wca';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { SmartCubeSessionController, type SmartCubeSessionLease } from '@cuberoot/shared/smart-cube/session';
import { SmartCubeSoloTimerController } from '@cuberoot/shared/smart-cube/solo-timer';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import type { SmartCubeRelayEvent } from '@cuberoot/shared/smart-cube/relay';
import { getMiniProgramLocale, tr } from './i18n';
import { appendTimerSolve, loadOrCreateTimerStore } from './timer-store';

const KEY = 'cuberoot:timer';
const LEGACY_SETTINGS_KEY = 'cuberoot:native-timer:preferences';
export type NativeTimerEvent = TimedWcaEvent;
export function nativeTimerEvents() {
  return EVENTS.filter(e => isTimedWcaEvent(e.id)).map(e => ({ id: e.id as NativeTimerEvent, name: tr({ en: e.nameEn, zh: e.nameZh }) }));
}
export interface NativeTimerStorage {
  getStorageSync(key: string): unknown;
  getStorageInfoSync?(): { keys: string[] };
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}
/** Mini Program storage/lifecycle adapter. Timing, penalties, statistics and generators remain shared. */
export class NativeTimer {
  state = initialTimerMachineState();
  scramble = '';
  private store: TimerStoreData;
  private storageReadable = true;
  error = '';
  visible = true;
  cubeConnected = false;
  cubeKnown = false;
  canResetCube = false;
  calibrating = false;
  externalConnected = false;
  externalName = '';
  private externalRunning = false;
  private readonly recording = new SmartCubeAttemptProducer();
  private readonly solo: SmartCubeSoloTimerController;
  private readonly cube: SmartCubeSessionController<{ futureHistory?: boolean }>;
  private lease?: SmartCubeSessionLease<{ futureHistory?: boolean }>;
  private device?: { model: string; name: string };
  private lastPenalty: Penalty | null = null;
  private lastSolveId = '';
  private generation = 0;
  private manualCursor = 0;
  private source: 'manual' | 'random' | 'wca' = 'random';
  loading = false;
  private wcaRequest?: { cancel(): void };
  private sourceGeneration = 0;
  private wcaRow: WcaDispensedScramble | null = null;
  private scrambleHistory: ScrambleHistory<{ scramble: string; row: WcaDispensedScramble | null }> = { list: [], idx: -1 };
  private historyIdentity = '';
  historyFilters = createTimerHistoryFilters();
  get canPrevious() { return this.scrambleHistory.idx > 0; }
  previousScramble() {
    if (this.busy || this.loading) return;
    const previous = histBack(this.scrambleHistory);
    if (previous) this.showHistory(previous);
  }
  private showHistory(history: typeof this.scrambleHistory) {
    this.scrambleHistory = history;
    const entry = history.list[history.idx]!;
    this.wcaRow = entry.row; this.setScramble(this.event, entry.scramble, false);
  }
  private wcaSpec(): WcaSourceSpec {
    const s = this.settings;
    return { event: this.event, ...resolveTimerWcaSourceCore(s), optimal: s.wcaUseOptimal };
  }
  get sourceLine() {
    const m = this.wcaRow?.meta;
    return this.source === 'wca' && m ? `${localizeCompName(m.ci, m.cn || m.ci, getMiniProgramLocale() === 'zh')} · ${timerWcaScrambleSourceLine(m.r, m.g, m.n, !!m.x)}` : '';
  }
  private manualSource = createTimerSourceRevision(`native-${Date.now()}`);
  private get sourceSnapshot() { return { kind: this.source, identity: this.source === 'manual' ? timerManualSourceIdentity(this.event, this.manualSource) : this.source === 'wca' ? this.wca?.sourceKey(this.wcaSpec()) ?? `wca|${this.event}` : `random|${this.event}` }; }
  onChange?: () => void;
  get facelets() { return this.cubeKnown ? this.cube.getFacelets() : null; }
  get guidance() { return this.solo.getGuidanceSnapshot(); }
  get sessions() { return timerSessionSnapshot(this.store.database); }
  get currentSource() { return this.source; }
  private applySession(result: TimerSessionMutationResult, select = false) {
    if (this.busy || result.failure) return false;
    this.store.database = result.database;
    if (select) {
      const event = timerSessionSelectedEvent(result.database, result.activeSessionId, this.event, this.settings.autoEventForSession);
      if (isTimedWcaEvent(event)) this.settings.event = event;
      this.state = initialTimerMachineState(); this.lastPenalty = null; this.nextScramble();
    }
    this.persist(); return true;
  }
  selectSession(id: string) { return this.applySession(activateTimerSession(this.store.database, id), true); }
  createSession(name: string) {
    return this.applySession(createAndActivateTimerSession(this.store.database, {
      id: `session-${Date.now()}-${++this.generation}`, name, createdTs: Date.now(), event: this.event,
      fallbackName: tr(TIMER_SESSION_UI_COPY.newSessionDefault),
    }), true);
  }
  renameSession(name: string) { return this.applySession(renameTimerSession(this.store.database, this.store.database.activeSessionId, name)); }
  deleteSession() { return this.applySession(deleteTimerSession(this.store.database, this.store.database.activeSessionId), true); }
  clearSession() { return this.applySession(clearTimerSession(this.store.database, this.store.database.activeSessionId), true); }
  moveResult(id: string, target: string) { return this.applySession(moveTimerSolveToSession(this.store.database, id, target)); }
  manualEntry(input: string) {
    if (this.busy || this.loading || !this.scramble) return false;
    const entry = parseTimerEntry(input);
    if (!entry) return false;
    this.store = appendTimerSolve(this.store, { id: `manual-${Date.now()}-${++this.generation}`, ts: Date.now(),
      event: this.event, timeMs: entry.ms, penalty: entry.penalty, scramble: this.scramble,
      scrambleSource: this.sourceSnapshot });
    this.persist(); this.nextScramble(); return true;
  }
  setManualScrambles(text: string) {
    if (this.busy) return;
    this.settings.manualScrambles = text; this.manualCursor = 0;
    this.manualSource = advanceTimerSourceRevision(this.manualSource, text);
    this.source = parseManualScrambleQueue(text).length ? 'manual' : 'random';
    this.persist(); this.nextScramble();
  }
  useRandomScrambles() { if (!this.busy) { this.source = 'random'; this.nextScramble(); } }
  useWcaScrambles() { if (!this.busy && this.wca) { this.source = 'wca'; this.nextScramble(); } }
  exportBackup() { return serializeTimerStoreData(this.store); }
  exportCloudBackup() { return JSON.stringify(this.store.database); }
  restoreBackup(text: string) {
    if (this.busy || !this.storageReadable) return false;
    const next = parseTimerStoreJson(text, this.settings);
    if (!next) return false;
    try { this.storage.setStorageSync(`${KEY}:before-restore`, this.exportBackup()); }
    catch { return false; }
    const previous = this.store;
    this.store = next;
    if (!this.persist()) { this.store = previous; return false; }
    this.state = initialTimerMachineState(); this.lastPenalty = null; this.nextScramble(); return true;
  }
  importCstimer(text: string) {
    if (this.busy || !this.storageReadable) return false;
    const parsed = parseCstimerExport(text, () => `solve-${Date.now()}-${++this.generation}`), plan = planTimerImport(parsed);
    if (!parsed.length || plan.unresolvedSessionIds.length) return false;
    const previous = this.store.database;
    this.store.database = appendTimerImportSessions(previous, plan.sessions, {
      createId: () => `import-${Date.now()}-${++this.generation}`, now: Date.now, defaultName: tr(TIMER_SESSION_UI_COPY.newSessionDefault),
    });
    if (!this.persist()) { this.store.database = previous; return false; }
    return true;
  }
  updateComment(id: string, comment: string) {
    if (this.busy) return;
    this.replaceRecords([...updateTimerHistorySolve(this.records, id, { comment: comment.trim() || undefined }).solves]); this.persist();
  }
  constructor(private storage: NativeTimerStorage, private now = () => Date.now(), private readonly wca?: ReturnType<typeof createWcaScramblePool>) {
    this.store = loadOrCreateTimerStore(null, { nowMs: Date.now(), id: `session-${Date.now()}`, language: getMiniProgramLocale() }).data;
    this.solo = new SmartCubeSoloTimerController({
      onGuidanceChange: () => this.onChange?.(),
      armFromCube: atMs => this.dispatch({ type: 'arm-from-cube', nowMs: this.now(), atMs }),
      autoReadyOnScramble: () => this.settings.bluetoothAutoReady === 'scrambled',
      canStartAttempt: () => this.visible && this.cubeKnown && Boolean(this.scramble),
      getPhase: () => this.state.phase,
      isTimingEnabled: () => this.visible && this.settings.timingEnabled,
      solve: async () => null,
      recordMove: e => { this.recording.recordMove(e.move, e.timestamp); },
      startFromCube: atMs => this.dispatch({ type: 'start-from-cube', nowMs: this.now(), atMs }),
      stopFromCube: atMs => this.dispatch({ type: 'stop-from-cube', nowMs: this.now(), atMs }),
    });
    this.cube = new SmartCubeSessionController<{ futureHistory?: boolean }>({
      now: this.now,
      onChange: () => this.onChange?.(),
      onMove: e => { if (this.visible) this.solo.move(e); },
      onSolved: atMs => { if (this.visible) this.solo.solved(atMs); },
    });
    try {
      // Douyin can throw for absent keys; a successful inventory distinguishes a fresh install from a read failure.
      const keys = storage.getStorageInfoSync?.().keys;
      const read = (key: string) => keys && !keys.includes(key) ? undefined : storage.getStorageSync(key);
      const raw = read(KEY);
      const loaded = loadOrCreateTimerStore(raw, { nowMs: Date.now(), id: `session-${Date.now()}`, language: getMiniProgramLocale() });
      if (loaded.recoveredFromCorruption) {
        storage.setStorageSync(`${KEY}:recovery`, raw);
        this.error = tr({ en: 'Unreadable results were preserved in a recovery copy.', zh: '异常成绩数据已保留恢复副本。' });
      }
      this.store = loaded.data;
      // Preserve choices from the unreleased preview once, then retire its separate settings key.
      const saved = read(LEGACY_SETTINGS_KEY) as { event?: string; settings?: { inspectionSec?: number; holdMs?: number; scrambleTap?: string } } | null;
      if (saved?.settings) {
        Object.assign(this.store.settings, normalizeTimerTimingSettings({ ...this.settings, ...saved.settings }), {
          scrambleClickAction: normalizeTimerScrambleClickAction(saved.settings.scrambleTap),
        });
        if (saved.event && isTimedWcaEvent(saved.event)) this.store.settings.event = saved.event;
        storage.setStorageSync(KEY, this.store);
        storage.removeStorageSync(LEGACY_SETTINGS_KEY);
      }
    } catch { this.storageReadable = false; this.error = tr({ en: 'Unable to read local results. Existing data will not be overwritten.', zh: '读取本机成绩失败，原有数据不会被覆盖。' }); }
  }
  get event(): NativeTimerEvent { return isTimedWcaEvent(this.settings.event) ? this.settings.event : '333'; }
  get settings(): TimerStoreSettings { return this.store.settings; }
  updateSettings(patch: Partial<TimerStoreSettings>) {
    if (this.busy) return;
    this.store.settings = { ...this.settings, ...patch, ...normalizeTimerTimingSettings({ ...this.settings, ...patch }),
      ...normalizeTimerScramblePreviewSettings({ ...this.settings, ...patch }),
      ...normalizeTimerDisplaySettings({ ...this.settings, ...patch }),
      ...normalizeTimerTypography({ ...this.settings, ...patch }),
      ...normalizeTimerWcaSourceCoreSettings({ ...this.settings, ...patch }),
      scrambleClickAction: normalizeTimerScrambleClickAction(patch.scrambleClickAction ?? this.settings.scrambleClickAction) };
    this.persist();
    if (this.source === 'wca' && Object.keys(patch).some(key => key.startsWith('wca'))) this.nextScramble();
  }
  get records(): Solve[] { return Object.values(this.store.database.dataBySession[this.store.database.activeSessionId] ?? {}).flatMap(solves => solves ?? []); }
  private replaceRecords(records: Solve[]) {
    const byEvent: Partial<Record<Solve['event'], Solve[]>> = {};
    for (const solve of records) (byEvent[solve.event] ??= []).push(solve);
    this.store.database.dataBySession[this.store.database.activeSessionId] = byEvent;
  }
  get busy() { return !timerCanSwitchScramble(this.state.phase); }
  get solves() { return activeTimerSolves(this.store, this.event); }
  get lastResult() { return this.solves.find(s => s.id === this.lastSolveId) ?? null; }
  display() {
    const now = this.now();
    return formatTimerTimingDisplay({ ...this.settings,
      displayMs: this.state.startedAtMs === null ? this.state.lastMs ?? 0 : Math.max(0, now - this.state.startedAtMs),
      inspectionDisplayMs: this.state.inspectionStartedAtMs === null ? 0 : Math.max(0, now - this.state.inspectionStartedAtMs),
      inspectionLimitSec: this.settings.inspectionSec, phase: this.state.phase, lastPenalty: this.lastPenalty });
  }
  summary(limit = 100) {
    const solves = this.solves;
    const filtered = filterTimerHistorySolves(solves, this.historyFilters).solves;
    return { count: solves.length, solved: solves.filter(s => Number.isFinite(effectiveMs(s))).length,
      mean: formatMs(meanOfAll(solves), this.settings.precision), mo3: formatMs(meanOfN(solves, 3), this.settings.precision),
      filteredCount: filtered.length, best: formatMs(bestSingle(solves), this.settings.precision), ao5: formatMs(averageOfN(solves, 5), this.settings.precision), ao12: formatMs(averageOfN(solves, 12), this.settings.precision),
      rows: filtered.slice(0, limit).map(s => ({ id: s.id, result: formatSolveResult(s, this.settings.precision), scramble: s.scramble, penalty: s.penalty, comment: s.comment ?? '' })) };
  }
  statistics(range: TimerStatsDateRange = 'all', now = Date.now()) {
    const solves = filterSolvesByStatsDateRange(this.solves, range, now);
    const f = (value: number | null) => formatMs(value, this.settings.precision);
    const finite = solves.map(effectiveMs).filter(Number.isFinite);
    const buckets = buildTimerHistogramBuckets(finite, 12);
    const peak = Math.max(1, ...buckets.map(b => b.count));
    return {
      count: solves.length, solved: finite.length,
      mean: f(meanOfAll(solves)), best: f(bestSingle(solves)), worst: f(worstSingle(solves)), sd: f(stdDev(solves)),
      rows: ROLLING_STAT_PRESETS.map(key => ({ key, current: f(rollingStatCurrent(solves, key)), best: f(rollingStatBest(solves, key)) })),
      distribution: finite.length < 5 ? [] : buckets.map((b, index) => ({
        ...b, index, height: b.count / peak * 100,
        label: `${f(b.lo)} – ${f(b.hi)}: ${b.count}`,
      })),
      distributionMin: buckets.length ? f(buckets[0].lo) : '',
      distributionMax: buckets.length ? f(buckets[buckets.length - 1].hi) : '',
    };
  }
  persist() {
    if (!this.storageReadable) return false;
    try {
      this.storage.setStorageSync(KEY, this.store);
      this.error = ''; return true;
    } catch { this.error = tr({ en: 'Results are in memory only. Storage is full or unavailable; export them before closing.', zh: '成绩暂存于内存，本机存储已满或不可用；请在关闭前导出。' }); return false; }
  }
  nextScramble() {
    if (this.busy) return;
    this.wcaRequest?.cancel(); this.wca?.cancelSource(); this.loading = false; this.wcaRow = null;
    const generation = ++this.sourceGeneration;
    const identity = this.sourceSnapshot.identity;
    if (identity !== this.historyIdentity) {
      this.historyIdentity = identity; this.scrambleHistory = { list: [], idx: -1 };
    } else {
      const forward = histForward(this.scrambleHistory);
      if (forward) { this.showHistory(forward); return; }
    }
    if (this.source === 'wca' && this.wca) {
      this.loading = true; this.error = ''; this.setScramble(this.event, '');
      const run = this.wcaRequest = this.wca.startNext(this.wcaSpec());
      void run.result.then(result => {
        if (generation !== this.sourceGeneration || !this.visible) return;
        this.loading = false;
        if (result.kind === 'ready') { this.wcaRow = result.value; this.setScramble(this.event, result.value.scramble); }
        else if (result.kind !== 'cancelled') this.error = tr(result.kind === 'confirmed-empty'
          ? { en: 'No official scrambles for this selection.', zh: '当前条件没有比赛真题。' }
          : { en: 'Official scrambles could not be loaded. Please retry.', zh: '比赛真题加载失败，请重试。' });
        this.onChange?.();
      });
      this.onChange?.(); return;
    }
    if (this.source === 'manual') {
      const next = takeManualScramble(parseManualScrambleQueue(this.settings.manualScrambles), this.manualCursor);
      if (next.scramble) { this.manualCursor = next.nextCursor; this.setScramble(this.event, next.scramble); return; }
      this.source = 'random';
    }
    this.setScramble(this.event, generateTimedWcaScramble(this.event, Math.random, this.settings.scramble222Mode));
  }
  private setScramble(event: NativeTimerEvent, scramble: string, remember = true) {
    this.scramble = scramble;
    if (remember && scramble) this.scrambleHistory = histPush(this.scrambleHistory, { scramble, row: this.wcaRow });
    this.solo.setContext({ event, scramble, id: ++this.generation,
      targetFacelets: event === '333' || event === '333oh' ? smartCubeTargetFacelets(scramble) : null });
  }
  selectEvent(event: string) {
    if (this.busy || !isTimedWcaEvent(event)) return;
    this.store.database = selectTimerEventSession(this.store.database, event, this.settings.autoSessionForEvent).database;
    this.settings.event = event;
    this.state = initialTimerMachineState(); this.lastPenalty = null;
    this.nextScramble(); this.persist();
  }
  dispatch(action: TimerMachineAction) {
    if (!this.scramble && action.type !== 'reset') return false;
    const before = this.state;
    const result = transitionTimer(this.state, action, { inspectionSec: this.settings.inspectionSec });
    this.state = result.state;
    if (result.effects.includes('run-started') && this.cubeConnected) this.recording.begin(this.state.startedAtMs ?? this.now(), this.device);
    this.solo.setRunning(this.state.phase === 'running');
    if (result.solve) {
      this.lastPenalty = result.solve.autoPenalty;
      this.lastSolveId = `${Date.now()}-${++this.generation}-${Math.random().toString(36).slice(2, 9)}`;
      this.store = appendTimerSolve(this.store, { id: this.lastSolveId,
        ts: Date.now(), event: this.event, scramble: this.scramble, timeMs: result.solve.timeMs,
        penalty: result.solve.autoPenalty, inspectionMs: result.solve.inspectionMs || undefined,
        ...this.recording.finishSolveFields({ event: this.event, scramble: this.scramble, timeMs: result.solve.timeMs }),
        scrambleSource: this.sourceSnapshot });
      this.persist(); this.nextScramble();
    }
    return result.accepted !== false && before !== this.state;
  }
  down() { if (!this.externalConnected && this.settings.timingEnabled && timerCanHandleAttemptPress(this.state.phase, Boolean(this.scramble), this.cubeConnected)) this.dispatch({ type: 'press-down', nowMs: this.now() }); }
  up() { if (!this.cubeConnected && !this.externalConnected) this.dispatch({ type: 'press-up', nowMs: this.now() }); }
  hide() {
    this.visible = false;
    this.externalRunning = false;
    if (this.state.phase === 'running') this.dispatch({ type: 'abort-run', nowMs: this.now() });
    else this.dispatch({ type: 'cancel-arm' });
    this.wcaRequest?.cancel(); this.wca?.cancelSource(); ++this.sourceGeneration; this.loading = false;
  }
  dispose() { this.hide(); this.wca?.dispose(); this.solo.dispose(); this.cube.dispose(); }
  updatePenalty(id: string, penalty: Penalty) {
    if (this.busy) return;
    this.replaceRecords([...updateTimerHistorySolve(this.records, id, { penalty }).solves]);
    if (id === this.lastSolveId) this.lastPenalty = penalty;
    this.persist();
  }
  remove(id: string) { if (!this.busy) { this.replaceRecords([...deleteTimerHistorySolve(this.records, id).solves]); this.persist(); } }
  /** Existing native driver events feed the shared timer machine, never a second clock. */
  receiveExternal = (event: SmartCubeRelayEvent): void => {
    if (event.type === 'status') {
      this.externalConnected = event.phase === 'connected'; this.externalName = this.externalConnected ? event.deviceName ?? '' : '';
      if (!this.externalConnected) {
        this.externalRunning = false;
        if (this.state.phase === 'running') this.dispatch({ type: 'abort-run', nowMs: this.now() });
      }
      if (event.error) this.error = event.error;
    } else if (event.type === 'timer' && this.visible && !this.loading && this.scramble && this.settings.timingEnabled) {
      const value = event.event;
      if (value.state === 'RUNNING' && !this.externalRunning) {
        this.externalRunning = true;
        this.dispatch({ type: 'start-now', nowMs: this.now(), elapsedMs: value.solveTime });
      } else if (value.state === 'STOPPED' && this.externalRunning && typeof value.solveTime === 'number' && Number.isFinite(value.solveTime) && value.solveTime >= 0) {
        this.externalRunning = false;
        this.dispatch({ type: 'stop-external', timeMs: value.solveTime, inspectionMs: value.inspectTime });
      } else if (value.state === 'DISCONNECT' || value.state === 'IDLE' || value.state === 'GAN_RESET') {
        this.externalRunning = false;
        if (this.state.phase === 'running') this.dispatch({ type: 'reset' });
      }
    }
    this.onChange?.();
  };
  /** Only a known, matching scramble can arm automatic timing. */
  receiveCube = (event: SmartCubeRelayEvent): void => {
    if (event.type === 'command-result') {
      if (!this.cubeConnected) return;
      if (event.ok) {
        this.cube.resetState();
        const facelets = this.cube.getFacelets(); this.cubeKnown = !!facelets;
        if (facelets) this.solo.syncFacelets(facelets);
      }
      else this.error = event.error ?? tr({ en: 'Calibration failed', zh: '校准失败' });
      this.onChange?.(); return;
    }
    if (event.type === 'status') {
      this.cubeConnected = event.phase === 'connected';
      this.canResetCube = !!event.canResetDevice;
      this.calibrating = !!event.calibrating;
      this.solo.setConnected(this.cubeConnected);
      if (this.cubeConnected && !this.lease) this.lease = this.cube.open({ publishInitialState: false });
      this.device = this.cubeConnected ? { model: event.brand ?? '', name: event.deviceName ?? '' } : undefined;
      if (!this.cubeConnected) {
        this.cubeKnown = false;
        if (this.state.phase === 'running') this.dispatch({ type: 'abort-run', nowMs: this.now() });
        else this.dispatch({ type: 'cancel-arm' });
        this.cube.close(); this.lease = undefined; this.recording.reset();
        // GAN can publish its initial state during the handshake, before connected.
        if (event.phase === 'connecting') this.lease = this.cube.open({ publishInitialState: false });
      }
      return;
    }
    if ((event.type !== 'state' && event.type !== 'move') || event.calibration) return;
    if (event.type === 'state') {
      this.cubeKnown = this.lease?.adoptFacelets(event.facelets) ?? false;
      if (this.cubeKnown) this.solo.syncFacelets(event.facelets);
    } else if (this.cubeKnown) {
      this.lease?.move(event.move, event.deviceTs, { futureHistory: event.futureHistory });
    }
    this.onChange?.();
  };
}
