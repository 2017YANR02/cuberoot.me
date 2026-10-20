# CubeRoot 工作台

入口 `/workspace`，中文 `/zh/workspace`。直接由 CubeRoot 承载，原跳转到 Mira 的规则已移除。

- 登录：既有 CubeRoot 账号与会话。管理员自动获得员工身份，直接记录本人工作并保留管理能力；其他员工由管理员按 CubeRoot ID 开通。管理员只可查看本人草稿及历史修订。
- 数据：CubeRoot PostgreSQL 的 `workspace_*` 表，迁移 `0281_workspace.sql`。Mira 使用自己的身份、会话和 SQLite；没有跨应用成员同步、令牌传递或数据库连接。
- 界面：两个应用共同消费 `@app-foundation/workspace-ui` 的布局、登录外壳、项目、报告、讨论与历史；各自注入传输、路由、品牌、主题和控件。
- 规则：使用已发布的 `workspace-policy@0.1.0`（Foundation v0.6.0）。UI 0.1.0 已发布于 Foundation v0.7.0，两站固定 release URL 与锁文件完整性。
- 权限：员工状态与项目资格每次请求重查；草稿和历史版本仅作者可见；共享报告按成员资格过滤后分页；项目归档后可读但不能写；管理员开通员工和管理项目。
- 审计：所有成员、项目、报告和评论写入审计；版本冲突拒绝覆盖。评论重试按 ID 幂等。身份预览会话不用于员工操作。

管理员在本站开通员工权限；Mira 与 CubeRoot 分别部署、分别验收。

隔离数据库验证（显式指向一次性 PostgreSQL，测试不会读取应用 DB 配置）：

```sh
cd core
WORKSPACE_TEST_DATABASE_URL=postgres://USER@127.0.0.1:PORT/postgres pnpm --filter @cuberoot/server exec vitest run tests/workspace.test.ts
pnpm --filter @cuberoot/server exec vitest run tests/workspace-http.test.ts
```

本地验证：API 与前端类型检查通过；一次性 PostgreSQL 及 HTTP 身份边界共 9 项检查通过，包含既有 WCA 管理员及账号注销；注销覆盖率与 schema/API 文档漂移共 47 项通过，路由、目录和 metadata 共 18 项通过。共享包隔离安装及 CJS/ESM/TypeScript 消费通过。

账号注销由 `0282_workspace_account_deletion.sql` 在同一事务清理私人草稿与历史修订、撤销项目资格并匿名化成员/评论；已提交团队记录保留，账号外键置空。日常停用仍保留历史，不等于账号注销。

## 2026-10-19 生产验收

- App Foundation [v0.7.0](https://github.com/2017YANR02/app-foundation/releases/tag/v0.7.0) 已发布；UI 包 SHA-256 为 `5ecdfda61a82c6490a8e4fdfafdbcb544b5a747ba8ab8a1378532165dc5365a0`。
- Mira 应用 `23af9031` 经 [CI 与生产部署](https://github.com/2017YANR02/mira.fans/actions/runs/39354119968) 成功上线，服务 active，活动目录与提交匹配。
- 使用生产临时身份验证两站登录、草稿保存、提交读取、评论重试幂等、草稿隔离及权限撤销。相同邮箱使用独立密码，跨站密码、会话和记录访问均被拒绝，停用仅影响所属应用。验证账号、会话及业务数据已清理，审计保留。
- 两站 /workspace 页面与 API 健康接口均返回 200；未执行真实员工操作、付费 AI 调用、实际报销付款或视觉验收。
- CubeRoot 最终功能提交 `533753580b2c85df9c17657154598daa296bdd7e`；[自有前端部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/39355684592) 与 Vercel 均成功。线上 API 活动目录已匹配该版本，0282 触发器及账号可空外键已回读确认。
- [最新主线检查](https://github.com/2017YANR02/cuberoot.me/actions/runs/39355899880) 的类型检查、后端检查及前端第1分片通过；第2分片唯一失败为比赛城市 Domažlice 缺中文译名（`city-localize-cn-coverage.test.ts`），没有跳过或放宽断言。工作台注销覆盖率失败已修复；不能把全仓 CI 标记为全绿。
- [最终 API 部署 39355684610](https://github.com/2017YANR02/cuberoot.me/actions/runs/39355684610) 已成功完成，生产求解服务 ready=true，最终版本保持启用，无回滚。

管理员自动权限：`0284_workspace_admin_access.sql` 记录独立的 `admin_access`，服务端用既有数据库管理员与共享 WCA 管理员清单自动同步全部管理员，复用现有成员 ID。显式员工授权的 `active/role` 独立保留；移除管理员资格即撤销派生权限，原本有显式授权的成员仍可作为员工使用。成员页将管理员标注为自动开通；管理员个人记录使用员工 ID，管理审计继续使用管理员身份。
