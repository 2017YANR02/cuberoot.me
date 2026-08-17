import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type DirectoryEntryKind = 'teacher' | 'organization';
export type DirectoryTeachingMode = 'online' | 'in_person' | 'both';
export type DirectoryImageKind = 'portrait' | 'organization' | 'teaching' | 'other';
export interface DirectoryImage {
  id: number;
  url: string;
  kind: DirectoryImageKind;
  captionZh: string;
  captionEn: string;
}
export const DIRECTORY_CONTACT_KEYS = [
  'wechat',
  'qq',
  'email',
  'phone',
  'youtube',
  'bilibili',
  'douyin',
  'kuaishou',
  'xiaohongshu',
  'wechatChannels',
  'facebook',
  'other',
] as const;
export type DirectoryContactKey = typeof DIRECTORY_CONTACT_KEYS[number];
export type DirectoryContacts = Partial<Record<DirectoryContactKey, string>>;

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
  contacts: DirectoryContacts;
  website: string;
  wcaId: string;
  isCurated: boolean;
  isVisible: boolean;
  images: DirectoryImage[];
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
  contacts: DirectoryContacts;
  website: string;
  wcaId: string;
  isCurated: boolean;
  isVisible: boolean;
  images: DirectoryImage[];
}

type TeacherDirectoryImageWire = Omit<DirectoryImage, 'url'> & { url?: string };
type TeacherDirectoryEntryWire = Omit<TeacherDirectoryEntry, 'isVisible' | 'contacts' | 'images'> & {
  isVisible?: boolean;
  contacts?: unknown;
  contact?: string;
  images?: unknown;
};

const DIRECTORY_IMAGE_KINDS = new Set<DirectoryImageKind>(['portrait', 'organization', 'teaching', 'other']);

export function normalizeDirectoryImages(value: unknown): DirectoryImage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const images: DirectoryImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Partial<TeacherDirectoryImageWire>;
    const id = Number(source.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    images.push({
      id,
      url: apiUrl(`/v1/article/img/${id}`),
      kind: DIRECTORY_IMAGE_KINDS.has(source.kind as DirectoryImageKind)
        ? source.kind as DirectoryImageKind
        : 'other',
      captionZh: typeof source.captionZh === 'string' ? source.captionZh : '',
      captionEn: typeof source.captionEn === 'string' ? source.captionEn : '',
    });
    if (images.length === 8) break;
  }
  return images;
}

export function normalizeDirectoryContacts(value: unknown, legacyContact = ''): DirectoryContacts {
  const contacts: DirectoryContacts = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    for (const key of DIRECTORY_CONTACT_KEYS) {
      const contactValue = typeof source[key] === 'string' ? source[key].trim() : '';
      if (contactValue) contacts[key] = contactValue;
    }
  }
  if (Object.keys(contacts).length === 0 && legacyContact.trim()) {
    contacts.other = legacyContact.trim();
  }
  return contacts;
}

function normalizeTeacherDirectoryEntry(entry: TeacherDirectoryEntryWire): TeacherDirectoryEntry {
  const { contact = '', ...rest } = entry;
  return {
    ...rest,
    contacts: normalizeDirectoryContacts(entry.contacts, contact),
    isVisible: entry.isVisible !== false,
    images: normalizeDirectoryImages(entry.images),
  };
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
    await fetch(apiUrl('/v1/teachers?v=4')),
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
