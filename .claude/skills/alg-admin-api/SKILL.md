---
name: alg-admin-api
description: "Use when AI/脚本管理 alg DB (create/update/del/reorder/batch-validate/dedup) 免 OAuth。X-Admin-Key 通道 + 4 个 admin endpoints + 直 SQL playbook。Triggers: \"alg admin\", \"X-Admin-Key\", \"reorder cases\", \"del alg case\", \"alg dup\", \"批量校验 alg\", \"AdminCaseEditor\", \"alg_cases SQL\"."
---

# Alg DB admin operations

DB 表 `alg_cases` / `alg_sets` 是公式库 source of truth。普通用户提交的"我的算法"在 `alg_submissions`(另一套,不在这里管)。

## 鉴权两条通道

| 通道 | 谁用 | 怎么用 |
|---|---|---|
| WCA OAuth + `ADMIN_WCA_IDS` | 浏览器 admin 用户 | 走 `requireAuth` + `ADMIN_WCA_IDS` 检查 |
| `X-Admin-Key` header | AI / 脚本 / curl | 走 `requireAdminOrApiKey`,匹配 server `.env` 的 `ADMIN_API_KEY` 即视为 admin |

helper:`packages/server/src/utils/recon_helpers.ts` 的 `requireAdminOrApiKey(c)`。仅 `routes/alg_sets.ts` 4 个 admin 端点用此 helper(create/update/delete case + reorder)。

key 在 **`.password.md`**(本地 gitignored) + 云 `/root/core-api/.env`。AI 自己读:

```bash
KEY=$(grep -oP 'ADMIN_API_KEY\*\* \| `\K[^`]+' D:/cube/ruiminyan.github.io/.password.md)
```

**别在对话明文打 key**,用 `$KEY`。

## 4 个 admin 端点

base = `https://api.cuberoot.me/v1/alg/sets`(prod)。

| 操作 | 方法 | 路径 | body |
|---|---|---|---|
| 新增 case | POST | `/:p/:s/cases` | `{ caseName, subgroup, setup, standard, sticker, algs, oriNames?, trainerKey? }` |
| 修改 case | PUT | `/:p/:s/cases/:id` | 同上 |
| 删 case | DELETE | `/:p/:s/cases/:id` | — |
| 重排 case 顺序 | PUT | `/:p/:s/reorder` | `{ ids: number[] }` —— 必须该 set 全部 case id 的新顺序,server 重写 position=0..N-1 |

注意 **reorder 路径是 `/reorder` 而非 `/cases/order`**(后者会被 `/cases/:id` 路由捕获,id="order"→NaN→400 invalid id)。

### 调用范例

```bash
# 删 case
curl -X DELETE -H "X-Admin-Key: $KEY" \
  https://api.cuberoot.me/v1/alg/sets/3x3/zbls/cases/6051

# 重排(必须传该 set 全部 case id)
curl -X PUT -H "X-Admin-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"ids":[6049,6053,6055,...]}' \
  https://api.cuberoot.me/v1/alg/sets/3x3/zbls/reorder
```

## 常见数据治理操作(直查 PG)

走 server-deploy skill 的 SSH + `PGPASSWORD=314159 psql` 模式。

### 列同 (puzzle, set_slug, subgroup, name) 的 dup case

```sql
SELECT puzzle, set_slug, subgroup, name, COUNT(*) cnt, array_agg(id ORDER BY id) ids
FROM alg_cases
GROUP BY puzzle, set_slug, subgroup, name
HAVING COUNT(*) > 1
ORDER BY puzzle, set_slug, subgroup, name;
```

### 删 dup,保留每组最小 id

```sql
DELETE FROM alg_cases a
USING (
  SELECT puzzle, set_slug, subgroup, name, MIN(id) AS keep_id
  FROM alg_cases
  GROUP BY puzzle, set_slug, subgroup, name
  HAVING COUNT(*) > 1
) d
WHERE a.puzzle = d.puzzle
  AND a.set_slug = d.set_slug
  AND a.subgroup = d.subgroup
  AND a.name = d.name
  AND a.id > d.keep_id
RETURNING a.id, a.puzzle, a.set_slug, a.subgroup, a.name;
```

(2026-05-07 跑过一次,删了 44 条 dup。)

## Cache 注意

- GET `/api/alg/sets/:p/:s` 设了 `Cache-Control: max-age=3600`(1 小时浏览器缓存)
- admin 改完后:**普通用户最多 1h 后才看到新版**;admin 自己 (`isAdmin=true`) 走 `loadAlg(p, s, { fresh: true })` 已绕开
- 如果 admin 看到 "Not found" 删失败,常因为 client 列表是陈旧 cache 指着已被删的 id —— hard refresh 解决

## 校验工具

`utils/alg_validation.ts` 的 `validateAlgCase(setup, alg, sticker, puzzle)`:对 8 种 puzzle 跑 cubing.js 模拟 setup+alg,检查是否真的还原。AdminCaseEditor 保存前会跑;`ValidationReportModal` 提供"校验全库 / 校验当前 set"批量入口(set 详情页 + alg index 页 admin 按钮)。

LL 类(`sticker.kind in {'face','f2l'}`)还会拒绝公式末尾 U-family move(多余 AUF)。

## 前端组件

| 组件 | 位置 | 用途 |
|---|---|---|
| AdminCaseEditor | `pages/alg/AdminCaseEditor.tsx` | 弹层编辑 case;保存前跑 validateAlgCase |
| AlgEditor | `pages/alg/AlgEditor.tsx` | 多 contenteditable 公式行 + 共享虚拟键盘 + 实时 player 预览 |
| ValidationReportModal | `pages/alg/ValidationReportModal.tsx` | 全库/单 set 校验报告,失败项可点击跳到 case editor 修 |
| AlgInput | `components/AlgInput/` | 统一 alg 输入框(textarea or contenteditable),含 autoSpace |

## Rotate ADMIN_API_KEY

```bash
NEWKEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
ssh root@cuberoot "sed -i 's|^ADMIN_API_KEY=.*|ADMIN_API_KEY=$NEWKEY|' /root/core-api/.env && pm2 restart core-api"
# 然后手动改本地 .password.md
```
