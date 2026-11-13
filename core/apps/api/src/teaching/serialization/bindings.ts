import { type JsonObject } from '../types.js';
import { iso } from './common.js';

export function bindingInviteToJson(row: Record<string, unknown>): JsonObject {
  const databaseNow = new Date(String(row.database_now)).getTime();
  if (!Number.isFinite(databaseNow)) {
    throw new Error('Student account binding invite query must include database_now');
  }
  const status = row.consumed_at != null
    ? 'consumed'
    : row.revoked_at != null
      ? 'revoked'
      : row.expired_at != null || new Date(String(row.expires_at)).getTime() <= databaseNow
        ? 'expired'
        : 'pending';
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    status,
    expiresAt: iso(row.expires_at),
    expiredAt: row.expired_at == null ? null : iso(row.expired_at),
    consumedAt: row.consumed_at == null ? null : iso(row.consumed_at),
    revokedAt: row.revoked_at == null ? null : iso(row.revoked_at),
    createdAt: iso(row.created_at),
  };
}

export function guardianBindingInviteToJson(row: Record<string, unknown>): JsonObject {
  const databaseNow = new Date(String(row.database_now)).getTime();
  if (!Number.isFinite(databaseNow)) {
    throw new Error('Guardian account binding invite query must include database_now');
  }
  const status = row.consumed_at != null
    ? 'consumed'
    : row.revoked_at != null
      ? 'revoked'
      : row.expired_at != null || new Date(String(row.expires_at)).getTime() <= databaseNow
        ? 'expired'
        : 'pending';
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    guardianLinkId: String(row.guardian_link_id),
    status,
    expiresAt: iso(row.expires_at),
    expiredAt: row.expired_at == null ? null : iso(row.expired_at),
    consumedAt: row.consumed_at == null ? null : iso(row.consumed_at),
    revokedAt: row.revoked_at == null ? null : iso(row.revoked_at),
    createdAt: iso(row.created_at),
  };
}
