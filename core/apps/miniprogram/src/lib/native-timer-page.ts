import { exportTimerSolvesCsv } from '@cuberoot/shared/timer/export-csv';
import { confirmNativeTimerLink, type NativeTimerLink } from './native-timer-link';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer/export-cstimer';
import { exportSpeedstacks } from '@cuberoot/shared/timer/export-speedstacks';
import { TIMER_SESSION_UI_COPY, timerSessionDeleteConfirmation, timerSessionClearConfirmation } from '@cuberoot/shared/timer/session';
import { checkTimerFmcSolvedness, createTimerManualEntryDraft, timerManualEntryCopy, timerManualEntryKind, validateTimerManualEntry, type TimerManualEntryDraft } from '@cuberoot/shared/timer/manual-entry';
import { TIMER_MORE_ACTION_COPY } from '@cuberoot/shared/timer/more-actions';
import { normalizeSolverScrambleDraft, TIMER_MANUAL_SCRAMBLE_EMPTY_COPY, TIMER_SOLVER_SCRAMBLE_EDITOR_COPY } from '@cuberoot/shared/timer/manual-scramble-queue';
import { TIMER_RESULTS_TABS_COPY, TIMER_HISTORY_QUICK_ACTION_IDS, TIMER_HISTORY_QUICK_ACTION_COPY, TIMER_HISTORY_PENALTIES, timerHistoryQuickActionPenalty, timerHistoryMoveTargets, timerSolveDetailStageRows, timerSolveDetailBldTimes } from '@cuberoot/shared/timer/history';
import type { EventId, Solve } from '@cuberoot/shared/timer/types';
import { BATTLE_EVENT_IDS, effectiveMs } from '@cuberoot/shared/timer/types';
import { timerScrambleClickEffect, timerSettingFieldContract, TIMER_SETTING_CATEGORY_CONTRACTS, TIMER_SETTING_FIELD_CONTRACTS } from '@cuberoot/shared/timer/settings-contract';
import { timerHidesRunningUi } from '@cuberoot/shared/timer/display-settings';
import { TIMER_RADIAL_POINTER_PROFILES } from '@cuberoot/shared/timer/input-contract';
import { TIMER_STATS_DATE_RANGES } from '@cuberoot/shared/timer/stats-buckets';
import { isNativeTimerStatisticsTab, NATIVE_TIMER_STATISTICS_COMPACT_WIDTH, nativeTimerStatistics,
  type NativeTimerStatisticsOptions } from './native-timer-statistics';
import { DEFAULT_SOLO_LAYOUT, TIMER_SOLO_LAYOUT_COPY, TIMER_SOLO_LAYOUT_REGIONS, timerSoloDragValue, timerSoloRegionPatch, timerSoloRegionValue, timerSoloStatRailRows,
  type TimerSoloLayoutGesture, type TimerSoloLayoutRegion, type TimerSoloLayoutSettings } from '@cuberoot/shared/timer/solo-layout';
import { BLUETOOTH_TIMER_DIALOG_COPY, TIMER_DEVICE_CENTER_LABELS } from '@cuberoot/shared/timer/device-contract';
import { normalizeTimerWcaDifficultySettings, reconcileTimerWcaDifficultySettings, timerInclusiveRange, timerWcaDifficultyUiModel,
  timerWcaSupportsDifficulty, type TimerWcaDifficultyCatalog, type TimerWcaDifficultyCoverage, type TimerWcaDifficultySettings } from '@cuberoot/shared/timer/wca-difficulty';
import { canTrainerDifficulty, EO_AXIS_LABELS, normalizeTimerRandomDifficultySettings, reconcileTimerRandomDifficultySettings,
  TIMER_RANDOM_DIFFICULTY_COPY, TIMER_RANDOM_DIFFICULTY_CASE_COPY, timerRandomDifficultyCaseLabels, timerRandomDifficultyRangePatch, timerRandomDifficultySelection,
  timerRandomDifficultyStagesOf, timerRandomDifficultyUiModel, type TimerRandomDifficultySettings } from '@cuberoot/shared/timer/random-difficulty';
import { TIMER_COLOR_DUAL_PAIRS, TIMER_COLOR_HEX, TIMER_COLOR_MODE_ORDER, TIMER_COLOR_NAMES, timerAllColorSubsetOptions, timerColorSubsetOption, timerColorSwatchBackground } from '@cuberoot/shared/timer/color-subsets';
import { STAGE_SOLVER_METHODS, STAGE_SOLVER_DEFAULT_CELLS, STAGE_SOLVER_DEFAULT_FACES, STAGE_SOLVER_DEFAULT_LIMIT,
  STAGE_SOLVER_DEFAULT_SLACK, STAGE_SOLVER_LIMIT_OPTIONS, STAGE_SOLVER_SLACK_OPTIONS, STAGE_SOLVER_MOVE_CELLS, STAGE_SOLVER_SLOT_LABELS, STAGE_SOLVER_INFO_TITLE,
  stageSolverHasBase, stageSolverMoveRestriction, stageSolverRestrictionKind, stageSolverSlotCombinations, stageSolverSlotCount, stageSolverToggleMoveCell,
  VARIANT_STAGES, stageLabel, stageSolverInfoModel, summarizeStageSolverTables, variantLabel,
  type StageSolverMethod, type StageSolverTableSize } from '@cuberoot/shared/timer/scramble-variants';
import { timerSmallPuzzleHintCopy, timerSupportsSmallPuzzleHints } from '@cuberoot/shared/timer/solution-hints';
import { METHOD_REGISTRY, scheduleTimer333StepSolve, TIMER_333_COMPARISON_COPY, TIMER_333_STEP_COPY, timer333StepNotation, type MethodId, type SolveResult } from '@cuberoot/puzzle-solvers/timer-333-step';
import { createNativeStageSolver, nativeStageSolverAvailability, nativeStageSolverCandidateRow, nativeStageSolverCandidateRows, NativeStageSolverRuntimeError, nativeStageSolverFaceCells, nativeStageSolverFrame, nativeStageSolverPlayback, nativeStageSolverPosition,
  type NativeStageSolverMoves, type NativeStageSolverPlayback } from './native-stage-solver';
import { startNativeTimerSolverComparison } from './native-timer-solver-comparison';
import { NativeTimer, nativeTimerEvents } from './native-timer';
import { createNativeTimerScrambleSource } from './native-timer-scramble-source';
import { nativeTimerProjectGroups } from './native-timer-projects';
import { confirmNativeTimerResetDefaults, nativeTimerOrientationOptions, nativeTimerSettingsModel, nativeTimerSettingPatch, nativeTimerSettingsActionSheet, nativeTimerSettingsMoreCommand, nativeTimerRollingStatsPatch, nativeTimerRollingStatsSettings, nativeTimerSyncSeedPatch, nativeTimerTrainingPatch } from './native-timer-settings';
import { applyOrientationPrefix } from '@cuberoot/shared/timer/cube-orientation';
import { preScrambleFor } from '@cuberoot/shared/timer/pre-scramble';
import { localizeTimerGoalProgress, timerGoalProgress, timerRoundProgress, timerTargetIndicator } from '@cuberoot/shared/timer/training-view';
import { timerAttemptSplitChips } from '@cuberoot/shared/timer/attempt-splits';
import { TIMER_BULK_SCRAMBLE_COPY, TIMER_BULK_SCRAMBLE_COUNTS, clampTimerBulkScrambleCount,
  isTimerBulkScrambleEvent, timerBulkScrambleBatch } from '@cuberoot/shared/timer/bulk-scramble';
import { timerScrambleStatus } from '@cuberoot/shared/timer/scramble-status';
import { confirmNativeTimerClearEvent, copyNativeTimerExport, listNativeTimerImportFiles, nativeTimerSettingsDataCommands,
  prepareNativeTimerExport, prepareNativeTimerImport, readNativeTimerImportClipboard, readNativeTimerImportFile,
  saveNativeTimerExport, switchNativeTimerLanguage, type NativeTimerImport } from './native-timer-settings-data';
import { createNativeTimerLocalBackups, nativeTimerLocalBackupsAvailable, nativeTimerLocalBackupControls } from './native-timer-backup';
import { nativeTimerMetronomeAvailable } from './native-timer-metronome';
import { nativeTimerSoundAvailable, nativeTimerVoiceAvailable } from './native-timer-sound';
import { planTimerImport } from '@cuberoot/shared/timer/import-timer';
import { createNativeWcaPool, nativeCompetitionCatalog, loadNativeCompetitionCountry, loadNativeCompetitionScrambles, nativeWcaDifficulty } from './native-timer-wca';
import { TIMER_SCRAMBLE_SOURCE_COPY, TIMER_WCA_COMPETITION_PERIODS, availableTimerWcaCompetitions, resolveTimerWcaSourceCore, timerWcaCompetitionPeriodStart,
  timerWcaCompetitionSuggestions, timerWcaRoundGroupOptions, timerWcaRoundShortLabel,
  type TimerWcaCompetition, type TimerWcaCompetitionPeriod, type TimerWcaCompetitionScramble } from '@cuberoot/shared/timer/wca-source-config';
import { timerEventNxnSize, timerFullPracticeContent, timerSupportsRealWcaScrambles, timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { miniProgramApi } from './platform';
import { applyNativeAppearance } from './appearance';
import { tr, getMiniProgramLocale } from './i18n';
import { getSmartCubeSession, type SmartCubeSessionSnapshot } from './smart-cube/session';
import { nativeStackmatManagement, nativeTimerDeviceCenter, nativeTimerDeviceManagement, nativeTimerDeviceSelection, type NativeTimerDeviceKind } from './native-timer-devices';
import { startExternalTimer, disconnectExternalTimer } from './external-timer/session';
import { nativeStackmatError } from './external-timer/stackmat';
import type { StackmatSnapshot } from '@cuberoot/shared/timer/external/stackmat-state';
import { discoverNativeTimers, resolveNativeQiyiTimerMac, type NativeBluetoothTimerCandidate } from './external-timer/ble';
import { normalizeBleMac } from './smart-cube/encrypted-ble';
import { createNativeTimerLiveShare, nativeTimerLiveShareCopy } from './native-timer-live-share';
import { createNativeTimerLiveAnalysis, type NativeLiveAnalysisView } from './native-timer-live-analysis';
import { RECON_NOTATION_PLAY_INTERVAL_MS, shouldAutoRecap } from '@cuberoot/shared/timer/reconstruct/recap';
import { sq1MoveCounts } from '@cuberoot/shared/sq1-metrics';
import { solveNativeTimerSq1 } from './native-timer-sq1-hint';
import type { NativeTimerRecap } from './native-timer-recap';
import { TIMER_REPLAY_INPUT_COPY } from '@cuberoot/shared/timer/replay-input';
import { readNativeTimerReplay } from './native-timer-replay';
import { mountNativeTimerCubeView, type NativeTimerCubeView } from './native-timer-cube-view';
import { createNativeTimerNetRoom, type NativeTimerNetRoom } from './native-timer-net-room';
import {
  NET_EVENTS, effectiveNetMs, formatNetHistoryResult, formatNetHistoryStat, isNetBattleEventId, isNetBattleRoomCode,
  isNetRoundParticipant, normalizeNetBattleRoomCode, playerStats, playerTimeline, roundViews,
  TIMER_ROOM_ADMIN_COPY, TIMER_ROOM_HISTORY_COPY, TIMER_ROOM_LOBBY_COPY, TIMER_ROOM_PLAYERS_COPY,
  TIMER_ROOM_ROUND_STATUS_COPY, TIMER_ROOM_TOOLBAR_COPY, timerRoomPlayerName, type NetBattleEventId,
} from '@cuberoot/shared/timer/net-battle';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { createNativeTimerLocalBattle } from './native-timer-local-battle';
import { LOCAL_BATTLE_SCRAMBLE_COPY } from '@cuberoot/shared/timer/local-battle-scramble';
import { nativeTimerLiveCubeImage, nativeTimerLiveView, nativeTimerPreview, nativeTimerPreviewAsync, nativeTimerUsesAsyncPreview } from './native-timer-preview';
import { createTimerBackupClient } from '@cuberoot/shared/timer/backup-client';
import { getStoredSessionSnapshot, requestJson } from './auth';
import { nativeTimerFetch } from './native-timer-network';
import { formatSolveResult, formatEventMs, formatMs } from '@cuberoot/shared/timer/stats';
import { createTimerRankClient, toWcaEventForRank } from '@cuberoot/shared/timer/rank-client';
import { timerRankPills, timerPersonalOfficialRank, type TimerRankOfficialRow } from '@cuberoot/shared/timer/rank-presentation';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import { TIMER_RANK_SCOPES } from '@cuberoot/shared/timer/settings-contract';
import { searchCountries } from '@cuberoot/shared/country-search';
import { countryName } from '@cuberoot/shared/country-name';
import { countryFlagIdentity } from '@cuberoot/shared/country-flag';
import { formatDateRangeIso, toLocalIsoDate } from '@cuberoot/shared/iso-date';

const ranks = createTimerRankClient({ apiUrl: path => path, fetcher: nativeTimerFetch });
const rankCountries = ['', ...searchCountries('', { limit: 250 }).map(row => row.iso2.toUpperCase())];

function nativeSettingsContext(p: NativePage) {
  return {
    signedIn: Boolean(getStoredSessionSnapshot().session), cloudBusy: p.cloudBusy, backupAvailable: Boolean(p.localBackups),
    resetDefaultsAvailable: true, recapAvailable: true, colorNeutralAvailable: true, rollingStatsAvailable: true, soundAvailable: nativeTimerSoundAvailable(),
    voiceAvailable: nativeTimerVoiceAvailable(),
    metronomeAvailable: nativeTimerMetronomeAvailable(),
    correctionAvailable: typeof miniProgramApi().createWorker === 'function' && typeof miniProgramApi().openBluetoothAdapter === 'function',
    syncSeedAvailable: typeof miniProgramApi().createWorker === 'function', syncSeedDraft: p.syncSeedDraft,
    smartCubeReadyAvailable: typeof miniProgramApi().openBluetoothAdapter === 'function',
    liveAnalysisAvailable: typeof miniProgramApi().createWorker === 'function' && typeof miniProgramApi().openBluetoothAdapter === 'function',
  };
}
const sourceChoices = ['wca', 'random', 'manual'] as const;
const manualFields = ['time', 'fmcSolution', 'fmcMoveCount', 'mbldAttempted', 'mbldSolved', 'scramble', 'comment'] as const;
function manualFormCopy() {
  const { error: _error, mbldPoints: _mbldPoints, fmcChecking: _checking, fmcInvalidToken: _token,
    fmcSolved: _solved, fmcUnchecked: _unchecked, fmcUnsolved: _unsolved, ...labels } = timerManualEntryCopy(getMiniProgramLocale());
  return labels;
}
const nativeToolbarMenus: Record<string, { anchor: string; width: number; align: 'left' | 'center' | 'viewport' }> = {
  devices: { anchor: 'devices', width: 132, align: 'center' },
  project: { anchor: 'project', width: 170, align: 'left' },
  content: { anchor: 'content', width: 140, align: 'left' },
  source: { anchor: 'source', width: 120, align: 'center' },
  wca: { anchor: 'source', width: 330, align: 'center' },
  difficulty: { anchor: 'difficulty', width: 380, align: 'viewport' },
};
function nativeLayoutData(layout: TimerSoloLayoutSettings, display: string) {
  return {
    timerLayout: layout.soloLayout,
    timerFontSize: Math.min(108 * layout.timerFontScale, 580 / Math.max(display.length * 0.65, 1)),
    scrambleFontSize: 36 * layout.scrambleFontScale,
  };
}

function soloStageData(timer: NativeTimer, display: string, layout: TimerSoloLayoutSettings, viewport?: { width: number; height: number }) {
  const width = viewport?.width ?? 393;
  const height = viewport?.height ?? 658;
  // The App's timer-stage container starts below the toolbar.
  const stageHeight = Math.max(0, height - 56);
  const compactStage = width >= 520 && width >= stageHeight && stageHeight <= 460;
  const layoutStyle = layout.soloLayout;
  const gap = (value: number) => compactStage ? Math.min(4, value) : value;
  const timerSize = Math.max(48, Math.min(width * .1, 132)) * layout.timerFontScale;
  const timerLimit = compactStage ? Math.max(40, Math.min(64, stageHeight * .18))
    : Math.min(width * .22, stageHeight * .24);
  const characterWidth = display.length - (display.includes('.') ? .58 : 0);
  const readoutSize = Math.min(timerSize, timerLimit, (width - 34) / Math.max(1, characterWidth * .6));
  const cubeHeight = Math.min(width * .3, Math.max(60, stageHeight * .26), 260) * layoutStyle.cubeScale;
  const cubeGap = gap(layoutStyle.cubeGap);
  const scrambleLengthScale = Math.min(1, Math.sqrt(80 / Math.max(1, timer.scramble.length)));
  const last = timer.settings;
  return {
    soloViewportHeight: viewport?.height ?? null,
    soloCompactStage: compactStage,
    soloTightFooter: stageHeight <= 350,
    soloHorizontalStats: stageHeight <= 240,
    soloScrambleGap: gap(layoutStyle.scrambleGap), soloSourceGap: gap(layoutStyle.sourceGap),
    soloTimerGap: gap(layoutStyle.timerGap), soloCubeGap: cubeGap,
    soloReadoutSize: readoutSize,
    soloReadoutFont: last.timerFont, soloScrambleFont: last.scrambleFont,
    soloScrambleScale: layout.scrambleFontScale,
    soloScrambleLengthScale: scrambleLengthScale,
    soloSourceSize: layoutStyle.sourceScale,
    soloCubeHeight: cubeHeight,
    soloCubeDrawHeight: Math.min(cubeHeight, (readoutSize + cubeGap + cubeHeight) * .55),
    soloCompactCubeHeight: Math.max(60, Math.min(120, stageHeight * .24)) * layoutStyle.cubeScale,
  };
}

function updateTimerTabBar(p: NativePage, hidden: boolean) {
  if (Boolean(p.tabBarHidden) === hidden) return;
  const api = miniProgramApi();
  if (typeof api.hideTabBar !== 'function' || typeof api.showTabBar !== 'function') return;
  p.tabBarHidden = hidden;
  const options = { animation: false, fail: () => { if (p.tabBarHidden === hidden) p.tabBarHidden = !hidden; } };
  if (hidden) api.hideTabBar(options);
  else api.showTabBar(options);
}

function applyTimerTabBarColors(p: NativePage) {
  const query = p.createSelectorQuery?.();
  if (!query) return;
  query.select('#nt-navigation-palette').fields({ computedStyle: ['backgroundColor'] });
  query.exec(([palette]) => {
    if (!p.active || !palette) return;
    const css = (palette as unknown as { backgroundColor?: string }).backgroundColor;
    const rgb = css?.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)?.slice(1).map(Number);
    if (!rgb) return;
    const backgroundColor = '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');
    miniProgramApi().setTabBarStyle?.({
      backgroundColor,
      borderStyle: rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 < 128 ? 'black' : 'white',
    });
  });
}

function nativeContentViewport() {
  try {
    const api = miniProgramApi();
    const size = api.getWindowInfo?.() ?? api.getSystemInfoSync();
    return { width: size.windowWidth, height: size.windowHeight };
  } catch { return undefined; }
}
function copy() {
  const labels = {
  players: tr({ en: 'Players', zh: '人数' }),
  playerOptions: [...[1, 2, 3, 4].map(count => tr({ en: `${count}P`, zh: `${count}人` })), tr({ en: 'Online', zh: '在线' })],
  battleStartAll: tr({ en: 'Start all', zh: '全部开始' }),
  battleNextRound: tr({ en: 'Next round', zh: '下一轮' }),
  battleHistory: tr({ en: 'Battle history', zh: '对战记录' }),
  battleWinner: tr({ en: 'Winner', zh: '胜者' }),
  battleRetry: tr(LOCAL_BATTLE_SCRAMBLE_COPY.failed),
  battleLoading: tr(LOCAL_BATTLE_SCRAMBLE_COPY.loading),
  battleSources: [tr(LOCAL_BATTLE_SCRAMBLE_COPY.wca), tr(LOCAL_BATTLE_SCRAMBLE_COPY.random)],
  battlePenalties: ['OK', '+2', 'DNF'],
  title: tr({ en: 'Timer', zh: '计时器' }), bluetooth: tr({ en: 'Bluetooth', zh: '蓝牙' }), settings: tr({ en: 'Settings', zh: '设置' }),
  next: tr({ en: 'Next scramble', zh: '下一条打乱' }), results: tr({ en: 'Results', zh: '成绩' }), best: tr({ en: 'Best', zh: '最佳' }),
  previous: tr({ en: 'Previous scramble', zh: '上一条打乱' }), moveSession: tr({ en: 'Move to group', zh: '移至分组' }),
  resultsPanel: {
    times: tr(TIMER_RESULTS_TABS_COPY.times), stats: tr(TIMER_RESULTS_TABS_COPY.stats), close: tr(TIMER_RESULTS_TABS_COPY.close),
    search: tr({ en: 'Search solves', zh: '搜索成绩' }),
    query: tr({ en: 'Time, scramble, comment', zh: '时间、打乱、注释' }),
    newGroup: tr({ en: 'New', zh: '新建' }),
    actions: tr({ en: 'Results actions', zh: '成绩操作' }),
    time: tr({ en: 'Time', zh: '时间' }), result: tr({ en: 'Result', zh: '成绩' }),
  },
  hold: tr({ en: 'Hold, then release to start', zh: '按住，准备后松手开始' }), ready: tr({ en: 'Release to start', zh: '松手开始' }),
  stop: tr({ en: 'Tap to stop', zh: '点击停止' }), inspection: tr({ en: 'Inspection · hold to start', zh: '观察中 · 按住准备开始' }),
  loading: tr({ en: 'Generating scramble…', zh: '正在生成打乱…' }), retry: tr({ en: 'Retry', zh: '重试' }),
  cube: tr({ en: 'Follow the scramble; the first turn starts timing and solving stops it.', zh: '按打乱转动魔方，匹配后首转开始，还原自动停止。' }),
  close: tr({ en: 'Close', zh: '关闭' }), export: tr({ en: 'Copy CSV', zh: '复制 CSV' }),
  bulkTitle: tr(TIMER_MORE_ACTION_COPY['more.bulk']),
  bulkCount: tr(TIMER_BULK_SCRAMBLE_COPY.count),
  bulkGenerate: tr(TIMER_BULK_SCRAMBLE_COPY.generate),
  bulkGenerating: tr(TIMER_BULK_SCRAMBLE_COPY.generating),
  bulkCopy: tr(TIMER_BULK_SCRAMBLE_COPY.copy),
  bulkCopied: tr(TIMER_BULK_SCRAMBLE_COPY.copied),
  bulkDownload: tr(TIMER_BULK_SCRAMBLE_COPY.download),
  bulkSaved: tr({ en: 'Saved in this mini program', zh: '已保存到本小程序' }),
  empty: tr({ en: 'No results yet', zh: '暂无成绩' }), local: tr({ en: 'Results are saved on this device. Load more to see older results; exports include the entire group.', zh: '成绩保存在本机，可加载更多；导出包含整个分组。' }),
  off: tr({ en: 'Off', zh: '关闭' }), cancel: tr({ en: 'Cancel attempt', zh: '取消本次' }),
  session: tr(TIMER_SESSION_UI_COPY.sessions), newSession: tr(TIMER_SESSION_UI_COPY.newSession),
  clear: tr(TIMER_SESSION_UI_COPY.clear),
  rename: tr(TIMER_SESSION_UI_COPY.rename), deleteSession: tr(TIMER_SESSION_UI_COPY.deleteSession), clearSession: tr(TIMER_SESSION_UI_COPY.clearSolves),
  entry: manualFormCopy(), manualEntry: timerManualEntryCopy(getMiniProgramLocale()).title,
  manualPlaceholder: timerManualEntryCopy(getMiniProgramLocale()).timePlaceholder,
  manualScrambles: tr(TIMER_SCRAMBLE_SOURCE_COPY.manualOption), queuePlaceholder: tr(TIMER_MANUAL_SCRAMBLE_EMPTY_COPY),
  save: timerManualEntryCopy(getMiniProgramLocale()).save,
  source: tr(TIMER_SCRAMBLE_SOURCE_COPY.title),
  sourceChoices: sourceChoices.map(id => ({ id, label: tr(TIMER_SCRAMBLE_SOURCE_COPY[`${id}Option`]) })),
  sourceLabels: Object.fromEntries(sourceChoices.map(id => [id, tr(TIMER_SCRAMBLE_SOURCE_COPY[id])])),
  full: tr(timerFullPracticeContent('333').title), content: tr({ en: 'Practice content', zh: '出题内容' }),
  difficulty: tr({ en: 'Diff.', zh: '难度' }),
  difficultyTitle: tr(TIMER_RANDOM_DIFFICULTY_COPY.difficulty),
  randomAxis: tr(TIMER_RANDOM_DIFFICULTY_COPY.eoAxis),
  randomStepRange: tr(TIMER_RANDOM_DIFFICULTY_COPY.steps),
  randomSlots: tr(TIMER_RANDOM_DIFFICULTY_COPY.f2lSlot),
  randomBlock: tr(TIMER_RANDOM_DIFFICULTY_COPY.block),
  randomDifficultyInfo: tr(TIMER_RANDOM_DIFFICULTY_COPY.moreInfo),
  caseAnswer: tr(TIMER_RANDOM_DIFFICULTY_CASE_COPY.answer), caseHide: tr(TIMER_RANDOM_DIFFICULTY_CASE_COPY.hide),
  caseSolving: tr(TIMER_RANDOM_DIFFICULTY_CASE_COPY.solving), caseError: tr(TIMER_RANDOM_DIFFICULTY_CASE_COPY.error),
  difficultyMethod: tr({ en: 'Method', zh: '方法' }), difficultyStage: tr({ en: 'Stage', zh: '阶段' }),
  difficultyColors: tr({ en: 'Base colors', zh: '底色' }), difficultySteps: tr({ en: 'Moves', zh: '步数' }),
  minDifficultySteps: tr({ en: 'Minimum moves', zh: '最少步数' }),
  maxDifficultySteps: tr({ en: 'Maximum moves', zh: '最多步数' }),
  clearDifficulty: tr({ en: 'Any difficulty', zh: '不限难度' }), applyDifficulty: tr({ en: 'Apply', zh: '应用' }),
  difficultyUnavailable: tr({ en: 'This competition has no difficulty index yet.', zh: '这场比赛的难度数据尚未入库。' }),
  layout: tr(TIMER_SOLO_LAYOUT_COPY.edit), layoutReset: tr(TIMER_SOLO_LAYOUT_COPY.reset), layoutDone: tr(TIMER_SOLO_LAYOUT_COPY.done),
  layoutHandles: Object.fromEntries(TIMER_SOLO_LAYOUT_REGIONS.map(region => [region.gap, {
    move: `${tr(region.label)} · ${tr(TIMER_SOLO_LAYOUT_COPY.move)}`,
    size: `${tr(region.label)} · ${tr(TIMER_SOLO_LAYOUT_COPY.size)}`,
    hide: 'hideLabel' in region ? tr(region.hideLabel) : '',
  }])),
  solver: tr({ en: 'Solution hints', zh: '解法提示' }), solveMethod: tr({ en: 'Method', zh: '方法' }),
  solverViews: [tr({ en: 'Solve', zh: '解法' }), tr({ en: 'Step-by-step', zh: '分步解法' })],
  solverRuntimeUnavailable: tr({ en: 'Stage hints require a newer Douyin client.', zh: '阶段解法需要更新抖音客户端。' }),
  solverFirstMove: tr({ en: 'First move', zh: '第一步' }), solverPrevMove: tr({ en: 'Previous move', zh: '上一步' }),
  solverNextMove: tr({ en: 'Next move', zh: '下一步' }), solverLastMove: tr({ en: 'Last move', zh: '最后一步' }),
  solverPlay: tr({ en: 'Play', zh: '播放' }), solverPause: tr({ en: 'Pause', zh: '暂停' }),
  solverStage: tr({ en: 'Stage', zh: '阶段' }),
  solverSettings: tr({ en: 'Solver settings', zh: '求解设置' }),
  solverScrambleEdit: tr(TIMER_SOLVER_SCRAMBLE_EDITOR_COPY.edit),
  solverScrambleInput: tr(TIMER_SOLVER_SCRAMBLE_EDITOR_COPY.input),
  solverScrambleApply: tr(TIMER_SOLVER_SCRAMBLE_EDITOR_COPY.apply),
  solverScrambleCancel: tr(TIMER_SOLVER_SCRAMBLE_EDITOR_COPY.cancel),
  solverInfo: tr(STAGE_SOLVER_INFO_TITLE),
  solverMoveLimit: tr({ en: 'Move limit', zh: '步数上限' }), solverResultLimit: tr({ en: 'Count limit', zh: '数量上限' }),
  solverBottom: tr({ en: 'Base colors', zh: '底色' }), solverAllowedMoves: tr({ en: 'Allowed moves', zh: '转动限制' }),
  solverRestricted: tr({ en: 'limited', zh: '已限制' }),
  solverAllowAll: tr({ en: 'All', zh: '全选' }),
  solverProgressiveReveal: tr({ en: 'Progressive reveal', zh: '逐步揭示' }),
  solverNextReveal: tr({ en: 'Reveal next move', zh: '显示下一步' }),
  solverFullReveal: tr({ en: 'Reveal full solution', zh: '显示完整解法' }),
  solverShowAll: tr({ en: 'Show all', zh: '显示全部' }),
  solverChooseSolution: tr({ en: 'Solution', zh: '解法' }),
  solverSlot: tr({ en: 'Slot', zh: '槽位' }), solverBase: tr({ en: 'Free Pair', zh: '基态' }),
  solverRotate: tr({ en: 'Rotate solution', zh: '转动解法朝向' }),
  solverBest: tr({ en: 'Best', zh: '最优' }),
  solverStop: tr({ en: 'Stop', zh: '终止' }),
  solverCompare: tr(TIMER_333_STEP_COPY.compare),
  solverCompareTitle: tr(TIMER_333_COMPARISON_COPY.title),
  solverCompareLoading: tr(TIMER_333_COMPARISON_COPY.loading),
  solverStepLoading: tr(TIMER_333_STEP_COPY.loading),
  solverStepFailed: tr(TIMER_333_STEP_COPY.failed),
  solverStepMethod: tr(TIMER_333_STEP_COPY.method),
  solverStepCopyLine: tr(TIMER_333_STEP_COPY.copyLine),
  solverStepSeekLine: tr(TIMER_333_STEP_COPY.seekLine),
  solverStepCopy: tr({ en: 'Copy in /recon format', zh: '复制成 /recon 的格式' }),
  sq1Hint: tr({ en: 'Square-1 solver hints', zh: 'Square-1 解法提示' }),
  sq1NearOptimal: tr({ en: 'Near-optimal (12c4)', zh: '近最优 (12c4)' }),
  megaHint: tr({ en: 'Megaminx solver hints', zh: '五魔解法提示' }),
  megaState: tr({ en: 'State', zh: '当前状态' }),
  megaMisplaced: tr({ en: 'Misplaced stickers', zh: '错位贴纸' }),
  megaNote: tr({ en: 'Currently shows solved-state statistics only', zh: '目前仅提供还原状态统计' }),
  devices: tr(TIMER_DEVICE_CENTER_LABELS.title), smartCube: tr(TIMER_DEVICE_CENTER_LABELS['smart-cube']),
  smartTimer: tr(TIMER_DEVICE_CENTER_LABELS['smart-timer']), deviceConnected: tr(TIMER_DEVICE_CENTER_LABELS.connected),
  solving: tr({ en: 'Solving…', zh: '求解中…' }),
  alreadySolved: tr({ en: 'Already solved', zh: '已完成' }), solverUnavailable: tr({ en: 'Stage unavailable', zh: '此阶段无解法' }),
  wca: tr({ en: 'Official scrambles', zh: '比赛真题' }),
  competitionPeriods: TIMER_WCA_COMPETITION_PERIODS.map(period => tr(period.label)),
  competitionRange: tr({ en: 'Time range', zh: '时间范围' }),
  allCompetitionsCountries: tr({ en: 'All countries', zh: '全部国家' }),
  competitionCountrySearch: tr({ en: 'Country', zh: '国家' }),
  noCompetitionEventScrambles: tr({ en: 'No scrambles for this event', zh: '该比赛没有当前项目的打乱' }),
  competitionCountry: tr({ en: 'Country', zh: '国家' }),
  filterCompetitions: tr({ en: 'Filter competitions', zh: '筛选比赛' }),
  noMatchingCompetitions: tr({ en: 'No matching competitions', zh: '未找到匹配的比赛' }),
  competitionListLoading: tr({ en: 'Loading competitions…', zh: '正在加载比赛…' }),
  competitionRoundsLoading: tr({ en: 'Loading rounds…', zh: '正在加载轮次…' }),
  competitionSearch: tr({ en: 'Search competition', zh: '搜索比赛' }), all: tr({ en: 'All', zh: '全部' }),
  from: tr({ en: 'From', zh: '开始日期' }), to: tr({ en: 'To', zh: '结束日期' }), round: tr({ en: 'Round', zh: '轮次' }), group: tr({ en: 'Group', zh: '组别' }),
  externalTimer: tr({ en: 'Connect external timer', zh: '连接外接计时器' }), disconnect: tr({ en: 'Disconnect', zh: '断开连接' }),
  preview: tr({ en: 'Scramble state', zh: '打乱状态' }), live: tr({ en: 'Live cube', zh: '实况魔方' }),
  matched: tr({ en: 'Scramble matched', zh: '打乱已匹配' }), unmatched: tr({ en: 'Scramble not matched', zh: '打乱尚未匹配' }),
  unknown: tr({ en: 'Waiting for cube state', zh: '等待魔方状态' }),
  restore: tr({ en: 'Restore backup', zh: '恢复备份' }),
  dataImport: tr(timerSettingFieldContract('settings.data.import-file').copy),
  dataImportMapping: tr(timerSettingFieldContract('settings.data.import-session-mapping').copy),
  dataImportComplete: tr(timerSettingFieldContract('settings.data.import-complete').copy),
  dataImportPaste: tr({ en: 'Paste from clipboard', zh: '从剪贴板粘贴' }),
  dataImportInspect: tr({ en: 'Check data', zh: '检查数据' }),
  dataImportPlaceholder: tr({ en: 'Paste CubeRoot or csTimer JSON', zh: '粘贴 CubeRoot 或 csTimer JSON' }),
  dataSaveAs: tr({ en: 'Save in this mini program', zh: '保存到本小程序' }),
  dataCopy: tr({ en: 'Copy', zh: '复制' }),
  dataCompleted: tr({ en: 'Completed', zh: '已完成' }),
  dataTransferError: tr({ en: 'Transfer failed. Try again.', zh: '操作失败，请重试。' }),
  dataInvalid: tr({ en: 'Invalid or unsupported backup file.', zh: '备份文件无效或格式不受支持。' }),
  cloudUpload: tr({ en: 'Back up results to account', zh: '备份成绩到账户' }), cloudDownload: tr({ en: 'Restore account backup', zh: '恢复账户备份' }),
  comment: tr(TIMER_HISTORY_QUICK_ACTION_COPY['history.quick.comment']),
  calibrate: tr({ en: 'Calibrate cube state', zh: '校准魔方状态' }),
  statistics: tr({ en: 'Statistics', zh: '统计' }), current: tr({ en: 'Current', zh: '当前' }), more: tr({ en: 'Load more', zh: '加载更多' }),
  mean: tr({ en: 'Mean', zh: '平均' }), worst: tr({ en: 'Worst', zh: '最差' }),
  count: tr({ en: 'Solved / total', zh: '成功 / 总次数' }), deviation: tr({ en: 'Standard deviation', zh: '标准差' }),
  distribution: tr({ en: 'Time distribution', zh: '成绩分布' }),
  distributionEmpty: tr({ en: 'Need 5+ solves to chart distribution', zh: '至少 5 次成绩才显示分布' }),
  noMatches: tr({ en: 'No matching results', zh: '没有匹配的成绩' }),
  detail: tr({ en: 'Result details', zh: '成绩详情' }),
  recap: tr({ en: 'Solve report', zh: '复盘' }),
  replayInput: Object.fromEntries(Object.entries(TIMER_REPLAY_INPUT_COPY).map(([key, label]) => [key, tr(label)])),
  recapCopy: tr({ en: 'Copy moves', zh: '复制动作' }),
  recapLink: tr({ en: 'Copy replay link', zh: '复制回放链接' }),
  recapTurns: tr({ en: 'Moves', zh: '步数' }),
  recapGyro: tr(timerSettingFieldContract('settings.smart-cube.gyro').copy),
  recapFluency: tr({ en: 'Fluency', zh: '流畅度' }), event: tr({ en: 'Event', zh: '项目' }),
  rawTime: tr({ en: 'Raw time', zh: '原始时间' }), penalty: tr({ en: 'Penalty', zh: '罚时' }),
  inspectionTime: tr({ en: 'Inspection', zh: '观察用时' }), device: tr({ en: 'Device', zh: '设备' }),
  stageSplits: tr({ en: 'Stage splits', zh: '分阶段成绩' }), memo: tr({ en: 'Memo', zh: '记忆' }), execution: tr({ en: 'Execution', zh: '执行' }),
  duration: tr({ en: 'Duration', zh: '耗时' }), cumulative: tr({ en: 'Cumulative', zh: '累计' }),
  rankHint: tr({ en: 'Compared with historical WCA results; not a live official rank', zh: '对比 WCA 历史成绩，非实时官方排名' }),
  rankScopes: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'rankScopes')!.copy),
  rankCountry: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'rankCountry')!.copy),
  };
  return { ...labels, sheetTitles: {
    solver: labels.solver, content: labels.content, difficulty: labels.difficultyTitle, devices: labels.devices,
    bulk: labels.bulkTitle, wca: labels.source, source: labels.source, project: labels.event, settings: labels.settings, manual: labels.manualEntry,
    create: labels.newSession, rename: labels.rename, comment: labels.comment,
    'net-history': TIMER_ROOM_HISTORY_COPY[getMiniProgramLocale()].title,
    'net-admin': TIMER_ROOM_ADMIN_COPY[getMiniProgramLocale()].title,
    'net-rename': TIMER_ROOM_PLAYERS_COPY[getMiniProgramLocale()].rename,
    restore: labels.restore, 'battle-history': labels.battleHistory, import: labels.dataImport, statistics: labels.statistics, detail: labels.detail, recap: labels.recap, replay: labels.replayInput.title,
  } };
}
interface NativePage {
  setData(data: Record<string, unknown>, callback?: () => void): void;
  createSelectorQuery?: WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>['createSelectorQuery'];
  nativeTimer?: NativeTimer;
  liveShare?: ReturnType<typeof createNativeTimerLiveShare>;
  liveAnalysis?: ReturnType<typeof createNativeTimerLiveAnalysis>;
  liveAnalysisCopyTimer?: ReturnType<typeof setTimeout>;
  holdTimer?: ReturnType<typeof setTimeout>;
  stagePress?: WechatMiniprogram.TouchDetail;
  ticker?: ReturnType<typeof setInterval>;
  unsubscribe?: () => void;
  sheet?: string;
  active?: boolean;
  localBattle?: ReturnType<typeof createNativeTimerLocalBattle>;
  soloViewport?: ReturnType<typeof nativeContentViewport>;
  tabBarHidden?: boolean;
  netBattle?: NativeTimerNetRoom;
  netMode?: boolean;
  netLeaving?: Promise<void>;
  netEvent?: NetBattleEventId;
  netPreviewKey?: string;
  netCode?: string;
  netName?: string;
  battleRelease?: () => void;
  battleCount?: number;
  battleSource?: 'wca' | 'random';
  battlePreviewKey?: string;
  battlePreview?: string;
  connecting?: boolean;
  deviceError?: string;
  cubeDeviceSnapshot?: SmartCubeSessionSnapshot;
  deviceManagementKind?: NativeTimerDeviceKind;
  externalTimerScan?: {
    controller: AbortController;
    devices: NativeBluetoothTimerCandidate[];
    done: Promise<void>;
  };
  externalTimerMac?: { picked: NativeBluetoothTimerCandidate; value: string };
  stackmatSnapshot?: StackmatSnapshot;
  generation?: number;
  previewKey?: string;
  livePreviewKey?: string;
  liveCubeView?: NativeTimerCubeView;
  liveCubeWanted?: boolean;
  liveCubeFailed?: boolean;
  liveCubeTicket?: number;
  liveCubeFacelets?: string;
  previewController?: AbortController;
  detailPreviewController?: AbortController;
  draft?: string;
  manualDraft?: TimerManualEntryDraft;
  manualCheck?: ReturnType<typeof setTimeout>;
  manualEditing?: boolean;
  resultId?: string;
  historyLimit?: number;
  statisticsOptions?: NativeTimerStatisticsOptions;
  statisticsExpanded?: boolean;
  cloudBusy?: boolean;
  localBackups?: ReturnType<typeof createNativeTimerLocalBackups>;
  backupsExpanded?: boolean;
  backupsBusy?: boolean;
  importBusy?: boolean;
  syncSeedDraft?: string;
  inspectionAlertsHelpRequest?: number;
  stagedImport?: Exclude<NativeTimerImport, { kind: 'invalid' }>;
  importTargets?: Record<string, EventId>;
  competitions?: readonly TimerWcaCompetition[];
  competitionRows?: TimerWcaCompetitionScramble[] | null;
  competitionQuery?: string;
  competitionPeriod?: TimerWcaCompetitionPeriod;
  competitionCountry?: string;
  competitionCountryQuery?: string;
  competitionLimit?: number;
  competitionCountryCodes?: string[];
  competitionLocale?: string;
  competitionRequest?: number;
  competitionSourceFlagId?: string;
  sheetGeneration?: number;
  layoutEditing?: boolean;
  layoutDrag?: {
    region: TimerSoloLayoutRegion; mode: TimerSoloLayoutGesture; identifier: number; y: number; value: number;
    height: number; minimum: number; maximum: number; lastY: number; measuring: boolean; ended: boolean;
  };
  layoutDraft?: Partial<TimerSoloLayoutSettings>;
  difficultyPress?: {
    identifier: number; x: number; ended: boolean;
    track?: { left: number; width: number }; bound?: 'low' | 'high';
  };
  difficultyDraft?: TimerWcaDifficultySettings;
  randomDifficultyDraft?: TimerRandomDifficultySettings;
  trainerCase?: NativeTimer['randomDifficultyResult'];
  trainerController?: AbortController;
  trainerAnswer?: { notation: string; frame: string };
  difficultyCatalog?: TimerWcaDifficultyCatalog;
  difficultyCoverage?: TimerWcaDifficultyCoverage;
  stopSolver?: () => void;
  stageSolver?: ReturnType<typeof createNativeStageSolver>;
  stageComparison?: ReturnType<typeof startNativeTimerSolverComparison>;
  comparisonLayoutRequest?: number;
  comparisonHeight?: number;
  stageCounts?: number[];
  stageGridInfo?: { elapsedMs?: number; tables: StageSolverTableSize[] };
  bulkScrambles?: ReturnType<typeof createNativeTimerScrambleSource>;
  stageResult?: NativeStageSolverMoves;
  stageDisplayRows?: ReturnType<typeof nativeStageSolverCandidateRows>;
  stageReveal?: boolean;
  stageRevealed?: Record<number, number>;
  stageFace?: number;
  stageCells?: boolean[];
  stageColors?: string;
  stageLimit?: number;
  stageSlack?: number;
  stageCombo?: string;
  stageBase?: number;
  solverScramble?: string;
  hintsToken?: number;
  recap?: NativeTimerRecap;
  replayRequest?: AbortController;
  replaySolve?: Solve;
  recapCube?: NativeTimerCubeView;
  recapIndex?: number;
  recapGyro?: boolean;
  recapAnimation?: ReturnType<typeof setInterval>;
  autoRecapId?: string;
  solverPlayback?: NativeStageSolverPlayback;
  solverFrame?: number;
  solverPausedByUser?: boolean;
  solverStepNotation?: ReturnType<typeof timer333StepNotation>;
  solverStepCache?: { scramble: string; methods: Map<MethodId, SolveResult> };
  solverNotationCopyTimer?: ReturnType<typeof setTimeout>;
  solverCube?: NativeTimerCubeView;
  solverCanvasTicket?: number;
  solverCubeGesture?: { id: number; x: number; y: number };
  solverAnimation?: ReturnType<typeof setInterval>;
  rankKey?: string;
  rankOfficial?: { id: string; rows: TimerRankOfficialRow[] };
}
const emptyDifficultyCatalog = { distribution: null, eventLengths: null, layout: null };
const difficultyColors = timerAllColorSubsetOptions();
const difficultyColorModes = { dual: { en: 'Dual', zh: '双色' }, cn: { en: 'CN', zh: '六色' }, single: { en: 'Single', zh: '单色' }, quad: { en: 'Quad', zh: '四色' } };
function difficultyColorGroups() {
  const isZh = getMiniProgramLocale() === 'zh';
  return TIMER_COLOR_MODE_ORDER.map(mode => ({ mode, label: tr(difficultyColorModes[mode]), options: difficultyColors.filter(option => option.mode === mode)
    .map(option => ({ key: option.key, swatch: timerColorSwatchBackground(option.colors), label: option.colors.map(color => tr(TIMER_COLOR_NAMES[color])).join(isZh ? '' : '+') })) }));
}
function difficultyStageOptions(stages: readonly string[]) {
  const isZh = getMiniProgramLocale() === 'zh';
  return stages.map(key => ({ key, label: stageLabel(key, isZh) }));
}
function difficultySelection(method: string, stage: string, options: readonly string[], colors: unknown, isZh: boolean) {
  const methodName = variantLabel(method, isZh), stageName = stage ? stageLabel(stage, isZh) : '';
  const option = timerColorSubsetOption(colors);
  return {
    difficultySelectedMethod: method, difficultySelectedStage: stage,
    difficultyMethodLabel: !stageName ? methodName : method === 'std' || methodName === stageName ? stageName : `${methodName} ${stageName}`,
    difficultyMethodOptions: options.map(key => ({ key, label: variantLabel(key, isZh) })),
    difficultyColorKey: option.key, difficultyColorSwatch: timerColorSwatchBackground(option.colors),
  };
}
function difficultyModel(p: NativePage, settings: TimerWcaDifficultySettings) {
  return timerWcaDifficultyUiModel(p.nativeTimer ? timerWcaScrambleEventId(p.nativeTimer.event) : null,
    settings, p.difficultyCatalog ?? emptyDifficultyCatalog, p.difficultyCoverage ?? 'idle');
}
function difficultySlider(min: number, max: number, low: number, high: number, marks?: number[]) {
  const percent = (value: number) => max === min ? 50 : (value - min) / (max - min) * 100;
  return { min, max, low, high, lowPercent: percent(low), highPercent: percent(high),
    marks: (marks ?? Array.from({ length: Math.min(15, max - min + 1) }, (_, index) => min + index))
      .map(value => ({ value, position: percent(value) })) };
}
function refreshDifficulty(p: NativePage, patch?: Partial<TimerWcaDifficultySettings>) {
  if (!p.difficultyDraft) return;
  const settings = normalizeTimerWcaDifficultySettings({ ...p.difficultyDraft, ...patch });
  const model = difficultyModel(p, settings);
  p.difficultyDraft = { ...settings, ...reconcileTimerWcaDifficultySettings(settings, model) };
  const isZh = getMiniProgramLocale() === 'zh';
  p.setData({
    difficultyModel: model, difficultySlider: difficultySlider(model.stepMin, model.stepMax, ...model.selectedRange, model.marks),
    ...difficultySelection(model.uiVariant, model.showStage ? model.dataStage : '', model.variantOptions, p.difficultyDraft.wcaDiffColors, isZh),
  });
}
const randomAxes = ['best', 2, 1, 0] as const;
function refreshRandomDifficulty(p: NativePage, patch?: Partial<TimerRandomDifficultySettings>) {
  if (!p.randomDifficultyDraft) return;
  const settings = normalizeTimerRandomDifficultySettings({ ...p.randomDifficultyDraft, ...patch });
  p.randomDifficultyDraft = { ...settings, ...reconcileTimerRandomDifficultySettings(settings, timerRandomDifficultyUiModel(settings)) };
  const model = timerRandomDifficultyUiModel(p.randomDifficultyDraft);
  const isZh = getMiniProgramLocale() === 'zh';
  p.setData({
    randomDifficulty: model, difficultySlider: difficultySlider(model.stepMin, model.stepMax, model.lo, model.hi, model.marks),
    ...difficultySelection(model.method, model.stage, model.methods, p.randomDifficultyDraft.genDiffColors, isZh),
    randomAxes: randomAxes.map(axis => axis === 'best' ? tr(TIMER_RANDOM_DIFFICULTY_COPY.bestAxis)
      : tr(TIMER_RANDOM_DIFFICULTY_COPY.fixedAxis).replace('{axis}', EO_AXIS_LABELS[axis])),
    randomAxisIndex: Math.max(0, randomAxes.indexOf(model.eoAxis)),
    randomSlots: [tr(model.stage === 'block222' ? TIMER_RANDOM_DIFFICULTY_COPY.bestBlock : TIMER_RANDOM_DIFFICULTY_COPY.bestSlot), ...model.slotNames],
    randomGap: model.gapText ? tr(TIMER_RANDOM_DIFFICULTY_COPY.rare).replace('{gaps}', model.gapText) : '',
    randomInfo: tr(TIMER_RANDOM_DIFFICULTY_COPY.answerWhy).replace('{god}', String(model.stepMax)),
  });
}
function openDifficulty(p: NativePage, sheetGeneration: number) {
  const t = p.nativeTimer;
  if (!t) return;
  if (t.currentSource === 'random') {
    p.randomDifficultyDraft = normalizeTimerRandomDifficultySettings({ ...t.settings, genDiffOn: true });
    p.setData({ randomDifficultyInfoOpen: false });
    refreshRandomDifficulty(p);
    return;
  }
  p.difficultyDraft = normalizeTimerWcaDifficultySettings({ ...t.settings, wcaDifficultyOn: true });
  p.difficultyCoverage = 'idle';
  refreshDifficulty(p);
  const current = () => p.active && p.sheet === 'difficulty' && p.sheetGeneration === sheetGeneration;
  void nativeWcaDifficulty.loadCatalog().then(catalog => {
    if (!current()) return;
    p.difficultyCatalog = catalog;
    refreshDifficulty(p);
  }).catch(() => { /* Shared fallback bounds remain usable. */ });
  const event = timerWcaScrambleEventId(t.event);
  if (t.settings.wcaScrambleMode !== 'comp' || !t.settings.wcaComp || !event) return;
  void nativeWcaDifficulty.probeCompetitionCoverage(t.settings.wcaComp, t.settings.wcaCompName, event).then(indexed => {
    if (!current()) return;
    p.difficultyCoverage = indexed === null ? 'unknown' : indexed ? 'indexed' : 'unindexed';
    refreshDifficulty(p);
  }).catch(() => { /* Keep an unknown coverage state available for retry. */ });
}
function refreshRank(p: NativePage) {
  const t = p.nativeTimer, solve = t?.state.phase === 'stopped' ? t.lastResult : null;
  const value = solve ? effectiveMs(solve) : null;
  if (!t || !solve || value === null || !Number.isFinite(value) || value <= 0) {
    if (p.rankKey) { p.rankKey = ''; p.setData({ rankLine: '' }); }
    return;
  }
  const scopes = t.settings.rankScopes, country = t.settings.rankCountry;
  const personId = (getStoredSessionSnapshot().session?.user.wcaId ?? '').trim().toUpperCase();
  const key = JSON.stringify([solve.id, value, scopes, country, personId]);
  if (p.rankKey === key) return;
  p.rankKey = key; p.setData({ rankLine: '' });
  const centis = Math.round(value / 10), event = toWcaEventForRank(solve.event);
  void Promise.all([
    scopes.some(scope => scope === 'WR' || ((scope === 'NR' || scope === 'CR') && country))
      ? ranks.fetchRankFor(solve.event, centis, 'single', country || undefined) : Promise.resolve(null),
    scopes.includes('PR') && WCA_ID_REGEX.test(personId) ? (p.rankOfficial?.id === personId ? Promise.resolve(p.rankOfficial.rows)
      : requestJson<{ results?: TimerRankOfficialRow[] }>(`/wca/person-page?wcaId=${encodeURIComponent(personId)}&v=1`).then(data => {
        const rows = Array.isArray(data.results) ? data.results : []; p.rankOfficial = { id: personId, rows }; return rows;
      }).catch(() => [])) : Promise.resolve([]),
  ]).then(([result, official]) => {
    if (!p.active || p.rankKey !== key) return;
    const personal = event ? timerPersonalOfficialRank(official, event, centis, 'single') : null;
    const pills = timerRankPills(scopes, personal, result, country);
    p.setData({ rankLine: pills.map(({ label, data }) => `${label}${data.rank === 1 ? '' : data.rank.toLocaleString('en-US')}`).join(' / ') });
  }).catch(() => { if (p.active && p.rankKey === key) p.setData({ rankLine: '' }); });
}
function nativeCompetitionFlag(country: string) {
  if (!country) return null;
  const { kind, code } = countryFlagIdentity(country);
  return { kind, src: kind === 'flag' || kind === 'chinese-taipei' ? `/assets/country-flags/${code}.png` : '' };
}
function refreshCompetitionSourceFlag(p: NativePage, competitionId: string, settings: NativeTimer['settings']) {
  if (p.competitionSourceFlagId === competitionId) return;
  p.competitionSourceFlagId = competitionId;
  const known = (settings.wcaComp === competitionId && settings.wcaCompCountry)
    || p.competitions?.find(row => row.id === competitionId)?.country || '';
  p.setData({ competitionSourceFlag: nativeCompetitionFlag(known) });
  if (!competitionId || known) return;
  void loadNativeCompetitionCountry(competitionId).then(country => {
    if (p.active && p.competitionSourceFlagId === competitionId) p.setData({ competitionSourceFlag: nativeCompetitionFlag(country) });
  });
}
function refreshCompetitionSuggestions(p: NativePage) {
  const today = toLocalIsoDate(new Date());
  const period = p.competitionPeriod ?? 'all';
  const country = p.competitionCountry ?? '';
  const available = availableTimerWcaCompetitions(p.competitions ?? [], timerWcaCompetitionPeriodStart(today, period), today);
  const language = getMiniProgramLocale();
  const countries = [...new Set(available.map(row => row.country.toUpperCase()).filter(Boolean).concat(country || []))]
    .map(code => ({ code, name: countryName(code, language === 'zh'), flag: nativeCompetitionFlag(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
  p.competitionCountryCodes = ['', ...countries.map(row => row.code)];
  const rows = timerWcaCompetitionSuggestions(available, p.competitionQuery ?? '', country, true);
  const limit = p.competitionLimit ?? 40;
  const countryQuery = p.competitionCountryQuery?.trim();
  const countryMatches = countryQuery
    ? searchCountries(countryQuery, { restrictTo: countries.map(row => row.code), limit: 20 })
      .map(row => ({ code: row.iso2.toUpperCase(), name: countryName(row.iso2, language === 'zh'), flag: nativeCompetitionFlag(row.iso2) }))
    : [{ code: '', name: copy().allCompetitionsCountries, flag: null }, ...countries];
  const selected = p.competitions?.find(row => row.id === p.nativeTimer?.settings.wcaComp);
  p.setData({
    competitionMatches: rows.slice(0, limit).map(row => ({ ...row, dateLabel: formatDateRangeIso(row.startDate, row.endDate), flag: nativeCompetitionFlag(row.country) })),
    competitionHasMore: rows.length > limit, competitionListHeight: Math.min(rows.length, 8) * 42,
    competitionPeriodIndex: TIMER_WCA_COMPETITION_PERIODS.findIndex(entry => entry.id === period),
    competitionCountryLabel: country ? countryName(country, language === 'zh') : copy().allCompetitionsCountries,
    competitionCountryFlag: nativeCompetitionFlag(country),
    competitionCountryMatches: countryMatches, competitionCountryScrollHeight: Math.min(countryMatches.length, 6) * 36,
    competitionSelectedName: selected?.selectedDisplayName ?? selected?.name ?? '',
    competitionSelectedFlag: nativeCompetitionFlag(selected?.country ?? p.nativeTimer?.settings.wcaCompCountry ?? ''),
  });
}
function refreshCompetitionOptions(p: NativePage) {
  const t = p.nativeTimer;
  if (!t) return;
  const options = timerWcaRoundGroupOptions(p.competitionRows ?? null, timerWcaScrambleEventId(t.event), t.settings.wcaRound);
  const rounds = ['', ...options.rounds], groups = ['', ...options.groups];
  p.setData({ rounds, groups, competitionHasEvent: options.hasEvent, roundLabels: rounds.map(r => r ? timerWcaRoundShortLabel(r) : copy().all), groupLabels: groups.map(g => g || copy().all),
    roundIndex: Math.max(0, rounds.indexOf(t.settings.wcaRound)), groupIndex: Math.max(0, groups.indexOf(t.settings.wcaGroup)) });
}
async function loadCompetitionOptions(p: NativePage) {
  const id = p.nativeTimer?.settings.wcaComp ?? '';
  const request = p.competitionRequest = (p.competitionRequest ?? 0) + 1;
  p.competitionRows = null; refreshCompetitionOptions(p);
  p.setData({ competitionRoundsStatus: id ? 'loading' : 'idle' });
  if (!id) return;
  try {
    const rows = await loadNativeCompetitionScrambles(id);
    if (!p.active || p.sheet !== 'wca' || p.competitionRequest !== request) return;
    p.competitionRows = rows;
    p.setData({ competitionRoundsStatus: 'ready' });
    refreshCompetitionOptions(p);
  } catch { if (p.active && p.sheet === 'wca' && p.competitionRequest === request) p.setData({ competitionRoundsStatus: 'error' }); }
}
function stopNativeBulkScrambles(p: NativePage) {
  p.bulkScrambles?.release();
  p.bulkScrambles = undefined;
}
function showSolverFrame(p: NativePage, index: number, animate = false) {
  const playback = p.solverPlayback;
  if (!playback) return;
  const frame = nativeStageSolverFrame(playback, index, !p.solverCube);
  p.solverFrame = frame.frame;
  if (p.solverCube) {
    if (animate && frame.move) p.solverCube.replayMove(frame.move, 17);
    else p.solverCube.replaySetup(nativeStageSolverPosition(playback, frame.frame));
  }
  p.setData({ playback: frame });
}

function setSolverPlayback(p: NativePage, playback: NativeStageSolverPlayback, selected = 0) {
  if (p.solverAnimation) clearInterval(p.solverAnimation);
  p.solverAnimation = undefined;
  p.solverPausedByUser = false;
  p.solverPlayback = playback;
  p.setData({ playing: false, solverSelected: selected });
  showSolverFrame(p, 0);
}

const SOLVER_REVEAL_STORAGE = 'timer.solverHints.progressiveReveal';
const SOLVER_STEP_METHOD_STORAGE = 'timer.solverHints.method';

function copySolverNotation(text: string, success?: () => void) {
  const api = miniProgramApi();
  const fail = () => api.showToast({ title: tr(TIMER_333_STEP_COPY.copyFailed), icon: 'none' });
  try { api.setClipboardData({ data: text, success, fail }); }
  catch { fail(); }
}

function displayNativeStageCandidates(p: NativePage, selected = 0) {
  const candidates = p.stageDisplayRows;
  const rows = candidates?.map(row => {
    const tokens = row.body.split(/\s+/).filter(Boolean);
    const count = p.stageRevealed?.[row.index] ?? 0;
    const hidden = Boolean(p.stageReveal && count < tokens.length);
    const solutionText = hidden ? [...tokens.slice(0, count), '…'].join(' ') : row.body;
    return { ...row, hidden, solutionText };
  }) ?? [];
  const candidate = rows[selected];
  p.setData({ stageResult: rows, solverPlayerHidden: candidate?.hidden ?? false, solverSelected: selected }, () => {
    if (p.active && p.sheet === 'solver' && p.stageDisplayRows === candidates && candidate && !candidate.hidden && !p.solverCube) {
      openSolverCanvas(p);
    }
  });
  if (p.solverScramble && candidate) {
    setSolverPlayback(p, nativeStageSolverPlayback(p.solverScramble, candidate.hidden ? candidate.lead : candidate.m), selected);
  }
  return candidate;
}

function releaseSolverCanvas(p: NativePage) {
  p.solverCanvasTicket = (p.solverCanvasTicket ?? 0) + 1;
  p.solverCube?.dispose();
  p.solverCube = undefined;
  p.solverCubeGesture = undefined;
}

function measureSolverPlayer(p: NativePage, after: () => void) {
  const query = p.createSelectorQuery?.() ?? miniProgramApi().createSelectorQuery?.();
  if (!query) { after(); return; }
  query.select('.nt-solver-results-scroll').boundingClientRect();
  query.exec(([bounds]) => {
    if (!bounds?.height) { after(); return; }
    p.setData({ solverPlayerHeight: bounds.height }, after);
  });
}

function openSolverCanvas(p: NativePage) {
  releaseSolverCanvas(p);
  const ticket = p.solverCanvasTicket;
  const current = () => p.active && p.sheet === 'solver' && p.solverCanvasTicket === ticket;
  p.setData({ solverCanvasReady: false, solverCanvas: true }, () => measureSolverPlayer(p, () => {
    if (!current()) return;
    const createQuery = p.createSelectorQuery?.bind(p) ?? miniProgramApi().createSelectorQuery?.bind(miniProgramApi());
    if (!createQuery) return;
    const query = createQuery();
    query.select('.nt-solver-screen').fields({ computedStyle: ['backgroundColor'] });
    query.select('.nt-solver-position').fields({ computedStyle: ['color', 'borderTopColor'] });
    query.exec(([data, sliderStyle]) => {
      if (!current()) return;
      const backdrop = (data as unknown as { backgroundColor?: string } | null)?.backgroundColor ?? '#fafafa';
      const slider = sliderStyle as unknown as { color?: string; borderTopColor?: string } | null;
      const sliderColor = (value?: string) => {
        const channels = value?.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)?.slice(1).map(Number);
        return channels ? '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('') : value ?? '';
      };
      if (slider) p.setData({ solverSliderAccent: sliderColor(slider.color), solverSliderTrack: sliderColor(slider.borderTopColor) });
      const fallback = () => {
        if (!current()) return;
        p.solverCube = undefined;
        p.setData({ solverCanvasReady: false, solverCanvas: false });
        showSolverFrame(p, p.solverFrame ?? 0);
      };
      void mountNativeTimerCubeView({ createSelectorQuery: createQuery }, '#nt-solver-cube-canvas', fallback,
        { solverBackdrop: backdrop }).then(view => {
          if (!current()) { view?.dispose(); return; }
          if (!view) { fallback(); return; }
          p.solverCube = view;
          p.setData({ solverCanvasReady: true }, () => {
            if (current()) showSolverFrame(p, p.solverFrame ?? 0);
          });
        });
    });
  }));
}

function stopNativeSolver(p: NativePage, dispose = false) {
  p.stopSolver?.();
  p.stopSolver = undefined;
  p.stageComparison?.(); p.stageComparison = undefined;
  if (p.solverAnimation) clearInterval(p.solverAnimation);
  p.solverAnimation = undefined;
  p.solverPlayback = undefined; p.solverFrame = undefined;
  clearTimeout(p.solverNotationCopyTimer); p.solverNotationCopyTimer = undefined;
  p.solverStepNotation = undefined;
  if (dispose) {
    releaseSolverCanvas(p);
    p.stageSolver?.dispose();
    p.stageSolver = undefined;
    p.stageGridInfo = undefined;
    p.stageResult = undefined;
    p.solverStepCache = undefined;
  }
}

function measureSolverComparison(p: NativePage) {
  const comparison = p.stageComparison;
  if (!p.active || p.sheet !== 'solver' || !comparison) return;
  const query = p.createSelectorQuery?.();
  if (!query) return;
  const request = p.comparisonLayoutRequest = (p.comparisonLayoutRequest ?? 0) + 1;
  query.select('#nt-steps-comparison').boundingClientRect();
  query.select('.nt-steps-comparison-heading').boundingClientRect();
  query.select('.nt-steps-comparison-scroll .solver-compare-content').boundingClientRect();
  query.exec(([overlay, heading, content]) => {
    if (!p.active || p.stageComparison !== comparison || p.comparisonLayoutRequest !== request || !overlay || !heading || !content) return;
    // Outer gutter, card padding and border, and the gap under the heading.
    const available = Math.max(1, Math.floor(overlay.height - heading.height - 74));
    const height = Math.min(Math.ceil(content.height), available);
    if (!height || height === p.comparisonHeight) return;
    p.comparisonHeight = height;
    p.setData({ compareScrollHeight: height });
  });
}

function nativeStageSolverInfo(p: NativePage) {
  const tables = p.stageResult?.tables ?? p.stageGridInfo?.tables;
  return {
    ...stageSolverInfoModel({ workers: 1, totalMs: p.stageGridInfo?.elapsedMs,
      enumerationMs: p.stageResult?.ms, tables: summarizeStageSolverTables(tables ?? []), bundledCross: true,
    }, getMiniProgramLocale()),
    tablesKnown: Boolean(tables),
  };
}
function nativeStageOptions(p: NativePage, method: StageSolverMethod, stage: number) {
  const kind = stageSolverRestrictionKind(method);
  const cells = p.stageCells ?? (kind === 'single-face' ? STAGE_SOLVER_DEFAULT_FACES : STAGE_SOLVER_DEFAULT_CELLS);
  const slotCount = stageSolverSlotCount(method, stage);
  const combinations = stageSolverSlotCombinations(slotCount);
  const slotOptions = [{ value: '', label: copy().solverBest },
    ...combinations.map(indices => ({ value: indices.join(','), label: indices.map(index => STAGE_SOLVER_SLOT_LABELS[index]).join(' / ') }))];
  const baseOptions = [{ value: -1, label: copy().solverBest }, ...STAGE_SOLVER_SLOT_LABELS.flatMap((label, index) =>
    p.stageCombo?.split(',').includes(String(index)) ? [] : [{ value: index, label }])];
  const restriction = stageSolverMoveRestriction(method, cells);
  const restrictionCells = kind === 'none' ? [] : cells.map((enabled, index) => ({ enabled, index, label: STAGE_SOLVER_MOVE_CELLS[index] }));
  const isZh = getMiniProgramLocale() === 'zh', stageKey = VARIANT_STAGES[method][stage];
  const methodName = variantLabel(method, isZh), stageName = stageLabel(stageKey, isZh);
  const colorOption = timerColorSubsetOption(p.stageColors);
  p.setData({
    stageRestricted: restriction.restricted,
    stageRestriction: [restrictionCells.slice(0, 6), restrictionCells.slice(6, 12), restrictionCells.slice(12)].filter(row => row.length),
    stageShowSlot: slotCount > 0 && combinations.length > 1, stageSlots: slotOptions,
    stageSlotIndex: Math.max(0, slotOptions.findIndex(item => item.value === p.stageCombo)),
    stageShowBase: stageSolverHasBase(method), stageBases: baseOptions,
    stageBaseIndex: Math.max(0, baseOptions.findIndex(item => item.value === p.stageBase)),
    stageSlackOptions: STAGE_SOLVER_SLACK_OPTIONS.map(value => value ? `${copy().solverBest}+${value}` : copy().solverBest),
    stageSlackIndex: STAGE_SOLVER_SLACK_OPTIONS.findIndex(value => value === (p.stageSlack ?? STAGE_SOLVER_DEFAULT_SLACK)),
    stageLimitOptions: STAGE_SOLVER_LIMIT_OPTIONS.map(value => value || '∞'),
    stageLimitIndex: STAGE_SOLVER_LIMIT_OPTIONS.findIndex(value => value === (p.stageLimit ?? STAGE_SOLVER_DEFAULT_LIMIT)),
    solverSelectedMethod: method, solverSelectedStage: stageKey,
    solverStageLabel: method === 'std' || methodName === stageName ? stageName : `${methodName} ${stageName}`,
    solverStageMethods: STAGE_SOLVER_METHODS.map(key => ({ key, label: variantLabel(key, isZh) })),
    solverColorGroups: difficultyColorGroups(), solverColorKey: colorOption.key,
    stageColorSwatches: [...timerColorSubsetOption(p.stageColors).colors].reverse().map(color => TIMER_COLOR_HEX[color]),
  });
  return restriction;
}
function nativeDeviceState(p: NativePage, timer: NativeTimer) {
  return {
    bluetoothAvailable: typeof miniProgramApi().openBluetoothAdapter === 'function',
    busy: timer.busy, connecting: p.connecting, cube: p.cubeDeviceSnapshot,
    cubeConnected: timer.cubeConnected, canResetCube: timer.canResetCube, calibrating: timer.calibrating,
    externalConnected: timer.externalConnected, externalName: timer.externalName,
    externalKind: timer.externalKind, externalState: timer.externalState, externalLastTime: timer.externalLastTime,
    externalScan: p.externalTimerScan?.devices.map(({ device, name }) => ({ deviceId: device.deviceId, deviceName: name })),
    externalMac: p.externalTimerMac ? { name: p.externalTimerMac.picked.name, value: p.externalTimerMac.value } : undefined,
    stackmatAvailable: typeof miniProgramApi().getRecorderManager === 'function',
    stackmat: p.stackmatSnapshot,
  };
}

async function connectExternalTimerCandidate(p: NativePage, t: NativeTimer, picked: NativeBluetoothTimerCandidate, mac?: string) {
  const sheetGeneration = p.sheetGeneration;
  const current = () => p.active && p.sheetGeneration === sheetGeneration;
  const scan = p.externalTimerScan;
  p.connecting = true;
  p.deviceError = '';
  p.externalTimerMac = undefined;
  scan?.controller.abort();
  refresh(p, true);
  try {
    await scan?.done;
    if (!current()) return;
    if (picked.driver === 'qiyi-timer' && !mac && !resolveNativeQiyiTimerMac(picked.device)) {
      p.externalTimerMac = { picked, value: '' };
      return;
    }
    await startExternalTimer('', picked.driver, t.receiveExternal, {
      device: { ...picked.device, name: picked.name }, mac,
      canReconnect: () => p.active === true && !t.busy,
    });
  } catch (error) {
    if (current()) p.deviceError = error instanceof Error ? error.message : String(error);
  } finally {
    p.connecting = false;
    if (p.active) refresh(p, true);
  }
}
function disposeRecapView(p: NativePage) {
  if (p.recapAnimation) clearInterval(p.recapAnimation);
  p.recapAnimation = undefined; p.recapIndex = undefined;
  p.recapCube?.dispose(); p.recapCube = undefined;
  p.recap = undefined;
  p.setData({ recapCanvas: false, recapCanvasReady: false });
}
function showRecapFrame(p: NativePage, frame: ReturnType<NativeTimerRecap['seek']>, animate = false) {
  const report = p.recap, view = p.recapCube;
  if (report && view) {
    if (animate && p.recapIndex !== undefined && frame.index >= p.recapIndex && frame.index - p.recapIndex <= 2) {
      for (let index = p.recapIndex + 1; index <= frame.index; index++) {
        const move = report.moveAt(index);
        if (move) view.replayMove(move.token, move.durationTicks);
      }
    } else if (!animate || frame.index !== p.recapIndex) view.replaySetup(frame.setup);
    const pose = p.recapGyro ? report.poseAt(frame.timeMs) : null;
    if (pose) view.pose(pose);
    p.recapIndex = frame.index;
  }
  p.setData({ recapFrame: view ? { ...frame, image: '' } : frame });
}
function stopLiveCube(p: NativePage) {
  p.liveCubeTicket = (p.liveCubeTicket ?? 0) + 1;
  p.liveCubeView?.dispose();
  p.liveCubeView = undefined; p.liveCubeWanted = false; p.liveCubeFacelets = undefined;
  p.setData({ liveCanvas: false, liveCanvasReady: false });
}
function nativeLiveAnalysisActive(p: NativePage, timer: NativeTimer) {
  return Boolean(p.active && !p.sheet && !p.layoutEditing && !p.localBattle && !p.netMode
    && timer.cubeConnected && timer.settings.liveSolutionAnalysis && timer.state.phase === 'running');
}
function refreshLiveCube(p: NativePage, timer: NativeTimer) {
  const facelets = timer.facelets;
  const viewMode = nativeTimerLiveView(timer.settings.liveCubeView);
  const wanted = Boolean(p.createSelectorQuery && facelets && timer.cubeConnected && viewMode === '3d'
    && !p.sheet && !p.layoutEditing && !p.liveCubeFailed);
  if (!wanted || !facelets) {
    if (p.liveCubeWanted) stopLiveCube(p);
    if (!timer.cubeConnected || viewMode !== '3d') p.liveCubeFailed = false;
    return;
  }
  if (p.liveCubeView) {
    if (p.liveCubeFacelets !== facelets) {
      p.liveCubeFacelets = facelets; p.liveCubeView.reset(facelets);
    }
    return;
  }
  if (p.liveCubeWanted || !p.createSelectorQuery) return;
  p.liveCubeWanted = true;
  const ticket = p.liveCubeTicket = (p.liveCubeTicket ?? 0) + 1;
  const current = () => p.active && p.liveCubeWanted && p.liveCubeTicket === ticket;
  p.setData({ liveCanvas: true }, () => {
    if (!current()) return;
    const unavailable = () => { if (current()) { p.liveCubeFailed = true; stopLiveCube(p); } };
    void mountNativeTimerCubeView({ createSelectorQuery: p.createSelectorQuery!.bind(p) }, '#nt-live-cube-canvas', unavailable).then(view => {
      if (!current()) { view?.dispose(); return; }
      if (!view) { unavailable(); return; }
      p.liveCubeView = view;
      p.liveCubeFacelets = timer.facelets ?? facelets;
      view.reset(p.liveCubeFacelets);
      const pose = timer.cubePose;
      if (pose) view.pose(pose);
      p.setData({ liveCanvasReady: true });
    }, unavailable);
  });
}
function updateTrainerCase(p: NativePage, timer: NativeTimer) {
  const current = timer.randomDifficultyResult;
  if (p.trainerCase === current) {
    if (timer.busy && p.trainerController) {
      p.trainerController.abort(); p.trainerController = undefined;
      p.setData({ trainerBusy: false });
    }
    return;
  }
  p.trainerController?.abort(); p.trainerController = undefined;
  p.trainerCase = current; p.trainerAnswer = undefined;
  p.setData({ trainerCase: current ? timerRandomDifficultyCaseLabels(current.spec, current.depth, getMiniProgramLocale()) : null,
    trainerAnswer: null, trainerBusy: false, trainerError: false, trainerShown: false });
}
const localBattleEvents = new Set(BATTLE_EVENT_IDS);
function localBattleProjects() {
  return nativeTimerEvents().filter(event => localBattleEvents.has(event.id));
}
function stopLocalBattle(p: NativePage) {
  p.localBattle?.dispose();
  p.localBattle = undefined; p.battlePreviewKey = undefined;
  p.battleRelease?.(); p.battleRelease = undefined;
}
function refreshLocalBattle(p: NativePage) {
  const snapshot = p.localBattle?.snapshot(), timer = p.nativeTimer;
  if (!p.active || !snapshot || !timer) return;
  const events = localBattleProjects();
  const winnerIds = new Set(snapshot.winners);
  const previewKey = `${timer.settings.showCubePreview}|${snapshot.event}|${snapshot.scramble}`;
  if (p.battlePreviewKey !== previewKey) {
    p.battlePreviewKey = previewKey;
    try { p.battlePreview = snapshot.scramble && timer.settings.showCubePreview ? nativeTimerPreview(snapshot.event, snapshot.scramble) : ''; }
    catch { p.battlePreview = ''; }
  }
  p.setData({
    battle: {
      ...snapshot, rounds: snapshot.rounds.slice(-50).reverse().map(round => ({
        id: round.id, date: new Date(round.ts).toLocaleString(getMiniProgramLocale() === 'zh' ? 'zh-CN' : 'en-US'),
        times: round.attempts.map(attempt => ({
          playerId: attempt.playerId, result: formatSolveResult(attempt.solve, timer.settings.precision),
        })),
      })),
      players: snapshot.players.map((player, index) => ({ ...player,
        label: tr({ en: `Player ${index + 1}`, zh: `玩家 ${index + 1}` }),
        winner: winnerIds.has(player.id), index,
        penaltyIndex: player.penalty === '+2' ? 1 : player.penalty === 'dnf' ? 2 : 0,
      })),
      eventIndex: Math.max(0, events.findIndex(event => event.id === snapshot.event)),
      sourceIndex: p.battleSource === 'random' ? 1 : 0,
      eventName: events.find(event => event.id === snapshot.event)?.name ?? snapshot.event,
      preview: p.battlePreview ?? '',
    },
    battleEvents: events,
  });
}
function startLocalBattle(p: NativePage, count: number) {
  const timer = p.nativeTimer;
  if (!timer) return;
  stopLocalBattle(p);
  const api = miniProgramApi(), wca = createNativeWcaPool(), source = createNativeTimerScrambleSource();
  const initialEvent = localBattleEvents.has(timer.event) ? timer.event : '333';
  p.battleSource ??= timer.currentSource === 'wca' ? 'wca' : 'random';
  p.battleRelease = () => { wca.dispose(); source.release(); };
  p.localBattle = createNativeTimerLocalBattle({
    playerCount: count, initialEvent,
    storage: {
      getItem(key) {
        if (api.getStorageInfoSync && !api.getStorageInfoSync().keys.includes(key)) return null;
        const value = api.getStorageSync<unknown>(key);
        return typeof value === 'string' && value ? value : null;
      },
      setItem: (key, value) => api.setStorageSync(key, value),
      removeItem: key => api.removeStorageSync(key),
    },
    settings: () => timer.settings,
    onChange: () => refreshLocalBattle(p),
    requestScramble: async (event, signal) => {
      if (p.battleSource === 'wca' && timerSupportsRealWcaScrambles(event)) {
        const spec = { event, ...resolveTimerWcaSourceCore(timer.settings), optimal: timer.settings.wcaUseOptimal };
        const request = wca.startNext(spec);
        const abort = () => request.cancel();
        signal.addEventListener('abort', abort, { once: true });
        try {
          const result = await request.result;
          if (signal.aborted || result.kind !== 'ready') throw new Error('Official battle scramble unavailable');
          const identity = result.value.slot ?? wca.sourceKey(spec);
          if (!identity) throw new Error('Official battle scramble has no source identity');
          return { scramble: result.value.scramble, wca: result.value.meta ?? undefined,
            source: { kind: 'wca', identity } };
        } finally { signal.removeEventListener('abort', abort); }
      }
      const abort = () => source.cancel();
      signal.addEventListener('abort', abort, { once: true });
      try {
        const scramble = await source.generate(event, timer.settings.scramble222Mode);
        if (signal.aborted) throw new Error('Battle scramble cancelled');
        return { scramble, source: { kind: 'random', identity: `random|${event}` } };
      } finally { signal.removeEventListener('abort', abort); }
    },
  });
  timer.setAutoReadyBlocked(true);
  refreshLocalBattle(p);
}
function netProjects() {
  const events = nativeTimerEvents();
  return NET_EVENTS.map(id => ({ id, name: events.find(event => event.id === id)?.name ?? id }));
}

function roomCopy(language = getMiniProgramLocale()) {
  const { pending: _pending, waiting: _waiting, ...status } = TIMER_ROOM_ROUND_STATUS_COPY[language];
  return {
    lobby: TIMER_ROOM_LOBBY_COPY[language], toolbar: TIMER_ROOM_TOOLBAR_COPY[language],
    players: TIMER_ROOM_PLAYERS_COPY[language], admin: TIMER_ROOM_ADMIN_COPY[language],
    history: TIMER_ROOM_HISTORY_COPY[language], status,
    name: tr({ en: 'Nickname', zh: '昵称' }), namePlaceholder: tr({ en: 'Cuber', zh: '魔友' }),
    join: tr({ en: 'Join room', zh: '加入房间' }),
  };
}

function refreshNetBattle(p: NativePage) {
  if (!p.active || !p.netBattle || !p.nativeTimer) return;
  const snapshot = p.netBattle.snapshot(), room = snapshot.room, timer = p.nativeTimer;
  const language = getMiniProgramLocale();
  const copy = roomCopy(language), labels = TIMER_ROOM_ROUND_STATUS_COPY[language], projects = netProjects();
  const identity = getStoredSessionSnapshot().session?.user;
  const name = (id: string) => room?.players[id] ? timerRoomPlayerName(room.players[id], language) : copy.history.unknown;
  const lobbyEvent = snapshot.event ?? p.netEvent ?? '333';
  const key = `${timer.settings.showCubePreview}|${snapshot.event}|${snapshot.scramble}`;
  if (p.netPreviewKey !== key) {
    p.netPreviewKey = key;
    let preview = '';
    try {
      if (timer.settings.showCubePreview && snapshot.event && snapshot.scramble) {
        preview = nativeTimerPreview(snapshot.event, snapshot.scramble);
      }
    } catch { /* Timing and live results remain usable without a scramble preview. */ }
    p.setData({ netPreview: preview });
  }
  let status = '';
  if (snapshot.countdownMs !== null) status = labels.countdown;
  else if (snapshot.result && !snapshot.resultPending) {
    status = snapshot.pendingPlayers > 0 ? labels.pending(snapshot.pendingPlayers)
      : snapshot.winners.length ? snapshot.winners.map(name).join(' / ') : labels.noResult;
  } else if (room && !isNetRoundParticipant(room, snapshot.playerId)) status = labels.spectator;
  else if (snapshot.gate.gated) status = snapshot.gate.ready ? labels.waiting(snapshot.gate.waiting) : labels.sync;
  const displaySettings = nativeLayoutData(timer.settings, snapshot.display);
  p.setData({
    netCopy: copy, netEvents: projects, netEventIndex: projects.findIndex(event => event.id === lobbyEvent),
    netAccount: identity?.name || (identity ? `#${identity.uid}` : ''),
    netBattle: {
      code: room?.code ?? '', round: room?.round ?? null, syncStart: room?.syncStart ?? false,
      busy: snapshot.busy || snapshot.restoring, error: snapshot.error, active: snapshot.active,
      scramble: snapshot.event ? formatScrambleForEvent(snapshot.event, snapshot.scramble) : '',
      display: snapshot.display, phase: snapshot.phase, gate: snapshot.gate, status,
      hideChrome: timerHidesRunningUi(snapshot.phase, timer.settings),
      timerFontSize: displaySettings.timerFontSize, scrambleFontSize: displaySettings.scrambleFontSize,
      canStart: snapshot.canStart || snapshot.gate.gated && !!snapshot.scramble,
      canChangeEvent: !room || isNetRoundParticipant(room, snapshot.playerId) && !snapshot.active && !snapshot.result,
      admin: snapshot.admin, result: snapshot.result, needsRetry: snapshot.resultPending && !snapshot.submitting,
      submitting: snapshot.submitting, advancing: snapshot.advancing, pendingPlayers: snapshot.pendingPlayers,
      players: snapshot.players.map(player => ({
        id: player.id, name: name(player.id), me: player.me, admin: player.admin, score: room?.scores[player.id] ?? 0,
        winner: snapshot.roundComplete && snapshot.winners.includes(player.id),
        status: player.result ? player.display : !player.online ? copy.players.offline
          : player.ph === 'solving' ? player.display : player.ph === 'inspecting' ? copy.players.inspecting
            : player.ph === 'ready' ? copy.players.ready : copy.players.waiting,
      })),
    },
  });
  if (p.sheet === 'net-history' && room) {
    const precision = timer.settings.precision;
    p.setData({
      netStandings: snapshot.players.map(player => {
        const stats = playerStats(playerTimeline(room, player.id));
        return {
          id: player.id, name: name(player.id), wins: room.scores[player.id] ?? 0,
          best: formatNetHistoryStat(stats.single, precision), ao5: formatNetHistoryStat(stats.ao5, precision),
          ao12: formatNetHistoryStat(stats.ao12, precision), ao50: formatNetHistoryStat(stats.ao50, precision),
          ao100: formatNetHistoryStat(stats.ao100, precision), mean: formatNetHistoryStat(stats.mean, precision),
        };
      }),
      netHistory: roundViews(room).slice(0, 50).map(round => ({
        round: round.round, live: round.live,
        events: [...new Set([...Object.keys(round.scrambles), ...Object.values(round.playerEvents)])].map(event => ({
          event, scramble: formatScrambleForEvent(event, round.scrambles[event] ?? ''),
          results: Object.entries(round.playerEvents).filter(([, playerEvent]) => playerEvent === event)
            .sort(([a], [b]) => (round.results[a] ? effectiveNetMs(round.results[a]) : Infinity)
              - (round.results[b] ? effectiveNetMs(round.results[b]) : Infinity))
            .map(([id]) => ({
              id, name: name(id), winner: round.winners.includes(id),
              result: formatNetHistoryResult(round.results[id], precision),
            })),
        })),
      })),
    });
  }
}

function startNetBattle(p: NativePage) {
  const timer = p.nativeTimer;
  if (!timer || p.netBattle) return;
  p.netEvent = isNetBattleEventId(timer.event) ? timer.event : '333';
  p.netPreviewKey = undefined;
  timer.setAutoReadyBlocked(true);
  stopLiveCube(p);
  p.netBattle = createNativeTimerNetRoom({
    settings: () => timer.settings,
    sessionId: () => timer.activeSessionId,
    onRecordSolve: record => timer.recordNetSolve(record),
    onChange: () => refreshNetBattle(p),
  });
  refreshNetBattle(p);
}

function refresh(page: NativePage, history = false) {
  const t = page.nativeTimer;
  if (!t || !page.active) return;
  if (!nativeLiveAnalysisActive(page, t)) page.liveAnalysis?.clear();
  page.liveShare?.setEnabled(!page.netMode && (page.battleCount ?? 1) === 1);
  updateTrainerCase(page, t);
  const labels = copy();
  const deviceState = nativeDeviceState(page, t);
  const deviceCenter = nativeTimerDeviceCenter(deviceState);
  const summary = history ? t.summary(page.historyLimit, page.sheet === 'history') : undefined;
  const settingsModel = history ? nativeTimerSettingsModel(t, nativeSettingsContext(page)) : null;
  const targetMs = t.settings.targetMsByEvent[t.event] ?? null;
  const target = t.state.phase === 'running' ? timerTargetIndicator(targetMs, t.displayMilliseconds(), tr) : null;
  const splits = t.state.phase === 'running' ? timerAttemptSplitChips(t.attemptSplitState, t.attemptSplitOptions, t.settings.precision, tr, true) : null;
  const targetPulse = t.state.phase === 'stopped' && targetMs !== null
    ? (t.displayMilliseconds() <= targetMs ? 'good' : 'bad') : '';
  const project = nativeTimerEvents().find(e => e.id === t.event);
  const previewScramble = applyOrientationPrefix(t.scramble, preScrambleFor(t.event, t.settings.preScr, t.settings.preScrT));
  const liveFacelets = t.cubeConnected ? t.facelets : null;
  const showPreview = !liveFacelets && t.settings.showCubePreview && !t.settings.soloLayout.hideCubePreview;
  const previewKey = `${showPreview}|${t.event}|${previewScramble}`;
  const liveMode = nativeTimerLiveView(t.settings.liveCubeView);
  const liveKey = liveFacelets ? `${liveMode}|${liveFacelets}` : '';
  const images: Record<string, unknown> = {};
  try {
    if (page.previewKey !== previewKey) {
      page.previewController?.abort(); page.previewController = undefined;
      page.previewKey = previewKey;
      images.previewError = '';
      images.preview = '';
      if (showPreview && t.scramble) {
        if (nativeTimerUsesAsyncPreview(t.event)) {
          const request = page.previewController = new AbortController();
          const current = () => page.active && !request.signal.aborted && page.previewKey === previewKey;
          void nativeTimerPreviewAsync(t.event, previewScramble, request.signal).then(preview => {
            if (current()) page.setData({ preview });
          }, () => {
            if (current()) page.setData({ previewError: tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }) });
          });
        } else images.preview = nativeTimerPreview(t.event, previewScramble);
      }
    }
    if (page.livePreviewKey !== liveKey) {
      images.livePreview = liveFacelets ? nativeTimerLiveCubeImage(liveFacelets, liveMode) : '';
      page.livePreviewKey = liveKey;
    }
  } catch { images.previewError = tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }); }
  const display = t.display(), sourceDetails = t.sourceDetails;
  refreshCompetitionSourceFlag(page, sourceDetails?.competitionId ?? '', t.settings);
  page.setData({ phase: t.state.phase, display, scramble: t.scramble, error: t.error, busy: t.busy, canUseCurrentScramble: t.canUseCurrentScramble, generating: t.loading, sourceLine: t.sourceLine, sourceDetails, canPrevious: t.canPrevious,
    attemptSplitChips: splits ? [...splits.stages, ...splits.memo] : [],
    ...images, guidance: !t.cubeKnown ? labels.unknown : t.guidance.match ? labels.matched : labels.unmatched,
    hideChrome: timerHidesRunningUi(t.state.phase, t.settings),
    compactScramble: t.settings.compactScramble,
    ...nativeLayoutData({ ...t.settings, ...page.layoutDraft }, display),
    ...soloStageData(t, display, { ...t.settings, ...page.layoutDraft }, page.soloViewport),
    canUseDifficulty: t.currentSource === 'random' ? canTrainerDifficulty(t.event) && !t.settings.syncSeed
      : t.currentSource === 'wca' && timerWcaSupportsDifficulty(timerWcaScrambleEventId(t.event)),
    difficultyActive: t.currentSource === 'random' ? canTrainerDifficulty(t.event) && !t.settings.syncSeed && t.settings.genDiffOn
      : t.currentSource === 'wca' && t.settings.wcaDifficultyOn && !t.difficultyUnavailable,
    difficultyUnavailable: t.difficultyUnavailable,
    event: t.event, eventName: project?.name, eventIcon: project?.icon, eventTextLabel: project?.textLabel,
    puzzleHintTitle: timerSupportsSmallPuzzleHints(t.event) ? timerSmallPuzzleHintCopy(t.event, getMiniProgramLocale()).title
      : t.event === 'sq1' ? labels.sq1Hint : t.event === 'mega' ? labels.megaHint : '',
    source: t.currentSource, officialAvailable: t.officialAvailable, randomDifficultyStatus: t.randomDifficultyStatus,
    entryPenalties: TIMER_HISTORY_PENALTIES.map(value => value === 'ok' ? 'OK' : value), timingEnabled: t.timingEnabled, entryKind: timerManualEntryKind(t.event),
    manualEditing: t.currentSource === 'manual' && (Boolean(page.manualEditing) || !t.scramble),
    hint: t.state.phase === 'running' ? labels.stop : t.state.phase === 'ready' ? labels.ready : t.state.phase === 'inspecting' ? labels.inspection : labels.hold,
    cubeConnected: t.cubeConnected, canResetCube: t.canResetCube, calibrating: t.calibrating,
    externalConnected: t.externalConnected, externalName: t.externalName, deviceCenter,
    deviceManagement: page.deviceManagementKind ? nativeTimerDeviceManagement(deviceState, page.deviceManagementKind) ?? null : null,
    deviceError: page.deviceError ?? '',
    trainingTarget: target,
    targetPulse,
    ...(settingsModel && summary ? { summary, soloStatRows: timerSoloStatRailRows(summary), settings: t.settings,
      settingsCategories: settingsModel.categories, settingsMenuCopy: settingsModel.copy,
      resetDefaults: settingsModel.resetDefaults ?? null, syncSeed: settingsModel.syncSeed ?? null,
      metronome: settingsModel.metronome ?? null, rollingSettings: settingsModel.rollingStats ?? null,
      trainingSettings: settingsModel.training,
      trainingGoal: t.settings.dailySolveGoal === null ? null : localizeTimerGoalProgress(timerGoalProgress(t.records, t.settings.dailySolveGoal), tr),
      trainingRound: timerRoundProgress(t.trainingRoundSolves, t.settings.round, targetMs, t.event, t.settings.precision, tr),
      settingRows: settingsModel.rows, settingSections: settingsModel.sections, settingsActions: settingsModel.actions,
      settingsMore: settingsModel.commands, settingsData: nativeTimerSettingsDataCommands(t.busy || Boolean(page.importBusy)),
      backupsAvailable: Boolean(page.localBackups), backupsExpanded: Boolean(page.backupsExpanded),
      backupControls: nativeTimerLocalBackupControls(t.busy || Boolean(page.backupsBusy), Boolean(page.backupsExpanded)),
      showRankCountry: settingsModel.showRankCountry, cloudCommands: settingsModel.cloudCommands, sessions: t.sessions.sessions,
      rankScopes: TIMER_RANK_SCOPES.map(scope => ({ scope, selected: t.settings.rankScopes.includes(scope) })),
      rankCountries: rankCountries.map(code => code ? countryName(code, getMiniProgramLocale() === 'zh') : labels.off),
      rankCountryIndex: Math.max(0, rankCountries.indexOf(t.settings.rankCountry)),
      sessionIndex: t.sessions.sessions.findIndex(s => s.id === t.sessions.activeSessionId) } : {}),
  });
  if (page.localBattle) {
    if (page.liveCubeWanted) stopLiveCube(page);
    refreshLocalBattle(page);
  } else if (!page.netMode) refreshLiveCube(page, t);
  if (history) refreshRank(page);
}
function cancelHold(page: NativePage) { if (page.holdTimer !== undefined) clearTimeout(page.holdTimer); page.holdTimer = undefined; }
function showDetail(p: NativePage): boolean {
  const t = p.nativeTimer, solve = t?.records.find(s => s.id === p.resultId);
  if (!t || !solve) return false;
  let preview = '', previewError = '';
  p.detailPreviewController?.abort(); p.detailPreviewController = undefined;
  if (nativeTimerUsesAsyncPreview(solve.event)) {
    const request = p.detailPreviewController = new AbortController();
    const current = () => p.active && !request.signal.aborted && p.sheet === 'detail' && p.resultId === solve.id;
    void nativeTimerPreviewAsync(solve.event, solve.scramble, request.signal).then(detailPreview => {
      if (current()) p.setData({ detailPreview });
    }, () => {
      if (current()) p.setData({ detailPreviewError: tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }) });
    });
  } else try { preview = nativeTimerPreview(solve.event, solve.scramble); }
  catch { previewError = tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }); }
  const labels = copy(), bld = timerSolveDetailBldTimes(solve);
  p.sheet = 'detail';
  if (p.liveCubeWanted) stopLiveCube(p);
  t.setAutoReadyBlocked(true);
  p.setData({ sheet: 'detail', formError: '', detailPreview: preview, detailPreviewError: previewError,
    detail: { id: solve.id, scramble: solve.scramble, comment: solve.comment ?? '', penalty: solve.penalty, result: formatSolveResult(solve, t.settings.precision),
      rawTime: formatEventMs(solve.event, solve.timeMs, t.settings.precision),
      date: new Date(solve.ts).toLocaleString(getMiniProgramLocale() === 'zh' ? 'zh-CN' : 'en-US'),
      eventName: nativeTimerEvents().find(e => e.id === solve.event)?.name ?? solve.event,
      inspection: solve.inspectionMs === undefined ? '' : formatMs(solve.inspectionMs, t.settings.precision),
      source: solve.scrambleSource ? ({ random: labels.sourceLabels.random, manual: labels.manualScrambles, wca: labels.wca })[solve.scrambleSource.kind] : '',
      deviceName: solve.device?.name || solve.device?.model || '',
      canRecap: Boolean(solve.moves?.length),
      stages: timerSolveDetailStageRows(solve).map(row => ({ id: row.id, label: row.id === 'cross' ? tr({ en: 'Cross', zh: '十字' }) : row.id.toUpperCase(), duration: formatMs(row.durationMs, t.settings.precision), cumulative: formatMs(row.cumulativeMs, t.settings.precision) })),
      memo: bld ? formatMs(bld.memoMs, t.settings.precision) : '', execution: bld ? formatMs(bld.executionMs, t.settings.precision) : '',
    },
    penaltyIndex: TIMER_HISTORY_PENALTIES.indexOf(solve.penalty),
    penaltyLabels: [tr(TIMER_HISTORY_QUICK_ACTION_COPY['history.quick.penalty-ok']), '+2', 'DNF', 'DNS'],
    moveTargets: timerHistoryMoveTargets(t.sessions.sessions, t.sessions.activeSessionId),
    resultActions: TIMER_HISTORY_QUICK_ACTION_IDS.filter(action => !timerHistoryQuickActionPenalty(action)).map(action => ({ id: action, title: tr(TIMER_HISTORY_QUICK_ACTION_COPY[action]) })),
  });
  return true;
}
function refreshNativeStatistics(page: NativePage) {
  const timer = page.nativeTimer;
  if (!timer || page.sheet !== 'statistics') return;
  page.setData({ statistics: nativeTimerStatistics(timer.solves, timer.event, page.statisticsOptions),
    statisticsExpanded: Boolean(page.statisticsExpanded), statisticsChartHint: null });
}

function generate(page: NativePage, event?: string) {
  const timer = page.nativeTimer;
  if (!timer || timer.busy) return;
  page.setData({ generating: true });
  const generation = page.generation = (page.generation ?? 0) + 1;
  setTimeout(() => {
    if (!page.active || generation !== page.generation) return;
    try { event ? timer.selectEvent(event) : timer.nextScramble(); }
    catch { timer.error = tr({ en: 'Unable to generate a scramble. Please retry.', zh: '生成打乱失败，请重试。' }); }
    page.setData({ generating: false }); refresh(page, true);
  }, 20);
}
export function createNativeTimerPageOptions(): WechatMiniprogram.Page.Options<Record<string, unknown>, WechatMiniprogram.Page.CustomOption> {
  return {
    data: { nativeTimerPage: true, appearanceStyle: '', appearanceScheme: 'light', copy: copy(), display: '0.000', phase: 'idle', scramble: '', generating: true, sheet: '', settingsCategory: 'timer', settingsCategoryIndex: 0, playerCountIndex: 0, netCode: '', summary: { rows: [] } },
    onLoad() {
      const p = this as unknown as NativePage;
      p.nativeTimer = new NativeTimer(miniProgramApi(), undefined, createNativeWcaPool());
    },
    onResize(event: { windowWidth?: number; windowHeight?: number; size?: { windowWidth: number; windowHeight?: number } }) {
      const p = this as unknown as NativePage;
      const width = event.windowWidth ?? event.size?.windowWidth;
      const height = event.windowHeight ?? event.size?.windowHeight;
      if (width && height && p.active) {
        p.soloViewport = { width, height };
        p.layoutDrag = undefined;
        p.layoutDraft = undefined;
        if (this.data.orientationMenu) this.setData({ orientationMenu: null });
        refresh(p);
        if (this.data.compareOpen) measureSolverComparison(p);
        const liveCube = p.liveCubeView;
        if (liveCube) {
          const query = p.createSelectorQuery?.();
          query?.select('#nt-live-cube-canvas').boundingClientRect();
          query?.exec(([bounds]) => {
            if (p.liveCubeView === liveCube && bounds?.width && bounds.height) liveCube.resize(bounds.width, bounds.height);
          });
        }
        const cube = p.solverCube;
        if (cube) measureSolverPlayer(p, () => {
          const query = p.createSelectorQuery?.();
          query?.select('#nt-solver-cube-canvas').boundingClientRect();
          query?.exec(([bounds]) => {
            if (p.solverCube === cube && bounds?.width && bounds.height) cube.resize(bounds.width, bounds.height);
          });
        });
      }
      if (p.sheet !== 'statistics' || !p.statisticsOptions || !width) return;
      const wide = width > NATIVE_TIMER_STATISTICS_COMPACT_WIDTH;
      if (wide === p.statisticsOptions.wide) return;
      p.statisticsOptions.wide = wide;
      refreshNativeStatistics(p);
    },
    onShow() {
      const p = this as unknown as NativePage;
      p.active = true;
      p.competitionSourceFlagId = undefined;
      p.soloViewport = nativeContentViewport();
      p.rankKey = ''; p.rankOfficial = undefined;
      if (!p.nativeTimer) {
        const api = miniProgramApi();
        const timer = p.nativeTimer = new NativeTimer(api, undefined, createNativeWcaPool());
        if (nativeTimerLocalBackupsAvailable(api)) {
          p.localBackups = createNativeTimerLocalBackups(api);
          timer.onPersistedSolve = () => p.localBackups?.onPersistedSolves(1, timer.settings.autoBackupEvery, () => timer.exportBackup());
        }
      }
      const timer = p.nativeTimer;
      p.liveShare ??= createNativeTimerLiveShare({
        snapshot: () => timer.liveShareSnapshot(),
        detail: (id, context) => timer.liveShareDetail(id, context),
      }, () => {
        const share = p.liveShare?.snapshot();
        if (!p.active || !share) return;
        if (!share.active || share.paused) {
          if (!share.active) timer.releaseLiveShare();
          p.setData({ liveShare: share, liveShareQr: '', liveShareCopied: false, liveShareCopyFailed: false });
        } else p.setData({ liveShare: share });
      });
      p.nativeTimer.onChange = () => {
        refresh(p, true);
        if (p.sheet === 'solver' && p.nativeTimer?.scramble !== p.solverScramble) this.refreshSolverScramble();
        const timer = p.nativeTimer, solve = timer?.lastResult;
        if (p.active && !p.sheet && !p.layoutEditing && solve && timer && solve.id !== p.autoRecapId) {
          p.autoRecapId = solve.id;
          if (shouldAutoRecap(solve, timer.settings)) {
            p.resultId = solve.id;
            this.openSheet({ currentTarget: { dataset: { sheet: 'recap' } } });
          }
        }
      };
      p.nativeTimer.onCubeMove = (move, facelets, timestamp) => {
        if (nativeLiveAnalysisActive(p, timer)) {
          p.liveAnalysis ??= createNativeTimerLiveAnalysis(view => {
            if (p.active && (!view || nativeLiveAnalysisActive(p, timer))) {
              p.setData(view ? { liveAnalysis: view } : { liveAnalysis: null, liveAnalysisCopied: false });
            }
          });
          p.liveAnalysis.schedule(() => nativeLiveAnalysisActive(p, timer) ? timer.liveAttempt() : null);
        }
        if (!p.active || !p.liveCubeView) return;
        p.liveCubeFacelets = facelets;
        p.liveCubeView.move(move, facelets, timestamp);
      };
      p.nativeTimer.onCubePose = pose => {
        if (!p.active || !p.liveCubeView) return;
        if (pose) p.liveCubeView.pose(pose);
        else p.liveCubeView.resetOrientation(null);
      };
      p.nativeTimer.visible = true;
      p.nativeTimer.setAutoReadyBlocked(Boolean(p.sheet || p.netMode || p.layoutEditing || p.manualEditing));
      this.setData({ copy: copy(), events: nativeTimerEvents(), projectGroups: nativeTimerProjectGroups(), manualText: p.nativeTimer.settings.manualScrambles });
      applyNativeAppearance(); miniProgramApi().setNavigationBarTitle({ title: copy().title });
      applyTimerTabBarColors(p);
      updateTimerTabBar(p, p.sheet === 'settings' || p.sheet === 'solver' || p.sheet === 'bulk');
      if (p.netMode) {
        if (p.netBattle) p.netBattle.setVisible(true);
        else startNetBattle(p);
      } else if ((p.battleCount ?? 1) > 1) startLocalBattle(p, p.battleCount!);
      else if (!p.nativeTimer.scramble) generate(p);
      refresh(p, true);
      if (p.sheet === 'solver') {
        p.solverScramble = undefined;
        this.refreshSolverScramble();
      }
      const linkGeneration = p.generation;
      confirmNativeTimerLink(p.nativeTimer, () => !!p.active && p.generation === linkGeneration, () => refresh(p, true),
        link => this.openTimerToolLink(link));
      if (p.ticker) clearInterval(p.ticker);
      p.ticker = setInterval(() => {
        const net = p.netBattle?.snapshot();
        if (net?.active) {
          const { display, phase } = net;
          this.setData({ 'netBattle.display': display, 'netBattle.phase': phase });
        } else if (p.localBattle?.snapshot().active) refreshLocalBattle(p);
        else if (p.nativeTimer?.busy) refresh(p);
      }, 50);
      p.unsubscribe?.();
      p.unsubscribe = getSmartCubeSession().subscribe(s => {
        p.cubeDeviceSnapshot = s;
        if (p.active) { this.setData({ deviceName: s.phase === 'connected' ? s.deviceName : '', battery: s.battery }); refresh(p, true); }
      });
    },
    onHide() {
      const p = this as unknown as NativePage;
      p.externalTimerScan?.controller.abort();
      p.externalTimerMac = undefined;
      p.stackmatSnapshot = undefined;
      if (p.sheet === 'device-management' && p.deviceManagementKind === 'smart-cube' && !p.nativeTimer?.cubeConnected) {
        void getSmartCubeSession().stopLocal();
      }
      p.trainerController?.abort(); p.trainerController = undefined;
      p.previewController?.abort(); p.previewController = undefined; p.previewKey = undefined;
      p.detailPreviewController?.abort(); p.detailPreviewController = undefined;
      p.liveAnalysis?.dispose(); p.liveAnalysis = undefined;
      clearTimeout(p.liveAnalysisCopyTimer); p.liveAnalysisCopyTimer = undefined;
      stopLiveCube(p);
      stopLocalBattle(p);
      p.active = false;
      p.stagePress = undefined;
      if (this.data.inspectionAlertsHelp) this.setData({ inspectionAlertsHelp: null });
      p.liveShare?.setEnabled(false);
      p.nativeTimer?.releaseLiveShare();
      updateTimerTabBar(p, false);
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      p.difficultyPress = undefined;
      p.netBattle?.setVisible(false);
      p.nativeTimer?.hide(); p.generation = (p.generation ?? 0) + 1;
      p.competitionSourceFlagId = undefined;
      p.competitionRequest = (p.competitionRequest ?? 0) + 1;
      p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      stopNativeSolver(p, true);
      stopNativeBulkScrambles(p);
      disposeRecapView(p);
      if (p.sheet === 'replay' || p.replaySolve) {
        p.sheet = '';
        this.setData({ sheet: '' });
      }
      p.replayRequest?.abort(); p.replayRequest = undefined; p.replaySolve = undefined;
      if (p.manualCheck) clearTimeout(p.manualCheck);
      p.manualCheck = undefined;
      p.layoutEditing = false;
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      void disconnectExternalTimer();
      cancelHold(p); if (p.ticker) clearInterval(p.ticker); p.ticker = undefined; p.unsubscribe?.(); p.unsubscribe = undefined;
      this.setData({ generating: false, bulkGenerating: false, bulkProjectMenu: null, solverLoading: false, layoutEditing: false, trainerBusy: false });
    },
    onUnload() { this.onHide?.(); const p = this as unknown as NativePage; p.liveShare?.dispose(); p.netBattle?.dispose(); const t = p.nativeTimer; if (t) { t.onChange = undefined; t.onPersistedSolve = undefined; t.onCubeMove = undefined; t.onCubePose = undefined; t.dispose(); } void getSmartCubeSession().stopLocal(); },
    startLiveShare() {
      const p = this as unknown as NativePage;
      if (p.active && p.sheet === 'settings') void p.liveShare?.start();
    },
    async endLiveShare() {
      const p = this as unknown as NativePage;
      if (!p.active || p.sheet !== 'settings') return;
      await p.liveShare?.stop();
      if (p.active && !p.liveShare?.snapshot().active) p.nativeTimer?.releaseLiveShare();
    },
    copyLiveShare() {
      const p = this as unknown as NativePage, share = p.liveShare;
      const url = share?.watchUrl();
      if (!p.active || p.sheet !== 'settings' || !url || share?.snapshot().paused) return;
      const current = () => p.active && p.sheet === 'settings' && p.liveShare?.watchUrl() === url && !share?.snapshot().paused;
      miniProgramApi().setClipboardData({ data: url,
        success: () => { if (current()) this.setData({ liveShareCopied: true, liveShareCopyFailed: false }); },
        fail: () => { if (current()) this.setData({ liveShareCopied: false, liveShareCopyFailed: true }); },
      });
    },
    toggleLiveShareQr() {
      const p = this as unknown as NativePage;
      if (p.active && p.sheet === 'settings') this.setData({ liveShareQr: this.data.liveShareQr ? '' : p.liveShare?.qr() ?? '' });
    },
    stageTouch(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (e.type === 'touchstart') {
        if (p.stagePress || !p.active || p.sheet || p.layoutEditing || p.manualEditing
          || e.target.dataset.timerSurface !== 'stage' || !p.nativeTimer?.timingEnabled
          || !p.nativeTimer.canUseCurrentScramble || this.data.generating || e.touches.length !== 1) return;
        p.stagePress = e.changedTouches[0];
        if (p.stagePress) this.timerDown();
        return;
      }
      const press = p.stagePress;
      if (!press) return;
      const touch = e.changedTouches.find(item => item.identifier === press.identifier);
      if (!touch && e.type !== 'touchcancel') return;
      const moved = touch && Math.hypot(touch.clientX - press.clientX, touch.clientY - press.clientY)
        > TIMER_RADIAL_POINTER_PROFILES.touch.tapSlopPx;
      if (e.type === 'touchmove' && !moved) return;
      p.stagePress = undefined;
      if (e.type === 'touchend' && !moved && !p.sheet && !p.layoutEditing) this.timerUp();
      else this.timerCancel();
    },
    timerDown() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || p.sheet || p.layoutEditing || !t.canUseCurrentScramble || this.data.generating) return;
      cancelHold(p); t.down();
      if (t.state.phase === 'holding') p.holdTimer = setTimeout(() => {
        t.dispatch({ type: 'hold-ready' }); refresh(p);
        try { miniProgramApi().vibrateShort({ type: 'light' }); } catch { /* optional */ }
      }, t.settings.holdMs);
      refresh(p, true);
    },
    timerUp() { const p = this as unknown as NativePage; if (p.layoutEditing) return; cancelHold(p); p.nativeTimer?.up(); refresh(p, true); },
    timerCancel() { const p = this as unknown as NativePage; cancelHold(p); p.nativeTimer?.dispatch({ type: 'cancel-press' }); refresh(p); },
    scrambleDown() {
      const t = (this as unknown as NativePage).nativeTimer;
      if (t && timerScrambleClickEffect(t.settings.scrambleClickAction, Boolean(t.scramble), !this.data.generating, false) === 'start') this.timerDown();
    },
    scrambleUp() {
      const t = (this as unknown as NativePage).nativeTimer;
      if (t?.settings.scrambleClickAction === 'start') this.timerUp();
    },
    scrambleTap() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || p.layoutEditing || this.data.generating || t.state.phase === 'running') return;
      const effect = timerScrambleClickEffect(t.settings.scrambleClickAction, Boolean(t.scramble), !this.data.generating, false);
      if (effect === 'copy') miniProgramApi().setClipboardData({ data: t.scramble });
      else if (effect === 'next') generate(p);
    },
    nextScramble() { generate(this as unknown as NativePage); },
    async toggleTrainerAnswer() {
      const p = this as unknown as NativePage, t = p.nativeTimer, item = t?.randomDifficultyResult;
      if (!p.active || !t || !item || t.busy || p.trainerController) return;
      if (p.trainerAnswer) { this.setData({ trainerShown: !this.data.trainerShown }); return; }
      const controller = p.trainerController = new AbortController();
      const current = () => p.active && !t.busy && !controller.signal.aborted && item === t.randomDifficultyResult;
      this.setData({ trainerBusy: true, trainerError: false });
      try {
        const answer = await t.solveRandomDifficultyCase(item, getMiniProgramLocale() === 'zh', controller.signal);
        if (current()) {
          p.trainerAnswer = answer;
          this.setData({ trainerAnswer: answer, trainerShown: true });
        }
      } catch { if (current()) this.setData({ trainerError: true }); }
      finally {
        if (p.trainerController === controller) {
          p.trainerController = undefined;
          if (p.active) this.setData({ trainerBusy: false });
        }
      }
    },
    retryRandomDifficulty() {
      const p = this as unknown as NativePage;
      p.nativeTimer?.retryRandomDifficulty(); refresh(p, true);
    },
    previousScramble() { const p = this as unknown as NativePage; p.nativeTimer?.previousScramble(); refresh(p, true); },
    selectProject(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const event = nativeTimerEvents().find(item => item.id === e.currentTarget.dataset.id)?.id;
      if (p.sheet === 'bulk' && this.data.bulkProjectMenu && event && isTimerBulkScrambleEvent(event)) {
        const index = (this.data.bulkEvents as ReturnType<typeof nativeTimerEvents>).findIndex(item => item.id === event);
        this.closeBulkProjectMenu();
        if (index >= 0 && this.data.bulkEventIndex !== index) {
          stopNativeBulkScrambles(p);
          this.setData({ bulkEventIndex: index, bulkGenerating: false, bulkBatch: null, bulkCopied: false, bulkExportError: '', formError: '' });
        }
        return;
      }
      if (p.sheet !== 'project' || !p.nativeTimer || p.nativeTimer.busy || !event) return;
      this.closeSheet();
      if (event !== p.nativeTimer.event) generate(p, event);
    },
    selectFullContent() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.sheet !== 'content') return;
      const content = timerFullPracticeContent(t.event).timer;
      if (content.type222 && t.settings.scramble222Type !== content.type222) {
        t.updateSettings({ scramble222Type: content.type222 });
      }
      if (content.event !== t.event) t.selectEvent(content.event);
      this.closeSheet(); refresh(p, true);
    },
    chooseSource(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const id = e.currentTarget.dataset.source;
      if (id === 'wca') {
        if (!t.officialAvailable) return;
        if (t.currentSource !== 'wca') t.useWcaScrambles();
        if (p.sheet !== 'wca') this.openSheet({ currentTarget: { dataset: { sheet: 'wca' } } });
        return;
      }
      this.closeSheet();
      p.manualEditing = id === 'manual';
      t.setAutoReadyBlocked(p.manualEditing);
      if (id === 'manual') {
        t.setManualScrambles(t.settings.manualScrambles);
        this.setData({ manualText: t.settings.manualScrambles });
      } else if (id === 'random' && t.currentSource !== 'random') t.useRandomScrambles();
      refresh(p, true);
    },
    editManualScrambles() {
      const p = this as unknown as NativePage;
      if (p.nativeTimer?.busy || p.layoutEditing || p.nativeTimer?.currentSource !== 'manual') return;
      p.manualEditing = true;
      p.nativeTimer.setAutoReadyBlocked(true);
      this.setData({ manualText: p.nativeTimer.settings.manualScrambles });
      refresh(p);
    },
    inputManualScrambles(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (t?.currentSource !== 'manual' || t.busy) return;
      t.setManualScrambles(e.detail.value);
      refresh(p);
    },
    finishManualScrambles() {
      const p = this as unknown as NativePage;
      p.manualEditing = false;
      p.nativeTimer?.setAutoReadyBlocked(Boolean(p.sheet || p.layoutEditing));
      refresh(p);
    },
    openSheet(e: { currentTarget: { dataset: { sheet?: string } } }) {
      const p = this as unknown as NativePage;
      if (p.nativeTimer?.busy || p.layoutEditing || p.localBattle?.snapshot().active || p.netBattle?.snapshot().active) return;
      stopNativeSolver(p, true);
      stopNativeBulkScrambles(p);
      p.localBattle?.cancelTouches();
      p.detailPreviewController?.abort(); p.detailPreviewController = undefined;
      const previousSheet = p.sheet;
      p.sheet = String(e.currentTarget.dataset.sheet);
      const resultsWorkspace = p.sheet === 'history'
        || (previousSheet === 'history' && (p.sheet === 'statistics' || p.sheet === 'manual'));
      updateTimerTabBar(p, p.sheet === 'settings' || p.sheet === 'solver' || p.sheet === 'bulk');
      p.nativeTimer?.setAutoReadyBlocked(Boolean(p.sheet || p.netMode || p.manualEditing));
      p.importBusy = false;
      p.backupsExpanded = false;
      if (p.sheet === 'settings') p.syncSeedDraft = p.nativeTimer?.settings.syncSeed ?? '';
      if (p.sheet === 'settings') this.setData({ inspectionAlertsHelp: null, liveShare: p.liveShare?.snapshot() ?? null, liveShareCopy: nativeTimerLiveShareCopy(),
        liveShareQr: '', liveShareCopied: false, liveShareCopyFailed: false });
      const sheetGeneration = p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      const menu = nativeToolbarMenus[p.sheet];
      const viewport = p.soloViewport ?? nativeContentViewport() ?? { width: 393, height: 658 };
      const menuWidth = menu ? Math.max(0, Math.min(
        p.sheet === 'project' && viewport.width > 480 ? 340 : menu.width,
        viewport.width - 16,
      )) : 0;
      const menuPosition = (left = (viewport.width - menuWidth) / 2, top = 56) => {
        const x = Math.max(8, Math.min(viewport.width - menuWidth - 8, left));
        return `width:${menuWidth}px;left:${x}px;top:${top}px;--nt-menu-max-height:${Math.max(0, viewport.height - top - 8)}px`;
      };
      p.replayRequest?.abort(); p.replayRequest = undefined;
      p.difficultyPress = undefined;
      p.draft = '';
      this.setData({ sheet: p.sheet, resultsWorkspace, orientationMenu: null, toolbarMenu: Boolean(menu), toolbarMenuStyle: menu ? menuPosition() : '', draft: p.draft, formError: '' });
      refresh(p, true);
      const api = miniProgramApi();
      if (menu && typeof api.createSelectorQuery === 'function') {
        const query = api.createSelectorQuery().in(this);
        query.select('#nt-toolbar').boundingClientRect();
        query.select(`#nt-tool-${menu.anchor}`).boundingClientRect();
        query.exec(([toolbar, trigger]) => {
          if (p.sheetGeneration !== sheetGeneration || !toolbar || !trigger) return;
          const left = menu.align === 'left' ? trigger.left
            : menu.align === 'center' ? (trigger.left + trigger.right - menuWidth) / 2
              : (viewport.width - menuWidth) / 2;
          const top = p.sheet === 'project' ? 8
            : p.sheet === 'content' ? trigger.bottom + 6
              : p.sheet === 'source' || p.sheet === 'wca' ? trigger.bottom + 11
                : p.sheet === 'difficulty' ? trigger.bottom : toolbar.bottom;
          this.setData({ toolbarMenuStyle: menuPosition(left, top) });
        });
      }
      if (p.sheet === 'net-history' || p.sheet === 'net-admin' || p.sheet === 'net-rename') refreshNetBattle(p);
      if (p.sheet === 'net-rename') {
        p.draft = p.netBattle?.snapshot().players.find(player => player.me)?.name ?? '';
        this.setData({ draft: p.draft });
      }
      if (p.sheet === 'replay') this.setData({ replayHasInput: false, replayLoading: false });
      if (p.sheet === 'import') {
        p.stagedImport = undefined; p.importTargets = {}; p.importBusy = false;
        this.setData({ importStatus: '', importBusy: false, importRows: [], importFiles: listNativeTimerImportFiles() });
      }
      if (p.sheet === 'manual' && p.nativeTimer) {
        p.manualDraft = createTimerManualEntryDraft(p.nativeTimer.event, p.nativeTimer.scramble);
        this.setData({ manualDraft: p.manualDraft, entryPreview: '', entryPenaltyIndex: 0 });
      }
      if (p.sheet === 'bulk') {
        const bulkProjectGroups = nativeTimerProjectGroups().map(group => ({ ...group,
          items: group.items.filter(item => isTimerBulkScrambleEvent(item.id)),
        })).filter(group => group.items.length > 0);
        const bulkEvents = bulkProjectGroups.flatMap(group => group.items);
        const eventIndex = bulkEvents.findIndex(item => item.id === p.nativeTimer?.event);
        this.setData({ bulkProjectGroups, bulkEvents, bulkProjectMenu: null,
          bulkEventIndex: eventIndex < 0 ? bulkEvents.findIndex(item => item.id === '333') : eventIndex,
          bulkCount: String(TIMER_BULK_SCRAMBLE_COUNTS.initial), bulkBatch: null, bulkCopied: false,
          bulkGenerating: false, bulkExportError: '' });
      }
      if (p.sheet === 'statistics') {
        let width: number | undefined;
        try { width = miniProgramApi().getSystemInfoSync?.().windowWidth; } catch { /* use the compact layout */ }
        p.statisticsOptions = { wide: (width ?? 0) > NATIVE_TIMER_STATISTICS_COMPACT_WIDTH };
        p.statisticsExpanded = false;
        this.setData({ statisticsCopied: false });
        refreshNativeStatistics(p);
      }
      if (p.sheet === 'difficulty') {
        this.setData({ difficultyOptionPanel: '', difficultyOptionMethod: '', difficultyStageOptions: [], difficultyColorGroups: difficultyColorGroups() });
        openDifficulty(p, sheetGeneration);
      }
      if (p.sheet === 'puzzle-hints') void this.loadPuzzleHints();
      if (p.sheet === 'recap') void this.loadRecap();
      if (p.sheet === 'solver') {
        this.cancelSolverScrambleEdit();
        const stageAvailable = nativeStageSolverAvailability().available;
        p.solverScramble = p.nativeTimer?.scramble;
        p.stageFace = undefined; p.stageCells = undefined; p.stageCombo = undefined; p.stageBase = undefined;
        p.stageRevealed = undefined;
        try { p.stageReveal = miniProgramApi().getStorageSync(SOLVER_REVEAL_STORAGE) === '1'; } catch { /* optional preference */ }
        let solverMethodIndex = 0;
        try {
          const methodId = miniProgramApi().getStorageSync(SOLVER_STEP_METHOD_STORAGE);
          solverMethodIndex = Math.max(0, METHOD_REGISTRY.findIndex(method => method.id === methodId));
        } catch { /* optional preference */ }
        p.stageColors ??= TIMER_COLOR_DUAL_PAIRS[0].key;
        this.setData({ solverSettingsOpen: false, solverInfoOpen: false, solverViewMenu: false, solverOptionsMenu: '', solverCandidatesOpen: false, solverRestrictionOpen: true, solverReveal: Boolean(p.stageReveal), solverPlayerHidden: false, compareOpen: false, compareRows: [], compareLoading: false, solverView: stageAvailable ? 0 : 1, stageAvailable, solverMethodIndex,
          stageMethodIndex: 0, stageIndex: 0, solverLoading: false, solverRows: [], stageResult: null, playback: null, solverCanvasReady: false, solverCanvas: false, solverPlayerHeight: 0, solverPlayerAnchor: '',
          solverMethods: METHOD_REGISTRY.map(method => method.nameEn) });
        if (stageAvailable) void this.loadStageCounts();
        else this.solveCurrentScramble();
      }
      if (p.sheet === 'wca') {
        p.competitionQuery = ''; p.competitionCountryQuery = ''; p.competitionLimit = 40;
        this.setData({ competitionQuery: '', competitionMatches: [], competitionCountryOpen: false, competitionCountryQuery: '' });
        refreshCompetitionSuggestions(p);
        void loadCompetitionOptions(p);
        void this.loadWcaCompetitions();
      }
    },
    closeSheet(e?: WechatMiniprogram.TouchEvent) {
      // Douyin catch handlers cancel native scrolling and input defaults as well as bubbling.
      // Dismiss only taps originating on the backdrop; inner controls retain their defaults.
      if (e?.currentTarget.id === 'nt-backdrop' && e.target.id !== 'nt-backdrop') return;
      const p = this as unknown as NativePage;
      if (e && p.sheet === 'solver' && this.data.solverScrambleEditing) {
        this.cancelSolverScrambleEdit();
        return;
      }
      updateTimerTabBar(p, false);
      if (p.sheet === 'device-management') {
        p.externalTimerScan?.controller.abort();
        p.externalTimerMac = undefined;
        if (p.deviceManagementKind === 'smart-cube' && !p.nativeTimer?.cubeConnected) void getSmartCubeSession().stopLocal();
        if (p.connecting && (p.deviceManagementKind === 'smart-timer' && !p.nativeTimer?.externalConnected
          || p.deviceManagementKind === 'stackmat' && p.nativeTimer?.externalKind !== 'stackmat-mic')) void disconnectExternalTimer();
      }
      p.replayRequest?.abort(); p.replayRequest = undefined;
      p.difficultyPress = undefined;
      if (p.sheet === 'recap') {
        const fromLink = Boolean(p.replaySolve); p.replaySolve = undefined;
        disposeRecapView(p);
        p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
        if (!fromLink && showDetail(p)) return;
      }
      if (p.sheet === 'comment' && showDetail(p)) return;
      if (p.sheet === 'detail' || (this.data.resultsWorkspace && (p.sheet === 'manual' || p.sheet === 'create'))) {
        this.openSheet({ currentTarget: { dataset: { sheet: 'history' } } }); return;
      }
      stopNativeSolver(p, true);
      stopNativeBulkScrambles(p);
      p.sheet = ''; p.nativeTimer?.setAutoReadyBlocked(Boolean(p.localBattle || p.netMode || p.layoutEditing || p.manualEditing)); p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      p.competitionRequest = (p.competitionRequest ?? 0) + 1;
      this.setData({ sheet: '', resultsWorkspace: false, orientationMenu: null, inspectionAlertsHelp: null, bulkProjectMenu: null });
      refresh(p);
    },
    choosePlayerCount(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const count = Number(e.detail.value) + 1;
      if (!p.nativeTimer || p.nativeTimer.busy || !Number.isInteger(count) || count < 1 || count > 5
        || p.localBattle?.snapshot().active || p.netBattle?.snapshot().active || p.netLeaving) return;
      if (count === 5) {
        stopLocalBattle(p);
        p.battleCount = 1; p.netMode = true;
        this.setData({ battle: null, netMode: true, playerCountIndex: 4 });
        this.closeSheet();
        startNetBattle(p);
        return;
      }
      if (p.netBattle) {
        const room = p.netBattle;
        p.netBattle = undefined; p.netMode = false;
        p.netLeaving = room.leave().finally(() => { room.dispose(); p.netLeaving = undefined; });
        this.setData({ netBattle: null, netMode: false, netCode: '' });
        p.netCode = '';
      }
      p.battleCount = count; this.setData({ playerCountIndex: count - 1 });
      if (count === 1) {
        stopLocalBattle(p);
        this.setData({ battle: null });
        this.closeSheet();
        if (!p.nativeTimer.scramble) generate(p);
      } else {
        if (p.localBattle) p.localBattle.setPlayerCount(count);
        else startLocalBattle(p, count);
        this.closeSheet();
      }
      refresh(p, true);
    },
    openTimerToolLink(link: NativeTimerLink) {
      const p = this as unknown as NativePage;
      if (p.nativeTimer?.busy || p.layoutEditing || p.localBattle?.snapshot().active || p.netBattle?.snapshot().active) return;
      if (link.replayInput) {
        this.openSheet({ currentTarget: { dataset: { sheet: 'replay' } } });
        p.draft = link.replayInput;
        this.setData({ draft: p.draft, replayHasInput: true });
        void this.openReplayInput();
      } else if (link.roomCode && !p.netLeaving) {
        const currentRoom = p.netBattle?.snapshot().room?.code;
        if (currentRoom && currentRoom !== link.roomCode) {
          miniProgramApi().showToast({ title: roomCopy().toolbar.leave, icon: 'none' });
          return;
        }
        if (!p.netMode) this.choosePlayerCount({ detail: { value: '4' } } as WechatMiniprogram.PickerChange);
        p.netCode = link.roomCode;
        this.setData({ netCode: link.roomCode });
      }
    },
    exitNetMode() { this.choosePlayerCount({ detail: { value: '0' } } as WechatMiniprogram.PickerChange); },
    selectNetEvent(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, event = netProjects()[Number(e.detail.value)]?.id;
      if (!p.netBattle || !event || p.sheet || p.netBattle.snapshot().busy) return;
      if (p.netBattle.snapshot().room) void p.netBattle.setEvent(event);
      else { p.netEvent = event; refreshNetBattle(p); }
    },
    inputNetName(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      p.netName = e.detail.value;
    },
    inputNetCode(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      const code = normalizeNetBattleRoomCode(e.detail.value);
      p.netCode = code;
      this.setData({ netCode: code });
      if (isNetBattleRoomCode(code)) this.joinNetRoom();
    },
    joinNetRoom() {
      const p = this as unknown as NativePage;
      if (!p.active || p.sheet || !p.netBattle || !isNetBattleRoomCode(p.netCode) || p.netBattle.snapshot().busy) return;
      void p.netBattle.join(p.netCode, { name: p.netName });
    },
    createNetRoom() {
      const p = this as unknown as NativePage;
      if (p.active && !p.sheet && p.netBattle && !p.netBattle.snapshot().busy) {
        void p.netBattle.create(p.netEvent ?? '333', { name: p.netName });
      }
    },
    leaveNetRoom() {
      const p = this as unknown as NativePage;
      if (!p.netBattle || p.netBattle.snapshot().active) return;
      p.netCode = ''; this.setData({ netCode: '' });
      void p.netBattle.leave();
    },
    copyNetInvite() {
      const code = (this as unknown as NativePage).netBattle?.snapshot().room?.code;
      if (code) miniProgramApi().setClipboardData({
        data: `https://cuberoot.me${getMiniProgramLocale() === 'zh' ? '/zh' : ''}/timer?players=net&room=${code}`,
      });
    },
    netTouchDown(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (!p.sheet && e.changedTouches?.[0]) p.netBattle?.down(e.changedTouches[0].identifier);
    },
    netTouchUp(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (!p.sheet && e.changedTouches?.[0]) p.netBattle?.up(e.changedTouches[0].identifier);
    },
    netTouchCancel(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (e.changedTouches?.[0]) p.netBattle?.cancel(e.changedTouches[0].identifier);
    },
    toggleNetReady() {
      const p = this as unknown as NativePage;
      if (!p.sheet) void p.netBattle?.toggleReady();
    },
    changeNetPenalty(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, penalty = (['ok', '+2', 'dnf'] as const)[Number(e.detail.value)];
      if (!p.sheet && penalty) void p.netBattle?.setPenalty(penalty);
    },
    retryNetResult() { void (this as unknown as NativePage).netBattle?.retryResult(); },
    nextNetRound() {
      const p = this as unknown as NativePage, room = p.netBattle;
      if (!p.sheet && room) void room.next(room.snapshot().pendingPlayers > 0);
    },
    setNetSync(e: WechatMiniprogram.SwitchChange) {
      const p = this as unknown as NativePage;
      if (p.sheet === 'net-admin' && p.netBattle?.snapshot().admin) void p.netBattle.setSyncStart(e.detail.value);
    },
    changeNetPlayer(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, adapter = p.netBattle;
      const { player: id, action } = e.currentTarget.dataset;
      const snapshot = adapter?.snapshot(), player = snapshot?.players.find(player => player.id === id && !player.me);
      if (!adapter || !snapshot?.admin || !player || p.sheet !== 'net-admin') return;
      const labels = TIMER_ROOM_ADMIN_COPY[getMiniProgramLocale()];
      miniProgramApi().showModal({
        title: action === 'transfer' ? labels.confirmTransfer : labels.confirm, content: player.name,
        success: result => {
          if (result.confirm && p.active && p.netBattle === adapter && adapter.snapshot().room?.code === snapshot.room?.code) {
            void (action === 'transfer' ? adapter.transferAdmin(player.id) : adapter.kick(player.id));
          }
        },
      });
    },
    async renameNetPlayer() {
      const p = this as unknown as NativePage, adapter = p.netBattle;
      if (p.sheet !== 'net-rename' || !p.draft?.trim() || !adapter || getStoredSessionSnapshot().session) return;
      if (await adapter.rename({ name: p.draft }) && p.active && p.netBattle === adapter && p.sheet === 'net-rename') this.closeSheet();
    },
    changeLocalBattleSource(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, battle = p.localBattle;
      if (!battle || p.sheet || battle.snapshot().active) return;
      const source = Number(e.detail.value) === 1 ? 'random' : 'wca';
      if (source === p.battleSource) return;
      p.battleSource = source;
      battle.retry();
      refreshLocalBattle(p);
    },
    selectBattleEvent(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const event = localBattleProjects()[Number(e.detail.value)]?.id;
      if (event && !p.sheet) p.localBattle?.setEvent(event);
    },
    battleTouchDown(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, id = Number(e.currentTarget.dataset.player);
      if (!p.sheet && e.changedTouches?.[0]) p.localBattle?.down(id, e.changedTouches[0].identifier);
    },
    battleTouchUp(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, id = Number(e.currentTarget.dataset.player);
      if (!p.sheet && e.changedTouches?.[0]) p.localBattle?.up(id, e.changedTouches[0].identifier);
    },
    battleTouchCancel(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, id = Number(e.currentTarget.dataset.player);
      if (e.changedTouches?.[0]) p.localBattle?.cancel(id, e.changedTouches[0].identifier);
    },
    changeBattlePenalty(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, value = ['ok', '+2', 'dnf'] as const;
      const penalty = value[Number(e.detail.value)];
      if (penalty && !p.sheet) p.localBattle?.setPenalty(Number(e.currentTarget.dataset.player), penalty);
    },
    startAllPlayers() { const p = this as unknown as NativePage; if (!p.sheet) p.localBattle?.startAll(); },
    nextBattleRound() { const p = this as unknown as NativePage; if (!p.sheet) p.localBattle?.next(); },
    retryBattleScramble() { const p = this as unknown as NativePage; if (!p.sheet) p.localBattle?.retry(); },
    toggleLayout() {
      const p = this as unknown as NativePage;
      if (!p.nativeTimer || p.nativeTimer.busy || p.sheet) return;
      p.layoutEditing = !p.layoutEditing;
      p.nativeTimer.setAutoReadyBlocked(p.layoutEditing);
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      this.setData({ layoutEditing: p.layoutEditing });
      refresh(p);
    },
    resetLayout() {
      const p = this as unknown as NativePage;
      if (!p.layoutEditing || !p.nativeTimer || p.nativeTimer.busy) return;
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      p.nativeTimer.updateSettings({ soloLayout: DEFAULT_SOLO_LAYOUT, timerFontScale: 1, scrambleFontScale: 1 });
      refresh(p, true);
    },
    startLayoutDrag(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const t = p.nativeTimer, touch = e.changedTouches?.[0] ?? e.touches?.[0];
      const { region: regionKey, mode, docked } = e.currentTarget.dataset;
      const region = TIMER_SOLO_LAYOUT_REGIONS.find(item => item.gap === regionKey);
      if (!p.layoutEditing || !t || p.layoutDrag || !touch || !region || (mode !== 'move' && mode !== 'size')) return;
      const y = touch.clientY ?? touch.pageY;
      if (!Number.isFinite(y)) return;
      const query = p.createSelectorQuery?.() ?? miniProgramApi().createSelectorQuery?.();
      const drag: NonNullable<NativePage['layoutDrag']> = p.layoutDrag = {
        region, mode, identifier: touch.identifier, y, lastY: y, ended: false, measuring: Boolean(query),
        value: timerSoloRegionValue(t.settings, region, mode, true), height: 100,
        minimum: -Infinity, maximum: Infinity,
      };
      if (!query) return;
      const target = docked ? '#nt-layout-docked-cubeGap' : `#nt-layout-${region.gap}`;
      if (mode === 'size') {
        query.select(target).boundingClientRect();
      } else {
        // Limit the active region against its neighbors without moving them.
        query.select(target).boundingClientRect();
        query.select('.nt-solo-stage').boundingClientRect();
        for (const other of TIMER_SOLO_LAYOUT_REGIONS) {
          if (other !== region) query.select(`#nt-layout-${other.gap}`).boundingClientRect();
        }
      }
      query.exec(([bounds, stage, ...neighbors]) => {
        if (p.layoutDrag !== drag) return;
        if (bounds?.height) drag.height = bounds.height;
        if (mode === 'move' && bounds?.height && stage?.height) {
          drag.minimum = Math.min(0, Math.ceil(stage.top - bounds.top));
          drag.maximum = Math.max(0, Math.floor(stage.bottom - bounds.bottom));
          for (const neighbor of neighbors) {
            if (!neighbor?.height || neighbor.right <= bounds.left || neighbor.left >= bounds.right) continue;
            if (neighbor.top + neighbor.bottom <= bounds.top + bounds.bottom) {
              drag.minimum = Math.max(drag.minimum, Math.min(0, Math.ceil(neighbor.bottom - bounds.top)));
            } else {
              drag.maximum = Math.min(drag.maximum, Math.max(0, Math.floor(neighbor.top - bounds.bottom)));
            }
          }
        }
        drag.measuring = false;
        this.applyLayoutDrag();
      });
    },
    moveLayoutDrag(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, drag = p.layoutDrag;
      const touch = [...(e.touches ?? []), ...(e.changedTouches ?? [])].find(item => item.identifier === drag?.identifier);
      if (!drag || drag.ended || !touch) return;
      const y = touch.clientY ?? touch.pageY;
      if (!Number.isFinite(y)) return;
      drag.lastY = y;
      this.applyLayoutDrag();
    },
    applyLayoutDrag() {
      const p = this as unknown as NativePage, drag = p.layoutDrag, t = p.nativeTimer;
      if (!p.layoutEditing || !drag || !t || drag.measuring) return;
      const distance = Math.max(drag.minimum, Math.min(drag.maximum, drag.lastY - drag.y));
      const value = timerSoloDragValue(drag.mode, drag.value, distance, drag.height);
      const patch = timerSoloRegionPatch(t.settings, drag.region, drag.mode, value, true);
      if (drag.ended) {
        if (Object.keys(patch).length) t.updateSettings(patch);
        this.cancelLayoutDrag();
        return;
      }
      if (!p.layoutDraft && !Object.keys(patch).length) return;
      p.layoutDraft = patch;
      const layout = { ...t.settings, ...p.layoutDraft };
      const display = t.display();
      this.setData({ ...nativeLayoutData(layout, display), ...soloStageData(t, display, layout, p.soloViewport) });
    },
    endLayoutDrag(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const drag = p.layoutDrag;
      if (!drag || (e.touches?.some(touch => touch.identifier === drag.identifier)
        && !e.changedTouches?.some(touch => touch.identifier === drag.identifier))) return;
      drag.ended = true;
      this.applyLayoutDrag();
    },
    cancelLayoutDrag() {
      const p = this as unknown as NativePage;
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      refresh(p, true);
    },
    hideLayoutRegion(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const region = TIMER_SOLO_LAYOUT_REGIONS.find(item => item.gap === e.currentTarget.dataset.region);
      if (!p.layoutEditing || !t || t.busy || !region || !('hide' in region)) return;
      if (region.gap === 'cubeGap' && t.cubeConnected && t.facelets) return;
      p.layoutDrag = undefined;
      p.layoutDraft = undefined;
      t.updateSettings({ soloLayout: { ...t.settings.soloLayout, [region.hide]: true } });
      refresh(p, true);
    },
    changeRandomDifficultyOption(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, draft = p.randomDifficultyDraft;
      if (p.sheet !== 'difficulty' || p.nativeTimer?.currentSource !== 'random' || !draft) return;
      const model = timerRandomDifficultyUiModel(draft);
      const index = Number(e.detail.value), field = e.currentTarget.dataset.field;
      if (field === 'axis' && randomAxes[index] !== undefined) refreshRandomDifficulty(p, { genDiffEoAxis: randomAxes[index] });
      if (field === 'slot' && index >= 0 && index <= model.slotNames.length) refreshRandomDifficulty(p, { genDiffSlot: index - 1 });
    },
    toggleDifficultyMenu(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const field = e.currentTarget.dataset.field;
      if (p.sheet !== 'difficulty' || (field !== 'colors' && field !== 'method')) return;
      const panel = this.data.difficultyOptionPanel === field ? '' : field;
      let method = '', stages: readonly string[] = [];
      if (panel === 'method') {
        if (p.nativeTimer?.currentSource === 'random' && p.randomDifficultyDraft) {
          const model = timerRandomDifficultyUiModel(p.randomDifficultyDraft);
          method = model.method;
          stages = model.stages;
        } else if (p.difficultyDraft) {
          const model = difficultyModel(p, p.difficultyDraft);
          if (model.showStage) {
            method = model.uiVariant;
            stages = model.stageOptions;
          }
        }
      }
      this.setData({ difficultyOptionPanel: panel, difficultyOptionMethod: method, difficultyStageOptions: difficultyStageOptions(stages) });
    },
    chooseDifficultyColor(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet === 'solver') { this.chooseSolverColors(e); return; }
      const color = difficultyColors.find(option => option.key === e.currentTarget.dataset.key);
      if (p.sheet !== 'difficulty' || !color) return;
      if (p.nativeTimer?.currentSource === 'random') {
        refreshRandomDifficulty(p, { genDiffColors: color.key });
      } else if (p.difficultyDraft && !difficultyModel(p, p.difficultyDraft).locked) {
        refreshDifficulty(p, { wcaDiffColors: color.key });
      }
      this.setData({ difficultyOptionPanel: '' });
    },
    chooseDifficultyMethod(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const method = e.currentTarget.dataset.method;
      if (p.sheet === 'solver') { this.previewSolverMethod(e); return; }
      if (p.sheet !== 'difficulty' || typeof method !== 'string') return;
      let stages: readonly string[];
      if (p.nativeTimer?.currentSource === 'random' && p.randomDifficultyDraft) {
        if (!timerRandomDifficultyUiModel(p.randomDifficultyDraft).methods.includes(method)) return;
        stages = timerRandomDifficultyStagesOf(method);
      } else if (p.difficultyDraft) {
        if (!difficultyModel(p, p.difficultyDraft).variantOptions.includes(method)) return;
        const next = difficultyModel(p, { ...p.difficultyDraft, wcaDiffVariant: method });
        if (!next.showStage || next.stageOptions.length === 0) {
          refreshDifficulty(p, { wcaDiffVariant: next.dataVariant, wcaDiffStage: next.dataStage });
          this.setData({ difficultyOptionPanel: '' });
          return;
        }
        stages = next.stageOptions;
      } else return;
      this.setData({ difficultyOptionMethod: method, difficultyStageOptions: difficultyStageOptions(stages) });
    },
    chooseDifficultyStage(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet === 'solver') { this.chooseSolverStage(e); return; }
      const stage = e.currentTarget.dataset.stage;
      const method = this.data.difficultyOptionMethod as string;
      if (p.sheet !== 'difficulty' || this.data.difficultyOptionPanel !== 'method' || typeof stage !== 'string' || !method) return;
      if (p.nativeTimer?.currentSource === 'random' && p.randomDifficultyDraft) {
        if (!timerRandomDifficultyStagesOf(method).includes(stage)) return;
        refreshRandomDifficulty(p, timerRandomDifficultySelection(method, stage));
      } else if (p.difficultyDraft) {
        const model = difficultyModel(p, p.difficultyDraft);
        const preview = difficultyModel(p, { ...p.difficultyDraft, wcaDiffVariant: method });
        if (model.locked || !preview.stageOptions.includes(stage)) return;
        const next = difficultyModel(p, { ...p.difficultyDraft, wcaDiffVariant: method, wcaDiffStage: stage });
        refreshDifficulty(p, { wcaDiffVariant: next.dataVariant, wcaDiffStage: next.dataStage });
      }
      this.setData({ difficultyOptionPanel: '', difficultyOptionMethod: '', difficultyStageOptions: [] });
    },
    difficultyTrackDown(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, sample = e.changedTouches?.[0] ?? e.touches?.[0];
      if (!sample || p.sheet !== 'difficulty' || p.difficultyPress) return;
      const query = p.createSelectorQuery?.() ?? miniProgramApi().createSelectorQuery?.();
      if (!query) return;
      const press: NonNullable<NativePage['difficultyPress']> =
        p.difficultyPress = { x: sample.clientX, identifier: sample.identifier, ended: false };
      query.select('#nt-difficulty-track').boundingClientRect();
      query.exec(rects => {
        if (p.difficultyPress !== press) return;
        if (!rects[0]?.width) { p.difficultyPress = undefined; return; }
        press.track = { left: rects[0].left, width: rects[0].width };
        this.applyDifficultyTrack();
      });
    },
    updateDifficultyTrack(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, press = p.difficultyPress;
      const touch = (e.changedTouches ?? e.touches ?? []).find(sample => sample.identifier === press?.identifier);
      if (!press || !touch) return;
      press.x = touch.clientX;
      press.ended = e.type === 'touchend';
      this.applyDifficultyTrack();
    },
    tapDifficultyMark(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const range = this.data.difficultySlider as ReturnType<typeof difficultySlider> | undefined;
      const value = Number(e.currentTarget.dataset.value);
      if (p.sheet !== 'difficulty' || !range || !Number.isInteger(value) || value < range.min || value > range.max) return;
      const bound = Math.abs(value - range.low) < Math.abs(value - range.high) ? 'low' : 'high';
      const event = { currentTarget: { dataset: { bound } }, detail: { value } };
      if (p.nativeTimer?.currentSource === 'random') this.changeRandomDifficultyBounds(event);
      else this.changeDifficulty(event);
    },
    cancelDifficultyTrack() { (this as unknown as NativePage).difficultyPress = undefined; },
    applyDifficultyTrack() {
      const p = this as unknown as NativePage, press = p.difficultyPress;
      const range = this.data.difficultySlider as ReturnType<typeof difficultySlider> | undefined;
      if (!range || !press?.track || p.sheet !== 'difficulty') return;
      const position = Math.max(0, Math.min(1, (press.x - press.track.left) / press.track.width));
      const target = range.min + position * (range.max - range.min);
      press.bound ??= Math.abs(target - range.low) < Math.abs(target - range.high) || target < range.low ? 'low' : 'high';
      const value = press.bound === 'low' ? Math.min(range.high, Math.round(target)) : Math.max(range.low, Math.round(target));
      const event = { currentTarget: { dataset: { bound: press.bound } }, detail: { value } };
      if (range[press.bound] !== value) {
        if (p.nativeTimer?.currentSource === 'random') this.changeRandomDifficultyBounds(event);
        else this.changeDifficulty(event);
      }
      if (press.ended) p.difficultyPress = undefined;
    },
    changeRandomDifficultyBounds(e: { currentTarget: { dataset: { bound?: string } }; detail: { value: number } }) {
      const p = this as unknown as NativePage, draft = p.randomDifficultyDraft;
      if (p.sheet !== 'difficulty' || p.nativeTimer?.currentSource !== 'random' || !draft) return;
      const model = timerRandomDifficultyUiModel(draft);
      const value = Math.round(e.detail.value);
      const [lo, hi] = e.currentTarget.dataset.bound === 'low' ? [value, model.hi] : [model.lo, value];
      refreshRandomDifficulty(p, timerRandomDifficultyRangePatch(model, lo, hi));
    },
    toggleRandomDifficultyInfo() {
      this.setData({ randomDifficultyInfoOpen: !this.data.randomDifficultyInfoOpen });
    },
    changeDifficulty(e: { currentTarget: { dataset: { bound?: string } }; detail: { value: number } }) {
      const p = this as unknown as NativePage;
      const draft = p.difficultyDraft;
      if (p.sheet !== 'difficulty' || !draft) return;
      const [low, high] = difficultyModel(p, draft).selectedRange;
      const value = Math.round(e.detail.value);
      const range = e.currentTarget.dataset.bound === 'low'
        ? timerInclusiveRange(value, Math.max(high, value))
        : timerInclusiveRange(Math.min(low, value), value);
      refreshDifficulty(p, { wcaDiffSteps: range });
    },
    saveDifficulty() {
      const p = this as unknown as NativePage, t = p.nativeTimer, draft = p.difficultyDraft;
      if (p.sheet !== 'difficulty' || !t || t.busy) return;
      if (t.currentSource === 'random' && canTrainerDifficulty(t.event) && p.randomDifficultyDraft) {
        t.updateSettings(p.randomDifficultyDraft);
      } else if (t.currentSource === 'wca' && draft && timerWcaSupportsDifficulty(timerWcaScrambleEventId(t.event)) && !difficultyModel(p, draft).locked) {
        t.updateSettings(draft);
      } else return;
      this.closeSheet();
      refresh(p, true);
    },
    clearDifficulty() {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'difficulty' || !p.nativeTimer || p.nativeTimer.busy) return;
      p.nativeTimer.updateSettings(p.nativeTimer.currentSource === 'random' ? { genDiffOn: false } : { wcaDifficultyOn: false });
      this.closeSheet();
      refresh(p, true);
    },
    async loadPuzzleHints() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'puzzle-hints' || !t?.scramble || t.loading) return;
      const event = t.event, scramble = t.scramble, generation = p.sheetGeneration;
      const request = p.hintsToken = (p.hintsToken ?? 0) + 1;
      const current = () => p.active && p.sheet === 'puzzle-hints' && p.sheetGeneration === generation
        && p.hintsToken === request && t.scramble === scramble;
      p.stopSolver?.();
      const controller = new AbortController();
      p.stopSolver = () => controller.abort();
      this.setData({ hintsLoading: true, hints: null, formError: '' });
      try {
        if (timerSupportsSmallPuzzleHints(event)) {
          const labels = timerSmallPuzzleHintCopy(event, getMiniProgramLocale());
          const { solveTimerSmallHints } = await import('@cuberoot/puzzle-solvers/timer-small-hints');
          if (!current()) return;
          const result = solveTimerSmallHints(event, scramble);
          const shortest = Math.min(...result.faces.map(row => row.moves.length).filter(Boolean));
          if (current()) this.setData({ hints: { kind: 'small', labels,
            full: { length: result.full.length, moves: result.full.moves.length ? result.full.moves.join(' ') : labels.alreadySolved },
            faces: result.faces.map(row => ({ face: row.face, count: row.moves.length, moves: row.moves.join(' ') || labels.noSolution,
              best: row.moves.length > 0 && row.moves.length === shortest })),
          } });
        } else if (event === 'sq1') {
          const solution = await solveNativeTimerSq1(scramble, controller.signal);
          if (current()) this.setData({ hints: { kind: 'sq1', solution, moves: sq1MoveCounts(solution).wca } });
        } else if (event === 'mega') {
          const { solveMega } = await import('@cuberoot/puzzle-solvers/timer-mega-hints');
          if (!current()) return;
          const result = solveMega(scramble);
          if (current()) this.setData({ hints: { kind: 'mega', ...result,
            inPlace: tr({ en: `${result.total - result.misplaced} / ${result.total} in place`, zh: `${result.total - result.misplaced} / ${result.total} 已就位` }),
          } });
        }
      } catch {
        if (current()) this.setData({ formError: copy().solverUnavailable });
      } finally {
        if (current()) { p.stopSolver = undefined; this.setData({ hintsLoading: false }); }
      }
    },
    toggleSolverViewMenu() {
      this.setData({ solverViewMenu: !this.data.solverViewMenu });
    },
    chooseSolverView(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const view = Number(e.currentTarget.dataset.index);
      this.setData({ solverViewMenu: false });
      if (p.sheet !== 'solver' || (view !== 0 && view !== 1) || (view === 0 && !this.data.stageAvailable)
        || this.data.solverView === view) return;
      this.cancelSolverScrambleEdit();
      stopNativeSolver(p);
      releaseSolverCanvas(p);
      this.setData({ solverView: view, solverSettingsOpen: false, solverOptionsMenu: '', solverCandidatesOpen: false, playback: null, compareOpen: false, compareLoading: false,
        solverCanvas: false, solverCanvasReady: false, playing: false, formError: '', solverRows: [] });
      if (view === 0) void this.loadStageCounts();
      else this.solveCurrentScramble();
    },
    toggleSolverOptions(e: WechatMiniprogram.TouchEvent) {
      const menu = e.currentTarget.dataset.menu;
      this.setData({ solverOptionsMenu: this.data.solverOptionsMenu === menu ? '' : menu ?? '' });
      if (menu === 'stage') this.previewSolverMethod({ currentTarget: { dataset: { method: this.data.solverSelectedMethod } } });
    },
    previewSolverMethod(e: { currentTarget: { dataset: { method?: StageSolverMethod } } }) {
      const method = e.currentTarget.dataset.method;
      if (!method || !STAGE_SOLVER_METHODS.includes(method)) return;
      this.setData({ solverPreviewMethod: method,
        solverPreviewStages: VARIANT_STAGES[method].map(key => ({ key, label: stageLabel(key, getMiniProgramLocale() === 'zh') })),
      });
    },
    chooseSolverStage(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const method = this.data.solverPreviewMethod as StageSolverMethod;
      const methodIndex = STAGE_SOLVER_METHODS.indexOf(method);
      const index = VARIANT_STAGES[method]?.indexOf(e.currentTarget.dataset.stage) ?? -1;
      if (methodIndex < 0 || index < 0) return;
      if (methodIndex !== Number(this.data.stageMethodIndex)) p.stageCells = undefined;
      p.stageCombo = undefined; p.stageBase = undefined;
      this.setData({ solverOptionsMenu: '', stageMethodIndex: methodIndex, stageIndex: index });
      void this.loadStageCounts(methodIndex, index);
    },
    chooseSolverColors(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const option = difficultyColors.find(color => color.key === e.currentTarget.dataset.key);
      if (!option) return;
      p.stageColors = option.key;
      this.setData({ solverOptionsMenu: '' });
      void this.loadStageCounts();
    },
    async loadStageCounts(methodIndex?: number, stageIndex?: number) {
      methodIndex ??= Number(this.data.stageMethodIndex);
      const stage = stageIndex ?? Number(this.data.stageIndex);
      const p = this as unknown as NativePage, t = p.nativeTimer, method = STAGE_SOLVER_METHODS[methodIndex];
      if (p.sheet !== 'solver' || !t?.scramble || !method || !VARIANT_STAGES[method]?.[stage] || !this.data.stageAvailable) return;
      stopNativeSolver(p);
      releaseSolverCanvas(p);
      const controller = new AbortController();
      const solver = p.stageSolver ??= createNativeStageSolver();
      p.stageCounts = undefined;
      p.stageGridInfo = undefined;
      p.stageResult = undefined;
      p.stageDisplayRows = undefined;
      p.stageRevealed = undefined;
      p.stopSolver = () => controller.abort();
      const current = () => p.active && p.sheet === 'solver' && !controller.signal.aborted;
      const scramble = p.solverScramble = t.scramble;
      const { mask, restriction } = nativeStageOptions(p, method, stage);
      let automaticFace: number | null = null;
      this.setData({ solverLoading: true, formError: '', stageResult: null, solverPlayerHidden: false, solverCandidatesOpen: false, solverCanvas: false, solverCanvasReady: false, playback: null, playing: false,
        stageInfo: nativeStageSolverInfo(p), stageFaces: nativeStageSolverFaceCells([], null, p.stageColors).faces });
      setSolverPlayback(p, nativeStageSolverPlayback(scramble, ''));
      try {
        const { counts, elapsedMs, tables } = await solver.counts({ scramble, method, stage, mask, restriction }, controller.signal);
        if (!current() || t.scramble !== scramble) return;
        p.stageCounts = counts;
        p.stageGridInfo = { elapsedMs, tables };
        const cells = nativeStageSolverFaceCells(counts, p.stageFace, p.stageColors);
        automaticFace = cells.faces.some(item => item.selected && item.status === 'ready') ? p.stageFace! : cells.bestFace;
        this.setData({ stageFaces: cells.faces, solverLoading: false, stageInfo: nativeStageSolverInfo(p) });
      } catch (error) {
        if (current()) this.setData({ solverLoading: false, formError: error instanceof NativeStageSolverRuntimeError ? copy().solverRuntimeUnavailable : copy().solverUnavailable });
      } finally { if (current()) p.stopSolver = undefined; }
      if (current() && automaticFace !== null) await this.solveStageFace(automaticFace);
    },
    retryStageCounts() { return this.loadStageCounts(); },
    chooseStageFace(e: WechatMiniprogram.TouchEvent) {
      return this.solveStageFace(Number(e.currentTarget.dataset.index));
    },
    async solveStageFace(face: number) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const method = STAGE_SOLVER_METHODS[Number(this.data.stageMethodIndex)];
      const stage = Number(this.data.stageIndex);
      const cell = nativeStageSolverFaceCells(p.stageCounts, null, p.stageColors).faces.find(value => value.index === face);
      if (p.sheet !== 'solver' || !t?.scramble || !method || cell?.status !== 'ready' || !p.stageSolver) return;
      stopNativeSolver(p);
      releaseSolverCanvas(p);
      const controller = new AbortController();
      p.stopSolver = () => controller.abort();
      p.stageResult = undefined; p.stageDisplayRows = undefined; p.stageFace = face;
      p.stageRevealed = undefined;
      const current = () => p.active && p.sheet === 'solver' && !controller.signal.aborted;
      const scramble = t.scramble;
      const { mask, restriction } = nativeStageOptions(p, method, stage);
      this.setData({ solverLoading: true, formError: '', stageResult: null, solverPlayerHidden: false, solverCandidatesOpen: false, solverCanvas: false, solverCanvasReady: false, playing: false,
        stageInfo: nativeStageSolverInfo(p), stageFaces: nativeStageSolverFaceCells(p.stageCounts, face, p.stageColors).faces });
      setSolverPlayback(p, nativeStageSolverPlayback(scramble, ''));
      try {
        const result = await p.stageSolver.moves({ scramble, method, stage, mask, restriction,
          limit: p.stageLimit, slack: p.stageSlack, combo: p.stageCombo, base: p.stageBase }, face, controller.signal);
        if (!current() || t.scramble !== scramble) return;
        p.stageResult = result;
        p.stageDisplayRows = nativeStageSolverCandidateRows(result.sols, mask !== undefined || Boolean(restriction));
        this.setData({ solverLoading: false, stageInfo: nativeStageSolverInfo(p) });
        displayNativeStageCandidates(p);
      } catch (error) {
        if (current()) this.setData({ solverLoading: false, formError: error instanceof NativeStageSolverRuntimeError ? copy().solverRuntimeUnavailable : copy().solverUnavailable });
      } finally { if (current()) p.stopSolver = undefined; }
    },
    toggleStageSettings(e?: WechatMiniprogram.TouchEvent) {
      if (e?.currentTarget.id === 'nt-solver-settings-backdrop' && e.target.id !== 'nt-solver-settings-backdrop') return;
      this.setData({ solverSettingsOpen: !this.data.solverSettingsOpen, solverInfoOpen: false });
    },
    toggleStageInfo(e?: WechatMiniprogram.TouchEvent) {
      if (e?.currentTarget.id === 'nt-solver-info-backdrop' && e.target.id !== 'nt-solver-info-backdrop') return;
      if (!this.data.solverSettingsOpen) return;
      this.setData({ solverInfoOpen: !this.data.solverInfoOpen, stageInfo: nativeStageSolverInfo(this as unknown as NativePage) });
    },
    toggleStageRestrictionPanel() {
      this.setData({ solverRestrictionOpen: !this.data.solverRestrictionOpen });
    },
    resetStageRestriction() {
      const p = this as unknown as NativePage;
      p.stageCells = undefined;
      void this.loadStageCounts();
    },
    toggleStageReveal() {
      const p = this as unknown as NativePage;
      p.stageReveal = !p.stageReveal;
      try { miniProgramApi().setStorageSync(SOLVER_REVEAL_STORAGE, p.stageReveal ? '1' : '0'); } catch { /* optional preference */ }
      this.setData({ solverReveal: p.stageReveal });
      displayNativeStageCandidates(p, Number(this.data.solverSelected) || 0);
    },
    revealStageCandidate(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const index = Number(e.currentTarget.dataset.index);
      const candidate = p.stageDisplayRows?.[index];
      if (!p.stageReveal || !candidate) return;
      const count = candidate.body.split(/\s+/).filter(Boolean).length;
      const previous = p.stageRevealed?.[index] ?? 0;
      p.stageRevealed = { ...p.stageRevealed, [index]: e.currentTarget.dataset.all ? count : Math.min(count, previous + 1) };
      displayNativeStageCandidates(p, index);
    },
    changeStageOptions(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const method = STAGE_SOLVER_METHODS[Number(this.data.stageMethodIndex)], stage = Number(this.data.stageIndex);
      if (p.sheet !== 'solver' || !method) return;
      const field = e.currentTarget.dataset.field, index = Number(e.detail.value);
      if (field === 'limit') p.stageLimit = STAGE_SOLVER_LIMIT_OPTIONS[index];
      if (field === 'slack') p.stageSlack = STAGE_SOLVER_SLACK_OPTIONS[index];
      if (field === 'slot') {
        p.stageCombo = (this.data.stageSlots as Array<{ value: string }>)[index]?.value;
        if (p.stageCombo?.split(',').includes(String(p.stageBase))) p.stageBase = undefined;
      }
      if (field === 'base') {
        const value = (this.data.stageBases as Array<{ value: number }>)[index]?.value;
        p.stageBase = value === -1 ? undefined : value;
      }
      nativeStageOptions(p, method, stage);
      if (!p.stageCounts || p.stageFace === undefined) void this.loadStageCounts();
      else void this.solveStageFace(p.stageFace);
    },
    toggleStageRestriction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const method = STAGE_SOLVER_METHODS[Number(this.data.stageMethodIndex)], index = Number(e.currentTarget.dataset.index);
      if (p.sheet !== 'solver' || !method) return;
      const kind = stageSolverRestrictionKind(method);
      const cells = p.stageCells ?? (kind === 'single-face' ? STAGE_SOLVER_DEFAULT_FACES : STAGE_SOLVER_DEFAULT_CELLS);
      if (kind === 'none' || !Number.isInteger(index) || index < 0 || index >= cells.length) return;
      p.stageCells = stageSolverToggleMoveCell(cells, index, kind === 'single-face');
      void this.loadStageCounts();
    },
    rotateSolverCandidate(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const index = Number(e.currentTarget.dataset.index), candidate = p.stageResult?.sols[index], row = p.stageDisplayRows?.[index];
      const method = STAGE_SOLVER_METHODS[Number(this.data.stageMethodIndex)];
      if (p.sheet !== 'solver' || !method || !candidate || !row || !p.stageDisplayRows) return;
      if (p.stageCells && stageSolverMoveRestriction(method, p.stageCells).restricted) return;
      p.stageDisplayRows[index] = nativeStageSolverCandidateRow(candidate, index, false, (row.rotation + 1) % 4);
      displayNativeStageCandidates(p, Number(this.data.solverSelected) || 0);
    },
    stopCurrentSolver() {
      stopNativeSolver(this as unknown as NativePage);
      this.setData({ solverLoading: false, playback: null, playing: false });
    },
    openSolverScrambleEdit() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'solver' || !t || t.busy || this.data.solverView !== 0) return;
      this.setData({
        solverScrambleEditing: true,
        solverScrambleFocused: true,
        solverScrambleDraft: t.scramble,
        solverScrambleApplyEnabled: normalizeSolverScrambleDraft(t.scramble) !== null,
      });
    },
    inputSolverScramble(e: WechatMiniprogram.Input) {
      const enabled = normalizeSolverScrambleDraft(e.detail.value) !== null;
      if (enabled !== this.data.solverScrambleApplyEnabled) this.setData({ solverScrambleApplyEnabled: enabled });
    },
    changeSolverScrambleFocus(e: WechatMiniprogram.Input) {
      const focused = e.type === 'focus';
      if (focused !== this.data.solverScrambleFocused) this.setData({ solverScrambleFocused: focused });
    },
    cancelSolverScrambleEdit() {
      this.setData({ solverScrambleEditing: false, solverScrambleFocused: false, solverScrambleDraft: '', solverScrambleApplyEnabled: false });
    },
    applySolverScramble(e: { detail: { value: string | { scramble?: string } } }) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'solver' || !this.data.solverScrambleEditing || !t || t.busy || this.data.solverView !== 0) return;
      const { value } = e.detail;
      const scramble = normalizeSolverScrambleDraft(typeof value === 'string' ? value : value.scramble ?? '');
      if (!scramble) return;
      this.cancelSolverScrambleEdit();
      p.manualEditing = false;
      t.setManualScrambles(scramble);
      refresh(p, true);
    },
    navigateSolverScramble(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'solver' || !t || t.busy || t.loading) return;
      if (e.currentTarget.dataset.direction === 'previous') t.previousScramble();
      else t.nextScramble();
      refresh(p, true);
      if (t.scramble !== p.solverScramble) this.refreshSolverScramble();
    },
    refreshSolverScramble() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'solver' || !t) return;
      p.solverScramble = t.scramble;
      stopNativeSolver(p);
      this.setData({ solverLoading: t.loading, solverRows: [], compareOpen: false, compareLoading: false, stageResult: null, playback: null, playing: false, formError: '' });
      if (!t.scramble) return;
      if (this.data.solverView === 0) void this.loadStageCounts();
      else this.solveCurrentScramble();
    },
    compareAllSolvers() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'solver' || this.data.solverView !== 1 || !t || this.data.compareOpen) return;
      if (p.solverAnimation) clearInterval(p.solverAnimation);
      p.solverAnimation = undefined;
      releaseSolverCanvas(p);
      const generation = p.sheetGeneration, scramble = t.scramble;
      p.comparisonHeight = undefined;
      this.setData({ compareOpen: true, compareMethod: '', compareScrollHeight: 256, solverCanvas: false, solverCanvasReady: false, playing: false });
      p.stageComparison = startNativeTimerSolverComparison(scramble, (rows, loading) => {
        if (p.active && p.sheet === 'solver' && p.sheetGeneration === generation && t.scramble === scramble) {
          this.setData({ compareRows: rows, compareLoading: loading }, () => measureSolverComparison(p));
        }
      });
    },
    dismissSolverComparison(e: WechatMiniprogram.TouchEvent) {
      if (e.target.id === 'nt-steps-comparison') this.closeSolverComparison();
    },
    closeSolverComparison() {
      const p = this as unknown as NativePage;
      p.stageComparison?.(); p.stageComparison = undefined;
      if (p.solverPlayback) showSolverFrame(p, p.solverFrame ?? 0);
      this.setData({ compareOpen: false, compareLoading: false }, () => {
        if (p.solverPlayback) openSolverCanvas(p);
      });
    },
    toggleStepComparison(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const method = e.currentTarget.dataset.method;
      this.setData({ compareMethod: this.data.compareMethod === method ? '' : method }, () => measureSolverComparison(p));
    },
    seekSolverStep(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const row = p.solverStepNotation?.lines[Number(e.currentTarget.dataset.index)];
      if (p.sheet !== 'solver' || this.data.solverView !== 1 || !row?.moves.length) return;
      copySolverNotation(row.text.trim());
      this.moveSolverPlayback({ detail: { value: row.fromIdx } });
      if (!p.solverPausedByUser) this.toggleSolverPlayback();
    },
    copySolverScramble() {
      const p = this as unknown as NativePage;
      if (p.sheet === 'solver' && this.data.solverView === 1 && p.solverStepNotation && p.solverScramble) {
        copySolverNotation(p.solverScramble);
      }
    },
    copySolverSteps() {
      const p = this as unknown as NativePage;
      const notation = p.solverStepNotation;
      if (p.sheet !== 'solver' || this.data.solverView !== 1 || !p.solverScramble || !notation?.lines.length) return;
      copySolverNotation(`${p.solverScramble}\n\n${notation.text}`, () => {
        if (!p.active || p.solverStepNotation !== notation) return;
        this.setData({ solverNotationCopied: true });
        clearTimeout(p.solverNotationCopyTimer);
        p.solverNotationCopyTimer = setTimeout(() => {
          p.solverNotationCopyTimer = undefined;
          this.setData({ solverNotationCopied: false });
        }, 1500);
      });
    },
    toggleSolverCandidates() {
      this.setData({ solverCandidatesOpen: !this.data.solverCandidatesOpen });
    },
    selectSolverCandidate(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const index = Number(e.currentTarget.dataset.index), candidate = p.stageDisplayRows?.[index];
      if (p.sheet !== 'solver' || !candidate || !p.solverScramble) return;
      this.setData({ solverCandidatesOpen: false });
      if (displayNativeStageCandidates(p, index)?.hidden) return;
      const generation = p.sheetGeneration;
      this.setData({ solverPlayerAnchor: '' }, () => {
        if (p.sheetGeneration === generation && p.sheet === 'solver') this.setData({ solverPlayerAnchor: 'nt-solver-main-player' });
      });
      this.toggleSolverPlayback();
    },
    moveSolverPlayback(e: WechatMiniprogram.SliderChange) {
      const p = this as unknown as NativePage;
      if (p.solverAnimation) clearInterval(p.solverAnimation);
      p.solverAnimation = undefined;
      this.setData({ playing: false });
      showSolverFrame(p, e.detail.value);
    },
    seekSolverPlayback(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, total = p.solverPlayback?.moves.length ?? 0;
      const frame = (p.solverFrame ?? 0);
      const key = e.currentTarget.dataset.seek;
      this.moveSolverPlayback({ detail: { value: key === 'start' ? 0 : key === 'end' ? total : key === 'back' ? frame - 1 : frame + 1 } });
    },
    toggleSolverPlayback() {
      const p = this as unknown as NativePage, playback = p.solverPlayback;
      const isSteps = this.data.solverView === 1;
      if (!playback?.moves.length) return;
      if (p.solverAnimation) {
        clearInterval(p.solverAnimation); p.solverAnimation = undefined;
        p.solverPausedByUser = true;
        this.setData({ playing: false }); return;
      }
      p.solverPausedByUser = false;
      const total = playback.moves.length;
      let index = (p.solverFrame ?? 0);
      if (index >= total) { index = 0; showSolverFrame(p, 0); }
      const advance = () => {
        showSolverFrame(p, ++index, true);
        if (index >= total) {
          clearInterval(p.solverAnimation); p.solverAnimation = undefined;
          this.setData({ playing: false });
        }
      };
      this.setData({ playing: true });
      p.solverAnimation = setInterval(advance, isSteps ? RECON_NOTATION_PLAY_INTERVAL_MS : 360);
      if (!isSteps) advance();
    },
    startSolverOrbit(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const point = e.touches?.[0];
      if (p.solverCube && point) p.solverCubeGesture = { id: point.identifier, x: point.clientX, y: point.clientY };
    },
    moveSolverOrbit(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, previous = p.solverCubeGesture;
      const point = previous && e.touches?.find(touch => touch.identifier === previous.id);
      if (!previous || !point) return;
      p.solverCube?.orbit(point.clientX - previous.x, point.clientY - previous.y);
      previous.x = point.clientX; previous.y = point.clientY;
    },
    endSolverOrbit() { (this as unknown as NativePage).solverCubeGesture = undefined; },
    selectSolverMethod(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const index = Number(e.detail.value), method = METHOD_REGISTRY[index];
      if (!method || index === this.data.solverMethodIndex) return;
      stopNativeSolver(p);
      try { miniProgramApi().setStorageSync(SOLVER_STEP_METHOD_STORAGE, method.id); } catch { /* optional preference */ }
      this.setData({ solverMethodIndex: index, solverRows: [], formError: '', playback: null, playing: false }, () => this.solveCurrentScramble());
    },
    solveCurrentScramble() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const method = METHOD_REGISTRY[Number(this.data.solverMethodIndex)];
      if (p.sheet !== 'solver' || this.data.solverView !== 1 || !t?.scramble || t.event !== '333' || t.busy || !method || p.stopSolver) return;
      const scramble = t.scramble;
      releaseSolverCanvas(p);
      if (p.solverStepCache?.scramble !== scramble) p.solverStepCache = { scramble, methods: new Map() };
      const cache = p.solverStepCache.methods;
      const display = (result: SolveResult) => {
        const notation = p.solverStepNotation = timer333StepNotation(result, method.id, getMiniProgramLocale());
        this.setData({ solverLoading: false, solverNotationCopied: false,
          solverRows: notation.lines.map(({ key, moveText, label }) => ({ id: key, moves: moveText, label })) });
        if (!notation.moves.length) return;
        setSolverPlayback(p, { setup: scramble, moves: notation.moves });
        if (!this.data.compareOpen) openSolverCanvas(p);
      };
      const cached = cache.get(method.id);
      if (cached) { display(cached); return; }
      this.setData({ solverLoading: true, solverRows: [], formError: '', solverCanvas: false, solverCanvasReady: false });
      p.stopSolver = scheduleTimer333StepSolve({ scramble, methodId: method.id }, outcome => {
        p.stopSolver = undefined;
        if (!p.active || p.sheet !== 'solver' || this.data.solverView !== 1) return;
        if (t.scramble !== scramble || outcome.status === 'error') {
          this.setData({ solverLoading: false, formError: copy().solverStepFailed });
          return;
        }
        cache.set(method.id, outcome.result);
        display(outcome.result);
      }, run => {
        const task = setTimeout(run, 20);
        return () => clearTimeout(task);
      });
    },
    loadMoreHistory() { const p = this as unknown as NativePage; p.historyLimit = (p.historyLimit ?? 100) + 100; refresh(p, true); },
    switchResultsTab(e: WechatMiniprogram.TouchEvent) {
      const sheet = e.currentTarget.dataset.sheet;
      if ((sheet === 'history' || sheet === 'statistics') && this.data.resultsWorkspace && sheet !== this.data.sheet) {
        this.openSheet({ currentTarget: { dataset: { sheet } } });
      }
    },
    toggleHistorySearch() {
      const open = !this.data.historySearchOpen;
      this.setData({ historySearchOpen: open });
      if (!open) this.clearHistorySearch();
    },
    openHistoryActions() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.sheet !== 'history') return;
      const labels = copy();
      const actions: { label: string; run: () => void }[] = [
        { label: labels.manualEntry, run: () => this.openSheet({ currentTarget: { dataset: { sheet: 'manual' } } }) },
      ];
      if (!this.data.generating) {
        if (this.data.canPrevious) actions.push({ label: labels.previous, run: () => this.previousScramble() });
        actions.push({ label: labels.next, run: () => this.nextScramble() });
      }
      if (t.solves.length) actions.push(
        { label: labels.export, run: () => this.exportResults('csv') },
        { label: 'csTimer JSON', run: () => this.exportResults('cstimer') },
        { label: 'Speedstacks', run: () => this.exportResults('speedstacks') },
      );
      const generation = p.sheetGeneration;
      miniProgramApi().showActionSheet({ itemList: actions.map(action => action.label), success: result => {
        if (p.active && p.sheet === 'history' && p.sheetGeneration === generation && !t.busy) actions[result.tapIndex]?.run();
      } });
    },
    searchHistory(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (p.nativeTimer) p.nativeTimer.historyFilters.query = e.detail.value;
      this.setData({ historyQuery: e.detail.value }); p.historyLimit = 100; refresh(p, true);
    },
    clearHistorySearch() {
      const p = this as unknown as NativePage;
      if (p.nativeTimer) p.nativeTimer.historyFilters.query = '';
      this.setData({ historyQuery: '' }); refresh(p, true);
    },
    toggleTimerSetting(e: WechatMiniprogram.TouchEvent) {
      const { setting, checked } = e.currentTarget.dataset;
      this.changeSetting({
        currentTarget: { dataset: { setting, kind: 'switch' } },
        detail: { value: checked !== true && checked !== 'true' },
      } as unknown as WechatMiniprogram.SwitchChange);
    },
    changeSetting(e: WechatMiniprogram.PickerChange | WechatMiniprogram.SwitchChange | WechatMiniprogram.Input | WechatMiniprogram.SliderChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const { setting, kind } = e.currentTarget.dataset;
      const value = kind === 'picker' ? Number(e.detail.value) : kind === 'number-range' && setting !== 'metronomeBpm' ? Number(e.detail.value) / 100 : e.detail.value;
      const category = TIMER_SETTING_CATEGORY_CONTRACTS.find(entry => entry.id === this.data.settingsCategory);
      if (!category) return;
      const patch = nativeTimerSettingPatch(t, category.id, setting, value, nativeSettingsContext(p));
      if (patch) t.updateSettings(patch);
      refresh(p, true);
    },
    tapTimerMetronome() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet === 'settings' && this.data.settingsCategory === 'sound' && t && !t.busy) {
        t.tapMetronomeTempo(); refresh(p, true);
      }
    },
    previewTimerSound(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet === 'settings' && this.data.settingsCategory === 'sound' && !t?.busy) t?.playSoundPreview(e.currentTarget.dataset.kind === 'inspection' ? 'inspection' : 'start');
    },
    toggleInspectionAlertsHelp() {
      const p = this as unknown as NativePage;
      if (!p.active || p.sheet !== 'settings' || this.data.settingsCategory !== 'sound') return;
      if (this.data.inspectionAlertsHelp) { this.closeInspectionAlertsHelp(); return; }
      const viewport = p.soloViewport ?? nativeContentViewport();
      const createQuery = p.createSelectorQuery?.bind(p);
      const request = p.inspectionAlertsHelpRequest = (p.inspectionAlertsHelpRequest ?? 0) + 1;
      if (!viewport || viewport.width <= 480 || viewport.height <= 420 || !createQuery) {
        this.setData({ inspectionAlertsHelp: { style: '' } });
        return;
      }
      this.setData({ inspectionAlertsHelp: { style: 'visibility:hidden' } }, () => {
        const query = createQuery();
        query.select('#nt-inspection-alerts-help-trigger').boundingClientRect();
        query.select('#nt-inspection-alerts-help').boundingClientRect();
        query.exec(([anchor, panel]) => {
          if (!this.data.inspectionAlertsHelp || p.inspectionAlertsHelpRequest !== request) return;
          if (!anchor || !panel) { this.setData({ inspectionAlertsHelp: { style: '' } }); return; }
          const below = anchor.bottom + 4;
          const top = below + panel.height <= viewport.height - 8 ? below : Math.max(8, anchor.top - panel.height - 4);
          const left = Math.min(Math.max(16, anchor.left), viewport.width - panel.width - 16);
          this.setData({ inspectionAlertsHelp: { style: `left:${left}px;top:${top}px;bottom:auto` } });
        });
      });
    },
    closeInspectionAlertsHelp() { this.setData({ inspectionAlertsHelp: null }); },
    selectSettingsCategory(e: WechatMiniprogram.PickerChange | WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget?.dataset?.index ?? (e.detail as { value?: string } | undefined)?.value);
      const category = (this.data.settingsCategories as { id: string }[] | undefined)?.[index];
      if (category && this.data.settingsCategory !== category.id) this.setData({ settingsCategory: category.id, settingsCategoryIndex: index, orientationMenu: null, inspectionAlertsHelp: null });
    },
    openScrambleOrientation() {
      const p = this as unknown as NativePage, timer = p.nativeTimer;
      if (p.sheet !== 'settings' || this.data.settingsCategory !== 'scramble' || !timer || timer.busy) return;
      const options = nativeTimerOrientationOptions(timer.settings.preScr);
      const viewport = p.soloViewport ?? nativeContentViewport() ?? { width: 393, height: 658 };
      const generation = p.sheetGeneration;
      const show = (anchor?: { left: number; top: number; bottom: number }) => {
        if (p.sheetGeneration !== generation || this.data.settingsCategory !== 'scramble' || timer.busy) return;
        const width = Math.min(124, viewport.width - 16), gap = 6;
        const belowTop = (anchor?.bottom ?? viewport.height / 2) + gap;
        const below = viewport.height - belowTop - 8;
        const above = (anchor?.top ?? viewport.height / 2) - gap - 8;
        const height = Math.max(0, Math.max(above, below));
        const top = below >= height ? belowTop : 8 + above - height;
        const left = Math.max(8, Math.min(anchor?.left ?? viewport.width - width - 18, viewport.width - width - 8));
        this.setData({ orientationMenu: { options, current: options.findIndex(option => option.selected),
          style: `left:${left}px;top:${top}px;width:${width}px;height:${height}px` } });
      };
      const query = p.createSelectorQuery?.();
      if (!query) { show(); return; }
      query.select('#nt-orientation-trigger').boundingClientRect();
      query.exec(([anchor]) => show(anchor ?? undefined));
    },
    closeScrambleOrientation() { this.setData({ orientationMenu: null }); },
    selectScrambleOrientation(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, timer = p.nativeTimer;
      if (p.sheet !== 'settings' || this.data.settingsCategory !== 'scramble' || !this.data.orientationMenu || !timer) return;
      const option = nativeTimerOrientationOptions(timer.settings.preScr)[Number(e.currentTarget.dataset.index)];
      const patch = nativeTimerSettingPatch(timer, 'scramble', 'preScr', option?.value);
      if (patch) timer.updateSettings(patch);
      this.closeScrambleOrientation();
      refresh(p, true);
    },
    changeTrainingSetting(e: WechatMiniprogram.Input | WechatMiniprogram.PickerChange | WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'settings' || this.data.settingsCategory !== 'training' || !t) return;
      const { field, event } = e.currentTarget.dataset;
      if (field === 'target' && event !== t.event) return;
      const patch = nativeTimerTrainingPatch(t, field, (e.detail as { value?: string } | undefined)?.value);
      if (patch) { t.updateSettings(patch); refresh(p, true); }
    },
    startTrainingRound() {
      const p = this as unknown as NativePage;
      if (p.sheet || p.layoutEditing || p.netMode || p.localBattle) return;
      p.nativeTimer?.startTrainingRound();
      refresh(p, true);
    },
    markAttemptSplit(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet || p.layoutEditing || p.netMode || p.localBattle) return;
      const { mark } = e.currentTarget.dataset;
      if (mark !== 'cross' && mark !== 'f2l' && mark !== 'oll' && mark !== 'memo') return;
      p.nativeTimer?.markAttemptSplit(mark);
      refresh(p);
    },
    toggleLiveNotation() {
      const p = this as unknown as NativePage;
      const view = this.data.liveAnalysis as NativeLiveAnalysisView | null | undefined;
      if (view?.canToggle) p.liveAnalysis?.toggleNotation();
    },
    copyLiveNotation(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const view = this.data.liveAnalysis as NativeLiveAnalysisView | null | undefined;
      if (!view) return;
      const { line } = e.currentTarget.dataset;
      const data = typeof line === 'string' ? line : view.clipboard;
      if (data) miniProgramApi().setClipboardData({ data, success: () => {
        if (typeof line === 'string' || !p.active || !this.data.liveAnalysis) return;
        this.setData({ liveAnalysisCopied: true });
        clearTimeout(p.liveAnalysisCopyTimer);
        p.liveAnalysisCopyTimer = setTimeout(() => {
          p.liveAnalysisCopyTimer = undefined;
          if (p.active) this.setData({ liveAnalysisCopied: false });
        }, 1500);
      } });
    },
    changeRollingStatistic(e: WechatMiniprogram.PickerChange | WechatMiniprogram.Input) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'settings' || this.data.settingsCategory !== 'timer' || !t || t.busy) return;
      const context = nativeSettingsContext(p), { column, kind } = e.currentTarget.dataset;
      const model = nativeTimerRollingStatsSettings(t, context);
      const value = kind === 'preset' ? model?.options[Number(e.detail.value)] : e.detail.value;
      const patch = nativeTimerRollingStatsPatch(t, context, column, kind, value);
      if (patch) t.updateSettings(patch);
      refresh(p, true);
    },
    inputSyncSeed(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      p.syncSeedDraft = e.detail.value;
      refresh(p, true);
    },
    changeSyncSeed(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'settings' || this.data.settingsCategory !== 'advanced' || !t || t.busy) return;
      const action = e.currentTarget.dataset.action;
      if (action === 'clear') p.syncSeedDraft = '';
      else {
        const patch = nativeTimerSyncSeedPatch(t, nativeSettingsContext(p), action);
        if (patch) { t.updateSettings(patch); p.syncSeedDraft = patch.syncSeed ?? ''; }
      }
      refresh(p, true);
    },
    async resetNativeTimerSettings() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || p.sheet !== 'settings' || this.data.settingsCategory !== 'advanced') return;
      const generation = p.sheetGeneration;
      await confirmNativeTimerResetDefaults(t, {
        isCurrent: () => Boolean(p.active) && p.sheet === 'settings' && p.sheetGeneration === generation
          && this.data.settingsCategory === 'advanced',
        reset: settings => t.resetSettings(settings),
      });
      refresh(p, true);
    },
    openSettingsAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.sheet !== 'settings') return;
      const sheet = nativeTimerSettingsActionSheet(t, this.data.settingsCategory, e.currentTarget.dataset.action);
      if (sheet) this.openSheet({ currentTarget: { dataset: { sheet } } });
    },
    async runSettingsMore(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'settings' || !t) return;
      const command = nativeTimerSettingsMoreCommand(t, this.data.settingsCategory, e.currentTarget.dataset.action);
      if (command === 'toggle-language') {
        switchNativeTimerLanguage();
        this.setData({ copy: copy(), events: nativeTimerEvents(), projectGroups: nativeTimerProjectGroups() });
        miniProgramApi().setNavigationBarTitle({ title: copy().title });
        refresh(p, true);
      }
      if (command === 'clear-event') {
        const generation = p.sheetGeneration;
        await confirmNativeTimerClearEvent(t, {
          isCurrent: () => Boolean(p.active) && p.sheet === 'settings' && p.sheetGeneration === generation,
          clear: (session, event) => t.clearCurrentEvent(session, event),
        });
        refresh(p, true);
      }
    },
    async nativeBackupAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer, backups = p.localBackups;
      if (!t || !backups || t.busy || p.backupsBusy || p.sheet !== 'settings') return;
      const generation = p.sheetGeneration, action = e.currentTarget.dataset.action;
      const current = () => p.active && !t.busy && p.sheet === 'settings' && p.sheetGeneration === generation;
      if (action === 'list' && p.backupsExpanded) { p.backupsExpanded = false; refresh(p, true); return; }
      p.backupsBusy = true; refresh(p, true);
      try {
        if (action === 'create') {
          await backups.create(t.exportBackup());
        }
        if (action === 'restore') {
          const key = String(e.currentTarget.dataset.key), snapshot = t.exportBackup();
          const text = await backups.read(key);
          if (!current()) return;
          if (!text) throw new Error('Backup unavailable');
          const confirmed = await new Promise<boolean>(resolve => miniProgramApi().showModal({
            title: copy().restore, content: nativeTimerLocalBackupControls(false, true).restoreConfirmation,
            success: result => resolve(result.confirm), fail: () => resolve(false),
          }));
          if (!confirmed || !current() || t.exportBackup() !== snapshot) return;
          if (!t.restoreBackup(text)) throw new Error('Backup restore failed');
          miniProgramApi().showToast({ icon: 'success', title: copy().dataCompleted });
        }
        if (!current()) return;
        if (action === 'create' || action === 'list') p.backupsExpanded = true;
        const rows = p.backupsExpanded ? await backups.list() : [];
        if (current()) this.setData({ localBackupRows: rows.map(row => ({
          ...row, date: new Date(row.ts).toLocaleString(getMiniProgramLocale() === 'zh' ? 'zh-CN' : 'en-US'),
        })) });
      } catch {
        if (current()) miniProgramApi().showToast({ icon: 'none', title: copy().dataTransferError });
      } finally { p.backupsBusy = false; refresh(p, true); }
    },
    exportTimerData(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'settings' || !t || t.busy) return;
      const transfer = prepareNativeTimerExport(t, e.currentTarget.dataset.format), labels = copy();
      if (!transfer) { miniProgramApi().showToast({ icon: 'none', title: labels.empty }); return; }
      miniProgramApi().showActionSheet({ itemList: [labels.dataCopy, labels.dataSaveAs], success: result => {
        const action = result.tapIndex === 0 ? copyNativeTimerExport(transfer) : saveNativeTimerExport(transfer);
        void action.then(() => {
          if (p.active && result.tapIndex === 1) miniProgramApi().showToast({ icon: 'success', title: labels.dataCompleted });
        }).catch(() => {
          if (p.active) miniProgramApi().showToast({ icon: 'none', title: labels.dataTransferError });
        });
      } });
    },
    async readTimerImport(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'import' || p.importBusy || !t || t.busy) return;
      const generation = p.sheetGeneration;
      const current = () => p.active && p.sheet === 'import' && p.sheetGeneration === generation;
      p.importBusy = true; this.setData({ importBusy: true, formError: '' });
      try {
        const id = e.currentTarget.dataset.id;
        const text = typeof id === 'string' && id ? await readNativeTimerImportFile(id) : await readNativeTimerImportClipboard();
        if (current()) this.stageTimerImport(text);
      } catch { if (current()) this.setData({ formError: copy().dataTransferError }); }
      finally { if (current()) { p.importBusy = false; this.setData({ importBusy: false }); } }
    },
    checkTimerImport() {
      const p = this as unknown as NativePage;
      if (p.sheet === 'import' && !p.importBusy) this.stageTimerImport(p.draft ?? '');
    },
    stageTimerImport(text: string) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (p.sheet !== 'import' || !t || t.busy) return;
      const staged = prepareNativeTimerImport(t, text);
      p.importTargets = {};
      p.stagedImport = staged.kind === 'invalid' ? undefined : staged;
      if (staged.kind === 'invalid') {
        this.setData({ importStatus: '', formError: copy().dataInvalid });
        return;
      }
      this.setData({ importStatus: staged.kind, formError: '',
        importRows: staged.kind === 'sessions' ? staged.sessions.filter(row => !row.matched && row.solves.length)
          .map(row => ({ id: row.sessionId, name: row.name, index: -1 })) : [],
        importCounts: { groups: staged.kind === 'backup' ? staged.sessionCount : staged.sessions.length, solves: staged.kind === 'backup' ? staged.solveCount : staged.plan.solveCount },
        importUnresolved: staged.kind === 'sessions' && staged.plan.unresolvedSessionIds.length > 0 });
    },
    setTimerImportEvent(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, staged = p.stagedImport, id = String(e.currentTarget.dataset.id);
      const events = nativeTimerEvents(), index = Number(e.detail.value);
      if (p.sheet !== 'import' || staged?.kind !== 'sessions' || !p.importTargets || !events[index]
        || !staged.sessions.some(row => row.sessionId === id && !row.matched)) return;
      p.importTargets[id] = events[index].id;
      staged.plan = planTimerImport(staged.sessions, p.importTargets);
      this.setData({ importUnresolved: staged.plan.unresolvedSessionIds.length > 0,
        importRows: staged.sessions.filter(row => !row.matched && row.solves.length)
          .map(row => ({ id: row.sessionId, name: row.name, index: events.findIndex(event => event.id === p.importTargets?.[row.sessionId]) })) });
    },
    async finishTimerImport() {
      const p = this as unknown as NativePage, t = p.nativeTimer, staged = p.stagedImport;
      if (!p.active || p.sheet !== 'import' || p.importBusy || !t || t.busy || !staged) return;
      const generation = p.sheetGeneration;
      if (staged.kind === 'sessions' && staged.plan.unresolvedSessionIds.length) return;
      if (staged.kind === 'backup') {
        const snapshot = t.exportBackup();
        const confirmed = await new Promise<boolean>(resolve => miniProgramApi().showModal({
          title: copy().restore,
          content: tr({ en: 'Replace local results and settings? A copy of the current data will be kept before restoring.', zh: '替换本机成绩和设置？恢复前会保留当前数据的副本。' }),
          success: result => resolve(result.confirm), fail: () => resolve(false),
        }));
        if (!confirmed || !p.active || p.sheet !== 'import' || p.sheetGeneration !== generation || p.stagedImport !== staged
          || t.busy || t.exportBackup() !== snapshot) return;
      }
      const done = staged.kind === 'backup' ? t.restoreBackup(staged.text) : t.importSessions(staged.plan.sessions);
      if (!done) { this.setData({ formError: copy().dataTransferError }); return; }
      this.openSheet({ currentTarget: { dataset: { sheet: 'settings' } } });
      refresh(p, true);
      miniProgramApi().showToast({ icon: 'success', title: copy().dataCompleted });
    },
    toggleBulkProjectMenu() {
      const p = this as unknown as NativePage;
      if (!p.active || p.sheet !== 'bulk') return;
      if (this.data.bulkProjectMenu) { this.closeBulkProjectMenu(); return; }
      const generation = p.sheetGeneration;
      const viewport = p.soloViewport ?? nativeContentViewport() ?? { width: 393, height: 658 };
      const position = (anchor?: { left: number }) => {
        if (p.sheetGeneration !== generation) return;
        const compactWidth = getMiniProgramLocale() === 'zh' ? 170 : 224;
        const width = Math.min(viewport.width <= 480 ? compactWidth : 340, viewport.width - 32);
        const left = Math.min(Math.max(16, anchor?.left ?? 16), viewport.width - width - 16);
        this.setData({ bulkProjectMenu: `left:${left}px;top:8px;width:${width}px;height:${viewport.height - 16}px` });
      };
      this.setData({ bulkProjectMenu: 'visibility:hidden' });
      const query = p.createSelectorQuery?.();
      if (!query) { position(); return; }
      query.select('#nt-bulk-project-trigger').boundingClientRect();
      query.exec(([anchor]) => { if (this.data.bulkProjectMenu) position(anchor ?? undefined); });
    },
    closeBulkProjectMenu() { this.setData({ bulkProjectMenu: null }); },
    inputBulkCount(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'bulk') return;
      const number = Number(e.detail.value);
      if (!Number.isFinite(number)) return;
      const count = String(clampTimerBulkScrambleCount(number));
      if (count !== this.data.bulkCount) {
        stopNativeBulkScrambles(p);
        this.setData({ bulkCount: count, bulkGenerating: false, bulkBatch: null, bulkCopied: false, bulkExportError: '', formError: '' });
      }
      return count;
    },
    generateBulkScrambles() {
      const p = this as unknown as NativePage;
      const timer = p.nativeTimer;
      if (!p.active || p.sheet !== 'bulk' || !timer || timer.busy || this.data.bulkGenerating) return;
      const event = (this.data.bulkEvents as ReturnType<typeof nativeTimerEvents>)[Number(this.data.bulkEventIndex)]?.id;
      const count = Number(this.data.bulkCount);
      if (!event || !isTimerBulkScrambleEvent(event) || !Number.isInteger(count) || count !== clampTimerBulkScrambleCount(count)) return;
      const generation = p.sheetGeneration;
      const { scramble222Mode, cnMode } = timer.settings;
      const scrambles: string[] = [];
      const source = p.bulkScrambles = createNativeTimerScrambleSource();
      const current = () => p.active && p.sheet === 'bulk' && p.sheetGeneration === generation && p.bulkScrambles === source;
      const fail = () => {
        stopNativeBulkScrambles(p);
        this.setData({ bulkGenerating: false, formError: tr(timerScrambleStatus('error-generated').message) });
      };
      const next = async () => {
        if (!current()) return;
        try {
          const request = source.generate(event, scramble222Mode, cnMode);
          const scramble = typeof request === 'string' ? request : await request;
          if (!current()) return;
          if (!scramble.trim()) { fail(); return; }
          scrambles.push(scramble);
          if (scrambles.length === count) {
            stopNativeBulkScrambles(p);
            this.setData({ bulkGenerating: false, bulkBatch: timerBulkScrambleBatch(event, scrambles) });
          } else setTimeout(() => { void next(); }, 0);
        } catch { if (current()) fail(); }
      };
      this.setData({ bulkGenerating: true, bulkBatch: null, bulkCopied: false, bulkExportError: '', formError: '' });
      setTimeout(() => { void next(); }, 0);
    },
    async exportBulkScrambles(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const batch = this.data.bulkBatch as ReturnType<typeof timerBulkScrambleBatch> | null;
      const { action } = e.currentTarget.dataset;
      if (!p.active || p.sheet !== 'bulk' || !batch || (action !== 'copy' && action !== 'download')) return;
      const generation = p.sheetGeneration;
      const current = () => p.active && p.sheet === 'bulk' && p.sheetGeneration === generation && this.data.bulkBatch === batch;
      this.setData({ bulkExportError: '' });
      try {
        if (action === 'copy') {
          await copyNativeTimerExport(batch);
          if (current()) this.setData({ bulkCopied: true });
        } else {
          await saveNativeTimerExport(batch);
          if (current()) miniProgramApi().showToast({ icon: 'success', title: copy().bulkSaved });
        }
      } catch {
        if (current()) this.setData({ bulkExportError: tr(TIMER_BULK_SCRAMBLE_COPY.exportFailed) });
      }
    },
    changeStatistics(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'statistics' || !p.statisticsOptions) return;
      const stats = p.statisticsOptions;
      const { action, value } = e.currentTarget.dataset;
      if (action === 'tab' && isNativeTimerStatisticsTab(value)) stats.tab = value;
      else if (action === 'range') {
        const range = TIMER_STATS_DATE_RANGES.find(item => item === value);
        if (!range) return;
        stats.range = range; stats.dayOffset = 0;
      } else if (action === 'metrics') {
        p.statisticsExpanded = !p.statisticsExpanded;
        this.setData({ statisticsExpanded: p.statisticsExpanded });
        return;
      } else if (action === 'day' && (value === 'previous' || value === 'next')) {
        const current = this.data.statistics as ReturnType<typeof nativeTimerStatistics> | undefined;
        const offset = current?.daily?.practice.offset ?? 0;
        stats.dayOffset = Math.max(0, offset + (value === 'previous' ? 1 : -1));
      } else if (action === 'cases' && (value === 'oll' || value === 'pll')) {
        const stage = value === 'oll' ? 'oll' : 'pll';
        stats.showAllCases = { ...stats.showAllCases, [stage]: !stats.showAllCases?.[stage] };
      } else return;
      refreshNativeStatistics(p);
    },
    chooseStatisticsMode(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'statistics' || !p.statisticsOptions) return;
      p.statisticsOptions.total = Number(e.detail.value) === 1;
      refreshNativeStatistics(p);
    },
    copyStatistics() {
      const p = this as unknown as NativePage, timer = p.nativeTimer;
      if (p.sheet !== 'statistics' || !timer) return;
      const generation = p.sheetGeneration;
      const report = nativeTimerStatistics(timer.solves, timer.event, { ...p.statisticsOptions, tab: 'overview', wide: false });
      const data = report.overview?.reportText;
      if (data) miniProgramApi().setClipboardData({ data, success: () => {
        if (p.sheet !== 'statistics' || p.sheetGeneration !== generation) return;
        this.setData({ statisticsCopied: true });
        setTimeout(() => {
          if (p.sheet === 'statistics' && p.sheetGeneration === generation) this.setData({ statisticsCopied: false });
        }, 1500);
      } });
    },
    selectStatisticsChartPoint(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      const { chart, label } = e.currentTarget.dataset;
      if (p.sheet === 'statistics' && (p.statisticsOptions?.wide || p.statisticsOptions?.tab === 'charts') && typeof label === 'string' && typeof chart === 'string') {
        this.setData({ statisticsChartHint: { chart, label } });
      }
    },
    toggleRankScope(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const scope = TIMER_RANK_SCOPES.find(value => value === e.currentTarget.dataset.scope);
      if (!t || t.busy || !scope) return;
      t.updateSettings({ rankScopes: t.settings.rankScopes.includes(scope) ? t.settings.rankScopes.filter(value => value !== scope) : [...t.settings.rankScopes, scope] });
      refresh(p, true);
    },
    changeRankCountry(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const country = rankCountries[Number(e.detail.value)];
      if (country !== undefined) p.nativeTimer?.updateSettings({ rankCountry: country });
      refresh(p, true);
    },
    selectSession(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const id = t?.sessions.sessions[Number(e.detail.value)]?.id;
      if (id) t?.selectSession(id); refresh(p, true);
    },
    sessionAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const action = String(e.currentTarget.dataset.action), active = t.sessions.sessions.find(s => s.id === t.sessions.activeSessionId)!;
      if (action === 'create' || action === 'rename') {
        p.sheet = action; p.draft = action === 'rename' ? active.name : '';
        this.setData({ sheet: action, draft: p.draft, formError: '' }); return;
      }
      miniProgramApi().showModal({ title: tr(action === 'delete' ? TIMER_SESSION_UI_COPY.deleteSession : TIMER_SESSION_UI_COPY.clearSolves),
        content: tr(action === 'delete' ? timerSessionDeleteConfirmation(active.name) : timerSessionClearConfirmation(active.name)),
        success: r => {
          if (!r.confirm || t.busy) return;
          const ok = action === 'delete' ? t.deleteSession() : t.clearSession();
          if (!ok) miniProgramApi().showToast({ icon: 'none', title: tr(TIMER_SESSION_UI_COPY.keepOneSession) });
          refresh(p, true);
        } });
    },
    draftInput(e: WechatMiniprogram.Input) { (this as unknown as NativePage).draft = e.detail.value; },
    changeManualEntry(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage, draft = p.manualDraft;
      const key = manualFields.find(field => field === e.currentTarget.dataset.field);
      if (p.sheet !== 'manual' || !draft || !key) return;
      draft[key] = e.detail.value;
      const validation = validateTimerManualEntry(draft);
      const labels = timerManualEntryCopy(getMiniProgramLocale());
      if (p.manualCheck) clearTimeout(p.manualCheck);
      p.manualCheck = undefined;
      const fmc = validation.fmc;
      const preview = validation.mbld ? `${validation.mbld.result} · ${labels.mbldPoints(validation.mbld.points)}`
        : fmc?.kind === 'parsed' ? labels.fmcChecking(fmc.count)
        : fmc?.kind === 'invalid' ? labels.fmcInvalidToken(fmc.token) : '';
      this.setData({ entryPreview: preview, formError: '' });
      if (fmc?.kind !== 'parsed') return;
      const scramble = draft.scramble.trim() || draft.currentScramble;
      const solution = draft.fmcSolution;
      p.manualCheck = setTimeout(() => {
        p.manualCheck = undefined;
        void checkTimerFmcSolvedness(scramble, fmc).then(result => {
          if (!p.active || p.sheet !== 'manual' || p.manualDraft !== draft
            || draft.fmcSolution !== solution || (draft.scramble.trim() || draft.currentScramble) !== scramble) return;
          const text = result === 'solved' ? labels.fmcSolved(fmc.count) : result === 'unsolved'
            ? labels.fmcUnsolved(fmc.count) : labels.fmcUnchecked(fmc.count);
          this.setData({ entryPreview: text });
        });
      }, 180);
    },
    changeEntryPenalty(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const index = Number(e.detail.value);
      const value = TIMER_HISTORY_PENALTIES[index];
      if (p.sheet !== 'manual' || !p.manualDraft || !value) return;
      p.manualDraft.penalty = value;
      this.setData({ entryPenaltyIndex: index, formError: '' });
    },
    clearDraft() { (this as unknown as NativePage).draft = ''; this.setData({ draft: '' }); },
    saveDraft() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const value = p.draft ?? '';
      if (p.sheet === 'manual') {
        const entry = p.manualDraft ? validateTimerManualEntry(p.manualDraft) : null;
        const saved = entry ? entry.value && t.saveManualEntry(entry.value) : t.manualEntry(value);
        if (!saved) {
          this.setData({ formError: timerManualEntryCopy(getMiniProgramLocale()).error(entry?.error ?? 'time-invalid') }); return;
        }
      }
      if (p.sheet === 'create') t.createSession(value);
      if (p.sheet === 'rename' && !t.renameSession(value)) return;
      if (p.sheet === 'comment' && p.resultId) { t.updateComment(p.resultId, value); showDetail(p); refresh(p, true); return; }
      this.closeSheet(); refresh(p, true);
    },
    async cloudBackup(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.cloudBusy) return;
      const session = getStoredSessionSnapshot().session;
      if (!session) { miniProgramApi().switchTab({ url: '/pages/account/index' }); return; }
      const upload = e.currentTarget.dataset.action === 'upload', token = session.token;
      const snapshot = t.exportBackup(), blob = t.exportCloudBackup();
      const current = () => p.active && !t.busy && getStoredSessionSnapshot().session?.token === token && t.exportBackup() === snapshot;
      const client = createTimerBackupClient({ apiUrl: path => path, fetcher: nativeTimerFetch, headers: () => ({ Authorization: `Bearer ${token}` }) });
      p.cloudBusy = true; this.setData({ cloudBusy: true });
      try {
        const remote = upload ? null : await client.download();
        if (!current()) return;
        if (!upload && !remote) { miniProgramApi().showToast({ icon: 'none', title: tr({ en: 'No account backup', zh: '账户暂无备份' }) }); return; }
        const confirm = await new Promise<boolean>(resolve => miniProgramApi().showModal({
          title: upload ? copy().cloudUpload : copy().cloudDownload,
          content: upload
            ? tr({ en: 'Replace this account’s cloud backup with the current local results?', zh: '用当前本机成绩替换该账户的云备份？' })
            : tr({ en: `Restore ${remote!.solveCount} results and replace local groups? Current local data will be kept in a recovery copy.`, zh: `恢复 ${remote!.solveCount} 条成绩并替换本机分组？恢复前会保留本机数据副本。` }),
          success: r => resolve(r.confirm), fail: () => resolve(false),
        }));
        if (!confirm || !current()) return;
        if (upload) await client.upload(blob);
        else if (!t.restoreBackup(remote!.blob)) throw new Error(tr({ en: 'Backup is invalid or storage is unavailable', zh: '备份无效或本机存储不可用' }));
        if (p.active && getStoredSessionSnapshot().session?.token === token) miniProgramApi().showToast({ icon: 'success', title: tr({ en: 'Completed', zh: '已完成' }) });
      } catch (error) {
        if (p.active) t.error = error instanceof Error ? error.message : String(error);
      } finally { p.cloudBusy = false; this.setData({ cloudBusy: false }); refresh(p, true); }
    },
    calibrateCube() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || !t.canResetCube || t.calibrating) return;
      miniProgramApi().showModal({ title: copy().calibrate,
        content: tr({ en: 'First solve the physical cube. Confirm only when all six faces are solved; calibration resets the device state.', zh: '请先把实体魔方六面还原，再确认。校准会重置魔方内部状态。' }),
        success: r => { if (r.confirm && !t.busy && t.cubeConnected) void getSmartCubeSession().resetLocalDevice(); } });
    },
    async loadWcaCompetitions() {
      const p = this as unknown as NativePage, generation = p.sheetGeneration;
      if (p.sheet !== 'wca') return;
      const language = getMiniProgramLocale();
      if (p.competitions && p.competitionLocale === language) {
        this.setData({ competitionListStatus: 'ready' }); refreshCompetitionSuggestions(p); return;
      }
      this.setData({ competitionListStatus: 'loading' });
      const current = () => p.active && p.sheet === 'wca' && p.sheetGeneration === generation;
      try {
        const rows = await nativeCompetitionCatalog.load(language);
        if (!current()) return;
        p.competitions = rows; p.competitionLocale = language;
        this.setData({ competitionListStatus: 'ready' }); refreshCompetitionSuggestions(p);
      } catch { if (current()) this.setData({ competitionListStatus: 'error' }); }
    },
    retryWcaRounds() { return loadCompetitionOptions(this as unknown as NativePage); },
    selectWcaCompetitionFilter(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, index = Number(e.detail.value);
      if (p.sheet !== 'wca') return;
      p.competitionPeriod = TIMER_WCA_COMPETITION_PERIODS[index]?.id ?? 'all';
      p.competitionLimit = 40; refreshCompetitionSuggestions(p);
    },
    toggleWcaCountry() {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'wca') return;
      p.competitionCountryQuery = '';
      this.setData({ competitionCountryOpen: !this.data.competitionCountryOpen, competitionCountryQuery: '' });
      refreshCompetitionSuggestions(p);
    },
    searchWcaCountry(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'wca') return;
      p.competitionCountryQuery = e.detail.value;
      this.setData({ competitionCountryQuery: e.detail.value });
      refreshCompetitionSuggestions(p);
    },
    pickWcaCountry(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, code = e.currentTarget.dataset.code;
      if (p.sheet !== 'wca' || typeof code !== 'string' || !p.competitionCountryCodes?.includes(code)) return;
      p.competitionCountry = code; p.competitionCountryQuery = ''; p.competitionLimit = 40;
      this.setData({ competitionCountryOpen: false, competitionCountryQuery: '' });
      refreshCompetitionSuggestions(p);
    },
    showMoreCompetitions() {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'wca' || !this.data.competitionHasMore) return;
      p.competitionLimit = (p.competitionLimit ?? 40) + 40; refreshCompetitionSuggestions(p);
    },
    wcaSearch(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage; p.competitionQuery = e.detail.value;
      this.setData({ competitionQuery: e.detail.value });
      p.competitionLimit = 40; refreshCompetitionSuggestions(p);
    },
    clearCompetitionSearch() {
      const p = this as unknown as NativePage;
      p.competitionQuery = ''; p.competitionLimit = 40; this.setData({ competitionQuery: '' });
      refreshCompetitionSuggestions(p);
    },
    pickCompetition(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, row = p.competitions?.find(c => c.id === e.currentTarget.dataset.id);
      if (!row) return;
      p.nativeTimer?.updateSettings({ wcaScrambleMode: 'comp', wcaComp: row.id, wcaCompName: row.name, wcaCompCountry: row.country, wcaRound: '', wcaGroup: '' });
      this.clearCompetitionSearch(); refresh(p, true); void loadCompetitionOptions(p);
    },
    changeWca(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t) return;
      const key = String(e.currentTarget.dataset.setting), index = Number(e.detail.value);
      if (key === 'round') t.updateSettings({ wcaRound: (this.data.rounds as string[])[index] ?? '', wcaGroup: '' });
      if (key === 'group') t.updateSettings({ wcaGroup: (this.data.groups as string[])[index] ?? '' });
      refreshCompetitionOptions(p); refresh(p, true);
    },
    clearWca(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, key = e.currentTarget.dataset.setting;
      if (key !== 'comp') return;
      p.nativeTimer?.updateSettings({ wcaScrambleMode: 'comp', wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '' });
      void loadCompetitionOptions(p);
      refreshCompetitionOptions(p); refresh(p, true);
    },
    imageError() { this.setData({ previewError: tr({ en: 'Image could not be displayed', zh: '图示加载失败' }) }); },
    detailImageError() { this.setData({ detailPreviewError: tr({ en: 'Image could not be displayed', zh: '图示加载失败' }) }); },
    cancelAttempt() { const p = this as unknown as NativePage; p.nativeTimer?.dispatch({ type: 'cancel-arm' }); refresh(p); },
    openDeviceCenter() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.layoutEditing) return;
      const model = nativeTimerDeviceCenter(nativeDeviceState(p, t));
      if (model.directKind) {
        p.deviceManagementKind = model.directKind;
        p.deviceError = '';
        this.openSheet({ currentTarget: { dataset: { sheet: 'device-management' } } });
      } else if (model.visible) this.openSheet({ currentTarget: { dataset: { sheet: 'devices' } } });
    },
    selectDevice(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || (p.sheet !== 'devices' && p.sheet !== 'device-management')) return;
      const kind = e.currentTarget.dataset.kind;
      const action = nativeTimerDeviceSelection(nativeDeviceState(p, t), kind);
      if (!action) return;
      p.deviceManagementKind = kind;
      p.deviceError = '';
      this.openSheet({ currentTarget: { dataset: { sheet: 'device-management' } } });
      if (action === 'scan-cube') void this.connectCube();
      if (action === 'connect-timer') this.scanExternalTimers();
      if (action === 'connect-stackmat') void this.startStackmatListening();
    },
    async disconnectDevice() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.sheet !== 'device-management') return;
      const generation = p.sheetGeneration;
      if (p.deviceManagementKind === 'smart-cube') await getSmartCubeSession().disconnect();
      else if (p.deviceManagementKind === 'smart-timer') { await disconnectExternalTimer(); return; }
      if (p.active && p.sheetGeneration === generation) this.closeSheet();
    },
    async startStackmatListening() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || !p.active || t.busy || p.connecting || t.externalKind === 'stackmat-mic'
        || p.sheet !== 'device-management' || p.deviceManagementKind !== 'stackmat' || !nativeDeviceState(p, t).stackmatAvailable) return;
      const generation = p.sheetGeneration;
      const panelOpen = () => p.active && p.sheet === 'device-management' && p.deviceManagementKind === 'stackmat';
      p.connecting = true;
      p.deviceError = '';
      p.stackmatSnapshot = undefined;
      refresh(p, true);
      let lastDiagnostics = 0;
      try {
        await disconnectExternalTimer();
        await getSmartCubeSession().stopLocal();
        if (!panelOpen() || p.sheetGeneration !== generation) return;
        await startExternalTimer('', 'stackmat-mic', t.receiveExternal, {
          onStackmatSnapshot(snapshot) {
            p.stackmatSnapshot = snapshot;
            const now = Date.now();
            if (!panelOpen() || now - lastDiagnostics < 80) return;
            lastDiagnostics = now;
            p.setData({ 'deviceManagement.stackmat': nativeStackmatManagement(nativeDeviceState(p, t)) });
          },
          onStackmatError(error) {
            p.stackmatSnapshot = undefined;
            if (panelOpen()) p.deviceError = nativeStackmatError(error);
          },
        });
      } catch (error) {
        if (panelOpen() && p.sheetGeneration === generation) p.deviceError = nativeStackmatError(error);
      } finally {
        p.connecting = false;
        if (p.active) refresh(p, true);
      }
    },
    async stopStackmatListening() {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'device-management' || p.deviceManagementKind !== 'stackmat' || p.nativeTimer?.externalKind !== 'stackmat-mic') return;
      p.stackmatSnapshot = undefined;
      p.deviceError = '';
      await disconnectExternalTimer();
    },
    async connectCube() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.connecting || p.sheet !== 'device-management' || p.deviceManagementKind !== 'smart-cube') return;
      if (t.cubeConnected) return;
      if (t.event !== '333' && t.event !== '333oh') {
        p.deviceError = tr({ en: 'Select 3×3 or OH first', zh: '请先选择三阶或单手' }); refresh(p, true); return;
      }
      const sheetGeneration = p.sheetGeneration, session = getSmartCubeSession();
      const current = () => p.active && p.sheetGeneration === sheetGeneration;
      p.deviceError = '';
      p.connecting = true;
      refresh(p, true);
      try {
        await disconnectExternalTimer();
        if (!current()) return;
        await session.startLocal(t.receiveCube);
        if (!current()) return;
        if (p.cubeDeviceSnapshot?.phase === 'scanning') await session.disconnect();
        if (current()) await session.scan({ scanTimeoutMs: 30_000 });
      } catch (error) { if (current()) p.deviceError = error instanceof Error ? error.message : String(error); }
      finally { p.connecting = false; if (p.active) refresh(p, true); }
    },
    async connectListedCube(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'device-management' || p.deviceManagementKind !== 'smart-cube'
        || p.cubeDeviceSnapshot?.phase !== 'scanning') return;
      const id = e.currentTarget.dataset.id;
      if (!p.cubeDeviceSnapshot.devices.some(device => device.deviceId === id)) return;
      const sheetGeneration = p.sheetGeneration;
      try { await getSmartCubeSession().connectDevice(id); }
      catch (error) {
        if (p.active && p.sheetGeneration === sheetGeneration) {
          p.deviceError = error instanceof Error ? error.message : String(error);
          refresh(p, true);
        }
      }
    },
    scanExternalTimers() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.connecting || p.sheet !== 'device-management' || p.deviceManagementKind !== 'smart-timer') return;
      if ((t.externalConnected && t.externalKind !== 'stackmat-mic') || p.externalTimerScan || p.externalTimerMac) return;
      const controller = new AbortController();
      const scan = p.externalTimerScan = { controller, devices: [] as NativeBluetoothTimerCandidate[], done: Promise.resolve() };
      p.deviceError = '';
      refresh(p, true);
      scan.done = (async () => {
        try {
          await disconnectExternalTimer();
          if (controller.signal.aborted) return;
          await getSmartCubeSession().stopLocal();
          if (controller.signal.aborted) return;
          await discoverNativeTimers({
            signal: controller.signal,
            onUpdate(devices) {
              if (!p.active || controller.signal.aborted) return;
              scan.devices = devices;
              refresh(p, true);
            },
          });
        } catch (error) {
          if (!controller.signal.aborted) p.deviceError = error instanceof Error ? error.message : String(error);
        } finally {
          p.externalTimerScan = undefined;
          if (p.active) refresh(p, true);
        }
      })();
    },
    connectListedTimer(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const scan = p.externalTimerScan;
      if (!t || t.busy || p.connecting || p.sheet !== 'device-management' || p.deviceManagementKind !== 'smart-timer'
        || !scan || scan.controller.signal.aborted) return;
      const picked = scan.devices.find(({ device }) => device.deviceId === e.currentTarget.dataset.id);
      if (picked) void connectExternalTimerCandidate(p, t, picked);
    },
    inputExternalTimerMac(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (!p.externalTimerMac) return;
      p.externalTimerMac.value = e.detail.value;
      p.deviceError = '';
      refresh(p, true);
    },
    clearExternalTimerMac() {
      const p = this as unknown as NativePage;
      if (!p.externalTimerMac) return;
      p.externalTimerMac.value = '';
      p.deviceError = '';
      refresh(p, true);
    },
    submitExternalTimerMac() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.connecting || !p.externalTimerMac || p.sheet !== 'device-management') return;
      const mac = normalizeBleMac(p.externalTimerMac.value);
      if (mac) void connectExternalTimerCandidate(p, t, p.externalTimerMac.picked, mac);
      else { p.deviceError = tr(BLUETOOTH_TIMER_DIALOG_COPY.invalidMac); refresh(p, true); }
    },
    cancelExternalTimerMac() {
      const p = this as unknown as NativePage;
      p.externalTimerMac = undefined;
      p.deviceError = '';
      refresh(p, true);
    },
    inputReplay(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'replay' || p.replayRequest) return;
      p.draft = e.detail.value;
      this.setData({ replayHasInput: Boolean(p.draft.trim()), formError: '' });
    },
    clearReplayInput() {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'replay' || p.replayRequest) return;
      p.draft = '';
      this.setData({ draft: '', replayHasInput: false, formError: '' });
    },
    async openReplayInput() {
      const p = this as unknown as NativePage, t = p.nativeTimer, input = p.draft?.trim();
      if (!p.active || !t || t.busy || !input || p.replayRequest || p.sheet !== 'replay') return;
      const controller = p.replayRequest = new AbortController();
      const generation = p.sheetGeneration;
      const current = () => p.active && p.sheet === 'replay' && p.sheetGeneration === generation && !controller.signal.aborted;
      this.setData({ replayLoading: true, formError: '' });
      try {
        const solve = await readNativeTimerReplay(input, t.records, controller.signal);
        if (!current()) return;
        if (!solve) { this.setData({ formError: copy().replayInput.error }); return; }
        p.replaySolve = solve;
        this.openSheet({ currentTarget: { dataset: { sheet: 'recap' } } });
      } catch { if (current()) this.setData({ formError: copy().replayInput.error }); }
      finally {
        if (p.replayRequest === controller) {
          p.replayRequest = undefined;
          if (current()) this.setData({ replayLoading: false });
        }
      }
    },
    async loadRecap() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const replay = p.replaySolve;
      const solve = replay ?? t?.records.find(row => row.id === p.resultId), generation = p.sheetGeneration;
      if (!solve?.moves?.length || p.sheet !== 'recap') return;
      this.setData({ recapLoading: true, recapFrame: null, recapPlaying: false, formError: '' });
      const current = () => p.active && p.sheet === 'recap' && p.sheetGeneration === generation
        && (replay ? p.replaySolve === replay : p.resultId === solve.id);
      try {
        const { createNativeTimerRecap } = await import('./native-timer-recap');
        if (!current()) return;
        const report = p.recap = createNativeTimerRecap(solve, getMiniProgramLocale()) ?? undefined;
        if (!report) return;
        p.recapGyro = report.hasGyro && t?.settings.gyroEnabled === true;
        this.setData({ recapFrame: report.seek(0), recapRows: report.rows, recapHasGyro: report.hasGyro, recapGyro: p.recapGyro,
          recapCanvas: false, recapCanvasReady: false,
          recapStages: report.stages.map(stage => ({ ...stage, result: formatMs(stage.stepMs) })),
          recapSummary: { moves: report.summary.stm, tps: report.summary.tps.toFixed(2), fluency: report.summary.fluency },
          recapScramble: report.scramble, recapAlgorithm: report.algorithm,
        });
        if (timerEventNxnSize(solve.event) === 3 && p.createSelectorQuery) {
          p.setData({ recapCanvas: true }, () => {
            if (!current()) return;
            const unavailable = () => {
              if (!current()) return;
              p.recapCube = undefined;
              p.setData({ recapCanvas: false, recapCanvasReady: false });
              showRecapFrame(p, report.seek(p.recapIndex ?? 0));
            };
            void mountNativeTimerCubeView({ createSelectorQuery: p.createSelectorQuery!.bind(p) }, '#nt-recap-canvas', unavailable)
              .then(view => {
                if (!current()) { view?.dispose(); return; }
                if (!view) { unavailable(); return; }
                p.recapCube = view;
                const visibleIndex = Number((this.data.recapFrame as { index?: number })?.index ?? 0);
                showRecapFrame(p, report.seek(visibleIndex));
                p.setData({ recapCanvasReady: true });
              }, unavailable);
          });
        }
      } catch { if (current()) this.setData({ formError: copy().solverUnavailable }); }
      finally { if (current()) this.setData({ recapLoading: false }); }
    },
    seekRecap(e: WechatMiniprogram.SliderChange) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'recap' || !p.recap) return;
      if (p.recapAnimation) clearInterval(p.recapAnimation);
      p.recapAnimation = undefined;
      showRecapFrame(p, p.recap.seek(e.detail.value));
      this.setData({ recapPlaying: false });
    },
    seekRecapRow(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, index = Number(e.currentTarget.dataset.index);
      if (p.sheet !== 'recap' || !p.recap || !Number.isInteger(index) || index < 0 || index >= p.recap.rows.length) return;
      if (p.recapAnimation) clearInterval(p.recapAnimation);
      p.recapAnimation = undefined;
      showRecapFrame(p, p.recap.seekRaw(index));
      this.setData({ recapPlaying: false });
    },
    toggleRecapPlayback() {
      const p = this as unknown as NativePage, report = p.recap;
      if (p.sheet !== 'recap' || !report) return;
      if (p.recapAnimation) {
        clearInterval(p.recapAnimation); p.recapAnimation = undefined; this.setData({ recapPlaying: false }); return;
      }
      const at = Number((this.data.recapFrame as { timeMs?: number } | null)?.timeMs ?? 0);
      const initial = at >= report.endMs ? 0 : at, start = Date.now();
      showRecapFrame(p, report.advance(initial));
      this.setData({ recapPlaying: true });
      p.recapAnimation = setInterval(() => {
        const frame = report.advance(initial + Date.now() - start);
        showRecapFrame(p, frame, true);
        this.setData({ recapPlaying: frame.playing });
        if (!frame.playing) { clearInterval(p.recapAnimation); p.recapAnimation = undefined; }
      }, 35);
    },
    toggleRecapGyro(e: WechatMiniprogram.SwitchChange) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'recap' || !p.recapCube || !p.recap?.hasGyro) return;
      p.recapGyro = e.detail.value;
      this.setData({ recapGyro: p.recapGyro });
      if (p.recapGyro) {
        const at = Number((this.data.recapFrame as { timeMs?: number } | null)?.timeMs ?? 0);
        const pose = p.recap.poseAt(at);
        if (pose) p.recapCube.pose(pose);
      } else p.recapCube.resetOrientation(null);
    },
    copyRecap(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage;
      if (p.sheet !== 'recap' || !p.recap) return;
      const data = e.currentTarget.dataset.kind === 'link' ? p.recap.shareUrl() : p.recap.copyText;
      miniProgramApi().setClipboardData({ data });
    },
    editResult(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer, id = String(e.currentTarget.dataset.id);
      if (!t || t.busy) return;
      const solve = t.records.find(s => s.id === id);
      if (!solve) return;
      p.resultId = id; showDetail(p);
    },
    changeDetailPenalty(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const penalty = TIMER_HISTORY_PENALTIES[Number(e.detail.value)];
      if (!t || t.busy || !p.resultId || !penalty) return;
      t.updatePenalty(p.resultId, penalty); showDetail(p); refresh(p, true);
    },
    resultAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer, id = p.resultId;
      if (!t || t.busy || !id) return;
      const action = TIMER_HISTORY_QUICK_ACTION_IDS.find(a => a === e.currentTarget.dataset.action);
      if (!action) return;
      const penalty = timerHistoryQuickActionPenalty(action);
      if (penalty) { t.updatePenalty(id, penalty); showDetail(p); }
      else if (action === 'history.quick.comment') {
          p.resultId = id; p.sheet = 'comment'; p.draft = t.records.find(s => s.id === id)?.comment ?? '';
          this.setData({ sheet: p.sheet, draft: p.draft, formError: '' });
      } else if (action === 'history.quick.copy-scramble') miniProgramApi().setClipboardData({ data: t.records.find(s => s.id === id)?.scramble ?? '' });
      else miniProgramApi().showModal({ title: tr({ en: 'Delete this result?', zh: '删除这条成绩？' }), content: tr({ en: 'This cannot be undone.', zh: '删除后无法恢复。' }), success: r => { if (r.confirm && p.active && !t.busy && p.resultId === id && p.sheet === 'detail') { t.remove(id); this.closeSheet(); refresh(p, true); } } });
      refresh(p, true);
    },
    moveResult(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || !p.resultId) return;
      const target = timerHistoryMoveTargets(t.sessions.sessions, t.sessions.activeSessionId)[Number(e.detail.value)];
      if (target && t.moveResult(p.resultId, target.id)) { this.closeSheet(); refresh(p, true); }
    },
    exportResults(format: 'csv' | 'cstimer' | 'speedstacks') {
      const t = (this as unknown as NativePage).nativeTimer;
      if (!t) return;
      const byEvent: Partial<Record<EventId, Solve[]>> = {};
      for (const solve of t.records) (byEvent[solve.event] ??= []).push(solve);
      const data = format === 'cstimer' ? exportTimerCstimerJson(byEvent).json : format === 'speedstacks' ? exportSpeedstacks(t.records) : exportTimerSolvesCsv(byEvent).csv;
      miniProgramApi().setClipboardData({ data });
    },
  };
}
