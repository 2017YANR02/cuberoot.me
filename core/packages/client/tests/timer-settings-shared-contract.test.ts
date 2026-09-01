import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION,
  DEFAULT_TIMER_TIMING_SETTINGS,
  EVENTS,
  TIMER_SETTING_CATEGORY_CONTRACTS,
  TIMER_SETTING_CATEGORY_IDS,
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SETTING_FIELD_IDS,
  TIMER_SCRAMBLE_CLICK_ACTIONS,
  normalizeTimerScrambleClickAction,
  normalizeTimerTimingSettings,
  timerScrambleClickEffect,
  timerSettingFieldStates,
  type TimerSettingCategoryId,
  type TimerSettingFieldContext,
  type TimerSettingFieldId,
} from '@cuberoot/shared/timer';
import { TIMER_TIMING_SETTING_FIELD_IDS } from '@cuberoot/timer-ui';

const EXPECTED_FIELDS_BY_CATEGORY = {
  timer: [
    'settings.timer.enabled',
    'settings.timer.inspection',
    'settings.timer.hold-threshold',
    'settings.timer.auto-session-for-event',
    'settings.timer.auto-event-for-session',
    'settings.timer.hide-running-time',
    'settings.timer.running-precision',
    'settings.timer.result-precision',
  ],
  'smart-cube': [
    'settings.smart-cube.fake-cube',
    'settings.smart-cube.auto-ready',
    'settings.smart-cube.live-view',
    'settings.smart-cube.record-orientation',
    'settings.smart-cube.auto-recap',
  ],
  scramble: [
    'settings.scramble.optimal',
    'settings.scramble.auto-mark-wca',
    'settings.scramble.pre-orientation',
    'settings.scramble.training-pre-orientation',
    'settings.scramble.color-neutral',
  ],
  training: [
    'settings.training.stage-splits',
    'settings.training.bld-memo-split',
    'settings.training.target-time',
    'settings.training.daily-goal',
    'settings.training.round-enabled',
    'settings.training.round-format',
    'settings.training.round-cutoff',
    'settings.training.round-time-limit',
    'settings.training.round-cumulative',
  ],
  appearance: [
    'settings.appearance.timer-font',
    'settings.appearance.timer-font-scale',
    'settings.appearance.scramble-font',
    'settings.appearance.scramble-font-scale',
    'settings.appearance.compact-scramble',
    'settings.appearance.scramble-image',
    'settings.appearance.cube-3d',
    'settings.appearance.scramble-click-action',
    'settings.appearance.hide-all-while-running',
    'settings.appearance.show-ranks',
    'settings.appearance.ranking-region',
  ],
  sound: [
    'settings.sound.enabled',
    'settings.sound.volume',
    'settings.sound.voice-inspection',
    'settings.sound.metronome-enabled',
    'settings.sound.metronome-tempo',
    'settings.sound.inspection-beeps',
  ],
  data: [
    'settings.data.auto-backup-frequency',
    'settings.data.local-backup-create',
    'settings.data.local-backup-list',
    'settings.data.local-backup-restore',
    'settings.data.cloud-sign-in',
    'settings.data.cloud-upload',
    'settings.data.cloud-restore',
    'settings.data.import-file',
    'settings.data.import-session-mapping',
    'settings.data.import-complete',
    'settings.data.export-cuberoot',
    'settings.data.export-cstimer',
    'settings.data.export-csv',
    'settings.data.export-speedstacks',
    'settings.data.reanalyze',
  ],
  advanced: [
    'settings.advanced.sync-seed',
    'settings.advanced.sync-seed-counter',
    'settings.advanced.keymap',
    'settings.advanced.reset-keymap',
    'settings.advanced.reset-defaults',
  ],
} as const satisfies Record<TimerSettingCategoryId, readonly TimerSettingFieldId[]>;

const BASE_CONTEXT: TimerSettingFieldContext = {
  event: '333',
  source: 'wca',
  development: true,
  signedIn: false,
  optimalAvailable: true,
  roundEnabled: false,
  rankEnabled: true,
  showCubePreview: true,
  soundsEnabled: true,
  voiceAvailable: true,
  metronomeEnabled: true,
  localBackupsExpanded: false,
  stagedImport: false,
  importUnresolved: false,
  cloudBusy: false,
  importBusy: false,
  reanalyzeBusy: false,
  syncSeedDraft: 'shared-seed',
  activeSyncSeed: null,
};

describe('canonical timer settings surface manifest', () => {
  it('locks all eight categories, all 64 reachable fields/commands, and their order', () => {
    expect(TIMER_SETTING_CATEGORY_IDS).toEqual([
      'timer', 'smart-cube', 'scramble', 'training', 'appearance', 'sound', 'data', 'advanced',
    ]);
    expect(TIMER_SETTING_CATEGORY_CONTRACTS.map((category) => category.id))
      .toEqual(TIMER_SETTING_CATEGORY_IDS);
    expect(new Set(TIMER_SETTING_FIELD_IDS).size).toBe(64);
    expect(TIMER_SETTING_FIELD_IDS).toEqual(Object.values(EXPECTED_FIELDS_BY_CATEGORY).flat());
    for (const category of TIMER_SETTING_CATEGORY_IDS) {
      expect(TIMER_SETTING_FIELD_CONTRACTS
        .filter((field) => field.category === category)
        .map((field) => field.id))
        .toEqual(EXPECTED_FIELDS_BY_CATEGORY[category]);
    }
  });

  it('gives every category/field bilingual copy and every field a real effect/value policy', () => {
    for (const category of TIMER_SETTING_CATEGORY_CONTRACTS) {
      expect(category.label.en).not.toBe('');
      expect(category.label.zh).not.toBe('');
      expect(category.description.en).not.toBe('');
      expect(category.description.zh).not.toBe('');
    }
    for (const field of TIMER_SETTING_FIELD_CONTRACTS) {
      expect(field.copy.en).not.toBe('');
      expect(field.copy.zh).not.toBe('');
      expect(field.effect).not.toBe('');
      expect(field.value.kind).not.toBe('');
      if (field.value.kind === 'file') {
        expect(field.storagePath).toBeNull();
      }
    }
  });

  it('locks timing defaults, normalization, and invalid/legacy-shaped inputs', () => {
    expect(DEFAULT_TIMER_TIMING_SETTINGS).toEqual({
      timingEnabled: true,
      inspectionSec: 0,
      holdMs: 550,
      autoSessionForEvent: false,
      autoEventForSession: false,
      hideTime: false,
      runningPrecision: 3,
      precision: 3,
    });
    expect(normalizeTimerTimingSettings({})).toEqual(DEFAULT_TIMER_TIMING_SETTINGS);
    expect(normalizeTimerTimingSettings({
      timingEnabled: false,
      inspectionSec: 8,
      holdMs: 99,
      autoSessionForEvent: true,
      autoEventForSession: true,
      hideTime: true,
      runningPrecision: 0,
      precision: 2,
    })).toEqual({
      timingEnabled: false,
      inspectionSec: 15,
      holdMs: 100,
      autoSessionForEvent: true,
      autoEventForSession: true,
      hideTime: true,
      runningPrecision: 0,
      precision: 2,
    });
    expect(normalizeTimerTimingSettings({
      inspectionSec: Number.NaN,
      holdMs: Number.POSITIVE_INFINITY,
      runningPrecision: 9,
      precision: 1,
    })).toEqual(DEFAULT_TIMER_TIMING_SETTINGS);
  });

  it('locks the scramble click action options, default, and invalid fallback', () => {
    expect(TIMER_SCRAMBLE_CLICK_ACTIONS).toEqual(['none', 'next', 'copy']);
    expect(DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION).toBe('copy');
    expect(TIMER_SCRAMBLE_CLICK_ACTIONS.map(normalizeTimerScrambleClickAction))
      .toEqual(TIMER_SCRAMBLE_CLICK_ACTIONS);
    expect(normalizeTimerScrambleClickAction('invalid')).toBe('copy');
    expect(normalizeTimerScrambleClickAction(undefined)).toBe('copy');
    expect(timerScrambleClickEffect('none', true, true, false)).toBe('none');
    expect(timerScrambleClickEffect('copy', false, true, false)).toBe('none');
    expect(timerScrambleClickEffect('copy', true, true, false)).toBe('copy');
    expect(timerScrambleClickEffect('next', false, true, false)).toBe('next');
    expect(timerScrambleClickEffect('copy', true, false, false)).toBe('none');
    expect(timerScrambleClickEffect('next', false, false, false)).toBe('none');
    expect(timerScrambleClickEffect('none', false, false, true)).toBe('retry');
  });

  it('exhaustively resolves event/source visibility and contextual disabled states', () => {
    expect(timerSettingFieldStates({ ...BASE_CONTEXT, development: false })
      .find((field) => field.id === 'settings.smart-cube.fake-cube')?.visible).toBe(false);
    const stageEvents = new Set(['222', '333', '444', '555', '666', '777', '333oh', '333fm']);
    const bldEvents = new Set(['333bld', '333mbld', '333ni', '444bld', '555bld', '666bld', '777bld']);
    const colorNeutralEvents = new Set(['333', '333oh', '333fm', '333bld', '333ni', '333mbld']);
    for (const event of EVENTS.map((entry) => entry.id)) {
      const states = timerSettingFieldStates({ ...BASE_CONTEXT, event });
      const visible = (id: TimerSettingFieldId) => states.find((field) => field.id === id)?.visible;
      expect(visible('settings.scramble.optimal')).toBe(event !== '222');
      expect(visible('settings.training.stage-splits')).toBe(stageEvents.has(event));
      expect(visible('settings.training.bld-memo-split')).toBe(bldEvents.has(event));
      expect(visible('settings.scramble.color-neutral')).toBe(colorNeutralEvents.has(event));
    }

    const disabled = timerSettingFieldStates({
      ...BASE_CONTEXT,
      optimalAvailable: false,
      showCubePreview: false,
      soundsEnabled: false,
      voiceAvailable: false,
      metronomeEnabled: false,
      syncSeedDraft: '',
      cloudBusy: true,
      importBusy: true,
      importUnresolved: true,
      reanalyzeBusy: true,
    }).filter((field) => field.disabled).map((field) => field.id);
    expect(disabled).toEqual([
      'settings.scramble.optimal',
      'settings.appearance.cube-3d',
      'settings.sound.volume',
      'settings.sound.voice-inspection',
      'settings.sound.metronome-tempo',
      'settings.sound.inspection-beeps',
      'settings.data.cloud-upload',
      'settings.data.cloud-restore',
      'settings.data.import-file',
      'settings.data.import-complete',
      'settings.data.reanalyze',
      'settings.advanced.sync-seed',
      'settings.advanced.sync-seed-counter',
    ]);
  });
});

describe('Web SettingsPanel is a checked shared-contract consumer', () => {
  const panel = readFileSync('app/[lang]/timer/_components/SettingsPanel.tsx', 'utf8');
  const settings = readFileSync('app/[lang]/timer/_lib/settings/index.ts', 'utf8');

  it('references the exact canonical field set, so additions/removals cannot drift silently', () => {
    const panelIds = [...panel.matchAll(/settings\.[a-z0-9-]+\.[a-z0-9-]+/g)]
      .map((match) => match[0] as TimerSettingFieldId);
    if (panel.includes('<TimerScrambleClickActionSetting')) {
      panelIds.push('settings.appearance.scramble-click-action');
    }
    expect(panelIds.filter((id) => TIMER_TIMING_SETTING_FIELD_IDS.includes(id))).toEqual([]);
    expect([...new Set([...panelIds, ...TIMER_TIMING_SETTING_FIELD_IDS])].sort())
      .toEqual([...TIMER_SETTING_FIELD_IDS].sort());
  });

  it('keeps direct layout-only rows on a fixed whitelist instead of hiding new fields outside the manifest', () => {
    const directLabels = [...panel.matchAll(/<Row label=\{tr\(\{ zh: '([^']+)', en: '([^']+)'/g)]
      .map((match) => [match[1], match[2]]);
    expect(directLabels).toEqual([
      ['操作', 'Actions'],
      ['登录', 'Sign in'],
      ['操作', 'Actions'],
      ['导入', 'Import'],
      ['导出', 'Export'],
    ]);
    expect(panel).not.toContain('<BooleanRow');
  });

  it('derives categories/copy and the priority timing behavior from shared', () => {
    expect(panel).toContain('TIMER_SETTING_CATEGORY_CONTRACTS.map');
    expect(panel).toContain('timerSettingFieldContract(id).copy');
    expect(panel).toContain('timerSettingFieldStates({');
    expect(panel).toContain('<TimerTimingSettingsSections');
    expect(panel).toContain('<TimerScrambleClickActionSetting');
    expect(panel).toContain('renderBooleanControl={renderTimingBooleanControl}');
    expect(panel).toContain("settingState('settings.training.stage-splits').visible");
    expect(panel).toContain("settingState('settings.sound.volume').disabled");
    expect(panel).not.toContain('normalizeTimerHoldMs(Number(e.target.value))');
    expect(panel).not.toContain('normalizeTimerRunningPrecision(Number(e.target.value))');
    expect(panel).not.toContain('normalizeTimerResultPrecision(Number(e.target.value))');
    expect(panel).not.toContain("e.target.value as 'none' | 'next' | 'copy'");
    expect(settings).toContain('extends TimerTimingSettings');
    expect(settings).toContain('...DEFAULT_TIMER_TIMING_SETTINGS');
    expect(settings).toContain('scrambleClickAction: DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION');
    expect(settings).toContain('normalizeTimerScrambleClickAction(candidate.scrambleClickAction)');
    expect(settings).toContain('normalizeTimerTimingSettings');
    expect(settings).not.toMatch(/^\s*inspection:\s*number;/m);
  });

  it('maps every direct preference mutation to a registered storage path', () => {
    const registeredRoots = new Set(
      TIMER_SETTING_FIELD_CONTRACTS
        .flatMap((field) => field.storagePath === null ? [] : [field.storagePath.split('.')[0]!]),
    );
    const directMutationRoots = [...panel.matchAll(/updateSettings\(\{\s*([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1]!);
    expect(directMutationRoots.length).toBeGreaterThan(30);
    expect(directMutationRoots.filter((key) => !registeredRoots.has(key))).toEqual([]);
  });
});
