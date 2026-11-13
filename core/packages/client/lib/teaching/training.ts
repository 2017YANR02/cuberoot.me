import {
  type TeachingTrainingTemplate,
  TRAINING_TEMPLATE_STATUSES,
  type TeachingTrainingTemplateVersion,
  TRAINING_EVIDENCE_SOURCES,
  isTrainingSourceActivity,
  type TeachingTrainingAssignment,
  TRAINING_ASSIGNMENT_STATUSES,
  TRAINING_SCHEDULE_KINDS,
  type TeachingTrainingAssignmentGoalMetric,
  TRAINING_GOAL_METRIC_KEYS,
  TRAINING_GOAL_OPERATORS,
  type TeachingTrainingAssignmentDetail,
  type TeachingTrainingAssignmentTarget,
  TRAINING_REVIEW_STATUSES,
  type TeachingTrainingEvidence,
  TRAINING_TRUST_LEVELS,
  type TeachingTrainingSubmissionReview,
  type TeachingSelfTrainingAssignment,
  type TeachingTrainingTemplateCreateInput,
  type TeachingTrainingTemplateVersionCreateInput,
  type TeachingTrainingAssignmentWriteInput,
  type TeachingTrainingReviewCreateInput,
} from '@cuberoot/shared/teaching';
import {
  record,
  string,
  enumValue,
  nullableInteger,
  integer,
  nullableString,
  boolean,
} from './validation';
import { TeachingApiError } from './errors';
import { type TeachingPage, type TeachingDailyBoard } from './types';
import { page, orgPath, pageQuery } from './pagination';
import { request, post } from './transport';

function trainingTemplate(value: unknown): TeachingTrainingTemplate {
  const item = record(value, 'trainingTemplate');
  return {
    id: string(item.id, 'trainingTemplate.id'),
    organizationId: string(item.organizationId, 'trainingTemplate.organizationId'),
    name: string(item.name, 'trainingTemplate.name'),
    description: string(item.description, 'trainingTemplate.description'),
    status: enumValue(item.status, TRAINING_TEMPLATE_STATUSES, 'trainingTemplate.status'),
    latestVersionNumber: nullableInteger(item.latestVersionNumber, 'trainingTemplate.latestVersionNumber', 1),
    createdAt: string(item.createdAt, 'trainingTemplate.createdAt'),
    updatedAt: string(item.updatedAt, 'trainingTemplate.updatedAt'),
  };
}

function trainingToolConfig(value: unknown): { schemaVersion: 1 } {
  const item = record(value, 'trainingTemplateVersion.toolConfig');
  if (item.schemaVersion !== 1 || Object.keys(item).some((key) => key !== 'schemaVersion')) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingTemplateVersion.toolConfig is invalid');
  }
  return { schemaVersion: 1 };
}

function trainingTemplateVersion(value: unknown): TeachingTrainingTemplateVersion {
  const item = record(value, 'trainingTemplateVersion');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'trainingTemplateVersion.source');
  const activity = string(item.activity, 'trainingTemplateVersion.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingTemplateVersion.activity is invalid');
  }
  return {
    id: string(item.id, 'trainingTemplateVersion.id'),
    organizationId: string(item.organizationId, 'trainingTemplateVersion.organizationId'),
    templateId: string(item.templateId, 'trainingTemplateVersion.templateId'),
    versionNumber: integer(item.versionNumber, 'trainingTemplateVersion.versionNumber', 1),
    title: string(item.title, 'trainingTemplateVersion.title'),
    instructions: string(item.instructions, 'trainingTemplateVersion.instructions'),
    source,
    activity,
    toolConfig: trainingToolConfig(item.toolConfig),
    publishedAt: string(item.publishedAt, 'trainingTemplateVersion.publishedAt'),
  };
}

function trainingAssignment(value: unknown): TeachingTrainingAssignment {
  const item = record(value, 'trainingAssignment');
  return {
    id: string(item.id, 'trainingAssignment.id'),
    organizationId: string(item.organizationId, 'trainingAssignment.organizationId'),
    templateVersionId: string(item.templateVersionId, 'trainingAssignment.templateVersionId'),
    title: string(item.title, 'trainingAssignment.title'),
    instructions: string(item.instructions, 'trainingAssignment.instructions'),
    status: enumValue(item.status, TRAINING_ASSIGNMENT_STATUSES, 'trainingAssignment.status'),
    scheduleKind: enumValue(item.scheduleKind, TRAINING_SCHEDULE_KINDS, 'trainingAssignment.scheduleKind'),
    expectedCount: integer(item.expectedCount, 'trainingAssignment.expectedCount', 1),
    timezoneSnapshot: string(item.timezoneSnapshot, 'trainingAssignment.timezoneSnapshot'),
    startsAt: string(item.startsAt, 'trainingAssignment.startsAt'),
    endsAt: nullableString(item.endsAt, 'trainingAssignment.endsAt'),
    publishedAt: nullableString(item.publishedAt, 'trainingAssignment.publishedAt'),
    closedAt: nullableString(item.closedAt, 'trainingAssignment.closedAt'),
    createdAt: string(item.createdAt, 'trainingAssignment.createdAt'),
    updatedAt: string(item.updatedAt, 'trainingAssignment.updatedAt'),
  };
}

function trainingGoal(value: unknown): TeachingTrainingAssignmentGoalMetric {
  const item = record(value, 'trainingGoal');
  return {
    id: string(item.id, 'trainingGoal.id'),
    organizationId: string(item.organizationId, 'trainingGoal.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingGoal.assignmentId'),
    metricKey: enumValue(item.metricKey, TRAINING_GOAL_METRIC_KEYS, 'trainingGoal.metricKey'),
    operator: enumValue(item.operator, TRAINING_GOAL_OPERATORS, 'trainingGoal.operator'),
    targetValue: integer(item.targetValue, 'trainingGoal.targetValue'),
  };
}

function trainingAssignmentDetail(value: unknown): TeachingTrainingAssignmentDetail {
  const item = record(value, 'trainingAssignmentDetail');
  if (!Array.isArray(item.goals)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingAssignmentDetail.goals is invalid');
  return {
    assignment: trainingAssignment(item.assignment),
    templateVersion: trainingTemplateVersion(item.templateVersion),
    goals: item.goals.map(trainingGoal),
  };
}

function trainingTarget(value: unknown): TeachingTrainingAssignmentTarget {
  const item = record(value, 'trainingTarget');
  const base = {
    id: string(item.id, 'trainingTarget.id'),
    organizationId: string(item.organizationId, 'trainingTarget.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingTarget.assignmentId'),
    evidenceCount: string(item.evidenceCount, 'trainingTarget.evidenceCount'),
    firstEvidenceAt: nullableString(item.firstEvidenceAt, 'trainingTarget.firstEvidenceAt'),
    lastEvidenceAt: nullableString(item.lastEvidenceAt, 'trainingTarget.lastEvidenceAt'),
    latestReviewRevision: integer(item.latestReviewRevision, 'trainingTarget.latestReviewRevision'),
    latestReviewStatus: item.latestReviewStatus === null
      ? null
      : enumValue(item.latestReviewStatus, TRAINING_REVIEW_STATUSES, 'trainingTarget.latestReviewStatus'),
  };
  const targetKind = enumValue(item.targetKind, ['group', 'student'] as const, 'trainingTarget.targetKind');
  if (targetKind === 'group') {
    return {
      ...base,
      targetKind,
      groupId: string(item.groupId, 'trainingTarget.groupId'),
      sourceGroupId: null,
      studentId: null,
      groupNameSnapshot: string(item.groupNameSnapshot, 'trainingTarget.groupNameSnapshot'),
      studentDisplayNameSnapshot: null,
      studentExternalRefSnapshot: null,
    };
  }
  return {
    ...base,
    targetKind,
    groupId: null,
    sourceGroupId: nullableString(item.sourceGroupId, 'trainingTarget.sourceGroupId'),
    studentId: string(item.studentId, 'trainingTarget.studentId'),
    groupNameSnapshot: null,
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'trainingTarget.studentDisplayNameSnapshot'),
    studentExternalRefSnapshot: nullableString(item.studentExternalRefSnapshot, 'trainingTarget.studentExternalRefSnapshot'),
  };
}

function trainingEvidence(value: unknown): TeachingTrainingEvidence {
  const item = record(value, 'trainingEvidence');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'trainingEvidence.source');
  const activity = string(item.activity, 'trainingEvidence.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingEvidence.activity is invalid');
  }
  return {
    id: string(item.id, 'trainingEvidence.id'),
    organizationId: string(item.organizationId, 'trainingEvidence.organizationId'),
    studentId: string(item.studentId, 'trainingEvidence.studentId'),
    source,
    sourceEventId: string(item.sourceEventId, 'trainingEvidence.sourceEventId'),
    trustLevel: enumValue(item.trustLevel, TRAINING_TRUST_LEVELS, 'trainingEvidence.trustLevel'),
    occurredAt: string(item.occurredAt, 'trainingEvidence.occurredAt'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'trainingEvidence.timezoneSnapshot'),
    localDate: string(item.localDate, 'trainingEvidence.localDate'),
    activity,
    durationMs: nullableInteger(item.durationMs, 'trainingEvidence.durationMs'),
    resultMs: nullableInteger(item.resultMs, 'trainingEvidence.resultMs'),
    success: item.success === null ? null : boolean(item.success, 'trainingEvidence.success'),
    payloadVersion: integer(item.payloadVersion, 'trainingEvidence.payloadVersion', 1),
    createdAt: string(item.createdAt, 'trainingEvidence.createdAt'),
  };
}

const TRAINING_REVIEWER_ROLES = ['owner', 'admin', 'teacher', 'assistant'] as const;

function trainingReview(value: unknown): TeachingTrainingSubmissionReview {
  const item = record(value, 'trainingReview');
  return {
    id: string(item.id, 'trainingReview.id'),
    organizationId: string(item.organizationId, 'trainingReview.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingReview.assignmentId'),
    studentId: string(item.studentId, 'trainingReview.studentId'),
    revision: integer(item.revision, 'trainingReview.revision', 1),
    reviewerUserId: nullableInteger(item.reviewerUserId, 'trainingReview.reviewerUserId', 1),
    reviewerUserIdSnapshot: integer(item.reviewerUserIdSnapshot, 'trainingReview.reviewerUserIdSnapshot', 1),
    reviewerDisplayNameSnapshot: string(item.reviewerDisplayNameSnapshot, 'trainingReview.reviewerDisplayNameSnapshot'),
    reviewerRoleSnapshot: enumValue(item.reviewerRoleSnapshot, TRAINING_REVIEWER_ROLES, 'trainingReview.reviewerRoleSnapshot'),
    status: enumValue(item.status, TRAINING_REVIEW_STATUSES, 'trainingReview.status'),
    rating: nullableInteger(item.rating, 'trainingReview.rating'),
    feedback: string(item.feedback, 'trainingReview.feedback'),
    createdAt: string(item.createdAt, 'trainingReview.createdAt'),
  };
}

function selfTrainingAssignment(value: unknown): TeachingSelfTrainingAssignment {
  const item = record(value, 'selfTrainingAssignment');
  const templateItem = record(item.template, 'selfTrainingAssignment.template');
  const target = trainingTarget(item.target);
  if (target.targetKind !== 'student') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'selfTrainingAssignment.target is invalid');
  }
  if (!Array.isArray(item.goals)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'selfTrainingAssignment.goals is invalid');
  return {
    assignment: trainingAssignment(item.assignment),
    target,
    template: {
      id: string(templateItem.id, 'selfTrainingAssignment.template.id'),
      name: string(templateItem.name, 'selfTrainingAssignment.template.name'),
    },
    templateVersion: trainingTemplateVersion(item.templateVersion),
    goals: item.goals.map(trainingGoal),
  };
}

export async function listTeachingTrainingTemplates(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingTemplate>> {
  return page(
    await request(orgPath(orgSlug, `/training/templates${pageQuery(pageNumber, pageSize)}`)),
    'templates',
    trainingTemplate,
  );
}

export async function getTeachingTrainingTemplate(
  orgSlug: string,
  templateId: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await request(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}`)),
    'training template',
  );
  return trainingTemplate(envelope.template);
}

export async function createTeachingTrainingTemplate(
  orgSlug: string,
  input: TeachingTrainingTemplateCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await post(orgPath(orgSlug, '/training/templates'), input, idempotencyKey),
    'training template create',
  );
  return trainingTemplate(envelope.template);
}

export async function listTeachingTrainingTemplateVersions(
  orgSlug: string,
  templateId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingTemplateVersion>> {
  return page(
    await request(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/versions${pageQuery(pageNumber, pageSize)}`)),
    'templateVersions',
    trainingTemplateVersion,
  );
}

export async function createTeachingTrainingTemplateVersion(
  orgSlug: string,
  templateId: string,
  input: TeachingTrainingTemplateVersionCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplateVersion> {
  const envelope = record(
    await post(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/versions`), input, idempotencyKey),
    'training template version create',
  );
  return trainingTemplateVersion(envelope.templateVersion);
}

export async function archiveTeachingTrainingTemplate(
  orgSlug: string,
  templateId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await post(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/archive`), {}, idempotencyKey),
    'training template archive',
  );
  return trainingTemplate(envelope.template);
}

export async function listTeachingTrainingAssignments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
  status?: TeachingTrainingAssignment['status'],
): Promise<TeachingPage<TeachingTrainingAssignment>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, pageNumber)),
    pageSize: String(Math.min(100, Math.max(1, pageSize))),
  });
  if (status) query.set('status', status);
  return page(
    await request(orgPath(orgSlug, `/training/assignments?${query}`)),
    'assignments',
    trainingAssignment,
  );
}

export async function getTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await request(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}`),
  ));
}

export async function getTeachingDailyBoard(orgSlug: string, assignmentId: string, learner: boolean, date: string | null, pageNumber = 1, rankEvent: string | null = null): Promise<TeachingDailyBoard> {
  const query = new URLSearchParams({ page: String(pageNumber), pageSize: '50' });
  if (date) query.set('date', date);
  if (rankEvent) query.set('rankEvent', rankEvent);
  const body = record(await request(orgPath(orgSlug, `/${learner ? 'me/' : ''}training/assignments/${encodeURIComponent(assignmentId)}/daily?${query}`)), 'dailyBoard');
  if (!Array.isArray(body.rows)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'dailyBoard.rows is invalid');
  if (!Array.isArray(body.events)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'dailyBoard.events is invalid');
  return {
    ...trainingAssignmentDetail(body),
    rankEvent: nullableString(body.rankEvent, 'rankEvent'), events: body.events.map(event => string(event, 'event')),
    date: string(body.date, 'date'), today: string(body.today, 'today'), timezone: string(body.timezone, 'timezone'), selfId: nullableString(body.selfId, 'selfId'),
    total: integer(body.total, 'total', 0), completedTotal: integer(body.completedTotal, 'completedTotal', 0), page: integer(body.page, 'page', 1), pageSize: integer(body.pageSize, 'pageSize', 1),
    rows: body.rows.map(raw => {
      const row = record(raw, 'row');
      if (!Array.isArray(row.results)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'dailyBoard.results is invalid');
      return { studentId: string(row.studentId, 'studentId'), name: string(row.name, 'name'), rank: nullableInteger(row.rank, 'rank'), count: integer(row.count, 'count', 0), durationMs: integer(row.durationMs, 'durationMs', 0), successes: integer(row.successes, 'successes', 0), completed: boolean(row.completed, 'completed'), results: row.results.map(rawResult => {
        const result = record(rawResult, 'result');
        return { event: string(result.event, 'event'), bestMs: nullableInteger(result.best_ms, 'best_ms'), meanMs: nullableInteger(result.mean_ms, 'mean_ms') };
      }) };
    }),
  };
}

export async function createTeachingTrainingAssignment(
  orgSlug: string,
  input: TeachingTrainingAssignmentWriteInput,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, '/training/assignments'),
    input,
    idempotencyKey,
  ));
}

export async function reviseTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  input: TeachingTrainingAssignmentWriteInput,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/revise`),
    input,
    idempotencyKey,
  ));
}

export async function publishTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/publish`),
    {},
    idempotencyKey,
  ));
}

export async function closeTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/close`),
    {},
    idempotencyKey,
  ));
}

export async function listTeachingTrainingAssignmentTargets(
  orgSlug: string,
  assignmentId: string,
  pageNumber = 1,
  pageSize = 25,
  targetKind?: TeachingTrainingAssignmentTarget['targetKind'],
): Promise<TeachingPage<TeachingTrainingAssignmentTarget>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, pageNumber)),
    pageSize: String(Math.min(100, Math.max(1, pageSize))),
  });
  if (targetKind) query.set('targetKind', targetKind);
  return page(
    await request(orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/targets?${query}`)),
    'targets',
    trainingTarget,
  );
}

export async function listTeachingTrainingTargetEvidence(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingEvidence>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/evidence${pageQuery(pageNumber, pageSize)}`,
    )),
    'evidence',
    trainingEvidence,
  );
}

export async function listTeachingTrainingTargetReviews(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingSubmissionReview>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/reviews${pageQuery(pageNumber, pageSize)}`,
    )),
    'reviews',
    trainingReview,
  );
}

export async function createTeachingTrainingTargetReview(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  input: TeachingTrainingReviewCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingSubmissionReview> {
  const envelope = record(await post(orgPath(
    orgSlug,
    `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/reviews`,
  ), input, idempotencyKey), 'training review create');
  return trainingReview(envelope.review);
}

export async function listSelfTeachingTrainingAssignments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingSelfTrainingAssignment>> {
  return page(
    await request(orgPath(orgSlug, `/me/training/assignments${pageQuery(pageNumber, pageSize)}`)),
    'assignments',
    selfTrainingAssignment,
  );
}
