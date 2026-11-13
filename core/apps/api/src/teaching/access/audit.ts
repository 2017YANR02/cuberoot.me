import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { query } from '../../db/connection.js';
import { TeachingApiException, ConcealedTeachingPermissionDeniedException } from '../errors.js';

function isAccessDenial(error: unknown): error is TeachingApiException {
  return error instanceof ConcealedTeachingPermissionDeniedException || (
    error instanceof TeachingApiException &&
    (error.code === 'ORGANIZATION_NOT_FOUND' || error.code === 'PERMISSION_DENIED')
  );
}

function accessDenialReason(error: TeachingApiException): string {
  return error instanceof ConcealedTeachingPermissionDeniedException
    ? error.auditReason
    : error.code;
}

async function recordDeniedOrganizationAccess(
  actor: TeachingActor,
  slug: string,
  action: string,
  requestId: string,
  error: TeachingApiException,
): Promise<void> {
  await query(
    `INSERT INTO teaching_audit_events (
       organization_id, actor_user_id, actor_role, actor_display_name,
       action, entity_type, entity_id, outcome, request_id, metadata
     )
     SELECT o.id, actor_account.id, m.role, ?, ?, 'organization', o.id::text, 'denied', ?, ?::jsonb
     FROM organizations o
     LEFT JOIN app_users actor_account ON actor_account.id = ?
     LEFT JOIN organization_members m
       ON m.organization_id = o.id AND m.user_id = actor_account.id
     WHERE o.slug = ?`,
    [
      actor.displayName,
      action,
      requestId,
      { reason: accessDenialReason(error) },
      actor.userId,
      slug,
    ],
  );
}

export async function withDeniedAccessAudit<T>(
  actor: TeachingActor,
  slug: string,
  action: string,
  requestId: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAccessDenial(error)) {
      await recordDeniedOrganizationAccess(actor, slug, action, requestId, error);
    }
    throw error;
  }
}
