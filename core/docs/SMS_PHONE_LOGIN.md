# 手机号登录(阿里云短信)

## 当前状态(2026-07-30)

**代码全通,卡在运营商实名报备。** 除此之外每一层都已实测验证。

阿里云同步返回 `Code: OK` 并扣费,但运营商侧异步回执 `PORT_NOT_REGISTERED` —— 签名的实名报备未完成,短信不下发。**没有加速办法,只能等**(阿里云自审几分钟,运营商报备 5–10 个工作日)。

报备完成后**不需要重启、不需要改任何配置**,直接就能收到码。查状态:短信控制台 → 国内消息 → 签名管理 → 看那条签名的报备状态。

⚠️ 报备完成前,前端点「发送验证码」会显示成功但永远收不到 —— 失败是异步回执,服务端当场拿不到,前端无从感知。介意的话把 env 里 4 行注释掉(`phone` 回落 `false`,入口自动隐藏),报备通过再打开。

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
| **返回成功但收不到短信** | **同步 OK ≠ 送达。必须查异步回执(见下),日志里不会有任何东西** |

常见错误码:

- `isv.AMOUNT_NOT_ENOUGH` —— 账户余额不足(踩过)
- `PORT_NOT_REGISTERED` —— 签名未完成运营商实名报备(当前卡这里)
- `Forbidden.RAM` —— RAM 用户没授 `AliyunDysmsFullAccess`

### 查异步回执

同步返回只说明阿里云受理了。真正的送达结果在 `QuerySendDetails`,`SendStatus` 1=等待 2=失败 3=成功,失败带 `ErrCode`。

控制台:业务统计 → 发送记录。或用脚本(签名逻辑照抄 `sms.ts`,参数换成 `Action=QuerySendDetails` + `PhoneNumber` + `SendDate=yyyyMMdd`,注意用**北京时区**的日期)。

排查期间直连阿里云发一条测试短信,能绕开本站 60 秒限流,快速隔离是本站的问题还是服务商的问题。

## 待办

- [ ] 等签名运营商报备完成 → 真机收码验证
- [ ] **轮换 AccessKey** —— 当前这把在对话中明文出现过。步骤:RAM 用户 `sms-sender` 建新 AccessKey → 改 env 两行 → `pm2 reload` → 删旧的
- [ ] 报备通过后考虑开启阿里云的「验证码防盗刷监控」(控制台安全设置),多一层防刷
