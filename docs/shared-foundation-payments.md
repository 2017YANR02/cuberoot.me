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

## 既有会员结算阻塞：生产发布前必须处理

以下是此次审阅发现的既有 `membership` 业务问题，不是共享包已经解决的能力，也不是已确认发生过的线上事故。本次仅记录，未修改结算代码。它们阻止将本次依赖切换直接视为可安全部署的完整支付闭环。

### 1. 支付结果没有与本地预期完整匹配

源码位置：

- `core/apps/api/src/routes/membership.ts:622–643`：主动查单取得 `remote.paid` 后调用 `settlePaidOrder`。
- 同文件 `:677–699`：支付宝通知校验通过后按 `out_trade_no` 调用结算。
- 同文件 `:703–725`：微信通知校验通过后按 `outTradeNo` 调用结算。
- 同文件 `:802–817`：`settlePaidOrder` 更新条件仅为订单号及 `status = 'pending'`，没有比较 `amount_cents`、币种、订单 provider、交易号归属或商户快照。

共享包只知道已配置商户和收到的金额，不知道本地会员订单应收多少。即使通知真实，金额字段合法也不证明它匹配该订单。后续应从本地不可变支付尝试/订单快照加载预期值，先验证 provider、商户/应用、订单号、交易号、币种及整数分金额，再在同一事务内转状态；退款同样跟随原支付身份。需要错金额、错 provider、错币种、错订单、重复/冲突交易号的负面测试，不能只跑付款成功路径。

### 2. 订单置为已付款与会员权益发放不是原子操作

源码位置：

- `core/apps/api/src/routes/membership.ts:806–815`：先执行 `pending → paid` 更新。
- 同文件 `:819–831`：随后另查套餐，再调用 `grantMembership`；找不到套餐只记录错误并返回。
- 同文件 `:229–276`：`grantMembership` 独立查询到期时间并 upsert 会员，没有与订单状态更新共用事务/行锁。

如果订单更新后进程退出、套餐查询或会员写入失败，重放通知看到订单已为 paid，就不会补发权益。多个独立订单并发延长同一会员时，当前读到期时间再写入的顺序也需要明确锁与幂等规则。

后续应将订单状态、通知/交易去重及权益发放放入同一数据库事务；若采用 outbox/权益任务，必须持久化任务、唯一去重并提供可重试恢复。补充故障注入、通知重放、并发支付/延长和恢复测试；不能因共享包测试通过就跳过这层验收。

## 后续状态

- [x] 独立公共仓库、精确版本包与来源声明。
- [x] CubeRoot 本地 consumer 适配及上述隔离验证。
- [x] 本仓库依赖与锁文件指向固定公开发行文件。
- [x] 最终发行 URL 安装、匿名下载 SHA-256/锁文件完整性一致，以及 release 依赖下的 40 项测试复核。
- [ ] 修复会员预期付款匹配及原子权益结算，并完成故障/并发测试。
- [ ] 获得本次明确发布授权后，再按各服务流程部署和验证。
- [ ] 独立确认商户产品权限、真实支付、回跳查单及退款到账。
