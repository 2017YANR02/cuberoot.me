import type { TimerSettingFieldId } from '@cuberoot/shared/timer';

/**
 * Current Mobile settings effects, not visual/device parity claims. All eight
 * fields persist through the shared schema, drive the runtime, and render
 * through the same TimerTimingSettingsSections component as Web.
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
] as const satisfies readonly TimerSettingFieldId[];

/**
 * No SettingsPanel field has completed shared-UI + interaction + visual/device
 * parity yet. Keeping this separate prevents a working callback from being
 * mistaken for full Web/Mobile parity.
 */
export const MOBILE_TIMER_SETTING_PARITY_FIELD_IDS = [] as const satisfies readonly TimerSettingFieldId[];
