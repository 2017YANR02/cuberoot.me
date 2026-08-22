// /quiz 社区题的 API 封装。端点见 server/src/routes/quiz.ts。
//
// 出题人写的题直接上线(无前置审核),所以「公开列表」和「我出的题」是两个端点:
// 前者只回已发布的,后者含被管理员下架的(带下架理由,作者要看得到为什么)。

import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { QuizDraft } from '@cuberoot/shared/quiz';

/** 一道社区题的 API 形状。缺的那一侧语言是空串,渲染时回落 —— 见 _lib/community.ts。 */
export interface CommunityQuestionRow {
  id: number;
  cat: string;
  level: string;
  type: string;
  qZh: string; qEn: string;
  whyZh: string; whyEn: string;
  options: { zh: string; en: string }[];
  answerIdx: number;
  answerZh: string; answerEn: string;
  accept: string[];
  authorKey?: string;
  authorName: string;
  authorUserId: number | null;
  status: string;
  hiddenNote: string;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizReportRow {
  id: number;
  questionId: number;
  qZh: string; qEn: string;
  authorName: string;
  authorUserId: number | null;
  questionStatus: string;
  reporterKey: string; reporterName: string;
  reporterUserId: number | null;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

/** 某一档的全部已发布社区题。没登录也能拉 —— 社区题对所有人可见。 */
export async function fetchCommunityQuestions(level: string): Promise<CommunityQuestionRow[]> {
  const r = await fetch(apiUrl(`/v1/quiz/questions?level=${encodeURIComponent(level)}`));
  const data = await handleApi<{ questions: CommunityQuestionRow[] }>(r);
  return data.questions;
}

/** 我出的题(含被下架的)。 */
export async function fetchMyQuestions(): Promise<CommunityQuestionRow[]> {
  const r = await fetch(apiUrl('/v1/quiz/mine'), { headers: authHeaders(false) });
  const data = await handleApi<{ questions: CommunityQuestionRow[] }>(r);
  return data.questions;
}

export async function createQuestion(draft: QuizDraft): Promise<CommunityQuestionRow> {
  const r = await fetch(apiUrl('/v1/quiz/questions'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(draft),
  });
  const data = await handleApi<{ question: CommunityQuestionRow }>(r);
  return data.question;
}

/** 改题。作者只能改自己的;status / hiddenNote 只有管理员发得动(服务端忽略非管理员的)。 */
export async function updateQuestion(
  id: number,
  draft: QuizDraft & { status?: string; hiddenNote?: string },
): Promise<CommunityQuestionRow> {
  const r = await fetch(apiUrl(`/v1/quiz/questions/${id}`), {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(draft),
  });
  const data = await handleApi<{ question: CommunityQuestionRow }>(r);
  return data.question;
}

export async function deleteQuestion(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/quiz/questions/${id}`), {
    method: 'DELETE', headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}

export async function reportQuestion(id: number, reason: string): Promise<void> {
  const r = await fetch(apiUrl(`/v1/quiz/questions/${id}/report`), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ reason }),
  });
  await handleApi<{ ok: boolean }>(r);
}

/** 管理员:全部社区题(含已下架)。 */
export async function fetchAllQuestions(): Promise<CommunityQuestionRow[]> {
  const r = await fetch(apiUrl('/v1/quiz/admin/questions'), { headers: authHeaders(false) });
  const data = await handleApi<{ questions: CommunityQuestionRow[] }>(r);
  return data.questions;
}

/** 管理员:举报列表(默认只看待处理)。 */
export async function fetchQuizReports(all = false): Promise<QuizReportRow[]> {
  const r = await fetch(apiUrl(`/v1/quiz/admin/reports${all ? '?all=1' : ''}`), {
    headers: authHeaders(false),
  });
  const data = await handleApi<{ reports: QuizReportRow[] }>(r);
  return data.reports;
}

export async function resolveQuizReport(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/quiz/admin/reports/${id}/resolve`), {
    method: 'POST', headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}
