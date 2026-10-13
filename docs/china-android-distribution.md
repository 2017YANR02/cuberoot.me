# CubeRoot 中国大陆 Android 分发调研

状态：`REFERENCE`。调研日期：2026-10-13。范围：普通手机应用，非游戏联运、快应用或广告投放。

Google Play 已上架，由所有者在本次任务中确认；完整发行记录见 [五端 App 路线图](./mobile-app-roadmap.md)。本文是渠道选择和材料准备参考，不是已完成上架的证明，也不批准新渠道发布。

## 1. 渠道选择结论

面向中国大陆 Android 用户，建议准备“官网 APK 下载 + 厂商应用商店”。官网便于已有用户直接获取，商店提供搜索、安装信任和版本更新入口。Android 官方支持网站分发，但用户需要允许对应来源安装应用，具体提示还受设备系统策略影响。[Android 分发说明](https://developer.android.com/distribute/marketing-tools/alternative-distribution)

本轮重点覆盖小米、OPPO、vivo、荣耀、华为五个厂商渠道，另列魅族和三星。此顺序不是市场份额排名；未取得可比的下载渠道占比数据，不把手机销量推算为应用下载比例。应用宝属于第三方商店，应作为后续补充渠道单独评估。

对 CubeRoot 的建议是先解决主体、备案、版权和签名，再做官网分发与首家商店验证。已有 OPPO 真机验收记录，可优先用 OPPO 验证渠道流程；具备符合要求的企业主体后，再复用材料推进小米、vivo、荣耀。华为应区分 Android 与原生鸿蒙，按现有 `core/apps/harmony` 的成熟度单独排期。这是项目实施建议，不是平台规定。

## 2. 各商店要求与流程

以下均需准备真实运营主体、应用信息、隐私说明、对应平台软件包及适用的备案和资质。表中列出影响选型的差异；具体截图尺寸、包大小、SDK 下限等以提审当天后台为准。

| 渠道及官方入口 | 主体与材料要点 | 提交流程与当前证据 |
| --- | --- | --- |
| [小米应用商店](https://dev.mi.com/) | 2026-09-08 更新的“不收录”清单明确包含个人开发者身份发布的 APP。版权材料接受软件著作权证书或平台认可的 APP 电子版权认证证书；不能假定任意电子存证都有效。 | 认证 → 创建名称/包名 → 上传 APK → 核对权限 → 填分类、中文介绍、截图、隐私 URL 和测试账号 → 上传资质 → 送审，选择即时或定时上线。官方创建指南给出 1～3 个工作日的审核参考。见 [主体限制](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1354)、[创建指南](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1072)、[版权材料](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1261)。 |
| [OPPO 软件商店](https://open.oppomobile.com/) | 按企业 Android 应用路线准备。官方社区答复区分了个人账号可用服务与企业 Android 应用上传权益，但答复较早，当前个人/个体工商户准入仍须后台复核。准备版权、APP 备案及适用承诺函。 | 企业认证 → 应用服务创建/认领 → 上传 APK → 填资料、资质、隐私与审核说明 → 提审 → 根据驳回整改 → 发布。官方 FAQ 的常规人工审核参考为 1～3 个工作日，不能等同包含整改的总工期。见 [接入入口](https://open.oppomobile.com/new/developmentDoc/info?id=10446)、[账号权益答复](https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=3565)、[审核 FAQ](https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6307)。 |
| [vivo 应用商店](https://dev.vivo.com.cn/) | **2026-09-16 官方公告明确提到进一步打通个人开发者上架通道。** 不能继续写成“只接受企业”。公告不等于所有类别无条件开放，也没有证明免备案或免版权材料。 | 账号注册/认证 → 确认个人或企业应用发布权益 → 创建应用、上传 APK → 填资料/资质/隐私 → 检测和提审 → 整改后发布。当前文档正文未能抓取，个人通道的类别、材料和审核时效列为后台待核实，不承诺 CubeRoot 必然可用。见 [官方公告](https://www.vivo.com.cn/brand/news/detail?id=1389&type=0)、[上传文档入口](https://dev.vivo.com.cn/documentCenter/doc/52)、[审核规范入口](https://dev.vivo.com.cn/documentCenter/doc/12)。 |
| [荣耀应用市场](https://developer.honor.com/) | 当前审核规范明确暂不接受个人上传，需企事业单位类型。大陆分发的 API 材料定义列有必填软件著作权；应用、APP 备案、软著名称和主体需核对一致性或适用授权。 | 认证 → 创建应用 → 上传 APK → 填介绍/素材/隐私、地区与资质 → 提交测试审核 → 发布。官方发布文档给出 1～3 个工作日参考。见 [审核规范](https://developer.honor.com/cn/doc/guides/100879)、[发布文档](https://developer.honor.com/cn/doc/guides/100885)、[名称规则](https://developer.honor.com/cn/doc/guides/101411)、[材料字段](https://developer.honor.com/cn/doc/guides/101359)。 |
| [华为应用市场 / AppGallery Connect](https://developer.huawei.com/consumer/cn/appgallery/devstart/) | 先完成开发者实名认证，再按应用类型和地区提交备案、版权及行业资质。个人、企业的具体类别权限须通过当前审核规范和账号确认；本轮没有取得足以保证 CubeRoot 个人主体准入的完整条款。 | AGC 创建项目/应用 → 上传对应平台软件包 → 配置商品（如有）→ 测试 → 填应用信息、隐私、资质和分发地区 → 送审发布。原生鸿蒙沿用独立构建、签名和设备验收，不能把 Android APK 直接视为鸿蒙发布包。见 [分发全流程](https://developer.huawei.com/consumer/cn/appgallery/devstart/)、[鸿蒙提交说明](https://developer.huawei.com/consumer/cn/app/submit/)、[审核政策总览](https://developer.huawei.com/consumer/cn/doc/doccenter-submission/50000)。 |

### 补充厂商渠道

- **魅族 Flyme**：账号认证 → 应用创建/认领 → 上传安装包与资料 → 审核 → 发布更新。官方协议提及个人和企业，但这不足以证明当前所有个人账号都能新上架普通 APP；主体准入、版权和备案字段需确认。规则包含名称/图标一致、正常安装运行和隐私告知。见 [开放平台文档](https://open.flyme.cn/docs)、[审核规范](https://open.flyme.cn/docs?id=110)、[认领流程](https://open.flyme.cn/docs?id=18)。
- **三星 Galaxy Store**：Samsung 账号 → Seller Portal 注册 → commercial seller 资格 → 创建应用、上传包体和素材 → 选择地区并提交审核。官方明确免费应用也需要 commercial seller 资格；不要套用“个人注册即能免费上架”的旧教程。中国大陆材料需再核对中国区入口及后台。见 [准入指南](https://developer.samsung.com/galaxy-store/prepare.html)、[发布流程](https://developer.samsung.com/galaxy-store/launch.html)、[中国开发者入口](https://support-cn.samsung.com.cn/App/DeveloperChina/home/list?parentid=11)。

不把 OPPO/vivo 的关联品牌覆盖当作全部机型必然可达的保证；最终需按用户实际设备、系统版本和商店搜索结果验收。

### 材料差异中已能直接行动的部分

- 小米创建指南要求手机截图 4～5 张，并给出横竖屏尺寸；现有 Play 首发的两张截图不足以直接复用整套提交。应补齐真实应用截图，具体格式再按后台核对。[小米创建指南](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1072)
- 荣耀将大陆分发的软著材料列为必填；小米允许特定电子版权证书，不能把小米的替代方案推定为全商店通用。[荣耀材料字段](https://developer.honor.com/cn/doc/guides/101359)、[小米版权指南](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1261)
- “1～3 个工作日”仅是部分平台公开的应用审核参考，不包含账号认证、办证、备案、补件和多轮驳回。华为、vivo 本轮不提供未经核实的时效或收费数字。

## 3. 共同前置材料与办理顺序

### 3.1 先定主体，再办理 APP 备案和版权材料

建议形成一份材料台账：

| 材料 | 应准备的内容 | CubeRoot 本轮状态 |
| --- | --- | --- |
| 运营主体 | 主体证照、统一社会信用代码（适用时）、负责人/联系人、认证及授权材料 | Play 组织路线已有历史记录；不能推定为各国内渠道已认证 |
| APP 备案 | 主办者、应用名、包名、签名等平台信息、网络资源和服务内容；以接入商字段为准 | 未核实已有有效的 Android APP 备案，不等同“没有” |
| 版权权属 | 软著，或目标平台明确接受的替代证明；非同主体需相应授权 | 未核实；开源仓库与 Play 上架记录不替代该项 |
| 商店素材 | 中文名称/介绍、图标、真实截图、分类、年龄/内容声明、更新说明 | Play 素材可作为基础，但需按平台补齐 |
| 隐私与支持 | 可访问的中文隐私政策、SDK/权限清单、注销路径、运营者和支持联系方式 | 已有文档草稿和功能证据，须按最终国内包复核 |
| 审核访问 | 可用测试账号、受限/付费功能访问、BLE/Stackmat 使用说明 | 可参考 Play 审核安排，需验证大陆可访问性与有效期 |

工信部说明：通过接入服务提供者或应用分发平台提交 APP 备案；已有网站备案可复用主体信息，但仍需补充 APP 信息。材料齐全准确后，通信管理局办理参考为二十个工作日，APP 内及分发处需显著展示备案号。这不是整个项目从零开始的保证工期。[工信部备案解读](https://www.miit.gov.cn/zwgk/zcjd/art/2023/art_39b4f1acc36745b98478e0ec3e07128d.html)

APP 备案、网站 ICP 备案、经营性许可和软件著作权是不同事项。不要把“有网站备案”写成“APP 已备案”，也不要把每个平台的软著收录规则表述成所有 APK 分发场景统一的法定义务。具体行业资格按真实服务内容核对。

### 3.2 CubeRoot 不能仅按离线工具准备审核

仓库当前事实源是 [Mobile README](../core/apps/mobile/README.md)、[商店提交资料](./mobile-store-submission.md) 和路线图。计时器本地优先，但 Tools/Account 提供在线服务，可达范围包含账号、论坛、音频/文件及会员等功能。

- **联网与备案**：本地计时可用不意味着整款 APP 是纯离线应用；官网提供 APK 也不改变在线服务范围。
- **UGC 与内容材料**：OPPO 官方 FAQ 将论坛等公众表达服务列入需安全评估报告的情形。CubeRoot 应核对实际开放功能与材料，不能只提交“计时工具”的描述。该要求与普通 APP 备案分开记账。[OPPO 审核 FAQ](https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6307)
- **WebView 内容**：小米和荣耀都限制简单网页打包等低价值应用。提交说明应真实展示本地计时、离线记录和设备连接能力，并说明在线工具的用途；Capacitor 本身不等于必然拒审，也不保证通过。[小米不收录清单](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1354)、[荣耀审核规范](https://developer.honor.com/cn/doc/guides/100879)
- **隐私和权限**：以最终包列清 BLE、麦克风、通知、账号、SDK 和实际数据用途；拒绝可选权限时保留无关核心功能。核对同意前的 SDK 初始化与联网行为，不把一份隐私 URL 当作全部验收。
- **版权范围**：Play 阶段已有部分第三方工具展示授权的所有者确认；国内渠道分发范围、论坛内容和音乐文件仍须按实际权属复核。

## 4. 官网直链 APK：可以做，但要维护完整升级链路

仓库现提供 `play`／`direct` 原生构建配置，官网 APK 使用 `direct`，复用网站支付宝／微信手机收银台；Play 包继续用 Play Billing。构建命令、产物路径、签名与升级约束见 [Mobile README](../core/apps/mobile/README.md#android-payment-distributions)，实现验证状态以 [路线图](./mobile-app-roadmap.md) 为准。这个配置不自动表示任一国内商店已批准相同支付方式，也不等于 APK 已发布。

官网分发适合作为基础渠道。建议下载页列出发布者、版本、大小、最低系统要求、更新说明、隐私/权限信息、APP 备案号，以及版本固定的 HTTPS APK 链接和 SHA-256。优先使用大陆实测可达的现有域名和文件服务；本轮没有测试运营商线路，不能直接宣称某个现有域名已适合大文件分发。

安装流程是下载 APK、允许浏览器或文件管理器安装该来源应用，再由系统确认安装。安全提示、商店引导和企业设备限制可能增加步骤；不要求用户整体关闭安全防护。网站分发也不会自动获得商店的更新能力，应确定后续版本提示和下载入口。[Android 分发说明](https://developer.android.com/distribute/marketing-tools/alternative-distribution)

工信部规则要求提供互联网信息服务的 APP 履行备案，并限制未备案 APP 的接入和分发。因此，对 CubeRoot 当前在线功能，不能把“仅在官网放 APK”理解为免备案方案。[工信部备案解读](https://www.miit.gov.cn/zwgk/zcjd/art/2023/art_39b4f1acc36745b98478e0ec3e07128d.html)

### 4.1 第一优先级是签名兼容

当前 Android release 包名为 `me.cuberoot.app`。Google Play 的 **upload key** 与设备实际安装 APK 的 **app signing key** 可能不同；现有路线图也明确没有用上传证书 APK 覆盖 Play 安装。不得直接把历史本地 release APK 上传官网并承诺无损升级。[Android 签名说明](https://developer.android.com/studio/publish/app-signing)

发布前按以下顺序验证：

1. 比较 Play 安装包、拟直链 APK 和拟商店 APK 的签名证书 SHA-256；确认包名、签名兼容性和版本号策略。
2. 若能使用一致的应用签名，优先各渠道共享兼容身份；若 Play 私钥由 Google 持有，不把下载证书误当成取得私钥。可核查 Console 是否提供适合再分发的已签名 APK，或另行设计国内渠道签名与迁移策略。
3. 验证 Play → 官网、官网 → 商店、旧国内版 → 新国内版的覆盖更新，检查本地成绩、登录和会员权益。
4. 不兼容时不得建议用户直接卸载丢弃本地成绩；先设计导出/恢复。改包名意味着独立应用和额外数据迁移，不能在本次调研中擅自更改。

这是 Android 安装和更新的约束，不是各商店一定要求不同渠道包。只有真实支付、推送或平台政策差异存在时才增加渠道配置，保持仓库既定的共享产品层。

### 4.2 安装可达不等于服务可用

Google Play 月订阅已有内测主流程证据，但不能推定国内无 Play 环境可正常购买。国内首发需决定购买方式、现有会员权益访问、退款和恢复策略，再核对目标商店支付政策；不能简单把 Play 包中的付款按钮替换成网站链接就宣称满足审核。

建议验证无 Google Play 服务设备上的冷启动、非 Google 登录、账号注销、云端服务、远程工具、推送降级和付款失败提示。下载与业务 API、验证码、邮箱和第三方内容的网络可达性分别测试；大陆商店上架不会自动解决这些依赖。

## 5. 推荐执行顺序

1. **建立材料台账**：确认拟使用的国内主体、现有 APP 备案、软著/权属、各开发者账号状态；Play 的 D-U-N-S 不替代国内平台材料。
2. **确认产品与包边界**：按真实可达内容确定类别和资质；对齐国内支付策略、签名、版本号和共享宿主配置。
3. **补齐基础材料**：备案/版权可并行准备；整理中文隐私、SDK 清单、截图、测试账号及硬件操作说明。不要为过审临时隐藏正式服务内容。
4. **验证官网包与第一家商店**：先验证大陆网络和覆盖升级，再发布下载入口、提审商店。若企业材料齐全，可优先 OPPO；若仅有个人主体，应先核查 vivo 新通道和华为对应类别，而非办理完所有材料才发现主体不被接受。
5. **扩展与持续维护**：复用核实后的材料推进其他商店；每次发布记录包体哈希、签名指纹、版本号、审核结果和公开下载链接。把官网与商店更新纳入同一版本台账。

本轮仅完成调研和文档更新。账号注册、备案申请、办证费用、支付改造、构建签名和实际上架都未执行。

## 6. 来源可靠性与尚待确认项

- 本文仅把平台官方文档、官方公告、可识别的官方社区答复和 Android/工信部资料作为政策依据；社区普通用户经验不作为确定规则。
- 小米旧审核页面仍出现“个人仅部分品类受限”的表述，但 2026-09-08 的专门不收录清单明确包含个人 APP。本文按更新的专门清单规划，并保留冲突提示。参见 [旧通用审核页](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1080) 与上文不收录清单。
- vivo 官方新闻确认新个人通道；上传/审核文档返回空正文，未核实具体类目和资料。OPPO 接入页返回 JavaScript 页面壳，账号权益依据为较早官方答复。荣耀主要条款来自官方页面搜索索引，直接读取仅得到页面壳或超时。上述限制不等于平台不提供该服务。
- 华为分发概览可读，但详细资质/审核 FAQ 读取失败；个人主体能否发布 CubeRoot、Android 存量渠道的当前受理范围，以及原生鸿蒙的准确提交包要求，需在 AGC 核实。
- 未登录任何商店后台，未代替用户咨询客服，未进行浏览器自动化、网络速度或真机测试。费用、个体工商户/境外主体资格、支付抽成和材料替代资格不作无证据承诺。
- 上线前应复查本文链接及后台最新要求。本文不把账号可注册、上传成功、审核通过和用户已能下载安装混为同一状态。
