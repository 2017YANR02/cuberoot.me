import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_DIRECTORY_GROUPS, SITE_DIRECTORY_TEXTS } from '@cuberoot/shared/site-directory';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(CLIENT, '..', '..', '..');

function readClient(path: string): string {
  return readFileSync(join(CLIENT, path), 'utf8');
}

describe('main-site teaching architecture', () => {
  it('keeps the main client as the only teaching frontend', () => {
    const plan = readFileSync(join(REPO, 'docs', 'platform-unification-plan.md'), 'utf8');
    expect(plan).toContain('`core/packages/client` 是唯一 Web 前端');
    expect(plan).toContain('旧 Platform 计时历史不迁移');
    expect(plan).toContain('`core/packages/platform` 只作为历史归档来源');
  });

  it('exposes both teaching entry points on the main homepage', () => {
    const learnEntries = SITE_DIRECTORY_GROUPS.find((group) => group.id === 'learn')?.entries ?? [];
    expect(learnEntries.find((entry) => entry.id === 'teaching-management')).toMatchObject({ href: '/org', internal: true });
    expect(learnEntries.find((entry) => entry.id === 'learning-center')).toMatchObject({ href: '/learn', internal: true });
    expect(SITE_DIRECTORY_TEXTS.teachingManagement).toEqual({ en: 'Teaching', zh: '教学管理' });
    expect(SITE_DIRECTORY_TEXTS.learningCenter).toEqual({ en: 'Learning Center', zh: '学习中心' });
  });

  it('keeps the restored legacy host isolated as a temporary comparison site', () => {
    const nginx = readFileSync(join(REPO, 'ops', 'nginx', 'platform.cuberoot.me.conf'), 'utf8');
    const learnEntries = SITE_DIRECTORY_GROUPS.find((group) => group.id === 'learn')?.entries ?? [];
    expect(nginx).toContain('旧 Cube Platform 验收对照站');
    expect(nginx).toMatch(/proxy_pass\s+http:\/\/127\.0\.0\.1:3004;/);
    expect(nginx).not.toContain('return 410;');
    expect(learnEntries.find((entry) => entry.id === 'platform')).toMatchObject({ href: '/platform', internal: true });
  });

  it('links teaching users to canonical main-site tools', () => {
    const overview = readClient('app/[lang]/org/[orgSlug]/page.tsx');
    for (const href of ['/timer', '/predict', '/alg', '/sim']) {
      expect(overview).toContain(`['${href}'`);
    }
    expect(overview).toContain('<AppLink');
    expect(overview).not.toContain('packages/platform');
  });

  it('exposes the workspace from the existing account page and supports narrow screens', () => {
    expect(readClient('app/[lang]/account/page.tsx')).toContain("href: '/org'");
    const orgCss = readClient('app/[lang]/org/org.css');
    expect(orgCss).toContain("@import '../../../components/teaching/teaching.css';");
    const css = readClient('components/teaching/teaching.css');
    expect(css).toContain('@media (max-width: 479px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain(':is(.teaching-form, .org-form) { grid-template-columns: 1fr; }');
    expect(css).toContain(':is(.teaching-table-wrap, .org-table-wrap) { overflow-x: auto; }');
    expect(css).toContain('var(--signal-success)');
    expect(css).not.toContain('var(--success)');
  });

  it('uses real links for CRM details and keeps tenant authorization on Core', () => {
    const classes = readClient('app/[lang]/org/[orgSlug]/classes/page.tsx');
    const students = readClient('app/[lang]/org/[orgSlug]/students/page.tsx');
    const classDetail = readClient('app/[lang]/org/[orgSlug]/classes/[groupId]/page.tsx');
    const studentDetail = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx');
    for (const source of [classes, students, classDetail]) {
      expect(source).toContain('<AppLink');
      expect(source).toContain('prefetch={false}');
    }
    expect(classDetail).toContain("hasTeachingPermission(role, 'assignment:manage')");
    expect(studentDetail).toContain("hasTeachingPermission(role, 'assignment:manage')");
    expect(classDetail).not.toContain('router.push');
    expect(studentDetail).not.toContain('router.push');
  });

  it('does not load organization-wide assignment choices for scoped teachers', () => {
    const classDetail = readClient('app/[lang]/org/[orgSlug]/classes/[groupId]/page.tsx');
    const studentDetail = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx');
    expect(classDetail).toContain('if (!canManageGroup && !canManageAssignments) return');
    expect(studentDetail).toContain('if (!canManageAssignments) return');
    expect(classDetail).toContain('listTeachingGroupMemberships');
    expect(studentDetail).toContain('getTeachingStudent');
  });

  it('keeps package and session workflows inside the main-site organization shell', () => {
    const workspace = readClient('app/[lang]/org/_components/OrgWorkspace.tsx');
    const studentDetail = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx');
    const sessionList = readClient('app/[lang]/org/[orgSlug]/sessions/page.tsx');
    const sessionDetail = readClient('app/[lang]/org/[orgSlug]/sessions/[sessionId]/page.tsx');

    expect(workspace).toContain("permission: 'package:read'");
    expect(workspace).toContain("permission: 'session:read'");
    expect(studentDetail).toContain('students/${studentId}/packages');
    expect(studentDetail).toContain('prefetch={false}');
    expect(sessionList).toContain("hasTeachingPermission(role, 'session:create')");
    expect(sessionDetail).toContain("hasTeachingPermission(role, 'session:manage')");
    expect(sessionDetail).toContain("hasTeachingPermission(role, 'feedback:read')");
    expect(sessionDetail).toContain("hasTeachingPermission(role, 'feedback:manage')");
    expect(sessionDetail).toContain('saveTeachingAttendanceBatch');
    expect(sessionDetail).toContain('completeTeachingSession');
    expect(sessionDetail).toContain('listTeachingLeaveRequests(orgSlug, sessionId),');
    expect(sessionDetail).toContain('createTeachingLeaveRequest');
    expect(sessionDetail).toContain('decideTeachingLeaveRequest');
    expect(sessionDetail).toContain('listTeachingMakeupCandidates');
    expect(sessionDetail).toContain('createTeachingMakeupAttempt');
    expect(sessionDetail).toContain('cancelTeachingSession');
    expect(sessionDetail).toContain('Promise.all([\n      listTeachingMakeupAttempts(orgSlug, sessionId, makeupAttendanceId),');
    expect(sessionDetail.match(/listTeachingMakeupAttempts\(/g)).toHaveLength(1);
    expect(sessionDetail).not.toMatch(/attendance\.map\([\s\S]{0,300}listTeachingMakeupAttempts/);
    expect(sessionDetail).toContain('leaveDecisionOperation.get(`${orgSlug}:${sessionId}:${request.attendanceId}:${request.id}:${decision}:${parsedReason}`)');
    expect(sessionDetail).toContain('leaveDecisionOperation.get(`${orgSlug}:${sessionId}:${request.attendanceId}:${request.id}:cancel:${parsedReason}`)');
    expect(sessionDetail).toContain("canManage && request.status === 'pending'");
    expect(sessionDetail).toContain("attendance.status !== 'excused'");
    expect(sessionDetail).toContain("item.status === 'pending' || item.status === 'approved'");
    expect(sessionDetail).toContain('listTeachingLessonFeedback');
    expect(sessionDetail).toContain('createTeachingLessonFeedback');
    expect(sessionDetail).toContain("session.status !== 'completed'");
    expect(sessionDetail).toContain('<AppLink');
    expect(sessionDetail).not.toContain('router.push');
  });

  it('keeps operation keys stable only for the same concrete request intent', () => {
    const teachingUi = readClient('components/teaching/TeachingUi.tsx');

    expect(teachingUi).toContain("const intentRef = useRef('')");
    expect(teachingUi).toContain('if (intentRef.current !== intent)');
    expect(teachingUi).toContain("keyRef.current = ''");
    expect(teachingUi).toContain('intentRef.current = intent');
  });

  it('keeps finance corrections permission-gated on the canonical student package page', () => {
    const packages = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/packages/page.tsx');

    expect(packages).toContain("hasTeachingPermission(role, 'finance:manage')");
    expect(packages).toContain("canManageFinance && item.remainingCredits > 0");
    expect(packages).not.toContain("canManageFinance && item.status === 'active'");
    expect(packages).toContain('Math.min(item.remainingCredits, 1_000_000)');
    expect(packages).toContain('credits > refundCreditLimit');
    expect(packages).toContain('max={refundCreditLimit}');
    expect(packages).toContain('实际退款款项在线下或外部系统处理');
    expect(packages).toContain('refundTeachingStudentPackage');
    expect(packages).toContain('reverseTeachingCreditLedgerEntry');
    expect(packages).toContain('useOperationKey');
    expect(packages).toContain('reversedByLedgerId');
    expect(packages).not.toContain('balanceAfter');
    expect(packages).not.toContain('packages/platform');
    expect(packages).not.toContain('router.push');
  });

  it('keeps the operations overview inside the main-site organization shell', () => {
    const workspace = readClient('app/[lang]/org/_components/OrgWorkspace.tsx');
    const operations = readClient('app/[lang]/org/[orgSlug]/operations/page.tsx');

    expect(workspace).toContain("permission: 'operations:read'");
    expect(operations).toContain('getTeachingOperationsOverview');
    expect(operations).toContain('creditConsumption');
    expect(operations).toContain('teacherLoad');
    expect(operations).toContain("hasTeachingPermission(role, 'finance:read')");
    expect(operations).toContain('listTeachingCreditAdjustments');
    expect(operations).toContain('<TeachingPagination');
    expect(operations).toContain('<AppLink');
    expect(operations).toContain('prefetch={false}');
    expect(operations).not.toContain('balanceAfter');
    expect(operations).not.toContain('packages/platform');
    expect(operations).not.toContain('router.push');
  });

  it('keeps searchable audit history inside the main-site organization shell', () => {
    const workspace = readClient('app/[lang]/org/_components/OrgWorkspace.tsx');
    const audit = readClient('app/[lang]/org/[orgSlug]/audit/page.tsx');

    expect(workspace).toContain("permission: 'audit:read'");
    expect(audit).toContain("hasTeachingPermission(organization.role, 'audit:read')");
    expect(audit).toContain('listTeachingAuditEvents');
    expect(audit).toContain('useQueryStates');
    expect(audit).toContain('<SearchInput');
    expect(audit).toContain('<TeachingPagination');
    expect(audit).toContain('exportSpreadsheetCsv');
    expect(audit).toContain('escapeSpreadsheetTextCell');
    expect(audit).not.toContain('actorUserId');
    expect(audit).not.toContain('metadata');
    expect(audit).not.toContain('packages/platform');
    expect(audit).not.toContain('router.push');
  });

  it('keeps training management and review inside the main-site organization shell', () => {
    const workspace = readClient('app/[lang]/org/_components/OrgWorkspace.tsx');
    const overview = readClient('app/[lang]/org/[orgSlug]/training/page.tsx');
    const template = readClient('app/[lang]/org/[orgSlug]/training/templates/[templateId]/page.tsx');
    const assignment = readClient('app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/page.tsx');
    const review = readClient('app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]/page.tsx');

    expect(workspace).toContain("permission: 'training:assignment:read'");
    expect(overview).toContain('<TrainingAssignmentForm');
    expect(template).toContain('TRAINING_SOURCE_ACTIVITIES');
    expect(template).toContain('toolConfig: { schemaVersion: 1 }');
    expect(assignment).toContain('publishTeachingTrainingAssignment');
    expect(assignment).toContain('closeTeachingTrainingAssignment');
    expect(review).toContain('listTeachingTrainingTargetEvidence');
    expect(review).toContain('createTeachingTrainingTargetReview');
    for (const source of [overview, template, assignment, review]) {
      expect(source).toContain('<AppLink');
      expect(source).not.toContain('router.push');
    }
  });

  it('keeps weekly report generation and publication inside the main-site organization shell', () => {
    const workspace = readClient('app/[lang]/org/_components/OrgWorkspace.tsx');
    const reports = readClient('app/[lang]/org/[orgSlug]/reports/page.tsx');
    const report = readClient('app/[lang]/org/[orgSlug]/reports/[reportId]/page.tsx');
    const reportSections = readClient('components/teaching/WeeklyReportSections.tsx');

    expect(workspace).toContain("permission: 'report:read'");
    expect(reports).toContain("hasTeachingPermission(role, 'report:manage')");
    expect(reports).toContain('listTeachingWeeklyReports');
    expect(reports).toContain('generateTeachingWeeklyReport');
    expect(report).toContain("hasTeachingPermission(role, 'report:manage')");
    expect(report).toContain("report.status === 'draft'");
    expect(report).toContain('getTeachingWeeklyReport');
    expect(report).toContain('publishTeachingWeeklyReport');
    expect(reports).toContain('date.getUTCDay() === 1');
    expect(report).toContain('<WeeklyReportSections');
    expect(reportSections).toContain('className="teaching-rich-text"');
    expect(report).not.toContain('internalNotes');
    expect(reportSections).not.toContain('internalNotes');
    for (const source of [reports, report]) {
      expect(source).toContain('<AppLink');
      expect(source).toContain('prefetch={false}');
      expect(source).not.toContain('router.push');
    }
  });

  it('uses the canonical main-site trainers for learner assignments', () => {
    const learner = readClient('app/[lang]/training/[orgSlug]/page.tsx');
    const trainingHelpers = readClient('lib/teaching-training.ts');
    expect(learner).toContain('listSelfTeachingTrainingAssignments');
    expect(learner).toContain('trainingToolHref');
    expect(learner).toContain('<AppLink');
    for (const route of ["timer: '/timer'", "predict: '/predict'", "'alg-trainer': '/alg'"]) {
      expect(trainingHelpers).toContain(route);
    }
    expect(trainingHelpers).not.toContain('/platform');
  });

  it('keeps student account binding explicit and token-safe in the main site', () => {
    const account = readClient('app/[lang]/account/page.tsx');
    const manager = readClient('app/[lang]/org/_components/StudentAccountBindingManager.tsx');
    const consume = readClient('app/[lang]/account/student-binding/page.tsx');
    const bindingPage = readClient('components/teaching/TeachingAccountBindingPage.tsx');
    const student = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx');
    expect(manager).toContain('createTeachingStudentAccountBindingInvite');
    expect(manager).toContain('revokeTeachingStudentAccountBindingInvite');
    expect(consume).toContain('<TeachingAccountBindingPage kind="student" />');
    expect(bindingPage).toContain('previewTeachingStudentAccountBinding');
    expect(bindingPage).toContain('consumeTeachingStudentAccountBinding');
    expect(bindingPage).toContain('/account#next=');
    expect(bindingPage).not.toContain('nextQuery(window.location.pathname + window.location.hash)');
    expect(account).toContain("new URLSearchParams(window.location.hash.slice(1)).get('next')");
    expect(student).toContain('<StudentAccountBindingManager');
    expect(manager).not.toContain('localStorage');
    expect(bindingPage).not.toContain('localStorage');
  });

  it('keeps learner and guardian reading inside the main-site learning center', () => {
    const account = readClient('app/[lang]/account/page.tsx');
    const learn = readClient('app/[lang]/learn/page.tsx');
    const workspace = readClient('components/teaching/LearnerWorkspace.tsx');
    const overview = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/page.tsx');
    const reports = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/reports/page.tsx');
    const report = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/reports/[reportId]/page.tsx');
    const feedback = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/feedback/page.tsx');
    const sessions = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/sessions/page.tsx');
    const binding = readClient('app/[lang]/account/guardian-binding/page.tsx');
    const bindingPage = readClient('components/teaching/TeachingAccountBindingPage.tsx');

    expect(account).toContain("href: '/learn'");
    expect(learn).toContain('listTeachingLearningContexts');
    expect(workspace).toContain('listTeachingOrganizationLearningContexts');
    expect(reports).toContain('listLearnerTeachingWeeklyReports');
    expect(report).toContain('getLearnerTeachingWeeklyReport');
    expect(report).toContain('<WeeklyReportSections');
    expect(feedback).toContain('listLearnerTeachingLessonFeedback');
    expect(feedback).toContain('<LessonFeedbackList');
    expect(sessions).toContain('listLearnerTeachingSessions');
    expect(sessions).toContain('listLearnerTeachingLeaveRequests');
    expect(sessions).toContain('createLearnerTeachingLeaveRequest');
    expect(sessions).toContain('cancelLearnerTeachingLeaveRequest');
    expect(sessions).toContain('useOperationKey');
    expect(sessions).toContain('requestOperation.get(`${orgSlug}:${studentId}:${selectedSession.id}:${selectedSession.attendance.id}:${canonicalReason}`)');
    expect(sessions).toContain('cancelOperation.get(`${orgSlug}:${studentId}:${selectedSession.id}:${selectedSession.attendance.id}:${request.id}:${canonicalReason}`)');
    expect(sessions).not.toContain('listTeachingStudents');
    expect(sessions).not.toContain('listTeachingLeaveRequests');
    expect(binding).toContain('<TeachingAccountBindingPage kind="guardian" />');
    expect(bindingPage).toContain('previewTeachingGuardianAccountBinding');
    expect(bindingPage).toContain('consumeTeachingGuardianAccountBinding');
    expect(bindingPage).not.toContain('localStorage');
    expect(workspace).toContain("relationship.kind === 'student'");
    expect(workspace).toContain('isSelf && <AppLink href={`/training/');
    expect(overview).toContain('isSelf && <AppLink');
    for (const source of [learn, workspace, overview, reports, report]) {
      expect(source).toContain('<AppLink');
      expect(source).toContain('prefetch={false}');
      expect(source).not.toContain('router.push');
    }
    expect(sessions).toContain('<TeachingPagination');
    expect(sessions).not.toContain('router.push');
  });

  it('shares one conversation UI across learner and staff routes with real links and narrow layout', () => {
    const learnerWorkspace = readClient('components/teaching/LearnerWorkspace.tsx');
    const learnerOverview = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/page.tsx');
    const studentDetail = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx');
    const conversationList = readClient('components/teaching/TeachingConversationList.tsx');
    const conversationThread = readClient('components/teaching/TeachingConversationThread.tsx');
    const learnerMessages = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/messages/page.tsx');
    const learnerThread = readClient('app/[lang]/learn/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx');
    const staffMessages = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/messages/page.tsx');
    const staffThread = readClient('app/[lang]/org/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx');
    const css = readClient('components/teaching/teaching.css');

    expect(learnerWorkspace).toContain('href={`${baseHref}/messages`}');
    expect(learnerOverview).toContain('href={`${baseHref}/messages`}');
    expect(studentDetail).toContain("hasTeachingPermission(role, 'conversation:read')");
    expect(studentDetail).toContain('students/${studentId}/messages');
    for (const source of [learnerWorkspace, learnerOverview, studentDetail, conversationList, conversationThread]) {
      expect(source).toContain('<AppLink');
      expect(source).toContain('prefetch={false}');
      expect(source).not.toContain('router.push');
    }
    expect(learnerMessages).toContain('<TeachingConversationList');
    expect(learnerThread).toContain('<TeachingConversationThread');
    expect(staffMessages).toContain("hasTeachingPermission(organization.role, 'conversation:read')");
    expect(staffMessages).toContain("hasTeachingPermission(organization.role, 'conversation:manage')");
    expect(staffThread).toContain("hasTeachingPermission(organization.role, 'conversation:read')");
    expect(staffThread).toContain("hasTeachingPermission(organization.role, 'conversation:manage')");
    expect(conversationList).toContain('maxLength={200}');
    expect(conversationList).toContain('maxLength={10_000}');
    expect(conversationThread).toContain('markTeachingConversationRead');
    expect(conversationThread).toContain('refreshNotificationsUnread');
    expect(conversationThread).toContain('maxLength={10_000}');
    expect(css).toContain('.teaching-conversation-entry { grid-template-columns: 42px minmax(0, 1fr);');
    expect(css).toContain('.teaching-conversation-body { min-width: 0; margin: 0; white-space: pre-wrap;');
  });
});
