import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/recon-ground-truth';

export type GroundTruthStatus = 'pending' | 'confirmed' | 'discussion' | 'rejected';
export type SavedGroundTruthStatus = Exclude<GroundTruthStatus, 'pending'>;

export interface GroundTruthSource {
  id: number;
  official: 'wca' | 'non_wca' | 'practice';
  visibility: 'public' | 'unlisted' | 'private';
  event: '3x3';
  person: string;
  personId: string;
  value: string;
  rawTime: number | null;
  comp: string;
  date: string;
  method: string;
  addedBy: string;
  addedById: string;
  reconer: string;
  reconerId: string;
  scramble: string;
  solution: string;
}

export interface GroundTruthCandidate extends Omit<GroundTruthSource, 'solution'> {
  status: GroundTruthStatus;
  decisionNote: string;
  decisionUpdatedAt: string | null;
  sourceChanged: boolean;
}

export interface GroundTruthAssessment {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  truth: string;
  normalizedSolution: string;
  crossNormalized: boolean;
  sourceSolved: boolean;
}

export interface GroundTruthDecision {
  status: SavedGroundTruthStatus;
  replay: string;
  truth: string;
  truthMode: 'normalize_cross';
  currentWrong: string;
  note: string;
  sourceEvent: string;
  sourceAddedById: string;
  sourceScramble: string;
  sourceSolution: string;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroundTruthDetail {
  source: GroundTruthSource;
  assessment: GroundTruthAssessment;
  decision: GroundTruthDecision | null;
  sourceChanged: boolean;
}

export interface CandidatePage {
  scope: { event: '3x3'; addedById: string };
  page: number;
  limit: number;
  total: number;
  items: GroundTruthCandidate[];
}

export async function listGroundTruthCandidates(params: {
  q?: string;
  status?: GroundTruthStatus | 'all';
  page?: number;
  limit?: number;
}): Promise<CandidatePage> {
  const url = new URL(`${BASE}/candidates`, window.location.origin);
  if (params.q) url.searchParams.set('q', params.q);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  return handleApi<CandidatePage>(await fetch(url, { headers: authHeaders(false) }));
}

export async function getGroundTruthDetail(reconId: number): Promise<GroundTruthDetail> {
  return handleApi<GroundTruthDetail>(
    await fetch(`${BASE}/${reconId}`, { headers: authHeaders(false) }),
  );
}

export async function saveGroundTruthDecision(
  reconId: number,
  body: {
    status: SavedGroundTruthStatus;
    replay: string;
    currentWrong: string;
    note: string;
    acknowledgeWarnings: boolean;
  },
): Promise<Pick<GroundTruthDetail, 'assessment' | 'decision' | 'sourceChanged'>> {
  return handleApi(await fetch(`${BASE}/${reconId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }));
}
