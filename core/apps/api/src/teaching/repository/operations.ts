import { query } from '../../db/connection.js';
import { type TeachingCreditUnit, type TeachingAuditEvent, isTeachingOrganizationRole, TEACHING_AUDIT_OUTCOMES, type TeachingAuditOutcome } from '@cuberoot/shared/teaching';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission } from '../access/organization.js';
import { iso } from '../serialization/common.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const operationsRepository: Pick<TeachingSaasRepository,
  'getOperationsOverview' | 'listAuditEvents'> = {
  async getOperationsOverview(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'operations.overview', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'operations:read');
      const boundsRows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (SELECT clock_timestamp() AS database_now)
         SELECT database_now::text AS database_now,
                ((database_now AT TIME ZONE ?)::date - 29)::text AS from_date,
                (database_now AT TIME ZONE ?)::date::text AS through_date,
                ((((database_now AT TIME ZONE ?)::date - 29)::timestamp AT TIME ZONE ?))::text AS starts_at,
                ((((database_now AT TIME ZONE ?)::date + 1)::timestamp AT TIME ZONE ?))::text AS ends_at
         FROM database_clock`,
        [access.timezone, access.timezone, access.timezone, access.timezone, access.timezone, access.timezone],
      );
      const bounds = boundsRows[0];
      if (!bounds) throw new Error('Unable to derive operations overview range');
      const databaseNow = String(bounds.database_now);
      const startsAt = String(bounds.starts_at);
      const endsAt = String(bounds.ends_at);
      const [sessionRows, attendanceRows, creditRows, packageRows, trainingRows, teacherRows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                  COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                  COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                  COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                  COUNT(*)::int AS total
           FROM teaching_sessions
           WHERE organization_id = ? AND starts_at >= ? AND starts_at < ?`,
          [access.id, startsAt, endsAt],
        ),
        query<Record<string, unknown>>(
          `SELECT COUNT(*) FILTER (WHERE ar.status = 'expected')::int AS expected,
                  COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present,
                  COUNT(*) FILTER (WHERE ar.status = 'late')::int AS late,
                  COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent,
                  COUNT(*) FILTER (WHERE ar.status = 'excused')::int AS excused,
                  COUNT(*)::int AS total
           FROM attendance_records ar
           JOIN teaching_sessions s
             ON s.organization_id = ar.organization_id AND s.id = ar.session_id
           WHERE ar.organization_id = ? AND s.starts_at >= ? AND s.starts_at < ?`,
          [access.id, startsAt, endsAt],
        ),
        query<Record<string, unknown>>(
          `SELECT sp.credit_unit, sp.credit_type, (-SUM(l.delta))::text AS amount
           FROM lesson_credit_ledger l
           JOIN teaching_sessions s
             ON s.organization_id = l.organization_id AND s.id = l.session_id
           JOIN student_packages sp
             ON sp.organization_id = l.organization_id AND sp.id = l.student_package_id
           WHERE l.organization_id = ? AND l.entry_type = 'consume'
             AND s.starts_at >= ? AND s.starts_at < ?
           GROUP BY sp.credit_unit, sp.credit_type
           HAVING SUM(l.delta) < 0
           ORDER BY sp.credit_unit, sp.credit_type`,
          [access.id, startsAt, endsAt],
        ),
        query<Record<string, unknown>>(
          `WITH balances AS (
             SELECT sp.id, sp.entitled_credits, sp.valid_until,
                    COALESCE(SUM(l.delta), 0)::bigint AS remaining_credits
             FROM student_packages sp
             LEFT JOIN lesson_credit_ledger l
               ON l.organization_id = sp.organization_id AND l.student_package_id = sp.id
             WHERE sp.organization_id = ? AND sp.lifecycle_status = 'active'
               AND sp.valid_from <= ?
               AND (sp.valid_until IS NULL OR sp.valid_until > ?)
             GROUP BY sp.id, sp.entitled_credits, sp.valid_until
           )
           SELECT COUNT(*)::int AS active,
                  COUNT(*) FILTER (WHERE remaining_credits * 5 <= entitled_credits)::int AS low_balance,
                  COUNT(*) FILTER (WHERE valid_until IS NOT NULL AND valid_until <= ?::timestamptz + INTERVAL '30 days')::int AS expiring_soon
           FROM balances`,
          [access.id, databaseNow, databaseNow, databaseNow],
        ),
        query<Record<string, unknown>>(
          `SELECT COUNT(DISTINCT a.id)::int AS assignments,
                  COUNT(t.id) FILTER (WHERE t.target_kind = 'student')::int AS student_targets,
                  COUNT(t.id) FILTER (WHERE t.target_kind = 'student' AND t.evidence_count > 0)::int AS targets_with_evidence
           FROM training_assignments a
           LEFT JOIN training_assignment_targets t
             ON t.organization_id = a.organization_id AND t.assignment_id = a.id
           WHERE a.organization_id = ? AND a.status IN ('published', 'closed')
             AND a.starts_at < ? AND (a.ends_at IS NULL OR a.ends_at > ?)`,
          [access.id, endsAt, startsAt],
        ),
        query<Record<string, unknown>>(
          `SELECT st.teacher_display_name_snapshot AS display_name,
                  COUNT(*)::int AS session_count,
                  COUNT(*) FILTER (WHERE s.status = 'completed')::int AS completed_session_count
           FROM session_teachers st
           JOIN teaching_sessions s
             ON s.organization_id = st.organization_id AND s.id = st.session_id
           WHERE st.organization_id = ? AND s.starts_at >= ? AND s.starts_at < ?
           GROUP BY st.teacher_user_id_snapshot, st.teacher_display_name_snapshot
           ORDER BY session_count DESC, completed_session_count DESC, display_name
           LIMIT 10`,
          [access.id, startsAt, endsAt],
        ),
      ]);
      const sessions = sessionRows[0] ?? {};
      const attendance = attendanceRows[0] ?? {};
      const packages = packageRows[0] ?? {};
      const training = trainingRows[0] ?? {};
      return {
        range: {
          fromDate: String(bounds.from_date),
          throughDate: String(bounds.through_date),
          timezone: access.timezone,
          days: 30,
        },
        sessions: {
          scheduled: Number(sessions.scheduled ?? 0), inProgress: Number(sessions.in_progress ?? 0),
          completed: Number(sessions.completed ?? 0), cancelled: Number(sessions.cancelled ?? 0),
          total: Number(sessions.total ?? 0),
        },
        attendance: {
          expected: Number(attendance.expected ?? 0), present: Number(attendance.present ?? 0),
          late: Number(attendance.late ?? 0), absent: Number(attendance.absent ?? 0),
          excused: Number(attendance.excused ?? 0), total: Number(attendance.total ?? 0),
        },
        creditConsumption: creditRows.map((row) => ({
          creditUnit: String(row.credit_unit) as TeachingCreditUnit,
          creditType: String(row.credit_type),
          amount: String(row.amount),
        })),
        packages: {
          active: Number(packages.active ?? 0), lowBalance: Number(packages.low_balance ?? 0),
          expiringSoon: Number(packages.expiring_soon ?? 0),
        },
        training: {
          assignments: Number(training.assignments ?? 0), studentTargets: Number(training.student_targets ?? 0),
          targetsWithEvidence: Number(training.targets_with_evidence ?? 0),
        },
        teacherLoad: teacherRows.map((row) => ({
          displayName: String(row.display_name), sessionCount: Number(row.session_count ?? 0),
          completedSessionCount: Number(row.completed_session_count ?? 0),
        })),
      };
    });
  },

  async listAuditEvents(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'audit.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'audit:read');
      const predicate = `organization_id = ?
        AND (?::text IS NULL OR outcome = ?)
        AND (?::text IS NULL
          OR strpos(lower(actor_display_name), lower(?)) > 0
          OR strpos(lower(action), lower(?)) > 0
          OR strpos(lower(entity_type), lower(?)) > 0
          OR strpos(lower(COALESCE(entity_id::text, '')), lower(?)) > 0
          OR strpos(lower(COALESCE(request_id, '')), lower(?)) > 0)`;
      const params = [
        access.id,
        filter.outcome,
        filter.outcome,
        filter.q,
        filter.q,
        filter.q,
        filter.q,
        filter.q,
        filter.q,
      ];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_audit_events WHERE ${predicate}`,
          params,
        ),
        query<Record<string, unknown>>(
          `SELECT id::text AS id, actor_display_name, actor_role, action, entity_type,
                  entity_id::text AS entity_id, outcome, request_id, created_at::text AS created_at
           FROM teaching_audit_events
           WHERE ${predicate}
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?`,
          [...params, pagination.pageSize, pagination.offset],
        ),
      ]);
      const items: TeachingAuditEvent[] = rows.map((row) => {
        const actorRole = row.actor_role === null ? null : String(row.actor_role);
        const outcome = String(row.outcome);
        if (actorRole !== null && !isTeachingOrganizationRole(actorRole)) {
          throw new Error('Invalid teaching audit actor role');
        }
        if (!TEACHING_AUDIT_OUTCOMES.includes(outcome as TeachingAuditOutcome)) {
          throw new Error('Invalid teaching audit outcome');
        }
        return {
          id: String(row.id),
          actorDisplayName: String(row.actor_display_name),
          actorRole,
          action: String(row.action),
          entityType: String(row.entity_type),
          entityId: row.entity_id === null ? null : String(row.entity_id),
          outcome: outcome as TeachingAuditOutcome,
          requestId: row.request_id === null ? null : String(row.request_id),
          createdAt: iso(row.created_at),
        };
      });
      return {
        items,
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },
};
