import type { QueryRunner } from '../db/connection.js';
import type { AdminActivityRange } from './admin_activity.js';

export function registrationReport(run: QueryRunner, range: AdminActivityRange) {
  return run<{ day: string; count: number | string }>(`WITH days AS (
      SELECT generate_series(?::date, ?::date, INTERVAL '1 day')::date AS day
    )
    SELECT days.day, COUNT(app_users.id) AS count
    FROM days
    LEFT JOIN app_users
      ON app_users.created_at >= days.day AT TIME ZONE 'UTC'
      AND app_users.created_at < (days.day + 1) AT TIME ZONE 'UTC'
      AND app_users.merged_into_user_id IS NULL
    GROUP BY days.day
    ORDER BY days.day`, [range.from, range.to]);
}

export function membershipSummaryReport(run: QueryRunner) {
  return run<{ active_personal: number | string; active_enterprise: number | string }>(`SELECT
      COUNT(*) FILTER (
        WHERE (expires_at IS NULL OR expires_at > NOW())
          AND LEFT(plan_slug, 11) <> 'enterprise_'
      ) AS active_personal,
      COUNT(*) FILTER (
        WHERE (expires_at IS NULL OR expires_at > NOW())
          AND LEFT(plan_slug, 11) = 'enterprise_'
      ) AS active_enterprise
      FROM memberships`);
}
