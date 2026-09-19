# 共享支付包接入记录

更新日期：2026-09-19。CubeRoot 本地已将官方微信支付、支付宝适配器改为使用独立共享包；本批工作仅作本地提交，未推送或部署，也未操作真实商户配置、支付、退款。共享包公开发布与 CubeRoot 生产发布是两个独立状态。

## 版本、来源与依赖边界

- 仓库：[2017YANR02/app-foundation](https://github.com/2017YANR02/app-foundation)。
- 包：`@app-foundation/payments`，精确版本 `0.1.0`。
- 发行版：[v0.1.0](https://github.com/2017YANR02/app-foundation/releases/tag/v0.1.0)。源提交：`443bdbeab9e4b951fed22608e4abcbe4229eabe9`。
- 安装地址：`https://github.com/2017YANR02/app-foundation/releases/download/v0.1.0/app-foundation-payments-0.1.0.tgz`。
- `core/apps/api/package.json` 固定上述发行文件 URL；`core/pnpm-lock.yaml` 固定同一 URL 和完整性摘要，不依赖本机目录、另一个业务仓库或未发布 workspace 包。
- 当前 lockfile 摘要：`sha512-zLVBAkpOSzXdtlYduCHTgcNRiQZjqrx0kGKGawLnm7iGzXsJMN+6OOIIePy5MLpXq15AWxFgXI6NgCLjqCRwXw==`。后续升级需要显式更换版本与锁文件，不能用相同版本替换发行文件。
- 共享包从 CubeRoot 提交 `e35459d59` 的 `core/apps/api/src/payment/wechat.ts`、`alipay.ts` 及 `core/packages/shared/src/payment.ts` 中必要签名函数提取，保留 `GPL-3.0-only`、LICENSE 与 NOTICE 来源声明；中性命名不改变许可或来源。

共享包只含支付协议、签名验签、通知解析与接口客户端。商户密钥、环境变量、订单、数据库、会员权益及审计记录仍属于各自应用。包内部不读取环境变量，也不包含 CubeRoot 运行时品牌默认值。Node >=22；提供 CommonJS 产物、TypeScript 声明及 ESM 可用的公开入口。

## CubeRoot 本地适配

| 文件 | 变化与保持的边界 |
| --- | --- |
| `core/apps/api/src/payment/wechat.ts` | 使用 `@app-foundation/payments/wechat`；保留原有导出函数和 `WECHAT_*` 环境变量。按调用创建独立客户端，不在模块导入时要求商户已配置。H5 与小程序各自保留显式开关，小程序 AppID 独立核对。 |
| `core/apps/api/src/payment/alipay.ts` | 使用 `@app-foundation/payments/alipay`；保留原有导出函数和 `ALIPAY_*` 环境变量，可选 `ALIPAY_SELLER_ID` 用于进一步限制卖家身份。 |
| `core/apps/api/tests/wechat_payment.test.ts` | 完整合成微信通知、验签/解密、商户与金额结构、独立支付产品开关及查单错误语义。 |
| `core/apps/api/tests/alipay_payment.test.ts` | PC/WAP 收银台签名、通知商户与 `notify_id`、已签名查单原 envelope、退款后查及配置缺失行为。 |
| `core/apps/api/tests/refund_provider.test.ts` | 保持业务层原有退款身份、金额和状态核对回归覆盖。 |

共享客户端提供关单能力，但本次没有新增业务关单流程。Airwallex、Xunhupay、会员页面及平台订单业务未迁入共享包。Mira 与 CubeRoot 不共享账号、数据库、商户身份或资金归属。

### 需要调用方理解的错误与通知语义

- 查单失败现在明确抛错，包括网络失败、无效响应、签名失败；只有经过验证的“订单不存在”才返回 `null`。原 `membership.ts:622–643` 主动查单已在 try/catch 内，失败不会被当作成功结算。
- 支付宝查单现在校验原始响应签名，保留调用方既有 `{ paid, txn, raw }` 结构，`raw` 仍为原响应 envelope。
- 微信通知先验签、解密、核对商户/AppID 与支付字段，再映射为原 `{ ok, outTradeNo, paid, txn, raw }`；失败返回 `{ ok: false }`。
- 支付宝 `verifyAlipayNotify` 保留 boolean 返回值，内部经完整通知解析，核对签名、应用、可选卖家、金额结构和 `notify_id`。事件 ID 使用通知 ID，不能直接以交易号代替所有通知事件。
- 配置不完整时 provider 保持不可用，不在应用启动时构造客户端；H5 与小程序缺少各自产品开关时不发下单请求。
- 共享包确认 provider 响应真实性和字段有效性；应用仍须核对自己的不可变订单/支付尝试快照、预期金额、币种和 provider，并原子、幂等地落实支付结果。

## 本地验证证据

以下命令均从 `core/` 执行，使用生成的测试 RSA 密钥、合成通知与 fake HTTP，不访问真实商户：

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @cuberoot/server exec vitest run tests/wechat_payment.test.ts tests/alipay_payment.test.ts tests/refund_provider.test.ts` | 3 个文件、40 项测试通过。 |
| `pnpm --filter @cuberoot/server typecheck` | 通过，退出码 0。 |
| `pnpm audit:boundaries` | 通过；203 项既有边界记录、217 次出现、15 项人工契约。 |
| `git diff --check` | 通过。 |

上述功能、类型及边界验证先在已审核的 `0.1.0` tarball 上完成。依赖随后切换为上方固定 release URL 并安装完成；2026-09-19 05:18 本地再次运行同一组 3 文件、40 项测试，全部通过。主任务匿名下载发行文件确认 SHA-256 为 `27c2db1db0643ab6ca962cf43c0675d7b77794dedf1eefd81dd701a2082710b3`，与已审核包一致，lockfile 的 SHA-512 也一致。因产物字节未改变，未重复类型与架构扫描。这些证据验证本地依赖与发行产物，不代表 CubeRoot 已部署。

首次执行时旧微信测试使用含下划线的模拟证书序列，不符合共享包配置格式；已将 fixture 改为合成十六进制序列，未放宽校验。支付宝 `notify_id` 缺失测试在旧 tarball 下失败，刷新到审核后的包后通过。以上问题均包含在最终 40 项通过结果中。

未进行真实付款、真机 H5 回跳、退款到账、商户产品权限、历史线上订单兼容、完整会员结算故障恢复或生产环境验证。此记录不代表这些阶段已完成。

## 会员结算后续修复：本地完成

初次提取共享包时记录的两项业务缺口，本轮已在 CubeRoot 自己的后端修复。共享支付库仍不拥有订单或会员数据库；无数据库迁移、历史数据批量更新或生产操作。

### 预期付款匹配

`core/apps/api/src/payment/membership-settlement.ts` 的 `membershipPaymentEvidence` 只接收已经通过 provider 验签/认证的通知或主动查询结果，统一提取支付来源、订单号、交易号、商户身份、整数分金额与币种。`settleMembershipPayment` 随后在订单行锁内核对本地 `provider`、`amount_cents`、`currency`、已有 `provider_txn` 与订单号；错误、缺失或非 pending/paid 状态拒绝结算。已付重复通知也须匹配同一交易，不能用另一个交易号覆盖。

同一 provider 交易号使用事务 advisory lock 串行检查，拒绝把一个支付流水重复关联到两个会员订单；订单已有绑定支付意图时必须与结果一致。金额从 provider 原始十进制精确转换，不使用 `Math.round` 容错入账。

路由接入点位于 `core/apps/api/src/routes/membership.ts` 的 `/membership/orders/:no`、四个 `/membership/notify/*` 及 `settlePaidOrder`。支付宝、微信的已验签主动查单继续补偿通知遗漏。Xunhupay 原主动查询路径没有响应认证，本轮停止使用它改变订单/会员状态；已签名成功回调仍可入账，未知 AppID 不再回退到主商户 secret。

Xunhupay 字段按 [官方付款成功回调说明](https://v3.xunhupay.com/doc/api/pay.html) 核对：`trade_order_id` 是本地订单号，`total_fee` 是人民币元金额，`transaction_id` / `open_order_id` 是支付/平台交易号，`appid` 标识支付渠道，`OD` 表示已支付，`hash` 覆盖回调验签。测试使用这些字段生成合成签名；沿原行为优先使用 `transaction_id`，缺失时兼容 `open_order_id`。此核对没有调用真实支付接口。

### 订单与会员权益原子提交

`settleMembershipPayment` 使用现有 `withTransaction`，在同一个 PostgreSQL 事务内锁订单、核对支付、写入 paid 状态并调用 `grantMembershipInTransaction`。权益写入失败会同时回滚 paid 状态，后续重放可重新完成。套餐行使用共享行锁避免结算期间同时修改。

`grantMembershipInTransaction` 用会员键的事务 advisory lock 覆盖“会员行尚不存在”的首购竞争，并使用单条 upsert 从当前到期时间计算续期；同一会员同时购买两个订单不会丢失一次延长，永久会员不会降级。管理员手动开通也把订单与权益写入放在同一事务，并共用会员锁。

### 实证与复现

新增 `core/apps/api/tests/membership-settlement.test.ts`：33 项通过，其中 7 项纯支付证据校验、26 项真实隔离 PostgreSQL/HTTP 验证。包含错金额、错币种、错 provider、错商户、错订单、绑定交易冲突、同一交易跨订单复用、10 路并发重复回调、同会员并发续期、首购不存在行、手动开通与付款竞争、数据库 trigger 注入故障后整体回滚和重试、永久会员保护、Xunhupay 真实签名格式回调及未认证查询不能入账。

本轮最终验证：

| 验证 | 结果 |
| --- | --- |
| 新结算测试 + `membership-plans-contract` + 微信/支付宝/退款适配回归 | 5 个文件、76 项全部通过；数据库用临时 `initdb` 创建的 PostgreSQL 16，未使用应用开发库或生产库。 |
| `pnpm --filter @cuberoot/server typecheck` | 通过。 |
| `pnpm audit:boundaries` | 通过，203 项既有边界记录、217 次出现、15 项人工契约。 |
| 可复现隔离 runner | 完整启动/建库/33 项测试/停止数据库均通过，退出码 0。 |
| `git diff --check` | 通过。 |

从 `core/` 执行以下命令可独立复现，要求 PATH 有 PostgreSQL 16 的 `initdb`、`pg_ctl`、`createdb` 和 pnpm：

```sh
node apps/api/scripts/test-membership-settlement.mjs
```

runner 在 `/tmp/cuberoot-membership-fixture-*` 创建专用数据库实例，随机 loopback 端口、专用 `membership_payment_test` 数据库，不读取应用 DB 配置。测试结束或失败后停止自己的实例，保留测试数据与日志目录供审阅，不删除用户数据。可追加其余测试文件来复现 76 项组合：

```sh
node apps/api/scripts/test-membership-settlement.mjs tests/membership-plans-contract.test.ts tests/wechat_payment.test.ts tests/alipay_payment.test.ts tests/refund_provider.test.ts
```

已有 CI 专用 PostgreSQL 可通过 `MEMBERSHIP_TEST_DATABASE_URL` 运行同一测试；测试要求地址为 localhost/127.0.0.1 且数据库名为 `membership_payment_test`，每次创建随机 schema 并在结束后移除该测试 schema。未配置此环境变量时，普通测试只运行 7 项纯规则，26 项 PostgreSQL 测试明确跳过；不能把跳过描述为数据库验收通过。

### 未覆盖的历史与发布边界

- 旧 `membership_orders` 没有不可变 merchant/AppID 快照。当前实现对照订单的 provider/channel 与当前已配置商户，微信 AppID 由共享客户端允许列表核对，不能证明某个历史订单原本属于哪个 AppID。切换商户/AppID 前须清点和处理未完成订单；本轮未补写或猜测历史商户信息。
- 旧订单也没有套餐 period/period_count 购买快照。金额使用订单自己的 `amount_cents`，但权益周期仍沿用已有行为读取当前套餐，并在结算事务内锁住；购买后、结算前已发生的套餐周期修改不会被本轮恢复。不可变商品/商户快照是后续独立迁移范围。
- provider 交易复用保护覆盖本次统一结算服务的写入路径；本轮没有新增数据库唯一索引。其他直写 `membership_orders` 的运维脚本不得绕开该服务，历史重复流水应审计后再决定数据库约束迁移。
- 对历史上已经 paid 但漏发权益的记录，本轮不自动回补：缺少足够的历史幂等凭证，盲目重放可能重复延长，需要单独对账取证。
- Xunhupay 主动查询补偿保持关闭，直到有经过审核的响应认证实现；签名回调遗漏须通过可信记录对账，不能重启旧的未验签入账路径。
- 数据库真实事务测试不等于线上验证。真实商户权限、付款、H5 回跳、退款到账、历史线上订单兼容以及部署仍未执行。

## 后续状态

- [x] 独立公共仓库、精确版本包与来源声明。
- [x] CubeRoot 本地 consumer 适配和固定发行文件安装；40 项适配测试、类型与架构验证。
- [x] 最终发行 URL 匿名下载 SHA-256 与 lockfile 完整性一致。
- [x] 本地修复会员预期付款匹配与原子权益结算，33 项新增测试及 76 项组合验证通过。
- [ ] 历史商户/商品快照、异常账单和历史漏发权益的独立审计与迁移评估。
- [ ] 获得本次明确发布授权后，再按各服务流程部署和验证。
- [ ] 独立确认商户产品权限、真实支付、回跳查单及退款到账。

## 2026-09-19 历史订单处理范围补充

负责人说明历史订单量很少，本轮暂缓全量历史对账、付款身份/套餐快照补录及历史漏发权益回补，不作为共享提取或新链路本地开发的阻塞。保留现有订单、付款与权益记录；不删除、不批量标成成功，也不假定不存在差异。若出现个案，再根据原渠道账单和原记录人工核对。此前本地支付结算修复与隔离测试结论保持；本轮无生产数据库操作、真实资金操作或 push/部署。
