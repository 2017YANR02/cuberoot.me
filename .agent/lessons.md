# 教训 (简介明了,具有通用性)

多个 JS 模块同时操控 URL query string 时，修了一处仍可能被另一处覆盖。排查必须 grep 所有 `searchParams`/`replaceState`/`pushState` 调用点。（Alg-Trainers: `i18n.js` 的 `init()` 在 `main.js` 读 URL 前偷偷追加了 `&lang=`）

`body.outerHTML = ...` 替换的是元素节点本身，旧节点上的 MutationObserver、事件监听、注入的 DOM 全部失效。用 `setInterval` 轮询新节点出现后再操作。

PowerShell `@"..."@` here-string 中 `""` 输出双引号，生成 HTML 属性时会破坏标签。用单引号包裹 HTML 属性值规避。

翻译含子元素的 `<span>Text <span>child</span></span>` 时，`textContent =` 会覆盖子节点。必须遍历 `childNodes` 只改第一个 `TEXT_NODE`。

对同一个 DOM 容器多次调用 `addEventListener` 会**累积** handler（不会覆盖）。异步渲染函数（如 `renderComments`）可能被调用多次（首次 catch + 成功后重渲染），导致同一个 click handler 触发两次。第二次 `showEditCommentEditor` 保存的 `originalHtml` 已经是编辑器 HTML，取消时恢复的还是编辑器——看起来"没反应"。修复：渲染前用 `cloneNode(false)` + `replaceChild` 替换容器，清除旧监听器。

i18n 动态文本必须用 data-i18n-en/zh 属性：凡是 JS 动态渲染的双语文本（如比赛名、选手名），必须返回 <span data-i18n-en="..." data-i18n-zh="..."> 而非纯文本。否则 i18n 

setLocale()
 切换时无法自动更新，需要刷新页面才能生效。同理，Recon 页面自己渲染的国旗元素必须加 data-person-flag / data-comp-flag 标记，防止 i18n 的 

_applyPersonFlags()
 / 

_applyCompetitionFlags()
 重复插入国旗。

 在多层嵌套的文件中添加变量时，必须先确认使用该变量的所有函数所在的作用域。
 应该先确认调用方所在的作用域层，再决定定义位置

i18n 翻译单元的粒度：中英文语序不同时（如英 `Grp B` vs 中 `B组`），不能只翻译单个词（`组→Group` 会产生 `BGroup`），必须把完整短语作为一个 `data-i18n-en/zh` 单元。

观察者模式（`notify` → `refresh`）下，**所有对 DOM 值的修改必须同步写入 state**。`refresh()` 会从 state 全量覆盖 DOM，任何"只改 DOM 不改 state"的代码都会被后续 `refresh` 静默还原，看似"没效果"。典型场景：backspace 删字符、全选清空。

移动端触摸事件的 `touchend` 和 `click` 可能**双触发**（即使 `touchstart` 已 `preventDefault`）。两次执行会互相抵消（第一次改对了，第二次因状态已变而走了另一条错误分支）。解决：用 100ms 防抖标记（`numpadBusy` flag）确保同一次物理触摸只执行一次回调。

重构时必须**逐项对照原代码的每个用户交互行为**（点击全选、跨格删除、焦点保持、选中状态替换输入等），而非只迁移核心逻辑。行为回归 bug 比功能 bug 更难发现——"代码在但交互细节丢了"。

修改函数内某个 if/else 分支时，必须**向下检查分支结束后、函数末尾是否有无条件执行的代码**会干扰分支的效果。典型案例：`numpadPress` 的 backspace 分支用 `navigateTo` 跳转了焦点，但函数最后一行 `v.focus()` 无条件把焦点拉回原格，导致跳转失效。越是 `focus()`、`blur()`、`scrollTo()` 这类全局副作用，越容易被末尾的无条件代码覆盖。

同页面多个 SVG 使用相同 gradient `id`（如 `grad0`）会导致 `url(#grad0)` 引用混乱——浏览器在**整个文档**作用域解析 `id`，而非限定在单个 SVG 内。解法：用唯一 ID 或直接用半透明纯色 `fill` + `fill-opacity` 替代渐变。

检测 i18n 当前语言时，**不要假设 `data-lang` 属性存在**——i18n.js 从不设置它。可靠数据源是 URL `?lang=` 参数（i18n.js 的 `init()` 和 `setLocale()` 始终同步该参数）。动态组件切语言后不更新，优先检查数据源是否真的在变。

iOS 移动端禁用页面缩放需要**三层防御**，因为双击（double-tap）和双指（pinch）是完全独立的机制：① CSS `* { touch-action: pan-y; }` 是**最关键的一行**，同时禁用双击和双指缩放，只保留纵向滚动（W3C 标准，iOS Safari/Chrome 均支持）；② viewport meta `user-scalable=no, maximum-scale=1` 在 Android 有效，但 iOS 10+ 被苹果以无障碍为由故意忽略；③ JS 拦截 Safari 专有的 `gesturestart`/`gesturechange` 事件 + 多指 `touchmove` 的 `preventDefault`（兜底）。踩坑顺序：先加 `user-scalable=no`（iOS 无效）→ 加 `touchmove` 拦截（双指有效但双击仍缩放）→ 加 `gesturestart`（pinch 更稳但双击仍在）→ 最终发现双击缩放是独立机制，`touch-action: pan-y` 一步到位。

隐藏全局注入的 UI 组件（如 i18n 的 `.lang-toggle-fixed`）时，**先 DevTools inspect 拿 class 名，然后在页面级 CSS 里一行 `display: none !important` 覆盖**。不需要读源码理解组件实现——你只是要隐藏它，不是要改它。花时间 grep + 读 1345 行 i18n.js 全文是严重浪费。

对于简单的单点修改（如替换首页卡片图标），**先用 DevTools Inspect 锁定目标 DOM 的特征（如特有的 class、id 或 data 属性），然后直接全局搜索这些特征去修改源码**。这比猜测组件的渲染逻辑或逐层阅读代码要快几十倍。DevTools 是人类开发者最高效的“透视眼”。

i18n 的 `_applySolverLabels()` 用 `el.textContent = map[text]` 做全局文本替换，会**销毁目标元素内所有子节点**（`<img>`、`<svg>` 等）。凡是含子元素的 `<button>`/`<label>`/`<span>`，如果其 `textContent` 恰好命中翻译映射表中的某个 key，子元素就会被静默删除。防御：对含子元素的交互元素加 `translate="no"` 或 `data-i18n`，让它豁免于全局扫描；翻译由内部的 `<span data-i18n="...">` 专门负责。