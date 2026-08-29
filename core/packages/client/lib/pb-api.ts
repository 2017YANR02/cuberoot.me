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

export async function fetchPbPerson(wcaId: string, signal?: AbortSignal): Promise<PbCollection> {
  return handleApi(await fetch(apiUrl(`/v1/pb/person/${encodeURIComponent(wcaId)}`), {
    cache: 'no-store',
    signal,
  }));
}

export async function fetchManagedPbs(wcaId: string, signal?: AbortSignal): Promise<PbCollection> {
  return handleApi(await fetch(apiUrl(`/v1/pb/manage/${encodeURIComponent(wcaId)}`), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  }));
}

function managedPath(path: string, ownerWcaId?: string): string {
  if (!ownerWcaId) return path;
  return `${path}?${new URLSearchParams({ owner: ownerWcaId })}`;
}

export async function updatePbVisibility(isPublic: boolean, ownerWcaId?: string): Promise<void> {
  await handleApi(await fetch(apiUrl(managedPath('/v1/pb/profile', ownerWcaId)), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ isPublic }),
  }));
}

export async function createPbRecord(input: CreatePbRecordInput, ownerWcaId?: string): Promise<PbRecord> {
  const data = await handleApi<{ record: PbRecord }>(await fetch(apiUrl(managedPath('/v1/pb/records', ownerWcaId)), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  }));
  return data.record;
}

export async function updatePbRecord(
  id: number,
  input: CreatePbRecordInput,
  ownerWcaId?: string,
): Promise<PbRecord> {
  const data = await handleApi<{ record: PbRecord }>(await fetch(apiUrl(managedPath(`/v1/pb/records/${id}`, ownerWcaId)), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(input),
  }));
  return data.record;
}

export async function deletePbRecord(id: number, ownerWcaId?: string): Promise<void> {
  await handleApi(await fetch(apiUrl(managedPath(`/v1/pb/records/${id}`, ownerWcaId)), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
