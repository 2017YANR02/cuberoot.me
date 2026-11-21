import { initialTimerMachineState, transitionTimer, type TimerMachineAction } from '@cuberoot/shared/timer/machine';
import type { ExternalTimerKind, ExternalTimerState } from '@cuberoot/shared/timer/external/types';
import { formatTimerTimingDisplay } from '@cuberoot/shared/timer/timing-display';
import { normalizeTimerAttemptSplitSettings, TimerAttemptSplitRecorder, type TimerManualStage } from '@cuberoot/shared/timer/attempt-splits';
import { normalizeTimerTrainingSettings } from '@cuberoot/shared/timer/training-settings';
import { normalizeTimerPreScrambleSettings } from '@cuberoot/shared/timer/pre-scramble';
import { startTimerRound, timerRoundSolves, type TimerRoundBoundary } from '@cuberoot/shared/timer/training-view';
import { activeTimerSolves, decodeTimerStoreData, serializeTimerStoreData, parseTimerStoreJson,
  type TimerStoreData, type TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';
import { planTimerImport, appendTimerImportSessions, type TimerImportPlan } from '@cuberoot/shared/timer/import-timer';
import { createTimerSourceRevision, advanceTimerSourceRevision, timerManualSourceIdentity } from '@cuberoot/shared/timer/source-revision';
import { updateTimerHistorySolve, deleteTimerHistorySolve, filterTimerHistorySolves, createTimerHistoryFilters } from '@cuberoot/shared/timer/history';
import { histPush, histBack, histForward, type ScrambleHistory } from '@cuberoot/shared/timer/scramble-history';
import { projectRollingStats, rollingStatColumnsForEvent, rollingStatCurrent, rollingStatBest, ROLLING_STAT_PRESETS } from '@cuberoot/shared/timer/rolling-stats';
import type { createWcaScramblePool, WcaSourceSpec, WcaDispensedScramble } from '@cuberoot/shared/timer/wca-scramble-pool';
import { timerWcaScrambleSourceLine, resolveTimerWcaSourceCore, normalizeTimerWcaSourceCoreSettings } from '@cuberoot/shared/timer/wca-source-config';
import { timerWcaDifficultyFilter } from '@cuberoot/shared/timer/wca-difficulty';
import { normalizeTimerRandomDifficultySettings, trainerSig, trainerSpecOf } from '@cuberoot/shared/timer/random-difficulty';
import type { TimerRandomDifficultyResult } from '@cuberoot/shared/timer/random-difficulty-pool';
import { timerScrambleAllowsEmptySlot } from '@cuberoot/shared/timer/scramble-capabilities';
import { timerScrambleStatus } from '@cuberoot/shared/timer/scramble-status';
import { timerSupportsRealWcaScrambles, timerSupportsSmartCubeAutoTiming, timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { localizeCompName } from '@cuberoot/shared/comp-localize';
import { normalizeTimerTimingSettings, normalizeTimerScrambleClickAction, normalizeTimerScramblePreviewSettings, timerSupportsStageSplits } from '@cuberoot/shared/timer/settings-contract';
import { normalizeTimerDisplaySettings } from '@cuberoot/shared/timer/display-settings';
import { normalizeTimerTypography } from '@cuberoot/shared/timer/typography';
import { timerCanSwitchScramble, timerCanHandleAttemptPress } from '@cuberoot/shared/timer/input-contract';
import { activateTimerSession, createAndActivateTimerSession, renameTimerSession, deleteTimerSession, clearTimerSession, clearTimerSessionEvent, timerSessionSnapshot, timerSessionSelectedEvent, TIMER_SESSION_UI_COPY, type TimerSessionMutationResult, selectTimerEventSession, moveTimerSolveToSession } from '@cuberoot/shared/timer/session';
import { parseTimerEntry, timerManualEntryKind, type TimerManualEntryValue } from '@cuberoot/shared/timer/manual-entry';
import { parseManualScrambleQueue, takeManualScramble } from '@cuberoot/shared/timer/manual-scramble-queue';
import { averageOfN, bestMbldSolve, bestSingle, meanOfAll, meanOfN, worstSingle, stdDev, formatMs, formatEventMs, formatMbldResult, formatSolveResult, buildTimerHistogramBuckets } from '@cuberoot/shared/timer/stats';
import { filterSolvesByStatsDateRange, type TimerStatsDateRange } from '@cuberoot/shared/timer/stats-buckets';
import { DEFAULT_TIMER_SCRAMBLE_SOURCE, effectiveMs, isBldEvent, type EventId, type Penalty, type Solve, type TimerScrambleSourceKind } from '@cuberoot/shared/timer/types';
import { upsertNetRecordedSolve, type NetRecordedAttempt } from '@cuberoot/shared/timer/net-attempt';
import { createNativeTimerMetronome, nativeTimerMetronomeAvailable } from './native-timer-metronome';
import { createNativeTimerSound, nativeTimerSoundAvailable } from './native-timer-sound';
import { createNativeSmartCubeFixup } from './native-timer-smart-cube-fixup';
import { encodeNativeGyroTrack } from './native-timer-gyro';
import { createNativeTimerAutoReady } from './native-timer-auto-ready';
import { consumeTimerSeed, normalizeTimerSyncSeed, timerSeedTicket } from '@cuberoot/shared/timer/sync-seed';
import { isSeededBasicWcaEvent } from '@cuberoot/shared/timer/seeded/wca';
import { createNativeTimerScrambleSource } from './native-timer-scramble-source';
import { isNativeTimerEvent, type NativeTimerEvent } from './native-timer-projects';
import { createNativeTimerRandomDifficulty } from './native-timer-random-difficulty';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { SmartCubeSessionController, type SmartCubeSessionLease } from '@cuberoot/shared/smart-cube/session';
import { SmartCubeSoloTimerController } from '@cuberoot/shared/smart-cube/solo-timer';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { captureTimerLiveAttempt, timerLiveCompletedAttempt, timerLiveHistory, timerLiveSolveDetail, type TimerLiveSnapshot } from '@cuberoot/shared/timer/live-share';
import { LiveSmartCubeAnchor } from '@cuberoot/shared/smart-cube/anchor';
import { applyOrientation, mirrorForBrand, sensorBasisForBrand, type Quat } from '@cuberoot/shared/smart-cube/orientation';
import type { SmartCubeRelayEvent } from '@cuberoot/shared/smart-cube/relay';
import { getMiniProgramLocale, tr } from './i18n';
import { appendTimerSolve, loadOrCreateTimerStore } from './timer-store';
import { nativeTimerTextBytes } from './native-timer-text';

const KEY = 'cuberoot:timer';
const LEGACY_SETTINGS_KEY = 'cuberoot:native-timer:preferences';
type NativeStoredTimer = TimerStoreData & { nativeScrambleSource: TimerScrambleSourceKind };
type NativeScrambleHistoryEntry = {
  scramble: string;
  row: WcaDispensedScramble | null;
  difficulty: TimerRandomDifficultyResult | null;
};
export { nativeTimerEvents, type NativeTimerEvent } from './native-timer-projects';
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
  private trainingRoundBoundary: TimerRoundBoundary | null = null;
  private storageReadable = true;
  error = '';
  visible = true;
  cubeConnected = false;
  cubeKnown = false;
  canResetCube = false;
  calibrating = false;
  externalConnected = false;
  externalName = '';
  externalKind: ExternalTimerKind = 'unknown';
  externalState: ExternalTimerState = 'DISCONNECT';
  externalLastTime = 0;
  private externalRunning = false;
  private autoReadyBlocked = false;
  private readonly cubeFixup = createNativeSmartCubeFixup();
  private readonly sound?: ReturnType<typeof createNativeTimerSound>;
  private readonly metronome?: ReturnType<typeof createNativeTimerMetronome>;
  private readonly autoReady: ReturnType<typeof createNativeTimerAutoReady>;
  private readonly recording = new SmartCubeAttemptProducer(encodeNativeGyroTrack);
  private readonly attemptSplits = new TimerAttemptSplitRecorder();
  private readonly solo: SmartCubeSoloTimerController;
  private readonly cube: SmartCubeSessionController<{ futureHistory?: boolean }>;
  private lease?: SmartCubeSessionLease<{ futureHistory?: boolean }>;
  private device?: { model: string; name: string };
  private cubeQuaternion?: Quat;
  private cubeGripReference?: Quat;
  private cubeDisplayReference?: Quat;
  private lastPenalty: Penalty | null = null;
  private lastSolveId = '';
  private liveShareRecords?: Partial<Record<Solve['event'], Solve[]>>;
  private liveHistory: Solve[] = [];
  private liveCubeAnchor?: LiveSmartCubeAnchor;
  private readonly pendingNetBackup = new Set<string>();
  private generation = 0;
  private manualCursor = 0;
  private source: TimerScrambleSourceKind;
  loading = false;
  private wcaRequest?: { cancel(): void };
  private sourceGeneration = 0;
  private wcaRow: WcaDispensedScramble | null = null;
  private readonly randomDifficulty = createNativeTimerRandomDifficulty();
  private readonly randomScrambles = createNativeTimerScrambleSource();
  private randomDifficultyCase: TimerRandomDifficultyResult | null = null;
  private randomDifficultyMiss: 'empty' | 'rare' | 'error' | null = null;
  private scrambleHistory: ScrambleHistory<NativeScrambleHistoryEntry> = { list: [], idx: -1 };
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
    this.wcaRow = entry.row;
    this.randomDifficultyCase = entry.difficulty;
    this.setScramble(this.event, entry.scramble, false);
  }
  private wcaSpec(): WcaSourceSpec {
    const s = this.settings;
    const diff = timerWcaDifficultyFilter(timerWcaScrambleEventId(this.event), s);
    return { event: this.event, ...resolveTimerWcaSourceCore(s), optimal: s.wcaUseOptimal, ...(diff ? { diff } : {}) };
  }
  get difficultyUnavailable() {
    if (this.source !== 'wca') return false;
    const spec = this.wcaSpec();
    return !!spec.diff && this.wca?.isWcaCompUnindexed(spec) === true;
  }
  get sourceDetails() {
    const meta = this.wcaRow?.meta;
    if (this.source !== 'wca' || !meta) return null;
    return {
      competitionId: meta.ci,
      title: localizeCompName(meta.ci, meta.cn || meta.ci, getMiniProgramLocale() === 'zh'),
      round: timerWcaScrambleSourceLine(meta.r, meta.g, meta.n, Boolean(meta.x)),
    };
  }
  get sourceLine() {
    const details = this.sourceDetails;
    return details ? `${details.title} · ${details.round}` : '';
  }
  private manualSource = createTimerSourceRevision(`native-${Date.now()}`);
  private get randomDifficultySpec() {
    return this.source === 'random' && !this.settings.syncSeed ? trainerSpecOf(this.event, this.settings) : null;
  }
  private get sourceSnapshot() {
    const kind = this.source;
    let identity: string;
    if (kind === 'manual') identity = timerManualSourceIdentity(this.event, this.manualSource);
    else if (kind === 'wca') identity = this.wca?.sourceKey(this.wcaSpec()) ?? `wca|${this.event}`;
    else {
      const { syncSeed, syncSeedRevision, cnMode, scramble222Mode } = this.settings;
      const difficulty = syncSeed ? '' : trainerSig(this.event, this.settings);
      identity = syncSeed && isSeededBasicWcaEvent(this.event) ? `random|${this.event}|seed:${syncSeedRevision}|${cnMode}|${scramble222Mode}`
        : difficulty ? `random|${this.event}|difficulty:${difficulty}`
        : this.event === '222' ? `random|${this.event}|${scramble222Mode}` : `random|${this.event}`;
    }
    return { kind, identity };
  }
  get randomDifficultyResult() { return this.randomDifficultyCase; }
  get randomDifficultyStatus() {
    if (!this.randomDifficultySpec) return 'idle';
    if (this.loading) return 'working';
    return this.randomDifficultyMiss ?? (this.randomDifficultyCase ? 'ready' : 'idle');
  }
  solveRandomDifficultyCase(result: TimerRandomDifficultyResult, isZh: boolean, signal?: AbortSignal) {
    return this.randomDifficulty.solve(result, isZh, signal);
  }
  retryRandomDifficulty() {
    const spec = this.randomDifficultySpec;
    if (!spec || this.busy || this.loading) return;
    this.randomDifficulty.retry(spec);
    this.nextScramble();
  }

  onChange?: (reason?: 'cube-state') => void;
  onPersistedSolve?: () => void;
  onCubeMove?: (move: string, facelets: string, timestamp: number) => void;
  onCubePose?: (pose: Quat | null) => void;
  get cubePose() {
    return this.settings.gyroEnabled && this.cubeQuaternion
      ? applyOrientation(this.cubeQuaternion, this.cubeDisplayReference ?? null, {
        basis: sensorBasisForBrand(this.device?.model), mirror: mirrorForBrand(this.device?.model),
      }) : null;
  }
  get facelets() { return this.cubeKnown ? this.cube.getFacelets() : null; }
  get guidance() { return this.solo.getGuidanceSnapshot(); }
  get sessions() { return timerSessionSnapshot(this.store.database); }
  get activeSessionId() { return this.store.database.activeSessionId; }
  get currentSource() { return this.source; }
  get officialAvailable() { return timerSupportsRealWcaScrambles(this.event); }
  get canUseCurrentScramble() { return Boolean(this.scramble) || timerScrambleAllowsEmptySlot(this.event, this.source); }
  private reconcileScrambleSource() {
    if (this.source === 'wca' && !this.officialAvailable) this.source = 'random';
  }
  private applySession(result: TimerSessionMutationResult, select = false) {
    if (this.busy || result.failure) return false;
    const roundContext = this.trainingRoundContext;
    this.store.database = result.database;
    if (select) {
      const event = timerSessionSelectedEvent(result.database, result.activeSessionId, this.event, this.settings.autoEventForSession);
      if (isNativeTimerEvent(event)) this.settings.event = event;
      this.state = initialTimerMachineState(); this.lastPenalty = null; this.nextScramble();
    }
    if (roundContext !== this.trainingRoundContext) this.trainingRoundBoundary = null;
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
  clearCurrentEvent(sessionId: string, event: EventId) {
    if (this.busy || !this.storageReadable || sessionId !== this.store.database.activeSessionId || event !== this.event) return false;
    const mutation = clearTimerSessionEvent(this.store.database, sessionId, event);
    if (mutation.failure || !this.commitDatabase(mutation.database)) return false;
    this.lastSolveId = '';
    this.lastPenalty = null;
    return true;
  }
  moveResult(id: string, target: string) { return this.applySession(moveTimerSolveToSession(this.store.database, id, target)); }
  manualEntry(input: string) {
    if (timerManualEntryKind(this.event) !== 'time') return false;
    const entry = parseTimerEntry(input);
    if (!entry) return false;
    return this.saveManualEntry({ event: this.event, timeMs: entry.ms, penalty: entry.penalty, scramble: this.scramble });
  }
  saveManualEntry(value: TimerManualEntryValue) {
    if (this.busy || this.loading || value.event !== this.event || (!value.scramble && !this.canUseCurrentScramble)) return false;
    this.store = appendTimerSolve(this.store, { id: `manual-${Date.now()}-${++this.generation}`, ts: Date.now(),
      ...value, ...(value.scramble === this.scramble ? { scrambleSource: this.sourceSnapshot } : {}) });
    if (this.persist()) this.onPersistedSolve?.();
    this.nextScramble(); return true;
  }
  recordNetSolve({ context, solve }: NetRecordedAttempt): void {
    const entries = this.store.database.dataBySession;
    // After a solve is moved, editing its room penalty must follow the existing row.
    const existing = Object.entries(entries).find(([, events]) => events[solve.event]?.some(item => item.id === solve.id));
    const sessionId = existing?.[0] ?? context.sessionId;
    const byEvent = Object.prototype.hasOwnProperty.call(entries, sessionId) ? entries[sessionId] : undefined;
    if (!byEvent) throw new Error(tr({ en: 'The original timer group no longer exists.', zh: '原成绩分组已不存在。' }));
    const candidate = decodeTimerStoreData({
      ...this.store,
      database: { ...this.store.database, dataBySession: {
        ...entries, [sessionId]: { ...byEvent, [solve.event]: upsertNetRecordedSolve(byEvent[solve.event] ?? [], solve) },
      } },
    });
    if (!candidate) throw new Error(tr({ en: 'Invalid online solve data.', zh: '联机成绩数据无效。' }));
    this.store = candidate;
    if (!existing) this.pendingNetBackup.add(solve.id);
    const saved = this.persist();
    this.onChange?.();
    if (!saved) throw new Error(this.error || tr({ en: 'The online result could not be saved locally.', zh: '联机成绩暂未保存到本机。' }));
  }
  setManualScrambles(text: string) {
    if (this.busy) return;
    if (this.source === 'manual' && text === this.settings.manualScrambles) return;
    this.settings.manualScrambles = text; this.manualCursor = 0;
    this.manualSource = advanceTimerSourceRevision(this.manualSource, text);
    this.source = 'manual';
    this.persist(); this.nextScramble();
  }
  private selectScrambleSource(source: 'random' | 'wca') {
    if (this.busy || (source === 'wca' && (!this.wca || !this.officialAvailable))) return;
    if (source !== this.source) {
      this.source = source;
      this.persist();
    }
    this.nextScramble();
  }
  useRandomScrambles() { this.selectScrambleSource('random'); }
  useWcaScrambles() { this.selectScrambleSource('wca'); }
  exportBackup() { return serializeTimerStoreData(this.store); }
  exportCloudBackup() { return JSON.stringify(this.store.database); }
  restoreBackup(text: string) {
    if (this.busy || !this.storageReadable) return false;
    const next = parseTimerStoreJson(text, this.settings);
    if (!next) return false;
    try { this.storage.setStorageSync(`${KEY}:before-restore`, this.exportBackup()); }
    catch { return false; }
    const previous = this.store;
    const previousSource = this.source;
    this.store = next; this.reconcileScrambleSource();
    if (!this.persist()) { this.store = previous; this.source = previousSource; return false; }
    this.trainingRoundBoundary = null;
    if (next.settings.manualScrambles !== previous.settings.manualScrambles) {
      this.manualCursor = 0;
      this.manualSource = advanceTimerSourceRevision(this.manualSource, next.settings.manualScrambles);
    }
    this.state = initialTimerMachineState(); this.lastPenalty = null; this.nextScramble(); return true;
  }
  importCstimer(text: string) {
    if (this.busy || !this.storageReadable) return false;
    const parsed = parseCstimerExport(text, () => `solve-${Date.now()}-${++this.generation}`), plan = planTimerImport(parsed);
    if (!parsed.length || plan.unresolvedSessionIds.length) return false;
    return this.importSessions(plan.sessions);
  }
  importSessions(sessions: TimerImportPlan['sessions']) {
    if (this.busy || !this.storageReadable) return false;
    try {
      const database = appendTimerImportSessions(this.store.database, sessions, {
        createId: () => `import-${Date.now()}-${++this.generation}`, now: Date.now, defaultName: tr(TIMER_SESSION_UI_COPY.newSessionDefault),
      });
      return this.commitDatabase(database);
    } catch {
      return false;
    }
  }
  private commitDatabase(database: TimerStoreData['database']) {
    const next = decodeTimerStoreData({ ...this.store, database });
    if (!next) return false;
    const before = this.store;
    this.store = next;
    if (this.persist()) { this.trainingRoundBoundary = null; return true; }
    this.store = before;
    return false;
  }
  updateComment(id: string, comment: string) {
    if (this.busy) return;
    this.replaceRecords([...updateTimerHistorySolve(this.records, id, { comment: comment.trim() || undefined }).solves]); this.persist();
  }
  constructor(private storage: NativeTimerStorage, private now = () => Date.now(), private readonly wca?: ReturnType<typeof createWcaScramblePool>) {
    this.source = wca ? DEFAULT_TIMER_SCRAMBLE_SOURCE : 'random';
    this.store = loadOrCreateTimerStore(null, { nowMs: Date.now(), id: `session-${Date.now()}`, language: getMiniProgramLocale() }).data;
    this.autoReady = createNativeTimerAutoReady(() => ({
      phase: this.state.phase,
      preference: this.settings.bluetoothAutoReady,
      canStart: this.visible && this.cubeConnected && this.cubeKnown && this.timingEnabled && Boolean(this.scramble)
        && timerSupportsSmartCubeAutoTiming(this.event),
      blocked: this.autoReadyBlocked,
    }), () => { this.dispatch({ type: 'arm-from-cube', nowMs: this.now() }); this.onChange?.(); });
    if (nativeTimerSoundAvailable()) this.sound = createNativeTimerSound(() => this.settings, {
      now: () => this.now(), isVisible: () => this.visible,
    });
    if (nativeTimerMetronomeAvailable()) this.metronome = createNativeTimerMetronome(() => this.settings, {
      now: () => this.now(), isVisible: () => this.visible,
    });
    this.solo = new SmartCubeSoloTimerController({
      onGuidanceChange: () => this.onChange?.(),
      armFromCube: (atMs, clock) => this.dispatch({ type: 'arm-from-cube', nowMs: this.now(), atMs, clock }),
      autoReadyOnScramble: () => this.settings.bluetoothAutoReady === 'scrambled',
      canStartAttempt: () => this.visible && !this.autoReadyBlocked && this.cubeKnown && Boolean(this.scramble),
      getPhase: () => this.state.phase,
      isTimingEnabled: () => this.visible && this.timingEnabled,
      solve: this.cubeFixup.solve,
      correctionLimit: () => this.settings.smartCubeCorrectionLimit,
      recordMove: e => {
        if (this.recording.recordMove(e.move, e.timestamp, e.clock) && this.attemptSplitOptions.multiStage) {
          this.attemptSplits.observeMoves({ event: this.event, scramble: this.scramble,
            moves: this.recording.snapshotMoves(), timeMs: this.displayMilliseconds() });
        }
      },
      startFromCube: (atMs, clock) => this.dispatch({ type: 'start-from-cube', nowMs: this.now(), atMs, clock }),
      stopFromCube: (atMs, clock) => this.dispatch({ type: 'stop-from-cube', nowMs: this.now(), atMs, clock }),
    });
    this.cube = new SmartCubeSessionController<{ futureHistory?: boolean }>({
      now: this.now,
      onChange: () => this.onChange?.('cube-state'),
      onMove: event => {
        if (!this.visible) return;
        const outcome = this.solo.move(event);
        if (this.cubeQuaternion) {
          if (outcome.guidancePenultimate && this.settings.autoCalibrateGyro) {
            this.cubeGripReference = { ...this.cubeQuaternion };
            this.cubeDisplayReference = { ...this.cubeQuaternion };
            this.onCubePose?.(this.cubePose);
          }
          if (outcome.guidanceCompleted && !this.cubeGripReference) this.cubeGripReference = { ...this.cubeQuaternion };
        }
        if (outcome.delivered) {
          this.liveCubeAnchor?.move(event.move, event.timestamp);
          this.onCubeMove?.(event.move, event.facelets, event.timestamp);
          this.autoReady.move(event.move);
        }
      },
      onSolved: (atMs, clock) => { if (this.visible) this.solo.solved(atMs, clock); },
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
      if (!loaded.recoveredFromCorruption && raw && typeof raw === 'object') {
        const source = (raw as Partial<NativeStoredTimer>).nativeScrambleSource;
        if (source === 'manual' || source === 'random' || (source === 'wca' && wca)) this.source = source;
      }
      // Preserve choices from the unreleased preview once, then retire its separate settings key.
      const saved = read(LEGACY_SETTINGS_KEY) as { event?: string; settings?: { inspectionSec?: number; holdMs?: number; scrambleTap?: string } } | null;
      if (saved?.settings) {
        Object.assign(this.store.settings, normalizeTimerTimingSettings({ ...this.settings, ...saved.settings }), {
          scrambleClickAction: normalizeTimerScrambleClickAction(saved.settings.scrambleTap),
        });
        if (saved.event && isNativeTimerEvent(saved.event)) this.store.settings.event = saved.event;
        storage.setStorageSync(KEY, this.nativeStoredTimer());
        storage.removeStorageSync(LEGACY_SETTINGS_KEY);
      }
      this.reconcileScrambleSource();
    } catch { this.storageReadable = false; this.error = tr({ en: 'Unable to read local results. Existing data will not be overwritten.', zh: '读取本机成绩失败，原有数据不会被覆盖。' }); }
  }
  get event(): NativeTimerEvent { return isNativeTimerEvent(this.settings.event) ? this.settings.event : '333'; }
  get timingEnabled() { return this.settings.timingEnabled && timerManualEntryKind(this.event) === 'time'; }
  get settings(): TimerStoreSettings { return this.store.settings; }
  get attemptSplitOptions() {
    return { multiStage: this.settings.multiStage && timerSupportsStageSplits(this.event),
      bldMemo: this.settings.bldMemo && isBldEvent(this.event) };
  }
  get attemptSplitState() { return this.attemptSplits.snapshot(); }
  markAttemptSplit(mark: TimerManualStage | 'memo') {
    if (this.state.phase !== 'running') return;
    const elapsed = this.displayMilliseconds();
    if (mark === 'memo') this.attemptSplits.markMemo(elapsed);
    else this.attemptSplits.markStage(mark, elapsed);
  }
  updateSettings(patch: Partial<TimerStoreSettings>) {
    if (this.busy) return;
    const previousRandomIdentity = this.source === 'random' ? this.sourceSnapshot.identity : null;
    this.store.settings = { ...this.settings, ...patch, ...normalizeTimerTimingSettings({ ...this.settings, ...patch }),
      ...normalizeTimerTrainingSettings({ ...this.settings, ...patch }),
      ...normalizeTimerPreScrambleSettings({ ...this.settings, ...patch }),
      ...normalizeTimerAttemptSplitSettings({ ...this.settings, ...patch }),
      ...normalizeTimerScramblePreviewSettings({ ...this.settings, ...patch }),
      ...normalizeTimerDisplaySettings({ ...this.settings, ...patch }),
      ...normalizeTimerTypography({ ...this.settings, ...patch }),
      ...normalizeTimerWcaSourceCoreSettings({ ...this.settings, ...patch }),
      ...normalizeTimerRandomDifficultySettings({ ...this.settings, ...patch }),
      ...normalizeTimerSyncSeed({ ...this.settings, ...patch }),
      scrambleClickAction: normalizeTimerScrambleClickAction(patch.scrambleClickAction ?? this.settings.scrambleClickAction) };
    this.persist();
    this.autoReady.sync();
    if (patch.soundsEnabled || patch.inspectionBeepAt || (patch.voiceInspection && patch.voiceInspection !== 'none')) this.sound?.warmupSound();
    if ((patch.metronomeOn !== undefined || patch.metronomeBpm !== undefined) && this.settings.metronomeOn) this.metronome?.warmup();
    if (this.source === 'wca' && Object.keys(patch).some(key => key.startsWith('wca'))) this.nextScramble();
    if (previousRandomIdentity !== null && previousRandomIdentity !== this.sourceSnapshot.identity) this.nextScramble();
  }
  tapMetronomeTempo() {
    const bpm = this.metronome?.tapTempo();
    if (bpm != null) this.updateSettings({ metronomeBpm: bpm });
  }
  playSoundPreview(kind: 'start' | 'inspection') {
    this.sound?.warmupSound();
    if (kind === 'inspection') this.sound?.playInspectionBeep();
    else this.sound?.playStartPreview();
  }
  resetSettings(settings: TimerStoreSettings) {
    if (this.busy || !this.storageReadable) return false;
    const previous = this.store.settings, source = this.source;
    this.store.settings = settings;
    this.source = this.wca ? DEFAULT_TIMER_SCRAMBLE_SOURCE : 'random';
    this.reconcileScrambleSource();
    if (!this.persist()) {
      this.store.settings = previous; this.source = source;
      return false;
    }
    this.manualCursor = 0;
    this.manualSource = advanceTimerSourceRevision(this.manualSource, settings.manualScrambles);
    this.state = initialTimerMachineState(); this.lastPenalty = null;
    this.historyIdentity = '';
    this.nextScramble();
    this.onChange?.();
    return true;
  }
  setAutoReadyBlocked(blocked: boolean) {
    if (this.autoReadyBlocked === blocked) return;
    this.autoReadyBlocked = blocked;
    this.autoReady.sync();
  }
  get records(): Solve[] { return Object.values(this.store.database.dataBySession[this.store.database.activeSessionId] ?? {}).flatMap(solves => solves ?? []); }
  private replaceRecords(records: Solve[]) {
    const byEvent: Partial<Record<Solve['event'], Solve[]>> = {};
    for (const solve of records) (byEvent[solve.event] ??= []).push(solve);
    this.store.database.dataBySession[this.store.database.activeSessionId] = byEvent;
  }
  get busy() { return !timerCanSwitchScramble(this.state.phase); }
  get solves() { return activeTimerSolves(this.store, this.event); }
  private get trainingRoundContext() { return `${this.activeSessionId}|${this.event}`; }
  get trainingRoundSolves() { return timerRoundSolves(this.solves, this.settings.round, this.trainingRoundContext, this.trainingRoundBoundary); }
  startTrainingRound() {
    if (!this.busy && this.settings.round.on) this.trainingRoundBoundary = startTimerRound(this.solves, this.trainingRoundContext);
  }
  get lastResult() { return this.solves.find(s => s.id === this.lastSolveId) ?? null; }
  liveAttempt() {
    const { phase, startedAtMs, trainingStartMode } = this.state;
    return captureTimerLiveAttempt(this.recording, phase === 'running' && startedAtMs !== null
      ? { startedAt: startedAtMs, event: this.event, scramble: this.scramble, trainingStartMode } : null);
  }
  liveShareSnapshot(): TimerLiveSnapshot {
    const context = this.activeSessionId, machine = this.state, now = this.now();
    const records = this.store.database.dataBySession[context];
    if (this.liveShareRecords !== records) {
      this.liveShareRecords = records;
      this.liveHistory = timerLiveHistory(this.records, nativeTimerTextBytes);
    }
    const anchor = this.liveCubeAnchor ??= new LiveSmartCubeAnchor({ solve: this.cubeFixup.generate, onChange() {} });
    anchor.setConnection(this.cubeConnected ? this.device?.name || 'cube' : null);
    anchor.observeFacelets(this.facelets);
    const completion = machine.phase === 'stopped' ? this.lastResult : null;
    const guidance = this.guidance;
    const settings = this.settings;
    return {
      state: { context, sessionName: this.store.database.sessions.find(session => session.id === context)?.name ?? '', event: this.event, scramble: this.scramble,
        phase: machine.phase, sampledAt: Date.now(), elapsedMs: machine.phase === 'running' ? Math.max(0, now - (machine.startedAtMs ?? now)) : machine.lastMs ?? 0,
        inspectionMs: machine.inspectionStartedAtMs === null ? 0 : Math.max(0, now - machine.inspectionStartedAtMs),
        inspectionSec: machine.inspectionSec ?? settings.inspectionSec, lastPenalty: this.lastPenalty,
        trainingObservation: Boolean(machine.trainingStartMode), timingEnabled: this.timingEnabled, hideTime: settings.hideTime,
        precision: settings.precision, runningPrecision: settings.runningPrecision ?? settings.precision,
        controls: { contentId: 'solve', source: this.source },
        appearance: { ...normalizeTimerTypography(settings), soloLayout: settings.soloLayout },
        ...(this.cubeConnected && { guidance: { hint: guidance.hint ?? null, match: guidance.match, correctionActive: guidance.correctionActive } }),
      },
      cube: { connected: this.cubeConnected, facelets: this.facelets, quaternion: this.cubePose, ...anchor.getSnapshot() },
      attempt: completion ? timerLiveCompletedAttempt({ context, solve: completion }, context, this.event)
        : this.liveAttempt(),
      history: this.liveHistory,
    };
  }
  liveShareDetail(id: string, context: string): Solve | null {
    const solve = context === this.activeSessionId && this.records.find(record => record.id === id);
    if (!solve) return null;
    return timerLiveSolveDetail(solve);
  }
  releaseLiveShare() {
    this.liveCubeAnchor?.setConnection(null);
    this.liveCubeAnchor = undefined;
    this.liveShareRecords = undefined;
    this.liveHistory = [];
  }
  display() {
    const now = this.now();
    return formatTimerTimingDisplay({ ...this.settings,
      displayMs: this.displayMilliseconds(now),
      inspectionDisplayMs: this.state.inspectionStartedAtMs === null ? 0 : Math.max(0, now - this.state.inspectionStartedAtMs),
      inspectionLimitSec: this.settings.inspectionSec, phase: this.state.phase, lastPenalty: this.lastPenalty });
  }
  displayMilliseconds(now = this.now()) {
    return this.state.startedAtMs === null ? this.state.lastMs ?? 0 : Math.max(0, now - this.state.startedAtMs);
  }
  summary(limit = 100, includeHistoryColumns = false) {
    const solves = this.solves;
    const filtered = filterTimerHistorySolves(solves, this.historyFilters).solves;
    const f = (value: number | null) => formatEventMs(this.event, value, this.settings.precision);
    const mbld = this.event === '333mbld';
    const bestAttempt = mbld ? bestMbldSolve(solves) : null;
    const columns = rollingStatColumnsForEvent(this.event, this.settings.statsRollingColumns);
    const indices = new Map(solves.map((solve, index) => [solve.id, index]));
    const projection = includeHistoryColumns ? projectRollingStats(solves, columns) : null;
    return { count: solves.length, solved: solves.filter(s => Number.isFinite(effectiveMs(s))).length,
      mean: mbld ? '-' : f(meanOfAll(solves)), mo3: mbld ? '-' : f(meanOfN(solves, 3)),
      rolling: columns.map(key => ({ key, value: f(rollingStatCurrent(solves, key)) })),
      filteredCount: filtered.length, best: mbld ? bestAttempt ? formatMbldResult(bestAttempt) : '-' : f(bestSingle(solves, this.event)),
      ao5: mbld ? '-' : f(averageOfN(solves, 5)), ao12: mbld ? '-' : f(averageOfN(solves, 12)),
      rows: filtered.slice(0, limit).map(s => {
        const index = indices.get(s.id)!;
        return { id: s.id, number: index + 1, result: formatSolveResult(s, this.settings.precision),
          penalty: s.penalty, hasComment: Boolean(s.comment),
          rolling: projection ? columns.map(key => {
            const point = projection.get(key)?.[index];
            return { key, value: formatEventMs(this.event, point?.value ?? null), isPb: Boolean(point?.isPb) };
          }) : [] };
      }) };
  }
  statistics(range: TimerStatsDateRange = 'all', now = Date.now()) {
    const solves = filterSolvesByStatsDateRange(this.solves, range, now);
    const f = (value: number | null) => formatEventMs(this.event, value, this.settings.precision);
    const mbld = this.event === '333mbld';
    const bestAttempt = mbld ? bestMbldSolve(solves) : null;
    const finite = solves.map(effectiveMs).filter(Number.isFinite);
    const buckets = buildTimerHistogramBuckets(finite, 12);
    const peak = Math.max(1, ...buckets.map(b => b.count));
    return {
      count: solves.length, solved: finite.length,
      mean: mbld ? '-' : f(meanOfAll(solves)),
      best: mbld ? bestAttempt ? formatMbldResult(bestAttempt) : '-' : f(bestSingle(solves, this.event)),
      worst: mbld ? '-' : f(worstSingle(solves)), sd: mbld ? '-' : f(stdDev(solves)),
      rows: mbld ? [] : ROLLING_STAT_PRESETS.map(key => ({ key, current: f(rollingStatCurrent(solves, key)), best: f(rollingStatBest(solves, key)) })),
      distribution: mbld || finite.length < 5 ? [] : buckets.map((b, index) => ({
        ...b, index, height: b.count / peak * 100,
        label: `${f(b.lo)} – ${f(b.hi)}: ${b.count}`,
      })),
      distributionMin: buckets.length ? f(buckets[0].lo) : '',
      distributionMax: buckets.length ? f(buckets[buckets.length - 1].hi) : '',
    };
  }
  private nativeStoredTimer(): NativeStoredTimer {
    return { ...this.store, nativeScrambleSource: this.source };
  }
  persist() {
    if (!this.storageReadable) return false;
    try {
      this.storage.setStorageSync(KEY, this.nativeStoredTimer());
    } catch { this.error = tr({ en: 'Results are in memory only. Storage is full or unavailable; export them before closing.', zh: '成绩暂存于内存，本机存储已满或不可用；请在关闭前导出。' }); return false; }
    this.error = '';
    if (this.pendingNetBackup.size > 0) {
      let count = 0;
      for (const byEvent of Object.values(this.store.database.dataBySession)) {
        for (const solves of Object.values(byEvent)) {
          for (const solve of solves ?? []) {
            if (this.pendingNetBackup.delete(solve.id)) count++;
          }
        }
      }
      this.pendingNetBackup.clear();
      for (let i = 0; i < count; i++) this.onPersistedSolve?.();
    }
    return true;
  }
  nextScramble() {
    if (this.busy) return;
    this.reconcileScrambleSource();
    this.wcaRequest?.cancel(); this.wca?.cancelSource(); this.randomScrambles.cancel(); this.loading = false; this.wcaRow = null;
    const difficulty = this.randomDifficultySpec;
    this.randomDifficultyCase = null;
    this.randomDifficultyMiss = null;
    if (!difficulty) this.randomDifficulty.release();
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
      this.manualCursor = next.nextCursor;
      this.setScramble(this.event, next.scramble);
      return;
    }
    if (difficulty) {
      this.loading = true;
      this.error = '';
      this.setScramble(this.event, '');
      void this.randomDifficulty.next(difficulty).then(outcome => {
        if (generation !== this.sourceGeneration || !this.visible) return;
        this.loading = false;
        if (outcome.kind === 'ready') {
          this.randomDifficultyCase = outcome.result;
          this.setScramble(this.event, outcome.result.scramble);
        } else if (outcome.kind !== 'cancelled') {
          this.randomDifficultyMiss = outcome.kind;
          const reason = outcome.kind === 'empty' ? 'empty-trainer'
            : outcome.kind === 'rare' ? 'rare-trainer' : 'error-generated';
          this.error = tr(timerScrambleStatus(reason).message);
        }
        this.onChange?.();
      });
      this.onChange?.();
      return;
    }
    const event = this.event;
    const ticket = isSeededBasicWcaEvent(event) ? timerSeedTicket(this.settings) : null;
    let scramble: ReturnType<typeof this.randomScrambles.generate>;
    try {
      scramble = ticket && isSeededBasicWcaEvent(event) ? this.randomScrambles.generateSeeded({
        event, ticket, scramble222Mode: this.settings.scramble222Mode, cnMode: this.settings.cnMode,
      }) : this.randomScrambles.generate(event, this.settings.scramble222Mode, this.settings.cnMode);
    } catch {
      this.setScramble(event, ''); this.error = tr(timerScrambleStatus('error-generated').message);
      this.onChange?.(); return;
    }
    if (typeof scramble === 'string') { this.setScramble(event, scramble); return; }
    this.loading = true; this.error = ''; this.setScramble(event, '');
    const current = () => generation === this.sourceGeneration && this.visible && this.event === event;
    void scramble.then(value => {
      if (!current()) return;
      this.loading = false;
      if (ticket) {
        const committed = consumeTimerSeed(this.settings, ticket);
        if (!committed) { this.onChange?.(); return; }
        const before = this.store.settings;
        this.store.settings = { ...before, ...committed };
        if (!this.persist()) { this.store.settings = before; this.onChange?.(); return; }
      }
      this.setScramble(event, value);
      this.onChange?.();
    }, () => {
      if (!current()) return;
      this.loading = false; this.error = tr(timerScrambleStatus('error-generated').message);
      this.onChange?.();
    });
    this.onChange?.();
  }
  private setScramble(event: NativeTimerEvent, scramble: string, remember = true) {
    this.autoReady.reset();
    this.cubeGripReference = undefined;
    this.scramble = scramble;
    if (remember && scramble) this.scrambleHistory = histPush(this.scrambleHistory, {
      scramble, row: this.wcaRow, difficulty: this.randomDifficultyCase,
    });
    this.solo.setContext({ event, scramble, id: ++this.generation,
      targetFacelets: event === '333' || event === '333oh' ? smartCubeTargetFacelets(scramble) : null });
  }
  selectEvent(event: string) {
    if (this.busy || !isNativeTimerEvent(event)) return;
    const roundContext = this.trainingRoundContext;
    this.store.database = selectTimerEventSession(this.store.database, event, this.settings.autoSessionForEvent).database;
    this.settings.event = event; this.reconcileScrambleSource();
    if (roundContext !== this.trainingRoundContext) this.trainingRoundBoundary = null;
    this.state = initialTimerMachineState(); this.lastPenalty = null;
    this.nextScramble(); this.persist();
  }
  dispatch(action: TimerMachineAction) {
    if (!this.canUseCurrentScramble && action.type !== 'reset') return false;
    const before = this.state;
    const result = transitionTimer(this.state, action, { inspectionSec: this.settings.inspectionSec });
    this.state = result.state;
    this.autoReady.sync();
    this.sound?.onTransition(result);
    this.metronome?.sync(this.state.phase);
    if (result.effects.includes('run-started')) this.attemptSplits.begin(this.attemptSplitOptions);
    if (result.effects.includes('run-started') && this.cubeConnected) {
      const initial = this.settings.recordGyro ? this.cubeQuaternion : undefined;
      const reference = this.cubeGripReference;
      this.recording.begin(this.state.startedAtMs ?? this.now(), this.device, reference && initial ? { reference, initial } : undefined, this.state.cubeStart);
      if (initial && !reference) this.recording.recordGyro(initial, 0);
    }
    this.solo.setRunning(this.state.phase === 'running');
    if (result.solve) {
      this.lastPenalty = result.solve.autoPenalty;
      this.lastSolveId = `${Date.now()}-${++this.generation}-${Math.random().toString(36).slice(2, 9)}`;
      this.store = appendTimerSolve(this.store, { id: this.lastSolveId,
        ts: Date.now(), event: this.event, scramble: this.scramble, timeMs: result.solve.timeMs,
        penalty: result.solve.autoPenalty, inspectionMs: result.solve.inspectionMs || undefined,
        ...this.recording.finishSolveFields({ event: this.event, scramble: this.scramble, timeMs: result.solve.timeMs }),
        ...this.attemptSplits.finish(result.solve.timeMs),
        scrambleSource: this.sourceSnapshot });
      if (this.persist()) this.onPersistedSolve?.();
      this.nextScramble();
    } else if (before.phase === 'running' && this.state.phase !== 'running') this.attemptSplits.cancel();
    return result.accepted !== false && before !== this.state;
  }
  down() { if (!this.externalConnected && this.timingEnabled && timerCanHandleAttemptPress(this.state.phase, this.canUseCurrentScramble, this.cubeConnected)) this.dispatch({ type: 'press-down', nowMs: this.now() }); }
  up() { if (!this.cubeConnected && !this.externalConnected) this.dispatch({ type: 'press-up', nowMs: this.now() }); }
  hide() {
    this.visible = false;
    this.cubeFixup.release();
    this.sound?.hide();
    this.metronome?.hide();
    this.autoReady.reset();
    if (this.externalRunning) this.cancelExternalAttempt();
    else if (this.state.phase === 'running') this.dispatch({ type: 'abort-run', nowMs: this.now() });
    else this.dispatch({ type: 'cancel-arm' });
    this.wcaRequest?.cancel(); this.wca?.cancelSource(); ++this.sourceGeneration; this.loading = false;
    this.randomDifficulty.release(); this.randomScrambles.cancel();
  }
  dispose() { this.hide(); this.sound?.dispose(); this.metronome?.dispose(); this.randomScrambles.release(); this.wca?.dispose(); this.solo.dispose(); this.cube.dispose(); }
  updatePenalty(id: string, penalty: Penalty) {
    if (this.busy) return;
    this.replaceRecords([...updateTimerHistorySolve(this.records, id, { penalty }).solves]);
    if (id === this.lastSolveId) this.lastPenalty = penalty;
    this.persist();
  }
  remove(id: string) { if (!this.busy) { this.replaceRecords([...deleteTimerHistorySolve(this.records, id).solves]); this.persist(); } }
  private cancelExternalAttempt() {
    if (!this.externalRunning) return;
    this.externalRunning = false;
    if (this.state.phase === 'running') this.dispatch({ type: 'reset' });
  }
  /** Existing native driver events feed the shared timer machine, never a second clock. */
  receiveExternal = (event: SmartCubeRelayEvent): void => {
    if (event.type === 'status') {
      this.externalConnected = event.phase === 'connected'; this.externalName = this.externalConnected ? event.deviceName ?? '' : '';
      if (this.externalConnected) {
        const kind = event.brand;
        this.externalKind = kind === 'qiyi-timer' || kind === 'gan-timer' || kind === 'stackmat-mic' ? kind : 'unknown';
        if (this.externalState === 'DISCONNECT') this.externalState = 'IDLE';
      } else {
        this.externalKind = 'unknown';
        this.externalState = 'DISCONNECT';
        this.cancelExternalAttempt();
      }
      if (event.error) this.error = event.error;
    } else if (event.type === 'timer') {
      const value = event.event;
      this.externalState = value.state;
      if (value.state === 'STOPPED' && typeof value.solveTime === 'number' && Number.isFinite(value.solveTime)) this.externalLastTime = value.solveTime;
      if (!this.visible || this.loading || !this.scramble || !this.timingEnabled) { this.onChange?.(); return; }
      if (value.state === 'RUNNING' && this.externalConnected && !this.externalRunning && this.state.phase !== 'running') {
        this.externalRunning = this.dispatch({ type: 'start-now', nowMs: this.now(), elapsedMs: value.solveTime });
      } else if (value.state === 'STOPPED' && this.externalRunning && typeof value.solveTime === 'number' && Number.isFinite(value.solveTime) && value.solveTime >= 0) {
        this.externalRunning = false;
        this.dispatch({ type: 'stop-external', timeMs: value.solveTime, inspectionMs: value.inspectTime });
      } else if (value.state === 'DISCONNECT' || value.state === 'IDLE' || value.state === 'GAN_RESET') {
        this.cancelExternalAttempt();
      }
    }
    this.onChange?.();
  };
  /** Only a known, matching scramble can arm automatic timing. */
  receiveCube = (event: SmartCubeRelayEvent): void => {
    if (event.type === 'gyro') {
      this.cubeQuaternion = event.quaternion;
      if (this.visible && this.cubeConnected) this.onCubePose?.(this.cubePose);
      if (this.visible && this.cubeConnected && this.settings.recordGyro && this.state.phase === 'running' && this.state.startedAtMs !== null) {
        this.recording.recordGyro(event.quaternion, this.now() - this.state.startedAtMs);
      }
      return;
    }
    if (event.type === 'command-result') {
      if (!this.cubeConnected) return;
      if (event.ok) {
        this.cube.resetState();
        if (this.cubeQuaternion) {
          this.cubeGripReference = { ...this.cubeQuaternion };
          this.cubeDisplayReference = { ...this.cubeQuaternion };
          this.onCubePose?.(this.cubePose);
        }
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
        this.cubeQuaternion = undefined; this.cubeGripReference = undefined; this.cubeDisplayReference = undefined;
        this.cubeFixup.release();
        this.autoReady.sync();
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
