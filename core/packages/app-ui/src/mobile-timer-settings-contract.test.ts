import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  TIMER_SETTING_CATEGORY_IDS,
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SETTING_FIELD_IDS,
} from '@cuberoot/shared/timer';

import {
  TIMER_TIMING_SETTING_FIELD_IDS,
} from '@cuberoot/timer-ui';

import {
  MOBILE_TIMER_SETTING_EFFECT_FIELD_IDS,
  MOBILE_TIMER_SETTING_PARITY_FIELD_IDS,
} from './mobile-timer-settings-contract';

describe('Mobile timer settings parity ledger', () => {
  it('records all eight real shared timing effects and no unverified device parity', () => {
    expect(MOBILE_TIMER_SETTING_EFFECT_FIELD_IDS).toEqual(TIMER_TIMING_SETTING_FIELD_IDS);
    expect(MOBILE_TIMER_SETTING_PARITY_FIELD_IDS).toEqual([]);
  });

  it('locks the canonical category gap counts so a new Web field fails here', () => {
    expect(TIMER_SETTING_FIELD_IDS).toHaveLength(64);
    expect(TIMER_SETTING_CATEGORY_IDS.map((category) => (
      TIMER_SETTING_FIELD_CONTRACTS.filter((field) => field.category === category).length
    ))).toEqual([8, 5, 5, 9, 11, 6, 15, 5]);

    const parity = new Set<string>(MOBILE_TIMER_SETTING_PARITY_FIELD_IDS);
    expect(TIMER_SETTING_CATEGORY_IDS.map((category) => (
      TIMER_SETTING_FIELD_CONTRACTS.filter((field) => (
        field.category === category
        && field.visibility !== 'development-only'
        && !parity.has(field.id)
      )).length
    ))).toEqual([8, 4, 5, 9, 11, 6, 15, 5]);
  });

  it('renders the shared eight-field UI and keeps its runtime effects wired', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<TimerTimingSettingsSections');
    expect(app).toContain('onChange={updateSettings}');
    expect(app).toContain('value={store!.settings}');
    expect(app).toContain('<TimerPillToggle');
    expect(app).toContain('formatTimerTimingDisplay({');
    expect(app).toContain('&& timingEnabled');
    expect(app).toContain('hideTime: hideRunningTime');
    expect(app).toContain('runningPrecision,');
    expect(app).toContain('precision: resultPrecision');
    expect(app).not.toContain('<option value="300">300 ms</option>');
  });
});
