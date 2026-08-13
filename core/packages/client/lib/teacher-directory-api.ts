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
}

export async function fetchTeacherDirectory(): Promise<TeacherDirectoryEntry[]> {
  const data = await handleApi<{ entries: TeacherDirectoryEntry[] }>(
    await fetch(apiUrl('/v1/teachers')),
  );
  return data.entries;
}

export async function fetchMyTeacherDirectory(): Promise<TeacherDirectoryEntry[]> {
  const data = await handleApi<{ entries: TeacherDirectoryEntry[] }>(
    await fetch(apiUrl('/v1/teachers/mine'), { headers: authHeaders(false) }),
  );
  return data.entries;
}

export async function createTeacherDirectoryEntry(draft: TeacherDirectoryDraft): Promise<TeacherDirectoryEntry> {
  const data = await handleApi<{ entry: TeacherDirectoryEntry }>(await fetch(apiUrl('/v1/teachers'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
  return data.entry;
}

export async function updateTeacherDirectoryEntry(
  id: number,
  draft: TeacherDirectoryDraft,
): Promise<TeacherDirectoryEntry> {
  const data = await handleApi<{ entry: TeacherDirectoryEntry }>(await fetch(apiUrl(`/v1/teachers/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
  return data.entry;
}

export async function deleteTeacherDirectoryEntry(id: number): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/teachers/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
