import { authHeaders, handleApi } from './admin-api';
import { apiUrl } from './api-base';

export type CompetitionDevice = 'ordinary' | 'smart';
export interface CompetitionProject {
  id: string;
  project: string;
  device: CompetitionDevice;
  amountMinor: number;
  currency: string;
  capacity: number;
}
export interface CompetitionSession {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  available: number;
  supervisorUserId: number | null;
  assistanceRequested: boolean;
  staffed: boolean;
}
export interface OnlineCompetitionSummary {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  status: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  organizationId: string;
  organizationName: string;
  projects: CompetitionProject[];
}
export interface OnlineCompetition extends OnlineCompetitionSummary {
  organizationSlug: string;
  commissionBps: number | null;
  settlementDays: number | null;
  settlementAnchor: 'finalized' | 'ended' | null;
  refundPolicy: string;
  recordingPolicy: string;
  sessions: CompetitionSession[];
  canManage?: boolean;
  canSupervise?: boolean;
  canPublish?: boolean;
  finalizedAt?: string | null;
}
export interface CompetitionRegistration {
  id: string;
  userId: number;
  displayName: string;
  project: string;
  device: CompetitionDevice;
  sessionId: string;
  orderId: string;
  status: string;
  checkedInAt?: string | null;
  canCheckIn: boolean;
  canRecordResult: boolean;
  resultRecordedAt: string | null;
}

export interface CompetitionAttempt {
  attemptNumber: number;
  scramble: string;
  issuedAt: string;
  centiseconds: number | null;
  penalty: 'none' | '+2' | 'DNF' | 'DNS' | null;
  recordedAt: string | null;
}
export interface CompetitionResult {
  id: string;
  displayName: string;
  project: string;
  device: CompetitionDevice;
  attempts: Array<{ centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' }>;
  finalizedAt: string | null;
}

const base = '/v1/platform/competitions';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;

// Reuse the account session and response handling used by platform commerce.
async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  return handleApi<T>(await fetch(apiUrl(url), {
    method, headers: { ...authHeaders(body !== undefined), ...(method === 'GET' ? {} : { 'Idempotency-Key': crypto.randomUUID() }) }, cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

export const listOnlineCompetitions = (managed = false) => request<{ competitions: OnlineCompetitionSummary[] }>(`${base}${managed ? '/manage' : ''}`);
export const getOnlineCompetition = (id: string) => request<{ competition: OnlineCompetition }>(path(id));
export const createOnlineCompetition = (body: Record<string, unknown>) => request<{ id: string; status: string }>(base, 'POST', body);
export const configureOnlineCompetition = (id: string, body: Record<string, unknown>) => request<{ id: string; status: string }>(`${path(id)}/config`, 'PUT', body);
export const addCompetitionSession = (id: string, body: Record<string, unknown>) => request(`${path(id)}/sessions`, 'POST', body);
export const updateCompetitionSession = (id: string, sessionId: string, body: Record<string, unknown>) => request(`${path(id)}/sessions/${encodeURIComponent(sessionId)}`, 'PATCH', body);
export const publishOnlineCompetition = (id: string) => request<{ id: string; status: string }>(`${path(id)}/publish`, 'POST', {});
export const listCompetitionRegistrations = (id: string) => request<{ registrations: CompetitionRegistration[] }>(`${path(id)}/registrations`);
const registrationPath = (id: string) => `${base}/registrations/${encodeURIComponent(id)}`;
export const checkInCompetition = (registrationId: string) => request(`${registrationPath(registrationId)}/check-in`, 'POST', {});
export const getCompetitionAttempts = (id: string) => request<{ attempts: CompetitionAttempt[] }>(`${registrationPath(id)}/attempts`);
export const nextCompetitionAttempt = (id: string) => request(`${registrationPath(id)}/attempts/next`, 'POST', {});
export const recordCompetitionAttempt = (id: string, attempt: number, body: { centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' }) => request(`${registrationPath(id)}/attempts/${attempt}/result`, 'POST', body);
export const finalizeCompetitionRegistration = (id: string) => request(`${registrationPath(id)}/result`, 'POST', {});
export const listCompetitionResults = (id: string) => request<{ results: CompetitionResult[] }>(`${path(id)}/results`);
export const raiseCompetitionDispute = (id: string, reason: string) => request(`${registrationPath(id)}/disputes`, 'POST', { reason });
export interface CompetitionDispute { id: string; registrationId: string; reason: string; resolution: string | null; createdAt: string; resolvedAt: string | null }
export interface CompetitionSettlement { commissionBps: number | null; settlementDays: number | null; settlementAnchor: string | null; finalizedAt: string | null; eligibleAt: string | null; netCollectedMinor: string; platformFeeMinor: string; organizerAmountMinor: string; refundedMinor: string; eligible: boolean; currency: string; transferStatus: string; transferredMinor?: string; outstandingMinor?: string; reconciliationRequired?: boolean; transfers?: Array<{id: string; amountMinor: number; transferredAt: string | null; createdAt: string; entryType: 'payout' | 'recovery' | 'adjustment'}> }
export const listCompetitionDisputes = (id: string) => request<{ disputes: CompetitionDispute[] }>(`${path(id)}/disputes`);
export const resolveCompetitionDispute = (id: string, resolution: string, correctedAttempts?: CompetitionResult['attempts']) => request(`${base}/disputes/${encodeURIComponent(id)}/resolve`, 'POST', { resolution, ...(correctedAttempts ? { correctedAttempts } : {}) });
export const finalizeCompetition = (id: string) => request(`${path(id)}/finalize`, 'POST', {});
export const closeCompetitionSessions = (id: string) => request(`${path(id)}/close-sessions`, 'POST', {});
export const getCompetitionSettlement = (id: string) => request<{ settlement: CompetitionSettlement }>(`${path(id)}/settlement`);
export const recordCompetitionSettlement = (id: string, body: { amountMinor: number; providerReference: string; transferredAt: string; direction?: 'payout' | 'recovery' }) => request(`${path(id)}/settlement-record`, 'POST', body);
export interface CompetitionEvidence { id: string; mime: string; sizeBytes: number; createdAt: string; expiresAt: string }
export interface OrganizerApplication {
  id: string; status: 'pending' | 'approved' | 'rejected'; name: string; slug: string; contact: string; description: string;
  createdAt: string; reviewedAt: string | null; reviewNote: string | null; organizationId: string | null; organizationSlug: string | null;
}
const organizerApplicationsPath = '/v1/platform/organizer-applications';
export const listOrganizerApplications = () => request<{ applications: OrganizerApplication[]; eligibleOrganizationIds: string[] }>(`${organizerApplicationsPath}/me`);
export const listOrganizerReviewQueue = () => request<{ applications: OrganizerApplication[] }>(`${organizerApplicationsPath}/review-queue`);
export const submitOrganizerApplication = (body: { name: string; slug: string; contact: string; description: string; organizationId?: string }) => request<{ application: OrganizerApplication }>(organizerApplicationsPath, 'POST', body);
export const reviewOrganizerApplication = (id: string, decision: 'approve' | 'reject', note: string) => request<{ application: OrganizerApplication }>(`${organizerApplicationsPath}/${encodeURIComponent(id)}/review`, 'POST', { decision, note });
export interface CompetitionRefund {
  id: string; orderId: string; status: string; amountMinor: string; currency: string; reasonCode: string;
  provider: string; providerStatus: string | null; failureCode: string | null; approvedAt: string | null;
  succeededAt: string | null; createdAt: string; lastCheckedAt: string | null;
  rejectionReason?: string | null;
}
export const listCompetitionOrderRefunds = (id: string) => request<{ items: CompetitionRefund[] }>(`/v1/platform/orders/${encodeURIComponent(id)}/refunds`);
export const requestCompetitionOrderRefund = (id: string, reasonCode: string) => request<CompetitionRefund>(`/v1/platform/orders/${encodeURIComponent(id)}/refund-requests`, 'POST', { reasonCode });
export const approveCompetitionOrderRefund = (id: string) => request<CompetitionRefund>(`/v1/admin/refunds/${encodeURIComponent(id)}/approve`, 'POST', {});
export const refreshCompetitionOrderRefund = (id: string) => request<CompetitionRefund>(`/v1/admin/refunds/${encodeURIComponent(id)}/refresh`, 'POST', {});
export const rejectCompetitionOrderRefund = (id: string, reasonCode: string) => request<CompetitionRefund>(`/v1/admin/refunds/${encodeURIComponent(id)}/reject`, 'POST', { reasonCode });
export const listCompetitionEvidence = (id: string) => request<{ evidence: CompetitionEvidence[] }>(`${registrationPath(id)}/evidence`);
export async function uploadCompetitionEvidence(id: string, file: File) {
  return handleApi(await fetch(apiUrl(`${registrationPath(id)}/evidence`), { method: 'POST', headers: { ...authHeaders(), 'Content-Type': file.type }, body: file }));
}
export async function downloadCompetitionEvidence(id: string) {
  const response = await fetch(apiUrl(`${base}/evidence/${encodeURIComponent(id)}/content`), { headers: authHeaders(), cache: 'no-store' });
  if (!response.ok) { await handleApi(response); throw new Error('Download failed'); }
  return response.blob();
}
export const createCompetitionOrder = (project: CompetitionProject, sessionId: string) => request<{ order?: { id: string }; id?: string; resourceId?: string }>('/v1/platform/orders', 'POST', {
  items: [{ eventTicketTypeId: project.id, competitionSessionId: sessionId, device: project.device, quantity: 1 }],
});
