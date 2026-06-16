/**
 * /v1/feedback 客户端封装。提交 + 传附件走 WCA OAuth Bearer(authHeaders);
 * admin 列表 / 改状态 / 删 / 取媒体也走 Bearer(后端 requireAdmin)。
 * 全部经 authHeaders() + handleApi()(lib/admin-api)+ apiUrl()(lib/api-base)。
 */
import { apiUrl } from './api-base';
import { authHeaders, handleApi as handle } from './admin-api';

export type FeedbackKind = 'need' | 'bug' | 'other';
export type FeedbackStatus = 'new' | 'triaged' | 'done';

export interface SubmitFeedbackInput {
  kind: FeedbackKind;
  body: string;
  contact?: string;
  pageUrl?: string;
  lang?: string;
  theme?: string;
  viewport?: string;
  userAgent?: string;
}

export interface FeedbackMedia {
  id: number;
  kind: 'image' | 'video';
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export type FeedbackRole = 'user' | 'admin';

export interface AdminFeedbackItem {
  id: number;
  kind: FeedbackKind;
  body: string;
  wcaId: string;
  wcaName: string;
  contact: string | null;
  pageUrl: string | null;
  lang: string | null;
  theme: string | null;
  viewport: string | null;
  userAgent: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
  lastReplyRole: FeedbackRole | null;
  replyCount?: number;
  unread?: boolean;
  media: FeedbackMedia[];
}

/** 用户自己的反馈线程(列表项)。 */
export interface MyFeedbackItem {
  id: number;
  kind: FeedbackKind;
  body: string;
  status: FeedbackStatus;
  createdAt: string;
  lastReplyAt: string | null;
  lastReplyRole: FeedbackRole | null;
  replyCount: number;
  unread: boolean;
  media: FeedbackMedia[];
}

export interface FeedbackMessage {
  id: number;
  role: FeedbackRole;
  wcaId: string;
  wcaName: string;
  body: string;
  createdAt: string;
}

export interface FeedbackThread {
  feedback: AdminFeedbackItem;
  messages: FeedbackMessage[];
}

/** 创建一条反馈,返回 id(随后逐个传附件)。 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<{ id: number }> {
  const r = await fetch(apiUrl('/v1/feedback'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return handle<{ id: number }>(r);
}

/** 传一张截图(JSON base64,客户端已缩放/转 webp)。 */
export async function uploadFeedbackImage(feedbackId: number, dataB64: string, mime: string): Promise<{ id: number }> {
  const r = await fetch(apiUrl(`/v1/feedback/${feedbackId}/image`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataB64, mime }),
  });
  return handle<{ id: number }>(r);
}

/** 传一段短视频(multipart;不设 Content-Type 让浏览器带 boundary)。 */
export async function uploadFeedbackVideo(feedbackId: number, file: File, durationMs?: number): Promise<{ id: number }> {
  const fd = new FormData();
  fd.append('file', file);
  if (durationMs != null) fd.append('durationMs', String(Math.round(durationMs)));
  const r = await fetch(apiUrl(`/v1/feedback/${feedbackId}/video`), {
    method: 'POST',
    headers: authHeaders(false),
    body: fd,
  });
  return handle<{ id: number }>(r);
}

// ── admin ─────────────────────────────────────────────────────────────────────
export async function fetchFeedbackList(status?: FeedbackStatus): Promise<AdminFeedbackItem[]> {
  const url = status ? apiUrl(`/v1/feedback?status=${status}`) : apiUrl('/v1/feedback');
  const r = await fetch(url, { headers: authHeaders(false), cache: 'no-store' });
  const data = await handle<{ items: AdminFeedbackItem[] }>(r);
  return data.items ?? [];
}

export async function updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
  const r = await fetch(apiUrl(`/v1/feedback/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  await handle<{ ok: boolean }>(r);
}

export async function deleteFeedback(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/feedback/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handle<{ ok: boolean }>(r);
}

/** 媒体公开可取,直接做 <img>/<video> 的 src。 */
export function feedbackMediaUrl(id: number): string {
  return apiUrl(`/v1/feedback/media/${id}`);
}

// ── 对话(GitHub issue 式来回) ──────────────────────────────────────────────────
/** 当前登录用户自己的反馈线程列表。 */
export async function fetchMyFeedback(): Promise<MyFeedbackItem[]> {
  const r = await fetch(apiUrl('/v1/feedback/mine'), { headers: authHeaders(false), cache: 'no-store' });
  const data = await handle<{ items: MyFeedbackItem[] }>(r);
  return data.items ?? [];
}

/** 「有管理员新回复」未读线程数(给入口红点)。 */
export async function fetchMyFeedbackUnread(): Promise<number> {
  const r = await fetch(apiUrl('/v1/feedback/mine/unread'), { headers: authHeaders(false), cache: 'no-store' });
  const data = await handle<{ count: number }>(r);
  return data.count ?? 0;
}

/** 单条反馈的完整对话(发帖人或 admin);取阅即标记该方已读。 */
export async function fetchFeedbackThread(id: number): Promise<FeedbackThread> {
  const r = await fetch(apiUrl(`/v1/feedback/${id}/thread`), { headers: authHeaders(false), cache: 'no-store' });
  return handle<FeedbackThread>(r);
}

/** 回帖(发帖人或 admin)。 */
export async function replyToFeedback(id: number, body: string): Promise<{ id: number }> {
  const r = await fetch(apiUrl(`/v1/feedback/${id}/reply`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  return handle<{ id: number }>(r);
}

/** 删一条回复(本人或 admin)。 */
export async function deleteFeedbackMessage(feedbackId: number, messageId: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/feedback/${feedbackId}/message/${messageId}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handle<{ ok: boolean }>(r);
}
