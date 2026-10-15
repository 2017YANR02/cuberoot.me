import type { QueryRunner } from '../db/connection.js';
import { notify, adminRecipients } from './notify.js';

export async function archiveAssistantDays(run: QueryRunner) {
  // The oldest calendar day becomes immutable before raw rows are deleted.
  // Never overwrite a finalized aggregate with a partially deleted day.
  await run(`INSERT INTO site_assistant_daily(day,metrics)
    SELECT (started_at AT TIME ZONE 'Asia/Shanghai')::date AS day,
      jsonb_build_object('requests',COUNT(*) FILTER(WHERE scope='chat'),
        'users',COUNT(DISTINCT user_id) FILTER(WHERE scope='chat'),
        'success',COUNT(*) FILTER(WHERE scope='chat' AND status='success'),
        'errors',COUNT(*) FILTER(WHERE scope='chat' AND status IN ('error','interrupted')),
        'feedback',COUNT(feedback),'helpful',COUNT(*) FILTER(WHERE feedback='helpful'),
        'clicked',COUNT(*) FILTER(WHERE clicked_actions<>'{}'::jsonb),
        'gross_cny',COALESCE(SUM((metrics->'cost'->>'grossCny')::numeric),0),
        'unpriced_calls',COALESCE(SUM((metrics->'cost'->>'unpricedCalls')::int),0),
        'avg_ms',AVG(duration_ms) FILTER(WHERE scope='chat' AND status='success'),
        'p95_ms',percentile_cont(0.95) WITHIN GROUP(ORDER BY duration_ms) FILTER(WHERE scope='chat' AND status='success'))
      FROM site_assistant_requests GROUP BY day
    ON CONFLICT(day) DO UPDATE SET metrics=EXCLUDED.metrics,updated_at=NOW()
      WHERE site_assistant_daily.day >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date - 89`);
}

export async function checkAssistantAlerts(run: QueryRunner, pending: number, deliver = notify) {
  const [window] = await run<{ n: number; errors: number; p95: number | null; missing: number }>(`SELECT COUNT(*)::int AS n,
    COUNT(*) FILTER(WHERE status IN ('error','interrupted'))::int AS errors,
    percentile_cont(0.95) WITHIN GROUP(ORDER BY duration_ms) FILTER(WHERE status='success') AS p95,
    COUNT(*) FILTER(WHERE (metrics->'cost'->>'unpricedCalls')::int>0)::int AS missing
    FROM site_assistant_requests WHERE started_at>NOW()-INTERVAL '15 minutes' AND scope='chat' AND status IN ('success','error','interrupted')`);
  const [cost] = await run<{ cost: number }>(`SELECT COALESCE(SUM((metrics->'cost'->>'grossCny')::numeric),0)::float8 AS cost FROM site_assistant_requests
    WHERE started_at >= ((NOW() AT TIME ZONE 'Asia/Shanghai')::date::timestamp AT TIME ZONE 'Asia/Shanghai')`);
  const [state] = await run<{ recent_failure: boolean }>(`SELECT last_failure_at>NOW()-INTERVAL '15 minutes' AS recent_failure FROM site_assistant_monitor_state WHERE id=TRUE`);
  const budget = Number(process.env.SITE_ASSISTANT_DAILY_COST_ALERT_CNY || 20);
  const checks = [
    { code: 'error_rate', active: window.n >= 10 && window.errors / window.n >= 0.2, details: { requests: window.n, errors: window.errors, threshold: 0.2 } },
    { code: 'latency', active: window.n >= 10 && (window.p95 ?? 0) > 30000, details: { p95: window.p95, thresholdMs: 30000 } },
    { code: 'recording', active: pending > 0 || !!state?.recent_failure, details: { pending } },
    { code: 'cost', active: Number.isFinite(budget) && budget > 0 && cost.cost >= budget, details: { grossCny: cost.cost, thresholdCny: budget } },
    { code: 'unpriced', active: window.missing >= 5, details: { requests: window.missing } },
  ];
  for (const check of checks) {
    await run(`INSERT INTO site_assistant_alerts(code,active,details) VALUES (?,?,?)
      ON CONFLICT(code) DO UPDATE SET active=EXCLUDED.active,details=EXCLUDED.details,checked_at=NOW(),
      opened_at=CASE WHEN NOT site_assistant_alerts.active AND EXCLUDED.active THEN NOW() ELSE site_assistant_alerts.opened_at END,
      resolved_at=CASE WHEN EXCLUDED.active THEN NULL WHEN site_assistant_alerts.active THEN NOW() ELSE site_assistant_alerts.resolved_at END,
      notified_at=CASE WHEN site_assistant_alerts.active<>EXCLUDED.active THEN NULL ELSE site_assistant_alerts.notified_at END`, [check.code, check.active, check.details]);
  }
  // Notification dedupe keys survive process restarts. Retry pending delivery on the next tick.
  const pendingAlerts = await run<{ code: string; active: boolean; opened_at: string; resolved_at: string | null; details: unknown }>(`SELECT * FROM site_assistant_alerts WHERE notified_at IS NULL AND (active OR resolved_at IS NOT NULL)`);
  for (const alert of pendingAlerts) {
    await deliver({ recipients: adminRecipients(), kind: 'assistant_alert', actorKey: 'system:assistant', actorName: '',
      title: 'CubeRoot AI', excerpt: `${alert.active ? '异常 / Alert' : '已恢复 / Recovered'}: ${alert.code}. ${JSON.stringify(alert.details)}`,
      link: '/admin#chat-monitoring', dedupeKey: `assistant:${alert.code}:${alert.active}:${new Date(alert.opened_at).toISOString()}:${alert.resolved_at ? new Date(alert.resolved_at).toISOString() : ''}` });
    await run('UPDATE site_assistant_alerts SET notified_at=NOW() WHERE code=? AND opened_at=? AND active=?', [alert.code, alert.opened_at, alert.active]);
  }
}
