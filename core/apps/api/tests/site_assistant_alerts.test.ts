import { describe, expect, it, vi } from 'vitest';
import { checkAssistantAlerts } from '../src/utils/site_assistant_monitor_jobs.js';

vi.mock('../src/utils/notify.js', () => ({ notify: vi.fn(), adminRecipients: () => ['admin'] }));

async function check(n: number, errors: number, failureSpan: number, active = false) {
  const alerts = new Map<string, { code: string; active: boolean; details: unknown; opened_at: string; resolved_at: string | null }>();
  const run = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.startsWith('SELECT COUNT')) return [{ n, errors, failure_span: failureSpan, p95: 60000, missing: 10 }];
    if (sql.startsWith('SELECT COALESCE')) return [{ cost: 100 }];
    if (sql.includes('FROM site_assistant_monitor_state')) return [{ recent_failure: true }];
    if (sql === 'SELECT code,active FROM site_assistant_alerts') return [{ code: 'error_rate', active }];
    if (sql.startsWith('INSERT INTO site_assistant_alerts')) {
      const [code, nextActive, details] = params as [string, boolean, unknown];
      alerts.set(code, { code, active: nextActive, details, opened_at: '2026-11-04T00:00:00Z', resolved_at: active && !nextActive ? '2026-11-04T01:00:00Z' : null });
    }
    if (sql.startsWith('SELECT * FROM site_assistant_alerts')) {
      expect(sql).toContain("code='error_rate'");
      const alert = alerts.get('error_rate')!;
      return alert.active !== active ? [alert] : [];
    }
    return [];
  });
  const deliver = vi.fn();
  await checkAssistantAlerts(run as Parameters<typeof checkAssistantAlerts>[0], 3, deliver);
  return { alerts, deliver };
}

describe('assistant alert noise and recovery', () => {
  it('keeps brief failures and operational diagnostics out of the inbox', async () => {
    const { deliver, alerts } = await check(11, 11, 60);
    expect(deliver).not.toHaveBeenCalled();
    expect(alerts.get('recording')?.active).toBe(true);
    expect(alerts.get('unpriced')?.active).toBe(true);
  });
  it('reports sustained failures in plain language', async () => {
    const { deliver } = await check(11, 11, 300);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0].excerpt).toContain('11 次请求中 11 次失败');
  });
  it.each([[8, 8], [0, 0], [9, 0], [10, 1]])('does not claim recovery with %i requests and %i failures', async (n, errors) => {
    const { alerts, deliver } = await check(n, errors, 300, true);
    expect(alerts.get('error_rate')?.active).toBe(true);
    expect(deliver).not.toHaveBeenCalled();
  });
  it('reports recovery only with sufficient healthy traffic', async () => {
    const { alerts, deliver } = await check(10, 0, 0, true);
    expect(alerts.get('error_rate')?.active).toBe(false);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0].excerpt).toContain('10 次请求中 10 次成功');
  });
});
