import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { sql } from '../../db/connection.js';
import { type Tx, type OrganizationAccess } from '../types.js';
import { requireSessionScope } from './organization.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException } from '../errors.js';

export async function lockManagedSession(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const scope = requireSessionScope(access, 'session:manage');
  const rows = scope === 'organization'
    ? await tx`
        SELECT session.* FROM teaching_sessions session
        WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
        FOR UPDATE OF session`
    : await tx`
        SELECT session.* FROM teaching_sessions session
        WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
          AND EXISTS (
            SELECT 1 FROM session_teachers assigned
            WHERE assigned.organization_id = session.organization_id
              AND assigned.session_id = session.id
              AND assigned.teacher_user_id = ${actor.userId}
          )
        FOR UPDATE OF session`;
  if (rows.length) return rows[0] as Record<string, unknown>;
  if (scope === 'assigned') {
    const existing = await tx`
      SELECT 1 FROM teaching_sessions WHERE organization_id = ${access.id} AND id = ${sessionId}`;
    if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
}

export async function lockManagedCancellationGraph(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  sessionId: string,
): Promise<{
  session: Record<string, unknown>;
}> {
  const scope = requireSessionScope(access, 'session:manage');
  const discoveredAttempts = await tx`
    SELECT source_session_id, target_session_id
    FROM makeup_attempts
    WHERE organization_id = ${access.id} AND status = 'scheduled'
      AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})
    ORDER BY source_session_id, target_session_id, id`;
  const sessionIds = [...new Set([
    sessionId,
    ...discoveredAttempts.flatMap((row) => [
      String(row.source_session_id),
      String(row.target_session_id),
    ]),
  ])].sort();
  const sessions = await tx`
    SELECT session.* FROM teaching_sessions session
    WHERE session.organization_id = ${access.id} AND session.id IN ${sql(sessionIds)}
    ORDER BY session.id
    FOR UPDATE OF session`;
  const session = sessions.find((row) => String(row.id) === sessionId) as
    | Record<string, unknown>
    | undefined;
  if (!session) {
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
  }
  if (sessions.length !== sessionIds.length) {
    throw new TeachingApiException('CONFLICT', 409, 'A related makeup session no longer exists');
  }
  if (scope === 'assigned') {
    const assigned = await tx`
      SELECT session_id FROM session_teachers
      WHERE organization_id = ${access.id} AND session_id IN ${sql(sessionIds)}
        AND teacher_user_id = ${actor.userId}
      ORDER BY session_id, id
      FOR SHARE`;
    if (new Set(assigned.map((row) => String(row.session_id))).size !== sessionIds.length) {
      throw new ConcealedTeachingPermissionDeniedException('Session not found');
    }
  }
  const attempts = await tx`
    SELECT source_session_id, target_session_id FROM makeup_attempts
    WHERE organization_id = ${access.id} AND status = 'scheduled'
      AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})
    ORDER BY source_session_id, target_session_id, id`;
  const lockedSessionIds = new Set(sessionIds);
  if (attempts.some((row) => (
    !lockedSessionIds.has(String(row.source_session_id))
      || !lockedSessionIds.has(String(row.target_session_id))
  ))) {
    throw new TeachingApiException('CONFLICT', 409, 'Makeup scheduling changed; retry cancellation');
  }
  return { session };
}
