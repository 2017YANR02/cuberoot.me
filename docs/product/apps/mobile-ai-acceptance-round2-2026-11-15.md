# 2026-11-15 第二轮安装端 AI 验收

状态：第二轮本地修复与可执行验收已结束，未推送或部署；受工具、远程发布和实体设备约束的项目保留待验。范围沿用[第一轮](mobile-ai-acceptance-2026-11-15.md)：优先计时内容尺寸、侧栏缩窗、原生外链，再补横竖屏、取消返回和旧 WebView 样式。总体进度仍以 [App 路线图](mobile-app-roadmap.md) 为准，不把共享代码或模拟器通过计作全部平台通过。

## 修复与提交

| 问题 | 修复 | 本地提交 |
| --- | --- | --- |
| 原生内容区域与整窗宽屏判定不一致，复盘槽位可能丢失 | 计时各消费者统一按宿主内容区域判断宽屏，浏览器沿用窗口回退 | `398a1e7c56` |
| 桌面外链只放行本站，邮箱误交给内嵌 Browser | 复用共享 URL 校验；Desktop 仅放行 http/https/mailto；Mobile 的 mailto 交给 AppLauncher，并检查取消结果 | `53490230f8` |
| 对战按住准备后旋转，holding/ready 状态残留，迟到的抬手可能错误起表 | 按玩家记录 pointer 所属；布局变化、失焦或失去捕获时取消未开始的触摸准备，不终止已运行计时或键盘准备 | `0a51870f52` |
| 侧栏拖宽后缩窗挤压计时主体 | 根据实际工作区及开放侧栏收敛宽度，为主体保留 320px；已关闭侧栏不占拖动预算 | `537c47f3ac` |
| WebView 103 不支持的单位、颜色和选择器会使布局声明失效 | 传统单位、主题值及 flex 回退；在 @supports 内启用新能力 | `02c06576b6` |
| 英文“我的”进入成绩子页可能跳回中文 | 网站 AppLink 在安装端保留显式语言，兼容 SSR 水合；普通 Web、认证/API/静态资源和外链保留原行为 | `c1db5c0e12` |
| 短横屏滚到底仍有统计被底栏遮挡 | 移除计时滚动容器的固定最小高度，使其收缩至底栏上方；保留内容自身最小尺寸和原生 viewport 覆盖 | `c5858ed653` |

最后一轮短横屏还复现了既有最小高度问题：844×390 中计时 stage 高 350px，超过底栏上方可用空间，滚到底仍遮住统计末行。第一轮仅改 overflow，未移除最小高度。修复后 Chrome 实测 stage 为 281px、底边 329px，最大滚动量从约 224px 增至 293px，ao12 完整位于底栏上方；320×568 中 stage 为 451px、底边 507px，末行同样可达。此为浏览器滚动证据，不替代手机触摸滚动。修改后已再次构建三个原生 debug 包，两个 iPhone 模拟器及 Android AVD 均覆盖安装启动，Mac 最终包已启动；Duo 最终包横屏显示原有 4 条成绩。

## 验收证据

| 环境 | 本轮取得的证据 | 边界 |
| --- | --- | --- |
| 共享 App / Chrome | 实际拖动两侧分隔条后在 1800、1200、1024、951、800 宽度切换，无文档横向溢出；1024px 稳定后主体 321px；设置分类和正文各自可滚动 | 160ms 侧栏动画期间短暂小于 320px，未把瞬时采样说成稳定宽度；无 ResizeObserver 循环错误 |
| 本机 macOS debug App | 已恢复既有登录态；WCA 外链打开默认 Chrome；支持邮箱交给 Mail；原生导出保存面板“取消→再次打开→取消” | WCA 目标返回 403，属于目标站响应；Mail 尚未配置账号，已退出，未发送邮件；未上传/恢复备份 |
| Mac 窗口尺寸 | 系统 Zoom 与四分之一窗口排列后，约 1200×820、2560×1321、1281×661 逻辑尺寸下计时页重排 | 本轮边缘拖动工具未实际改变窗口尺寸，未冒充最终包窄窗拖动验收；窄窗证据分为第一轮 Mac 原生记录与本轮共享 App 浏览器检查 |
| iPhone 18 Pro / iOS 27.2 Simulator | 最终原生包覆盖安装；计时竖屏/横屏；设置横屏转回竖屏；JSON 原生分享面板关闭后可重新打开 | 未分享或保存文件；模拟器工具拖动未有效推进触摸滚动，仍不标手机滚动通过 |
| iPhone Duo / iOS 27.2 Simulator | 覆盖安装；收起竖屏/横屏、展开竖屏、展开横屏设置；“我的”收起竖屏与横屏布局；原有 4 条成绩保留 | 不涉及实体设备、真实折叠硬件或 BLE；不把设备示意图的倒置旋转动画当成 App 竖屏适配 |
| Android 官方 AVD / API 36 | Debug APK 构建、覆盖安装和启动；WebView 133；最终限定日志中未见 App 崩溃，有系统 BluetoothPowerStatsCollector 能耗查询错误 | CUA 未暴露模拟器窗口，已有 Android 工具绑定的是另一台实体设备；浏览器拒绝调试内部 URL，未绕过。没有视觉、系统返回或 WebView 103 真机验收 |
| Apple Watch、Windows、HarmonyOS、小程序 | 本轮无新增设备页面验收 | 不以 Mac/iOS 共享 UI 通过替代其系统能力验证 |

iPhone 取消系统 Browser 后，当前线上账号页仍保持空邮箱焦点并显示键盘；第一轮网页桥的本地焦点修复尚未取得线上复测证据。本轮语言导航修复也仅本地，需网站发布后在原生包远程页面重验。没有输入凭据、提交验证码、绑定或注销账号。

## 定向检查

分组可能重叠，数字不相加为唯一测试总数。

- 内容区域/复盘槽位：client 定向 12 项；侧栏组件拖动、缩窗、关闭重开与观察者清理回归通过。
- Mobile/Desktop 外链：27 项；覆盖允许协议、拒绝其他协议及系统拒绝/取消结果。
- 对战触摸生命周期：30 项；包括横竖互转的 holding/ready 取消、错误玩家抬手、运行中旋转、下次正常停表、键盘与捕获丢失。
- 安装端语言导航：组件/入口 66 项、proxy 路由 185 项，client 类型检查通过；SSR 水合无 recoverable mismatch。
- 取消与返回：app-ui 的 mobile-back、file-export、timer-export-settings 共 13 项；Mobile timer-effects 7 项通过。
- 最后短视口修复：既有 mobile-viewport 7 项通过，另以 Chrome 实际滚动、尺寸和修复前后截图确认末行可达。
- 旧 WebView CSS：现有兼容检查 2 项；chrome103 构建产物扫描未发现新增未保护单位。64 个现代/屏蔽新能力的 fixture 观察用于比较布局和颜色，**不等于真实 WebView 103 验收**。
- app-ui、timer-ui、Mobile、Desktop 相关类型检查按修改阶段通过。iOS、macOS 与 Android 均完成本地原生 debug 构建；不代表签名分发、公证或商店发布。

## 本机证据与剩余门槛

证据根目录为 `.local-data/ai-acceptance-2026-11-15/`：

- `round2/`：原生构建日志、手机/Duo 截图、Mac 导出取消截图、浏览器侧栏尺寸记录及横竖屏截图。
- `round2-legacy-css/REPORT.md`、`results.json`、`chrome103.css`：旧 CSS 能力回退的限定验证。
- `account/LANGUAGE-FOLLOWUP.md`：线上导航复现、组件修复前失败及修复后通过记录。

最终原生构建命令：在 `core/` 运行 `pnpm --filter @cuberoot/mobile ios:build`、`pnpm --filter @cuberoot/desktop tauri build --debug --bundles app --no-sign`；Mobile 资源构建完成后 `pnpm --filter @cuberoot/mobile exec cap sync android`，再用本机已安装 JDK 21 运行 `pnpm --filter @cuberoot/mobile exec node scripts/build-android.ts debug`。最终日志分别为 `round2/ios-scroll-final-build.log`、`mac-scroll-final-build.log`、`android-scroll-final-build.log`，均成功。iOS 覆盖安装保留数据；Android 使用 `adb install -r`。这些是本地调试构建，不是商店或分发构建。

仍需网站发布后复测语言导航与登录取消键盘；实体 Android/iPhone 的滚动、IME、权限、后台、文件分享与回跳；Windows 的窗口与系统 adapter；Watch 运行时和实体能力。GAN 16 UI 的真实转动、首手起表、复原停表、复盘和断连恢复另留实物验收。本轮无需维护者操作魔方，也未修改这些门槛的完成勾选。
