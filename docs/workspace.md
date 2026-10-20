# CubeRoot 工作台

入口 `/workspace`，中文 `/zh/workspace`。直接由 CubeRoot 承载，原跳转到 Mira 的规则已移除。

- 登录：既有 CubeRoot 账号与会话。管理员在成员页按 CubeRoot ID 开通、调整或停用员工权限。
- 数据：CubeRoot PostgreSQL 的 `workspace_*` 表，迁移 `0281_workspace.sql`。Mira 使用自己的身份、会话和 SQLite；没有跨应用成员同步、令牌传递或数据库连接。
- 界面：两个应用共同消费 `@app-foundation/workspace-ui` 的布局、登录外壳、项目、报告、讨论与历史；各自注入传输、路由、品牌、主题和控件。
- 规则：使用已发布的 `workspace-policy@0.1.0`（Foundation v0.6.0）。UI 0.1.0 已发布于 Foundation v0.7.0，两站固定 release URL 与锁文件完整性。
- 权限：员工状态与项目资格每次请求重查；草稿和历史版本仅作者可见；共享报告按成员资格过滤后分页；项目归档后可读但不能写；管理员开通员工和管理项目。
- 审计：所有成员、项目、报告和评论写入审计；版本冲突拒绝覆盖。评论重试按 ID 幂等。身份预览会话不用于员工操作。

用户已授权配套发布。按正常 migration runner 应用迁移后，由管理员开通员工权限；Mira 与 CubeRoot 分别部署、分别验收。最终上线结果见发布证据。

隔离数据库验证（显式指向一次性 PostgreSQL，测试不会读取应用 DB 配置）：

```sh
cd core
WORKSPACE_TEST_DATABASE_URL=postgres://USER@127.0.0.1:PORT/postgres pnpm --filter @cuberoot/server exec vitest run tests/workspace.test.ts
pnpm --filter @cuberoot/server exec vitest run tests/workspace-http.test.ts
```

本地验证：API 与前端类型检查通过；一次性 PostgreSQL 及 HTTP 身份边界共 7 项检查通过，路由、目录和 metadata 共 18 项检查通过。两个工作台入口均返回 HTTP 200。共享包隔离安装及 CJS/ESM/TypeScript 消费通过。真实员工操作、视觉及线上部署尚未验收。

账号注销由 `0282_workspace_account_deletion.sql` 在同一事务清理私人草稿与历史修订、撤销项目资格并匿名化成员/评论；已提交团队记录保留，账号外键置空。日常停用仍保留历史，不等于账号注销。
