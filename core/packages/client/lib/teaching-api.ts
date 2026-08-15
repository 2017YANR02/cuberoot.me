import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type AdvancedCourseTrack = '333' | '222';

export interface AdvancedCourseLesson {
  id: number;
  track: AdvancedCourseTrack;
  position: number;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  minutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdvancedCourseDraft {
  track: AdvancedCourseTrack;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  minutes: number;
}

export interface TrialLessonOverride {
  lessonId: string;
  titleZh: string;
  outcomeZh: string;
  minutes: number;
  shotsZh: string[];
  scriptZh: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TrialLessonDraft = Omit<TrialLessonOverride, 'lessonId' | 'createdAt' | 'updatedAt'>;

export async function fetchTrialLessonOverrides(): Promise<TrialLessonOverride[]> {
  return handleApi(await fetch(apiUrl('/v1/teaching/trial'), { cache: 'no-store' }));
}

export async function updateTrialLessonOverride(
  lessonId: string,
  draft: TrialLessonDraft,
): Promise<TrialLessonOverride> {
  return handleApi(await fetch(apiUrl(`/v1/teaching/trial/${encodeURIComponent(lessonId)}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
}

export async function fetchAdvancedCourseLessons(): Promise<AdvancedCourseLesson[]> {
  return handleApi(await fetch(apiUrl('/v1/teaching/advanced'), { cache: 'no-store' }));
}

export async function createAdvancedCourseLesson(draft: AdvancedCourseDraft): Promise<AdvancedCourseLesson> {
  return handleApi(await fetch(apiUrl('/v1/teaching/advanced'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
}

export async function updateAdvancedCourseLesson(
  id: number,
  draft: AdvancedCourseDraft,
): Promise<AdvancedCourseLesson> {
  return handleApi(await fetch(apiUrl(`/v1/teaching/advanced/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  }));
}

export async function reorderAdvancedCourseLessons(
  track: AdvancedCourseTrack,
  ids: number[],
): Promise<void> {
  await handleApi(await fetch(apiUrl('/v1/teaching/advanced/reorder'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ track, ids }),
  }));
}

export async function deleteAdvancedCourseLesson(id: number): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/teaching/advanced/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
