---
name: admin-api-client
description: "Use when writing a new client-side API helper for any 'public GET + admin write' Hono route (alg_sets / wiki / ops / nav_sites 模式). 强制从 utils/admin_api 复用 authHeaders + handleApi, 不要每个新 file 再 paste 一份 getToken/authHeaders/handle. Triggers: \"client api helper\", \"admin api\", \"authHeaders\", \"handleApi\", \"X-Admin-Key\", \"wiki_api\", \"alg_sets_api\", \"ops_api\", \"加新 api util\"."
---

# Admin API client (复用 helper)

凡是 server 有 `requireAdminOrApiKey` 的端点 (alg_sets / wiki / ops / nav_sites / ...),client 模块**禁止再写**这套 boilerplate:

```ts
// ❌ 别 paste 这种
function getToken() { return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token'); }
function authHeaders() { ...token Bearer header... }
async function handle<T>(r) { if (!r.ok) throw new Error(...); return r.json(); }
```

**正确做法**:从 `utils/admin_api.ts` import:

```ts
// utils/foo_api.ts (新模块)
import { API_ORIGIN } from '../utils/api_base';     // 或 apiUrl()
import { authHeaders, handleApi } from '../utils/admin_api';

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

- `utils/wiki_api.ts` — wiki terms / additions
- `utils/alg_sets_api.ts` — alg_cases CRUD
- `pages/code/ops_api.ts` — /code/ops runbook 命令

## isAdmin 检测 (page 端控制 UI 显隐)

```ts
import { useAuthStore, ADMIN_WCA_IDS } from '../stores/auth_store';
const user = useAuthStore((s) => s.user);
const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
```

server 端的 `requireAdminOrApiKey` 同时接受:
- WCA OAuth Bearer (用户在 ADMIN_WCA_IDS 名单)
- `X-Admin-Key` header (脚本 / curl / AI 自动化,key 见 `.password.md`)

client 走 Bearer (browser 登录态);AI / 脚本走 X-Admin-Key (见 `alg-admin-api` skill)。
