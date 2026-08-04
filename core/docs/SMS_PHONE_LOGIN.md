# 手机号登录(阿里云短信)

## 当前状态(2026-08-04)

**全链路通了,真机收到验证码。** 回执实证:

```
SendDate 2026-08-04 22:04:32 → ReceiveDate 22:04:35(3 秒)
SendStatus 3  ErrCode DELIVERED
```

7 月 30 日卡的是运营商实名报备(异步回执 `PORT_NOT_REGISTERED`,阿里云同步照样返 `Code: OK` 并扣费),等了 5 天自己通的 —— 报备完成**不需要重启、不需要改任何配置**。

⚠️ 三家运营商的报备结果目前都是「已报备待验证」,不是终态。短信在发是事实,但后续还有验证环节,签名用途与报备不符仍可能被打回。控制台 → 国内消息 → 签名管理 → 运营商报备结果那一列看。

历史教训留着:**同步 `Code: OK` ≠ 送达**。真出问题时前端会显示成功但永远收不到,因为失败是异步回执,服务端当场拿不到。判据只有 `QuerySendDetails`(见下)。

## 这套东西一直都在

手机号登录**不是新功能**,代码从一开始就是全的:

| 层 | 位置 |
|---|---|
| 登录/注册 | `server/src/routes/account_auth.ts` `/auth/phone/send` + `/verify` |
| 绑定/解绑 | 同上 `/auth/link/phone/*`;解绑走通用 `/auth/unlink/:provider` |
| 短信传输 | `server/src/utils/sms.ts` —— 阿里云 Dysmsapi,手写 HMAC-SHA1,无 SDK |
| 号码规范化 | `shared/src/account.ts` `normalizePhone` / `isValidPhone`,库里存 E.164 |
| 验证码存储 | PG `auth_codes`(migration `0064_user_accounts.sql`),与邮箱同一套逻辑 |
| 前端 | `client/components/AuthPanel.tsx` —— `CodeFlow channel="phone"` |

开关只有一个:`smsConfigured()` 检查 4 个 env 是否齐全,不齐则 `/v1/auth/providers` 返 `phone:false`,前端自动隐藏入口、路由直接 503。**"没有手机号登录"从来不是缺功能,是缺凭据。**

验证码由本站生成和校验(`auth_codes`),阿里云只当传输层。

## 配置

服务器 `/root/core-api/.env`(`node --env-file` 读),4 个变量:

```
ALIYUN_SMS_ACCESS_KEY_ID=…        # RAM 用户 sms-sender,授 AliyunDysmsFullAccess
ALIYUN_SMS_ACCESS_KEY_SECRET=…    # 只在创建时显示一次
ALIYUN_SMS_SIGN_NAME=上海魔方根教育科技工作室
ALIYUN_SMS_TEMPLATE_CODE=SMS_511315001
```

改完 `ssh root@cuberoot 'cd /root/core-api && pm2 reload core-api --update-env'`,**不需要重新部署**。备份在 `.env.bak-smsadd`。

生效验证:`curl -s https://api.cuberoot.me/v1/auth/providers` 看 `phone` 是否为 `true`。

## 阿里云侧资源(申请时的坑)

- **主体必须是企业认证**。个人认证的自用资质 2025-06 起无法通过签名实名制报备。本站主体已升企业认证(个人独资企业 → 企业类型选「普通企业」,不是「个体工商户」)。
- **签名来源必须选「企事业单位名」**。「已备案网站」「公众号/小程序」「电商店铺名」等旧来源已下线,选了必被拒。
- **签名内容必须是资质企业名全称**。简称(如「魔方根」)会以「省略主要信息,须特定且唯一对应」被拒 —— 实际踩过一次。全称 `上海魔方根教育科技工作室` 12 字,正好顶签名 12 字上限。
- **模板变量名必须是 `code`**。`sms.ts` 里 `TemplateParam: JSON.stringify({ code })` 是写死的。模板内容:`您的验证码是${code},5分钟内有效,请勿泄露。`
- 资质表单的企业名称要和**阿里云账号认证主体**逐字一致,不是和营业执照一致 —— 阿里云存的是英文半角括号,营业执照印的是中文全角括号,不做归一化比对,得按前者填。
- 防刷在「国内消息设置 → 安全设置」:日限额 300 / 月限额 2000,联系人手机号必须填,否则触发限额时无人知晓。服务端本身也有 IP 限流 + 60 秒发码间隔(`checkRateLimit` + `issueCode` 返 429)。

## 排障

**按这个顺序查,别猜:**

| 症状 | 查什么 |
|---|---|
| 前端没有手机号入口 | `/v1/auth/providers` 的 `phone`;false = env 没配全或没 reload |
| 「操作太频繁,请 60 秒后再试」 | 我们自己的限流,请求没到阿里云。等 60 秒 |
| 「发送失败,请稍后重试」 | `pm2 logs core-api` 找 `[auth] sms send failed:`,后面是阿里云的 Code+Message |
| **返回成功但收不到短信** | 同步 OK ≠ 送达。`pm2 logs core-api` 找 `[sms] delivery failed:`(回执推来的,带运营商原始错误码);没有就查 `QuerySendDetails`(见下) |

常见错误码:

- `DELIVERED` —— 送达(正常态,配 `SendStatus: 3`)
- `isv.AMOUNT_NOT_ENOUGH` —— 账户余额不足(踩过)
- `PORT_NOT_REGISTERED` —— 签名未完成运营商实名报备(踩过,2026-08-04 前)
- `Forbidden.RAM` —— RAM 用户没授 `AliyunDysmsFullAccess`

### 送达回执(已接,2026-08-04)

失败的送达结果现在会自己送上门,不用再人肉查:

- 端点 `POST /v1/sms/receipt/:token`(`server/src/routes/sms_receipt.ts`),密钥 `SMS_RECEIPT_TOKEN` 在服务器 `.env`。**没配 token 整个端点 404**。
- 控制台配在「**通用设置 → 回执配置 → 状态报告接收**」,打开「HTTP 批量推送模式」填地址。那页的「测试」按钮的地址框**不会自动带出已保存的地址**,空着点就报 `Param.Error`,得手动粘一次。
- 只打失败,成功不打(成功是绝大多数,全打会淹掉日志)。日志形如
  `[sms] delivery failed: 138****8000 PORT_NOT_REGISTERED 签名未报备 biz=xxx`,号码打码。
- **连续 3 条失败**额外打一行 `[sms] ALERT` —— 那个形状是通道级问题(余额 / 签名 / 模板),不是某个号的问题。
- 除鉴权外一律回 200 + `{"code":0,"msg":"接收成功"}`(实测控制台只认 `code`,`msg` 文案不限)。我们只落日志不落库,让它按 1/5/10/30/60 分钟重推十次只会把同一条噪音放大十倍。
- 回执**不保证幂等**,同一条可能推多次;这里只打日志,重复无害。
- 开启后有缓存,约 15 分钟才全量推送。响应超时 700ms —— 将来谁往这个 handler 里加数据库写入,就会开始偶发超时重推。

⚠️ **兜底会掩盖信号**:「验证码兜底解决方案」(国内消息设置里,已开)在主签名因报备原因发不出去时自动换兜底签名。用户照样收到码 —— 但回执因此显示成功,日志安安静静,**主签名被打回你不会从日志看出来**。所以签名状态那一列仍要偶尔看一眼。

### 手动查回执

同步返回只说明阿里云受理了。真正的送达结果在 `QuerySendDetails`,`SendStatus` 1=等待 2=失败 3=成功,失败带 `ErrCode`。

控制台:业务统计 → 发送记录。或用脚本(签名逻辑照抄 `sms.ts`,参数换成 `Action=QuerySendDetails` + `PhoneNumber` + `SendDate=yyyyMMdd`,注意用**北京时区**的日期)。

排查期间直连阿里云发一条测试短信,能绕开本站 60 秒限流,快速隔离是本站的问题还是服务商的问题。

## 待办

- [x] 等签名运营商报备完成 → 真机收码验证(2026-08-04,`DELIVERED`)
- [x] 接送达回执 + 开验证码兜底(2026-08-04,控制台「测试」通过)
- [ ] 撤掉站内「手机验证码暂时无法使用」的页面通知
- [ ] 三家运营商仍是「已报备待验证」:要各用移动 / 联通 / 电信的号少量多次真发才会翻成「报备成功」。开了兜底后这件事从防线降级成「让状态好看」
- [ ] 港澳台目前和「国外」一起被 `+86` 挡着 —— 他们是中文站的核心受众,这是比开放全球更该开的口子,且走同一条国际线路(不需签名 / 模板)
- [ ] 只支持 +86:非中国大陆号码会被 `isValidPhone` 拒掉,但前端错误文案说的是「手机号格式不正确」—— 对国外用户是错的话。最低成本是把约束前置(输入框标 `+86`,文案改成「仅支持中国大陆手机号,国外请用邮箱 / WCA / Google」)。真开国际要换 `SendMessageToGlobe-Intl`(不用签名模板)+ 国家白名单 + 分国家限额,防 SMS pumping 刷单
- [ ] **轮换 AccessKey** —— 当前这把在对话中明文出现过。步骤:RAM 用户 `sms-sender` 建新 AccessKey → 改 env 两行 → `pm2 reload` → 删旧的
- [ ] 报备通过后考虑开启阿里云的「验证码防盗刷监控」(控制台安全设置),多一层防刷
