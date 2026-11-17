# 2026-11-16 登录取消与计时弹层 AI 验收

状态：`HISTORICAL`。本轮局部验收记录；不代表全平台完整验收、正式发布或所有者视觉认可。当前产品门槛仍见[路线图](../mobile-app-roadmap.md)。

## 范围与环境

用户授权按顺序检查“我的”登录取消/返回/键盘恢复，再检查计时状态、弹层横竖屏与缩窗；发现问题直接修复，按颗粒度本地提交。本轮没有 push。

- Web：本机 Chrome、localhost:3000，重点尺寸 956×440、844×390、390×844、568×320、320×568。
- 原生 Mac：本机 Tauri debug 应用。通过系统窗口菜单检查缩放与四分之一窗口；坐标拖动因自动化工具找不到目标窗口未完成，不记为拖动通过。
- iPhone 18 Pro / Duo：Device Hub 的 iOS 27.2 **模拟器**，不是同名物理设备。覆盖安装保留原有容器，未卸载或清数据。
- Android、Windows、Apple Watch、小程序本轮没有新增设备画面验收；共享源码与自动测试不能替代这些宿主验证。

## 修复记录

| 本地提交 | 修复与验证 |
| --- | --- |
| `7fe9c3bd21` | 手动录入复用共享弹层取消逻辑；从内容拖到遮罩、pointercancel 不丢草稿。补旧 WebView 的高度与颜色回退。相关测试 15 项通过。 |
| `92dbcd6088` | 设置分类栏为底部重置区域留出外部空间，避免滚到底的“高级”分类被覆盖；956×440 画面复验通过。 |
| `68acc84b21`、`f00bd102ef` | 字体列表按视口限制高度/翻转方向；补 WebKit 点击后焦点仍在父设置容器的情况。首个 Escape 仅关字体菜单并归还焦点，第二个关闭设置；Web 与新构建 Mac 原生复验通过。 |
| `95a28fe361` | 成绩详情补旧 WebView 的 vh 与主题颜色回退，涵盖普通、全屏与窄屏分支。 |
| `7275b82d5e` | 默认布局复用间距高度预算；短屏长打乱收紧行距/词距，保留字号下限、用户设置和自然展开。 |
| `251950ac75` | 来源/难度控件移入菜单后不再留下占位空容器，保留内联入口；补实际 portal/内联交互回归。 |

## 已观察的交互

- iPhone：邮箱入口唤起系统登录浏览器，竖屏与横屏软件键盘可见时取消；返回后键盘消失，“我的”高度、导航及计时切换恢复。未填写账号、验证码或提交登录。
- Duo：折叠/展开态登录浏览器的软件键盘取消恢复；设置弹层展开后折叠，分类切换为窄屏入口，关闭可返回计时。模拟器外壳旋转与实际 interface orientation 不是同一件事；不将外壳旋转记作横竖屏通过。
- Mac：保留已登录会话，没有为了测试取消而退出原账号。新构建的字体菜单两级 Escape 通过。
- 登录边界：关闭整个系统登录浏览器的外层回调共用；WCA、Google、Apple 等第三方授权页自身取消仍是不同流程。本轮没有将邮箱入口取消推广成全部 provider 通过。Apple 当前走 Web OAuth，没有独立原生账号登录插件；StoreKit 购买取消不属于账号验收。
- Web：8 类设置在 320×568 与 568×320 可滚到底；项目、来源、难度及字体菜单无已观察到的边界溢出。FMC / 多盲录入草稿旋转后取消，未产生新成绩。
- Web 普通三阶：运行时竖横切换、停止、+2 / DNF / DNS、观察期旋转与取消；取消观察不新增成绩。手动录入从 956×440 缩到 568×320，再转 320×568，草稿仍在、操作区可达。
- 覆盖安装后 GUI 确认 Mac 原成绩 2/2、best 6.10；iPhone 1/1、best 0.50；Duo 4/4、best 0.80。安装前后应用自身数据库/偏好校验保持；Duo 系统登录浏览器缓存有关闭写入，另列回执。

Web 使用单独的 `AI验收 2026-11-16` 分组，仅留一条测试记录，最终状态 DNS；默认分组原 132 条未改。结束后恢复 Default、三阶/完整/真题、观察关闭及浏览器默认视口。Next 开发指示器偶尔遮住右上关闭按钮属于开发工具覆盖，不把它计为正式包缺陷。

### 极小视口与长打乱

续验通过画面 DOM 确认现有自定义值为 scrambleGap 230、sourceGap 69、timerGap 92、cubeGap 175、sourceScale 1.67、cubeScale 0.98、scrambleScale 1.79；没有覆盖这些偏好。修复使默认间距也使用已有高度预算，短高度长打乱适度收紧行距/词距，并去掉来源/难度控件全部移入菜单后遗留的空容器。

- 三阶 956×440：实际计时区域 clientHeight / scrollHeight 为 392 / 392，单屏。
- 三阶 568×320：计时区域 272 / 273，统计和预览实际内容均在屏幕内（预览 bottom 317.17）；约 1px 来自底部 padding 舍入，不通过裁切或特别补丁消除。
- 七阶叠加上述大字号、长比赛名时，固有内容仍可能超过极小视口。按现有打乱可读性合同保留字号下限、完整换行和整体滚动；已实际滚到底确认读数、统计、预览可达且不重叠。**此例不记为单屏通过**，不把所有高度溢出都归因于自定义间距。

## 自动验证边界

以下使用既有业务测试及针对已复现缺陷的回归测试，不等同真实设备操作或声音听验：

- 登录 bridge / auth hooks / visual viewport：42 项通过（其中 viewport 定向选择 4 项，其余 4 项未在该命令执行）。
- Apple 登录组件与回调：2 文件 36 项通过，覆盖取消等待/重试、BFCache 返回、access_denied 清理、忽略迟到成功；不代表真实 Apple 授权 GUI。
- 计时状态与控制 hook / 声音调度：6 文件 57 项通过。覆盖 idle→holding→ready→running→stopped、早松、取消、pointer loss、overlay gate、罚时锁定及按钮。判罚边界为 15.000 秒正常、15.001 秒 +2、17.000 秒仍 +2、17.001 秒 DNF；8/12 提示顺序与清理由 fake timers 验证。
- 智能魔方 fake transport、多人计时、读数、解法栏及成绩详情：98 项通过；不证明 BLE 扫描、实体转动或重连。
- 字体菜单、弹层位置与设置：3 文件 8 项通过；timer-ui 类型检查通过。
- 最后两项布局修复：间距/viewport/WCA 来源与难度等定向 46 项通过，timer-ui、app-ui 与 client 标准类型检查通过。直接调用旧 client tsc 曾在默认约 4GB 堆上限退出（OOM，没有类型诊断）；随后按仓库标准 `typecheck`（tsgo）成功，不提高堆上限。
- 旧 WebView：Chrome 103 目标的 CSS 编译检查保留回退规则；没有把静态检查写成 Android 103 设备验收。

主要命令在 `core` 执行：

```sh
pnpm --filter @cuberoot/client exec vitest run tests/mobile_embed_apple_bridge.test.ts tests/mobile_embed_auth.test.ts
pnpm --filter @cuberoot/app-ui exec vitest run src/auth/installed-auth.test.ts src/auth/use-installed-auth.test.tsx
pnpm --filter @cuberoot/client exec vitest run tests/apple_login_ui.test.ts tests/apple_auth_callback.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/timer_machine.test.ts tests/inspection_penalty.test.ts tests/timer-timing-display-shared.test.ts tests/timer-penalty-actions.test.ts
pnpm --filter @cuberoot/app-ui exec vitest run src/hooks/use-timer-controller.test.tsx src/timer-sound-integration.test.tsx
pnpm --filter @cuberoot/client exec vitest run tests/timer-font-picker.test.ts tests/panel-clamp-position.test.ts tests/timer-settings-panel.test.ts
pnpm --filter @cuberoot/timer-ui exec tsc --noEmit
pnpm --filter @cuberoot/client typecheck
```

## 证据与剩余人工项

本地持久证据位于 `.local-data/ai-acceptance-2026-11-16/`：登录键盘/取消、运行与观察、录入、原生计时及旋转截图；`web-overlays/` 保存弹层矩阵；`shared-ui-native/second-*` 记录来源 `f00bd102ef` 的构建、安装与数据校验。原生构建同时包含当时 checkout 的其他已提交功能，不把它们自动视为本轮验收通过。

最后两项修复在 `251950ac75` 再次构建 Mac/iOS，并覆盖安装到两台模拟器；两台应用持久数据 SHA 均不变，回执见 `shared-ui-native/third-*`。最终 GUI 再验 Mac 系统菜单缩窗与还原、iPhone 实际竖横屏、Duo 折叠/展开，原成绩计数和 best 保持。构建期间其他任务的滑块 CSS 仍有变化，可能进入 Mac/iOS 的不同构建时点；来源指纹已记录，这些额外 WIP 不属于本轮一致性通过项。

仍需要设备或所有者参与的内容：实际账号/OAuth 成功回跳、系统权限拒绝后恢复、真实蓝牙魔方扫描/连接/转动/断连重连、触摸手感/震动/提示音、Watch 与手机交接；Android/Windows/小程序宿主及真实 iPhone/Duo 的系统中断和硬件能力。不会因 Web 或模拟器通过而勾掉这些门槛。

## App 导航与统一外观（本地追加验收）

维护者确认将深浅色/跟随系统、配色、强调色、背景统一到 App 级设置。共享模型、存储键、控件和主题 CSS 由 Web 与 App 复用；App 首次迁移计时偏好，之后由外层设置管理，并同步可信工具/账号 WebView。我的外层工具栏提供外观入口，离线也能打开；从计时设置或工具页外观入口进入同一独立页面，返回原标签。

导航修复区分外层标签与内层业务页面：工具的普通计时入口切换现有计时标签，普通账号入口切换我的；我的根页隐藏网站首页返回与重复设置标题、通用和外观分类。账号子页面仍可返回账号根页。训练、分享、复盘等带业务参数的计时链接保留完整地址交系统浏览器，尚未实现相应原生业务路由。桥接仅接受可信来源和当前可见的对应 iframe；普通浏览器及旧宿主保留原入口。

本轮完成的验证：

- 本地配对 App/Web 页面在 390×844、320×568、956×440 验收。修复独立外观页最初超出可用高度的问题；320×568 页面总尺寸匹配视口，956×440 标题和底部导航保持可见、背景列表在页内滚动。
- 工具→计时只有一套外层导航，工具 iframe 保持原页；工具外观→App 外观→返回后没有遗留 hover 菜单；工具登录入口切我的，账号根页没有回首页箭头或重复设置分类。
- 深色、配色、背景和语言即时联动；刷新恢复偏好。横屏计时仍为居中打乱/数字与右下预览。本轮未新增成绩，也未执行真实登录或操作魔方。
- App 集成 37 项、其余定向 App/主题/返回合同 26 项通过；账号导航/Bridge 六文件 64 项通过，客户端外观主题八文件 124 项通过，最终外观 hover 七项通过。测试组有交叉，不累加为总覆盖数。client/app-ui/mobile 类型检查、架构边界与文档检查通过。
- Mobile 生产构建和 Mac Tauri debug 构建通过；Mac 新包实际打开了我的外层外观入口。完整三页联动在本地配对页面验证，线上 WebView 尚未发布这次桥接改动。最终 Mac 构建后未再次重启用户正在使用的 App；本轮没有重新安装 iPhone/Duo，也没有将浏览器视口测试记作真机验收。

截图、构建日志与提交前工作区备份保存在 `.local-data/ai-acceptance-2026-11-16/app-appearance/`。临时本地配对服务已停止，自动加入的本轮 Next 临时类型路径已移除；正式源码仍使用正式站点地址。后续联动验收需同时具备新宿主和发布后的 Web 代码。
