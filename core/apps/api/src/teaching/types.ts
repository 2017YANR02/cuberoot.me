import type postgres from 'postgres';
import { type TeachingOrganizationRole, type TeachingCreditUnit, type TeachingPackageAcquisitionType, type TeachingAttendanceStatus, type TeachingFeedbackVisibility, type TeachingAuditEvent, type TeachingTrainingTemplateCreateInput, type TeachingTrainingTemplateVersionCreateInput, type TeachingTrainingAssignmentWriteInput, type TeachingTrainingReviewCreateInput, type TrainingAssignmentStatus, type TeachingAuditOutcome, type TeachingConversationActorRole } from '@cuberoot/shared/teaching';

export type JsonValue = postgres.JSONValue;

export type JsonObject = { [key: string]: JsonValue };

export type MutationStatus = 200 | 201;

export type Tx = postgres.TransactionSql;

export interface OrganizationAccess {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: 'active' | 'suspended' | 'archived';
  version: number;
  role: TeachingOrganizationRole;
}

export interface MutationResult {
  status: MutationStatus;
  body: JsonObject;
}

export interface CreateOrganizationInput {
  slug: string;
  name: string;
  timezone: string;
}

export interface CreateMemberInput {
  userId: number;
  role: Exclude<TeachingOrganizationRole, 'owner'>;
}

export interface CreateStudentInput {
  displayName: string;
  externalRef: string | null;
}

export interface CreateCampusInput {
  code: string | null;
  name: string;
  timezone: string | null;
}

export interface CreateGroupInput {
  campusId: string | null;
  code: string | null;
  name: string;
}

export interface CreateStudentGroupMembershipInput {
  studentId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CreateTeacherAssignmentInput {
  teacherUserId: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface TeacherAssignmentTarget {
  groupId: string | null;
  studentId: string | null;
}

export interface CreatePackageProductInput {
  code: string;
  name: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
}

export interface CreateStudentPackageInput {
  productId: string;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
}

export interface CreateCreditRefundInput {
  credits: number;
  reason: string;
  sourceSystem: string;
  sourceRef: string;
  sourceLineRef: string | null;
}

export interface CreateCreditReversalInput {
  reason: string;
}

export interface CreateSessionInput {
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

export interface AttendanceBatchInput {
  records: Array<{
    attendanceId: string;
    status: Extract<TeachingAttendanceStatus, 'present' | 'late' | 'absent'>;
  }>;
}

export interface LeaveRequestInput {
  reason: string;
}

export interface LeaveDecisionInput {
  decision: 'approved' | 'rejected';
  reason: string;
}

export interface MakeupScheduleInput {
  targetSessionId: string;
  reason: string;
}

export interface SessionCancelInput {
  reason: string;
}

export interface CreateLessonFeedbackInput {
  visibility: TeachingFeedbackVisibility;
  summary: string;
  strengths: string | null;
  challenges: string | null;
  nextGoals: string | null;
  internalNotes: string | null;
}

export interface PageInput {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PageResult {
  items: JsonObject[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditPageResult {
  items: TeachingAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateStudentAccountBindingInviteInput {
  expiresInMinutes: number;
}

export interface ConsumeStudentAccountBindingInput {
  tokenHash: string;
}

export type CreateGuardianAccountBindingInviteInput = CreateStudentAccountBindingInviteInput;

export type ConsumeGuardianAccountBindingInput = ConsumeStudentAccountBindingInput;

export type CreateTrainingTemplateInput = TeachingTrainingTemplateCreateInput;

export type CreateTrainingTemplateVersionInput = TeachingTrainingTemplateVersionCreateInput;

export type WriteTrainingAssignmentInput = TeachingTrainingAssignmentWriteInput;

export type CreateTrainingReviewInput = TeachingTrainingReviewCreateInput;

export interface TrainingTargetFilter {
  targetKind: 'group' | 'student' | null;
}

export interface TrainingAssignmentFilter {
  status: TrainingAssignmentStatus | null;
}

export interface WeeklyReportFilter {
  studentId: string | null;
}

export interface AuditEventFilter {
  q: string | null;
  outcome: TeachingAuditOutcome | null;
}

export interface ConversationMessagePageInput {
  afterSequence: number;
  limit: number;
}

export type SessionAccessScope = 'organization' | 'assigned';

export type ReportAccessScope = 'organization' | 'assigned';

export interface BoundSelfStudent {
  organizationId: string;
  organizationName: string;
  organizationTimezone: string;
  studentId: string;
  studentDisplayName: string;
  accountLinkedAt: string;
  databaseNow: string;
}

export interface ConversationActorScope {
  organization: Pick<OrganizationAccess, 'id' | 'slug' | 'name' | 'timezone' | 'status' | 'version'>;
  student: { id: string; displayName: string };
  actorOwnerKey: string;
  role: TeachingConversationActorRole;
  relationship: string | null;
  staffAccess: OrganizationAccess | null;
}
