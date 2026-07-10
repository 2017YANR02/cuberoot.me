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
  /** 全部楼层数(含软删占位)——「跳到最后一页」按它算,不用 replyCount */
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
  content: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
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
): Promise<{ ok: boolean; id: number }> {
  return apiSend('POST', '/threads', { forumSlug, title, content });
}

export async function createPost(
  threadId: number, content: string,
): Promise<{ ok: boolean; id: number; postNo: number }> {
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
