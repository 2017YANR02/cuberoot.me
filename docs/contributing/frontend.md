# 前端组件与交互规范

根 [AGENTS.md](../../AGENTS.md) 细则（2026-11-05）。当次指令优先。路径相对仓库根，命令在 `core/` 执行。授权见[发布规则](release.md)。

## 移动端布局检查记录

竖屏、横屏的复现、修复和验收待办见 [2026-11-09 布局清单](../design/history/mobile-web-layout-audit-2026-11-09.md)。

## 代码风格

### 复用与验证

- 新增或复刻前全仓查组件、数据、工具、交互及资源。同职责复用，内嵌逻辑按职责抽取并保留原行为。优先改旧文件，跨端只加必要适配。禁复制、依赖原业务入口或擅加功能。
- 权限、回收站按根 AGENTS，保留他人改动。可读 Git 状态、差异及历史。typecheck 见[开发与验证](development.md)。先找根因、最小修复，禁症状补丁及多余抽象。日志、EXPLAIN、运行或浏览器证据支持结论，未证实标假设。性能、502、OOM 先 profile。
- UI 优先找 Playwright MCP（可能延迟加载），遵循内置浏览器规则，fixtures 查全集。新路由查重，改名或合并不加旧路由 redirect。
- 浏览器源码禁正则后行断言，用捕获边界或前字符判断（Hook + CI）。`browserslist` 跟随 Next 官方基线，旧 WebView 和开发工具走启动失败提示。顶层 `ssr:false` 用 `ClientLoadStatus`（`browser-support-policy.test.ts`、`timer-bootstrap.test.ts`）。
- 可复用组件或 hook 登记到 `/dev` 的 `_catalog.tsx`（`dev-catalog-sync`、`dev-tokens-drift`）。

### 数据与首屏

- 格式化、隐藏步骤、本地化只用于渲染和复制。播放、计算、校验、保存、API 及派生用原值。登录和管理态只增操作权限。
- **日期**中英文均 `yyyy-mm-dd`，含时间的提示同样适用。字符串保留原日历日，`Date` / 时间戳用 `@cuberoot/shared/iso-date` 的 `toLocalIsoDate`，禁 `toLocaleDateString()` 或截 UTC。WCA 区间见 [comp-date-range](../../.agents/skills/comp-date-range/SKILL.md)。
- WCA 时间序列默认从 2003-08-22 起步，第 0 帧为 1982 快照。统计聚合含 1982 场。
- SSR 首次 render / `useState` 禁读随机、当前时间和浏览器存储，固定首屏后用 effect 更新。外部存储用 `useSyncExternalStore` 服务端快照。
- **登录态**React 统一从 `@/lib/auth-store` 用 `useAuthUser()`、`useIsAdmin()`、`useOwnerKey()`（服务端快照，挂载后读当前会话）。登录、退出、刷新用 `authActions`。`getAuthUser()` 用于事件、effect 或异步返回后的核对，`subscribeAuthUser()` 用于会话桥接和缓存，均不派生首屏。`useAuthStore` / `isAdmin()` 仅供认证实现及非 React 命令。API 独立鉴权。
  - `eslint.auth.config.mjs` 限制 `app/`、`components/`、`hooks/` 的 TS/TSX 和 `lib/` 的 TSX（含别名、命名空间、转导出）。CI 跑 `pnpm --filter @cuberoot/client lint:auth`。`auth-hydration.test.ts` 覆盖游客、用户、管理员首屏、后续挂载及账号、角色变化。
- **标题**用 metadata / `useDocumentTitle`。弹窗、嵌入保留外层标题，`AlgCaseView` 传 `embedded`。一个监听器协调标题，关闭时恢复仍挂载的拥有者（`tests/recon-case-dialog-title.test.ts`）。
- Observer（`MutationObserver` / `ResizeObserver`）和 effect 检查写入重触发。相同值不重写，共享 DOM 单写入，卸载清订阅。嵌套页面或弹窗须跑有硬次数上限的隔离回归，覆盖挂载、关闭及重挂载，禁以单组件或延时代替。

### 布局与交互

- **界面（2026-10-19）**信息只显示一次，去掉常驻提示和套话。必要说明放设置、按需帮助或短反馈。列数、宽度、间距随内容和屏幕调整，优先留白与排版，分隔线只标实际边界。
- **并排面板（2026-11-25）**独立两栏必须可拖动调宽。复用 `@app-foundation/navigation-ui/resize-divider` 的 `ResizeDivider` 和 `resize-divider.css`，保留计时器热区及左右键。页面设栏宽上下限，窄屏单栏隐藏分隔线。表格列线和装饰线除外。见[计时器](../../core/packages/timer-ui/src/TimerWorkspace.tsx)、[API 目录](../../core/packages/client/app/[lang]/dev/_shared/ReferenceCatalog.tsx)。
- **展开（2026-10-30）**用状态对应的线性 Chevron，禁原生 marker 和字符或 CSS 三角。`details/summary` 保留键盘和语义。`@cuberoot/timer-ui/MoreToggle`（Web `@/components/MoreToggle`）的 `as="summary"` 默认 220ms 高度过渡，缺 `interpolate-size` / `::details-content` 时立即展开。按钮用 `MoreTogglePanel expanded={open}`，禁外层 `open &&`。首次展开挂载后保留，`keepMounted` 提前挂载。触发器、面板均支持 `animate={false}` 和减少动态效果。加载更多、切视图不自动套面板。例见 `/dev/components`。
- **弹窗**点按遮罩关闭，内点或向外拖不关闭。遮罩接 `useModalDismiss` props，已有生命周期用 `useModalBackdrop`。关闭即取消，无隐式保存或提交，仅提交中可禁用（Hook + CI）。
- **过渡**大弹窗用 `@cuberoot/timer-ui/dialog-motion` 的 `useDialogMotion`（Web `hooks/useModalDismiss`）。`motionRef` 挂遮罩，按钮和 dismiss 接 `close`，退出后回调。嵌入 `enabled: false`，手机日程底窗 `sheet: true`。仅变遮罩颜色、面板位移及缩放，玻璃祖先禁 opacity/filter，不留入场填充态。支持减少动态效果和卸载取消。跨模块用语言 layout 的 `PageTransition`，查询参数、换题、同模块详情不加全页动画。
- **按钮**用去 UA 样式的 `<button>` 或 `AppLink`，图标可用 lucide-react。禁 div/span 点击（iOS Safari），特例 div 加 `role="button"`、`tabIndex`、`onKeyDown`、`allow-static-onclick`（Hook + CI ratchet）。
- **返回（2026-10-20）**页面不新增返回按钮，wizard 步骤除外。已有或确需的导航仅显示箭头，保留 `aria-label` / `sr-only`，暂不加 Hook。恢复内容操作除外。回首页用 `BackHome`，放正文同宽容器，禁直挂 full-bleed root。其余复用现有返回组件。
- **共享控件**。选择、搜索框非空用 `components/ClearButton`。密码用带显隐眼睛的 `components/PasswordInput`，禁手写 `type="password"`。切换默认下拉，≤4 项且需横比才用 chip。chip、tab、下拉项不显示计数。答题对错用 `components/TrainingFeedbackOverlay` 的绿 ✅、红 ❌。
- **开关**。布尔用 `BoolToggle`，含独立标签的 DOM 一律左文右开关，禁 `row-reverse` / `order` 反转。同组纵向设置行撑满，开关右齐。二选一用原生 `<select>`，`PillToggle` 仅作无文字开关底层。禁裸 checkbox，特例标 `allow-checkbox: <理由>`（Hook + CI ratchet）。`block-toggle-side.mts` 和 `toggle-side-guard.test.ts` 共用扫描器覆盖 client/timer-ui/app-ui，Hook 查增量，CI 查全集及共享 DOM 顺序。
- **菜单与表格**。下拉宽度 `fit-content`，列 flex 加 `align-self:flex-start`，禁固定 `min-width`。absolute + `top:100%` 锚定面板用 `hooks/usePanelClamp`，标 `anchored-panel: clamped`。确证安全标 `anchored-panel: safe (<理由>)`（Hook + CI ratchet，`audit:overflow` popup 已通过）。表头排序用 `components/SortArrow`，只在当前列文字右侧显示（CI）。吸顶表头用 `components/sticky-table.css` 的 `.sticky-scroll`、`.sticky-thead`，契约见文件头。
- **CSS 定位**。共享控件用 `.共享class.角色class` 等明确作用域，禁止同优先级单 class 覆盖。absolute/fixed 改 relative 重置原 inset/top/left 等。改 static 重置 transform/translate，未生效的 inset 无需修。全局固定按钮右沿用 `right: max(16px, calc((100vw - <content-max-width>) / 2))`。定位守卫为 `block-css-position-cascade.mts` 和 `css-position-cascade-guard.test.ts`（共用扫描器）。规则内 `allow-css-position: 具体理由` 可豁免，动态 class 或复杂选择器须浏览器复核。
- **项目选择**统一 `components/PuzzlePicker`，禁自写菜单（Hook + CI `component-reuse-guard`）。WCA 选择器、内联例外和比赛表头按下文链接的 wca-event。
- **共享元素的位置稳定（维护者要求，2026-11-25）**：在相同视口下，同类页面或同一流程各状态共用的主图、导航、操作按钮等元素，应相对各自的容器保持稳定。随步骤出现、消失或改变长度的控件和文案，放在共享元素下方或独立区域。验收时对照切换前后的元素位置，同时检查外框尺寸。

### 身份、品牌与公式

- **选手身份（2026-11-04）**用 `PersonLink` 或 `WcaPersonIdentity`，传 `flag`，保留姓名模式、曾用名、历史国籍与点击行为。表格国旗跨行对齐，禁止单页改 logo 尺寸或加外边距。组件选择、链接嵌套和对齐细则见 [cuber-name-display](../../.agents/skills/cuber-name-display/SKILL.md)。
- **厂商与培训机构 logo（2026-10-26）**。统一 `CubingBrandLabel` 和 `public/images/brands/`。保留品牌原色及轮廓，含有意义的内部白色图形。去掉装饰描边、外框、光晕，自带白边换无边素材。优先真实 SVG，禁嵌 PNG 冒充矢量。
- **公式详情**。`/alg` case 用 `AlgCaseView`、静态主图 `CaseThumb`、动画 `AlgPlayer`。多朝向保留主图与共享结构，桌面一行一朝向、左动画右公式。普通、编辑、F2L 入槽行共用 `AlgFormulaRow` / `AlgFormulaReadRow`。行尺寸只由 `components/alg-formula-row.css` 管理，编辑模式不加补偿。标签图标、工具图标和菜单文字（含 Portal）共用 `--alg-ui-size`，图标用 `1em`。详情、F2L 分组只传 `tags`，共享行定位、去重（`alg-row-tags.test.ts` 验渲染和调用边界）。展开工具、输入聚焦保持行尺寸，切换模式保留选中。
  - 改公式行组件或布局 CSS 时运行 `pnpm --filter @cuberoot/client test:alg-layout`。实测宽窄屏、触屏、分组、长公式和加粗坐标。本地 Chrome，CI Playwright Chromium，无需 Next 或数据库。
- **魔方静态图（2026-10-16）**。`/alg`、`/recon`、`/timer` 及同类页复用 `CaseThumb`、`VisualCube` 或计时器绘图器。少量图用 `local`，长列表、选择网格、旧成绩加 `loading="lazy"`。参数、回归及网络图例外见 [visualcube](../../.agents/skills/visualcube/SKILL.md)。

## 主题/颜色

- 写 CSS 色值前读 [theme-tokens](../../.agents/skills/theme-tokens/SKILL.md)，禁硬码灰阶。
- **设备图**。`/dev/expenses`、`/dev/infrastructure` 新设备同次配齐准确型号、配色的产品图。`infrastructure-costs.ts` 的 `imageSrc` 保持必填。保留用户给出的完整型号（含屏幕版本，普通屏不可代替 PROLED XDR）。优先官方或用户素材，复用 `.infra-equipment-art` / `.infra-equipment-image` 的尺寸、比例、留白和对齐。禁通用图标及其他型号或空白占位。
- **图片透明与缓存**。用真实透明抠图，禁烘焙底色（含棋盘格）。验产品外像素透明度并预览深浅背景。`next/image` 保留 `unoptimized`（曾输出白底 JPEG）。替换浏览过的同名图须换 URL。见[素材记录](../design/equipment-images.md)。
- **玻璃**定义在 `@app-foundation/ui-controls/glass-surface.css`，经 `@cuberoot/app-ui/appearance.css` 接入。本站 `appearance-material.css` 绑定主题并兼容旧变量，`site-surfaces.css` 适配旧页面。新表面用 `data-site-surface="panel|popover|heading"`，独立绘制层用 `af-glass-surface`。页面负责布局和状态色，共享材质负责折射、反光边、无障碍回退。多余底框只约束已确认位置，候选不自动扩大范围，复用材质 Hook/CI。截图巡检按需，不作日常开发或提交门槛。见[玻璃回归](../design/glass/glass-menu-regression.md)。
- 既有页面的玻璃选择器通过 `@reference` 引用 `components/glass-utilities.css`，按用途使用 `site-glass-panel/menu/dialog/heading`，保留页面作用域。分段选择器用 `LiquidGlassChips`，轨道用 Foundation 的 `frosted`，活动滑块用 `lens`。场景选择器只在有图片时生效，独立交互控件可在纯色主题继续显示材质。
- **提示**。按钮或链接的短悬停提示用 `components/Tooltip`，如 `<Tooltip content={tr({zh,en})}>{(tip) => <button {...tip}>…</button>}</Tooltip>`。触发 props 挂实际元素，合并同名事件。组件处理 hover/focus、Escape、移入提示、Portal、视口钳制。页面禁自写气泡、blur/透明度或以原生 `title` 代替设计提示。Hook/CI 共用材质扫描器拦截 `content: attr(data-tooltip/data-tip/title)` 伪元素，范围不含任意 JSX 或动态样式。可交互内容避开 Tooltip。点击说明用 InfoTooltip。Portal 继承全站主题，局部配色预览单独核验。

## 项目菜单短名

### 项目图标先进入图标库（维护者要求，2026-10-20）

按 [wca-event](../../.agents/skills/wca-event/SKILL.md) 先入共享 SVG 库、生成映射并核验图标库，再用同一键接入各端。新增模拟器同次交付图标。源文件、图形要求、双语别名、例外及验证命令见该技能。

项目目录直接写双语短名。分组、选中项及提示均省「魔方」，三维尺寸省乘号（`233`、`334`、`335`），左侧文字与提示一致。保留 ID、计算及保存值，正文用词照常。新数据源纳入 wca-event 所列守卫。

## 圆角

用 `@2017yanr02/continuous-corners`。全站入口为 `core/packages/client/app/layout.tsx` 的 `SiteCorners`。自定义或反向圆角用 `continuousCornerRadii`，真圆保持圆形，禁渐变、手绘曲线或 CSS squircle 替代。

## 导航

先查 `@app-foundation/navigation-ui` 的 README 和导出。通用布局、动画及圆角归共享包，业务菜单与权限归本站。内部工作台和联系页侧栏均复用该包，入口为 `core/packages/client/app/[lang]/{workspace,contact}/page.tsx`。
