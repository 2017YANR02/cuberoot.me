# Windows Microsoft Store 上架基础

决策日期：2026-11-15。Windows 使用公司账号、免费 MSIX 应用和既有 CubeRoot 会员体系，首版不接 Microsoft Store IAP。Windows/macOS 仍共用 `core/apps/desktop` 与 `@cuberoot/app-ui`，不新增业务工程。当前分层证据只见[App 路线图](../product/apps/mobile-app-roadmap.md)。

## 发行入口

- 官网 EXE：继续使用 `.github/workflows/app_release.yml`，版本、发布和更新 feed 保持原流程。
- 商店 MSIX：新增 `.github/workflows/windows_store.yml`，仅手动构建 Windows x64 候选包；无 Android/macOS jobs、网站发布、商店上传或内购商品创建。
- MSIX 使用原生 `microsoft-store` Cargo feature。App 启动读取原生渠道，商店版不暴露官网 EXE 更新入口；正式更新由 Store 管理。
- Tauri 现有 CLI 不直接输出 MSIX。本项目对同一 Tauri release EXE 使用 Windows SDK `MakeAppx` 包装，保留其默认 schema/语义检查，不用 `/nv` 跳过验证。
- 默认产出未签名 `.msix`，供 Store 提交处理；不能把它当作普通用户可直接双击安装的包。测试签名/受限分发与正式商店签名另行完成，不在此入口生成或安装信任证书。

## Partner Center 配置

### 公司账号核验材料（2026-11-16 补件）

本次补件用于公司账号的 `Employment verification`（申请人与公司的关联核验），不是应用包送审。当前状态与下一步统一见[App 路线图](../product/apps/mobile-app-roadmap.md#2026-11-15-windows-microsoft-store-基础本地未送审)。

- 提交时间：2026-11-16 18:27（America/Los_Angeles，UTC−08:00），即北京时间 2026-11-17 10:27；Store Developer 对话中已出现本次说明、附件及微软接收回执。
- 提交附件：`cuberoot-domain-verification.pdf`，共两页。第一页为阿里云域名证书原图转 PDF，保留完整正文和印章；第二页为阿里云原始「已付款业务清单」直接打印为 PDF。未用自行撰写的证明替换官方材料。
- 证书记录：域名 `cuberoot.me`，持有人「颜瑞民 / yan rui min」，注册商 Alibaba Cloud Computing (Beijing) Co., Ltd.，注册日期 2018-12-13，到期日期 2028-12-13。
- 付款记录：2025-06-05 转入阿里云，金额 CNY 110，到期日期 2028-12-13；这是域名转入付款，不是 2018 年首次注册的付款记录。两份官方材料的出具日期均保留为 2026-11-17。
- 在表单评论中已明确说明：Ruimin Yan（颜瑞民）是申请公司 Shanghai CubeRoot Technology Co.,Ltd.（上海魔方根科技有限公司）的法定代表人；证书中的 `yan rui min` 是同一人；域名仍登记在其个人名下，未声称已过户给公司。
- 提交后的微软回执提示通常需 5–7 个工作日，并会通过邮件通知结果或补件要求；此时仅证明材料已接收，不代表核验通过。

原始证书、两份独立 PDF、合并提交 PDF 和 `microsoft-submission-result.jpg` 保存在维护者本机的 `.local-data/windows-store/verification-2026-11-16/`。这些私有材料及微软附件临时签名链接不进入 Git；本节只保留材料摘要和证据定位。

### 正式应用包身份

公司主体完成 Microsoft Store 开发者验证后，新建 **MSIX/PWA 类型**应用，预留 `CubeRoot`（名称可用性待后台核验）。不要新建 EXE/MSI 类型条目来接收此 MSIX。

从应用 Product identity 原样取得以下值，保存为 GitHub 仓库 Actions variables，或者在本地执行命令时通过同名环境变量注入。这些是公开包身份，不是商户或微软账号凭据；不要根据品牌、域名或组织名称猜值。

| 变量 | 来源 |
| --- | --- |
| `WINDOWS_STORE_IDENTITY_NAME` | Package/Identity/Name |
| `WINDOWS_STORE_PUBLISHER` | Package/Identity/Publisher，完整 `CN=...` 字符串 |
| `WINDOWS_STORE_PUBLISHER_DISPLAY_NAME` | Package/Properties/PublisherDisplayName |
| `WINDOWS_STORE_VERSION` | 本轮明确选定的 `Major.Minor.Build.0`；CI 从 `version` 输入赋值 |

缺失身份时脚本直接停止。版本首段大于 0，各段不超过 65535，第四段保留为 0；不得用独立 workflow 的运行次数冒充全局递增版本。提交前核对 Partner Center 已上传/发布的最高版本，选择更高值，Tauri 内部版本使用前三段。

## 构建与产物

从 `core/` 执行：

```sh
pnpm --filter @cuberoot/desktop store:check
pnpm --filter @cuberoot/desktop store:test
pnpm --filter @cuberoot/desktop build:store
```

`store:check` 可在 Mac 上运行，只校验身份、版本、原有品牌图标和协议配置；不调用 SDK、不生成安装包。正式身份未取得时只能用合成 fixture 验证代码，不能宣称已核实真实微软配置。

`build:store` 必须在干净的现有 Windows checkout 中运行，依赖仓库指定 Node/pnpm、Rust x64 MSVC、Visual Studio C++ Build Tools 和 Windows 10/11 SDK。脚本使用独立 Cargo target，原生构建携带 `microsoft-store` feature，检测 EXE 的 x64 PE 架构，再调用 MakeAppx。Web UI 仍走现有 Desktop build，不复制资源或业务源码。

输出位于仓库 `.local-data/windows-store/<version>-<commit>-<unique>/artifacts/`：

- `CubeRoot-<version>-x64.msix`：未签名候选包。
- `AppxManifest.xml`：本次实际包身份、权限和回跳配置。
- `receipt.json`：来源提交、版本、渠道、EXE/MSIX SHA-256、大小及未签名/未提交状态。

CI artifact 保留 30 天。正式送审候选包和验证证据需及时保留在持久发行档案；`.local-data/windows-store/target` 仅为可重建编译缓存。旧官网下载包、现有会员商品和其他平台构建不由此工作流改变。

## 权限、登录与运行环境

- `runFullTrust`：Tauri 是 Win32 桌面进程，承载本地 WebView2、系统凭据、文件导出/打印和原生设备适配；不是 UWP 重写，也不申请管理员提权。
- `bluetooth`：智能魔方 BLE；协议解析继续复用现有共享实现。
- `microphone`：用户启用 Stackmat 音频输入时使用，不因应用启动主动录音。
- `internetClient`：账号、会员、网站内容和联网功能。
- `me.cuberoot.app`：MSIX 清单把完整 URI 作为一个参数交给原进程；复用现有 single-instance、deep-link、PKCE/state 和系统安全存储。商店 feature 下不再调用运行时注册，不把 WindowsApps 的版本目录写入普通协议关联。

清单的最低技术基线为 Windows 10 build 19041、x64；这不代表已经验收所有系统。首发至少实测 Windows 11 x64；若保留 Windows 10 可安装范围，还须验证相应环境。WebView2 Evergreen Runtime 必须可用；本轮不把 NSIS 的运行库安装步骤误认为 MSIX 也会执行。缺运行库的干净环境仍是送审前阻塞项：需落实受支持的依赖部署或明确的启动安装引导并实测，再确定正式支持范围。

官网下载版与 MSIX 可能同时安装，但当前 single-instance 插件使用相同 `me.cuberoot.desktop` 作为互斥身份：旧 EXE 正在运行时，MSIX 启动/回跳可能交给旧进程。因此测试前先退出另一渠道；正式发行前必须明确迁移或共存方案并实测，不能宣称两者可同时运行。不为绕过互斥而擅改稳定 identifier。

协议默认应用选择、凭据复用、WebView2/IndexedDB 路径与升级保留也须实测；不能假定相同 identifier 会自动迁移旧成绩。未完成迁移前保留旧安装，先导出/备份数据，不自动卸载或搬移目录。

## 会员支付

Windows 保留网站 canonical 会员页、套餐、订单和服务端权益；不增加微软商品、独立会员表或 Windows 专用价格规则。现有 PC 收银流程优先复用扫码/网站付款，付款成功只以服务端验签/查单结算为准。原生商店渠道不会切到 Apple/Google Billing。

Android `webMembership` 桥目前会选择 H5/wap 并标记 `android-direct`，本轮没有给 Windows 接这个桥；不能为了打开浏览器误用 Android 渠道。如果后续需要 Windows 外部收银体验，先把真实多端需要的契约抽到合适公共模块，保留桌面支付方式和订单归属校验。

送审时声明使用安全第三方支付，商店描述说明可选会员、实际价格范围和条款；支付提供方和退款入口须清晰。普通计时与免费功能不能被写成必须购买。会员续订/取消/退款仍由原购买渠道处理；已有有效权益由同一账号读取，不自动把 Apple/Google 订阅迁成网站订阅。

## 提交资料与验收顺序

1. 核对公司账号、包身份和名称；按真实计时/训练工具定位填写非游戏分类，最终以 Store 审核为准。
2. 保存中英文商店描述、真实 Windows 截图、隐私政策和支持链接；核对账号、购买记录、蓝牙及麦克风披露。评分问卷按真实功能回答。
3. 使用确切提交构建候选包，审阅 manifest/receipt；运行 Windows App Certification Kit，保存结果和例外原因。
4. 完成干净安装、启动、WebView2、覆盖升级、卸载行为、离线计时、成绩保留、导入导出与打印。
5. 验证登录冷/热回跳、账号切换、注销及与旧 EXE 共存；验证 GAN 16 UI、权限拒绝、快速转动和重连，以及 Stackmat 输入。
6. 用获准测试账号验收付款、取消、重复通知、返回刷新、退款和跨端读取同一权益，确认商店版不出现 EXE 更新入口。
7. 保存测试凭据到后台专用受限字段（不进 Git），向审核解释 full-trust 和第三方会员支付，提交最终候选包；审核和公开发布另记证据。

## 官方依据（2026-11-15 核对）

- [Microsoft Store 政策 §10.8](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies#108-financial-transactions)：PC 非游戏应用可使用安全第三方支付，须披露；安装完成后可在浏览器完成交易。
- [MSIX 准备清单](https://learn.microsoft.com/en-us/windows/apps/publish/store-readiness-checklist)：包身份、签名和提审资料。
- [手动生成 MSIX](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion)：manifest 与 MakeAppx。
- [桌面协议扩展](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions)：`windows.protocol` 参数。
- [WebView2 分发](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)：Evergreen 与运行库部署。
- [Tauri Microsoft Store](https://v2.tauri.app/distribute/microsoft-store/)：官方页面当前描述 EXE/MSI 路线，不应把它当作原生 MSIX 输出支持。
