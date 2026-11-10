# 前端组件与交互规范

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

## 移动端布局检查记录

主要功能页的竖屏/横屏问题、复现条件、修复顺序和接手验收见 [2026-11-09 Web 移动端布局清单](../mobile-web-layout-audit-2026-11-09.md)。这是待办与历史检查记录，不替代下述组件规范。

## 代码风格

- **选手身份展示复用（维护者要求，2026-11-04）**：以 `/wca/results?tab=records` 的共享实现为准。跳转选手主页用 `PersonLink`，国旗通过其 `flag` 传入，不再手写战队 logo + 国旗 + 姓名链接；姓名模式、曾用名和历史国籍仍保留各自数据语义。比赛成绩弹窗、自定义目的地、整张可点击卡片和纯文本标题使用 `PersonLink` 同源的 `WcaPersonIdentity` 包裹原有内容，并传入 `flag`，不得为复用改变点击行为或嵌套链接；卡片/按钮内徽标用 `linked={false}`。表格中的国旗必须跨行对齐：共享紧凑 logo 列保留相同宽度，logo 靠右紧邻国旗；无战队行仍保留这列以对齐国旗，表头对齐国旗起点。不要将“不要占位”误解为允许国旗随 logo 宽度左右跳动；非表格保持自然宽度。logo 列宽、最大尺寸和比例统一由 `wca-person-team-badge.css` 管理，不在页面复制尺寸或叠加 logo 外边距。详见 `.agents/skills/cuber-name-display/SKILL.md`。

- **展开与收起（维护者要求，2026-10-30）**：展开/收起控件使用图标库中的线性图标（如 ChevronRight/ChevronDown），不得使用浏览器默认实心三角形、三角字符或 CSS 三角形。使用 details/summary 时隐藏原生 marker，图标随展开状态变化，保留原生键盘操作与无障碍语义。

- **厂商与培训机构 logo（维护者要求，2026-10-26）**：不加白色或其他装饰性描边、外框、光晕；原素材自带的白色轮廓也应使用无描边版本替换。保留品牌原色与标志形状，优先复用真实 SVG 矢量资源，不把 PNG 嵌入 SVG 冒充矢量。统一复用 `CubingBrandLabel` 和 `public/images/brands/` 资源，新增品牌或机构时同样遵循；logo 内部有意义的白色图形不视为装饰描边。

- **界面与文案精简（维护者要求，2026-10-19）**：不要重复内容、常驻提示和阅读套话。同一信息只展示一次，不重复标题、名称或说明；不添加“点击即可…”等常驻操作提示，以及“请阅读以下内容”“温馨提示”等无实际信息的引导套话。必要说明放到设置、按需帮助或交互时的短暂反馈中，正文只保留用户完成任务所需的信息。

- 页面层级优先用留白、间距和排版区分；分隔线仅在确实帮助辨识内容边界时使用。导航、标题和工具栏已有清晰布局时保持简洁，去掉多余的装饰性横线。
- 布局保持均衡，根据内容量和屏幕宽度合理安排列数、容器宽度与间距，避免大面积无意义留白；通过调整布局保持紧凑与可读性。

- 弹窗必须支持点击/触摸外部遮罩关闭,内部操作和从内部拖到外部不得误关;新改弹窗遮罩复用 `useModalDismiss` 返回的 props(已有生命周期用 `useModalBackdrop`),关闭等同取消且不得隐式保存/提交,仅提交中的临时禁用可阻止关闭;hook + CI 检查漏接关闭事件。
- 大弹窗开关过渡复用 `@cuberoot/timer-ui/dialog-motion` 的 `useDialogMotion`（Web 可从 `hooks/useModalDismiss` 导入）：`motionRef` 挂遮罩、`close` 接关闭按钮与 dismiss hook，退出结束后再调用原关闭回调；嵌入内容用 `enabled: false`，手机底部日程窗用 `sheet: true`。共享实现只动画遮罩颜色与面板位移/缩放，不对玻璃祖先施加 opacity/filter，不保留入场动画填充态；支持减少动态效果和卸载取消。页面跨模块过渡由语言 layout 中的 `PageTransition` 负责，查询参数、换题和同模块详情沿用各自交互，不另加全页动画。
- 新增或复刻任何功能前先全仓搜索现有组件、数据源、工具、交互契约与资源，存在同职责实现时直接复用或先提取单一事实源，禁止复制后改名、各端维护副本或擅自增加源实现没有的内容，跨运行时只保留必要的平台适配层。
- 复用内嵌逻辑时，能抽取就优先抽取：若逻辑仍属于某个页面、组件或业务入口，先将可共用部分移到职责合适的公共模块，再让原调用方和新调用方共同引用，避免新调用方直接依赖原业务入口或复制实现。抽取保持原调用方行为不变；已经独立的公共实现直接复用，不为抽取而新增无必要的层级或 package。
- 优先编辑已有文件；typecheck 范围遵循全局验证规则。
- 改动先定位根因,禁止在症状点打补丁;根因定位后落地用最小实现,不臆造抽象层/翻译层。
- 展示格式化、隐藏步骤和本地化后的值只用于渲染或复制;播放器、计算、校验、保存、API 和派生状态必须使用无损原值,登录/管理员态只能增加操作能力,不得改变公开内容语义。
- SSR 首次 render / useState 初始化禁读随机数、当前时间或浏览器存储;固定首屏后再用 effect 更新,外部存储走 useSyncExternalStore 的 server snapshot。
- 浏览器标题统一使用 metadata 或 `useDocumentTitle`；弹窗/嵌入内容不得抢外层页面标题，复用 `AlgCaseView` 时传 `embedded`。动态标题 hook 由单一监听器协调多个使用者，禁止恢复为每实例各建标题 MutationObserver；关闭时恢复仍挂载的标题拥有者。回归见 `tests/recon-case-dialog-title.test.ts`。
- 新增或修改 MutationObserver/ResizeObserver/effect 同步时，核对回调写入是否会再次触发自身或其他监听器；相同值不重复写，共享 DOM 状态只保留一个写入入口，卸载时清理订阅。涉及页面嵌套/弹窗时用有硬性次数上限的隔离回归验证挂载、关闭与重新挂载，不能只验证单组件或用延时掩盖循环。
- 浏览器端源码禁用正则后行断言,改用捕获边界或显式前字符判断;Hook + CI 守卫。
- UI 可用 lucide-react;不放页面级"返回"按钮(wizard 步骤间不算)。
- **返回导航（维护者要求，2026-10-20）**：全站已有或确需保留的返回导航只显示箭头，不显示“返回”“首页”“Back”等文字；通过 `aria-label` 或 `sr-only` 保留明确的无障碍名称。返回首页复用 `BackHome`，其他返回导航优先复用已有组件，不另造带可见文字的版本。本规则不要求新增返回入口，也不适用于“返回公式”等恢复内容的功能操作。暂不增加 hook。
- `BackHome` 必须放进与正文同宽的 header/topbar/wrap，禁直接挂在 full-bleed page root 下。
- 按钮式交互必须真 `<button>`(剥 UA 样式)或 `AppLink`,禁 `<div/span onClick>`(iOS Safari tap 不可靠);例外 div 加 `role="button"`+`tabIndex`+`onKeyDown`;豁免注释 `allow-static-onclick`。守卫:hook + CI ratchet。
- 选择/搜索输入框非空时显示清除按钮,统一 `components/ClearButton`。
- 所有密码输入统一复用 `components/PasswordInput`,必须带可切换明文的眼睛按钮,禁页面手写 `type="password"`。
- 切换器默认下拉;chip 仅当选项 ≤4 且需左右对比。
- 布尔开关用 `BoolToggle`，全项目统一内容/文字在左、开关在右（共享组件保持此 DOM 顺序，页面不得用 row-reverse/order 反转）；同组纵向设置行须占满共同宽度，开关右侧对齐，不得随标签长短错位；设置行已有独立标签时，开关也放在标签右侧。`block-toggle-side.mts` 与 `toggle-side-guard.test.ts` 共用扫描器，覆盖 client/timer-ui/app-ui；Hook 检查新增片段，CI 验证完整源码和共享 DOM 顺序。二选一统一用浏览器原生 `<select>` 菜单；`PillToggle` 仅保留无文字开关底层，不再提供二选一形态;禁裸 checkbox,特例注释 `allow-checkbox: <理由>`。守卫:hook + CI ratchet。
- 表头排序一律 `components/SortArrow`(文字右侧,仅当前列显示)。CI 守卫。
- 下拉/菜单宽度 fit-content,column flex 加 `align-self:flex-start`;禁钉 `min-width`。
- 锚定下拉面板(absolute + top:100%)必挂 `hooks/usePanelClamp` 钳视口,CSS 注明 `anchored-panel: clamped`;确证安全注明 `anchored-panel: safe (<理由>)`。守卫:hook + CI ratchet;实测 `audit:overflow` popup pass。
- 共享控件的页面定位覆盖不能依赖 CSS 加载顺序：用 `.共享class.角色class` 等明确作用域，禁止同优先级单 class 覆盖。absolute/fixed 改 relative 时显式重置原有 inset/top/left 等偏移，改 static 时重置 transform/translate；静态定位下未生效的 inset 不视为 bug。Hook `block-css-position-cascade.mts` 与 CI `css-position-cascade-guard.test.ts` 共用扫描器；规则内 `allow-css-position: 具体理由` 才能豁免，动态 class/复杂选择器仍须浏览器复核。
- 吸顶表头走 `components/sticky-table.css`(`.sticky-scroll` + `.sticky-thead`),禁手写 sticky thead;契约见文件头注。
- 新可复用组件/hook 登记 `/dev` catalog(`_catalog.tsx`)。CI 守卫:`dev-catalog-sync` + `dev-tokens-drift`。
- 答题/训练的对错提示统一复用 `components/TrainingFeedbackOverlay` 的绿色 ✅ / 红色 ❌,禁页面自画。
- 浏览器基线跟随当前 Next 官方支持范围，禁为旧 WebView/开发者工具下调 `browserslist`；旧内核走全站启动失败提示，顶层 `ssr:false` 加载态用 `ClientLoadStatus`。CI:`browser-support-policy.test.ts` + `timer-bootstrap.test.ts`。
- 项目菜单统一用 `components/PuzzlePicker`;WCA 筛选用默认菜单式 `WcaEventSelector`/`WcaEventMultiSelector`，师生编辑和双人计时浮层显式 `presentation="inline"`；比赛列表保留项目表头；禁页面自写项目菜单。hook + CI 守卫:`component-reuse-guard`。
- `/alg` case 详情统一走 `AlgCaseView`:静态主图用 `CaseThumb`,动画用 `AlgPlayer`;多朝向不得省略主图或另造结构,桌面一行一朝向且动画左公式右。
- **魔方静态图的本地绘制（2026-10-16）**：`/alg`、`/recon`、`/timer` 的应用内状态图优先复用现有 `CaseThumb` / `VisualCube` / 计时器共享绘图器，不依赖 `/v1/visualcube.svg` 的网络往返。当前题、上一个、弹窗等少量图使用 `local`；长列表、选择网格和旧成绩必须使用 `local` + `loading="lazy"`，由 `VisualCube` 复用 `LazyVisible`，在接近视口后才生成 SVG，并预留准确宽高。禁止为了本地化一次同步生成全库，也禁止把旧记录悄悄切回网络图；新增同类页面沿用此契约。动画继续用既有播放器，视频封面、静态资源与对外可分享的 SVG URL 不属本地绘图替换范围。回归见 `tests/visualcube-lazy-local.test.ts`；相关技能见 `.agents/skills/visualcube/SKILL.md`。
- 全局固定按钮对齐内容右沿:`right: max(16px, calc((100vw - <content-max-width>) / 2))`。
- chip/tab/下拉项不显示数量计数。
- WCA 时间锚点:时间序列默认视图从 2003-08-22 起步(第 0 帧 = 1982 快照),统计聚合必含 1982 场。
- 可为任务边界读取 `git status`/diff，仅需历史证据时读 `git log`；文件和配置的增删改遵守部署章节的长期授权、当次任务范围及权限边界，保留他人未提交工作，执行仍遵循全局回收站规则。
- 报根因/"修好了"/done 前必须实证(日志/EXPLAIN/run 输出/playwright);未证实标「假设」;性能/502/OOM 先 profile 禁猜。
- UI 验证先搜并用 Playwright MCP(可能延迟加载);fixtures 全集别采样。
- 新路由先 grep 防撞名;路由改名/合并不为旧路径加 redirect。

## 主题/颜色

`/dev/expenses` 与 `/dev/infrastructure` 新增设备时，同次补齐对应型号、配色的产品图，不用通用图标、其他型号或空白占位；`infrastructure-costs.ts` 的 `imageSrc` 保持必填。设备名称按用户提供的完整型号保留，不能省略屏幕版本等型号区别；普通屏幕版不能替代 PROLED XDR 版。优先官方素材或用户提供的图片，复用现有 `.infra-equipment-art` / `.infra-equipment-image` 的尺寸、比例、留白和对齐。

设备图片必须是实际透明背景的产品抠图，不能把白底、棋盘格或其他底色烘焙进图片。仅检查 PNG/WebP 的 `hasAlpha` 不够：还要检查产品外空白区域的像素透明度，并在深色、浅色背景上预览。透明图片用 `next/image` 时保留 `unoptimized`，本地曾实测 Next 图片优化把它们转成白底 JPEG。替换已浏览过的同名图片时更换资源 URL，避免缓存继续显示旧图。设备图片来源见[素材记录](../equipment-images.md)。

写任何 CSS 色值前调 `theme-tokens` skill(token 表 + dark-locked 页清单 + color-mix 规则);禁 `#888 #aaa` 等硬码灰阶。

透明背景材质只在 `glass-material.css` 定义，旧样式由 `site-surfaces.css` 适配；新表面复用 `data-site-surface="panel|popover|heading"`，禁页面另造透明度/blur，保留状态色和无障碍回退，详 `theme-tokens` skill。

多余底框只约束已确认的位置，复用现有材质 Hook/CI；截图巡检按需运行，不作为日常开发或提交的额外门槛，不凭候选自动扩大禁用范围，详 `docs/glass-menu-regression.md`。

- 按钮/链接的短悬停提示统一使用 `components/Tooltip`（`<Tooltip content={tr({zh,en})}>{(tip) => <button {...tip}>…</button>}</Tooltip>`），禁止另写页面级提示气泡或用 native `title` 代替需要设计样式的提示。触发属性放在实际按钮上；已有同名事件须组合调用。写入 Hook 和 CI 共用材质扫描器拦截 `content: attr(data-tooltip/data-tip/title)` 伪元素气泡（不覆盖任意 JSX 或动态样式）；组件负责 hover/focus、Escape、可移入提示、Portal 和视口钳制，页面不再定义 blur/透明度。可交互内容不放 Tooltip，点击展开的说明继续用 InfoTooltip。Portal 继承全站主题；局部配色预览须单独核验。

## 项目菜单短名

### 项目图标先进入图标库（维护者要求，2026-10-20）

新增或修复具体拼图的图标时，先按 [wca-event skill](../../.agents/skills/wca-event/SKILL.md) 在 `core/packages/event-icon/svg/` 制作或复用真实 SVG，生成共享映射并确认 `/zh/icon`（英文 `/icon`）可查看、搜索和下载，再让模拟器、打乱器、计时器与 App 消费同一键。原创图放 `svg/puzzle/`，保留上游原稿；按实际外形、切割、阶数和联体重叠绘制，不借相似图冒充，不用文字缩写长期替代具体拼图的图标。训练阶段、自定义模式可保留语义文字徽标。同步中英文名称与事件别名，运行现有 `puzzle-icon-catalog.test.ts` 覆盖检查，并在图标库及实际菜单小尺寸、深浅主题下目检；新增模拟器必须同一任务交付图标，不留给下一轮 AI 补。

网站所有项目选择菜单（含分组、选中项、提示名称）不得出现「魔方」二字，例如「二重奏」「枫叶」「齿轮」。使用统一 PuzzlePicker 的展示规则，并在项目目录数据中直接写短名；不得改项目 ID、计算或保存值。此规则只约束项目菜单，不禁止文章正文等正常用词。写入守卫 `block-puzzle-menu-label.mts` 与 CI `puzzle-menu-label-guard.test.ts` 共同维护；新增菜单数据源时同步纳入检查。

项目菜单的三维尺寸省略乘号，写作 `233`、`334`、`335`，不写 `2×3×3`、`3x3x4`；中英文名称、左侧文字标签、选中提示保持一致。仅格式化展示，不改项目 ID。

## 圆角

统一复用 `@2017yanr02/continuous-corners`：全站入口 `core/packages/client/app/layout.tsx` 的 `SiteCorners`；自定义／反向圆角用包内 `continuousCornerRadii` 生成。禁止用渐变、手绘曲线或 CSS squircle 替代；真圆保持圆形。

## 导航

新增或修改导航相关 UI 前，先查 `@app-foundation/navigation-ui` 的 README 与导出，优先复用；通用能力补进共享包，避免本站重复实现。

内部工作台与联系页侧栏复用 `@app-foundation/navigation-ui`，接入见 `core/packages/client/app/[lang]/{workspace,contact}/page.tsx`；布局、动画和圆角在共享包修改，业务菜单与权限留在本站。
