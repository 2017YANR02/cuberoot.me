# Recon 复盘系统

## 数据流

```
Hono API 后端（api.cuberoot.me/v1/recon/）
    │  PostgreSQL 13 cuberoot_db.recons（全量数据，SERIAL ID）
    │  PostgreSQL 13 cuberoot_db.edits（编辑覆盖层，JSONB 字段）
    │  PostgreSQL 13 cuberoot_db.edit_history（编辑历史记录）
    ↓
React SPA（/recon 路由，Zustand 状态管理）
    ↓ 中文模式时
comp_names_zh.json（英文→中文比赛名映射，CI 每日更新）
```

## API 接口

基址：`https://api.cuberoot.me/v1/recon/`（Hono RESTful）

| Action | 方法 | 权限 | 说明 |
|--------|------|------|------|
| `list` | GET | 公开 | 全部复盘（可按 `wcaId` 筛选） |
| `/:id` | GET | 公开 | 单条复盘（含编辑覆盖合并） |
| `/` | POST | 登录 | 添加复盘 |
| `/:id` | PUT | 登录 | 更新复盘字段 |
| `/:id` | DELETE | 本人/管理员 | 删除复盘 |
| `/edits` | GET | 公开 | 所有编辑覆盖 |
| `/save-edit` | POST | 管理员 | 保存编辑覆盖层 |
| `/edit/:id` | DELETE | 管理员 | 删除编辑覆盖 |
| `/save-history` | POST | 管理员 | 保存编辑历史 |
| `/history` | GET | 公开 | 指定复盘的编辑历史 |
| `/check-duplicate` | GET | 公开 | 重复检测 |
| `/search-solvers` | GET | 公开 | WCA API 代理搜索选手 |
| `/list-persons` | GET | 公开 | 数据库中有 WCA ID 的选手 |
| `/user-stats` | GET | 公开 | 用户统计 |
| `/wca-attempts` | GET | 公开 | WCA API 代理同轮次成绩 |
| `/bili-cover` | GET | 公开 | Bilibili 封面代理 |
| `/comments` | GET/POST | 公开/登录 | 评论列表/添加评论 |
| `/comments/:id` | PUT/DELETE | 本人/管理员 | 更新/删除评论 |

> 响应已启用 gzip（~2.3MB → ~300KB）。写操作有速率限制（30 次/分钟）。

## 数据库列重命名

通过 `index.php` 的临时管理员端点 `renameColumns2` 执行：

```javascript
// 在已登录的 Recon 页面控制台执行
fetch('https://api.cuberoot.me/v1/recon/renameColumns2', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + WcaAuth.getAccessToken() }
}).then(r => r.json()).then(console.log)
```

> Token 有效期约 2 小时，获取：`console.log(localStorage.getItem('wca_access_token'))`

## Record Badge 颜色规则

| 颜色 | 含义 | 匹配规则 |
|------|------|----------|
| 🔴 红色 | 世界纪录（WR, FWR, WB, YTWR 等） | `^[FXU]?W[RB]$\|^1STWR$\|^RWR$\|^YTW[RB]$\|^XWR$` |
| 🔶 橙色 | 世界冠军赛纪录（WCR） | `WCR` |
| 🟡 黄色 | 洲际纪录（AsR, ER, CR 等） | `(?:AS\|E)[RB]$\|^(?:SAR\|SAB\|NAR\|...)$` |
| 🟢 绿色 | 国家纪录（NR, FNR, NB 等） | `^[FXU]?N[RB]$\|^NWR$\|^ANR$\|^YTN[RB]$` |
| 🔵 蓝色 | 个人纪录（PR, PB 等） | `endsWith('PR'\|'PB')` |
| ⚪ 灰色 | 其他 | 默认 |

- 前缀 `F` = 女子纪录，颜色同上
- `B` = Best，与 `R` = Record 同色
