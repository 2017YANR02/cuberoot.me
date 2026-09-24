# 邮件与验证码接入及账号事务跟踪

## 2026-09-23：短信传输包接入

`@app-foundation/sms` 0.1.1 已通过固定的 v0.3.1 GitHub Release URL 和 lockfile 完整性接入 API。`utils/sms.ts` 保留原环境变量、`smsConfigured()` 和 `sendSmsCode()` 契约；标准阿里云 Dysmsapi 请求由共享包生成，本站仍负责验证码、冷却、账号状态与核销。共享包不读本站环境或数据库，不自动重发；供应商受理不代表手机送达，也不等同 PNVS 验证。

本地定向短信适配测试 3 项、API 类型检查及冻结锁文件安装通过；`/dev/auth` 已复核为流程不变。未用真实凭据或手机联调。CubeRoot 其他在途改动不属于本切片，实际部署与收码验收须独立记录。

更新：2026-09-19。本次先修 CubeRoot 自己的邮箱认证事务，随后在共享仓库另行获准发布 v0.2.0 后接入固定发行包；不依赖未发布包，不替换既有摘要、不合并账号系统。不读应用环境文件、真实数据库或发送真实邮件。本批未提交、push 或部署；最终提交/发布状态由主任务另行记录。

## 第一切片：邮箱闭环

- `0243_auth_code_delivery.sql` 为 `auth_codes` 添加 `delivery_status`，仅 pending/sent/failed。旧行默认 sent，原 64 字符摘要、有效期和核销信息保留。CubeRoot 的摘要列是 TEXT，没有 64 字符列宽限制；本批没有启用共享 `v1$` 新格式。
- `issueCode` 默认在 PostgreSQL 事务内执行，并按 channel/target 的事务 advisory lock 串行化冷却检查、旧码失效和新码插入；覆盖初次发码没有可锁行的情况，冷却跨 purpose 保持原语义。显式 QueryRunner 必须来自调用者自己的事务，现有 identity-choice 调用满足此约束。
- 邮箱登录与绑定发码先存 pending，发送在事务外进行，成功只按原 ID 把仍有效、未被替代的 pending 激活为 sent。失败保留 failed；数据库故障无法写 failed 时，pending 仍不可用。没有自动重发，失败继续遵守原 60 秒冷却。供应商接受不代表邮箱实际收到。
- 通用验码只接受 sent，失败次数在行锁下累加，第 5 次失败同时核销；严格检查存储摘要形状。旧算法与 pepper 配置保持不变。`consume:false` 的内部预检查仍保留。
- 邮箱 `/auth/email/verify` 的核销与现有账号登录/更新或新账号选择票据插入共用事务；绑定和换绑同样共用事务。业务冲突和数据库故障回滚成功核销，错误验证码的计数则正常提交。没有把设备记录和 JWT 签发变为数据库内副作用。
- 邮件传输不再读取/抛出供应商响应正文，网络异常使用稳定分类，路由日志不打印嵌套异常。中英文模板、默认发件人、自定义退订头、可选服务配置保持；下方第二切片已采用共享 transport 的合法 message ID 要求，不能沿用旧的任意 2xx 都成功判断。

## 第二切片：已接入发布的共享包

`core/apps/api/package.json` 与 `core/pnpm-lock.yaml` 固定两个完整发行 URL 及 SHA-512：

- messaging：`https://github.com/2017YANR02/app-foundation/releases/download/v0.2.0/app-foundation-messaging-0.1.0.tgz`
- verification：`https://github.com/2017YANR02/app-foundation/releases/download/v0.2.0/app-foundation-verification-0.1.0.tgz`

两包版本均为 0.1.0，发行集合为 v0.2.0，保留 GPL-3.0-only 来源许可。既有 payments v0.1.0 的 URL 和完整性摘要未变化。`pnpm install --offline --frozen-lockfile --ignore-scripts` 已通过；没有本机路径、软链接或不存在的发布地址。

- `email.ts` 现在通过已安装的 `createResendClient` 发送，保留原 `Promise<void>` 导出、模块加载时的环境配置、默认发件人、品牌/语言模板和通知退订头。成功必须是合法 message ID；空 204、畸形 2xx 属于结果未知，既不报告发送成功，也不自动重试。邮箱 challenge 保持不可验证（failed 或无法落状态时 pending），这不证明供应商没有发送。
- `account.ts` 消费已安装的验证码数字生成、严格十六进制比较及毫秒冷却函数。业务用途、发送状态、PG 锁和账号操作留本应用；数据库提供时间，明确转换为安全毫秒数。`hashCode` 的原 SHA-256 序列及 pepper 配置保持不变，当前未使用共享新 HMAC 格式或替换历史验证码。
- 新 transport 回归覆盖供应商/网络异常脱敏、合法接受、畸形 2xx、不自动重发、原配置生命周期及邮件头注入。真实 PG 回归另证明畸形 2xx 不会激活 challenge，旧 hash 仍可验证。

## 验证与复现

从 `core/` 运行：

```sh
node apps/api/scripts/test-email-code-auth.mjs
pnpm --filter @cuberoot/server exec vitest run tests/identity_choice_routes.test.ts tests/notify_dedup.test.ts tests/email_transport.test.ts
pnpm --filter @cuberoot/server typecheck
pnpm --filter @cuberoot/client exec vitest run tests/dev-schema-api-drift.test.ts
pnpm audit:boundaries
```

runner 只在 `/tmp/cuberoot-email-code-fixture-*` 新建 PostgreSQL 16 实例，使用随机 loopback 端口、email_code_test/identity_choice_test 两个独立空库及合成配置。网络发送全部注入 fake fetch，结束会停止自己的 PG，保留隔离日志供审阅。普通全量测试未开启显式 PG 标志时会跳过数据库组，不能把跳过计为事务验收。

新邮件 PG 用例覆盖：真实旧表升级与旧码验证、pending/failed 不可用、10 路并发首次发码、跨用途冷却、迟到/过期发送、发送期间无法验码、失败与不自动重试、数据库激活故障、并发猜码上限、账号选择写入故障、一次消费、已有账号与 existingOnly、绑定冲突/故障、换绑回滚、短信和内部 challenge 兼容。另运行原 identity-choice 全部真实 PG 回归；路由单测和 transport 脱敏另行验收。

接入固定发布包后最终本地实证：邮件 PG 17 项、原 identity-choice PG 55 项、邮件 transport 5 项通过（runner 共 77 项，其中 72 项真实隔离 PG）；隔离实例已停止。路由/通知/邮件组合 60 项通过（与 runner 重叠 5 项 transport，不重复计数）；schema/API 漂移 6 项、API typecheck、离线 frozen-lock 安装、diff 检查和架构边界均通过（205 identities/219 occurrences/16 manual contracts）。补充等待行锁之后重查过期时间，避免长时间锁等待继续接受已过期码。没有 CI、上线、实际收件或生产迁移证据。

## 发布和回滚前置

1. 先部署 additive migration，再启用对应代码；发布时排空旧无锁发码进程，混合版本期间不声称已经完整保证发码串行化。
2. **不能直接回退到忽略 delivery_status 的旧验码实现。** 旧代码会把 pending 当作可验证行。回滚版本需保留 sent 过滤，或者停止新发码并等待所有未过期 pending 失效后再回滚；不删除或臆造旧码状态。
3. 旧行默认 sent 是兼容原状态，不能据此证明历史发信成功。历史记录没有足够信息补写发送结果，本批不猜测或批量清理。
4. 数据库备份、迁移恢复、staging 流程和实际收件验收独立于本地 PG 测试。没有从共享库发布推断 CubeRoot 已上线。

## 后续切片

- 短信：当前仍按原 sent 发行，外部发送失败激活问题尚未迁移；通用发码/验码锁已改善，但短信路由的发送生命周期及登录/找回密码/绑定/换绑与核销事务需分别补齐。
- 账号合并：`/auth/account/merge` 仍先核销后调用 mergeAccounts。需先审阅全部合并事务和不可逆同意边界，再做专门故障/并发测试；本次没有机械改写。内部 identity-choice 已有事务与 consume:false 语义，本次回归保持。
- 共享邮件正式运行依赖已在本地接入固定发行包，部署与实际送达尚未完成。未来升级继续要求新不可变版本、完整性校验及双消费者回归，不覆盖发行资产。
- 共享验证码新格式：明确版本字段/分支、保留旧算法至旧码自然过期、持久绑定现有 challenge ID，并在应用边界处理秒/毫秒。当前旧 hash/pepper 不变；不通过猜算法回退兼容。
- 实际邮件/短信送达、供应商产品开通和发布，分别取得授权并记录证据；不以单元测试替代。

## 主任务复核

主任务已逐项复核邮件账号事务、迟到发送激活、旧摘要兼容、锁后的过期重查和固定依赖；未发现需阻断本地提交的新增问题。同步 `/dev/auth` 中英文发信/邮箱登录/绑定节点及源码指纹，明确短信/账号合并尚未迁移。auth-doc-sync 与 auth_flow_documentation 合计58项通过，指纹覆盖154文件。应用仍未部署、未真实发信；shared Release 的发布不触发本仓库上线。

## 2026-09-19 发布前 rebase 核对

已合并远端 `c24c369ee`，保留微信 WCA 短期票据绑定、原生分享与邮箱发送/核销事务两组流程；重新核对登录说明的 165 个源码文件。未发布的邮箱迁移顺延为 `0243_auth_code_delivery.sql`，避开远端 0240–0242，历史迁移不改。架构守卫新增的两条依赖只属于已审阅的隔离 PostgreSQL 测试 runner，同步精确数量断言，不放宽生产依赖边界。支付/登录相关 126 项及隔离 PG runner 77 项通过；真实收件和微信设备验收仍独立待办。
