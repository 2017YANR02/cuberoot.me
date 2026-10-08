# CubeRoot 网站实名认证

## 2026-10-08 接入

独立于 Mira 的阿里云账号 `1964361522100427`（ruiminyan），场景 `1000021659`，名称「CubeRoot网站实名认证」。OSS 留存、降级认证和设备增强检测未启用。专用 RAM 用户为 `cuberoot-face-verification`；负责人已确认创建长期凭据并授予发起/查询两项权限，账号安全验证已完成，专用用户和密钥已创建，密钥保存于维护者 Mac 仓库外 0700 目录/0600 文件，负责人已通过截图确认策略绑定成功。凭据必须保存在仓库外受限文件与服务器环境中，不得放入前端或 Git。

网站通过现有 sessionFetch / HttpOnly 同源会话桥接访问认证 API，长期密钥不进入浏览器，使用原会话绑定认证。

网站入口 `/account/verify`（中文 `/zh/account/verify`），从「我的 → 实名认证」进入。仅本人有效签名会话可操作，拒绝角色预览和代看；不接受外部用户 ID 或 CertifyId。姓名、身份证号只通过 POST 提交阿里云，不在站内保存明文或写入 URL。独立同意后才加载官方设备信息脚本；原始人脸由阿里云处理，站内不保存照片/视频。

服务器仅在 `DescribeFaceVerify` 返回 `Passed=T` 后记录通过。回跳参数不作为结果；未通过可在 30 分钟内继续查询。认证独立于 WCA 绑定和登录，不修改公开身份，不随账号合并迁移。删除账号通过外键删除认证记录。迁移 `0264_face_verification.sql` 只增加新表；保存账号/会话绑定、身份证 HMAC 和尾号、同意版本、流水及结果。身份摘要密钥启用后须稳定保存，不能随意轮换。

费用限制为滚动 24 小时每账号 3 次、全站 100 次，在调用前事务占用额度；失败也计次，查询间隔至少 5 秒。数据库约束阻止同一身份通过多个账号。限额不是账单封顶；控制台告警和本人验收仍由负责人管理。

服务端环境变量：`CUBEROOT_FACE_ENABLED=true`、`CUBEROOT_FACE_CONSENT_APPROVED=true`、`CUBEROOT_FACE_SCENE_ID=1000021659`、`CUBEROOT_FACE_ACCESS_KEY_ID`、`CUBEROOT_FACE_ACCESS_KEY_SECRET`、`CUBEROOT_FACE_IDENTITY_PEPPER`（独立随机密钥至少 32 字符）、`CUBEROOT_FACE_APP_ORIGIN=https://cuberoot.me`。关闭启用开关可停止新发起和查询，不改写历史认证。

RAM 自定义策略仅允许 `antcloudauth:InitFaceVerify`、`antcloudauth:DescribeFaceVerify`，当前生效的 v2 使用 `Resource: "*"`。原账号 ARN 未匹配通过授权诊断，已在负责人确认后修正；操作范围仍限于发起和查询，不授予场景管理、RAM 管理、OSS 或全产品权限。

按负责人“不用检查”要求，未追加本地测试、编译或真人刷脸；部署状态、原生容器兼容和真实收费不能从本地实现推断。发布通过独立工作树隔离其他尚未发布的改动，数据库由现有 Deploy Core 流程迁移，前端由既有双线路流程构建。

官方接入依据：[H5 集成](https://help.aliyun.com/zh/id-verification/financial-grade-id-verification/integration-by-using-pc-or-mobile-h5-pages)、[服务端集成](https://help.aliyun.com/zh/id-verification/financial-grade-id-verification/server-side-integration-2)。

2026-10-08 发布：529cd3e699 的 Deploy Core（37794743420）、Deploy Next（37794743415）及 Vercel 均成功；正式 API 版本和网站入口 200 已确认。负责人截图确认 CubeRootFaceVerificationInvoke 已绑定专用账号，1 项成功、0 项失败；随后开启生产开关并重新加载 API。真实本人刷脸未验收。自动 CI 发现卡片排序清单、CSS 选择器和开发文档遗漏，随收尾修正发布；不追加本地测试。

收尾发布：4b4c99d747 的 Deploy Core 37796950499、Deploy Next 37796950464 和 Vercel 均成功；API 当前版本已切换到 4b4c99d747，数据库健康正常，生产开关已开启。前一版自动 CI 的 4 项集成遗漏已修正；随后出现的卡片拖动测试固定索引已在 98af4cba15 改为按目标卡片定位，该测试修正不修改生产功能，后续自动 CI 状态待返回。未新增本地测试或真人身份调用。此发布状态回填仅作本地记录，不为文档再次发布。


## 2026-10-08 首次验收失败处理

线上只有一次初始化失败记录，未取得认证流水；紧接着的重试被一分钟冷却限制拦截，旧提示将其混同为待完成/每日限额。无身份资料的 DescribeFaceVerify 授权诊断返回 411，定位到专用 RAM 授权仍不可用。负责人确认修正后，控制台显示 v2 已生效，仍仅允许原两项操作；同一无身份资料诊断不再返回 411，而是缺少认证流水参数的 400。该诊断不等同于真实本人认证通过。

代码已拆分进行中、重试冷却、滚动 24 小时个人限额、全站限额、服务授权与欠费提示；发起错误后刷新本人状态。日志仅保存固定事件、接口名、HTTP 状态、三位错误码和格式受限的请求编号，不保存身份信息、密钥、原始结果或供应商消息。原限额和同意规则保持不变。本次没有重新提交用户身份资料；代码提交、部署与真人验收分别记录。

后续负责人要求提交全部现有改动并使 CI 全绿。首批改动及远端安全修复合并推送后，CI 暴露旧控件接口、训练手动来源回归、集成测试契约和退役组件遗漏；分别以 e79dc21d1c、606fc54949 修复。负责人提醒有其他 AI 并行工作后，后续修复全部移至独立工作树，不更新其他 AI 的主工作区。相关定向测试 52 项、客户端类型检查、认证文档校验与 Knip 均通过；移动端和桌面 UI 在 e79dc21d1c 的 CI 通过，606fc54949 的 Test（37803508103）通过，未受最后组件清理影响的任务由路径规则跳过。

发布确认：API 修复 a74bc701ad 的 Deploy Core（37801096307）成功，服务器实际 release 指向该提交，健康接口返回 200。前端 606fc54949 的 Deploy Next（37803507854）和 Vercel 均成功，自建前端服务 active。真实本人刷脸、原生容器及收费结果仍由负责人验收，不能从授权诊断或 CI 推断。
