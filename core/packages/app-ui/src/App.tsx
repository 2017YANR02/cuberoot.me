import { createRandomScrambleClient } from '@cuberoot/timer-ui/random-scramble';
import { createTimerBackupClient } from '@cuberoot/shared/timer/backup-client';
import { TimerRankBadge } from '@cuberoot/timer-ui/rank-badge';
import { timerRankHost, getWcaPerson } from './data/timer-rank';
import { resetTimerSyncSeed, timerSeedTicket, mergeTimerSeedProgress } from '@cuberoot/shared/timer/sync-seed';
import type { TimerSeedRequest } from '@cuberoot/shared/timer/seeded/generate';
import { nextSeededScramble } from './data/sync-seed';
import { TimerTrainerSubsetModal, TimerSyncSeedSettings, TimerRankSettings, TimerBackupSettings, TimerImportSettings, TimerReanalyzeSettings, TimerReplayImportModal } from '@cuberoot/timer-ui';
import { readTimerReplay, createTimerReplayShare } from '@cuberoot/shared/timer/replay-client';
import { TimerStatisticsWorkspace, timerStatsPanelLabels } from '@cuberoot/timer-ui';
import { TimerHistoryWorkspace, TimerStatsModal, type TimerHistoryWorkspaceHandle } from '@cuberoot/timer-ui';
import { createInstalledBattleScrambleProvider } from './data/local-battle-scramble';
import { buildLocalBattleCsv } from '@cuberoot/shared/timer';
import { TimerBattleSourceSettings } from '@cuberoot/timer-ui';
import { NetRecordingOutbox, uploadNetRecordedAttempt } from '@cuberoot/shared/timer';
import { createNetOutboxStorage, TimerNetOutboxNotice } from '@cuberoot/timer-ui';
import { BluetoothTimerModal, StackmatModal } from '@cuberoot/timer-ui/external';
import { useExternalDevices } from './hooks/use-external-devices';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { decodeAppleMembershipRequest } from '@cuberoot/shared/apple-membership';
import { decodeGoogleMembershipRequest } from '@cuberoot/shared/google-membership';
import { TimerDisplaySettings, TimerPreScrambleSettings, TimerColorNeutralSetting, createTimerSound, useTimerSoundFeedback } from '@cuberoot/timer-ui';
import { normalizeTimerSoundSettings, resetTimerStoreSettings } from '@cuberoot/shared/timer';
import { TimerResetSettings } from '@cuberoot/timer-ui';
import { TimerExportSettings, type TimerExportFormat } from '@cuberoot/timer-ui';
import { exportTimerCstimerJson, exportTimerSolvesCsv, exportSpeedstacks } from '@cuberoot/shared/timer';
import { TimerSoundSettings, TimerMetronomeSettings } from '@cuberoot/timer-ui';
import { createMetronome } from '@cuberoot/timer-ui/metronome';
import { applyOrientationPrefix, preScrambleFor, timerSmartCubeTrainingOrientation, timerSmartCubeAttemptScramble } from '@cuberoot/shared/timer';
import { timerHidesRunningUi } from '@cuberoot/shared/timer';
import type { TimerSettingsUpdate } from './data/timer-repository';
import { TimerKeymapSettings, useTimerRound, TimerGoalSettings, TimerRoundSettings, TimerGoalProgress, TimerRoundPanel, TimerTargetTime, useTimerTargetFeedback } from '@cuberoot/timer-ui';
import { normalizeTimerTrainingSettings } from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import {
  createTimerDeviceRegistry,
  TIMER_DEVICE_REGISTRATIONS,
} from '@cuberoot/shared/timer/device-contract';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';
import { encodeReplayUrl } from '@cuberoot/shared/timer/replay-encode';
import { shouldAutoRecap } from '@cuberoot/shared/timer/reconstruct/recap';
import { Spinner } from '@cuberoot/timer-ui/Spinner';
import { isWcaIdFormat, ownerKey } from '@cuberoot/shared/account';
import type { SmartCubeGuidanceState } from '@cuberoot/shared/smart-cube/scramble-guidance';
import { SmartCubeSoloTimerController } from '@cuberoot/shared/smart-cube/solo-timer';
import {
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedAccountManage,
  decodeMobileEmbedAuthRequest,
  decodeMobileEmbedExternal,
  decodeMobileEmbedNavigation,
  decodeMobileEmbedWebSessionResult,
  MOBILE_EMBED_FRAME_NAMES,
  mobileEmbedAuthClearMessage,
  mobileEmbedAccountManageResultMessage,
  mobileEmbedBackMessage,
  mobileEmbedInitMessage,
  mobileEmbedWebSessionMessage,
  type MobileEmbedSurface,
} from '@cuberoot/shared/mobile-embed';
import { MOBILE_AUTH_PROVIDERS } from '@cuberoot/shared/auth/web-session';
import { openInstalledAccountManagement } from './auth/account-management';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import {
  MAX_TIMER_BACKUP_BYTES,
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  DEFAULT_TIMER_BY_STEPS_SETTINGS,
  DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
  SCRAMBLE_222_TYPE_CATALOG,
  SCRAMBLE_222_TYPES,
  SCRAMBLE_222_UI_LABELS,
  TIMER_BY_STEPS_UI_LABELS,
  STEP_METRICS,
  TIMER_EVENT_PICKER_GROUPS,
  TIMER_MANUAL_SCRAMBLE_EMPTY_COPY,
  TIMER_SCRAMBLE_CLICK_TITLE_COPY,
  TIMER_SETTING_CATEGORY_CONTRACTS,
  WCA_SCRAMBLE_222_TYPES,
  CloudOptimalScrambleHttpError,
  activeTimerSolves,
  advanceTimerSourceRevision,
  awaitOptimal333,
  canUseRandomOptimal333,
  createTimerSourceRevision,
  fetchTimerWcaScrambleMarks,
  formatMs,
  formatTimerTimingDisplay,
  generateTimerDrillScramble,
  generateTimerScramble,
  histBack,
  histForward,
  histPush,
  isBldEvent,
  normalizeTimerByStepsSettings,
  normalizeTimerRandomDifficultySettings,
  normalizeTimerWcaSourceSettings,
  parseManualScrambleQueue,
  peekOptimal333Result,
  prefetchOptimal333,
  postTimerWcaScrambleMark,
  releaseOptimal333,
  requestCloudOptimalScramble,
  resolveTimerWcaSourceCore,
  resolveKeymap,
  retryOptimal333,
  shouldUseRandomOptimal333,
  summarize,
  takeManualScramble,
  timerEventIdFromSelector,
  timerEventPickerName,
  timerEventSupportsDrill,
  timerManualSourceIdentity,
  timerPrintScrambleSource,
  timerManualEntryCopy,
  timerHistoryMoveTargets,
  timerClearCurrentEventConfirmation,
  timerCanStartAttempt,
  timerCanUseGestureWheel,
  timerCanSwitchScramble,
  timerShouldStopFromExternalPointer,
  timerGestureActionAt,
  timerGestureActionStates,
  timerKeyDownDecision,
  timerKeyUpDecision,
  stepPuzzleOf,
  stageLabel,
  timerByStepsIdentity,
  timerByStepsFilter,
  canTrainerDifficulty,
  trainerSig,
  trainerSpecOf,
  timerScrambleAllowsEmptySlot,
  timerScrambleClickEffect,
  timerScrambleStatus,
  timerWcaRoundShortLabel,
  timerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleMarkKeyFromSlot,
  timerWcaScrambleMarkKeyIdentity,
  timerWcaScrambleProgressLabels,
  timerWcaScrambleEventId,
  timerWcaScrambleSourceLine,
  timerWcaScrambleEmptyReason,
  timerWcaDifficultyFilter,
  timerWcaSupportsOptimal,
  updateTimerWcaScrambleMarkIfExists,
  timerSettingFieldContract,
  variantLabel,
  TIMER_WCA_SCRAMBLE_SOURCE_COPY,
  TIMER_WCA_MIN_DATE,
  timerSupportsRealWcaScrambles,
  timerSupportsStageSplits,
  timerSupportsSmartCubeAutoTiming,
  TimerAttemptSplitRecorder,
  TimerWcaFinitePoolProgressTracker,
  timerTracksTrainerCase,
  type EventId,
  type Penalty,
  type Solve,
  type SolveResult,
  type Scramble222Mode,
  type Scramble222Type,
  type ScrambleHistory,
  type TimerGestureActionId,
  type TimerDrillTarget,
  type TimerPhase,
  type TimerStoreData,
  type TimerStoreSettings,
  type TimerSettingCategoryId,
  type TimerAttemptSplitState,
  type TimerByStepsSettings,
  type TimerRandomDifficultyResult,
  type TimerRandomDifficultySettings,
  type TimerHostSharedScrambleProviderId,
  type TimerManualEntryValue,
  type TimerNon222StepPuzzle,
  type Optimal333Source,
  type TimerWcaDifficultyCoverage,
  type TimerWcaCompetition,
  type TimerWcaSourceSettings,
  type TimerWcaScrambleMarkKey,
  type TimerWcaScrambleMarksResponse,
  type TimerRealScrambleRetryOutcome,
} from '@cuberoot/shared/timer';
import {
  DateRangeInput,
  Flag,
  GestureWheel,
  ManualScrambleQueueEditor,
  SegmentTime,
  TimerDeviceCenter,
  TIMER_DEVICE_CENTER_LABELS,
  TimerSmartCubeDeviceModal,
  TimerInfoToast,
  TimerAttemptSplitSettings,
  TimerAttemptSplitStatus,
  TimerSolveDetailModal,
  TimerCubePreview,
  TimerDrillPicker,
  TimerManualEntryModal,
  TimerMoreMenu,
  TimerPillToggle,
  TimerPlayersSelect,
  TimerPuzzlePicker,
  TimerPrintController,
  TimerScramble222Config,
  TimerScramblePreviewSettings,
  TimerScrambleStrip,
  TimerWcaScrambleSource,
  TimerWcaScrambleProgress,
  TimerByStepsConfig,
  TimerScrambleSourceSelect,
  TimerSessionSwitcher,
  timerSessionSwitcherLabels,
  TimerStatRail,
  TimerStageLayout,
  TimerBooleanSettingRow,
  TimerWorkspace,
  useTimerWideLayout,
  TimerTypographySettings,
  TimerSettingsPanel,
  TimerTimingSettingsSections,
  TimerTopbar,
  TimerWcaSourceConfig,
  TimerWcaDifficultyConfig,
  TimerRandomDifficultyConfig,
  TimerRandomDifficultyCaseBar,
  TIMER_OVERLAY_IDS,
  TimingSurface,
  shouldIgnoreTimerTarget,
  timerKeyboardTargetContext,
  useGestureWheel,
  type TimerRollingStatsPickerLabels,
  type TimerOverlayId,
  type TimerOverlayOpenChangeDetails,
  type TimerPrintControllerHandle,
  type TimerPlayersValue,
  type TimerPuzzlePickerGroup,
  type TimerScramble222Labels,
  type TimerSessionSwitcherHost,
  type TimerByStepsLabels,
  type TimerWcaSourceDataAdapter,
  type TimerWcaSourceLabels,
  type TimerWcaDifficultyLabels,
  TimerSmartCubeSettingsFields,
  useAutoReady,
} from '@cuberoot/timer-ui';
import {
  Clock3,
  Grid2X2,
  Settings as SettingsIcon,
  UserRound,
  X,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';

import {
  COPY,
  dateRangeInputLabels,
  preferredLanguage,
  type SupportedLanguage,
} from './copy';
import {
  CorruptTimerStoreError,
  IndexedDbTimerStoreDriver,
  TimerRepository,
  TimerSessionRepositoryError,
} from './data/timer-repository';
import {
  mergeRealScramblePool,
  isAllTimeRealScrambleDateSource,
  normalizeRealScrambleSourceSpec,
  readRealScrambleCache,
  realScrambleSourceKey,
  writeRealScrambleCache,
  type RealScramble,
  type RealScrambleSourceSpec,
} from './data/real-scramble-pool';
import { startRealScrambleFetchRetry } from './data/real-scramble-retry';
import {
  autoMarkSavedWcaSolve,
  wcaAutoMarkLiveSession,
  wcaAutoMarkOwnerKey,
} from './data/wca-auto-mark';
import {
  LatestSnapshotGate,
  type SnapshotRevision,
} from './data/latest-snapshot-gate';
import { nextMobileCube222SpecialScramble } from './data/cube222-special-pool';
import { nextMobileCube222ByStepsScramble } from './data/cube222-steps-pool';
import { nextMobileNon222ByStepsScramble } from './data/non222-steps-pool';
import {
  awaitMobileRandomDifficulty,
  peekMobileRandomDifficulty,
  prefetchMobileRandomDifficulty,
  releaseMobileRandomDifficulty,
  retryMobileRandomDifficulty,
} from './data/random-difficulty-pool';
import { mobileBackAction } from './mobile-back';
import { MobileVisibleScrambleRequestGate } from './data/visible-scramble-request-gate';
import { MobileSmallPuzzleHints } from './MobileSmallPuzzleHints';
import {
  createMobileScrambleHistoryEntry,
  mobileScrambleAttemptSnapshot,
  planMobileScrambleHistoryDisplay,
  replaceMobileScrambleHistoryEntry,
  type MobileScrambleAttemptSnapshot,
  type MobileScrambleHistoryEntry,
  type MobileScrambleSource as ScrambleSource,
} from './mobile-scramble-history';
import { mobileTimerMoreMenuItems } from './mobile-more-actions';
import {
  displayMobileWcaCompetitionName,
  loadMobileWcaCompetitionScrambles,
  loadMobileWcaCompetitions,
  mobileTimerWcaDifficultyAdapter,
  mobileApiUrl,
} from './data/wca-source-adapter';
import { useTimerController } from './hooks/use-timer-controller';
import {
  LocalBattleMode,
  NetBattleMode,
  type BattleSmartCubeHandlers,
} from './BattleModes';
import {
  mobileShellViewportLayout,
  observeVisibleViewportHeight,
  visibleViewportHeight,
} from './mobile-viewport';
import type { InstalledAppHost } from './platform';
import { startWebSurfaceHandshake } from './web-surface-handshake';
import {
  solveMobileRandomDifficultyCase,
  solveMobileSmartCubeFixup,
  solveMobileSmartCubeAnchor,
} from './smart-cube/fixup';

const SITE_ORIGIN = 'https://cuberoot.me';
const ReconstructModal = lazy(() => import('@cuberoot/timer-ui/reconstruct-modal'));
const ReconstructReport = lazy(() => import('@cuberoot/timer-ui/reconstruct-report'));
const StageSolverDialog = lazy(() => import('./StageSolverDialog'));
const SolveRecap = lazy(() => import('@cuberoot/timer-ui/solve-recap'));
const MOBILE_EMBED_SURFACES = ['tools', 'account'] as const;
const MOBILE_EMBED_INIT_RETRY_MS = 400;
const MOBILE_EMBED_INIT_RETRIES = 25;
const MOBILE_EMBED_AUTH_TIMEOUT_MS = 10_000;
const repository = new TimerRepository(new IndexedDbTimerStoreDriver());
const netRecordingOutbox = new NetRecordingOutbox(({ context, solve }) => repository.saveNetSolve(context.sessionId, solve), createNetOutboxStorage());

type AppView = 'timer' | 'tools' | 'account' | 'history' | 'settings';
type PrimaryView = Extract<AppView, 'timer' | 'tools' | 'account'>;
type ConnectionState = 'checking' | 'offline' | 'online';
type WebSurfaceStatus = 'loading' | 'ready' | 'error';
interface RealPoolRequest {
  cancel(): void;
  promise: Promise<TimerRealScrambleRetryOutcome<RealScramble[]>>;
}

function siteUrl(language: SupportedLanguage): string {
  return language === 'zh' ? `${SITE_ORIGIN}/zh` : `${SITE_ORIGIN}/`;
}

function siteRouteUrl(language: SupportedLanguage, route: string): string {
  const path = route.startsWith('/') ? route : `/${route}`;
  return language === 'zh' ? `${SITE_ORIGIN}/zh${path}` : `${SITE_ORIGIN}${path}`;
}

function privacyUrl(language: SupportedLanguage): string {
  return language === 'zh' ? `${SITE_ORIGIN}/zh/privacy` : `${SITE_ORIGIN}/privacy`;
}

function accountUrl(language: SupportedLanguage, view?: 'delete'): string {
  const path = language === 'zh' ? `${SITE_ORIGIN}/zh/account` : `${SITE_ORIGIN}/account`;
  return view ? `${path}?view=${view}` : path;
}

function applyPreferences(settings: TimerStoreSettings): void {
  if (settings.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
  document.documentElement.lang = settings.language === 'zh' ? 'zh-Hans' : 'en';
}

function downloadBackup(text: string, filename: string, mime: string): void {
  const blobUrl = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

async function shareOrDownloadBackup(text: string, fileSpec = {
  filename: `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`, mime: 'application/json',
}): Promise<void> {
  const { filename, mime } = fileSpec;
  const file = new File([text], filename, { type: mime });
  const shareData: ShareData = { files: [file], title: 'CubeRoot timer backup' };
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  downloadBackup(text, filename, mime);
}


export function App({ host }: { host: InstalledAppHost }) {
  useEffect(() => {
    if (!host.netBattle) return;
    const { client, sessions } = host.netBattle;
    netRecordingOutbox.setUploader(record => uploadNetRecordedAttempt(record, client, sessions));
    void netRecordingOutbox.retry();
  }, [host.netBattle]);
  const timerDeviceRegistry = useMemo(() => createTimerDeviceRegistry({
    adapterIds: ['smart-cube', ...(host.createBleTransport ? ['smart-timer'] : []), ...(host.createStackmatSource ? ['stackmat'] : [])],
    registrations: TIMER_DEVICE_REGISTRATIONS,
  }), [host]);
  const [store, setStore] = useState<TimerStoreData | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const timerSound = useMemo(() => createTimerSound(() => ({
    ...normalizeTimerSoundSettings(storeRef.current?.settings),
    inspectionBeepAt: storeRef.current?.settings.inspectionBeepAt ?? [],
  })), []);
  const metronome = useMemo(() => createMetronome(), []);
  useEffect(() => metronome.attach(), [metronome]);
  useEffect(() => { metronome.setMetronome({ bpm: store?.settings.metronomeBpm ?? 120 }); }, [metronome, store?.settings.metronomeBpm]);
  const onTimerSoundTransition = useTimerSoundFeedback(timerSound);
  useEffect(() => {
    const warm = () => {
      const settings = storeRef.current?.settings;
      if (settings?.soundsEnabled || settings?.inspectionBeepAt.length) timerSound.warmupSound();
      if (settings?.metronomeOn) metronome.warmup();
    };
    window.addEventListener('pointerdown', warm, true);
    window.addEventListener('keydown', warm, true);
    return () => {
      window.removeEventListener('pointerdown', warm, true);
      window.removeEventListener('keydown', warm, true);
      timerSound.dispose();
    };
  }, [timerSound, metronome]);
  const [lastResult, setLastResult] = useState<SolveResult | null>(null);
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  const [recapSolveId, setRecapSolveId] = useState<string | null>(null);
  const recapAttemptRevisionRef = useRef(0);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [view, setView] = useState<AppView>('timer');
  const [settingsCategory, setSettingsCategory] = useState<TimerSettingCategoryId>('timer');
  const [timerMode, setTimerMode] = useState<TimerPlayersValue>(1);
  const wideLayout = useTimerWideLayout();
  const dockHistory = wideLayout && view === 'history' && timerMode === 1;
  const timerVisible = view === 'timer' || view === 'settings' || dockHistory;
  const timerVisibleRef = useRef(timerVisible);
  timerVisibleRef.current = timerVisible;
  const [battleModeActive, setBattleModeActive] = useState(false);
  const battleOverlayCloseRef = useRef<(() => void) | null>(null);
  const onBattleOverlayCloseChange = useCallback((close: (() => void) | null) => {
    battleOverlayCloseRef.current = close;
  }, []);
  const [openedWebViews, setOpenedWebViews] = useState({ tools: false, account: false });
  const [toolsEntryRoute, setToolsEntryRoute] = useState<string | null>(null);
  const [webSurfaceStatus, setWebSurfaceStatus] = useState<Record<MobileEmbedSurface, WebSurfaceStatus>>({
    account: 'loading',
    tools: 'loading',
  });
  const [webSurfaceRevision, setWebSurfaceRevision] = useState<Record<MobileEmbedSurface, number>>({
    account: 0,
    tools: 0,
  });
  const [webSurfaceReloadUrl, setWebSurfaceReloadUrl] = useState<Record<MobileEmbedSurface, string | null>>({
    account: null,
    tools: null,
  });
  const [viewportHeight, setViewportHeight] = useState(visibleViewportHeight);
  const [primaryNavBottomInset, setPrimaryNavBottomInset] = useState(0);
  const primaryNavRef = useRef<HTMLElement>(null);
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [wcaDifficultyCoverage, setWcaDifficultyCoverage] = useState<TimerWcaDifficultyCoverage>('idle');
  const [wcaTopControlsSlot, setWcaTopControlsSlot] = useState<HTMLSpanElement | null>(null);
  const [wcaDifficultyToggleSlot, setWcaDifficultyToggleSlot] = useState<HTMLSpanElement | null>(null);
  const realPoolsRef = useRef(new Map<string, RealScramble[]>());
  const realCurrentBySourceRef = useRef(new Map<string, RealScramble>());
  const realRequestsRef = useRef(new Map<string, RealPoolRequest>());
  const hydratedRealSourcesRef = useRef(new Set<string>());
  const realProgressTrackerRef = useRef(new TimerWcaFinitePoolProgressTracker());
  const [, refreshRealProgress] = useState(0);
  const wcaMarksCacheRef = useRef(new Map<string, TimerWcaScrambleMarksResponse>());
  const wcaMarksRequestsRef = useRef(new Map<string, Promise<TimerWcaScrambleMarksResponse>>());
  const [, refreshWcaMarks] = useState(0);
  const [scrambleSource, setScrambleSource] = useState<ScrambleSource>('wca');
  const [scrambleHistory, setScrambleHistory] = useState<ScrambleHistory<MobileScrambleHistoryEntry>>({
    list: [],
    idx: -1,
  });
  const scrambleHistoryRef = useRef(scrambleHistory);
  const scrambleRequestRef = useRef(0);
  const [ordinaryRandom] = useState(createRandomScrambleClient);
  useEffect(() => () => ordinaryRandom.reset(), [ordinaryRandom]);
  const randomScrambleGateRef = useRef(new MobileVisibleScrambleRequestGate());
  const [toast, setToast] = useState('');
  const [pendingSolves, setPendingSolves] = useState<Array<{
    ownerAtSaveStart: string;
    sessionId: string;
    solve: Omit<Solve, 'id' | 'ts'>;
  }>>([]);
  const retryingPendingSolveRef = useRef(false);
  const [retryingPendingSolve, setRetryingPendingSolve] = useState(false);
  const [undoToast, setUndoToast] = useState<{ message: string; undo(): void } | null>(null);
  const [historyDetail, setHistoryDetail] = useState<{
    autoFocusComment: boolean;
    context: string;
    solveId: string;
  } | null>(null);
  const historyDetailRef = useRef(historyDetail);
  historyDetailRef.current = historyDetail;
  const closeDeviceOverlayRef = useRef<() => void>(() => {});
  const [openOverlay, setOpenOverlay] = useState<TimerOverlayId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(fullscreen);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const historyWorkspaceRef = useRef<TimerHistoryWorkspaceHandle>(null);
  const [historyTab, setHistoryTab] = useState<'history' | 'stats' | 'chart'>('history');
  const [statsOpen, setStatsOpen] = useState(false);
  const [replayImportOpen, setReplayImportOpen] = useState(false);
  const [replaySolve, setReplaySolve] = useState<Solve | null>(null);
  const replayBlocking = replayImportOpen || replaySolve !== null;
  const replayBlockingRef = useRef(false); replayBlockingRef.current = replayBlocking;
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const historyModalOpenRef = useRef(false); historyModalOpenRef.current = historyModalOpen;
  const statsOpenRef = useRef(false); statsOpenRef.current = statsOpen;
  const [timerContextMutationBusy, setTimerContextMutationBusy] = useState(false);
  const [canUndoImport, setCanUndoImport] = useState(false);
  const webFrameRefs = useRef<Record<MobileEmbedSurface, HTMLIFrameElement | null>>({
    account: null,
    tools: null,
  });
  const webLastHrefRef = useRef<Record<MobileEmbedSurface, string>>({
    account: SITE_ORIGIN,
    tools: SITE_ORIGIN,
  });
  const webHandshakeRetryRef = useRef<Record<MobileEmbedSurface, (() => void) | null>>({
    account: null,
    tools: null,
  });
  const webSurfaceLoadedRef = useRef<Record<MobileEmbedSurface, boolean>>({
    account: false,
    tools: false,
  });
  const previousConnectionRef = useRef<ConnectionState>('checking');
  const webDepthRef = useRef<Record<MobileEmbedSurface, number>>({ account: 0, tools: 0 });
  const webBridgeReadyRef = useRef<Record<MobileEmbedSurface, boolean>>({
    account: false,
    tools: false,
  });
  const accountManagementRequestRef = useRef<string | null>(null);
  const accountSyncInFlightRef = useRef<{ requestId: string; token: string } | null>(null);
  const accountSyncTimeoutRef = useRef<number | null>(null);
  const accountSyncedTokenRef = useRef<string | null>(null);
  const viewRef = useRef(view);
  const previousTimerWorkViewRef = useRef(view);
  const timerModeRef = useRef<TimerPlayersValue>(timerMode);
  const battleSmartCubeHandlersRef = useRef<BattleSmartCubeHandlers | null>(null);
  const battleModeActiveRef = useRef(battleModeActive);
  const timingRunningRef = useRef(false);
  const timingEnabledRef = useRef(true);
  const timerPhaseRef = useRef<TimerPhase>('idle');
  const cancelTimerArmRef = useRef<() => boolean>(() => false);
  const timerContextMutationBusyRef = useRef(false);
  const timerOverlayBlocking = openOverlay !== null || statsOpen || historyModalOpen || replayBlocking;
  const openOverlayRef = useRef<TimerOverlayId | null>(openOverlay);
  const solverDismissRef = useRef<(() => boolean) | null>(null);
  const registerSolverDismiss = useCallback((dismiss: (() => boolean) | null) => { solverDismissRef.current = dismiss; }, []);
  const wcaMarksOverlayIdentityRef = useRef<string | null>(null);
  const moreOpenRef = useRef(moreOpen);
  const manualEntryOpenRef = useRef(manualEntryOpen);
  const printControllerRef = useRef<TimerPrintControllerHandle>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gestureActionsRef = useRef<Partial<Record<TimerGestureActionId, () => void>>>({});
  const keymapRef = useRef(resolveKeymap(undefined));
  const fallbackLanguage = preferredLanguage();
  const language = store?.settings.language ?? fallbackLanguage;
  const copy = COPY[language];
  const toolsWebUrl = toolsEntryRoute
    ? siteRouteUrl(language, toolsEntryRoute)
    : siteUrl(language);
  const accountWebUrl = accountUrl(language);
  const auth = host.useAuth(language);
  const activeAuthSession = wcaAutoMarkLiveSession(auth.session, auth.busy);
  const authSessionRef = useRef(auth.session);
  authSessionRef.current = activeAuthSession;
  const logoutEverywhereRef = useRef(auth.logout);
  const setBattleSmartCubeHandlers = useCallback((handlers: BattleSmartCubeHandlers | null) => {
    battleSmartCubeHandlersRef.current = handlers;
  }, []);
  const activeEvent = store?.settings.event ?? '333';
  const [trainerSubsetOpen, setTrainerSubsetOpen] = useState<'oll' | 'pll' | null>(null);
  const trainerSubsetOpenRef = useRef(trainerSubsetOpen);
  trainerSubsetOpenRef.current = trainerSubsetOpen;
  useEffect(() => {
    if (view !== 'settings' || settingsCategory !== 'training') setTrainerSubsetOpen(null);
  }, [view, settingsCategory]);
  const [drillTarget, setDrillTarget] = useState<TimerDrillTarget | null>(null);
  const effectiveDrillTarget = timerEventSupportsDrill(activeEvent) ? drillTarget : null;
  const drillTargetRef = useRef<TimerDrillTarget | null>(effectiveDrillTarget);
  drillTargetRef.current = effectiveDrillTarget;
  useEffect(() => {
    if (!timerEventSupportsDrill(activeEvent) && drillTarget) setDrillTarget(null);
  }, [activeEvent, drillTarget]);
  const multiStageActive = (store?.settings.multiStage ?? false)
    && timerSupportsStageSplits(activeEvent);
  const bldMemoActive = (store?.settings.bldMemo ?? true) && isBldEvent(activeEvent);
  const timingEnabled = store?.settings.timingEnabled ?? true;
  timingEnabledRef.current = timingEnabled;
  const hideRunningTime = store?.settings.hideTime ?? false;
  const runningPrecision = store?.settings.runningPrecision ?? 3;
  const resultPrecision = store?.settings.precision ?? 3;
  const manualScrambles = store?.settings.manualScrambles ?? '';
  const scramble222Mode = store?.settings.scramble222Mode ?? 'optimal';
  const scramble222Type = store?.settings.scramble222Type ?? 'full';
  const byStepsSettings: TimerByStepsSettings = {
    genByStepsOn: store?.settings.genByStepsOn ?? DEFAULT_TIMER_BY_STEPS_SETTINGS.genByStepsOn,
    genStepsMetric: store?.settings.genStepsMetric ?? DEFAULT_TIMER_BY_STEPS_SETTINGS.genStepsMetric,
    genSteps: store?.settings.genSteps ?? [...DEFAULT_TIMER_BY_STEPS_SETTINGS.genSteps],
  };
  const randomDifficultySettings = normalizeTimerRandomDifficultySettings(
    store?.settings ?? DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
  );
  const randomDifficultySpec = !store?.settings.syncSeed && timerMode === 1 && scrambleSource === 'random'
    ? trainerSpecOf(activeEvent, randomDifficultySettings)
    : null;
  const randomDifficultySignature = randomDifficultySpec
    ? trainerSig(activeEvent, randomDifficultySettings)
    : '';
  const randomDifficultySpecRef = useRef(randomDifficultySpec);
  randomDifficultySpecRef.current = randomDifficultySpec;
  // Unmapped retained-Real events (Ivy/Gear) use their local random provider.
  // Keep their by-steps identity in React dependencies too: the WCA source key
  // is intentionally just `unmapped|event`, so it cannot trigger regeneration.
  const byStepsSourceSignature = store?.settings.syncSeed ? '' : timerByStepsIdentity(
    activeEvent,
    scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)
      ? 'wca'
      : 'random',
    byStepsSettings,
    scramble222Mode,
  );
  const wcaSourceSettings: TimerWcaSourceSettings = store?.settings
    ?? DEFAULT_TIMER_WCA_SOURCE_SETTINGS;
  const randomOptimalOwner = activeAuthSession
    ? ownerKey(activeAuthSession.user.uid, activeAuthSession.user.wcaId)
    : '';
  const randomOptimalAvailable = canUseRandomOptimal333(
    activeEvent,
    scrambleSource,
    Boolean(activeAuthSession),
    store?.settings.syncSeed ?? null,
  );
  const randomOptimalRequested = timerMode === 1 && shouldUseRandomOptimal333(
    wcaSourceSettings.wcaUseOptimal,
    activeEvent,
    scrambleSource,
    Boolean(activeAuthSession),
    store?.settings.syncSeed ?? null,
  );
  const randomOptimalAuthPending = !store?.settings.syncSeed && timerMode === 1
    && wcaSourceSettings.wcaUseOptimal
    && activeEvent === '333'
    && scrambleSource === 'random'
    && (auth.loading || auth.busy);
  const randomOptimalKey = randomOptimalRequested
    ? `${randomOptimalOwner}|${effectiveDrillTarget
      ? `drill:${effectiveDrillTarget.type}:${effectiveDrillTarget.id}`
      : randomDifficultySignature
        ? `difficulty:${randomDifficultySignature}`
        : 'normal'}`
    : '';
  const randomOptimalSource = useMemo<Optimal333Source | null>(() => {
    if (!randomOptimalRequested || !randomOptimalKey) return null;
    const target = effectiveDrillTarget;
    return {
      key: randomOptimalKey,
      generateBase: async (signal) => {
        if (target) {
          const generated = generateTimerDrillScramble(target);
          if (generated) return generated.scramble;
          throw new Error('could not generate optimal drill base state');
        }
        const difficulty = randomDifficultySpecRef.current;
        if (difficulty) {
          prefetchMobileRandomDifficulty(difficulty);
          const status = await awaitMobileRandomDifficulty(difficulty);
          if (signal.aborted) throw new Error('optimal 3x3 generation aborted');
          if (status === 'ready') {
            const generated = peekMobileRandomDifficulty(difficulty);
            if (generated) {
              return { kind: 'ready', scramble: generated.scramble, context: generated } as const;
            }
          }
          if (status === 'empty' || status === 'rare' || status === 'error') {
            return { kind: 'unavailable', reason: status } as const;
          }
          throw new Error('random difficulty base state became idle');
        }
        const generated = await generateTimerScramble({ event: activeEvent });
        if (signal.aborted) throw new Error('optimal 3x3 generation aborted');
        if (!generated.ok || generated.kind === 'manual') {
          throw new Error('could not generate optimal 3x3 base state');
        }
        return generated.scramble;
      },
      optimize: async (base, signal) => {
        const token = authSessionRef.current?.token;
        if (!token) throw new Error('optimal 3x3 requires authentication');
        try {
          return (await requestCloudOptimalScramble(base, {
            url: mobileApiUrl('/v1/scramble/optimal-solve'),
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal,
          })).scramble;
        } catch (error) {
          if (error instanceof CloudOptimalScrambleHttpError
            && error.status === 401
            && !signal.aborted
            && authSessionRef.current?.token === token) {
            void logoutEverywhereRef.current();
          }
          throw error;
        }
      },
    };
  }, [
    activeEvent,
    effectiveDrillTarget,
    randomDifficultySignature,
    randomOptimalKey,
    randomOptimalRequested,
  ]);
  const randomOptimalSourceRef = useRef(randomOptimalSource);
  randomOptimalSourceRef.current = randomOptimalSource;
  useEffect(() => {
    if (!timerVisible || !randomOptimalSource) {
      releaseOptimal333();
      return;
    }
    prefetchOptimal333(randomOptimalSource);
    return () => releaseOptimal333();
  }, [randomOptimalKey, randomOptimalSource, timerVisible]);
  useEffect(() => {
    if (!timerVisible) {
      releaseMobileRandomDifficulty();
      return;
    }
    const spec = randomDifficultySpecRef.current;
    if (spec) prefetchMobileRandomDifficulty(spec);
    else releaseMobileRandomDifficulty();
  }, [randomDifficultySignature, timerVisible]);
  const optimalAvailable = scrambleSource === 'wca'
    ? timerWcaSupportsOptimal(timerWcaScrambleEventId(activeEvent))
    : randomOptimalAvailable;
  const activeRealSourceSpec: RealScrambleSourceSpec = {
    event: activeEvent,
    scramble222Mode,
    scramble222Type,
    ...byStepsSettings,
    ...wcaSourceSettings,
  };
  const activeRealSourceKey = realScrambleSourceKey(activeRealSourceSpec);
  const wcaSourceSignature = `${activeRealSourceKey}|unindexed:${
    wcaDifficultyCoverage === 'unindexed' ? 1 : 0
  }`;
  const storeLoaded = store !== null;
  const solves = store ? activeTimerSolves(store, activeEvent) : [];
  const trainingSettings = store?.settings ?? normalizeTimerTrainingSettings();
  const targetMs = trainingSettings.targetMsByEvent[activeEvent] ?? null;
  const trainingRound = useTimerRound(solves, trainingSettings.round, `${store?.database.activeSessionId ?? ''}|${activeEvent}`);
  const allSessionSolves = useMemo(() => store ? Object.values(store.database.dataBySession[store.database.activeSessionId] ?? {}).flatMap(list => list ?? []) : [], [store?.database]);
  useEffect(() => { if (view !== 'history') setStatsOpen(false); }, [view]);
  const historyContext = `${store?.database.activeSessionId ?? ''}|${activeEvent}`;
  const historyDetailSolve = historyDetail?.context === historyContext
    ? solves.find((solve) => solve.id === historyDetail.solveId) ?? null
    : null;
  const historyDetailIndex = historyDetailSolve
    ? solves.findIndex((solve) => solve.id === historyDetailSolve.id)
    : -1;
  const activePrintSessionName = useMemo(() => store?.database.sessions.find(
    (session) => session.id === store.database.activeSessionId,
  )?.name, [store]);
  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const stats = useMemo(() => summarize(solves, activeEvent), [activeEvent, solves]);
  const historyMoveTargets = useMemo(() => store
    ? timerHistoryMoveTargets(store.database.sessions, store.database.activeSessionId)
    : [], [store]);
  const eventPickerGroups = useMemo<readonly TimerPuzzlePickerGroup[]>(() => (
    TIMER_EVENT_PICKER_GROUPS.map((group) => ({
      id: group.id,
      label: [group.nameEn, group.nameZh][Number(language === 'zh')],
      items: group.items.map((item) => ({
        id: item.id,
        label: [item.nameEn, item.nameZh][Number(language === 'zh')],
        iconClass: item.iconClass,
        textLabel: item.textLabel,
      })),
    }))
  ), [language]);
  const scramble222Labels = useMemo<TimerScramble222Labels>(() => ({
    modeAriaLabel: SCRAMBLE_222_UI_LABELS.modeAriaLabel[language],
    modeLabel: SCRAMBLE_222_UI_LABELS.modeLabel[language],
    optimal: SCRAMBLE_222_UI_LABELS.optimal[language],
    type: SCRAMBLE_222_UI_LABELS.type[language],
    typeAriaLabel: SCRAMBLE_222_UI_LABELS.typeAriaLabel[language],
    typeOptions: Object.fromEntries(
      SCRAMBLE_222_TYPE_CATALOG.map((item) => [item.id, item.label[language]]),
    ) as Record<Scramble222Type, string>,
    wca11Move: SCRAMBLE_222_UI_LABELS.wca11Move[language],
  }), [language]);
  const byStepsLabels = useMemo<TimerByStepsLabels>(() => ({
    bySteps: TIMER_BY_STEPS_UI_LABELS.bySteps[language],
    byStepsAriaLabel: TIMER_BY_STEPS_UI_LABELS.byStepsAriaLabel[language],
    metricAriaLabel: TIMER_BY_STEPS_UI_LABELS.metricAriaLabel[language],
    metricOptions: Object.fromEntries(
      Object.values(STEP_METRICS).flatMap((metrics) => (
        metrics.map((metric) => [metric.key, metric[language]] as const)
      )),
    ),
    stepRangeAriaLabel: TIMER_BY_STEPS_UI_LABELS.stepRangeAriaLabel[language],
  }), [language]);
  const wcaSourceLabels = useMemo<TimerWcaSourceLabels>(() => ({
    all: copy.all,
    clearCompetition: copy.clearCompetition,
    comp: copy.competition,
    competitionListFailed: copy.competitionListFailed,
    competitionListLoading: copy.competitionListLoading,
    competitionSearch: copy.searchCompetition,
    competitionScramblesFailed: copy.competitionScramblesFailed,
    competitionScramblesLoading: copy.competitionScramblesLoading,
    date: copy.date,
    dateRange: copy.dateRange,
    group: copy.group,
    groupOption: (group) => copy.groupOption(group),
    noEventScrambles: copy.noEventScrambles,
    noMatchingCompetitions: copy.noMatchingCompetitions,
    retry: copy.retry,
    round: copy.round,
    sourceMode: copy.realScrambleRange,
  }), [copy]);
  const wcaDifficultyLabels = useMemo<TimerWcaDifficultyLabels>(() => ({
    colorSubsetAriaLabel: copy.colorSubset,
    difficulty: copy.difficulty,
    difficultyAriaLabel: copy.difficultyFilter,
    merge: copy.merge,
    mergeAriaLabel: copy.mergeAriaLabel,
    mergeHelp: copy.mergeHelp,
    methodAriaLabel: copy.method,
    methodLabel: (key) => variantLabel(key, language === 'zh'),
    rangeAriaLabel: copy.stepRange,
    scrambleLengthRangeAriaLabel: copy.scrambleLengthRange,
    stageAriaLabel: copy.stage,
    stageLabel: (key) => stageLabel(key, language === 'zh'),
    unindexedCompetition: copy.unindexedCompetition,
  }), [copy, language]);
  const wcaProgressLabels = useMemo(
    () => timerWcaScrambleProgressLabels(language),
    [language],
  );
  const manualEntryLabels = useMemo(() => timerManualEntryCopy(language), [language]);
  const dateRangeLabels = useMemo(() => dateRangeInputLabels(language), [language]);
  const sessionLabels = useMemo(() => timerSessionSwitcherLabels(language), [language]);
  const rollingPickerLabels = useMemo<TimerRollingStatsPickerLabels>(() => ({
    changeColumn: copy.statsChangeColumn,
    clear: copy.clear,
    customPlaceholder: copy.statsCustomPlaceholder,
    customSize: copy.statsCustomSize,
    replace: copy.replace,
  }), [copy]);
  const wcaSourceAdapter = useMemo<TimerWcaSourceDataAdapter>(() => ({
    loadCompetitions: () => loadMobileWcaCompetitions(language),
    loadCompetitionScrambles: (competitionId, signal) => (
      loadMobileWcaCompetitionScrambles(competitionId, fetch, signal)
    ),
  }), [language]);
  const activeEventRef = useRef(activeEvent);
  const scramble222ModeRef = useRef<Scramble222Mode>(scramble222Mode);
  const scramble222TypeRef = useRef<Scramble222Type>(scramble222Type);
  const byStepsSettingsRef = useRef<TimerByStepsSettings>(byStepsSettings);
  const randomDifficultySettingsRef = useRef<TimerRandomDifficultySettings>(
    randomDifficultySettings,
  );
  const scrambleSourceRef = useRef(scrambleSource);
  const manualScramblesRef = useRef(manualScrambles);
  const [manualSourceInitialRevision] = useState(() => createTimerSourceRevision(
    globalThis.crypto.randomUUID(),
    manualScrambles,
  ));
  const manualSourceRevisionRef = useRef(manualSourceInitialRevision);
  const battleSourceSettings = normalizeTimerWcaSourceSettings({
    wcaScrambleMode: wcaSourceSettings.wcaScrambleMode, wcaComp: wcaSourceSettings.wcaComp,
    wcaCompName: wcaSourceSettings.wcaCompName, wcaRound: wcaSourceSettings.wcaRound,
    wcaGroup: wcaSourceSettings.wcaGroup, wcaDateFrom: wcaSourceSettings.wcaDateFrom,
    wcaDateTo: wcaSourceSettings.wcaDateTo, wcaUseOptimal: wcaSourceSettings.wcaUseOptimal,
  });
  const battleSourceKey = JSON.stringify([scrambleSource === 'wca', battleSourceSettings]);
  const battleScrambleProvider = useMemo(() => createInstalledBattleScrambleProvider(
    scrambleSource === 'wca' ? 'wca' : 'random', battleSourceSettings,
  // Only the source specification changes the provider, not unrelated settings or renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [battleSourceKey]);
  const wcaSourceSettingsRef = useRef<TimerWcaSourceSettings>(wcaSourceSettings);
  const manualCursorRef = useRef(0);
  const previousScrambleSourceRef = useRef<ScrambleSource>('wca');
  const previousScrambleEventRef = useRef<EventId>('333');
  const previousManualScramblesRef = useRef('');
  const storeSnapshotGateRef = useRef(new LatestSnapshotGate<TimerStoreData>());
  activeEventRef.current = activeEvent;
  scramble222ModeRef.current = scramble222Mode;
  scramble222TypeRef.current = scramble222Type;
  byStepsSettingsRef.current = byStepsSettings;
  randomDifficultySettingsRef.current = randomDifficultySettings;
  scrambleSourceRef.current = scrambleSource;
  manualScramblesRef.current = manualScrambles;
  wcaSourceSettingsRef.current = wcaSourceSettings;
  viewRef.current = view;
  timerModeRef.current = timerMode;
  battleModeActiveRef.current = battleModeActive;
  openOverlayRef.current = openOverlay;
  moreOpenRef.current = moreOpen;
  manualEntryOpenRef.current = manualEntryOpen;
  fullscreenRef.current = fullscreen;

  const beginTimerContextMutation = useCallback((): boolean => {
    if (timerContextMutationBusyRef.current) return false;
    timerContextMutationBusyRef.current = true;
    setTimerContextMutationBusy(true);
    return true;
  }, []);

  const endTimerContextMutation = useCallback(() => {
    timerContextMutationBusyRef.current = false;
    setTimerContextMutationBusy(false);
  }, []);

  const applyStoreSnapshot = useCallback((data: TimerStoreData) => {
    storeRef.current = data;
    keymapRef.current = resolveKeymap(data.settings.keymap);
    activeEventRef.current = data.settings.event;
    scramble222ModeRef.current = data.settings.scramble222Mode;
    scramble222TypeRef.current = data.settings.scramble222Type;
    byStepsSettingsRef.current = {
      genByStepsOn: data.settings.genByStepsOn,
      genStepsMetric: data.settings.genStepsMetric,
      genSteps: data.settings.genSteps,
    };
    randomDifficultySettingsRef.current = normalizeTimerRandomDifficultySettings(data.settings);
    manualSourceRevisionRef.current = advanceTimerSourceRevision(
      manualSourceRevisionRef.current,
      data.settings.manualScrambles,
    );
    manualScramblesRef.current = data.settings.manualScrambles;
    wcaSourceSettingsRef.current = data.settings;
    setStore(data);
    applyPreferences(data.settings);
  }, []);

  const realSpecFor = useCallback((event: EventId): RealScrambleSourceSpec => ({
    event,
    scramble222Mode: scramble222ModeRef.current,
    scramble222Type: scramble222TypeRef.current,
    ...byStepsSettingsRef.current,
    ...wcaSourceSettingsRef.current,
  }), []);

  const scrambleIdentityFor = useCallback((source: ScrambleSource, event: EventId): string => {
    const seed = storeRef.current?.settings;
    if (seed?.syncSeed && event !== 'custom' && source !== 'manual' && (source !== 'wca' || !timerSupportsRealWcaScrambles(event))) {
      return JSON.stringify(['seed', source, event, seed.syncSeed, seed.syncSeedRevision, seed.cnMode,
        scramble222ModeRef.current, scramble222TypeRef.current, seed.ollSubset, seed.pllSubset, timerEventSupportsDrill(event) ? drillTargetRef.current : null]);
    }
    const withGenerationOptions = (identity: string) => {
      if (event === 'oll' || event === 'pll') identity += JSON.stringify(storeRef.current?.settings[event === 'oll' ? 'ollSubset' : 'pllSubset']);
      const target = source !== 'manual' && timerEventSupportsDrill(event)
        ? drillTargetRef.current
        : null;
      const difficultyIdentity = timerModeRef.current === 1 && source === 'random' && !target
        ? trainerSig(event, randomDifficultySettingsRef.current)
        : '';
      const drillIdentity = target
        ? `${identity}|drill:${target.type}:${target.id}`
        : difficultyIdentity
          ? `${identity}|difficulty:${difficultyIdentity}`
          : identity;
      if (source === 'random' && event === '333' && randomOptimalAuthPending) {
        return `${drillIdentity}|optimal:auth-pending`;
      }
      return source === 'random' && event === '333' && randomOptimalRequested
        ? `${drillIdentity}|optimal:${randomOptimalKey}`
        : drillIdentity;
    };
    if (source === 'wca') return withGenerationOptions(`wca|${realScrambleSourceKey(realSpecFor(event))}`);
    if (source === 'manual') {
      return timerManualSourceIdentity(event, manualSourceRevisionRef.current);
    }
    if (event === '222') {
      return withGenerationOptions(`random|222|${scramble222ModeRef.current}|${scramble222TypeRef.current}|${
        scramble222TypeRef.current === 'full'
          ? timerByStepsIdentity('222', 'random', byStepsSettingsRef.current, scramble222ModeRef.current)
          : ''
      }`);
    }
    const hasHigherPriorityGenerator = timerEventSupportsDrill(event) && drillTargetRef.current
      ? true
      : timerModeRef.current === 1
        && trainerSig(event, randomDifficultySettingsRef.current).length > 0;
    return withGenerationOptions(`random|${event}|${hasHigherPriorityGenerator
      ? ''
      : timerByStepsIdentity(event, 'random', byStepsSettingsRef.current)}`);
  }, [randomOptimalAuthPending, randomOptimalKey, randomOptimalRequested, realSpecFor]);

  const writeScrambleHistory = useCallback((next: ScrambleHistory<MobileScrambleHistoryEntry>) => {
    scrambleHistoryRef.current = next;
    setScrambleHistory(next);
  }, []);

  const applyScrambleHistory = useCallback((next: ScrambleHistory<MobileScrambleHistoryEntry>) => {
    // A displayed-slot change is an attempt boundary. Match Web by cancelling
    // every pre-run phase before a later pointer/key release can start another
    // history entry.
    cancelTimerArmRef.current();
    writeScrambleHistory(next);
  }, [writeScrambleHistory]);

  const replaceScrambleHistoryEntry = useCallback((
    id: number,
    sourceIdentity: string,
    patch: Partial<Pick<
      MobileScrambleHistoryEntry,
      'seedRequest' | 'availability' | 'caseId' | 'currentReal' | 'failure' | 'scramble' | 'sourceSnapshot' | 'trainerMeta'
    >>,
  ): boolean => {
    const current = scrambleHistoryRef.current;
    const next = replaceMobileScrambleHistoryEntry(current, id, sourceIdentity, patch);
    if (next === current) return false;
    writeScrambleHistory(next);
    return true;
  }, [writeScrambleHistory]);

  const currentScrambleEntry = scrambleHistory.list[scrambleHistory.idx] ?? null;
  const scramble = currentScrambleEntry?.scramble ?? '';
  const [smartCubeGuidance, setSmartCubeGuidance] = useState<SmartCubeGuidanceState>({
    correctionActive: false,
    hint: null,
    match: null,
  });
  const scrambleCaseId = currentScrambleEntry?.caseId ?? null;
  const currentReal = currentScrambleEntry?.currentReal ?? null;
  const [currentRealCompetition, setCurrentRealCompetition] = useState<TimerWcaCompetition | null>(null);
  const scrambleAvailability = currentScrambleEntry?.availability ?? 'loading';
  const currentWcaMarkKey = useMemo<TimerWcaScrambleMarkKey | null>(() => (
    currentReal && scrambleSource === 'wca'
      ? timerWcaScrambleMarkKeyFromSlot(currentReal)
      : null
  ), [currentReal, scrambleSource]);
  const currentWcaMarkIdentity = useMemo(() => currentWcaMarkKey
    ? timerWcaScrambleMarkKeyIdentity(currentWcaMarkKey)
    : null, [currentWcaMarkKey]);
  const currentWcaMarks = currentWcaMarkIdentity
    ? wcaMarksCacheRef.current.get(currentWcaMarkIdentity)
    : undefined;
  const currentWcaOwnerKey = auth.session
    ? ownerKey(auth.session.user.uid, auth.session.user.wcaId)
    : '';
  const currentWcaMarked = Boolean(currentWcaOwnerKey && currentWcaMarks?.marks.some(
    (mark) => mark.wcaId === currentWcaOwnerKey,
  ));
  const currentRealProgress = currentReal
    && scrambleSource === 'wca'
    && currentScrambleEntry?.sourceIdentity === `wca|${activeRealSourceKey}`
    && isAllTimeRealScrambleDateSource(activeRealSourceSpec)
    ? realProgressTrackerRef.current.get(activeRealSourceKey)
    : null;

  const loadWcaMarks = useCallback(async (
    key: TimerWcaScrambleMarkKey,
    refresh = false,
  ): Promise<TimerWcaScrambleMarksResponse> => {
    const identity = timerWcaScrambleMarkKeyIdentity(key);
    if (!refresh) {
      const cached = wcaMarksCacheRef.current.get(identity);
      if (cached) return cached;
    }
    const pending = wcaMarksRequestsRef.current.get(identity);
    if (pending) {
      const result = await pending;
      if (!refresh) return result;
    }
    const request = fetchTimerWcaScrambleMarks(key, {
      apiBase: mobileApiUrl(''),
      fetcher: (input, init) => fetch(input, init),
    });
    wcaMarksRequestsRef.current.set(identity, request);
    try {
      const result = await request;
      wcaMarksCacheRef.current.set(identity, result);
      refreshWcaMarks((revision) => revision + 1);
      return result;
    } finally {
      if (wcaMarksRequestsRef.current.get(identity) === request) {
        wcaMarksRequestsRef.current.delete(identity);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentWcaMarkKey || !currentWcaMarkIdentity) return;
    const timerId = window.setTimeout(() => {
      void loadWcaMarks(currentWcaMarkKey).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timerId);
  }, [currentWcaMarkIdentity, currentWcaMarkKey, loadWcaMarks]);

  useEffect(() => {
    const competitionId = currentReal?.competitionId;
    let active = true;
    setCurrentRealCompetition(null);
    if (!competitionId) return () => { active = false; };
    void wcaSourceAdapter.loadCompetitions().then((competitions) => {
      if (active) {
        setCurrentRealCompetition(
          competitions.find((competition) => competition.id === competitionId) ?? null,
        );
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [currentReal?.competitionId, wcaSourceAdapter]);

  const realPoolFor = useCallback((input: RealScrambleSourceSpec): RealScramble[] => {
    const spec = normalizeRealScrambleSourceSpec(input);
    const sourceKey = realScrambleSourceKey(spec);
    if (!hydratedRealSourcesRef.current.has(sourceKey)) {
      hydratedRealSourcesRef.current.add(sourceKey);
      realPoolsRef.current.set(sourceKey, readRealScrambleCache(spec));
    }
    const existing = realPoolsRef.current.get(sourceKey);
    if (existing) return existing;
    const created: RealScramble[] = [];
    realPoolsRef.current.set(sourceKey, created);
    return created;
  }, []);

  const refillRealPool = useCallback((
    input: RealScrambleSourceSpec,
  ): Promise<TimerRealScrambleRetryOutcome<RealScramble[]>> => {
    const spec = normalizeRealScrambleSourceSpec(input);
    const sourceKey = realScrambleSourceKey(spec);
    const inFlight = realRequestsRef.current.get(sourceKey);
    if (inFlight) return inFlight.promise;
    const run = startRealScrambleFetchRetry(spec, {
      onClosedSet: isAllTimeRealScrambleDateSource(spec)
        ? (scrambles) => {
            if (!realProgressTrackerRef.current.registerClosedSet(sourceKey, scrambles)) return;
            const current = realCurrentBySourceRef.current.get(sourceKey);
            if (current) realProgressTrackerRef.current.noteServed(sourceKey, current);
            refreshRealProgress((revision) => revision + 1);
          }
        : undefined,
    });
    let request!: Promise<TimerRealScrambleRetryOutcome<RealScramble[]>>;
    request = run.result.then((outcome) => {
      if (outcome.kind !== 'ready') return outcome;
      const incoming = outcome.value;
      const pool = realPoolFor(spec);
      const current = realCurrentBySourceRef.current.get(sourceKey);
      const merged = mergeRealScramblePool(
        pool,
        incoming,
        current,
        spec.wcaScrambleMode === 'comp' && Boolean(spec.wcaComp),
      );
      realPoolsRef.current.set(sourceKey, merged);
      writeRealScrambleCache(
        spec,
        current ? [current, ...merged] : merged,
        localStorage,
        Date.now(),
      );
      return outcome;
    }).finally(() => {
      if (realRequestsRef.current.get(sourceKey)?.promise === request) {
        realRequestsRef.current.delete(sourceKey);
      }
    });
    realRequestsRef.current.set(sourceKey, { cancel: run.cancel, promise: request });
    return request;
  }, [realPoolFor]);

  const generateRandomScramble = useCallback((
    entry: MobileScrambleHistoryEntry,
    requestId: number,
  ) => {
    const controller = randomScrambleGateRef.current.begin();
    const { event, source: expectedSource } = entry;
    const ticket = timerSeedTicket(storeRef.current?.settings ?? {});
    if (ticket && event !== 'custom') {
      const request: TimerSeedRequest = entry.seedRequest ?? {
        ticket, event, cnMode: storeRef.current?.settings.cnMode,
        trainerCaseIds: event === 'oll' ? storeRef.current?.settings.ollSubset : event === 'pll' ? storeRef.current?.settings.pllSubset : undefined,
        scramble222Mode: scramble222ModeRef.current, scramble222Type: scramble222TypeRef.current,
        drill: timerEventSupportsDrill(event) ? drillTargetRef.current : null,
      };
      replaceScrambleHistoryEntry(entry.id, entry.sourceIdentity, { seedRequest: request });
      const current = () => !controller.signal.aborted && requestId === scrambleRequestRef.current
        && activeEventRef.current === event && scrambleSourceRef.current === expectedSource
        && scrambleIdentityFor(expectedSource, event) === entry.sourceIdentity
        && scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx]?.id === entry.id;
      void nextSeededScramble(request, controller.signal).then(async result => {
        if (!current()) return;
        if (!beginTimerContextMutation()) throw new Error('Timer busy');
        const revision = storeSnapshotGateRef.current.beginMutation();
        try {
          const data = await repository.commitSeed(request.ticket, current);
          if (!storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot)) {
            const latest = storeRef.current;
            if (latest) applyStoreSnapshot({ ...latest, settings: mergeTimerSeedProgress(latest.settings, data.settings) });
          }
          if (current()) replaceScrambleHistoryEntry(entry.id, entry.sourceIdentity, {
            availability: 'ready', failure: null, currentReal: null,
            scramble: result.scramble, caseId: result.caseId,
          });
        } finally { endTimerContextMutation(); }
      }).catch(() => {
        if (current()) replaceScrambleHistoryEntry(entry.id, entry.sourceIdentity, {
          availability: 'error', failure: { kind: 'generation', code: 'generation-failed', retryable: true },
        });
      }).finally(() => randomScrambleGateRef.current.finish(controller));
      return;
    }
    const requested222Mode = scramble222ModeRef.current;
    const requested222Type = scramble222TypeRef.current;
    const requestedBySteps = normalizeTimerByStepsSettings(
      event,
      'random',
      byStepsSettingsRef.current,
    );
    const requestedIdentity = entry.sourceIdentity;
    const use222BySteps = event === '222'
      && requested222Type === 'full'
      && requestedBySteps.genByStepsOn;
    const stepPuzzle = stepPuzzleOf(event);
    const non222ByStepsEvent: TimerNon222StepPuzzle | null = requestedBySteps.genByStepsOn
      && stepPuzzle
      && stepPuzzle !== '222'
      ? stepPuzzle
      : null;
    const request = {
      event,
      scramble222Mode: requested222Mode,
      scramble222Type: requested222Type,
      trainerCaseIds: event === 'oll' ? storeRef.current?.settings.ollSubset : event === 'pll' ? storeRef.current?.settings.pllSubset : undefined,
      cnMode: use222BySteps || non222ByStepsEvent ? 'none' : storeRef.current?.settings.cnMode,
    } as const;
    const specialistDependencies = (event === '222' && (requested222Type !== 'full' || use222BySteps))
      || non222ByStepsEvent !== null

      ? {
          generateCubingScramble: non222ByStepsEvent
            ? (_cubingEventId: string, requestedEvent: EventId): Promise<string> => {
                if (requestedEvent !== non222ByStepsEvent) {
                  return Promise.reject(new Error('invalid by-steps cubing request'));
                }
                return nextMobileNon222ByStepsScramble(
                  non222ByStepsEvent,
                  requestedBySteps,
                  controller.signal,
                );
              }
            : undefined,
          generateSharedScramble: (
            provider: TimerHostSharedScrambleProviderId,
            requestedEvent: EventId,
          ): Promise<string> => {
            if (provider === 'small-puzzle-random-state' && non222ByStepsEvent) {
              if (requestedEvent !== non222ByStepsEvent) {
                return Promise.reject(new Error('invalid by-steps small-puzzle request'));
              }
              return nextMobileNon222ByStepsScramble(
                non222ByStepsEvent,
                requestedBySteps,
                controller.signal,
              );
            }
            if (provider !== 'wca-pocket' || requestedEvent !== '222') {
              return Promise.reject(new Error('invalid 2x2 specialist provider request'));
            }
            return requested222Type === 'full'
              ? nextMobileCube222ByStepsScramble(requestedBySteps, requested222Mode, controller.signal)
              : nextMobileCube222SpecialScramble(requested222Type, controller.signal);
          },
        }
      : undefined;
    const pending = specialistDependencies
      ? generateTimerScramble(request, specialistDependencies)
      : ordinaryRandom.next(request, controller.signal);
    void pending.then((result) => {
      if (controller.signal.aborted
        || requestId !== scrambleRequestRef.current
        || activeEventRef.current !== event
        || scrambleSourceRef.current !== expectedSource
        || scrambleIdentityFor(expectedSource, event) !== requestedIdentity) return;
      if (!result.ok) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
          availability: result.code === 'unsupported-event' ? 'unsupported' : 'error',
          failure: { kind: 'generation', code: result.code, retryable: result.retryable },
        });
        return;
      }
      if (result.kind === 'manual') {
        // Custom has an intentionally empty user-supplied slot on Web for
        // both Random and retained-WCA. It is ready, not unsupported.
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
          availability: 'ready',
          caseId: null,
          currentReal: null,
          failure: null,
          scramble: '',
        });
        return;
      }
      replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
        availability: 'ready',
        caseId: timerTracksTrainerCase(event) ? result.metadata?.caseId ?? null : null,
        currentReal: null,
        failure: null,
        scramble: result.scramble,
      });
    }).catch(() => {
      if (!controller.signal.aborted
        && requestId === scrambleRequestRef.current
        && activeEventRef.current === event
        && scrambleSourceRef.current === expectedSource
        && scrambleIdentityFor(expectedSource, event) === requestedIdentity) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
          availability: 'error',
          failure: { kind: 'generation', code: 'generation-failed', retryable: true },
        });
      }
    }).finally(() => {
      randomScrambleGateRef.current.finish(controller);
    });
  }, [ordinaryRandom, replaceScrambleHistoryEntry, scrambleIdentityFor, applyStoreSnapshot, beginTimerContextMutation, endTimerContextMutation]);

  const fillScrambleHistoryEntry = useCallback((entry: MobileScrambleHistoryEntry) => {
    const liveEntry = scrambleHistoryRef.current.list.find((candidate) => (
      candidate.id === entry.id && candidate.sourceIdentity === entry.sourceIdentity
    ));
    if (!liveEntry || (entry.availability !== 'loading' && liveEntry.availability === 'loading')) return;
    const { event, source, sourceIdentity } = liveEntry;
    const retryingOptimal = liveEntry.failure?.kind === 'optimal';
    const retryingTrainer = liveEntry.failure?.kind === 'trainer';
    if (sourceIdentity !== scrambleIdentityFor(source, event)) return;
    randomScrambleGateRef.current.cancel();
    const requestId = ++scrambleRequestRef.current;
    replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
      availability: 'loading',
      failure: null,
    });

    if (source === 'manual') {
      const taken = takeManualScramble(
        parseManualScrambleQueue(manualScramblesRef.current),
        manualCursorRef.current,
      );
      manualCursorRef.current = taken.nextCursor;
      replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
        availability: 'ready',
        caseId: null,
        currentReal: null,
        failure: null,
        scramble: taken.scramble,
      });
      return;
    }
    if (storeRef.current?.settings.syncSeed && (source === 'random' || !timerSupportsRealWcaScrambles(event))) {
      generateRandomScramble(liveEntry, requestId);
      return;
    }
    if (source === 'random' && event === '333' && randomOptimalAuthPending) return;
    const optimalSource = source === 'random' && event === '333'
      ? randomOptimalSourceRef.current
      : null;
    if (optimalSource) {
      const target = drillTargetRef.current;
      const difficulty = randomDifficultySpecRef.current;
      if (retryingTrainer && difficulty) {
        retryMobileRandomDifficulty(difficulty);
        retryOptimal333(optimalSource);
      }
      if (retryingOptimal) retryOptimal333(optimalSource);
      void awaitOptimal333(optimalSource).then((status) => {
        if (requestId !== scrambleRequestRef.current
          || activeEventRef.current !== event
          || scrambleSourceRef.current !== source
          || scrambleIdentityFor(source, event) !== sourceIdentity) return;
        if (status === 'base-empty' || status === 'base-rare' || status === 'base-error') {
          const reason = status === 'base-empty'
            ? 'empty'
            : status === 'base-rare' ? 'rare' : 'error';
          replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
            availability: reason === 'error' ? 'error' : 'empty',
            failure: { kind: 'trainer', reason },
          });
          return;
        }
        if (status !== 'ready') {
          if (status === 'idle') return;
          replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
            availability: 'error',
            failure: { kind: 'optimal' },
          });
          return;
        }
        const optimal = peekOptimal333Result(optimalSource);
        if (!optimal) {
          replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
            availability: 'error',
            failure: { kind: 'optimal' },
          });
          return;
        }
        const trainerResult = optimal.context as TimerRandomDifficultyResult | undefined;
        replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
          availability: 'ready',
          caseId: target && event === target.type ? target.id : null,
          currentReal: null,
          failure: null,
          scramble: optimal.scramble,
          trainerMeta: trainerResult ? {
            spec: trainerResult.spec,
            depth: trainerResult.depth,
            state: trainerResult.state,
          } : null,
          sourceSnapshot: {
            kind: 'random',
            identity: target
              ? `random|333|optimal|drill:${target.type}:${target.id}`
              : trainerResult
                ? `random|333|optimal|difficulty:${trainerSig(
                    event,
                    randomDifficultySettingsRef.current,
                  )}`
                : 'random|333|optimal',
          },
        });
      });
      return;
    }
    const target = timerEventSupportsDrill(event) ? drillTargetRef.current : null;
    if (target) {
      const generated = generateTimerDrillScramble(target);
      replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, generated ? {
        availability: 'ready',
        caseId: event === target.type ? generated.targetCase : null,
        currentReal: null,
        failure: null,
        scramble: generated.scramble,
        sourceSnapshot: {
          kind: 'random',
          identity: `drill|${event}|${target.type}:${target.id}`,
        },
      } : {
        availability: 'error',
        failure: { kind: 'generation', code: 'generation-failed', retryable: false },
      });
      return;
    }
    if (source === 'random') {
      const difficulty = timerModeRef.current === 1
        ? trainerSpecOf(event, randomDifficultySettingsRef.current)
        : null;
      if (difficulty) {
        if (retryingTrainer) retryMobileRandomDifficulty(difficulty);
        prefetchMobileRandomDifficulty(difficulty);
        void awaitMobileRandomDifficulty(difficulty).then((status) => {
          if (requestId !== scrambleRequestRef.current
            || activeEventRef.current !== event
            || scrambleSourceRef.current !== source
            || scrambleIdentityFor(source, event) !== sourceIdentity) return;
          if (status !== 'ready') {
            if (status === 'idle' || status === 'working') return;
            replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
              availability: status === 'error' ? 'error' : 'empty',
              failure: {
                kind: 'trainer',
                reason: status === 'error' ? 'error' : status,
              },
            });
            return;
          }
          const generated = peekMobileRandomDifficulty(difficulty);
          if (!generated) return;
          replaceScrambleHistoryEntry(liveEntry.id, sourceIdentity, {
            availability: 'ready',
            caseId: null,
            currentReal: null,
            failure: null,
            scramble: generated.scramble,
            trainerMeta: {
              spec: generated.spec,
              depth: generated.depth,
              state: generated.state,
            },
            sourceSnapshot: {
              kind: 'random',
              identity: `random|${event}|difficulty:${trainerSig(
                event,
                randomDifficultySettingsRef.current,
              )}`,
            },
          });
        });
        return;
      }
      generateRandomScramble(liveEntry, requestId);
      return;
    }

    // Canonical Web behavior: projects without a WCA-pool mapping keep the
    // Real source selected but use that same project's local provider. This is
    // not a network-error fallback, and it must never turn into a 333 scramble.
    if (!timerSupportsRealWcaScrambles(event)) {
      generateRandomScramble(liveEntry, requestId);
      return;
    }

    const realSpec = normalizeRealScrambleSourceSpec(realSpecFor(event));
    const sourceKey = realScrambleSourceKey(realSpec);
    const requestedIdentity = sourceIdentity;
    const pool = realPoolFor(realSpec);
    const activate = (next: RealScramble) => {
      realCurrentBySourceRef.current.set(sourceKey, next);
      if (isAllTimeRealScrambleDateSource(realSpec)
        && realProgressTrackerRef.current.get(sourceKey)
        && realProgressTrackerRef.current.noteServed(sourceKey, next)) {
        refreshRealProgress((revision) => revision + 1);
      }
      replaceScrambleHistoryEntry(liveEntry.id, requestedIdentity, {
        availability: 'ready',
        caseId: null,
        currentReal: next,
        failure: null,
        scramble: next.scramble,
        sourceSnapshot: {
          kind: 'wca',
          identity: timerWcaCompetitionScrambleSlotIdentity(next),
        },
      });
      writeRealScrambleCache(realSpec, [next, ...realPoolFor(realSpec)]);
    };
    const next = pool.shift();
    if (next) {
      activate(next);
      if (pool.length <= 8) void refillRealPool(realSpec).catch(() => undefined);
      return;
    }

    void refillRealPool(realSpec).then((outcome) => {
      if (requestId !== scrambleRequestRef.current
        || activeEventRef.current !== event
        || scrambleSourceRef.current !== 'wca'
        || realScrambleSourceKey(realSpecFor(activeEventRef.current)) !== sourceKey) return;
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'confirmed-empty') {
        replaceScrambleHistoryEntry(liveEntry.id, requestedIdentity, {
          availability: 'empty',
          failure: { kind: 'real-empty' },
        });
        return;
      }
      if (outcome.kind === 'exhausted') {
        replaceScrambleHistoryEntry(liveEntry.id, requestedIdentity, {
          availability: 'error',
          failure: { kind: 'real-exhausted' },
        });
        return;
      }
      const loaded = realPoolFor(realSpec).shift();
      if (!loaded) {
        replaceScrambleHistoryEntry(liveEntry.id, requestedIdentity, {
          availability: 'error',
          failure: { kind: 'real-exhausted' },
        });
        return;
      }
      activate(loaded);
    }).catch(() => {
      if (requestId === scrambleRequestRef.current
        && activeEventRef.current === event
        && scrambleSourceRef.current === 'wca'
        && realScrambleSourceKey(realSpecFor(activeEventRef.current)) === sourceKey) {
        replaceScrambleHistoryEntry(liveEntry.id, requestedIdentity, {
          availability: 'error',
          failure: { kind: 'real-exhausted' },
        });
      }
    });
  }, [
    generateRandomScramble,
    realPoolFor,
    realSpecFor,
    refillRealPool,
    replaceScrambleHistoryEntry,
    randomOptimalAuthPending,
    scrambleIdentityFor,
  ]);

  const nextScramble = useCallback((
    source: ScrambleSource,
    event: EventId,
    historyMode: 'push' | 'reset' = 'push',
  ) => {
    const sourceIdentity = scrambleIdentityFor(source, event);
    const entry = createMobileScrambleHistoryEntry(event, source, sourceIdentity);
    applyScrambleHistory(historyMode === 'reset'
      ? { list: [entry], idx: 0 }
      : histPush(scrambleHistoryRef.current, entry));
    fillScrambleHistoryEntry(entry);
  }, [applyScrambleHistory, fillScrambleHistoryEntry, scrambleIdentityFor]);

  const activeScrambleIdentity = scrambleIdentityFor(scrambleSource, activeEvent);

  useEffect(() => {
    if (!storeLoaded) return;
    ordinaryRandom.reset();
    const activeRealSourceKey = realScrambleSourceKey(realSpecFor(activeEvent));
    for (const [sourceKey, request] of realRequestsRef.current) {
      if (scrambleSource === 'wca' && sourceKey === activeRealSourceKey) continue;
      request.cancel();
      realRequestsRef.current.delete(sourceKey);
    }
    if (scrambleSource === 'manual'
      && (previousScrambleSourceRef.current !== 'manual'
        || previousScrambleEventRef.current !== activeEvent
        || previousManualScramblesRef.current !== manualScrambles)) {
      manualCursorRef.current = 0;
    }
    previousScrambleSourceRef.current = scrambleSource;
    previousScrambleEventRef.current = activeEvent;
    previousManualScramblesRef.current = manualScrambles;
    nextScramble(scrambleSource, activeEvent, 'reset');
  }, [
    activeEvent,
    activeScrambleIdentity,
    ordinaryRandom,
    byStepsSourceSignature,
    manualScrambles,
    nextScramble,
    realSpecFor,
    scramble222Mode,
    scramble222Type,
    scrambleSource,
    storeLoaded,
    wcaSourceSignature,
  ]);

  useEffect(() => {
    const previousView = previousTimerWorkViewRef.current;
    previousTimerWorkViewRef.current = view;
    if (previousView === 'timer' || view !== 'timer') return;
    const entry = scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx];
    if (entry?.availability === 'loading') fillScrambleHistoryEntry(entry);
  }, [fillScrambleHistoryEntry, view]);

  useEffect(() => () => {
    randomScrambleGateRef.current.cancel();
    for (const request of realRequestsRef.current.values()) request.cancel();
    realRequestsRef.current.clear();
  }, []);

  const canSwitchScramble = useCallback(() => {
    return !timerContextMutationBusyRef.current
      && timerCanSwitchScramble(timerPhaseRef.current);
  }, []);

  const displayScrambleHistory = useCallback((
    next: ScrambleHistory<MobileScrambleHistoryEntry>,
  ) => {
    const plan = planMobileScrambleHistoryDisplay(next);
    applyScrambleHistory(plan.history);
    // Only the visible slot owns an async generator. Fast navigation cancels
    // the old request; revisiting its still-loading slot must therefore restart
    // that exact immutable entry instead of leaving it loading forever.
    if (plan.refillEntry) fillScrambleHistoryEntry(plan.refillEntry);
  }, [applyScrambleHistory, fillScrambleHistoryEntry]);

  const previousDisplayedScramble = useCallback(() => {
    if (!canSwitchScramble()) return;
    const previous = histBack(scrambleHistoryRef.current);
    if (previous) displayScrambleHistory(previous);
  }, [canSwitchScramble, displayScrambleHistory]);

  const advanceDisplayedScramble = useCallback(() => {
    const forward = histForward(scrambleHistoryRef.current);
    if (forward) {
      displayScrambleHistory(forward);
      return;
    }
    nextScramble(scrambleSourceRef.current, activeEventRef.current);
  }, [displayScrambleHistory, nextScramble]);

  const nextDisplayedScramble = useCallback(() => {
    if (canSwitchScramble()) advanceDisplayedScramble();
  }, [advanceDisplayedScramble, canSwitchScramble]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 3000);
  }, []);

  const recoverLatestStoreSnapshot = useCallback((revision: SnapshotRevision) => (
    storeSnapshotGateRef.current.reloadIfLatest(
      revision,
      () => repository.load(),
      applyStoreSnapshot,
    )
  ), [applyStoreSnapshot]);

  const commitSessionMutation = useCallback(async (
    operation: () => Promise<TimerStoreData>,
  ): Promise<void> => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    try {
      const data = await operation();
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    } catch (error) {
      await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      throw error;
    }
  }, [applyStoreSnapshot, recoverLatestStoreSnapshot]);

  const sessionHost = useMemo<TimerSessionSwitcherHost>(() => ({
    activate: (sessionId) => commitSessionMutation(() => repository.activateSession(sessionId)),
    create: (name, sessionEvent) => commitSessionMutation(
      () => repository.createSession(name, sessionEvent),
    ),
    rename: (sessionId, name) => commitSessionMutation(
      () => repository.renameSession(sessionId, name),
    ),
    clear: (sessionId) => commitSessionMutation(() => repository.clearSession(sessionId)),
    delete: (sessionId) => commitSessionMutation(() => repository.deleteSession(sessionId)),
  }), [commitSessionMutation]);

  const handleTimerOverlayOpenChange = useCallback((
    open: boolean,
    details: TimerOverlayOpenChangeDetails,
  ) => {
    setOpenOverlay((current) => {
      const next = open ? details.id : current === details.id ? null : current;
      openOverlayRef.current = next;
      return next;
    });
  }, []);

  const closeHistorySolveDetail = useCallback((expected?: typeof historyDetail) => {
    if (expected && historyDetailRef.current !== expected) return;
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement
      && active.dataset.historyActionId === 'solve.detail.comment') active.blur();
    historyDetailRef.current = null;
    setHistoryDetail(null);
    setOpenOverlay((current) => {
      const next = current === TIMER_OVERLAY_IDS.solveDetail ? null : current;
      openOverlayRef.current = next;
      return next;
    });
  }, []);

  const openHistorySolveDetail = useCallback((solve: Solve, autoFocusComment = false) => {
    const detail = { autoFocusComment, context: historyContext, solveId: solve.id };
    historyDetailRef.current = detail;
    setHistoryDetail(detail);
    openOverlayRef.current = TIMER_OVERLAY_IDS.solveDetail;
    setOpenOverlay(TIMER_OVERLAY_IDS.solveDetail);
  }, [historyContext]);

  useEffect(() => {
    const wcaMarksIdentityChanged = wcaMarksOverlayIdentityRef.current
      !== currentWcaMarkIdentity;
    wcaMarksOverlayIdentityRef.current = currentWcaMarkIdentity;
    if (openOverlay === null) return;
    const available = openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher
      || openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu
      || openOverlay === TIMER_OVERLAY_IDS.historyCompare
      || openOverlay === TIMER_OVERLAY_IDS.solveDetail
      ? view === 'history' && (
        (openOverlay !== TIMER_OVERLAY_IDS.solveDetail || historyDetailSolve !== null)
      )
      : timerVisible && (
        (openOverlay !== TIMER_OVERLAY_IDS.stageSolver || activeEvent === '333')
        && (openOverlay !== TIMER_OVERLAY_IDS.drillPicker
          || timerEventSupportsDrill(activeEvent))
        && (openOverlay !== TIMER_OVERLAY_IDS.wcaCompetition
          || (scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)))
        && (openOverlay !== TIMER_OVERLAY_IDS.wcaScrambleMarks || (
          currentWcaMarkIdentity !== null
          && (currentWcaMarks?.count ?? 0) > 0
          && !wcaMarksIdentityChanged
        ))
      );
    if (!available) {
      if (openOverlay === TIMER_OVERLAY_IDS.solveDetail) setHistoryDetail(null);
      openOverlayRef.current = null;
      setOpenOverlay(null);
    }
  }, [
    activeEvent,
    currentWcaMarkIdentity,
    currentWcaMarks?.count,
    historyDetailSolve,
    openOverlay,
    scrambleSource,
    timerVisible,
    view,
  ]);

  const clearWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    webHandshakeRetryRef.current[surface]?.();
    webHandshakeRetryRef.current[surface] = null;
  }, []);

  const beginWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    if (connection !== 'online') return;
    const postInit = () => webFrameRefs.current[surface]?.contentWindow?.postMessage(
      mobileEmbedInitMessage(surface, { authProviders: MOBILE_AUTH_PROVIDERS, accountManagement: true, appleMembership: Boolean(host.appleMembership), googleMembership: Boolean(host.googleMembership) }),
      SITE_ORIGIN,
    );
    webHandshakeRetryRef.current[surface] = startWebSurfaceHandshake(
      postInit,
      MOBILE_EMBED_INIT_RETRY_MS,
      MOBILE_EMBED_INIT_RETRIES,
    );
  }, [clearWebSurfaceHandshake, connection]);

  const markWebSurfaceLoaded = useCallback((surface: MobileEmbedSurface) => {
    webSurfaceLoadedRef.current[surface] = true;
    setWebSurfaceStatus((current) => (
      current[surface] === 'ready' ? current : { ...current, [surface]: 'ready' }
    ));
  }, []);

  const finishWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    webBridgeReadyRef.current[surface] = true;
    webSurfaceLoadedRef.current[surface] = true;
    setWebSurfaceStatus((current) => (
      current[surface] === 'ready' ? current : { ...current, [surface]: 'ready' }
    ));
  }, [clearWebSurfaceHandshake]);

  const clearAccountSyncTimeout = useCallback(() => {
    if (accountSyncTimeoutRef.current !== null) window.clearTimeout(accountSyncTimeoutRef.current);
    accountSyncTimeoutRef.current = null;
  }, []);

  const retryWebSurface = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    webBridgeReadyRef.current[surface] = false;
    webSurfaceLoadedRef.current[surface] = false;
    if (surface === 'account') {
      clearAccountSyncTimeout();
      accountSyncInFlightRef.current = null;
      accountSyncedTokenRef.current = null;
    }
    const fallbackUrl = surface === 'tools' ? toolsWebUrl : accountWebUrl;
    let nextUrl = webLastHrefRef.current[surface] || fallbackUrl;
    try {
      if (new URL(nextUrl).origin !== SITE_ORIGIN) nextUrl = fallbackUrl;
    } catch {
      nextUrl = fallbackUrl;
    }
    setWebSurfaceStatus((current) => ({ ...current, [surface]: 'loading' }));
    setWebSurfaceReloadUrl((current) => ({ ...current, [surface]: nextUrl }));
    setWebSurfaceRevision((current) => ({ ...current, [surface]: current[surface] + 1 }));
  }, [accountWebUrl, clearAccountSyncTimeout, clearWebSurfaceHandshake, toolsWebUrl]);

  useEffect(() => {
    for (const surface of MOBILE_EMBED_SURFACES) {
      if (connection === 'online'
        && openedWebViews[surface]
        && webSurfaceStatus[surface] === 'loading'
        && webFrameRefs.current[surface]) {
        beginWebSurfaceHandshake(surface);
      } else if (connection !== 'online') {
        clearWebSurfaceHandshake(surface);
        webBridgeReadyRef.current[surface] = false;
        if (surface === 'account') {
          clearAccountSyncTimeout();
          accountSyncInFlightRef.current = null;
        }
        if (openedWebViews[surface]) {
          setWebSurfaceStatus((current) => current[surface] === 'loading'
            ? current
            : { ...current, [surface]: 'loading' });
        }
      }
    }
  }, [
    beginWebSurfaceHandshake,
    clearAccountSyncTimeout,
    clearWebSurfaceHandshake,
    connection,
    openedWebViews.account,
    openedWebViews.tools,
    webSurfaceRevision.account,
    webSurfaceRevision.tools,
    webSurfaceStatus.account,
    webSurfaceStatus.tools,
  ]);

  useEffect(() => {
    const previous = previousConnectionRef.current;
    previousConnectionRef.current = connection;
    if (previous === 'online' || connection !== 'online') return;
    for (const surface of MOBILE_EMBED_SURFACES) {
      if (!openedWebViews[surface]) continue;
      if (webSurfaceLoadedRef.current[surface]) {
        setWebSurfaceStatus((current) => current[surface] === 'ready'
          ? current
          : { ...current, [surface]: 'ready' });
        beginWebSurfaceHandshake(surface);
        continue;
      }
      setWebSurfaceStatus((current) => ({ ...current, [surface]: 'loading' }));
      setWebSurfaceRevision((current) => ({ ...current, [surface]: current[surface] + 1 }));
    }
  }, [
    beginWebSurfaceHandshake,
    connection,
    openedWebViews.account,
    openedWebViews.tools,
  ]);

  useEffect(() => () => {
    for (const surface of MOBILE_EMBED_SURFACES) clearWebSurfaceHandshake(surface);
    clearAccountSyncTimeout();
  }, [clearAccountSyncTimeout, clearWebSurfaceHandshake]);

  useEffect(() => {
    webLastHrefRef.current.tools = toolsWebUrl;
    webBridgeReadyRef.current.tools = false;
    webSurfaceLoadedRef.current.tools = false;
    setWebSurfaceStatus((current) => current.tools === 'loading'
      ? current
      : { ...current, tools: 'loading' });
    setWebSurfaceReloadUrl((current) => current.tools === null
      ? current
      : { ...current, tools: null });
  }, [toolsWebUrl]);

  useEffect(() => {
    clearAccountSyncTimeout();
    webBridgeReadyRef.current.account = false;
    accountSyncInFlightRef.current = null;
    webLastHrefRef.current.account = accountWebUrl;
    webSurfaceLoadedRef.current.account = false;
    setWebSurfaceStatus((current) => current.account === 'loading'
      ? current
      : { ...current, account: 'loading' });
    setWebSurfaceReloadUrl((current) => current.account === null
      ? current
      : { ...current, account: null });
  }, [accountWebUrl, clearAccountSyncTimeout]);

  const syncAccountWebSession = useCallback(async () => {
    const token = auth.session?.token;
    const frame = webFrameRefs.current.account;
    if (!token || !frame?.contentWindow || !webBridgeReadyRef.current.account) return;
    if (accountSyncedTokenRef.current === token
      || accountSyncInFlightRef.current?.token === token) return;
    clearAccountSyncTimeout();
    const requestId = crypto.randomUUID();
    accountSyncInFlightRef.current = { requestId, token };
    accountSyncTimeoutRef.current = window.setTimeout(() => {
      if (accountSyncInFlightRef.current?.requestId !== requestId) return;
      accountSyncInFlightRef.current = null;
      accountSyncTimeoutRef.current = null;
      setWebSurfaceStatus((current) => ({ ...current, account: 'error' }));
      announce(copy.authError);
    }, MOBILE_EMBED_AUTH_TIMEOUT_MS);
    try {
      const envelope = await auth.issueWebSessionTicket();
      if (accountSyncInFlightRef.current?.requestId !== requestId
        || webFrameRefs.current.account !== frame
        || !webBridgeReadyRef.current.account) return;
      frame.contentWindow.postMessage(
        mobileEmbedWebSessionMessage(envelope.ticket, requestId),
        SITE_ORIGIN,
      );
    } catch {
      if (accountSyncInFlightRef.current?.requestId !== requestId) return;
      clearAccountSyncTimeout();
      accountSyncInFlightRef.current = null;
      setWebSurfaceStatus((current) => ({ ...current, account: 'error' }));
      announce(copy.authError);
    }
  }, [announce, auth.issueWebSessionTicket, auth.session?.token, clearAccountSyncTimeout, copy.authError]);

  const logoutEverywhere = useCallback(async () => {
    clearAccountSyncTimeout();
    accountSyncInFlightRef.current = null;
    accountSyncedTokenRef.current = null;
    // Cancel any durable-save completion immediately; the auth hook clears its
    // rendered session only after the native logout request finishes.
    authSessionRef.current = null;
    webFrameRefs.current.account?.contentWindow?.postMessage(
      mobileEmbedAuthClearMessage(),
      SITE_ORIGIN,
    );
    await auth.logout();
  }, [auth.logout, clearAccountSyncTimeout]);
  logoutEverywhereRef.current = logoutEverywhere;

  const selectPrimaryView = useCallback((next: PrimaryView) => {
    if (timingRunningRef.current
      || battleModeActiveRef.current
      || timerContextMutationBusyRef.current) {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (next === 'tools' || next === 'account') {
      setOpenedWebViews((current) => {
        if (current[next]) return current;
        webDepthRef.current[next] = 0;
        return { ...current, [next]: true };
      });
    }
    setView(next);
  }, [announce, copy.finishAttemptFirst]);

  const openToolsRoute = useCallback((route: string) => {
    setToolsEntryRoute(route);
    selectPrimaryView('tools');
  }, [selectPrimaryView]);

  const markSavedWcaSolve = useCallback((
    solve: Omit<Solve, 'id' | 'ts'>,
    ownerAtSaveStart: string,
  ) => {
    const enabled = storeRef.current?.settings.autoMarkWcaScramble ?? true;
    void autoMarkSavedWcaSolve(solve, ownerAtSaveStart, authSessionRef.current, enabled, {
      loadMarks: loadWcaMarks,
      postMark: (key, mark, token) => postTimerWcaScrambleMark(key, mark, {
        apiBase: mobileApiUrl(''),
        fetcher: (input, init) => fetch(input, init),
        token,
      }),
      updateMark: (key, mark, token) => updateTimerWcaScrambleMarkIfExists(key, mark, {
        apiBase: mobileApiUrl(''),
        fetcher: (input, init) => fetch(input, init),
        token,
      }),
    }).catch(() => undefined);
  }, [loadWcaMarks]);

  useEffect(() => {
    return observeVisibleViewportHeight(setViewportHeight);
  }, []);

  useLayoutEffect(() => {
    const height = primaryNavRef.current?.getBoundingClientRect().height ?? 0;
    setPrimaryNavBottomInset(wideLayout ? 0 : height);
  }, [fullscreen, storeLoaded, viewportHeight, wideLayout]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN) return;
      const accountFrame = webFrameRefs.current.account;
      const accountSource = Boolean(accountFrame && event.source === accountFrame.contentWindow);

      const purchase = decodeAppleMembershipRequest(event.data) ?? decodeGoogleMembershipRequest(event.data);
      if (purchase) {
        const frame = webFrameRefs.current[purchase.surface];
        if (!frame || event.source !== frame.contentWindow) return;
        const session = authSessionRef.current;
        const reply = (result: object) => frame.contentWindow?.postMessage({ ...result,
          type: `${purchase.type}-result`, requestId: purchase.requestId }, SITE_ORIGIN);
        if (!session || session.user.uid !== purchase.expectedUid) {
          reply({ status: 'error' }); return;
        }
        const operation = purchase.type === 'cuberoot:mobile:apple-membership'
          ? host.appleMembership?.(purchase, session) : host.googleMembership?.(purchase, session);
        if (!operation) { reply({ status: 'error' }); return; }
        void operation.then(reply).catch(() => reply({ status: 'error' }));
        return;
      }
      const management = decodeMobileEmbedAccountManage(event.data);
      if (accountSource && management) {
        const reply = (ok: boolean) => accountFrame?.contentWindow?.postMessage(
          mobileEmbedAccountManageResultMessage(ok, management.requestId), SITE_ORIGIN,
        );
        if (accountManagementRequestRef.current) { reply(false); return; }
        accountManagementRequestRef.current = management.requestId;
        void openInstalledAccountManagement(management, accountWebUrl, {
          currentSession: () => authSessionRef.current,
          openExternal: (href) => host.openExternal(href),
        }).then(() => reply(true)).catch(() => reply(false)).finally(() => {
          accountManagementRequestRef.current = null;
        });
        return;
      }

      const authRequest = decodeMobileEmbedAuthRequest(event.data);
      if (accountSource && authRequest) {
        void auth.login(authRequest.provider);
        return;
      }

      const authClear = decodeMobileEmbedAuthClear(event.data);
      if (accountSource && authClear) {
        clearAccountSyncTimeout();
        accountSyncInFlightRef.current = null;
        accountSyncedTokenRef.current = null;
        void auth.logout();
        return;
      }

      const webSessionResult = decodeMobileEmbedWebSessionResult(event.data);
      if (accountSource && webSessionResult) {
        const pending = accountSyncInFlightRef.current;
        if (!pending || pending.requestId !== webSessionResult.requestId) return;
        clearAccountSyncTimeout();
        accountSyncInFlightRef.current = null;
        if (webSessionResult.ok) accountSyncedTokenRef.current = pending.token;
        else {
          setWebSurfaceStatus((current) => ({ ...current, account: 'error' }));
          announce(copy.authError);
        }
        return;
      }

      const external = decodeMobileEmbedExternal(event.data);
      if (external) {
        const frame = webFrameRefs.current[external.surface];
        if (!frame || event.source !== frame.contentWindow) return;
        if (installedContentUnavailable(external.href)) { announce(copy.actionFailed); return; }
        void host.openExternal(external.href).catch(() => announce(copy.actionFailed));
        return;
      }

      const navigation = decodeMobileEmbedNavigation(event.data);
      if (!navigation) return;
      const frame = webFrameRefs.current[navigation.surface];
      if (!frame || event.source !== frame.contentWindow) return;
      try {
        if (new URL(navigation.href).origin !== SITE_ORIGIN) return;
      } catch {
        return;
      }
      webLastHrefRef.current[navigation.surface] = navigation.href;
      webDepthRef.current[navigation.surface] = navigation.depth;
      finishWebSurfaceHandshake(navigation.surface);
      if (navigation.surface === 'account') {
        void syncAccountWebSession();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    announce,
    accountWebUrl,
    auth.login,
    auth.logout,
    clearAccountSyncTimeout,
    copy.actionFailed,
    copy.authError,
    finishWebSurfaceHandshake,
    host,
    syncAccountWebSession,
  ]);

  useEffect(() => {
    // Browser.open resolves before the login callback. Report later callback failures too.
    if (auth.busy) return;
    if (auth.error) {
      setWebSurfaceStatus((current) => ({ ...current, account: 'error' }));
      announce(copy.authError);
    }
  }, [announce, auth.busy, auth.error, copy.authError]);

  useEffect(() => {
    if (!auth.session) {
      clearAccountSyncTimeout();
      accountSyncInFlightRef.current = null;
      accountSyncedTokenRef.current = null;
      return;
    }
    void syncAccountWebSession();
  }, [auth.session?.token, clearAccountSyncTimeout, syncAccountWebSession]);

  useEffect(() => {
    if (!host.isInstalled() || !host.addBackButtonListener) return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void host.addBackButtonListener(() => {
      const current = viewRef.current;
      if (trainerSubsetOpenRef.current) { trainerSubsetOpenRef.current = null; setTrainerSubsetOpen(null); return; }
      if (replayBlockingRef.current) { setReplayImportOpen(false); setReplaySolve(null); return; }
      if (statsOpenRef.current) { setStatsOpen(false); return; }
      if (current === 'history' && openOverlayRef.current === null && historyWorkspaceRef.current?.dismiss()) return;
      if (current === 'timer' && timerModeRef.current !== 1 && openOverlayRef.current === null) {
        if (battleOverlayCloseRef.current) {
          battleOverlayCloseRef.current();
          return;
        }
        if (battleModeActiveRef.current) {
          announce(copy.finishAttemptFirst);
          return;
        }
        timerModeRef.current = 1;
        setTimerMode(1);
        return;
      }
      const action = mobileBackAction({
        fullscreen: fullscreenRef.current,
        historyCompareMode: false,
        manualEntryOpen: manualEntryOpenRef.current,
        moreOpen: moreOpenRef.current,
        mutationBusy: timerContextMutationBusyRef.current,
        overlayOpen: openOverlayRef.current !== null,
        phase: timerPhaseRef.current,
        view: current,
        webDepth: current === 'tools' || current === 'account'
          ? (webBridgeReadyRef.current[current] ? webDepthRef.current[current] : 0)
          : 0,
      });
      if (action === 'close-overlay') {
        if (openOverlayRef.current === TIMER_OVERLAY_IDS.stageSolver && solverDismissRef.current?.()) return;
        if (openOverlayRef.current === TIMER_OVERLAY_IDS.smartCubeDevice
          || openOverlayRef.current === TIMER_OVERLAY_IDS.smartTimerDevice
          || openOverlayRef.current === TIMER_OVERLAY_IDS.stackmatDevice) closeDeviceOverlayRef.current();
        if (openOverlayRef.current === TIMER_OVERLAY_IDS.solveDetail) {
          closeHistorySolveDetail();
          return;
        }
        openOverlayRef.current = null;
        setOpenOverlay(null);
        return;
      }
      if (action === 'close-history-compare') {
        historyWorkspaceRef.current?.dismiss();
        return;
      }
      if (action === 'close-more') {
        setMoreOpen(false);
        return;
      }
      if (action === 'close-manual-entry') {
        setManualEntryOpen(false);
        return;
      }
      if (action === 'exit-fullscreen') {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        setFullscreen(false);
        return;
      }
      if (action === 'cancel-arm') {
        cancelTimerArmRef.current();
        return;
      }
      if (action === 'block-busy') {
        announce(copy.finishAttemptFirst);
        return;
      }
      if (action === 'close-subview') {
        setView('timer');
        return;
      }
      if (action === 'embedded-back' && (current === 'tools' || current === 'account')) {
        webFrameRefs.current[current]?.contentWindow?.postMessage(
          mobileEmbedBackMessage(current),
          SITE_ORIGIN,
        );
        return;
      }
      void host.exitApp?.();
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = handle.remove;
    }).catch(() => undefined);
    return () => {
      active = false;
      void removeListener?.();
    };
  }, [announce, closeHistorySolveDetail, copy.finishAttemptFirst, host]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    onFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    let active = true;
    void repository.load().then((data) => {
      if (!active) return;
      applyStoreSnapshot(data);
      void repository.hasImportRecovery().then((available) => {
        if (active) setCanUndoImport(available);
      });
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error : new Error('load failed'));
    });
    return () => { active = false; };
  }, [applyStoreSnapshot]);

  useEffect(() => {
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void host.getNetworkStatus().then((connected) => {
      if (active) setConnection(connected ? 'online' : 'offline');
    }).catch(() => {
      if (active) setConnection(navigator.onLine ? 'online' : 'offline');
    });
    void host.addNetworkListener((connected) => {
      if (active) setConnection(connected ? 'online' : 'offline');
    }).then((handle) => {
      if (active) removeListener = handle.remove;
      else void handle.remove();
    });
    return () => {
      active = false;
      void removeListener?.();
    };
  }, [host]);

  const slotMatchesActiveSource = currentScrambleEntry !== null
    && currentScrambleEntry.event === activeEvent
    && currentScrambleEntry.source === scrambleSource
    && currentScrambleEntry.sourceIdentity === activeScrambleIdentity;
  const emptyScrambleAllowed = timerScrambleAllowsEmptySlot(
    activeEvent,
    scrambleSource,
  );
  const attemptCanStart = timerCanStartAttempt({
    availability: scrambleAvailability === 'ready'
      ? 'ready'
      : scrambleAvailability === 'loading' ? 'loading' : 'unavailable',
    emptyScrambleAllowed,
    scramble,
    sourceMatches: slotMatchesActiveSource,
  });
  const attemptCanStartRef = useRef(attemptCanStart);
  attemptCanStartRef.current = attemptCanStart;
  const attemptRef = useRef<MobileScrambleAttemptSnapshot | null>(null);
  const smartCubeAttemptProducerRef = useRef(new SmartCubeAttemptProducer());
  const smartCubeMoveSubscribersRef = useRef(new Set<(move: string, timestamp: number) => void>());
  const smartCubeQuatRef = useRef<Quat | null>(null);
  const [smartCubeCalibration, setSmartCubeCalibration] = useState(0);
  const [smartCubeRenderedView, setSmartCubeRenderedView] = useState('net');
  const connectedSmartCubeRef = useRef<Solve['device']>(undefined);
  const [attemptSplitState, setAttemptSplitState] = useState<TimerAttemptSplitState>({ stages: {} });
  const [attemptSplitRecorder] = useState(() => new TimerAttemptSplitRecorder(setAttemptSplitState));
  const attemptStartedAtRef = useRef(0);
  const timerDisplayMsRef = useRef(0);
  const externalAttemptRef = useRef<{kind: 'smart-timer' | 'stackmat'; sessionId: string; snapshot: MobileScrambleAttemptSnapshot; running: boolean} | null>(null);
  const externalActiveRef = useRef(false);
  const externalOperationRef = useRef(0);
  const [externalConnectAttempt, setExternalConnectAttempt] = useState<{kind: 'smart-timer' | 'stackmat'; promise: Promise<void>} | null>(null);
  const completeSolve = useCallback((result: SolveResult) => {
    setLastResult(result);
    setLastPenalty(result.autoPenalty);
    const splitResult = attemptSplitRecorder.finish(result.timeMs);
    const displayedEntry = currentScrambleEntry;
    const attempt = attemptRef.current
      ?? (displayedEntry ? mobileScrambleAttemptSnapshot(displayedEntry) : null);
    attemptRef.current = null;
    const sessionId = externalAttemptRef.current?.sessionId ?? storeRef.current?.database.activeSessionId;
    if (!attempt || !sessionId) {
      smartCubeAttemptProducerRef.current.reset();
      announce(copy.actionFailed);
      return;
    }
    const { bld, stages } = splitResult;
    advanceDisplayedScramble();
    const revision = storeSnapshotGateRef.current.beginMutation();
    const solve: Omit<Solve, 'id' | 'ts'> = {
      ...(attempt.caseId ? { caseId: attempt.caseId } : {}),
      event: attempt.event,
      inspectionMs: result.inspectionMs || undefined,
      ...(bld ? { bld } : {}),
      ...(stages ? { stages } : {}),
      penalty: result.autoPenalty,
      scramble: attempt.scramble,
      scrambleSource: attempt.scrambleSource,
      timeMs: result.timeMs,
    };
    Object.assign(solve, smartCubeAttemptProducerRef.current.finishSolveFields(solve));
    const ownerAtSaveStart = wcaAutoMarkOwnerKey(authSessionRef.current);
    const recapRevision = recapAttemptRevisionRef.current;
    const priorSolveIds = new Set((storeRef.current?.database.dataBySession[sessionId]?.[solve.event] ?? []).map((item) => item.id));
    void repository.addSolve(solve, sessionId).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      markSavedWcaSolve(solve, ownerAtSaveStart);
      if (recapRevision === recapAttemptRevisionRef.current
        && storeRef.current?.database.activeSessionId === sessionId
        && shouldAutoRecap(solve, storeRef.current?.settings ?? {})) {
        const saved = [...(data.database.dataBySession[sessionId]?.[solve.event] ?? [])].reverse().find((item) => !priorSolveIds.has(item.id)
          && item.timeMs === solve.timeMs && item.scramble === solve.scramble);
        if (saved) setRecapSolveId(saved.id);
      }
    }).catch(() => {
      setPendingSolves((current) => current.some((pending) => pending.solve === solve)
        ? current
        : [...current, { ownerAtSaveStart, sessionId, solve }]);
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
    });
  }, [
    advanceDisplayedScramble,
    announce,
    applyStoreSnapshot,
    attemptSplitRecorder,
    currentScrambleEntry,
    markSavedWcaSolve,
    recoverLatestStoreSnapshot,
  ]);

  const retryPendingSolve = useCallback(() => {
    const pending = pendingSolves[0];
    if (!pending || retryingPendingSolveRef.current) return;
    retryingPendingSolveRef.current = true;
    setRetryingPendingSolve(true);
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.addSolve(pending.solve, pending.sessionId).then((data) => {
      setPendingSolves((current) => current.filter((candidate) => candidate !== pending));
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      markSavedWcaSolve(pending.solve, pending.ownerAtSaveStart);
    }).catch((error: unknown) => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(error instanceof TimerSessionRepositoryError && error.failure === 'unknown-session'
        ? copy.saveSessionMissing
        : copy.saveRetryFailed);
    }).finally(() => {
      retryingPendingSolveRef.current = false;
      setRetryingPendingSolve(false);
    });
  }, [announce, applyStoreSnapshot, copy.saveRetryFailed, copy.saveSessionMissing, markSavedWcaSolve, pendingSolves, recoverLatestStoreSnapshot]);

  const timer = useTimerController({
    inputBlocked: () => externalActiveRef.current,
    onTransition: onTimerSoundTransition,
    canStart: attemptCanStart,
    enabled: view !== 'settings' && timerVisible
      && timerMode === 1
      && timingEnabled
      && !moreOpen
      && !manualEntryOpen
      && !timerOverlayBlocking
      && !timerContextMutationBusy,
    holdMs: store?.settings.holdMs ?? 550,
    inspectionSec: store?.settings.inspectionSec ?? 0,
    onComplete: completeSolve,
    onStart: (startedAtMs) => {
      recapAttemptRevisionRef.current++;
      setRecapSolveId(null);
      const entry = scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx];
      if (!entry
        || entry.availability !== 'ready'
        || entry.event !== activeEventRef.current
        || entry.source !== scrambleSourceRef.current
        || entry.sourceIdentity !== scrambleIdentityFor(entry.source, entry.event)) return;
      attemptRef.current = mobileScrambleAttemptSnapshot(entry);
      if (connectedSmartCubeRef.current) {
        attemptRef.current = {
          ...attemptRef.current,
          scramble: timerSmartCubeAttemptScramble(entry.event, entry.scramble, storeRef.current?.settings.preScrT),
        };
      }
      attemptStartedAtRef.current = startedAtMs;
      attemptSplitRecorder.begin({
        bldMemo: (storeRef.current?.settings.bldMemo ?? true) && isBldEvent(entry.event),
        multiStage: (storeRef.current?.settings.multiStage ?? false)
          && timerSupportsStageSplits(entry.event),
      });
      smartCubeAttemptProducerRef.current.begin(startedAtMs, connectedSmartCubeRef.current);
      if (storeRef.current?.settings.recordGyro && smartCubeQuatRef.current) {
        smartCubeAttemptProducerRef.current.recordGyro(smartCubeQuatRef.current, 0);
      }
      timerPhaseRef.current = 'running';
    },
  });
  timingRunningRef.current = timer.machine.phase === 'running';
  timerPhaseRef.current = timer.machine.phase;
  cancelTimerArmRef.current = timer.cancelArm;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const external = useExternalDevices(host, language, (kind, event) => {
    if (event.state === 'DISCONNECT' || event.state === 'IDLE' || event.state === 'GAN_RESET') {
      if (externalAttemptRef.current?.kind === kind) {
        externalAttemptRef.current = null;
        attemptRef.current = null;
        timer.reset();
      }
      return;
    }
    const canReceiveStart = timerMode === 1 && timerVisible && view !== 'settings'
      && !timerContextMutationBusy && !statsOpen && !historyModalOpen && !replayBlocking && attemptCanStartRef.current;
    if (canReceiveStart && !externalAttemptRef.current
      && (event.state === 'HANDS_ON' || event.state === 'GET_SET' || event.state === 'INSPECTION' || event.state === 'RUNNING')) {
      const sessionId = storeRef.current?.database.activeSessionId;
      const entry = scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx];
      if (sessionId && entry) externalAttemptRef.current = {
        kind, sessionId, snapshot: mobileScrambleAttemptSnapshot(entry), running: false,
      };
    }
    const attempt = externalAttemptRef.current;
    if (event.state === 'RUNNING' && canReceiveStart && attempt?.kind === kind
      && !attempt.running && timerPhaseRef.current !== 'running') {
      if (timer.startExternal(event.solveTime ?? 0)) {
        attempt.running = true;
        attemptRef.current = attempt.snapshot;
      } else externalAttemptRef.current = null;
    }
    if (event.state === 'STOPPED' && attempt?.kind === kind && attempt.running
      && typeof event.solveTime === 'number' && Number.isFinite(event.solveTime) && event.solveTime >= 0) {
      timer.stopExternal(event.solveTime, event.inspectTime);
      externalAttemptRef.current = null;
    }
  });
  externalActiveRef.current = external.timer.status.connected || external.stackmat.status.listening;
  const externalModalOpen = openOverlay === TIMER_OVERLAY_IDS.smartTimerDevice || openOverlay === TIMER_OVERLAY_IDS.stackmatDevice;
  const previousExternalModalRef = useRef(false);
  useEffect(() => {
    if (previousExternalModalRef.current && !externalModalOpen) {
      externalOperationRef.current++;
      external.resolveMac(null);
      if (!external.timer.status.connected) external.timer.disconnect();
      if (!external.stackmat.status.listening) external.stackmat.stop();
    }
    previousExternalModalRef.current = externalModalOpen;
  }, [externalModalOpen, external]);
  host.useTimerEffects(timerMode === 1
    ? timer.machine.phase
    : battleModeActive ? 'running' : 'idle');

  useEffect(() => {
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (shouldIgnoreTimerTarget(event.target)) return;
      const target = event.target as Node | null;
      const insideTimingSurface = Boolean(
        surfaceRef.current && target && surfaceRef.current.contains(target),
      );
      if (timerShouldStopFromExternalPointer(
        timerPhaseRef.current,
        insideTimingSurface,
      )) timer.pressDown();
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [timer.pressDown]);

  const trainingOrientation = timerSmartCubeTrainingOrientation(activeEvent, store?.settings.preScrT);
  const previousTrainingOrientationRef = useRef(trainingOrientation);
  useLayoutEffect(() => {
    if (previousTrainingOrientationRef.current !== trainingOrientation) {
      previousTrainingOrientationRef.current = trainingOrientation;
      timer.cancelArm();
    }
  }, [trainingOrientation, timer.cancelArm]);
  const smartCubeTarget = useMemo(() => (
    timerSupportsSmartCubeAutoTiming(activeEvent) && scramble.length > 0
      ? smartCubeTargetFacelets(scramble, trainingOrientation)
      : null
  ), [activeEvent, scramble, trainingOrientation]);
  const [smartCubeAnchor, setSmartCubeAnchor] = useState<LiveSmartCubeAnchorSnapshot>({ moves: [], algAnchored: false });
  const [smartCubeAnchorController] = useState(() => new LiveSmartCubeAnchor({
    solve: solveMobileSmartCubeAnchor,
    onChange: setSmartCubeAnchor,
  }));
  const smartCubeSoloController = useMemo(() => new SmartCubeSoloTimerController({
    armFromCube: () => {
      const armed = timerRef.current.armFromCube();
      if (armed) timerPhaseRef.current = (storeRef.current?.settings.inspectionSec ?? 0) > 0
        ? 'inspecting'
        : 'ready';
      return armed;
    },
    autoReadyOnScramble: () => storeRef.current?.settings.bluetoothAutoReady === 'scrambled',
    canStartAttempt: () => attemptCanStartRef.current,
    getPhase: () => timerPhaseRef.current,
    isTimingEnabled: () => timingEnabledRef.current,
    onGuidanceChange: setSmartCubeGuidance,
    onMove: ({ move, timestamp }) => {
      for (const subscriber of smartCubeMoveSubscribersRef.current) subscriber(move, timestamp);
    },
    recordMove: ({ move, timestamp }) => {
      if (!smartCubeAttemptProducerRef.current.recordMove(move, timestamp)) return;
      const attempt = attemptRef.current;
      if (!attempt) return;
      attemptSplitRecorder.observeMoves({
        event: attempt.event,
        moves: smartCubeAttemptProducerRef.current.snapshotMoves(),
        scramble: attempt.scramble,
        timeMs: Math.max(0, timestamp - attemptStartedAtRef.current),
      });
    },
    solve: solveMobileSmartCubeFixup,
    startFromCube: (timestamp) => timerRef.current.startFromCube(timestamp),
    stopFromCube: (timestamp) => {
      const stopped = timerRef.current.stopFromCube(timestamp);
      if (stopped) timerPhaseRef.current = 'stopped';
      return stopped;
    },
  }), [attemptSplitRecorder]);
  const smartCube = host.useSmartCube({
    language,
    onConnectionEvent: (event) => {
      if (event.kind === 'disconnected') announce(copy.smartCubeDisconnected);
      else if (event.kind === 'error') announce(copy.smartCubeError);
    },
    onGyro: (quaternion, timestamp) => {
      smartCubeQuatRef.current = quaternion;
      if (timerModeRef.current !== 1) battleSmartCubeHandlersRef.current?.onGyro?.(quaternion, timestamp);
      if (timerModeRef.current === 1 && timerPhaseRef.current === 'running'
        && storeRef.current?.settings.recordGyro) {
        smartCubeAttemptProducerRef.current.recordGyro(quaternion, timestamp - attemptStartedAtRef.current);
      }
    },
    onMove: (move, timestamp, facelets, metadata) => {
      const futureHistory = metadata?.futureHistory === true;
      smartCubeAnchorController.move(move);
      if (timerModeRef.current !== 1) {
        if (!futureHistory) battleSmartCubeHandlersRef.current?.onMove(move, timestamp, facelets);
        return;
      }
      smartCubeSoloController.move({ facelets, metadata, move, timestamp });
    },
    onSolved: (timestamp) => {
      if (timerModeRef.current !== 1) {
        battleSmartCubeHandlersRef.current?.onSolved(timestamp);
        return;
      }
      smartCubeSoloController.solved(timestamp);
    },
  });
  connectedSmartCubeRef.current = smartCube.phase === 'connected' && smartCube.deviceName
    ? { model: smartCube.model ?? 'gan-v4', name: smartCube.deviceName }
    : undefined;
  useAutoReady({
    enabled: view !== 'settings' && timerVisible && timerMode === 1 && smartCube.phase === 'connected' && timingEnabled
      && attemptCanStart
      && !moreOpen && !manualEntryOpen && !timerOverlayBlocking
      && (timer.machine.phase === 'idle' || timer.machine.phase === 'inspecting' || timer.machine.phase === 'stopped')
      && !timerContextMutationBusy
      && (store?.settings.bluetoothAutoReady === 'still' || store?.settings.bluetoothAutoReady === 'double-flick'),
    mode: store?.settings.bluetoothAutoReady === 'double-flick' ? 'double-flick' : 'still',
    onReady: () => { timer.armFromCube(); },
    onMoveSubscriber: (callback) => {
      smartCubeMoveSubscribersRef.current.add(callback);
      return () => { smartCubeMoveSubscribersRef.current.delete(callback); };
    },
  });
  useLayoutEffect(() => {
    smartCubeAnchorController.setConnection(smartCube.phase === 'connected' ? smartCube.deviceName : null);
    smartCubeAnchorController.observeFacelets(smartCube.facelets);
  }, [smartCube.phase, smartCube.deviceName, smartCube.facelets, smartCubeAnchorController]);
  useEffect(() => () => smartCubeAnchorController.setConnection(null), [smartCubeAnchorController]);
  const smartCubeScrambleMatch = timerMode === 1
    && timer.machine.phase !== 'running'
    && smartCube.phase === 'connected'
    && smartCubeTarget
    ? smartCubeGuidance.match
    : null;

  useLayoutEffect(() => {
    smartCubeSoloController.setContext(timerMode === 1 && currentScrambleEntry
      ? {
          event: currentScrambleEntry.event,
          id: currentScrambleEntry.id,
          scramble,
          targetFacelets: smartCubeTarget,
          orientation: trainingOrientation,
        }
      : null);
  }, [currentScrambleEntry, scramble, smartCubeSoloController, smartCubeTarget, timerMode, trainingOrientation]);

  useLayoutEffect(() => {
    const connected = smartCube.phase === 'connected';
    smartCubeSoloController.setConnected(connected);
    if (!connected) {
      timer.cancelArm();
      smartCubeQuatRef.current = null;
    }
    return () => smartCubeSoloController.setConnected(false);
  }, [smartCube.phase, smartCubeSoloController, timer.cancelArm]);

  useLayoutEffect(() => {
    smartCubeSoloController.setRunning(timer.machine.phase === 'running');
  }, [smartCubeSoloController, timer.machine.phase]);

  useLayoutEffect(() => {
    if (smartCube.facelets) smartCubeSoloController.syncFacelets(smartCube.facelets);
  }, [
    currentScrambleEntry?.id,
    scramble,
    smartCube.facelets,
    smartCube.phase,
    smartCubeSoloController,
    smartCubeTarget,
    timer.machine.phase,
    timerMode,
  ]);

  const closeSmartCubeDevice = useCallback(() => {
    externalOperationRef.current++;
    if (smartCube.phase === 'requesting' || smartCube.phase === 'connecting') void smartCube.disconnect();
    void smartCube.stopScan?.();
    setOpenOverlay((current) => {
      const next = current === TIMER_OVERLAY_IDS.smartCubeDevice ? null : current;
      openOverlayRef.current = next;
      return next;
    });
  }, [smartCube]);

  const connectSmartCube = useCallback(async (deviceId?: string) => {
    const token = ++externalOperationRef.current;
    try {
      await external.timer.disconnect();
      if (token !== externalOperationRef.current) return;
      external.stackmat.stop();
      const name = await smartCube.connect(deviceId);
      announce(copy.smartCubeConnected(name));
    } catch (error) {
      announce(copy.smartCubeError);
      throw error;
    }
  }, [announce, copy, smartCube, external.timer, external.stackmat]);

  closeDeviceOverlayRef.current = () => {
    externalOperationRef.current++;
    external.resolveMac(null);
    if (!external.timer.status.connected) void external.timer.disconnect();
    if (!external.stackmat.status.listening) external.stackmat.stop();
    if (smartCube.phase === 'requesting' || smartCube.phase === 'connecting') void smartCube.disconnect();
    void smartCube.stopScan?.();
  };

  const scanSmartCubes = useCallback(async () => {
    try {
      await smartCube.scanDevices?.();
    } catch (error) {
      announce(copy.smartCubeError);
      throw error;
    }
  }, [announce, copy.smartCubeError, smartCube]);

  const disconnectSmartCube = useCallback(async () => {
    await smartCube.disconnect();
    announce(copy.smartCubeDisconnected);
  }, [announce, copy.smartCubeDisconnected, smartCube]);

  const resetSmartCubeState = useCallback(async () => {
    if (smartCube.resetDeviceState) await smartCube.resetDeviceState();
    else smartCube.resetState?.();
  }, [smartCube]);

  const openSmartCubeDevice = useCallback(() => {
    openOverlayRef.current = TIMER_OVERLAY_IDS.smartCubeDevice;
    setOpenOverlay(TIMER_OVERLAY_IDS.smartCubeDevice);
    if (smartCube.phase === 'idle' || smartCube.phase === 'error') {
      if (smartCube.scanDevices) void scanSmartCubes().catch(() => undefined);
      else void connectSmartCube().catch(() => undefined);
    }
  }, [connectSmartCube, scanSmartCubes, smartCube]);

  useEffect(() => {
    metronome.setMetronomeHold('timer', timerMode === 1 && !!store?.settings.metronomeOn
      && (timer.machine.phase === 'inspecting' || timer.machine.phase === 'running'));
  }, [metronome, store?.settings.metronomeOn, timer.machine.phase, timerMode]);

  const displayMs = timer.machine.phase === 'running'
    ? Math.max(0, timer.nowMs - (timer.machine.startedAtMs ?? timer.nowMs))
    : timer.machine.lastMs ?? 0;
  timerDisplayMsRef.current = displayMs;
  const targetFeedbackClass = useTimerTargetFeedback(timer.machine.phase, displayMs, targetMs);
  const timerText = formatTimerTimingDisplay({
    displayMs,
    hideTime: hideRunningTime,
    inspectionDisplayMs: timer.machine.phase === 'inspecting'
      ? Math.max(0, timer.nowMs - (timer.machine.inspectionStartedAtMs ?? timer.nowMs))
      : 0,
    inspectionLimitSec: timer.machine.inspectionSec ?? 0,
    lastPenalty,
    phase: timer.machine.phase,
    precision: resultPrecision,
    runningPrecision,
    timingEnabled,
  });
  let timerInstruction: string = timingEnabled ? copy.holdToArm : copy.nextScramble;
  if (timer.machine.phase === 'running') timerInstruction = copy.tapToStop;
  if (timer.machine.phase === 'holding') timerInstruction = copy.keepHolding;
  if (timer.machine.phase === 'ready') timerInstruction = copy.releaseToStart;
  if (timingEnabled && timer.machine.phase === 'inspecting') {
    timerInstruction = copy.holdToArm;
  }
  const timerColorClass = timer.machine.phase === 'stopped'
    && (lastPenalty === 'DNF' || lastPenalty === 'DNS')
    ? 'dnf'
    : timer.machine.phase;
  // Web keeps source/config controls available through hold/ready/inspection
  // and fades them only once timing is actually running.
  const sourceControlsEnabled = timer.machine.phase !== 'running'
    && !timerContextMutationBusy;
  const scrambleReady = attemptCanStart;
  const mappedRealSource = scrambleSource === 'wca'
    && timerSupportsRealWcaScrambles(activeEvent);
  const resolvedWcaSource = resolveTimerWcaSourceCore(wcaSourceSettings);
  const appByStepsFilter = (activeEvent !== '222' || scramble222Type === 'full')
    ? timerByStepsFilter(activeEvent, mappedRealSource ? 'wca' : 'random', byStepsSettings)
    : null;
  const appWcaDifficultyFilter = mappedRealSource
    ? timerWcaDifficultyFilter(timerWcaScrambleEventId(activeEvent), wcaSourceSettings, {
        competitionUnindexed: wcaDifficultyCoverage === 'unindexed',
        suppress: activeEvent === '222' && scramble222Type !== 'full',
      })
    : null;
  const scrambleStatus = (() => {
    if (scrambleAvailability === 'loading') {
      return timerScrambleStatus(randomOptimalRequested || randomOptimalAuthPending
        ? 'loading-optimal'
        : mappedRealSource ? 'loading-real' : 'loading-generated');
    }
    if (scrambleAvailability === 'unsupported') return timerScrambleStatus('unsupported');
    if (scrambleAvailability === 'empty') {
      if (currentScrambleEntry?.failure?.kind === 'trainer') {
        return timerScrambleStatus(currentScrambleEntry.failure.reason === 'rare'
          ? 'rare-trainer'
          : 'empty-trainer');
      }
      return timerScrambleStatus(timerWcaScrambleEmptyReason({
        competitionUnindexed: wcaDifficultyCoverage === 'unindexed',
        hasByStepsFilter: appByStepsFilter !== null,
        hasDifficultyFilter: appWcaDifficultyFilter !== null,
        hasTypeFilter: activeEvent === '222' && scramble222Type !== 'full',
        mode: resolvedWcaSource.mode,
      }));
    }
    if (scrambleAvailability !== 'error') return null;
    const descriptor = timerScrambleStatus(
      currentScrambleEntry?.failure?.kind === 'optimal'
        ? 'error-optimal'
        : currentScrambleEntry?.failure?.kind === 'trainer'
          ? 'error-generated'
        : mappedRealSource
        ? 'error-real'
        : appByStepsFilter
          ? 'error-steps'
          : 'error-generated',
    );
    const retryable = currentScrambleEntry?.failure?.kind === 'generation'
      ? currentScrambleEntry.failure.retryable
      : descriptor.retryable;
    return { ...descriptor, retryable };
  })();
  const scrambleText = scrambleSource === 'manual' && scramble.length === 0
    ? ''
    : activeEvent === 'custom' && scramble.length === 0
      ? '—'
      : smartCube.phase === 'connected' && timerSupportsSmartCubeAutoTiming(activeEvent)
        ? normalizeWcaScramble(scramble) ?? scramble
        : scramble;

  const invalidateCurrentScramble = useCallback(() => {
    randomScrambleGateRef.current.cancel();
    scrambleRequestRef.current += 1;
    attemptRef.current = null;
    timer.cancelArm();
    applyScrambleHistory({ list: [], idx: -1 });
  }, [applyScrambleHistory, timer.cancelArm]);

  const updateSettings = useCallback((changes: TimerSettingsUpdate) => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.updateSettings(changes).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, recoverLatestStoreSnapshot]);

  const updateWcaSourceSettings = useCallback((
    patch: Partial<TimerWcaSourceSettings>,
  ) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    const current = wcaSourceSettingsRef.current;
    const next = normalizeTimerWcaSourceSettings({ ...current, ...patch });
    const event = activeEventRef.current;
    const currentSpec = normalizeRealScrambleSourceSpec({
      event,
      scramble222Mode: scramble222ModeRef.current,
      scramble222Type: scramble222TypeRef.current,
      ...current,
    });
    const nextSpec = normalizeRealScrambleSourceSpec({
      event,
      scramble222Mode: scramble222ModeRef.current,
      scramble222Type: scramble222TypeRef.current,
      ...next,
    });
    const currentSourceKey = realScrambleSourceKey(currentSpec);
    const identityChanged = currentSourceKey !== realScrambleSourceKey(nextSpec);
    const revision = storeSnapshotGateRef.current.beginMutation();
    wcaSourceSettingsRef.current = next;
    if (identityChanged) {
      const request = realRequestsRef.current.get(currentSourceKey);
      request?.cancel();
      realRequestsRef.current.delete(currentSourceKey);
      invalidateCurrentScramble();
    }
    setStore((value) => value ? {
      ...value,
      settings: { ...value.settings, ...next },
    } : value);
    void repository.updateSettings(next).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, copy.finishAttemptFirst, invalidateCurrentScramble, recoverLatestStoreSnapshot, sourceControlsEnabled]);

  const updateScramble222Mode = useCallback((mode: Scramble222Mode) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (mode === scramble222ModeRef.current) return;
    scramble222ModeRef.current = mode;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, scramble222Mode: mode },
    } : current);
    updateSettings({ scramble222Mode: mode });
  }, [announce, copy.finishAttemptFirst, invalidateCurrentScramble, sourceControlsEnabled, updateSettings]);

  const updateScramble222Type = useCallback((type: Scramble222Type) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (type === scramble222TypeRef.current) return;
    scramble222TypeRef.current = type;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, scramble222Type: type },
    } : current);
    updateSettings({ scramble222Type: type });
  }, [announce, copy.finishAttemptFirst, invalidateCurrentScramble, sourceControlsEnabled, updateSettings]);

  const updateByStepsSettings = useCallback((patch: Partial<TimerByStepsSettings>) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    const event = activeEventRef.current;
    const source = scrambleSourceRef.current === 'wca' && timerSupportsRealWcaScrambles(event)
      ? 'wca'
      : 'random';
    const next = normalizeTimerByStepsSettings(event, source, {
      ...byStepsSettingsRef.current,
      ...patch,
    });
    const previous = byStepsSettingsRef.current;
    if (previous.genByStepsOn === next.genByStepsOn
      && previous.genStepsMetric === next.genStepsMetric
      && previous.genSteps.join('.') === next.genSteps.join('.')) return;
    byStepsSettingsRef.current = next;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, ...next },
    } : current);
    updateSettings(next);
  }, [announce, copy.finishAttemptFirst, invalidateCurrentScramble, sourceControlsEnabled, updateSettings]);

  const updateRandomDifficultySettings = useCallback((
    patch: Partial<TimerRandomDifficultySettings>,
  ) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    const previous = randomDifficultySettingsRef.current;
    const next = normalizeTimerRandomDifficultySettings({ ...previous, ...patch });
    if (previous.genDiffOn === next.genDiffOn
      && previous.genDiffVariant === next.genDiffVariant
      && previous.genDiffStage === next.genDiffStage
      && previous.genDiffColors === next.genDiffColors
      && previous.genDiffSlot === next.genDiffSlot
      && previous.genDiffSteps.join('.') === next.genDiffSteps.join('.')) return;
    randomDifficultySettingsRef.current = next;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, ...next },
    } : current);
    updateSettings(next);
  }, [announce, copy.finishAttemptFirst, invalidateCurrentScramble, sourceControlsEnabled, updateSettings]);

  const updateManualScrambles = useCallback((value: string) => {
    if (!sourceControlsEnabled) {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (manualScramblesRef.current === value) return;
    const revision = storeSnapshotGateRef.current.beginMutation();
    manualSourceRevisionRef.current = advanceTimerSourceRevision(
      manualSourceRevisionRef.current,
      value,
    );
    manualScramblesRef.current = value;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, manualScrambles: value },
    } : current);
    void repository.updateSettings({ manualScrambles: value }).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, copy.finishAttemptFirst, invalidateCurrentScramble, recoverLatestStoreSnapshot, sourceControlsEnabled]);

  const selectTimerEvent = useCallback((id: string) => {
    const nextEvent = timerEventIdFromSelector(id);
    if (!nextEvent || nextEvent === activeEvent) return;
    if (timer.machine.phase === 'running') {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (!beginTimerContextMutation()) return;
    timer.cancelArm();
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.selectEvent(nextEvent).then((data) => {
      const committed = storeSnapshotGateRef.current.commitIfLatest(revision, data, (latest) => {
        invalidateCurrentScramble();
        timer.reset();
        setLastResult(null);
        setLastPenalty(null);
        applyStoreSnapshot(latest);
      });
      if (committed && !timerSupportsSmartCubeAutoTiming(nextEvent) && smartCube.phase === 'connected') {
        void smartCube.disconnect();
      }
    }).catch(async () => {
      await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    }).finally(() => {
      endTimerContextMutation();
    });
  }, [activeEvent, announce, applyStoreSnapshot, beginTimerContextMutation, copy.actionFailed, copy.finishAttemptFirst, endTimerContextMutation, invalidateCurrentScramble, recoverLatestStoreSnapshot, smartCube, timer]);

  const updateSolve = useCallback((solve: Solve, changes: Partial<Pick<Solve, 'penalty' | 'comment' | 'bld' | 'reconOk'>>) => {
    const last = solvesRef.current[solvesRef.current.length - 1];
    if (last?.id === solve.id && changes.penalty) setLastPenalty(changes.penalty);
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.updateSolve(solve.event, solve.id, changes)
      .then((data) => {
        storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      })
      .catch(() => {
        void recoverLatestStoreSnapshot(revision).catch(() => undefined);
        announce(copy.actionFailed);
      });
  }, [announce, applyStoreSnapshot, copy.actionFailed, recoverLatestStoreSnapshot]);

  const useReconstructionScramble = useCallback((text: string) => {
    if (!timerCanSwitchScramble(timerPhaseRef.current) || timerContextMutationBusy) {
      announce(copy.finishAttemptFirst);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    timer.cancelArm();
    const source = scrambleSourceRef.current;
    const event = activeEventRef.current;
    const entry = createMobileScrambleHistoryEntry(event, source, scrambleIdentityFor(source, event));
    applyScrambleHistory(histPush(scrambleHistoryRef.current, {
      ...entry,
      availability: 'ready',
      scramble: trimmed,
      sourceSnapshot: { kind: 'manual', identity: `replay:${entry.id}` },
    }));
    closeHistorySolveDetail();
    setRecapSolveId(null);
    setView('timer');
  }, [announce, applyScrambleHistory, closeHistorySolveDetail, copy.finishAttemptFirst, scrambleIdentityFor, timer.cancelArm, timerContextMutationBusy]);

  const rankWcaId = activeAuthSession?.user.wcaId?.trim().toUpperCase() ?? '';
  const [rankPersonCountry, setRankPersonCountry] = useState<{ id: string; country: string } | null>(null);
  useEffect(() => {
    let live = true;
    if (rankWcaId) void getWcaPerson(rankWcaId).then(person => { if (live) setRankPersonCountry({ id: rankWcaId, country: person?.country_iso2 ?? '' }); });
    return () => { live = false; };
  }, [rankWcaId]);
  const rankAccountCountry = (rankPersonCountry?.id === rankWcaId ? rankPersonCountry.country : '') || '';
  const rankCountry = rankAccountCountry || store?.settings.rankCountry || '';
  const rankMs = timer.machine.lastMs;
  const rankVisible = store?.settings.timingEnabled && (timer.machine.phase === 'stopped' || (timer.machine.phase === 'holding' && timer.machine.inspectionStartedAtMs === null));
  const rankCentis = rankVisible && rankMs !== null && lastPenalty !== 'DNF' && lastPenalty !== 'DNS' ? Math.round((rankMs + (lastPenalty === '+2' ? 2000 : 0)) / 10) : null;
  const backupTokenRef = useRef(activeAuthSession?.token); backupTokenRef.current = activeAuthSession?.token;
  const backupClient = createTimerBackupClient({ apiUrl: mobileApiUrl, fetcher: fetch,
    headers: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + activeAuthSession?.token }),
  });
  const canCommitSettingsData = () => viewRef.current === 'settings' && timerCanSwitchScramble(timerPhaseRef.current);
  const restoreDatabaseBackup = async (load: () => Promise<TimerStoreData>) => {
    if (!canCommitSettingsData() || !beginTimerContextMutation()) throw new Error('Timer busy');
    timer.cancelArm();
    const revision = storeSnapshotGateRef.current.beginMutation();
    try {
      const data = await load();
      commitImportedStore(revision, data);
      setCanUndoImport(await repository.hasImportRecovery());
    } finally { endTimerContextMutation(); }
  };

  const reconstructionHost = {
    localize: <T,>(text: { en: T; zh: T }) => text[language],
    writeClipboardText: host.writeClipboardText,
    replayUrl: async (solve: Solve) => {
      const base = SITE_ORIGIN + (language === 'zh' ? '/zh' : '') + '/timer';
      const id = await createTimerReplayShare(solve, activeAuthSession?.token, { apiUrl: mobileApiUrl, fetcher: fetch });
      return id ? base + '?share=' + id : encodeReplayUrl(solve, base);
    },
    recordGyro: store?.settings.recordGyro ?? true,
    onEnableGyro: () => updateSettings({ recordGyro: true }),
  };
  const recapSolve = solves.find((solve) => solve.id === recapSolveId) ?? null;
  const solveRecap = recapSolve && (
    <Suspense fallback={<Spinner label={{ en: 'Loading', zh: '加载中' }[language]} />}>
      <SolveRecap
        key={recapSolve.id}
        history={solves}
        host={reconstructionHost}
        isZh={language === 'zh'}
        onDismiss={() => setRecapSolveId(null)}
        onFull={() => { setView('history'); openHistorySolveDetail(recapSolve); }}
        onReconFeedback={(reconOk) => updateSolve(recapSolve, { reconOk })}
        onUseScramble={useReconstructionScramble}
        solve={recapSolve}
      />
    </Suspense>
  );

  const moveSolveToSession = useCallback(async (solve: Solve, targetSessionId: string): Promise<boolean> => {
    try {
      await commitSessionMutation(() => repository.moveSolveToSession(solve.id, targetSessionId));
      return true;
    } catch {
      announce(copy.actionFailed);
      return false;
    }
  }, [announce, commitSessionMutation, copy.actionFailed]);

  const addManualSolve = useCallback((value: TimerManualEntryValue) => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.addSolve(value).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      setManualEntryOpen(false);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, recoverLatestStoreSnapshot]);

  const deleteSolveNow = useCallback(async (solve: Solve): Promise<boolean> => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    try {
      const data = await repository.deleteSolve(solve.event, solve.id);
      return storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    } catch {
      await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
      return false;
    }
  }, [announce, applyStoreSnapshot, copy.actionFailed, recoverLatestStoreSnapshot]);

  const quickDeleteSolve = useCallback((solve: Solve) => {
    const sessionId = store?.database.activeSessionId;
    if (!sessionId) return;
    void deleteSolveNow(solve).then((committed) => {
      if (!committed) return;
      setUndoToast({
        message: copy.deletedSolve,
        undo: () => {
          setUndoToast(null);
          const revision = storeSnapshotGateRef.current.beginMutation();
          void repository.restoreSolve(sessionId, solve).then((data) => {
            storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
          }).catch(() => {
            void recoverLatestStoreSnapshot(revision).catch(() => undefined);
            announce(copy.actionFailed);
          });
        },
      });
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, copy.deletedSolve, deleteSolveNow, recoverLatestStoreSnapshot, store?.database.activeSessionId]);

  const changeLastPenalty = useCallback((penalty: Penalty) => {
    const last = solvesRef.current[solvesRef.current.length - 1];
    if (!last) return;
    updateSolve(last, { penalty });
  }, [updateSolve]);

  const commentLastSolve = useCallback(() => {
    const last = solvesRef.current[solvesRef.current.length - 1];
    if (!last) return;
    historyWorkspaceRef.current?.clearFilters();
    setView('history');
    openHistorySolveDetail(last, true);
  }, [openHistorySolveDetail]);

  const deleteLastSolve = useCallback(() => {
    const last = solvesRef.current[solvesRef.current.length - 1];
    const sessionId = store?.database.activeSessionId;
    if (!last || !sessionId) return;
    void deleteSolveNow(last).then((committed) => {
      if (!committed) return;
      setLastResult(null);
      setLastPenalty(null);
      setUndoToast({
        message: copy.deletedLastSolve,
        undo: () => {
          setUndoToast(null);
          const revision = storeSnapshotGateRef.current.beginMutation();
          void repository.restoreSolve(sessionId, last).then((data) => {
            if (!storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot)) return;
            setLastResult({
              autoPenalty: last.penalty === 'DNS' ? 'ok' : last.penalty,
              inspectionMs: last.inspectionMs ?? 0,
              timeMs: last.timeMs,
            });
            setLastPenalty(last.penalty);
          }).catch(() => {
            void recoverLatestStoreSnapshot(revision).catch(() => undefined);
            announce(copy.actionFailed);
          });
        },
      });
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, copy.deletedLastSolve, deleteSolveNow, recoverLatestStoreSnapshot, store?.database.activeSessionId]);

  const exportData = useCallback(() => {
    void repository.exportJson()
      .then(shareOrDownloadBackup)
      .then(() => announce(copy.exportSuccess))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        announce(copy.actionFailed);
      });
  }, [announce, copy.actionFailed, copy.exportSuccess]);

  const exportFormat = useCallback((format: TimerExportFormat) => {
    if (format === 'cuberoot') { exportData(); return; }
    void repository.load().then(async (data) => {
      const byEvent = data.database.dataBySession[data.database.activeSessionId] ?? {};
      const date = new Date().toISOString().slice(0, 10);
      let text: string; let count: number; let extension: string; let mime: string;
      if (format === 'cstimer') {
        const result = exportTimerCstimerJson(byEvent);
        text = result.json; count = result.solveCount; extension = 'json'; mime = 'application/json';
      } else if (format === 'csv') {
        const result = exportTimerSolvesCsv(byEvent);
        text = result.csv; count = result.solveCount; extension = 'csv'; mime = 'text/csv;charset=utf-8';
      } else {
        const entries = byEvent[data.settings.event] ?? [];
        text = exportSpeedstacks(entries); count = entries.length; extension = 'txt'; mime = 'text/plain;charset=utf-8';
      }
      if (count === 0) {
        announce({ zh: '当前没有可导出的成绩。', en: 'No solves to export.' }[language]);
        return;
      }
      await shareOrDownloadBackup(text, { filename: `cuberoot-${format}-${date}.${extension}`, mime });
      announce(copy.exportSuccess);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      announce(copy.actionFailed);
    });
  }, [announce, copy.actionFailed, copy.exportSuccess, exportData, language]);

  const commitImportedStore = useCallback((
    revision: SnapshotRevision,
    data: TimerStoreData,
  ): boolean => storeSnapshotGateRef.current.commitIfLatest(revision, data, (latest) => {
    trainingRound.reset();
    // Import/undo/reset can replace every source-affecting setting. Make the swap one
    // synchronous attempt boundary before any old hold/keyup can reach it.
    const previousIdentity = scrambleIdentityFor(
      scrambleSourceRef.current,
      activeEventRef.current,
    );
    applyStoreSnapshot(latest);
    const nextIdentity = scrambleIdentityFor(
      scrambleSourceRef.current,
      activeEventRef.current,
    );
    if (previousIdentity !== nextIdentity) invalidateCurrentScramble();
  }), [applyStoreSnapshot, invalidateCurrentScramble, scrambleIdentityFor, trainingRound.reset]);

  const resetSettingsToDefaults = useCallback(() => {
    if (!sourceControlsEnabled || !beginTimerContextMutation()) return;
    timer.cancelArm();
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.updateSettings(resetTimerStoreSettings).then((data) => {
      if (!commitImportedStore(revision, data)) return;
      if (scrambleSourceRef.current !== 'wca') {
        scrambleSourceRef.current = 'wca';
        setScrambleSource('wca');
        invalidateCurrentScramble();
      }
    }).catch(async () => {
      await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    }).finally(endTimerContextMutation);
  }, [announce, beginTimerContextMutation, commitImportedStore, copy.actionFailed, endTimerContextMutation, invalidateCurrentScramble, recoverLatestStoreSnapshot, sourceControlsEnabled, timer.cancelArm]);

  const importData = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMoreOpen(false);
    if (file.size > MAX_TIMER_BACKUP_BYTES) {
      announce(copy.importTooLarge);
      return;
    }
    let revision: SnapshotRevision | null = null;
    let ownsContextMutation = false;
    void (async () => {
      const text = await file.text();
      const preview = await repository.previewImport(text);
      if (!window.confirm(copy.importConfirm(preview.incoming.solveCount, preview.current.solveCount))) return;
      if (timer.machine.phase === 'running') {
        announce(copy.finishAttemptFirst);
        return;
      }
      if (!beginTimerContextMutation()) return;
      ownsContextMutation = true;
      timer.cancelArm();
      revision = storeSnapshotGateRef.current.beginMutation();
      const data = await repository.importJson(text);
      commitImportedStore(revision, data);
      setLoadError(null);
      setCanUndoImport(await repository.hasImportRecovery());
      announce(COPY[data.settings.language].importSuccess);
    })().catch(async () => {
      if (revision) await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    }).finally(() => {
      if (ownsContextMutation) endTimerContextMutation();
    });
  }, [announce, beginTimerContextMutation, commitImportedStore, copy.actionFailed, copy.finishAttemptFirst, copy.importConfirm, copy.importTooLarge, endTimerContextMutation, recoverLatestStoreSnapshot, timer.cancelArm, timer.machine.phase]);

  const undoImport = useCallback(() => {
    if (!window.confirm(copy.undoImportConfirm)) return;
    if (timer.machine.phase === 'running') {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (!beginTimerContextMutation()) return;
    timer.cancelArm();
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.restoreImportRecovery().then((data) => {
      commitImportedStore(revision, data);
      setCanUndoImport(false);
      announce(COPY[data.settings.language].undoImportSuccess);
    }).catch(async () => {
      await recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    }).finally(() => {
      endTimerContextMutation();
    });
  }, [announce, beginTimerContextMutation, commitImportedStore, copy.actionFailed, copy.finishAttemptFirst, copy.undoImportConfirm, endTimerContextMutation, recoverLatestStoreSnapshot, timer.cancelArm, timer.machine.phase]);

  const openExternal = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!host.isInstalled()) return;
    event.preventDefault();
    void host.openExternal(event.currentTarget.href).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, host]);

  const toggleMoreLanguage = useCallback(() => {
    let next: SupportedLanguage = 'zh';
    if (language === 'zh') next = 'en';
    updateSettings({ language: next });
  }, [language, updateSettings]);

  const toggleTimerFullscreen = useCallback(() => {
    void (async () => {
      try {
        if (fullscreenRef.current) {
          if (document.fullscreenElement) await document.exitFullscreen();
          setFullscreen(false);
          return;
        }
        if (typeof document.documentElement.requestFullscreen === 'function') {
          await document.documentElement.requestFullscreen();
          setFullscreen(true);
          return;
        }
        // Older Android WebViews still get the identical distraction-free App
        // layout even when the platform Fullscreen API is unavailable.
        setFullscreen(true);
      } catch {
        announce(copy.actionFailed);
      }
    })();
  }, [announce, copy.actionFailed]);

  const openManualEntry = useCallback(() => {
    timer.cancelArm();
    setManualEntryOpen(true);
  }, [timer.cancelArm]);

  const clearCurrentEvent = useCallback(() => {
    if (!store || solves.length === 0) return;
    const eventName = timerEventPickerName(activeEvent, language);
    const confirmation = timerClearCurrentEventConfirmation(eventName, solves.length)[language];
    if (!window.confirm(confirmation)) return;
    if (!beginTimerContextMutation()) return;
    timer.cancelArm();
    const sessionId = store.database.activeSessionId;
    void commitSessionMutation(() => repository.clearSessionEvent(sessionId, activeEvent))
      .then(() => {
        setLastResult(null);
        setLastPenalty(null);
      })
      .catch(() => announce(copy.actionFailed))
      .finally(endTimerContextMutation);
  }, [
    activeEvent,
    announce,
    beginTimerContextMutation,
    commitSessionMutation,
    copy.actionFailed,
    endTimerContextMutation,
    language,
    solves.length,
    store,
    timer.cancelArm,
  ]);

  const moreItems = useMemo(() => mobileTimerMoreMenuItems({
    compactViewport: true,
    drillActive: effectiveDrillTarget !== null,
    event: activeEvent,
    fullscreen,
    solveCount: solves.length,
  }, language, {
    'more.marks': () => openToolsRoute('/timer/marks'),
    'more.stats-mobile': () => { setView('history'); setHistoryTab('stats'); },
    'more.language-mobile': toggleMoreLanguage,
    'more.drill': () => {
      openOverlayRef.current = TIMER_OVERLAY_IDS.drillPicker;
      setOpenOverlay(TIMER_OVERLAY_IDS.drillPicker);
    },
    'more.bld-helper': () => openToolsRoute('/alg/3bld/helper'),
    'more.fullscreen': toggleTimerFullscreen,
    'more.manual-entry': openManualEntry,
    'more.replay': () => setReplayImportOpen(true),
    'more.solver': () => openToolsRoute('/scramble/solver?event=333'),
    'more.bulk': () => openToolsRoute('/scramble/gen?mode=batch'),
    'more.print': () => printControllerRef.current?.print(),
    'more.clear-event': clearCurrentEvent,
  }), [
    activeEvent,
    clearCurrentEvent,
    effectiveDrillTarget,
    fullscreen,
    language,
    openManualEntry,
    openToolsRoute,
    solves.length,
    toggleMoreLanguage,
    toggleTimerFullscreen,
  ]);

  useEffect(() => {
    const modalState = () => (
      viewRef.current === 'settings'
      || !timerVisibleRef.current
      || openOverlayRef.current !== null
      || statsOpenRef.current || historyModalOpenRef.current || replayBlockingRef.current
      || moreOpenRef.current
      || manualEntryOpenRef.current
        ? 'blocking' as const
        : 'none' as const
    );
    const execute = (
      decision: ReturnType<typeof timerKeyDownDecision>,
      event: KeyboardEvent,
    ) => {
      if (decision.preventDefault) event.preventDefault();
      if (decision.blurActiveElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const command = decision.command;
      const currentSolves = solvesRef.current;
      const last = currentSolves[currentSolves.length - 1];
      const togglePenalty = (penalty: Penalty) => {
        if (!last) return;
        changeLastPenalty(last.penalty === penalty ? 'ok' : penalty);
      };

      switch (command.id) {
        case 'none':
          return;
        case 'press-down':
          timer.pressDown();
          return;
        case 'press-up':
          timer.pressUp();
          return;
        case 'reset':
          timer.reset();
          return;
        case 'mark-stage':
          attemptSplitRecorder.markStage(command.stage, timerDisplayMsRef.current);
          return;
        case 'mark-bld-memo':
          attemptSplitRecorder.markMemo(timerDisplayMsRef.current);
          return;
        case 'delete-last':
          deleteLastSolve();
          return;
        case 'toggle-plus2':
          togglePenalty('+2');
          return;
        case 'toggle-dnf':
          togglePenalty('DNF');
          return;
        case 'toggle-dns':
          togglePenalty('DNS');
          return;
        case 'next-scramble':
          nextDisplayedScramble();
          return;
        case 'prev-scramble':
          previousDisplayedScramble();
          return;
        case 'toggle-fullscreen':
          void toggleTimerFullscreen();
          return;
        case 'open-solve': {
          const solve = currentSolves[currentSolves.length - command.offsetFromLast];
          if (!solve) return;
          historyWorkspaceRef.current?.clearFilters();
          setView('history');
          openHistorySolveDetail(solve);
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      execute(timerKeyDownDecision({
        bldMemoActive,
        input: event,
        keymap: keymapRef.current,
        modal: modalState(),
        multiStageActive,
        phase: timerPhaseRef.current,
        solveCount: solvesRef.current.length,
        target: timerKeyboardTargetContext(event.target),
        timingEnabled: timingEnabledRef.current,
      }), event);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      execute(timerKeyUpDecision({
        input: event,
        modalOpen: modalState() !== 'none',
        target: timerKeyboardTargetContext(event.target),
        timingEnabled: timingEnabledRef.current,
      }), event);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    attemptSplitRecorder,
    bldMemoActive,
    changeLastPenalty,
    deleteLastSolve,
    multiStageActive,
    nextDisplayedScramble,
    openHistorySolveDetail,
    previousDisplayedScramble,
    timer.pressDown,
    timer.pressUp,
    timer.reset,
    toggleTimerFullscreen,
  ]);

  gestureActionsRef.current = {
    'next-scramble': nextDisplayedScramble,
    'penalty-ok': () => changeLastPenalty('ok'),
    'toggle-plus2': () => {
      const last = solvesRef.current[solvesRef.current.length - 1];
      changeLastPenalty(last?.penalty === '+2' ? 'ok' : '+2');
    },
    'toggle-dnf': () => {
      const last = solvesRef.current[solvesRef.current.length - 1];
      changeLastPenalty(last?.penalty === 'DNF' ? 'ok' : 'DNF');
    },
    'prev-scramble': previousDisplayedScramble,
    'comment-last': commentLastSolve,
    'delete-last': deleteLastSolve,
  };

  const { wheelRef: gestureWheelRef } = useGestureWheel({
    active: storeLoaded
      && view !== 'settings'
      && timerVisible
      && !timerOverlayBlocking
      && !moreOpen
      && !manualEntryOpen,
    surfaceRef,
    canGesture: () => timerCanUseGestureWheel(timerPhaseRef.current),
    enabledFor: () => timerGestureActionStates({
      hasLastSolve: solvesRef.current.length > 0,
      hasPreviousScramble: scrambleHistoryRef.current.idx > 0,
    }).map((action) => action.enabled && action.id !== 'copy-scramble'),
    fireAction: (direction) => {
      const action = timerGestureActionAt(direction);
      if (action) gestureActionsRef.current[action.id]?.();
    },
    onPressDown: () => {
      if (timingEnabled) timer.pressDown();
    },
    onPressCancel: () => { timer.cancelPress(); },
    onPressUp: () => {
      if (timingEnabled) timer.pressUp();
      else nextDisplayedScramble();
    },
    onArmCancel: () => { timer.cancelArm(); },
    ignoreTarget: shouldIgnoreTimerTarget,
  });

  if (!store && !loadError) {
    return <main className="loading-screen"><strong>{copy.title}</strong></main>;
  }

  if (!store && loadError) {
    return (
      <main className="recovery-screen">
        <h1>{copy.corruptTitle}</h1>
        <p>{loadError instanceof CorruptTimerStoreError ? copy.corruptDetail : copy.actionFailed}</p>
        <label className="primary-action">
          {copy.importData}
          <input accept="application/json,.json" hidden onChange={importData} type="file" />
        </label>
        <p aria-live="polite" className="toast">{toast}</p>
      </main>
    );
  }

  const scrambleClickEffect = timerScrambleClickEffect(
    'none', // Scramble presses belong to timing, including legacy click preferences.
    scramble.length > 0,
    scrambleReady,
    scrambleStatus?.retryable === true && currentScrambleEntry !== undefined,
  );
  const connectExternalTimer = async () => {
    const token = ++externalOperationRef.current;
    await smartCube.disconnect();
    if (token !== externalOperationRef.current) return;
    external.stackmat.stop();
    await external.timer.connect();
  };
  const startStackmat = async (deviceId?: string) => {
    const token = ++externalOperationRef.current;
    await smartCube.disconnect();
    await external.timer.disconnect();
    if (token !== externalOperationRef.current) return;
    await external.stackmat.start(deviceId);
  };
  const closeExternalDevice = () => {
    externalOperationRef.current++;
    setExternalConnectAttempt(null);
    setOpenOverlay(null);
  };
  const smartCubeDeviceCenter = (
    <TimerDeviceCenter
      ariaLabel={TIMER_DEVICE_CENTER_LABELS.title[language]}
      items={timerDeviceRegistry.list()
        .map((device) => device.kind !== 'smart-cube' ? ({
          id: device.id, kind: device.kind,
          active: device.kind === 'smart-timer' ? external.timer.status.connected : external.stackmat.status.listening,
          label: TIMER_DEVICE_CENTER_LABELS[device.kind][language],
          detail: device.kind === 'smart-timer'
            ? (external.timer.status.connected ? TIMER_DEVICE_CENTER_LABELS.connected[language] : undefined)
            : (external.stackmat.status.listening ? TIMER_DEVICE_CENTER_LABELS.listening[language] : undefined),
          onSelect: () => {
            const kind = device.kind as 'smart-timer' | 'stackmat';
            setOpenOverlay(kind === 'smart-timer' ? TIMER_OVERLAY_IDS.smartTimerDevice : TIMER_OVERLAY_IDS.stackmatDevice);
            const active = kind === 'smart-timer' ? external.timer.status.connected : external.stackmat.status.listening;
            if (!active) {
              const promise = kind === 'smart-timer' ? connectExternalTimer() : startStackmat();
              setExternalConnectAttempt({kind, promise});
              void promise.catch(() => {}); // The shared modal owns the error message.
            }
          },
        }) : ({
          active: smartCube.phase === 'connected',
          detail: smartCube.phase === 'connected'
            ? smartCube.deviceName || TIMER_DEVICE_CENTER_LABELS.connected[language]
            : smartCube.phase === 'requesting' || smartCube.phase === 'connecting'
              ? copy.connectingBluetooth
              : undefined,
          id: device.id,
          kind: device.kind,
          label: TIMER_DEVICE_CENTER_LABELS['smart-cube'][language],
          onSelect: openSmartCubeDevice,
        }))}
      menuLabel={TIMER_DEVICE_CENTER_LABELS.menu[language]}
      triggerLabel={TIMER_DEVICE_CENTER_LABELS.trigger[language]}
    />
  );
  const shellViewport = mobileShellViewportLayout(viewportHeight);
  const viewHeader = (
    <header className="app-titlebar">
      <strong>{view === 'history' ? copy.history : copy.settings}</strong>
      <button
        aria-label={copy.close}
        className="app-titlebar-close"
        onClick={() => {
          if (view === 'history') historyWorkspaceRef.current?.dismiss();
          setView('timer');
        }}
        type="button"
      ><X aria-hidden="true" size={20} /></button>
      <span
        aria-label={connection === 'checking' ? copy.checking : connection === 'online' ? copy.online : copy.offline}
        className={`network network--${connection}`}
        role="status"
      />
    </header>
  );

  return (
    <main
      className={`app-shell app-shell--${dockHistory || view === 'settings' ? 'timer' : view}${shellViewport.classNameSuffix}${fullscreen ? ' app-shell--timer-fullscreen' : ''}${timer.machine.phase === 'running' ? ' is-solving' : ''}`}
      data-timer-hide-ui={timerMode === 1 && store && timerHidesRunningUi(timer.machine.phase, store.settings) ? '' : undefined}
      data-wide={wideLayout ? 'true' : undefined}
      style={shellViewport.style}
    >
      <TimerPrintController
        currentResult={timerText}
        currentScramble={formatScrambleForEvent(activeEvent, scramble)}
        currentScrambleSource={timerPrintScrambleSource(
          scrambleSource,
          language,
          currentReal && scrambleSource === 'wca'
            ? `${displayMobileWcaCompetitionName(
              currentReal.competitionId,
              currentReal.competitionName,
              language,
            )} · ${timerWcaScrambleSourceLine(
              currentReal.roundTypeId,
              currentReal.groupId,
              currentReal.scrambleNumber,
              currentReal.isExtra,
            )}`
            : undefined,
        )}
        event={activeEvent}
        language={language}
        onError={() => announce(copy.actionFailed)}
        ref={printControllerRef}
        sessionName={activePrintSessionName}
        solves={solves}
        transport={host.print}
      />
      {!dockHistory && view === 'history' && (
        viewHeader
      )}

      <TimerWorkspace className="view-container" active={timerMode === 1 && timerVisible} panelOpen={dockHistory} recap={solveRecap}>
        {timerVisible && timerMode === 1 && (
          <section className="timer-view timer-workspace-main timer-workspace-main--with-toolbar" aria-labelledby="timer-title">
            <h1 className="sr-only" id="timer-title">{copy.timer}</h1>
            <TimerTopbar
              actions={(
                <>
                  <TimerMoreMenu
                    items={moreItems}
                    onOpenChange={setMoreOpen}
                    open={moreOpen}
                    triggerClassName="timer-toolbar-icon"
                    triggerDisabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                    triggerLabel={copy.more}
                    viewportBottomInset={primaryNavBottomInset}
                  />
                  <button
                    aria-label={copy.settings}
                    className="timer-toolbar-icon"
                    data-no-timer
                    disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                    onClick={() => { setSettingsCategory('timer'); setView('settings'); }}
                    type="button"
                  ><SettingsIcon aria-hidden="true" size={17} /></button>
                </>
              )}
              controls={(
                <>
                  <TimerPlayersSelect
                    ariaLabel={copy.onePlayer}
                    disabled={timer.machine.phase !== 'idle'
                      && timer.machine.phase !== 'stopped'}
                    onlineLabel={copy.online}
                    onChange={(mode) => {
                      timerModeRef.current = mode;
                      setTimerMode(mode);
                    }}
                    playerLabel={copy.players}
                    value={1}
                  />
                  <TimerPuzzlePicker
                    dataNoTimer
                    disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                    groups={eventPickerGroups}
                    onOpenChange={handleTimerOverlayOpenChange}
                    onSelect={selectTimerEvent}
                    open={openOverlay === TIMER_OVERLAY_IDS.puzzlePicker}
                    puzzleLabel={copy.puzzle}
                    scrambleTypeLabel={copy.scrambleType}
                    selectedEvent={activeEvent}
                  />
                  <TimerScrambleSourceSelect
                    className="shell-scramble-source-select"
                    disabled={!sourceControlsEnabled}
                    labels={{
                      ariaLabel: copy.scrambleSource,
                      real: copy.real,
                      realOption: copy.realOption,
                      random: copy.random,
                      randomOption: copy.randomOption,
                      manual: copy.manual,
                      manualOption: copy.manualOption,
                    }}
                    onChange={(source) => {
                      if (!sourceControlsEnabled) {
                        announce(copy.finishAttemptFirst);
                        return;
                      }
                      if (source === scrambleSourceRef.current) return;
                      invalidateCurrentScramble();
                      setScrambleSource(source);
                    }}
                    onOpenChange={handleTimerOverlayOpenChange}
                    open={openOverlay === TIMER_OVERLAY_IDS.scrambleSource}
                    popupClassName="shell-scramble-source-popup"
                    realValue="wca"
                    triggerClassName="shell-players-select"
                    value={scrambleSource}
                  />
                  <span
                    className="mobile-wca-shared-controls"
                    data-no-timer
                    ref={setWcaDifficultyToggleSlot}
                  />
                </>
              )}
            />
            <TimerStageLayout
              className="mobile-timer-stage"
              fullscreen={fullscreen}
              source={<>
                {scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent) && (
                  <fieldset
                    className="mobile-scramble-source-config mobile-wca-source-config"
                    disabled={!sourceControlsEnabled}
                  >
                    <TimerWcaSourceConfig
                      adapter={wcaSourceAdapter}
                      competitionDisplayName={(competitionId, canonicalName) => (
                        displayMobileWcaCompetitionName(competitionId, canonicalName, language)
                      )}
                      disabled={!sourceControlsEnabled}
                      labels={wcaSourceLabels}
                      maxDate={toLocalIsoDate()}
                      minDate={TIMER_WCA_MIN_DATE}
                      onChange={updateWcaSourceSettings}
                      onOpenChange={handleTimerOverlayOpenChange}
                      open={openOverlay === TIMER_OVERLAY_IDS.wcaCompetition}
                      renderCountry={(country) => <Flag iso2={country} />}
                      renderDateRange={(props) => (
                        <DateRangeInput
                          ariaLabel={props.ariaLabel}
                          className="mobile-wca-date-range"
                          disabled={props.disabled}
                          from={props.from}
                          labels={dateRangeLabels}
                          max={props.max}
                          min={props.min}
                          onChange={props.onChange}
                          size="compact"
                          to={props.to}
                        />
                      )}
                      roundLabel={timerWcaRoundShortLabel}
                      settings={wcaSourceSettings}
                      trailingControls={(
                        <span className="mobile-wca-shared-controls" ref={setWcaTopControlsSlot} />
                      )}
                      wcaEventId={timerWcaScrambleEventId(activeEvent)}
                    />
                    <TimerWcaDifficultyConfig
                      adapter={mobileTimerWcaDifficultyAdapter}
                      disabled={!sourceControlsEnabled}
                      language={language}
                      labels={wcaDifficultyLabels}
                      onChange={updateWcaSourceSettings}
                      onCoverageChange={setWcaDifficultyCoverage}
                      settings={wcaSourceSettings}
                      topControlsSlot={wcaTopControlsSlot}
                      toggleSlot={wcaDifficultyToggleSlot}
                      wcaEventId={timerWcaScrambleEventId(activeEvent)}
                    />
                  </fieldset>
                )}
                {scrambleSource === 'random' && canTrainerDifficulty(activeEvent) && (
                  <fieldset
                    className="mobile-scramble-source-config mobile-random-difficulty-config"
                    disabled={!sourceControlsEnabled}
                  >
                    <TimerRandomDifficultyConfig
                      disabled={!sourceControlsEnabled}
                      language={language}
                      onChange={updateRandomDifficultySettings}
                      settings={randomDifficultySettings}
                      toggleSlot={wcaDifficultyToggleSlot}
                    />
                  </fieldset>
                )}
                {activeEvent === '222' && scrambleSource !== 'manual' && scramble222Type !== 'full' && (
                  <fieldset
                    className="mobile-scramble-source-config mobile-scramble-222-config"
                    disabled={!sourceControlsEnabled}
                  >
                    <TimerScramble222Config
                      active222
                      disabled={!sourceControlsEnabled}
                      labels={scramble222Labels}
                      mode={scramble222Mode}
                      onModeChange={updateScramble222Mode}
                      onTypeChange={updateScramble222Type}
                      showLabel={false}
                      showModeWithSpecialType={scrambleSource === 'wca'}
                      showSpecialTypes
                      type={scramble222Type}
                      typeOptions={scrambleSource === 'random'
                        ? SCRAMBLE_222_TYPES
                        : WCA_SCRAMBLE_222_TYPES}
                    />
                  </fieldset>
                )}
                {scrambleSource !== 'manual'
                  && stepPuzzleOf(activeEvent)
                  && (activeEvent !== '222' || scramble222Type === 'full') && (
                  <fieldset
                    className="mobile-scramble-source-config mobile-scramble-222-config"
                    disabled={!sourceControlsEnabled}
                  >
                    <TimerByStepsConfig
                      disabled={!sourceControlsEnabled}
                      event={activeEvent}
                      extraTopRow={activeEvent === '222' ? (
                        <TimerScramble222Config
                          active222
                          disabled={!sourceControlsEnabled}
                          labels={scramble222Labels}
                          mode={scramble222Mode}
                          onModeChange={updateScramble222Mode}
                          onTypeChange={updateScramble222Type}
                          showLabel={false}
                          showModeWithSpecialType={scrambleSource === 'wca'}
                          showSpecialTypes
                          type={scramble222Type}
                          typeOptions={scrambleSource === 'random'
                            ? SCRAMBLE_222_TYPES
                            : WCA_SCRAMBLE_222_TYPES}
                        />
                      ) : undefined}
                      labels={byStepsLabels}
                      onChange={updateByStepsSettings}
                      settings={byStepsSettings}
                      source={scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)
                        ? 'wca'
                        : 'random'}
                    />
                  </fieldset>
                )}
                {scrambleSource === 'manual' && (
                  <fieldset
                    className="mobile-scramble-source-config"
                    disabled={!sourceControlsEnabled}
                  >
                    <ManualScrambleQueueEditor
                      ariaLabel={copy.manualScrambles}
                      placeholder={TIMER_MANUAL_SCRAMBLE_EMPTY_COPY[language]}
                      onChange={updateManualScrambles}
                      value={manualScrambles}
                    />
                  </fieldset>
                )}
                  </>}
              statistics={
                <TimerStatRail
                  disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                  language={language}
                  summary={stats}
                  onClick={() => setView('history')}
                />
              }
              devices={smartCubeDeviceCenter}
            >
              <TimingSurface
                digitsCorner={solves.length > 0 && <TimerRankBadge eventId={activeEvent} centis={rankCentis} type="single" country={rankCountry} isZh={language === 'zh'} scopes={store!.settings.rankScopes} wcaId={rankWcaId} host={timerRankHost} />}
                className={targetFeedbackClass}
                ariaLabel={copy.timer}
                colorClass={`${timerColorClass} tf-${store!.settings.timerFont}`}
                fontScale={store!.settings.timerFontScale}
                cornerSlot={smartCube.phase === 'connected' ? (
                  <div className="timer-live-cube">
                    <LiveCubeState
                      algAnchored={smartCubeAnchor.algAnchored}
                      displayOrientation={trainingOrientation}
                      calibrateToken={smartCubeCalibration}
                      facelets={smartCube.facelets || null}
                      language={language}
                      mode={store!.settings.liveCubeView}
                      moves={[...smartCubeAnchor.moves]}
                      onViewChange={setSmartCubeRenderedView}
                      useGyro={store!.settings.gyroEnabled}
                      quatRef={store!.settings.gyroEnabled ? smartCubeQuatRef : undefined}
                    />
                  </div>
                ) : store!.settings.showCubePreview && scrambleReady && scramble.length > 0 ? (
                  <TimerCubePreview
                    ariaLabel={copy.cubeState}
                    event={activeEvent}
                    fill
                    scramble={applyOrientationPrefix(scramble, preScrambleFor(activeEvent, store!.settings.preScr, store!.settings.preScrT))}
                    visualization={store!.settings.prefer3D ? '3D' : '2D'}
                  />
                ) : undefined}
                digits={<SegmentTime text={timerText} />}
                layout="solo"
                interactive={scrambleReady}
                onContextMenu={(event) => event.preventDefault()}
                phase={timer.machine.phase}
                scrambleSlot={(
                  <TimerScrambleStrip compact={store!.settings.compactScramble}
                    font={store!.settings.scrambleFont}
                    fontScale={store!.settings.scrambleFontScale}
                    copiedLabel={copy.copied}
                    correctionActive={smartCubeGuidance.correctionActive}
                    fallback={scrambleText}
                    fallbackKind="empty"
                    match={smartCubeScrambleMatch}
                    hint={smartCubeGuidance.hint}
                    nonOptimal={currentReal?.nonOptimal ? {
                      label: TIMER_WCA_SCRAMBLE_SOURCE_COPY.nonOptimalLabel[language],
                      title: TIMER_WCA_SCRAMBLE_SOURCE_COPY.nonOptimalTitle[language],
                    } : undefined}
                    title={TIMER_SCRAMBLE_CLICK_TITLE_COPY[scrambleClickEffect][language]}
                    scramble={scrambleReady && scramble.length > 0 ? scrambleText : ''}
                    status={scrambleStatus
                      ? scrambleStatus.retryable && currentScrambleEntry
                        ? {
                            kind: scrambleStatus.kind,
                            message: scrambleStatus.message[language],
                            onRetry: () => {
                              if (canSwitchScramble()) fillScrambleHistoryEntry(currentScrambleEntry);
                            },
                            retryLabel: TIMER_SCRAMBLE_CLICK_TITLE_COPY.retry[language],
                          }
                        : {
                            kind: scrambleStatus.kind,
                            message: scrambleStatus.message[language],
                          }
                      : undefined}
                    verificationLabels={{
                      copiedCorrection: copy.scrambleCorrectionCopied,
                      correction: copy.scrambleCorrection,
                      correctionTitle: copy.scrambleCorrectionTitle,
                      mismatch: copy.scrambleMismatch,
                      ready: copy.scrambleReady,
                    }}
                  >
                    {currentScrambleEntry?.trainerMeta && (
                      <TimerRandomDifficultyCaseBar
                        disabled={!sourceControlsEnabled}
                        depth={currentScrambleEntry.trainerMeta.depth}
                        language={language}
                        occurrenceKey={currentScrambleEntry.id}
                        solve={(signal) => solveMobileRandomDifficultyCase(
                          currentScrambleEntry.trainerMeta!.spec,
                          {
                            cp: [...currentScrambleEntry.trainerMeta!.state.cp],
                            co: [...currentScrambleEntry.trainerMeta!.state.co],
                            ep: [...currentScrambleEntry.trainerMeta!.state.ep],
                            eo: [...currentScrambleEntry.trainerMeta!.state.eo],
                          },
                          language === 'zh',
                          signal,
                        )}
                        spec={currentScrambleEntry.trainerMeta.spec}
                      />
                    )}
                    {currentReal && scrambleSource === 'wca' && (
                      <TimerWcaScrambleSource
                        competitionName={currentRealCompetition?.selectedDisplayName
                          ?? displayMobileWcaCompetitionName(
                            currentReal.competitionId,
                            currentReal.competitionName,
                            language,
                          )}
                        country={currentRealCompetition?.country}
                        eventLabel={timerEventPickerName(activeEvent, language)}
                        eventId={currentReal.eventId}
                        groupId={currentReal.groupId}
                        href={siteRouteUrl(
                          language,
                          `/scramble/gen?comp=${encodeURIComponent(currentReal.competitionId)}`,
                        )}
                        isExtra={currentReal.isExtra}
                        onNavigate={() => openToolsRoute(
                          `/scramble/gen?comp=${encodeURIComponent(currentReal.competitionId)}`,
                        )}
                        roundTypeId={currentReal.roundTypeId}
                        scrambleNumber={currentReal.scrambleNumber}
                        title={TIMER_WCA_SCRAMBLE_SOURCE_COPY.viewCompetition[language]}
                      >
                        <TimerWcaScrambleProgress
                          key={currentWcaMarkIdentity ?? 'wca-source-progress'}
                          allMarksHref={siteRouteUrl(language, '/timer/marks')}
                          labels={wcaProgressLabels}
                          language={language}
                          markCount={currentWcaMarks?.count}
                          marked={currentWcaMarked}
                          marks={currentWcaMarks?.marks.map((mark) => ({
                            country: mark.country || undefined,
                            dateLabel: new Date(mark.createdAt * 1_000).toISOString().slice(0, 10),
                            name: mark.name,
                            personHref: isWcaIdFormat(mark.wcaId)
                              ? siteRouteUrl(
                                language,
                                `/wca/persons/${encodeURIComponent(mark.wcaId)}`,
                              )
                              : undefined,
                            timeLabel: mark.timeCs == null ? undefined : formatMs(mark.timeCs * 10),
                            wcaId: mark.wcaId,
                          }))}
                          onNavigateAllMarks={() => openToolsRoute('/timer/marks')}
                          onNavigatePerson={(mark) => {
                            if (isWcaIdFormat(mark.wcaId)) openToolsRoute(
                              `/wca/persons/${encodeURIComponent(mark.wcaId)}`,
                            );
                          }}
                          onOpenChange={handleTimerOverlayOpenChange}
                          open={openOverlay === TIMER_OVERLAY_IDS.wcaScrambleMarks
                            && wcaMarksOverlayIdentityRef.current === currentWcaMarkIdentity}
                          progress={currentRealProgress ?? undefined}
                          viewportBottomInset={primaryNavBottomInset}
                        />
                      </TimerWcaScrambleSource>
                    )}
                  </TimerScrambleStrip>
                )}
                surfaceRef={surfaceRef}
              >
                <span aria-live="polite" className="sr-only">{timerInstruction}</span>
                {timer.machine.phase === 'running' && <TimerTargetTime targetMs={targetMs} displayMs={displayMs} localize={value => value[language]} />}
                {timer.machine.phase === 'running' && (multiStageActive || bldMemoActive) && (
                  <TimerAttemptSplitStatus
                    bldMemoActive={bldMemoActive}
                    localize={(value) => value[language]}
                    multiStageActive={multiStageActive}
                    onMarkMemo={() => attemptSplitRecorder.markMemo(timerDisplayMsRef.current)}
                    onMarkStage={(stage) => attemptSplitRecorder.markStage(stage, timerDisplayMsRef.current)}
                    precision={resultPrecision}
                    state={attemptSplitState}
                  />
                )}
              </TimingSurface>
              <div className="surface-chrome">
                <TimerGoalProgress solves={allSessionSolves} goal={trainingSettings.dailySolveGoal} localize={value => value[language]} />
                <TimerRoundPanel solves={trainingRound.solves} config={trainingSettings.round} targetMs={targetMs} event={activeEvent} precision={resultPrecision} onReset={trainingRound.start} localize={value => value[language]} />
              </div>
              {!wideLayout && solveRecap}

              {openOverlay === TIMER_OVERLAY_IDS.drillPicker && (
                <TimerDrillPicker
                  activeCase={effectiveDrillTarget}
                  initialType={activeEvent === 'pll' ? 'pll' : 'oll'}
                  language={language}
                  onClose={() => {
                    openOverlayRef.current = null;
                    setOpenOverlay(null);
                  }}
                  onExit={() => setDrillTarget(null)}
                  onPick={(target) => setDrillTarget(target)}
                />
              )}
              {activeEvent === '333' && <div className="mobile-solution-hints surface-chrome" data-no-timer>
                <button type="button" className="timer-small-hints-trigger"
                  disabled={timer.machine.phase === 'running' || timer.machine.phase === 'inspecting'}
                  onClick={() => {
                    openOverlayRef.current = TIMER_OVERLAY_IDS.stageSolver;
                    setOpenOverlay(TIMER_OVERLAY_IDS.stageSolver);
                  }}>
                  {({ zh: '解法', en: 'Solve' })[language]}
                </button>
                {openOverlay === TIMER_OVERLAY_IDS.stageSolver && <Suspense fallback={null}>
                  <StageSolverDialog scramble={scramble} language={language} onDismissChange={registerSolverDismiss}
                    onPrevScramble={previousDisplayedScramble} onNextScramble={nextDisplayedScramble}
                    onClose={() => {
                    openOverlayRef.current = null;
                    setOpenOverlay(null);
                  }} />
                </Suspense>}
              </div>}
              <MobileSmallPuzzleHints
                event={activeEvent}
                language={language}
                phase={timer.machine.phase}
                scramble={scramble}
              />
            </TimerStageLayout>
          </section>
        )}

        {view === 'timer' && typeof timerMode === 'number' && timerMode >= 2 && (
          <LocalBattleMode
            scrambleProvider={battleScrambleProvider}
            onExportRounds={rounds => shareOrDownloadBackup(buildLocalBattleCsv(rounds, [], timerMode as number), {
              filename: `local-battle_${new Date().toISOString().slice(0, 10)}.csv`, mime: 'text/csv;charset=utf-8',
            })}
            sourceSettings={event => <TimerBattleSourceSettings language={language}
              value={scrambleSource === 'wca' ? 'wca' : 'random'} onChange={setScrambleSource}>
              <TimerWcaSourceConfig adapter={wcaSourceAdapter} labels={wcaSourceLabels}
                competitionDisplayName={(id, name) => displayMobileWcaCompetitionName(id, name, language)}
                settings={battleSourceSettings} onChange={patch => updateSettings(patch)}
                minDate={TIMER_WCA_MIN_DATE} maxDate={toLocalIsoDate()} wcaEventId={timerWcaScrambleEventId(event)}
                roundLabel={timerWcaRoundShortLabel} renderCountry={country => <Flag iso2={country} />}
                renderDateRange={props => <DateRangeInput {...props} labels={dateRangeLabels} size="compact" />} />
            </TimerBattleSourceSettings>}
            renderSource={row => row.wca && <TimerWcaScrambleSource eventLabel={row.wca.e} title={copy.competition}
              competitionName={displayMobileWcaCompetitionName(row.wca.ci, row.wca.cn, language)}
              eventId={row.wca.e} groupId={row.wca.g} roundTypeId={row.wca.r} scrambleNumber={row.wca.n}
              isExtra={row.wca.x === 1} href={`${SITE_ORIGIN}${language === 'zh' ? '/zh' : ''}/scramble/gen?comp=${encodeURIComponent(row.wca.ci)}`} />}
            onSettingsChange={updateSettings}
            onOverlayCloseChange={onBattleOverlayCloseChange}
            copy={copy}
            eventGroups={eventPickerGroups}
            hideTime={hideRunningTime}
            holdMs={store!.settings.holdMs}
            inspectionSec={store!.settings.inspectionSec}
            language={language}
            deviceControls={smartCubeDeviceCenter}
            inputBlocked={timerOverlayBlocking}
            onActivityChange={setBattleModeActive}
            onModeChange={(mode) => {
              timerModeRef.current = mode;
              setTimerMode(mode);
            }}
            onSmartCubeHandlersChange={setBattleSmartCubeHandlers}
            playerCount={timerMode as 2 | 3 | 4}
            typographySettings={store!.settings}
            scramblePreviewSettings={store!.settings}
            precision={resultPrecision}
            runningPrecision={runningPrecision}
            smartCube={smartCube}
          />
        )}

        {view === 'timer' && timerMode === 'net' && (
          <NetBattleMode
            sessionId={store!.database.activeSessionId}
            recordGyro={store!.settings.recordGyro}
            recordingOutbox={netRecordingOutbox}
            onRecordSolve={async ({ context, solve }) => {
              const revision = storeSnapshotGateRef.current.beginMutation();
              await netRecordingOutbox.enqueue({ context, solve }, true);
              const data = await repository.load();
              storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
            }}
            renderRecordedSolve={({ solve }) => solve.moves?.length ? (
              <Suspense fallback={<Spinner label={{ en: 'Loading', zh: '加载中' }[language]} />}>
                <ReconstructReport solve={solve} history={solves} host={reconstructionHost} isZh={language === 'zh'} />
              </Suspense>
            ) : null}
            onOverlayCloseChange={onBattleOverlayCloseChange}
            accountIdentity={auth.session ? {
              name: auth.session.user.name || `#${auth.session.user.uid}`,
              wcaId: auth.session.user.wcaId || undefined,
            } : undefined}
            capability={host.netBattle}
            copy={copy}
            eventGroups={eventPickerGroups}
            hideTime={hideRunningTime}
            holdMs={store!.settings.holdMs}
            inspectionSec={store!.settings.inspectionSec}
            language={language}
            deviceControls={smartCubeDeviceCenter}
            inputBlocked={timerOverlayBlocking}
            onActivityChange={setBattleModeActive}
            onModeChange={(mode) => {
              timerModeRef.current = mode;
              setTimerMode(mode);
            }}
            onSmartCubeHandlersChange={setBattleSmartCubeHandlers}
            precision={resultPrecision}
            runningPrecision={runningPrecision}
            typographySettings={store!.settings}
            scramblePreviewSettings={store!.settings}
            smartCube={smartCube}
            writeClipboardText={host.writeClipboardText}
          />
        )}

        {MOBILE_EMBED_SURFACES.map((surface) => {
          if (!openedWebViews[surface]) return null;
          const status = webSurfaceStatus[surface];
          const title = surface === 'tools' ? copy.tools : copy.my;
          const canonicalUrl = surface === 'tools' ? toolsWebUrl : accountWebUrl;
          const frameUrl = webSurfaceReloadUrl[surface] ?? canonicalUrl;
          const showState = connection !== 'online' || status !== 'ready';
          const stateLabel = connection === 'offline'
            ? copy.offline
            : status === 'error' ? copy.actionFailed : copy.checking;
          return (
            <section
              aria-label={title}
              className="web-surface"
              hidden={view !== surface}
              key={surface}
            >
              {showState && (
                <div className="web-surface-state" role={status === 'error' ? 'alert' : 'status'}>
                  <p>{stateLabel}</p>
                  {status === 'error' && connection === 'online' && (
                    <div className="action-row">
                      <button
                        className="primary-action"
                        onClick={() => retryWebSurface(surface)}
                        type="button"
                      >{copy.retry}</button>
                      <button
                        className="secondary-action"
                        onClick={() => void host.openExternal(frameUrl).catch(() => announce(copy.actionFailed))}
                        type="button"
                      >{copy.openFullSite}</button>
                    </div>
                  )}
                </div>
              )}
              <iframe
                allow="clipboard-write; fullscreen"
                aria-hidden={showState}
                key={`${surface}-${webSurfaceRevision[surface]}`}
                name={MOBILE_EMBED_FRAME_NAMES[surface]}
                onLoad={() => {
                  webBridgeReadyRef.current[surface] = false;
                  if (connection === 'offline') {
                    webSurfaceLoadedRef.current[surface] = false;
                    return;
                  }
                  if (surface === 'account') {
                    clearAccountSyncTimeout();
                    accountSyncInFlightRef.current = null;
                  }
                  markWebSurfaceLoaded(surface);
                  beginWebSurfaceHandshake(surface);
                }}
                onError={() => {
                  if (connection !== 'online') return;
                  clearWebSurfaceHandshake(surface);
                  webBridgeReadyRef.current[surface] = false;
                  webSurfaceLoadedRef.current[surface] = false;
                  setWebSurfaceStatus((current) => ({ ...current, [surface]: 'error' }));
                }}
                ref={(frame) => {
                  webFrameRefs.current[surface] = frame;
                }}
                referrerPolicy="strict-origin-when-cross-origin"
                src={frameUrl}
                tabIndex={showState ? -1 : undefined}
                title={title}
              />
            </section>
          );
        })}

        {view === 'history' && (
          <section className="history-view timer-workspace-panel" aria-labelledby="history-title" data-no-timer>
            {dockHistory && viewHeader}
            <div className="timer-workspace-panel-body">
            <header className="section-heading">
              <h1 id="history-title">{copy.history}</h1>
              <span>{solves.length}</span>
            </header>
            <TimerSessionSwitcher
              activeSessionId={store!.database.activeSessionId}
              className="mobile-session-switcher"
              event={activeEvent}
              host={sessionHost}
              labels={sessionLabels}
              onOpenChange={handleTimerOverlayOpenChange}
              onOperationError={() => announce(copy.actionFailed)}
              open={openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher}
              sessions={store!.database.sessions}
              viewportBottomInset={primaryNavBottomInset}
            />
            <select aria-label={{en:'Results view',zh:'成绩视图'}[language]} value={historyTab} onChange={event => { historyWorkspaceRef.current?.dismiss(); setHistoryTab(event.target.value as typeof historyTab); }}>
              <option value="history">{{en:'History',zh:'历史'}[language]}</option><option value="stats">{{en:'Stats',zh:'统计'}[language]}</option><option value="chart">{{en:'Charts',zh:'图表'}[language]}</option>
            </select>
            {historyTab !== 'history' && <TimerStatisticsWorkspace view={historyTab} language={language} event={activeEvent} solves={solves}
              labels={timerStatsPanelLabels(language)} rollingColumns={store!.settings.statsRollingColumns}
              onRollingColumnsChange={statsRollingColumns => updateSettings({statsRollingColumns})}
              sessionData={store!.database.sessions.map(session => ({session,byEvent:store!.database.dataBySession[session.id] ?? {}}))}
              activeSessionId={store!.database.activeSessionId} onOpenFull={() => setStatsOpen(true)} viewportBottomInset={primaryNavBottomInset} />}
            <div hidden={historyTab !== 'history'}>
            <TimerHistoryWorkspace onBlockingChange={setHistoryModalOpen} quickMenuOpen={openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu} onQuickMenuOpenChange={handleTimerOverlayOpenChange} ref={historyWorkspaceRef} historyContextKey={historyContext} solves={solves} isZh={language === 'zh'}
              dateRangeLabels={dateRangeLabels} rollingPickerLabels={rollingPickerLabels}
              rollingStatColumns={store!.settings.statsRollingColumns}
              onRollingColumnsChange={statsRollingColumns => updateSettings({statsRollingColumns})}
              viewportBottomInset={primaryNavBottomInset}
              onRowClick={solve => openHistorySolveDetail(solve)}
              onQuickComment={solve => openHistorySolveDetail(solve, true)}
              onQuickPenalty={(id, penalty) => { const solve = solves.find(item => item.id === id); if (solve) updateSolve(solve, {penalty}); }}
              onQuickDelete={id => { const solve = solves.find(item => item.id === id); if (solve) quickDeleteSolve(solve); }}
              onCopyText={text => host.writeClipboardText(text)}
              onBulkDelete={async ids => {
                try { await commitSessionMutation(() => repository.deleteSolves(store!.database.activeSessionId, activeEvent, ids)); return true; }
                catch { announce(copy.actionFailed); return false; }
              }}
            />
            </div>
            {statsOpen && <TimerStatsModal key={historyContext} event={activeEvent} solves={solves} isZh={language === 'zh'} onClose={() => setStatsOpen(false)} onCopyText={text => host.writeClipboardText(text)} />}
            {openOverlay === TIMER_OVERLAY_IDS.solveDetail
              && historyDetailSolve
              && historyDetailIndex >= 0 && (
              <TimerSolveDetailModal
                autoFocusComment={historyDetail?.autoFocusComment}
                index={historyDetailIndex}
                key={historyDetailSolve.id}
                localize={(text) => text[language]}
                moveTargets={historyMoveTargets}
                onChangeComment={(comment) => updateSolve(historyDetailSolve, { comment })}
                onChangePenalty={(penalty) => updateSolve(historyDetailSolve, { penalty })}
                onClose={() => closeHistorySolveDetail()}
                onDelete={() => {
                  void deleteSolveNow(historyDetailSolve).then((committed) => {
                    if (committed) closeHistorySolveDetail(historyDetail);
                  });
                }}
                onMoveToSession={(targetSessionId) => {
                  void moveSolveToSession(historyDetailSolve, targetSessionId).then((moved) => {
                    if (moved) closeHistorySolveDetail(historyDetail);
                  });
                }}
                preview={(
                  <TimerCubePreview
                    ariaLabel={copy.cubeState}
                    event={historyDetailSolve.event}
                    scramble={historyDetailSolve.scramble}
                  />
                )}
                solve={historyDetailSolve}
                report={historyDetailSolve.moves?.length ? (
                  <Suspense fallback={<Spinner label={{ en: 'Loading', zh: '加载中' }[language]} />}>
                    <ReconstructReport
                      hideDate
                      history={solves}
                      host={reconstructionHost}
                      isZh={language === 'zh'}
                      onReconFeedback={(reconOk) => updateSolve(historyDetailSolve, { reconOk })}
                      onUseScramble={useReconstructionScramble}
                      solve={historyDetailSolve}
                    />
                  </Suspense>
                ) : undefined}
              />
            )}
            </div>
          </section>
        )}

        {view === 'settings' && (
          <TimerSettingsPanel language={language} activeCategory={settingsCategory}
            onCategoryChange={setSettingsCategory} onClose={() => setView('timer')}
            categories={[
              'timer', 'smart-cube', 'scramble', 'training', 'appearance', 'sound', 'data', 'advanced',
            ]}>
            {settingsCategory === 'appearance' && <>
            <div className="settings-group">
              <label className="settings-row">
                <span className="settings-row-label">{copy.language}</span>
                <select className="settings-row-control-select"
                  onChange={(event) => updateSettings({ language: event.target.value as SupportedLanguage })}
                  value={store!.settings.language}
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </select>
              </label>
              <label className="settings-row">
                <span className="settings-row-label">{copy.theme}</span>
                <select className="settings-row-control-select"
                  onChange={(event) => updateSettings({ theme: event.target.value as TimerStoreSettings['theme'] })}
                  value={store!.settings.theme}
                >
                  <option value="system">{copy.system}</option>
                  <option value="light">{copy.light}</option>
                  <option value="dark">{copy.dark}</option>
                </select>
              </label>
            </div>

            <TimerRankSettings language={language} scopes={store!.settings.rankScopes} country={store!.settings.rankCountry} accountCountry={rankAccountCountry} onScopes={rankScopes => updateSettings({ rankScopes })} onCountry={rankCountry => updateSettings({ rankCountry })} login={!activeAuthSession ? () => void auth.login() : undefined} />
            <TimerTypographySettings value={store!.settings} language={language} onChange={updateSettings} />

            </>}
            <TimerTimingSettingsSections active={settingsCategory === 'timer'}
              localize={(value) => value[language]}
              onChange={updateSettings}
              renderBooleanControl={({ disabled, label, onChange, value }) => (
                <TimerPillToggle
                  ariaLabel={label}
                  disabled={disabled}
                  onChange={onChange}
                  value={value}
                />
              )}
              value={store!.settings}
            />

            {settingsCategory === 'smart-cube' && <>
            <section className="settings-section">
              <h2>{TIMER_SETTING_CATEGORY_CONTRACTS.find((category) => category.id === 'smart-cube')?.label[language]}</h2>
              <TimerSmartCubeSettingsFields
                localize={(value) => value[language]}
                onChange={updateSettings}
                renderBooleanControl={({ disabled, label, onChange, value }) => (
                  <TimerPillToggle ariaLabel={label} disabled={disabled} onChange={onChange} value={value} />
                )}
                value={store!.settings}
              />
              <TimerPreScrambleSettings only="training" value={store!.settings} onChange={updateSettings} localize={value => value[language]} />
            </section>

            </>}
            {settingsCategory === 'scramble' && (activeEvent !== '222' || scrambleSource === 'wca') && (
              <section className="settings-section">
                <h2>{TIMER_SETTING_CATEGORY_CONTRACTS.find((category) => (
                  category.id === 'scramble'
                ))?.label[language]}</h2>
                {activeEvent !== '222' && (
                  <TimerBooleanSettingRow
                    disabled={!optimalAvailable}
                    field={timerSettingFieldContract('settings.scramble.optimal')}
                    hint={scrambleSource === 'random'
                      && activeEvent === '333'
                      && !activeAuthSession
                      && !auth.loading
                      && !auth.busy
                      ? copy.optimalSignInHint
                      : undefined}
                    label={copy.optimalScramble}
                    onChange={(wcaUseOptimal) => updateWcaSourceSettings({ wcaUseOptimal })}
                    renderBooleanControl={({ disabled, label, onChange, value }) => (
                      <TimerPillToggle
                        ariaLabel={label}
                        disabled={disabled}
                        onChange={onChange}
                        value={value}
                      />
                    )}
                    value={optimalAvailable && wcaSourceSettings.wcaUseOptimal}
                  />
                )}
                {scrambleSource === 'wca' && (
                  <TimerBooleanSettingRow
                    field={timerSettingFieldContract('settings.scramble.auto-mark-wca')}
                    hint={copy.autoMarkWcaHint}
                    label={timerSettingFieldContract(
                      'settings.scramble.auto-mark-wca'
                    ).copy[language]}
                    onChange={(autoMarkWcaScramble) => updateSettings({ autoMarkWcaScramble })}
                    renderBooleanControl={({ disabled, label, onChange, value }) => (
                      <TimerPillToggle
                        ariaLabel={label}
                        disabled={disabled}
                        onChange={onChange}
                        value={value}
                      />
                    )}
                    value={store!.settings.autoMarkWcaScramble}
                  />
                )}
              </section>
            )}

            {settingsCategory === 'training' && (
              <section className="settings-section">
                <h2>{TIMER_SETTING_CATEGORY_CONTRACTS.find((category) => (
                  category.id === 'training'
                ))?.label[language]}</h2>
                <TimerAttemptSplitSettings
                  bldVisible={isBldEvent(activeEvent)}
                  localize={(value) => value[language]}
                  onChange={updateSettings}
                  renderBooleanControl={({ label, onChange, value }) => (
                    <TimerPillToggle
                      ariaLabel={label}
                      onChange={onChange}
                      value={value}
                    />
                  )}
                  stageVisible={timerSupportsStageSplits(activeEvent)}
                  value={store!.settings}
                />
                <TimerGoalSettings value={store!.settings} event={activeEvent} onChange={updateSettings} localize={value => value[language]} />
              </section>
            )}

            {settingsCategory === 'scramble' && <TimerPreScrambleSettings only="normal" value={store!.settings} onChange={updateSettings} localize={value => value[language]} />}
            {settingsCategory === 'scramble' && <TimerColorNeutralSetting event={activeEvent} value={store!.settings.cnMode} onChange={cnMode => updateSettings({ cnMode })} localize={value => value[language]} />}
            {settingsCategory === 'training' && <TimerRoundSettings value={store!.settings} onChange={patch => updateSettings(current => ({ round: { ...current.round, ...patch } }))} localize={value => value[language]} />}

            {settingsCategory === 'appearance' && <>
            <section className="settings-section">
              <h2>{TIMER_SETTING_CATEGORY_CONTRACTS.find((category) => (
                category.id === 'appearance'
              ))?.label[language]}</h2>
              <TimerDisplaySettings value={store!.settings} onChange={updateSettings} localize={value => value[language]} renderBooleanControl={({ disabled, label, onChange, value }) => (<TimerPillToggle value={value} onChange={onChange} disabled={disabled} ariaLabel={label} />)}>
              <TimerScramblePreviewSettings
                localize={(value) => value[language]}
                onChange={updateSettings}
                renderBooleanControl={({ disabled, label, onChange, value }) => (
                  <TimerPillToggle
                    ariaLabel={label}
                    disabled={disabled}
                    onChange={onChange}
                    value={value}
                  />
                )}
                value={store!.settings}
              />
              </TimerDisplaySettings>
            </section>

            </>}
            {settingsCategory === 'sound' && <TimerSoundSettings value={store!.settings} onChange={updateSettings} localize={value => value[language]} voiceAvailable={timerSound.isVoiceAvailable()} onWarmup={timerSound.warmupSound} onPreview={() => timerSound.play('start')} />}
            {settingsCategory === 'sound' && <TimerMetronomeSettings value={store!.settings} bpm={store!.settings.metronomeBpm} onChange={updateSettings} onBpmChange={metronomeBpm => updateSettings({ metronomeBpm })} onTap={metronome.tapTempo} onWarmup={timerSound.warmupSound} onPreviewBeep={timerSound.playInspectionBeep} localize={value => value[language]} />}
            {settingsCategory === 'training' && (activeEvent === 'oll' || activeEvent === 'pll') && <button type="button" className="hint-btn" disabled={!sourceControlsEnabled} onClick={() => setTrainerSubsetOpen(activeEvent)}>{{ en: 'Pick training subset', zh: '选择训练子集' }[language]}</button>}
            {trainerSubsetOpen && <TimerTrainerSubsetModal kind={trainerSubsetOpen} language={language} value={store!.settings[trainerSubsetOpen === 'oll' ? 'ollSubset' : 'pllSubset']} onClose={() => setTrainerSubsetOpen(null)} onSave={value => updateSettings(trainerSubsetOpen === 'oll' ? { ollSubset: value } : { pllSubset: value })} />}
            {settingsCategory === 'advanced' && <TimerSyncSeedSettings value={store!.settings} language={language} disabled={!sourceControlsEnabled} onReset={seed => updateSettings(current => resetTimerSyncSeed(current, seed))} />}
            {settingsCategory === 'advanced' && <TimerKeymapSettings value={store!.settings.keymap} onChange={update => updateSettings(current => ({ keymap: update(current.keymap) }))} localize={value => value[language]} />}
            {settingsCategory === 'advanced' && <TimerResetSettings disabled={!sourceControlsEnabled} onReset={resetSettingsToDefaults} confirmReset={message => window.confirm(message)} localize={value => value[language]} />}
            {settingsCategory === 'advanced' && <>
            <div className="settings-section">
              <h2>{copy.account}</h2>
              {auth.loading ? <p>{copy.checking}</p> : auth.session ? (
                <>
                  <p>
                    {copy.signedInAs}: <strong>{auth.session.user.name || `#${auth.session.user.uid}`}</strong>
                    {auth.session.user.wcaId ? ` · ${auth.session.user.wcaId}` : ''}
                  </p>
                  <p>{copy.localDataNotSynced}</p>
                  <div className="action-row">
                    <a
                      className="site-link"
                      href={accountUrl(language)}
                      onClick={openExternal}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {copy.manageAccount}<span aria-hidden="true">↗</span>
                    </a>
                    <a
                      className="site-link"
                      href={accountUrl(language, 'delete')}
                      onClick={openExternal}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {copy.deleteAccount}<span aria-hidden="true">↗</span>
                    </a>
                    <button
                      className="secondary-action"
                      disabled={auth.busy}
                      onClick={() => void logoutEverywhere()}
                      type="button"
                    >{copy.signOut}</button>
                  </div>
                </>
              ) : (
                <>
                  <p>{copy.accountDetail}</p>
                  <button
                    className="primary-action"
                    disabled={auth.busy}
                    onClick={() => void auth.login()}
                    type="button"
                  >{auth.busy ? copy.signingIn : copy.signIn}</button>
                </>
              )}
              {auth.error ? <p role="alert">{copy.authError}</p> : null}
            </div>

            </>}
            {settingsCategory === 'data' && <>
            <div className="settings-section">
              <h2>{copy.data}</h2>
              <p>{solves.length} {copy.dataCount}</p>
              <div className="action-row">
                {canUndoImport && (
                  <button className="secondary-action" onClick={undoImport} type="button">{copy.undoImport}</button>
                )}
              </div>
              <TimerBackupSettings language={language} every={store!.settings.autoBackupEvery} onEveryChange={autoBackupEvery => updateSettings({ autoBackupEvery })}
                disabled={!sourceControlsEnabled} owner={activeAuthSession?.token ?? null} login={() => void auth.login()}
                local={{ create: () => repository.createBackup(), list: () => repository.listBackups(), restore: (key, canCommit) => restoreDatabaseBackup(() => repository.restoreBackup(key, () => canCommit() && canCommitSettingsData())) }}
                cloud={{ meta: () => backupClient.meta(), upload: async () => {
                  const token = activeAuthSession?.token;
                  const data = await repository.load();
                  if (!token || token !== backupTokenRef.current) throw new Error('Account changed');
                  return backupClient.upload(JSON.stringify(data.database));
                }, restore: async canCommit => {
                  const token = activeAuthSession?.token;
                  const data = await backupClient.download();
                  if (!token || token !== backupTokenRef.current) throw new Error('Account changed');
                  if (!data) return false;
                  await restoreDatabaseBackup(() => repository.importJson(data.blob, () => canCommit() && canCommitSettingsData() && token === backupTokenRef.current));
                  return true;
                } }} />
              <TimerImportSettings language={language} disabled={!sourceControlsEnabled} importSessions={async (sessions, canCommit) => {
                await commitSessionMutation(() => repository.importSessions(sessions, () => canCommit() && canCommitSettingsData()));
              }} importBackup={async (text, canCommit) => {
                const preview = await repository.previewImport(text);
                if (!window.confirm(copy.importConfirm(preview.incoming.solveCount, preview.current.solveCount))) return false;
                if (!beginTimerContextMutation()) throw new Error('Timer busy');
                timer.cancelArm();
                const revision = storeSnapshotGateRef.current.beginMutation();
                try {
                  const data = await repository.importJson(text, () => canCommit() && canCommitSettingsData());
                  commitImportedStore(revision, data);
                  setCanUndoImport(await repository.hasImportRecovery());
                  return true;
                } finally { endTimerContextMutation(); }
              }} />
              <TimerReanalyzeSettings language={language} disabled={!sourceControlsEnabled} run={async () => {
                const revision = storeSnapshotGateRef.current.beginMutation();
                const result = await repository.reanalyze(store!.database.activeSessionId);
                storeSnapshotGateRef.current.commitIfLatest(revision, result.data, applyStoreSnapshot);
                return result;
              }} />
              <TimerExportSettings onExport={exportFormat} localize={value => value[language]} />
            </div>

            </>}
            {settingsCategory === 'advanced' && <>
            <div className="settings-section">
              <h2>{copy.fullSite}</h2>
              <p>{copy.fullSiteDetail}</p>
              <a className="site-link" href={siteUrl(language)} onClick={openExternal} rel="noreferrer" target="_blank">
                {copy.openFullSite}<span aria-hidden="true">↗</span>
              </a>
            </div>

            <div className="settings-section settings-meta">
              <a className="site-link" href={privacyUrl(language)} onClick={openExternal} rel="noreferrer" target="_blank">
                {copy.privacy}<span aria-hidden="true">↗</span>
              </a>
              <a className="site-link" href="mailto:yrmfxc@gmail.com">{copy.support}</a>
              <span>{copy.version} {host.version}</span>
            </div>
            </>}
          </TimerSettingsPanel>
        )}
      </TimerWorkspace>

      {replayImportOpen && <TimerReplayImportModal language={language} onClose={() => setReplayImportOpen(false)}
        load={(input, signal) => readTimerReplay(input, Object.values(store!.database.dataBySession[store!.database.activeSessionId] ?? {}).flat(), { apiUrl: mobileApiUrl, fetcher: fetch }, signal)}
        onOpen={setReplaySolve} />}
      {replaySolve && <Suspense fallback={null}><ReconstructModal solve={replaySolve} history={store!.database.dataBySession[store!.database.activeSessionId]?.[replaySolve.event] ?? []}
        host={reconstructionHost} isZh={language === 'zh'} onUseScramble={useReconstructionScramble}
        onReconFeedback={reconOk => setReplaySolve(current => current ? { ...current, reconOk } : null)} onClose={() => setReplaySolve(null)} /></Suspense>}
      {openOverlay === TIMER_OVERLAY_IDS.smartCubeDevice && (
        <TimerSmartCubeDeviceModal
          availableDevices={smartCube.availableDevices}
          macPrompt={smartCube.macPrompt ?? undefined}
          capabilities={{
            ...timerDeviceRegistry.get('smart-cube')?.capabilities,
            gyro: Boolean(smartCube.quaternion),
            scan: Boolean(smartCube.scanDevices),
          }}
          connectionFailure={smartCube.phase === 'error'
            ? <p className="timer-smart-cube-device__failure">{smartCube.error || copy.smartCubeError}</p>
            : undefined}
          language={language}
          onClose={closeSmartCubeDevice}
          onConnect={connectSmartCube}
          onDisconnect={disconnectSmartCube}
          onResetGyro={smartCube.quaternion ? () => setSmartCubeCalibration((value) => value + 1) : undefined}
          onResetState={smartCube.resetState ? resetSmartCubeState : undefined}
          onScan={smartCube.scanDevices ? scanSmartCubes : undefined}
          scanning={smartCube.scanning}
          snapshot={{
            battery: smartCube.status?.battery,
            deviceName: smartCube.deviceName,
            hasGyro: Boolean(smartCube.quaternion),
            lastMove: smartCube.lastMove,
            phase: smartCube.phase,
            protocol: smartCube.status?.protocol ?? smartCube.model,
            solved: smartCube.solved,
          }}
        />
      )}

      {openOverlay === TIMER_OVERLAY_IDS.smartTimerDevice && <BluetoothTimerModal
        localize={value => value[language]} compact={!wideLayout}
        devices={external.devices} onSelectDevice={external.selectDevice}
        timer={{...external.timer, connect: connectExternalTimer}} macPrompt={external.macPrompt}
        connectAttempt={externalConnectAttempt?.kind === 'smart-timer' ? externalConnectAttempt.promise : null}
        onSubmitMac={external.resolveMac} onCancelMac={() => external.timer.disconnect()}
        onClose={closeExternalDevice}
      />}
      {openOverlay === TIMER_OVERLAY_IDS.stackmatDevice && <StackmatModal
        localize={value => value[language]} compact={!wideLayout}
        stackmat={{...external.stackmat, start: startStackmat}} onClose={closeExternalDevice}
        connectAttempt={externalConnectAttempt?.kind === 'stackmat' ? externalConnectAttempt.promise : null}
      />}

      <nav data-timer-hide-while-running className="primary-nav" aria-label={copy.title} ref={primaryNavRef}>
        <button
          aria-current={view === 'timer' || view === 'history' || view === 'settings' ? 'page' : undefined}
          data-no-timer
          disabled={timerContextMutationBusy}
          onClick={() => selectPrimaryView('timer')}
          type="button"
        >
          <Clock3 aria-hidden="true" size={20} />
          <span>{copy.timer}</span>
        </button>
        <button
          aria-current={view === 'tools' ? 'page' : undefined}
          data-no-timer
          disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
          onClick={() => selectPrimaryView('tools')}
          type="button"
        >
          <Grid2X2 aria-hidden="true" size={20} />
          <span>{copy.tools}</span>
        </button>
        <button
          aria-current={view === 'account' ? 'page' : undefined}
          data-no-timer
          disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
          onClick={() => selectPrimaryView('account')}
          type="button"
        >
          <UserRound aria-hidden="true" size={20} />
          <span>{copy.my}</span>
        </button>
      </nav>

      {manualEntryOpen && (
        <TimerManualEntryModal
          currentScramble={scramble}
          event={activeEvent}
          labels={manualEntryLabels}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={addManualSolve}
        />
      )}

      <GestureWheel ref={gestureWheelRef} isZh={language === 'zh'} />

      {pendingSolves.length > 0 ? (
        <TimerInfoToast
          durationMs={null}
          actionBusy={retryingPendingSolve}
          actionDisabled={retryingPendingSolve}
          message={copy.saveFailed(pendingSolves.length)}
          onDismiss={() => undefined}
          onUndo={retryPendingSolve}
          undoLabel={copy.retry}
          viewportBottomInset={primaryNavBottomInset}
        />
      ) : undoToast && (
        <TimerInfoToast
          message={undoToast.message}
          onDismiss={() => setUndoToast(null)}
          onUndo={undoToast.undo}
          undoLabel={copy.undo}
          viewportBottomInset={primaryNavBottomInset}
        />
      )}

      <p aria-live="polite" className="toast">{toast}</p>
    <TimerNetOutboxNotice outbox={netRecordingOutbox} language={language} viewportBottomInset={primaryNavBottomInset} suppressed={pendingSolves.length > 0 || Boolean(undoToast)}
      onSaved={() => {
        const revision = storeSnapshotGateRef.current.beginMutation();
        void repository.load().then(data => storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot)).catch(() => announce(copy.actionFailed));
      }} />
    </main>
  );
}
