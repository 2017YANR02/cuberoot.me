// /forum API client — typed fetch helpers for /v1/forum/*.
// Same shape as lib/recon-api.ts: API_BASE + authHeaders/handleApi.

import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const API_BASE = API_ORIGIN + '/v1/forum';

export const REACTION_KINDS = ['like', 'love', 'haha', 'wow', 'sad'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const REACTION_EMOJI: Record<ReactionKind, string> = {
  like: '👍', love: '❤️', haha: '😄', wow: '😮', sad: '😢',
};

export interface ForumLastThread {
  id: number;
  title: string;
  lastPostAt: string;
  lastPostAuthorId: string;
  lastPostAuthorName: string;
}

export interface ForumBoard {
  id: number;
  slug: string;
  nameEn: string;
  nameZh: string;
  descEn: string;
  descZh: string;
  icon: string;
  adminOnly: boolean;
}

export interface ForumSummary extends ForumBoard {
  threadCount: number;
  postCount: number;
  lastThread: ForumLastThread | null;
}

export interface ForumCategory {
  id: number;
  slug: string;
  nameEn: string;
  nameZh: string;
  forums: ForumSummary[];
}

export interface ForumStats {
  threads: number;
  posts: number;
  members: number;
  latestMemberName: string;
}

export interface ForumIndexData {
  categories: ForumCategory[];
  stats: ForumStats;
}

/** 审核状态(0074):pending 仅作者与管理员可见,rejected 对他人等同删除。 */
export type ForumReviewStatus = 'approved' | 'pending' | 'rejected';

export interface ForumThread {
  id: number;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  replyCount: number;
  viewCount: number;
  lastPostAt: string;
  lastPostAuthorId: string;
  lastPostAuthorName: string;
  isPinned: boolean;
  isLocked: boolean;
  status: ForumReviewStatus;
  /** 全部楼层数(含软删/待审占位)——「跳到最后一页」按它算,不用 replyCount */
  postTotal: number;
}

export interface ForumRef {
  slug: string;
  nameEn: string;
  nameZh: string;
}

export interface ForumListData {
  forum: ForumBoard;
  category: ForumRef;
  pinned: ForumThread[];
  threads: ForumThread[];
  total: number;
  page: number;
  size: number;
}

export interface PostReaction {
  kind: ReactionKind;
  count: number;
  names: string[];
}

export interface ForumPost {
  id: number;
  authorId: string;
  authorName: string;
  /** 待审/驳回楼层对非作者非管理员掩码为 ''(占位显示) */
  content: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  status: ForumReviewStatus;
  /** 驳回原因,仅本楼作者与管理员可见 */
  reviewNote: string | null;
  postNo: number;
  reactions: PostReaction[];
}

export interface PostAuthor {
  name: string;
  avatarUrl: string | null;
  joinedAt: string | null;
  postCount: number;
  wcaId: string | null;
  isAdmin: boolean;
}

export interface ThreadDetail {
  id: number;
  forumId: number;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  status: ForumReviewStatus;
  /** 驳回原因(仅作者/管理员能打开非公开主题,故拿到即可见) */
  reviewNote: string | null;
}

export interface ThreadPageData {
  thread: ThreadDetail;
  forum: ForumRef;
  category: ForumRef;
  posts: ForumPost[];
  authors: Record<string, PostAuthor>;
  myReactions: Record<string, ReactionKind>;
  total: number;
  page: number;
  size: number;
}

export interface LatestThread extends ForumThread {
  forumSlug: string;
  forumNameEn: string;
  forumNameZh: string;
}

export interface SearchThread extends LatestThread {
  snippet: string | null;
}

export interface SearchData {
  threads: SearchThread[];
  total: number;
  page: number;
  size: number;
}

function originForUrl(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, originForUrl());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return handleApi<T>(await fetch(url.toString(), { headers: authHeaders(false) }));
}

async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  return handleApi<T>(await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
}

export async function fetchForumIndex(): Promise<ForumIndexData> {
  return apiGet<ForumIndexData>('/index');
}

export async function fetchForumList(
  slug: string, page: number, size: number, sort: 'activity' | 'created',
): Promise<ForumListData> {
  return apiGet<ForumListData>(`/f/${encodeURIComponent(slug)}`, {
    page: String(page), size: String(size), sort,
  });
}

export async function fetchThread(id: number, page: number, size: number): Promise<ThreadPageData> {
  return apiGet<ThreadPageData>(`/t/${id}`, { page: String(page), size: String(size) });
}

export async function fetchLatestThreads(limit: number): Promise<{ threads: LatestThread[] }> {
  return apiGet<{ threads: LatestThread[] }>('/latest', { limit: String(limit) });
}

export async function searchForum(q: string, page: number, size: number): Promise<SearchData> {
  return apiGet<SearchData>('/search', { q, page: String(page), size: String(size) });
}

export async function createThread(
  forumSlug: string, title: string, content: string,
): Promise<{ ok: boolean; id: number; status: ForumReviewStatus }> {
  return apiSend('POST', '/threads', { forumSlug, title, content });
}

export async function createPost(
  threadId: number, content: string,
): Promise<{ ok: boolean; id: number; postNo: number; status: ForumReviewStatus }> {
  return apiSend('POST', '/posts', { threadId, content });
}

export async function updatePost(id: number, content: string): Promise<{ ok: boolean }> {
  return apiSend('PATCH', `/posts/${id}`, { content });
}

export async function deletePost(id: number): Promise<{ ok: boolean }> {
  return apiSend('DELETE', `/posts/${id}`);
}

export async function deleteThread(id: number): Promise<{ ok: boolean }> {
  return apiSend('DELETE', `/threads/${id}`);
}

export async function updateThread(
  id: number, patch: { title?: string; isPinned?: boolean; isLocked?: boolean },
): Promise<{ ok: boolean }> {
  return apiSend('PATCH', `/threads/${id}`, patch);
}

export async function reactToPost(
  id: number, kind: ReactionKind | null,
): Promise<{ ok: boolean; reactions: PostReaction[] }> {
  return apiSend('POST', `/posts/${id}/react`, { kind });
}

export async function trackThreadView(id: number): Promise<void> {
  // Fire-and-forget; failures are irrelevant to the reader.
  try {
    await fetch(`${API_BASE}/t/${id}/view`, { method: 'POST' });
  } catch { /* ignore */ }
}

export interface ForumReport {
  id: number;
  postId: number;
  threadId: number;
  threadTitle: string;
  postAuthorName: string;
  excerpt: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export async function reportPost(id: number, reason: string): Promise<{ ok: boolean }> {
  return apiSend('POST', `/posts/${id}/report`, { reason });
}

export async function fetchReports(all: boolean): Promise<{ reports: ForumReport[] }> {
  return apiGet<{ reports: ForumReport[] }>('/reports', all ? { all: '1' } : {});
}

export async function resolveReport(id: number): Promise<{ ok: boolean }> {
  return apiSend('POST', `/reports/${id}/resolve`);
}

// ── 审核队列(管理员)─────────────────────────────────────────────────────────
export interface ReviewItem {
  type: 'thread' | 'post';
  /** thread 时 = 主题 id;post 时 = 帖子 id */
  id: number;
  threadId: number;
  threadTitle: string;
  forumNameEn: string | null;
  forumNameZh: string | null;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export async function fetchReviewQueue(): Promise<{ items: ReviewItem[] }> {
  return apiGet<{ items: ReviewItem[] }>('/review');
}

export async function moderateReview(
  type: 'thread' | 'post', id: number, action: 'approve' | 'reject', reason?: string,
): Promise<{ ok: boolean }> {
  return apiSend('POST', `/review/${type}/${id}/${action}`, action === 'reject' ? { reason } : undefined);
}

// ── 图片上传 ────────────────────────────────────────────────────────────────
export interface UploadedImage {
  id: number;
  url: string;
}

/**
 * 上传一张图(JSON base64 通道),返回 { id, url }(url 绝对地址,直接写进 markdown)。
 * 复用共享图库端点 /v1/article/img/:id(不可变 + nginx 缓存)——/article 并入论坛后,
 * 该路径只是底层 blob store,与文章无关。客户端先 canvas 缩放再传(服务端不 resize)。
 */
export async function uploadForumImage(dataB64: string, mime: string): Promise<UploadedImage> {
  return handleApi<UploadedImage>(await fetch(`${API_ORIGIN}/v1/article/img`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ dataB64, mime }),
  }));
}
