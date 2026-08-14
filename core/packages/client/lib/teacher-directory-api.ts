import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type DirectoryEntryKind = 'teacher' | 'organization';
export type DirectoryTeachingMode = 'online' | 'in_person' | 'both';

export interface TeacherDirectoryEntry {
  id: number;
  kind: DirectoryEntryKind;
  nameZh: string;
  nameEn: string;
  locationZh: string;
  locationEn: string;
  specialtiesZh: string[];
  specialtiesEn: string[];
  teachingMode: DirectoryTeachingMode;
  descriptionZh: string;
  descriptionEn: string;
  contact: string;
  website: string;
  wcaId: string;
  isCurated: boolean;
  isVisible: boolean;
  ownerKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherDirectoryDraft {
  kind: DirectoryEntryKind;
  nameZh: string;
  nameEn: string;
  locationZh: string;
  locationEn: string;
  specialtiesZh: string[];
  specialtiesEn: string[];
  teachingMode: DirectoryTeachingMode;
  descriptionZh: string;
  descriptionEn: string;
  contact: string;
  website: string;
  wcaId: string;
  isCurated: boolean;
  isVisible: boolean;
}

type TeacherDirectoryEntryWire = Omit<TeacherDirectoryEntry, 'isVisible'> & {
  isVisible?: boolean;
};

function normalizeTeacherDirectoryEntry(entry: TeacherDirectoryEntryWire): TeacherDirectoryEntry {
  return { ...entry, isVisible: entry.isVisible !== false };
}

export function mergeTeacherDirectoryEntries(
  publicEntries: TeacherDirectoryEntry[],
  ownedEntries: TeacherDirectoryEntry[],
): TeacherDirectoryEntry[] {
  const ownedById = new Map(ownedEntries.map((entry) => [entry.id, entry]));
  const publicIds = new Set(publicEntries.map((entry) => entry.id));
  return [
    ...publicEntries.map((entry) => ownedById.get(entry.id) ?? entry),
    ...ownedEntries.filter((entry) => !publicIds.has(entry.id)),
  ];
}

export async function fetchTeacherDirectory(): Promise<TeacherDirectoryEntry[]> {
  const data = await handleApi<{ entries: TeacherDirectoryEntryWire[] }>(
    await fetch(apiUrl('/v1/teachers?v=2')),
  );
  return data.entries.map(normalizeTeacherDirectoryEntry);
}

export async function fetchMyTeacherDirectory(): Promise<TeacherDirectoryEntry[]> {
  const data = await handleApi<{ entries: TeacherDirectoryEntryWire[] }>(
    await fetch(apiUrl('/v1/teachers/mine'), { headers: authHeaders(false) }),
  );
  return data.entries.map(normalizeTeacherDirectoryEntry);
}

export async function createTeacherDirectoryEntry(draft: TeacherDirectoryDraft): Promise<TeacherDirectoryEntry> {
  const data = await handleApi<{ entry: TeacherDirectoryEntryWire }>(await fetch(apiUrl('/v1/teachers'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
  return normalizeTeacherDirectoryEntry(data.entry);
}

export async function updateTeacherDirectoryEntry(
  id: number,
  draft: TeacherDirectoryDraft,
): Promise<TeacherDirectoryEntry> {
  const data = await handleApi<{ entry: TeacherDirectoryEntryWire }>(await fetch(apiUrl(`/v1/teachers/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
  return normalizeTeacherDirectoryEntry(data.entry);
}

export async function deleteTeacherDirectoryEntry(id: number): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/teachers/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
