import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('mobile timer compact statistics parity', () => {
  it('consumes the shared website panel and persists its shared rolling columns', () => {
    expect(app).toContain('TimerStatsPanel');
    expect(app).toContain('rollingColumns={store!.settings.statsRollingColumns}');
    expect(app).toContain('updateSettings({ statsRollingColumns })');
    expect(app).not.toContain('function MobileStatsPanel');
  });
});
