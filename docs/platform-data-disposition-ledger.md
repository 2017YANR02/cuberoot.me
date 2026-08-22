# Platform 权威数据与处置账本

基线日期：2026-08-22
用途：记录旧 Platform 生产数据的权威快照、恢复证据、逐表分类和最终处置。本文不包含手机号、验证码、匿名标识、referer、原始 URL/payload 或任何凭据。

## 1. 权威来源与冻结

- 旧生产应用已停止且禁止手工启动；旧域名保持 HTTP 410。
- 权威一致性备份：`platform-production-frozen-20260822T1205Z.sqlite`。
- 大小：856,064 bytes；SHA-256：`9508F247A2BEEC76F6583C876338FDF67CF3FF95F7C92AEAD0688E53D3808764`。
- SQLite `integrity_check=ok`；40 张表，其中 39 张业务表和 1 张 migration ledger。
- audit-v1 schema SHA-256：`77D76A7D8027A841468970A7B8481AFA34298AD2B58D6632C12D123750CEAEAD`。
- audit-v1 逻辑内容 SHA-256：`0B3A396696B6052FDB2412061FA675D7ED2B5EA38EB2854E46D77BBDEE2734A9`。
- 加密归档 SHA-256：`07C187CDA5BD38C92E6965DAA6E489C5E98C9961D62EE79D9223527809E9BA8F`；加密文件和 manifest 均为只读不可变，密钥不进入仓库。
- 隔离恢复副本通过 `integrity_check`；表数、schema hash、逻辑内容 hash 和逐表行数与来源一致。SQLite 物理文件 hash 因备份页布局不同而不同，逻辑 hash 相等。
- 审计方法与完整无敏感值结果见 [`scripts/audit_platform_snapshot.mjs`](../scripts/audit_platform_snapshot.mjs) 和 [`platform-data-audit-sidecar.json`](./platform-data-audit-sidecar.json)：schema 按表名和空白归一化后的 `CREATE TABLE` 排序；内容按列序和规范化 JSON 行排序，bigint/blob 显式标型。
- 一致性快照和隔离恢复的临时明文审计副本保留在 gitignored `.tmp`；目录已禁用继承，现有文件使用同一受限 ACL，新生 WAL/SHM 仅继承该目录的本机管理员 ACL。收紧 ACL 后，两份物理文件 SHA-256 均未变化。它们不是长期权威归档，后续处置仍需仓库所有者授权。
- 旧本地 `D:\cube\cube-platform\data.db` 只作为 drift 证据，不与生产快照 union。
- 归档源码存在未执行的 `0033 otp_rate_limits` migration；生产权威库截至 `0000-0032`，不得反向补造该表的数据。

## 2. 39 张业务表

| 表 | 源行数 | 分类 | 最终处置 |
| --- | ---: | --- | --- |
| `algorithms` | 39 | 固定 seed | `merged-no-write=35`，`rejected=4`；主站新增 0 |
| `certificates` | 0 | zero-row | 不导入历史；目标证书功能从空数据开始 |
| `circle_members` | 0 | zero-row | 不导入历史；社区复用主站 forum |
| `collection_items` | 9 | seed 课程路径 | 可逆归档，待 owner 确认；不导入 |
| `collections` | 3 | seed 课程路径 | 可逆归档，待 owner 确认；不导入 |
| `comments` | 8 | 固定 seed | 可逆归档，待 owner 确认；不导入论坛 |
| `coupons` | 0 | zero-row | 不导入历史；目标优惠功能从空数据开始 |
| `course_reviews` | 0 | zero-row | 不导入历史；目标评价功能从空数据开始 |
| `courses` | 6 | 固定 seed | 可逆归档，待 owner 确认；不导入课程 |
| `error_logs` | 0 | zero-row | 不导入历史；目标复用主站观测与审计 |
| `events` | 5 | 固定 seed | 可逆归档，待 owner 确认；不导入活动 |
| `events_track` | 960 | 隐私遥测 | 权威加密归档；临时明文审计副本已收紧 ACL，不进入产品库 |
| `favorites` | 0 | zero-row | 不导入历史；目标收藏功能从空数据开始 |
| `instructor_applications` | 0 | zero-row | 不导入历史；目标申请流从空数据开始 |
| `instructor_payouts` | 0 | zero-row | 不导入历史；目标结算账本从空数据开始 |
| `instructors` | 5 | 固定 seed | 可逆归档，待 owner 确认；不导入教师目录 |
| `invite_codes` | 0 | zero-row | 不导入历史；目标营销邀请从空数据开始 |
| `learning_progress` | 0 | zero-row | 不导入历史；目标课程进度从空数据开始 |
| `lesson_notes` | 0 | zero-row | 不导入历史；目标笔记功能从空数据开始 |
| `lessons` | 0 | zero-row | 不导入课时 |
| `memberships` | 0 | zero-row | 不导成主站会员或课程权益 |
| `news` | 5 | 固定 seed | 可逆归档，待 owner 确认；不导入公告 |
| `notifications` | 0 | zero-row | 复用主站通知，不迁数据 |
| `orders` | 0 | zero-row | 不导入历史；目标订单、支付与权益从空数据开始 |
| `otp_codes` | 0 | zero-row | 不迁认证瞬态数据 |
| `payment_logs` | 0 | zero-row | 不重放支付回调 |
| `point_ledger` | 0 | zero-row | 不导入历史；目标积分账本从空数据开始 |
| `post_likes` | 10 | 固定 seed | 可逆归档，待 owner 确认；不导入 reaction |
| `posts` | 5 | 固定 seed | 可逆归档，待 owner 确认；不导入论坛 |
| `products` | 6 | 固定 seed | 可逆归档，待 owner 确认；旧 seed 不导入，目标商城功能从空数据开始 |
| `prompt_templates` | 89 | 固定 seed | 可逆归档，待 owner 确认；旧 seed 不导入，目标 QR 模板后台从空数据开始 |
| `qr_codes` | 2 | demo | 可逆归档，待 owner 确认；旧公开 QR 与链接不导入，目标 QR 创建、审批与扫描功能从空数据开始 |
| `quiz_attempts` | 0 | zero-row | 不导入历史；目标测验记录从空数据开始 |
| `quizzes` | 0 | zero-row | 不导入历史；目标测验功能从空数据开始 |
| `request_logs` | 0 | zero-row | 不导入历史；目标复用主站观测与审计 |
| `study_checkins` | 0 | zero-row | 不导入历史；目标签到功能从空数据开始 |
| `timer_solves` | 0 | 用户明确不迁 | 不迁 timer history |
| `user_achievements` | 0 | zero-row | 不制造历史成就；目标成就功能从空数据开始 |
| `users` | 5 | `u_test_*` 固定 seed | 可逆归档，待 owner 确认；不创建主站账号或 identity bridge |

FTS shadow 表是派生索引，不属于 39 张业务表，不迁移。

## 3. 行级守恒

生产业务行总数为 1,157：

- `merged-no-write`：35 条公式。
- `rejected-with-reason`：4 条公式；3 条不完整/状态不一致 PLL，1 条无可靠 case 身份 F2L。
- `reversible-archive-pending-owner`：158 条 seed/demo 内容，包括 146 条明确 seed/demo，以及 12 条只引用 seed 课程的路径与条目。该分类只表示当前可逆保留，不冒充仓库所有者已批准最终归档或销毁。
- `retained-under-policy`：960 条原始遥测；长期权威副本只进入受限加密归档，本地明文副本仅供当前审计且 ACL 已收紧。
- `imported`：0。
- `blocked`：0。

守恒：`35 + 4 + 158 + 960 + 0 + 0 = 1,157`，差值 0。归档文件保存全部来源行，是恢复证据，不在处置加法中重复计数。

## 4. 公式去重证据

- 39/39 条与 Platform 固定 seed 的 8 个业务字段逐字段一致，创建时间完全相同。
- 主站 canonical 库覆盖 PLL 21、OLL 57、F2L 41 个 case。
- 23 条公式精确重复，12 条为同 case 的 AUF、朝向或等价变体。
- 4 条拒绝：PLL Aa、Ab、Ja 的公式不完整或状态不一致；“F2L 角朝上配对”缺 setup/case 身份且无法验证映射。
- 旧 description、hint、case_group 同样来自 seed，部分文案与状态矛盾，不合入主站。

## 5. 关系、JSON 与派生字段

- 源 schema 没有数据库 FK，因此由审计脚本逐项验证了 41 组业务关系；完整 child/parent、检查行数、空值数、缺失父记录数与恢复副本一致性见无敏感值 sidecar，缺失父记录为 0。
- 所有在用 JSON 字段合法；业务唯一键无重复。
- 以下数字只作为旧展示快照归档，不迁成事实：课程声明 109 课时而实际 0；声明 4,438 学员而付费订单 0；帖子声明 55 点赞而关系行 10；QR 声明 93 扫描而 `qr_scan` 51；活动声明 985 报名但没有报名关系表。
- 生产订单、支付、课程权益、学习进度、正式学生、结算、申请和证书均为 0，因此不需要历史导入事务或旧身份 bridge；目标产品仍须建立完整交易、权益、学习、申请、结算与证书模型，并从空数据开始。

## 6. 媒体

- 生产 uploads 仅有 `.gitkeep`，0 bytes；数据库没有 `/uploads/` 引用，也没有发现对象存储配置证据。
- 本地与主仓归档 `public` 字节一致：13 个文件，9,308,817 bytes。
- 2 张 WebP 卡面只被 demo QR 引用；5 个短 MP4 是未被生产数据引用的 demo 资产。当前可逆保留且不部署到主站，最终归档或销毁等待仓库所有者确认。
- 生产 seed 课程引用 4 个外部视频；其中 2 个样例地址当前 TLS 无效。因为课程本身不迁移，外链不转存，也不冒充耐久媒体。

## 7. 恢复与删除边界

主站新数据的账号注销由 migration `0168_platform_account_deletion.sql` 在 `app_users` 删除事务内统一执行：覆盖 48 张直接引用账号的 Platform 表和 57 个外键，私有/短期数据及旧 outbox 裸账号标识删除，保留的交易、修订、审计、同意记录和结算证据去标识化；12 张不可变表仅允许深度受限的删除触发器修改指定身份列。独立 PostgreSQL 夹具从 0167 全新建库后验证真实删号、12/12 表身份字段变换、非身份业务证据不变、直接伪造上下文和修改结算隐私快照均被拒绝；本地 PostgreSQL 13 与发布 Test `32600584942` 的 PostgreSQL 13 fresh snapshot、0167→0168 升级复验均已通过。

- 代码迁移无需旧 SQLite 在线，也不恢复双写。
- 如需取证，可从加密不可变归档在隔离环境恢复并复算 schema、逻辑内容和逐表行数。
- 当前本地明文证据副本未删除，已受 ACL 限制；只有仓库所有者明确授权并确认不再需要本轮复审或恢复时，才可按回收站规则处置。
- 旧源码目录、GitHub 仓库、数据库归档、媒体、凭据和运行配置是不同删除对象。
- 至少 30 天观察结束前，不删除旧本地源码或远端仓库；加密权威数据归档不随源码删除。
- GitHub 仓库删除只由仓库所有者亲自执行。
