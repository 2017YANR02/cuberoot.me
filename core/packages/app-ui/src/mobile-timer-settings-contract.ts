import type { TimerSettingFieldId } from '@cuberoot/shared/timer';
import { TIMER_SCRAMBLE_PREVIEW_SETTING_FIELD_IDS } from '@cuberoot/timer-ui';

/**
 * Current Mobile settings effects, not visual/device parity claims. These
 * fields persist through the shared schema, drive the runtime, and render
 * through the same shared components as Web.
 */
export const MOBILE_TIMER_SETTING_EFFECT_FIELD_IDS = [
  'settings.timer.enabled',
  'settings.timer.inspection',
  'settings.timer.hold-threshold',
  'settings.timer.auto-session-for-event',
  'settings.timer.auto-event-for-session',
  'settings.timer.hide-running-time',
  'settings.timer.running-precision',
  'settings.timer.result-precision',
  'settings.training.stage-splits',
  'settings.training.bld-memo-split',
  'settings.scramble.optimal',
  'settings.scramble.auto-mark-wca',
  ...TIMER_SCRAMBLE_PREVIEW_SETTING_FIELD_IDS,
  'settings.appearance.scramble-click-action',
] as const satisfies readonly TimerSettingFieldId[];

/**
 * No SettingsPanel field has completed shared-UI + interaction + visual/device
 * parity yet. Keeping this separate prevents a working callback from being
 * mistaken for full Web/Mobile parity.
 */
export const MOBILE_TIMER_SETTING_PARITY_FIELD_IDS = [] as const satisfies readonly TimerSettingFieldId[];
