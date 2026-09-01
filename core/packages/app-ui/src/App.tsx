import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import {
  createSmartCubeGuidanceController,
  type SmartCubeGuidanceState,
} from '@cuberoot/shared/smart-cube/scramble-guidance';
import {
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedAuthRequest,
  decodeMobileEmbedExternal,
  decodeMobileEmbedNavigation,
  decodeMobileEmbedWebSessionResult,
  MOBILE_EMBED_FRAME_NAMES,
  mobileEmbedAuthClearMessage,
  mobileEmbedBackMessage,
  mobileEmbedInitMessage,
  mobileEmbedWebSessionMessage,
  type MobileEmbedSurface,
} from '@cuberoot/shared/mobile-embed';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { EventIcon } from '@cuberoot/event-icon/event';
import {
  MAX_TIMER_BACKUP_BYTES,
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  DEFAULT_TIMER_BY_STEPS_SETTINGS,
  SCRAMBLE_222_TYPE_CATALOG,
  SCRAMBLE_222_TYPES,
  SCRAMBLE_222_UI_LABELS,
  TIMER_BY_STEPS_UI_LABELS,
  STEP_METRICS,
  TIMER_EVENT_PICKER_GROUPS,
  TIMER_HISTORY_PENALTIES,
  TIMER_HISTORY_QUICK_ACTION_COPY,
  TIMER_HISTORY_QUICK_ACTION_IDS,
  TIMER_SCRAMBLE_CLICK_TITLE_COPY,
  TIMER_SETTING_CATEGORY_CONTRACTS,
  WCA_SCRAMBLE_222_TYPES,
  activeTimerSolves,
  advanceTimerSourceRevision,
  createTimerSourceRevision,
  createTimerHistoryFilters,
  filterTimerHistorySolves,
  formatTimerTimingDisplay,
  generateTimerScramble,
  histBack,
  histForward,
  histPush,
  normalizeTimerByStepsSettings,
  normalizeTimerWcaSourceSettings,
  parseManualScrambleQueue,
  resolveKeymap,
  summarize,
  takeManualScramble,
  timerEventNxnSize,
  timerEventIdFromSelector,
  timerEventPickerName,
  timerManualSourceIdentity,
  timerPrintScrambleSource,
  timerManualEntryCopy,
  timerHistoryCopyText,
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
  stepMetricsFor,
  stepPuzzleOf,
  stageLabel,
  timerByStepsIdentity,
  timerScrambleCapability,
  timerScrambleAllowsEmptySlot,
  timerScrambleClickEffect,
  timerWcaRoundShortLabel,
  timerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleEventId,
  timerWcaScrambleSourceLine,
  timerWcaSupportsOptimal,
  variantLabel,
  TIMER_COLOR_NAMES,
  TIMER_WCA_MIN_DATE,
  timerSupportsRealWcaScrambles,
  timerSupportsSmartCubeAutoTiming,
  timerTracksTrainerCase,
  toggleTimerHistoryPenalty,
  type EventId,
  type Penalty,
  type Solve,
  type SolveResult,
  type Scramble222Mode,
  type Scramble222Type,
  type ScrambleHistory,
  type TimerHistoryFilters,
  type TimerHistoryQuickActionId,
  type TimerGestureActionId,
  type TimerPhase,
  type TimerStoreData,
  type TimerStoreSettings,
  type TimerByStepsSettings,
  type TimerHostSharedScrambleProviderId,
  type TimerManualEntryValue,
  type TimerColorLetter,
  type TimerNon222StepPuzzle,
  type TimerWcaDifficultyCoverage,
  type TimerWcaSourceSettings,
} from '@cuberoot/shared/timer';
import {
  ClearButton,
  DateRangeInput,
  Flag,
  GestureWheel,
  ManualScrambleQueueEditor,
  SegmentTime,
  TimerDeviceActions,
  TimerInfoToast,
  TimerHistoryCommentEditor,
  TimerHistoryRow,
  TimerManualEntryModal,
  TimerMoreMenu,
  TimerPillToggle,
  TimerPlayersSelect,
  TimerPuzzlePicker,
  TimerPrintController,
  TimerScramble222Config,
  TimerScrambleClickActionSetting,
  TimerScrambleStrip,
  TimerByStepsConfig,
  TimerScrambleSourceSelect,
  TimerSessionSwitcher,
  TimerStatRail,
  TimerStatsPanel,
  TimerTimingSettingsSections,
  TimerTopbar,
  TimerWcaSourceConfig,
  TimerWcaDifficultyConfig,
  TimerWcaOptimalToggle,
  TIMER_OVERLAY_IDS,
  TimingSurface,
  shouldIgnoreTimerTarget,
  timerKeyboardTargetContext,
  useGestureWheel,
  type TimerHistoryQuickMenuLabels,
  type TimerHistoryRowQuickMenu,
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
} from '@cuberoot/timer-ui';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import {
  Clock3,
  Grid2X2,
  Settings as SettingsIcon,
  UserRound,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

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
} from './data/timer-repository';
import {
  mergeRealScramblePool,
  normalizeRealScrambleSourceSpec,
  readRealScrambleCache,
  realScrambleSourceKey,
  writeRealScrambleCache,
  type RealScramble,
  type RealScrambleSourceSpec,
} from './data/real-scramble-pool';
import { startRealScrambleFetchRetry } from './data/real-scramble-retry';
import {
  LatestSnapshotGate,
  type SnapshotRevision,
} from './data/latest-snapshot-gate';
import { nextMobileCube222SpecialScramble } from './data/cube222-special-pool';
import { nextMobileCube222ByStepsScramble } from './data/cube222-steps-pool';
import { nextMobileCstimerNonWcaScramble } from './data/cstimer-nonwca-pool';
import { nextMobileNon222ByStepsScramble } from './data/non222-steps-pool';
import { mobileBackAction } from './mobile-back';
import { MobileVisibleScrambleRequestGate } from './data/visible-scramble-request-gate';
import { timerSessionSwitcherLabels } from './timer-session-labels';
import { MobileSmallPuzzleHints } from './MobileSmallPuzzleHints';
import {
  createMobileScrambleHistoryEntry,
  mobileScrambleAttemptSnapshot,
  planMobileScrambleHistoryDisplay,
  replaceMobileScrambleHistoryEntry,
  type MobileScrambleAvailability as ScrambleAvailability,
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
import { solveMobileSmartCubeFixup } from './smart-cube/fixup';

const SITE_ORIGIN = 'https://cuberoot.me';
const MOBILE_EMBED_SURFACES = ['tools', 'account'] as const;
const MOBILE_EMBED_INIT_RETRY_MS = 400;
const MOBILE_EMBED_INIT_RETRIES = 25;
const MOBILE_EMBED_AUTH_TIMEOUT_MS = 10_000;
const repository = new TimerRepository(new IndexedDbTimerStoreDriver());

type AppView = 'timer' | 'tools' | 'account' | 'history' | 'settings';
type PrimaryView = Extract<AppView, 'timer' | 'tools' | 'account'>;
type ConnectionState = 'checking' | 'offline' | 'online';
type WebSurfaceStatus = 'loading' | 'ready' | 'error';
type RealPoolFillOutcome = 'ready' | 'confirmed-empty' | 'exhausted' | 'cancelled';

interface RealPoolRequest {
  cancel(): void;
  promise: Promise<RealPoolFillOutcome>;
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

function downloadBackup(text: string): void {
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function ScrambleCube({ alt, event, scramble }: { alt: string; event: EventId; scramble: string }) {
  const cubeSize = timerEventNxnSize(event);
  const svg = useMemo(() => {
    if (cubeSize === null) return null;
    try {
      return renderFromSimpleQuery({ setup: scramble, cubeSize, view: 'net' });
    } catch {
      // Manual queue entries are intentionally opaque. An unrenderable line
      // remains a valid timer scramble and is still frozen into the solve.
      return null;
    }
  }, [cubeSize, scramble]);
  if (!svg) return null;
  return (
    <span
      aria-label={alt}
      className="mobile-cube-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
    />
  );
}

async function shareOrDownloadBackup(text: string): Promise<void> {
  const filename = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], filename, { type: 'application/json' });
  const shareData: ShareData = { files: [file], title: 'CubeRoot timer backup' };
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  downloadBackup(text);
}

function MobileHistoryItem({
  copy,
  focusComment,
  index,
  language,
  onDelete,
  onQuickDelete,
  onCopy,
  onMove,
  onQuickMenuOpenChange,
  onCommentFocusHandled,
  onUpdate,
  moveTargets,
  quickMenuOpen,
  solve,
}: {
  copy: (typeof COPY)[SupportedLanguage];
  focusComment: boolean;
  index: number;
  language: SupportedLanguage;
  onDelete(solve: Solve): void;
  onQuickDelete(solve: Solve): void;
  onCopy(solve: Solve): void;
  onMove(solve: Solve, targetSessionId: string): void;
  onQuickMenuOpenChange(open: boolean, details: TimerOverlayOpenChangeDetails): void;
  onCommentFocusHandled(): void;
  onUpdate(solve: Solve, changes: Pick<Solve, 'penalty' | 'comment'>): void;
  moveTargets: readonly { id: string; name: string }[];
  quickMenuOpen: boolean;
  solve: Solve;
}) {
  const [expanded, setExpanded] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusComment) return;
    setExpanded(true);
    const frame = window.requestAnimationFrame(() => {
      commentRef.current?.focus();
      onCommentFocusHandled();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusComment, onCommentFocusHandled]);

  const date = useMemo(() => new Intl.DateTimeFormat(
    language === 'zh' ? 'zh-CN' : 'en',
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  ).format(solve.ts), [language, solve.ts]);

  const quickMenuLabels = useMemo<TimerHistoryQuickMenuLabels>(() => ({
    actions: Object.fromEntries(TIMER_HISTORY_QUICK_ACTION_IDS.map((actionId) => (
      [actionId, TIMER_HISTORY_QUICK_ACTION_COPY[actionId][language]]
    ))) as Record<TimerHistoryQuickActionId, string>,
    menu: copy.moreActions,
  }), [copy.moreActions, language]);

  const quickMenu = useMemo<TimerHistoryRowQuickMenu>(() => ({
    labels: quickMenuLabels,
    onChangePenalty: (entry, penalty) => onUpdate(entry, {
      penalty,
      comment: entry.comment,
    }),
    onComment: () => {
      setExpanded(true);
      window.requestAnimationFrame(() => commentRef.current?.focus());
    },
    onCopyScramble: onCopy,
    onDelete: onQuickDelete,
    onOpenChange: onQuickMenuOpenChange,
    open: quickMenuOpen,
    variant: 'sheet',
    viewportBottomInset: 64,
  }), [onCopy, onQuickDelete, onQuickMenuOpenChange, onUpdate, quickMenuLabels, quickMenuOpen]);

  return (
    <article className="mobile-history-item">
      <TimerHistoryRow
        index={index}
        onActivate={() => setExpanded((value) => !value)}
        quickMenu={quickMenu}
        solve={solve}
        trailing={(
          <time className="mobile-history-date" dateTime={new Date(solve.ts).toISOString()}>
            {date}
          </time>
        )}
      />
      {expanded && (
        <div className="history-row-detail">
          <p className="history-scramble">{solve.scramble}</p>
          <label className="comment-field">
            <span>{copy.comment}</span>
            <TimerHistoryCommentEditor
              ariaLabel={copy.comment}
              maxLength={500}
              onBlurSave={(comment) => onUpdate(solve, {
                penalty: solve.penalty,
                comment: comment || undefined,
              })}
              ref={commentRef}
              value={solve.comment}
            />
          </label>
          {moveTargets.length > 0 && (
            <label className="history-move-field">
              <span>{copy.moveToSession}</span>
              <select
                data-history-action-id="solve.detail.move-session"
                onChange={(event) => {
                  if (event.target.value) onMove(solve, event.target.value);
                }}
                value=""
              >
                <option value="">{copy.chooseSession}</option>
                {moveTargets.map((target) => (
                  <option key={target.id} value={target.id}>{target.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="history-actions">
            <button className="text-action text-action--danger" onClick={() => onDelete(solve)} type="button">
              {copy.delete}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function App({ host }: { host: InstalledAppHost }) {
  const [store, setStore] = useState<TimerStoreData | null>(null);
  const [lastResult, setLastResult] = useState<SolveResult | null>(null);
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [view, setView] = useState<AppView>('timer');
  const [timerMode, setTimerMode] = useState<TimerPlayersValue>(1);
  const [battleModeActive, setBattleModeActive] = useState(false);
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
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [wcaDifficultyCoverage, setWcaDifficultyCoverage] = useState<TimerWcaDifficultyCoverage>('idle');
  const realPoolsRef = useRef(new Map<string, RealScramble[]>());
  const realCurrentBySourceRef = useRef(new Map<string, RealScramble>());
  const realRequestsRef = useRef(new Map<string, RealPoolRequest>());
  const hydratedRealSourcesRef = useRef(new Set<string>());
  const [scrambleSource, setScrambleSource] = useState<ScrambleSource>('wca');
  const [scrambleHistory, setScrambleHistory] = useState<ScrambleHistory<MobileScrambleHistoryEntry>>({
    list: [],
    idx: -1,
  });
  const scrambleHistoryRef = useRef(scrambleHistory);
  const scrambleRequestRef = useRef(0);
  const randomScrambleGateRef = useRef(new MobileVisibleScrambleRequestGate());
  const [toast, setToast] = useState('');
  const [scrambleCopied, setScrambleCopied] = useState(false);
  const scrambleCopiedTimerRef = useRef<number | null>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; undo(): void } | null>(null);
  const [historyCommentSolveId, setHistoryCommentSolveId] = useState<string | null>(null);
  const [openOverlay, setOpenOverlay] = useState<TimerOverlayId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(fullscreen);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<TimerHistoryFilters>(
    createTimerHistoryFilters,
  );
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);
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
  const accountLoginRequestedRef = useRef(false);
  const accountSyncInFlightRef = useRef<{ requestId: string; token: string } | null>(null);
  const accountSyncTimeoutRef = useRef<number | null>(null);
  const accountSyncedTokenRef = useRef<string | null>(null);
  const viewRef = useRef(view);
  const timerModeRef = useRef<TimerPlayersValue>(timerMode);
  const battleSmartCubeHandlersRef = useRef<BattleSmartCubeHandlers | null>(null);
  const battleModeActiveRef = useRef(battleModeActive);
  const timingRunningRef = useRef(false);
  const timingEnabledRef = useRef(true);
  const timerPhaseRef = useRef<TimerPhase>('idle');
  const cancelTimerArmRef = useRef<() => boolean>(() => false);
  const timerContextMutationBusyRef = useRef(false);
  const openOverlayRef = useRef<TimerOverlayId | null>(openOverlay);
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
  const setBattleSmartCubeHandlers = useCallback((handlers: BattleSmartCubeHandlers | null) => {
    battleSmartCubeHandlersRef.current = handlers;
  }, []);
  const activeEvent = store?.settings.event ?? '333';
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
  // Unmapped retained-Real events (Ivy/Gear) use their local random provider.
  // Keep their by-steps identity in React dependencies too: the WCA source key
  // is intentionally just `unmapped|event`, so it cannot trigger regeneration.
  const byStepsSourceSignature = timerByStepsIdentity(
    activeEvent,
    scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)
      ? 'wca'
      : 'random',
    byStepsSettings,
    scramble222Mode,
  );
  const wcaSourceSettings: TimerWcaSourceSettings = store?.settings
    ?? DEFAULT_TIMER_WCA_SOURCE_SETTINGS;
  const wcaSourceSignature = `${realScrambleSourceKey({
    event: activeEvent,
    scramble222Mode,
    scramble222Type,
    ...byStepsSettings,
    ...wcaSourceSettings,
  })}|unindexed:${wcaDifficultyCoverage === 'unindexed' ? 1 : 0}`;
  const storeLoaded = store !== null;
  const solves = store ? activeTimerSolves(store, activeEvent) : [];
  const activePrintSessionName = useMemo(() => store?.database.sessions.find(
    (session) => session.id === store.database.activeSessionId,
  )?.name, [store]);
  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const stats = useMemo(() => summarize(solves, activeEvent), [activeEvent, solves]);
  const filteredHistory = useMemo(
    () => filterTimerHistorySolves(solves, historyFilters),
    [historyFilters, solves],
  );
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
    colorMode: {
      cn: copy.colorModeCn,
      dual: copy.colorModeDual,
      quad: copy.colorModeQuad,
      single: copy.colorModeSingle,
    },
    colorName: (color: TimerColorLetter) => TIMER_COLOR_NAMES[color][language],
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
  const manualEntryLabels = useMemo(() => timerManualEntryCopy(language), [language]);
  const dateRangeLabels = useMemo(() => dateRangeInputLabels(language), [language]);
  const sessionLabels = useMemo(() => timerSessionSwitcherLabels(language), [language]);
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
  const scrambleSourceRef = useRef(scrambleSource);
  const manualScramblesRef = useRef(manualScrambles);
  const [manualSourceInitialRevision] = useState(() => createTimerSourceRevision(
    globalThis.crypto.randomUUID(),
    manualScrambles,
  ));
  const manualSourceRevisionRef = useRef(manualSourceInitialRevision);
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
    activeEventRef.current = data.settings.event;
    scramble222ModeRef.current = data.settings.scramble222Mode;
    scramble222TypeRef.current = data.settings.scramble222Type;
    byStepsSettingsRef.current = {
      genByStepsOn: data.settings.genByStepsOn,
      genStepsMetric: data.settings.genStepsMetric,
      genSteps: data.settings.genSteps,
    };
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
    if (source === 'wca') return `wca|${realScrambleSourceKey(realSpecFor(event))}`;
    if (source === 'manual') {
      return timerManualSourceIdentity(event, manualSourceRevisionRef.current);
    }
    if (event === '222') {
      return `random|222|${scramble222ModeRef.current}|${scramble222TypeRef.current}|${
        scramble222TypeRef.current === 'full'
          ? timerByStepsIdentity('222', 'random', byStepsSettingsRef.current, scramble222ModeRef.current)
          : ''
      }`;
    }
    return `random|${event}|${timerByStepsIdentity(event, 'random', byStepsSettingsRef.current)}`;
  }, [realSpecFor]);

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
      'availability' | 'caseId' | 'currentReal' | 'scramble' | 'sourceSnapshot'
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
  const scrambleAvailability = currentScrambleEntry?.availability ?? 'loading';

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

  const refillRealPool = useCallback((input: RealScrambleSourceSpec): Promise<RealPoolFillOutcome> => {
    const spec = normalizeRealScrambleSourceSpec(input);
    const sourceKey = realScrambleSourceKey(spec);
    const inFlight = realRequestsRef.current.get(sourceKey);
    if (inFlight) return inFlight.promise;
    const run = startRealScrambleFetchRetry(spec);
    let request!: Promise<RealPoolFillOutcome>;
    request = run.result.then((outcome): RealPoolFillOutcome => {
      if (outcome.kind !== 'ready') return outcome.kind;
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
      return 'ready';
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
    const requested222Mode = scramble222ModeRef.current;
    const requested222Type = scramble222TypeRef.current;
    const requestedBySteps = normalizeTimerByStepsSettings(
      event,
      'random',
      byStepsSettingsRef.current,
    );
    const requestedIdentity = entry.sourceIdentity;
    const request = {
      event,
      scramble222Mode: requested222Mode,
      scramble222Type: requested222Type,
    } as const;
    const use222BySteps = event === '222'
      && requested222Type === 'full'
      && requestedBySteps.genByStepsOn;
    const stepPuzzle = stepPuzzleOf(event);
    const non222ByStepsEvent: TimerNon222StepPuzzle | null = requestedBySteps.genByStepsOn
      && stepPuzzle
      && stepPuzzle !== '222'
      ? stepPuzzle
      : null;
    const eventCapability = timerScrambleCapability(event);
    const useCstimerNonWcaWorker = eventCapability?.kind === 'shared'
      && eventCapability.provider === 'cstimer-nonwca';
    const specialistDependencies = (event === '222' && (requested222Type !== 'full' || use222BySteps))
      || non222ByStepsEvent !== null
      || useCstimerNonWcaWorker
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
            if (provider === 'cstimer-nonwca') {
              return nextMobileCstimerNonWcaScramble(requestedEvent, controller.signal);
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
    void generateTimerScramble(request, specialistDependencies).then((result) => {
      if (controller.signal.aborted
        || requestId !== scrambleRequestRef.current
        || activeEventRef.current !== event
        || scrambleSourceRef.current !== expectedSource
        || scrambleIdentityFor(expectedSource, event) !== requestedIdentity) return;
      if (!result.ok) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
          availability: result.code === 'unsupported-event' ? 'unsupported' : 'error',
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
          scramble: '',
        });
        return;
      }
      replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
        availability: 'ready',
        caseId: timerTracksTrainerCase(event) ? result.metadata?.caseId ?? null : null,
        currentReal: null,
        scramble: result.scramble,
      });
    }).catch(() => {
      if (!controller.signal.aborted
        && requestId === scrambleRequestRef.current
        && activeEventRef.current === event
        && scrambleSourceRef.current === expectedSource
        && scrambleIdentityFor(expectedSource, event) === requestedIdentity) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' });
      }
    }).finally(() => {
      randomScrambleGateRef.current.finish(controller);
    });
  }, [replaceScrambleHistoryEntry, scrambleIdentityFor]);

  const fillScrambleHistoryEntry = useCallback((entry: MobileScrambleHistoryEntry) => {
    randomScrambleGateRef.current.cancel();
    const requestId = ++scrambleRequestRef.current;
    const { event, source, sourceIdentity } = entry;

    if (source === 'manual') {
      const taken = takeManualScramble(
        parseManualScrambleQueue(manualScramblesRef.current),
        manualCursorRef.current,
      );
      manualCursorRef.current = taken.nextCursor;
      replaceScrambleHistoryEntry(entry.id, sourceIdentity, {
        availability: 'ready',
        caseId: null,
        currentReal: null,
        scramble: taken.scramble,
      });
      return;
    }
    if (source === 'random') {
      generateRandomScramble(entry, requestId);
      return;
    }

    // Canonical Web behavior: projects without a WCA-pool mapping keep the
    // Real source selected but use that same project's local provider. This is
    // not a network-error fallback, and it must never turn into a 333 scramble.
    if (!timerSupportsRealWcaScrambles(event)) {
      generateRandomScramble(entry, requestId);
      return;
    }

    const realSpec = normalizeRealScrambleSourceSpec(realSpecFor(event));
    const sourceKey = realScrambleSourceKey(realSpec);
    const requestedIdentity = entry.sourceIdentity;
    const pool = realPoolFor(realSpec);
    const activate = (next: RealScramble) => {
      realCurrentBySourceRef.current.set(sourceKey, next);
      replaceScrambleHistoryEntry(entry.id, requestedIdentity, {
        availability: 'ready',
        caseId: null,
        currentReal: next,
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
      if (outcome === 'cancelled') return;
      if (outcome === 'confirmed-empty') {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'empty' });
        return;
      }
      if (outcome === 'exhausted') {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' });
        return;
      }
      const loaded = realPoolFor(realSpec).shift();
      if (!loaded) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' });
        return;
      }
      activate(loaded);
    }).catch(() => {
      if (requestId === scrambleRequestRef.current
        && activeEventRef.current === event
        && scrambleSourceRef.current === 'wca'
        && realScrambleSourceKey(realSpecFor(activeEventRef.current)) === sourceKey) {
        replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' });
      }
    });
  }, [
    generateRandomScramble,
    realPoolFor,
    realSpecFor,
    refillRealPool,
    replaceScrambleHistoryEntry,
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

  useEffect(() => {
    if (openOverlay === null) return;
    const available = openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher
      || openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu
      ? view === 'history'
      : view === 'timer' && (
        openOverlay !== TIMER_OVERLAY_IDS.wcaCompetition
        || (scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent))
      );
    if (!available) {
      openOverlayRef.current = null;
      setOpenOverlay(null);
    }
  }, [activeEvent, openOverlay, scrambleSource, view]);

  const clearWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    webHandshakeRetryRef.current[surface]?.();
    webHandshakeRetryRef.current[surface] = null;
  }, []);

  const beginWebSurfaceHandshake = useCallback((surface: MobileEmbedSurface) => {
    clearWebSurfaceHandshake(surface);
    if (connection !== 'online') return;
    const postInit = () => webFrameRefs.current[surface]?.contentWindow?.postMessage(
      mobileEmbedInitMessage(surface),
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
    webFrameRefs.current.account?.contentWindow?.postMessage(
      mobileEmbedAuthClearMessage(),
      SITE_ORIGIN,
    );
    await auth.logout();
  }, [auth.logout, clearAccountSyncTimeout]);

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

  useEffect(() => {
    return observeVisibleViewportHeight(setViewportHeight);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN) return;
      const accountFrame = webFrameRefs.current.account;
      const accountSource = Boolean(accountFrame && event.source === accountFrame.contentWindow);

      const authRequest = decodeMobileEmbedAuthRequest(event.data);
      if (accountSource && authRequest) {
        accountLoginRequestedRef.current = true;
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
    if (!accountLoginRequestedRef.current || auth.busy) return;
    accountLoginRequestedRef.current = false;
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
      if (current === 'timer' && timerModeRef.current !== 1) {
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
        openOverlayRef.current = null;
        setOpenOverlay(null);
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
  }, [announce, copy.finishAttemptFirst, host]);

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
  const attemptRef = useRef<MobileScrambleAttemptSnapshot | null>(null);
  const completeSolve = useCallback((result: SolveResult) => {
    setLastResult(result);
    setLastPenalty(result.autoPenalty);
    const displayedEntry = currentScrambleEntry;
    const attempt = attemptRef.current
      ?? (displayedEntry ? mobileScrambleAttemptSnapshot(displayedEntry) : null);
    attemptRef.current = null;
    if (!attempt) {
      announce(copy.actionFailed);
      return;
    }
    advanceDisplayedScramble();
    const revision = storeSnapshotGateRef.current.beginMutation();
    void repository.addSolve({
      ...(attempt.caseId ? { caseId: attempt.caseId } : {}),
      event: attempt.event,
      inspectionMs: result.inspectionMs || undefined,
      penalty: result.autoPenalty,
      scramble: attempt.scramble,
      scrambleSource: attempt.scrambleSource,
      timeMs: result.timeMs,
    }).then((data) => {
      storeSnapshotGateRef.current.commitIfLatest(revision, data, applyStoreSnapshot);
    }).catch(() => {
      void recoverLatestStoreSnapshot(revision).catch(() => undefined);
      announce(copy.actionFailed);
    });
  }, [
    advanceDisplayedScramble,
    announce,
    applyStoreSnapshot,
    copy.actionFailed,
    currentScrambleEntry,
    recoverLatestStoreSnapshot,
  ]);

  const timer = useTimerController({
    canStart: attemptCanStart,
    enabled: view === 'timer'
      && timerMode === 1
      && timingEnabled
      && !moreOpen
      && !manualEntryOpen
      && openOverlay === null
      && !timerContextMutationBusy,
    holdMs: store?.settings.holdMs ?? 550,
    inspectionSec: store?.settings.inspectionSec ?? 0,
    onComplete: completeSolve,
    onStart: () => {
      const entry = scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx];
      if (!entry
        || entry.availability !== 'ready'
        || entry.event !== activeEventRef.current
        || entry.source !== scrambleSourceRef.current
        || entry.sourceIdentity !== scrambleIdentityFor(entry.source, entry.event)) return;
      attemptRef.current = mobileScrambleAttemptSnapshot(entry);
    },
  });
  timingRunningRef.current = timer.machine.phase === 'running';
  timerPhaseRef.current = timer.machine.phase;
  cancelTimerArmRef.current = timer.cancelArm;
  host.useTimerEffects(timerMode === 1
    ? timer.machine.phase
    : battleModeActive ? 'running' : 'idle');

  useEffect(() => {
    const onDocumentPointerDown = (event: PointerEvent) => {
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

  const smartCubeTarget = useMemo(() => (
    timerSupportsSmartCubeAutoTiming(activeEvent) && scramble.length > 0
      ? smartCubeTargetFacelets(scramble)
      : null
  ), [activeEvent, scramble]);
  const smartCubeGuidanceController = useMemo(() => createSmartCubeGuidanceController({
    onChange: setSmartCubeGuidance,
    solve: solveMobileSmartCubeFixup,
  }), []);
  const smartCube = host.useSmartCube({
    language,
    onMove: (move, timestamp, facelets) => {
      if (timerModeRef.current !== 1) {
        battleSmartCubeHandlersRef.current?.onMove(move, timestamp, facelets);
        return;
      }
      if (!timerSupportsSmartCubeAutoTiming(activeEvent)) return;
      // An armed attempt consumes its first solve turn before scramble guidance
      // sees the deliberately off-target cube state.
      if (timer.startFromCube(timestamp)) {
        smartCubeGuidanceController.setRunning(true);
        return;
      }
      if (timerPhaseRef.current === 'running') {
        smartCubeGuidanceController.setRunning(true);
        return;
      }
      const observation = smartCubeGuidanceController.observe(facelets);
      if (observation.completedNow && timingEnabled) timer.armFromCube();
      console.info('[smart-cube] move', move);
    },
    onSolved: (timestamp) => {
      if (timerModeRef.current !== 1) {
        battleSmartCubeHandlersRef.current?.onSolved(timestamp);
        return;
      }
      if (timingEnabled && timerSupportsSmartCubeAutoTiming(activeEvent)) timer.stopFromCube(timestamp);
    },
  });
  const smartCubeScrambleMatch = timerMode === 1
    && timer.machine.phase !== 'running'
    && smartCube.phase === 'connected'
    && smartCubeTarget
    ? smartCubeGuidance.match
    : null;

  useLayoutEffect(() => {
    smartCubeGuidanceController.setContext(timerMode === 1 && smartCubeTarget && currentScrambleEntry
      ? { id: currentScrambleEntry.id, scramble, targetFacelets: smartCubeTarget }
      : null);
  }, [currentScrambleEntry?.id, scramble, smartCubeGuidanceController, smartCubeTarget, timerMode]);

  useLayoutEffect(() => {
    const connected = smartCube.phase === 'connected';
    smartCubeGuidanceController.setConnected(connected);
    return () => smartCubeGuidanceController.setConnected(false);
  }, [smartCube.phase, smartCubeGuidanceController]);

  useLayoutEffect(() => {
    smartCubeGuidanceController.setRunning(timer.machine.phase === 'running');
  }, [smartCubeGuidanceController, timer.machine.phase]);

  useLayoutEffect(() => {
    if (smartCube.facelets) smartCubeGuidanceController.syncFacelets(smartCube.facelets);
  }, [
    currentScrambleEntry?.id,
    scramble,
    smartCube.facelets,
    smartCube.phase,
    smartCubeGuidanceController,
    smartCubeTarget,
    timer.machine.phase,
    timerMode,
  ]);

  const toggleSmartCube = useCallback(() => {
    if (!timerSupportsSmartCubeAutoTiming(activeEvent)) {
      announce(copy.smartCubeOnly333);
      return;
    }
    if (smartCube.phase === 'connected') {
      void smartCube.disconnect().then(() => announce(copy.smartCubeDisconnected));
      return;
    }
    void smartCube.connect()
      .then((name) => announce(copy.smartCubeConnected(name)))
      .catch(() => announce(copy.smartCubeError));
  }, [activeEvent, announce, copy, smartCube]);

  const displayMs = timer.machine.phase === 'running'
    ? Math.max(0, timer.nowMs - (timer.machine.startedAtMs ?? timer.nowMs))
    : timer.machine.lastMs ?? 0;
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
  const scrambleText = scrambleAvailability === 'loading'
    ? scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)
      ? copy.loadingReal
      : copy.generatingScramble
    : scrambleAvailability === 'unsupported'
      ? copy.scrambleUnsupported
      : scrambleAvailability === 'empty'
        ? copy.realScrambleEmpty
      : scrambleAvailability === 'error'
        ? scrambleSource === 'wca' && timerSupportsRealWcaScrambles(activeEvent)
          ? copy.realScrambleFailed
          : copy.actionFailed
        : scrambleSource === 'manual' && scramble.length === 0
          ? copy.manualPasteHint
          : activeEvent === 'custom' && scramble.length === 0
            ? '—'
            : scramble;

  const invalidateCurrentScramble = useCallback(() => {
    randomScrambleGateRef.current.cancel();
    scrambleRequestRef.current += 1;
    attemptRef.current = null;
    timer.cancelArm();
    applyScrambleHistory({ list: [], idx: -1 });
  }, [applyScrambleHistory, timer.cancelArm]);

  const updateSettings = useCallback((changes: Partial<TimerStoreSettings>) => {
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

  const updateSolve = useCallback((solve: Solve, changes: Pick<Solve, 'penalty' | 'comment'>) => {
    const last = solvesRef.current[solvesRef.current.length - 1];
    if (last?.id === solve.id) setLastPenalty(changes.penalty);
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

  const updateHistoryFilter = useCallback(<Key extends keyof TimerHistoryFilters,>(
    key: Key,
    value: TimerHistoryFilters[Key],
  ) => {
    setHistoryFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleHistoryPenalty = useCallback((penalty: Penalty) => {
    setHistoryFilters((current) => ({
      ...current,
      penalties: toggleTimerHistoryPenalty(current.penalties, penalty),
    }));
  }, []);

  const clearHistoryFilters = useCallback(() => {
    setHistoryFilters(createTimerHistoryFilters());
  }, []);

  const moveSolveToSession = useCallback((solve: Solve, targetSessionId: string) => {
    void commitSessionMutation(() => repository.moveSolveToSession(solve.id, targetSessionId))
      .catch(() => announce(copy.actionFailed));
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

  const deleteSolve = useCallback((solve: Solve) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    void deleteSolveNow(solve);
  }, [copy.deleteConfirm, deleteSolveNow]);

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
    setHistoryFilters(createTimerHistoryFilters());
    setHistoryCommentSolveId(last.id);
    setView('history');
  }, []);

  const copyCurrentScramble = useCallback(() => {
    const entry = scrambleHistoryRef.current.list[scrambleHistoryRef.current.idx];
    if (!entry?.scramble) return;
    void host.writeClipboardText(formatScrambleForEvent(entry.event, entry.scramble))
      .then(() => {
        announce(copy.copiedScramble);
        setScrambleCopied(true);
        if (scrambleCopiedTimerRef.current !== null) {
          window.clearTimeout(scrambleCopiedTimerRef.current);
        }
        scrambleCopiedTimerRef.current = window.setTimeout(() => {
          scrambleCopiedTimerRef.current = null;
          setScrambleCopied(false);
        }, 1200);
      })
      .catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, copy.copiedScramble, host]);

  useEffect(() => () => {
    if (scrambleCopiedTimerRef.current !== null) {
      window.clearTimeout(scrambleCopiedTimerRef.current);
    }
  }, []);

  const copyHistoryScramble = useCallback((solve: Solve) => {
    void host.writeClipboardText(timerHistoryCopyText(solve))
      .then(() => announce(copy.copiedScramble))
      .catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, copy.copiedScramble, host]);

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

  const commitImportedStore = useCallback((
    revision: SnapshotRevision,
    data: TimerStoreData,
  ): boolean => storeSnapshotGateRef.current.commitIfLatest(revision, data, (latest) => {
    // Import/undo can replace every source-affecting setting. Make the swap one
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
  }), [applyStoreSnapshot, invalidateCurrentScramble, scrambleIdentityFor]);

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
    drillActive: false,
    event: activeEvent,
    fullscreen,
    solveCount: solves.length,
  }, language, {
    'more.marks': () => openToolsRoute('/timer/marks'),
    'more.stats-mobile': () => setView('history'),
    'more.language-mobile': toggleMoreLanguage,
    'more.bld-helper': () => openToolsRoute('/alg/3bld/helper'),
    'more.fullscreen': toggleTimerFullscreen,
    'more.manual-entry': openManualEntry,
    'more.solver': () => openToolsRoute('/scramble/solver?event=333'),
    'more.bulk': () => openToolsRoute('/scramble/gen?mode=batch'),
    'more.print': () => printControllerRef.current?.print(),
    'more.clear-event': clearCurrentEvent,
  }), [
    activeEvent,
    clearCurrentEvent,
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
      viewRef.current !== 'timer'
      || openOverlayRef.current !== null
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
        case 'mark-bld-memo':
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
          setHistoryFilters(createTimerHistoryFilters());
          setHistoryCommentSolveId(solve.id);
          setView('history');
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      execute(timerKeyDownDecision({
        bldMemoActive: false,
        input: event,
        keymap: keymapRef.current,
        modal: modalState(),
        multiStageActive: false,
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
    changeLastPenalty,
    deleteLastSolve,
    nextDisplayedScramble,
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
    'copy-scramble': copyCurrentScramble,
  };

  const { wheelRef: gestureWheelRef } = useGestureWheel({
    active: storeLoaded
      && view === 'timer'
      && openOverlay === null
      && !moreOpen
      && !manualEntryOpen,
    surfaceRef,
    canGesture: () => timerCanUseGestureWheel(timerPhaseRef.current),
    enabledFor: () => timerGestureActionStates({
      hasLastSolve: solvesRef.current.length > 0,
      hasPreviousScramble: scrambleHistoryRef.current.idx > 0,
    }).map((action) => action.enabled),
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
    store!.settings.scrambleClickAction,
    scramble.length > 0,
    scrambleReady,
    scrambleAvailability === 'error' && currentScrambleEntry !== undefined,
  );
  const shellViewport = mobileShellViewportLayout(viewportHeight);

  return (
    <main
      className={`app-shell app-shell--${view}${shellViewport.classNameSuffix}${fullscreen ? ' app-shell--timer-fullscreen' : ''}`}
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
      {(view === 'history' || view === 'settings') && (
        <header className="app-titlebar">
          <strong>{view === 'history' ? copy.history : copy.settings}</strong>
          <button
            aria-label={copy.close}
            className="app-titlebar-close"
            onClick={() => setView('timer')}
            type="button"
          ><X aria-hidden="true" size={20} /></button>
          <span
            aria-label={connection === 'checking' ? copy.checking : connection === 'online' ? copy.online : copy.offline}
            className={`network network--${connection}`}
            role="status"
          />
        </header>
      )}

      <div className="view-container">
        {view === 'timer' && timerMode === 1 && (
          <section className="timer-view" aria-labelledby="timer-title">
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
                    viewportBottomInset={96}
                  />
                  <button
                    aria-label={copy.settings}
                    className="timer-toolbar-icon"
                    data-no-timer
                    disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                    onClick={() => setView('settings')}
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
                </>
              )}
            />
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
                  wcaEventId={timerWcaScrambleEventId(activeEvent)}
                />
                {activeEvent !== '222'
                  && timerWcaSupportsOptimal(timerWcaScrambleEventId(activeEvent)) && (
                  <div className="timer-wca-difficulty-top-row mobile-wca-optimal-row">
                    <span className="timer-wca-difficulty-label">{copy.optimalScramble}</span>
                    <TimerWcaOptimalToggle
                      ariaLabel={copy.optimalScramble}
                      disabled={!sourceControlsEnabled}
                      onChange={(wcaUseOptimal) => updateWcaSourceSettings({ wcaUseOptimal })}
                      value={wcaSourceSettings.wcaUseOptimal}
                      wcaEventId={timerWcaScrambleEventId(activeEvent)}
                    />
                  </div>
                )}
                <TimerWcaDifficultyConfig
                  adapter={mobileTimerWcaDifficultyAdapter}
                  disabled={!sourceControlsEnabled}
                  labels={wcaDifficultyLabels}
                  onChange={updateWcaSourceSettings}
                  onCoverageChange={setWcaDifficultyCoverage}
                  settings={wcaSourceSettings}
                  wcaEventId={timerWcaScrambleEventId(activeEvent)}
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
                  onChange={updateManualScrambles}
                  value={manualScrambles}
                />
              </fieldset>
            )}
            <div className="mobile-timer-stage">
              <TimingSurface
                ariaLabel={copy.timer}
                colorClass={timerColorClass}
                digits={<SegmentTime text={timerText} />}
                fontSize="clamp(4.8rem, 24vw, 8.5rem)"
                interactive={scrambleReady}
                onContextMenu={(event) => event.preventDefault()}
                phase={timer.machine.phase}
                 scrambleSlot={(
                   <TimerScrambleStrip
                     copied={scrambleCopied}
                     copiedLabel={copy.copied}
                     correctionActive={smartCubeGuidance.correctionActive}
                     fallback={scrambleText}
                     fallbackKind={scrambleAvailability === 'loading' ? 'custom' : 'empty'}
                     match={smartCubeScrambleMatch}
                     hint={smartCubeGuidance.hint}
                     onActivate={scrambleClickEffect === 'retry' && currentScrambleEntry
                       ? () => {
                         if (canSwitchScramble()) fillScrambleHistoryEntry(currentScrambleEntry);
                       }
                       : scrambleClickEffect === 'next'
                         ? nextDisplayedScramble
                         : scrambleClickEffect === 'copy' ? copyCurrentScramble : undefined}
                     scramble={scrambleReady && scramble.length > 0 ? scrambleText : ''}
                     title={TIMER_SCRAMBLE_CLICK_TITLE_COPY[scrambleClickEffect][language]}
                     verificationLabels={{
                       copiedCorrection: copy.scrambleCorrectionCopied,
                       correction: copy.scrambleCorrection,
                       correctionTitle: copy.scrambleCorrectionTitle,
                       mismatch: copy.scrambleMismatch,
                       ready: copy.scrambleReady,
                     }}
                   >
                     {currentReal && scrambleSource === 'wca' && (
                       <p className="mobile-scramble-source">
                        <strong>{currentReal.competitionName}</strong>
                        <EventIcon
                          ariaLabel={timerEventPickerName(activeEvent, language)}
                          event={currentReal.eventId}
                        />
                        <span>{timerWcaScrambleSourceLine(
                          currentReal.roundTypeId,
                          currentReal.groupId,
                          currentReal.scrambleNumber,
                          currentReal.isExtra,
                        )}</span>
                      </p>
                    )}
                     {scrambleReady && scramble.length > 0 && (
                       <ScrambleCube alt={copy.cubeState} event={activeEvent} scramble={scramble} />
                     )}
                   </TimerScrambleStrip>
                 )}
                surfaceRef={surfaceRef}
              >
                <span aria-live="polite" className="sr-only">{timerInstruction}</span>
              </TimingSurface>
              <TimerStatRail
                disabled={timer.machine.phase === 'running' || timerContextMutationBusy}
                emptyLabel={copy.times}
                items={stats.count > 0 ? [
                  { label: copy.solved, value: `${stats.solved}/${stats.count}` },
                  { label: 'mean', value: stats.mean },
                  { label: copy.best, value: stats.best },
                  { label: 'mo3', value: stats.mo3 },
                  { label: 'ao5', value: stats.ao5 },
                  { label: 'ao12', value: stats.ao12 },
                ] : []}
                onClick={() => setView('history')}
                title={copy.openTimes}
              />
              <MobileSmallPuzzleHints
                event={activeEvent}
                language={language}
                phase={timer.machine.phase}
                scramble={scramble}
              />
              <TimerDeviceActions
                active={smartCube.phase === 'connected'}
                connectAriaLabel={smartCube.phase === 'connected' ? copy.disconnectBluetooth : copy.connectBluetooth}
                connectLabel={smartCube.phase === 'connected'
                  ? `${smartCube.deviceName}${smartCube.lastMove ? ` · ${smartCube.lastMove}` : ''}`
                  : smartCube.phase === 'requesting' || smartCube.phase === 'connecting'
                    ? copy.connectingBluetooth
                    : copy.connect}
                onConnect={toggleSmartCube}
              />
            </div>
          </section>
        )}

        {view === 'timer' && typeof timerMode === 'number' && timerMode >= 2 && (
          <LocalBattleMode
            copy={copy}
            eventGroups={eventPickerGroups}
            hideTime={hideRunningTime}
            holdMs={store!.settings.holdMs}
            inspectionSec={store!.settings.inspectionSec}
            language={language}
            onActivityChange={setBattleModeActive}
            onModeChange={(mode) => {
              timerModeRef.current = mode;
              setTimerMode(mode);
            }}
            onSmartCubeHandlersChange={setBattleSmartCubeHandlers}
            playerCount={timerMode as 2 | 3 | 4}
            precision={resultPrecision}
            runningPrecision={runningPrecision}
            smartCube={smartCube}
          />
        )}

        {view === 'timer' && timerMode === 'net' && (
          <NetBattleMode
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
            onActivityChange={setBattleModeActive}
            onModeChange={(mode) => {
              timerModeRef.current = mode;
              setTimerMode(mode);
            }}
            onSmartCubeHandlersChange={setBattleSmartCubeHandlers}
            precision={resultPrecision}
            runningPrecision={runningPrecision}
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
          <section className="history-view" aria-labelledby="history-title">
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
              viewportBottomInset={96}
            />
            <TimerStatsPanel
              className="mobile-stats-panel"
              event={activeEvent}
              labels={{
                best: copy.best,
                bestBo3: copy.bestBo3,
                bestMo3: copy.bestMo3,
                count: copy.count,
                current: copy.current,
                hideExtras: copy.hideExtras,
                mean: copy.mean,
                rollingPicker: {
                  changeColumn: copy.statsChangeColumn,
                  clear: copy.clear,
                  customPlaceholder: copy.statsCustomPlaceholder,
                  customSize: copy.statsCustomSize,
                  replace: copy.replace,
                },
                showAllStats: copy.showAllStats,
                single: copy.single,
                subX: copy.subX,
                worst: copy.worst,
              }}
              onRollingColumnsChange={(statsRollingColumns) => updateSettings({ statsRollingColumns })}
              rollingColumns={store!.settings.statsRollingColumns}
              solves={solves}
              viewportBottomInset={96}
            />
            <div className="mobile-history-filters">
              <div className="mobile-history-search-row">
                <label className="mobile-history-search">
                  <span className="sr-only">{copy.searchHistory}</span>
                  <input
                    aria-label={copy.searchHistory}
                    onChange={(event) => updateHistoryFilter('query', event.target.value)}
                    placeholder={copy.searchHistory}
                    type="text"
                    value={historyFilters.query}
                  />
                  {historyFilters.query && (
                    <ClearButton
                      ariaLabel={copy.clearSearch}
                      onClick={() => updateHistoryFilter('query', '')}
                      preserveFocus
                    />
                  )}
                </label>
                {filteredHistory.hasAnyFilter && (
                  <span className="mobile-history-match-count">
                    {copy.historyMatches(filteredHistory.solves.length)}
                  </span>
                )}
              </div>
              <div className="mobile-history-filter-actions">
                <button
                  aria-expanded={historyFiltersExpanded}
                  className="text-action"
                  onClick={() => setHistoryFiltersExpanded((value) => !value)}
                  type="button"
                >{copy.filters}</button>
                {filteredHistory.hasAnyFilter && (
                  <button className="text-action" onClick={clearHistoryFilters} type="button">
                    {copy.clearFilters}
                  </button>
                )}
              </div>
              {historyFiltersExpanded && (
                <div className="mobile-history-filter-panel">
                  <DateRangeInput
                    ariaLabel={copy.dateRange}
                    className="mobile-history-date-range"
                    from={historyFilters.dateFrom}
                    labels={dateRangeLabels}
                    onChange={(dateFrom, dateTo) => {
                      setHistoryFilters((current) => ({ ...current, dateFrom, dateTo }));
                    }}
                    size="compact"
                    to={historyFilters.dateTo}
                  />
                  <div className="mobile-history-filter-grid">
                    <label>
                      <span>{copy.minSeconds}</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateHistoryFilter('timeMin', event.target.value)}
                        type="text"
                        value={historyFilters.timeMin}
                      />
                    </label>
                    <label>
                      <span>{copy.maxSeconds}</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateHistoryFilter('timeMax', event.target.value)}
                        type="text"
                        value={historyFilters.timeMax}
                      />
                    </label>
                  </div>
                  <fieldset className="mobile-history-penalties">
                    <legend>{copy.penalty}</legend>
                    {TIMER_HISTORY_PENALTIES.map((penalty) => (
                      <button
                        aria-pressed={historyFilters.penalties.has(penalty)}
                        className="choice-button"
                        key={penalty}
                        onClick={() => toggleHistoryPenalty(penalty)}
                        type="button"
                      >{penalty === 'ok' ? 'OK' : penalty}</button>
                    ))}
                  </fieldset>
                  <div className="mobile-history-filter-grid">
                    <label>
                      <span>{copy.ollCase}</span>
                      <input
                        onChange={(event) => updateHistoryFilter('ollCase', event.target.value)}
                        type="text"
                        value={historyFilters.ollCase}
                      />
                    </label>
                    <label>
                      <span>{copy.pllCase}</span>
                      <input
                        onChange={(event) => updateHistoryFilter('pllCase', event.target.value)}
                        type="text"
                        value={historyFilters.pllCase}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            {solves.length === 0 ? <p className="empty-state">{copy.emptyHistory}</p>
              : filteredHistory.solves.length === 0 ? (
                <p className="empty-state">{copy.noHistoryMatches}</p>
              ) : (
              <div className="history-list">
                {filteredHistory.solves.map((solve) => (
                  <MobileHistoryItem
                    copy={copy}
                    focusComment={historyCommentSolveId === solve.id}
                    index={solves.findIndex((entry) => entry.id === solve.id)}
                    key={solve.id}
                    language={language}
                    onCopy={copyHistoryScramble}
                    onDelete={deleteSolve}
                    onQuickDelete={quickDeleteSolve}
                    onMove={moveSolveToSession}
                    onQuickMenuOpenChange={handleTimerOverlayOpenChange}
                    onCommentFocusHandled={() => setHistoryCommentSolveId(null)}
                    onUpdate={updateSolve}
                    moveTargets={historyMoveTargets}
                    quickMenuOpen={openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu}
                    solve={solve}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'settings' && (
          <section className="settings-view" aria-labelledby="settings-title">
            <h1 id="settings-title">{copy.settings}</h1>
            <div className="settings-group">
              <label className="setting-row">
                <span>{copy.language}</span>
                <select
                  onChange={(event) => updateSettings({ language: event.target.value as SupportedLanguage })}
                  value={store!.settings.language}
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </select>
              </label>
              <label className="setting-row">
                <span>{copy.theme}</span>
                <select
                  onChange={(event) => updateSettings({ theme: event.target.value as TimerStoreSettings['theme'] })}
                  value={store!.settings.theme}
                >
                  <option value="system">{copy.system}</option>
                  <option value="light">{copy.light}</option>
                  <option value="dark">{copy.dark}</option>
                </select>
              </label>
            </div>

            <TimerTimingSettingsSections
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

            <section className="settings-section">
              <h2>{TIMER_SETTING_CATEGORY_CONTRACTS.find((category) => (
                category.id === 'appearance'
              ))?.label[language]}</h2>
              <TimerScrambleClickActionSetting
                localize={(value) => value[language]}
                onChange={(scrambleClickAction) => updateSettings({ scrambleClickAction })}
                value={store!.settings.scrambleClickAction}
              />
            </section>

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

            <div className="settings-section">
              <h2>{copy.data}</h2>
              <p>{solves.length} {copy.dataCount}</p>
              <div className="action-row">
                <button className="secondary-action" onClick={exportData} type="button">{copy.exportData}</button>
                <label className="secondary-action">
                  {copy.importData}
                  <input accept="application/json,.json" hidden onChange={importData} type="file" />
                </label>
                {canUndoImport && (
                  <button className="secondary-action" onClick={undoImport} type="button">{copy.undoImport}</button>
                )}
              </div>
            </div>

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
          </section>
        )}
      </div>

      <nav className="primary-nav" aria-label={copy.title}>
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

      {undoToast && (
        <TimerInfoToast
          message={undoToast.message}
          onDismiss={() => setUndoToast(null)}
          onUndo={undoToast.undo}
          undoLabel={copy.undo}
          viewportBottomInset={64}
        />
      )}

      <p aria-live="polite" className="toast">{toast}</p>
    </main>
  );
}
