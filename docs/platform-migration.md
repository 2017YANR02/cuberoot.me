# Cube Platform 迁移跟踪

最后更新:2026-08-18

## 目标

把原独立平台完整纳入 `cuberoot.me` 主仓库,以 `core/packages/platform` 作为唯一源码。旧本地目录和旧 GitHub 仓库最终可由仓库所有者删除,但删除前必须满足本文的切换门槛。

这次迁移解决代码、Git 历史、workspace、CI、构建和部署归属。生产数据库、上传文件、运行时环境变量与 GitHub secrets 都是仓库外状态,不会因为代码迁移自动搬家。

## Git 证据

| 项目 | 值 |
| --- | --- |
| 主仓迁移前基线 | `891383b65cda135577d38efd4d47ac11f095e435` |
| 旧仓本地 `main` | `1a333326c304d5bc2dca90a31d5eedf0c5f4a778` |
| 旧仓当时 `origin/main` | `f555dca25ed54881a79434d87cd28fed0153d0ff` |
| 历史导入提交 | `6599c7af027b62e0d85e38d150c1279cc9d06391` |
| Monorepo 适配提交 | `3e8414f41f4cdf7c51d8747144cf3ba21a4fd26e` |
| 合入当前 `main` | `6b7092edef5450c36971e82b69220429d7734bf6` |
| 导入方式 | two-parent `git subtree add --prefix=core/packages/platform` |

旧仓本地 `main` 比其远端多 1 个提交,所以导入明确取本地 SHA,没有只复制远端或 squash。导入提交的第二父提交就是旧仓本地 `main`,旧仓 92 个提交因此仍可从主仓追溯。

## 内容守恒

旧仓共有 398 个 tracked 文件、12,211,330 bytes。两轮只读盘点将它们完整分类,未发现未分类文件或 tracked symlink。

- 应用主体和包级配置迁入 `core/packages/platform`。
- workflow 归位到 `/.github/workflows/deploy_platform.yml`。
- systemd unit 归位到 `/ops/systemd/platform-next.service`。
- 独立仓库的 `pnpm-lock.yaml`、`pnpm-workspace.yaml` 被主仓 `core/` 单一 lockfile/workspace 取代。
- SQLite 原有 33 个 migration 与 journal 原样迁入;Stage 0 新增 `0033` 验证码限流 migration,当前共 34 个,始终不与 Hono/PostgreSQL migrations 混合。

明确未迁入:

- `.git`、`node_modules`、`.next`、`.tmp`、tsbuildinfo 与浏览器调试缓存。
- `.password.md` 和任何真实凭据。
- 本地 `data.db`、WAL、SHM。它们是可能含用户数据的运行状态。
- 旧仓未跟踪的 `qr-layout.png`。
- `.tmp` 内的商业计划书、截图和调试产物。

## Monorepo 适配

- workspace 名称改为 `@cuberoot/platform`,根脚本提供 dev/build/typecheck/test 入口。
- 根 workspace 允许构建 `better-sqlite3`;依赖统一进入 `core/pnpm-lock.yaml`。
- Next standalone tracing root 改为 `core/`,workflow 动态定位 monorepo 的 `server.js`。
- Docker 改用 `core/` 构建上下文、pnpm 11、Node 24 和根 lockfile。
- 后续只改 `packages/platform/**` 不再触发 Hono 后端 deploy;平台有独立 test 和 deploy workflow。首次推送迁移提交仍会因为共享 package/lock/workspace 与 workflow 本身发生变化,同时触发平台、主站和后端工作流,必须一起观察。
- 生产鉴权不再接受默认管理员密码或默认 session secret;systemd 从 `/etc/cube-platform.env` 读取必填值。

## 现有能力与教学系统边界

迁入代码已经有用户登录、课程 / 章节、学习进度、订单、会员、讲师入驻与后台、支付、内容、社群、上传和运营日志。多机构教学 SaaS 的 Stage 0 底座、Stage 1 CRM 基础与 Stage 2 履约 MVP 也已进入主仓本地实现;Stage 3A Foundation、Stage 3B 学员自助证据接口、Stage 3C 教师任务接口和主站训练工具上报适配器均已在本地完成,但 Platform 训练管理页面与完整端到端验收尚未完成:

- `shared` 已定义机构角色、权限、状态和错误契约;Stage 3A 已收口去客户端身份字段的证据输入、可信等级、严格 registry / JSON / 时间边界和训练 Foundation DTO,并通过独立 TypeScript 契约检查。
- PostgreSQL `0142` 至 `0146` 已建立机构、成员、学员、监护人、审计、幂等、平台账号桥接、独立写入尝试限流与学员分页索引。
- Core 已有短时 HMAC 身份断言、重放保护、机构 API、角色校验、失败尝试也计数的写入限流和跨机构拒绝审计。
- Platform 已有受登录保护的 `/org` 机构选择、机构工作台、按权限裁剪的概览、成员 / 学员分页与学员建档。
- PostgreSQL `0147`、`0148` 已加入课包商品、学员课包、排课、授课成员、出勤、只追加课时账本 / 课堂事件和最后 owner 并发保护；Core 与 Platform 已接通课包发放、余额流水、排课、出勤、完课消课和课堂历史。
- PostgreSQL `0149` 与 Core / Platform 已加入校区、班级、多班分组、班级或个人学员负责人和半开有效期；teacher/assistant 的校区、班级与学员读取按 active 长期指派收窄,课堂事实仍由 `session_teachers` 独立记录。
- PostgreSQL `0150` 与 shared 已加入版本化训练模板、任务/目标、带班级展开来源的学员快照、证据/任务关联、批改、日聚合和一次性学员账号绑定模型。
- Core 已加入账号绑定邀请的创建、查看、撤销、预览与确认接口,学员自助任务 / 证据接口,以及训练模板、版本、任务、发布、关闭、目标证据与批改接口。身份、机构、学员和证据可信等级均由服务端派生,客户端不能指定。
- 主站 `/timer`、`/predict` 与 `alg-trainer` 已加入受任务参数约束的证据适配器和本地重试队列;普通访问不生成或上传训练证据,所有当前浏览器证据仍明确标记为 `self_reported`。`/sim` 暂时只作为主站工具链接,不伪装成已验证证据源。
- Platform 已把训练入口统一为主站真链接,并退役重复的 timer 历史展示、速度榜、timer 徽章与旧算法公开实现。按仓库所有者最新决定,旧 Platform SQLite 计时历史不迁入新训练证据系统;原表和 migration 只为兼容保留,不删除运行态数据。
- Platform 尚缺训练模板、任务发布、训练日历、学员证据、批改和账号绑定工作台。现阶段已有 Core 能力与主站生产者,但还不能称为教师端训练产品闭环。
- Stage 1 尚缺监护人管理工作台、批量导入、远程搜索选择器和完整权限工作台；当前不能视为完整 CRM 验收通过。
- OTP 已改为持久限流、加密随机码和生产短信 fail-closed。

这仍是完整系统的基础阶段,后续继续在同一 `@cuberoot/platform` 产品边界内补齐:

1. 补齐监护人管理、批量导入、远程搜索和完整角色权限工作台。
2. 补齐课包支付接单、退款 / 撤销反向流水、到期执行与异常对账。
3. 补齐请假、补课、调课规则和更完整的课堂状态流转。
4. 基于已完成的 Stage 3 Core API 与主站生产者,补 Platform 账号绑定、任务发布、训练日历、证据和批改页面,再完成多角色端到端验收。
5. 每周课堂反馈、阶段报告、站内通知和有审计记录的家校沟通。

`packages/client` 继续负责主站公开训练工具;Platform 只消费 shared/Core 契约并链接主站,不复制 timer、predict、alg 或 sim 引擎。现有内容/商城在切换前继续使用独立 SQLite;新多租户教学交易域不再堆入 SQLite,按[多机构教学 SaaS 设计](./teaching-saas-plan.md)在 Hono/PostgreSQL 落新 schema 与权限边界,旧域是否迁移另开项目。

## 最新本地实施提交

以下提交均已进入当前本地历史,尚未 push:

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| Stage 3A | `1e204071fd` | 训练 Foundation schema 与共享契约 |
| Stage 3B | `d0b97e10d7` | 学员自助任务、证据与账号绑定流程 |
| Stage 3C | `eeb5569051` | 教师训练模板、任务、发布、证据与批改接口 |
| Platform 复用 | `ac08d065f6` | 训练入口改为复用主站工具 |
| Platform 收口 | `39300a9c52` | 退役旧计时历史相关展示与重复入口 |
| 主站生产者 | `7112ab4b83` | `/timer`、`/predict`、`alg-trainer` 作业证据上报适配 |

## 验证记录

- [x] 旧仓 tracked 清单两轮守恒审计:398/398,未分类 0。
- [x] 旧仓 `git fsck --full`:无损坏,仅 1 个无关 dangling blob。
- [x] 源 SHA 作为 subtree 第二父提交进入主仓。
- [x] 根 lockfile 已生成;`pnpm install --frozen-lockfile` 通过,补齐缓存后 offline frozen install 也通过。
- [x] `platform` typecheck 通过;迁移基线的平台范围 Knip 通过。
- [x] 全仓 Knip 也执行过;仅报告两个迁移前已存在且本次未修改的文件:`packages/client/components/persons/sections/PersonTeachers.tsx`、`packages/miniprogram/scripts/release-check-lib.d.mts`。
- [x] Platform SQLite 空库 migrate、seed 和生产 build 通过;Next 16.2.6 以 14 workers 生成 96 个页面。
- [x] standalone 入口确认在 `.next/standalone/packages/platform/server.js`;部署迁移器对副本返回 `up to date`。
- [x] 本地 standalone HTTP smoke:首页 200、`/timer` 200、`/admin` 307 到登录页。
- [x] 两个 deploy workflow 和一个 platform test workflow 通过 YAML 1.2 解析,所有 `run` 脚本通过 Bash 语法检查;`docker compose config --quiet` 通过。
- [x] Docker ignore 已显式重新包含 `patches/`、`packages/`、`packages/shared/` 与 `packages/platform/` 父目录,避免白名单子路径被父目录排除;构建顺序先生成 shared 输出。
- [ ] Docker 镜像构建:本机 Docker daemon 未运行,只验证了 Compose 配置。
- [x] 独立 agent 已完成两轮迁移后复审;历史 / 文件守恒通过,发现的删除门槛、首次部署、SQLite 回滚边界和 Docker context 问题已在本次适配中修正或明确标为未验证。
- [x] Stage 3A Foundation 在升级库与最终 schema 库完成 PostgreSQL 18 结构、约束和并发夹具验证。
- [x] Stage 3B / 3C Core routes 通过类型检查、定向测试与关键 PostgreSQL 18 并发夹具;账号绑定、自然幂等、跨租户拒绝审计、发布快照和批改 revision 均有实证。
- [x] 主站训练证据适配器通过客户端类型检查与定向测试;普通访问不创建训练事件,任务访问复用稳定事件 ID 和本地重试队列。
- [x] Platform 训练入口改为主站真链接,重复 timer / alg 公开功能与旧计时历史展示已退役;Platform 类型检查和定向测试通过。
- [ ] Platform 训练管理页面与登录态端到端 smoke:账号绑定、任务发布、训练日历、证据查看和批改尚未实现。
- [ ] 迁移提交推送到主仓远端。
- [ ] 新仓 GitHub Actions 首次成功部署并完成线上 smoke test。

Stage 0、Stage 1 CRM 基础、Stage 2 与 Stage 3 的详细设计和验证边界记录在[多机构教学 SaaS 设计](./teaching-saas-plan.md)。从 Stage 0 parent snapshot 顺序应用 `0147`、`0148` 已得到 7 张 Stage 2 表和 4 个 owner triggers,双 owner 并发与审计匿名化也已实测；从 Stage 2 最终结构升级 `0149` 与直接加载最终 schema 的两套隔离 PG18 验证均通过。`0150` 也已在全新的升级库与最终 schema 库中加载并取得一致语义目录,真实并发夹具覆盖发布与分班变更双向竞争、班级展开目标的缺失 / 多余拒绝、直接学员与多班重复命中的正确发布、证据 / 账号删除锁序、自然幂等、批改 revision 和日聚合。Stage 3 HTTP routes 与主站生产者已经存在,但 Platform 训练 UI、完整账号绑定 UX、真实多角色浏览器流程和线上 smoke 尚未完成,不能把后端与适配器测试写成训练产品已经上线。其余课包业务并发夹具、Docker image build、线上 migration 与登录态 smoke 仍是上线前未验证项,不能用 mock 单测替代。历史 migration 链依赖旧生产基线,不具备绝对空库全量重放能力,恢复仍以已验证备份为准。

## 删除旧本地目录与旧 GitHub 仓库前的门槛

以下项目必须全部完成;删除动作由仓库所有者亲自执行:

1. 迁移提交已推送,并在主仓远端验证 `1a333326...` 可达、`core/packages/platform` 文件完整。
2. 主仓已配置 `PLATFORM_DEPLOY_HOST`、`PLATFORM_DEPLOY_USER`、`PLATFORM_DEPLOY_SSH_KEY`。GitHub 不允许导出旧 secrets,必须重新配置。
3. 按当前 workflow 权限模型,`PLATFORM_DEPLOY_USER` 必须是 root;其 NVM 下必须安装 Node 24。workflow 固定选择 `/root/.nvm/versions/node/v24.*`,与 CI 编译 `better-sqlite3` 的 ABI 保持一致。未来若改普通部署账号,需同时重写目录权限、systemd 管理方式与 Node 路径。
4. 服务器 `/etc/cube-platform.env` 已配置新的强随机 `ADMIN_PASSWORD`、`SESSION_SECRET`,旧默认凭据已失效;生产 `SMS_PROVIDER` 是真实短信通道且所需变量齐全。
5. Core 与 Platform 运行环境已配置同一个新生成的 64 位十六进制 `TEACHING_PLATFORM_SECRET`;先部署 Core 的 `0142` 至 `0150`、shared 契约和 Stage 0 至 Stage 3 API,验证 migration 与 API 后再部署 Platform 和主站生产者。独立 workflow 没有可靠的跨 workflow 顺序保证,首次发布必须分次受控触发;双端都不得输出密钥。
6. 对生产 SQLite、uploads 与教学 PostgreSQL 做一致性备份,并实际验证备份可读。workflow 失败时会自动回滚代码包;迁移器用单个 SQLite transaction 防止半迁移,但已成功提交的 schema 不会随代码包反向回滚,数据库恢复必须使用已验证备份并评估期间新增写入。
7. 逐项处理旧本地目录中的非 Git 状态:`data.db`、`data.db-wal`、`data.db-shm`、`qr-layout.png`、`.tmp` 内商业文档 / 调试产物与 `.password.md`。每项必须先外部备份或明确确认放弃;凭据要迁入安全存储并轮换,不能复制进主仓。
8. 首次推送产生的平台、主站和后端 workflow 都成功;平台首页、登录、管理员、讲师、课程、订单、上传、数据库 migration 和教学 API 完成 smoke test。
9. 用登录账号实际完成机构创建 / 列表、成员查看、学员建档、校区 / 班级创建、分班、负责人指派、课包发放、排课、出勤与完课消课;再用两个机构夹具验证跨机构读取与写入均被拒绝且 `teaching_audit_events` 留下 `denied` 记录。Stage 3 routes 与主站 adapters 已落地,但仍须等 Platform 训练 UI 完成后实测账号绑定、任务发布、工具上报、证据查看和批改全流程。
10. 已确认代码包与数据库各自的失败恢复步骤,上一版本包和数据库备份都可用。
11. 在主仓 tracked 文件中搜索旧本地路径、旧 workflow / unit 路径和旧仓唯一依赖,结果为 0。
12. 已轮换曾进入 Git 历史的数据库凭据和教程外部账号凭据；删除旧仓库不能替代凭据轮换。
13. 已盘点旧 GitHub 仓库的 Actions run 日志、仓库 settings、environments、branch rules、releases / artifacts、issues / PR 等非 Git 元数据；需要保留的先导出,其余由仓库所有者明确确认放弃。
14. 再保留一个观察窗口;确认无回滚需要后,才删除旧本地目录和旧 GitHub 仓库。

删除旧 GitHub 仓库前尤其要先推送主仓。当前本地历史完整不等于远端已有备份。
