import {
  TIMER_SCRAMBLE_CLICK_TITLE_COPY,
  TIMER_COLOR_NEUTRAL_MODE_COPY,
  TIMER_RESET_SETTINGS_COPY,
  TIMER_SETTING_CATEGORY_CONTRACTS,
  TIMER_SMART_CUBE_AUTO_CALIBRATE_HINT,
  TIMER_SMART_CUBE_CORRECTION_HINT,
  TIMER_SMART_CUBE_LIVE_VIEW_COPY,
  TIMER_SMART_CUBE_LIVE_VIEW_LABEL,
  TIMER_SMART_CUBE_SECTION_COPY,
  normalizeSmartCubeCorrectionLimit,
  normalizeTimerHoldMs,
  timerSettingFieldContract,
  timerSettingFieldStates,
  timerSupportsStageSplits,
  type TimerScrambleClickAction,
  type TimerSettingCategoryId,
  type TimerSettingFieldState,
} from '@cuberoot/shared/timer/settings-contract';
import { TIMER_ATTEMPT_SPLIT_COPY } from '@cuberoot/shared/timer/attempt-splits';
import { isBldEvent } from '@cuberoot/shared/timer/types';
import {
  TIMER_MORE_ACTION_COPY,
  TIMER_SETTING_ACTION_CATEGORY,
  visibleTimerMoreActions,
  type TimerMoreActionId,
} from '@cuberoot/shared/timer/more-actions';
import { timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { CUBE_ORIENTATIONS, orientedFaceColors, type CubeOrientationOption } from '@cuberoot/shared/timer/cube-orientation';
import { CUBE_COLOR_NAMES, CUBE_FILL } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { timerWcaSupportsOptimal } from '@cuberoot/shared/timer/wca-difficulty';
import { normalizeTimerAutoBackupEvery } from '@cuberoot/shared/timer/backup-client';
import { TIMER_SMART_CUBE_AUTO_READY_COPY } from '@cuberoot/shared/timer/auto-ready';
import { formatTargetTime, parseDailySolveGoal, parseTargetTime, TIMER_TRAINING_COPY,
  timerRoundFormatChoices, timerTrainingTargetPatch } from '@cuberoot/shared/timer/training-settings';
import { TIMER_SYNC_SEED_COPY, resetTimerSyncSeed, timerSyncSeedCurrentCopy } from '@cuberoot/shared/timer/sync-seed';
import { TIMER_INSPECTION_ALERTS_COPY, TIMER_INSPECTION_VOICE_COPY, TIMER_SOUND_SETTINGS_COPY } from '@cuberoot/shared/timer/sound-feedback';
import { BPM_MAX, BPM_MIN, TIMER_METRONOME_COPY, bpmToTps, parseInspectionBeepInput } from '@cuberoot/shared/timer/metronome-settings';
import {
  MAX_AO_WINDOW, MIN_AO_WINDOW, TIMER_ROLLING_STAT_SETTINGS_COPY, customRollingStatKey,
  normalizeRollingStatColumns, replaceRollingStatColumn, rollingStatReplacementOptions, timerRollingStatChangeColumnCopy,
} from '@cuberoot/shared/timer/rolling-stats';
import { resetTimerStoreSettings, type TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { getMiniProgramLocale, tr, type MiniProgramLocale } from './i18n';
import type { NativeTimer } from './native-timer';
import { NATIVE_TIMER_LIVE_VIEWS, nativeTimerLiveView } from './native-timer-preview';
import { miniProgramApi } from './platform';

type SettingsTimer = Pick<NativeTimer, 'event' | 'settings' | 'busy' | 'currentSource' | 'solves'>;
type SettingOption = boolean | number | string;

export interface NativeTimerSettingsContext {
  signedIn?: boolean;
  rankAccountCountry?: string;
  cloudBusy?: boolean;
  backupAvailable?: boolean;
  smartCubeReadyAvailable?: boolean;
  liveAnalysisAvailable?: boolean;
  correctionAvailable?: boolean;
  recapAvailable?: boolean;
  resetDefaultsAvailable?: boolean;
  syncSeedAvailable?: boolean;
  syncSeedDraft?: string;
  soundAvailable?: boolean;
  voiceAvailable?: boolean;
  metronomeAvailable?: boolean;
  colorNeutralAvailable?: boolean;
  rollingStatsAvailable?: boolean;
  fixedHoldMs?: number;
}

// Every key here already has a consumer in the native timer. Visibility, copy,
// effects and bounds are owned by the shared field contract.
const controlKeys = new Set<string>([
  'timingEnabled', 'inspectionSec', 'holdMs', 'hideTime', 'runningPrecision', 'precision',
  'autoSessionForEvent', 'autoEventForSession', 'wcaUseOptimal',
  'timerFont', 'timerFontScale', 'scrambleFont', 'scrambleFontScale', 'compactScramble', 'showCubePreview',
  'scrambleClickAction', 'hideAllUiWhileRunning', 'autoBackupEvery', 'bluetoothAutoReady', 'autoRecap', 'smartCubeCorrectionLimit',
  'gyroEnabled', 'autoCalibrateGyro', 'liveCubeView', 'liveSolutionAnalysis', 'preScr',
  'soundsEnabled', 'volume', 'voiceInspection', 'inspectionBeepAt', 'metronomeOn', 'metronomeBpm', 'cnMode',
] satisfies readonly (keyof TimerStoreSettings)[]);

const controlAvailability: Partial<Record<string, keyof NativeTimerSettingsContext>> = {
  autoBackupEvery: 'backupAvailable',
  bluetoothAutoReady: 'smartCubeReadyAvailable',
  gyroEnabled: 'smartCubeReadyAvailable',
  autoCalibrateGyro: 'smartCubeReadyAvailable',
  liveCubeView: 'smartCubeReadyAvailable',
  liveSolutionAnalysis: 'liveAnalysisAvailable',
  smartCubeCorrectionLimit: 'correctionAvailable',
  autoRecap: 'recapAvailable',
  metronomeOn: 'metronomeAvailable',
  metronomeBpm: 'metronomeAvailable',
  soundsEnabled: 'soundAvailable',
  volume: 'soundAvailable',
  voiceInspection: 'soundAvailable',
  inspectionBeepAt: 'soundAvailable',
  cnMode: 'colorNeutralAvailable',
};

function hasSettingsControl(key: string, context: NativeTimerSettingsContext) {
  if (!controlKeys.has(key)) return false;
  const capability = controlAvailability[key];
  return capability === undefined || context[capability] === true;
}

function settingStorageKey(field: TimerSettingFieldState) {
  return field.storagePath === 'metronome.bpm' ? 'metronomeBpm' : field.storagePath ?? '';
}

export const nativeTimerSettingsCategories = TIMER_SETTING_CATEGORY_CONTRACTS.filter(category =>
  category.id === 'timer' || category.id === 'smart-cube' || category.id === 'scramble'
    || category.id === 'appearance' || category.id === 'data');

const toolSheets: Partial<Record<TimerMoreActionId, 'bulk' | 'manual' | 'statistics' | 'replay'>> = {
  'more.bulk': 'bulk',
  'more.replay': 'replay',
  'more.manual-entry': 'manual',
  'more.stats-mobile': 'statistics',
};

function settingFieldStates(timer: SettingsTimer, context: NativeTimerSettingsContext) {
  const settings = timer.settings;
  return timerSettingFieldStates({
    event: timer.event,
    source: timer.currentSource,
    development: false,
    signedIn: context.signedIn ?? false,
    optimalAvailable: timer.currentSource === 'wca' && timerWcaSupportsOptimal(timerWcaScrambleEventId(timer.event)),
    roundEnabled: settings.round.on,
    rankEnabled: settings.rankScopes.some(scope => scope === 'NR' || scope === 'CR'),
    rankAccountCountry: context.rankAccountCountry,
    showCubePreview: settings.showCubePreview,
    soundsEnabled: settings.soundsEnabled,
    voiceAvailable: context.voiceAvailable ?? false,
    metronomeEnabled: settings.metronomeOn,
    localBackupsExpanded: false,
    stagedImport: false,
    importUnresolved: false,
    cloudBusy: context.cloudBusy ?? false,
    importBusy: false,
    reanalyzeBusy: false,
    syncSeedDraft: context.syncSeedDraft ?? settings.syncSeed ?? '',
    activeSyncSeed: settings.syncSeed,
  });
}

function optionLabel(field: TimerSettingFieldState, option: SettingOption, language: MiniProgramLocale) {
  if (field.storagePath === 'cnMode') return tr(TIMER_COLOR_NEUTRAL_MODE_COPY[option as TimerStoreSettings['cnMode']], language);
  if (field.storagePath === 'voiceInspection') {
    return tr(TIMER_INSPECTION_VOICE_COPY[option as TimerStoreSettings['voiceInspection']], language);
  }
  if (field.storagePath === 'bluetoothAutoReady') {
    return tr(TIMER_SMART_CUBE_AUTO_READY_COPY[option as TimerStoreSettings['bluetoothAutoReady']], language);
  }
  if (field.storagePath === 'scrambleClickAction') {
    return tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY[option as TimerScrambleClickAction], language);
  }
  if (field.storagePath === 'runningPrecision' || field.storagePath === 'precision') {
    const decimals = Number(option);
    return decimals === 0 ? 'x' : `x.${'x'.repeat(decimals)}`;
  }
  return String(option);
}

function nativeTimerOrientationOption(option: CubeOrientationOption, language: MiniProgramLocale) {
  const faces = orientedFaceColors(option.value);
  return { ...option, top: CUBE_FILL[faces.U], front: CUBE_FILL[faces.F],
    colors: `${tr(CUBE_COLOR_NAMES[faces.U], language)} ${tr(CUBE_COLOR_NAMES[faces.F], language)}` };
}

export function nativeTimerOrientationOptions(value: string, language = getMiniProgramLocale()) {
  const orientations = CUBE_ORIENTATIONS.some(option => option.value === value)
    ? CUBE_ORIENTATIONS : [...CUBE_ORIENTATIONS, { value, label: value }];
  return orientations.map(option => ({ ...nativeTimerOrientationOption(option, language), selected: option.value === value }));
}

function settingsControl(
  field: TimerSettingFieldState,
  timer: SettingsTimer,
  context: NativeTimerSettingsContext,
  language: MiniProgramLocale,
) {
  const key = settingStorageKey(field) as keyof TimerStoreSettings;
  const current = timer.settings[key];
  const base = {
    key,
    id: field.id,
    category: field.category,
    label: tr(field.copy, language),
    disabled: field.disabled || timer.busy,
    ...(key === 'wcaUseOptimal' && field.disabled ? {
      hint: tr({ en: 'Unavailable for this event or scramble source', zh: '当前项目或出题来源不支持' }, language),
    } : {}),
    ...(key === 'voiceInspection' && !context.voiceAvailable ? { hint: tr(TIMER_SOUND_SETTINGS_COPY.voiceUnavailable, language) } : {}),
    ...(key === 'smartCubeCorrectionLimit' ? { hint: tr(TIMER_SMART_CUBE_CORRECTION_HINT, language) } : {}),
    ...(key === 'autoCalibrateGyro' ? { hint: tr(TIMER_SMART_CUBE_AUTO_CALIBRATE_HINT, language) } : {}),
  };
  if (key === 'liveCubeView') {
    const labels = NATIVE_TIMER_LIVE_VIEWS.map(view => tr(TIMER_SMART_CUBE_LIVE_VIEW_COPY[view], language));
    const index = NATIVE_TIMER_LIVE_VIEWS.indexOf(nativeTimerLiveView(timer.settings.liveCubeView));
    return { ...base, kind: 'picker' as const, ariaLabel: tr(TIMER_SMART_CUBE_LIVE_VIEW_LABEL, language), labels, index, value: labels[index] };
  }
  if (key === 'preScr') {
    const value = timer.settings.preScr;
    const option = CUBE_ORIENTATIONS.find(option => option.value === value) ?? { value, label: value };
    return { ...base, kind: 'orientation' as const, orientation: nativeTimerOrientationOption(option, language) };
  }
  if (key === 'inspectionBeepAt') {
    return { ...base, kind: 'text' as const, value: timer.settings.inspectionBeepAt.join(','),
      placeholder: tr(TIMER_SOUND_SETTINGS_COPY.beepPlaceholder, language),
      previewLabel: tr(TIMER_SOUND_SETTINGS_COPY.test, language), previewDisabled: timer.busy };
  }
  if (key === 'metronomeBpm') {
    const bpm = timer.settings.metronomeBpm;
    return { ...base, kind: 'number-range' as const, value: bpm, min: BPM_MIN, max: BPM_MAX, step: 1,
      valueText: `${bpmToTps(bpm).toFixed(1)} TPS · ${bpm} BPM`,
      tapLabel: tr(TIMER_METRONOME_COPY.tap, language), tapHint: tr(TIMER_METRONOME_COPY.tapHint, language) };
  }
  if (field.value.kind === 'boolean' || key === 'inspectionSec') {
    return {
      ...base,
      kind: 'switch' as const,
      checked: key === 'inspectionSec' ? Number(current) > 0
        : current === true && !(key === 'wcaUseOptimal' && field.disabled),
    };
  }
  if (field.value.kind === 'integer' || field.value.kind === 'number-range') {
    const fixed = key === 'holdMs' ? context.fixedHoldMs : undefined;
    return {
      ...base,
      kind: field.value.kind,
      disabled: base.disabled || fixed !== undefined,
      value: fixed ?? Number(current),
      valueText: field.value.kind === 'number-range' ? `${Math.round(Number(current) * 100)}%` : String(fixed ?? current),
      min: field.value.min!,
      max: field.value.max!,
      step: field.value.step!,
      ...(key === 'volume' ? { previewLabel: tr(TIMER_SOUND_SETTINGS_COPY.test, language), previewDisabled: timer.busy || !timer.settings.soundsEnabled } : {}),
    };
  }
  const values = field.value.values ?? [];
  const labels = values.map(value => optionLabel(field, value, language));
  const index = Math.max(0, values.indexOf(current as SettingOption));
  return { ...base, kind: 'picker' as const, labels, index, value: labels[index] };
}

function visibleSettingsMoreActions(timer: SettingsTimer) {
  return visibleTimerMoreActions({
    compactViewport: true,
    drillActive: false,
    event: timer.event,
    fullscreen: false,
    solveCount: timer.solves.length,
  });
}

export function nativeTimerSettingsActions(timer: SettingsTimer, language = getMiniProgramLocale()) {
  return visibleSettingsMoreActions(timer).flatMap(action => {
    const sheet = toolSheets[action.id];
    return sheet ? [{
      id: action.id,
      sheet,
      category: TIMER_SETTING_ACTION_CATEGORY[action.id],
      label: tr(TIMER_MORE_ACTION_COPY[action.id], language),
      disabled: action.disabled || timer.busy,
    }] : [];
  });
}

export function nativeTimerSettingsActionSheet(timer: SettingsTimer, category: unknown, actionId: unknown) {
  return nativeTimerSettingsActions(timer)
    .find(action => action.id === actionId && action.category === category && !action.disabled)?.sheet;
}

const moreCommands = {
  'more.language-mobile': 'toggle-language',
  'more.clear-event': 'clear-event',
} as const;

export function nativeTimerSettingsMoreCommands(timer: SettingsTimer, language = getMiniProgramLocale()) {
  return visibleSettingsMoreActions(timer).flatMap(action => {
    if (!Object.hasOwn(moreCommands, action.id)) return [];
    return [{
      id: action.id,
      command: moreCommands[action.id as keyof typeof moreCommands],
      category: TIMER_SETTING_ACTION_CATEGORY[action.id],
      label: tr(TIMER_MORE_ACTION_COPY[action.id], language),
      disabled: action.disabled || timer.busy,
      danger: action.danger,
    }];
  });
}

export function nativeTimerSettingsMoreCommand(timer: SettingsTimer, category: unknown, actionId: unknown) {
  return nativeTimerSettingsMoreCommands(timer)
    .find(action => action.id === actionId && action.category === category && !action.disabled)?.command;
}

const cloudCommands = {
  'settings.data.cloud-sign-in': 'sign-in',
  'settings.data.cloud-upload': 'upload',
  'settings.data.cloud-restore': 'download',
} as const;

const categoryIcons = { timer: 'timer', 'smart-cube': 'bluetooth', scramble: 'dices', training: 'trophy',
  appearance: 'palette', sound: 'volume-2', data: 'database', advanced: 'keyboard' } satisfies Record<TimerSettingCategoryId, string>;

const soloSettingsSections = {
  timer: [
    { id: 'timing', title: { en: 'Timing', zh: '计时' }, keys: ['timingEnabled', 'inspectionSec', 'holdMs'] },
    { id: 'display', title: { en: 'Display', zh: '显示' }, keys: ['hideTime', 'runningPrecision', 'precision'] },
    { id: 'events-sessions', title: { en: 'Events and sessions', zh: '项目与分组' }, keys: ['autoSessionForEvent', 'autoEventForSession'] },
  ],
  'smart-cube': [
    { id: 'smart-cube-ready', title: TIMER_SMART_CUBE_SECTION_COPY.ready, keys: ['bluetoothAutoReady', 'smartCubeCorrectionLimit'] },
    { id: 'smart-cube-live', title: TIMER_SMART_CUBE_SECTION_COPY.live, keys: ['gyroEnabled', 'autoCalibrateGyro', 'liveCubeView', 'liveSolutionAnalysis'] },
    { id: 'smart-cube-after-solve', title: TIMER_SMART_CUBE_SECTION_COPY.solved, keys: ['autoRecap'] },
  ],
  appearance: [
    { id: 'fonts', title: { en: 'Fonts', zh: '字体' }, keys: ['timerFont', 'timerFontScale', 'scrambleFont', 'scrambleFontScale'] },
    { id: 'display-interaction', title: { en: 'Display and interaction', zh: '显示与操作' }, keys: ['hideAllUiWhileRunning', 'scrambleClickAction', 'compactScramble', 'showCubePreview'] },
  ],
  sound: [
    { id: 'sound-effects', title: undefined, keys: ['soundsEnabled', 'volume', 'voiceInspection'] },
    { id: 'metronome', title: TIMER_METRONOME_COPY.heading, keys: ['metronomeOn', 'metronomeBpm'] },
    { id: 'inspection-alerts', title: TIMER_INSPECTION_ALERTS_COPY.title, keys: ['inspectionBeepAt'] },
  ],
  data: [{ id: 'local-backup', title: { en: 'Local backup', zh: '本机备份' }, keys: ['autoBackupEvery'] }],
} as const;

export async function confirmNativeTimerResetDefaults(
  timer: Pick<SettingsTimer, 'busy' | 'settings'>,
  guard: { isCurrent(): boolean; reset(settings: TimerStoreSettings): boolean },
  language = getMiniProgramLocale(),
  api: Pick<typeof wx, 'showModal'> = miniProgramApi(),
): Promise<boolean> {
  if (timer.busy || !guard.isCurrent()) return false;
  const before = JSON.stringify(timer.settings);
  const confirmed = await new Promise<boolean>(resolve => api.showModal({
    title: tr(timerSettingFieldContract('settings.advanced.reset-defaults').copy, language),
    content: tr(TIMER_RESET_SETTINGS_COPY.confirmation, language),
    success: result => resolve(result.confirm),
    fail: () => resolve(false),
  }));
  if (!confirmed || timer.busy || !guard.isCurrent() || before !== JSON.stringify(timer.settings)) return false;
  return guard.reset(resetTimerStoreSettings(timer.settings));
}

export function nativeTimerSettingsModel(
  timer: SettingsTimer,
  context: NativeTimerSettingsContext = {},
  language = getMiniProgramLocale(),
) {
  const fields = settingFieldStates(timer, context).filter(field => field.visible);
  const categories = TIMER_SETTING_CATEGORY_CONTRACTS.filter(category => nativeTimerSettingsCategories.includes(category)
    || (category.id === 'advanced' && (context.resetDefaultsAvailable || context.syncSeedAvailable))
    || (category.id === 'sound' && (context.soundAvailable || context.metronomeAvailable)) || category.id === 'training');
  const rows = fields.flatMap(field =>
    hasSettingsControl(settingStorageKey(field), context) ? [settingsControl(field, timer, context, language)] : []);
  const sections = categories.flatMap(category => {
    const categoryRows = rows.filter(row => row.category === category.id);
    const groups = category.id === 'timer' || category.id === 'appearance' || category.id === 'sound'
      || category.id === 'data' || category.id === 'smart-cube'
      ? soloSettingsSections[category.id] : [];
    const grouped = groups.map(group => ({
      id: group.id, category: category.id, title: group.title ? tr(group.title, language) : '',
      rows: group.keys.flatMap(key => categoryRows.filter(row => row.key === key)),
    }));
    const remaining = categoryRows.filter(row => !grouped.some(group => group.rows.includes(row)));
    return [...grouped, { id: category.id, category: category.id, title: tr(category.label, language), rows: remaining }]
      .filter(section => section.rows.length > 0);
  });
  const resetField = context.resetDefaultsAvailable ? fields.find(field => field.id === 'settings.advanced.reset-defaults') : undefined;
  const seedField = context.syncSeedAvailable ? fields.find(field => field.id === 'settings.advanced.sync-seed') : undefined;
  const counterField = context.syncSeedAvailable ? fields.find(field => field.id === 'settings.advanced.sync-seed-counter') : undefined;
  const actions = nativeTimerSettingsActions(timer, language);
  const commands = nativeTimerSettingsMoreCommands(timer, language);
  return {
    categories: categories.map(category => ({
      id: category.id,
      label: tr(category.label, language),
      icon: categoryIcons[category.id],
      hasTools: actions.some(action => action.category === category.id)
        || commands.some(action => action.category === category.id && !action.danger),
      description: tr(category.description, language),
      ...(category.id === 'appearance' ? { rankingsTitle: tr({ en: 'Result rankings', zh: '成绩排名' }, language) } : {}),
    })),
    copy: {
      categories: tr({ en: 'Settings categories', zh: '设置分类' }, language),
      close: tr({ en: 'Close settings', zh: '关闭设置' }, language),
      tools: tr({ en: 'Tools', zh: '工具' }, language),
      preview: tr({ en: 'Preview', zh: '预览' }, language),
      cloud: tr({ en: 'Cloud backup', zh: '云备份' }, language),
      export: tr({ en: 'Export', zh: '导出' }, language),
      inspectionAlertsHelpLabel: tr(TIMER_INSPECTION_ALERTS_COPY.helpLabel, language),
      inspectionAlertsHelp: tr(TIMER_INSPECTION_ALERTS_COPY.help, language),
    },
    rows,
    sections,
    training: nativeTimerTrainingSettings(timer, language),
    actions,
    commands,
    rollingStats: nativeTimerRollingStatsSettings(timer, context, language),
    metronome: context.metronomeAvailable ? {
      heading: tr(TIMER_METRONOME_COPY.heading, language), description: tr(TIMER_METRONOME_COPY.description, language),
    } : undefined,
    resetDefaults: resetField ? {
      id: resetField.id, label: tr(resetField.copy, language), disabled: resetField.disabled || timer.busy,
      description: tr(TIMER_RESET_SETTINGS_COPY.description, language),
    } : undefined,
    syncSeed: seedField && counterField ? {
      id: seedField.id,
      label: tr(seedField.copy, language),
      draft: context.syncSeedDraft ?? timer.settings.syncSeed ?? '',
      placeholder: tr(TIMER_SYNC_SEED_COPY.placeholder, language),
      clearInput: tr(TIMER_SYNC_SEED_COPY.clearInput, language),
      apply: tr(TIMER_SYNC_SEED_COPY.apply, language),
      disable: tr(TIMER_SYNC_SEED_COPY.disable, language),
      counterId: counterField.id,
      counterLabel: tr(counterField.copy, language),
      counterText: tr(timerSyncSeedCurrentCopy(timer.settings), language),
      resetCounter: tr(TIMER_SYNC_SEED_COPY.resetCounter, language),
      help: tr(TIMER_SYNC_SEED_COPY.description, language),
      disabled: timer.busy,
      applyDisabled: seedField.disabled || timer.busy,
      counterDisabled: counterField.disabled || timer.busy,
    } : undefined,
    showRankCountry: fields.some(field => field.id === 'settings.appearance.ranking-region'),
    cloudCommands: fields.flatMap(field => {
      if (!Object.hasOwn(cloudCommands, field.id)) return [];
      return [{
        id: field.id,
        command: cloudCommands[field.id as keyof typeof cloudCommands],
        label: tr(field.copy, language),
        disabled: field.disabled || timer.busy,
      }];
    }),
  };
}

const trainingBasis = ['per-attempt', 'cumulative'] as const;

function nativeTimerTrainingSettings(timer: SettingsTimer, language: MiniProgramLocale) {
  const s = timer.settings;
  const label = (suffix: 'stage-splits' | 'bld-memo-split' | 'target-time' | 'daily-goal' | 'round-enabled' | 'round-format' | 'round-cutoff'
    | 'round-time-limit' | 'round-cumulative') => tr(timerSettingFieldContract(`settings.training.${suffix}`).copy, language);
  const field = (key: string, caption: string, value: string, placeholder: string) => ({ key, label: caption, value, placeholder });
  const none = tr(TIMER_TRAINING_COPY.limitPlaceholder, language);
  const formats = timerRoundFormatChoices(s.round.format);
  const basis = trainingBasis.map(value => tr(value === 'cumulative' ? TIMER_TRAINING_COPY.cumulative : TIMER_TRAINING_COPY.perAttempt, language));
  const splits = [];
  if (timerSupportsStageSplits(timer.event)) splits.push({ key: 'multiStage', label: label('stage-splits'),
    on: s.multiStage, hint: tr(TIMER_ATTEMPT_SPLIT_COPY.touchStageHint, language) });
  if (isBldEvent(timer.event)) splits.push({ key: 'bldMemo', label: label('bld-memo-split'),
    on: s.bldMemo, hint: tr(TIMER_ATTEMPT_SPLIT_COPY.touchBldHint, language) });
  return {
    splits,
    goals: [
      field('target', label('target-time'), formatTargetTime(s.targetMsByEvent[timer.event]), tr(TIMER_TRAINING_COPY.targetPlaceholder, language)),
      field('daily', label('daily-goal'), s.dailySolveGoal === null ? '' : String(s.dailySolveGoal), tr(TIMER_TRAINING_COPY.goalPlaceholder, language)),
    ],
    inputs: [
      field('cutoff', label('round-cutoff'), formatTargetTime(s.round.cutoffMs), none),
      field('limit', label('round-time-limit'), formatTargetTime(s.round.limitMs), none),
    ],
    roundTitle: label('round-enabled'),
    roundOn: s.round.on,
    formatLabel: label('round-format'),
    formats: formats.map(option => tr(option.copy, language)),
    formatIndex: formats.findIndex(option => option.value === s.round.format),
    basisLabel: label('round-cumulative'),
    basis,
    basisIndex: Number(s.round.cumulative),
  };
}

export function nativeTimerTrainingPatch(timer: SettingsTimer, field: unknown, raw: unknown): Partial<TimerStoreSettings> | undefined {
  if (timer.busy) return;
  const { settings } = timer;
  if (field === 'multiStage' && timerSupportsStageSplits(timer.event)) return { multiStage: !settings.multiStage };
  if (field === 'bldMemo' && isBldEvent(timer.event)) return { bldMemo: !settings.bldMemo };
  if (field === 'enabled') return { round: { ...settings.round, on: !settings.round.on } };
  if (typeof raw !== 'string') return;
  if (field === 'target') return timerTrainingTargetPatch(settings, timer.event, parseTargetTime(raw));
  if (field === 'daily') return { dailySolveGoal: parseDailySolveGoal(raw) };
  if (!settings.round.on) return;
  if (field === 'cutoff') return { round: { ...settings.round, cutoffMs: parseTargetTime(raw) } };
  if (field === 'limit') return { round: { ...settings.round, limitMs: parseTargetTime(raw) } };
  if (field === 'basis') {
    const basis = trainingBasis[Number(raw)];
    if (basis) return { round: { ...settings.round, cumulative: basis === 'cumulative' } };
  }
  if (field === 'format') {
    const format = timerRoundFormatChoices(settings.round.format)[Number(raw)]?.value;
    if (format) return { round: { ...settings.round, format } };
  }
}

export function nativeTimerRollingStatsSettings(timer: SettingsTimer, context: NativeTimerSettingsContext, language = getMiniProgramLocale()) {
  if (!context.rollingStatsAvailable) return;
  const field = timerSettingFieldContract('settings.timer.rolling-statistics');
  const columns = normalizeRollingStatColumns(timer.settings.statsRollingColumns);
  const copy = TIMER_ROLLING_STAT_SETTINGS_COPY;
  return {
    id: field.id,
    heading: tr(copy.heading, language),
    disabled: timer.busy,
    columns: columns.map((key, index) => ({
      key,
      label: copy.column[language][index] ?? tr(field.copy, language),
      ariaLabel: tr(timerRollingStatChangeColumnCopy(key), language),
    })),
    options: rollingStatReplacementOptions(columns),
    min: MIN_AO_WINDOW,
    max: MAX_AO_WINDOW,
    customPlaceholder: tr(copy.customPlaceholder, language),
    customSize: tr(copy.customSize, language),
    clear: tr(copy.clear, language),
    replace: tr(copy.replace, language),
  };
}

export function nativeTimerRollingStatsPatch(
  timer: SettingsTimer,
  context: NativeTimerSettingsContext,
  column: unknown,
  kind: unknown,
  value: unknown,
): Partial<TimerStoreSettings> | undefined {
  if (!context.rollingStatsAvailable || timer.busy) return;
  const columns = normalizeRollingStatColumns(timer.settings.statsRollingColumns);
  const current = columns.find(key => key === column);
  if (!current) return;
  const replacement = kind === 'preset'
    ? rollingStatReplacementOptions(columns).find(key => key === value)
    : kind === 'custom' && typeof value === 'string' ? customRollingStatKey(value) : undefined;
  if (replacement === undefined || columns.includes(replacement)) return;
  return { statsRollingColumns: replaceRollingStatColumn(columns, current, replacement) };
}

export function nativeTimerSyncSeedPatch(timer: SettingsTimer, context: NativeTimerSettingsContext, action: unknown) {
  if (!context.syncSeedAvailable || timer.busy) return;
  const fields = settingFieldStates(timer, context);
  if (action === 'apply') {
    const seed = context.syncSeedDraft;
    const field = fields.find(row => row.id === 'settings.advanced.sync-seed');
    return field?.visible && !field.disabled && seed ? resetTimerSyncSeed(timer.settings, seed) : undefined;
  }
  if (action !== 'disable' && action !== 'reset-counter') return;
  const field = fields.find(row => row.id === 'settings.advanced.sync-seed-counter');
  if (!field?.visible || field.disabled) return;
  return resetTimerSyncSeed(timer.settings, action === 'disable' ? null : timer.settings.syncSeed);
}

/** Resolve the same guards during tap dispatch as when drawing the control. */
export function nativeTimerSettingPatch(
  timer: SettingsTimer,
  category: TimerSettingCategoryId,
  key: unknown,
  selection: unknown,
  context: NativeTimerSettingsContext = {},
): Partial<TimerStoreSettings> | undefined {
  if (timer.busy || typeof key !== 'string' || !hasSettingsControl(key, context)) return;
  const field = settingFieldStates(timer, context)
    .find(candidate => settingStorageKey(candidate) === key && candidate.category === category && candidate.visible && !candidate.disabled);
  if (!field) return;
  if (key === 'preScr') {
    return typeof selection === 'string' && CUBE_ORIENTATIONS.some(option => option.value === selection)
      ? { preScr: selection } : undefined;
  }
  if (key === 'inspectionBeepAt') return typeof selection === 'string' ? { inspectionBeepAt: parseInspectionBeepInput(selection) } : undefined;
  if (key === 'smartCubeCorrectionLimit') {
    return typeof selection === 'string' ? { smartCubeCorrectionLimit: normalizeSmartCubeCorrectionLimit(selection.trim() ? Number(selection) : undefined) } : undefined;
  }
  if (field.value.kind === 'boolean') return typeof selection === 'boolean' ? { [key]: selection } : undefined;
  if (key === 'inspectionSec') {
    const value = field.value.values?.find(value => typeof value === 'number' && (value > 0) === selection);
    return typeof value === 'number' ? { inspectionSec: value as TimerStoreSettings['inspectionSec'] } : undefined;
  }
  if (key === 'holdMs' || key === 'autoBackupEvery') {
    if ((key === 'holdMs' && context.fixedHoldMs !== undefined) || typeof selection !== 'string' || !selection.trim()) return;
    const value = Number(selection);
    if (!Number.isFinite(value)) return;
    return key === 'holdMs' ? { holdMs: normalizeTimerHoldMs(value) } : { autoBackupEvery: normalizeTimerAutoBackupEvery(value) };
  }
  if (field.value.kind === 'number-range') {
    return typeof selection === 'number' && Number.isFinite(selection)
      && selection >= field.value.min! && selection <= field.value.max! ? { [key]: selection } : undefined;
  }
  if (typeof selection !== 'number' || !Number.isSafeInteger(selection)) return;
  const value = key === 'liveCubeView' ? NATIVE_TIMER_LIVE_VIEWS[selection] : field.value.values?.[selection];
  return value === undefined ? undefined : { [key]: value };
}
