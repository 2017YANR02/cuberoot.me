import { isTeachingOrganizationRole, type TeachingPermission, hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { query } from '../../db/connection.js';
import { type OrganizationAccess, type SessionAccessScope, type ReportAccessScope, type Tx } from '../types.js';
import { TeachingApiException } from '../errors.js';

export function asAccess(row: Record<string, unknown>): OrganizationAccess {
  if (!isTeachingOrganizationRole(row.role)) {
    throw new Error('Invalid organization role in database');
  }
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    timezone: String(row.timezone),
    status: row.status as OrganizationAccess['status'],
    version: Number(row.version),
    role: row.role,
  };
}

export function requirePermission(access: OrganizationAccess, permission: TeachingPermission): void {
  if (!hasTeachingPermission(access.role, permission)) {
    throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
  }
}

export function requireSessionScope(
  access: OrganizationAccess,
  permission: 'session:read' | 'session:manage' | 'feedback:read' | 'feedback:manage',
): SessionAccessScope {
  requirePermission(access, permission);
  if (access.role === 'owner' || access.role === 'admin') return 'organization';
  if (access.role === 'teacher' || access.role === 'assistant') return 'assigned';
  throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
}

export function requireReportScope(
  access: OrganizationAccess,
  permission: 'report:read' | 'report:manage',
): ReportAccessScope {
  requirePermission(access, permission);
  if (access.role === 'owner' || access.role === 'admin') return 'organization';
  if (access.role === 'teacher' || access.role === 'assistant') return 'assigned';
  throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
}

export function requireWritable(access: OrganizationAccess): void {
  if (access.status !== 'active') {
    throw new TeachingApiException('ORGANIZATION_SUSPENDED', 409, 'Organization is not active');
  }
}

export async function accessForRead(actorUserId: number, slug: string): Promise<OrganizationAccess> {
  const rows = await query<Record<string, unknown>>(
    `SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
     FROM organizations o
     JOIN organization_members m ON m.organization_id = o.id
     WHERE o.slug = ? AND m.user_id = ? AND m.status = 'active'`,
    [slug, actorUserId],
  );
  if (!rows.length) {
    throw new TeachingApiException('ORGANIZATION_NOT_FOUND', 404, 'Organization not found');
  }
  return asAccess(rows[0]);
}

export async function accessForWrite(tx: Tx, actorUserId: number, slug: string): Promise<OrganizationAccess> {
  const rows = await tx`
    SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id
    WHERE o.slug = ${slug} AND m.user_id = ${actorUserId} AND m.status = 'active'
    FOR UPDATE OF o, m`;
  if (!rows.length) {
    throw new TeachingApiException('ORGANIZATION_NOT_FOUND', 404, 'Organization not found');
  }
  return asAccess(rows[0] as Record<string, unknown>);
}

export function hasOrganizationCrmScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}
