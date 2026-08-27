import type { PbRecordType } from '@cuberoot/shared/pb';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export interface PbProfile {
  userId: number;
  name: string;
  avatar: string;
  wcaId: string;
  isPublic: boolean;
}

export interface PbRecord {
  id: number;
  eventId: string;
  recordType: PbRecordType;
  setSize: number;
  resultValue: number;
  happenedOn: string;
  cubeName: string;
  comments: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PbCollection {
  profile: PbProfile;
  records: PbRecord[];
}

export interface PbLeaderboardRow {
  rank: number;
  profile: PbProfile;
  record: PbRecord;
}

export interface CreatePbRecordInput {
  eventId: string;
  recordType: PbRecordType;
  setSize: number;
  resultValue: number;
  happenedOn: string;
  cubeName: string;
  comments: string;
}

export async function fetchMyPbs(signal?: AbortSignal): Promise<PbCollection> {
  return handleApi(await fetch(apiUrl('/v1/pb/me'), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  }));
}

export async function fetchPbProfile(userId: number, signal?: AbortSignal): Promise<PbCollection> {
  return handleApi(await fetch(apiUrl(`/v1/pb/profile/${userId}`), { cache: 'no-store', signal }));
}

export async function fetchPbPerson(wcaId: string, signal?: AbortSignal): Promise<PbCollection> {
  return handleApi(await fetch(apiUrl(`/v1/pb/person/${encodeURIComponent(wcaId)}`), {
    cache: 'no-store',
    signal,
  }));
}

export async function fetchPbLeaderboard(
  eventId: string,
  recordType: PbRecordType,
  setSize: number,
  signal?: AbortSignal,
): Promise<PbLeaderboardRow[]> {
  const query = new URLSearchParams({ event: eventId, type: recordType, size: String(setSize) });
  const data = await handleApi<{ rows: PbLeaderboardRow[] }>(
    await fetch(apiUrl(`/v1/pb/leaderboard?${query}`), { cache: 'no-store', signal }),
  );
  return data.rows;
}

export async function updatePbVisibility(isPublic: boolean): Promise<void> {
  await handleApi(await fetch(apiUrl('/v1/pb/profile'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ isPublic }),
  }));
}

export async function createPbRecord(input: CreatePbRecordInput): Promise<PbRecord> {
  const data = await handleApi<{ record: PbRecord }>(await fetch(apiUrl('/v1/pb/records'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  }));
  return data.record;
}

export async function deletePbRecord(id: number): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/pb/records/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
