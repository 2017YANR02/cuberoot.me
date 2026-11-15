# Platform 模块化与产品验收跟踪

状态：本地拆分、追加修复与范围内自动验收完成；发布与真实资金/设备/印刷验收未完成。开始日期：2026-11-13。负责人：当前 Codex 会话。

追加轮次（2026-11-13）：迁移冲突已解决，三名 Agent 完成后端、Web、集成验收的独立复审；最后提出的会员未来权益、退款空档与混合购物车锁顺序问题均已实证修复，受影响回归和独立末审通过，无剩余本轮阻断。原 migration 检查失败保留为第一轮历史证据，不再是当前阻碍。实际结果与必须使用真实账号/资金/硬件的边界见本文末尾。

## 目标与边界

用户要求覆盖在线课程与学习、学员个人空间、讲师工作台、机构教务、训练管理、交易履约、活动与线上比赛、二维码与卡片、内容运营，先记录方案，再多 Agent 迭代实现与验证。目标是可维护、可验证、复用主站能力的产品；不以拆文件数量或测试数量代替业务完成。

本地起点为 `3b1d2cff8`；精确 HEAD、已有修改 patch 和未跟踪文件备份在 `.local-data/platform-modernization-2026-11-13/`。始终使用当前 checkout，不创建工作树，不覆盖其他任务修改。默认不提交、不推送、不部署，不写生产业务数据。旧 `core/packages/platform` 保留归档，不开发、不测试、不构建。

## 实施方案

1. 固定基线：备份现有修改，识别现役入口、领域边界与已有行为测试。
2. 教务后端：从 `teaching_saas.ts` 分离契约、校验、权限/事务基础、各领域数据操作与 HTTP 注册。按机构成员、班级校区、课时账本、排课请假补课、训练、账号绑定、反馈周报和沟通划分；保留请求、响应、事务、防重和租户权限语义。
3. Platform 后端：按学习、目录、订单支付、履约、优惠、讲师结算、对账分清职责；二维码与赛事已有专门模块，先审阅再按实际耦合处理，不为文件数制造新层。
4. Web：分离通用控件、领域表单、领域内容与页面协调；减少万能组件的业务分支。继续复用 auth、AppLink、播放器、Markdown、图片上传、日期输入、论坛、计时器与公式库，不另造 package 或第二业务事实源。
5. 契约与集成：保留现有公开导入入口；更新必要源码定位测试，使其核验实际模块，不放宽行为断言。类型检查、权限/防重/状态转换回归、隔离 PostgreSQL 保存回读、页面 smoke 分层验收。
6. 复审迭代：独立检查依赖方向、重复实现、权限与并发、失败恢复；针对发现修复并重跑受影响验证。

## 分工与写入所有权

| 工作包 | 范围 | 状态 |
| --- | --- | --- |
| T：机构与训练后端 | `apps/api/src/routes/teaching_saas.ts`、新增 `apps/api/src/teaching/**`、对应 teaching 测试 | 本地完成，PG 与交叉复审通过 |
| P：Platform 后端 | `apps/api/src/routes/platform_*.ts`、`apps/api/src/platform/**`、对应 platform API 测试 | 本地完成，PG 与交叉复审通过 |
| W：Web 领域组件 | `client/components/platform/**` 与对应 UI 测试 | 本地完成，异步保存与打印行为回归通过 |
| I：集成与验收 | 本文、client lib 调用层、隔离 PG、跨领域验证、最终复审 | 第一轮与追加复审完成；发布及实物边界见后文 |

每位 Agent 只修改自己的范围；需要越界先交接。共用 package manifest、schema、主 API 挂载、现有他人改动不擅改。

## 九域验收矩阵

| 业务域 | 必验链路 | 当前状态 |
| --- | --- | --- |
| 在线课程与学习 | 列表/详情、权限课堂、进度保存恢复、测验与证书 | 学习 PG、播放器、父课程可见性、购买模式及媒体授权通过；课程游客页面已验 |
| 学员个人空间 | 本人数据隔离、笔记、签到、收藏、权益 | 学习 PG、跨账号/机构/学员隔离及学员/监护人浏览器 fixture 通过；真实第三方登录与硬件另列 |
| 讲师工作台 | 课程维护、学员可见范围、收入与结算 | 讲师/他人/管理员权限 PG，讲师浏览器 503→重试→收入展示通过；真实到账未验 |
| 机构教务 | 机构隔离、成员/班级、排课、考勤扣课时、请假补课 | 教务行为回归、课时调整/请假补课 PG、学员门户 PG 通过 |
| 训练管理 | 模板版本、发布任务、提交证据、教师批改 | 教务路由/repository 行为回归、每日面板 SQL 五场景通过；真实设备训练未验 |
| 交易与履约 | 报价与下单一致、库存、防重复付款/退款、履约和对账 | PG+HTTP 报价、库存、支付回调重放、并发默认地址、购买/兑换会员累计时长通过；支付网络边界使用 fixture，未真实扣款 |
| 活动与线上比赛 | 公开详情、报名/场次、权限与成绩流程 | PG 报名/签到/退款/结算、真实 JWT 签名、入场角色与凭据失效链路通过；实际 LiveKit 摄像头连接未验 |
| 二维码与卡片 | 创建/回读/编辑/启停、落地、导出、统计 | QR PG、SVG/落地/卡片、并发编辑/保存/打印回归通过；实体印刷未验 |
| 内容与运营 | 搜索、资讯、运营表单、实际数据聚合 | 内容保存回读/搜索/聚合 PG、Web 行为回归通过；资讯游客页已验 |

## 交付门槛

- 领域拥有明确入口，不把原单体简单改名或搬进另一个大文件；共享基础不反向引用领域。
- 现有接口和数据语义保留，测试不得通过跳过、删断言或伪造成功来变绿。
- 本地 API/Web 类型检查，受影响行为回归和隔离 PG 关键写入回读有实际结果。
- 浏览器验证与 API 验证分别记录；未验证的权限角色、真实支付、设备与印刷不得写作完成。
- 范围内修复、尚存限制和发布状态明确。生产支付/退款、旧印刷短链等沿用 `platform-completion-tracker.md` 的实际限制；可用 fixture 自动验证的角色权限逐项记录，不再笼统留给用户。

## 执行记录

- 2026-11-13：读取架构、开发、前端、路由、发布及 server-deploy 规则；保存现有修改快照。`127.0.0.1:3000` 返回 200，复用已有 dev，禁止并行 Next build。本机存在 PostgreSQL 16 工具，隔离验证环境待准备。
- 第一轮：T/P/W 三个 Agent 按所有权执行。教务 client 调用层从 3222 行拆成 `lib/teaching/` 的机构、课时、课次、训练、报告、绑定、沟通、校验、传输和类型模块；原入口保留明确 re-export。175 个函数/类与拆分前正文逐一比对完全一致；72 个既有调用层/主站契约测试通过。
- 第一轮浏览器：复用本机 dev，通过独立 Chrome 测试会话读取 `/zh/platform`、课程、活动、线上比赛、资讯、课程会员、我的课程、讲师、QR 管理、`/zh/org`、`/zh/learn` 共 11 个入口，均 HTTP 200，无 pageerror；受保护入口显示登录状态。截图和逐页结果在本轮 `.local-data`。这是游客验收，不能代表登录角色操作完成；只读请求仍沿用现有 dev 的线上反代，未写生产数据。
- 第二轮发现：学习 PG 测试依赖固定预置库，改为显式 loopback URL、随机独占 schema 和自动清理；交易服务消费方仍引用路由门面，改为直接依赖领域 service；Web 静态加载 QR 工作室、读取取消后的更新和重复提示由 W 修正。新模块的 shared 根导入由架构检查发现，改用已有公开 subpath，不新增豁免。
- 集成检查：教务与 Platform 路由清单和 `/dev/api` 精确匹配。源码检查通过静态相对 import/re-export 跟随限定领域目录，保留方法/路径完整性断言，避免跨路由 helper 引用造成重复计数。
- 第一轮发现的外部阻碍（追加轮已解决）：完整 `dev-schema-api-drift` 曾发现 migration 编号 0325、0326 重复（assistant 与 WCA 变更）。追加授权后完成生产 ledger 只读核对，将未应用的 WCA 文件顺延为 0328、0329，未放宽编号守卫；详见下方追加轮证据。

## 当前实现地图

| 层 | 入口与职责 |
| --- | --- |
| 教务 API | `apps/api/src/routes/teaching_saas.ts` 保留 8 行公开入口；`src/teaching/http/` 注册接口，`repository/` 分领域持久化，`access/`、`validation/`、`serialization/` 与 `transactions.ts` 单向提供基础能力 |
| Platform API | `src/platform/catalog/`、`learning/`、`commerce/` 接管原 3 个单体；路由文件只组装和保留原有公开出口；QR、赛事、内容继续使用现有独立实现 |
| Web 教务调用 | `client/lib/teaching-saas-api.ts` 保留公开导出；`lib/teaching/` 按机构、课时、课次、训练、周报、绑定和沟通归属，校验与传输共用 |
| Web 产品组件 | `client/components/platform/` 中课程、会员、订单、结算、地址、兑换码各自拥有操作组件；页面协调、列表、落地页分开；QR 画布/属性/提示词/草稿状态分开，工作室按需加载 |
| 复用与守卫 | 继续复用主站账号、播放器、论坛、计时器、公式库等；金额和会员期限复用单一实现；删除一条已消除的 shared 根导入债务，未新增架构豁免 |

本轮没有新增 workspace package、独立服务、URL 或业务数据库 migration。追加轮仅对已有未应用的 WCA migration 重新编号，SQL 不变。没有修改归档 Platform，没有复制另一套身份或订单系统。拆分的目的在于按业务定位和验证，文件总行数会因显式 import/export 增加，不能把入口行数下降当成总代码量减少。

## 第一轮复审与验收证据

本轮持久证据目录：`.local-data/platform-modernization-2026-11-13/`。完整变更路径清单为 `files.json`。该目录保留任务前快照、日志与截图，不含生产凭据。验证使用 PostgreSQL **16**，不代表生产 PG13 重新验收。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 教务行为与源契约 | 13 文件、151 项通过；读取器复用后 4 个受影响文件 65 项通过 | `teaching/all-tests-final.log`、`source-contracts-final.log` |
| 教务真实 PG | learner portal、weekly reports、credit adjustments、leave/makeups、conversations 五组通过；daily-board 五场景通过 | `teaching/pg-final-*.log`、`pg-conversations.log`、`pg-daily.log` |
| Platform API | 22 套、171 项全部通过，无跳过，含课程/订单/QR/赛事 PG | `platform-api/final-tests.log`、`verification.md` |
| API 类型检查 | 两工作包均通过 | `teaching/typecheck-final.log`、`platform-api/typecheck.log` |
| Client 调用层 | 72 项通过；175 个函数/类正文与拆分前一致 | `client-function-parity.json`；最终集成组另见下项 |
| 跨域集成组 | 6 文件共 95 项，94 通过，1 项失败为外部 migration 编号重复；所有 Platform/teaching 路由契约通过 | `integration-client-final.log` |
| Client 类型检查 | 非增量 tsgo 通过 | `client-typecheck-final.log`，Web 后续修复另有 `web-typecheck-final.log` |
| Platform Web | 14 文件、132 项通过；包含真实 Studio 组件点击、延迟保存后打印及编辑期间阻止打印 | `web-platform-all.log`、`web-qr-studio-tests.log` |
| 架构边界 | 通过，移除原 PlatformDomainActions 的 shared 根导入债务 | `boundaries-final.log` |
| 浏览器 | 13 个中英文入口 HTTP 200，无 pageerror；390px 视口无横向溢出；图片 decode 后截图 | `browser-smoke.json`、`browser-smoke-final.log`、`platform-mobile.png` |
| 交叉复审 | T 复审 client 调用层和 Platform API，P 复审教务；无新增运行时依赖环、接口遗漏或已知阻断问题 | `teaching/peer-review.json`、`platform-api/verification.md` |

教务实际修复：删除账号与限流 INSERT 并发时原实现可能抛 FK `23503`。现以同一语句先 `FOR KEY SHARE` 锁账号，再写限流记录，与账号删除的锁顺序一致；已删除账号返回隐藏 404。行为回归及真实并发 PG 场景通过。除该修复外，239 个教务函数/方法抽取前后保持语义；97 个教务接口和 commerce 40、learning 45、catalog 51 个接口保持。

Web 实际修复：会员空数据不再制造 effect 依赖循环，取消后的地址/测验/二维码请求不覆盖当前界面，空状态保留业务传入提示。QR 草稿按卡片编辑版本及挂载 epoch 接收保存结果；保存期间继续编辑或撤销，不会被旧响应覆盖或错误标记为已保存。批量 SVG 和打印先保存全部所选卡片，设计或选择改变即停止输出。主审复审追加了保存期间 reset 的回归，防止旧基线误标 clean。通用页面自我介绍及重复标题删去，必要业务说明保留。

隔离 PG 所有 fixture 结束后已停止。现有 Web dev 服务保留。重跑 PG 时可启动本轮专用 cluster：`pg_ctl -D .local-data/platform-modernization-2026-11-13/pg -l .local-data/platform-modernization-2026-11-13/pg.log -o '-h 127.0.0.1 -p 55439 -c shared_buffers=32MB -c max_connections=24' start`。只用于本地测试，不与线上数据同步。平台用显式 `*_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/postgres`；教务 fixture 用 `DB_HOST=127.0.0.1 DB_PORT=55439 DB_USER=postgres DB_NAME=postgres`。完整 Platform 命令见 `platform-api/verification.md`。

## 追加轮：迁移冲突、自动验收与全面复审

本轮仍在原 checkout，由三个独立 Agent 分别复审后端权限/事务、Web 角色/异步行为、跨域数据库/媒体/赛事验收，主审负责迁移编号、CI 接线、交叉复核与跟踪。原有修改、未跟踪源码和冲突迁移先备份到 `review-round2/baseline/` 与 `baseline.patch`。

### 迁移冲突

只读核对生产 `schema_migrations` 和 Git 历史后确认，助手迁移 `0325_assistant_share_versions`、`0326_assistant_context`、`0327_assistant_knowledge_metadata` 已应用，WCA 两份未应用且未提交。只将 WCA 文件顺延为 `0328_wca_multiple_teams.sql`、`0329_cubicle_roster.sql`，同步 migration README、`/dev/schema`、WCA PG fixture 与导入记录。迁移正文 SHA-256 逐字节不变，已应用迁移不动；未执行任何生产迁移。证据：`review-round2/migration-renumber.json`。

### 实证问题与修复

- 课程权限：零价邀请/管理员授权课程原先可从订单绕过报名规则。报价与下单统一只出售 `purchase` 模式；其他模式隐藏 404，PG 验证没有订单、明细或权益副作用。
- 地址并发：同时切换不同默认地址原先发生 `40P01` 死锁、一方 500。创建/修改/归档先锁所属账号，再锁地址；锁模式与幂等记录 FK 兼容，并发操作成功且恰有一个默认地址。
- 课时可见性：父课程草稿/归档时，已发布课时原先仍可答题并拿到解析。共享课时入口检查父课程 `published/unlisted`；答题、课时状态、进度、笔记均拒绝隐藏课程，个人历史保留。
- 会员并发：首次授予时不存在行，原 `FOR UPDATE` 无法串行化，两个成功购买仅发一个周期。结算、兑换、退款重算共用用户级事务锁；购买+购买、兑换+兑换、混合竞争验证累计两个周期、账本首尾相接。
- 退款后重新开通：追加四种退款/购买/兑换竞争场景又复现了已撤销会员沿用旧到期日、多发已退款时长的问题。购买和兑换共用 `membershipPeriodBase`，已撤销会员重新起算并重置生效时间；两个锁顺序都验证无死锁、退款 409 完整回滚以及最终权益/账本一致。
- 混合购物车：支付回调之间、支付回调与全额优惠零元订单之间，会员/商品行顺序相反时均实证 `40P01`。报价、结算、退款统一在库存操作前取得用户级事务锁；报价使用明确事务，两个真实接口竞争回归通过。
- 退款后的有效区间：剩余未来兑换权益不再永久标成过期，按时间自然生效；邀请 A→购买 B→邀请 C 退掉 B 后，不再用最早/最晚时间跨过中间已退款时段。报价和会员页面共用 `membership-access.ts` 的未冲销账本区间规则，兼容无 ledger 的旧会员。真实 HTTP 验证空档拒绝会员价、进入 C 后恢复；Web 的未来有效权益显示“尚未生效”。
- Web 身份隔离：学习中心、机构列表、机构工作区、学员工作区按账号/资源重新挂载，清除旧身份的列表、角色和草稿；迟到兑换响应不能在切换页面/账号后导航；学习路径忽略取消后的结果并清除旧错误。
- 隐私入口描述：改为当前实际的隐私政策入口，不再承诺已经不存在的可选事件开关；没有改变采集策略或遗留 consent API。
- 表单草稿：追加检查保存期间继续编辑、回退至旧值和服务端刷新，QR 资料与普通领域表单复用草稿保护；最终结果见下方 Web 验证记录。

后端失败→通过证据见 `review-round2/backend/review.md` 及 `*-before.log`；Web 记录见 `review-round2/web/REVIEW.md`；媒体/视频独立审查见 `review-round2/acceptance/verification.md`。普通权限和 SQL 场景已自动验证，不再笼统交给用户。

### 自动验收与持续检查

| 检查 | 本轮结果 | `review-round2/` 下证据 |
| --- | --- | --- |
| 迁移唯一性、API/schema 清单 | 12 项通过，原冲突失败已消除 | `schema-api-contracts.log` |
| WCA 两份迁移真实 PG | 5 项通过 | `wca-migrations.log` |
| Platform 后端完整定向组 | 26 文件、207 项通过，无跳过 | `backend/platform-tests-final.log` |
| 最后交易/会员修复 | 完整 commerce PG 与相关会员/退款共 6 文件、71 项通过，无跳过；累计独立覆盖 214 项＝原 207＋4 退款竞争＋2 混合订单竞争＋1 空档案例，未重复无关领域 | `backend/commerce-membership-final.log`、`backend/review.md` |
| 最后独立权益复核 | 三项末审无阻断；同一 PG 生产 SQL 复查空档权限由 true 变 false，与未冲销 grant 一致 | `acceptance/membership-refund-gap-after.log`、`acceptance/verification.md` |
| 教务 PG | 五组 fixture、daily-board 五场景通过 | `acceptance/teaching-*.log`、`acceptance/daily-board.log` |
| 账号删除升级 | 0167→0168、57 个账号 FK/48 表清理与历史保留通过 | `acceptance/account-deletion.log` |
| 身份与媒体 | 9 项通过：真实权限 SQL、签名、文件读取、206/HEAD/416、篡改/过期/跨课时拒绝 | `acceptance/access-media.log` |
| 赛事与视频监督 | 既有 39 项通过；PG 订单/签到/视频凭据 5 项通过；JWT 使用实际 SDK | `acceptance/video-existing.log`、`acceptance/competition-video-pg.log` |
| 后端独立交叉回归 | commerce/learning/access-media/competition 四文件、39 项通过，无跳过 | `acceptance/peer-regression.log` |
| 产品分析 PG | 4 项通过；随机 schema 隔离，允许 CI loopback 测试库 | `product-analytics-final.log` |
| Platform/教务 Web | 22 文件、230 项通过，含真实组件操作与保存期回退 | `web/client-platform-teaching.log` |
| 浏览器角色 | Chrome 学员、监护人、讲师、管理员四角色通过，无 pageerror；监护人 390px 无横向溢出 | `web/browser-roles.json`、`web/browser-*.png` |
| 草稿修复后浏览器复验 | 管理员列表→新建→提交及金额换算通过 | `web/browser-admin-after-drafts.json` |
| 未来会员状态文案 | 现有会员相关 5 项通过，最终 Web 类型检查通过 | `web/REVIEW.md` |
| CI 接线契约 | 31 项通过，workflow YAML 语法通过 | `workflow-contract-final.log` |
| API 打包 | Node22 ESM 主入口 bundle 通过，未启动 API 或部署 | `api-bundle.log` |
| 最终类型检查 | API 非增量 tsc、Client tsgo 均通过 | `backend/typecheck.log`、`web/typecheck.log` |
| 架构/冗余/差异 | 架构边界、Knip files/dependencies/unlisted/binaries、任务范围 diff 检查通过 | `boundaries-final.log`、`knip-final.log`、`diff-check.log` |

各组有重叠，不相加冒充不重复覆盖。新增浏览器角色使用隔离测试身份，所有 `/v1`、`/api` 流量由 fixture 接管，其他外部请求阻断；管理员真实表单验证 12.34 元提交为 1234 分，但不会向生产创建课程。媒体使用实际本地文件与签名，LiveKit 真实签名/验证，房间网络与会话认证为 fixture；不代表摄像头画质、真实网络或真实支付通过。本地 PG 为 16，CI 配置为 13，后者尚未运行。

`.github/workflows/test.yml` 已为原 PG 服务补齐 commerce、learning、media、competition、product analytics 及本轮重新编号的 WCA 迁移测试所需的显式数据库变量，并加入五组教务 fixture 与 daily-board SQL。独立 schema 与事务清理隔离测试数据，新增 workflow 契约避免这些检查再次静默跳过。未增加原生构建、未触发 Actions。

全仓 Knip 曾报告一个与本轮拆分无关、在任务开始前已无引用的 `assistant-text-reveal.ts`。核对 HEAD 与当前所有引用后仅删除该孤立文件，原内容备份为 `review-round2/assistant-text-reveal.before.ts`；没有扩大为 Assistant 重构。其他任务修改均保留。

所有 PG 检查结束后，已关闭本轮端口 55439 的专用 cluster，证据为 `review-round2/pg-stop.log`。原 3000 开发服务保留，未运行 Next build。任务路径清单 `files.json` 已补入本轮文件；它记录涉及路径，不代表可整文件提交其他任务已有修改。

## 发布与人工验收边界

- 当前代码仅本地修改，未 commit/push，未部署，未执行生产迁移。
- 第一轮 migration 冲突已在追加授权中解决；未执行生产迁移。各项本地检查与后续 CI 发布结果分别记账，不用本地通过代替未运行的 CI。
- 真正需要真人参与的项目：①实际商户付款、退款与讲师到账核对；②两名真实用户通过线上 LiveKit 使用摄像头/麦克风，检查断线恢复与监督画面；③训练/比赛需要时连接实体智能魔方或计时器；④用已经印出的旧卡片及实际印刷尺寸扫码，确认目标和可读性。
- 发布、生产迁移和线上只读复验属于后续发布流程，可在获得发布指令后继续自动完成；不把它们转嫁成必须由用户手工执行的任务。第三方登录若触发验证码或账号确认，届时再单独请求用户参与。
- 历史数据/印刷品限制仍保留于 `platform-completion-tracker.md`，本地 fixture 不替代真实业务事实；已在该文档补上当前跟踪入口与 CI 状态，未覆写历史发布记录。
