import type { CompetitionDnfReason, NetBattleCredentials } from '@cuberoot/shared/timer';
import { optionalSessionGet, sessionFetch } from '@/lib/session-fetch';
import type { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { authHeaders, handleApi } from './admin-api';
import { apiUrl } from './api-base';

export type CompetitionDevice = 'ordinary' | 'smart';
export type CompetitionDraftProject = (typeof WCA_TIMED_EVENT_ORDER)[number];
export interface CompetitionSetup {
  format: 'advancement' | 'average';
  device: CompetitionDevice;
  capacity: number;
  project?: CompetitionDraftProject | null;
  feeMinor?: number | null;
}
export type CompetitionMode = 'self_service' | 'supervised' | 'offline';
export type CompetitionReviewStatus = 'draft' | 'pending_approval' | 'rejected' | 'approved';
export type CompetitionRefundTemplate = 'before_24h' | 'before_start' | 'custom';
export type CompetitionVenue = { city: string; address: string; contact: string; checkinGuide: string };
export type CompetitionDraftSession = {
  startsAt: string; endsAt: string; capacity: number; supervisorUserId: number | null; assistanceRequested: boolean;
};
export type CompetitionSettlementTerms = { commissionBps: number; settlementDays: number; settlementAnchor: 'ended' | 'finalized' };
export interface CompetitionDraftSettings {
  format: CompetitionSetup['format'];
  supervisionMode: CompetitionMode;
  projects: Array<{ project: string; device: CompetitionDevice; amountMinor: number; capacity: number }>;
  sessions: CompetitionDraftSession[];
  offlineVenue?: CompetitionVenue;
  refundTemplate: CompetitionRefundTemplate;
  refundPolicy: string;
  recordingPolicy: string;
  titleZh: string;
  titleEn: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
}
export interface CompetitionProject {
  id: string;
  project: string;
  device: CompetitionDevice;
  amountMinor: number;
  currency: string;
  capacity: number;
  available?: number;
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
  kind?: CompetitionMode;
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
  setup?: CompetitionSetup | null;
  format?: CompetitionSetup['format'];
  supervisionMode?: CompetitionMode;
  reviewStatus?: CompetitionReviewStatus;
  submittedAt?: string | null;
  finalizedAt?: string | null;
}
export interface OnlineCompetition extends OnlineCompetitionSummary {
  organizationSlug: string;
  commissionBps: number | null;
  settlementDays: number | null;
  settlementAnchor: 'finalized' | 'ended' | null;
  refundPolicy: string;
  recordingPolicy: string;
  refundTemplate?: CompetitionRefundTemplate;
  offlineVenue?: CompetitionVenue | null;
  reviewNote?: string;
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
  sessionKind?: CompetitionMode;
  orderId: string;
  status: string;
  checkedInAt?: string | null;
  canCheckIn: boolean;
  canRecordResult: boolean;
  canJoinVideo?: boolean;
  resultRecordedAt: string | null;
  attemptNumber?: number | null;
  reservationExpiresAt?: string | null;
  attempts?: CompetitionResult['attempts'] | null;
  reviewRequired?: boolean;
  reviewAttempts?: Array<CompetitionAttemptResult & { attemptNumber: number }>;
}

export interface MyCompetitionEntry {
  registrationId: string;
  competitionId: string;
  titleZh: string;
  titleEn: string;
  status: string;
  device: CompetitionDevice | null;
  orderId: string;
  sessionStartsAt: string;
  reservationExpiresAt?: string | null;
  action: 'pay' | 'results' | 'enter' | 'enter_bracket' | 'check_in' | 'upcoming' | 'details';
}

interface CompetitionHostTotals {
  registered: number;
  netCollectedMinor: string;
  refundedMinor: string;
  organizerAmountMinor: string | null;
}

export interface CompetitionHostOverview {
  currency: 'CNY';
  competitionCount: number;
  totals: CompetitionHostTotals;
  competitions: Array<CompetitionHostTotals & {
    id: string;
    titleZh: string;
    titleEn: string;
    organizationName: string;
    status?: string;
  }>;
}

export interface CompetitionAttempt {
  attemptNumber: number;
  scramble: string;
  issuedAt: string;
  centiseconds: number | null;
  penalty: 'none' | '+2' | 'DNF' | 'DNS' | null;
  recordedAt: string | null;
  reviewRequired?: boolean;
  telemetry?: { status: 'started' | 'device_reported'; moveCount?: number } | null;
}
export type CompetitionAttemptResult = { centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' };
export type CompetitionSelfResult = CompetitionAttemptResult & ({ recordedLocally: true } | { recordingEvidenceId: string });
export interface CompetitionResult {
  id: string;
  wcaId?: string | null;
  countryCode?: string | null;
  rank?: number | null;
  displayName: string;
  project: string;
  device: CompetitionDevice;
  attempts: CompetitionAttemptResult[];
  replayAttempts?: number[];
  recordedAt?: string;
  finalizedAt: string | null;
}

const base = '/v1/platform/competitions';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;

// Reuse the account session and response handling used by platform commerce.
async function request<T>(url: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl(url), {
    method, headers: { ...authHeaders(body !== undefined), ...(method === 'GET' ? {} : { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() }) }, cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

function publicGet<T>(url: string): Promise<T> {
  return fetch(apiUrl(url), { cache: 'no-store', credentials: 'omit' }).then(handleApi<T>);
}

export const listOnlineCompetitions = (managed = false) => managed
  ? request<{ competitions: OnlineCompetitionSummary[] }>(`${base}/manage?v=3`)
  : publicGet<{ competitions: OnlineCompetitionSummary[] }>(`${base}?v=3`);
export const listSupervisedCompetitions = () => request<{ competitions: OnlineCompetitionSummary[] }>(`${base}/me/supervised?v=3`);
export const getCompetitionHostOverview = () => request<CompetitionHostOverview>(`${base}/host/overview`);
export async function listMyCompetitionEntries() {
  const response = await sessionFetch(apiUrl(`${base}/me/entries?v=2`), { headers: authHeaders(false), cache: 'no-store' });
  // The website can reach an older API revision during independent rollouts.
  if (response.status === 404) return { entries: [] };
  return handleApi<{ entries: MyCompetitionEntry[] }>(response);
}
export const getOnlineCompetition = (id: string) => optionalSessionGet(apiUrl(`${path(id)}?v=3`), {
  headers: authHeaders(false), cache: 'no-store',
}).then(handleApi<{ competition: OnlineCompetition }>);
export const createOnlineCompetition = (body: CompetitionDraftSettings & { organizationId: string; slug: string }, idempotencyKey: string) =>
  request<{ id: string; status: 'draft' }>(`${base}/drafts`, 'POST', body, idempotencyKey);
export const updateCompetitionDraft = (id: string, body: CompetitionDraftSettings, idempotencyKey: string) =>
  request<{ id: string; status: 'draft' }>(`${base}/drafts/${encodeURIComponent(id)}`, 'PUT', body, idempotencyKey);
export const configureOnlineCompetition = (id: string, body: Record<string, unknown>) => request<{ id: string; status: string }>(`${path(id)}/config`, 'PUT', body);
export const addCompetitionSession = (id: string, body: Record<string, unknown>) => request(`${path(id)}/sessions`, 'POST', body);
export const updateCompetitionSession = (id: string, sessionId: string, body: Record<string, unknown>) => request(`${path(id)}/sessions/${encodeURIComponent(sessionId)}`, 'PATCH', body);
export const publishOnlineCompetition = (id: string, terms?: CompetitionSettlementTerms, key?: string) => request<{ id: string; status: string }>(`${path(id)}/submit`, 'POST', terms ?? {}, key);
export type CompetitionSupervisor = { id: number; name: string };
export const competitionSupervisors = (id: string) => request<{ supervisors: CompetitionSupervisor[] }>(`${base}/organizers/${encodeURIComponent(id)}/supervisors`);
export const listCompetitionReviewQueue = () => request<{ competitions: OnlineCompetition[]; supervisors: CompetitionSupervisor[] }>(`${base}/review-queue`);
export const reviewCompetition = (id: string, body: {
  decision: 'approve' | 'reject'; note: string; submittedAt?: string; supervisorAssignments?: Array<{ sessionId: string; supervisorUserId: number }>;
} & Partial<CompetitionSettlementTerms>) => request(`${path(id)}/review`, 'POST', body);
export const recordOfflineCompetitionResults = (id: string, results: Array<{ registrationId: string; attempts: CompetitionResult['attempts'] }>) =>
  request(`${path(id)}/offline-results`, 'POST', { results });
export const listCompetitionRegistrations = (id: string) => request<{ registrations: CompetitionRegistration[] }>(`${path(id)}/registrations`);
const registrationPath = (id: string) => `${base}/registrations/${encodeURIComponent(id)}`;
export type CompetitionCheckInDevice = { deviceBrand: string; deviceName: string; facelets: string };
export const checkInCompetition = (registrationId: string, device?: CompetitionCheckInDevice) =>
  request(`${registrationPath(registrationId)}/check-in`, 'POST', device ?? {});
export const getCompetitionAttempts = (id: string) => request<{ attempts: CompetitionAttempt[] }>(`${registrationPath(id)}/attempts`);
export const nextCompetitionAttempt = (id: string) => request(`${registrationPath(id)}/attempts/next`, 'POST', {});
export const nextCompetitionSelfAttempt = (id: string) => request(`${registrationPath(id)}/self-attempts/next`, 'POST', {});
export const completeCompetitionSelfAttempt = (id: string, attempt: number, body: CompetitionSelfResult, key: string) =>
  request(`${registrationPath(id)}/self-attempts/${attempt}/complete`, 'POST', body, key);
export const reviewCompetitionSelfAttempt = (id: string, attemptNumber: number, decision: 'approve' | 'DNF') =>
  request(`${registrationPath(id)}/review-clear`, 'POST', { attemptNumber, decision });
export const recordCompetitionAttempt = (id: string, attempt: number, body: { centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' }) => request(`${registrationPath(id)}/attempts/${attempt}/result`, 'POST', body);
export const finalizeCompetitionRegistration = (id: string) => request(`${registrationPath(id)}/result`, 'POST', {});
export const listCompetitionResults = (id: string) => publicGet<{ results: CompetitionResult[] }>(`${path(id)}/results`);
export const raiseCompetitionDispute = (id: string, reason: string) => request(`${registrationPath(id)}/disputes`, 'POST', { reason });
export interface CompetitionDispute { id: string; registrationId: string; reason: string; resolution: string | null; createdAt: string; resolvedAt: string | null }
export interface CompetitionSettlement { commissionBps: number | null; settlementDays: number | null; settlementAnchor: string | null; finalizedAt: string | null; eligibleAt: string | null; netCollectedMinor: string; platformFeeMinor: string; organizerAmountMinor: string; refundedMinor: string; eligible: boolean; currency: string; transferStatus: string; transferredMinor?: string; outstandingMinor?: string; reconciliationRequired?: boolean; transfers?: Array<{id: string; amountMinor: number; transferredAt: string | null; createdAt: string; entryType: 'payout' | 'recovery' | 'adjustment'}> }
export const listCompetitionDisputes = (id: string) => request<{ disputes: CompetitionDispute[] }>(`${path(id)}/disputes`);
export const resolveCompetitionDispute = (id: string, resolution: string, correctedAttempts?: CompetitionResult['attempts']) => request(`${base}/disputes/${encodeURIComponent(id)}/resolve`, 'POST', { resolution, ...(correctedAttempts ? { correctedAttempts } : {}) });
export const finalizeCompetition = (id: string) => request(`${path(id)}/finalize`, 'POST', {});
export const closeCompetitionSessions = (id: string) => request(`${path(id)}/close-sessions`, 'POST', {});
export const getCompetitionSettlement = (id: string) => request<{ settlement: CompetitionSettlement }>(`${path(id)}/settlement`);
export const recordCompetitionSettlement = (id: string, body: { amountMinor: number; providerReference: string; transferredAt: string; direction?: 'payout' | 'recovery' }) => request(`${path(id)}/settlement-record`, 'POST', body);
export interface CompetitionEvidence { attemptNumber?: number | null; id: string; mime: string; sizeBytes: number; createdAt: string; expiresAt: string }
export interface OrganizerApplication {
  id: string; status: 'pending' | 'approved' | 'rejected'; name: string; slug: string; contact: string; description: string;
  createdAt: string; reviewedAt: string | null; reviewNote: string | null; organizationId: string | null; organizationSlug: string | null;
}
export interface OrganizerAccess {
  applications: OrganizerApplication[];
  eligibleOrganizationIds: string[];
  eligibleOrganizations?: Array<{ id: string; name: string }>;
}
const organizerApplicationsPath = '/v1/platform/organizer-applications';
export const listOrganizerApplications = () => request<OrganizerAccess>(`${organizerApplicationsPath}/me?v=2`);
export const listOrganizerReviewQueue = () => request<{ applications: OrganizerApplication[] }>(`${organizerApplicationsPath}/review-queue`);
type OrganizerApplicationInput = { contact: string; description: string } & (
  { organizationId: string; name?: never; slug?: never } | { name: string; slug: string; organizationId?: never }
);
export const submitOrganizerApplication = (body: OrganizerApplicationInput, idempotencyKey?: string) =>
  request<{ application: OrganizerApplication }>(organizerApplicationsPath, 'POST', body, idempotencyKey);
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
export async function uploadCompetitionEvidence(id: string, file: File, attemptNumber?: number) {
  const query = attemptNumber === undefined ? '' : `?attemptNumber=${attemptNumber}`;
  return handleApi<{ evidence: CompetitionEvidence[] }>(await sessionFetch(apiUrl(`${registrationPath(id)}/evidence${query}`), { method: 'POST', headers: { ...authHeaders(), 'Content-Type': file.type }, body: file }));
}
export async function competitionEvidencePlayback(id: string) {
  const basePath = `${base}/evidence/${encodeURIComponent(id)}`;
  const result = await request<{ token: string }>(`${basePath}/playback`);
  return apiUrl(`${basePath}/content?${new URLSearchParams({ token: result.token })}`);
}
export function getCompetitionAttemptReplay(id: string, number: number, publiclyAvailable = false) {
  type Replay = { report: CompetitionReplay | null };
  const url = `${registrationPath(id)}/attempts/${number}/telemetry`;
  return publiclyAvailable ? publicGet<Replay>(url) : request<Replay>(url);
}
export async function downloadCompetitionEvidence(id: string) {
  const response = await sessionFetch(apiUrl(`${base}/evidence/${encodeURIComponent(id)}/content`), { headers: authHeaders(), cache: 'no-store' });
  if (!response.ok) { await handleApi(response); throw new Error('Download failed'); }
  return response.blob();
}
export const createCompetitionOrder = (project: CompetitionProject, sessionId: string) => request<{ order?: { id: string }; id?: string; resourceId?: string }>('/v1/platform/orders', 'POST', {
  items: [{ eventTicketTypeId: project.id, competitionSessionId: sessionId, device: project.device, quantity: 1 }],
});

export type CompetitionBracketMatch = {
  id: string; ticketId: string; project: string; device: CompetitionDevice;
  side: 'winners' | 'losers' | 'grand_final'; round: number; number: number; bestOf: number;
  playerA: string | null; playerB: string | null; nameA: string | null; nameB: string | null;
  scoreA: number; scoreB: number; winner: string | null;
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'bye';
  gameNumber?: number | null;
  nextWin: string | null; nextLoss: string | null;
};
export type CompetitionBracketStanding = {
  id: string; ticketId: string; name: string; rank: number; wins: number; best: number | null;
  wcaId: string | null; countryCode: string | null; recordedAt?: string | null;
};
export type CompetitionReplay = {
  scramble: string; durationMs: number; moves: Array<{ move: string; elapsedMs: number }>;
  gyro?: string | null; timestamp?: string | null; penalty?: string | null; inspectionMs?: number; disconnected?: boolean;
};

export type CompetitionArenaIdentity = { name: string; wcaId: string | null; countryCode: string | null };
export type CompetitionArenaAttempt = {
  attemptNumber: number; centiseconds: number | null; penalty: CompetitionAttemptResult['penalty'] | null;
  inspectAt: string | null; solveAt: string | null; dnfReason: CompetitionDnfReason | null; replay: boolean;
};
export type CompetitionArenaPlayer = CompetitionArenaIdentity & { id: string; attempts: CompetitionArenaAttempt[] };
export type CompetitionArenaSnapshot = {
  serverNow: string; checkedIn?: boolean; roundNumber: number | null; seated: boolean; completed: boolean; legacy?: boolean;
  roomId: string | null; startsAt: string | null; scramble: string | null; credentials: NetBattleCredentials | null;
  inspectAt: string | null; solveAt: string | null; players: CompetitionArenaPlayer[];
};
export type CompetitionArenaPhase = 'inspecting' | 'solving' | 'timeout' | 'disconnected';
export type CompetitionTelemetryReport = CompetitionReplay & {
  runId: string; serverIssuedAt: string; startFacelets: string; endFacelets: string;
  deviceBrand: string; deviceName: string; disconnected: boolean; inspectionMs: number;
};
export type CompetitionDuelGame = {
  gameNumber: number; ownResult: (CompetitionAttemptResult & { dnfReason?: CompetitionDnfReason }) | null;
  opponentResult: (CompetitionAttemptResult & { dnfReason?: CompetitionDnfReason }) | null;
  winner: 'own' | 'opponent' | 'draw'; ownReplay?: boolean; opponentReplay?: boolean;
};
export type CompetitionDuel = {
  id: string; eventId: string; project: string; device: CompetitionDevice; status: CompetitionBracketMatch['status'];
  registrationId: string | null; supervisionMode: CompetitionMode; requiresSupervision: boolean; checkedIn: boolean;
  ownName: string; opponentName: string; ownScore: number; opponentScore: number;
  bestOf?: number; bracketSide?: CompetitionBracketMatch['side']; credentials?: NetBattleCredentials | null;
  ownIdentity?: CompetitionArenaIdentity; opponentIdentity?: CompetitionArenaIdentity; opponentPlayerId?: string | null;
  serverNow: string; gameNumber: number; startAt: string | null; canPlay: boolean;
  scramble: string | null; ownReady: boolean; opponentReady: boolean;
  ownResult: CompetitionDuelGame['ownResult']; opponentFinished: boolean; runId: string | null;
  opponentPhase: 'inspecting' | 'solving' | null;
  activeGame?: {
    gameNumber: number; authoritativeTiming: boolean; inspectAt: string | null; solveAt: string | null;
    scrambleDeadlineAt: string | null; inspectionSeconds: number;
    opponentResult?: CompetitionDuelGame['opponentResult']; opponentInspectAt?: string | null; opponentSolveAt?: string | null;
  } | null;
  lastGame?: CompetitionDuelGame | null;
  history?: CompetitionDuelGame[];
};
const matchPath = (id: string) => `${base}/matches/${encodeURIComponent(id)}`;
export const getCompetitionBrackets = (id: string) => publicGet<{ generated: boolean; matches: CompetitionBracketMatch[]; standings: CompetitionBracketStanding[] }>(`${path(id)}/brackets`);
export const generateCompetitionBrackets = (id: string) => request(`${path(id)}/brackets/generate`, 'POST', {});
export const getCompetitionDuel = (id: string) => request<CompetitionDuel>(matchPath(id));
export const readyCompetitionDuel = (id: string, gameNumber: number, key?: string) =>
  request(`${matchPath(id)}/ready`, 'POST', { gameNumber }, key);
export const setCompetitionDuelPhase = (id: string, gameNumber: number, phase: CompetitionArenaPhase, key?: string, inspectionMs?: number) =>
  request<{ inspectAt: string | null; solveAt: string | null; result?: CompetitionAttemptResult }>(`${matchPath(id)}/phase`, 'POST', { gameNumber, phase, ...(phase === 'disconnected' ? { disconnected: true } : {}), ...(inspectionMs === undefined ? {} : { inspectionMs }) }, key);
export const recordCompetitionDuel = (id: string, gameNumber: number, result: CompetitionResult['attempts'][number], key: string) =>
  request<{ recorded: true; result: CompetitionAttemptResult }>(`${matchPath(id)}/result`, 'POST', { gameNumber, ...result }, key);

export const getCompetitionArena = (id: string) => request<CompetitionArenaSnapshot>(`${registrationPath(id)}/arena`);
export const readyCompetitionArena = (id: string, key: string) => request(`${registrationPath(id)}/arena`, 'POST', {}, key);
export const setCompetitionArenaPhase = (id: string, attemptNumber: number, phase: CompetitionArenaPhase, key: string, inspectionMs?: number) =>
  request(`${registrationPath(id)}/arena/phase`, 'POST', { attemptNumber, phase, ...(phase === 'disconnected' ? { disconnected: true } : {}), ...(inspectionMs === undefined ? {} : { inspectionMs }) }, key);
const telemetryPath = (entryId: string, duel: boolean, number: number) =>
  duel ? `${matchPath(entryId)}/games/${number}/telemetry` : `${registrationPath(entryId)}/attempts/${number}/telemetry`;
export const startCompetitionTelemetry = (id: string, duel: boolean, number: number,
  body: { scramble: string; serverIssuedAt: string; startFacelets: string }, key: string) =>
  request<{ runId?: string; startedAt?: string; status: string }>(`${telemetryPath(id, duel, number)}/start`, 'POST', body, key);
export const reportCompetitionTelemetry = (id: string, duel: boolean, number: number, body: CompetitionTelemetryReport, key: string) =>
  request<{ status: string }>(telemetryPath(id, duel, number), 'POST', body, key);
export const getCompetitionDuelReplay = (id: string, number: number) =>
  request<{ own: CompetitionReplay | null; opponent: CompetitionReplay | null }>(telemetryPath(id, true, number));
