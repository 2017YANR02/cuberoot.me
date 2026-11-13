import { type TeachingActor } from '../utils/teaching_platform_assertion.js';
import { type TeachingOperationsOverview, type GenerateTeachingWeeklyReportInput, type PublishTeachingWeeklyReportInput, type CreateTeachingConversationInput, type ReplyTeachingConversationInput, type MarkTeachingConversationReadInput, type TrainingEvidenceV1 } from '@cuberoot/shared/teaching';
import { type PageInput, type JsonObject, type AuditEventFilter, type AuditPageResult, type CreateOrganizationInput, type MutationResult, type PageResult, type CreateMemberInput, type CreateStudentInput, type CreateCampusInput, type CreateGroupInput, type CreateStudentGroupMembershipInput, type TeacherAssignmentTarget, type CreateTeacherAssignmentInput, type CreatePackageProductInput, type CreateStudentPackageInput, type CreateCreditRefundInput, type CreateCreditReversalInput, type CreateSessionInput, type AttendanceBatchInput, type SessionCancelInput, type LeaveRequestInput, type LeaveDecisionInput, type MakeupScheduleInput, type CreateLessonFeedbackInput, type WeeklyReportFilter, type CreateStudentAccountBindingInviteInput, type ConsumeStudentAccountBindingInput, type CreateGuardianAccountBindingInviteInput, type ConsumeGuardianAccountBindingInput, type ConversationMessagePageInput, type CreateTrainingTemplateInput, type CreateTrainingTemplateVersionInput, type TrainingAssignmentFilter, type WriteTrainingAssignmentInput, type TrainingTargetFilter, type CreateTrainingReviewInput } from './types.js';

export interface TeachingSaasRepository {
  getTrainingDailyBoard(actor: TeachingActor, slug: string, assignmentId: string, date: string | null, learner: boolean, pagination: PageInput, requestId: string, rankEvent?: string | null): Promise<JsonObject>;
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
