import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export async function platformLearningRequest<T>(path: string, body?: Record<string, unknown>, method = 'POST', signal?: AbortSignal): Promise<T> {
  return handleApi<T>(await fetch(apiUrl(`/v1/platform${path}`), {
    method: body === undefined ? 'GET' : method,
    headers: { ...authHeaders(), ...(body === undefined ? {} : { 'Idempotency-Key': crypto.randomUUID() }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
  }));
}
export interface LearningNote { id: string; body: string; positionSeconds: number | null; updatedAt?: string; lessonId?: string; courseId?: string; title?: string; courseTitleZh?: string; courseTitleEn?: string }
export interface LearningLesson { id: string; titleZh?: string; titleEn?: string; ordinal?: number; status?: string; progressBps?: number; durationSeconds?: number; accessScope?: string }
export interface QuizFeedback { questionId: string; selected: unknown; expected: unknown; correct: boolean; explanation?: string }
export interface LearningAttempt { id: string; quizId: string; quizRevision?: number; attemptNumber: number; scoreBps: number; passed: boolean; gradedAt?: string; feedback?: QuizFeedback[]; awardedPoints?: boolean }
export interface LessonLearningState { progress: { status: string; progressBps: number; positionSeconds: number } | null; notes: LearningNote[]; lessons: LearningLesson[]; attempts: LearningAttempt[] }
export const learningTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
