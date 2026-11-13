import { isTrainingEvidenceSource, type TrainingEvidenceSource, isTrainingSourceActivity, parseTrainingToolConfigForActivity, TrainingEvidenceValidationError, type TrainingEvidenceActivity, TRAINING_SCHEDULE_KINDS, type TrainingScheduleKind, isTrainingGoalMetricKey, isTrainingGoalOperator, type TrainingGoalMetricKey, type TrainingGoalOperator, TRAINING_REVIEW_STATUSES, type TrainingReviewStatus, TRAINING_ASSIGNMENT_STATUSES, type TrainingAssignmentStatus } from '@cuberoot/shared/teaching';
import { type Context } from 'hono';
import { type JsonObject, type CreateTrainingTemplateInput, type CreateTrainingTemplateVersionInput, type WriteTrainingAssignmentInput, type CreateTrainingReviewInput, type TrainingTargetFilter, type TrainingAssignmentFilter } from '../types.js';
import { assertOnlyKeys, requiredString, requiredTimestamp, requiredUuidArray, requiredInteger, requiredUuid } from './common.js';
import { TeachingApiException } from '../errors.js';

export function parseTrainingTemplateInput(body: JsonObject): CreateTrainingTemplateInput {
  assertOnlyKeys(body, ['name', 'description'], 'training template input');
  const description = body.description;
  if (typeof description !== 'string' || description.length > 4_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'description must be a string up to 4000 characters');
  }
  return { name: requiredString(body, 'name', 200), description };
}

export function parseTrainingTemplateVersionInput(body: JsonObject): CreateTrainingTemplateVersionInput {
  assertOnlyKeys(body, ['title', 'instructions', 'source', 'activity', 'toolConfig'], 'training template version input');
  if (!isTrainingEvidenceSource(body.source)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'source is not a registered training source');
  }
  const source = body.source as TrainingEvidenceSource;
  if (typeof body.activity !== 'string' || !isTrainingSourceActivity(source, body.activity)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'activity is not registered for source');
  }
  if (typeof body.instructions !== 'string' || body.instructions.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'instructions must be a string up to 8000 characters');
  }
  let toolConfig: CreateTrainingTemplateVersionInput['toolConfig'];
  try {
    toolConfig = parseTrainingToolConfigForActivity(source, body.activity, body.toolConfig);
  } catch (error) {
    if (error instanceof TrainingEvidenceValidationError) {
      throw new TeachingApiException('INVALID_INPUT', 400, error.message);
    }
    throw error;
  }
  return {
    title: requiredString(body, 'title', 200),
    instructions: body.instructions,
    source,
    activity: body.activity as TrainingEvidenceActivity,
    toolConfig,
  };
}

export function parseTrainingAssignmentInput(body: JsonObject): WriteTrainingAssignmentInput {
  assertOnlyKeys(
    body,
    ['templateVersionId', 'title', 'instructions', 'scheduleKind', 'expectedCount', 'startsAt', 'endsAt', 'groupIds', 'studentIds', 'goals'],
    'training assignment input',
  );
  if (!TRAINING_SCHEDULE_KINDS.includes(body.scheduleKind as TrainingScheduleKind)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'scheduleKind must be once or daily');
  }
  if (typeof body.instructions !== 'string' || body.instructions.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'instructions must be a string up to 8000 characters');
  }
  const startsAt = requiredTimestamp(body, 'startsAt');
  const endsAt = body.endsAt === null ? null : requiredTimestamp(body, 'endsAt');
  if (endsAt !== null && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'endsAt must be after startsAt');
  }
  if (body.scheduleKind === 'once' && endsAt === null) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'once assignments require endsAt');
  }
  const groupIds = requiredUuidArray(body, 'groupIds');
  const studentIds = requiredUuidArray(body, 'studentIds');
  if (groupIds.length + studentIds.length < 1 || groupIds.length + studentIds.length > 100) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'groupIds and studentIds must contain 1 to 100 total selectors');
  }
  if (!Array.isArray(body.goals) || body.goals.length > 4) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'goals must contain at most 4 items');
  }
  const goals = body.goals.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    assertOnlyKeys(item, ['metricKey', 'operator', 'targetValue'], `goals[${index}]`);
    if (!isTrainingGoalMetricKey(item.metricKey)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}].metricKey is not registered`);
    }
    if (!isTrainingGoalOperator(item.operator)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}].operator is not registered`);
    }
    return {
      metricKey: item.metricKey as TrainingGoalMetricKey,
      operator: item.operator as TrainingGoalOperator,
      targetValue: requiredInteger(item, 'targetValue', 0, Number.MAX_SAFE_INTEGER),
    };
  });
  if (new Set(goals.map((goal) => goal.metricKey)).size !== goals.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'goals must not repeat metricKey');
  }
  return {
    templateVersionId: requiredUuid(body, 'templateVersionId'),
    title: requiredString(body, 'title', 200),
    instructions: body.instructions,
    scheduleKind: body.scheduleKind as TrainingScheduleKind,
    expectedCount: requiredInteger(body, 'expectedCount', 1, 100_000),
    startsAt,
    endsAt,
    groupIds,
    studentIds,
    goals,
  };
}

export function parseTrainingReviewInput(body: JsonObject): CreateTrainingReviewInput {
  assertOnlyKeys(body, ['status', 'rating', 'feedback'], 'training review input');
  if (!TRAINING_REVIEW_STATUSES.includes(body.status as TrainingReviewStatus)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'status must be commented, needs_changes, or accepted');
  }
  const rating = body.rating === null ? null : requiredInteger(body, 'rating', 1, 5);
  if (typeof body.feedback !== 'string' || body.feedback.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'feedback must be a string up to 8000 characters');
  }
  return { status: body.status as TrainingReviewStatus, rating, feedback: body.feedback };
}

export function trainingTargetFilterOf(c: Context): TrainingTargetFilter {
  const targetKind = c.req.query('targetKind');
  if (targetKind !== undefined && targetKind !== 'group' && targetKind !== 'student') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'targetKind must be group or student');
  }
  return { targetKind: targetKind ?? null } as TrainingTargetFilter;
}

export function trainingAssignmentFilterOf(c: Context): TrainingAssignmentFilter {
  const status = c.req.query('status');
  if (status !== undefined && !TRAINING_ASSIGNMENT_STATUSES.includes(status as TrainingAssignmentStatus)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'status must be draft, published, or closed');
  }
  return { status: (status as TrainingAssignmentStatus | undefined) ?? null };
}
