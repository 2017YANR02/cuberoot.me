import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type postgres from 'postgres';
import {
  hasTeachingPermission,
  isTrainingEvidenceSource,
  isTrainingGoalRegistered,
  isTrainingGoalMetricKey,
  isTrainingGoalOperator,
  isTrainingSourceActivity,
  isTeachingOrganizationRole,
  parseTrainingEvidenceV1,
  parseTrainingToolConfigForActivity,
  TRAINING_ASSIGNMENT_STATUSES,
  TRAINING_REVIEW_STATUSES,
  TRAINING_SCHEDULE_KINDS,
  TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS,
  TRAINING_EVIDENCE_MAX_BODY_BYTES,
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_FEEDBACK_VISIBILITIES,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  TEACHING_AUDIT_OUTCOMES,
  TEACHING_WEEKLY_REPORT_VISIBILITIES,
  type GenerateTeachingWeeklyReportInput,
  type CreateTeachingConversationInput,
  type MarkTeachingConversationReadInput,
  type PublishTeachingWeeklyReportInput,
  type ReplyTeachingConversationInput,
  type TeachingConversationActorRole,
  type TeachingErrorCode,
  type TeachingAttendanceStatus,
  type TeachingAuditEvent,
  type TeachingAuditOutcome,
  type TeachingCreditUnit,
  type TeachingFeedbackVisibility,
  type TeachingPackageAcquisitionType,
  type TeachingOrganizationRole,
  type TeachingOperationsOverview,
  type TeachingPermission,
  type TeachingTrainingAssignmentWriteInput,
  type TeachingTrainingReviewCreateInput,
  type TeachingTrainingTemplateCreateInput,
  type TeachingTrainingTemplateVersionCreateInput,
  type TrainingAssignmentStatus,
  type TrainingEvidenceActivity,
  type TrainingEvidenceSource,
  type TrainingGoalMetricKey,
  type TrainingGoalOperator,
  type TrainingReviewStatus,
  type TrainingScheduleKind,
  type TrainingEvidenceV1,
  TrainingEvidenceValidationError,
} from '@cuberoot/shared/teaching';
import { query, sql } from '../db/connection.js';
import {
  authenticateTeachingActor,
  InvalidTeachingPlatformAssertionError,
  type TeachingActor,
} from '../utils/teaching_platform_assertion.js';

type JsonValue = postgres.JSONValue;
type JsonObject = { [key: string]: JsonValue };
type MutationStatus = 200 | 201;
type Tx = postgres.TransactionSql;

const TRAINING_REVIEW_CREATE_OPERATION = 'training.review.create';
const LESSON_FEEDBACK_CREATE_OPERATION = 'lesson.feedback.create';

interface OrganizationAccess {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: 'active' | 'suspended' | 'archived';
  version: number;
  role: TeachingOrganizationRole;
}

interface MutationResult {
  status: MutationStatus;
  body: JsonObject;
}

interface CreateOrganizationInput {
  slug: string;
  name: string;
  timezone: string;
}

interface CreateMemberInput {
  userId: number;
  role: Exclude<TeachingOrganizationRole, 'owner'>;
}

interface CreateStudentInput {
  displayName: string;
  externalRef: string | null;
}

interface CreateCampusInput {
  code: string | null;
  name: string;
  timezone: string | null;
}

interface CreateGroupInput {
  campusId: string | null;
  code: string | null;
  name: string;
}

interface CreateStudentGroupMembershipInput {
  studentId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface CreateTeacherAssignmentInput {
  teacherUserId: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface TeacherAssignmentTarget {
  groupId: string | null;
  studentId: string | null;
}

interface CreatePackageProductInput {
  code: string;
  name: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
}

interface CreateStudentPackageInput {
  productId: string;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
}

interface CreateCreditRefundInput {
  credits: number;
  reason: string;
  sourceSystem: string;
  sourceRef: string;
  sourceLineRef: string | null;
}

interface CreateCreditReversalInput {
  reason: string;
}

interface CreateSessionInput {
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
  teacherUserIds: number[];
  attendees: Array<{
    studentId: string;
    studentPackageId: string;
    creditCost: number;
  }>;
}

interface AttendanceBatchInput {
  records: Array<{
    attendanceId: string;
    status: Extract<TeachingAttendanceStatus, 'present' | 'late' | 'absent'>;
  }>;
}

interface LeaveRequestInput {
  reason: string;
}

interface LeaveDecisionInput {
  decision: 'approved' | 'rejected';
  reason: string;
}

interface MakeupScheduleInput {
  targetSessionId: string;
  reason: string;
}

interface SessionCancelInput {
  reason: string;
}

interface CreateLessonFeedbackInput {
  visibility: TeachingFeedbackVisibility;
  summary: string;
  strengths: string | null;
  challenges: string | null;
  nextGoals: string | null;
  internalNotes: string | null;
}

interface PageInput {
  page: number;
  pageSize: number;
  offset: number;
}

interface PageResult {
  items: JsonObject[];
  total: number;
  page: number;
  pageSize: number;
}

interface AuditPageResult {
  items: TeachingAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

interface CreateStudentAccountBindingInviteInput {
  expiresInMinutes: number;
}

interface ConsumeStudentAccountBindingInput {
  tokenHash: string;
}

type CreateGuardianAccountBindingInviteInput = CreateStudentAccountBindingInviteInput;
type ConsumeGuardianAccountBindingInput = ConsumeStudentAccountBindingInput;

type CreateTrainingTemplateInput = TeachingTrainingTemplateCreateInput;
type CreateTrainingTemplateVersionInput = TeachingTrainingTemplateVersionCreateInput;
type WriteTrainingAssignmentInput = TeachingTrainingAssignmentWriteInput;
type CreateTrainingReviewInput = TeachingTrainingReviewCreateInput;

interface TrainingTargetFilter {
  targetKind: 'group' | 'student' | null;
}

interface TrainingAssignmentFilter {
  status: TrainingAssignmentStatus | null;
}

interface WeeklyReportFilter {
  studentId: string | null;
}

interface AuditEventFilter {
  q: string | null;
  outcome: TeachingAuditOutcome | null;
}

interface ConversationMessagePageInput {
  afterSequence: number;
  limit: number;
}

export interface TeachingSaasRepository {
  listOrganizations(actor: TeachingActor): Promise<JsonObject[]>;
  getOrganization(actor: TeachingActor, slug: string, requestId: string): Promise<JsonObject>;
  getOrganizationSummary(actor: TeachingActor, slug: string, requestId: string): Promise<JsonObject>;
  getOperationsOverview(actor: TeachingActor, slug: string, requestId: string): Promise<TeachingOperationsOverview>;
  listAuditEvents(
    actor: TeachingActor,
    slug: string,
    filter: AuditEventFilter,
    pagination: PageInput,
    requestId: string,
  ): Promise<AuditPageResult>;
  createOrganization(
    actor: TeachingActor,
    input: CreateOrganizationInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listMembers(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  createMember(
    actor: TeachingActor,
    slug: string,
    input: CreateMemberInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudents(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getStudent(actor: TeachingActor, slug: string, studentId: string, requestId: string): Promise<JsonObject>;
  createStudent(
    actor: TeachingActor,
    slug: string,
    input: CreateStudentInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listCampuses(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getCampus(actor: TeachingActor, slug: string, campusId: string, requestId: string): Promise<JsonObject>;
  createCampus(
    actor: TeachingActor, slug: string, input: CreateCampusInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveCampus(
    actor: TeachingActor, slug: string, campusId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listGroups(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getGroup(actor: TeachingActor, slug: string, groupId: string, requestId: string): Promise<JsonObject>;
  createGroup(
    actor: TeachingActor, slug: string, input: CreateGroupInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveGroup(
    actor: TeachingActor, slug: string, groupId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listGroupStudents(
    actor: TeachingActor, slug: string, groupId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createStudentGroupMembership(
    actor: TeachingActor, slug: string, groupId: string, input: CreateStudentGroupMembershipInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  revokeStudentGroupMembership(
    actor: TeachingActor, slug: string, membershipId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTeacherAssignments(
    actor: TeachingActor, slug: string, target: TeacherAssignmentTarget,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTeacherAssignment(
    actor: TeachingActor, slug: string, input: CreateTeacherAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  revokeTeacherAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listPackageProducts(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  createPackageProduct(
    actor: TeachingActor,
    slug: string,
    input: CreatePackageProductInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudentPackages(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  createStudentPackage(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    input: CreateStudentPackageInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudentPackageLedger(
    actor: TeachingActor,
    slug: string,
    studentPackageId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  listCreditAdjustments(
    actor: TeachingActor,
    slug: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  refundStudentPackageCredits(
    actor: TeachingActor,
    slug: string,
    studentPackageId: string,
    input: CreateCreditRefundInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  reverseStudentPackageLedgerEntry(
    actor: TeachingActor,
    slug: string,
    studentPackageId: string,
    ledgerId: string,
    input: CreateCreditReversalInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listSessions(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getSession(actor: TeachingActor, slug: string, sessionId: string, requestId: string): Promise<JsonObject>;
  listLessonFeedback(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  createSession(
    actor: TeachingActor,
    slug: string,
    input: CreateSessionInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  saveAttendanceBatch(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
    input: AttendanceBatchInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  completeSession(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  cancelSession(
    actor: TeachingActor, slug: string, sessionId: string, input: SessionCancelInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listLeaveRequests(
    actor: TeachingActor, slug: string, sessionId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createLeaveRequest(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string,
    input: LeaveRequestInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  decideLeaveRequest(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string, leaveRequestId: string,
    input: LeaveDecisionInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  cancelLeaveRequest(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string, leaveRequestId: string,
    input: LeaveRequestInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listMakeupAttempts(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listMakeupCandidates(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  scheduleMakeup(
    actor: TeachingActor, slug: string, sessionId: string, attendanceId: string,
    input: MakeupScheduleInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listLearnerSessions(
    actor: TeachingActor, slug: string, studentId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listLearnerLeaveRequests(
    actor: TeachingActor, slug: string, studentId: string, sessionId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createLearnerLeaveRequest(
    actor: TeachingActor, slug: string, studentId: string, sessionId: string, attendanceId: string,
    input: LeaveRequestInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  cancelLearnerLeaveRequest(
    actor: TeachingActor, slug: string, studentId: string, sessionId: string, attendanceId: string,
    leaveRequestId: string, input: LeaveRequestInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  createLessonFeedback(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
    studentId: string,
    input: CreateLessonFeedbackInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listWeeklyReports(
    actor: TeachingActor,
    slug: string,
    filter: WeeklyReportFilter,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  getWeeklyReport(
    actor: TeachingActor,
    slug: string,
    reportId: string,
    requestId: string,
  ): Promise<JsonObject>;
  generateWeeklyReport(
    actor: TeachingActor,
    slug: string,
    input: GenerateTeachingWeeklyReportInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  publishWeeklyReport(
    actor: TeachingActor,
    slug: string,
    reportId: string,
    input: PublishTeachingWeeklyReportInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  createStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    input: CreateStudentAccountBindingInviteInput,
    requestId: string,
  ): Promise<MutationResult>;
  getCurrentStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    requestId: string,
  ): Promise<JsonObject>;
  revokeStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    inviteId: string,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  previewStudentAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeStudentAccountBindingInput,
    requestId: string,
  ): Promise<JsonObject>;
  consumeStudentAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeStudentAccountBindingInput,
    requestId: string,
  ): Promise<MutationResult>;
  createGuardianAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    guardianLinkId: string,
    input: CreateGuardianAccountBindingInviteInput,
    requestId: string,
  ): Promise<MutationResult>;
  getCurrentGuardianAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    guardianLinkId: string,
    requestId: string,
  ): Promise<JsonObject>;
  revokeGuardianAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    guardianLinkId: string,
    inviteId: string,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  previewGuardianAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeGuardianAccountBindingInput,
    requestId: string,
  ): Promise<JsonObject>;
  consumeGuardianAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeGuardianAccountBindingInput,
    requestId: string,
  ): Promise<MutationResult>;
  listLearningContexts(
    actor: TeachingActor,
    slug: string | null,
    requestId: string,
  ): Promise<JsonObject[]>;
  listConversations(
    actor: TeachingActor, slug: string, studentId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createConversation(
    actor: TeachingActor, slug: string, studentId: string,
    input: CreateTeachingConversationInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  getConversation(
    actor: TeachingActor, slug: string, studentId: string,
    conversationId: string, requestId: string,
  ): Promise<JsonObject>;
  listConversationMessages(
    actor: TeachingActor, slug: string, studentId: string,
    conversationId: string, pagination: ConversationMessagePageInput, requestId: string,
  ): Promise<{ items: JsonObject[]; afterSequence: number; nextAfterSequence: number; hasMore: boolean }>;
  replyConversation(
    actor: TeachingActor, slug: string, studentId: string, conversationId: string,
    input: ReplyTeachingConversationInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  markConversationRead(
    actor: TeachingActor, slug: string, studentId: string, conversationId: string,
    input: MarkTeachingConversationReadInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listLearnerWeeklyReports(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  getLearnerWeeklyReport(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    reportId: string,
    requestId: string,
  ): Promise<JsonObject>;
  listLearnerLessonFeedback(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  listSelfTrainingAssignments(
    actor: TeachingActor,
    slug: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  createSelfTrainingEvidence(
    actor: TeachingActor,
    slug: string,
    input: TrainingEvidenceV1,
    requestId: string,
  ): Promise<MutationResult>;
  listTrainingTemplates(
    actor: TeachingActor, slug: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  getTrainingTemplate(
    actor: TeachingActor, slug: string, templateId: string, requestId: string,
  ): Promise<JsonObject>;
  createTrainingTemplate(
    actor: TeachingActor, slug: string, input: CreateTrainingTemplateInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingTemplateVersions(
    actor: TeachingActor, slug: string, templateId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTrainingTemplateVersion(
    actor: TeachingActor, slug: string, templateId: string, input: CreateTrainingTemplateVersionInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveTrainingTemplate(
    actor: TeachingActor, slug: string, templateId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingAssignments(
    actor: TeachingActor, slug: string, filter: TrainingAssignmentFilter,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  getTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, requestId: string,
  ): Promise<JsonObject>;
  createTrainingAssignment(
    actor: TeachingActor, slug: string, input: WriteTrainingAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  reviseTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, input: WriteTrainingAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  publishTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  closeTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingAssignmentTargets(
    actor: TeachingActor, slug: string, assignmentId: string, filter: TrainingTargetFilter,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listTrainingTargetEvidence(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listTrainingTargetReviews(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTrainingTargetReview(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    input: CreateTrainingReviewInput, idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
}

export class TeachingApiException extends Error {
  constructor(
    readonly code: TeachingErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message);
    this.name = 'TeachingApiException';
  }
}

class ConcealedTeachingPermissionDeniedException extends TeachingApiException {
  readonly auditReason = 'PERMISSION_DENIED';

  constructor(message: string) {
    super('RESOURCE_NOT_FOUND', 404, message);
    this.name = 'ConcealedTeachingPermissionDeniedException';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function refundLedgerIdempotencyKey(idempotencyKey: string): string {
  return `refund:v1:${sha256(idempotencyKey)}`;
}

function reversalLedgerIdempotencyKey(ledgerId: string, idempotencyKey: string): string {
  return `reversal:v1:${ledgerId}:${sha256(idempotencyKey)}`;
}

function trainingReviewRequestHash(assignmentId: string, studentId: string, rawBody: string): string {
  return sha256(JSON.stringify([assignmentId, studentId, rawBody]));
}

const STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SELF_TRAINING_EVIDENCE_BACKFILL_MS = 30 * 24 * 60 * 60 * 1_000;

function assertOnlyKeys(body: JsonObject, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(body).find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in ${label}`);
  }
}

function parseStudentAccountBindingInviteInput(body: JsonObject): CreateStudentAccountBindingInviteInput {
  assertOnlyKeys(body, ['expiresInMinutes'], 'student account binding invite input');
  const expiresInMinutes = body.expiresInMinutes === undefined
    ? 60
    : requiredInteger(body, 'expiresInMinutes', 5, 1_440);
  return { expiresInMinutes };
}

function parseStudentAccountBindingConsumeInput(body: JsonObject): { token: string } {
  assertOnlyKeys(body, ['token'], 'student account binding consume input');
  const token = requiredString(body, 'token', 43);
  if (!STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN.test(token)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'token must be a 32-byte base64url value');
  }
  return { token };
}

function parseGuardianAccountBindingInviteInput(body: JsonObject): CreateGuardianAccountBindingInviteInput {
  assertOnlyKeys(body, ['expiresInMinutes'], 'guardian account binding invite input');
  const expiresInMinutes = body.expiresInMinutes === undefined
    ? 60
    : requiredInteger(body, 'expiresInMinutes', 5, 1_440);
  return { expiresInMinutes };
}

function parseGuardianAccountBindingConsumeInput(body: JsonObject): { token: string } {
  assertOnlyKeys(body, ['token'], 'guardian account binding consume input');
  const token = requiredString(body, 'token', 43);
  if (!STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN.test(token)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'token must be a 32-byte base64url value');
  }
  return { token };
}

function parseCreateConversationInput(body: JsonObject): CreateTeachingConversationInput {
  assertOnlyKeys(body, ['subject', 'body'], 'conversation create input');
  return {
    subject: requiredString(body, 'subject', 200),
    body: requiredString(body, 'body', 10_000),
  };
}

function parseReplyConversationInput(body: JsonObject): ReplyTeachingConversationInput {
  assertOnlyKeys(body, ['body'], 'conversation reply input');
  return { body: requiredString(body, 'body', 10_000) };
}

function parseMarkConversationReadInput(body: JsonObject): MarkTeachingConversationReadInput {
  assertOnlyKeys(body, ['lastReadSequence'], 'conversation read input');
  return { lastReadSequence: requiredInteger(body, 'lastReadSequence', 0, 2_147_483_647) };
}

function conversationMessagePaginationOf(c: Context): ConversationMessagePageInput {
  assertQueryKeys(c, ['afterSequence', 'limit']);
  const afterRaw = c.req.query('afterSequence');
  const limitRaw = c.req.query('limit');
  const afterSequence = afterRaw === undefined ? 0 : Number(afterRaw);
  const limit = limitRaw === undefined ? 50 : Number(limitRaw);
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || afterSequence > 2_147_483_647
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new TeachingApiException(
      'INVALID_INPUT', 400,
      'afterSequence must be a non-negative integer and limit must be 1 to 100',
    );
  }
  return { afterSequence, limit };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Canonical JSON does not accept undefined');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function canonicalTrainingEvidencePayload(input: TrainingEvidenceV1): JsonObject {
  return {
    schemaVersion: 1,
    source: input.source,
    sourceEventId: input.sourceEventId,
    occurredAt: input.occurredAt,
    activity: input.activity,
    durationMs: input.durationMs ?? null,
    metrics: input.metrics as JsonObject,
    payloadVersion: input.payloadVersion,
    payload: (input.payload ?? {}) as JsonObject,
    assignmentIds: input.assignmentIds ?? [],
  };
}

async function withRepeatableReadRetry<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await sql.begin('isolation level repeatable read', operation) as T;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code !== '40001' && code !== '40P01') || attempt === 4) {
        if (code === '40001' || code === '40P01') {
          throw new TeachingApiException('CONFLICT', 409, 'Concurrent training update; retry the complete request');
        }
        throw error;
      }
    }
  }
  throw new TeachingApiException('CONFLICT', 409, 'Concurrent training update; retry the complete request');
}

async function withWeeklyReportGenerateRetry<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  const retryableUniqueConstraints = new Set([
    'teaching_weekly_reports_revision_unique',
    'uq_teaching_weekly_reports_one_draft',
  ]);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await sql.begin('isolation level repeatable read', operation) as T;
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string; constraint_name?: string };
      const code = databaseError.code;
      const constraint = databaseError.constraint ?? databaseError.constraint_name;
      const generateRace = code === '23505'
        && constraint != null
        && retryableUniqueConstraints.has(constraint);
      if ((code !== '40001' && code !== '40P01' && !generateRace) || attempt === 4) {
        if (code === '40001' || code === '40P01' || generateRace) {
          throw new TeachingApiException('CONFLICT', 409, 'Concurrent weekly report update; retry the complete request');
        }
        throw error;
      }
    }
  }
  throw new TeachingApiException('CONFLICT', 409, 'Concurrent weekly report update; retry the complete request');
}

function requestIdOf(c: Context): string {
  const supplied = c.req.header('X-Request-ID')?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

function idempotencyKeyOf(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim() ?? '';
  if (!key) {
    throw new TeachingApiException('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  if (key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Idempotency-Key must be 1 to 200 visible ASCII characters');
  }
  return key;
}

function paginationOf(c: Context): PageInput {
  const pageRaw = c.req.query('page');
  const pageSizeRaw = c.req.query('pageSize');
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const pageSize = pageSizeRaw === undefined ? 30 : Number(pageSizeRaw);
  if (
    !Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'page must be positive and pageSize must be 1 to 100');
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function assertQueryKeys(c: Context, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = [...new URL(c.req.url).searchParams.keys()].find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in this query`);
  }
}

function trainingPaginationOf(c: Context, extra: readonly string[] = []): PageInput {
  assertQueryKeys(c, ['page', 'pageSize', ...extra]);
  return paginationOf(c);
}

async function jsonBody(c: Context, maxBytes?: number): Promise<{ value: JsonObject; raw: string }> {
  const raw = await c.req.text();
  if (maxBytes !== undefined && Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new TeachingApiException('INVALID_INPUT', 400, `Request body must not exceed ${maxBytes} bytes`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Request body must be valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Request body must be a JSON object');
  }
  return { value: value as JsonObject, raw };
}

function requiredString(body: JsonObject, key: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters`);
  }
  return trimmed;
}

function optionalString(body: JsonObject, key: string, maxLength: number): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters or null`);
  }
  return trimmed;
}

function requiredInteger(body: JsonObject, key: string, min: number, max: number): number {
  const value = body[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an integer from ${min} to ${max}`);
  }
  return value as number;
}

function requiredUuid(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a UUID`);
  }
  return value;
}

function optionalUuid(body: JsonObject, key: string): string | null {
  if (body[key] === undefined || body[key] === null) return null;
  return requiredUuid(body, key);
}

function uuidParam(value: string, key: string): string {
  return requiredUuid({ [key]: value }, key);
}

const PG_BIGINT_MAX = 9_223_372_036_854_775_807n;

function bigintParam(value: string, key: string): string {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > PG_BIGINT_MAX) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a positive PostgreSQL BIGINT decimal`);
  }
  return value;
}

function requiredTimestamp(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:(Z)|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an ISO 8601 timestamp with an offset`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zulu, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zulu ? 0 : Number(offsetHourText);
  const offsetMinute = zulu ? 0 : Number(offsetMinuteText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (
    year < 1 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  return date.toISOString();
}

function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'timezone must be a valid IANA time zone');
  }
  return value;
}

function parseOrganizationInput(body: JsonObject): CreateOrganizationInput {
  const slug = requiredString(body, 'slug', 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'slug must contain lowercase letters, numbers, or interior hyphens');
  }
  const name = requiredString(body, 'name', 160);
  const timezone = body.timezone === undefined ? 'Asia/Shanghai' : requiredString(body, 'timezone', 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'timezone must be a valid IANA time zone');
  }
  return { slug, name, timezone };
}

function parseMemberInput(body: JsonObject): CreateMemberInput {
  if (!Number.isSafeInteger(body.userId) || (body.userId as number) <= 0) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'userId must be a positive integer');
  }
  if (!isTeachingOrganizationRole(body.role) || body.role === 'owner') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'role must be admin, teacher, assistant, finance, or viewer');
  }
  return { userId: body.userId as number, role: body.role };
}

function parseStudentInput(body: JsonObject): CreateStudentInput {
  const displayName = requiredString(body, 'displayName', 160);
  const ref = body.externalRef;
  if (ref !== undefined && ref !== null && typeof ref !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'externalRef must be a string or null');
  }
  const externalRef = typeof ref === 'string' ? ref.trim() : null;
  if (externalRef !== null && (!externalRef || externalRef.length > 100)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'externalRef must be 1 to 100 characters or null');
  }
  return { displayName, externalRef };
}

function optionalNormalizedCode(body: JsonObject): string | null {
  const code = optionalString(body, 'code', 64)?.toLowerCase() ?? null;
  if (code !== null && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  return code;
}

function parseEffectiveRange(body: JsonObject): { effectiveFrom: string; effectiveTo: string | null } {
  const effectiveFrom = body.effectiveFrom === undefined
    ? new Date().toISOString()
    : requiredTimestamp(body, 'effectiveFrom');
  const effectiveTo = body.effectiveTo === undefined || body.effectiveTo === null
    ? null
    : requiredTimestamp(body, 'effectiveTo');
  if (effectiveTo !== null && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'effectiveTo must be after effectiveFrom');
  }
  return { effectiveFrom, effectiveTo };
}

function parseCampusInput(body: JsonObject): CreateCampusInput {
  const timezone = optionalString(body, 'timezone', 64);
  return {
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
    timezone: timezone === null ? null : validTimezone(timezone),
  };
}

function parseGroupInput(body: JsonObject): CreateGroupInput {
  return {
    campusId: optionalUuid(body, 'campusId'),
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
  };
}

function parseStudentGroupMembershipInput(body: JsonObject): CreateStudentGroupMembershipInput {
  return {
    studentId: requiredUuid(body, 'studentId'),
    ...parseEffectiveRange(body),
  };
}

function parseTeacherAssignmentInput(body: JsonObject): CreateTeacherAssignmentInput {
  if (!Number.isSafeInteger(body.teacherUserId) || (body.teacherUserId as number) <= 0) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserId must be a positive integer');
  }
  const groupId = optionalUuid(body, 'groupId');
  const studentId = optionalUuid(body, 'studentId');
  if ((groupId === null) === (studentId === null)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'exactly one of groupId or studentId is required');
  }
  return {
    teacherUserId: body.teacherUserId as number,
    groupId,
    studentId,
    ...parseEffectiveRange(body),
  };
}

function teacherAssignmentTargetOf(c: Context): TeacherAssignmentTarget {
  const rawGroupId = c.req.query('groupId');
  const rawStudentId = c.req.query('studentId');
  if ((rawGroupId === undefined) === (rawStudentId === undefined)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'exactly one of groupId or studentId is required');
  }
  return {
    groupId: rawGroupId === undefined ? null : uuidParam(rawGroupId, 'groupId'),
    studentId: rawStudentId === undefined ? null : uuidParam(rawStudentId, 'studentId'),
  };
}

function parsePackageProductInput(body: JsonObject): CreatePackageProductInput {
  const code = requiredString(body, 'code', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  if (!TEACHING_CREDIT_UNITS.includes(body.creditUnit as TeachingCreditUnit)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditUnit must be lesson or minute');
  }
  const creditType = requiredString(body, 'creditType', 64).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(creditType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditType must be a normalized identifier');
  }
  const validityDays = body.validityDays == null
    ? null
    : requiredInteger(body, 'validityDays', 1, 36_500);
  const currency = requiredString(body, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'currency must be a three-letter ISO currency code');
  }
  return {
    code,
    name: requiredString(body, 'name', 160),
    creditUnit: body.creditUnit as TeachingCreditUnit,
    creditType,
    totalCredits: requiredInteger(body, 'totalCredits', 1, 1_000_000),
    validityDays,
    priceAmountMinor: requiredInteger(body, 'priceAmountMinor', 0, Number.MAX_SAFE_INTEGER),
    currency,
  };
}

function parseStudentPackageInput(body: JsonObject): CreateStudentPackageInput {
  if (!TEACHING_PACKAGE_ACQUISITION_TYPES.includes(body.acquisitionType as TeachingPackageAcquisitionType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'acquisitionType must be purchase, grant, or migration');
  }
  const sourceSystem = optionalString(body, 'sourceSystem', 64);
  const sourceRef = optionalString(body, 'sourceRef', 160);
  const sourceLineRef = optionalString(body, 'sourceLineRef', 160);
  if ((sourceSystem === null) !== (sourceRef === null) || (sourceLineRef !== null && sourceSystem === null)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'sourceSystem and sourceRef must be provided together');
  }
  return {
    productId: requiredUuid(body, 'productId'),
    acquisitionType: body.acquisitionType as TeachingPackageAcquisitionType,
    validFrom: body.validFrom === undefined ? new Date().toISOString() : requiredTimestamp(body, 'validFrom'),
    sourceSystem,
    sourceRef,
    sourceLineRef,
  };
}

function parseCreditRefundInput(body: JsonObject): CreateCreditRefundInput {
  assertOnlyKeys(
    body,
    ['credits', 'reason', 'sourceSystem', 'sourceRef', 'sourceLineRef'],
    'credit refund input',
  );
  return {
    credits: requiredInteger(body, 'credits', 1, 1_000_000),
    reason: requiredString(body, 'reason', 500),
    sourceSystem: requiredString(body, 'sourceSystem', 64),
    sourceRef: requiredString(body, 'sourceRef', 160),
    sourceLineRef: optionalString(body, 'sourceLineRef', 160),
  };
}

function parseCreditReversalInput(body: JsonObject): CreateCreditReversalInput {
  assertOnlyKeys(body, ['reason'], 'credit reversal input');
  return { reason: requiredString(body, 'reason', 500) };
}

function parseSessionInput(body: JsonObject): CreateSessionInput {
  const startsAt = requiredTimestamp(body, 'startsAt');
  const endsAt = requiredTimestamp(body, 'endsAt');
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'endsAt must be after startsAt');
  }
  const rawTeacherIds = body.teacherUserIds ?? [];
  if (!Array.isArray(rawTeacherIds) || rawTeacherIds.length > 20) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must contain at most 20 user IDs');
  }
  const teacherUserIds = rawTeacherIds.map((value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must contain positive integers');
    }
    return value;
  });
  if (new Set(teacherUserIds).size !== teacherUserIds.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must not contain duplicates');
  }
  const rawAttendees = body.attendees ?? [];
  if (!Array.isArray(rawAttendees) || rawAttendees.length > 500) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'attendees must contain at most 500 records');
  }
  const attendees = rawAttendees.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `attendees[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    return {
      studentId: requiredUuid(item, 'studentId'),
      studentPackageId: requiredUuid(item, 'studentPackageId'),
      creditCost: requiredInteger(item, 'creditCost', 1, 1_000_000),
    };
  });
  if (new Set(attendees.map((item) => item.studentId)).size !== attendees.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'attendees must not repeat a student');
  }
  return {
    title: requiredString(body, 'title', 160),
    startsAt,
    endsAt,
    timezone: body.timezone === undefined ? null : validTimezone(requiredString(body, 'timezone', 64)),
    teacherUserIds,
    attendees,
  };
}

function parseAttendanceBatchInput(body: JsonObject): AttendanceBatchInput {
  assertOnlyKeys(body, ['records'], 'attendance batch input');
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 500) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must contain 1 to 500 attendance updates');
  }
  const records = body.records.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `records[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    assertOnlyKeys(item, ['attendanceId', 'status'], `records[${index}]`);
    if (!['present', 'late', 'absent'].includes(String(item.status))) {
      throw new TeachingApiException(
        'INVALID_INPUT', 400,
        `records[${index}].status must be present, late, or absent; excused requires leave approval`,
      );
    }
    return {
      attendanceId: requiredUuid(item, 'attendanceId'),
      status: item.status as Extract<TeachingAttendanceStatus, 'present' | 'late' | 'absent'>,
    };
  });
  if (new Set(records.map((item) => item.attendanceId)).size !== records.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must not repeat an attendanceId');
  }
  return { records };
}

function parseLeaveRequestInput(body: JsonObject): LeaveRequestInput {
  assertOnlyKeys(body, ['reason'], 'leave request input');
  return { reason: requiredString(body, 'reason', 500) };
}

function parseLeaveDecisionInput(body: JsonObject): LeaveDecisionInput {
  assertOnlyKeys(body, ['decision', 'reason'], 'leave decision input');
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'decision must be approved or rejected');
  }
  return { decision: body.decision, reason: requiredString(body, 'reason', 500) };
}

function parseMakeupScheduleInput(body: JsonObject): MakeupScheduleInput {
  assertOnlyKeys(body, ['targetSessionId', 'reason'], 'makeup schedule input');
  return {
    targetSessionId: requiredUuid(body, 'targetSessionId'),
    reason: requiredString(body, 'reason', 500),
  };
}

function parseSessionCancelInput(body: JsonObject): SessionCancelInput {
  assertOnlyKeys(body, ['reason'], 'session cancellation input');
  return { reason: requiredString(body, 'reason', 500) };
}

function parseLessonFeedbackInput(body: JsonObject): CreateLessonFeedbackInput {
  assertOnlyKeys(
    body,
    ['visibility', 'summary', 'strengths', 'challenges', 'nextGoals', 'internalNotes'],
    'lesson feedback input',
  );
  if (!TEACHING_FEEDBACK_VISIBILITIES.includes(body.visibility as TeachingFeedbackVisibility)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'visibility is not supported');
  }
  return {
    visibility: body.visibility as TeachingFeedbackVisibility,
    summary: requiredString(body, 'summary', 2_000),
    strengths: optionalString(body, 'strengths', 4_000),
    challenges: optionalString(body, 'challenges', 4_000),
    nextGoals: optionalString(body, 'nextGoals', 4_000),
    internalNotes: optionalString(body, 'internalNotes', 4_000),
  };
}

function requiredMonday(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an ISO date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid Monday`);
  }
  return value;
}

function parseGenerateWeeklyReportInput(body: JsonObject): GenerateTeachingWeeklyReportInput {
  assertOnlyKeys(body, ['studentId', 'weekStart'], 'weekly report generate input');
  return {
    studentId: requiredUuid(body, 'studentId'),
    weekStart: requiredMonday(body, 'weekStart'),
  };
}

function parsePublishWeeklyReportInput(body: JsonObject): PublishTeachingWeeklyReportInput {
  assertOnlyKeys(body, ['teacherSummary', 'nextWeekPlan', 'visibility'], 'weekly report publish input');
  if (!TEACHING_WEEKLY_REPORT_VISIBILITIES.includes(
    body.visibility as PublishTeachingWeeklyReportInput['visibility'],
  )) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'visibility is not supported');
  }
  return {
    teacherSummary: requiredString(body, 'teacherSummary', 5_000),
    nextWeekPlan: requiredString(body, 'nextWeekPlan', 5_000),
    visibility: body.visibility as PublishTeachingWeeklyReportInput['visibility'],
  };
}

function weeklyReportFilterOf(c: Context): WeeklyReportFilter {
  const rawStudentId = c.req.query('studentId');
  return { studentId: rawStudentId === undefined ? null : uuidParam(rawStudentId, 'studentId') };
}

function auditEventFilterOf(c: Context): AuditEventFilter {
  const qRaw = c.req.query('q');
  const q = qRaw === undefined ? null : qRaw.trim();
  if (q !== null && (q === '' || q.length > 100)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'q must be 1 to 100 characters after trimming');
  }
  const outcomeRaw = c.req.query('outcome');
  if (
    outcomeRaw !== undefined &&
    !TEACHING_AUDIT_OUTCOMES.includes(outcomeRaw as TeachingAuditOutcome)
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'outcome is not supported');
  }
  return {
    q,
    outcome: outcomeRaw === undefined ? null : outcomeRaw as TeachingAuditOutcome,
  };
}

function parseTrainingTemplateInput(body: JsonObject): CreateTrainingTemplateInput {
  assertOnlyKeys(body, ['name', 'description'], 'training template input');
  const description = body.description;
  if (typeof description !== 'string' || description.length > 4_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'description must be a string up to 4000 characters');
  }
  return { name: requiredString(body, 'name', 200), description };
}

function parseTrainingTemplateVersionInput(body: JsonObject): CreateTrainingTemplateVersionInput {
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

function requiredUuidArray(body: JsonObject, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value) || value.length > 100) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an array containing at most 100 UUIDs`);
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new TeachingApiException('INVALID_INPUT', 400, `${key}[${index}] must be a UUID`);
    }
    return uuidParam(entry, `${key}[${index}]`);
  });
  if (new Set(result).size !== result.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must not contain duplicates`);
  }
  return result.sort();
}

function parseTrainingAssignmentInput(body: JsonObject): WriteTrainingAssignmentInput {
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

function parseTrainingReviewInput(body: JsonObject): CreateTrainingReviewInput {
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

function trainingTargetFilterOf(c: Context): TrainingTargetFilter {
  const targetKind = c.req.query('targetKind');
  if (targetKind !== undefined && targetKind !== 'group' && targetKind !== 'student') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'targetKind must be group or student');
  }
  return { targetKind: targetKind ?? null } as TrainingTargetFilter;
}

function trainingAssignmentFilterOf(c: Context): TrainingAssignmentFilter {
  const status = c.req.query('status');
  if (status !== undefined && !TRAINING_ASSIGNMENT_STATUSES.includes(status as TrainingAssignmentStatus)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'status must be draft, published, or closed');
  }
  return { status: (status as TrainingAssignmentStatus | undefined) ?? null };
}

function asAccess(row: Record<string, unknown>): OrganizationAccess {
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

function requirePermission(access: OrganizationAccess, permission: TeachingPermission): void {
  if (!hasTeachingPermission(access.role, permission)) {
    throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
  }
}

type SessionAccessScope = 'organization' | 'assigned';
type ReportAccessScope = 'organization' | 'assigned';

function requireSessionScope(
  access: OrganizationAccess,
  permission: 'session:read' | 'session:manage' | 'feedback:read' | 'feedback:manage',
): SessionAccessScope {
  requirePermission(access, permission);
  if (access.role === 'owner' || access.role === 'admin') return 'organization';
  if (access.role === 'teacher' || access.role === 'assistant') return 'assigned';
  throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
}

function requireReportScope(
  access: OrganizationAccess,
  permission: 'report:read' | 'report:manage',
): ReportAccessScope {
  requirePermission(access, permission);
  if (access.role === 'owner' || access.role === 'admin') return 'organization';
  if (access.role === 'teacher' || access.role === 'assistant') return 'assigned';
  throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
}

function requireWritable(access: OrganizationAccess): void {
  if (access.status !== 'active') {
    throw new TeachingApiException('ORGANIZATION_SUSPENDED', 409, 'Organization is not active');
  }
}

async function accessForRead(actorUserId: number, slug: string): Promise<OrganizationAccess> {
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

async function accessForWrite(tx: Tx, actorUserId: number, slug: string): Promise<OrganizationAccess> {
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

async function lockStudentPackageForCreditMutation(
  tx: Tx,
  organizationId: string,
  studentPackageId: string,
): Promise<Record<string, unknown>> {
  const packages = await tx`
    SELECT p.*
    FROM student_packages p
    WHERE p.organization_id = ${organizationId} AND p.id = ${studentPackageId}
    FOR UPDATE OF p`;
  if (packages.length) return packages[0] as Record<string, unknown>;

  const existing = await tx`
    SELECT organization_id
    FROM student_packages
    WHERE id = ${studentPackageId}`;
  if (existing.length && String(existing[0].organization_id) !== organizationId) {
    throw new ConcealedTeachingPermissionDeniedException('Student package not found');
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
}

async function studentPackageCreditBalance(
  tx: Tx,
  organizationId: string,
  studentPackageId: string,
): Promise<number> {
  const rows = await tx`
    SELECT COALESCE(SUM(delta), 0)::bigint AS balance
    FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId} AND student_package_id = ${studentPackageId}`;
  return Number(rows[0]?.balance ?? 0);
}

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

async function withDeniedAccessAudit<T>(
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

async function beginIdempotency(
  tx: Tx,
  actorUserId: number,
  organizationId: string | null,
  operation: string,
  key: string,
  requestHash: string,
): Promise<{ id: number } | { replay: MutationResult }> {
  const scopeKey = organizationId ? `org:${organizationId}` : 'global';
  const idempotencyLockKey = `teaching-mutation:${actorUserId}:${operation}`;
  await tx`
    SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyLockKey}, 0))`;
  await tx`
    DELETE FROM teaching_idempotency_requests
    WHERE actor_user_id = ${actorUserId}
      AND scope_key = ${scopeKey}
      AND operation = ${operation}
      AND idempotency_key = ${key}
      AND expires_at <= NOW()`;
  await tx`
    DELETE FROM teaching_idempotency_requests
    WHERE id IN (
      SELECT id
      FROM teaching_idempotency_requests
      WHERE expires_at <= NOW()
      ORDER BY expires_at
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    )`;
  const inserted = await tx`
    INSERT INTO teaching_idempotency_requests (
      organization_id, actor_user_id, scope_key, operation, idempotency_key,
      request_hash, expires_at
    ) VALUES (
      ${organizationId}, ${actorUserId}, ${scopeKey}, ${operation}, ${key},
      ${requestHash}, NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (actor_user_id, scope_key, operation, idempotency_key) DO NOTHING
    RETURNING id`;
  if (inserted.length) return { id: Number(inserted[0].id) };

  const existing = await tx`
    SELECT id, request_hash, state, response_status, response_body
    FROM teaching_idempotency_requests
    WHERE actor_user_id = ${actorUserId}
      AND scope_key = ${scopeKey}
      AND operation = ${operation}
      AND idempotency_key = ${key}
    FOR UPDATE`;
  const row = existing[0] as Record<string, unknown> | undefined;
  if (!row || row.request_hash !== requestHash || row.state !== 'completed') {
    throw new TeachingApiException('IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was already used with a different request');
  }
  return {
    replay: {
      status: Number(row.response_status) as MutationStatus,
      body: row.response_body as JsonObject,
    },
  };
}

async function completeIdempotency(
  tx: Tx,
  id: number,
  result: MutationResult,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await tx`
    UPDATE teaching_idempotency_requests
    SET state = 'completed', response_status = ${result.status}, response_body = ${sql.json(result.body)},
        resource_type = ${resourceType}, resource_id = ${resourceId}, completed_at = NOW()
    WHERE id = ${id}`;
}

/**
 * Call this before opening the business transaction. Every mutation attempt,
 * including an idempotent replay, is charged in its own committed statement so
 * a rollback cannot erase the counter and no transaction nests a pool checkout.
 */
async function consumeMutationAttempt(
  actorUserId: number,
  operation: string,
  maxRequests: number,
  window: '1 minute' | '1 hour',
): Promise<void> {
  const rows = window === '1 minute'
    ? await query<Record<string, unknown>>(
        `INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) VALUES (?, ?, NOW(), 1, NOW())
         ON CONFLICT (actor_user_id, operation) DO UPDATE SET
           attempts = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
             ELSE teaching_mutation_rate_limits.attempts + 1
           END,
           window_started_at = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
             ELSE teaching_mutation_rate_limits.window_started_at
           END,
           updated_at = NOW()
         RETURNING attempts`,
        [actorUserId, operation],
      )
    : await query<Record<string, unknown>>(
        `INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) VALUES (?, ?, NOW(), 1, NOW())
         ON CONFLICT (actor_user_id, operation) DO UPDATE SET
           attempts = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
             ELSE teaching_mutation_rate_limits.attempts + 1
           END,
           window_started_at = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
             ELSE teaching_mutation_rate_limits.window_started_at
           END,
           updated_at = NOW()
         RETURNING attempts`,
        [actorUserId, operation],
      );
  if (Number(rows[0]?.attempts ?? 0) > maxRequests) {
    throw new TeachingApiException('RATE_LIMITED', 429, 'Too many teaching mutations; retry later');
  }
}

function uniqueConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') throw new TeachingApiException('CONFLICT', 409, message);
  throw error;
}

function crmConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505' || code === '23503' || code === '23514' || code === '23P01' || code === '55000') {
    throw new TeachingApiException('CONFLICT', 409, message);
  }
  if (code === '40001' || code === '40P01') {
    throw new TeachingApiException('CONFLICT', 409, 'Concurrent teaching update; retry the complete request');
  }
  throw error;
}

function hasOrganizationCrmScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function studentPackageToJson(row: Record<string, unknown>, remainingCredits: number): JsonObject {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    productId: String(row.product_id),
    productCode: String(row.product_code_snapshot),
    productName: String(row.product_name_snapshot),
    creditUnit: String(row.credit_unit),
    creditType: String(row.credit_type),
    entitledCredits: Number(row.entitled_credits),
    remainingCredits,
    validityDays: row.validity_days_snapshot == null ? null : Number(row.validity_days_snapshot),
    priceAmountMinor: Number(row.price_amount_minor),
    currency: String(row.currency),
    status: String(row.lifecycle_status),
    acquisitionType: String(row.acquisition_type),
    validFrom: iso(row.valid_from),
    validUntil: row.valid_until == null ? null : iso(row.valid_until),
    sourceSystem: row.source_system == null ? null : String(row.source_system),
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
    createdAt: iso(row.created_at),
  };
}

function creditLedgerEntryToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    entryType: String(row.entry_type),
    delta: Number(row.delta),
    attendanceId: row.attendance_id == null ? null : String(row.attendance_id),
    sessionId: row.session_id == null ? null : String(row.session_id),
    sourceSystem: row.source_system == null ? null : String(row.source_system),
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
    reversalOfLedgerId: row.reversal_of_ledger_id == null ? null : String(row.reversal_of_ledger_id),
    reversedByLedgerId: row.reversed_by_ledger_id == null ? null : String(row.reversed_by_ledger_id),
    reason: String(row.reason),
    actorRole: String(row.actor_role),
    actorDisplayName: String(row.actor_display_name),
    metadata: row.metadata as JsonValue,
    createdAt: iso(row.created_at),
  };
}

function creditAdjustmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    ledgerEntry: creditLedgerEntryToJson(row),
    student: {
      id: String(row.student_id),
      displayName: String(row.student_display_name),
    },
    studentPackage: {
      id: String(row.student_package_id),
      productCode: String(row.product_code_snapshot),
      productName: String(row.product_name_snapshot),
      creditUnit: String(row.credit_unit),
      creditType: String(row.credit_type),
    },
  };
}

function actorSnapshotToJson(row: Record<string, unknown>, prefix: string): JsonObject | null {
  const userId = row[`${prefix}_user_id_snapshot`];
  if (userId == null) return null;
  return {
    userId: String(userId),
    displayName: String(row[`${prefix}_display_name_snapshot`]),
    role: String(row[`${prefix}_role_snapshot`]),
    relationship: row[`${prefix}_relationship_snapshot`] == null
      ? null
      : String(row[`${prefix}_relationship_snapshot`]),
  };
}

function attendanceToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.attendance_id ?? row.id),
    studentId: String(row.student_id),
    studentPackageId: row.student_package_id == null ? null : String(row.student_package_id),
    status: String(row.attendance_status ?? row.status),
    creditCost: Number(row.credit_cost),
    notes: row.notes == null ? null : String(row.notes),
    updatedAt: new Date(String(row.attendance_updated_at ?? row.updated_at)).toISOString(),
  };
}

function leaveRequestToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    sessionId: String(row.session_id),
    attendanceId: String(row.attendance_id),
    studentId: String(row.student_id),
    status: String(row.status),
    reason: String(row.reason),
    decisionReason: row.decision_reason == null ? null : String(row.decision_reason),
    requestedBy: actorSnapshotToJson(row, 'requested_by'),
    decidedBy: actorSnapshotToJson(row, 'decided_by'),
    decidedAt: row.decided_at == null ? null : new Date(String(row.decided_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function makeupAttemptToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    sourceSessionId: String(row.source_session_id),
    sourceAttendanceId: String(row.source_attendance_id),
    targetSessionId: String(row.target_session_id),
    targetAttendanceId: String(row.target_attendance_id),
    studentId: String(row.student_id),
    studentPackageId: String(row.student_package_id),
    creditCost: Number(row.credit_cost),
    status: String(row.status),
    reason: String(row.reason),
    createdBy: actorSnapshotToJson(row, 'created_by'),
    resolvedBy: actorSnapshotToJson(row, 'resolved_by'),
    resolutionReason: row.resolution_reason == null ? null : String(row.resolution_reason),
    resolvedAt: row.resolved_at == null ? null : new Date(String(row.resolved_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function lessonFeedbackToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    internalNotes: row.internal_notes == null ? null : String(row.internal_notes),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    attendanceStatusSnapshot: String(row.attendance_status_snapshot),
    creditCostSnapshot: Number(row.credit_cost_snapshot),
    authorUserId: row.author_user_id == null ? null : Number(row.author_user_id),
    authorUserIdSnapshot: Number(row.author_user_id_snapshot),
    authorDisplayNameSnapshot: String(row.author_display_name_snapshot),
    authorRoleSnapshot: String(row.author_role_snapshot),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
  };
}

function weeklyReportToJson(row: Record<string, unknown>, includeAggregate: boolean): JsonObject {
  const report: JsonObject = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    studentExternalRefSnapshot: row.student_external_ref_snapshot == null
      ? null
      : String(row.student_external_ref_snapshot),
    weekStart: String(row.week_start),
    weekEnd: String(row.week_end),
    timezoneSnapshot: String(row.timezone_snapshot),
    revision: Number(row.revision),
    status: String(row.status),
    visibility: String(row.visibility),
    teacherSummary: String(row.teacher_summary),
    nextWeekPlan: String(row.next_week_plan),
    generatedByUserId: row.generated_by_user_id == null ? null : Number(row.generated_by_user_id),
    generatedByUserIdSnapshot: Number(row.generated_by_user_id_snapshot),
    generatedByDisplayNameSnapshot: String(row.generated_by_display_name_snapshot),
    generatedByRoleSnapshot: String(row.generated_by_role_snapshot),
    generatedAt: iso(row.generated_at),
    publishedByUserId: row.published_by_user_id == null ? null : Number(row.published_by_user_id),
    publishedByUserIdSnapshot: row.published_by_user_id_snapshot == null
      ? null
      : Number(row.published_by_user_id_snapshot),
    publishedByDisplayNameSnapshot: row.published_by_display_name_snapshot == null
      ? null
      : String(row.published_by_display_name_snapshot),
    publishedByRoleSnapshot: row.published_by_role_snapshot == null
      ? null
      : String(row.published_by_role_snapshot),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  if (includeAggregate) report.aggregate = row.aggregate as JsonObject;
  return report;
}

function studentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    accountUserId: row.account_user_id == null ? null : Number(row.account_user_id),
    externalRef: row.external_ref == null ? null : String(row.external_ref),
    displayName: String(row.display_name),
    status: String(row.status),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function campusToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    timezone: row.timezone == null ? null : String(row.timezone),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function groupToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    campusId: row.campus_id == null ? null : String(row.campus_id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function membershipToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    student: {
      id: String(row.student_id),
      displayName: String(row.student_display_name),
      externalRef: row.student_external_ref == null ? null : String(row.student_external_ref),
      status: String(row.student_status),
    },
  };
}

function assignmentToJson(row: Record<string, unknown>): JsonObject {
  const liveUserId = row.teacher_user_id == null ? null : Number(row.teacher_user_id);
  return {
    id: String(row.id),
    teacherUserId: liveUserId,
    teacherUserIdSnapshot: Number(row.teacher_user_id_snapshot),
    groupId: row.group_id == null ? null : String(row.group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    teacher: {
      userId: liveUserId,
      displayName: String(row.teacher_display_name_snapshot),
      role: String(row.teacher_role_snapshot),
      status: row.teacher_member_status == null ? null : String(row.teacher_member_status),
    },
  };
}

function trainingTemplateToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: String(row.description),
    status: String(row.status),
    latestVersionNumber: row.latest_version_number == null ? null : Number(row.latest_version_number),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function trainingTemplateVersionToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateId: String(row.template_id),
    versionNumber: Number(row.version_number),
    title: String(row.title),
    instructions: String(row.instructions),
    source: String(row.source),
    activity: String(row.activity),
    toolConfig: row.tool_config as JsonObject,
    publishedAt: iso(row.published_at),
  };
}

function trainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateVersionId: String(row.template_version_id),
    title: String(row.title),
    instructions: String(row.instructions),
    status: String(row.status),
    scheduleKind: String(row.schedule_kind),
    expectedCount: Number(row.expected_count),
    timezoneSnapshot: String(row.timezone_snapshot),
    startsAt: iso(row.starts_at),
    endsAt: row.ends_at == null ? null : iso(row.ends_at),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    closedAt: row.closed_at == null ? null : iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function trainingTargetToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    targetKind: String(row.target_kind),
    groupId: row.group_id == null ? null : String(row.group_id),
    sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    groupNameSnapshot: row.group_name_snapshot == null ? null : String(row.group_name_snapshot),
    studentDisplayNameSnapshot: row.student_display_name_snapshot == null
      ? null
      : String(row.student_display_name_snapshot),
    studentExternalRefSnapshot: row.student_external_ref_snapshot == null
      ? null
      : String(row.student_external_ref_snapshot),
    evidenceCount: String(row.evidence_count),
    firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
    lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
    latestReviewRevision: Number(row.latest_review_revision),
    latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
  };
}

function trainingGoalToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    metricKey: String(row.metric_key),
    operator: String(row.operator),
    targetValue: Number(row.target_value),
  };
}

function trainingReviewToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    reviewerUserId: row.reviewer_user_id == null ? null : Number(row.reviewer_user_id),
    reviewerUserIdSnapshot: Number(row.reviewer_user_id_snapshot),
    reviewerDisplayNameSnapshot: String(row.reviewer_display_name_snapshot),
    reviewerRoleSnapshot: String(row.reviewer_role_snapshot),
    status: String(row.status),
    rating: row.rating == null ? null : Number(row.rating),
    feedback: String(row.feedback),
    createdAt: iso(row.created_at),
  };
}

function bindingInviteToJson(row: Record<string, unknown>): JsonObject {
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

function guardianBindingInviteToJson(row: Record<string, unknown>): JsonObject {
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

function learnerLessonFeedbackToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    attendanceStatusSnapshot: String(row.attendance_status_snapshot),
    authorDisplayNameSnapshot: String(row.author_display_name_snapshot),
    authorRoleSnapshot: String(row.author_role_snapshot),
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at),
  };
}

function learnerWeeklyReportToJson(row: Record<string, unknown>, includeAggregate: boolean): JsonObject {
  const report: JsonObject = {
    id: String(row.id),
    studentId: String(row.student_id),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    weekStart: String(row.week_start),
    weekEnd: String(row.week_end),
    timezoneSnapshot: String(row.timezone_snapshot),
    revision: Number(row.revision),
    status: 'published',
    visibility: String(row.visibility),
    teacherSummary: String(row.teacher_summary),
    nextWeekPlan: String(row.next_week_plan),
    publishedByDisplayNameSnapshot: String(row.published_by_display_name_snapshot),
    publishedByRoleSnapshot: String(row.published_by_role_snapshot),
    publishedAt: iso(row.published_at),
  };
  if (!includeAggregate) return report;

  const aggregate = row.aggregate as Record<string, JsonValue>;
  const lessonFeedback = aggregate.lessonFeedback as Record<string, JsonValue>;
  const visibleFeedback = Array.isArray(lessonFeedback.feedback)
    ? lessonFeedback.feedback.filter((item) => {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) return false;
        const visibility = (item as Record<string, JsonValue>).visibility;
        return visibility === 'student_and_guardians'
          || (row.is_self === true && visibility === 'student');
      })
    : [];
  report.aggregate = {
    ...aggregate,
    lessonFeedback: {
      ...lessonFeedback,
      feedbackCount: visibleFeedback.length,
      feedback: visibleFeedback,
    },
  };
  return report;
}

function selfTrainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    assignment: {
      id: String(row.assignment_id),
      organizationId: String(row.organization_id),
      templateVersionId: String(row.template_version_id),
      title: String(row.assignment_title),
      instructions: String(row.assignment_instructions),
      status: String(row.assignment_status),
      scheduleKind: String(row.schedule_kind),
      expectedCount: Number(row.expected_count),
      timezoneSnapshot: String(row.timezone_snapshot),
      startsAt: iso(row.starts_at),
      endsAt: row.ends_at == null ? null : iso(row.ends_at),
      publishedAt: row.published_at == null ? null : iso(row.published_at),
      closedAt: row.closed_at == null ? null : iso(row.closed_at),
      createdAt: iso(row.assignment_created_at),
      updatedAt: iso(row.assignment_updated_at),
    },
    target: {
      id: String(row.target_id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      targetKind: 'student',
      groupId: null,
      sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
      studentId: String(row.student_id),
      groupNameSnapshot: null,
      studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
      studentExternalRefSnapshot: row.student_external_ref_snapshot == null
        ? null
        : String(row.student_external_ref_snapshot),
      evidenceCount: String(row.evidence_count),
      firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
      lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
      latestReviewRevision: Number(row.latest_review_revision),
      latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
    },
    template: {
      id: String(row.template_id),
      name: String(row.template_name),
    },
    templateVersion: {
      id: String(row.template_version_id),
      organizationId: String(row.organization_id),
      templateId: String(row.template_id),
      versionNumber: Number(row.version_number),
      title: String(row.version_title),
      instructions: String(row.version_instructions),
      source: String(row.source),
      activity: String(row.activity),
      toolConfig: row.tool_config as JsonObject,
      publishedAt: iso(row.version_published_at),
    },
    goals: (row.goals as Array<Record<string, unknown>>).map((goal) => ({
      id: String(goal.id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      metricKey: String(goal.metricKey),
      operator: String(goal.operator),
      targetValue: Number(goal.targetValue),
    })),
  };
}

function trainingEvidenceToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    source: String(row.source),
    sourceEventId: String(row.source_event_id),
    trustLevel: String(row.trust_level),
    occurredAt: iso(row.occurred_at),
    timezoneSnapshot: String(row.timezone_snapshot),
    localDate: row.local_date instanceof Date
      ? row.local_date.toISOString().slice(0, 10)
      : String(row.local_date).slice(0, 10),
    activity: String(row.activity),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    resultMs: row.result_ms == null ? null : Number(row.result_ms),
    success: row.success == null ? null : Boolean(row.success),
    payloadVersion: Number(row.payload_version),
    createdAt: iso(row.created_at),
  };
}

function selfTrainingEvidenceReceipt(row: Record<string, unknown>): JsonObject {
  const evidence = trainingEvidenceToJson(row);
  return {
    id: evidence.id,
    source: evidence.source,
    sourceEventId: evidence.sourceEventId,
    trustLevel: evidence.trustLevel,
    occurredAt: evidence.occurredAt,
    localDate: evidence.localDate,
    durationMs: evidence.durationMs,
    resultMs: evidence.resultMs,
    success: evidence.success,
    createdAt: evidence.createdAt,
  };
}

interface BoundSelfStudent {
  organizationId: string;
  organizationName: string;
  organizationTimezone: string;
  studentId: string;
  studentDisplayName: string;
  accountLinkedAt: string;
  databaseNow: string;
}

async function boundSelfStudentForUpdate(
  tx: Tx,
  actorUserId: number,
  slug: string,
): Promise<BoundSelfStudent> {
  const actors = await tx`
    SELECT id FROM app_users WHERE id = ${actorUserId} FOR KEY SHARE`;
  if (!actors.length) {
    throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
  }
  const rows = await tx`
    SELECT o.id AS organization_id, o.name AS organization_name,
           o.timezone AS organization_timezone,
           student.id AS student_id, student.display_name AS student_display_name,
           student.account_linked_at, clock_timestamp() AS database_now
    FROM organizations o
    JOIN student_profiles student
      ON student.organization_id = o.id
     AND student.account_user_id = ${actorUserId}
    WHERE o.slug = ${slug}
      AND o.status = 'active'
      AND student.status = 'active'
    FOR UPDATE OF student`;
  if (!rows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Student account binding not found');
  }
  const row = rows[0] as Record<string, unknown>;
  return {
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    organizationTimezone: String(row.organization_timezone),
    studentId: String(row.student_id),
    studentDisplayName: String(row.student_display_name),
    accountLinkedAt: iso(row.account_linked_at),
    databaseNow: iso(row.database_now),
  };
}

const ACTIVE_STUDENT_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ?
      AND member.user_id = ?
      AND member.status = 'active'
      AND member.role IN ('teacher', 'assistant')
  ), scoped_student_ids AS (
    SELECT ta.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN student_profiles direct_student
      ON direct_student.organization_id = ta.organization_id AND direct_student.id = ta.student_id
    WHERE ta.organization_id = ?
      AND ta.student_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND direct_student.status = 'active'
    UNION
    SELECT membership.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = ta.organization_id AND teaching_group.id = ta.group_id
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = teaching_group.organization_id AND membership.group_id = teaching_group.id
    JOIN student_profiles group_student
      ON group_student.organization_id = membership.organization_id AND group_student.id = membership.student_id
    WHERE ta.organization_id = ?
      AND ta.group_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
      AND teaching_group.status = 'active'
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
      AND group_student.status = 'active'
  )`;

const ACTIVE_TRAINING_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ? AND member.user_id = ?
      AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
  ), scoped_group_ids AS (
    SELECT assignment.group_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    WHERE assignment.organization_id = ? AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
  ), scoped_student_ids AS (
    SELECT assignment.student_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id AND student.status = 'active'
    WHERE assignment.organization_id = ? AND assignment.student_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
    UNION
    SELECT membership.student_id
    FROM scoped_group_ids scoped_group
    JOIN student_group_memberships membership ON membership.group_id = scoped_group.id
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id AND student.status = 'active'
    WHERE membership.organization_id = ?
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
  )`;

function activeTrainingScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id, access.id];
}

function activeStudentScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id];
}

function hasOrganizationTrainingScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

async function actorHasActiveStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND EXISTS (
          SELECT 1 FROM student_profiles scoped_student
          WHERE scoped_student.organization_id = member.organization_id
            AND scoped_student.id = ${studentId}
            AND scoped_student.status = 'active'
        )
        AND (
          EXISTS (
            SELECT 1 FROM teacher_assignments direct_scope
            WHERE direct_scope.organization_id = member.organization_id
              AND direct_scope.teacher_user_id = member.user_id
              AND direct_scope.student_id = ${studentId}
              AND direct_scope.effective_from <= clock_timestamp()
              AND (direct_scope.effective_to IS NULL OR direct_scope.effective_to > clock_timestamp())
          )
          OR EXISTS (
            SELECT 1
            FROM teacher_assignments group_scope
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = group_scope.organization_id
             AND teaching_group.id = group_scope.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            JOIN student_group_memberships membership
              ON membership.organization_id = group_scope.organization_id
             AND membership.group_id = group_scope.group_id
             AND membership.student_id = ${studentId}
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            WHERE group_scope.organization_id = member.organization_id
              AND group_scope.teacher_user_id = member.user_id
              AND group_scope.effective_from <= clock_timestamp()
              AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          )
        )
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function actorHasActiveGroupScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments group_scope
        ON group_scope.organization_id = member.organization_id
       AND group_scope.teacher_user_id = member.user_id
       AND group_scope.group_id = ${groupId}
       AND group_scope.effective_from <= clock_timestamp()
       AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = group_scope.organization_id
       AND teaching_group.id = group_scope.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function touchTrainingRelationLock(
  tx: Tx,
  organizationId: string,
  relationKind: 'student_group' | 'teacher_group' | 'teacher_student',
  subjectKey: string,
  targetKey: string,
): Promise<void> {
  await tx`
    INSERT INTO teaching_relation_locks (
      organization_id, relation_kind, subject_key, target_key
    ) VALUES (${organizationId}, ${relationKind}, ${subjectKey}, ${targetKey})
    ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
    DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                  touched_at = clock_timestamp()`;
}

async function lockAndCheckTeacherGroupScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  groupId: string,
): Promise<boolean> {
  await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
  return actorHasActiveGroupScope(tx, access.id, actor.userId, groupId);
}

async function actorHasExactDirectStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.student_id = ${studentId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = assignment.organization_id
       AND student.id = assignment.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function actorHasExactGroupStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.group_id = ${groupId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = assignment.organization_id
       AND teaching_group.id = assignment.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      JOIN student_group_memberships membership
        ON membership.organization_id = assignment.organization_id
       AND membership.group_id = assignment.group_id
       AND membership.student_id = ${studentId}
       AND membership.effective_from <= clock_timestamp()
       AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = membership.organization_id
       AND student.id = membership.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function lockAndCheckTeacherStudentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  studentId: string,
): Promise<boolean> {
  const candidateRows = await tx`
    SELECT NULL::uuid AS group_id, 0 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.student_id = ${studentId}
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
    UNION ALL
    SELECT assignment.group_id, 1 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = assignment.organization_id
     AND membership.group_id = assignment.group_id
     AND membership.student_id = ${studentId}
     AND membership.effective_from <= clock_timestamp()
     AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ORDER BY priority, group_id NULLS FIRST
    LIMIT 1`;
  if (!candidateRows.length) return false;
  const groupId = candidateRows[0].group_id == null ? null : String(candidateRows[0].group_id);
  if (groupId === null) {
    await touchTrainingRelationLock(tx, access.id, 'teacher_student', String(actor.userId), studentId);
    return actorHasExactDirectStudentScope(tx, access.id, actor.userId, studentId);
  } else {
    await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
    await touchTrainingRelationLock(tx, access.id, 'student_group', studentId, groupId);
    return actorHasExactGroupStudentScope(tx, access.id, actor.userId, groupId, studentId);
  }
}

async function buildWeeklyReportAggregate(
  tx: Tx,
  access: OrganizationAccess,
  studentId: string,
  weekStart: string,
): Promise<JsonObject> {
  const attendanceRows = await tx`
    SELECT COUNT(*)::int AS session_count,
           COUNT(*) FILTER (WHERE session.status = 'completed')::int AS completed_session_count,
           COUNT(*) FILTER (WHERE attendance.status = 'present')::int AS present_count,
           COUNT(*) FILTER (WHERE attendance.status = 'late')::int AS late_count,
           COUNT(*) FILTER (WHERE attendance.status = 'absent')::int AS absent_count,
           COUNT(*) FILTER (WHERE attendance.status = 'excused')::int AS excused_count
    FROM attendance_records attendance
    JOIN teaching_sessions session
      ON session.organization_id = attendance.organization_id
     AND session.id = attendance.session_id
    WHERE attendance.organization_id = ${access.id}
      AND attendance.student_id = ${studentId}
      AND session.starts_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND session.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})`;
  const attendance = attendanceRows[0] as Record<string, unknown>;

  const creditRows = await tx`
    SELECT COUNT(*)::int AS ledger_entry_count,
           COALESCE(SUM(-delta) FILTER (WHERE entry_type = 'consume'), 0)::text AS consumed_credits,
           COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::text AS credited_credits,
           COALESCE(SUM(delta), 0)::text AS net_credit_delta
    FROM lesson_credit_ledger
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND created_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND created_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})`;
  const credits = creditRows[0] as Record<string, unknown>;

  const trainingRows = await tx`
    SELECT source, activity, trust_level,
           SUM(evidence_count)::text AS evidence_count,
           SUM(duration_ms)::text AS duration_ms,
           SUM(success_count)::text AS success_count
    FROM daily_training_rollups
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND local_date BETWEEN ${weekStart}::date AND (${weekStart}::date + 6)
    GROUP BY source, activity, trust_level
    ORDER BY source, activity, trust_level`;
  const trainingDayRows = await tx`
    SELECT COUNT(DISTINCT local_date)::int AS active_day_count
    FROM daily_training_rollups
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND local_date BETWEEN ${weekStart}::date AND (${weekStart}::date + 6)
      AND evidence_count > 0`;
  const dimensions = trainingRows.map((row) => ({
    source: String(row.source),
    activity: String(row.activity),
    trustLevel: String(row.trust_level),
    evidenceCount: String(row.evidence_count),
    durationMs: String(row.duration_ms),
    successCount: String(row.success_count),
  }));

  const assignmentRows = await tx`
    SELECT assignment.id, assignment.title, assignment.status, assignment.schedule_kind,
           assignment.expected_count, assignment.starts_at, assignment.ends_at,
           target.evidence_count, target.latest_review_revision, target.latest_review_status
    FROM training_assignment_targets target
    JOIN training_assignments assignment
      ON assignment.organization_id = target.organization_id
     AND assignment.id = target.assignment_id
    WHERE target.organization_id = ${access.id}
      AND target.student_id = ${studentId}
      AND target.target_kind = 'student'
      AND assignment.status IN ('published', 'closed')
      AND assignment.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})
      AND (assignment.ends_at IS NULL
        OR assignment.ends_at > (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone}))
    ORDER BY assignment.starts_at, assignment.id`;
  const assignments = assignmentRows.map((row) => ({
    assignmentId: String(row.id),
    title: String(row.title),
    status: String(row.status),
    scheduleKind: String(row.schedule_kind),
    expectedCount: Number(row.expected_count),
    evidenceCount: String(row.evidence_count),
    latestReviewRevision: Number(row.latest_review_revision),
    latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
    startsAt: iso(row.starts_at),
    endsAt: row.ends_at == null ? null : iso(row.ends_at),
  }));

  const feedbackRows = await tx`
    SELECT DISTINCT ON (feedback.session_id)
           feedback.id, feedback.session_id, feedback.revision, feedback.visibility,
           feedback.summary, feedback.strengths, feedback.challenges, feedback.next_goals,
           feedback.published_at, feedback.created_at
    FROM lesson_feedback feedback
    JOIN teaching_sessions session
      ON session.organization_id = feedback.organization_id
     AND session.id = feedback.session_id
    WHERE feedback.organization_id = ${access.id}
      AND feedback.student_id = ${studentId}
      AND feedback.visibility IN ('student', 'student_and_guardians')
      AND session.starts_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND session.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})
    ORDER BY feedback.session_id, feedback.revision DESC`;
  const feedback = feedbackRows.map((row) => ({
    feedbackId: String(row.id),
    sessionId: String(row.session_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
  }));

  const sumDimension = (key: 'evidenceCount' | 'durationMs' | 'successCount'): string =>
    dimensions.reduce((total, dimension) => total + BigInt(dimension[key]), 0n).toString();
  return {
    attendance: {
      sessionCount: Number(attendance.session_count),
      completedSessionCount: Number(attendance.completed_session_count),
      presentCount: Number(attendance.present_count),
      lateCount: Number(attendance.late_count),
      absentCount: Number(attendance.absent_count),
      excusedCount: Number(attendance.excused_count),
    },
    credits: {
      ledgerEntryCount: Number(credits.ledger_entry_count),
      consumedCredits: String(credits.consumed_credits),
      creditedCredits: String(credits.credited_credits),
      netCreditDelta: String(credits.net_credit_delta),
    },
    training: {
      activeDayCount: Number(trainingDayRows[0]?.active_day_count ?? 0),
      evidenceCount: sumDimension('evidenceCount'),
      durationMs: sumDimension('durationMs'),
      successCount: sumDimension('successCount'),
      dimensions,
    },
    assignments: { assignmentCount: assignments.length, assignments },
    lessonFeedback: { feedbackCount: feedback.length, feedback },
  };
}

async function trainingAssignmentEnvelope(
  tx: Tx,
  organizationId: string,
  assignmentId: string,
): Promise<JsonObject> {
  const assignments = await tx`
    SELECT assignment.*, version.id AS version_id, version.template_id,
           version.version_number, version.title AS version_title,
           version.instructions AS version_instructions, version.source,
           version.activity, version.tool_config, version.published_at AS version_published_at
    FROM training_assignments assignment
    JOIN training_template_versions version
      ON version.organization_id = assignment.organization_id
     AND version.id = assignment.template_version_id
    WHERE assignment.organization_id = ${organizationId}
      AND assignment.id = ${assignmentId}`;
  if (!assignments.length) {
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment not found');
  }
  const goals = await tx`
    SELECT * FROM training_assignment_goal_metrics
    WHERE organization_id = ${organizationId} AND assignment_id = ${assignmentId}
    ORDER BY metric_key`;
  const row = assignments[0] as Record<string, unknown>;
  return {
    assignment: trainingAssignmentToJson(row),
    templateVersion: trainingTemplateVersionToJson({
      id: row.version_id,
      organization_id: row.organization_id,
      template_id: row.template_id,
      version_number: row.version_number,
      title: row.version_title,
      instructions: row.version_instructions,
      source: row.source,
      activity: row.activity,
      tool_config: row.tool_config,
      published_at: row.version_published_at,
    }),
    goals: goals.map((goal) => trainingGoalToJson(goal as Record<string, unknown>)),
  };
}

async function trainingResourceMissing(
  tx: Tx,
  table: 'training_templates' | 'training_assignments',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_templates'
    ? await tx`SELECT 1 FROM training_templates WHERE id = ${id}`
    : await tx`SELECT 1 FROM training_assignments WHERE id = ${id}`;
  if (rows.length) throw new ConcealedTeachingPermissionDeniedException(message);
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

async function trainingSelectorMissing(
  tx: Tx,
  access: OrganizationAccess,
  table: 'training_template_versions' | 'teaching_groups' | 'student_profiles',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_template_versions'
    ? await tx`SELECT organization_id FROM training_template_versions WHERE id = ${id}`
    : table === 'teaching_groups'
      ? await tx`SELECT organization_id FROM teaching_groups WHERE id = ${id}`
      : await tx`SELECT organization_id FROM student_profiles WHERE id = ${id}`;
  if (rows.length && String(rows[0].organization_id) !== access.id) {
    throw new ConcealedTeachingPermissionDeniedException(message);
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

async function assertTrainingAssignmentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  assignment: Record<string, unknown>,
  mode: 'read' | 'manage',
): Promise<void> {
  if (hasOrganizationTrainingScope(access.role)) return;
  const selectors = await tx`
    SELECT target_kind, group_id, student_id, source_group_id
    FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND (target_kind = 'group' OR source_group_id IS NULL)
    ORDER BY target_kind, COALESCE(group_id, student_id)`;
  if (mode === 'manage') {
    if (access.role !== 'teacher') {
      throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    for (const selector of selectors) {
      const allowed = selector.target_kind === 'group'
        ? await lockAndCheckTeacherGroupScope(tx, access, actor, String(selector.group_id))
        : await lockAndCheckTeacherStudentScope(tx, access, actor, String(selector.student_id));
      if (!allowed) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    if (!selectors.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    return;
  }
  for (const selector of selectors) {
    const allowed = selector.target_kind === 'group'
      ? await actorHasActiveGroupScope(tx, access.id, actor.userId, String(selector.group_id))
      : await actorHasActiveStudentScope(tx, access.id, actor.userId, String(selector.student_id));
    if (allowed) return;
  }
  const expanded = await tx`
    SELECT student_id FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND target_kind = 'student' AND source_group_id IS NOT NULL
    ORDER BY student_id`;
  for (const target of expanded) {
    if (await actorHasActiveStudentScope(tx, access.id, actor.userId, String(target.student_id))) return;
  }
  throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
}

async function replaceTrainingAssignmentDraft(
  tx: Tx,
  access: OrganizationAccess,
  assignmentId: string,
  input: WriteTrainingAssignmentInput,
): Promise<void> {
  await tx`DELETE FROM training_assignment_goal_metrics
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  await tx`DELETE FROM training_assignment_targets
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  for (const groupId of input.groupIds) {
    const groups = await tx`SELECT name FROM teaching_groups
      WHERE organization_id = ${access.id} AND id = ${groupId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, group_id, group_name_snapshot
    ) VALUES (${access.id}, ${assignmentId}, 'group', ${groupId}, ${String(groups[0].name)})`;
  }
  for (const studentId of input.studentIds) {
    const students = await tx`SELECT display_name, external_ref FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, student_id,
      student_display_name_snapshot, student_external_ref_snapshot
    ) VALUES (
      ${access.id}, ${assignmentId}, 'student', ${studentId},
      ${String(students[0].display_name)}, ${students[0].external_ref == null ? null : String(students[0].external_ref)}
    )`;
  }
  for (const goal of input.goals) {
    await tx`INSERT INTO training_assignment_goal_metrics (
      organization_id, assignment_id, metric_key, operator, target_value
    ) VALUES (${access.id}, ${assignmentId}, ${goal.metricKey}, ${goal.operator}, ${goal.targetValue})`;
  }
}

async function insertTrainingAudit(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
  metadata: JsonObject,
): Promise<void> {
  await tx`INSERT INTO teaching_audit_events (
    organization_id, actor_user_id, actor_role, actor_display_name,
    action, entity_type, entity_id, request_id, metadata
  ) VALUES (
    ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
    ${action}, ${entityType}, ${entityId}, ${requestId}, ${sql.json(metadata)}
  )`;
}

async function lockAndValidateTrainingSelectors(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  input: WriteTrainingAssignmentInput,
): Promise<Record<string, unknown>> {
  const versions = await tx`
    SELECT version.*, template.status AS template_status
    FROM training_template_versions version
    JOIN training_templates template
      ON template.organization_id = version.organization_id
     AND template.id = version.template_id
    WHERE version.organization_id = ${access.id}
      AND version.id = ${input.templateVersionId}
    FOR UPDATE OF template`;
  if (!versions.length || versions[0].template_status !== 'active') {
    await trainingSelectorMissing(
      tx, access, 'training_template_versions', input.templateVersionId,
      'Training template version not found',
    );
  }
  const version = versions[0] as Record<string, unknown>;
  for (const goal of input.goals) {
    if (!isTrainingGoalRegistered(
      String(version.source) as TrainingEvidenceSource,
      String(version.activity),
      goal.metricKey,
      goal.operator,
    )) {
      throw new TeachingApiException('INVALID_INPUT', 400, `${goal.metricKey}/${goal.operator} is not registered for this training activity`);
    }
  }
  for (const groupId of input.groupIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherGroupScope(tx, access, actor, groupId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training group selector not found');
    }
    const groups = await tx`
      SELECT teaching_group.id
      FROM teaching_groups teaching_group
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      WHERE teaching_group.organization_id = ${access.id}
        AND teaching_group.id = ${groupId}
        AND teaching_group.status = 'active'
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
      FOR UPDATE OF teaching_group`;
    if (!groups.length) {
      await trainingSelectorMissing(tx, access, 'teaching_groups', groupId, 'Training group selector not found');
    }
  }
  for (const studentId of input.studentIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training student selector not found');
    }
    const students = await tx`
      SELECT id FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
      FOR UPDATE`;
    if (!students.length) {
      await trainingSelectorMissing(tx, access, 'student_profiles', studentId, 'Training student selector not found');
    }
  }
  return version;
}

interface ConversationActorScope {
  organization: Pick<OrganizationAccess, 'id' | 'slug' | 'name' | 'timezone' | 'status' | 'version'>;
  student: { id: string; displayName: string };
  actorOwnerKey: string;
  role: TeachingConversationActorRole;
  relationship: string | null;
  staffAccess: OrganizationAccess | null;
}

function conversationDisplayName(actor: TeachingActor, scope: ConversationActorScope): string {
  const displayName = actor.displayName.trim();
  if (displayName) return displayName;
  if (scope.role === 'student') return scope.student.displayName;
  return scope.role === 'guardian' ? 'Guardian' : 'Staff';
}

async function lockConversationActorScope(
  tx: Tx,
  actor: TeachingActor,
  slug: string,
  studentId: string,
  mode: 'read' | 'write',
): Promise<ConversationActorScope> {
  const actorRows = await tx`
    SELECT COALESCE(NULLIF(wca_id, ''), 'u' || id::text) AS owner_key
    FROM app_users
    WHERE id = ${actor.userId}
    FOR KEY SHARE`;
  if (!actorRows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  const actorOwnerKey = String(actorRows[0].owner_key);
  const contextRows = await tx`
    SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version,
           student.id AS student_id, student.display_name, student.account_user_id
    FROM organizations o
    JOIN student_profiles student ON student.organization_id = o.id
    WHERE o.slug = ${slug} AND student.id = ${studentId} AND student.status = 'active'
    FOR SHARE OF o, student`;
  if (!contextRows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  const row = contextRows[0] as Record<string, unknown>;
  const organization = {
    id: String(row.id), slug: String(row.slug), name: String(row.name),
    timezone: String(row.timezone), status: row.status as OrganizationAccess['status'],
    version: Number(row.version),
  };
  const student = { id: String(row.student_id), displayName: String(row.display_name) };
  const memberRows = await tx`
    SELECT role FROM organization_members
    WHERE organization_id = ${organization.id} AND user_id = ${actor.userId} AND status = 'active'
    FOR SHARE`;
  const memberRole = memberRows[0]?.role;
  if (isTeachingOrganizationRole(memberRole)) {
    const staffAccess: OrganizationAccess = { ...organization, role: memberRole };
    if (mode === 'write' && organization.status !== 'active') {
      throw new TeachingApiException('ORGANIZATION_SUSPENDED', 409, 'Organization is not active');
    }
    if (memberRole === 'owner' || memberRole === 'admin') {
      return {
        organization, student, actorOwnerKey,
        role: memberRole, relationship: null, staffAccess,
      };
    }
    if ((memberRole === 'teacher' || memberRole === 'assistant')
        && await lockAndCheckTeacherStudentScope(tx, staffAccess, actor, studentId)) {
      return {
        organization, student, actorOwnerKey,
        role: memberRole, relationship: null, staffAccess,
      };
    }
  }
  if (organization.status !== 'active') {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  if (row.account_user_id != null && Number(row.account_user_id) === actor.userId) {
    return {
      organization, student, actorOwnerKey,
      role: 'student', relationship: null, staffAccess: null,
    };
  }
  const guardianRows = await tx`
    SELECT relationship
    FROM guardian_links
    WHERE organization_id = ${organization.id}
      AND student_id = ${studentId}
      AND guardian_user_id = ${actor.userId}
      AND status = 'active'
    ORDER BY id
    LIMIT 1
    FOR SHARE`;
  if (guardianRows.length) {
    return {
      organization, student, actorOwnerKey, role: 'guardian',
      relationship: String(guardianRows[0].relationship), staffAccess: null,
    };
  }
  throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
}

async function lockManagedSession(
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

async function lockManagedCancellationGraph(
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

function requireLearnerScope(scope: ConversationActorScope): void {
  if (scope.staffAccess !== null || (scope.role !== 'student' && scope.role !== 'guardian')) {
    throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
  }
}

function conversationRow(row: Record<string, unknown>): JsonObject {
  const lastMessageSequence = Number(row.last_message_sequence);
  const lastReadSequence = Number(row.last_read_sequence ?? 0);
  return {
    id: String(row.id),
    organization: { slug: String(row.organization_slug), name: String(row.organization_name) },
    student: { id: String(row.student_id), displayName: String(row.student_display_name_snapshot) },
    subject: String(row.subject),
    lastMessageSequence,
    lastMessageAt: iso(row.last_message_at),
    createdAt: iso(row.created_at),
    createdBy: {
      displayName: String(row.created_by_display_name_snapshot),
      role: String(row.created_by_role_snapshot),
      relationship: row.created_by_relationship_snapshot == null
        ? null : String(row.created_by_relationship_snapshot),
    },
    lastReadSequence,
    unreadCount: Math.max(0, lastMessageSequence - lastReadSequence),
  };
}

function conversationMessageRow(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    sequence: Number(row.sequence),
    body: String(row.body),
    author: {
      displayName: String(row.author_display_name_snapshot),
      role: String(row.author_role_snapshot),
      relationship: row.author_relationship_snapshot == null
        ? null : String(row.author_relationship_snapshot),
    },
    createdAt: iso(row.created_at),
  };
}

async function conversationRecipients(
  tx: Tx,
  scope: ConversationActorScope,
  excludedUserId: number,
): Promise<Array<Record<string, unknown>>> {
  const rows = await tx`
    WITH eligible AS (
      SELECT member.user_id, member.role::text AS role, NULL::text AS relationship,
             app.display_name, app.wca_id, 0 AS priority
      FROM organization_members member
      JOIN app_users app ON app.id = member.user_id
      WHERE member.organization_id = ${scope.organization.id}
        AND member.status = 'active'
        AND member.role IN ('owner', 'admin')
      UNION ALL
      SELECT member.user_id, member.role::text, NULL::text,
             app.display_name, app.wca_id, 1
      FROM organization_members member
      JOIN app_users app ON app.id = member.user_id
      WHERE member.organization_id = ${scope.organization.id}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (
          EXISTS (
            SELECT 1 FROM teacher_assignments assignment
            WHERE assignment.organization_id = member.organization_id
              AND assignment.teacher_user_id = member.user_id
              AND assignment.student_id = ${scope.student.id}
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
          ) OR EXISTS (
            SELECT 1
            FROM teacher_assignments assignment
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            JOIN student_group_memberships membership
              ON membership.organization_id = assignment.organization_id
             AND membership.group_id = assignment.group_id
             AND membership.student_id = ${scope.student.id}
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            WHERE assignment.organization_id = member.organization_id
              AND assignment.teacher_user_id = member.user_id
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          )
        )
      UNION ALL
      SELECT student.account_user_id, 'student', NULL::text,
             app.display_name, app.wca_id, 2
      FROM student_profiles student
      JOIN app_users app ON app.id = student.account_user_id
      WHERE student.organization_id = ${scope.organization.id}
        AND student.id = ${scope.student.id}
        AND student.status = 'active'
      UNION ALL
      SELECT guardian.guardian_user_id, 'guardian', guardian.relationship,
             app.display_name, app.wca_id, 3
      FROM guardian_links guardian
      JOIN app_users app ON app.id = guardian.guardian_user_id
      WHERE guardian.organization_id = ${scope.organization.id}
        AND guardian.student_id = ${scope.student.id}
        AND guardian.status = 'active'
    )
    SELECT DISTINCT ON (user_id)
      user_id, role, relationship,
      COALESCE(NULLIF(btrim(display_name), ''),
        CASE WHEN role = 'student' THEN ${scope.student.displayName}
             WHEN role = 'guardian' THEN 'Guardian' ELSE 'Staff' END) AS display_name,
      COALESCE(NULLIF(wca_id, ''), 'u' || user_id::text) AS owner_key
    FROM eligible
    WHERE user_id <> ${excludedUserId}
    ORDER BY user_id, priority`;
  return rows as unknown as Array<Record<string, unknown>>;
}

async function lockConversationRecipientUsers(
  tx: Tx,
  recipients: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const live = new Set<number>();
  const userIds = [...new Set(recipients.map((recipient) => Number(recipient.user_id)))]
    .sort((left, right) => left - right);
  for (const userId of userIds) {
    const rows = await tx`SELECT id FROM app_users WHERE id = ${userId} FOR KEY SHARE`;
    if (rows.length) live.add(userId);
  }
  return recipients.filter((recipient) => live.has(Number(recipient.user_id)));
}

async function upsertConversationParticipant(
  tx: Tx,
  scope: ConversationActorScope,
  conversationId: string,
  userId: number,
  displayName: string,
  role: TeachingConversationActorRole,
  relationship: string | null,
  lastReadSequence: number,
): Promise<number> {
  const rows = await tx`
    INSERT INTO teaching_conversation_participants (
      organization_id, conversation_id, student_id, participant_user_id,
      participant_display_name_snapshot, participant_role_snapshot,
      participant_relationship_snapshot, last_read_sequence
    ) VALUES (
      ${scope.organization.id}, ${conversationId}, ${scope.student.id}, ${userId},
      ${displayName}, ${role}, ${relationship}, ${lastReadSequence}
    )
    ON CONFLICT (organization_id, conversation_id, participant_user_id)
      WHERE participant_user_id IS NOT NULL
    DO UPDATE SET last_read_sequence = GREATEST(
      teaching_conversation_participants.last_read_sequence,
      EXCLUDED.last_read_sequence
    )
    RETURNING last_read_sequence`;
  return Number(rows[0].last_read_sequence);
}

async function appendConversationMessage(
  tx: Tx,
  actor: TeachingActor,
  scope: ConversationActorScope,
  conversationId: string,
  subject: string,
  body: string,
  recipients: Array<Record<string, unknown>>,
): Promise<{ message: JsonObject; lastMessageSequence: number; lastMessageAt: string }> {
  const allocated = await tx`
    UPDATE teaching_conversations
    SET last_message_sequence = last_message_sequence + 1,
        last_message_at = clock_timestamp()
    WHERE organization_id = ${scope.organization.id}
      AND id = ${conversationId}
      AND student_id = ${scope.student.id}
    RETURNING last_message_sequence, last_message_at`;
  if (!allocated.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
  }
  const sequence = Number(allocated[0].last_message_sequence);
  const displayName = conversationDisplayName(actor, scope);
  const messages = await tx`
    INSERT INTO teaching_conversation_messages (
      organization_id, conversation_id, student_id, sequence, body,
      author_user_id, author_display_name_snapshot, author_role_snapshot,
      author_relationship_snapshot
    ) VALUES (
      ${scope.organization.id}, ${conversationId}, ${scope.student.id}, ${sequence}, ${body},
      ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
    )
    RETURNING *`;
  await upsertConversationParticipant(
    tx, scope, conversationId, actor.userId, displayName,
    scope.role, scope.relationship, sequence,
  );
  for (const recipient of recipients) {
    await upsertConversationParticipant(
      tx, scope, conversationId, Number(recipient.user_id), String(recipient.display_name),
      recipient.role as TeachingConversationActorRole,
      recipient.relationship == null ? null : String(recipient.relationship), 0,
    );
    const isLearner = recipient.role === 'student' || recipient.role === 'guardian';
    const link = isLearner
      ? `/learn/${encodeURIComponent(scope.organization.slug)}`
        + `/students/${encodeURIComponent(scope.student.id)}`
        + `/messages/${encodeURIComponent(conversationId)}`
      : `/org/${encodeURIComponent(scope.organization.slug)}`
        + `/students/${encodeURIComponent(scope.student.id)}`
        + `/messages/${encodeURIComponent(conversationId)}`;
    await tx`
      INSERT INTO notifications (
        user_key, kind, actor_key, actor_name, title, excerpt, link, dedupe_key
      ) VALUES (
        ${String(recipient.owner_key)}, 'teaching_message', ${scope.actorOwnerKey},
        ${displayName.slice(0, 100)}, ${subject}, ${body.slice(0, 500)}, ${link},
        ${`teaching-message:${conversationId}:${sequence}`}
      )
      ON CONFLICT (user_key, kind, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`;
  }
  return {
    message: conversationMessageRow(messages[0] as Record<string, unknown>),
    lastMessageSequence: sequence,
    lastMessageAt: iso(allocated[0].last_message_at),
  };
}

async function insertConversationAudit(
  tx: Tx,
  actor: TeachingActor,
  scope: ConversationActorScope,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
  metadata: JsonObject,
): Promise<void> {
  const staffRole = scope.staffAccess?.role ?? null;
  await tx`
    INSERT INTO teaching_audit_events (
      organization_id, actor_user_id, actor_role, actor_display_name,
      action, entity_type, entity_id, request_id, metadata
    ) VALUES (
      ${scope.organization.id}, ${actor.userId}, ${staffRole}, ${conversationDisplayName(actor, scope)},
      ${action}, ${entityType}, ${entityId}, ${requestId},
      ${sql.json({ ...metadata, actorKind: scope.role, actorRelationship: scope.relationship })}
    )`;
}

export const teachingSaasRepository: TeachingSaasRepository = {
  async listOrganizations(actor) {
    const rows = await query<Record<string, unknown>>(
      `SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.name, o.slug`,
      [actor.userId],
    );
    return rows.map((row) => ({ ...asAccess(row) }));
  },

  async getOrganization(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.read', requestId, async () => ({
      ...await accessForRead(actor.userId, slug),
    }));
  },

  async getOrganizationSummary(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.summary', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const [memberRows, studentRows] = await Promise.all([
        hasTeachingPermission(access.role, 'member:read')
          ? query<Record<string, unknown>>(
              'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
              [access.id],
            )
          : Promise.resolve([]),
        hasTeachingPermission(access.role, 'student:read')
          ? hasOrganizationCrmScope(access.role)
            ? query<Record<string, unknown>>(
                'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?',
                [access.id],
              )
            : query<Record<string, unknown>>(
                `${ACTIVE_STUDENT_SCOPE_CTE}
                 SELECT COUNT(*)::int AS count FROM scoped_student_ids`,
                activeStudentScopeParams(access, actor),
              )
          : Promise.resolve([]),
      ]);
      return {
        organization: { ...access },
        memberCount: hasTeachingPermission(access.role, 'member:read')
          ? Number(memberRows[0]?.count ?? 0)
          : null,
        studentCount: hasTeachingPermission(access.role, 'student:read')
          ? Number(studentRows[0]?.count ?? 0)
          : null,
      };
    });
  },

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

  async createOrganization(actor, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'organization.create', 10, '1 hour');
    try {
      return await sql.begin(async (tx) => {
        const idem = await beginIdempotency(tx, actor.userId, null, 'organization.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO organizations (slug, name, timezone, created_by_user_id)
          VALUES (${input.slug}, ${input.name}, ${input.timezone}, ${actor.userId})
          RETURNING id, slug, name, timezone, status, version`;
        const org = rows[0] as Record<string, unknown>;
        const organizationId = String(org.id);
        await tx`
          INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
          VALUES (${organizationId}, ${actor.userId}, 'owner', 'active', NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId}, 'owner', ${actor.displayName},
            'organization.create', 'organization', ${organizationId}, ${requestId}, ${sql.json({ slug: input.slug })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            organization: {
              id: organizationId,
              slug: String(org.slug),
              name: String(org.name),
              timezone: String(org.timezone),
              status: String(org.status),
              version: Number(org.version),
              role: 'owner',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization', organizationId);
        return result;
      }) as MutationResult;
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      return uniqueConflict(error, 'Organization slug already exists');
    }
  },

  async listMembers(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'member:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
      `SELECT m.user_id, u.display_name, u.avatar_url, m.role, m.status, m.joined_at, m.created_at
       FROM organization_members m
       JOIN app_users u ON u.id = m.user_id
       WHERE m.organization_id = ?
       ORDER BY CASE m.role
         WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2
         WHEN 'assistant' THEN 3 WHEN 'finance' THEN 4 ELSE 5 END,
         u.display_name, m.user_id
       LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          userId: Number(row.user_id),
          displayName: String(row.display_name ?? ''),
          avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
          role: String(row.role),
          status: String(row.status),
          joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createMember(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'member.create', 60, '1 minute');
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'member:manage');
        if (input.role === 'admin' && access.role !== 'owner') {
          throw new TeachingApiException('PERMISSION_DENIED', 403, 'Only an owner can grant the admin role');
        }
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'member.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const users = await tx`SELECT id, display_name FROM app_users WHERE id = ${input.userId}`;
        if (!users.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'User not found');
        await tx`
          INSERT INTO organization_members (
            organization_id, user_id, role, status, invited_by_user_id, joined_at
          ) VALUES (${access.id}, ${input.userId}, ${input.role}, 'active', ${actor.userId}, NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'member.create', 'organization_member', ${String(input.userId)}, ${requestId}, ${sql.json({ role: input.role })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            member: {
              userId: input.userId,
              displayName: String(users[0].display_name ?? ''),
              role: input.role,
              status: 'active',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization_member', String(input.userId));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'User is already a member of this organization');
      }
    });
  },

  async listStudents(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeParams = activeStudentScopeParams(access, actor);
      const [countRows, rows] = await Promise.all(organizationScope ? [
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?', [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
           FROM student_profiles
           WHERE organization_id = ?
           ORDER BY display_name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ] : [
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE} SELECT COUNT(*)::int AS count FROM scoped_student_ids`, scopeParams,
        ),
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE}
           SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                  student.status, student.created_at, student.updated_at
           FROM student_profiles student
           JOIN scoped_student_ids scope ON scope.id = student.id
           ORDER BY student.display_name, student.id
           LIMIT ? OFFSET ?`,
          [...scopeParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(studentToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async getStudent(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = organizationScope
        ? await query<Record<string, unknown>>(
            `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
             FROM student_profiles WHERE organization_id = ? AND id = ?`,
            [access.id, studentId],
          )
        : await query<Record<string, unknown>>(
            `${ACTIVE_STUDENT_SCOPE_CTE}
             SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                    student.status, student.created_at, student.updated_at
             FROM student_profiles student
             JOIN scoped_student_ids scope ON scope.id = student.id
             WHERE student.id = ?`,
            [...activeStudentScopeParams(access, actor), studentId],
          );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM student_profiles WHERE organization_id = ? AND id = ?', [access.id, studentId],
        );
        if (exists.length && !organizationScope) {
          throw new ConcealedTeachingPermissionDeniedException('Student not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      return studentToJson(rows[0]);
    });
  },

  async createStudent(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student.create', 120, '1 minute');
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'student:manage');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'student.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO student_profiles (
            organization_id, external_ref, display_name, created_by_user_id
          ) VALUES (${access.id}, ${input.externalRef}, ${input.displayName}, ${actor.userId})
          RETURNING id, external_ref, display_name, status, created_at, updated_at`;
        const student = rows[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'student.create', 'student', ${String(student.id)}, ${requestId}, ${sql.json({ externalRef: input.externalRef })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            student: {
              id: String(student.id),
              accountUserId: null,
              externalRef: student.external_ref == null ? null : String(student.external_ref),
              displayName: String(student.display_name),
              status: String(student.status),
              createdAt: student.created_at instanceof Date ? student.created_at.toISOString() : String(student.created_at),
              updatedAt: student.updated_at instanceof Date ? student.updated_at.toISOString() : String(student.updated_at),
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'student', String(student.id));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student external reference already exists in this organization');
      }
    });
  },

  async listCampuses(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND campus.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN teaching_groups teaching_group
            ON teaching_group.organization_id = assignment.organization_id
           AND teaching_group.id = assignment.group_id
           WHERE assignment.organization_id = campus.organization_id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND teaching_group.status = 'active'
            AND teaching_group.campus_id = campus.id
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                  campus.archived_at, campus.created_at, campus.updated_at
           FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}
           ORDER BY CASE campus.status WHEN 'active' THEN 0 ELSE 1 END, campus.name, campus.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(campusToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getCampus(actor, slug, campusId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                campus.archived_at, campus.created_at, campus.updated_at
         FROM teaching_campuses campus
         WHERE campus.organization_id = ? AND campus.id = ?
           ${organizationScope ? '' : `AND campus.status = 'active' AND EXISTS (
             SELECT 1 FROM teacher_assignments assignment
             JOIN teaching_groups teaching_group
               ON teaching_group.organization_id = assignment.organization_id
              AND teaching_group.id = assignment.group_id
             WHERE assignment.organization_id = campus.organization_id
               AND assignment.teacher_user_id = ?
               AND EXISTS (
                 SELECT 1 FROM organization_members scoped_member
                 WHERE scoped_member.organization_id = assignment.organization_id
                   AND scoped_member.user_id = assignment.teacher_user_id
                   AND scoped_member.status = 'active'
                   AND scoped_member.role IN ('teacher', 'assistant')
               )
               AND assignment.effective_from <= NOW()
               AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
               AND teaching_group.status = 'active'
               AND teaching_group.campus_id = campus.id
           )`}`,
        organizationScope ? [access.id, campusId] : [access.id, campusId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_campuses WHERE organization_id = ? AND id = ?', [access.id, campusId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Campus not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
      }
      return campusToJson(rows[0]);
    });
  },

  async createCampus(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_campuses (organization_id, code, name, timezone, created_by_user_id)
            VALUES (${access.id}, ${input.code}, ${input.name}, ${input.timezone}, ${actor.userId})
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.create', 'campus', ${String(rows[0].id)}, ${requestId}, ${sql.json({ code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus code already exists or the campus is invalid');
      }
    });
  },

  async archiveCampus(actor, slug, campusId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_campuses
            WHERE organization_id = ${access.id} AND id = ${campusId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Campus is already archived');
          const rows = await tx`
            UPDATE teaching_campuses SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${campusId}
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.archive', 'campus', ${campusId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', campusId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus cannot be archived while it has active groups');
      }
    });
  },

  async listGroups(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND teaching_group.status = 'active'
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
        AND EXISTS (
          SELECT 1 FROM teacher_assignments assignment
           WHERE assignment.organization_id = teaching_group.organization_id
             AND assignment.group_id = teaching_group.id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                  teaching_group.status, teaching_group.archived_at,
                  teaching_group.created_at, teaching_group.updated_at
           FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}
           ORDER BY CASE teaching_group.status WHEN 'active' THEN 0 ELSE 1 END,
                    teaching_group.name, teaching_group.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(groupToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getGroup(actor, slug, groupId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                teaching_group.status, teaching_group.archived_at,
                teaching_group.created_at, teaching_group.updated_at
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      return groupToJson(rows[0]);
    });
  },

  async createGroup(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_groups (organization_id, campus_id, code, name, created_by_user_id)
            VALUES (${access.id}, ${input.campusId}, ${input.code}, ${input.name}, ${actor.userId})
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.create', 'group', ${String(rows[0].id)}, ${requestId}, ${sql.json({ campusId: input.campusId, code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group code already exists or its campus is unavailable');
      }
    });
  },

  async archiveGroup(actor, slug, groupId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_groups
            WHERE organization_id = ${access.id} AND id = ${groupId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Group is already archived');
          const rows = await tx`
            UPDATE teaching_groups SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${groupId}
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.archive', 'group', ${groupId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', groupId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group cannot be archived');
      }
    });
  },

  async listGroupStudents(actor, slug, groupId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const groupRows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!groupRows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      const activeOnly = organizationScope ? '' : `
        AND membership.effective_from <= NOW()
        AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
        AND student.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN organization_members scoped_member
            ON scoped_member.organization_id = assignment.organization_id
           AND scoped_member.user_id = assignment.teacher_user_id
          WHERE assignment.organization_id = membership.organization_id
            AND assignment.group_id = membership.group_id
            AND assignment.teacher_user_id = ?
            AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND scoped_member.status = 'active'
            AND scoped_member.role IN ('teacher', 'assistant')
        )`;
      const relationParams: unknown[] = organizationScope
        ? [access.id, groupId]
        : [access.id, groupId, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}`,
          relationParams,
        ),
        query<Record<string, unknown>>(
          `SELECT membership.id, membership.group_id, membership.effective_from, membership.effective_to,
                  membership.created_at, student.id AS student_id,
                  student.display_name AS student_display_name,
                  student.external_ref AS student_external_ref, student.status AS student_status
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}
           ORDER BY membership.effective_from DESC, membership.id
           LIMIT ? OFFSET ?`,
          [...relationParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(membershipToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentGroupMembership(actor, slug, groupId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.assign', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.assign', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.assign', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO student_group_memberships (
                organization_id, group_id, student_id, effective_from, effective_to, created_by_user_id
              ) VALUES (
                ${access.id}, ${groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              )
              RETURNING id, organization_id, group_id, student_id, effective_from, effective_to, created_at
            )
            SELECT inserted.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM inserted
            JOIN student_profiles student
              ON student.organization_id = inserted.organization_id AND student.id = inserted.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.assign', 'student_group_membership', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student membership overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeStudentGroupMembership(actor, slug, membershipId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM student_group_memberships
            WHERE organization_id = ${access.id} AND id = ${membershipId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Membership not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Membership has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE student_group_memberships
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${membershipId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM ended
            JOIN student_profiles student
              ON student.organization_id = ended.organization_id AND student.id = ended.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.revoke', 'student_group_membership', ${membershipId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: membership.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', membershipId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Membership could not be ended');
      }
    });
  },

  async listTeacherAssignments(actor, slug, target, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'assignment:manage');
      const targetSql = target.groupId !== null ? 'assignment.group_id = ?' : 'assignment.student_id = ?';
      const targetId = (target.groupId ?? target.studentId) as string;
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teacher_assignments assignment
           WHERE assignment.organization_id = ? AND ${targetSql}`,
          [access.id, targetId],
        ),
        query<Record<string, unknown>>(
          `SELECT assignment.id, assignment.teacher_user_id, assignment.teacher_user_id_snapshot,
                  assignment.teacher_display_name_snapshot, assignment.teacher_role_snapshot,
                  assignment.group_id, assignment.student_id, assignment.effective_from,
                  assignment.effective_to, assignment.created_at,
                  member.status AS teacher_member_status
           FROM teacher_assignments assignment
           LEFT JOIN organization_members member
             ON member.organization_id = assignment.organization_id
            AND member.user_id = assignment.teacher_user_id
           WHERE assignment.organization_id = ? AND ${targetSql}
           ORDER BY assignment.effective_from DESC, assignment.id
           LIMIT ? OFFSET ?`,
          [access.id, targetId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(assignmentToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createTeacherAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.create', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO teacher_assignments (
                organization_id, teacher_user_id, teacher_user_id_snapshot,
                teacher_display_name_snapshot, teacher_role_snapshot,
                group_id, student_id, effective_from, effective_to, created_by_user_id
              )
              SELECT ${access.id}, member.user_id, member.user_id, app_user.display_name, member.role,
                     ${input.groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              FROM organization_members member
              JOIN app_users app_user ON app_user.id = member.user_id
              WHERE member.organization_id = ${access.id}
                AND member.user_id = ${input.teacherUserId}
                AND member.status = 'active'
                AND member.role IN ('owner', 'admin', 'teacher', 'assistant')
              RETURNING *
            )
            SELECT inserted.*, member.status AS teacher_member_status
            FROM inserted
            LEFT JOIN organization_members member
              ON member.organization_id = inserted.organization_id
             AND member.user_id = inserted.teacher_user_id`;
          if (!rows.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Teacher must be an active teaching member');
          }
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.create', 'teacher_assignment', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ teacherUserId: input.teacherUserId, groupId: input.groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeTeacherAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM teacher_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assignment not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Assignment has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE teacher_assignments
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${assignmentId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, member.status AS teacher_member_status
            FROM ended
            LEFT JOIN organization_members member
              ON member.organization_id = ended.organization_id
             AND member.user_id = ended.teacher_user_id`;
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.revoke', 'teacher_assignment', ${assignmentId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: assignment.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', assignmentId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment could not be ended');
      }
    });
  },

  async listPackageProducts(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_package_products WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, code, name, status, credit_unit, credit_type, total_credits,
                  validity_days, price_amount_minor, currency, created_at, updated_at
           FROM lesson_package_products
           WHERE organization_id = ?
           ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), code: String(row.code), name: String(row.name), status: String(row.status),
          creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
          totalCredits: Number(row.total_credits),
          validityDays: row.validity_days == null ? null : Number(row.validity_days),
          priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createPackageProduct(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'package_product.create', 60, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'package_product.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO lesson_package_products (
              organization_id, code, name, credit_unit, credit_type, total_credits,
              validity_days, price_amount_minor, currency, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.code}, ${input.name}, ${input.creditUnit}, ${input.creditType},
              ${input.totalCredits}, ${input.validityDays}, ${input.priceAmountMinor}, ${input.currency}, ${actor.userId}
            )
            RETURNING id, code, name, status, credit_unit, credit_type, total_credits,
                      validity_days, price_amount_minor, currency, created_at, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          const productId = String(row.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'package_product.create', 'lesson_package_product', ${productId}, ${requestId},
              ${sql.json({ code: input.code, totalCredits: input.totalCredits })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: { packageProduct: {
              id: productId, code: String(row.code), name: String(row.name), status: String(row.status),
              creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
              totalCredits: Number(row.total_credits),
              validityDays: row.validity_days == null ? null : Number(row.validity_days),
              priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
              createdAt: new Date(String(row.created_at)).toISOString(),
              updatedAt: new Date(String(row.updated_at)).toISOString(),
            } },
          };
          await completeIdempotency(tx, idem.id, result, 'lesson_package_product', productId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Package product code already exists in this organization');
      }
    });
  },

  async listStudentPackages(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const students = await query<Record<string, unknown>>(
        'SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?',
        [access.id, studentId],
      );
      if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_packages WHERE organization_id = ? AND student_id = ?',
          [access.id, studentId],
        ),
        query<Record<string, unknown>>(
          `SELECT p.*,
                  COALESCE((SELECT SUM(l.delta) FROM lesson_credit_ledger l
                            WHERE l.organization_id = p.organization_id AND l.student_package_id = p.id), 0)::int
                    AS remaining_credits
           FROM student_packages p
           WHERE p.organization_id = ? AND p.student_id = ?
           ORDER BY p.created_at DESC, p.id
           LIMIT ? OFFSET ?`,
          [access.id, studentId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => studentPackageToJson(row, Number(row.remaining_credits))),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentPackage(actor, slug, studentId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'student_package.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const students = await tx`
            SELECT id FROM student_profiles WHERE organization_id = ${access.id} AND id = ${studentId}`;
          if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          const products = await tx`
            SELECT id, code, name, credit_unit, credit_type, total_credits, validity_days,
                   price_amount_minor, currency
            FROM lesson_package_products
            WHERE organization_id = ${access.id} AND id = ${input.productId} AND status = 'active'`;
          if (!products.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active package product not found');
          const product = products[0] as Record<string, unknown>;
          const packages = await tx`
            INSERT INTO student_packages (
              organization_id, student_id, product_id, product_code_snapshot, product_name_snapshot,
              credit_unit, credit_type, entitled_credits, validity_days_snapshot, price_amount_minor,
              currency, acquisition_type, valid_from, valid_until, source_system, source_ref,
              source_line_ref, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${input.productId}, ${String(product.code)}, ${String(product.name)},
              ${String(product.credit_unit)}, ${String(product.credit_type)}, ${Number(product.total_credits)},
              ${product.validity_days == null ? null : Number(product.validity_days)}, ${Number(product.price_amount_minor)},
              ${String(product.currency)}, ${input.acquisitionType}, ${input.validFrom},
              CASE WHEN ${product.validity_days == null ? null : Number(product.validity_days)}::int IS NULL THEN NULL
                   ELSE ${input.validFrom}::timestamptz + (${product.validity_days == null ? null : Number(product.validity_days)}::int * INTERVAL '1 day') END,
              ${input.sourceSystem}, ${input.sourceRef}, ${input.sourceLineRef}, ${actor.userId}
            )
            RETURNING *`;
          const studentPackage = packages[0] as Record<string, unknown>;
          const studentPackageId = String(studentPackage.id);
          await tx`
            SELECT id FROM student_packages
            WHERE organization_id = ${access.id} AND id = ${studentPackageId}
            FOR UPDATE`;
          const entryType = input.acquisitionType === 'migration' ? 'adjustment' : input.acquisitionType;
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta, idempotency_key,
              source_system, source_ref, source_line_ref, reason, actor_user_id, actor_role,
              actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${studentId}, ${entryType}, ${Number(product.total_credits)},
              ${idempotencyKey}, ${input.sourceSystem}, ${input.sourceRef},
              ${input.sourceLineRef}, 'Initial entitlement', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${sql.json({ productId: input.productId })}
            )`;
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.create', 'student_package', ${studentPackageId}, ${requestId},
              ${sql.json({ studentId, productId: input.productId, acquisitionType: input.acquisitionType })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              studentPackage: studentPackageToJson(
                studentPackage,
                Number(studentPackage.entitled_credits),
              ),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'student_package', studentPackageId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student package source reference already exists');
      }
    });
  },

  async listStudentPackageLedger(actor, slug, studentPackageId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.ledger', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const packages = await query<Record<string, unknown>>(
        'SELECT id FROM student_packages WHERE organization_id = ? AND id = ?',
        [access.id, studentPackageId],
      );
      if (!packages.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_credit_ledger WHERE organization_id = ? AND student_package_id = ?',
          [access.id, studentPackageId],
        ),
        query<Record<string, unknown>>(
          `SELECT ledger.id, ledger.student_id, ledger.entry_type, ledger.delta,
                  ledger.attendance_id, ledger.session_id, ledger.source_system,
                  ledger.source_ref, ledger.source_line_ref, ledger.reversal_of_ledger_id,
                  reversed.id AS reversed_by_ledger_id, ledger.reason, ledger.actor_role,
                  ledger.actor_display_name, ledger.metadata, ledger.created_at
           FROM lesson_credit_ledger ledger
           LEFT JOIN lesson_credit_ledger reversed
             ON reversed.organization_id = ledger.organization_id
            AND reversed.reversal_of_ledger_id = ledger.id
           WHERE ledger.organization_id = ? AND ledger.student_package_id = ?
           ORDER BY ledger.created_at DESC, ledger.id DESC LIMIT ? OFFSET ?`,
          [access.id, studentPackageId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(creditLedgerEntryToJson),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async listCreditAdjustments(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'credit_adjustment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'finance:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM lesson_credit_ledger
           WHERE organization_id = ?
             AND entry_type IN ('adjustment', 'refund', 'reversal', 'expiration')`,
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT ledger.id, ledger.student_package_id, ledger.student_id,
                  ledger.entry_type, ledger.delta, ledger.attendance_id, ledger.session_id,
                  ledger.source_system, ledger.source_ref, ledger.source_line_ref,
                  ledger.reversal_of_ledger_id, reversed.id AS reversed_by_ledger_id,
                  ledger.reason, ledger.actor_role, ledger.actor_display_name,
                  ledger.metadata, ledger.created_at,
                  student.display_name AS student_display_name,
                  package.product_code_snapshot, package.product_name_snapshot,
                  package.credit_unit, package.credit_type
           FROM lesson_credit_ledger ledger
           JOIN student_profiles student
             ON student.organization_id = ledger.organization_id
            AND student.id = ledger.student_id
           JOIN student_packages package
             ON package.organization_id = ledger.organization_id
            AND package.id = ledger.student_package_id
            AND package.student_id = ledger.student_id
           LEFT JOIN lesson_credit_ledger reversed
             ON reversed.organization_id = ledger.organization_id
            AND reversed.reversal_of_ledger_id = ledger.id
           WHERE ledger.organization_id = ?
             AND ledger.entry_type IN ('adjustment', 'refund', 'reversal', 'expiration')
           ORDER BY ledger.created_at DESC, ledger.id DESC
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(creditAdjustmentToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async refundStudentPackageCredits(
    actor, slug, studentPackageId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student_package.refund', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.refund', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'finance:manage');
          const studentPackage = await lockStudentPackageForCreditMutation(
            tx, access.id, studentPackageId,
          );
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student_package.refund:${studentPackageId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;

          const balance = await studentPackageCreditBalance(tx, access.id, studentPackageId);
          if (balance < input.credits) {
            throw new TeachingApiException('CONFLICT', 409, 'Refund would make the package credit balance negative');
          }
          const inserted = await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              idempotency_key, source_system, source_ref, source_line_ref, reason,
              actor_user_id, actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${String(studentPackage.student_id)},
              'refund', ${-input.credits}, ${refundLedgerIdempotencyKey(idempotencyKey)},
              ${input.sourceSystem}, ${input.sourceRef}, ${input.sourceLineRef}, ${input.reason},
              ${actor.userId}, ${access.role}, ${actor.displayName},
              ${sql.json({ credits: input.credits })}
            )
            RETURNING *`;
          const ledgerEntry = inserted[0] as Record<string, unknown>;
          const ledgerId = String(ledgerEntry.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.refund', 'lesson_credit_ledger', ${ledgerId}, ${requestId},
              ${sql.json({
                studentPackageId,
                credits: input.credits,
                sourceSystem: input.sourceSystem,
                sourceRef: input.sourceRef,
                sourceLineRef: input.sourceLineRef,
              })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              ledgerEntry: creditLedgerEntryToJson(ledgerEntry),
              studentPackage: studentPackageToJson(studentPackage, balance - input.credits),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'lesson_credit_ledger', ledgerId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Credit refund conflicts with the current package ledger');
      }
    });
  },

  async reverseStudentPackageLedgerEntry(
    actor, slug, studentPackageId, ledgerId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student_package.ledger.reversal', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.ledger.reversal', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'finance:manage');
          const studentPackage = await lockStudentPackageForCreditMutation(
            tx, access.id, studentPackageId,
          );
          const targets = await tx`
            SELECT target.*, reversed.id AS reversed_by_ledger_id
            FROM lesson_credit_ledger target
            LEFT JOIN lesson_credit_ledger reversed
              ON reversed.organization_id = target.organization_id
             AND reversed.reversal_of_ledger_id = target.id
            WHERE target.organization_id = ${access.id}
              AND target.student_package_id = ${studentPackageId}
              AND target.id = ${ledgerId}`;
          if (!targets.length) {
            const existing = await tx`
              SELECT organization_id, student_package_id
              FROM lesson_credit_ledger
              WHERE id = ${ledgerId}`;
            if (existing.length && String(existing[0].organization_id) !== access.id) {
              throw new ConcealedTeachingPermissionDeniedException('Credit ledger entry not found');
            }
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Credit ledger entry not found');
          }
          const target = targets[0] as Record<string, unknown>;
          if (target.entry_type === 'reversal') {
            throw new TeachingApiException('CONFLICT', 409, 'A reversal entry cannot be reversed');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student_package.ledger.reversal:${studentPackageId}:${ledgerId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (target.reversed_by_ledger_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Credit ledger entry was already reversed');
          }

          const balance = await studentPackageCreditBalance(tx, access.id, studentPackageId);
          const delta = -Number(target.delta);
          if (balance + delta < 0) {
            throw new TeachingApiException('CONFLICT', 409, 'Reversal would make the package credit balance negative');
          }
          const inserted = await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              idempotency_key, reversal_of_ledger_id, reason,
              actor_user_id, actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${String(studentPackage.student_id)},
              'reversal', ${delta}, ${reversalLedgerIdempotencyKey(ledgerId, idempotencyKey)},
              ${ledgerId}, ${input.reason}, ${actor.userId}, ${access.role},
              ${actor.displayName}, ${sql.json({ reversedLedgerId: ledgerId })}
            )
            RETURNING *`;
          const ledgerEntry = inserted[0] as Record<string, unknown>;
          const reversalLedgerId = String(ledgerEntry.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.ledger.reversal', 'lesson_credit_ledger',
              ${reversalLedgerId}, ${requestId},
              ${sql.json({ studentPackageId, reversedLedgerId: ledgerId, delta })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              ledgerEntry: creditLedgerEntryToJson(ledgerEntry),
              studentPackage: studentPackageToJson(studentPackage, balance + delta),
            },
          };
          await completeIdempotency(
            tx, idem.id, result, 'lesson_credit_ledger', reversalLedgerId,
          );
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Credit reversal conflicts with the current package ledger');
      }
    });
  },

  async listSessions(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const countQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            'SELECT COUNT(*)::int AS count FROM teaching_sessions WHERE organization_id = ?',
            [access.id],
          )
        : query<Record<string, unknown>>(
            `SELECT COUNT(*)::int AS count
             FROM teaching_sessions s
             WHERE s.organization_id = ?
               AND EXISTS (
                 SELECT 1 FROM session_teachers assigned
                 WHERE assigned.organization_id = s.organization_id
                   AND assigned.session_id = s.id
                   AND assigned.teacher_user_id = ?
               )`,
            [access.id, actor.userId],
          );
      const sessionsQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, pagination.pageSize, pagination.offset],
          )
        : query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
             AND EXISTS (
               SELECT 1 FROM session_teachers assigned
               WHERE assigned.organization_id = s.organization_id
                 AND assigned.session_id = s.id
                 AND assigned.teacher_user_id = ?
             )
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, actor.userId, pagination.pageSize, pagination.offset],
          );
      const [countRows, rows] = await Promise.all([countQuery, sessionsQuery]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), title: String(row.title),
          startsAt: new Date(String(row.starts_at)).toISOString(),
          endsAt: new Date(String(row.ends_at)).toISOString(),
          timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
          startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
          completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
          cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
          teachers: row.teachers as JsonValue, attendanceCount: Number(row.attendance_count),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getSession(actor, slug, sessionId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const rows = scope === 'organization'
        ? await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?`,
            [access.id, sessionId],
          )
        : await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?
           AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = s.organization_id
               AND assigned.session_id = s.id
               AND assigned.teacher_user_id = ?
           )`,
            [access.id, sessionId, actor.userId],
          );
      if (!rows.length) {
        if (scope === 'assigned') {
          const existing = await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          );
          if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
      }
      const row = rows[0];
      const attendance = await query<Record<string, unknown>>(
        `SELECT a.id, a.student_id, p.display_name, a.student_package_id,
                a.status, a.credit_cost, a.notes, a.updated_at
         FROM attendance_records a
         JOIN student_profiles p
           ON p.organization_id = a.organization_id AND p.id = a.student_id
         WHERE a.organization_id = ? AND a.session_id = ?
         ORDER BY p.display_name, a.student_id`,
        [access.id, sessionId],
      );
      return {
        id: String(row.id), title: String(row.title),
        startsAt: new Date(String(row.starts_at)).toISOString(),
        endsAt: new Date(String(row.ends_at)).toISOString(),
        timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
        startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
        completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
        cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
        teachers: row.teachers as JsonValue,
        attendance: attendance.map((item) => ({
          id: String(item.id), studentId: String(item.student_id), displayName: String(item.display_name),
          studentPackageId: item.student_package_id == null ? null : String(item.student_package_id),
          status: String(item.status), creditCost: Number(item.credit_cost), notes: String(item.notes),
          updatedAt: new Date(String(item.updated_at)).toISOString(),
        })),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      };
    });
  },

  async listLessonFeedback(actor, slug, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'feedback:read');
      const sessions = scope === 'organization'
        ? await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          )
        : await query<Record<string, unknown>>(
            `SELECT 1
             FROM teaching_sessions session
             WHERE session.organization_id = ? AND session.id = ?
               AND EXISTS (
                 SELECT 1 FROM session_teachers assigned
                 WHERE assigned.organization_id = session.organization_id
                   AND assigned.session_id = session.id
                   AND assigned.teacher_user_id = ?
               )`,
            [access.id, sessionId, actor.userId],
          );
      if (!sessions.length) {
        if (scope === 'assigned') {
          const existing = await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          );
          if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
      }
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM lesson_feedback
           WHERE organization_id = ? AND session_id = ?`,
          [access.id, sessionId],
        ),
        query<Record<string, unknown>>(
          `SELECT *
           FROM lesson_feedback
           WHERE organization_id = ? AND session_id = ?
           ORDER BY created_at DESC, revision DESC, id DESC
           LIMIT ? OFFSET ?`,
          [access.id, sessionId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(lessonFeedbackToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createSession(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.create', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'session:create');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'session.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO teaching_sessions (
            organization_id, title, starts_at, ends_at, timezone, created_by_user_id
          ) VALUES (
            ${access.id}, ${input.title}, ${input.startsAt}, ${input.endsAt},
            ${input.timezone ?? access.timezone}, ${actor.userId}
          )
          RETURNING id, title, starts_at, ends_at, timezone, status, version, created_at, updated_at`;
        const session = rows[0] as Record<string, unknown>;
        const sessionId = String(session.id);
        const teachers: JsonObject[] = [];
        for (let index = 0; index < input.teacherUserIds.length; index += 1) {
          const teacherUserId = input.teacherUserIds[index];
          const members = await tx`
            SELECT m.user_id, m.role, u.display_name
            FROM organization_members m
            JOIN app_users u ON u.id = m.user_id
            WHERE m.organization_id = ${access.id} AND m.user_id = ${teacherUserId}
              AND m.status = 'active' AND m.role IN ('owner', 'admin', 'teacher', 'assistant')`;
          if (!members.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assigned teacher is not an active teaching member');
          }
          const member = members[0] as Record<string, unknown>;
          const role = index === 0 ? 'lead' : 'assistant';
          await tx`
            INSERT INTO session_teachers (
              organization_id, session_id, teacher_user_id, teacher_user_id_snapshot,
              teacher_display_name_snapshot, role
            ) VALUES (
              ${access.id}, ${sessionId}, ${teacherUserId}, ${teacherUserId},
              ${String(member.display_name)}, ${role}
            )`;
          teachers.push({ userId: teacherUserId, displayName: String(member.display_name), role });
        }
        const attendance: JsonObject[] = [];
        for (const attendee of input.attendees) {
          const packages = await tx`
            SELECT p.id, s.display_name
            FROM student_packages p
            JOIN student_profiles s
              ON s.organization_id = p.organization_id AND s.id = p.student_id
            WHERE p.organization_id = ${access.id} AND p.id = ${attendee.studentPackageId}
              AND p.student_id = ${attendee.studentId} AND p.lifecycle_status = 'active'
              AND p.valid_from <= ${input.startsAt}::timestamptz
              AND (p.valid_until IS NULL OR p.valid_until > ${input.startsAt}::timestamptz)`;
          if (!packages.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active student package not found for an attendee');
          }
          const rows = await tx`
            INSERT INTO attendance_records (
              organization_id, session_id, student_id, student_package_id,
              status, credit_cost, notes, recorded_by_user_id
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendee.studentId}, ${attendee.studentPackageId},
              'expected', ${attendee.creditCost}, '', ${actor.userId}
            )
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          attendance.push({
            id: String(row.id), studentId: String(row.student_id),
            displayName: String(packages[0].display_name), studentPackageId: String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost), notes: String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'scheduled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ teacherUserIds: input.teacherUserIds, attendeeCount: attendance.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.create', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ startsAt: input.startsAt, teacherCount: teachers.length, attendeeCount: attendance.length })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: { session: {
            id: sessionId, title: String(session.title),
            startsAt: new Date(String(session.starts_at)).toISOString(),
            endsAt: new Date(String(session.ends_at)).toISOString(),
            timezone: String(session.timezone), status: String(session.status), version: Number(session.version),
            teachers, attendance, attendanceCount: attendance.length,
            startedAt: null, completedAt: null, cancelledAt: null,
            createdAt: new Date(String(session.created_at)).toISOString(),
            updatedAt: new Date(String(session.updated_at)).toISOString(),
          } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async createStudentAccountBindingInvite(actor, slug, studentId, input, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.create', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite:${initialAccess.id}`,
        30,
        '1 hour',
      );
      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id, status, account_user_id
            FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const student = students[0] as Record<string, unknown>;
          if (student.status !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Only an active student can be linked');
          }
          if (student.account_user_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Student already has a linked account');
          }
          await tx`
            UPDATE student_account_binding_invites
            SET expired_at = GREATEST(expires_at, clock_timestamp())
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at <= clock_timestamp()`;
          await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL`;
          const rows = await tx`
            INSERT INTO student_account_binding_invites (
              organization_id, student_id, token_hash, expires_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${tokenHash},
              clock_timestamp() + make_interval(mins => ${input.expiresInMinutes}),
              ${actor.userId}
            )
            RETURNING *, clock_timestamp() AS database_now`;
          const invite = bindingInviteToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.create', 'student_account_binding_invite',
              ${String(rows[0].id)}, ${requestId},
              ${sql.json({ studentId, expiresAt: invite.expiresAt })}
            )`;
          return { status: 201, body: { invite, token } } satisfies MutationResult;
        }) as MutationResult;
      } catch (error) {
        uniqueConflict(error, 'A student account binding invite could not be issued concurrently');
      }
    });
  },

  async getCurrentStudentAccountBindingInvite(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:manage');
      const students = await query<Record<string, unknown>>(
        `SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?`,
        [access.id, studentId],
      );
      if (!students.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      const rows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (
           SELECT clock_timestamp() AS database_now
         )
         SELECT invite.*, database_clock.database_now
         FROM student_account_binding_invites invite
         CROSS JOIN database_clock
         WHERE invite.organization_id = ? AND invite.student_id = ?
           AND invite.expired_at IS NULL
           AND invite.consumed_at IS NULL
           AND invite.revoked_at IS NULL
           AND invite.expires_at > database_clock.database_now
         ORDER BY invite.created_at DESC, invite.id DESC
         LIMIT 1`,
        [access.id, studentId],
      );
      return { invite: rows.length ? bindingInviteToJson(rows[0]) : null };
    });
  },

  async revokeStudentAccountBindingInvite(
    actor,
    slug,
    studentId,
    inviteId,
    idempotencyKey,
    requestHash,
    requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.revoke', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite-revoke:${initialAccess.id}`,
        60,
        '1 minute',
      );
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const rows = await tx`
            SELECT invite.*, clock_timestamp() AS database_now
            FROM student_account_binding_invites invite
            WHERE invite.organization_id = ${access.id}
              AND invite.student_id = ${studentId}
              AND invite.id = ${inviteId}
            FOR UPDATE`;
          if (!rows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student.account-binding.invite.revoke:${inviteId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const existing = rows[0] as Record<string, unknown>;
          if (
            existing.expired_at != null
            || existing.consumed_at != null
            || existing.revoked_at != null
            || new Date(String(existing.expires_at)).getTime()
              <= new Date(String(existing.database_now)).getTime()
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Only a current pending invite can be revoked');
          }
          const revoked = await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND id = ${inviteId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS database_now`;
          if (!revoked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding invite changed concurrently');
          }
          const invite = bindingInviteToJson(revoked[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.revoke', 'student_account_binding_invite',
              ${inviteId}, ${requestId}, ${sql.json({ studentId, reason: 'manual_revoke' })}
            )`;
          const result: MutationResult = { status: 200, body: { invite } };
          await completeIdempotency(
            tx,
            idem.id,
            result,
            'student_account_binding_invite',
            inviteId,
          );
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student account binding invite could not be revoked');
      }
    });
  },

  async previewStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-preview', 120, '1 hour');
    const rows = await query<Record<string, unknown>>(
      `SELECT invite.id, invite.organization_id, invite.student_id,
              invite.expires_at, invite.expired_at, invite.consumed_at, invite.revoked_at,
              organization.name AS organization_name, organization.status AS organization_status,
              student.display_name AS student_display_name, student.status AS student_status,
              student.account_user_id, clock_timestamp() AS database_now
       FROM student_account_binding_invites invite
       JOIN organizations organization ON organization.id = invite.organization_id
       JOIN student_profiles student
         ON student.organization_id = invite.organization_id AND student.id = invite.student_id
       WHERE invite.token_hash = ?`,
      [input.tokenHash],
    );
    if (rows.length) {
      const row = rows[0];
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-preview:${String(row.organization_id)}`,
        30,
        '1 hour',
      );
      const available = row.expired_at == null
        && row.consumed_at == null
        && row.revoked_at == null
        && new Date(String(row.expires_at)).getTime() > new Date(String(row.database_now)).getTime()
        && row.organization_status === 'active'
        && row.student_status === 'active'
        && row.account_user_id == null;
      if (available) {
        return {
          organizationName: String(row.organization_name),
          studentDisplayName: String(row.student_display_name),
          expiresAt: iso(row.expires_at),
        };
      }
    }
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
  },

  async consumeStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-consume', 60, '1 hour');
    const rateScopes = await query<Record<string, unknown>>(
      `SELECT organization_id FROM student_account_binding_invites WHERE token_hash = ?`,
      [input.tokenHash],
    );
    if (rateScopes.length) {
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-consume:${String(rateScopes[0].organization_id)}`,
        20,
        '1 hour',
      );
    }
    type ConsumeOutcome = MutationResult | { unavailable: true };
    let outcome: ConsumeOutcome;
    try {
      outcome = await withRepeatableReadRetry<ConsumeOutcome>(async (tx) => {
        const actors = await tx`
          SELECT id FROM app_users WHERE id = ${actor.userId} FOR KEY SHARE`;
        if (!actors.length) {
          throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
        }
        const inviteIdentity = await tx`
          SELECT organization_id, student_id
          FROM student_account_binding_invites
          WHERE token_hash = ${input.tokenHash}`;
        if (!inviteIdentity.length) return { unavailable: true };
        const organizationId = String(inviteIdentity[0].organization_id);
        const studentId = String(inviteIdentity[0].student_id);
        const students = await tx`
          SELECT student.id, student.display_name, student.status,
                 student.account_user_id, student.account_linked_at,
                 organization.name AS organization_name, organization.status AS organization_status
          FROM student_profiles student
          JOIN organizations organization ON organization.id = student.organization_id
          WHERE student.organization_id = ${organizationId} AND student.id = ${studentId}
          FOR UPDATE OF student`;
        if (!students.length) return { unavailable: true };
        const student = students[0] as Record<string, unknown>;
        const invites = await tx`
          WITH database_clock AS MATERIALIZED (
            SELECT clock_timestamp() AS database_now
          )
          SELECT invite.*, database_clock.database_now
          FROM student_account_binding_invites invite
          CROSS JOIN database_clock
          WHERE invite.token_hash = ${input.tokenHash}
            AND invite.organization_id = ${organizationId}
            AND invite.student_id = ${studentId}
          FOR UPDATE OF invite`;
        if (!invites.length) return { unavailable: true };
        let invite = invites[0] as Record<string, unknown>;

        const consumedBySameActor = invite.consumed_at != null
          && Number(invite.consumed_by_user_id_snapshot) === actor.userId
          && Number(student.account_user_id) === actor.userId;
        if (consumedBySameActor) {
          return {
            status: 200,
            body: {
              invite: {
                id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
                consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
              },
              student: {
                id: studentId, organizationName: String(student.organization_name),
                displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
              },
            },
          };
        }

        const operationInstant = iso(invite.database_now);
        const databaseNow = new Date(operationInstant).getTime();
        const linkedToAnotherAccount = student.account_user_id != null
          && Number(student.account_user_id) !== actor.userId;
        if (
          invite.expired_at != null || invite.revoked_at != null || invite.consumed_at != null
          || new Date(String(invite.expires_at)).getTime() <= databaseNow
          || linkedToAnotherAccount
          || student.organization_status !== 'active' || student.status !== 'active'
        ) {
          if (
            invite.expired_at == null && invite.revoked_at == null && invite.consumed_at == null
            && new Date(String(invite.expires_at)).getTime() <= databaseNow
          ) {
            const expired = await tx`
              UPDATE student_account_binding_invites
              SET expired_at = GREATEST(expires_at, ${operationInstant})
              WHERE id = ${String(invite.id)}
              RETURNING *`;
            invite = expired[0] as Record<string, unknown>;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, outcome, request_id, metadata
            ) VALUES (
              ${organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'student.account-binding.consume',
              'student_account_binding_invite', ${String(invite.id)}, 'denied', ${requestId},
              ${sql.json({ reason: linkedToAnotherAccount ? 'STUDENT_ALREADY_LINKED' : 'INVITE_UNAVAILABLE' })}
            )`;
          return { unavailable: true };
        }
        if (student.account_user_id == null) {
          const linked = await tx`
            UPDATE student_profiles
            SET account_user_id = ${actor.userId}, account_linked_at = ${operationInstant}
            WHERE organization_id = ${organizationId} AND id = ${studentId}
              AND account_user_id IS NULL
            RETURNING account_linked_at`;
          if (!linked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding changed concurrently');
          }
          student.account_linked_at = linked[0].account_linked_at;
        }
        const consumed = await tx`
          UPDATE student_account_binding_invites
          SET consumed_at = ${operationInstant},
              consumed_by_user_id = ${actor.userId},
              consumed_by_user_id_snapshot = ${actor.userId}
          WHERE id = ${String(invite.id)}
            AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > ${operationInstant}
          RETURNING *`;
        if (!consumed.length) {
          throw new TeachingApiException(
            'RESOURCE_NOT_FOUND',
            404,
            'Student account binding invite not found',
          );
        }
        invite = consumed[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId},
            (SELECT role FROM organization_members
             WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
            ${actor.displayName}, 'student.account-binding.consume',
            'student_account_binding_invite', ${String(invite.id)}, ${requestId},
            ${sql.json({ studentId })}
          )`;
        return {
          status: 200,
          body: {
            invite: {
              id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
              consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
            },
            student: {
              id: studentId, organizationName: String(student.organization_name),
              displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23514' || code === '55000') {
        throw new TeachingApiException(
          'RESOURCE_NOT_FOUND',
          404,
          'Student account binding invite not found',
        );
      }
      uniqueConflict(error, 'This account is already linked to another student in the organization');
    }
    if ('unavailable' in outcome) {
      throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
    }
    return outcome;
  },

  async createGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, input, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.create', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-invite:${initialAccess.id}`,
        30,
        '1 hour',
      );
      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const guardians = await tx`
            SELECT guardian.id, guardian.status, guardian.guardian_user_id,
                   student.status AS student_status
            FROM guardian_links guardian
            JOIN student_profiles student
              ON student.organization_id = guardian.organization_id
             AND student.id = guardian.student_id
            WHERE guardian.organization_id = ${access.id}
              AND guardian.student_id = ${studentId}
              AND guardian.id = ${guardianLinkId}
            FOR UPDATE OF guardian`;
          if (!guardians.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
          }
          const guardian = guardians[0] as Record<string, unknown>;
          if (guardian.status !== 'active' || guardian.student_status !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Only an active guardian link can be linked');
          }
          if (guardian.guardian_user_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Guardian link already has a linked account');
          }
          await tx`
            UPDATE guardian_account_binding_invites
            SET expired_at = GREATEST(expires_at, clock_timestamp())
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at <= clock_timestamp()`;
          await tx`
            UPDATE guardian_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL`;
          const rows = await tx`
            INSERT INTO guardian_account_binding_invites (
              organization_id, guardian_link_id, token_hash, expires_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${guardianLinkId}, ${tokenHash},
              clock_timestamp() + make_interval(mins => ${input.expiresInMinutes}),
              ${actor.userId}
            )
            RETURNING *, clock_timestamp() AS database_now`;
          const invite = guardianBindingInviteToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'guardian.account-binding.invite.create', 'guardian_account_binding_invite',
              ${String(rows[0].id)}, ${requestId},
              ${sql.json({ studentId, guardianLinkId, expiresAt: invite.expiresAt })}
            )`;
          return { status: 201, body: { invite, token } } satisfies MutationResult;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        uniqueConflict(error, 'A guardian account binding invite could not be issued concurrently');
      }
    });
  },

  async getCurrentGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:manage');
      const guardians = await query<Record<string, unknown>>(
        `SELECT id FROM guardian_links
         WHERE organization_id = ? AND student_id = ? AND id = ?`,
        [access.id, studentId, guardianLinkId],
      );
      if (!guardians.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
      }
      const rows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (
           SELECT clock_timestamp() AS database_now
         )
         SELECT invite.*, database_clock.database_now
         FROM guardian_account_binding_invites invite
         CROSS JOIN database_clock
         WHERE invite.organization_id = ? AND invite.guardian_link_id = ?
           AND invite.expired_at IS NULL
           AND invite.consumed_at IS NULL
           AND invite.revoked_at IS NULL
           AND invite.expires_at > database_clock.database_now
         ORDER BY invite.created_at DESC, invite.id DESC
         LIMIT 1`,
        [access.id, guardianLinkId],
      );
      return { invite: rows.length ? guardianBindingInviteToJson(rows[0]) : null };
    });
  },

  async revokeGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, inviteId,
    idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.revoke', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-invite-revoke:${initialAccess.id}`,
        60,
        '1 minute',
      );
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const guardians = await tx`
            SELECT id FROM guardian_links
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId} AND id = ${guardianLinkId}
            FOR UPDATE`;
          if (!guardians.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
          }
          const rows = await tx`
            SELECT invite.*, clock_timestamp() AS database_now
            FROM guardian_account_binding_invites invite
            WHERE invite.organization_id = ${access.id}
              AND invite.guardian_link_id = ${guardianLinkId}
              AND invite.id = ${inviteId}
            FOR UPDATE`;
          if (!rows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `guardian.account-binding.invite.revoke:${inviteId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const existing = rows[0] as Record<string, unknown>;
          if (
            existing.expired_at != null || existing.consumed_at != null || existing.revoked_at != null
            || new Date(String(existing.expires_at)).getTime()
              <= new Date(String(existing.database_now)).getTime()
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Only a current pending invite can be revoked');
          }
          const revoked = await tx`
            UPDATE guardian_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND id = ${inviteId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS database_now`;
          if (!revoked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Guardian account binding invite changed concurrently');
          }
          const invite = guardianBindingInviteToJson(revoked[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'guardian.account-binding.invite.revoke', 'guardian_account_binding_invite',
              ${inviteId}, ${requestId},
              ${sql.json({ studentId, guardianLinkId, reason: 'manual_revoke' })}
            )`;
          const result: MutationResult = { status: 200, body: { invite } };
          await completeIdempotency(tx, idem.id, result, 'guardian_account_binding_invite', inviteId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Guardian account binding invite could not be revoked');
      }
    });
  },

  async previewGuardianAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'guardian-binding-preview', 120, '1 hour');
    const rows = await query<Record<string, unknown>>(
      `SELECT invite.id, invite.organization_id, invite.guardian_link_id,
              invite.expires_at, invite.expired_at, invite.consumed_at, invite.revoked_at,
              organization.name AS organization_name, organization.status AS organization_status,
              student.display_name AS student_display_name, student.status AS student_status,
              guardian.relationship, guardian.status AS guardian_status,
              guardian.guardian_user_id, clock_timestamp() AS database_now
       FROM guardian_account_binding_invites invite
       JOIN organizations organization ON organization.id = invite.organization_id
       JOIN guardian_links guardian
         ON guardian.organization_id = invite.organization_id AND guardian.id = invite.guardian_link_id
       JOIN student_profiles student
         ON student.organization_id = guardian.organization_id AND student.id = guardian.student_id
       WHERE invite.token_hash = ?`,
      [input.tokenHash],
    );
    if (rows.length) {
      const row = rows[0];
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-preview:${String(row.organization_id)}`,
        30,
        '1 hour',
      );
      const available = row.expired_at == null
        && row.consumed_at == null
        && row.revoked_at == null
        && new Date(String(row.expires_at)).getTime() > new Date(String(row.database_now)).getTime()
        && row.organization_status === 'active'
        && row.student_status === 'active'
        && row.guardian_status === 'active'
        && row.guardian_user_id == null;
      if (available) {
        return {
          organizationName: String(row.organization_name),
          studentDisplayName: String(row.student_display_name),
          relationship: String(row.relationship),
          expiresAt: iso(row.expires_at),
        };
      }
    }
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
  },

  async consumeGuardianAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'guardian-binding-consume', 60, '1 hour');
    const rateScopes = await query<Record<string, unknown>>(
      `SELECT organization_id FROM guardian_account_binding_invites WHERE token_hash = ?`,
      [input.tokenHash],
    );
    if (rateScopes.length) {
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-consume:${String(rateScopes[0].organization_id)}`,
        20,
        '1 hour',
      );
    }
    type ConsumeOutcome = MutationResult | { unavailable: true };
    let outcome: ConsumeOutcome;
    try {
      outcome = await withRepeatableReadRetry<ConsumeOutcome>(async (tx) => {
        const actors = await tx`
          SELECT id FROM app_users WHERE id = ${actor.userId} FOR KEY SHARE`;
        if (!actors.length) {
          throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
        }
        const inviteIdentity = await tx`
          SELECT organization_id, guardian_link_id
          FROM guardian_account_binding_invites
          WHERE token_hash = ${input.tokenHash}`;
        if (!inviteIdentity.length) return { unavailable: true };
        const organizationId = String(inviteIdentity[0].organization_id);
        const guardianLinkId = String(inviteIdentity[0].guardian_link_id);
        const guardians = await tx`
          SELECT guardian.id, guardian.student_id, guardian.relationship,
                 guardian.status, guardian.guardian_user_id, guardian.account_linked_at,
                 student.display_name AS student_display_name, student.status AS student_status,
                 organization.name AS organization_name, organization.status AS organization_status
          FROM guardian_links guardian
          JOIN organizations organization ON organization.id = guardian.organization_id
          JOIN student_profiles student
            ON student.organization_id = guardian.organization_id AND student.id = guardian.student_id
          WHERE guardian.organization_id = ${organizationId} AND guardian.id = ${guardianLinkId}
          FOR UPDATE OF guardian`;
        if (!guardians.length) return { unavailable: true };
        const guardian = guardians[0] as Record<string, unknown>;
        const invites = await tx`
          WITH database_clock AS MATERIALIZED (
            SELECT clock_timestamp() AS database_now
          )
          SELECT invite.*, database_clock.database_now
          FROM guardian_account_binding_invites invite
          CROSS JOIN database_clock
          WHERE invite.token_hash = ${input.tokenHash}
            AND invite.organization_id = ${organizationId}
            AND invite.guardian_link_id = ${guardianLinkId}
          FOR UPDATE OF invite`;
        if (!invites.length) return { unavailable: true };
        let invite = invites[0] as Record<string, unknown>;
        const studentId = String(guardian.student_id);
        const consumedBySameActor = invite.consumed_at != null
          && Number(invite.consumed_by_user_id_snapshot) === actor.userId
          && Number(guardian.guardian_user_id) === actor.userId;
        if (consumedBySameActor) {
          return {
            status: 200,
            body: {
              invite: {
                id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
                consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
              },
              guardian: {
                guardianLinkId, studentId,
                organizationName: String(guardian.organization_name),
                studentDisplayName: String(guardian.student_display_name),
                relationship: String(guardian.relationship),
                accountLinkedAt: iso(guardian.account_linked_at),
              },
            },
          };
        }
        const operationInstant = iso(invite.database_now);
        const databaseNow = new Date(operationInstant).getTime();
        const linkedToAnotherAccount = guardian.guardian_user_id != null
          && Number(guardian.guardian_user_id) !== actor.userId;
        if (
          invite.expired_at != null || invite.revoked_at != null || invite.consumed_at != null
          || new Date(String(invite.expires_at)).getTime() <= databaseNow
          || linkedToAnotherAccount
          || guardian.organization_status !== 'active'
          || guardian.student_status !== 'active'
          || guardian.status !== 'active'
        ) {
          if (
            invite.expired_at == null && invite.revoked_at == null && invite.consumed_at == null
            && new Date(String(invite.expires_at)).getTime() <= databaseNow
          ) {
            const expired = await tx`
              UPDATE guardian_account_binding_invites
              SET expired_at = GREATEST(expires_at, ${operationInstant})
              WHERE id = ${String(invite.id)}
              RETURNING *`;
            invite = expired[0] as Record<string, unknown>;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, outcome, request_id, metadata
            ) VALUES (
              ${organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'guardian.account-binding.consume',
              'guardian_account_binding_invite', ${String(invite.id)}, 'denied', ${requestId},
              ${sql.json({ reason: linkedToAnotherAccount ? 'GUARDIAN_ALREADY_LINKED' : 'INVITE_UNAVAILABLE' })}
            )`;
          return { unavailable: true };
        }
        const linked = await tx`
          UPDATE guardian_links
          SET guardian_user_id = ${actor.userId}, account_linked_at = ${operationInstant}
          WHERE organization_id = ${organizationId} AND id = ${guardianLinkId}
            AND guardian_user_id IS NULL AND status = 'active'
          RETURNING account_linked_at`;
        if (!linked.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Guardian account binding changed concurrently');
        }
        guardian.account_linked_at = linked[0].account_linked_at;
        const consumed = await tx`
          UPDATE guardian_account_binding_invites
          SET consumed_at = ${operationInstant},
              consumed_by_user_id = ${actor.userId},
              consumed_by_user_id_snapshot = ${actor.userId}
          WHERE id = ${String(invite.id)}
            AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > ${operationInstant}
          RETURNING *`;
        if (!consumed.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
        }
        invite = consumed[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId},
            (SELECT role FROM organization_members
             WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
            ${actor.displayName}, 'guardian.account-binding.consume',
            'guardian_account_binding_invite', ${String(invite.id)}, ${requestId},
            ${sql.json({ studentId, guardianLinkId })}
          )`;
        return {
          status: 200,
          body: {
            invite: {
              id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
              consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
            },
            guardian: {
              guardianLinkId, studentId,
              organizationName: String(guardian.organization_name),
              studentDisplayName: String(guardian.student_display_name),
              relationship: String(guardian.relationship),
              accountLinkedAt: iso(guardian.account_linked_at),
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23514' || code === '55000') {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
      }
      uniqueConflict(error, 'This account is already linked to this student as a guardian');
    }
    if ('unavailable' in outcome) {
      throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
    }
    return outcome;
  },

  async listLearningContexts(actor, slug, requestId) {
    const rows = await query<Record<string, unknown>>(
      `SELECT context.organization_slug, context.organization_name,
              context.student_id, context.student_display_name,
              context.relationship_kind, context.guardian_link_id, context.relationship
       FROM (
         SELECT organization.slug AS organization_slug,
                organization.name AS organization_name,
                student.id AS student_id,
                student.display_name AS student_display_name,
                'student'::text AS relationship_kind,
                NULL::uuid AS guardian_link_id,
                NULL::text AS relationship,
                0 AS relationship_order
         FROM student_profiles student
         JOIN organizations organization ON organization.id = student.organization_id
         WHERE student.account_user_id = ?
           AND student.status = 'active'
           AND organization.status = 'active'
           AND (?::text IS NULL OR organization.slug = ?)
         UNION ALL
         SELECT organization.slug AS organization_slug,
                organization.name AS organization_name,
                student.id AS student_id,
                student.display_name AS student_display_name,
                'guardian'::text AS relationship_kind,
                guardian.id AS guardian_link_id,
                guardian.relationship,
                1 AS relationship_order
         FROM guardian_links guardian
         JOIN organizations organization ON organization.id = guardian.organization_id
         JOIN student_profiles student
           ON student.organization_id = guardian.organization_id
          AND student.id = guardian.student_id
         WHERE guardian.guardian_user_id = ?
           AND guardian.status = 'active'
           AND student.status = 'active'
           AND organization.status = 'active'
           AND (?::text IS NULL OR organization.slug = ?)
       ) context
       ORDER BY context.organization_slug,
                context.student_display_name, context.student_id,
                context.relationship_order, context.guardian_link_id`,
      [actor.userId, slug, slug, actor.userId, slug, slug],
    );
    const contexts: JsonObject[] = [];
    let previousKey: string | null = null;
    for (const row of rows) {
      const key = `${String(row.organization_slug)}:${String(row.student_id)}`;
      if (key !== previousKey) {
        contexts.push({
          organization: {
            slug: String(row.organization_slug),
            name: String(row.organization_name),
          },
          student: {
            id: String(row.student_id),
            displayName: String(row.student_display_name),
          },
          relationships: [],
        });
        previousKey = key;
      }
      const relationships = contexts[contexts.length - 1].relationships as JsonObject[];
      relationships.push(row.relationship_kind === 'student'
        ? { kind: 'student' }
        : {
            kind: 'guardian',
            guardianLinkId: String(row.guardian_link_id),
            relationship: String(row.relationship),
          });
    }
    return contexts;
  },

  async listConversations(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'conversation.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM teaching_conversations conversation
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.student_id = ${scope.student.id}`;
        const rows = await tx`
          SELECT conversation.*, organization.slug AS organization_slug,
                 organization.name AS organization_name,
                 COALESCE(participant.last_read_sequence, 0) AS last_read_sequence
          FROM teaching_conversations conversation
          JOIN organizations organization ON organization.id = conversation.organization_id
          LEFT JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.student_id = ${scope.student.id}
          ORDER BY conversation.last_message_at DESC, conversation.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => conversationRow(row as Record<string, unknown>)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createConversation(
    actor, slug, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, 'conversation.create', 60, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.create', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        const recipients = await lockConversationRecipientUsers(
          tx,
          await conversationRecipients(tx, scope, actor.userId),
        );
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.create:${studentId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const displayName = conversationDisplayName(actor, scope);
        const inserted = await tx`
          INSERT INTO teaching_conversations (
            organization_id, student_id, student_display_name_snapshot, subject,
            created_by_user_id, created_by_display_name_snapshot,
            created_by_role_snapshot, created_by_relationship_snapshot
          ) VALUES (
            ${scope.organization.id}, ${scope.student.id}, ${scope.student.displayName}, ${input.subject},
            ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
          )
          RETURNING id`;
        const conversationId = String(inserted[0].id);
        const appended = await appendConversationMessage(
          tx, actor, scope, conversationId, input.subject, input.body, recipients,
        );
        const rows = await tx`
          SELECT conversation.*, ${scope.organization.slug}::text AS organization_slug,
                 ${scope.organization.name}::text AS organization_name,
                 participant.last_read_sequence
          FROM teaching_conversations conversation
          JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.id = ${conversationId}
            AND conversation.student_id = ${scope.student.id}`;
        const result: MutationResult = {
          status: 201,
          body: {
            conversation: conversationRow(rows[0] as Record<string, unknown>),
            message: appended.message,
          },
        };
        await insertConversationAudit(
          tx, actor, scope, 'conversation.create', 'teaching_conversation',
          conversationId, requestId, { studentId },
        );
        await completeIdempotency(tx, idem.id, result, 'teaching_conversation', conversationId);
        return result;
      }) as MutationResult;
    });
  },

  async getConversation(actor, slug, studentId, conversationId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'conversation.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const rows = await tx`
          SELECT conversation.*, ${scope.organization.slug}::text AS organization_slug,
                 ${scope.organization.name}::text AS organization_name,
                 COALESCE(participant.last_read_sequence, 0) AS last_read_sequence
          FROM teaching_conversations conversation
          LEFT JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.id = ${conversationId}
            AND conversation.student_id = ${scope.student.id}
          FOR SHARE OF conversation`;
        if (!rows.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        return conversationRow(rows[0] as Record<string, unknown>);
      }) as JsonObject;
    });
  },

  async listConversationMessages(
    actor, slug, studentId, conversationId, pagination, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'conversation.message.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const conversations = await tx`
          SELECT id FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR SHARE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const rows = await tx`
          SELECT * FROM teaching_conversation_messages
          WHERE organization_id = ${scope.organization.id}
            AND conversation_id = ${conversationId}
            AND student_id = ${scope.student.id}
            AND sequence > ${pagination.afterSequence}
          ORDER BY sequence
          LIMIT ${pagination.limit + 1}`;
        const hasMore = rows.length > pagination.limit;
        const visible = hasMore ? rows.slice(0, pagination.limit) : rows;
        const nextAfterSequence = visible.length
          ? Number(visible[visible.length - 1].sequence)
          : pagination.afterSequence;
        return {
          items: visible.map((row) => conversationMessageRow(row as Record<string, unknown>)),
          afterSequence: pagination.afterSequence,
          nextAfterSequence,
          hasMore,
        };
      });
    });
  },

  async replyConversation(
    actor, slug, studentId, conversationId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `conversation.reply:${conversationId}`, 120, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.message.send', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        const recipients = await lockConversationRecipientUsers(
          tx,
          await conversationRecipients(tx, scope, actor.userId),
        );
        const conversations = await tx`
          SELECT subject FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR UPDATE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.message.send:${conversationId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const appended = await appendConversationMessage(
          tx, actor, scope, conversationId, String(conversations[0].subject), input.body, recipients,
        );
        const result: MutationResult = {
          status: 201,
          body: {
            message: appended.message,
            conversation: {
              id: conversationId,
              lastMessageSequence: appended.lastMessageSequence,
              lastMessageAt: appended.lastMessageAt,
              lastReadSequence: appended.lastMessageSequence,
              unreadCount: 0,
            },
          },
        };
        await insertConversationAudit(
          tx, actor, scope, 'conversation.message.send', 'teaching_conversation_message',
          String(appended.message.id), requestId, { conversationId, studentId },
        );
        await completeIdempotency(
          tx, idem.id, result, 'teaching_conversation_message', String(appended.message.id),
        );
        return result;
      }) as MutationResult;
    });
  },

  async markConversationRead(
    actor, slug, studentId, conversationId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `conversation.read:${conversationId}`, 240, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.read.mark', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const conversations = await tx`
          SELECT last_message_sequence FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR SHARE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const lastMessageSequence = Number(conversations[0].last_message_sequence);
        if (input.lastReadSequence > lastMessageSequence) {
          throw new TeachingApiException(
            'INVALID_INPUT', 400, 'lastReadSequence cannot exceed the latest message sequence',
          );
        }
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.read.mark:${conversationId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const lastReadSequence = await upsertConversationParticipant(
          tx, scope, conversationId, actor.userId, conversationDisplayName(actor, scope),
          scope.role, scope.relationship, input.lastReadSequence,
        );
        await tx`
          UPDATE notifications SET read_at = COALESCE(read_at, NOW())
          WHERE user_key = ${scope.actorOwnerKey}
            AND kind = 'teaching_message'
            AND dedupe_key LIKE ${`teaching-message:${conversationId}:%`}
            AND split_part(dedupe_key, ':', 3) ~ '^[0-9]+$'
            AND split_part(dedupe_key, ':', 3)::integer <= ${lastReadSequence}
            AND read_at IS NULL`;
        const result: MutationResult = {
          status: 200,
          body: { read: { conversationId, lastReadSequence } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_conversation_read', conversationId);
        return result;
      }) as MutationResult;
    });
  },

  async listLearnerSessions(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'learner.session.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        requireLearnerScope(scope);
        const rows = await tx`
          SELECT session.*, attendance.id AS attendance_id,
                 attendance.status AS attendance_status, attendance.credit_cost,
                 attendance.updated_at AS attendance_updated_at,
                 COUNT(*) OVER()::int AS total,
                 COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                   'displayName', teacher.teacher_display_name_snapshot,
                   'role', CASE teacher.role WHEN 'lead' THEN 'teacher' ELSE 'assistant' END
                 ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 ELSE 1 END,
                   teacher.teacher_display_name_snapshot, teacher.id)
                  FROM session_teachers teacher
                  WHERE teacher.organization_id = session.organization_id
                    AND teacher.session_id = session.id AND teacher.role IN ('lead', 'assistant')),
                  '[]'::jsonb) AS teachers,
                 active_leave.active_leave_request
          FROM attendance_records attendance
          JOIN teaching_sessions session
            ON session.organization_id = attendance.organization_id
           AND session.id = attendance.session_id
          LEFT JOIN LATERAL (
            SELECT JSONB_BUILD_OBJECT(
              'id', leave_request.id::text,
              'organizationId', leave_request.organization_id::text,
              'sessionId', leave_request.session_id::text,
              'attendanceId', leave_request.attendance_id::text,
              'studentId', leave_request.student_id::text,
              'status', leave_request.status,
              'reason', leave_request.reason,
              'decisionReason', leave_request.decision_reason,
              'requestedBy', JSONB_BUILD_OBJECT(
                'userId', leave_request.requested_by_user_id_snapshot::text,
                'displayName', leave_request.requested_by_display_name_snapshot,
                'role', leave_request.requested_by_role_snapshot,
                'relationship', leave_request.requested_by_relationship_snapshot
              ),
              'decidedBy', CASE WHEN leave_request.decided_by_user_id_snapshot IS NULL THEN NULL
                ELSE JSONB_BUILD_OBJECT(
                  'userId', leave_request.decided_by_user_id_snapshot::text,
                  'displayName', leave_request.decided_by_display_name_snapshot,
                  'role', leave_request.decided_by_role_snapshot,
                  'relationship', NULL
                ) END,
              'decidedAt', leave_request.decided_at,
              'createdAt', leave_request.created_at,
              'updatedAt', leave_request.updated_at
            ) AS active_leave_request
            FROM leave_requests leave_request
            WHERE leave_request.organization_id = attendance.organization_id
              AND leave_request.attendance_id = attendance.id
              AND leave_request.status IN ('pending', 'approved')
            ORDER BY leave_request.created_at DESC, leave_request.id DESC LIMIT 1
          ) active_leave ON TRUE
          WHERE attendance.organization_id = ${scope.organization.id}
            AND attendance.student_id = ${studentId}
          ORDER BY session.starts_at DESC, session.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => ({
            id: String(row.id), title: String(row.title),
            startsAt: new Date(String(row.starts_at)).toISOString(),
            endsAt: new Date(String(row.ends_at)).toISOString(), timezone: String(row.timezone),
            status: String(row.status), teachers: row.teachers as JsonValue,
            attendance: {
              id: String(row.attendance_id),
              status: String(row.attendance_status),
              creditCost: Number(row.credit_cost),
              updatedAt: new Date(String(row.attendance_updated_at)).toISOString(),
            },
            activeLeaveRequest: (row.active_leave_request as JsonValue | null) ?? null,
          })),
          total: Number(rows[0]?.total ?? 0), page: pagination.page, pageSize: pagination.pageSize,
        };
      });
    });
  },

  async listLearnerLeaveRequests(actor, slug, studentId, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        requireLearnerScope(scope);
        const attendance = await tx`
          SELECT id FROM attendance_records
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND student_id = ${studentId}`;
        if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const [counts, rows] = await Promise.all([
          tx`SELECT COUNT(*)::int AS count FROM leave_requests
             WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
               AND student_id = ${studentId}`,
          tx`SELECT * FROM leave_requests
             WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
               AND student_id = ${studentId}
             ORDER BY created_at DESC, id DESC
             LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
        ]);
        return {
          items: rows.map((row) => leaveRequestToJson(row as Record<string, unknown>)),
          total: Number(counts[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
        };
      });
    });
  },

  async createLearnerLeaveRequest(
    actor, slug, studentId, sessionId, attendanceId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'learner.leave_request.create', 60, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
          requireLearnerScope(scope);
          const sessions = await tx`
            SELECT * FROM teaching_sessions
            WHERE organization_id = ${scope.organization.id} AND id = ${sessionId}
            FOR UPDATE`;
          if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
          const attendance = await tx`
            SELECT * FROM attendance_records
            WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
              AND id = ${attendanceId} AND student_id = ${studentId}
            FOR UPDATE`;
          if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
          const idem = await beginIdempotency(
            tx, actor.userId, scope.organization.id,
            `learner.leave_request.create:${studentId}:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))
              || attendance[0].status !== 'expected') {
            throw new TeachingApiException('CONFLICT', 409, 'Leave requires expected attendance in an open session');
          }
          const displayName = conversationDisplayName(actor, scope);
          const rows = await tx`
            INSERT INTO leave_requests (
              organization_id, session_id, attendance_id, student_id, reason,
              requested_by_user_id, requested_by_user_id_snapshot,
              requested_by_display_name_snapshot, requested_by_role_snapshot,
              requested_by_relationship_snapshot
            ) VALUES (
              ${scope.organization.id}, ${sessionId}, ${attendanceId}, ${studentId}, ${input.reason},
              ${actor.userId}, ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
            ) RETURNING *`;
          const leaveRequestId = String(rows[0].id);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${scope.organization.id}, ${sessionId}, 'leave_requested', ${actor.userId}, ${scope.role},
            ${displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId, studentId })}
          )`;
          await tx`INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${scope.organization.id}, ${actor.userId}, ${scope.role}, ${displayName},
            'learner.leave_request.create', 'leave_request', ${leaveRequestId}, ${requestId},
            ${sql.json({ sessionId, attendanceId, studentId })}
          )`;
          const result: MutationResult = {
            status: 201,
            body: {
              leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
              attendance: attendanceToJson(attendance[0] as Record<string, unknown>),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Leave request conflicts with the current attendance state');
      }
    });
  },

  async cancelLearnerLeaveRequest(
    actor, slug, studentId, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'learner.leave_request.cancel', 60, '1 minute');
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        requireLearnerScope(scope);
        const sessions = await tx`SELECT id, status FROM teaching_sessions
          WHERE organization_id = ${scope.organization.id} AND id = ${sessionId} FOR UPDATE`;
        if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND id = ${attendanceId} AND student_id = ${studentId}
          FOR UPDATE`;
        if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
            AND student_id = ${studentId} AND requested_by_user_id_snapshot = ${actor.userId}
          FOR UPDATE`;
        if (!requests.length) throw new ConcealedTeachingPermissionDeniedException('Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `learner.leave_request.cancel:${studentId}:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be cancelled after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Only a pending leave request can be cancelled');
        }
        const displayName = conversationDisplayName(actor, scope);
        const rows = await tx`
          UPDATE leave_requests SET
            status = 'cancelled', decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${displayName},
            decided_by_role_snapshot = ${scope.role}, decided_at = NOW()
          WHERE organization_id = ${scope.organization.id} AND id = ${leaveRequestId}
          RETURNING *`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${scope.organization.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${scope.role},
          ${displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId, studentId })}
        )`;
        await tx`INSERT INTO teaching_audit_events (
          organization_id, actor_user_id, actor_role, actor_display_name,
          action, entity_type, entity_id, request_id, metadata
        ) VALUES (
          ${scope.organization.id}, ${actor.userId}, ${scope.role}, ${displayName},
          'learner.leave_request.cancel', 'leave_request', ${leaveRequestId}, ${requestId},
          ${sql.json({ sessionId, attendanceId, studentId })}
        )`;
        const result: MutationResult = {
          status: 200,
          body: {
            leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
            attendance: attendanceToJson(attendance[0] as Record<string, unknown>),
          },
        };
        await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
        return result;
      }) as MutationResult;
    });
  },

  async listLearnerWeeklyReports(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.learner.list', requestId, async () => {
      const commonParams = [slug, studentId, actor.userId, actor.userId];
      const visibilitySql = `report.status = 'published'
        AND report.published_at IS NOT NULL
        AND report.visibility IN ('student', 'student_and_guardians')
        AND (
          student.account_user_id = ?
          OR (
            report.visibility = 'student_and_guardians'
            AND EXISTS (
              SELECT 1 FROM guardian_links guardian
              WHERE guardian.organization_id = student.organization_id
                AND guardian.student_id = student.id
                AND guardian.guardian_user_id = ?
                AND guardian.status = 'active'
            )
          )
        )`;
      const totals = await query<Record<string, unknown>>(
        `SELECT COUNT(*)::int AS total
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND ${visibilitySql}`,
        commonParams,
      );
      const rows = await query<Record<string, unknown>>(
        `SELECT report.*, (student.account_user_id = ?) AS is_self
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND ${visibilitySql}
         ORDER BY report.week_start DESC, report.revision DESC, report.id
         LIMIT ? OFFSET ?`,
        [actor.userId, ...commonParams, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map((row) => learnerWeeklyReportToJson(row, false)),
        total: Number(totals[0]?.total ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async getLearnerWeeklyReport(actor, slug, studentId, reportId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.learner.read', requestId, async () => {
      const rows = await query<Record<string, unknown>>(
        `SELECT report.*, (student.account_user_id = ?) AS is_self
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND report.id = ?
           AND report.status = 'published' AND report.published_at IS NOT NULL
           AND report.visibility IN ('student', 'student_and_guardians')
           AND (
             student.account_user_id = ?
             OR (
               report.visibility = 'student_and_guardians'
               AND EXISTS (
                 SELECT 1 FROM guardian_links guardian
                 WHERE guardian.organization_id = student.organization_id
                   AND guardian.student_id = student.id
                   AND guardian.guardian_user_id = ?
                   AND guardian.status = 'active'
               )
             )
           )`,
        [actor.userId, slug, studentId, reportId, actor.userId, actor.userId],
      );
      if (!rows.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
      }
      return learnerWeeklyReportToJson(rows[0], true);
    });
  },

  async listLearnerLessonFeedback(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.learner.list', requestId, async () => {
      const visibleFeedbackSql = `organization.slug = ? AND organization.status = 'active'
        AND student.id = ? AND student.status = 'active'
        AND feedback.published_at IS NOT NULL
        AND feedback.visibility IN ('student', 'student_and_guardians')
        AND (
          student.account_user_id = ?
          OR (
            feedback.visibility = 'student_and_guardians'
            AND EXISTS (
              SELECT 1 FROM guardian_links guardian
              WHERE guardian.organization_id = student.organization_id
                AND guardian.student_id = student.id
                AND guardian.guardian_user_id = ?
                AND guardian.status = 'active'
            )
          )
        )`;
      const params = [slug, studentId, actor.userId, actor.userId];
      const totals = await query<Record<string, unknown>>(
        `WITH visible AS (
           SELECT feedback.id,
                  ROW_NUMBER() OVER (
                    PARTITION BY feedback.session_id, feedback.student_id
                    ORDER BY feedback.revision DESC, feedback.id DESC
                  ) AS visible_revision_rank
           FROM lesson_feedback feedback
           JOIN organizations organization ON organization.id = feedback.organization_id
           JOIN student_profiles student
             ON student.organization_id = feedback.organization_id AND student.id = feedback.student_id
           WHERE ${visibleFeedbackSql}
         )
         SELECT COUNT(*)::int AS total FROM visible WHERE visible_revision_rank = 1`,
        params,
      );
      const rows = await query<Record<string, unknown>>(
        `WITH visible AS (
           SELECT feedback.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY feedback.session_id, feedback.student_id
                    ORDER BY feedback.revision DESC, feedback.id DESC
                  ) AS visible_revision_rank
           FROM lesson_feedback feedback
           JOIN organizations organization ON organization.id = feedback.organization_id
           JOIN student_profiles student
             ON student.organization_id = feedback.organization_id AND student.id = feedback.student_id
           WHERE ${visibleFeedbackSql}
         )
         SELECT * FROM visible
         WHERE visible_revision_rank = 1
         ORDER BY published_at DESC, session_id DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map(learnerLessonFeedbackToJson),
        total: Number(totals[0]?.total ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
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

  async listTrainingTemplates(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:template:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM training_templates WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT template.*,
                  (SELECT MAX(version_number) FROM training_template_versions version
                   WHERE version.organization_id = template.organization_id
                     AND version.template_id = template.id) AS latest_version_number
           FROM training_templates template
           WHERE template.organization_id = ?
           ORDER BY CASE template.status WHEN 'active' THEN 0 ELSE 1 END,
                    template.name, template.id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(trainingTemplateToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingTemplate(actor, slug, templateId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const rows = await tx`
          SELECT template.*,
                 (SELECT MAX(version_number) FROM training_template_versions version
                  WHERE version.organization_id = template.organization_id
                    AND version.template_id = template.id) AS latest_version_number
          FROM training_templates template
          WHERE template.organization_id = ${access.id} AND template.id = ${templateId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        return trainingTemplateToJson(rows[0] as Record<string, unknown>);
      }) as JsonObject;
    });
  },

  async createTrainingTemplate(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.template.create', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.template.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO training_templates (
              organization_id, name, description, created_by_user_id
            ) VALUES (${access.id}, ${input.name}, ${input.description}, ${actor.userId})
            RETURNING *`;
          const templateId = String(rows[0].id);
          const template = trainingTemplateToJson({ ...rows[0], latest_version_number: null });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.create', 'training_template', templateId,
            requestId, { name: input.name },
          );
          const result: MutationResult = { status: 201, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be created');
      }
    });
  },

  async listTrainingTemplateVersions(actor, slug, templateId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.version.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const templates = await tx`
          SELECT 1 FROM training_templates
          WHERE organization_id = ${access.id} AND id = ${templateId}`;
        if (!templates.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
        const rows = await tx`
          SELECT * FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}
          ORDER BY version_number DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTemplateVersionToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTemplateVersion(
    actor, slug, templateId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.template.version.create:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.version.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const templates = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!templates.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.version.create:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(templates[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Archived training templates cannot receive versions');
          }
          const rows = await tx`
            INSERT INTO training_template_versions (
              organization_id, template_id, version_number, title, instructions,
              source, activity, tool_config, created_by_user_id, published_by_user_id
            ) SELECT ${access.id}, ${templateId},
                     COALESCE(MAX(version_number), 0) + 1,
                     ${input.title}, ${input.instructions}, ${input.source}, ${input.activity},
                     ${sql.json(input.toolConfig)}, ${actor.userId}, ${actor.userId}
              FROM training_template_versions
             WHERE organization_id = ${access.id} AND template_id = ${templateId}
            RETURNING *`;
          const versionId = String(rows[0].id);
          const templateVersion = trainingTemplateVersionToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.template.version.create', 'training_template_version',
            versionId, requestId, { templateId, versionNumber: Number(rows[0].version_number) },
          );
          const result: MutationResult = { status: 201, body: { templateVersion } };
          await completeIdempotency(tx, idem.id, result, 'training_template_version', versionId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template version could not be created');
      }
    });
  },

  async archiveTrainingTemplate(actor, slug, templateId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.template.archive:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.archive', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const rows = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.archive:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Training template is already archived');
          }
          const archived = await tx`
            UPDATE training_templates
            SET status = 'archived', archived_at = clock_timestamp()
            WHERE organization_id = ${access.id} AND id = ${templateId}
            RETURNING *`;
          const versionRows = await tx`
            SELECT MAX(version_number) AS latest_version_number
            FROM training_template_versions
            WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
          const template = trainingTemplateToJson({
            ...archived[0], latest_version_number: versionRows[0]?.latest_version_number,
          });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.archive', 'training_template', templateId,
            requestId, { reason: 'manual_archive' },
          );
          const result: MutationResult = { status: 200, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be archived');
      }
    });
  },

  async listTrainingAssignments(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:assignment:read');
      const statusSql = filter.status === null ? '' : ' AND assignment.status = ?';
      const statusParams = filter.status === null ? [] : [filter.status];
      const organizationScope = hasOrganizationTrainingScope(access.role);
      const scopeCte = organizationScope ? '' : `${ACTIVE_TRAINING_SCOPE_CTE},`;
      const scopeSql = organizationScope ? '' : ` AND EXISTS (
        SELECT 1 FROM training_assignment_targets visible_target
        WHERE visible_target.organization_id = assignment.organization_id
          AND visible_target.assignment_id = assignment.id
          AND (
            (visible_target.target_kind = 'group' AND visible_target.group_id IN (SELECT id FROM scoped_group_ids))
            OR (visible_target.target_kind = 'student' AND visible_target.student_id IN (SELECT id FROM scoped_student_ids))
          )
      )`;
      const scopeParams = organizationScope ? [] : activeTrainingScopeParams(access, actor);
      const countRows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT COUNT(*)::int AS total
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}`,
        [...scopeParams, access.id, ...statusParams],
      );
      const rows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT assignment.*
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}
         ORDER BY assignment.starts_at DESC, assignment.id DESC
         LIMIT ? OFFSET ?`,
        [...scopeParams, access.id, ...statusParams, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map(trainingAssignmentToJson), total: Number(countRows[0]?.total ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingAssignment(actor, slug, assignmentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const rows = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        return body;
      }) as JsonObject;
    });
  },

  async createTrainingAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.assignment.create', 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.assignment.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          const rows = await tx`
            INSERT INTO training_assignments (
              organization_id, template_version_id, title, instructions, schedule_kind,
              expected_count, timezone_snapshot, starts_at, ends_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.templateVersionId}, ${input.title}, ${input.instructions},
              ${input.scheduleKind}, ${input.expectedCount}, ${access.timezone},
              ${input.startsAt}, ${input.endsAt}, ${actor.userId}
            ) RETURNING *`;
          const assignmentId = String(rows[0].id);
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.create', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 201, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be created');
      }
    });
  },

  async reviseTrainingAssignment(
    actor, slug, assignmentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.revise:${assignmentId}`, 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.revise', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(
            tx, access, actor, rows[0] as Record<string, unknown>, 'manage',
          );
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.revise:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be revised');
          }
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          await tx`
            UPDATE training_assignments
            SET template_version_id = ${input.templateVersionId}, title = ${input.title},
                instructions = ${input.instructions}, schedule_kind = ${input.scheduleKind},
                expected_count = ${input.expectedCount}, starts_at = ${input.startsAt},
                ends_at = ${input.endsAt}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.revise', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be revised');
      }
    });
  },

  async publishTrainingAssignment(
    actor, slug, assignmentId, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.publish:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.publish', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const assignments = await tx`
            SELECT assignment.*, version.source, version.activity
            FROM training_assignments assignment
            JOIN training_template_versions version
              ON version.organization_id = assignment.organization_id
             AND version.id = assignment.template_version_id
            WHERE assignment.organization_id = ${access.id} AND assignment.id = ${assignmentId}
            FOR UPDATE OF assignment`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const assignment = assignments[0] as Record<string, unknown>;
          await assertTrainingAssignmentScope(tx, access, actor, assignment, 'manage');
          const selectorRows = await tx`
            SELECT target_kind, group_id, student_id
            FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND (target_kind = 'group' OR source_group_id IS NULL)
            ORDER BY target_kind, COALESCE(group_id, student_id)`;
          const groupIds = selectorRows
            .filter((row) => row.target_kind === 'group')
            .map((row) => String(row.group_id))
            .sort();
          const directStudentIds = selectorRows
            .filter((row) => row.target_kind === 'student')
            .map((row) => String(row.student_id))
            .sort();
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.publish:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(assignment.status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be published');
          }
          const instantRows = await tx`SELECT clock_timestamp() AS published_at`;
          const publishedAt = iso(instantRows[0].published_at);

          for (const groupId of groupIds) {
            await touchTrainingRelationLock(tx, access.id, 'student_group', '*', groupId);
          }
          const groupNames = new Map<string, string>();
          for (const groupId of groupIds) {
            const groups = await tx`
              SELECT teaching_group.id, teaching_group.name
              FROM teaching_groups teaching_group
              LEFT JOIN teaching_campuses campus
                ON campus.organization_id = teaching_group.organization_id
               AND campus.id = teaching_group.campus_id
              WHERE teaching_group.organization_id = ${access.id}
                AND teaching_group.id = ${groupId}
                AND teaching_group.status = 'active'
                AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
              FOR UPDATE OF teaching_group`;
            if (!groups.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training group is no longer active');
            }
            groupNames.set(groupId, String(groups[0].name));
          }

          const groupSourceByStudent = new Map<string, string>();
          for (const groupId of groupIds) {
            const memberships = await tx`
              SELECT membership.student_id
              FROM student_group_memberships membership
              JOIN student_profiles student
                ON student.organization_id = membership.organization_id
               AND student.id = membership.student_id
               AND student.status = 'active'
              WHERE membership.organization_id = ${access.id}
                AND membership.group_id = ${groupId}
                AND membership.effective_from <= ${publishedAt}
                AND (membership.effective_to IS NULL OR membership.effective_to > ${publishedAt})
              ORDER BY membership.student_id`;
            for (const membership of memberships) {
              const studentId = String(membership.student_id);
              const previous = groupSourceByStudent.get(studentId);
              if (previous === undefined || groupId < previous) groupSourceByStudent.set(studentId, groupId);
            }
          }
          const directStudents = new Set(directStudentIds);
          const allStudentIds = [...new Set([...directStudentIds, ...groupSourceByStudent.keys()])].sort();
          if (!allStudentIds.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Published training assignments require at least one active student');
          }
          const studentSnapshots = new Map<string, { displayName: string; externalRef: string | null }>();
          for (const studentId of allStudentIds) {
            const students = await tx`
              SELECT id, display_name, external_ref
              FROM student_profiles
              WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
              FOR UPDATE`;
            if (!students.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training student is no longer active');
            }
            studentSnapshots.set(studentId, {
              displayName: String(students[0].display_name),
              externalRef: students[0].external_ref == null ? null : String(students[0].external_ref),
            });
          }

          for (const [groupId, groupName] of groupNames) {
            await tx`
              UPDATE training_assignment_targets
              SET group_name_snapshot = ${groupName}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'group' AND group_id = ${groupId}`;
          }
          for (const studentId of directStudentIds) {
            const snapshot = studentSnapshots.get(studentId)!;
            await tx`
              UPDATE training_assignment_targets
              SET student_display_name_snapshot = ${snapshot.displayName},
                  student_external_ref_snapshot = ${snapshot.externalRef}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'student' AND student_id = ${studentId}
                AND source_group_id IS NULL`;
          }
          await tx`
            DELETE FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND source_group_id IS NOT NULL`;
          for (const studentId of allStudentIds) {
            if (directStudents.has(studentId)) continue;
            const snapshot = studentSnapshots.get(studentId)!;
            const sourceGroupId = groupSourceByStudent.get(studentId)!;
            await tx`
              INSERT INTO training_assignment_targets (
                organization_id, assignment_id, target_kind, source_group_id, student_id,
                student_display_name_snapshot, student_external_ref_snapshot
              ) VALUES (
                ${access.id}, ${assignmentId}, 'student', ${sourceGroupId},
                ${studentId}, ${snapshot.displayName}, ${snapshot.externalRef}
              )`;
          }
          await tx`
            UPDATE training_assignments
            SET status = 'published', published_at = ${publishedAt}, published_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.publish', 'training_assignment', assignmentId,
            requestId, { groupCount: groupIds.length, directStudentCount: directStudentIds.length, studentCount: allStudentIds.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be published');
      }
    });
  },

  async closeTrainingAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.assignment.close:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.close', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(tx, access, actor, rows[0] as Record<string, unknown>, 'manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.close:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'published') {
            throw new TeachingApiException('CONFLICT', 409, 'Only published training assignments can be closed');
          }
          await tx`
            UPDATE training_assignments
            SET status = 'closed', closed_at = clock_timestamp(), closed_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.close', 'training_assignment', assignmentId,
            requestId, {},
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be closed');
      }
    });
  },

  async listTrainingAssignmentTargets(actor, slug, assignmentId, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, assignments[0] as Record<string, unknown>, 'read',
        );
        const kind = filter.targetKind;
        if (hasOrganizationTrainingScope(access.role)) {
          const totals = await tx`
            SELECT COUNT(*)::int AS total FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})`;
          const rows = await tx`
            SELECT * FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
            LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
          return {
            items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
            page: pagination.page, pageSize: pagination.pageSize,
          };
        }
        const totals = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT COUNT(*)::int AS total FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))`;
        const rows = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT * FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))
          ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetEvidence(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.evidence.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM training_evidence_assignments link
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}`;
        const rows = await tx`
          SELECT evidence.*
          FROM training_evidence_assignments link
          JOIN training_evidence evidence
            ON evidence.organization_id = link.organization_id AND evidence.id = link.evidence_id
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}
          ORDER BY evidence.occurred_at DESC, evidence.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingEvidenceToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetReviews(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}`;
        const rows = await tx`
          SELECT * FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}
          ORDER BY revision DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingReviewToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTargetReview(
    actor, slug, assignmentId, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(
      actor.userId, TRAINING_REVIEW_CREATE_OPERATION, 240, '1 minute',
    );
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:review');
          const assignments = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const targets = await tx`
            SELECT * FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND student_id = ${studentId}
            FOR UPDATE`;
          if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
          if (!hasOrganizationTrainingScope(access.role)
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
            throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id,
            TRAINING_REVIEW_CREATE_OPERATION,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['published', 'closed'].includes(String(assignments[0].status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Draft training assignments cannot be reviewed');
          }
          if (BigInt(String(targets[0].evidence_count)) < 1n) {
            throw new TeachingApiException('CONFLICT', 409, 'Training evidence is required before review');
          }
          const revision = Number(targets[0].latest_review_revision) + 1;
          const rows = await tx`
            INSERT INTO training_submission_reviews (
              organization_id, assignment_id, student_id, revision,
              reviewer_user_id, reviewer_user_id_snapshot, reviewer_display_name_snapshot,
              reviewer_role_snapshot, status, rating, feedback
            ) VALUES (
              ${access.id}, ${assignmentId}, ${studentId}, ${revision},
              ${actor.userId}, ${actor.userId}, ${actor.displayName}, ${access.role},
              ${input.status}, ${input.rating}, ${input.feedback}
            ) RETURNING *`;
          const reviewId = String(rows[0].id);
          const review = trainingReviewToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.target.review.create',
            'training_submission_review', reviewId, requestId,
            { assignmentId, studentId, revision, status: input.status, rating: input.rating },
          );
          const result: MutationResult = { status: 201, body: { review } };
          await completeIdempotency(tx, idem.id, result, 'training_submission_review', reviewId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training review could not be created');
      }
    });
  },

  async listLeaveRequests(actor, slug, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const assigned = scope === 'assigned'
        ? `AND EXISTS (SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = session.organization_id
               AND assigned.session_id = session.id AND assigned.teacher_user_id = ?)`
        : '';
      const params = scope === 'assigned' ? [access.id, sessionId, actor.userId] : [access.id, sessionId];
      const sessions = await query<Record<string, unknown>>(
        `SELECT 1 FROM teaching_sessions session
         WHERE session.organization_id = ? AND session.id = ? ${assigned}`,
        params,
      );
      if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
      const [counts, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM leave_requests WHERE organization_id = ? AND session_id = ?',
          [access.id, sessionId],
        ),
        query<Record<string, unknown>>(
          `SELECT * FROM leave_requests
           WHERE organization_id = ? AND session_id = ?
           ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
          [access.id, sessionId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(leaveRequestToJson), total: Number(counts[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createLeaveRequest(
    actor, slug, sessionId, attendanceId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const session = await lockManagedSession(tx, access, actor, sessionId);
          const attendance = await tx`
            SELECT * FROM attendance_records
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
            FOR UPDATE`;
          if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `leave_request.create:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['scheduled', 'in_progress'].includes(String(session.status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Leave can only be requested for an open session');
          }
          const rows = await tx`
            INSERT INTO leave_requests (
              organization_id, session_id, attendance_id, student_id, reason,
              requested_by_user_id, requested_by_user_id_snapshot,
              requested_by_display_name_snapshot, requested_by_role_snapshot
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendanceId}, ${String(attendance[0].student_id)}, ${input.reason},
              ${actor.userId}, ${actor.userId}, ${actor.displayName}, ${access.role}
            ) RETURNING *`;
          const leaveRequest = leaveRequestToJson(rows[0] as Record<string, unknown>);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'leave_requested', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ leaveRequestId: String(rows[0].id), attendanceId })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'leave_request.create', 'leave_request', String(rows[0].id), requestId,
            { sessionId, attendanceId },
          );
          const result: MutationResult = {
            status: 201, body: { leaveRequest, attendance: attendanceToJson(attendance[0] as Record<string, unknown>) },
          };
          await completeIdempotency(tx, idem.id, result, 'leave_request', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Leave request conflicts with the current attendance state');
      }
    });
  },

  async decideLeaveRequest(
    actor, slug, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.decide', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.decide', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const session = await lockManagedSession(tx, access, actor, sessionId);
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
          FOR UPDATE`;
        if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
          FOR UPDATE`;
        if (!requests.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `leave_request.decide:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(session.status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be decided after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Leave request has already been decided');
        }
        if (input.decision === 'approved') {
          if (attendance[0].status !== 'expected') {
            throw new TeachingApiException('CONFLICT', 409, 'Approved leave requires expected attendance');
          }
          await tx`
            UPDATE attendance_records SET status = 'excused', recorded_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${attendanceId}`;
        }
        const rows = await tx`
          UPDATE leave_requests SET
            status = ${input.decision}, decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${actor.displayName},
            decided_by_role_snapshot = ${access.role}, decided_at = NOW()
          WHERE organization_id = ${access.id} AND id = ${leaveRequestId}
          RETURNING *`;
        const savedAttendance = await tx`
          SELECT * FROM attendance_records WHERE organization_id = ${access.id} AND id = ${attendanceId}`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${access.id}, ${sessionId}, 'leave_decided', ${actor.userId}, ${access.role},
          ${actor.displayName}, ${requestId},
          ${sql.json({ leaveRequestId, attendanceId, decision: input.decision })}
        )`;
        await insertTrainingAudit(
          tx, access, actor, 'leave_request.decide', 'leave_request', leaveRequestId, requestId,
          { sessionId, attendanceId, decision: input.decision },
        );
        const result: MutationResult = {
          status: 200,
          body: {
            leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
            attendance: attendanceToJson(savedAttendance[0] as Record<string, unknown>),
          },
        };
        await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
        return result;
      }) as MutationResult;
    });
  },

  async cancelLeaveRequest(
    actor, slug, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.cancel', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const session = await lockManagedSession(tx, access, actor, sessionId);
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
          FOR UPDATE`;
        if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
          FOR UPDATE`;
        if (!requests.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `leave_request.cancel:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(session.status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be cancelled after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Only a pending leave request can be cancelled');
        }
        const rows = await tx`
          UPDATE leave_requests SET
            status = 'cancelled', decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${actor.displayName},
            decided_by_role_snapshot = ${access.role}, decided_at = NOW()
          WHERE organization_id = ${access.id} AND id = ${leaveRequestId}
          RETURNING *`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${access.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${access.role},
          ${actor.displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId })}
        )`;
        await insertTrainingAudit(
          tx, access, actor, 'leave_request.cancel', 'leave_request', leaveRequestId, requestId,
          { sessionId, attendanceId },
        );
        const result: MutationResult = {
          status: 200,
          body: {
            leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
            attendance: attendanceToJson(attendance[0] as Record<string, unknown>),
          },
        };
        await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
        return result;
      }) as MutationResult;
    });
  },

  async listMakeupAttempts(actor, slug, sessionId, attendanceId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const sessionParams = scope === 'assigned'
        ? [access.id, sessionId, actor.userId, attendanceId]
        : [access.id, sessionId, attendanceId];
      const assigned = scope === 'assigned'
        ? `AND EXISTS (SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = session.organization_id
               AND assigned.session_id = session.id AND assigned.teacher_user_id = ?)`
        : '';
      const source = await query<Record<string, unknown>>(
        `SELECT attendance.id FROM teaching_sessions session
         JOIN attendance_records attendance
           ON attendance.organization_id = session.organization_id AND attendance.session_id = session.id
         WHERE session.organization_id = ? AND session.id = ? ${assigned}
           AND attendance.id = ?`,
        sessionParams,
      );
      if (!source.length) throw new ConcealedTeachingPermissionDeniedException('Attendance record not found');
      const [counts, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM makeup_attempts WHERE organization_id = ? AND source_attendance_id = ?',
          [access.id, attendanceId],
        ),
        query<Record<string, unknown>>(
          `SELECT * FROM makeup_attempts
           WHERE organization_id = ? AND source_attendance_id = ?
           ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
          [access.id, attendanceId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(makeupAttemptToJson), total: Number(counts[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async listMakeupCandidates(actor, slug, sessionId, attendanceId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.candidates', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const source = await query<Record<string, unknown>>(
        `SELECT source.ends_at, attendance.student_id, attendance.student_package_id,
                attendance.credit_cost
         FROM teaching_sessions source
         JOIN attendance_records attendance
           ON attendance.organization_id = source.organization_id AND attendance.session_id = source.id
         JOIN leave_requests leave_request
           ON leave_request.organization_id = attendance.organization_id
          AND leave_request.attendance_id = attendance.id AND leave_request.status = 'approved'
         WHERE source.organization_id = ? AND source.id = ? AND attendance.id = ?
           AND source.status IN ('scheduled', 'in_progress', 'completed')
           ${scope === 'assigned' ? `AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = source.organization_id
               AND assigned.session_id = source.id AND assigned.teacher_user_id = ?
           )` : ''}`,
        scope === 'assigned'
          ? [access.id, sessionId, attendanceId, actor.userId]
          : [access.id, sessionId, attendanceId],
      );
      if (!source.length) throw new ConcealedTeachingPermissionDeniedException('Attendance record not found');
      const sourceRow = source[0];
      const rows = await query<Record<string, unknown>>(
        `SELECT target.id AS session_id, target.title, target.starts_at, target.ends_at, target.timezone,
                target_attendance.id AS attendance_id,
                COUNT(*) OVER()::int AS total,
                COALESCE((
                  SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                    'userId', teacher.teacher_user_id_snapshot::text,
                    'displayName', teacher.teacher_display_name_snapshot,
                    'role', CASE teacher.role WHEN 'lead' THEN 'teacher' ELSE 'assistant' END
                  ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 ELSE 1 END,
                    teacher.teacher_display_name_snapshot, teacher.id)
                  FROM session_teachers teacher
                  WHERE teacher.organization_id = target.organization_id
                    AND teacher.session_id = target.id AND teacher.role IN ('lead', 'assistant')
                ), '[]'::jsonb) AS teachers
         FROM teaching_sessions target
         JOIN student_packages package
           ON package.organization_id = target.organization_id AND package.id = ?
          AND package.student_id = ? AND package.lifecycle_status = 'active'
          AND package.valid_from <= target.starts_at
          AND (package.valid_until IS NULL OR package.valid_until > target.starts_at)
         LEFT JOIN attendance_records target_attendance
           ON target_attendance.organization_id = target.organization_id
          AND target_attendance.session_id = target.id
          AND target_attendance.student_id = ?
         WHERE target.organization_id = ? AND target.status = 'scheduled'
           AND target.id <> ? AND target.starts_at > NOW() AND target.starts_at > ?
           AND (target_attendance.id IS NULL OR (
             target_attendance.status = 'expected'
             AND target_attendance.student_package_id = ?
             AND target_attendance.credit_cost = ?
           ))
           AND NOT EXISTS (
             SELECT 1 FROM makeup_attempts nested
             WHERE nested.organization_id = target.organization_id
               AND (
                 nested.target_attendance_id = ?
                 OR (nested.source_attendance_id = ? AND nested.status IN ('scheduled', 'fulfilled'))
                 OR (target_attendance.id IS NOT NULL AND (
                   nested.source_attendance_id = target_attendance.id
                   OR nested.target_attendance_id = target_attendance.id
                 ))
               )
           )
           ${scope === 'assigned' ? `AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = target.organization_id
               AND assigned.session_id = target.id AND assigned.teacher_user_id = ?
           )` : ''}
         ORDER BY target.starts_at, target.id LIMIT ? OFFSET ?`,
        scope === 'assigned'
          ? [sourceRow.student_package_id, sourceRow.student_id,
              sourceRow.student_id, access.id, sessionId, sourceRow.ends_at,
              sourceRow.student_package_id, sourceRow.credit_cost, attendanceId, attendanceId, actor.userId,
              pagination.pageSize, pagination.offset]
          : [sourceRow.student_package_id, sourceRow.student_id,
              sourceRow.student_id, access.id, sessionId, sourceRow.ends_at,
              sourceRow.student_package_id, sourceRow.credit_cost, attendanceId, attendanceId,
              pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map((row) => ({
          sessionId: String(row.session_id), title: String(row.title),
          startsAt: new Date(String(row.starts_at)).toISOString(),
          endsAt: new Date(String(row.ends_at)).toISOString(), timezone: String(row.timezone),
          teachers: row.teachers as JsonValue,
          attendanceId: row.attendance_id == null ? null : String(row.attendance_id),
        })),
        total: Number(rows[0]?.total ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async scheduleMakeup(
    actor, slug, sessionId, attendanceId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.schedule', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'makeup_attempt.schedule', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireSessionScope(access, 'session:manage');
          const sessionIds = [sessionId, input.targetSessionId].sort();
          const sessions = await tx`
            SELECT session.*, TRANSACTION_TIMESTAMP() AS operation_now FROM teaching_sessions session
            WHERE organization_id = ${access.id} AND id IN ${sql(sessionIds)}
            ORDER BY id FOR UPDATE`;
          if (sessions.length !== 2) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
          if (scope === 'assigned') {
            const assigned = await tx`
              SELECT session_id FROM session_teachers
              WHERE organization_id = ${access.id} AND session_id IN ${sql(sessionIds)}
                AND teacher_user_id = ${actor.userId}
              ORDER BY session_id, id FOR SHARE`;
            if (new Set(assigned.map((row) => String(row.session_id))).size !== 2) {
              throw new ConcealedTeachingPermissionDeniedException('Session not found');
            }
          }
          const sourceSession = sessions.find((row) => String(row.id) === sessionId) as Record<string, unknown>;
          const targetSession = sessions.find((row) => String(row.id) === input.targetSessionId) as Record<string, unknown>;
          const attendanceRows = await tx`
            SELECT attendance.*
            FROM attendance_records attendance
            JOIN attendance_records source
              ON source.organization_id = attendance.organization_id
             AND source.session_id = ${sessionId} AND source.id = ${attendanceId}
            WHERE attendance.organization_id = ${access.id}
              AND (
                attendance.id = source.id
                OR (
                  attendance.session_id = ${input.targetSessionId}
                  AND attendance.student_id = source.student_id
                )
              )
            ORDER BY attendance.id
            FOR UPDATE OF attendance`;
          const sourceAttendanceRows = attendanceRows.filter((row) => String(row.id) === attendanceId);
          if (!sourceAttendanceRows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          }
          const sourceAttendance = sourceAttendanceRows[0] as Record<string, unknown>;
          const targetAttendanceRows = attendanceRows.filter(
            (row) => String(row.session_id) === input.targetSessionId
              && String(row.student_id) === String(sourceAttendance.student_id),
          );
          const targetAttendanceId = targetAttendanceRows[0]?.id == null
            ? null
            : String(targetAttendanceRows[0].id);
          const existingAttempts = await tx`
            SELECT id, status, source_attendance_id, target_attendance_id FROM makeup_attempts
            WHERE organization_id = ${access.id}
              AND (
                target_attendance_id = ${attendanceId}
                OR (source_attendance_id = ${attendanceId} AND status IN ('scheduled', 'fulfilled'))
                OR (${targetAttendanceId}::uuid IS NOT NULL AND (
                  source_attendance_id = ${targetAttendanceId}
                  OR target_attendance_id = ${targetAttendanceId}
                ))
              )
            ORDER BY id FOR UPDATE`;
          const approvedLeave = await tx`
            SELECT id FROM leave_requests
            WHERE organization_id = ${access.id} AND attendance_id = ${attendanceId} AND status = 'approved'
            FOR UPDATE`;
          const packageId = sourceAttendance.student_package_id == null
            ? null
            : String(sourceAttendance.student_package_id);
          const packageRows = packageId === null
            ? []
            : await tx`SELECT id, lifecycle_status, valid_from, valid_until FROM student_packages
              WHERE organization_id = ${access.id} AND id = ${packageId}
                AND student_id = ${String(sourceAttendance.student_id)}
              FOR SHARE`;
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `makeup_attempt.schedule:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!approvedLeave.length || sourceAttendance.status !== 'excused' || packageId === null) {
            throw new TeachingApiException('CONFLICT', 409, 'Makeup requires approved excused attendance with a package');
          }
          if (!['scheduled', 'in_progress', 'completed'].includes(String(sourceSession.status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Source session cannot accept a makeup');
          }
          if (targetSession.status !== 'scheduled'
              || new Date(String(targetSession.starts_at)).getTime()
                <= new Date(String(targetSession.operation_now)).getTime()
              || new Date(String(targetSession.starts_at)).getTime() <= new Date(String(sourceSession.ends_at)).getTime()) {
            throw new TeachingApiException('CONFLICT', 409, 'Target session must be a later future scheduled session');
          }
          const studentPackage = packageRows[0] as Record<string, unknown> | undefined;
          const targetStartsAt = new Date(String(targetSession.starts_at)).getTime();
          if (!studentPackage || studentPackage.lifecycle_status !== 'active'
              || new Date(String(studentPackage.valid_from)).getTime() > targetStartsAt
              || (studentPackage.valid_until != null
                && new Date(String(studentPackage.valid_until)).getTime() <= targetStartsAt)) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package is not active for the target session');
          }
          if (existingAttempts.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Attendance is already part of a makeup chain');
          }
          let targetAttendance: Record<string, unknown>;
          if (targetAttendanceRows.length) {
            targetAttendance = targetAttendanceRows[0] as Record<string, unknown>;
            if (targetAttendance.status !== 'expected'
                || String(targetAttendance.student_package_id) !== packageId
                || Number(targetAttendance.credit_cost) !== Number(sourceAttendance.credit_cost)) {
              throw new TeachingApiException('CONFLICT', 409, 'Existing target attendance does not match the source');
            }
          } else {
            const insertedAttendance = await tx`
              INSERT INTO attendance_records (
                organization_id, session_id, student_id, student_package_id,
                status, credit_cost, notes
              ) VALUES (
                ${access.id}, ${input.targetSessionId}, ${String(sourceAttendance.student_id)},
                ${packageId}, 'expected', ${Number(sourceAttendance.credit_cost)}, ''
              ) RETURNING *`;
            targetAttendance = insertedAttendance[0] as Record<string, unknown>;
          }
          const rows = await tx`
            INSERT INTO makeup_attempts (
              organization_id, source_session_id, source_attendance_id,
              target_session_id, target_attendance_id, student_id, student_package_id,
              credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
              created_by_display_name_snapshot, created_by_role_snapshot
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendanceId}, ${input.targetSessionId},
              ${String(targetAttendance.id)}, ${String(sourceAttendance.student_id)}, ${packageId},
              ${Number(sourceAttendance.credit_cost)}, ${input.reason}, ${actor.userId}, ${actor.userId},
              ${actor.displayName}, ${access.role}
            ) RETURNING *`;
          const makeupAttemptId = String(rows[0].id);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${input.targetSessionId}, 'makeup_scheduled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ makeupAttemptId, sourceSessionId: sessionId, sourceAttendanceId: attendanceId })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'makeup_attempt.schedule', 'makeup_attempt', makeupAttemptId, requestId,
            { sourceSessionId: sessionId, sourceAttendanceId: attendanceId, targetSessionId: input.targetSessionId },
          );
          const result: MutationResult = {
            status: 201,
            body: {
              makeupAttempt: makeupAttemptToJson(rows[0] as Record<string, unknown>),
              attendance: attendanceToJson(targetAttendance),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'makeup_attempt', makeupAttemptId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Makeup scheduling conflicts with the current attendance state');
      }
    });
  },

  async saveAttendanceBatch(actor, slug, sessionId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.attendance.batch', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.attendance.batch', 240, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
        if (!sessions.length) {
          if (scope === 'assigned') {
            const existing = await tx`
              SELECT 1 FROM teaching_sessions
              WHERE organization_id = ${access.id} AND id = ${sessionId}`;
            if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
          }
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.attendance.batch:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Attendance cannot change after the session is closed');
        }
        const attendanceIds = [...input.records.map((item) => item.attendanceId)].sort();
        const lockedAttendance = await tx`
          SELECT id, student_package_id FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND id IN ${sql(attendanceIds)}
          ORDER BY student_package_id NULLS LAST, id
          FOR UPDATE`;
        if (lockedAttendance.length !== attendanceIds.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        }
        const protectedLeave = await tx`
          SELECT attendance_id FROM leave_requests
          WHERE organization_id = ${access.id}
            AND attendance_id IN ${sql(attendanceIds)}
            AND status IN ('pending', 'approved')
          ORDER BY attendance_id
          FOR UPDATE`;
        if (protectedLeave.length) {
          throw new TeachingApiException(
            'CONFLICT', 409,
            'Pending or approved leave attendance must be changed through the leave workflow',
          );
        }
        const saved: JsonObject[] = [];
        for (const item of input.records) {
          const rows = await tx`
            UPDATE attendance_records
            SET status = ${item.status}, recorded_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${item.attendanceId}
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          if (!rows.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          const row = rows[0] as Record<string, unknown>;
          saved.push({
            id: String(row.id), studentId: String(row.student_id),
            studentPackageId: row.student_package_id == null ? null : String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost),
            notes: row.notes == null ? null : String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'attendance_updated', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ count: saved.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.attendance.batch', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ count: saved.length })}
          )`;
        const result: MutationResult = { status: 200, body: { attendance: saved } };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async completeSession(actor, slug, sessionId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.complete', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.complete', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
        if (!sessions.length) {
          if (scope === 'assigned') {
            const existing = await tx`
              SELECT 1 FROM teaching_sessions
              WHERE organization_id = ${access.id} AND id = ${sessionId}`;
            if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
          }
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.complete:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const session = sessions[0] as Record<string, unknown>;
        if (session.status === 'cancelled') {
          throw new TeachingApiException('CONFLICT', 409, 'A cancelled session cannot be completed');
        }
        if (session.status === 'completed') {
          const totals = await tx`
            SELECT COUNT(*)::int AS attendance_count, COALESCE(-SUM(delta), 0)::int AS total_credits
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND entry_type = 'consume'`;
          const result: MutationResult = {
            status: 200,
            body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(session.completed_at)).toISOString() },
              consumption: { attendanceCount: Number(totals[0].attendance_count), totalCredits: Number(totals[0].total_credits) } },
          };
          await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
          return result;
        }
        const attendanceRows = await tx`
          SELECT id, student_id, student_package_id, status, credit_cost
          FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
          ORDER BY student_package_id NULLS LAST, id
          FOR UPDATE`;
        if (!attendanceRows.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Session needs attendance before completion');
        }
        const pendingLeaves = await tx`
          SELECT id FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'
          ORDER BY attendance_id, id
          FOR UPDATE`;
        if (pendingLeaves.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Resolve pending leave requests before completion');
        }
        if (attendanceRows.some((row) => row.status === 'expected')) {
          throw new TeachingApiException('CONFLICT', 409, 'Resolve all expected attendance before completion');
        }
        await tx`
          SELECT id FROM makeup_attempts
          WHERE organization_id = ${access.id} AND target_session_id = ${sessionId}
            AND status = 'scheduled'
          ORDER BY id FOR UPDATE`;
        const billable = attendanceRows.filter((row) => row.status === 'present' || row.status === 'late');
        const packageIds = [...new Set(billable.map((row) => String(row.student_package_id)))].sort();
        const lockedPackages = packageIds.length
          ? await tx`
              SELECT id, student_id, lifecycle_status, valid_from, valid_until
              FROM student_packages
              WHERE organization_id = ${access.id} AND id IN ${sql(packageIds)}
              ORDER BY id
              FOR UPDATE`
          : [];
        const completed = await tx`
          UPDATE teaching_sessions
          SET status = 'completed', completed_at = NOW(), version = version + 1
          WHERE organization_id = ${access.id} AND id = ${sessionId}
          RETURNING completed_at`;
        let totalCredits = 0;
        for (const attendance of billable) {
          const packageId = String(attendance.student_package_id);
          const studentPackage = lockedPackages.find((row) => (
            String(row.id) === packageId && String(row.student_id) === String(attendance.student_id)
          )) as Record<string, unknown> | undefined;
          if (!studentPackage) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
          const sessionStartsAt = new Date(String(session.starts_at)).getTime();
          if (
            studentPackage.lifecycle_status !== 'active' ||
            new Date(String(studentPackage.valid_from)).getTime() > sessionStartsAt ||
            (studentPackage.valid_until != null && new Date(String(studentPackage.valid_until)).getTime() <= sessionStartsAt)
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package is not active for the session time');
          }
          const balances = await tx`
            SELECT COALESCE(SUM(delta), 0)::int AS balance
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND student_package_id = ${packageId}`;
          const creditCost = Number(attendance.credit_cost);
          if (Number(balances[0].balance) < creditCost) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package has insufficient credits');
          }
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              attendance_id, session_id, idempotency_key, reason, actor_user_id,
              actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${packageId}, ${String(attendance.student_id)}, 'consume', ${-creditCost},
              ${String(attendance.id)}, ${sessionId}, ${`attendance:${String(attendance.id)}`},
              'Session attendance', ${actor.userId}, ${access.role}, ${actor.displayName},
              ${sql.json({ attendanceStatus: String(attendance.status) })}
            )`;
          totalCredits += creditCost;
        }
        const resolvedMakeups = await tx`
          UPDATE makeup_attempts attempt
          SET status = CASE attendance.status
                WHEN 'present' THEN 'fulfilled'
                WHEN 'late' THEN 'fulfilled'
                ELSE 'failed'
              END,
              resolved_by_user_id = ${actor.userId},
              resolved_by_user_id_snapshot = ${actor.userId},
              resolved_by_display_name_snapshot = ${actor.displayName},
              resolved_by_role_snapshot = ${access.role},
              resolution_reason = CASE attendance.status
                WHEN 'present' THEN 'Target attendance completed'
                WHEN 'late' THEN 'Target attendance completed'
                ELSE 'Target attendance was not billable'
              END,
              resolved_at = NOW()
          FROM attendance_records attendance
          WHERE attempt.organization_id = ${access.id}
            AND attempt.target_session_id = ${sessionId}
            AND attempt.status = 'scheduled'
            AND attendance.organization_id = attempt.organization_id
            AND attendance.id = attempt.target_attendance_id
            AND attendance.status IN ('present', 'late', 'absent', 'excused')
          RETURNING attempt.id, attempt.status, attempt.source_session_id`;
        for (const makeup of resolvedMakeups) {
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId},
            ${makeup.status === 'fulfilled' ? 'makeup_fulfilled' : 'makeup_failed'},
            ${actor.userId}, ${access.role}, ${actor.displayName}, ${requestId},
            ${sql.json({ makeupAttemptId: String(makeup.id), sourceSessionId: String(makeup.source_session_id) })}
          )`;
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'completed', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.complete', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        const result: MutationResult = {
          status: 200,
          body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(completed[0].completed_at)).toISOString() },
            consumption: { attendanceCount: billable.length, totalCredits } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async cancelSession(actor, slug, sessionId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.cancel', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const cancellation = await lockManagedCancellationGraph(tx, access, actor, sessionId);
        const { session } = cancellation;
        const attendanceRows = await tx`
          SELECT attendance.*, student.display_name
          FROM attendance_records attendance
          JOIN student_profiles student
            ON student.organization_id = attendance.organization_id
           AND student.id = attendance.student_id
          WHERE attendance.organization_id = ${access.id} AND attendance.session_id = ${sessionId}
          ORDER BY attendance.student_package_id NULLS LAST, attendance.id
          FOR UPDATE OF attendance`;
        const leaveRows = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'
          ORDER BY attendance_id, id FOR UPDATE`;
        const attemptRows = await tx`
          SELECT * FROM makeup_attempts
          WHERE organization_id = ${access.id} AND status = 'scheduled'
            AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})
          ORDER BY id FOR UPDATE`;
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.cancel:${sessionId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (session.status === 'completed') {
          throw new TeachingApiException('CONFLICT', 409, 'A completed session cannot be cancelled');
        }
        if (session.status !== 'cancelled') {
          await tx`
            UPDATE leave_requests SET
              status = 'cancelled', decision_reason = ${input.reason},
              decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
              decided_by_display_name_snapshot = ${actor.displayName},
              decided_by_role_snapshot = ${access.role}, decided_at = NOW()
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'`;
          await tx`
            UPDATE makeup_attempts SET
              status = 'cancelled', resolved_by_user_id = ${actor.userId},
              resolved_by_user_id_snapshot = ${actor.userId},
              resolved_by_display_name_snapshot = ${actor.displayName},
              resolved_by_role_snapshot = ${access.role},
              resolution_reason = ${input.reason}, resolved_at = NOW()
            WHERE organization_id = ${access.id} AND status = 'scheduled'
              AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})`;
          await tx`
            UPDATE teaching_sessions
            SET status = 'cancelled', cancelled_at = NOW(), version = version + 1
            WHERE organization_id = ${access.id} AND id = ${sessionId}`;
          if (leaveRows.length) {
            await tx`INSERT INTO session_events (
              organization_id, session_id, event_type, actor_user_id, actor_role,
              actor_display_name, request_id, metadata
            ) VALUES (
              ${access.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${requestId}, ${sql.json({ count: leaveRows.length, reason: input.reason })}
            )`;
          }
          if (attemptRows.length) {
            await tx`INSERT INTO session_events (
              organization_id, session_id, event_type, actor_user_id, actor_role,
              actor_display_name, request_id, metadata
            ) VALUES (
              ${access.id}, ${sessionId}, 'makeup_cancelled', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${requestId}, ${sql.json({ count: attemptRows.length, reason: input.reason })}
            )`;
          }
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'cancelled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ reason: input.reason })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'session.cancel', 'teaching_session', sessionId, requestId,
            { reason: input.reason, leaveRequestCount: leaveRows.length, makeupAttemptCount: attemptRows.length },
          );
        }
        const details = await tx`
          SELECT session.*,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
              'userId', teacher.teacher_user_id_snapshot,
              'displayName', teacher.teacher_display_name_snapshot,
              'role', teacher.role
            ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
              teacher.teacher_display_name_snapshot, teacher.id)
             FROM session_teachers teacher
             WHERE teacher.organization_id = session.organization_id
               AND teacher.session_id = session.id), '[]'::jsonb) AS teachers
          FROM teaching_sessions session
          WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}`;
        const detail = details[0] as Record<string, unknown>;
        const resolvedAttempts = attemptRows.length
          ? await tx`
              SELECT * FROM makeup_attempts
              WHERE organization_id = ${access.id}
                AND id IN ${sql(attemptRows.map((row) => String(row.id)))}
              ORDER BY created_at DESC, id DESC`
          : [];
        const sessionJson: JsonObject = {
          id: sessionId, title: String(detail.title),
          startsAt: new Date(String(detail.starts_at)).toISOString(),
          endsAt: new Date(String(detail.ends_at)).toISOString(), timezone: String(detail.timezone),
          status: String(detail.status), version: Number(detail.version),
          startedAt: detail.started_at == null ? null : new Date(String(detail.started_at)).toISOString(),
          completedAt: detail.completed_at == null ? null : new Date(String(detail.completed_at)).toISOString(),
          cancelledAt: detail.cancelled_at == null ? null : new Date(String(detail.cancelled_at)).toISOString(),
          teachers: detail.teachers as JsonValue,
          attendance: attendanceRows.map((row) => ({
            ...attendanceToJson(row as Record<string, unknown>), displayName: String(row.display_name),
          })),
          attendanceCount: attendanceRows.length,
          createdAt: new Date(String(detail.created_at)).toISOString(),
          updatedAt: new Date(String(detail.updated_at)).toISOString(),
        };
        const result: MutationResult = {
          status: 200,
          body: { session: sessionJson, makeupAttempts: resolvedAttempts.map(makeupAttemptToJson) },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async createLessonFeedback(
    actor, slug, sessionId, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, LESSON_FEEDBACK_CREATE_OPERATION, 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireSessionScope(access, 'feedback:manage');
          const sessions = scope === 'organization'
            ? await tx`
                SELECT session.id, session.status
                FROM teaching_sessions session
                WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
                FOR UPDATE OF session`
            : await tx`
                SELECT session.id, session.status
                FROM teaching_sessions session
                WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
                  AND EXISTS (
                    SELECT 1 FROM session_teachers assigned
                    WHERE assigned.organization_id = session.organization_id
                      AND assigned.session_id = session.id
                      AND assigned.teacher_user_id = ${actor.userId}
                  )
                FOR UPDATE OF session`;
          if (!sessions.length) {
            if (scope === 'assigned') {
              const existing = await tx`
                SELECT 1 FROM teaching_sessions
                WHERE organization_id = ${access.id} AND id = ${sessionId}`;
              if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
            }
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            LESSON_FEEDBACK_CREATE_OPERATION,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (sessions[0].status !== 'completed') {
            throw new TeachingApiException('CONFLICT', 409, 'Lesson feedback requires a completed session');
          }
          const attendance = await tx`
            SELECT 1
            FROM attendance_records
            WHERE organization_id = ${access.id}
              AND session_id = ${sessionId}
              AND student_id = ${studentId}
            FOR UPDATE`;
          if (!attendance.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session attendance not found');
          }
          const rows = await tx`
            INSERT INTO lesson_feedback (
              organization_id, session_id, student_id, visibility,
              summary, strengths, challenges, next_goals, internal_notes,
              author_user_id
            ) VALUES (
              ${access.id}, ${sessionId}, ${studentId}, ${input.visibility},
              ${input.summary}, ${input.strengths}, ${input.challenges},
              ${input.nextGoals}, ${input.internalNotes}, ${actor.userId}
            )
            RETURNING *`;
          const feedback = lessonFeedbackToJson(rows[0] as Record<string, unknown>);
          const feedbackId = String(rows[0].id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'lesson_feedback.create', 'lesson_feedback', ${feedbackId}, ${requestId},
              ${sql.json({
                sessionId,
                studentId,
                revision: Number(rows[0].revision),
                visibility: input.visibility,
              })}
            )`;
          const result: MutationResult = { status: 201, body: { feedback } };
          await completeIdempotency(tx, idem.id, result, 'lesson_feedback', feedbackId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Lesson feedback could not be created');
      }
    });
  },

  async listWeeklyReports(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireReportScope(access, 'report:read');
      return await sql.begin(async (tx) => {
        if (scope === 'assigned' && filter.studentId !== null
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, filter.studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Weekly report student not found');
        }
        const scopeClause = scope === 'assigned'
          ? sql`AND EXISTS (
              SELECT 1
              FROM student_profiles active_student
              WHERE active_student.organization_id = report.organization_id
                AND active_student.id = report.student_id
                AND active_student.status = 'active'
            )
            AND EXISTS (
              SELECT 1 FROM teacher_assignments direct_scope
              WHERE direct_scope.organization_id = report.organization_id
                AND direct_scope.teacher_user_id = ${actor.userId}
                AND direct_scope.student_id = report.student_id
                AND direct_scope.effective_from <= clock_timestamp()
                AND (direct_scope.effective_to IS NULL OR direct_scope.effective_to > clock_timestamp())
              UNION ALL
              SELECT 1
              FROM teacher_assignments group_scope
              JOIN teaching_groups teaching_group
                ON teaching_group.organization_id = group_scope.organization_id
               AND teaching_group.id = group_scope.group_id
               AND teaching_group.status = 'active'
              LEFT JOIN teaching_campuses campus
                ON campus.organization_id = teaching_group.organization_id
               AND campus.id = teaching_group.campus_id
              JOIN student_group_memberships membership
                ON membership.organization_id = group_scope.organization_id
               AND membership.group_id = group_scope.group_id
               AND membership.student_id = report.student_id
               AND membership.effective_from <= clock_timestamp()
               AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
              WHERE group_scope.organization_id = report.organization_id
                AND group_scope.teacher_user_id = ${actor.userId}
                AND group_scope.effective_from <= clock_timestamp()
                AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
                AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
            )`
          : sql``;
        const studentClause = filter.studentId === null
          ? sql``
          : sql`AND report.student_id = ${filter.studentId}`;
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM teaching_weekly_reports report
          WHERE report.organization_id = ${access.id}
          ${studentClause}
          ${scopeClause}`;
        const rows = await tx`
          SELECT report.*
          FROM teaching_weekly_reports report
          WHERE report.organization_id = ${access.id}
          ${studentClause}
          ${scopeClause}
          ORDER BY report.week_start DESC, report.student_display_name_snapshot, report.revision DESC, report.id
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => weeklyReportToJson(row as Record<string, unknown>, false)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async getWeeklyReport(actor, slug, reportId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireReportScope(access, 'report:read');
      return await sql.begin(async (tx) => {
        const rows = await tx`
          SELECT * FROM teaching_weekly_reports
          WHERE organization_id = ${access.id} AND id = ${reportId}`;
        if (!rows.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
        }
        const report = rows[0] as Record<string, unknown>;
        if (scope === 'assigned'
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, String(report.student_id))) {
          throw new ConcealedTeachingPermissionDeniedException('Weekly report not found');
        }
        return weeklyReportToJson(report, true);
      }) as JsonObject;
    });
  },

  async generateWeeklyReport(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'weekly_report.generate', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'weekly_report.generate', requestId, async () => {
      try {
        return await withWeeklyReportGenerateRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireReportScope(access, 'report:manage');
          if (scope === 'assigned'
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, input.studentId)) {
            throw new ConcealedTeachingPermissionDeniedException('Weekly report student not found');
          }
          const students = await tx`
            SELECT id, display_name, external_ref
            FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${input.studentId} AND status = 'active'
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report student not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'weekly_report.generate', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const aggregate = await buildWeeklyReportAggregate(tx, access, input.studentId, input.weekStart);
          const drafts = await tx`
            SELECT id FROM teaching_weekly_reports
            WHERE organization_id = ${access.id} AND student_id = ${input.studentId}
              AND week_start = ${input.weekStart}::date AND status = 'draft'
            FOR UPDATE`;
          const rows = drafts.length
            ? await tx`
                UPDATE teaching_weekly_reports
                SET aggregate = ${sql.json(aggregate)}, generated_by_user_id = ${actor.userId}
                WHERE organization_id = ${access.id} AND id = ${String(drafts[0].id)}
                RETURNING *`
            : await tx`
                INSERT INTO teaching_weekly_reports (
                  organization_id, student_id, student_display_name_snapshot,
                  student_external_ref_snapshot, week_start, week_end, timezone_snapshot,
                  revision, aggregate, generated_by_user_id, generated_by_user_id_snapshot,
                  generated_by_display_name_snapshot, generated_by_role_snapshot
                ) VALUES (
                  ${access.id}, ${input.studentId}, ${String(students[0].display_name)},
                  ${students[0].external_ref == null ? null : String(students[0].external_ref)},
                  ${input.weekStart}::date, (${input.weekStart}::date + 6), ${access.timezone},
                  1, ${sql.json(aggregate)}, ${actor.userId}, ${actor.userId},
                  ${actor.displayName}, ${access.role}
                ) RETURNING *`;
          const report = weeklyReportToJson(rows[0] as Record<string, unknown>, true);
          const reportId = String(rows[0].id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'weekly_report.generate', 'teaching_weekly_report', ${reportId}, ${requestId},
              ${sql.json({
                studentId: input.studentId,
                weekStart: input.weekStart,
                revision: Number(rows[0].revision),
                recomputed: drafts.length > 0,
              })}
            )`;
          const result: MutationResult = {
            status: drafts.length ? 200 : 201,
            body: { weeklyReport: report },
          };
          await completeIdempotency(tx, idem.id, result, 'teaching_weekly_report', reportId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Weekly report could not be generated');
      }
    });
  },

  async publishWeeklyReport(
    actor, slug, reportId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, 'weekly_report.publish', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'weekly_report.publish', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireReportScope(access, 'report:manage');
          const reports = await tx`
            SELECT * FROM teaching_weekly_reports
            WHERE organization_id = ${access.id} AND id = ${reportId}
            FOR UPDATE`;
          if (!reports.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
          }
          const report = reports[0] as Record<string, unknown>;
          if (scope === 'assigned'
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, String(report.student_id))) {
            throw new ConcealedTeachingPermissionDeniedException('Weekly report not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `weekly_report.publish:${reportId}`, idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (report.status !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Weekly report is already published');
          }
          const rows = await tx`
            UPDATE teaching_weekly_reports
            SET status = 'published', visibility = ${input.visibility},
                teacher_summary = ${input.teacherSummary}, next_week_plan = ${input.nextWeekPlan},
                published_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${reportId}
            RETURNING *`;
          const published = weeklyReportToJson(rows[0] as Record<string, unknown>, true);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'weekly_report.publish', 'teaching_weekly_report', ${reportId}, ${requestId},
              ${sql.json({
                studentId: String(report.student_id),
                weekStart: String(report.week_start),
                revision: Number(report.revision),
                visibility: input.visibility,
              })}
            )`;
          const result: MutationResult = { status: 200, body: { weeklyReport: published } };
          await completeIdempotency(tx, idem.id, result, 'teaching_weekly_report', reportId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Weekly report could not be published');
      }
    });
  },
};

function errorResponse(c: Context, error: unknown, requestId: string): Response {
  c.header('Cache-Control', 'no-store');
  if (error instanceof TeachingApiException) {
    return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status);
  }
  if (error instanceof InvalidTeachingPlatformAssertionError) {
    return c.json({ error: { code: 'INVALID_PLATFORM_ASSERTION', message: error.message, requestId } }, 401);
  }
  if (error instanceof Error && error.message.includes('Authentication required')) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId } }, 401);
  }
  console.error(`[500] teaching SaaS ${requestId}`, error);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Teaching service request failed', requestId } }, 500);
}

export function createTeachingSaasRoutes(deps: {
  authenticate?: (c: Context) => Promise<TeachingActor>;
  repository?: TeachingSaasRepository;
} = {}): Hono {
  const routes = new Hono();
  const authenticate = deps.authenticate ?? authenticateTeachingActor;
  const repository = deps.repository ?? teachingSaasRepository;

  routes.get('/teaching/organizations', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ organizations: await repository.listOrganizations(actor) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createOrganization(actor, parseOrganizationInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ organization: await repository.getOrganization(actor, c.req.param('orgSlug'), requestId) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/summary', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ summary: await repository.getOrganizationSummary(actor, c.req.param('orgSlug'), requestId) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/operations/overview', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ operationsOverview: await repository.getOperationsOverview(actor, c.req.param('orgSlug'), requestId) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/audit-events', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listAuditEvents(
        actor,
        c.req.param('orgSlug'),
        auditEventFilterOf(c),
        trainingPaginationOf(c, ['q', 'outcome']),
        requestId,
      );
      return c.json({ auditEvents: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/members', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listMembers(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ members: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/members', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createMember(actor, c.req.param('orgSlug'), parseMemberInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudents(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ students: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudent(actor, c.req.param('orgSlug'), parseStudentInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const result = await repository.createStudentAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        parseStudentAccountBindingInviteInput(body.value),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invite', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const result = await repository.getCurrentStudentAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        requestId,
      );
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites/:inviteId/revoke',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const key = idempotencyKeyOf(c);
        const body = await jsonBody(c, 1_024);
        assertOnlyKeys(body.value, [], 'student account binding invite revoke input');
        const result = await repository.revokeStudentAccountBindingInvite(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('inviteId'), 'inviteId'),
          key,
          sha256(body.raw),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post('/teaching/me/student-account-binding/preview', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseStudentAccountBindingConsumeInput(body.value);
      const result = await repository.previewStudentAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/me/student-account-binding/consume', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseStudentAccountBindingConsumeInput(body.value);
      const result = await repository.consumeStudentAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const body = await jsonBody(c, 1_024);
        const result = await repository.createGuardianAccountBindingInvite(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
          parseGuardianAccountBindingInviteInput(body.value),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invite',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const result = await repository.getCurrentGuardianAccountBindingInvite(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
          requestId,
        );
        return c.json(result);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites/:inviteId/revoke',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const key = idempotencyKeyOf(c);
        const body = await jsonBody(c, 1_024);
        assertOnlyKeys(body.value, [], 'guardian account binding invite revoke input');
        const result = await repository.revokeGuardianAccountBindingInvite(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
          uuidParam(c.req.param('inviteId'), 'inviteId'),
          key,
          sha256(body.raw),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post('/teaching/me/guardian-account-binding/preview', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseGuardianAccountBindingConsumeInput(body.value);
      const result = await repository.previewGuardianAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/me/guardian-account-binding/consume', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseGuardianAccountBindingConsumeInput(body.value);
      const result = await repository.consumeGuardianAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/me/learning-contexts', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({
        learningContexts: await repository.listLearningContexts(actor, null, requestId),
      });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/me/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({
        learningContexts: await repository.listLearningContexts(
          actor,
          c.req.param('orgSlug'),
          requestId,
        ),
      });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const page = await repository.listConversations(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          trainingPaginationOf(c),
          requestId,
        );
        return c.json({
          conversations: page.items,
          total: page.total,
          page: page.page,
          pageSize: page.pageSize,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        // JSON may encode CJK text as UTF-8 or \uXXXX escapes; keep the byte cap above
        // the strict 10,000-character field limit so valid localized content is accepted.
        const body = await jsonBody(c, 65_536);
        const input = parseCreateConversationInput(body.value);
        const result = await repository.createConversation(
          actor,
          c.req.param('orgSlug'),
          studentId,
          input,
          idempotencyKeyOf(c),
          sha256(stableJson({ studentId, input })),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        assertQueryKeys(c, []);
        const conversation = await repository.getConversation(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('conversationId'), 'conversationId'),
          requestId,
        );
        return c.json({ conversation });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/messages',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const page = await repository.listConversationMessages(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('conversationId'), 'conversationId'),
          conversationMessagePaginationOf(c),
          requestId,
        );
        return c.json({
          messages: page.items,
          afterSequence: page.afterSequence,
          nextAfterSequence: page.nextAfterSequence,
          hasMore: page.hasMore,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/messages',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        const conversationId = uuidParam(c.req.param('conversationId'), 'conversationId');
        const body = await jsonBody(c, 65_536);
        const input = parseReplyConversationInput(body.value);
        const result = await repository.replyConversation(
          actor,
          c.req.param('orgSlug'),
          studentId,
          conversationId,
          input,
          idempotencyKeyOf(c),
          sha256(stableJson({ studentId, conversationId, input })),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/read',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        const conversationId = uuidParam(c.req.param('conversationId'), 'conversationId');
        const body = await jsonBody(c, 1_024);
        const input = parseMarkConversationReadInput(body.value);
        const result = await repository.markConversationRead(
          actor,
          c.req.param('orgSlug'),
          studentId,
          conversationId,
          input,
          idempotencyKeyOf(c),
          sha256(stableJson({ studentId, conversationId, input })),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const page = await repository.listLearnerWeeklyReports(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          paginationOf(c),
          requestId,
        );
        return c.json({
          weeklyReports: page.items,
          total: page.total,
          page: page.page,
          pageSize: page.pageSize,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports/:reportId',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const weeklyReport = await repository.getLearnerWeeklyReport(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('reportId'), 'reportId'),
          requestId,
        );
        return c.json({ weeklyReport });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/lesson-feedback',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const page = await repository.listLearnerLessonFeedback(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          paginationOf(c),
          requestId,
        );
        return c.json({
          feedback: page.items,
          total: page.total,
          page: page.page,
          pageSize: page.pageSize,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get('/teaching/organizations/:orgSlug/me/students/:studentId/sessions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const page = await repository.listLearnerSessions(
        actor, c.req.param('orgSlug'), studentId, paginationOf(c), requestId,
      );
      return c.json({ sessions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/leave-requests',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const page = await repository.listLearnerLeaveRequests(
          actor, c.req.param('orgSlug'), studentId, sessionId, paginationOf(c), requestId,
        );
        return c.json({
          leaveRequests: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const body = await jsonBody(c, 4_096);
        const input = parseLeaveRequestInput(body.value);
        const result = await repository.createLearnerLeaveRequest(
          actor, c.req.param('orgSlug'), studentId, sessionId, attendanceId, input,
          idempotencyKeyOf(c), sha256(stableJson({ studentId, sessionId, attendanceId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const studentId = uuidParam(c.req.param('studentId'), 'studentId');
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
        const body = await jsonBody(c, 4_096);
        const input = parseLeaveRequestInput(body.value);
        const result = await repository.cancelLearnerLeaveRequest(
          actor, c.req.param('orgSlug'), studentId, sessionId, attendanceId, leaveRequestId, input,
          idempotencyKeyOf(c),
          sha256(stableJson({ studentId, sessionId, attendanceId, leaveRequestId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get('/teaching/organizations/:orgSlug/me/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listSelfTrainingAssignments(
        actor,
        c.req.param('orgSlug'),
        paginationOf(c),
        requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/me/training/evidence', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      let input: TrainingEvidenceV1;
      try {
        input = parseTrainingEvidenceV1(body.value);
      } catch (error) {
        if (error instanceof TrainingEvidenceValidationError) {
          throw new TeachingApiException('EVIDENCE_INVALID', 400, error.message);
        }
        throw error;
      }
      const result = await repository.createSelfTrainingEvidence(
        actor,
        c.req.param('orgSlug'),
        input,
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTemplates(
        actor, c.req.param('orgSlug'), trainingPaginationOf(c), requestId,
      );
      return c.json({ templates: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingTemplate(
        actor, c.req.param('orgSlug'), parseTrainingTemplateInput(body.value),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      assertQueryKeys(c, []);
      const template = await repository.getTrainingTemplate(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'), requestId,
      );
      return c.json({ template });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTemplateVersions(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        trainingPaginationOf(c), requestId,
      );
      return c.json({ templateVersions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingTemplateVersion(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        parseTrainingTemplateVersionInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      assertOnlyKeys(body.value, [], 'training template archive input');
      const result = await repository.archiveTrainingTemplate(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingAssignments(
        actor, c.req.param('orgSlug'), trainingAssignmentFilterOf(c),
        trainingPaginationOf(c, ['status']), requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingAssignment(
        actor, c.req.param('orgSlug'), parseTrainingAssignmentInput(body.value),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      assertQueryKeys(c, []);
      return c.json(await repository.getTrainingAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'), requestId,
      ));
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/revise', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.reviseTrainingAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        parseTrainingAssignmentInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  const trainingAssignmentLifecycleHandler = (action: 'publish' | 'close') => async (c: Context) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      assertOnlyKeys(body.value, [], `training assignment ${action} input`);
      const orgSlug = c.req.param('orgSlug') ?? '';
      const assignmentId = uuidParam(c.req.param('assignmentId') ?? '', 'assignmentId');
      const result = action === 'publish'
        ? await repository.publishTrainingAssignment(
          actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
        )
        : await repository.closeTrainingAssignment(
          actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
        );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  };

  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/publish',
    trainingAssignmentLifecycleHandler('publish'),
  );
  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/close',
    trainingAssignmentLifecycleHandler('close'),
  );

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingAssignmentTargets(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        trainingTargetFilterOf(c), trainingPaginationOf(c, ['targetKind']), requestId,
      );
      return c.json({ targets: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/evidence', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTargetEvidence(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
      );
      return c.json({ evidence: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTargetReviews(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
      );
      return c.json({ reviews: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const assignmentId = uuidParam(c.req.param('assignmentId'), 'assignmentId');
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const result = await repository.createTrainingTargetReview(
        actor, c.req.param('orgSlug'), assignmentId, studentId, parseTrainingReviewInput(body.value),
        key, trainingReviewRequestHash(assignmentId, studentId, body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const student = await repository.getStudent(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), requestId,
      );
      return c.json({ student });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/campuses', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listCampuses(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ campuses: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/campuses', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createCampus(
        actor, c.req.param('orgSlug'), parseCampusInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/campuses/:campusId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const campus = await repository.getCampus(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'), requestId,
      );
      return c.json({ campus });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/campuses/:campusId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Campus archive body must be empty');
      }
      const result = await repository.archiveCampus(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listGroups(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ groups: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createGroup(
        actor, c.req.param('orgSlug'), parseGroupInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const group = await repository.getGroup(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), requestId,
      );
      return c.json({ group });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Group archive body must be empty');
      }
      const result = await repository.archiveGroup(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listGroupStudents(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), paginationOf(c), requestId,
      );
      return c.json({ memberships: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudentGroupMembership(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
        parseStudentGroupMembershipInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/student-group-memberships/:membershipId/revoke', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Membership revoke body must be empty');
      }
      const result = await repository.revokeStudentGroupMembership(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('membershipId'), 'membershipId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/teacher-assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTeacherAssignments(
        actor, c.req.param('orgSlug'), teacherAssignmentTargetOf(c), paginationOf(c), requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createTeacherAssignment(
        actor, c.req.param('orgSlug'), parseTeacherAssignmentInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments/:assignmentId/revoke', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Assignment revoke body must be empty');
      }
      const result = await repository.revokeTeacherAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/package-products', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listPackageProducts(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ packageProducts: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/package-products', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createPackageProduct(
        actor, c.req.param('orgSlug'), parsePackageProductInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/packages', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudentPackages(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), paginationOf(c), requestId,
      );
      return c.json({ studentPackages: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/students/:studentId/packages', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudentPackage(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'),
        parseStudentPackageInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/student-packages/:studentPackageId/ledger', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudentPackageLedger(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentPackageId'), 'studentPackageId'),
        paginationOf(c), requestId,
      );
      return c.json({ ledger: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/student-packages/:packageId/refunds', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const packageId = uuidParam(c.req.param('packageId'), 'packageId');
      const body = await jsonBody(c, 4_096);
      const result = await repository.refundStudentPackageCredits(
        actor,
        c.req.param('orgSlug'),
        packageId,
        parseCreditRefundInput(body.value),
        key,
        sha256(JSON.stringify([packageId, body.raw])),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post(
    '/teaching/organizations/:orgSlug/student-packages/:packageId/ledger/:ledgerId/reversal',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const key = idempotencyKeyOf(c);
        const packageId = uuidParam(c.req.param('packageId'), 'packageId');
        const ledgerId = bigintParam(c.req.param('ledgerId'), 'ledgerId');
        const body = await jsonBody(c, 4_096);
        const result = await repository.reverseStudentPackageLedgerEntry(
          actor,
          c.req.param('orgSlug'),
          packageId,
          ledgerId,
          parseCreditReversalInput(body.value),
          key,
          sha256(JSON.stringify([packageId, ledgerId, body.raw])),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get('/teaching/organizations/:orgSlug/operations/credit-adjustments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listCreditAdjustments(
        actor, c.req.param('orgSlug'), paginationOf(c), requestId,
      );
      return c.json({
        creditAdjustments: page.items,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/weekly-reports', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listWeeklyReports(
        actor,
        c.req.param('orgSlug'),
        weeklyReportFilterOf(c),
        paginationOf(c),
        requestId,
      );
      return c.json({
        weeklyReports: page.items,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/weekly-reports/generate', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.generateWeeklyReport(
        actor,
        c.req.param('orgSlug'),
        parseGenerateWeeklyReportInput(body.value),
        key,
        sha256(body.raw),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/weekly-reports/:reportId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const weeklyReport = await repository.getWeeklyReport(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('reportId'), 'reportId'),
        requestId,
      );
      return c.json({ weeklyReport });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/weekly-reports/:reportId/publish', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const reportId = uuidParam(c.req.param('reportId'), 'reportId');
      const result = await repository.publishWeeklyReport(
        actor,
        c.req.param('orgSlug'),
        reportId,
        parsePublishWeeklyReportInput(body.value),
        key,
        sha256(body.raw),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listSessions(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ sessions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createSession(
        actor, c.req.param('orgSlug'), parseSessionInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const session = await repository.getSession(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'), requestId,
      );
      return c.json({ session });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId/leave-requests', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const page = await repository.listLeaveRequests(
        actor, c.req.param('orgSlug'), sessionId, paginationOf(c), requestId,
      );
      return c.json({
        leaveRequests: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
      });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const body = await jsonBody(c, 4_096);
        const input = parseLeaveRequestInput(body.value);
        const result = await repository.createLeaveRequest(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, input, idempotencyKeyOf(c),
          sha256(stableJson({ sessionId, attendanceId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/decision',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
        const body = await jsonBody(c, 4_096);
        const input = parseLeaveDecisionInput(body.value);
        const result = await repository.decideLeaveRequest(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, leaveRequestId, input,
          idempotencyKeyOf(c),
          sha256(stableJson({ sessionId, attendanceId, leaveRequestId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
        const body = await jsonBody(c, 4_096);
        const input = parseLeaveRequestInput(body.value);
        const result = await repository.cancelLeaveRequest(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, leaveRequestId, input,
          idempotencyKeyOf(c),
          sha256(stableJson({ sessionId, attendanceId, leaveRequestId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const page = await repository.listMakeupAttempts(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, paginationOf(c), requestId,
        );
        return c.json({
          makeupAttempts: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
        });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.get(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups/candidates',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const page = await repository.listMakeupCandidates(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, paginationOf(c), requestId,
        );
        return c.json({ candidates: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
        const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
        const body = await jsonBody(c, 4_096);
        const input = parseMakeupScheduleInput(body.value);
        const result = await repository.scheduleMakeup(
          actor, c.req.param('orgSlug'), sessionId, attendanceId, input, idempotencyKeyOf(c),
          sha256(stableJson({ sessionId, attendanceId, input })), requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/batch', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.saveAttendanceBatch(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
        parseAttendanceBatchInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/complete', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Session completion body must be empty');
      }
      const result = await repository.completeSession(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/cancel', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const body = await jsonBody(c, 4_096);
      const input = parseSessionCancelInput(body.value);
      const result = await repository.cancelSession(
        actor, c.req.param('orgSlug'), sessionId, input, idempotencyKeyOf(c),
        sha256(stableJson({ sessionId, input })), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId/feedback', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listLessonFeedback(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('sessionId'), 'sessionId'),
        paginationOf(c),
        requestId,
      );
      return c.json({ feedback: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/students/:studentId/feedback', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const result = await repository.createLessonFeedback(
        actor,
        c.req.param('orgSlug'),
        sessionId,
        studentId,
        parseLessonFeedbackInput(body.value),
        key,
        sha256(JSON.stringify([sessionId, studentId, body.raw])),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  return routes;
}

export const teachingSaasRoutes = createTeachingSaasRoutes();
