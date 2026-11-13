import {
  type TeachingOrganizationStatus,
  type TeachingOrganizationRole,
  type TeachingStudentStatus,
  type TeachingMemberStatus,
  type TeachingPackageProductStatus,
  type TeachingCreditUnit,
  type TeachingStudentPackageStatus,
  type TeachingPackageAcquisitionType,
  type TeachingCreditLedgerEntry,
  type TeachingAttendanceStatus,
  type TeachingSessionStatus,
  type TeachingLeaveRequest,
  type TeachingMakeupAttempt,
  type TeachingFeedbackVisibility,
  type TeachingTrainingAssignmentDetail,
} from '@cuberoot/shared/teaching';

export interface TeachingOrganizationAccess {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: TeachingOrganizationStatus;
  version: number;
  role: TeachingOrganizationRole;
}

export interface TeachingOrganizationSummary {
  organization: TeachingOrganizationAccess;
  memberCount: number | null;
  studentCount: number | null;
}

export interface TeachingStudent {
  id: string;
  accountUserId: number | null;
  externalRef: string | null;
  displayName: string;
  status: TeachingStudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeachingMember {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  role: TeachingOrganizationRole;
  status: TeachingMemberStatus;
  joinedAt: string | null;
  createdAt: string | null;
}

export interface TeachingPackageProduct {
  id: string;
  code: string;
  name: string;
  status: TeachingPackageProductStatus;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingStudentPackage {
  id: string;
  studentId: string;
  productId: string;
  productCode: string;
  productName: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  entitledCredits: number;
  remainingCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
  status: TeachingStudentPackageStatus;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  validUntil: string | null;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
  createdAt: string;
}

export interface TeachingCreditLedgerMutationResult {
  ledgerEntry: TeachingCreditLedgerEntry;
  studentPackage: TeachingStudentPackage;
}

export interface TeachingSessionTeacher {
  userId: number;
  displayName: string;
  role: 'lead' | 'assistant';
}

export interface TeachingAttendance {
  id: string;
  studentId: string;
  displayName: string | null;
  studentPackageId: string | null;
  status: TeachingAttendanceStatus;
  creditCost: number;
  notes: string;
  updatedAt: string;
}

export interface TeachingSessionSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: TeachingSessionStatus;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  teachers: TeachingSessionTeacher[];
  attendanceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingSession extends TeachingSessionSummary {
  attendance: TeachingAttendance[];
}

export interface TeachingSessionCompletion {
  session: {
    id: string;
    status: 'completed';
    completedAt: string;
  };
  consumption: {
    attendanceCount: number;
    totalCredits: number;
  };
}

export interface TeachingLeaveRequestMutationResult {
  leaveRequest: TeachingLeaveRequest;
  attendance: TeachingAttendance;
}

export interface TeachingMakeupMutationResult {
  makeupAttempt: TeachingMakeupAttempt;
  attendance: TeachingAttendance;
}

export interface TeachingSessionCancellationResult {
  session: TeachingSession;
  makeupAttempts: TeachingMakeupAttempt[];
}

export interface TeachingLessonFeedback {
  id: string;
  sessionId: string;
  studentId: string;
  revision: number;
  visibility: TeachingFeedbackVisibility;
  summary: string;
  strengths: string | null;
  challenges: string | null;
  nextGoals: string | null;
  internalNotes: string | null;
  studentDisplayNameSnapshot: string;
  attendanceStatusSnapshot: TeachingAttendanceStatus;
  creditCostSnapshot: number;
  authorUserId: number | null;
  authorUserIdSnapshot: number;
  authorDisplayNameSnapshot: string;
  authorRoleSnapshot: TeachingOrganizationRole;
  publishedAt: string | null;
  createdAt: string;
}

export interface TeachingDailyBoard extends TeachingTrainingAssignmentDetail {
  rankEvent: string | null;
  events: string[];
  date: string;
  today: string;
  timezone: string;
  selfId: string | null;
  total: number;
  completedTotal: number;
  page: number;
  pageSize: number;
  rows: { studentId: string; name: string; rank: number | null; count: number; durationMs: number; successes: number; completed: boolean; results: { event: string; bestMs: number | null; meanMs: number | null }[] }[];
}
