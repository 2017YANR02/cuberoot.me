import { API_ORIGIN } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

const BASE = API_ORIGIN + '/v1/wca/teachers';
const RESPONSE_VERSION = '5';

export interface WcaTeacher {
  studentWcaId: string;
  studentName?: string;
  student333Average?: number | null;
  eventId: string;
  teacherWcaId: string;
  teacherName: string;
  teacherCountryIso2: string;
}

export interface WcaNamedStudent {
  id: string;
  teacherWcaId: string;
  studentName: string;
  countryIso2: string;
  eventIds: string[];
}

export async function listWcaTeacherStudents(teacherWcaId: string): Promise<WcaTeacher[]> {
  const qs = new URLSearchParams({
    teachers: teacherWcaId,
    v: RESPONSE_VERSION,
    refresh: Date.now().toString(),
  });
  const data = await handleApi<{ teachers: WcaTeacher[] }>(await fetch(`${BASE}?${qs.toString()}`, { cache: 'no-store' }));
  return data.teachers;
}

export async function listWcaNamedStudents(teacherWcaId: string): Promise<WcaNamedStudent[]> {
  const data = await handleApi<{ students: WcaNamedStudent[] }>(await fetch(
    `${BASE}/${encodeURIComponent(teacherWcaId)}/named-students?v=${RESPONSE_VERSION}&refresh=${Date.now()}`,
    { cache: 'no-store' },
  ));
  return data.students;
}

export async function createWcaNamedStudent(
  teacherWcaId: string,
  studentName: string,
  countryIso2: string,
  eventIds: string[],
): Promise<WcaNamedStudent> {
  const data = await handleApi<{ student: WcaNamedStudent }>(await fetch(
    `${BASE}/${encodeURIComponent(teacherWcaId)}/named-students`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentName, countryIso2, eventIds }),
    },
  ));
  return data.student;
}

export async function updateWcaNamedStudent(
  teacherWcaId: string,
  studentId: string,
  studentName: string,
  countryIso2: string,
  eventIds: string[],
): Promise<WcaNamedStudent> {
  const data = await handleApi<{ student: WcaNamedStudent }>(await fetch(
    `${BASE}/${encodeURIComponent(teacherWcaId)}/named-students/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ studentName, countryIso2, eventIds }),
    },
  ));
  return data.student;
}

export async function removeWcaNamedStudent(teacherWcaId: string, studentId: string): Promise<void> {
  await handleApi<{ ok: true }>(await fetch(
    `${BASE}/${encodeURIComponent(teacherWcaId)}/named-students/${encodeURIComponent(studentId)}`,
    { method: 'DELETE', headers: authHeaders(false) },
  ));
}

export async function listWcaTeachers(studentWcaIds: string[], eventIds: string[]): Promise<WcaTeacher[]> {
  if (studentWcaIds.length === 0 || eventIds.length === 0) return [];
  const qs = new URLSearchParams({
    students: studentWcaIds.join(','),
    events: eventIds.join(','),
    v: RESPONSE_VERSION,
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
