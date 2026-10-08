# CubeRoot 网站实名认证

## 2026-10-08 接入

独立于 Mira 的阿里云账号 `1964361522100427`（ruiminyan），场景 `1000021659`，名称「CubeRoot网站实名认证」。OSS 留存、降级认证和设备增强检测未启用。专用 RAM 用户为 `cuberoot-face-verification`；负责人已确认创建长期凭据并授予发起/查询两项权限，账号安全验证已完成，专用用户和密钥已创建，密钥保存于维护者 Mac 仓库外 0700 目录/0600 文件，当前等待权限策略页面恢复后绑定。凭据必须保存在仓库外受限文件与服务器环境中，不得放入前端或 Git。

网站通过现有 sessionFetch / HttpOnly 同源会话桥接访问认证 API，长期密钥不进入浏览器，使用原会话绑定认证。

网站入口 `/account/verify`（中文 `/zh/account/verify`），从「我的 → 实名认证」进入。仅本人有效签名会话可操作，拒绝角色预览和代看；不接受外部用户 ID 或 CertifyId。姓名、身份证号只通过 POST 提交阿里云，不在站内保存明文或写入 URL。独立同意后才加载官方设备信息脚本；原始人脸由阿里云处理，站内不保存照片/视频。

服务器仅在 `DescribeFaceVerify` 返回 `Passed=T` 后记录通过。回跳参数不作为结果；未通过可在 30 分钟内继续查询。认证独立于 WCA 绑定和登录，不修改公开身份，不随账号合并迁移。删除账号通过外键删除认证记录。迁移 `0264_face_verification.sql` 只增加新表；保存账号/会话绑定、身份证 HMAC 和尾号、同意版本、流水及结果。身份摘要密钥启用后须稳定保存，不能随意轮换。

费用限制为滚动 24 小时每账号 3 次、全站 100 次，在调用前事务占用额度；失败也计次，查询间隔至少 5 秒。数据库约束阻止同一身份通过多个账号。限额不是账单封顶；控制台告警和本人验收仍由负责人管理。

服务端环境变量：`CUBEROOT_FACE_ENABLED=true`、`CUBEROOT_FACE_CONSENT_APPROVED=true`、`CUBEROOT_FACE_SCENE_ID=1000021659`、`CUBEROOT_FACE_ACCESS_KEY_ID`、`CUBEROOT_FACE_ACCESS_KEY_SECRET`、`CUBEROOT_FACE_IDENTITY_PEPPER`（独立随机密钥至少 32 字符）、`CUBEROOT_FACE_APP_ORIGIN=https://cuberoot.me`。关闭启用开关可停止新发起和查询，不改写历史认证。

RAM 自定义策略仅允许 `antcloudauth:InitFaceVerify`、`antcloudauth:DescribeFaceVerify`，资源为 `acs:antcloudauth:*:1964361522100427:*`（账号粒度，非场景粒度）。不授予场景管理、RAM 管理、OSS 或全产品权限。

按负责人“不用检查”要求，未追加本地测试、编译或真人刷脸；部署状态、原生容器兼容和真实收费不能从本地实现推断。发布通过独立工作树隔离其他尚未发布的改动，数据库由现有 Deploy Core 流程迁移，前端由既有双线路流程构建。

官方接入依据：[H5 集成](https://help.aliyun.com/zh/id-verification/financial-grade-id-verification/integration-by-using-pc-or-mobile-h5-pages)、[服务端集成](https://help.aliyun.com/zh/id-verification/financial-grade-id-verification/server-side-integration-2)。
