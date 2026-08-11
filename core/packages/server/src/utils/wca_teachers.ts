const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;

export const MAX_TEACHER_LOOKUP_IDS = 100;

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

export function mayReplaceTeacher(
  isAdmin: boolean,
  actorWcaId: string,
  existingTeacherWcaId: string | null,
): boolean {
  return isAdmin || existingTeacherWcaId == null || existingTeacherWcaId === actorWcaId;
}
