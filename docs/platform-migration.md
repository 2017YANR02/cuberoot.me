# Cube Platform 迁移跟踪

最后更新:2026-08-22

状态:Platform 迁移已经全部完成,独立前端已退役。本文保留导入证据和历史边界;旧源码、SQLite 与 uploads 继续作为离线档案保留。

## 目标

把原独立平台完整纳入 `cuberoot.me` 主仓库,先以 `core/packages/platform` 完整保存源码与历史,再把仍需要的教学管理能力迁入主站。旧本地目录和旧 GitHub 仓库最终可由仓库所有者删除,但删除前必须满足本文的切换门槛。

这次迁移解决代码、Git 历史、workspace、CI、构建和部署归属。生产数据库、上传文件、运行时环境变量与 GitHub secrets 都是仓库外状态,不会因为代码迁移自动搬家。

最终前端架构已经确定:不保留独立 Platform 前端。`core/packages/client` 的 `/org/*` 是教职员工工作台,`/learn/*` 是学员 / 监护人入口,`packages/platform` 仅作为迁移来源与历史兼容。详细顺序和验收门槛见[教学平台前端统一计划](./platform-unification-plan.md)。

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
- 迁入时 workflow 曾归位到 `/.github/workflows/deploy_platform.yml`,退役时删除。
- 迁入时 systemd unit 曾归位到 `/ops/systemd/platform-next.service`,退役时删除并停用线上服务。
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
- 迁入阶段曾有独立 Platform test/deploy workflow;退役后两者已删除,归档源码不再自动构建或上线。
- 生产鉴权不再接受默认管理员密码或默认 session secret;systemd 从 `/etc/cube-platform.env` 读取必填值。

## 现有能力与教学系统边界

迁入代码已经有用户登录、课程 / 章节、学习进度、订单、会员、讲师入驻与后台、支付、内容、社群、上传和运营日志。多机构教学 SaaS 的 Stage 0 底座、Stage 1 CRM 基础、Stage 2 履约 MVP、Stage 3 训练闭环和 Stage 4 教师课后反馈 / 周报切片均已进入主仓实现。最终产品边界已经确定为主站 `packages/client` 唯一教学前端,不再为 Platform 补一套训练管理页面:

- `shared` 已定义机构角色、权限、状态和错误契约;Stage 3A 已收口去客户端身份字段的证据输入、可信等级、严格 registry / JSON / 时间边界和训练 Foundation DTO,并通过独立 TypeScript 契约检查。
- PostgreSQL `0142` 至 `0146` 已建立机构、成员、学员、监护人、审计、幂等、平台账号桥接、独立写入尝试限流与学员分页索引。
- Core 已有短时 HMAC 身份断言、重放保护、机构 API、角色校验、失败尝试也计数的写入限流和跨机构拒绝审计。
- Platform 曾提供受登录保护的 `/org` 机构工作台;对应教学能力现已迁入主站,Platform 不再作为目标前端继续开发。
- PostgreSQL `0147`、`0148` 已加入课包商品、学员课包、排课、授课成员、出勤、只追加课时账本 / 课堂事件和最后 owner 并发保护；Core 与 Platform 已接通课包发放、余额流水、排课、出勤、完课消课和课堂历史。
- PostgreSQL `0149` 与 Core / Platform 已加入校区、班级、多班分组、班级或个人学员负责人和半开有效期；teacher/assistant 的校区、班级与学员读取按 active 长期指派收窄,课堂事实仍由 `session_teachers` 独立记录。
- PostgreSQL `0150` 与 shared 已加入版本化训练模板、任务/目标、带班级展开来源的学员快照、证据/任务关联、批改、日聚合和一次性学员账号绑定模型。
- Core 已加入账号绑定邀请的创建、查看、撤销、预览与确认接口,学员自助任务 / 证据接口,以及训练模板、版本、任务、发布、关闭、目标证据与批改接口。身份、机构、学员和证据可信等级均由服务端派生,客户端不能指定。
- 主站 `/timer`、`/predict` 与 `alg-trainer` 已加入受任务参数约束的证据适配器和本地重试队列;普通访问不生成或上传训练证据,所有当前浏览器证据仍明确标记为 `self_reported`。`/sim` 暂时只作为主站工具链接,不伪装成已验证证据源。
- Platform 已把训练入口统一为主站真链接,并退役重复的 timer 历史展示、速度榜、timer 徽章与旧算法公开实现。按仓库所有者最新决定,旧 Platform SQLite 计时历史不迁入新训练证据系统;原表和 migration 只为兼容保留,不删除运行态数据。
- 主站 `/org/*` 已接入账号绑定、训练模板、任务发布、训练日历、证据、批改、课包、课次、教师课后反馈、周报和学员消息;`/learn/*` 已接入学员 / 监护人上下文、已发布周报与反馈、消息会话和通知深链。Platform 不再承担这些界面。
- Stage 1 尚缺监护人管理工作台、批量导入、远程搜索选择器和完整权限工作台；当前不能视为完整 CRM 验收通过。
- OTP 已改为持久限流、加密随机码和生产短信 fail-closed。

后续能力统一在主站 `/org/*` 与 `/learn/*` 产品边界内补齐:

1. 补齐监护人管理、批量导入、远程搜索和完整角色权限工作台。
2. 补齐课包支付接单、退款 / 撤销反向流水、到期执行与异常对账。
3. 补齐请假、补课、调课规则和更完整的课堂状态流转。
4. 完成账号绑定、任务、反馈、周报、通知和家校沟通的真实多角色端到端验收。
5. 补齐经营报表、审计检索、导出、备份恢复演练与长期运维观察。

`packages/client` 同时负责公开训练工具与最终教学管理界面,只消费 shared/Core 契约,不复制 timer、predict、alg 或 sim 引擎。旧 Platform 内容/商城与 SQLite 已离线归档;新多租户教学交易域不再写入 SQLite,按[多机构教学 SaaS 设计](./teaching-saas-plan.md)在 Hono/PostgreSQL 落 schema 与权限边界。

## 阶段性实施记录

以下提交记录用于追溯 Stage 3 的主要落点;当前发布状态以 Git 远端和工作流结果为准:

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
- [x] 主站训练管理页面已实现账号绑定、任务发布、训练日历、证据查看和批改,不再建设第二套 Platform 教学前端。
- [x] 主站已实现学员 / 监护人学习入口、已发布反馈 / 周报读取、站内通知和家校消息页面,并与 Core `0154` 至 `0158` 契约对齐。

## 独立前端退役记录

- 主站首页和账号页提供 `/org` 与 `/learn` 真链接,两种语言继续由主站路由处理。
- `platform.cuberoot.me` 的 HTTP 与 HTTPS vhost 统一返回 410,不提供页面,也不跳转。
- 独立 Platform test/deploy workflow 和仓库内 systemd unit 已删除;Web 运维部署会停用旧服务并验证 `:3004` 不再监听。
- 旧 SQLite、uploads、migration 与源码继续保留,不迁移计时历史,也不再接受线上写入。

Stage 0 至 Stage 4 的详细设计和验证边界记录在[多机构教学 SaaS 设计](./teaching-saas-plan.md)。`0147` 至 `0150` 的结构、约束与关键并发夹具已在隔离 PostgreSQL 验证;`0154` 至 `0158` 已补齐课后反馈、周报、学习门户、监护人绑定与家校会话,其中会话夹具覆盖同键回放、20 路并发连续序号、单调已读游标、权限撤销与账号删除竞争、通知去重和 append-only 约束。真实多角色授权、跨租户拒绝、课包并发和备份恢复继续属于主站的持续性生产验收,不再阻塞独立 Platform 前端退役。历史 migration 链依赖旧生产基线,恢复仍以已验证备份为准。

## 删除旧本地目录与旧 GitHub 仓库前的门槛

以下项目全部完成后,旧本地目录与旧 GitHub 仓库可由仓库所有者删除:

1. 主仓远端仍可达原 subtree 父提交,并保留完整 `core/packages/platform` 归档源码。
2. 旧 SQLite、uploads 和非 Git 文件已备份或明确放弃,且需要保留的备份已验证可读。
3. 旧仓的 Actions 日志、settings、environments、branch rules、releases、artifacts、issues 与 PR 已按需导出。
4. 曾用于旧平台的凭据已经轮换或撤销;删除仓库不能替代凭据处置。
5. 退役发布工作流全部成功,旧域名只返回 410,旧服务与监听均已停止。
6. 观察窗口结束且确认不再需要从旧仓回滚。

删除旧 GitHub 仓库前尤其要先确认主仓远端提交与全部发布工作流成功;本地历史完整不等于远端已有备份。
