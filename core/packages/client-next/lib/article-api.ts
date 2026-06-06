/**
 * /v1/article/* client wrapper.
 *
 * 社区长文(markdown + 指令)。任何登录 WCA 用户可发(untrusted)。
 *   - GET 列表 / 单篇:公开(已发布);?mine / 草稿走 authed。
 *   - POST/PATCH/DELETE:requireAuth;owner / admin 才能改自己的。
 *   - 图片:bytea 存库,POST 返回 { id, url }。
 *
 * 全部走 authHeaders() + handleApi()(lib/admin-api.ts)+ apiUrl()(lib/api-base.ts)。
 * 新增 API 字段一律防御性可选链(memory feedback_new_api_field_defensive)。
 */
import { apiUrl } from './api-base';
import { authHeaders, handleApi as handle } from './admin-api';

// ── response 类型(契约见 SPEC §3) ───────────────────────────────────────────
export interface ArticleListItem {
  slug: string;
  title: string;
  subtitle?: string;
  authorName: string;
  authorWcaId: string;
  lang: string;
  publishedAt: string | null;
  updatedAt: string;
}

export interface Article extends ArticleListItem {
  body: string;
  createdAt: string;
  canEdit?: boolean;
}

export interface UploadedImage {
  id: number;
  url: string;
}

export interface ArticleMe {
  wcaId: string;
  name: string;
  isAdmin: boolean;
}

// 创建 / 更新入参。slug / publish 在更新时可选。
export interface CreateArticleInput {
  slug: string;
  title: string;
  subtitle?: string;
  body: string;
  lang?: string;
  publish?: boolean;
}

export interface UpdateArticleInput {
  slug?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  publish?: boolean;
}

// ── 列表 ──────────────────────────────────────────────────────────────────────
/**
 * 已发布文章列表(精简项,不含 body)。
 * mine=true → 自己的草稿 + 发布(需登录,服务端 no-store)。
 */
export async function fetchArticles(opts?: { mine?: boolean }): Promise<ArticleListItem[]> {
  const url = apiUrl(`/v1/article${opts?.mine ? '?mine=1' : ''}`);
  const r = opts?.mine
    ? await fetch(url, { headers: authHeaders(false), cache: 'no-store' })
    : await fetch(url);
  const data = await handle<ArticleListItem[] | { articles?: ArticleListItem[] }>(r);
  // 防御:后端可能裸返数组,也可能包一层 { articles }。
  if (Array.isArray(data)) return data;
  return data?.articles ?? [];
}

// ── 单篇 ──────────────────────────────────────────────────────────────────────
/** 按 slug 取全量(含 body)。已发布任何人可看,草稿仅 owner/admin。 */
export async function fetchArticleBySlug(slug: string, opts?: { authed?: boolean }): Promise<Article> {
  const url = apiUrl(`/v1/article/${encodeURIComponent(slug)}`);
  const r = opts?.authed
    ? await fetch(url, { headers: authHeaders(false), cache: 'no-store' })
    : await fetch(url, { next: { revalidate: 300 } });
  // 后端单篇统一包一层 { article }(列表是 { articles });防御性回退到裸对象。
  const data = await handle<{ article?: Article }>(r);
  return data.article ?? (data as unknown as Article);
}

// ── 写 ────────────────────────────────────────────────────────────────────────
export async function createArticle(input: CreateArticleInput): Promise<Article> {
  const r = await fetch(apiUrl('/v1/article'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await handle<{ article?: Article }>(r);
  return data.article ?? (data as unknown as Article);
}

export async function updateArticle(slug: string, input: UpdateArticleInput): Promise<Article> {
  const r = await fetch(apiUrl(`/v1/article/${encodeURIComponent(slug)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await handle<{ article?: Article }>(r);
  return data.article ?? (data as unknown as Article);
}

export async function deleteArticle(slug: string): Promise<void> {
  const r = await fetch(apiUrl(`/v1/article/${encodeURIComponent(slug)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handle<{ ok: boolean }>(r);
}

// ── 图片 ──────────────────────────────────────────────────────────────────────
/**
 * 上传一张文章图(JSON base64 通道)。客户端 canvas 缩放后再传(服务端不 resize)。
 * 返回 { id, url };url 是绝对地址,直接写进 markdown。
 */
export async function uploadArticleImage(dataB64: string, mime: string): Promise<UploadedImage> {
  const r = await fetch(apiUrl('/v1/article/img'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataB64, mime }),
  });
  return handle<UploadedImage>(r);
}

// ── me(UI 门控) ──────────────────────────────────────────────────────────────
export async function fetchArticleMe(): Promise<ArticleMe> {
  const r = await fetch(apiUrl('/v1/article/me'), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handle<ArticleMe>(r);
}
