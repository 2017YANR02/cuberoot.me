# 多机构教学 SaaS 设计

最后更新:2026-08-18

前端架构已经调整:最终不再扩展独立 `@cuberoot/platform` 前端,所有教学管理页面统一进入主站 `/org/*`;本文的领域模型、Core API、PostgreSQL 权限与审计设计继续有效。迁移顺序见[教学平台前端统一计划](./platform-unification-plan.md)。

## 产品目标

把 CubeRoot 主站扩展成面向个人老师、工作室和培训机构的完整教学系统。最终范围一次设计完整,工程按可验收阶段交付,不做只能服务单个老师的临时模型。

系统必须同时支持:

- 一个账号加入多个机构,在不同机构拥有不同角色。
- 机构、校区、教师、助教、学员、监护人与班级关系。
- 购买课包、赠课、扣课、请假、补课、退款、过期与剩余课时。
- 排课、签到、消课和不可篡改的上课历史。
- 老师布置训练任务,自动收集 `/timer`、`/predict` 等主站工具的训练证据。
- 每日打卡、作业批改、课堂反馈、周报和家校沟通。
- 机构经营报表、教师工作台、学员/家长端与完整审计。

## 迁入时旧平台底座与真实缺口

下表描述的是旧平台迁入主仓时的能力基线,不代表后续 Stage 0 至 Stage 3A 的本地实施状态。当前进度与未完成边界见文末实施状态。

| 领域 | 已有实现 | 不能直接当作教学系统的原因 |
| --- | --- | --- |
| 账号与讲师 | `users`、全局 `role`、`instructors`、讲师申请 | 一个用户只有一个全局角色,没有机构成员关系和租户隔离 |
| 课程与学习 | `courses`、`lessons`、`learning_progress`、测验、笔记、证书 | 这是内容课程,没有班级、排课、出勤和线下/直播课历史 |
| 学员 | `/instructor/students` 从已支付课程订单查询用户 | 购买者不等于学籍;没有学员档案、监护人、负责老师和班级关系 |
| 交易 | `orders`、支付回调、退款、优惠券、讲师结算 | 订单只能证明买过商品,不能表达课包批次、有效期和每次课时变动 |
| 训练 | `timer_solves`、`study_checkins`、积分与成就 | 只覆盖平台内置计时器;没有任务、提交、证据归属、批改或主站工具契约 |
| 通知 | `notifications`、帖子与评论 | 没有机构会话、参与人、已读回执、反馈可见范围和家校审计 |

现有公开课程、商城、支付、内容学习和讲师分成继续使用。新的教学运营域不从这些表反推业务事实,也不把 `orders` 当课时余额表。

## 系统边界

### 应用边界

- `core/packages/platform`:教学 SaaS 页面、机构工作台、学员/家长端和现有内容商城。
- `core/packages/server`:新教学域 API、PostgreSQL 数据、权限策略、训练证据入口和审计。
- `core/packages/shared`:跨应用的 DTO、枚举、事件版本和校验 schema。
- `core/packages/client`:继续拥有 `/timer`、`/predict` 等训练引擎,只接入证据上报契约,不复制引擎到平台。

### 数据边界

现有平台 SQLite 暂时承载原有内容与商城,避免在切换前重写 33 个历史 migration。新多租户教学交易域从第一版进入 PostgreSQL,原因是它需要并发写入、严格外键、机构隔离、账本事务和长期审计。两边通过稳定 ID 与 API 连接,旧域是否迁入 PostgreSQL 另开数据迁移项目。

禁止双写同一业务事实。课包余额、出勤、消课、作业状态和沟通记录只能以教学域 PostgreSQL 为准。

## 身份、租户与权限

### 核心模型

- `organizations`:机构租户,含 slug、时区、状态和业务设置。
- `campuses`:机构下的校区或线上教学点。
- `organization_members`:账号在机构内的成员身份,角色为 owner、admin、teacher、assistant、finance 或 viewer。
- `student_profiles`:机构内学员档案,可由老师代建;建档不会自动归属登录账号或主站训练记录,只能通过一次性绑定邀请由已登录学员确认绑定,并记录 `account_linked_at`。
- `guardian_links`:学员与监护人账号的关系和可见范围。
- `teaching_groups`:班级或长期教学小组。
- `group_memberships`:学员入班、转班、退班的有效期历史。
- `teacher_assignments`:老师负责班级或个人学员的关系。

`users.role` 只保留旧平台兼容,不能用于新教学域授权。新接口必须从当前账号、机构成员关系和资源归属共同判权。

### 权限原则

- 每个教学域表都直接或可强约束地归属 `organization_id`。
- 每个查询先限定机构,再校验角色和资源关系;禁止先按资源 ID 查询后在页面层过滤。
- 机构 owner/admin 管本机构;teacher 只看负责的班级和学员;guardian 只看已绑定孩子允许公开的内容。
- 平台超级管理员与机构管理员分开,超级权限操作必须写审计事件。
- 租户隔离、越权读取和越权写入必须有 API 回归测试。

## 课包、排课与上课历史

### 课包模型

- `lesson_package_products`:机构可售课包模板,定义课时类型、总量、有效期、适用课程/老师/校区和退款规则。
- `student_packages`:购买后生成的条款快照,后续修改商品不能改变已售课包。
- `lesson_credit_ledger`:追加式课时账本,记录 purchase、gift、consume、refund、adjust、expire 和 transfer。

剩余课时由账本 `SUM(delta)` 得出,不维护一个可直接覆盖的余额字段。每笔变动必须有操作者、原因、关联订单/课堂和幂等键。不同课时类型不能混用;是否允许负数由机构策略在事务入口校验。

### 排课与消课

- `teaching_sessions`:一次具体课堂,含课程、班级/学员、校区、开始结束时间、时区和状态。
- `session_teachers`:主讲、助教和代课关系。
- `attendance_records`:每位学员的 present、late、absent、leave、makeup 状态。
- `session_events`:排课、改期、取消、开课、完课和作废的追加式历史。

课堂状态按 `scheduled -> in_progress -> completed` 推进;取消、改期、缺席和补课走明确分支。只有完成课堂且出勤规则允许时才能生成消课账本,同一学员同一课堂最多消课一次。撤销消课必须追加反向流水,不能修改旧流水。

## 训练任务与证据

### 任务模型

- `training_templates` 与只追加的 `training_template_versions`:模板身份/归档状态与每版 source、activity、说明和工具配置分离。
- `training_assignments`:一次布置绑定固定模板版本,采用 once/daily、expected count、IANA 时区快照、半开时间窗和 draft/published/closed 状态。
- `training_assignment_targets`:草稿可选择班级或个人;发布时把班级选择器展开为不可变的学员快照,只有学员目标可关联证据和批改。
- `training_assignment_goal_metrics`:保存受 source/activity registry 约束的目标指标和比较方式。
- `training_evidence` 与 `training_evidence_assignments`:原始证据和任务关联只追加,关联时重验机构、学员、目标、时间窗与 source/activity。
- `training_submission_reviews`:追加式批改,保存状态、1 至 5 分评分、文字反馈和老师快照;当前 Foundation 不含语音反馈。
- `daily_training_rollups`:按机构时区、source、activity 和 trust level 可重建的日聚合。

边界条件必须在入口处理:空目标、非法 source/activity/metric、无效 JSON、无显式时区偏移或超过允许未来偏移的时间、结束不晚于开始、重复内容冲突、任务已关闭、学员不属于机构、工具不支持该指标时直接拒绝。

### 主站工具契约

主站训练工具只提交严格版本化的 `TrainingEvidenceV1`:schemaVersion、注册的 source/activity、sourceEventId、带显式 offset 的 occurredAt、可选 durationMs、严格注册的 metrics、payloadVersion、受限 payload,以及可选的复数 assignmentIds。当前 source registry 只包含 `timer`、`predict` 和 `alg-trainer`,不能把未登记工具或指标静默当作合法证据。

客户端不得提交 organizationId、studentId、actorUserId、trustLevel、timezoneSnapshot 或 localDate。Core 必须从登录态和当前学员账号绑定推导身份,在事务内重验每个任务关联,并由服务端生成机构时区快照、localDate、payload hash 与提交者快照。sourceEventId 的去重范围是机构、学员和 source;重复 ID 只有内容一致时才能按既定语义处理,内容冲突必须拒绝。

证据必须明确展示 trust level:`self_reported`、`server_recomputed`、`server_challenge_recomputed` 或 `server_originated`。界面不得把 `self_reported` 表述成“已验证”;只有独立的服务端计算链路才能提升可信等级。

带签名任务上下文、主站 `/timer`、`/predict`、`alg-trainer` 生产者接入和自动回传属于 Stage 3B。本轮 Stage 3A Foundation 不包含这些 adapters,也不包含 Core 训练 routes 或 Platform 训练页面。禁止 iframe 抓页面或复制主站训练引擎。

每日打卡应由不可变证据和机构时区日聚合派生。Foundation 当前不提供手动补签;未来若支持,必须作为独立、可审计且不冒充工具证据的事件。删除任务不能删除已产生的证据。

## 反馈、周报与沟通

- `lesson_feedback`:老师按课堂和学员记录表现、问题、下次目标与可见范围。
- `weekly_reports`:保存已发布周报快照;草稿可重算,发布后修改产生新版本。
- `conversation_threads`、`conversation_participants`、`messages`、`message_receipts`:机构内沟通、附件和已读状态。
- 现有 `notifications` 作为投递提醒,不能替代消息正文和会话历史。

课堂反馈默认只对负责老师和机构管理员可见;发布时才能给学员/监护人。内部备注与对外反馈必须分字段/权限,不能依赖前端隐藏。消息撤回、导出、归档和保留期都写审计。

周报聚合至少包含:实际上课/请假/缺席、消耗与剩余课时、任务完成率、训练天数、关键指标趋势、老师反馈和下周任务。历史周报引用发布时快照,不能随源数据变化悄悄改写。

## 核心业务闭环

以下是目标业务闭环,不是当前所有阶段均已完成的状态说明。

1. 机构创建课包商品,订单支付后生成学员课包和 grant 流水。
2. 管理员/老师排课,学员签到,老师完课并确认出勤,事务内生成 consume 流水。
3. 老师从模板布置任务,学员进入主站训练工具,证据自动回传并更新日聚合。
4. 老师批改作业并发布课堂反馈,系统生成周报草稿。
5. 老师发布周报,学员/监护人收到通知并在会话中继续沟通。
6. 机构看板按校区、老师、班级追踪课消、出勤、任务完成和到期风险。

## 路由信息架构

机构工作台统一放在 `/org/[orgSlug]`:

- `/dashboard`:今日课程、待批作业、异常出勤、课包预警。
- `/students`、`/teachers`、`/classes`:人员与教学关系。
- `/schedule`、`/sessions/[id]`:排课、签到、完课与课堂记录。
- `/packages`、`/orders`:课包商品、学员余额和流水。
- `/assignments`、`/assignments/[id]`:训练任务创建、发布、目标与学员提交汇总。
- `/students/[studentId]/training`:学员训练日历与证据明细。
- `/assignments/[id]/students/[studentId]/review`:批改历史与新增批改。
- `/reports`:课堂反馈和周报,属于 Stage 4。
- `/messages`:机构会话。
- `/settings`:校区、角色、规则、审计和集成设置。

未来学员/家长端放在 `/learn`:今日任务、训练记录、课表、剩余课时、反馈、周报和消息。学员端训练归属必须先完成一次性账号绑定,不能因老师建档而自动获得主站训练记录。现有 `/instructor` 继续表示内容课程讲师,在数据迁移完成前不要把它直接改名或混入机构 teacher 权限。

## 状态机与不变量

- 所有金额用最小货币单位整数,所有课时用明确单位或整数 credit,禁止浮点余额。
- 数据库存 UTC 时间,机构配置 IANA 时区;日打卡、周报和课程日期按机构时区计算。
- 管理写操作、完课消课、退款和 webhook 使用 Idempotency-Key;训练证据以机构、学员、source、sourceEventId 和 payload hash 实现不可变去重,不能只依赖通用幂等响应缓存。
- 财务、课时、课堂事件、反馈发布和权限变更不硬删除;作废使用反向事件或状态迁移。
- 报表/日聚合可重建,账本和原始事件不可重建时必须长期保留。
- 所有列表有分页和机构范围索引;教师看板不在应用层遍历全机构数据。
- 学员未绑定账号、无监护人、多人共用手机号、转班、跨校区、代课、跨周/月和课包同时到期都必须有测试。
- 学员绑定邀请只保存 token hash;生成新邀请使旧链接失效,预览不消费 token,确认消费后才建立账号归属。明文 token 不进入通用幂等响应缓存。

## 交付阶段

### 0. 契约与基础设施

- 在 `shared` 定义角色、状态机、`TrainingEvidenceV1` 和错误码。
- 在 PostgreSQL 落机构、成员、学员、监护人、审计与幂等底座。
- 建立租户隔离测试夹具和平台到 API 的服务端鉴权。

验收:同一账号可加入两个机构;任何跨机构读写都返回明确拒绝并留下安全日志。

### 1. 机构 CRM

- 机构/校区/老师/学员/监护人/班级管理。
- 负责关系、批量导入、搜索、归档和权限工作台。

验收:机构能独立建档、分班、指派老师;老师只能看到负责范围。

### 2. 课包与教学履约

- 课包商品、购买快照、课时账本、排课、签到、请假、补课、完课和消课。
- 学员课时页与机构异常流水报表。

验收:买课到消课完整闭环;重复完课不重复扣课;退款和撤销都有可追溯反向流水。

### 3A. 训练 Foundation

- 版本化模板、once/daily 任务、发布时目标快照、追加式证据/任务关联、可信等级、日聚合、追加式批改和一次性账号绑定邀请。
- 验收:客户端身份与 trust 字段不可伪造;非法 JSON、时间、source/activity/metric、重复内容冲突和跨租户关联被拒绝;日聚合可从原始证据重建。

### 3B. 训练产品闭环

- Core 训练与绑定 routes、主站任务/日历/证据/批改页面,以及主站训练工具生产者接入。
- 先接 `/timer`,再用同一契约接 `/predict` 和 `alg-trainer`。
- 验收:老师只能看到负责范围,学员绑定后可提交并查看自己的证据;每条证据明确显示 trust level,不能把 `self_reported` 表述成“已验证”。

### 4. 反馈、周报与沟通

- 课堂反馈、内部备注、周报快照、学员/家长端、会话和已读回执。

验收:一次课堂结束后可完成反馈、周报发布、家长阅读与后续沟通,全过程可审计。

### 5. 机构经营与上线保障

- 课消、出勤、续费、到期、教师负载、任务完成率和留存报表。
- 数据导出、备份恢复、限流、审计检索、隐私保留策略和机构停用流程。

验收:多机构并发隔离通过;备份恢复演练通过;关键账本可逐笔对账。

## Stage 0 初始实现顺序（历史记录）

第一批代码先做阶段 0,但 schema 和契约按最终模型命名,不写单机构快捷字段。以下是当时的实施顺序,不是当前待办清单:

1. shared 状态/权限/证据契约。
2. PostgreSQL migration:organizations、members、students、guardians、audit、idempotency。
3. Hono 机构上下文和权限中间件。
4. 平台机构选择与 `/org/[orgSlug]` 最小工作台。
5. 跨租户 API 测试和审计测试。

阶段 0 后再落课包账本。Stage 0 的最小证据类型只是占位契约;Stage 3A 正在以去客户端身份字段、严格 registry、JSON 和时间边界的正式证据契约取代它。

## Stage 0、Stage 1 CRM 基础、Stage 2 与 Stage 3A 实施状态

截至 2026-08-17,Stage 0 底座、Stage 1 的校区 / 班级 / 长期负责关系和 Stage 2 的管理端授予、排课、出勤、正常消课 MVP 已完成本地实现。Stage 3A 的本地 Foundation schema 与共享契约也已完成并通过定向验证,但不代表训练产品闭环已经完成:

- `@cuberoot/shared` 提供角色 / 权限 / 状态、`TrainingEvidenceV1`、平台身份断言和统一错误码。
- PostgreSQL `0142` 至 `0146` 建立租户、成员、学员 / 监护人、审计、幂等、平台账号映射、独立写入尝试限流和学员分页索引;最终态同步进 `schema.pg.sql` 与 `/dev/schema`。
- Core 教学 API 使用内部 `app_users.id` 授权,短时签名同时绑定 method、path + query、body hash 和 Idempotency-Key,并有 nonce 重放保护。
- 机构创建、成员 / 学员读取与学员创建都在服务端重验 active membership、机构状态和角色;跨机构拒绝写入 `teaching_audit_events`,写端点按 actor 独立持久限流,业务事务回滚后的失败尝试仍会计数。
- Platform `/org` 提供机构选择、机构工作台、成员查看和学员建档;概览直接读取数据库聚合,成员 / 学员列表服务端分页;歧义重试复用同一个幂等键,成功或表单内容变化后才更换。
- PostgreSQL `0147` 建立课包商品、学员课包、课堂、授课成员、出勤、课时账本和课堂事件；`0148` 加固机构最后一名 active owner 的数据库约束。课时账本与课堂事件只追加,重复完课不会重复扣课。
- Core 已提供课包创建 / 发放 / 查询、余额流水、排课、出勤批量保存、完课消课和课堂历史 API。teacher/assistant 只可读写分配给自己的课堂,未分配资源对外返回 404 并记录内部拒绝审计。
- Platform 已提供课包创建与发放、学员剩余课时 / 流水、课堂创建、出勤、完课和历史分页页面；所有动态链接禁预取,写操作在歧义重试时复用同一 operation key。
- PostgreSQL `0149` 建立校区、班级、学员分班、长期老师负责关系和永久关系并发锁；关系采用半开有效期,所有跨表关系使用机构复合外键,归档与新增关系的并发竞争由数据库串行化。
- Core 已提供校区 / 班级分页与归档、学员分班、班级或个人学员负责人指派和结束关系 API。teacher/assistant 的校区、班级和学员查询都在 SQL 内按当前 active 长期指派收窄,无权资源对外返回 404 并记录内部拒绝审计；`session_teachers` 继续保留每堂课的事实快照。
- Platform 已提供校区、班级、班级学员和负责人管理页面,以及学员个人负责关系页面。owner/admin 可管理关系,teacher/assistant 只读取 Core 已裁剪的负责范围,不预载全机构学员选择器或同事历史。
- Stage 3A Foundation 在 PostgreSQL `0150` 建立版本化模板、任务/目标/目标指标、带来源的不可变学员快照、不可变证据及任务关联、追加式批改、日聚合和账号绑定邀请,并为 `student_profiles` 增加 `account_linked_at`;升级路径与最终 schema 路径已在全新 PostgreSQL 18 隔离库验证。
- `@cuberoot/shared` 已定义细粒度 training permissions、source/activity/metric/trust registry、严格且有界的 JSON 证据解析与 Foundation DTO;source/activity 与目标指标组合由类型和运行时 registry 同时约束。
- 本轮明确不包含 Core Stage 3 routes、Platform 训练 UI、主站工具 adapters 或端到端账号绑定。Stage 3B 未开始验收,不能把 Foundation 写成 `/timer`、`/predict` 已自动回传或证据已经服务端验证。
- Stage 1 当前完成的是 CRM 基础闭环；监护人管理工作台、批量导入、远程搜索选择器和完整权限工作台尚未实现,不能把阶段 1 的完整验收标记为通过。
- Stage 2 当前覆盖管理端授予课包与正常消课闭环,尚未接通订单 / 支付；退款 / 撤销反向流水、请假补课规则和异常流水报表也未完成,不能把阶段 2 的完整验收标记为通过。
- 手机验证码使用加密随机数和 SQLite 持久限流;生产环境没有真实短信 provider 时拒绝启动部署,不再回退到控制台输出验证码。

仍未把教学系统标记为生产验收通过:

- 真实 PostgreSQL 18 已验证从 Stage 0 parent snapshot 顺序应用 `0147`、`0148`,得到 7 张 Stage 2 表和 4 个 owner triggers;审计 actor 随账号删除匿名化成功。两事务并发删除仅剩两名 owner 时,READ COMMITTED 下第二笔以 `23514` 拒绝,REPEATABLE READ 下第二笔以 `40001` 拒绝,最终均保留 1 名 owner。
- 真实 PostgreSQL 18 已分别验证从 Stage 2 最终结构升级 `0149` 与直接加载最终 `schema.pg.sql`。两套隔离 schema 均通过跨机构复合外键、关系 XOR 与半开区间、READ COMMITTED 重叠拒绝、REPEATABLE READ 序列化失败后重试、归档与新增的双向竞争、账号删除匿名化、200 字符教师快照和永久关系锁身份保护。
- 历史 migration 链依赖 ledger 出现前的旧生产基线,从绝对空库按文件名重放会在 `0003_add_note_to_colpi_words.sql` 因缺少基线表停止。已验证的 Stage 0 最终结构向 `0147`、`0148` 升级不受这个历史缺口影响,但新库初始化 / 灾难恢复只能依赖已验证备份,不能宣称全历史空库重放已通过。
- 真实 PostgreSQL 18 已在全新升级库与最终 schema 库中验证 `0150`,两边的语义目录 2424 项完全一致。顺序夹具覆盖跨机构复合外键、发布非空与发布后不可变、邀请过期 / 重发 / 消费、证据身份 / 时间 / 指标 / 自然唯一、日聚合与重建、追加式批改、聚合防篡改和账号删除匿名化。并发夹具覆盖分班新增 / 结束与发布的 RC / RR 双向顺序、班级展开目标 exact-set、直接学员与多班重复命中、同自然键证据、批改 revision 及证据写入与账号删除锁序。
- 真实 PG 尚未覆盖 20 路幂等 / 限流并发、完整双机构 HTTP API 夹具、课包并发透支、重复完课和整套 runtime 角色权限;线上 `0142` 至 `0150` 也尚未执行。
- 本机 Docker daemon 未运行,尚未完成从干净构建上下文生成平台镜像的实测。
- 本地分支尚未与远端最新 `main` 安全整合,也没有 push;线上尚未配置双端同一新密钥或完成登录态 smoke。

此前已完成的 Stage 0 至 Stage 2 本地验证:

- `pnpm install --frozen-lockfile` 与 `@cuberoot/shared build` 通过。
- Platform typecheck 通过;全量 Vitest 6 个文件、29 个测试通过。
- Shared build、Server typecheck 通过;教学权限、repository、Stage 1 / Stage 2 schema、owner guard 与幂等 / 限流边界 Vitest 5 个文件、49 个测试通过。
- Client typecheck 通过;schema/API drift 与账号删除契约 Vitest 2 个文件、34 个测试通过。
- 两个 deploy workflow 和一个 platform test workflow 通过 YAML 1.2 解析,所有 workflow `run` 脚本通过 Bash 语法检查;`docker compose config --quiet` 与 `git diff --check` 通过。

Stage 3A Foundation 已通过 shared build / typecheck、Server typecheck、独立 strict TypeScript 契约编译、Server 5 个文件 24 项定向测试、Client typecheck、`/dev/schema` drift 与账号删除契约 2 个文件 36 项测试。`0150` 的 PostgreSQL 18 升级 / 最终 schema 双路径、顺序与 RC / RR 并发夹具均通过,全工作树 `git diff --check` 通过。以上计数只代表 Foundation schema / 契约,不代表尚不存在的 Stage 3 routes、UI 或 adapters。

以上项目必须按 `docs/platform-migration.md` 的删除门槛完成后,旧本地目录和旧 GitHub 仓库才可由仓库所有者删除。
