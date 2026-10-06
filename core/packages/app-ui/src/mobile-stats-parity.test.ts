import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('mobile timer compact statistics parity', () => {
  it('consumes the shared website panel and persists its shared rolling columns', () => {
    expect(app).toContain('<TimerStatisticsWorkspace');
    expect(app).toContain('labels={timerStatsPanelLabels(language)}');
    expect(app).toContain('event={activeEvent} solves={solves}');
    expect(app).toContain('rollingColumns={store!.settings.statsRollingColumns}');
    expect(app).toMatch(/onRollingColumnsChange=\{statsRollingColumns => updateSettings\(\{\s*statsRollingColumns\s*\}\)\}/);
    expect(app).not.toContain('function MobileStatsPanel');
  });
});
