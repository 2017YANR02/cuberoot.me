import { describe, expect, it, vi } from 'vitest';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { TIMER_SETTING_CATEGORY_CONTRACTS, normalizeSmartCubeCorrectionLimit, normalizeTimerHoldMs } from '@cuberoot/shared/timer/settings-contract';
import type { TimerScrambleSourceKind } from '@cuberoot/shared/timer/types';
import type { NativeTimerEvent } from '../src/lib/native-timer';
import {
  nativeTimerSettingPatch,
  nativeTimerSettingsActionSheet,
  nativeTimerSettingsModel,
  nativeTimerRollingStatsPatch,
  nativeTimerTrainingPatch,
  confirmNativeTimerResetDefaults,
} from '../src/lib/native-timer-settings';

function fixture() {
  return {
    event: '333' as NativeTimerEvent,
    settings: createTimerStoreSettings('zh'),
    currentSource: 'wca' as TimerScrambleSourceKind,
    busy: false,
    solves: [],
  };
}

describe('native timer settings adapters', () => {
  it('gates manual stage and memo settings by project', () => {
    const timer = fixture();
    expect(nativeTimerSettingsModel(timer, {}, 'zh').training.splits).toMatchObject([{ key: 'multiStage', on: false }]);
    expect(nativeTimerTrainingPatch(timer, 'multiStage', undefined)).toEqual({ multiStage: true });
    expect(nativeTimerTrainingPatch(timer, 'bldMemo', undefined)).toBeUndefined();
    timer.event = '333bld';
    expect(nativeTimerSettingsModel(timer, {}, 'zh').training.splits).toMatchObject([{ key: 'bldMemo', on: true }]);
    expect(nativeTimerTrainingPatch(timer, 'bldMemo', undefined)).toEqual({ bldMemo: false });
    timer.event = 'sq1';
    expect(nativeTimerSettingsModel(timer, {}, 'zh').training.splits).toEqual([]);
    expect(nativeTimerTrainingPatch(timer, 'multiStage', undefined)).toBeUndefined();
  });

  it('commits training fields with the current project and supported round choices', () => {
    const timer = fixture();
    timer.settings.targetMsByEvent = { '222': 5000 };
    expect(nativeTimerTrainingPatch(timer, 'target', '1:02.50')).toEqual({ targetMsByEvent: { '222': 5000, '333': 62500 } });
    expect(nativeTimerTrainingPatch(timer, 'daily', '0')).toEqual({ dailySolveGoal: null });
    expect(nativeTimerTrainingPatch(timer, 'limit', '9')).toBeUndefined();
    timer.settings.round = nativeTimerTrainingPatch(timer, 'enabled', undefined)!.round!;
    timer.settings.round = nativeTimerTrainingPatch(timer, 'format', '1')!.round!;
    timer.settings.round = nativeTimerTrainingPatch(timer, 'cutoff', '10.01')!.round!;
    timer.settings.round = nativeTimerTrainingPatch(timer, 'basis', '1')!.round!;
    expect(timer.settings.round).toMatchObject({ on: true, format: 'mo3', cutoffMs: 10010, cumulative: true });
    expect(nativeTimerSettingsModel(timer, {}, 'zh').training).toMatchObject({
      formatIndex: 1, basisIndex: 1, inputs: [{ key: 'cutoff', value: '0:10.01' }, { key: 'limit', value: '' }],
    });
  });

  it('projects shared labels, supported field IDs and category order', () => {
    const model = nativeTimerSettingsModel(fixture(), {}, 'zh');
    expect(model.categories.map(category => category.id)).toEqual(
      TIMER_SETTING_CATEGORY_CONTRACTS.filter(category =>
        ['timer', 'smart-cube', 'scramble', 'training', 'appearance', 'data'].includes(category.id)).map(category => category.id),
    );
    expect(model.rows.filter(row => row.category === 'timer').map(row => row.id)).toEqual([
      'settings.timer.enabled',
      'settings.timer.inspection',
      'settings.timer.hold-threshold',
      'settings.timer.hide-running-time',
      'settings.timer.running-precision',
      'settings.timer.result-precision',
      'settings.timer.auto-session-for-event',
      'settings.timer.auto-event-for-session',
    ]);
    expect(model.rows.find(row => row.key === 'runningPrecision')).toMatchObject({
      label: '计时中精度',
      labels: ['x', 'x.x', 'x.xx', 'x.xxx'],
    });
    expect(model.rows.find(row => row.key === 'prefer3D')).toBeUndefined();
  });

  it('uses the shared category order and groups the gear panel controls and actions', () => {
    const model = nativeTimerSettingsModel(fixture(), {
      backupAvailable: true, soundAvailable: true, metronomeAvailable: true, resetDefaultsAvailable: true,
    }, 'zh');
    expect(model.categories.map(category => category.id)).toEqual(TIMER_SETTING_CATEGORY_CONTRACTS.map(category => category.id));
    expect(model.categories.find(category => category.id === 'training')).toMatchObject({ icon: 'trophy', hasTools: true });
    expect(model.sections.find(section => section.id === 'fonts')?.rows.map(row => row.key))
      .toEqual(['timerFont', 'timerFontScale', 'scrambleFont', 'scrambleFontScale']);
    expect(model.sections.filter(section => section.category === 'sound').map(section => section.id))
      .toEqual(['sound-effects', 'metronome', 'inspection-alerts']);
    expect(model.sections.find(section => section.id === 'local-backup')).toMatchObject({ title: '本机备份' });
    expect(model.commands.find(action => action.id === 'more.clear-event')).toMatchObject({ category: 'data', danger: true, disabled: true });
  });

  it('normalizes the editable controls and blocks mismatched or stale input', () => {
    const timer = fixture();
    expect(nativeTimerSettingPatch(timer, 'timer', 'inspectionSec', true)).toEqual({ inspectionSec: 15 });
    expect(nativeTimerSettingPatch(timer, 'timer', 'inspectionSec', false)).toEqual({ inspectionSec: 0 });
    expect(nativeTimerSettingPatch(timer, 'timer', 'holdMs', '125')).toEqual({ holdMs: normalizeTimerHoldMs(125) });
    expect(nativeTimerSettingPatch(timer, 'timer', 'holdMs', '4')).toEqual({ holdMs: 100 });
    expect(nativeTimerSettingPatch(timer, 'timer', 'holdMs', '')).toBeUndefined();
    expect(nativeTimerSettingPatch(timer, 'timer', 'holdMs', '125', { fixedHoldMs: 550 })).toBeUndefined();
    expect(nativeTimerSettingPatch(timer, 'timer', 'runningPrecision', 3)).toEqual({ runningPrecision: 3 });
    expect(nativeTimerSettingPatch(timer, 'timer', 'precision', 3)).toBeUndefined();
    expect(nativeTimerSettingPatch(timer, 'timer', 'showCubePreview', true)).toBeUndefined();
    expect(nativeTimerSettingPatch(timer, 'appearance', 'prefer3D', true)).toBeUndefined();
    expect(nativeTimerSettingPatch({ ...timer, busy: true }, 'timer', 'hideTime', true)).toBeUndefined();
  });

  it('shows the shared auto-recap preference only when the host can open the new result', () => {
    const timer = fixture();
    expect(nativeTimerSettingsModel(timer).rows.some(row => row.key === 'autoRecap')).toBe(false);
    const capability = { recapAvailable: true };
    expect(nativeTimerSettingsModel(timer, capability, 'zh').rows.find(row => row.key === 'autoRecap'))
      .toMatchObject({ label: '自动打开复盘', checked: true });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'autoRecap', false, capability)).toEqual({ autoRecap: false });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'autoRecap', false)).toBeUndefined();
  });

  it('normalizes the smart-cube correction threshold with the canonical bounds', () => {
    const timer = fixture();
    expect(nativeTimerSettingsModel(timer).rows.some(row => row.key === 'smartCubeCorrectionLimit')).toBe(false);
    const capability = { correctionAvailable: true };
    expect(nativeTimerSettingsModel(timer, capability, 'zh').rows.find(row => row.key === 'smartCubeCorrectionLimit'))
      .toMatchObject({ label: '打乱纠错阈值（步）', min: 0, max: 100, kind: 'integer' });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'smartCubeCorrectionLimit', '120', capability)).toEqual({ smartCubeCorrectionLimit: 100 });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'smartCubeCorrectionLimit', '', capability))
      .toEqual({ smartCubeCorrectionLimit: normalizeSmartCubeCorrectionLimit(undefined) });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'smartCubeCorrectionLimit', '0')).toBeUndefined();
  });

  it('connects gyroscope preferences and supported live views to the shared smart-cube section', () => {
    const timer = fixture();
    const capability = { smartCubeReadyAvailable: true, correctionAvailable: true, recapAvailable: true };
    const model = nativeTimerSettingsModel(timer, capability, 'zh');
    expect(model.sections.filter(section => section.category === 'smart-cube').map(section => section.title))
      .toEqual(['预备与起表', '实况与姿态', '结束后']);
    expect(model.sections.find(section => section.id === 'smart-cube-live')?.rows).toMatchObject([
      { key: 'gyroEnabled', kind: 'switch', checked: true },
      { key: 'autoCalibrateGyro', kind: 'switch', checked: true, hint: '在打乱完成倒数第二步时进行朝向重置' },
      { key: 'liveCubeView', kind: 'picker', index: 0, labels: ['three.js', 'q2Look', '展开图', '立体图'] },
    ]);
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'gyroEnabled', false, capability)).toEqual({ gyroEnabled: false });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'autoCalibrateGyro', false, capability)).toEqual({ autoCalibrateGyro: false });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'gyroEnabled', false)).toBeUndefined();
    expect(nativeTimerSettingPatch({ ...timer, busy: true }, 'smart-cube', 'autoCalibrateGyro', false, capability)).toBeUndefined();
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'liveCubeView', 1, capability)).toEqual({ liveCubeView: 'q2look' });
    expect(nativeTimerSettingPatch(timer, 'smart-cube', 'liveCubeView', 4, capability)).toBeUndefined();
    timer.settings.liveCubeView = 'twizzle';
    expect(nativeTimerSettingsModel(timer, capability, 'zh').rows.find(row => row.key === 'liveCubeView')).toMatchObject({ index: 0 });
    expect(timer.settings.liveCubeView).toBe('twizzle');
  });

  it('uses the shared event and source gate for optimal WCA', () => {
    const timer = fixture();
    expect(nativeTimerSettingPatch(timer, 'scramble', 'wcaUseOptimal', true)).toEqual({ wcaUseOptimal: true });
    expect(nativeTimerSettingsModel({ ...timer, event: '222' }).rows.find(row => row.key === 'wcaUseOptimal')).toBeUndefined();
    const randomTimer = { ...timer, currentSource: 'random' as const };
    expect(nativeTimerSettingsModel(randomTimer, {}, 'en').rows.find(row => row.key === 'wcaUseOptimal')).toMatchObject({
      disabled: true,
      checked: false,
      hint: 'Unavailable for this event or scramble source',
    });
    expect(nativeTimerSettingPatch(randomTimer, 'scramble', 'wcaUseOptimal', true)).toBeUndefined();
  });

  it('uses canonical event gating and localized color choices', () => {
    const timer = fixture();
    const training = { ...timer, event: 'oll' as const };
    const context = { colorNeutralAvailable: true };
    expect(nativeTimerSettingsModel(training).rows.find(row => row.key === 'cnMode')).toBeUndefined();
    expect(nativeTimerSettingsModel(timer, context).rows.find(row => row.key === 'cnMode')).toBeUndefined();
    expect(nativeTimerSettingsModel(training, context, 'zh').rows.find(row => row.key === 'cnMode'))
      .toMatchObject({ label: '颜色中立', labels: ['禁用', '单色', '双色', '六色'] });
    expect(nativeTimerSettingPatch(training, 'scramble', 'cnMode', 2, context)).toEqual({ cnMode: 'dual' });
    expect(nativeTimerSettingPatch(timer, 'scramble', 'cnMode', 2, context)).toBeUndefined();
    expect(nativeTimerSettingPatch({ ...timer, event: 'clock' }, 'scramble', 'cnMode', 2, context)).toBeUndefined();
  });

  it('keeps both rolling-statistics columns and shares replacement and custom range rules', () => {
    const timer = fixture();
    const context = { rollingStatsAvailable: true };
    expect(nativeTimerSettingsModel(timer).rollingStats).toBeUndefined();
    expect(nativeTimerSettingsModel(timer, context, 'zh').rollingStats).toMatchObject({
      heading: '成绩', columns: [{ key: 'ao5', label: '统计指标一' }, { key: 'ao12', label: '统计指标二' }],
      options: ['mo3', 'ao25', 'ao50', 'ao100', 'ao200', 'ao1000', 'ao10000'], min: 3, max: 100000,
    });
    expect(nativeTimerRollingStatsPatch(timer, context, 'ao5', 'preset', 'ao25')).toEqual({ statsRollingColumns: ['ao12', 'ao25'] });
    expect(nativeTimerRollingStatsPatch(timer, context, 'ao12', 'custom', ' 15.8 ')).toEqual({ statsRollingColumns: ['ao5', 'ao15'] });
    expect(nativeTimerRollingStatsPatch(timer, context, 'ao5', 'custom', '12')).toBeUndefined();
    expect(nativeTimerRollingStatsPatch(timer, context, 'ao12', 'custom', '100001')).toBeUndefined();
    expect(nativeTimerRollingStatsPatch(timer, context, 'ao25', 'preset', 'mo3')).toBeUndefined();
  });

  it('uses shared signing and ranking predicates before exposing commands and region choice', () => {
    const timer = fixture();
    expect(nativeTimerSettingsModel(timer).cloudCommands.map(row => row.command)).toEqual(['sign-in']);
    expect(nativeTimerSettingsModel(timer, { signedIn: true, cloudBusy: true }).cloudCommands).toMatchObject([
      { command: 'upload', disabled: true },
      { command: 'download', disabled: true },
    ]);
    expect(nativeTimerSettingsModel(timer).showRankCountry).toBe(true);
    expect(nativeTimerSettingsModel(timer, { rankAccountCountry: 'CN' }).showRankCountry).toBe(false);
    timer.settings.rankScopes = ['PR', 'WR'];
    expect(nativeTimerSettingsModel(timer).showRankCountry).toBe(false);
  });

  it('uses the same shared action grouping for the menu and actual dispatch', () => {
    const timer = fixture();
    const model = nativeTimerSettingsModel(timer);
    expect(model.actions.map(action => [action.id, action.category, action.sheet])).toEqual([
      ['more.stats-mobile', 'data', 'statistics'],
      ['more.manual-entry', 'data', 'manual'],
      ['more.replay', 'training', 'replay'],
      ['more.bulk', 'scramble', 'bulk'],
    ]);
    expect(nativeTimerSettingsActionSheet(timer, 'scramble', 'more.bulk')).toBe('bulk');
    expect(nativeTimerSettingsActionSheet(timer, 'data', 'more.bulk')).toBeUndefined();
    expect(nativeTimerSettingsActionSheet({ ...timer, busy: true }, 'scramble', 'more.bulk')).toBeUndefined();
  });

  it('exposes reset only when wired and guards its destructive confirmation', async () => {
    const timer = fixture();
    timer.settings.event = '222';
    timer.settings.theme = 'dark';
    timer.settings.holdMs = 700;
    expect(nativeTimerSettingsModel(timer).resetDefaults).toBeUndefined();
    const model = nativeTimerSettingsModel(timer, { resetDefaultsAvailable: true }, 'en');
    expect(model.categories.at(-1)?.id).toBe('advanced');
    expect(model.resetDefaults).toMatchObject({ label: 'Reset defaults', disabled: false });
    let modal!: WechatMiniprogram.ShowModalOption;
    const api = { showModal: (options: WechatMiniprogram.ShowModalOption) => { modal = options; } } as Pick<typeof wx, 'showModal'>;
    const guard = { isCurrent: () => true, reset: vi.fn(() => true) };
    const stale = confirmNativeTimerResetDefaults(timer, guard, 'en', api);
    expect(modal.content).toBe('Reset all settings to defaults?');
    timer.settings.holdMs = 800;
    const accept = { confirm: true, cancel: false, content: '', errMsg: 'showModal:ok' };
    modal.success?.(accept);
    await expect(stale).resolves.toBe(false);
    expect(guard.reset).not.toHaveBeenCalled();
    const fresh = confirmNativeTimerResetDefaults(timer, guard, 'en', api);
    modal.success?.(accept);
    await expect(fresh).resolves.toBe(true);
    expect(guard.reset).toHaveBeenCalledWith(expect.objectContaining({
      event: '222', theme: 'dark', language: 'zh', holdMs: createTimerStoreSettings().holdMs,
    }));
  });
});
