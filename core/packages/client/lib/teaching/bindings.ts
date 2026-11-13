import {
  type TeachingLearningContext,
  type TeachingStudentAccountBindingInvite,
  type TeachingStudentAccountBindingInviteCreated,
  type TeachingStudentAccountBindingPreview,
  type TeachingStudentAccountBindingConsumed,
  type TeachingGuardianAccountBindingPreview,
  type TeachingGuardianAccountBindingConsumed,
} from '@cuberoot/shared/teaching';
import {
  record,
  enumValue,
  string,
  nullableString,
} from './validation';
import { TeachingApiError } from './errors';
import { request, postWithoutIdempotency, post } from './transport';
import { orgPath } from './pagination';

function learningRelationship(value: unknown): TeachingLearningContext['relationships'][number] {
  const item = record(value, 'learningContext.relationship');
  const kind = enumValue(item.kind, ['student', 'guardian'] as const, 'learningContext.relationship.kind');
  if (kind === 'student') return { kind };
  return {
    kind,
    guardianLinkId: string(item.guardianLinkId, 'learningContext.relationship.guardianLinkId'),
    relationship: string(item.relationship, 'learningContext.relationship.relationship'),
  };
}

function learningContext(value: unknown): TeachingLearningContext {
  const item = record(value, 'learningContext');
  const organizationItem = record(item.organization, 'learningContext.organization');
  const studentItem = record(item.student, 'learningContext.student');
  if (!Array.isArray(item.relationships) || item.relationships.length === 0) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learningContext.relationships is invalid');
  }
  return {
    organization: {
      slug: string(organizationItem.slug, 'learningContext.organization.slug'),
      name: string(organizationItem.name, 'learningContext.organization.name'),
    },
    student: {
      id: string(studentItem.id, 'learningContext.student.id'),
      displayName: string(studentItem.displayName, 'learningContext.student.displayName'),
    },
    relationships: item.relationships.map(learningRelationship),
  };
}

function bindingInvite(value: unknown): TeachingStudentAccountBindingInvite {
  const item = record(value, 'bindingInvite');
  return {
    id: string(item.id, 'bindingInvite.id'),
    organizationId: string(item.organizationId, 'bindingInvite.organizationId'),
    studentId: string(item.studentId, 'bindingInvite.studentId'),
    status: enumValue(item.status, ['pending', 'expired', 'revoked', 'consumed'] as const, 'bindingInvite.status'),
    expiresAt: string(item.expiresAt, 'bindingInvite.expiresAt'),
    expiredAt: nullableString(item.expiredAt, 'bindingInvite.expiredAt'),
    consumedAt: nullableString(item.consumedAt, 'bindingInvite.consumedAt'),
    revokedAt: nullableString(item.revokedAt, 'bindingInvite.revokedAt'),
    createdAt: string(item.createdAt, 'bindingInvite.createdAt'),
  };
}

export async function getCurrentTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
): Promise<TeachingStudentAccountBindingInvite | null> {
  const envelope = record(await request(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invite`,
  )), 'binding invite current');
  return envelope.invite === null ? null : bindingInvite(envelope.invite);
}

export async function createTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
  expiresInMinutes: number,
): Promise<TeachingStudentAccountBindingInviteCreated> {
  const envelope = record(await postWithoutIdempotency(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invites`,
  ), { expiresInMinutes }), 'binding invite create');
  return {
    invite: bindingInvite(envelope.invite),
    token: string(envelope.token, 'binding invite token'),
  };
}

export async function revokeTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
  inviteId: string,
  idempotencyKey: string,
): Promise<TeachingStudentAccountBindingInvite> {
  const envelope = record(await post(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invites/${encodeURIComponent(inviteId)}/revoke`,
  ), {}, idempotencyKey), 'binding invite revoke');
  return bindingInvite(envelope.invite);
}

export async function previewTeachingStudentAccountBinding(
  token: string,
): Promise<TeachingStudentAccountBindingPreview> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/student-account-binding/preview', { token }),
    'binding preview',
  );
  return {
    organizationName: string(item.organizationName, 'binding preview.organizationName'),
    studentDisplayName: string(item.studentDisplayName, 'binding preview.studentDisplayName'),
    expiresAt: string(item.expiresAt, 'binding preview.expiresAt'),
  };
}

export async function consumeTeachingStudentAccountBinding(
  token: string,
): Promise<TeachingStudentAccountBindingConsumed> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/student-account-binding/consume', { token }),
    'binding consume',
  );
  const invite = record(item.invite, 'binding consume.invite');
  const linkedStudent = record(item.student, 'binding consume.student');
  return {
    invite: {
      id: string(invite.id, 'binding consume.invite.id'),
      status: enumValue(invite.status, ['consumed'] as const, 'binding consume.invite.status'),
      expiresAt: string(invite.expiresAt, 'binding consume.invite.expiresAt'),
      consumedAt: string(invite.consumedAt, 'binding consume.invite.consumedAt'),
      createdAt: string(invite.createdAt, 'binding consume.invite.createdAt'),
    },
    student: {
      id: string(linkedStudent.id, 'binding consume.student.id'),
      organizationName: string(linkedStudent.organizationName, 'binding consume.student.organizationName'),
      displayName: string(linkedStudent.displayName, 'binding consume.student.displayName'),
      accountLinkedAt: string(linkedStudent.accountLinkedAt, 'binding consume.student.accountLinkedAt'),
    },
  };
}

export async function previewTeachingGuardianAccountBinding(
  token: string,
): Promise<TeachingGuardianAccountBindingPreview> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/guardian-account-binding/preview', { token }),
    'guardian binding preview',
  );
  return {
    organizationName: string(item.organizationName, 'guardian binding preview.organizationName'),
    studentDisplayName: string(item.studentDisplayName, 'guardian binding preview.studentDisplayName'),
    relationship: string(item.relationship, 'guardian binding preview.relationship'),
    expiresAt: string(item.expiresAt, 'guardian binding preview.expiresAt'),
  };
}

export async function consumeTeachingGuardianAccountBinding(
  token: string,
): Promise<TeachingGuardianAccountBindingConsumed> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/guardian-account-binding/consume', { token }),
    'guardian binding consume',
  );
  const invite = record(item.invite, 'guardian binding consume.invite');
  const guardian = record(item.guardian, 'guardian binding consume.guardian');
  return {
    invite: {
      id: string(invite.id, 'guardian binding consume.invite.id'),
      status: enumValue(invite.status, ['consumed'] as const, 'guardian binding consume.invite.status'),
      expiresAt: string(invite.expiresAt, 'guardian binding consume.invite.expiresAt'),
      consumedAt: string(invite.consumedAt, 'guardian binding consume.invite.consumedAt'),
      createdAt: string(invite.createdAt, 'guardian binding consume.invite.createdAt'),
    },
    guardian: {
      guardianLinkId: string(guardian.guardianLinkId, 'guardian binding consume.guardian.guardianLinkId'),
      studentId: string(guardian.studentId, 'guardian binding consume.guardian.studentId'),
      organizationName: string(guardian.organizationName, 'guardian binding consume.guardian.organizationName'),
      studentDisplayName: string(guardian.studentDisplayName, 'guardian binding consume.guardian.studentDisplayName'),
      relationship: string(guardian.relationship, 'guardian binding consume.guardian.relationship'),
      accountLinkedAt: string(guardian.accountLinkedAt, 'guardian binding consume.guardian.accountLinkedAt'),
    },
  };
}

function learningContextsEnvelope(value: unknown): TeachingLearningContext[] {
  const envelope = record(value, 'learningContexts');
  if (!Array.isArray(envelope.learningContexts)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learningContexts response is invalid');
  }
  return envelope.learningContexts.map(learningContext);
}

export async function listTeachingLearningContexts(): Promise<TeachingLearningContext[]> {
  return learningContextsEnvelope(await request('/v1/teaching/me/learning-contexts'));
}

export async function listTeachingOrganizationLearningContexts(
  orgSlug: string,
): Promise<TeachingLearningContext[]> {
  return learningContextsEnvelope(await request(orgPath(orgSlug, '/me/students')));
}
