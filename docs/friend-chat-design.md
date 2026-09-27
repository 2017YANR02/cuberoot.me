# 好友轻量聊天设计

状态：`ACTIVE — DESIGN PROPOSAL`。日期：2026-09-27。

本文完成代码分析与实施设计，尚未实现、迁移、部署或取得设备验收。需求是给现有好友系统增加轻量交流能力，业务逻辑与界面放在共享层。共享范围暂按 CubeRoot 仓库内的网站与五端确定；尚未收到将它抽到跨项目 app-foundation 的确认。

## 1. 推荐方向与范围

首版采用**已接受好友之间的一对一纯文字聊天，共享契约和状态控制器 + 共享 React 界面 + 现有 Hono/PostgreSQL**。接收消息使用前台短轮询，沿用网站好友页作为六个 surface 的统一入口。

最小可行路径就是普通 HTTP 发消息、游标拉消息、服务器保存历史；本方案直接选用这条路径，不增加 IM 服务、Redis、消息队列、WebSocket 连接或第三方账号。预估实现涉及 25–35 个源码、测试和配置文件，超过 8 个文件；主要工作量在并发/权限测试及共享包接入，不能把它当成仅增加一个输入框。源码与本地验证按约 4–6 个工程日估算，设备验收另行记账。

首版包含：好友发消息入口、会话列表、纯文字与换行、历史分页、未读数量、发送中/已发送/失败重试、删除好友或拉黑后禁止继续发送、站内通知入口。普通账号可用，不要求 WCA 身份或会员。

首版不包含：群聊、陌生人私信、图片文件、语音视频、富文本/Markdown、链接预览、正在输入、在线状态、向对方展示已读回执、编辑/撤回/逐条删除、离线发送队列、原生后台推送、端到端加密。小程序不是五端 React 宿主，本次不增加小程序聊天页面；未来可消费同一运行时中性契约。

关键假设：轻量交流接受会话内正常网络下约 3 秒的接收等待，不要求 App 退到后台或退出后及时提醒。如果后台送达或亚秒响应成为硬要求，应单独扩展推送/实时传输，仍保留本文的持久化、鉴权和游标协议。

## 2. 已核对的代码事实

下列路径均相对仓库根。

| 事实源 | 当前行为 | 设计结论 |
| --- | --- | --- |
| `core/apps/api/src/routes/friends.ts`、迁移 `0175_friends.sql` | 无向好友对、pending/accepted、双向拉黑校验；关系写入按 UID 排序锁两个账号行 | 复用关系事实源及相同锁序，不另存一套聊天好友状态 |
| `core/packages/client/app/[lang]/friends/page.tsx`、`lib/friends-api.ts` | 好友/申请/黑名单、搜索、WCA 联系人；目前是 Web 私有实现 | 在已有页面挂载共享聊天；仅 accepted 注册用户有发消息按钮 |
| `core/apps/api/migrations/0178_wca_friend_contacts.sql` | 未关联账号的 WCA 选手只是单方联系人 | 这些联系人不能建立会话或发消息 |
| `core/packages/app-ui/src/App.tsx`、`platform.ts` | 五端「我的」加载 canonical 网站账号 surface；非当前 surface 使用 hidden 保留 iframe | 沿既有账号→好友导航使用同一聊天界面，不新增第四个底部栏目；必须测试隐藏 iframe 不误标已读 |
| `core/packages/shared/src/timer/net-battle.ts` | 已有运行时中性 DTO、校验、注入 transport/URL 的客户端模式 | 聊天沿用该分层方式，不引用 client 的 auth-store 或 Next |
| `core/apps/api/src/routes/teaching_saas.ts` 的 `appendConversationMessage`、`markConversationRead` | 教学会话按会话分配序号、独立已读游标、事务写消息与通知 | 沿用机制；机构/学生/监护人授权、教学表和 platform 幂等表不适用于好友域，不能直接复用这些业务对象 |
| `core/apps/api/src/routes/feedback.ts` | 反馈回复是公开对话 | 不可作为私聊存储或授权后端 |
| `core/apps/api/src/utils/notify.ts` | `notify()` 插入通知后可能发邮件 | 聊天直接在消息事务中聚合站内提醒，不逐条调用会发邮件的入口 |
| `core/packages/client/components/DeskPet.tsx` | 通知在挂载、页面恢复可见及每 90 秒刷新 | 复用现有全站提醒，不能声称全站通知是 3 秒实时到达 |
| `core/apps/api/src/utils/app_user_auth.ts` | 将登录凭证解析成 canonical `app_users.id` | 身份来自服务器，客户端不传发送人 UID |
| `core/apps/api/src/utils/account_merge.ts` | 通过数据库外键枚举拒绝暂不支持合并的业务数据，返回 linked_data；好友域也在此边界内 | 聊天首版延续此规则，不悄悄合并或丢弃历史 |
| `core/apps/api/src/utils/account_delete.ts` | 私有数据清理与所有权漂移守卫 | 新表必须登记注销语义并跑现有守卫 |
| `docs/shared-foundation-auth.md` | 已安装的 `@app-foundation/messaging` 用于邮件传输 | 它不是现成的好友 IM，首版无需改动它或发布新的外部包 |
| `.github/workflows/deploy_next.yml`、`test.yml` | 网站部署与 client 测试当前未把 app-ui 列为输入 | 网站新增共享 UI 依赖时，同步补路径监听，避免共享界面单独变更不触发网站更新 |

遵守 `docs/cross-platform-app-contract.md` 与 `docs/mobile-three-tab-contract.md`：shared 不含 React 页面/数据库，app-ui 不反向引用 client，宿主不复制业务 UI。本设计与现有分层不冲突。

## 3. 共享层归属

```text
网站 /friends 路由（Next、nuqs、账号和 API origin 适配）
          │
          ├── @cuberoot/app-ui/chat（唯一 React 聊天界面）
          │             │
          └── @cuberoot/shared/chat（契约、客户端、状态控制器）
                        │ HTTP + Authorization
                 Hono chat route / repository
                        │ 事务
                 PostgreSQL + 站内 notifications

五端 app-ui「我的」── 现有在线账号 surface ── 网站 /friends
```

- `core/packages/shared/src/chat/`：DTO、错误码、长度/游标校验、HTTP client、消息归并、幂等 key 生命周期、轮询与请求代次控制器；公开 `@cuberoot/shared/chat`。不依赖 React、DOM、Next、Node 或本机存储。HTTP、鉴权头、URL、时钟/调度和 UUID 由消费者注入；不维护第二份 token。
- `core/packages/shared/src/friends.ts`：将已有 `friends-api.ts` 的好友 DTO 移到这里；原模块继续 re-export，聊天复用相同用户摘要，不另造不兼容头像字段。公开 `@cuberoot/shared/friends`。
- `core/packages/app-ui/src/chat/`：`ChatPanel`、会话列表/消息列表/编辑框及 React 绑定。公开独立 subpath `@cuberoot/app-ui/chat` 和 `@cuberoot/app-ui/chat.css`，不经根入口加载整个计时器 App，也不导入全局 app.css。
- `core/packages/client`：仅负责 `apiUrl()`、`authHeaders()`、登录、语言、nuqs、现有头像/链接组件的 render slot、页面可见性适配。不得再实现第二套消息 reducer 或请求循环。
- `core/apps/api`：`routes/chat.ts` 接 HTTP，`utils/chat_repository.ts` 承担权限、事务、SQL。两者消费 shared 契约；数据库逻辑不进 shared。
- 从 friends route 提取现有无向 pair 与按序锁账号方法到 `utils/friend_relationships.ts`，供好友和聊天共同使用，保留现有好友响应形状和通知行为。

网站在 `package.json` 增加已有 workspace 包 app-ui 依赖，在 Next `transpilePackages` 中登记；补两个包 exports/runtime 元数据与 lockfile。五端通过 canonical surface 使用这份共享 UI，不为制造“第二个消费者”在本地壳再加平行聊天页。将来若改为本地承载，仍消费同一公开组件与控制器，不复制实现。

## 4. 产品入口与交互

- 好友列表 accepted 行增加「发消息」。好友页增加「聊天」视图，沿用现有 nuqs `view`：`/friends?view=chats&peer=<UID>`；中文使用 `/zh/friends`。`peer` 只代表目标用户，不能作为鉴权依据。
- 聊天视图桌面显示会话列表和对话两列；窄屏只显示当前层，通过站内链接切会话，浏览器/宿主返回遵循 nuqs history，不手写 history API，不增页面级返回按钮。
- 打开未聊过的好友时只显示空对话，不写数据库；发送第一条才原子创建会话。好友搜索与身份显示复用现有页面组件。
- 内容按纯文本渲染，保留换行，禁止 HTML、自动执行/嵌入和预览请求。桌面 Enter 发送、Shift+Enter 换行；输入法组合态不得发送；触摸键盘 Enter 换行，显式按钮发送。
- 发送时显示本地 pending 项。提交成功后用服务器消息替换；超时/断网显示失败，保留内容和 clientMessageId，用户点击重试。发送成功只表示已写入服务器，不表示对方已收到或读过。
- 用户在看旧消息时不强拉到底；显示「有新消息」入口。加载更早历史保留滚动位置。仅当前对话可见、最新消息已渲染到可见区域时推进本人已读游标；发送自己的消息不自动清掉尚未看过的来信。
- 同一账号跨设备共享历史和已读位置；草稿、pending/failed 项仅保留在当前内存会话。退出/切账号清空它们；不把聊天正文写入 localStorage、IndexedDB 或日志。

## 5. 持久化设计

新增两个好友聊天专用表，不做通用群聊成员/事件系统。迁移实施时按 migrations 的最新序号分配新文件，禁止在方案阶段占用或改写已发布迁移。历史默认持续保存，直到参与账号注销；没有定时过期清理任务。上线后的消息量与备份增长由现有数据库运维监测，不宣称无限容量。

| 表 | 核心字段与约束 |
| --- | --- |
| `friend_chat_conversations` | `id UUID PK`；`user_low_id`、`user_high_id` 外键→app_users，ON DELETE CASCADE；low < high，用户对 UNIQUE；`last_sequence BIGINT DEFAULT 0`；`low_read_sequence`、`high_read_sequence BIGINT DEFAULT 0`；`last_message_at TIMESTAMPTZ`；游标满足 0 ≤ read ≤ last |
| `friend_chat_messages` | `conversation_id UUID` 外键→会话，ON DELETE CASCADE；`sequence BIGINT > 0`；`sender_user_id BIGINT` 外键→app_users，ON DELETE CASCADE；`client_message_id UUID`；`body TEXT`；`created_at TIMESTAMPTZ`；PK(conversation_id, sequence)，UNIQUE(conversation_id, sender_user_id, client_message_id) |

消息发送人必须是会话参与人，由写入事务校验。所有消息不可变，顺序由会话行锁内递增的 sequence 决定，不用时间戳或全局自增 ID 当作跨事务增量游标。BIGINT 序号在线上 JSON 中使用十进制字符串，shared 统一比较，避免 JS Number 丢精度；UID 沿现有正安全整数契约。

索引：会话 low/high 各建 `(user_id, last_message_at DESC, id DESC)` 索引；消息主键用于历史与增量；补 `(sender_user_id, created_at DESC)` 用于账号发送频控；来信未读查询使用 `(conversation_id, sender_user_id, sequence)`。未读数实际统计对方发送且 sequence > 本人 read 的消息，不能直接 last-read，因为差值包含自己发的消息。首版不额外存 unread_count，以免多端并发维护两套事实。

消息正文统一 CRLF/CR 为 LF，拒绝空白-only、NUL 和不合法 Unicode 标量；最多 2,000 个 Unicode code point，保留其它前后空白。数据库补非空白和 char_length 上限约束；HTTP JSON 请求体上限 32 KiB，覆盖转义字符膨胀。正文不进入通用通知 excerpt。

删除好友/拉黑不删除历史：原参与人仍可查看旧消息，双方均不可发新消息；重新成为好友后复用原会话。解除拉黑本身不恢复好友。会话不外键依赖 user_friendships，防止解除关系误删历史。

注销任一参与账号时，整段双方会话及消息级联清理；这项产品语义须在注销说明中明确，不冒称能收回对方已复制的内容。删除账号行前，在同一事务中取其会话 ID 并清理双方对应 friend_message 通知，不能级联删除后再查会话。新增表登记到注销所有权清单/例外并测试；账号合并沿既有 linked_data 拒绝规则，不允许静默迁移。因为注销说明和覆盖范围变化，同步 `/dev/auth` 说明、指纹及现有 auth 文档测试。

## 6. HTTP 契约

所有路由置于 `/v1/chat`，使用 `requireAppUserId()`；响应包括错误一律 `Cache-Control: no-store`。不得缓存到 service worker，不在 URL 中放 token 或消息正文。无管理员绕过读私信接口。消息是经 HTTPS 传输的服务器明文，不复用私密资料库的浏览器端加密承诺；账号/隐私说明应准确注明存储与删除范围。

| 方法与路径 | 请求 | 响应与约定 |
| --- | --- | --- |
| GET `/conversations` | `limit` 默认 30、最大 100；可选 `cursor` | `items` 包含 id、peer、lastMessage 摘要、lastSequence、myReadSequence、unreadCount、canSend；`nextCursor`。按 last_message_at/id 降序分页，cursor 固定编码这两个值并严格校验；刷新首屏并按 id 去重，动态列表不承诺历史快照 |
| GET `/peers/:peerUserId/messages` | `limit` 默认 50、最大 100；`before`、`after` 互斥，均为序号字符串 | 无游标取最新一页；before 取更旧一页；after 升序取新消息，所有 items 返回升序。带 conversationId、peer、canSend、myReadSequence、lastSequence、oldestSequence、nextAfterSequence、hasMore。accepted 好友尚无会话时返回空列表和 null conversationId |
| POST `/peers/:peerUserId/messages` | `clientMessageId` UUID、`body` | 首次 201，重复同内容 200，均返回同一 canonical message（conversationId、sequence、senderUserId、clientMessageId、body、createdAt）；相同 key 不同规范化正文 409 |
| PUT `/peers/:peerUserId/read` | `throughSequence` | `myReadSequence` 和当前 unreadCount。GREATEST 单调推进；超过 lastSequence 或无会话为 400/404；仅本人的一侧游标可写 |

错误 envelope 固定为 `error: { code, message }`；用户文案按 code 翻译，message 不含 SQL、凭证或正文。代码集合：UNAUTHENTICATED(401)、CHAT_NOT_FOUND(404，非参与者或目标不存在统一)、CHAT_UNAVAILABLE(403，不能向当前目标发送，不泄漏拉黑方向)、INVALID_INPUT(400)、IDEMPOTENCY_CONFLICT(409)、BODY_TOO_LARGE(413)、RATE_LIMITED(429，Retry-After)、INTERNAL_ERROR(500)。不得把 HTML 错误页或畸形 2xx 当发送成功。

对原参与人开放历史/read；无历史的非好友不可读到目标账号资料。pending/outgoing/WCA 联系人/自己不能发送。每次写入重新检查账号未合并、accepted 关系与任一方向的 block，不能仅在打开页面时检查。

## 7. 并发、去重、未读与提醒

发送事务严格按以下顺序执行：

1. 按 UID 升序锁两个 app_users 行（复用好友锁序），确保账号当前有效；查现有会话。
2. 现有相同 clientMessageId 先查 canonical 结果：内容相同返回原消息且不再写入，即使成功后好友已解除也可确认此前送达；内容不同 409。此检查仍要求请求人确为原参与者。
3. 对新的发送校验 accepted/无 block；原子检查发送人最近 60 秒已提交消息 < 60 条。账号行锁使同账号跨会话发送也串行计数，不新增频控表。HTTP 尝试频控另复用 checkRateLimit，分 chat-send 用户桶每分钟 120 次、读请求用户桶每分钟 120 次；该进程内桶不是跨实例持久配额，PG 已提交消息配额才是发送硬边界。
4. 必要时插入唯一用户对会话；锁会话行，递增 last_sequence，再插消息并更新 last_message_at。内容与提醒同事务，任一失败整体回滚。
5. 接收人的 notifications 中 upsert 一条 `friend_message`，dedupe_key=`friend-chat:<conversation UUID>`，link 指向对应 peer，title 为聊天入口，excerpt 为空。更新为未读，只保持每人每会话一行。事务提交后才返回成功。

read 事务也按账号→会话的顺序加锁，推进游标；只有 throughSequence 已覆盖锁定时的 lastSequence，才将本会话提醒标已读，不能清掉并发新消息。清理账号涉及多个会话时按会话 id 排序，避免锁反转。

复用通知页面和桌宠的既有刷新链，新增 friend_message 类型、双语标签和图标；不调用会发邮件的 notify()，不接原生推送。通知的「全部已读」仅代表提醒已查看，不推进聊天消息游标；聊天内 unreadCount 仍以会话为准。明确区分提醒条数和未读消息条数，不把它们加成一个含义不明的数。

发消息与删好友/拉黑竞争：共享账号锁决定先后。如果发送先取得锁并提交，该消息属于关系解除前；如果解除先提交，新发送被拒绝。幂等重试不增加消息、序号、通知或发送硬配额。网络超时后不自动重发，保留同一个 key 供手动重试。

## 8. 同步、生命周期与规模边界

- 活跃会话首次取最新 50 条；之后每 3 秒 GET after=已连续合并的接收游标。hasMore 时立即补后续页，补完再等待，不用服务器 lastSequence 跳过未收到的中间页。单次读取超时 12 秒。
- POST 返回的自己的消息可以立即渲染，但不能直接推进增量接收游标；否则可能跳过同时到达的对方消息。用 conversationId+sequence 去重，并用 clientMessageId 替换 pending 项。
- 会话列表可见时每 15 秒刷新第一页；只串行执行同一种轮询，不允许上次未完又开一次。网络错误退避 3/6/12/24/30 秒，成功归常态；429 尊重 Retry-After；401 暂停并交给既有登录适配，不另建登录流程。
- 文档隐藏、组件不可见或离线时停轮询；恢复后立即增量补齐。Web 可见性适配结合 visibilitychange 与 IntersectionObserver；五端 hidden iframe 的交叉浏览上下文可见性必须实测，不能仅凭 document.visibilityState 自动标已读。没有确认可见的窗口不写 read；初始状态按不可见处理。
- 切会话、退出、切账号取消请求；每个异步结果检查 session generation、UID 和 peer。迟到响应（含旧账号的 401）不能写入新会话或清掉新账号登录。每个挂载聊天 surface 只有一个控制器，多标签可各自轮询，由服务器幂等/游标协调，不做跨标签 leader 选举。
- 最大内存保留 500 条已加载消息；超过后从非当前阅读端释放，可重新分页，不删服务器记录。草稿与失败发送项不混入服务器历史计数。
- 请求量粗估：100 个同时打开对话约 33 次增量 GET/秒，加上可见列表刷新与既有通知；1,000 个会话约 333 次/秒。这只是容量推算，不是性能验收。API 当前 PG pool max=10，需要用真实 query 和 EXPLAIN 核查索引及连接等待。若 100 活跃会话的空增量读取 p95 超过 300ms，先定位查询/连接成本，再决定改传输，不直接放大 pool 或承诺支持千人同时聊天。

接近的替代方案是 HTTP 写入 + Hono SSE 通知失效 + HTTP 补拉。官方 streamSSE 可用，但 bearer 鉴权、代理长连接、宿主挂起恢复与多进程事件广播增加首版成本；当前无需承担。对战 relay 的房间凭证、瞬时状态与生命周期不适用于账号私聊，不接入该通道。

## 9. 实施清单与验证

作为一个端到端交付单元实现；以下是内部顺序，不把“只有表、没有可用入口”的中间状态称为可发布阶段。

1. shared 增加 `src/chat/{index,contract,client,state}.ts`、`src/friends.ts` 和公开出口/runtime 登记；friends-api 改为消费共享 DTO。
2. 新增顺序 migration，同步 `src/db/schema.pg.sql`、`migrations/README.md`；建立 chat_repository/chat routes 并在 index.ts 挂载，提取 friend_relationships 共享锁方法。
3. 新增 app-ui `src/chat/{index,ChatPanel,use-chat,chat.css}`（组件按需要在同目录拆分，不创建独立 package）；接 Web `lib/chat-adapter.ts` 和既有 friends 页；新增共享组件登记 dev catalog，遵循项目颜色、i18n、输入框与弹窗契约。
4. friend_message 通知接入 `utils/notify.ts` 的类型/标签、client `notifications-api.ts`、notifications 页；实际写通知走 chat_repository 的事务。接注销清理与账号合并边界测试，同步 auth 流程图。
5. client 依赖、Next transpile、包 runtime/export、lockfile、网站 CI 输入和 deploy_next 输入同步增加 app-ui。检查 Vercel ignore/build 规则是否遍历 workspace 依赖；shared/app-ui 的孤立修改都必须触发相应测试与网站构建。不扩大 server→client 耦合。
6. 补 `docs/README.md`、跨端合同对聊天源码归属的说明与当前设计状态；若工具产生登记范围内的生成物，按 generated-artifacts 契约同步，不能把源码方案写成已部署。

测试落点：API 新增 `tests/chat_routes.test.ts`、`tests/chat_repository.test.ts` 和 `tests/fixtures/friend_chat_pg.ts`；复用教学消息 PG fixture 的隔离数据库与清理模式，不拷贝教学业务实现。client 新增 `tests/friend-chat-contract.test.ts`，app-ui 的交互/控制器测试放 `src/chat/`，共同覆盖 shared 状态归并与 HTTP 契约。

必须覆盖：

- 两个普通账号申请/接受后聊天，WCA 身份非必需；第三人、自聊、未登录、待接受、已拉黑、未注册联系人均拒绝发送；不能猜 peer/id 越权看历史。
- 第一条并发创建只有一个会话；双向并发消息严格有序；同 key 同内容只一条，同 key 异内容冲突；提交后连接断开再重试不重复。
- 真实 PG 并发发送与删除好友/拉黑/read/注销竞争；消息与通知原子性；发送配额跨会话/并发成立；注销无残留、合并按现状拒绝。
- 初始最新页、before/after 边界、超过一页的补拉、POST 回包早于补拉、乱序/重复响应、BIGINT 序号、空页面和动态会话列表去重。
- 未读排除本人消息，多个设备的较旧 read 不倒退，不因通知全部已读丢消息游标；并发新消息不被旧 read 清提醒。
- 正文上限、中文/emoji/换行、全空白、NUL、不合法 Unicode、XSS 字符串、JSON/HTML 错误响应；请求体超限与限流。
- 401、429、断网、超时、恢复、页面隐藏/隐藏 iframe、不在底部阅读、切账号迟到响应；输入法回车、触摸键盘、草稿/失败态与滚动位置。
- 架构守卫：shared 无 DOM/app import；chat 入口不加载计时器；没有五端私有聊天副本；app-ui-only 修改触发网站测试和部署。

实现后的验证命令（均从 `core/` 执行；新测试文件属于本方案的明确交付物）：

```powershell
pnpm --filter @cuberoot/shared build
pnpm --filter @cuberoot/server typecheck
pnpm --filter @cuberoot/server exec vitest run tests/chat_routes.test.ts tests/chat_repository.test.ts tests/friends_contract.test.ts tests/account_merge.test.ts
pnpm --filter @cuberoot/server exec tsx tests/fixtures/friend_chat_pg.ts
pnpm --filter @cuberoot/app-ui typecheck
pnpm --filter @cuberoot/app-ui exec vitest run src/chat
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run tests/friend-chat-contract.test.ts tests/account_delete.test.ts tests/auth-doc-sync.test.ts tests/auth_flow_documentation.test.ts
pnpm audit:boundaries
```

PG fixture 仅操作它自己新建的测试库，默认本地 PG13 5433/cuberoot_db 为管理连接；测试完成后清理自己创建的资源。必须执行真实数据库并发测试，不能用源码字符串断言替代。

Web 与 Android/iOS/Harmony/Windows/macOS 分别登记双账号发送、历史、弱网、切账号、隐藏 surface、软键盘、安全区和返回导航的证据。按本工作区规则，浏览器自动化仅在用户主动要求后执行；未获得设备/浏览器证据时标记未验收，不以 typecheck 通过冒充五端完成。网站 production build 只在无 dev 共用 .next 时或 CI 中执行。

## 10. 发布与回滚

新增持久化表、注销语义和 push=上线均有实际影响。本轮只有设计文档，不执行迁移、发送测试私信、commit 或 push。实施前按当前授权范围核对数据库变更；上线前单独说明迁移、通知和历史保留语义并获得发布授权。

发布顺序：先上线兼容旧前端的新增表/API，确认鉴权、数据库版本与两账号接口测试，再放出聊天 UI；两个自动部署 workflow 无天然先后保证，需按实际 CI 完成状态控制 UI 发布提交。阶段间旧站继续可用，不通过未就绪接口返回假成功。

回滚应用代码不删新表、不执行 down migration，保留已产生消息；回滚到上线前 API 后新 UI 应显示暂不可用并保留本地未确认发送，随后回滚 UI。通知可能保留指向好友页的聊天 query，旧页应仍能打开。只有单独授权的数据清理任务才能删除聊天数据。无需新增服务、环境变量、密钥、第三方账号或用户安装步骤。

## 11. 本轮依据与待验收边界

已阅读仓库规则、核心 README、跨端合同、好友/通知/教学消息/账号生命周期源码、包配置、相关现有测试与 CI/deploy path filters。仓库未找到额外 CLAUDE.md 或 .claude/rules。

官方能力核对（2026-09-27，页面读取均 HTTP 200）：[Hono bodyLimit](https://hono.dev/docs/middleware/builtin/body-limit)、[Hono streamSSE](https://hono.dev/docs/helpers/streaming)、[PostgreSQL 13 行锁](https://www.postgresql.org/docs/13/explicit-locking.html)。使用现有框架能力，不引入新的聊天 SDK。

本轮只验证方案文件与源码事实的对应、相对链接和 diff；未运行业务测试或性能测试，未访问用户私信、未创建好友/消息、未改数据库。首版范围、3 秒轮询和账号注销删除整段会话均为本设计建议，尚不是用户确认或生产行为。
