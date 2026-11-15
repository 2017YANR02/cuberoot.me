# 2026-11-15 第一轮安装端 AI 验收

状态：第一轮已结束，修复已分批本地提交；未推送或部署。本文记录本轮证据，不替代 [App 路线图](mobile-app-roadmap.md) 的总体状态，也不表示五端验收完成。未覆盖的手机滚动、键盘返回与真机能力列入后续边界。

范围由维护者指定：重点检查“计时”和“我的”，明显问题直接修复；需要实体魔方操作时再请维护者参与。验收不依赖备案审批完成。证据保存在本机 `.local-data/ai-acceptance-2026-11-15/`，其中运行日志和截图未作为源码提交。

## 1. 已发现并修复的问题

| 问题与复现条件 | 修复 | 本轮证据 | 本地提交 |
| --- | --- | --- | --- |
| 退出后，迟到的账号校验或登录票据交换仍可能恢复旧会话；旧账号的校验结果也可能覆盖或清除新登录账号 | 共享认证客户端检查会话版本，并串行执行原生存储写入；失效登录不再向 React 调用方返回会话 | 修复前 3 个回归均失败；修复后覆盖旧 200/401、退出后换号，以及退出发生在原生存储提交过程中的情形 | `699157ceff` |
| shared composite 构建未纳入源码实际导入的 JSON | 在已有 tsconfig include 中纳入 JSON，保留现有模块边界 | shared build 完成；后续 iOS 与 Mac 完整构建成功 | `245be20fcb` |
| Watch 复盘运行时构建引入不适合 QuickJS 的依赖，阻断本轮 Mobile 构建 | 调整 Watch bundle 构建，并让颜色模型使用现有颜色子集公开入口，减少不相关依赖进入运行时 | Watch 定向回归、Mac 上 QuickJS smoke 及后续完整 iOS 构建 | `bdbb58a6d6` 中的本任务部分 |
| 320×568 短视口下，计时工作区高度 451px、内容高度 570px，`overflow:hidden` 使底部统计不可达 | 将共享 `.mobile-timer-stage` 改为可滚动；已有原生 viewport 覆盖保持不变 | 修复前后浏览器截图；修复后可滚到 ao12，底部导航不遮挡最后统计行 | `93974e8286` |
| 原生 Mac 的 App 为英文，但“我的”进入中文 `/zh/account` | 工具和账号的首次 iframe 入口使用网站已有显式语言路径；英文 `/en/account` 仍指向 canonical `/account`，不新增页面或更改网站路由 | 中文 Accept-Language 下线上只读响应复现；新 Mac 包已显示完整英文登录表单 | `56b0157665` |
| Mac 点击空邮箱触发既定系统浏览器交接，却立即失败 | Tauri opener 命令原本没有 URL scope；仅补充 `https://cuberoot.me/*` | 修复后实际打开默认 Chrome，复用已有浏览器会话自动回跳；原生 Me 成为登录态，Web session 同步完成；退出应用再启动后会话恢复 | `6ff0260af7` |
| 原生登录交接失败时，已加载的“我的”整页被错误状态遮盖，无法继续操作表单 | 保留原 iframe，使用已有登录错误 toast；不把系统交接失败当成网页加载失败 | 定向组件测试确认同一个 iframe 仍可见且错误提示出现 | `1ce081f7f1` |
| iOS Simulator 未签名包缺少 Keychain entitlement，登录交接存储失败 | 模拟器构建采用 ad-hoc 签名并生成所需 entitlement，不降级安全存储 | 新包成功打开系统 Browser；最终包在两个 iPhone 模拟器覆盖安装并启动 | `48f5fe2404` |
| iPhone Simulator 关闭系统 Browser 后，原 iframe 的空邮箱仍保持焦点，残留键盘压缩横屏视口 | 网站桥在原生交接前释放当前 LoginForm 内的焦点；保留系统 Browser 委托 | click/keydown 两个回归修复前失败，修复后通过；未部署，因此原生远程页面尚未取得此修复 | `c61103c5c6`，网站未发布 |

iPhone Simulator 的同类交接失败另有构建根因：未签名包的 SecureStorage 写入报 `-34018`，缺少 Keychain entitlement。构建流程另行修正模拟器签名；新签名包已成功打开系统 Browser，竖横屏的输入框和键盘可见。未降级安全存储，也没有输入或提交凭据。关闭 Browser 后原 iframe 焦点和键盘仍可能保留，见下方未完成项。

提交归属说明：`bdbb58a6d6` 在并发暂存期间还包含其他会话的 `shared/package.json` 中 `./draw`、`./draw/words`、`./draw/controller` exports/runtime 声明。这些不是本轮验收修复，不计入本任务成果；不得把该提交全部内容归为 Watch 修复。工作区中其他会话的首页、Draw、小程序等改动同样不属于本轮。

语言修复仅控制 App 自有的首次产品入口，不重写网站导航 ACK、已记录的子页面或重试目标，因此不会强行为静态工具、资源或认证地址添加语言前缀。`?lang=en` 先设置 `SameSite=Lax` Cookie 再跳回裸地址，无法在 iframe 不接受第三方 Cookie 时可靠锁定英文；本轮直接复用网站现有 `/en` 页面树。公开 canonical、分享与其他外部链接保持原约定。细则见 [三栏合同](mobile-three-tab-contract.md)。

## 2. 页面验收矩阵

以下各层证据独立记账。共享页面的浏览器通过不能替代原生系统能力验收；模拟器通过不能替代手机或手表真机。

| 环境 | 本轮已观察或执行 | 当前边界 |
| --- | --- | --- |
| Chrome 中的安装端共享 App，390×844 | 随机三阶打乱、预览、来源选择、设置；实际长按起表与点击停表，保存 11.846 秒成绩；运行时周边导航/动作禁用，停表后生成下一题 | 独立浏览器数据，不是原生 BLE 或手机触感验收 |
| 同一共享 App，320×568 | 历史替换计时视图；成绩详情底部操作可达；+2 与备注保存并在刷新后保留；修复后完整统计可滚动到达 | 主要布局修复证据；无生产成绩写入 |
| 同一共享 App，844×390 | 设置分类与正文可分别滚动；智能魔方设置可到达最后的自动复盘/解法组 | 只验设置页面，不表示魔方连接或自动计时通过 |
| 同一共享 App，1280×800 | 求解器、计时、历史三栏；统计摘要与空图表状态；更多菜单和手动输入 12.34 秒，浏览器成绩计数成为 2/2 | 未扩展到全部项目、全部打乱来源或多人矩阵 |
| 浏览器“我的”，390×844 | 加载真实网站 `/zh/account` 未登录页；登录控件位于 App 底栏上方 | 浏览器 fallback；未提交凭据，不是安装端登录闭环 |
| 本机 macOS 原生 Tauri debug App，窗口布局 | 652×820、392×640、1200×821 下 Timer 与 Me 可见；窄窗底部导航、设置分类下拉、智能魔方设置滚动至末组；Me 登录选项可滚动到达；宽窗恢复求解器栏 | 本轮场景未发现新增阻断布局问题；网站可隐藏的宠物浮层在窄窗部分遮挡登录按钮文字，未修改 |
| 本机 macOS 原生 Tauri debug App，账号 | 最终包点击空邮箱打开 Chrome auth/mobile；复用既有浏览器会话自动协议回跳，Me 成为登录态；菜单 Quit 后重新启动，仍显示 Change avatar、不显示 Sign in/up、无错误，安全存储恢复与 iframe 同步通过 | 未手填或提交凭据，未绑定、退出账号、注销或修改资料；其他 provider 与 BLE 未验 |
| iPhone Duo Simulator | 新包覆盖安装；展开竖屏/横屏的 Timer 与 Me 可显示；合上竖屏/横屏可显示；最终签名包再次覆盖安装并启动 | 本轮不把此前的截图或历史 BLE 记录当作新包证据；触摸滚动及完整键盘返回矩阵保留后续验收 |
| iPhone 18 Pro Simulator | 新包覆盖安装；Timer 正向竖屏、左右横屏；横屏打开智能魔方设置后旋转回竖屏，分类下拉可自适应；新签名包打开系统 Browser，竖横屏输入框和键盘可见 | DeviceHub 拖动未能有效推进滚动，触摸滚动不标通过；Browser 返回后的原表单焦点/键盘残留未解决；倒置竖屏不在 Info.plist 支持范围，不算布局缺陷 |
| 实体 iPhone、Android、Windows | 本轮未完成视觉或系统能力验收 | 共享修复可供后续安装验证，但不能据此把这些平台标为通过 |
| Apple Watch | Watch bundle 与 Mac 上 QuickJS 运行验证 | 无 Watch 页面视觉、实体安装或 BLE 验收 |
| 微信/抖音小程序 | 本轮未执行 | 独立运行时，保留单独验收 |

## 3. 检查与构建证据

测试分组存在重复覆盖，以下数字按实际各次运行记录列出，**不相加为不重复的测试总数**。

| 检查 | 结果 | 证据/范围 |
| --- | --- | --- |
| 账号会话与 Web surface 定向回归 | 4 文件 / 30 项通过 | `auth/installed-auth.test.ts`、`auth/use-installed-auth.test.tsx`、`auth/account-management.test.ts`、`installed-web-surface.test.ts`；结果见 `account/results.json` |
| 语言入口与实际 App 接线回归 | 4 文件 / 52 项通过 | `web-surface-url.test.ts`、`installed-web-surface.test.ts`、`mobile-more-actions.test.ts`、`app-smart-cube-integration.test.tsx`；包含工具深链、query/hash、重复参数、语言入口及通知目标 |
| 既有视口回归 | 1 文件 / 7 项通过 | `mobile-viewport.test.ts`；CSS 修复的主要证据是浏览器前后对比 |
| Watch 定向回归 | 2 文件 / 9 项通过 | `native/watch-tests.log`；不代表 Watch UI 或实体蓝牙通过 |
| 原生交接失败时保留 Me 的回归 | 定向组件 1 项通过、34 项跳过；另 2 文件 / 22 项通过 | 新增组件回归及既有 installed-web-surface、installed-auth 测试；与前述认证分组有重叠 |
| 网站登录桥焦点回归 | 3 文件 / 36 项通过 | `mobile_embed_auth.test.ts`、`mobile_embed_apple_bridge.test.ts`、`apple_login_ui.test.ts`；交接时 click/keydown 焦点释放、无关输入框保留，以及原有 Apple 能力/会话边界；为组件 DOM 回归，不是 iOS 软键盘验收 |
| app-ui 类型检查、改动 diff 检查 | 通过 | 按改动阶段执行，未以根 references-only tsconfig 冒充检查 |
| shared build | 通过 | `native/shared-build.log` |
| Watch QuickJS smoke | 通过已执行的离线查询和复盘路径 | `native/watch-quickjs-smoke.log`；离线 lookup loaded，复盘显示 loaded/solved，且不依赖 Browser/Node globals；运行于本机，不是手表设备 |
| iOS 最终完整构建 | `BUILD SUCCEEDED` | `native/ios-auth-final-build.log`；最终签名包覆盖安装并启动于两种 iPhone 模拟器，保留数据；早期构建另见 `ios-final-build.log` |
| macOS 最终 debug App 构建 | 完成原生可执行文件及 App bundle | `native/mac-auth-fixed-build.log`；是本机调试包，不表示商店发布、签名分发或公证通过；早期构建另见 `mac-final-build.log` |
| macOS 原生冷启动恢复 | 通过 | 菜单 Quit 后重新启动最终包，`native/mac-auth-cold-start.json` 记录 signedIn=true、signInForm=false、error=false |

自动化账号回归仅使用内存存储、合成账号与模拟网络。Mac 原生人工界面验收另行复用了已登录的默认浏览器会话，自动完成一次真实原生登录与网页会话同步；未输入凭据，也未执行账号退出、绑定、注销或资料修改。Watch bundle 中存在的构建警告不等于其未执行路径已完成验收；对应日志保留，未来仍须按实际能力验证。

## 4. 证据入口

本机目录：`.local-data/ai-acceptance-2026-11-15/`。

- `timer-ui/REPORT.md`：共享页面浏览器流程、视口、局部修复与边界；截图包含 `320-stats-clipped-before.jpg`、`320-stats-scroll-after.jpg`、`390-solve-saved.jpg`、`844-landscape-settings.jpg`、`1280-history-dock.jpg`。
- `account/REPORT.md`、`account/LANGUAGE.md`、`account/results.json`：会话竞态与语言入口证据。初始 `account-390.png` 只记录当时 5 秒观察窗的加载状态，不能单独判定永久加载失败；后续浏览器及原生观察另记。
- `account/NATIVE-HANDOFF.md`：Mac opener scope、iOS Simulator Keychain entitlement 和登录失败 UX 的分别取证；临时诊断日志已删除。
- `native/`：最终构建日志、Duo 各形态截图、普通 iPhone 模拟器截图，以及 `mac-me-english.jpg`。
- `mac-window/REPORT.md` 与截图：本机原生窗口、设置及账号滚动证据；其中旧包账号交接失败结论已由本报告的最终包修复复测更新。

## 5. 未完成与下一轮

- iPhone Duo/普通 iPhone 的触摸滚动、完整键盘返回矩阵仍需后续验收；本轮工具拖动未能有效推进页面，不把桌面或浏览器滚动通过代替手机通过。
- iPhone 系统 Browser 关闭后的键盘残留已完成网站桥本地修复与组件回归，未发布到远程页面。发布后仍需重新验证系统 Browser 取消/关闭、原 iframe 焦点、竖横屏键盘和页面恢复；当前不算键盘流程通过。
- 使用实际安装包验证真实 iPhone、Android 和 Windows 的 WebView、键盘、安全区、系统返回、登录取消/冷启动回跳及存储恢复；Mac 已走通的登录回跳不能替代这些平台证据。
- 默认 GAN 16 UI 的连接、状态、打乱引导、第一手起表、复原停表、成绩/复盘保存、下一局及异常重连，本轮均未实物验收。需要维护者实际操作魔方时再安排。
- Watch 的离开 iPhone 独立使用、真实直连、恢复同步、后台与功耗另行验证。
- 本地浏览器源访问 WCA 随机真题 API 曾返回缺失 CORS allow-origin；静态比赛目录返回 200，证据见 `timer-ui/wca-browser-cors.json`。未扩大 CORS 配置，也不据此推断原生同样失败；后续应在目标宿主确认。

本轮提交不等于推送、部署、商店发布或完整多端 parity 验收。本报告不修改路线图勾选。
