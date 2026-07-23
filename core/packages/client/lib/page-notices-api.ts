// /v1/page-notices 客户端封装 — 每页顶部管理员通知条。
// 公共 GET 无认证;admin 写端点走 authHeaders(WCA OAuth Bearer / X-Admin-Key)。
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type NoticeLevel = 'info' | 'warning' | 'maintenance';

export interface PageNotice {
  id: number;
  path: string;
  level: NoticeLevel;
  icon?: string;       // lucide 图标 key(空 = 按 level 回退);老后端可能不返回,故可选
  bodyEn: string;
  bodyZh: string;
  enabled: boolean;
  dismissible: boolean;
  updatedAt: string;
}

export interface PageNoticeInput {
  path: string;
  level: NoticeLevel;
  icon: string;
  bodyEn: string;
  bodyZh: string;
  enabled: boolean;
  dismissible: boolean;
}

/** enabled 通知(全站访客用,60s 浏览器缓存)。 */
export async function fetchPageNotices(): Promise<PageNotice[]> {
  const r = await fetch(apiUrl('/v1/page-notices'));
  return handleApi<PageNotice[]>(r);
}

/** 全部通知含 disabled(admin,行内编辑器预填用)。 */
export async function fetchAllPageNotices(): Promise<PageNotice[]> {
  const r = await fetch(apiUrl('/v1/page-notices/manage'), { headers: authHeaders(false), cache: 'no-store' });
  return handleApi<PageNotice[]>(r);
}

/** 按 path upsert(admin)。 */
export async function savePageNotice(body: PageNoticeInput): Promise<PageNotice> {
  const r = await fetch(apiUrl('/v1/page-notices'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleApi<PageNotice>(r);
}

/** 删除(admin)。 */
export async function deletePageNotice(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/page-notices/${id}`), { method: 'DELETE', headers: authHeaders(false) });
  await handleApi<{ ok: boolean }>(r);
}

// ── 路径匹配(前端按当前 pathname 选出该显示哪些通知)──

/** 把浏览器 pathname 归一化成 lang 无关的页面 key(strip /zh 或 /en 前缀 + 去尾斜杠)。 */
export function pageKeyFromPathname(pathname: string): string {
  let p = pathname || '/';
  if (p === '/zh' || p === '/en') p = '/';
  else if (p.startsWith('/zh/')) p = p.slice(3);
  else if (p.startsWith('/en/')) p = p.slice(3);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/** 一条通知的 path 模式是否匹配某页面 key。支持精确 / `/foo/*` 前缀 / `/*` 全站。 */
export function noticeMatches(pattern: string, key: string): boolean {
  if (pattern === '/*') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2); // '/recon/*' → '/recon'
    return key === prefix || key.startsWith(prefix + '/');
  }
  return pattern === key;
}

/** 特异度打分:精确 > 长前缀 > 短前缀 > 全站。用于同页多条通知排序(特异的靠前)。 */
export function noticeSpecificity(pattern: string): number {
  if (pattern === '/*') return 0;
  if (pattern.endsWith('/*')) return pattern.length; // 前缀:越长越特异
  return 1000 + pattern.length;                      // 精确永远压过前缀
}

/** 选出匹配当前 key 的通知,按特异度降序(最贴合本页的排最前)。 */
export function matchNotices(notices: PageNotice[], key: string): PageNotice[] {
  return notices
    .filter((n) => noticeMatches(n.path, key))
    .sort((a, b) => noticeSpecificity(b.path) - noticeSpecificity(a.path));
}
