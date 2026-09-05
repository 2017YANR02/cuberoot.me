import { isBldEvent, type EventId, type TimerScrambleSourceKind } from './types';

/**
 * Runtime-neutral contract for the settings surfaces currently reachable from
 * Web `/timer`.
 *
 * This is deliberately NOT a second persisted settings schema. `storagePath`
 * points at the existing host-owned setting (or is null for commands such as
 * backup/export), while the manifest locks the user-visible category, copy,
 * value shape, visibility, disabled state, and effect. Web is the product fact
 * source during the migration; Mobile registers only effects it really ships.
 */

export interface TimerSettingCopy {
  en: string;
  zh: string;
}

export const TIMER_SETTING_CATEGORY_IDS = [
  'timer',
  'smart-cube',
  'scramble',
  'training',
  'appearance',
  'sound',
  'data',
  'advanced',
] as const;

export type TimerSettingCategoryId = (typeof TIMER_SETTING_CATEGORY_IDS)[number];

export interface TimerSettingCategoryContract {
  id: TimerSettingCategoryId;
  label: TimerSettingCopy;
  description: TimerSettingCopy;
}

export const TIMER_SETTING_CATEGORY_CONTRACTS: readonly TimerSettingCategoryContract[] = [
  {
    id: 'timer',
    label: { en: 'Timing', zh: '计时' },
    description: { en: 'Start, inspection, and precision', zh: '启动、观察和成绩精度' },
  },
  {
    id: 'smart-cube',
    label: { en: 'Smart cube', zh: '智能魔方' },
    description: { en: 'Start behavior, live view, and orientation', zh: '起表、实况显示和姿态记录' },
  },
  {
    id: 'scramble',
    label: { en: 'Scrambles', zh: '打乱' },
    description: { en: 'Rules, orientation, and sync seed', zh: '生成规则、朝向和同步种子' },
  },
  {
    id: 'training',
    label: { en: 'Training', zh: '训练' },
    description: { en: 'Goals, splits, and round simulation', zh: '目标、分段和轮次模拟' },
  },
  {
    id: 'appearance',
    label: { en: 'Appearance', zh: '外观' },
    description: { en: 'Fonts, scramble display, and ranks', zh: '字体、打乱显示和排名' },
  },
  {
    id: 'sound',
    label: { en: 'Sound & rhythm', zh: '声音与节奏' },
    description: { en: 'Sounds, voice, and metronome', zh: '提示音、语音和节拍器' },
  },
  {
    id: 'data',
    label: { en: 'Data', zh: '数据' },
    description: { en: 'Backup, import, and export', zh: '备份、导入和导出' },
  },
  {
    id: 'advanced',
    label: { en: 'Advanced', zh: '高级' },
    description: { en: 'Shortcuts, sync seed, and reset', zh: '快捷键、同步种子和恢复默认' },
  },
];

export type TimerSettingValueKind =
  | 'boolean'
  | 'country'
  | 'duration'
  | 'enum'
  | 'file'
  | 'font'
  | 'integer'
  | 'keymap'
  | 'number-range'
  | 'orientation'
  | 'per-event-duration'
  | 'string-list'
  | 'text'
  | 'action';

export interface TimerSettingValueContract {
  kind: TimerSettingValueKind;
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
  step?: number;
}

export type TimerSettingVisibility =
  | 'always'
  | 'development-only'
  | 'event-not-222'
  | 'wca-source'
  | 'stage-split-event'
  | 'bld-event'
  | 'color-neutral-event'
  | 'rank-enabled-without-account-country'
  | 'signed-out'
  | 'signed-in'
  | 'round-enabled'
  | 'local-backups-expanded'
  | 'staged-import';

export type TimerSettingDisabledWhen =
  | 'never'
  | 'optimal-unavailable'
  | 'scramble-preview-hidden'
  | 'sounds-disabled'
  | 'sounds-disabled-or-voice-unavailable'
  | 'metronome-disabled'
  | 'sync-seed-draft-empty-or-unchanged'
  | 'sync-seed-off'
  | 'cloud-busy'
  | 'import-busy'
  | 'import-unresolved'
  | 'reanalyze-busy';

export interface TimerSettingFieldContract {
  id: string;
  category: TimerSettingCategoryId;
  copy: TimerSettingCopy;
  /** Existing Web/Mobile setting path. Null means a command, not a preference. */
  storagePath: string | null;
  value: TimerSettingValueContract;
  visibility: TimerSettingVisibility;
  disabledWhen: TimerSettingDisabledWhen;
  effect: string;
}

const bool = { kind: 'boolean' } as const;
const action = { kind: 'action' } as const;

export const TIMER_RANK_SCOPES = ['PR', 'NR', 'CR', 'WR'] as const;
export type TimerRankScope = typeof TIMER_RANK_SCOPES[number];

export function normalizeTimerRankScopes(value: unknown): TimerRankScope[] {
  return Array.isArray(value)
    ? TIMER_RANK_SCOPES.filter((scope) => value.includes(scope))
    : [...TIMER_RANK_SCOPES];
}

export const TIMER_SCRAMBLE_CLICK_ACTIONS = ['none', 'next', 'copy'] as const;

export type TimerScrambleClickAction = (typeof TIMER_SCRAMBLE_CLICK_ACTIONS)[number];

export const DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION: TimerScrambleClickAction = 'copy';

export interface TimerScramblePreviewSettings {
  showCubePreview: boolean;
  prefer3D: boolean;
}

export const DEFAULT_TIMER_SCRAMBLE_PREVIEW_SETTINGS: TimerScramblePreviewSettings = {
  showCubePreview: true,
  prefer3D: false,
};

function normalizedBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeTimerScramblePreviewSettings(value: {
  showCubePreview?: unknown;
  prefer3D?: unknown;
}): TimerScramblePreviewSettings {
  return {
    showCubePreview: normalizedBoolean(
      value.showCubePreview,
      DEFAULT_TIMER_SCRAMBLE_PREVIEW_SETTINGS.showCubePreview,
    ),
    prefer3D: normalizedBoolean(
      value.prefer3D,
      DEFAULT_TIMER_SCRAMBLE_PREVIEW_SETTINGS.prefer3D,
    ),
  };
}

export function timerScramblePreview3DDisabled(value: Pick<TimerScramblePreviewSettings, 'showCubePreview'>): boolean {
  return !value.showCubePreview;
}

export type TimerScrambleClickEffect = 'none' | 'next' | 'copy' | 'retry';

export const TIMER_SCRAMBLE_CLICK_TITLE_COPY: Record<TimerScrambleClickEffect, TimerSettingCopy> = {
  none: { en: 'Click disabled', zh: '点击无操作' },
  next: { en: 'Click to refresh', zh: '点击换一个打乱' },
  copy: { en: 'Click to copy', zh: '点击复制打乱' },
  retry: { en: 'Try again', zh: '再试一次' },
};

export function normalizeTimerScrambleClickAction(value: unknown): TimerScrambleClickAction {
  return TIMER_SCRAMBLE_CLICK_ACTIONS.find((action) => action === value)
    ?? DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION;
}

export function timerScrambleClickEffect(
  action: TimerScrambleClickAction,
  hasScramble: boolean,
  ready: boolean,
  retryable: boolean,
): TimerScrambleClickEffect {
  if (retryable) return 'retry';
  if (!ready) return 'none';
  if (action === 'next') return 'next';
  return action === 'copy' && hasScramble ? 'copy' : 'none';
}

/** Exact SettingsPanel order within each of the eight categories. */
export const TIMER_SETTING_FIELD_CONTRACTS = [
  // Timing
  { id: 'settings.timer.enabled', category: 'timer', copy: { en: 'Timing', zh: '计时' }, storagePath: 'timingEnabled', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-timing-enabled' },
  { id: 'settings.timer.inspection', category: 'timer', copy: { en: 'WCA inspection', zh: 'WCA 观察' }, storagePath: 'inspectionSec', value: { kind: 'enum', values: [0, 15] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-inspection-seconds' },
  { id: 'settings.timer.hold-threshold', category: 'timer', copy: { en: 'Hold threshold (ms)', zh: '按住阈值（毫秒）' }, storagePath: 'holdMs', value: { kind: 'integer', min: 100, max: 2000, step: 50 }, visibility: 'always', disabledWhen: 'never', effect: 'persist-hold-threshold' },
  { id: 'settings.timer.auto-session-for-event', category: 'timer', copy: { en: 'Match session when changing event', zh: '切换项目时匹配分组' }, storagePath: 'autoSessionForEvent', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-auto-session-for-event' },
  { id: 'settings.timer.auto-event-for-session', category: 'timer', copy: { en: 'Match event when changing session', zh: '切换分组时匹配项目' }, storagePath: 'autoEventForSession', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-auto-event-for-session' },
  { id: 'settings.timer.hide-running-time', category: 'timer', copy: { en: 'Hide time while running', zh: '隐藏运行中的时间' }, storagePath: 'hideTime', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-hide-running-time' },
  { id: 'settings.timer.running-precision', category: 'timer', copy: { en: 'Running precision', zh: '计时中精度' }, storagePath: 'runningPrecision', value: { kind: 'enum', values: [0, 1, 2, 3] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-running-precision' },
  { id: 'settings.timer.result-precision', category: 'timer', copy: { en: 'Result precision', zh: '成绩精度' }, storagePath: 'precision', value: { kind: 'enum', values: [2, 3] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-result-precision' },

  // Smart cube
  { id: 'settings.smart-cube.fake-cube', category: 'smart-cube', copy: { en: 'Fake cube', zh: '假魔方' }, storagePath: 'showDevFakeCube', value: bool, visibility: 'development-only', disabledWhen: 'never', effect: 'persist-development-fake-cube-controls' },
  { id: 'settings.smart-cube.auto-ready', category: 'smart-cube', copy: { en: 'Smart-cube auto-ready', zh: '智能魔方自动预备' }, storagePath: 'bluetoothAutoReady', value: { kind: 'enum', values: ['scrambled', 'off', 'still', 'double-flick'] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-smart-cube-auto-ready' },
  { id: 'settings.smart-cube.live-view', category: 'smart-cube', copy: { en: 'Live cube', zh: '实况魔方' }, storagePath: 'liveCubeView', value: { kind: 'enum', values: ['3d', 'q2look', 'net', '2d'] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-live-cube-view' },
  { id: 'settings.smart-cube.record-orientation', category: 'smart-cube', copy: { en: 'Record orientation for replay', zh: '录姿态用于回放' }, storagePath: 'recordGyro', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-record-orientation' },
  { id: 'settings.smart-cube.auto-recap', category: 'smart-cube', copy: { en: 'Open reconstruction after each solve', zh: '拧完后打开复盘' }, storagePath: 'autoRecap', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-auto-recap' },

  // Scrambles
  { id: 'settings.scramble.optimal', category: 'scramble', copy: { en: 'Optimal scramble', zh: '最优打乱' }, storagePath: 'wcaUseOptimal', value: bool, visibility: 'event-not-222', disabledWhen: 'optimal-unavailable', effect: 'persist-optimal-scramble' },
  { id: 'settings.scramble.auto-mark-wca', category: 'scramble', copy: { en: 'Auto-mark completed real scrambles', zh: '完成真题后自动打卡' }, storagePath: 'autoMarkWcaScramble', value: bool, visibility: 'wca-source', disabledWhen: 'never', effect: 'persist-auto-mark-wca' },
  { id: 'settings.scramble.pre-orientation', category: 'scramble', copy: { en: 'Pre-scramble', zh: '预打乱朝向' }, storagePath: 'preScr', value: { kind: 'orientation' }, visibility: 'always', disabledWhen: 'never', effect: 'persist-pre-scramble-orientation' },
  { id: 'settings.scramble.training-pre-orientation', category: 'scramble', copy: { en: 'Training pre-scramble', zh: '训练预打乱朝向' }, storagePath: 'preScrT', value: { kind: 'orientation' }, visibility: 'always', disabledWhen: 'never', effect: 'persist-training-pre-scramble-orientation' },
  { id: 'settings.scramble.color-neutral', category: 'scramble', copy: { en: 'Color neutral', zh: '颜色中立' }, storagePath: 'cnMode', value: { kind: 'enum', values: ['none', 'single', 'dual', 'six'] }, visibility: 'color-neutral-event', disabledWhen: 'never', effect: 'persist-color-neutral-mode' },

  // Training
  { id: 'settings.training.stage-splits', category: 'training', copy: { en: 'CFOP stage splits', zh: 'CFOP 分阶段计时' }, storagePath: 'multiStage', value: bool, visibility: 'stage-split-event', disabledWhen: 'never', effect: 'persist-stage-splits' },
  { id: 'settings.training.bld-memo-split', category: 'training', copy: { en: 'BLD memo split', zh: '盲拧记忆 / 执行分段' }, storagePath: 'bldMemo', value: bool, visibility: 'bld-event', disabledWhen: 'never', effect: 'persist-bld-memo-split' },
  { id: 'settings.training.target-time', category: 'training', copy: { en: 'Target time', zh: '目标时间' }, storagePath: 'targetMsByEvent', value: { kind: 'per-event-duration' }, visibility: 'always', disabledWhen: 'never', effect: 'persist-current-event-target' },
  { id: 'settings.training.daily-goal', category: 'training', copy: { en: 'Daily solve goal', zh: '每日目标次数' }, storagePath: 'dailySolveGoal', value: { kind: 'integer', min: 0, step: 1 }, visibility: 'always', disabledWhen: 'never', effect: 'persist-daily-solve-goal' },
  { id: 'settings.training.round-enabled', category: 'training', copy: { en: 'Round simulation', zh: '轮次模拟' }, storagePath: 'round.on', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-round-enabled' },
  { id: 'settings.training.round-format', category: 'training', copy: { en: 'Format', zh: '赛制' }, storagePath: 'round.format', value: { kind: 'enum', values: ['ao5', 'mo3', 'bo3', 'bo1'] }, visibility: 'round-enabled', disabledWhen: 'never', effect: 'persist-round-format' },
  { id: 'settings.training.round-cutoff', category: 'training', copy: { en: 'Cutoff', zh: '过关线' }, storagePath: 'round.cutoffMs', value: { kind: 'duration' }, visibility: 'round-enabled', disabledWhen: 'never', effect: 'persist-round-cutoff' },
  { id: 'settings.training.round-time-limit', category: 'training', copy: { en: 'Time limit', zh: '时限' }, storagePath: 'round.limitMs', value: { kind: 'duration' }, visibility: 'round-enabled', disabledWhen: 'never', effect: 'persist-round-time-limit' },
  { id: 'settings.training.round-cumulative', category: 'training', copy: { en: 'Time-limit basis', zh: '时限口径' }, storagePath: 'round.cumulative', value: { kind: 'enum', values: ['per-attempt', 'cumulative'] }, visibility: 'round-enabled', disabledWhen: 'never', effect: 'persist-round-time-limit-basis' },

  // Appearance
  { id: 'settings.appearance.timer-font', category: 'appearance', copy: { en: 'Timer font', zh: '计时器字体' }, storagePath: 'timerFont', value: { kind: 'font', values: ['lcd', 'mono', 'liberation', 'sans'] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-timer-font' },
  { id: 'settings.appearance.timer-font-scale', category: 'appearance', copy: { en: 'Timer font scale', zh: '计时器字号' }, storagePath: 'timerFontScale', value: { kind: 'number-range', min: 0.5, max: 2, step: 0.05 }, visibility: 'always', disabledWhen: 'never', effect: 'persist-timer-font-scale' },
  { id: 'settings.appearance.scramble-font', category: 'appearance', copy: { en: 'Scramble font', zh: '打乱字体' }, storagePath: 'scrambleFont', value: { kind: 'font', values: ['liberation', 'mono', 'sans'] }, visibility: 'always', disabledWhen: 'never', effect: 'persist-scramble-font' },
  { id: 'settings.appearance.scramble-font-scale', category: 'appearance', copy: { en: 'Scramble font scale', zh: '打乱字号' }, storagePath: 'scrambleFontScale', value: { kind: 'number-range', min: 0.6, max: 2.5, step: 0.05 }, visibility: 'always', disabledWhen: 'never', effect: 'persist-scramble-font-scale' },
  { id: 'settings.appearance.compact-scramble', category: 'appearance', copy: { en: 'Compact scramble', zh: '紧凑打乱' }, storagePath: 'compactScramble', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-compact-scramble' },
  { id: 'settings.appearance.scramble-image', category: 'appearance', copy: { en: 'Scramble image', zh: '打乱图' }, storagePath: 'showCubePreview', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-scramble-image' },
  { id: 'settings.appearance.cube-3d', category: 'appearance', copy: { en: '3D cube', zh: '3D 立方体' }, storagePath: 'prefer3D', value: bool, visibility: 'always', disabledWhen: 'scramble-preview-hidden', effect: 'persist-3d-preview' },
  { id: 'settings.appearance.scramble-click-action', category: 'appearance', copy: { en: 'Scramble click action', zh: '点击打乱条' }, storagePath: 'scrambleClickAction', value: { kind: 'enum', values: TIMER_SCRAMBLE_CLICK_ACTIONS }, visibility: 'always', disabledWhen: 'never', effect: 'persist-scramble-click-action' },
  { id: 'settings.appearance.hide-all-while-running', category: 'appearance', copy: { en: 'Hide all UI while running', zh: '运行中隐藏全部 UI' }, storagePath: 'hideAllUiWhileRunning', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-hide-all-ui' },
  { id: 'settings.appearance.rank-scopes', category: 'appearance', copy: { en: 'Ranks to show', zh: '排名范围' }, storagePath: 'rankScopes', value: { kind: 'string-list', values: TIMER_RANK_SCOPES }, visibility: 'always', disabledWhen: 'never', effect: 'persist-rank-scopes' },
  { id: 'settings.appearance.ranking-region', category: 'appearance', copy: { en: 'Ranking region', zh: '地区排名' }, storagePath: 'rankCountry', value: { kind: 'country' }, visibility: 'rank-enabled-without-account-country', disabledWhen: 'never', effect: 'persist-ranking-region-or-sign-in' },

  // Sound and rhythm
  { id: 'settings.sound.enabled', category: 'sound', copy: { en: 'Sounds', zh: '提示音' }, storagePath: 'soundsEnabled', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-sounds-and-warm-audio' },
  { id: 'settings.sound.volume', category: 'sound', copy: { en: 'Volume', zh: '音量' }, storagePath: 'volume', value: { kind: 'number-range', min: 0, max: 1, step: 0.05 }, visibility: 'always', disabledWhen: 'sounds-disabled', effect: 'persist-volume-or-preview-sound' },
  { id: 'settings.sound.voice-inspection', category: 'sound', copy: { en: 'Voice inspection', zh: '语音观察' }, storagePath: 'voiceInspection', value: { kind: 'enum', values: ['none', 'en-male', 'en-female', 'zh-male', 'zh-female'] }, visibility: 'always', disabledWhen: 'sounds-disabled-or-voice-unavailable', effect: 'persist-inspection-voice' },
  { id: 'settings.sound.metronome-enabled', category: 'sound', copy: { en: 'Enable metronome', zh: '开启节拍器' }, storagePath: 'metronomeOn', value: bool, visibility: 'always', disabledWhen: 'never', effect: 'persist-metronome-and-warm-audio' },
  { id: 'settings.sound.metronome-tempo', category: 'sound', copy: { en: 'Tempo', zh: '速度' }, storagePath: 'metronome.bpm', value: { kind: 'number-range', min: 30, max: 1800, step: 1 }, visibility: 'always', disabledWhen: 'metronome-disabled', effect: 'set-shared-metronome-bpm-or-tap-tempo' },
  { id: 'settings.sound.inspection-beeps', category: 'sound', copy: { en: 'Beep at (sec)', zh: '观察提示音（秒）' }, storagePath: 'inspectionBeepAt', value: { kind: 'string-list' }, visibility: 'always', disabledWhen: 'metronome-disabled', effect: 'persist-normalized-inspection-beep-seconds-or-preview' },

  // Data commands and the one persisted backup preference
  { id: 'settings.data.auto-backup-frequency', category: 'data', copy: { en: 'Back up every N solves', zh: '每完成 N 次自动备份' }, storagePath: 'autoBackupEvery', value: { kind: 'integer', min: 0, max: 30, step: 1 }, visibility: 'always', disabledWhen: 'never', effect: 'persist-auto-backup-frequency' },
  { id: 'settings.data.local-backup-create', category: 'data', copy: { en: 'Back up now', zh: '立即备份' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'create-local-backup' },
  { id: 'settings.data.local-backup-list', category: 'data', copy: { en: 'View backups', zh: '查看备份' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'toggle-local-backup-list' },
  { id: 'settings.data.local-backup-restore', category: 'data', copy: { en: 'Restore', zh: '恢复' }, storagePath: null, value: action, visibility: 'local-backups-expanded', disabledWhen: 'never', effect: 'confirm-and-restore-local-backup' },
  { id: 'settings.data.cloud-sign-in', category: 'data', copy: { en: 'Sign in to back up', zh: '登录后备份到云端' }, storagePath: null, value: action, visibility: 'signed-out', disabledWhen: 'never', effect: 'start-account-login' },
  { id: 'settings.data.cloud-upload', category: 'data', copy: { en: 'Upload to cloud', zh: '上传到云端' }, storagePath: null, value: action, visibility: 'signed-in', disabledWhen: 'cloud-busy', effect: 'replace-cloud-backup-with-local-database' },
  { id: 'settings.data.cloud-restore', category: 'data', copy: { en: 'Restore from cloud', zh: '从云端恢复' }, storagePath: null, value: action, visibility: 'signed-in', disabledWhen: 'cloud-busy', effect: 'confirm-and-replace-local-database-from-cloud' },
  { id: 'settings.data.import-file', category: 'data', copy: { en: 'One-click import', zh: '一键导入' }, storagePath: null, value: { kind: 'file' }, visibility: 'always', disabledWhen: 'import-busy', effect: 'inspect-and-import-cuberoot-cstimer-or-dctimer' },
  { id: 'settings.data.import-session-mapping', category: 'data', copy: { en: 'Choose event', zh: '选择项目' }, storagePath: null, value: { kind: 'enum' }, visibility: 'staged-import', disabledWhen: 'never', effect: 'map-unrecognized-import-session-event' },
  { id: 'settings.data.import-complete', category: 'data', copy: { en: 'Finish import', zh: '完成导入' }, storagePath: null, value: action, visibility: 'staged-import', disabledWhen: 'import-unresolved', effect: 'create-imported-sessions' },
  { id: 'settings.data.export-cuberoot', category: 'data', copy: { en: 'CubeRoot JSON', zh: 'CubeRoot JSON' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'download-cuberoot-json' },
  { id: 'settings.data.export-cstimer', category: 'data', copy: { en: 'csTimer JSON', zh: 'csTimer JSON' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'download-cstimer-json' },
  { id: 'settings.data.export-csv', category: 'data', copy: { en: 'CSV', zh: 'CSV' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'download-solves-csv' },
  { id: 'settings.data.export-speedstacks', category: 'data', copy: { en: 'Speedstacks', zh: 'Speedstacks' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'download-current-event-speedstacks' },
  { id: 'settings.data.reanalyze', category: 'data', copy: { en: 'Reanalyze stage data', zh: '重算分阶段数据' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'reanalyze-busy', effect: 'reanalyze-recorded-move-streams' },

  // Advanced
  { id: 'settings.advanced.sync-seed', category: 'advanced', copy: { en: 'Seed', zh: '种子' }, storagePath: 'syncSeed', value: { kind: 'text' }, visibility: 'always', disabledWhen: 'sync-seed-draft-empty-or-unchanged', effect: 'apply-or-clear-sync-seed-and-reset-counter' },
  { id: 'settings.advanced.sync-seed-counter', category: 'advanced', copy: { en: 'Current', zh: '当前' }, storagePath: 'syncSeedCounter', value: action, visibility: 'always', disabledWhen: 'sync-seed-off', effect: 'reset-sync-seed-counter' },
  { id: 'settings.advanced.keymap', category: 'advanced', copy: { en: 'Shortcut bindings', zh: '快捷键绑定' }, storagePath: 'keymap', value: { kind: 'keymap' }, visibility: 'always', disabledWhen: 'never', effect: 'capture-rebind-or-unbind-timer-action' },
  { id: 'settings.advanced.reset-keymap', category: 'advanced', copy: { en: 'Reset shortcuts to defaults', zh: '恢复默认快捷键' }, storagePath: 'keymap', value: action, visibility: 'always', disabledWhen: 'never', effect: 'clear-keymap-overrides' },
  { id: 'settings.advanced.reset-defaults', category: 'advanced', copy: { en: 'Reset defaults', zh: '恢复默认' }, storagePath: null, value: action, visibility: 'always', disabledWhen: 'never', effect: 'confirm-and-reset-all-timer-settings' },
] as const satisfies readonly TimerSettingFieldContract[];

export type TimerSettingFieldId = (typeof TIMER_SETTING_FIELD_CONTRACTS)[number]['id'];

export const TIMER_SETTING_FIELD_IDS: readonly TimerSettingFieldId[] =
  TIMER_SETTING_FIELD_CONTRACTS.map((field) => field.id);

const FIELD_BY_ID = new Map<TimerSettingFieldId, (typeof TIMER_SETTING_FIELD_CONTRACTS)[number]>(
  TIMER_SETTING_FIELD_CONTRACTS.map((field) => [field.id, field]),
);

export function timerSettingFieldContract(id: TimerSettingFieldId): (typeof TIMER_SETTING_FIELD_CONTRACTS)[number] {
  const field = FIELD_BY_ID.get(id);
  if (!field) throw new Error(`Unknown timer setting field: ${id}`);
  return field;
}

export interface TimerSettingFieldContext {
  event: EventId;
  source: TimerScrambleSourceKind;
  development: boolean;
  signedIn: boolean;
  optimalAvailable: boolean;
  roundEnabled: boolean;
  rankEnabled: boolean;
  rankAccountCountry?: string;
  showCubePreview: boolean;
  soundsEnabled: boolean;
  voiceAvailable: boolean;
  metronomeEnabled: boolean;
  localBackupsExpanded: boolean;
  stagedImport: boolean;
  importUnresolved: boolean;
  cloudBusy: boolean;
  importBusy: boolean;
  reanalyzeBusy: boolean;
  syncSeedDraft: string;
  activeSyncSeed: string | null;
}

export interface TimerSettingFieldState extends TimerSettingFieldContract {
  visible: boolean;
  disabled: boolean;
}

const STAGE_SPLIT_EVENTS: ReadonlySet<EventId> = new Set([
  '222', '333', '444', '555', '666', '777', '333oh', '333fm',
]);

export function timerSupportsStageSplits(event: EventId): boolean {
  return STAGE_SPLIT_EVENTS.has(event);
}

const COLOR_NEUTRAL_EVENTS: ReadonlySet<EventId> = new Set([
  '333', '333oh', '333fm', '333bld', '333ni', '333mbld',
]);

function settingVisible(
  visibility: TimerSettingVisibility,
  context: TimerSettingFieldContext,
): boolean {
  switch (visibility) {
    case 'always': return true;
    case 'development-only': return context.development;
    case 'event-not-222': return context.event !== '222';
    case 'wca-source': return context.source === 'wca';
    case 'stage-split-event': return timerSupportsStageSplits(context.event);
    case 'bld-event': return isBldEvent(context.event);
    case 'color-neutral-event': return COLOR_NEUTRAL_EVENTS.has(context.event);
    case 'rank-enabled-without-account-country': return context.rankEnabled && !/^[a-z]{2}$/i.test(context.rankAccountCountry?.trim() ?? '');
    case 'signed-out': return !context.signedIn;
    case 'signed-in': return context.signedIn;
    case 'round-enabled': return context.roundEnabled;
    case 'local-backups-expanded': return context.localBackupsExpanded;
    case 'staged-import': return context.stagedImport;
  }
}

function settingDisabled(
  disabledWhen: TimerSettingDisabledWhen,
  context: TimerSettingFieldContext,
): boolean {
  switch (disabledWhen) {
    case 'never': return false;
    case 'optimal-unavailable': return !context.optimalAvailable;
    case 'scramble-preview-hidden': return timerScramblePreview3DDisabled(context);
    case 'sounds-disabled': return !context.soundsEnabled;
    case 'sounds-disabled-or-voice-unavailable': return !context.soundsEnabled || !context.voiceAvailable;
    case 'metronome-disabled': return !context.metronomeEnabled;
    case 'sync-seed-draft-empty-or-unchanged':
      return context.syncSeedDraft === '' || context.syncSeedDraft === context.activeSyncSeed;
    case 'sync-seed-off': return context.activeSyncSeed === null;
    case 'cloud-busy': return context.cloudBusy;
    case 'import-busy': return context.importBusy;
    case 'import-unresolved': return context.importUnresolved;
    case 'reanalyze-busy': return context.reanalyzeBusy;
  }
}

/** Resolve every contract without dropping hidden fields, for exact-set audits. */
export function timerSettingFieldStates(
  context: TimerSettingFieldContext,
): readonly TimerSettingFieldState[] {
  return TIMER_SETTING_FIELD_CONTRACTS.map((field) => ({
    ...field,
    visible: settingVisible(field.visibility, context),
    disabled: settingDisabled(field.disabledWhen, context),
  }));
}

/**
 * The shared timing projection used by the Web settings schema. Mobile already
 * uses the same `inspectionSec` and `holdMs` names; the other fields remain
 * explicit parity gaps until its real settings UI and persistence consume them.
 */
export interface TimerTimingSettings {
  timingEnabled: boolean;
  inspectionSec: number;
  holdMs: number;
  autoSessionForEvent: boolean;
  autoEventForSession: boolean;
  hideTime: boolean;
  runningPrecision: 0 | 1 | 2 | 3;
  precision: 2 | 3;
}

export const DEFAULT_TIMER_TIMING_SETTINGS: TimerTimingSettings = {
  timingEnabled: true,
  inspectionSec: 0,
  holdMs: 550,
  autoSessionForEvent: false,
  autoEventForSession: false,
  hideTime: false,
  runningPrecision: 3,
  precision: 3,
};

export function normalizeTimerInspectionSec(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? 15 : 0;
}

export function normalizeTimerHoldMs(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value)
    ? value
    : DEFAULT_TIMER_TIMING_SETTINGS.holdMs;
  return Math.max(100, Math.min(2000, number || DEFAULT_TIMER_TIMING_SETTINGS.holdMs));
}

export function normalizeTimerRunningPrecision(value: unknown): 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3
    ? value
    : DEFAULT_TIMER_TIMING_SETTINGS.runningPrecision;
}

export function normalizeTimerResultPrecision(value: unknown): 2 | 3 {
  return value === 2 || value === 3 ? value : DEFAULT_TIMER_TIMING_SETTINGS.precision;
}

export function normalizeTimerTimingSettings(
  value: Partial<Record<keyof TimerTimingSettings, unknown>>,
): TimerTimingSettings {
  return {
    timingEnabled: normalizedBoolean(value.timingEnabled, DEFAULT_TIMER_TIMING_SETTINGS.timingEnabled),
    inspectionSec: normalizeTimerInspectionSec(value.inspectionSec),
    holdMs: normalizeTimerHoldMs(value.holdMs),
    autoSessionForEvent: normalizedBoolean(
      value.autoSessionForEvent,
      DEFAULT_TIMER_TIMING_SETTINGS.autoSessionForEvent,
    ),
    autoEventForSession: normalizedBoolean(
      value.autoEventForSession,
      DEFAULT_TIMER_TIMING_SETTINGS.autoEventForSession,
    ),
    hideTime: normalizedBoolean(value.hideTime, DEFAULT_TIMER_TIMING_SETTINGS.hideTime),
    runningPrecision: normalizeTimerRunningPrecision(value.runningPrecision),
    precision: normalizeTimerResultPrecision(value.precision),
  };
}
