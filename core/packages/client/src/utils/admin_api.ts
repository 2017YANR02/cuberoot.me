// 共用 admin API helper:从 localStorage 取 WCA token + 标准 fetch 错误处理.
// 被 alg_sets_api / wiki_api / ops_api 等所有"public GET + admin write"型路由 client 模块复用.
// server 端 requireAdminOrApiKey 同时接受 WCA OAuth Bearer (ADMIN_WCA_IDS) 或 X-Admin-Key.

function getToken(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

// 默认带 Content-Type: application/json;GET / DELETE 等无 body 路径传 false 跳过。
export function authHeaders(json = true): HeadersInit {
  const token = getToken();
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function handleApi<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `API error ${r.status}`);
  }
  return r.json();
}
