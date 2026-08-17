# Cube Platform 迁移跟踪

最后更新:2026-08-17

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

迁入代码已经有用户登录、课程 / 章节、学习进度、订单、会员、讲师入驻与后台、支付、内容、社群、上传和运营日志。多机构教学 SaaS 的 Stage 0 底座也已进入主仓工作树:

- `shared` 已定义机构角色、权限、状态、训练证据和错误契约。
- PostgreSQL `0142` 至 `0146` 已建立机构、成员、学员、监护人、审计、幂等、平台账号桥接、独立写入尝试限流与学员分页索引。
- Core 已有短时 HMAC 身份断言、重放保护、机构 API、角色校验、失败尝试也计数的写入限流和跨机构拒绝审计。
- Platform 已有受登录保护的 `/org` 机构选择、机构工作台、按权限裁剪的概览、成员 / 学员分页与学员建档。
- OTP 已改为持久限流、加密随机码和生产短信 fail-closed。

这仍是完整系统的基础阶段,后续继续在同一 `@cuberoot/platform` 产品边界内补齐:

1. 机构、校区、教师、学员、监护人与角色权限的多租户模型。
2. 课包购买、赠送 / 扣减 / 退款流水、剩余课时与到期规则。
3. 排课、签到、请假、补课、消课与不可篡改的上课历史。
4. 训练模板、个人任务、`/timer` / `/predict` 等训练证据、每日打卡和作业批改。
5. 每周课堂反馈、阶段报告、站内通知和有审计记录的家校沟通。

`packages/client` 继续负责主站公开训练工具;平台通过稳定契约复用训练结果,不要复制 timer/predict 引擎。现有内容/商城在切换前继续使用独立 SQLite;新多租户教学交易域不再堆入 SQLite,按[多机构教学 SaaS 设计](./teaching-saas-plan.md)在 Hono/PostgreSQL 落新 schema 与权限边界,旧域是否迁移另开项目。

## 验证记录

- [x] 旧仓 tracked 清单两轮守恒审计:398/398,未分类 0。
- [x] 旧仓 `git fsck --full`:无损坏,仅 1 个无关 dangling blob。
- [x] 源 SHA 作为 subtree 第二父提交进入主仓。
- [x] 根 lockfile 已生成;`pnpm install --frozen-lockfile` 通过,补齐缓存后 offline frozen install 也通过。
- [x] `platform` typecheck 通过;迁移基线的平台范围 Knip 通过。
- [x] 全仓 Knip 也执行过;仅报告两个迁移前已存在且本次未修改的文件:`packages/client/components/persons/sections/PersonTeachers.tsx`、`packages/miniprogram/scripts/release-check-lib.d.mts`。
- [x] 空库 migrate、seed 和生产 build 通过;Next 16.2.6 以 14 workers 生成 96 个页面。
- [x] standalone 入口确认在 `.next/standalone/packages/platform/server.js`;部署迁移器对副本返回 `up to date`。
- [x] 本地 standalone HTTP smoke:首页 200、`/timer` 200、`/admin` 307 到登录页。
- [x] 两个 deploy workflow 和一个 platform test workflow 通过 YAML 1.2 解析,所有 `run` 脚本通过 Bash 语法检查;`docker compose config --quiet` 通过。
- [x] Docker ignore 已显式重新包含 `patches/`、`packages/`、`packages/shared/` 与 `packages/platform/` 父目录,避免白名单子路径被父目录排除;构建顺序先生成 shared 输出。
- [ ] Docker 镜像构建:本机 Docker daemon 未运行,只验证了 Compose 配置。
- [x] 独立 agent 已完成两轮迁移后复审;历史 / 文件守恒通过,发现的删除门槛、首次部署、SQLite 回滚边界和 Docker context 问题已在本次适配中修正或明确标为未验证。
- [ ] 迁移提交推送到主仓远端。
- [ ] 新仓 GitHub Actions 首次成功部署并完成线上 smoke test。

Stage 0 的最新定向测试、类型检查和 YAML 解析证据记录在[多机构教学 SaaS 设计](./teaching-saas-plan.md)。本机 PostgreSQL 与 Docker daemon 当前未运行,所以真实 PG migration/repository 集成和 Docker image build 仍是明确的上线前未验证项,不能用 mock 单测替代。

## 删除旧本地目录与旧 GitHub 仓库前的门槛

以下项目必须全部完成;删除动作由仓库所有者亲自执行:

1. 迁移提交已推送,并在主仓远端验证 `1a333326...` 可达、`core/packages/platform` 文件完整。
2. 主仓已配置 `PLATFORM_DEPLOY_HOST`、`PLATFORM_DEPLOY_USER`、`PLATFORM_DEPLOY_SSH_KEY`。GitHub 不允许导出旧 secrets,必须重新配置。
3. 按当前 workflow 权限模型,`PLATFORM_DEPLOY_USER` 必须是 root;其 NVM 下必须安装 Node 24。workflow 固定选择 `/root/.nvm/versions/node/v24.*`,与 CI 编译 `better-sqlite3` 的 ABI 保持一致。未来若改普通部署账号,需同时重写目录权限、systemd 管理方式与 Node 路径。
4. 服务器 `/etc/cube-platform.env` 已配置新的强随机 `ADMIN_PASSWORD`、`SESSION_SECRET`,旧默认凭据已失效;生产 `SMS_PROVIDER` 是真实短信通道且所需变量齐全。
5. Core 与 Platform 运行环境已配置同一个新生成的 64 位十六进制 `TEACHING_PLATFORM_SECRET`;先部署 Core 的 `0142` 至 `0146` 和教学 API,确认后再部署 Platform。独立 workflow 没有可靠的跨 workflow 顺序保证,首次发布必须分两次受控触发;双端都不得输出密钥。
6. 对生产 SQLite、uploads 与教学 PostgreSQL 做一致性备份,并实际验证备份可读。workflow 失败时会自动回滚代码包;迁移器用单个 SQLite transaction 防止半迁移,但已成功提交的 schema 不会随代码包反向回滚,数据库恢复必须使用已验证备份并评估期间新增写入。
7. 逐项处理旧本地目录中的非 Git 状态:`data.db`、`data.db-wal`、`data.db-shm`、`qr-layout.png`、`.tmp` 内商业文档 / 调试产物与 `.password.md`。每项必须先外部备份或明确确认放弃;凭据要迁入安全存储并轮换,不能复制进主仓。
8. 首次推送产生的平台、主站和后端 workflow 都成功;平台首页、登录、管理员、讲师、课程、订单、上传、数据库 migration 和教学 API 完成 smoke test。
9. 用登录账号实际完成机构创建 / 列表、成员查看和学员建档;再用两个机构夹具验证跨机构读取与写入均被拒绝且 `teaching_audit_events` 留下 `denied` 记录。
10. 已确认代码包与数据库各自的失败恢复步骤,上一版本包和数据库备份都可用。
11. 在主仓 tracked 文件中搜索旧本地路径、旧 workflow / unit 路径和旧仓唯一依赖,结果为 0。
12. 再保留一个观察窗口;确认无回滚需要后,才删除旧本地目录和旧 GitHub 仓库。

删除旧 GitHub 仓库前尤其要先推送主仓。当前本地历史完整不等于远端已有备份。
