import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';

const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;
const WCA_EVENT_ID_RE = /^[a-z0-9]{2,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WCA_EVENT_IDS: ReadonlySet<string> = new Set(WCA_EVENT_ORDER);

export const MAX_TEACHER_LOOKUP_IDS = 100;
export const MAX_TEACHER_LOOKUP_EVENTS = 30;
export const MAX_NAMED_STUDENT_NAME_LENGTH = 160;

export function normalizeWcaId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return WCA_ID_RE.test(id) ? id : null;
}

export function parseTeacherLookupIds(value: string | undefined): string[] | null {
  if (!value) return [];
  const raw = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (raw.length > MAX_TEACHER_LOOKUP_IDS) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = normalizeWcaId(value);
    if (!id) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function normalizeWcaEventId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return WCA_EVENT_ID_RE.test(id) && WCA_EVENT_IDS.has(id) ? id : null;
}

export function parseTeacherLookupEvents(value: string | undefined): string[] | null {
  if (!value) return [];
  const raw = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (raw.length > MAX_TEACHER_LOOKUP_EVENTS) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = normalizeWcaEventId(value);
    if (!id) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function normalizeNamedStudentName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name || name.length > MAX_NAMED_STUDENT_NAME_LENGTH) return null;
  return name;
}

export function normalizeNamedStudentId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return UUID_RE.test(id) ? id : null;
}

export function parseTeacherEventIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEACHER_LOOKUP_EVENTS) return null;
  const eventIds: string[] = [];
  const seen = new Set<string>();
  for (const valueItem of value) {
    const eventId = normalizeWcaEventId(valueItem);
    if (!eventId) return null;
    if (!seen.has(eventId)) {
      seen.add(eventId);
      eventIds.push(eventId);
    }
  }
  return eventIds;
}

export function mayReplaceTeacher(
  isAdmin: boolean,
  actorWcaId: string,
  existingTeacherWcaId: string | null,
): boolean {
  return isAdmin || existingTeacherWcaId == null || existingTeacherWcaId === actorWcaId;
}
