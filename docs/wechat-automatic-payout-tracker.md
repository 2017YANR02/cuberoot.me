# 微信佣金自动提现接入跟踪

更新：2026-10-27（2026-10-26 开始实施）。本地实现，未提交发布、执行生产迁移、配置商户或真实转账。负责人已确认 CubeRoot 的商家转账产品开通且「佣金报酬（1005）」适用。Mira 同期实现，共用 App Foundation payments 0.1.3。

## 用户与财务入口

- 网站 `/{lang}/instructor/earnings`：默认微信，保留银行卡；显示可申请佣金与本人提现记录，支持申请及刷新。微信账户从小程序绑定，不接受网站手填任意 OpenID。
- 微信小程序「账号 → 佣金提现」：本人微信登录身份核对、姓名/收款同意、申请提现、官方确认收款、提现状态；每 30 秒前台读取和下拉刷新。
- 财务既有讲师结算管理：微信草稿「审核并转账」，处理中「核对微信结果」。银行卡仍用原人工结算；微信记录禁止人工标记到账或用人工失败释放预留。
- 讲师主动申请与财务生成结算单共用 `createInstructorPayout`，事务锁定本人讲师、全部未分配的有符号收益流水。金额/收款方式变更时拒绝旧展示快照，避免重复申请或忽略负向退款流水。

## 协议与状态

迁移 `core/apps/api/migrations/0296_wechat_instructor_payouts.sql` 新建独立转账尝试表及不可变单号/终态约束，不更改历史账本。未取得微信终态前，数据库阻止账号注销清除原收款快照；已结清历史记录按既有隐私策略处理，列表兼容已清除资料。

审核前检查可用收益、退款、身份及配置。财务批准后保存原单与收款快照，再发起转账；确认微信 SUCCESS 才更新 paid，FAIL/CANCELLED 才释放原流水占用。通知仅触发验签原单查询；小程序成功回调不作为到账凭证。

60 秒分页恢复处理已批准但未发送、已发送未结束记录。仅在签名查询返回不存在或 ACCEPTED、首次发送后 24 小时内且距上次发送超过 60 秒时允许同单重发；保持金额、收款人、AppID、商户号及 out_bill_no。超时、配置变化和未知结果不新建转账、不释放占用。退款发生在转账处理中时继续核对原结果，不以内部失败状态代替微信到账结果。

## 所需配置与发布顺序

API 独立配置：

| 配置 | 要求 |
| --- | --- |
| `WECHAT_PAYOUT_ENABLED` | true 开启绑定、申请、审核与原单补发 |
| `WECHAT_PAYOUT_RECOVERY_ENABLED` | true 开启后台原单恢复/查询 |
| `WECHAT_PAYOUT_APPID` | 必须等于现有 `WECHAT_MINI_APP_ID`，绑定及收款都属于同一小程序 |
| `WECHAT_PAYOUT_MCHID` | 必须等于现有 `WECHAT_MCHID` |
| `WECHAT_PAYOUT_MIN_FEN` / `WECHAT_PAYOUT_MAX_FEN` | 该商户已批准的实际单笔整数分限额；最低不得小于 10 分 |
| 现有 `WECHAT_API_V3_KEY` / `WECHAT_CERT_SERIAL` / `WECHAT_PRIVATE_KEY` / `WECHAT_PLATFORM_PUBKEY_ID` / `WECHAT_PLATFORM_PUBKEY` | 复用现有直连商户签名、解密和验签配置，不输出密钥 |
| `PLATFORM_DATA_ENCRYPTION_KEY_V1` | 既有收款资料加密密钥，未结清历史快照仍须可解密 |
| `PUBLIC_API_ORIGIN` | HTTPS API 外部来源；默认 https://api.cuberoot.me |

回调地址：`https://api.cuberoot.me/v1/platform/payouts/wechat/notify`（自定义 API 来源时相应调整）。回调不要求用户登录，但必须通过微信签名及解密、原单查验。

待本批授权后：核对本商户 AppID 绑定、安全 IP、运营账户资金及 1005 场景额度 → 应用 0296 迁移 → 发布 API/Web 及对应小程序版本 → 配置并启用 → 负责人真实小额到账验收。保留读取/回调与恢复配置处理已有尝试，关闭新申请不能清空既有资金义务。迁移不能在存在转账记录时直接删表回滚。

当前申请完整可用 CNY 余额；超出微信单笔额度时明确拒绝，引导调整商户额度或改用银行卡，不自动拆单绕过限制。其他币种历史结算仍走原路径，列表按真实币种显示。

## 公共包与验证边界

固定 `core/vendor/app-foundation/app-foundation-payments-0.1.3.tgz`，SHA-256：`f65332dfb9fc6c66714a08116d07d498db3f460b544b784ff34d1e07c104ed7d`。与 Mira 字节相同；无跨仓库运行时路径或共享数据库。

API/Web/小程序 TypeScript 编译及小程序必要构建均通过，差异检查通过；未主动运行测试、浏览器验收或真实转账。未执行生产迁移、推送部署、上传/送审/发布小程序。商户权限由负责人确认，生产运行配置与到账尚无证据，不能宣称上线。其他工作树修改保留，未纳入本功能交付。
