import { describe, expect, it, vi } from 'vitest';
import {
  classifyTimerBootUserAgent,
  createTimerBootTelemetryRoutes,
  type TimerBootSummary,
  type TimerBootTelemetryStore,
} from '../src/routes/timer_boot_telemetry.js';

const WECHAT_CHROME_83_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; V1921A Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36 MicroMessenger/8.0.76.3141';
const ANDROID_CHROME_78_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; V1921A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.96 Mobile Safari/537.36';
const IOS_15_WECHAT_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.76';
const IOS_16_3_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 Version/16.3 Mobile/15E148 Safari/604.1';
const MODERN_CHROME_USER_AGENT = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';
const BOOT_ID = '11111111-1111-4111-8111-111111111111';

function emptySummary(days: number, now: number): TimerBootSummary {
  const counts = { attempts: 0, successes: 0, failures: 0, incomplete: 0, successRate: null, failureRate: null, incompleteRate: null };
  return {
    generatedAt: new Date(now).toISOString(),
    retentionDays: 90,
    windows: [7, 30, 90].map((windowDays) => ({ days: windowDays, ...counts })),
    breakdownDays: days,
    breakdowns: { supportStatus: [], engine: [], os: [], container: [] },
    failureKinds: [],
  };
}

function fakeStore() {
  const record = vi.fn<TimerBootTelemetryStore['record']>(async () => {});
  const cleanupExpired = vi.fn<TimerBootTelemetryStore['cleanupExpired']>(async () => {});
  const summarize = vi.fn<TimerBootTelemetryStore['summarize']>(async (days, now) => emptySummary(days, now));
  return { record, cleanupExpired, summarize } satisfies TimerBootTelemetryStore;
}

describe('timer boot runtime classification', () => {
  it('buckets the affected user agents without retaining their raw values', () => {
    expect(classifyTimerBootUserAgent(WECHAT_CHROME_83_USER_AGENT)).toEqual({
      engineFamily: 'chromium', engineMajor: 83,
      osFamily: 'android', osMajor: 10,
      container: 'wechat', supportStatus: 'below-baseline',
    });
    expect(classifyTimerBootUserAgent(ANDROID_CHROME_78_USER_AGENT)).toEqual({
      engineFamily: 'chromium', engineMajor: 78,
      osFamily: 'android', osMajor: 10,
      container: 'browser', supportStatus: 'below-baseline',
    });
    expect(classifyTimerBootUserAgent(IOS_15_WECHAT_USER_AGENT)).toEqual({
      engineFamily: 'webkit', engineMajor: null,
      osFamily: 'ios', osMajor: 15,
      container: 'wechat', supportStatus: 'below-baseline',
    });
    expect(classifyTimerBootUserAgent(IOS_16_3_USER_AGENT).supportStatus).toBe('below-baseline');
    expect(classifyTimerBootUserAgent(MODERN_CHROME_USER_AGENT).supportStatus).toBe('supported');
  });
});

describe('timer boot telemetry API', () => {
  it('accepts text/plain beacon events and derives privacy-safe dimensions on the server', async () => {
    let now = Date.UTC(2026, 7, 22);
    const store = fakeStore();
    const rateLimit = vi.fn();
    const routes = createTimerBootTelemetryRoutes({
      store,
      now: () => now,
      identifyIp: () => '203.0.113.1',
      rateLimit,
    });
    const post = (outcome: 'attempt' | 'success' | 'failure', failureKind: string | null = null) => routes.request('/timer/boot-events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': WECHAT_CHROME_83_USER_AGENT },
      body: JSON.stringify({ version: 1, bootId: BOOT_ID, outcome, path: '/zh/timer', failureKind }),
    });

    expect((await post('attempt')).status).toBe(204);
    expect((await post('success')).status).toBe(204);
    expect((await post('failure', 'chunk')).status).toBe(204);
    expect(store.cleanupExpired).toHaveBeenCalledTimes(1);
    expect(store.record).toHaveBeenNthCalledWith(1, {
      bootId: BOOT_ID,
      path: '/zh/timer',
      outcome: 'attempt',
      failureKind: null,
    }, {
      engineFamily: 'chromium', engineMajor: 83,
      osFamily: 'android', osMajor: 10,
      container: 'wechat', supportStatus: 'below-baseline',
    });
    expect(store.record.mock.calls[0]?.flat().join(' ')).not.toContain(WECHAT_CHROME_83_USER_AGENT);
    expect(rateLimit).toHaveBeenCalledTimes(3);

    now += 24 * 60 * 60 * 1000;
    expect((await post('attempt')).status).toBe(204);
    expect(store.cleanupExpired).toHaveBeenCalledTimes(2);
  });

  it('rejects identifiers, paths, outcome shapes, and any undeclared sensitive field', async () => {
    const store = fakeStore();
    const routes = createTimerBootTelemetryRoutes({ store, rateLimit: () => {} });
    const post = (body: object) => routes.request('/timer/boot-events', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body),
    });
    const base = { version: 1, bootId: BOOT_ID, outcome: 'attempt', path: '/timer', failureKind: null };

    expect((await post({ ...base, bootId: 'device-123' })).status).toBe(400);
    expect((await post({ ...base, path: '/paint' })).status).toBe(400);
    expect((await post({ ...base, outcome: 'failure' })).status).toBe(400);
    expect((await post({ ...base, failureKind: 'chunk' })).status).toBe(400);
    expect((await post({ ...base, userAgent: WECHAT_CHROME_83_USER_AGENT })).status).toBe(400);
    expect((await post({ ...base, error: "Unexpected token '='" })).status).toBe(400);
    expect(store.record).not.toHaveBeenCalled();
  });

  it('keeps summary reads admin-only and limits the aggregation windows', async () => {
    const store = fakeStore();
    const authorizeAdmin = vi.fn(async () => {});
    const now = Date.UTC(2026, 7, 22);
    const routes = createTimerBootTelemetryRoutes({ store, authorizeAdmin, now: () => now });

    const response = await routes.request('/timer/boot-stats?days=30');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(authorizeAdmin).toHaveBeenCalledTimes(1);
    expect(store.summarize).toHaveBeenCalledWith(30, now);
    expect(await response.json()).toMatchObject({ retentionDays: 90, breakdownDays: 30 });

    expect((await routes.request('/timer/boot-stats?days=14')).status).toBe(400);
    expect(store.summarize).toHaveBeenCalledTimes(1);
  });
});
