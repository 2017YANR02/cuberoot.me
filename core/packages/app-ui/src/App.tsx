import { AppearanceBackground, AppAppearanceSettings, runViewTransition, applyAppearancePreferences, persistAppearancePreferences, readAppearancePreferences } from './appearance';
import { resolveAppearanceScheme, type AppearancePreferences } from '@cuberoot/shared/appearance';
import { NotificationOpenQueue } from './notification-navigation';
import { TimerResultsSessionBar } from '@cuberoot/timer-ui';
import { AutoRecapDismissGesture } from '@cuberoot/shared/timer/reconstruct/recap';
import { useTimerLiveShare, TimerLiveShareSettings, TimerLiveShareStatus } from '@cuberoot/timer-ui/live-share';
import { captureTimerLiveAttempt, timerLiveHistory, timerLiveCompletedAttempt, timerLiveSolveDetail, type TimerLiveCompletion } from '@cuberoot/shared/timer/live-share';
import { applyOrientation } from '@cuberoot/shared/smart-cube/orientation';
import { timerTrainingSummaries } from '@cuberoot/timer-ui';
import { createPortal } from 'react-dom';
import { useTimerWcaCompetitionFilters, TimerPracticeContentPicker, TimerPracticeMethodPicker, TimerResultsTabs, TimerSoloLayoutEditor } from '@cuberoot/timer-ui';
import { timerPracticeContents, selectedTimerPracticeContent, type TimerPracticeContent } from '@cuberoot/shared/timer';
import { SiteCorners } from "@2017yanr02/continuous-corners/react";
import { shareOrDownloadBackup } from './file-export';
import { TimerSoloControls, TimerSoloPage, timerSoloModalState, useTimerSoloCompactLayout } from '@cuberoot/timer-ui/TimerSoloPage';
import { InstalledTimerVideoReview } from './InstalledTimerVideoReview';
import { InstalledBleHost, installedBleRequestPort } from './installed-ble-host';
import { pickInstalledBleDevice, type InstalledBlePicker } from './installed-ble-picker';
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
import { indexNetRecordedReplays, NetRecordingOutbox, uploadNetRecordedAttempt } from '@cuberoot/shared/timer';
import { createNetOutboxStorage, TimerNetOutboxNotice } from '@cuberoot/timer-ui';
import { BluetoothTimerModal, StackmatModal } from '@cuberoot/timer-ui/external';
import { useExternalDevices } from './hooks/use-external-devices';
import { installedContentUnavailable, isInstalledCommunityHref } from '@cuberoot/shared/installed-content';
import { useInstalledCommunityAvailability } from './hooks/use-installed-community-availability';
import { decodeAppleMembershipRequest } from '@cuberoot/shared/apple-membership';
import { decodeGoogleMembershipRequest } from '@cuberoot/shared/google-membership';
import { TimerPreScrambleSettings, TimerColorNeutralSetting, createTimerSound, useTimerSoundFeedback } from '@cuberoot/timer-ui';
import { normalizeTimerSoundSettings, resetTimerStoreSettings } from '@cuberoot/shared/timer';
import { TimerResetSettings } from '@cuberoot/timer-ui';
import { TimerExportSettings, type TimerExportFormat } from '@cuberoot/timer-ui';
import { exportTimerCstimerJson, exportTimerSolvesCsv, exportSpeedstacks } from '@cuberoot/shared/timer';
import { TimerSoundSettings, TimerMetronomeSettings } from '@cuberoot/timer-ui';
import { createMetronome } from '@cuberoot/timer-ui/metronome';
import { timerMetronomeActive } from '@cuberoot/shared/timer/metronome-settings';
import { applyOrientationPrefix, preScrambleFor, timerSmartCubeTrainingOrientation, timerSmartCubeAttemptScramble } from '@cuberoot/shared/timer';
import { timerHidesRunningUi } from '@cuberoot/shared/timer';
import { startWatchTimerSync } from './watch-timer-sync';
import type { TimerSettingsUpdate } from './data/timer-repository';
import { TimerKeymapSettings, useTimerRound, TimerGoalSettings, TimerRoundSettings, TimerGoalProgress, TimerRoundPanel, TimerTargetTime, useTimerTargetFeedback } from '@cuberoot/timer-ui';
import { normalizeTimerTrainingSettings, timerSupportsTrainingTiming } from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import {
  createTimerDeviceRegistry,
  TIMER_DEVICE_REGISTRATIONS,
} from '@cuberoot/shared/timer/device-contract';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { useLiveSmartCubeAttempt, TimerLiveSolutionPanel, TimerTrainingTimingStatus } from '@cuberoot/timer-ui';
import { sensorBasisForBrand, mirrorForBrand, type Quat } from '@cuberoot/shared/smart-cube/orientation';
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
  decodeMobileEmbedAppearance,
  decodeMobileEmbedAuthRequest,
  decodeMobileEmbedExternal,
  decodeMobileEmbedNavigation,
  decodeMobileEmbedSelectTab,
  decodeMobileEmbedOpenSettings,
  mobileEmbedAppearanceMessage,
  decodeMobileEmbedWebSessionResult,
  MOBILE_EMBED_FRAME_NAMES,
  MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES,
  mobileEmbedAuthClearMessage,
  mobileEmbedAccountManageResultMessage,
  mobileEmbedBackMessage,
  mobileEmbedInitMessage,
  mobileEmbedWebSessionMessage,
  type MobileEmbedSurface,
  type MobileEmbedChrome,
} from '@cuberoot/shared/mobile-embed';
import { MOBILE_AUTH_PROVIDERS } from '@cuberoot/shared/auth/web-session';
import { openInstalledAccountManagement } from './auth/account-management';
import { AccountBack, AccountHome, type AccountPage } from './auth/AccountHome';
import { decodeWebMembershipRequest } from '@cuberoot/shared/mobile-embed';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import {
  MAX_TIMER_BACKUP_BYTES,
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  DEFAULT_TIMER_TIMING_SETTINGS,
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
  isCnEligible,
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
  DEFAULT_TIMER_SCRAMBLE_SOURCE,
  TIMER_WCA_MIN_DATE,
  timerSupportsRealWcaScrambles,
  timerSupportsStageSplits,
  timerSupportsSmartCubeAutoTiming,
  TimerAttemptSplitRecorder,
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
  timerCubePreviewAspect,
  TimerDrillPicker,
  TimerManualEntryModal,
  TimerPillToggle,
  TimerPlayersSelect,
  TimerPuzzlePicker,
  TimerPrintController,
  TimerScramble222Config,
  TimerScrambleStrip,
  TimerWcaScrambleSource,
  TimerWcaScrambleProgress,
  TimerByStepsConfig,
  TimerScrambleSourceSelect,
  timerSessionSwitcherLabels,
  TimerStatRail,
  TimerBooleanSettingRow,
  TimerWorkspace,
  useTimerWideLayout,
  useHostViewportLayout,
  TimerSoloAppearanceSections,
  TimerSoloResultSettings,
  TimerSettingsPanel,
  TimerTimingSettingsSections,
  TimerWcaSourceConfig,
  TimerWcaDifficultyConfig,
  TimerRandomDifficultyConfig,
  TimerRandomDifficultyCaseBar,
  TIMER_OVERLAY_IDS,
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
  Video,
  Clock3,
  Grid2X2,
  Settings as SettingsIcon,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';

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
  createMobileWcaPool,
  realSpecToWcaSource,
  wcaRowToReal,
  isAllTimeRealScrambleDateSource,
  normalizeRealScrambleSourceSpec,
  realScrambleSourceKey,
  type RealScramble,
  type RealScrambleSourceSpec,
} from './data/real-scramble-pool';
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
import { NativeTimerManualEntry } from './NativeTimerManualEntry';
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
import { LoadingBrandMark } from './LoadingBrandMark';
import { installedWebEntryUrl } from './web-surface-url';
import { useDraggablePrimaryNavigation, usePrimaryNavigation, useTimerNavigationAvoidance } from './use-primary-navigation';
import { NavigationDragLens } from './NavigationDragLens';
import { PrimaryNavigationOptics } from './PrimaryNavigationOptics';
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

function isEmbeddedTopBarRoute(surface: MobileEmbedSurface, pathname: string) {
  const path = pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  return path === (surface === 'tools' ? '/' : '/account');
}
const MOBILE_EMBED_INIT_RETRY_MS = 400;
const MOBILE_EMBED_INIT_RETRIES = 25;
const MOBILE_EMBED_AUTH_TIMEOUT_MS = 10_000;
const TOOLS_PRELOAD_DELAY_MS = 250;
const repository = new TimerRepository(new IndexedDbTimerStoreDriver());
const netRecordingOutbox = new NetRecordingOutbox(({ context, solve }) => repository.saveNetSolve(context.sessionId, solve), createNetOutboxStorage());

function isAccountDetailsPage(page: AccountPage): page is Exclude<AccountPage, 'home' | 'sign-in' | 'recover-password'> {
  return page === 'security' || page === 'membership' || page === 'profile';
}

type AppView = 'timer' | 'tools' | 'account' | 'history' | 'settings' | 'appearance';
type PrimaryView = Extract<AppView, 'timer' | 'tools' | 'account'>;
type ConnectionState = 'checking' | 'offline' | 'online';
type WebSurfaceStatus = 'loading' | 'ready' | 'error';

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

function accountUrl(language: SupportedLanguage, view?: 'delete' | 'signin'): string {
  const path = language === 'zh' ? `${SITE_ORIGIN}/zh/account` : `${SITE_ORIGIN}/account`;
  return view ? `${path}?view=${view}` : path;
}

export function App({ host, loadingMark }: { host: InstalledAppHost; loadingMark?: ReactNode }) {
  const communityAvailability = useInstalledCommunityAvailability(host.generativeAiDisabled === true, SITE_ORIGIN);
  const communityAvailable = communityAvailability === true;
  const communityAvailableRef = useRef(communityAvailable);
  communityAvailableRef.current = communityAvailable;
  const [toolsBlePicker, setToolsBlePicker] = useState<InstalledBlePicker | null>(null);
  const toolsBlePickerRef = useRef(toolsBlePicker);
  toolsBlePickerRef.current = toolsBlePicker;
  const toolsBleRef = useRef<{ owner: InstalledBleHost; port: MessagePort } | null>(null);
  const toolsBleDrainRef = useRef<Promise<void>>(Promise.resolve());
  const toolsBleEpochRef = useRef(0);
  const revokeToolsBle = useCallback(() => {
    toolsBleEpochRef.current++;
    const current = toolsBleRef.current;
    toolsBleRef.current = null;
    if (current) {
      const draining = current.owner.dispose();
      current.port.close();
      toolsBleDrainRef.current = Promise.all([toolsBleDrainRef.current, draining]).then(() => {});
    }
    return toolsBleDrainRef.current;
  }, []);
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
  const [appearance, setAppearance] = useState<AppearancePreferences | null>(null);
  const appearanceRef = useRef(appearance);
  const accountInlineSettingsRef = useRef(false);
  const [accountFrameLocale, setAccountFrameLocale] = useState<SupportedLanguage | null>(null);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
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
  const [accountPage, setAccountPage] = useState<AccountPage>('home');
  const accountPageRef = useRef<AccountPage>('home');
  const [accountFramePage, setAccountFramePage] = useState<Exclude<AccountPage, 'home' | 'sign-in' | 'recover-password'>>('profile');
  const accountDetails = isAccountDetailsPage(accountPage);
  const [accountDetailsReady, setAccountDetailsReady] = useState(false);
  const appearanceReturnRef = useRef<Exclude<AppView, 'appearance'>>('account');
  const selectedView = view === 'appearance' ? appearanceReturnRef.current : view;
  const [settingsCategory, setSettingsCategory] = useState<TimerSettingCategoryId>('timer');
  const [timerMode, setTimerMode] = useState<TimerPlayersValue>(1);
  useEffect(() => {
    if (communityAvailability === false && timerMode === 'net') {
      setTimerMode(1);
      setBattleModeActive(false);
    }
  }, [communityAvailability, timerMode]);
  const wideLayout = useTimerWideLayout({ useHostContent: true });
  const hostViewport = useHostViewportLayout();
  const hinge = hostViewport?.hinge;
  const horizontalFold = Boolean(hinge && hinge.width > hinge.height);
  const [foldSolverPreferred, setFoldSolverPreferred] = useState(() => {
    try { return (localStorage.getItem('timer.fold.solverOpen') ?? localStorage.getItem('timer.solverHints.panelOpen')) !== '0'; }
    catch { return true; }
  });
  const selectFoldSolver = (open: boolean, nextView: 'timer' | 'history' = 'timer') => {
    setFoldSolverPreferred(open);
    try { localStorage.setItem('timer.fold.solverOpen', open ? '1' : '0'); } catch { /* Keep the choice for this visit. */ }
    setView(nextView);
  };
  const wideLayoutRef = useRef(wideLayout);
  const bluetoothButtonRef = useRef<HTMLButtonElement>(null);
  wideLayoutRef.current = wideLayout;
  const compactSoloLayout = useTimerSoloCompactLayout();
  const dockHistory = wideLayout && view === 'history' && timerMode === 1;
  const timerVisible = view === 'timer' || view === 'settings' || dockHistory;
  const upperPaneVisible = horizontalFold && timerMode === 1 && timerVisible;
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
  const sideNavigation = Boolean(hostViewport?.bar && viewportHeight - hostViewport.bar.y >= 148);
  const [primaryNavBottomInset, setPrimaryNavBottomInset] = useState(0);
  const primaryNavRef = useRef<HTMLElement>(null);
  const toolsSearchRef = useRef<HTMLButtonElement>(null);
  const [toolsSearchReady, setToolsSearchReady] = useState(false);
  const [toolsSearchOpen, setToolsSearchOpen] = useState(false);
  const [dockedKeyboardTop, setDockedKeyboardTop] = useState<number | null>(null);
  const [searchViewportTop, setSearchViewportTop] = useState(0);
  const floatingNavigation = Boolean(host.floatingNavigation || host.primaryNavigation);
  const labeledCapsule = host.floatingNavigation === 'labeled';
  const showNavigationLabels = labeledCapsule || (wideLayout && !floatingNavigation && !sideNavigation);
  const [webChrome, setWebChrome] = useState({ tools: false, account: false });
  const [nativeTopBars, setNativeTopBars] = useState({ tools: false, account: false });
  const nativeTopBar = hostViewport?.topBar;
  const embeddedTopBar = floatingNavigation && nativeTopBar && hostViewport && nativeTopBar.width >= 400
    && hostViewport.content.width <= 767
    ? {
      left: Math.max(0, nativeTopBar.x - hostViewport.content.x),
      right: Math.max(0, hostViewport.content.x + hostViewport.content.width - nativeTopBar.x - nativeTopBar.width),
    }
    : undefined;
  const embeddedChromeRef = useRef<MobileEmbedChrome | undefined>(undefined);
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [wcaDifficultyCoverage, setWcaDifficultyCoverage] = useState<TimerWcaDifficultyCoverage>('idle');
  const [wcaSourceSlot, setWcaSourceSlot] = useState<HTMLDivElement | null>(null);
  const [wcaTopControlsSlot, setWcaTopControlsSlot] = useState<HTMLSpanElement | null>(null);
  const [wcaDifficultyToggleSlot, setWcaDifficultyToggleSlot] = useState<HTMLSpanElement | null>(null);
  const [mobileWcaPool] = useState(createMobileWcaPool);
  const activeRealWaiterRef = useRef<{ cancel(): void } | null>(null);
  const [, refreshRealProgress] = useState(0);
  const wcaMarksCacheRef = useRef(new Map<string, TimerWcaScrambleMarksResponse>());
  const wcaMarksRequestsRef = useRef(new Map<string, Promise<TimerWcaScrambleMarksResponse>>());
  const [, refreshWcaMarks] = useState(0);
  const [scrambleSource, setScrambleSource] = useState<ScrambleSource>(DEFAULT_TIMER_SCRAMBLE_SOURCE);
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
    autoRecap: boolean;
    closeRequested?: boolean;
    context: string;
    solveId: string;
  } | null>(null);
  const autoRecapDismissGestureRef = useRef(new AutoRecapDismissGesture());
  const historyDetailRef = useRef(historyDetail);
  historyDetailRef.current = historyDetail;
  const closeDeviceOverlayRef = useRef<() => void>(() => {});
  const [openOverlay, setOpenOverlay] = useState<TimerOverlayId | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(fullscreen);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const historyWorkspaceRef = useRef<TimerHistoryWorkspaceHandle>(null);
  const [historyTab, setHistoryTab] = useState<'history' | 'stats'>('history');
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
  // The site's in-document back stack starts over after a full frame refresh.
  const desktopToolsHistory = useRef<string[]>([]);
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
  const [solverBlocking, setSolverBlocking] = useState(false);
  const solverBlockingRef = useRef(false); solverBlockingRef.current = solverBlocking;
  const [layoutEditing, setLayoutEditing] = useState(false);
  const layoutEditingRef = useRef(false);
  const finishLayoutEditing = useCallback(() => { layoutEditingRef.current = false; setLayoutEditing(false); }, []);
  useEffect(() => { if (view !== 'timer' || timerMode !== 1) finishLayoutEditing(); }, [view, timerMode, finishLayoutEditing]);
  const timerPanelBlocking = layoutEditing || solverBlocking || statsOpen || historyModalOpen || replayBlocking;
  const timerOverlayBlocking = timerPanelBlocking || openOverlay !== null;
  const topbarPickerOpen = openOverlay === TIMER_OVERLAY_IDS.practiceContent
    || openOverlay === TIMER_OVERLAY_IDS.practiceMethod
    || openOverlay === TIMER_OVERLAY_IDS.puzzlePicker
    || openOverlay === TIMER_OVERLAY_IDS.scrambleSource;
  const timerCoversNavigation = timerPanelBlocking || (openOverlay !== null && !topbarPickerOpen);
  const openOverlayRef = useRef<TimerOverlayId | null>(openOverlay);
  const [solverOpenRequest, setSolverOpenRequest] = useState(0);
  const changeSolverSheet = useCallback((open: boolean) => {
    if (open) {
      if ((openOverlayRef.current !== null && openOverlayRef.current !== TIMER_OVERLAY_IDS.stageSolver)
        || timerContextMutationBusyRef.current) return;
      openOverlayRef.current = TIMER_OVERLAY_IDS.stageSolver;
      setOpenOverlay(TIMER_OVERLAY_IDS.stageSolver);
    } else if (openOverlayRef.current === TIMER_OVERLAY_IDS.stageSolver) {
      openOverlayRef.current = null;
      setOpenOverlay(null);
    }
  }, []);
  useEffect(() => { if (upperPaneVisible) changeSolverSheet(false); }, [upperPaneVisible, changeSolverSheet]);
  const toolDismissRef = useRef<(() => boolean) | null>(null);
  const registerToolDismiss = useCallback((dismiss: (() => boolean) | null) => { toolDismissRef.current = dismiss; }, []);
  const solverDismissRef = useRef<(() => boolean) | null>(null);
  const registerSolverDismiss = useCallback((dismiss: (() => boolean) | null) => { solverDismissRef.current = dismiss; }, []);
  const wcaMarksOverlayIdentityRef = useRef<string | null>(null);
  const manualEntryOpenRef = useRef(manualEntryOpen);
  const printControllerRef = useRef<TimerPrintControllerHandle>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gestureActionsRef = useRef<Partial<Record<TimerGestureActionId, () => void>>>({});
  const keymapRef = useRef(resolveKeymap(undefined));
  const fallbackLanguage = preferredLanguage();
  const language = appearance?.locale ?? store?.settings.language ?? fallbackLanguage;
  const copy = COPY[language];
  const toolsWebUrl = installedWebEntryUrl(toolsEntryRoute
    ? siteRouteUrl(language, toolsEntryRoute)
    : siteUrl(language), language);
  const accountEntryLocale = accountFrameLocale ?? language;
  const accountWebUrl = installedWebEntryUrl(accountFramePage === 'membership'
    ? siteRouteUrl(accountEntryLocale, '/membership')
    : accountUrl(accountEntryLocale, accountFramePage === 'security' ? 'signin' : undefined), accountEntryLocale);
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
  const practiceContents = useMemo(() => timerPracticeContents(activeEvent), [activeEvent]);
  const practiceContent = selectedTimerPracticeContent(practiceContents, activeEvent, scramble222Type, null);
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
      ? `drill:${effectiveDrillTarget.type}:${effectiveDrillTarget.id}|cn:${store?.settings.cnMode ?? 'none'}`
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
          const generated = generateTimerDrillScramble(target, Math.random, storeRef.current?.settings.cnMode);
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
        const generated = await ordinaryRandom.generate({ event: activeEvent }, signal);
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
    ordinaryRandom,
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
  const netHistoryReplays = useMemo(() => timerMode === 'net' && store?.database
    ? indexNetRecordedReplays(Object.values(store.database.dataBySession)) : undefined, [timerMode, store?.database]);
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
  const trainingStatistics = useMemo(() => timerTrainingSummaries(solves, activeEvent, trainingSettings.trainingStartMode),
    [solves, activeEvent, trainingSettings.trainingStartMode]);
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
    on: { zh: '开启', en: 'On' }[language],
    off: { zh: '关闭', en: 'Off' }[language],
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
    // Migrate old timer preferences once; subsequent timer snapshots cannot
    // overwrite the App-level appearance (including after imports/sign-in).
    if (!appearanceRef.current) {
      const next = readAppearancePreferences({ theme: data.settings.theme, locale: data.settings.language });
      // Persist the migration before a timer backup can change its legacy fields.
      // A restricted storage context must still be able to open the timer.
      try { persistAppearancePreferences(next); } catch { /* This visit keeps the recovered preferences. */ }
      appearanceRef.current = next;
      setAppearance(next);
      applyAppearancePreferences(next);
    }
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
      if (target || (isCnEligible(event) && !difficultyIdentity)) identity += `|cn:${seed?.cnMode ?? 'none'}`;
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
    ? mobileWcaPool.wcaPoolProgress(realSpecToWcaSource(activeRealSourceSpec))
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
    activeRealWaiterRef.current?.cancel();
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
      const generated = generateTimerDrillScramble(target, Math.random, storeRef.current?.settings.cnMode);
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

    // A restored event may reach generation before source normalization runs.
    // Unsupported real sources use the event's own provider during that handoff.
    if (!timerSupportsRealWcaScrambles(event)) {
      generateRandomScramble(liveEntry, requestId);
      return;
    }

    const realSpec = normalizeRealScrambleSourceSpec(realSpecFor(event));
    const sourceKey = realScrambleSourceKey(realSpec);
    const requestedIdentity = sourceIdentity;
    const poolSpec = realSpecToWcaSource(realSpec);
    const activate = (next: RealScramble) => {
      refreshRealProgress((revision) => revision + 1);
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
    };
    const next = mobileWcaPool.peekWcaRow(poolSpec);
    if (next) { activate(wcaRowToReal(next)); return; }
    const retry = mobileWcaPool.startNext(poolSpec);
    activeRealWaiterRef.current?.cancel();
    activeRealWaiterRef.current = retry;
    void retry.result.then((outcome) => {
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
      activate(wcaRowToReal(outcome.value));
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
    realSpecFor,
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
    activeRealWaiterRef.current?.cancel();
    mobileWcaPool.cancelSource();
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
    activeRealWaiterRef.current?.cancel();
    mobileWcaPool.cancelSource();
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
    autoRecapDismissGestureRef.current.reset();
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement
      && active.dataset.historyActionId === 'solve.detail.comment') active.blur();
    if (historyDetailRef.current?.autoRecap) setRecapSolveId(null);
    historyDetailRef.current = null;
    setHistoryDetail(null);
    setOpenOverlay((current) => {
      const next = current === TIMER_OVERLAY_IDS.solveDetail ? null : current;
      openOverlayRef.current = next;
      return next;
    });
  }, []);

  const openHistorySolveDetail = useCallback((solve: Solve, autoFocusComment = false, autoRecap = false) => {
    autoRecapDismissGestureRef.current.reset();
    const detail = { autoFocusComment, autoRecap, context: historyContext, solveId: solve.id };
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
    const available = openOverlay === TIMER_OVERLAY_IDS.solveDetail
      ? (view === 'timer' || view === 'history') && historyDetailSolve !== null
      : openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher
      || openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu
      || openOverlay === TIMER_OVERLAY_IDS.historyCompare
      ? view === 'history'
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

  const postWebSurfaceInit = useCallback((surface: MobileEmbedSurface) => {
    webFrameRefs.current[surface]?.contentWindow?.postMessage(
      mobileEmbedInitMessage(surface, {
        authProviders: MOBILE_AUTH_PROVIDERS,
        accountManagement: true,
        // Older websites use this flag to hide the Account Settings tab.
        shellNavigation: surface === 'tools',
        inlineAccountSettings: surface === 'account' ? true : undefined,
        accountDetailNavigation: surface === 'account' ? true : undefined,
        appearance: surface === 'tools' || accountInlineSettingsRef.current ? appearanceRef.current ?? undefined : undefined,
        appleMembership: Boolean(host.appleMembership),
        googleMembership: Boolean(host.googleMembership),
        webMembership: Boolean(host.webMembership),
        bluetooth: surface === 'tools' && Boolean(host.createBleTransport),
        chrome: embeddedChromeRef.current,
      }), SITE_ORIGIN,
    );
  }, [host.appleMembership, host.googleMembership, host.webMembership, host.createBleTransport]);

  const beginWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    if (connection !== 'online') return;
    webHandshakeRetryRef.current[surface] = startWebSurfaceHandshake(
      () => postWebSurfaceInit(surface),
      MOBILE_EMBED_INIT_RETRY_MS,
      MOBILE_EMBED_INIT_RETRIES,
      host.generativeAiDisabled ? () => {
        setWebSurfaceStatus((current) => current[surface] === 'loading'
          ? { ...current, [surface]: 'error' } : current);
      } : undefined,
    );
  }, [clearWebSurfaceHandshake, connection, host.generativeAiDisabled, postWebSurfaceInit]);

  const markWebSurfaceLoaded = useCallback((surface: MobileEmbedSurface) => {
    webSurfaceLoadedRef.current[surface] = true;
    setWebSurfaceStatus((current) => (
      current[surface] === 'ready' ? current : { ...current, [surface]: 'ready' }
    ));
  }, []);

  const finishWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    webBridgeReadyRef.current[surface] = true;
    if (appearanceRef.current && (surface === 'tools' || accountInlineSettingsRef.current)) webFrameRefs.current[surface]?.contentWindow?.postMessage(
      mobileEmbedAppearanceMessage(surface, appearanceRef.current), SITE_ORIGIN,
    );
    webSurfaceLoadedRef.current[surface] = true;
    setWebSurfaceStatus((current) => (
      current[surface] === 'ready' ? current : { ...current, [surface]: 'ready' }
    ));
  }, [clearWebSurfaceHandshake]);

  const clearAccountSyncTimeout = useCallback(() => {
    if (accountSyncTimeoutRef.current !== null) window.clearTimeout(accountSyncTimeoutRef.current);
    accountSyncTimeoutRef.current = null;
  }, []);

  const navigateAccount = useCallback((page: AccountPage) => {
    if (page === accountPageRef.current) return;
    if (page === 'home' && (accountPageRef.current === 'profile' || accountPageRef.current === 'security')
      && authSessionRef.current) void auth.refreshAccountSession().catch(() => undefined);
    accountPageRef.current = page;
    webDepthRef.current.account = 0;
    setAccountPage(page);
    clearAccountSyncTimeout();
    accountSyncInFlightRef.current = null;
    accountSyncedTokenRef.current = null;
    // Keep the trusted account frame available for explicit web-session cleanup on sign-out.
    if (!isAccountDetailsPage(page)) return;
    setAccountFramePage(page);
    webBridgeReadyRef.current.account = false;
    setWebSurfaceStatus(current => ({ ...current, account: 'loading' }));
    setWebSurfaceReloadUrl(current => ({ ...current, account: null }));
    setWebSurfaceRevision(current => ({ ...current, account: current.account + 1 }));
    setAccountDetailsReady(false);
    setOpenedWebViews(current => ({ ...current, account: true }));
  }, [auth.refreshAccountSession, clearAccountSyncTimeout]);

  useEffect(() => {
    if (accountDetails && !auth.loading && !auth.session) navigateAccount('home');
  }, [accountDetails, auth.loading, auth.session, navigateAccount]);

  const retryWebSurface = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    webBridgeReadyRef.current[surface] = false;
    webSurfaceLoadedRef.current[surface] = false;
    if (surface === 'account') {
      clearAccountSyncTimeout();
      accountSyncInFlightRef.current = null;
      accountSyncedTokenRef.current = null;
      setAccountDetailsReady(false);
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
    if (!storeLoaded || connection !== 'online' || openedWebViews.tools) return;
    // Give the local timer its first paint before starting the online homepage.
    const timeout = window.setTimeout(() => {
      setOpenedWebViews((current) => current.tools ? current : { ...current, tools: true });
    }, TOOLS_PRELOAD_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [storeLoaded, connection, openedWebViews.tools]);

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
    desktopToolsHistory.current = [];
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
    accountInlineSettingsRef.current = false;
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
    if (!isAccountDetailsPage(accountPageRef.current) || !token || !frame?.contentWindow || !webBridgeReadyRef.current.account) return;
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
    navigateAccount('home');
  }, [auth.logout, clearAccountSyncTimeout, navigateAccount]);
  logoutEverywhereRef.current = logoutEverywhere;

  const selectPrimaryView = useCallback((next: PrimaryView) => {
    if (timingRunningRef.current
      || battleModeActiveRef.current
      || timerContextMutationBusyRef.current) {
      announce(copy.finishAttemptFirst);
      return false;
    }
    if (next === 'tools') {
      setOpenedWebViews((current) => {
        if (current[next]) return current;
        webDepthRef.current[next] = 0;
        return { ...current, [next]: true };
      });
    }
    if (next === 'account' && viewRef.current === 'account') navigateAccount('home');
    setView(next);
    return true;
  }, [announce, copy.finishAttemptFirst, navigateAccount]);

  const openAppAppearance = useCallback(() => {
    if (timingRunningRef.current || battleModeActiveRef.current || timerContextMutationBusyRef.current) {
      announce(copy.finishAttemptFirst);
      return;
    }
    if (viewRef.current !== 'appearance') appearanceReturnRef.current = viewRef.current;
    cancelTimerArmRef.current();
    setView('appearance');
  }, [announce, copy.finishAttemptFirst]);

  const closeAppAppearance = useCallback(() => setView(appearanceReturnRef.current), []);
  useEffect(() => {
    if (view !== 'appearance') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      closeAppAppearance();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, closeAppAppearance]);

  const openToolsRoute = useCallback((route: string) => {
    const destination = new URL(route, SITE_ORIGIN);
    if (destination.origin !== SITE_ORIGIN || installedContentUnavailable(destination.href, host.generativeAiDisabled)
      || (!communityAvailableRef.current && isInstalledCommunityHref(destination.href))) {
      announce(copy.actionFailed);
      return;
    }
    if (destination.pathname.replace(/^\/(en|zh)(?=\/|$)/, '').replace(/\/$/, '') === '/timer'
      && !destination.search && !destination.hash) {
      selectPrimaryView('timer');
      return;
    }
    if (!selectPrimaryView('tools')) return;
    const path = destination.pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    const entry = path + destination.search + destination.hash;
    const href = installedWebEntryUrl(siteRouteUrl(language, entry), language);
    setToolsEntryRoute(entry);
    if (href === toolsWebUrl && webLastHrefRef.current.tools !== href) {
      webDepthRef.current.tools = 0;
      setWebSurfaceReloadUrl(current => ({ ...current, tools: null }));
      setWebSurfaceRevision(current => ({ ...current, tools: current.tools + 1 }));
    }
  }, [announce, copy.actionFailed, host.generativeAiDisabled, language, selectPrimaryView, toolsWebUrl]);

  const remoteReturnRef = useRef(0);
  useEffect(() => {
    const remote = host.uuRemote;
    if (!remote) return;
    const onReturn = () => {
      const returned = remote.getSnapshot().returned;
      if (returned <= remoteReturnRef.current) return;
      remoteReturnRef.current = returned;
      selectPrimaryView('account');
    };
    onReturn();
    return remote.subscribe(onReturn);
  }, [host.uuRemote, selectPrimaryView]);

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

  useEffect(() => {
    let active = true;
    const listener = host.addDockedKeyboardListener?.(top => {
      if (active) setDockedKeyboardTop(top);
    });
    return () => {
      active = false;
      void listener?.then(handle => handle.remove()).catch(() => {});
    };
  }, [host]);

  useLayoutEffect(() => {
    const frame = primaryNavRef.current?.getBoundingClientRect();
    const height = frame?.height ?? 0;
    const inset = floatingNavigation && frame && height > 0 ? viewportHeight - frame.top : height;
    setPrimaryNavBottomInset(sideNavigation || (wideLayout && !floatingNavigation) ? 0 : inset);
  }, [floatingNavigation, fullscreen, storeLoaded, viewportHeight, wideLayout, sideNavigation]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN) return;
      const accountFrame = webFrameRefs.current.account;
      const accountSource = Boolean(accountFrame && event.source === accountFrame.contentWindow);
      const authClear = decodeMobileEmbedAuthClear(event.data);
      if (accountSource && !isAccountDetailsPage(accountPageRef.current) && !authClear) return;
      if (event.data?.type === 'cuberoot:mobile:embedded-search-blur') {
        if (event.source === webFrameRefs.current.tools?.contentWindow) setDockedKeyboardTop(null);
        return;
      }
      if (event.data?.type === 'cuberoot:mobile:embedded-top-ready') {
        const surface: unknown = event.data.surface;
        if (floatingNavigation && (surface === 'account' || surface === 'tools')) {
          const frame = webFrameRefs.current[surface]?.contentWindow;
          const top = event.data.top === true;
          if (frame && event.source === frame) {
            setNativeTopBars(current => current[surface] === top ? current : { ...current, [surface]: top });
            if (surface === 'tools') setToolsSearchReady(event.data.search === true);
          }
        }
        return;
      }
      const selectTab = decodeMobileEmbedSelectTab(event.data);
      const openSettings = decodeMobileEmbedOpenSettings(event.data);
      const shellAction = selectTab ?? openSettings;
      if (shellAction) {
        const frame = webFrameRefs.current[shellAction.surface];
        if (!frame || event.source !== frame.contentWindow || viewRef.current !== shellAction.surface) return;
        if (selectTab) selectPrimaryView(selectTab.tab);
        else openAppAppearance();
        return;
      }
      const purchase = decodeAppleMembershipRequest(event.data) ?? decodeGoogleMembershipRequest(event.data) ?? decodeWebMembershipRequest(event.data);
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
          ? host.appleMembership?.(purchase, session)
          : purchase.type === 'cuberoot:mobile:google-membership'
            ? host.googleMembership?.(purchase, session) : host.webMembership?.(purchase, session);
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
        void openInstalledAccountManagement(management, accountUrl(accountEntryLocale), {
          currentSession: () => authSessionRef.current,
          openExternal: (href) => host.openExternal(href),
        }).then(() => reply(true)).catch(() => reply(false)).finally(() => {
          accountManagementRequestRef.current = null;
        });
        return;
      }

      const authRequest = decodeMobileEmbedAuthRequest(event.data);
      if (accountSource && authRequest) {
        if (authRequest.provider) void auth.login(authRequest.provider);
        else navigateAccount(authSessionRef.current ? 'home' : 'sign-in');
        return;
      }

      if (accountSource && authClear) {
        clearAccountSyncTimeout();
        accountSyncInFlightRef.current = null;
        accountSyncedTokenRef.current = null;
        if (authSessionRef.current) void auth.logout();
        navigateAccount('home');
        return;
      }

      const webSessionResult = decodeMobileEmbedWebSessionResult(event.data);
      if (accountSource && webSessionResult) {
        const pending = accountSyncInFlightRef.current;
        if (!pending || pending.requestId !== webSessionResult.requestId) return;
        clearAccountSyncTimeout();
        accountSyncInFlightRef.current = null;
        if (webSessionResult.ok) {
          accountSyncedTokenRef.current = pending.token;
          setAccountDetailsReady(true);
        }
        else {
          setWebSurfaceStatus((current) => ({ ...current, account: 'error' }));
          announce(copy.authError);
        }
        return;
      }

      const external = decodeMobileEmbedExternal(event.data);
      if (external) {
        const frame = webFrameRefs.current[external.surface];
        if (!frame || event.source !== frame.contentWindow || viewRef.current !== external.surface) return;
        if (installedContentUnavailable(external.href, host.generativeAiDisabled)
          || (!communityAvailableRef.current && isInstalledCommunityHref(external.href))) { announce(copy.actionFailed); return; }
        void host.openExternal(external.href).catch(() => announce(copy.actionFailed));
        return;
      }

      const navigation = decodeMobileEmbedNavigation(event.data);
      if (!navigation) return;
      const frame = webFrameRefs.current[navigation.surface];
      if (!frame || event.source !== frame.contentWindow) return;
      let destination: URL;
      try {
        destination = new URL(navigation.href);
        if (destination.origin !== SITE_ORIGIN) return;
      } catch {
        return;
      }
      const previousHref = webLastHrefRef.current[navigation.surface];
      webLastHrefRef.current[navigation.surface] = navigation.href;
      if (host.listenDesktopNavigation && navigation.surface === 'tools') {
        const history = desktopToolsHistory.current;
        const index = history.lastIndexOf(navigation.href);
        if (index === -1) history.push(navigation.href);
        else history.length = index + 1;
      }
      if (!isEmbeddedTopBarRoute(navigation.surface, destination.pathname)) {
        setNativeTopBars(current => current[navigation.surface] ? { ...current, [navigation.surface]: false } : current);
        if (navigation.surface === 'tools') {
          setToolsSearchReady(false);
          setToolsSearchOpen(false);
        }
      } else if (floatingNavigation && previousHref !== navigation.href &&
        (!previousHref || !isEmbeddedTopBarRoute(navigation.surface, new URL(previousHref, SITE_ORIGIN).pathname))) {
        postWebSurfaceInit(navigation.surface);
      }
      webDepthRef.current[navigation.surface] = navigation.depth;
      const usesChrome = navigation.usesChrome === true;
      setWebChrome(current => current[navigation.surface] === usesChrome
        ? current : { ...current, [navigation.surface]: usesChrome });
      if (navigation.surface === 'account') accountInlineSettingsRef.current = navigation.inlineAccountSettings === true;
      finishWebSurfaceHandshake(navigation.surface);
      if (navigation.surface === 'account') {
        void syncAccountWebSession();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    announce,
    accountEntryLocale,
    auth.login,
    auth.logout,
    clearAccountSyncTimeout,
    copy.actionFailed,
    copy.authError,
    finishWebSurfaceHandshake,
    floatingNavigation,
    navigateAccount,
    postWebSurfaceInit,
    selectPrimaryView,
    openAppAppearance,
    host,
    syncAccountWebSession,
  ]);

  useEffect(() => {
    // Browser.open resolves before the login callback. Report later callback failures too.
    if (auth.busy) return;
    if (auth.error) {
      // A native sign-in failure does not invalidate the loaded account page.
      // Keep its form available for retry while reporting the failed handoff.
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
      if (toolsBlePickerRef.current) { toolsBlePickerRef.current.cancel(); return; }
      const current = viewRef.current;
      if (current === 'account' && accountPageRef.current !== 'home' && webDepthRef.current.account === 0) {
        navigateAccount(accountPageRef.current === 'recover-password' ? 'sign-in' : 'home');
        return;
      }
      if (current === 'appearance') { setView(appearanceReturnRef.current); return; }
      if (layoutEditingRef.current) { finishLayoutEditing(); return; }
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
        mutationBusy: timerContextMutationBusyRef.current,
        overlayOpen: openOverlayRef.current !== null || solverBlockingRef.current,
        phase: timerPhaseRef.current,
        view: current,
        webDepth: current === 'tools' || current === 'account'
          ? (webBridgeReadyRef.current[current] ? webDepthRef.current[current] : 0)
          : 0,
      });
      if (action === 'close-overlay') {
        if (toolDismissRef.current?.()) return;
        if ((openOverlayRef.current === TIMER_OVERLAY_IDS.stageSolver || solverBlockingRef.current) && solverDismissRef.current?.()) return;
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
  }, [announce, closeHistorySolveDetail, copy.finishAttemptFirst, host, navigateAccount]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    onFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!host.watchTimer) return;
    return startWatchTimerSync(host.watchTimer, repository, async (operation) => {
      const revision = storeSnapshotGateRef.current.beginMutation();
      try {
        const data = await operation();
        storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      } catch (error) {
        await storeSnapshotGateRef.current.reloadIfLatest(revision, () => repository.load(), applyStoreSnapshot);
        throw error;
      }
    });
  }, [host, applyStoreSnapshot]);

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
  attemptCanStartRef.current = !layoutEditing && attemptCanStart;
  const attemptRef = useRef<MobileScrambleAttemptSnapshot | null>(null);
  const smartCubeAttemptProducerRef = useRef(new SmartCubeAttemptProducer());
  const smartCubeMoveSubscribersRef = useRef(new Set<(move: string, timestamp: number) => void>());
  useEffect(() => {
    const gesture = autoRecapDismissGestureRef.current;
    if (!historyDetail?.autoRecap || historyDetail.context !== historyContext
      || openOverlay !== TIMER_OVERLAY_IDS.solveDetail) {
      gesture.reset();
      return;
    }
    // Resizing does not remount the detail or fire onEntered again.
    if (wideLayout) return;
    const subscribers = smartCubeMoveSubscribersRef.current;
    const onMove = (move: string) => {
      const current = historyDetailRef.current;
      if (!current?.autoRecap || current.context !== historyContext
        || current.solveId !== historyDetail.solveId || current.closeRequested
        || openOverlayRef.current !== TIMER_OVERLAY_IDS.solveDetail) return;
      if (!gesture.observe(move)) return;
      const next = { ...current, closeRequested: true };
      historyDetailRef.current = next;
      setHistoryDetail(next);
    };
    subscribers.add(onMove);
    return () => { subscribers.delete(onMove); };
  }, [wideLayout, historyDetail?.autoRecap, historyDetail?.context, historyDetail?.solveId, historyContext, openOverlay]);

  const smartCubeQuatRef = useRef<Quat | null>(null);
  const smartCubeLastFaceletsRef = useRef<string | null>(null);
  const smartCubeReferenceRef = useRef<Quat | null>(null);
  const [smartCubeCalibration, setSmartCubeCalibration] = useState(0);
  const calibrationReferenceRef = useRef<Quat | null>(null);
  const resetSmartCubeOrientation = () => {
    calibrationReferenceRef.current = smartCubeQuatRef.current ? { ...smartCubeQuatRef.current } : null;
    if (timerPhaseRef.current !== 'running' && smartCubeQuatRef.current) {
      smartCubeReferenceRef.current = { ...smartCubeQuatRef.current };
    }
    setSmartCubeCalibration(value => value + 1);
  };
  const [smartCubeRenderedView, setSmartCubeRenderedView] = useState('net');
  const connectedSmartCubeRef = useRef<Solve['device']>(undefined);
  const smartCubeAttemptDeviceRef = useRef<Solve['device']>(undefined);
  const trainingTimingMode = () => timerSupportsTrainingTiming(activeEventRef.current) && connectedSmartCubeRef.current
    ? storeRef.current?.settings.trainingStartMode ?? 'first-turn' : undefined;
  const [attemptSplitState, setAttemptSplitState] = useState<TimerAttemptSplitState>({ stages: {} });
  const [attemptSplitRecorder] = useState(() => new TimerAttemptSplitRecorder(setAttemptSplitState));
  const attemptStartedAtRef = useRef(0);
  const liveCompletionRef = useRef<TimerLiveCompletion | null>(null);
  const { solve: liveSolve, publish: publishLiveSolve, clear: clearLiveSolve } = useLiveSmartCubeAttempt(
    smartCubeAttemptProducerRef.current, () => timerPhaseRef.current === 'running' && attemptRef.current
      ? { startedAt: attemptStartedAtRef.current, event: attemptRef.current.event, scramble: attemptRef.current.scramble }
      : null, store?.settings.liveSolutionAnalysis ?? true);
  const [liveStageTarget, setLiveStageTarget] = useState<HTMLDivElement | null>(null);
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
      ...(result.trainingStartMode ? { trainingStartMode: result.trainingStartMode } : {}),
      ...(bld ? { bld } : {}),
      ...(stages ? { stages } : {}),
      penalty: result.autoPenalty,
      scramble: attempt.scramble,
      scrambleSource: attempt.scrambleSource,
      timeMs: result.timeMs,
    };
    Object.assign(solve, smartCubeAttemptProducerRef.current.finishSolveFields(solve));
    liveCompletionRef.current = { context: sessionId, solve: { ...solve, id: crypto.randomUUID(), ts: Date.now() } };
    const ownerAtSaveStart = wcaAutoMarkOwnerKey(authSessionRef.current);
    const recapRevision = recapAttemptRevisionRef.current;
    const priorSolveIds = new Set((storeRef.current?.database.dataBySession[sessionId]?.[solve.event] ?? []).map((item) => item.id));
    void repository.addSolve(solve, sessionId).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      markSavedWcaSolve(solve, ownerAtSaveStart);
      if (recapRevision === recapAttemptRevisionRef.current
        && storeRef.current?.database.activeSessionId === sessionId
        && activeEventRef.current === solve.event && viewRef.current === 'timer'
        && storeRef.current?.settings.autoOpenSolution && solve.device && solve.moves?.length) {
        setSolverOpenRequest(value => value + 1);
      }
      if (recapRevision === recapAttemptRevisionRef.current
        && storeRef.current?.database.activeSessionId === sessionId
        && activeEventRef.current === solve.event && viewRef.current === 'timer'
        && shouldAutoRecap(solve, storeRef.current?.settings ?? {})) {
        const saved = [...(data.database.dataBySession[sessionId]?.[solve.event] ?? [])].reverse().find((item) => !priorSolveIds.has(item.id)
          && item.timeMs === solve.timeMs && item.scramble === solve.scramble);
        if (saved) {
          // Match Web: narrow screens open full detail over the timer; wide
          // screens keep the completed reconstruction in the workspace rail.
          setRecapSolveId(saved.id);
          if (!wideLayoutRef.current) openHistorySolveDetail(saved, false, true);
        }
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
    openHistorySolveDetail,
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
    smartCubeActive: () => Boolean(connectedSmartCubeRef.current || smartCubeAttemptDeviceRef.current),
    trainingStartMode: trainingTimingMode,
    canManualArmTraining: () => smartCubeGuidance.match === true,
    onTransition: transition => {
      timerPhaseRef.current = transition.state.phase;
      onTimerSoundTransition(transition);
    },
    canStart: attemptCanStart,
    enabled: view !== 'settings' && timerVisible
      && timerMode === 1
      && timingEnabled
      && !manualEntryOpen
      && !timerOverlayBlocking
      && !timerContextMutationBusy,
    holdMs: store?.settings.holdMs ?? DEFAULT_TIMER_TIMING_SETTINGS.holdMs,
    inspectionSec: store?.settings.inspectionSec ?? 0,
    onComplete: completeSolve,
    onStart: (startedAtMs, cubeStart) => {
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
      liveCompletionRef.current = null;
      clearLiveSolve();
      smartCubeAttemptDeviceRef.current = connectedSmartCubeRef.current;
      attemptSplitRecorder.begin({
        bldMemo: (storeRef.current?.settings.bldMemo ?? true) && isBldEvent(entry.event),
        multiStage: (storeRef.current?.settings.multiStage ?? false)
          && timerSupportsStageSplits(entry.event),
      });
      const reference = smartCubeReferenceRef.current;
      const initial = smartCubeQuatRef.current;
      smartCubeAttemptProducerRef.current.begin(startedAtMs, connectedSmartCubeRef.current,
        storeRef.current?.settings.recordGyro && reference && initial
          ? { reference, initial, orientation: timerSmartCubeTrainingOrientation(activeEvent, storeRef.current?.settings.preScrT) }
          : undefined, cubeStart);
      if (storeRef.current?.settings.recordGyro && smartCubeQuatRef.current) {
        smartCubeAttemptProducerRef.current.recordGyro(smartCubeQuatRef.current, 0);
      }
      timerPhaseRef.current = 'running';
    },
  });
  // A solve started without room for the rail stays focused when the iPad rotates.
  const idleSolverWide = useRef(wideLayout);
  useLayoutEffect(() => {
    if (timer.machine.phase !== 'running') idleSolverWide.current = wideLayout;
  }, [timer.machine.phase, wideLayout]);
  timingRunningRef.current = timer.machine.phase === 'running';
  const [notificationOpens] = useState(() => new NotificationOpenQueue());
  const [notificationRevision, refreshNotificationOpen] = useState(0);
  useEffect(() => {
    if (!host.addNotificationOpenListener) return;
    let active = true;
    const listener = host.addNotificationOpenListener(value => {
      if (!active) return;
      notificationOpens.offer(value);
      refreshNotificationOpen(n => n + 1);
    });
    void listener.catch(() => { /* Notification transport cannot block the app. */ });
    return () => { active = false; void listener.then(h => h.remove()).catch(() => undefined); };
  }, [host, notificationOpens]);
  useEffect(() => {
    const route = notificationOpens.take(auth.session?.user.uid,
      !auth.loading && store !== null,
      !['idle', 'stopped'].includes(timer.machine.phase) || battleModeActive || timerContextMutationBusyRef.current);
    if (!route) return;
    // Reuse Tools' real website surface and its back/auth bridge, including when
    // another Tools page was already open or a retry URL was retained.
    clearWebSurfaceHandshake('tools');
    webBridgeReadyRef.current.tools = false;
    webSurfaceLoadedRef.current.tools = false;
    webDepthRef.current.tools = 0;
    webLastHrefRef.current.tools = '';
    setWebSurfaceStatus(current => ({ ...current, tools: 'loading' }));
    setWebSurfaceReloadUrl(current => ({ ...current, tools: null }));
    setWebSurfaceRevision(current => ({ ...current, tools: current.tools + 1 }));
    openToolsRoute(route);
  }, [notificationOpens, notificationRevision, auth.loading, auth.session?.user.uid, store,
    timer.machine.phase, battleModeActive, clearWebSurfaceHandshake, openToolsRoute]);
  useEffect(() => {
    if (timer.machine.phase !== 'running') smartCubeAttemptDeviceRef.current = undefined;
  }, [timer.machine.phase]);
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
  useLayoutEffect(() => { smartCubeReferenceRef.current = null; }, [scramble, trainingOrientation]);
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
    armFromCube: (timestamp, clock) => {
      const armed = timerRef.current.armFromCube(timestamp, clock);
      if (armed) timerPhaseRef.current = trainingTimingMode()
        ? trainingTimingMode() === 'first-turn' ? 'ready' : 'inspecting'
        : (storeRef.current?.settings.inspectionSec ?? 0) > 0 ? 'inspecting' : 'ready';
      return armed;
    },
    autoReadyOnScramble: () => trainingTimingMode() ? trainingTimingMode() !== 'manual'
      : storeRef.current?.settings.bluetoothAutoReady === 'scrambled',
    canStartAttempt: () => attemptCanStartRef.current,
    getPhase: () => timerPhaseRef.current,
    correctionLimit: () => storeRef.current?.settings.smartCubeCorrectionLimit,
    isTimingEnabled: () => timingEnabledRef.current,
    onGuidanceChange: setSmartCubeGuidance,
    onMove: ({ move, timestamp }) => {
      for (const subscriber of smartCubeMoveSubscribersRef.current) subscriber(move, timestamp);
    },
    recordMove: ({ move, timestamp, clock }) => {
      if (!smartCubeAttemptProducerRef.current.recordMove(move, timestamp, clock)) return;
      publishLiveSolve();
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
    startFromCube: (timestamp, clock) => timerRef.current.startFromCube(timestamp, clock),
    stopFromCube: (timestamp, clock) => {
      const stopped = timerRef.current.stopFromCube(timestamp, clock);
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
    onMove: (move, timestamp, facelets, metadata, clock) => {
      const futureHistory = metadata?.futureHistory === true;
      smartCubeAnchorController.move(move, timestamp);
      if (timerModeRef.current !== 1) {
        if (!futureHistory) battleSmartCubeHandlersRef.current?.onMove(move, timestamp, facelets, clock);
        return;
      }
      const outcome = smartCubeSoloController.move({ facelets, metadata, move, timestamp, clock });
      if (outcome.guidancePenultimate && storeRef.current?.settings.autoCalibrateGyro && smartCubeQuatRef.current) {
        resetSmartCubeOrientation();
      }
      if (outcome.guidanceCompleted && !smartCubeReferenceRef.current && smartCubeQuatRef.current) {
        smartCubeReferenceRef.current = { ...smartCubeQuatRef.current };
      }
    },
    onSolved: (timestamp, clock) => {
      if (timerModeRef.current !== 1) {
        battleSmartCubeHandlersRef.current?.onSolved(timestamp, clock);
        return;
      }
      smartCubeSoloController.solved(timestamp, clock);
    },
  });
  connectedSmartCubeRef.current = smartCube.phase === 'connected' && smartCube.deviceName
    ? { model: smartCube.model ?? 'gan-v4', name: smartCube.deviceName }
    : undefined;
  useEffect(() => {
    if (smartCube.phase !== 'connected') return;
    void import('@cuberoot/timer-ui/reconstruct/library-cache')
      .then(({ reconstructionLibraries }) => reconstructionLibraries.warm())
      .then(() => import('@cuberoot/timer-ui/reconstruct-analysis'))
      .then(({ reconstructionAnalyzer }) => reconstructionAnalyzer.warmup()).catch(() => {});
  }, [smartCube.phase]);
  if (smartCube.facelets) smartCubeLastFaceletsRef.current = smartCube.facelets;
  useAutoReady({
    enabled: view !== 'settings' && timerVisible && timerMode === 1 && smartCube.phase === 'connected' && timingEnabled
      && !trainingTimingMode()
      && attemptCanStart
      && !manualEntryOpen && !timerOverlayBlocking
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
          cnMode: store?.settings.cnMode,
        }
      : null);
  }, [currentScrambleEntry, scramble, smartCubeSoloController, smartCubeTarget, timerMode, trainingOrientation, store?.settings.cnMode]);

  useLayoutEffect(() => {
    const connected = smartCube.phase === 'connected';
    smartCubeSoloController.setConnected(connected);
    if (!connected) {
      timer.cancelArm();
      smartCubeQuatRef.current = null;
      smartCubeReferenceRef.current = null;
      calibrationReferenceRef.current = null;
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
      await revokeToolsBle();
      if (token !== externalOperationRef.current) return;
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

  useEffect(() => {
    if (view !== 'tools') void revokeToolsBle();
  }, [view, revokeToolsBle]);

  const prepareToolsBleRef = useRef(async () => {});
  prepareToolsBleRef.current = async () => {
    externalOperationRef.current++;
    await smartCube.disconnect();
    await external.timer.disconnect();
    external.stackmat.stop();
  };
  useEffect(() => {
    const onOpen = (event: MessageEvent) => {
      const port = installedBleRequestPort(event, webFrameRefs.current.tools?.contentWindow, SITE_ORIGIN);
      if (!port) return;
      const reject = () => { port.postMessage({ event: 'closed' }); port.close(); };
      if (viewRef.current !== 'tools' || !host.createBleTransport) { reject(); return; }
      const drain = revokeToolsBle();
      const epoch = toolsBleEpochRef.current;
      let abandoned = false;
      const queue: unknown[] = [];
      port.onmessage = event => {
        if (event.data?.dispose) abandoned = true;
        else if (queue.length < 32) queue.push(event.data);
      };
      const preparation = drain.then(async () => {
        if (!abandoned && epoch === toolsBleEpochRef.current && viewRef.current === 'tools') await prepareToolsBleRef.current();
      });
      toolsBleDrainRef.current = preparation.catch(() => {});
      void (async () => {
        await preparation;
        if (abandoned || epoch !== toolsBleEpochRef.current || viewRef.current !== 'tools') { reject(); return; }
        const owner = new InstalledBleHost(host.createBleTransport!(), message => port.postMessage(message),
          (transport, options, signal) => pickInstalledBleDevice(transport, options, signal, setToolsBlePicker));
        toolsBleRef.current = { owner, port };
        port.onmessage = event => {
          if (toolsBleRef.current?.owner !== owner) return;
          if (event.data?.dispose) { void revokeToolsBle(); return; }
          if (viewRef.current !== 'tools') { void revokeToolsBle(); return; }
          owner.receive(event.data);
        };
        queue.forEach(value => owner.receive(value));
      })().catch(reject);
    };
    window.addEventListener('message', onOpen);
    return () => { window.removeEventListener('message', onOpen); void revokeToolsBle(); };
  }, [host, revokeToolsBle]);

  closeDeviceOverlayRef.current = () => {
    externalOperationRef.current++;
    external.resolveMac(null);
    if (!external.timer.status.connected) void external.timer.disconnect();
    if (!external.stackmat.status.listening) external.stackmat.stop();
    if (smartCube.phase === 'requesting' || smartCube.phase === 'connecting') void smartCube.disconnect();
    void smartCube.stopScan?.();
  };

  const scanSmartCubes = useCallback(async () => {
    const token = ++externalOperationRef.current;
    try {
      await revokeToolsBle();
      if (token !== externalOperationRef.current || viewRef.current === 'tools' || viewRef.current === 'account') return;
      await smartCube.scanDevices?.();
    } catch (error) {
      announce(copy.smartCubeError);
      throw error;
    }
  }, [announce, copy.smartCubeError, smartCube, revokeToolsBle]);

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
    metronome.setMetronomeHold('timer', timerMode === 1
      && timerMetronomeActive(timer.machine.phase, !!store?.settings.metronomeOn));
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
    trainingObservation: Boolean(timer.machine.trainingStartMode),
    lastPenalty,
    phase: timer.machine.phase,
    precision: resultPrecision,
    runningPrecision,
    timingEnabled,
  });
  let timerInstruction: string = timingEnabled ? copy.holdToArm : copy.nextScramble;
  const liveShareHistory = useMemo(() => timerLiveHistory(allSessionSolves), [allSessionSolves]);
  const liveShareApiUrl = mobileApiUrl;
  const liveShare = useTimerLiveShare({ apiUrl: liveShareApiUrl, websocketUrl: liveShareApiUrl('/v1/timer/live-shares/socket').replace(/^http/, 'ws') }, {
    snapshot: () => {
      const machine = timer.machine, now = performance.now();
      return {
        state: { context: store?.database.activeSessionId ?? '', sessionName: activePrintSessionName ?? '', event: activeEvent, scramble,
          phase: machine.phase, elapsedMs: machine.phase === 'running' ? Math.max(0, now - (machine.startedAtMs ?? now)) : machine.lastMs ?? 0,
          inspectionMs: machine.inspectionStartedAtMs === null ? 0 : Math.max(0, now - machine.inspectionStartedAtMs),
          inspectionSec: machine.inspectionSec ?? store?.settings.inspectionSec ?? 0, sampledAt: Date.now(), lastPenalty,
          trainingObservation: Boolean(machine.trainingStartMode), timingEnabled, hideTime: hideRunningTime, precision: resultPrecision, runningPrecision },
        cube: { connected: smartCube.phase === 'connected', facelets: smartCube.facelets || null, moves: smartCubeAnchor.moves, algAnchored: smartCubeAnchor.algAnchored,
          quaternion: smartCube.phase === 'connected' && store?.settings.gyroEnabled && smartCubeQuatRef.current
            ? applyOrientation(smartCubeQuatRef.current, calibrationReferenceRef.current,
              { basis: sensorBasisForBrand(smartCube.model), mirror: mirrorForBrand(smartCube.model) }) : null },
        attempt: machine.phase === 'stopped' ? timerLiveCompletedAttempt(liveCompletionRef.current, store?.database.activeSessionId ?? '', activeEvent) : captureTimerLiveAttempt(smartCubeAttemptProducerRef.current, machine.phase === 'running' && attemptRef.current ? {
          startedAt: attemptStartedAtRef.current, event: attemptRef.current.event, scramble: attemptRef.current.scramble,
          trainingStartMode: machine.trainingStartMode } : null), history: liveShareHistory,
      };
    },
    detail: (id, context) => {
      if (context !== store?.database.activeSessionId) return null;
      const solve = allSessionSolves.find(s => s.id === id);
      return solve ? timerLiveSolveDetail(solve) : null;
    },
  }, communityAvailable && !!store && timerMode === 1 && (timerVisible || view === 'history'));
  const regionRevokedLiveShare = useRef<string | null>(null);
  useEffect(() => {
    if (communityAvailability !== false) {
      regionRevokedLiveShare.current = null;
      return;
    }
    if (liveShare.busy || !liveShare.session || regionRevokedLiveShare.current === liveShare.session.id) return;
    regionRevokedLiveShare.current = liveShare.session.id;
    void liveShare.stop();
  }, [communityAvailability, liveShare.busy, liveShare.session, liveShare.stop]);
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
  const wcaCompetitionFilters = useTimerWcaCompetitionFilters({ today: toLocalIsoDate(), language, disabled: !sourceControlsEnabled });
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

  useEffect(() => {
    if (!sourceControlsEnabled || scrambleSource !== 'wca'
      || timerSupportsRealWcaScrambles(activeEvent)) return;
    invalidateCurrentScramble();
    setScrambleSource('random');
  }, [activeEvent, sourceControlsEnabled, scrambleSource, invalidateCurrentScramble]);

  const updateSettings = useCallback((changes: TimerSettingsUpdate) => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.updateSettings(changes).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [announce, applyStoreSnapshot, copy.actionFailed, recoverLatestStoreSnapshot]);

  const updateAppAppearance = useCallback((changes: Partial<AppearancePreferences>, fromAccount = false) => {
    const previous = appearanceRef.current;
    if (!previous) return;
    const next = { ...previous, ...changes };
    try {
      persistAppearancePreferences(next);
      appearanceRef.current = next;
      const animate = previous.theme !== next.theme || previous.palette !== next.palette
        || (previous.accent !== next.accent && !next.accent?.startsWith('#')) || previous.contrast !== next.contrast;
      runViewTransition(() => {
        if (appearanceRef.current === next) applyAppearancePreferences(next);
      }, animate, 'appearance');
      if (next.locale !== previous.locale) {
        setAccountFrameLocale(current => fromAccount ? current ?? previous.locale : null);
      }
      setAppearance(next);
      for (const surface of MOBILE_EMBED_SURFACES) {
        if (webBridgeReadyRef.current[surface] && (surface === 'tools' || accountInlineSettingsRef.current)) {
          webFrameRefs.current[surface]?.contentWindow?.postMessage(mobileEmbedAppearanceMessage(surface, next), SITE_ORIGIN);
        }
      }
      if (storeRef.current?.settings.theme !== next.theme || storeRef.current?.settings.language !== next.locale) {
        updateSettings({ theme: next.theme, language: next.locale });
      }
    } catch { announce(copy.actionFailed); }
  }, [announce, copy.actionFailed, updateSettings]);

  useEffect(() => {
    const receiveAccountAppearance = (event: MessageEvent) => {
      const accountWindow = webFrameRefs.current.account?.contentWindow;
      if (event.origin !== SITE_ORIGIN || !accountWindow || event.source !== accountWindow
        || !accountInlineSettingsRef.current || viewRef.current !== 'account' || !isAccountDetailsPage(accountPageRef.current)) return;
      const change = decodeMobileEmbedAppearance(event.data);
      if (change?.surface !== 'account' || JSON.stringify(change.preferences) === JSON.stringify(appearanceRef.current)) return;
      updateAppAppearance(change.preferences, true);
    };
    window.addEventListener('message', receiveAccountAppearance);
    return () => window.removeEventListener('message', receiveAccountAppearance);
  }, [updateAppAppearance]);

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
      activeRealWaiterRef.current?.cancel();
      mobileWcaPool.cancelSource(realSpecToWcaSource(currentSpec));
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
      && previous.genDiffEoAxis === next.genDiffEoAxis
      && previous.genDiffSteps.join('.') === next.genDiffSteps.join('.')) return;
    randomDifficultySettingsRef.current = next;
    invalidateCurrentScramble();
    setStore((current) => current ? {
      ...current,
      settings: { ...current.settings, ...next },
    } : current);
    updateSettings(next);
  }, [announce, copy.finishAttemptFirst, invalidateCurrentScramble, sourceControlsEnabled, updateSettings]);

  const updateManualScrambles = useCallback((value: string, selectManualSource = false) => {
    if (!sourceControlsEnabled || (selectManualSource && !canSwitchScramble())) {
      announce(copy.finishAttemptFirst);
      return;
    }
    const sourceChanged = selectManualSource && scrambleSourceRef.current !== 'manual';
    if (sourceChanged) {
      scrambleSourceRef.current = 'manual';
      setScrambleSource('manual');
    }
    if (manualScramblesRef.current === value) {
      if (sourceChanged) invalidateCurrentScramble();
      return;
    }
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
  }, [announce, applyStoreSnapshot, canSwitchScramble, copy.actionFailed, copy.finishAttemptFirst, invalidateCurrentScramble, recoverLatestStoreSnapshot, sourceControlsEnabled]);

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

  const openPractice = (entry: TimerPracticeContent, method: 'train' | 'memo' | 'recognize', select = false) => {
    if (!sourceControlsEnabled) return;
    const path = method === 'recognize' ? entry.recognizePath
      : select ? entry.selectPath ?? entry.runPath : entry.runPath ?? entry.path;
    if (!path) return;
    const [pathname, search] = path.split('?');
    const params = new URLSearchParams({ event: activeEvent, training: pathname });
    for (const [key, value] of new URLSearchParams(search)) params.set(`train.${key}`, value);
    if (method !== 'recognize') params.set('train.mode', method === 'memo' ? 'memo' : 'recap');
    openToolsRoute(`/timer?${params}`);
  };
  const choosePracticeContent = (id: string) => {
    if (!sourceControlsEnabled) return;
    const entry = practiceContents.find(item => item.id === id);
    if (!entry || entry.id === practiceContent?.id) return;
    if (!entry.timer) { openPractice(entry, 'train', !!entry.selectPath); return; }
    invalidateCurrentScramble();
    if (entry.id !== 'solve') setScrambleSource('random');
    if (entry.timer.type222) updateScramble222Type(entry.timer.type222);
    selectTimerEvent(entry.timer.event);
  };

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
    renderCaseLink: (path: string, label: ReactNode, className: string) => {
      const href = SITE_ORIGIN + (language === 'zh' ? '/zh' : '') + path;
      return <a href={href} className={className} onClick={event => {
        event.preventDefault();
        openToolsRoute(path);
      }}>{label}</a>;
    },
    writeClipboardText: host.writeClipboardText,
    replayUrl: communityAvailable ? async (solve: Solve) => {
      if (!communityAvailableRef.current) return null;
      const base = SITE_ORIGIN + (language === 'zh' ? '/zh' : '') + '/timer';
      const id = await createTimerReplayShare(solve, activeAuthSession?.token, { apiUrl: mobileApiUrl, fetcher: fetch });
      if (!communityAvailableRef.current) return null;
      return id ? base + '?share=' + id : encodeReplayUrl(solve, base);
    } : undefined,
    recordGyro: store?.settings.recordGyro ?? true,
    onEnableGyro: () => updateSettings({ recordGyro: true }),
  };
  const foldSolverOpen = activeEvent === '333' && foldSolverPreferred && view !== 'history';
  const recapSolve = useMemo(() => {
    // Solves in a session are chronological. Manual times have no moves to replay.
    if (upperPaneVisible) {
      for (let i = solves.length - 1; i >= 0; i--) if (solves[i].moves?.length) return solves[i];
      return null;
    }
    return solves.find(solve => solve.id === recapSolveId) ?? null;
  }, [solves, recapSolveId, upperPaneVisible]);
  const liveSolutionPanel = timer.machine.phase === 'running' && liveSolve ? (
    <TimerLiveSolutionPanel language={language}>
      <Suspense fallback={null}><ReconstructReport key={liveSolve.id} solve={liveSolve}
        host={reconstructionHost} isZh={language === 'zh'} live
        liveGyroSamples={liveSolve.liveGyroSamples} liveStageTarget={liveStageTarget} /></Suspense>
    </TimerLiveSolutionPanel>
  ) : null;
  const solveRecap = recapSolve && (
    <Suspense fallback={<Spinner label={{ en: 'Loading', zh: '加载中' }[language]} />}>
      <SolveRecap
        key={recapSolve.id}
        history={solves}
        host={reconstructionHost}
        isZh={language === 'zh'}
        onDismiss={() => { setRecapSolveId(null); if (upperPaneVisible) setView('history'); }}
        onFull={() => { setView('history'); openHistorySolveDetail(recapSolve); }}
        onReconFeedback={(reconOk) => updateSolve(recapSolve, { reconOk })}
        onUseScramble={useReconstructionScramble}
        solve={recapSolve}
      />
    </Suspense>
  );

  const visibleRecap = upperPaneVisible && (foldSolverOpen || view === 'history') ? null : liveSolutionPanel ?? solveRecap;
  const showFoldResults = upperPaneVisible && !foldSolverOpen && !visibleRecap;
  const showHistoryPanel = upperPaneVisible ? showFoldResults : view === 'history' && !liveSolutionPanel;
  const moveSolveToSession = useCallback(async (solve: Solve, targetSessionId: string): Promise<boolean> => {
    try {
      await commitSessionMutation(() => repository.moveSolveToSession(solve.id, targetSessionId));
      return true;
    } catch {
      announce(copy.actionFailed);
      return false;
    }
  }, [announce, commitSessionMutation, copy.actionFailed]);

  const addManualSolve = useCallback(async (value: TimerManualEntryValue) => {
    const revision = storeSnapshotGateRef.current.beginMutation();
    try {
      const data = await repository.addSolve(value);
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
      setManualEntryOpen(false);
      return true;
    } catch {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
      return false;
    }
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
      .then(text => shareOrDownloadBackup(host, text))
      .then(() => announce(copy.exportSuccess))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        announce(copy.actionFailed);
      });
  }, [announce, copy.actionFailed, copy.exportSuccess, host]);

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
      await shareOrDownloadBackup(host, text, { filename: `cuberoot-${format}-${date}.${extension}`, mime });
      announce(copy.exportSuccess);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      announce(copy.actionFailed);
    });
  }, [announce, copy.actionFailed, copy.exportSuccess, exportData, host, language]);

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
    if (appearanceRef.current) updateAppAppearance({ ...appearanceRef.current, locale: next });
  }, [language, updateAppAppearance]);

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
    compactViewport: compactSoloLayout,
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
    'more.bld-helper': () => setOpenOverlay(TIMER_OVERLAY_IDS.bldTool),
    'more.fullscreen': toggleTimerFullscreen,
    'more.manual-entry': openManualEntry,
    'more.replay': () => setReplayImportOpen(true),
    'more.solver': () => setOpenOverlay(TIMER_OVERLAY_IDS.solverTool),
    'more.bulk': () => setOpenOverlay(TIMER_OVERLAY_IDS.bulkTool),
    'more.print': () => printControllerRef.current?.print(),
    'more.clear-event': clearCurrentEvent,
  }), [
    compactSoloLayout,
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
    const modalState = () => timerSoloModalState(
      layoutEditingRef.current || viewRef.current === 'settings'
      || !timerVisibleRef.current
      || (openOverlayRef.current !== null && openOverlayRef.current !== TIMER_OVERLAY_IDS.stageSolver)
      || solverBlockingRef.current || statsOpenRef.current || historyModalOpenRef.current || replayBlockingRef.current
      || manualEntryOpenRef.current,
      openOverlayRef.current === TIMER_OVERLAY_IDS.stageSolver
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

  const hideRunningChrome = timerMode === 1 && store && timerHidesRunningUi(timer.machine.phase, store.settings);
  const canShowNavigation = Boolean(store && !fullscreen && !hideRunningChrome && (!floatingNavigation
    || (view !== 'settings' && !timerCoversNavigation && !manualEntryOpen && !toolsBlePicker)));
  const canShowToolsSearch = Boolean(floatingNavigation && (toolsSearchReady || webChrome.tools) && canShowNavigation && view === 'tools'
    && connection === 'online' && webSurfaceStatus.tools === 'ready');
  const toolsSearchExpanded = canShowToolsSearch && toolsSearchOpen;
  const searchKeyboardVisible = toolsSearchExpanded && dockedKeyboardTop !== null;
  const [accountInputViewport, setAccountInputViewport] = useState<number | null>(null);
  const signingIn = view === 'account' && (accountPage === 'sign-in' || accountPage === 'recover-password');
  useEffect(() => {
    if (!signingIn || host.addDockedKeyboardListener) return;
    const focused = () => {
      if (document.activeElement?.matches('.installed-account-signin input')) {
        setAccountInputViewport(previous => previous ?? visibleViewportHeight());
      }
    };
    const blurred = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Element && event.relatedTarget.matches('.installed-account-signin input'))) {
        setAccountInputViewport(null);
      }
    };
    document.addEventListener('focusin', focused);
    document.addEventListener('focusout', blurred);
    return () => {
      document.removeEventListener('focusin', focused);
      document.removeEventListener('focusout', blurred);
      setAccountInputViewport(null);
    };
  }, [signingIn, host]);
  const accountKeyboardVisible = signingIn && (dockedKeyboardTop !== null
    || (accountInputViewport !== null && accountInputViewport - viewportHeight > 80));
  const navVisible = canShowNavigation && !searchKeyboardVisible && !accountKeyboardVisible;
  const showToolsSearch = canShowToolsSearch && !searchKeyboardVisible;
  useLayoutEffect(() => {
    if (!toolsSearchExpanded || !host.addDockedKeyboardListener) {
      setSearchViewportTop(0);
      return;
    }
    const viewport = window.visualViewport;
    // WebKit can pan its visible viewport to reveal the focused iframe field.
    let contracted = false;
    const update = () => {
      setSearchViewportTop(Math.max(0, viewport?.pageTop ?? window.scrollY));
      if (!viewport || viewport.scale !== 1) return;
      const occlusion = window.innerHeight - viewport.height;
      if (occlusion > 80) contracted = true;
      else if (contracted && occlusion < 8) {
        contracted = false;
        setDockedKeyboardTop(null);
      }
    };
    viewport?.addEventListener('scroll', update);
    viewport?.addEventListener('resize', update);
    window.addEventListener('scroll', update);
    update();
    return () => {
      viewport?.removeEventListener('scroll', update);
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [host, toolsSearchExpanded]);
  useEffect(() => {
    if (view !== 'tools') setToolsSearchOpen(false);
  }, [view]);
  const primaryDestination = selectedView === 'tools' || selectedView === 'account' ? selectedView : 'timer';
  const keepNavigationCentered = host.floatingNavigation === 'draggable';
  const navHorizontalOffset = useTimerNavigationAvoidance(primaryNavRef,
    floatingNavigation && !sideNavigation && navVisible && view === 'timer' && timerMode === 1, keepNavigationCentered);
  const nativeNavigation = usePrimaryNavigation(host.primaryNavigation, primaryNavRef, {
    visible: navVisible,
    selected: primaryDestination,
    vertical: sideNavigation,
    horizontalOffset: navHorizontalOffset,
    disabled: timerContextMutationBusy,
    running: timer.machine.phase === 'running',
    language,
    viewport: hostViewport,
    viewportHeight,
    viewportTop: searchViewportTop,
    searchRef: toolsSearchRef,
    showSearch: showToolsSearch,
    searchExpanded: toolsSearchExpanded,
    dark: appearance ? resolveAppearanceScheme(appearance, systemDark) === 'dark' : systemDark,
  }, id => {
    if (id === 'search') {
      if (showToolsSearch) setToolsSearchOpen(open => !open);
    } else if (navVisible) selectPrimaryView(id);
  });
  const glassNavigation = (keepNavigationCentered || labeledCapsule) && !nativeNavigation;
  const draggableNavigation = glassNavigation && !sideNavigation;
  const navigationDragHandlers = useDraggablePrimaryNavigation(draggableNavigation && navVisible, selectPrimaryView);

  const desktopCommand = useRef<(command: string) => void>(() => {});
  useLayoutEffect(() => {
    desktopCommand.current = command => {
      if (command === 'timer' || command === 'tools' || command === 'account') {
        if (navVisible) selectPrimaryView(command);
        return;
      }
      if (view !== 'tools') return;
      if (command === 'refresh') {
        if (webSurfaceStatus.tools === 'ready') {
          webFrameRefs.current.tools?.contentWindow?.postMessage({ type: 'cuberoot:desktop:reload-tool' }, SITE_ORIGIN);
        } else retryWebSurface('tools');
      } else if (command === 'back') {
        if (webDepthRef.current.tools > 0) {
          webFrameRefs.current.tools?.contentWindow?.postMessage(mobileEmbedBackMessage('tools'), SITE_ORIGIN);
        } else if (desktopToolsHistory.current.length > 1) {
          const history = desktopToolsHistory.current;
          history.pop();
          const previous = history[history.length - 1]!;
          setWebSurfaceReloadUrl(current => ({ ...current, tools: previous }));
          setWebSurfaceRevision(current => ({ ...current, tools: current.tools + 1 }));
        } else if (toolsEntryRoute || !isEmbeddedTopBarRoute('tools', new URL(webLastHrefRef.current.tools || toolsWebUrl, SITE_ORIGIN).pathname)) {
          setToolsEntryRoute(null);
          setWebSurfaceReloadUrl(current => ({ ...current, tools: installedWebEntryUrl(siteUrl(language), language) }));
          setWebSurfaceRevision(current => ({ ...current, tools: current.tools + 1 }));
        }
      } else if (command === 'search' && showToolsSearch) {
        const frame = webFrameRefs.current.tools;
        frame?.focus();
        if (toolsSearchExpanded) frame?.contentWindow?.postMessage({ type: 'cuberoot:desktop:focus-search' }, SITE_ORIGIN);
        setToolsSearchOpen(true);
      } else if (command === 'escape' && toolsSearchExpanded) {
        setToolsSearchOpen(false);
        toolsSearchRef.current?.focus();
      }
    };
  });
  useEffect(() => {
    if (!host.listenDesktopNavigation) return;
    let active = true;
    const subscription = host.listenDesktopNavigation(language, command => {
      if (active) desktopCommand.current(command);
    }).catch(() => undefined);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN || event.source !== webFrameRefs.current.tools?.contentWindow) return;
      if (event.data?.type === 'cuberoot:desktop:tools-input' && ['back', 'escape'].includes(event.data.command)) {
        desktopCommand.current(event.data.command);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) desktopCommand.current('escape');
    };
    const onMouse = (event: MouseEvent) => {
      if (event.button === 3 && viewRef.current === 'tools') {
        event.preventDefault();
        desktopCommand.current('back');
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      active = false;
      void subscription.then(handle => handle?.remove());
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  }, [host, language]);

  const embeddedBottom = navVisible && !sideNavigation
    ? Math.max(0, primaryNavBottomInset - (hostViewport
      ? Math.max(0, viewportHeight - hostViewport.content.y - hostViewport.content.height) : 0)) + 8
    : 0;
  const frameInsetByHost = Boolean(hostViewport);
  useLayoutEffect(() => {
    if (!floatingNavigation) return;
    embeddedChromeRef.current = {
      insetByHost: frameInsetByHost ? true : undefined,
      toolsSearch: { expanded: toolsSearchExpanded, keyboard: searchKeyboardVisible || undefined },
      top: embeddedTopBar?.left !== undefined && embeddedTopBar.right !== undefined
        ? { left: embeddedTopBar.left, right: embeddedTopBar.right } : undefined,
      bottom: embeddedBottom,
    };
    for (const surface of MOBILE_EMBED_SURFACES) {
      if (webBridgeReadyRef.current[surface]) postWebSurfaceInit(surface);
    }
  }, [floatingNavigation, frameInsetByHost, embeddedTopBar?.left, embeddedTopBar?.right, embeddedBottom, toolsSearchExpanded, searchKeyboardVisible, postWebSurfaceInit]);

  if (!store && !loadError) {
    return <main className="loading-screen">{loadingMark ?? <strong>{copy.title}</strong>}</main>;
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
    store?.settings.scrambleClickAction ?? 'start',
    scramble.length > 0,
    scrambleReady,
    scrambleStatus?.retryable === true && currentScrambleEntry !== undefined,
  );
  const connectExternalTimer = async () => {
    const token = ++externalOperationRef.current;
    await revokeToolsBle();
    if (token !== externalOperationRef.current) return;
    await smartCube.disconnect();
    if (token !== externalOperationRef.current) return;
    external.stackmat.stop();
    await external.timer.connect();
  };
  const startStackmat = async (deviceId?: string) => {
    const token = ++externalOperationRef.current;
    await revokeToolsBle();
    if (token !== externalOperationRef.current) return;
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
      triggerRef={bluetoothButtonRef}
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
  const contentRect = hostViewport?.content;
  const frameUsesTopBar = view === 'tools' && (webChrome.tools || nativeTopBars.tools);
  const webTop = embeddedTopBar && frameUsesTopBar ? nativeTopBar?.y : undefined;
  const shellTop = webTop ?? contentRect?.y ?? 0;
  const trackSearchViewport = toolsSearchExpanded && (searchKeyboardVisible || searchViewportTop > 0);
  const shellBottom = searchKeyboardVisible ? dockedKeyboardTop : viewportHeight;
  const shellHeight = contentRect ? Math.max(1, Math.min(contentRect.y + contentRect.height, shellBottom) - shellTop) : Math.max(1, shellBottom);
  const shellViewport = mobileShellViewportLayout(shellHeight);
  const solverHintPanel = activeEvent === '333' ? <Suspense fallback={<Spinner label={{ en: 'Loading', zh: '加载中' }[language]} />}>
    <StageSolverDialog suppressRail={timer.machine.phase === 'running' && !idleSolverWide.current && !upperPaneVisible} foldSelection={upperPaneVisible ? { open: foldSolverOpen, select: selectFoldSolver } : undefined} scramble={scramble} language={language}
      sheetOpen={openOverlay === TIMER_OVERLAY_IDS.stageSolver} onSheetOpenChange={changeSolverSheet}
      onDismissChange={registerSolverDismiss} onBlockingChange={setSolverBlocking} autoOpenOnSolve={solverOpenRequest}
      onScrambleChange={sourceControlsEnabled && timerCanSwitchScramble(timer.machine.phase) ? value => updateManualScrambles(value, true) : undefined}
      autoCollapseOnReady={timer.machine.phase === 'ready' && smartCube.phase === 'connected'}
      onPrevScramble={previousDisplayedScramble} onNextScramble={nextDisplayedScramble} />
  </Suspense> : null;

  return (
    <main
      className={`app-shell app-shell--${dockHistory || view === 'settings' ? 'timer' : view}${shellViewport.classNameSuffix}${fullscreen ? ' app-shell--timer-fullscreen' : ''}${timer.machine.phase === 'running' ? ' is-solving' : ''}`}
      data-timer-hide-ui={hideRunningChrome ? '' : undefined}
      data-wide={wideLayout ? 'true' : undefined}
      data-side-navigation={sideNavigation ? '' : undefined}
      data-labeled-capsule={labeledCapsule ? '' : undefined}
      data-floating-navigation={floatingNavigation ? '' : undefined}
      data-navigation-covered={floatingNavigation && !navVisible ? '' : undefined}
      data-layout-editing={layoutEditing ? '' : undefined}
      style={{ ...shellViewport.style,
        ...(contentRect ? { position: 'fixed', left: contentRect.x, top: shellTop, width: contentRect.width, paddingTop: 0 } : {}),
        ...(trackSearchViewport ? {
          position: 'absolute',
          top: shellTop + searchViewportTop,
          left: contentRect?.x ?? 0,
          width: contentRect?.width ?? '100%',
        } : {}),
        '--solo-scramble-gap': `${store?.settings.soloLayout.scrambleGap ?? 16}px`,
        '--solo-source-gap': `${store?.settings.soloLayout.sourceGap ?? 16}px`,
        '--solo-timer-gap': `${store?.settings.soloLayout.timerGap ?? 20}px`,
        '--solo-cube-gap': `${store?.settings.soloLayout.cubeGap ?? 8}px`,
        '--solo-source-scale': store?.settings.soloLayout.sourceScale ?? 1,
        '--solo-cube-scale': store?.settings.soloLayout.cubeScale ?? 1,
      } as CSSProperties}
    >
      {appearance && <AppearanceBackground
        choice={resolveAppearanceScheme(appearance, systemDark) === 'dark' ? appearance.darkBackground : appearance.lightBackground}
        scheme={resolveAppearanceScheme(appearance, systemDark)} assetRoot={`${SITE_ORIGIN}/assets/home-backgrounds/v1`} />}
      <SiteCorners exclude=".maplibregl-map, [data-floating-navigation] > .primary-nav, .tools-search-toggle" containers=".cg-card, .rc-card, .recon-card, .sortable-card, .timer-workspace-panel" />
      {view === 'timer' && timerMode === 1 && timer.machine.phase === 'running' && smartCubeAttemptDeviceRef.current && (
        <button type="button" className="smart-cube-abort" data-no-timer aria-label={copy.stopSmartCube}
          onClick={() => {
            if (timer.abortRun()) smartCubeSoloController.setRunning(false);
          }}>
          <X size={24} aria-hidden="true" />
        </button>
      )}
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




      {openOverlay === TIMER_OVERLAY_IDS.videoReview && <InstalledTimerVideoReview
        language={language} appearance={appearance} scramble={activeEvent === '333' || activeEvent === '333oh' ? scramble : ''} origin={host.videoReviewOrigin ?? SITE_ORIGIN}
        onClose={() => setOpenOverlay(null)} onDismissChange={registerToolDismiss} />}
      <TimerWorkspace className="view-container" soloLayout={store?.settings.soloLayout} active={timerMode === 1 && timerVisible}
        data-fold-solver={upperPaneVisible && foldSolverOpen ? '' : undefined}
        data-live-reconstruction={liveSolutionPanel ? '' : undefined}
        panelOpen={upperPaneVisible ? showFoldResults : dockHistory && !liveSolutionPanel} recap={visibleRecap}>
        {view === 'appearance' && appearance && <AppAppearanceSettings value={appearance}
          effectiveTheme={resolveAppearanceScheme(appearance, systemDark)} backgroundAssetRoot={`${SITE_ORIGIN}/assets/home-backgrounds/v1`}
          onChange={updateAppAppearance} onClose={closeAppAppearance} />}
        {timerVisible && timerMode === 1 && (
          <TimerSoloPage tools={{
          tool: openOverlay === TIMER_OVERLAY_IDS.bulkTool ? 'bulk' : openOverlay === TIMER_OVERLAY_IDS.bldTool ? 'bld-helper' : openOverlay === TIMER_OVERLAY_IDS.solverTool ? 'solver' : null,
          event: activeEvent,
          scramble: scramble,
          language: language,
          randomOptions: { cnMode: store!.settings.cnMode, scramble222Mode },
          transport: { copy: text => host.writeClipboardText(text), download: (text, filename) => shareOrDownloadBackup(host, text, { filename, mime: 'text/plain' }) },
          onClose: () => setOpenOverlay(null),
          onDismissChange: registerToolDismiss
        }} title={copy.timer}
        topbar={{
          availableTopBar: hostViewport?.topBar,
          controls: (
                <>
                  {communityAvailable && <TimerLiveShareStatus controller={liveShare} language={language} />}
                  <button type="button" className="timer-solo-control" data-no-timer aria-haspopup="dialog"
                    aria-label={{ zh: '视频复盘', en: 'Video review' }[language]}
                    disabled={!sourceControlsEnabled}
                    onClick={() => setOpenOverlay(TIMER_OVERLAY_IDS.videoReview)}>
                    <Video size={18} aria-hidden="true" />
                  </button>
                  {smartCubeDeviceCenter}
                  <TimerSoloControls
                    project={<TimerPuzzlePicker
                        showArrow={false}
                        combineScrambleTypes
                        dataNoTimer
                        disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                        groups={eventPickerGroups}
                        onOpenChange={handleTimerOverlayOpenChange}
                        onSelect={id => {
                          if (id === '222') updateScramble222Type('full');
                          selectTimerEvent(id);
                        }}
                        open={openOverlay === TIMER_OVERLAY_IDS.puzzlePicker}
                        puzzleLabel={copy.puzzle}
                        scrambleTypeLabel={copy.scrambleType}
                        selectedEvent={activeEvent}
                      />}
                    content={<TimerPracticeContentPicker entries={practiceContents} selectedId={practiceContent?.id}
                        label={practiceContent?.title[language] ?? (language === 'zh' ? '请选择' : 'Choose content')}
                        disabled={!sourceControlsEnabled} language={language} onSelect={choosePracticeContent}
                        open={openOverlay === TIMER_OVERLAY_IDS.practiceContent} onOpenChange={handleTimerOverlayOpenChange} />}
                    method={practiceContent && (practiceContent.runPath || practiceContent.recognizePath) && <TimerPracticeMethodPicker
                        value="train" recall={!!practiceContent.runPath} recognize={!!practiceContent.recognizePath}
                        disabled={!sourceControlsEnabled} language={language}
                        open={openOverlay === TIMER_OVERLAY_IDS.practiceMethod}
                        onOpenChange={open => handleTimerOverlayOpenChange(open, { id: TIMER_OVERLAY_IDS.practiceMethod, reason: 'trigger' })}
                        onChange={method => { if (method !== 'train') openPractice(practiceContent, method); }} />}
                    source={<TimerScrambleSourceSelect
                        showArrow={false}
                        language={language}
                        trainingItems={practiceContent?.selectPath ? [{ value: 'cases', label: language === 'zh' ? '选定情况' : 'Selected cases' }] : []}
                        onTrainingChange={() => { if (practiceContent) openPractice(practiceContent, 'train', true); }}
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
                        realAvailable={timerSupportsRealWcaScrambles(activeEvent)}
                        realMenuContent={<div ref={setWcaSourceSlot} />}
                        realValue="wca"
                        triggerClassName="shell-players-select"
                        value={scrambleSource}
                      />}
                    afterSource={<span
                        className="mobile-wca-shared-controls"
                        data-no-timer
                        ref={setWcaDifficultyToggleSlot}
                      />}
                    layout={{
                      label: { en: 'Edit layout', zh: '调整布局' }[language],
                      editing: layoutEditing,
                      disabled: !layoutEditing && (timer.machine.phase !== 'idle' && timer.machine.phase !== 'stopped' || timerContextMutationBusy),
                      onToggle: () => {
                        if (layoutEditing) finishLayoutEditing();
                        else { layoutEditingRef.current = true; setLayoutEditing(true); }
                      },
                    }}
                    settings={{
                      label: copy.settings,
                      disabled: timer.machine.phase === 'running' || timerContextMutationBusy,
                      onOpen: () => { setSettingsCategory('timer'); setView('settings'); },
                    }}
                  />
                </>
              )}}
        stage={{
          className: "mobile-timer-stage timer-view",
          rankings: store!.settings.rankScopes.length > 0 && rankVisible && solves.length > 0
            ? <TimerRankBadge eventId={activeEvent} centis={rankCentis} type="single" country={rankCountry} isZh={language === 'zh'} scopes={store!.settings.rankScopes} wcaId={rankWcaId} host={timerRankHost} />
            : undefined,
          fullscreen: fullscreen,
          source: <>
                {scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent) && (
                  <fieldset
                    className="mobile-scramble-source-config mobile-wca-source-config"
                    disabled={!sourceControlsEnabled}
                  >
                    {wcaSourceSlot && createPortal(<TimerWcaSourceConfig
                      popupContainer={wcaSourceSlot}
                      competitionFilters={wcaCompetitionFilters}
                      adapter={wcaSourceAdapter}
                      competitionDisplayName={(competitionId, canonicalName) => (
                        displayMobileWcaCompetitionName(competitionId, canonicalName, language)
                      )}
                      disabled={!sourceControlsEnabled}
                      labels={wcaSourceLabels}
                      maxDate={toLocalIsoDate()}
                      minDate={TIMER_WCA_MIN_DATE}
                      onChange={updateWcaSourceSettings}
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
                    />, wcaSourceSlot)}
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
                  </>,
          statistics: <TimerStatRail
                  disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                  language={language}
                  summary={stats}
                  trainingSummaries={trainingStatistics}
                  onClick={() => { if (upperPaneVisible) selectFoldSolver(false, 'history'); else setView('history'); }}
                />}}
        solver={solverHintPanel}
        narrowRecap={!wideLayout ? liveSolutionPanel : undefined}
        timing={{
className: targetFeedbackClass,
ariaLabel: copy.timer,
colorClass: `${timerColorClass} tf-${store!.settings.timerFont}`,
fontScale: store!.settings.timerFontScale,
cornerAspect: smartCube.phase === 'connected' || smartCubeAttemptDeviceRef.current ? undefined : timerCubePreviewAspect(activeEvent, scramble),
cornerSlot: smartCube.phase === 'connected' || smartCubeAttemptDeviceRef.current ? (
                  <div className="timer-live-cube">
                    <LiveCubeState
                      algAnchored={smartCubeAnchor.algAnchored}
                      displayOrientation={trainingOrientation}
                      calibrateToken={smartCubeCalibration}
                      calibrationReference={calibrationReferenceRef.current}
                      facelets={smartCube.facelets || (smartCubeAttemptDeviceRef.current ? smartCubeLastFaceletsRef.current : null)}
                      language={language}
                      mode={store!.settings.liveCubeView}
                      moves={[...smartCubeAnchor.moves]}
                      liveSource={smartCubeAnchorController}
                      onViewChange={setSmartCubeRenderedView}
                      useGyro={store!.settings.gyroEnabled}
                      sensorBasis={sensorBasisForBrand(smartCube.model ?? smartCubeAttemptDeviceRef.current?.model)}
                      mirror={mirrorForBrand(smartCube.model ?? smartCubeAttemptDeviceRef.current?.model)}
                      quatRef={store!.settings.gyroEnabled ? smartCubeQuatRef : undefined}
                    />
                  </div>
                ) : store!.settings.showCubePreview && !store!.settings.soloLayout.hideCubePreview && scrambleReady && scramble.length > 0 ? (
                  <TimerCubePreview
                    ariaLabel={copy.cubeState}
                    event={activeEvent}
                    fill
                    scramble={applyOrientationPrefix(scramble, preScrambleFor(activeEvent, store!.settings.preScr, store!.settings.preScrT))}
                    visualization={store!.settings.prefer3D ? '3D' : '2D'}
                  />
                ) : undefined,
digits: <SegmentTime text={timerText} />,
interactive: scrambleReady,
onContextMenu: (event) => event.preventDefault(),
phase: timer.machine.phase,
scrambleSlot: (
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
                    timingEnabled={scrambleClickEffect === 'start'}
                    onActivate={scrambleClickEffect === 'next' ? nextDisplayedScramble
                      : scrambleClickEffect === 'copy' ? () => {
                        if (!canSwitchScramble()) return;
                        void host.writeClipboardText(scrambleText).then(() => announce(copy.copied))
                          .catch(() => announce(copy.actionFailed));
                      } : undefined}
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
                    {currentReal && scrambleSource === 'wca' && !store!.settings.soloLayout.hideCompetitionInfo && (
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
                ),
surfaceRef: surfaceRef,
cubeFooter: timer.machine.phase === 'running' && liveSolve && <div ref={setLiveStageTarget} className="timer-live-stage" data-no-timer />,
children: <>
                <TimerTrainingTimingStatus mode={trainingTimingMode()} phase={timer.machine.phase}
                  matched={smartCubeGuidance.match === true} language={language} />
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
              </>
}}
        afterTiming={<>
              <div className="surface-chrome">
                <TimerGoalProgress solves={allSessionSolves} goal={trainingSettings.dailySolveGoal} localize={value => value[language]} />
                <TimerRoundPanel solves={trainingRound.solves} config={trainingSettings.round} targetMs={targetMs} event={activeEvent} precision={resultPrecision} onReset={trainingRound.start} localize={value => value[language]} />
              </div>


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

              <MobileSmallPuzzleHints
                event={activeEvent}
                language={language}
                phase={timer.machine.phase}
                scramble={scramble}
              />
            </>}

      />

        )}

        {view === 'timer' && typeof timerMode === 'number' && timerMode >= 2 && (
          <LocalBattleMode
            onlineAvailable={communityAvailable}
            scrambleProvider={battleScrambleProvider}
            onExportRounds={rounds => shareOrDownloadBackup(host, buildLocalBattleCsv(rounds, [], timerMode as number), {
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
              if (mode === 'net' && !communityAvailableRef.current) return;
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

        {view === 'timer' && timerMode === 'net' && communityAvailable && (
          <NetBattleMode
            sound={timerSound}
            timingSettings={{
              value: store!.settings, onChange: updateSettings,
              voiceAvailable: timerSound.isVoiceAvailable(), onWarmup: timerSound.warmupSound,
              onPreview: () => timerSound.play('start'),
            }}
            historyReplays={netHistoryReplays}
            renderAttemptReplay={(solve, onClose) => <Suspense fallback={null}>
              <ReconstructModal solve={solve} host={reconstructionHost} isZh={language === 'zh'} onClose={onClose} />
            </Suspense>}
            smartCubeSettings={store!.settings}
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

        {view === 'account' && !isAccountDetailsPage(accountPage) && (
          <div style={{ '--account-nav-clearance': `${embeddedBottom}px` } as CSSProperties}>
            <AccountHome auth={auth} language={language} page={accountPage} onNavigate={navigateAccount}
              onSettings={openAppAppearance} onLogout={() => void logoutEverywhere()}
              openPolicy={(policy) => void host.openExternal(siteRouteUrl(language, `/${policy}`)).catch(() => announce(copy.actionFailed))} />
          </div>
        )}

        {MOBILE_EMBED_SURFACES.map((surface) => {
          if (!openedWebViews[surface]) return null;
          const status = webSurfaceStatus[surface];
          const title = surface === 'tools' ? copy.tools : copy.my;
          const canonicalUrl = surface === 'tools' ? toolsWebUrl : accountWebUrl;
          const frameUrl = webSurfaceReloadUrl[surface] ?? canonicalUrl;
          const showState = connection !== 'online' || status !== 'ready' || (surface === 'account' && !accountDetailsReady);
          const showLoadingMark = connection !== 'offline' && status !== 'error';
          const stateLabel = connection === 'offline'
            ? copy.offline
            : status === 'error' ? copy.actionFailed : copy.checking;
          return (
            <section
              aria-label={title}
              className={`web-surface${surface === 'account' ? ' web-surface--account' : ''}`}
              hidden={view !== surface || (surface === 'account' && !accountDetails)}
              key={surface}
            >
              {surface === 'account' && (
                <header className="installed-account-detail-header">
                  <AccountBack language={language} onBack={() => navigateAccount('home')} />
                  <strong>{accountPage === 'security'
                    ? ({ zh: '账号与安全', en: 'Account & security' })[language]
                    : accountPage === 'membership' ? ({ zh: '订阅 Pro', en: 'Subscribe to Pro' })[language]
                      : ({ zh: '我的空间', en: 'My space' })[language]}</strong>
                </header>
              )}
              {showState && view === surface && (
                <div className="web-surface-state" role={status === 'error' ? 'alert' : 'status'}>
                  {showLoadingMark ? (
                    <>
                      {loadingMark ?? <LoadingBrandMark />}
                      <span className="sr-only">{surface === 'tools' ? copy.loadingTools : copy.checking}</span>
                    </>
                  ) : <p>{stateLabel}</p>}
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
                allow={surface === 'tools'
                  ? `clipboard-write; fullscreen; camera; microphone${host.listenDesktopNavigation ? '; focus-without-user-activation https://cuberoot.me' : ''}`
                  : 'clipboard-write; fullscreen'}
                aria-hidden={showState}
                inert={showState && (surface === 'account' || host.generativeAiDisabled)}
                key={`${surface}-${webSurfaceRevision[surface]}`}
                name={(host.generativeAiDisabled ? MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES : MOBILE_EMBED_FRAME_NAMES)[surface]}
                onLoad={() => {
                  if (surface === 'tools') {
                    void revokeToolsBle();
                    setToolsSearchReady(false);
                    setToolsSearchOpen(false);
                  } else {
                    accountInlineSettingsRef.current = false;
                  }
                  webBridgeReadyRef.current[surface] = false;
                  setNativeTopBars(current => current[surface] ? { ...current, [surface]: false } : current);
                  setWebChrome(current => current[surface] ? { ...current, [surface]: false } : current);
                  if (connection === 'offline') {
                    webSurfaceLoadedRef.current[surface] = false;
                    return;
                  }
                  if (surface === 'account') {
                    clearAccountSyncTimeout();
                    accountSyncInFlightRef.current = null;
                  }
                  if (host.generativeAiDisabled) {
                    webSurfaceLoadedRef.current[surface] = false;
                    setWebSurfaceStatus((current) => ({ ...current, [surface]: 'loading' }));
                  } else {
                    markWebSurfaceLoaded(surface);
                  }
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

        {showHistoryPanel && (
          <section className="history-view timer-workspace-panel" aria-label={copy.history} data-no-timer>
            <TimerResultsTabs value={historyTab === 'history' ? 'times' : 'stats'} language={language}
              onChange={tab => { historyWorkspaceRef.current?.dismiss(); setHistoryTab(tab === 'times' ? 'history' : 'stats'); }}
              onClose={upperPaneVisible && activeEvent !== '333' && !solveRecap ? undefined : () => {
                historyWorkspaceRef.current?.dismiss();
                if (upperPaneVisible) selectFoldSolver(activeEvent === '333');
                else setView('timer');
              }} />
            <div className="timer-workspace-panel-body timer-results-panel-body">
            {historyTab === 'history' && <TimerResultsSessionBar
              language={language} query={historyQuery} onQueryChange={setHistoryQuery}
              activeSessionId={store!.database.activeSessionId}
              event={activeEvent}
              host={sessionHost}
              labels={sessionLabels}
              onOpenChange={handleTimerOverlayOpenChange}
              onOperationError={() => announce(copy.actionFailed)}
              open={openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher}
              sessions={store!.database.sessions}
              viewportBottomInset={primaryNavBottomInset}
            />}
            {historyTab !== 'history' && <TimerStatisticsWorkspace compact view={historyTab} language={language} event={activeEvent} solves={solves}
              labels={timerStatsPanelLabels(language)} rollingColumns={store!.settings.statsRollingColumns}
              onRollingColumnsChange={statsRollingColumns => updateSettings({statsRollingColumns})}
              sessionData={store!.database.sessions.map(session => ({session,byEvent:store!.database.dataBySession[session.id] ?? {}}))}
              activeSessionId={store!.database.activeSessionId} onOpenFull={() => setStatsOpen(true)} viewportBottomInset={primaryNavBottomInset} />}
            <div hidden={historyTab !== 'history'}>
            <TimerHistoryWorkspace desktopCommands={Boolean(host.listenDesktopNavigation)} minimal searchQuery={historyQuery} onSearchQueryChange={setHistoryQuery} onBlockingChange={setHistoryModalOpen} quickMenuOpen={openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu} onQuickMenuOpenChange={handleTimerOverlayOpenChange} ref={historyWorkspaceRef} historyContextKey={historyContext} solves={solves} isZh={language === 'zh'}
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
            </div>
          </section>
        )}
            {openOverlay === TIMER_OVERLAY_IDS.solveDetail
              && historyDetailSolve
              && historyDetailIndex >= 0 && (
              <TimerSolveDetailModal
                autoFocusComment={historyDetail?.autoFocusComment}
                closeRequested={historyDetail?.closeRequested}
                onEntered={historyDetail?.autoRecap ? () => autoRecapDismissGestureRef.current.markDisplayed() : undefined}
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
                onUseScramble={useReconstructionScramble}
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

        {view === 'settings' && (
          <TimerSettingsPanel language={language} activeCategory={settingsCategory}
            onCategoryChange={setSettingsCategory} onClose={() => setView('timer')}
            actions={moreItems}
            playersControl={
              <TimerPlayersSelect
                ariaLabel={copy.onePlayer}
                disabled={timer.machine.phase !== 'idle'
                  && timer.machine.phase !== 'stopped'}
                onlineLabel={copy.online}
                onlineAvailable={communityAvailable}
                onChange={(mode) => {
                  if (mode === 'net' && !communityAvailableRef.current) return;
                  timerModeRef.current = mode;
                  setTimerMode(mode);
                  setView('timer');
                }}
                playerLabel={copy.players}
                value={1}
              />
            }
            categories={[
              'timer', 'smart-cube', 'scramble', 'training', 'appearance', 'sound', 'data', 'advanced',
            ]}>
            {settingsCategory === 'appearance' && <>
            <div className="settings-group">
              <button type="button" className="settings-row" onClick={openAppAppearance}>
                <span className="settings-row-label">{copy.appAppearance}</span>
                <SettingsIcon aria-hidden="true" size={20} />
              </button>
            </div>

            <TimerSoloAppearanceSections language={language} value={store!.settings} onChange={updateSettings}
              renderBooleanControl={({ disabled, label, onChange, value }) => (
                <TimerPillToggle ariaLabel={label} disabled={disabled} onChange={onChange} value={value} />
              )}
              rankings={<TimerRankSettings language={language} scopes={store!.settings.rankScopes} country={store!.settings.rankCountry} accountCountry={rankAccountCountry} onScopes={rankScopes => updateSettings({ rankScopes })} onCountry={rankCountry => updateSettings({ rankCountry })} login={!activeAuthSession ? () => { if (selectPrimaryView('account')) navigateAccount('sign-in'); } : undefined} />}
            />

            </>}
            <TimerTimingSettingsSections active={settingsCategory === 'timer'}
              liveShare={communityAvailable && <TimerLiveShareSettings controller={liveShare} language={language} copy={text => host.writeClipboardText(text)}
                watchBase={`${SITE_ORIGIN}${language === 'zh' ? '/zh' : ''}/timer/watch`} />}
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

            {settingsCategory === 'timer' && <TimerSoloResultSettings language={language}
              columns={store!.settings.statsRollingColumns} onColumnsChange={statsRollingColumns => updateSettings({ statsRollingColumns })} />}
            {settingsCategory === 'smart-cube' && <>
              <TimerSmartCubeSettingsFields
                localize={(value) => value[language]}
                onChange={updateSettings}
                orientationControl={<TimerPreScrambleSettings only="training" value={store!.settings} onChange={updateSettings} localize={value => value[language]} />}
                renderBooleanControl={({ disabled, label, onChange, value }) => (
                  <TimerPillToggle ariaLabel={label} disabled={disabled} onChange={onChange} value={value} />
                )}
                value={store!.settings}
              />

            </>}
            {settingsCategory === 'scramble' && (
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
                <TimerPreScrambleSettings only="normal" value={store!.settings} onChange={updateSettings} localize={value => value[language]} />
                <TimerColorNeutralSetting event={activeEvent} value={store!.settings.cnMode} onChange={cnMode => updateSettings({ cnMode })} localize={value => value[language]} />
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
                <TimerGoalSettings value={store!.settings} event={activeEvent} onChange={updateSettings} localize={value => value[language]} trainingTiming />
              </section>
            )}

            {settingsCategory === 'training' && <TimerRoundSettings value={store!.settings} onChange={patch => updateSettings(current => ({ round: { ...current.round, ...patch } }))} localize={value => value[language]} />}

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
                      onClick={event => {
                        event.preventDefault();
                        selectPrimaryView('account');
                      }}
                      rel="noreferrer"
                    >
                      {copy.manageAccount}
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
                    onClick={() => { if (selectPrimaryView('account')) navigateAccount('sign-in'); }}
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
                disabled={!sourceControlsEnabled} owner={activeAuthSession?.token ?? null} login={() => { if (selectPrimaryView('account')) navigateAccount('sign-in'); }}
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
              <a className="site-link" href={siteUrl(language)} onClick={event => {
                event.preventDefault();
                openToolsRoute('/');
              }}>
                {copy.openFullSite}
              </a>
            </div>

            <div className="settings-section settings-meta">
              <a className="site-link" href={privacyUrl(language)} onClick={event => {
                event.preventDefault();
                openToolsRoute('/privacy');
              }}>
                {copy.privacy}
              </a>
              <a className="site-link" href="mailto:yrmfxc@gmail.com" onClick={openExternal}>{copy.support}</a>
              {host.icpFilingNumber && (
                <a className="site-link" href="https://beian.miit.gov.cn/" onClick={openExternal} rel="noreferrer" target="_blank">
                  {copy.icpFiling} {host.icpFilingNumber}<span aria-hidden="true">↗</span>
                </a>
              )}
              <span>{copy.version} {host.version}</span>
            </div>
            </>}
          </TimerSettingsPanel>
        )}
        {layoutEditing && store && <TimerSoloLayoutEditor surfaceRef={surfaceRef}
          contentKey={`${scramble}:${store.settings.showCubePreview}:${smartCube.phase}`}
          getSettings={() => storeRef.current!.settings} updateSettings={updateSettings}
          language={language} onDone={finishLayoutEditing}
          hideableRegions={smartCube.phase === 'connected' || smartCubeAttemptDeviceRef.current ? ['sourceGap'] : ['sourceGap', 'cubeGap']} />}
      </TimerWorkspace>

      {replayImportOpen && <TimerReplayImportModal language={language} onClose={() => setReplayImportOpen(false)}
        load={(input, signal) => readTimerReplay(input, Object.values(store!.database.dataBySession[store!.database.activeSessionId] ?? {}).flat(), { apiUrl: mobileApiUrl, fetcher: fetch }, signal)}
        onOpen={setReplaySolve} />}
      {replaySolve && <Suspense fallback={null}><ReconstructModal solve={replaySolve} history={store!.database.dataBySession[store!.database.activeSessionId]?.[replaySolve.event] ?? []}
        host={reconstructionHost} isZh={language === 'zh'} onUseScramble={useReconstructionScramble}
        onReconFeedback={reconOk => setReplaySolve(current => current ? { ...current, reconOk } : null)} onClose={() => setReplaySolve(null)} /></Suspense>}
      {toolsBlePicker && <TimerSmartCubeDeviceModal
        language={language}
        availableDevices={toolsBlePicker.devices}
        snapshot={{ phase: 'idle' }}
        onScan={toolsBlePicker.scan}
        onConnect={toolsBlePicker.select}
        onClose={toolsBlePicker.cancel}
      />}
      {openOverlay === TIMER_OVERLAY_IDS.smartCubeDevice && (
        <TimerSmartCubeDeviceModal
          anchorRef={bluetoothButtonRef}
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
          onResetGyro={smartCube.quaternion ? resetSmartCubeOrientation : undefined}
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

      <nav {...navigationDragHandlers} data-timer-hide-while-running className="primary-nav" aria-label={copy.title} ref={primaryNavRef}
        data-site-surface={floatingNavigation && !glassNavigation ? 'popover' : undefined}
        data-glass-shell={glassNavigation ? '' : undefined}
        data-drag-lens={draggableNavigation ? '' : undefined}
        data-selected={floatingNavigation ? primaryDestination : undefined}
        data-native-navigation={nativeNavigation ? '' : undefined}
        aria-hidden={nativeNavigation || !navVisible || undefined} inert={nativeNavigation || !navVisible}
        style={sideNavigation && hostViewport?.bar ? { left: hostViewport.bar.x,
          width: hostViewport.bar.width, ...(floatingNavigation
            ? { top: Math.min(hostViewport.bar.y + hostViewport.bar.height, viewportHeight) - 148 }
            : { top: hostViewport.bar.y, height: Math.min(hostViewport.bar.height, Math.max(0, viewportHeight - hostViewport.bar.y)) }) }
          : { '--app-nav-offset-x': `${navHorizontalOffset}px` } as CSSProperties}>
        {glassNavigation && <>
          <PrimaryNavigationOptics siteWide />
          <span className="primary-nav-surface af-glass-surface" data-af-glass-optics="lens" data-af-glass-role="popover" aria-hidden="true" />
        </>}
        {draggableNavigation && <NavigationDragLens />}
        <button
          data-destination="timer"
          aria-label={copy.timer}
          aria-current={primaryDestination === 'timer' ? 'page' : undefined}
          data-no-timer
          disabled={timerContextMutationBusy}
          onClick={() => selectPrimaryView('timer')}
          type="button"
        >
          <Clock3 aria-hidden="true" size={20} />
          {showNavigationLabels && <span>{copy.timer}</span>}
        </button>
        <button
          data-destination="tools"
          aria-label={copy.tools}
          aria-current={primaryDestination === 'tools' ? 'page' : undefined}
          data-no-timer
          disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
          onClick={() => selectPrimaryView('tools')}
          type="button"
        >
          <Grid2X2 aria-hidden="true" size={20} />
          {showNavigationLabels && <span>{copy.tools}</span>}
        </button>
        <button
          data-destination="account"
          aria-label={copy.my}
          aria-current={primaryDestination === 'account' ? 'page' : undefined}
          data-no-timer
          disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
          onClick={() => selectPrimaryView('account')}
          type="button"
        >
          <UserRound aria-hidden="true" size={20} />
          {showNavigationLabels && <span>{copy.my}</span>}
        </button>
      </nav>

      {showToolsSearch && <button type="button" className="tools-search-toggle" ref={toolsSearchRef}
        data-site-surface="popover" data-native-navigation={nativeNavigation ? '' : undefined}
        aria-label={copy.siteSearch} aria-expanded={toolsSearchExpanded} aria-hidden={nativeNavigation || undefined}
        inert={nativeNavigation} data-no-timer
        style={sideNavigation && hostViewport?.bar ? {
          left: hostViewport.bar.x,
          top: Math.max(hostViewport.bar.y, Math.min(hostViewport.bar.y + hostViewport.bar.height, viewportHeight) - 208),
          width: hostViewport.bar.width,
          height: hostViewport.bar.width,
        } : undefined}
        onClick={() => setToolsSearchOpen(open => !open)}>
        <Search aria-hidden="true" />
        <X aria-hidden="true" />
      </button>}

      {manualEntryOpen && (host.manualEntrySheet ? (
        <NativeTimerManualEntry
          host={host.manualEntrySheet}
          currentScramble={scramble}
          event={activeEvent}
          labels={manualEntryLabels}
          saveError={copy.actionFailed}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={addManualSolve}
        />
      ) : (
        <TimerManualEntryModal
          currentScramble={scramble}
          event={activeEvent}
          labels={manualEntryLabels}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={addManualSolve}
        />
      ))}

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
