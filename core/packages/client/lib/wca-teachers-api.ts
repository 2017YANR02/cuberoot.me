import { API_ORIGIN } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

const BASE = API_ORIGIN + '/v1/wca/teachers';

export interface WcaTeacher {
  studentWcaId: string;
  eventId: string;
  teacherWcaId: string;
  teacherName: string;
}

export async function listWcaTeachers(studentWcaIds: string[], eventIds: string[]): Promise<WcaTeacher[]> {
  if (studentWcaIds.length === 0 || eventIds.length === 0) return [];
  const qs = new URLSearchParams({
    students: studentWcaIds.join(','),
    events: eventIds.join(','),
  });
  const data = await handleApi<{ teachers: WcaTeacher[] }>(await fetch(`${BASE}?${qs.toString()}`));
  return data.teachers;
}

export async function setWcaTeacher(studentWcaId: string, eventId: string, teacherWcaId?: string): Promise<WcaTeacher> {
  const data = await handleApi<{ teacher: WcaTeacher }>(await fetch(`${BASE}/${encodeURIComponent(studentWcaId)}/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(teacherWcaId ? { teacherWcaId } : {}),
  }));
  return data.teacher;
}

export async function removeWcaTeacher(studentWcaId: string, eventId: string): Promise<void> {
  await handleApi<{ ok: true }>(await fetch(`${BASE}/${encodeURIComponent(studentWcaId)}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
