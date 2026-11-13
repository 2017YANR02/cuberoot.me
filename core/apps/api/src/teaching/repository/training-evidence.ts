import { sql, transactionQuery, query } from '../../db/connection.js';
import { TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS } from '@cuberoot/shared/teaching';
import { withDeniedAccessAudit } from '../access/audit.js';
import { boundSelfStudentForUpdate } from '../access/learner.js';
import { accessForWrite, requirePermission } from '../access/organization.js';
import { hasOrganizationTrainingScope, ACTIVE_STUDENT_SCOPE_CTE } from '../access/student.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { trainingAssignmentEnvelope } from '../training/assignments.js';
import { type JsonValue, type JsonObject, type PageResult, type MutationResult } from '../types.js';
import { selfTrainingAssignmentToJson, selfTrainingEvidenceReceipt } from '../serialization/training.js';
import { consumeMutationAttempt, withRepeatableReadRetry } from '../transactions.js';
import { canonicalTrainingEvidencePayload, sha256, stableJson } from '../encoding.js';
import { SELF_TRAINING_EVIDENCE_BACKFILL_MS } from '../constants.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const trainingEvidenceRepository: Pick<TeachingSaasRepository,
  'getTrainingDailyBoard' | 'listSelfTrainingAssignments' | 'createSelfTrainingEvidence'> = {
  async getTrainingDailyBoard(actor, slug, assignmentId, requestedDate, learner, pagination, requestId, rankEvent = null) {
    return withDeniedAccessAudit(actor, slug, 'training.daily.read', requestId, async () => sql.begin(async tx => {
      let organizationId: string;
      let selfId: string | null = null;
      let scopedIds: string[] | null = null;
      if (learner) {
        const student = await boundSelfStudentForUpdate(tx, actor.userId, slug);
        organizationId = student.organizationId;
        selfId = student.studentId;
      } else {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        organizationId = access.id;
        if (!hasOrganizationTrainingScope(access.role)) {
          const scoped = await transactionQuery(tx)<{ id: string }>(`${ACTIVE_STUDENT_SCOPE_CTE} SELECT id FROM scoped_student_ids`, [organizationId, actor.userId, organizationId, organizationId]);
          scopedIds = scoped.map(row => String(row.id));
        }
      }
      const assignments = await tx`SELECT * FROM training_assignments WHERE organization_id = ${organizationId} AND id = ${assignmentId} AND schedule_kind = 'daily' AND status IN ('published', 'closed')`;
      if (!assignments.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
      const assignment = assignments[0];
      let groupId: string | null = null;
      if (selfId) {
        const targets = await tx`SELECT source_group_id FROM training_assignment_targets WHERE organization_id = ${organizationId} AND assignment_id = ${assignmentId} AND student_id = ${selfId} AND target_kind = 'student'`;
        if (!targets.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
        groupId = targets[0].source_group_id ? String(targets[0].source_group_id) : null;
        // Classmates remain visible only while the learner belongs to that active class.
        if (groupId) {
          const memberships = await tx`SELECT 1 FROM student_group_memberships m JOIN teaching_groups g ON g.organization_id = m.organization_id AND g.id = m.group_id AND g.status = 'active' WHERE m.organization_id = ${organizationId} AND m.group_id = ${groupId} AND m.student_id = ${selfId} AND m.effective_from <= clock_timestamp() AND (m.effective_to IS NULL OR m.effective_to > clock_timestamp())`;
          if (!memberships.length) groupId = null;
        }
      }
      const timezone = String(assignment.timezone_snapshot);
      const dates = await tx`SELECT (clock_timestamp() AT TIME ZONE ${timezone})::date AS today`;
      const today = String(dates[0].today).slice(0, 10);
      const date = requestedDate ?? today;
      const envelope = await trainingAssignmentEnvelope(tx, organizationId, assignmentId);
      const rows = await tx`
        WITH eligible AS (
          SELECT target.student_id, target.student_display_name_snapshot AS name
          FROM training_assignment_targets target
          JOIN student_profiles student ON student.organization_id = target.organization_id AND student.id = target.student_id AND student.status = 'active'
          WHERE target.organization_id = ${organizationId} AND target.assignment_id = ${assignmentId} AND target.target_kind = 'student'
            AND (${scopedIds === null} OR target.student_id = ANY(${scopedIds ?? []}::uuid[]))
            AND (${!learner} OR target.student_id = ${selfId}::uuid OR (
              ${groupId}::uuid IS NOT NULL AND target.source_group_id = ${groupId}::uuid
              AND EXISTS (SELECT 1 FROM student_group_memberships m WHERE m.organization_id = target.organization_id AND m.group_id = ${groupId}::uuid AND m.student_id = target.student_id AND m.effective_from <= clock_timestamp() AND (m.effective_to IS NULL OR m.effective_to > clock_timestamp()))
            ))
        ), evidence AS (
          SELECT e.* FROM training_evidence_assignments link
          JOIN training_evidence e ON e.organization_id = link.organization_id AND e.id = link.evidence_id AND e.student_id = link.student_id
          JOIN eligible ON eligible.student_id = e.student_id
          WHERE link.organization_id = ${organizationId} AND link.assignment_id = ${assignmentId}
            AND e.occurred_at >= (${date}::date::timestamp AT TIME ZONE ${timezone})
            AND e.occurred_at < ((${date}::date + 1)::timestamp AT TIME ZONE ${timezone})
        ), totals AS (
          SELECT eligible.student_id, eligible.name, COUNT(e.id)::int AS count,
            COALESCE(SUM(e.duration_ms), 0)::bigint AS duration_ms,
            COUNT(e.id) FILTER (WHERE e.success)::int AS successes,
            MIN(e.result_ms) FILTER (WHERE e.success AND e.result_ms > 0) AS best_ms,
            MIN(e.result_ms) FILTER (WHERE e.success AND e.result_ms > 0 AND e.source = 'timer' AND e.payload->>'event' = ${rankEvent}) AS rank_ms
          FROM eligible LEFT JOIN evidence e ON e.student_id = eligible.student_id
          GROUP BY eligible.student_id, eligible.name
        ), evaluated AS (
          SELECT totals.*, count >= ${Number(assignment.expected_count)} AND NOT EXISTS (
            SELECT 1 FROM training_assignment_goal_metrics goal
            WHERE goal.organization_id = ${organizationId} AND goal.assignment_id = ${assignmentId}
              AND NOT COALESCE(CASE goal.metric_key
                WHEN 'evidence_count' THEN totals.count >= goal.target_value
                WHEN 'duration_ms' THEN totals.duration_ms >= goal.target_value
                WHEN 'success_count' THEN totals.successes >= goal.target_value
                WHEN 'best_result_ms' THEN totals.best_ms <= goal.target_value
                ELSE false END, false)
          ) AS completed FROM totals
        ), ranked AS (
          SELECT evaluated.*, RANK() OVER (ORDER BY CASE WHEN ${rankEvent}::text IS NULL THEN count END DESC, rank_ms ASC NULLS LAST)::int AS rank FROM evaluated
        ), page_rows AS (
        SELECT ranked.*,
          COALESCE((SELECT jsonb_agg(summary ORDER BY summary.event) FROM (
            SELECT COALESCE(NULLIF(e.payload->>'event', ''), 'unknown') AS event,
              MIN(e.result_ms) FILTER (WHERE e.success AND e.result_ms > 0) AS best_ms,
              ROUND(AVG(e.result_ms) FILTER (WHERE e.success AND e.result_ms > 0)) AS mean_ms
            FROM evidence e WHERE e.student_id = ranked.student_id AND e.source = 'timer'
            GROUP BY e.payload->>'event'
          ) summary), '[]'::jsonb) AS results
        FROM ranked ORDER BY rank, name, student_id
        LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}
        ) SELECT page_rows.*, stats.total, stats.completed_total, stats.events
          FROM (SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE completed)::int AS completed_total,
            COALESCE((SELECT jsonb_agg(DISTINCT e.payload->>'event') FROM evidence e WHERE e.source = 'timer' AND e.success AND e.result_ms > 0 AND NULLIF(e.payload->>'event', '') IS NOT NULL), '[]'::jsonb) AS events FROM ranked) stats
          LEFT JOIN page_rows ON true ORDER BY page_rows.rank, page_rows.name, page_rows.student_id`;
      if (!learner && scopedIds !== null && !rows.some(row => row.student_id)) {
        // Do not disclose another teacher's assignment metadata through an empty board.
        const visible = await tx`SELECT 1 FROM training_assignment_targets WHERE organization_id = ${organizationId} AND assignment_id = ${assignmentId} AND student_id = ANY(${scopedIds}::uuid[]) LIMIT 1`;
        if (!visible.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
      }
      return {
        ...envelope, date, today, timezone, selfId, rankEvent, events: (rows[0]?.events ?? []) as JsonValue,
        total: Number(rows[0]?.total ?? 0), completedTotal: Number(rows[0]?.completed_total ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
        rows: rows.filter(row => row.student_id).map(row => ({ studentId: String(row.student_id), name: String(row.name), rank: (rankEvent ? row.rank_ms != null : Number(row.count) > 0) ? Number(row.rank) : null, count: Number(row.count), durationMs: Number(row.duration_ms), successes: Number(row.successes), completed: Boolean(row.completed), results: row.results as JsonValue })),
      } as JsonObject;
    }));
  },

  async listSelfTrainingAssignments(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.self.list', requestId, async () => {
      const page = await sql.begin(async (tx) => {
        const student = await boundSelfStudentForUpdate(tx, actor.userId, slug);
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM training_assignment_targets target
          JOIN training_assignments assignment
            ON assignment.organization_id = target.organization_id
           AND assignment.id = target.assignment_id
          WHERE target.organization_id = ${student.organizationId}
            AND target.student_id = ${student.studentId}
            AND target.target_kind = 'student'
            AND assignment.status IN ('published', 'closed')`;
        const rows = await tx`
          SELECT assignment.id AS assignment_id, assignment.organization_id,
                 assignment.template_version_id, assignment.title AS assignment_title,
                 assignment.instructions AS assignment_instructions,
                 assignment.status AS assignment_status, assignment.schedule_kind,
                 assignment.expected_count, assignment.timezone_snapshot,
                 assignment.starts_at, assignment.ends_at, assignment.published_at,
                 assignment.closed_at, assignment.created_at AS assignment_created_at,
                 assignment.updated_at AS assignment_updated_at,
                 target.id AS target_id, target.source_group_id, target.student_id,
                 target.student_display_name_snapshot, target.student_external_ref_snapshot,
                 target.evidence_count, target.first_evidence_at, target.last_evidence_at,
                 target.latest_review_revision, target.latest_review_status,
                 template.id AS template_id, template.name AS template_name,
                 version.version_number, version.title AS version_title,
                 version.instructions AS version_instructions, version.source, version.activity,
                 version.tool_config, version.published_at AS version_published_at,
                 COALESCE((
                   SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                     'id', goal.id,
                     'metricKey', goal.metric_key,
                     'operator', goal.operator,
                     'targetValue', goal.target_value
                   ) ORDER BY goal.metric_key)
                   FROM training_assignment_goal_metrics goal
                   WHERE goal.organization_id = assignment.organization_id
                     AND goal.assignment_id = assignment.id
                 ), '[]'::jsonb) AS goals
          FROM training_assignment_targets target
          JOIN training_assignments assignment
            ON assignment.organization_id = target.organization_id
           AND assignment.id = target.assignment_id
          JOIN training_template_versions version
            ON version.organization_id = assignment.organization_id
           AND version.id = assignment.template_version_id
          JOIN training_templates template
            ON template.organization_id = version.organization_id
           AND template.id = version.template_id
          WHERE target.organization_id = ${student.organizationId}
            AND target.student_id = ${student.studentId}
            AND target.target_kind = 'student'
            AND assignment.status IN ('published', 'closed')
          ORDER BY assignment.starts_at DESC, assignment.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => selfTrainingAssignmentToJson(row as Record<string, unknown>)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      });
      return page as PageResult;
    });
  },

  async createSelfTrainingEvidence(actor, slug, input, requestId) {
    const organizations = await query<Record<string, unknown>>(
      `SELECT id FROM organizations WHERE slug = ?`,
      [slug],
    );
    if (organizations.length) {
      await consumeMutationAttempt(
        actor.userId,
        `training-evidence:${String(organizations[0].id)}`,
        240,
        '1 minute',
      );
    }
    return withDeniedAccessAudit(actor, slug, 'training.evidence.self.create', requestId, async () => {
      const canonicalPayload = canonicalTrainingEvidencePayload(input);
      const payloadHash = sha256(stableJson(canonicalPayload));
      const assignmentIds = input.assignmentIds ?? [];
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const student = await boundSelfStudentForUpdate(tx, actor.userId, slug);
          const occurredAtMs = new Date(input.occurredAt).getTime();
          const databaseNowMs = new Date(student.databaseNow).getTime();
          if (occurredAtMs > databaseNowMs + TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS) {
            throw new TeachingApiException(
              'EVIDENCE_INVALID',
              400,
              'occurredAt cannot be more than five minutes after the database clock',
            );
          }
          const backfillFloor = Math.max(
            new Date(student.accountLinkedAt).getTime(),
            databaseNowMs - SELF_TRAINING_EVIDENCE_BACKFILL_MS,
          );
          if (occurredAtMs < backfillFloor) {
            throw new TeachingApiException(
              'EVIDENCE_INVALID',
              400,
              'occurredAt must follow account linking and stay within the 30-day self-report window',
            );
          }
          const relationSubject = sha256(stableJson({
            kind: 'training-evidence-student-source',
            studentId: student.studentId,
            source: input.source,
          }));
          const relationTarget = sha256(stableJson({
            kind: 'training-evidence-source-event',
            sourceEventId: input.sourceEventId,
          }));
          await tx`
            INSERT INTO teaching_relation_locks (
              organization_id, relation_kind, subject_key, target_key
            ) VALUES (
              ${student.organizationId}, 'training_evidence', ${relationSubject}, ${relationTarget}
            )
            ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
            DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                          touched_at = clock_timestamp()`;
          const existing = await tx`
            SELECT * FROM training_evidence
            WHERE organization_id = ${student.organizationId}
              AND student_id = ${student.studentId}
              AND source = ${input.source}
              AND source_event_id = ${input.sourceEventId}
            FOR UPDATE`;
          if (existing.length) {
            const row = existing[0] as Record<string, unknown>;
            if (String(row.payload_sha256) !== payloadHash) {
              throw new TeachingApiException(
                'CONFLICT',
                409,
                'sourceEventId is permanently bound to different evidence',
              );
            }
            const links = await tx`
              SELECT assignment_id
              FROM training_evidence_assignments
              WHERE organization_id = ${student.organizationId}
                AND evidence_id = ${String(row.id)}
              ORDER BY assignment_id`;
            return {
              status: 200,
              body: {
                evidence: selfTrainingEvidenceReceipt(row),
                assignmentIds: links.map((link) => String(link.assignment_id)),
                replayed: true,
              },
            };
          }
          for (const assignmentId of assignmentIds) {
            const targets = await tx`
              SELECT target.id
              FROM training_assignment_targets target
              JOIN training_assignments assignment
                ON assignment.organization_id = target.organization_id
               AND assignment.id = target.assignment_id
              JOIN training_template_versions version
                ON version.organization_id = assignment.organization_id
               AND version.id = assignment.template_version_id
              WHERE target.organization_id = ${student.organizationId}
                AND target.assignment_id = ${assignmentId}
                AND target.student_id = ${student.studentId}
                AND target.target_kind = 'student'
                AND assignment.status = 'published'
                AND version.source = ${input.source}
                AND version.activity = ${input.activity}
                AND assignment.starts_at <= ${input.occurredAt}
                AND (assignment.ends_at IS NULL OR assignment.ends_at > ${input.occurredAt})
              FOR UPDATE OF assignment, target`;
            if (!targets.length) {
              throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
            }
          }
          const resultMs = input.source === 'timer'
            ? (input.metrics.resultMs as number | null | undefined) ?? null
            : null;
          const inserted = await tx`
            INSERT INTO training_evidence (
              organization_id, student_id, source, source_event_id, payload_sha256,
              trust_level, occurred_at, timezone_snapshot, local_date, activity,
              duration_ms, result_ms, success, metrics, payload_version, payload,
              submitted_by_user_id
            ) VALUES (
              ${student.organizationId}, ${student.studentId}, ${input.source},
              ${input.sourceEventId}, ${payloadHash}, 'self_reported', ${input.occurredAt},
              ${student.organizationTimezone}, ${input.occurredAt.slice(0, 10)}, ${input.activity},
              ${input.durationMs ?? null}, ${resultMs}, ${Boolean(input.metrics.success)},
              ${sql.json(input.metrics as JsonObject)}, ${input.payloadVersion},
              ${sql.json((input.payload ?? {}) as JsonObject)}, ${actor.userId}
            )
            RETURNING *`;
          const row = inserted[0] as Record<string, unknown>;
          for (const assignmentId of assignmentIds) {
            await tx`
              INSERT INTO training_evidence_assignments (
                organization_id, evidence_id, assignment_id, student_id
              ) VALUES (
                ${student.organizationId}, ${String(row.id)}, ${assignmentId}, ${student.studentId}
              )`;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${student.organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${student.organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'training.evidence.self.create', 'training_evidence',
              ${String(row.id)}, ${requestId},
              ${sql.json({ source: input.source, activity: input.activity, assignmentCount: assignmentIds.length })}
            )`;
          return {
            status: 201,
            body: {
              evidence: selfTrainingEvidenceReceipt(row),
              assignmentIds,
              replayed: false,
            },
          };
        });
      } catch (error) {
        crmConflict(error, 'Training evidence could not be saved because its student or assignment changed');
      }
    });
  },
};
