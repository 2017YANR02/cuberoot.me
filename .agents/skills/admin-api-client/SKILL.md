---
name: admin-api-client
description: "Use when adding a client API helper for a public-GET plus admin-write Hono route, especially requests mentioning admin API, X-Admin-Key, authHeaders, handleApi, or 新 API util. Reuse utils/admin_api instead of duplicating token and response handling."
---

# Admin API client (复用 helper)

凡是 server 有 `requireAdminOrApiKey` 的端点 (alg_sets / wiki / ops / nav_sites / ...),client 模块**禁止再写**这套 boilerplate:

```ts
// ❌ 别 paste 这种
function getToken() { return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token'); }
function authHeaders() { ...token Bearer header... }
async function handle<T>(r) { if (!r.ok) throw new Error(...); return r.json(); }
```

**正确做法**:从 `lib/admin-api.ts` import:

```ts
// lib/foo-api.ts (新模块)
import { API_ORIGIN } from '@/lib/api-base';     // 或 apiUrl()
import { authHeaders, handleApi } from '@/lib/admin-api';

const BASE = API_ORIGIN + '/v1/foo';

export async function listFoo<T>(): Promise<T[]> {
  return handleApi<T[]>(await fetch(BASE));
}
export async function createFoo<T>(body: unknown): Promise<T> {
  return handleApi<T>(await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }));
}
// 同 PUT / DELETE / reorder ...
```

## 用 helper 的现有模块 (参考)

- `lib/wiki-api.ts` — wiki terms / additions
- `lib/sponsors-api.ts` — sponsors CRUD
- `lib/ops-api.ts` — /dev/ops runbook 命令

## isAdmin 检测 (page 端控制 UI 显隐)

```ts
import { useIsAdmin } from '@/lib/auth-store';
const isAdmin = useIsAdmin();
```

需要用户信息时用 `useAuthUser()`；这两个 hook 保证服务端与浏览器首次渲染一致。不要在 render 中直接读 store、`isAdmin()` 或 `getAuthUser()`。登录等命令用 `authActions`，异步账号核对才用 `getAuthUser()`；完整契约见 [前端规范](../../../docs/contributing/frontend.md)。

server 端的 `requireAdminOrApiKey` 同时接受:
- WCA OAuth Bearer (用户在 ADMIN_WCA_IDS 名单)
- `X-Admin-Key` header (脚本 / curl / AI 自动化,key 见 `.password.md`)

client 走 Bearer (browser 登录态);AI / 脚本走 X-Admin-Key (见 `alg-admin-api` skill)。
