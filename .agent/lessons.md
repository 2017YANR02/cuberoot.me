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

Pointer Events 状态机的两个杀手级陷阱：① `pointercancel` 触发后**不会再有 `pointerup`**（W3C spec），所以 cancel 处理函数必须也执行状态转换逻辑（如 `playerUp()`），否则状态机会卡死在中间态（如绿灯/canStart）。② 状态重置函数（如 `resetForNextRound`）**绝不能清除 `pointerId`**——此时用户手指可能还在屏幕上，清除后 `pointerup` 的 ID 检查会失败，`playerUp` 永远不被调用。`pointerId` 的生命周期只应由 pointer 事件处理函数本身管理。

移动端 Flex 布局中，若父级 `display: flex`，直接子元素如果是 `inline-block` 则不参与弹性分配，极易撑破屏幕。必须让直接包裹层（如 wrapper）本身设置 `flex: 1; min-width: 0` 才能受到弹性压缩约束。全局修改要小心是否会破坏桌面端的原本布局，通常放在手机端媒体查询里覆盖。

长文本 Tooltip 移动端溢出陷阱：如果是 `absolute` + `right: 0`，由于文字太长会导致气泡向屏幕左侧疯长并在视区外被截断。移动端最稳健的方案是 `position: fixed` 脱离文档流束缚，然后借助 JS 点击时动态测量触发器的坐标并注入类似 `--tip-top` CSS 自定义变量，限制在视口内全宽排布。

异步 DOM/状态更新的虚假更新（死灰复燃）竞态：输入框的 `blur` 如果加了 setTimeout（预防焦点冲撞），而同时其他元素的 `focus` 事件又立刻覆盖了 `activeCell` 指针，会导致逻辑漏网。比如：用户逐字符删空旧格（仅 UI 变化），立刻点击新格，新格 `focus` 拿走指针，旧格延迟的 `blur` 发现指针不对就跳过保存 state。随后 `refresh()` 时 state 的旧值又被重绘到 DOM 上。解法：任何全局 `focus` / 导航入口，第一行代码必须是**同步检测并强行 save 遗留的旧指针状态**再转移焦点。

移动端触摸非 input 元素后调用 `el.focus()+el.select()` 会一闪而过：浏览器在 `touchend` 阶段会自动"纠正"焦点到用户手指实际触摸的元素，重置其余元素的选区。所有延迟方案（`setTimeout(0)`、`rAF`、`setSelectionRange`）均无效。行业惯例：放弃强制 focus，改用 CSS 视觉高亮（如 outline）标记目标格子，让用户二次点击获得真正 focus。

绕过 `focus()` 后必须**手动同步所有依赖 focus 事件的副作用**：`activeCell` 指针、`barSelectPending` 替换标志、numpad display 同步——缺任何一个都会产生新 bug（如 numpad 路由到错误格子、首次按键追加而非替换旧值、按键后全选当前字符）。

Web Audio API autoplay 限制：`AudioContext` 创建后默认 `suspended`，必须在用户手势中调 `resume()` 才能发声，在 iOS Safari 和桌面 Chrome 均有效。最简单的修法：在每次播放前检查 `ctx.state === 'suspended'` 就 `resume()`，已 `running` 时 `resume()` 是 no-op 无开销。不要只在 `AudioContext` 创建时调一次——创建时机未必在用户手势内。

"数据对了但显示不对"时，问题在**渲染层**；要先用 DevTools / JS 注入确认 state 是否真的正确，再决定去哪层找 bug。**不要想当然假设 state 残留**，盲目在数据写入路径上找遗漏。典型案例：backspace 清空后图表仍显示幽灵柱，花了很长时间找 state 漏洞，最终发现 state.times 全部是 0，是 SVG DOM 元素泄漏。

SVG `<g>` 复用组（如 `barGroup`）不做 `clearGroup` 时，往里 append 的临时元素必须**打 class 标签**，并在每次重绘前按 class 选择性清除。否则旧元素无限累积，即使对应数据已归零也不消失。通用策略：只要某类 SVG 元素的生命周期不与父 `<g>` 绑定（父 `<g>` 不做整体清空），就必须给该类元素加 class，并在绘制入口处先 `querySelectorAll('.cls')` + `remove()` 再重画。

Ruby 3.4 的 `sort_by` 在混合 key 时对同 key 子组**不稳定**（实测确定性反转）：即使 Ruby 宣称 `sort_by` 是稳定的，当数组中存在多种不同 key 值时，同 key 子组的内部顺序会被反转（如 `[1,2,3]` 变成 `[3,2,1]`）。凡是用日期(或字符串)作为单一排序键，且同日期可能出现多条记录时，**必须加第二排序键**消除歧义，否则依赖顺序的扫描逻辑（如"扫描全局最小值"）会遗漏中间值。

一键清空（Clear All）等重置型操作极易触发**焦点/失焦回写竞争**：当重置逻辑清空全局 state（并跳过当前 activeCell 的 DOM 刷新以保护输入）后，若紧接着动用 `focus()` 或 `navigateTo` 转移焦点，会立刻触发旧 activeCell 的 `blur/save` 逻辑。此时旧 DOM 中未清空的值会被当做“新值”重写入刚清空的 state，造成“死灰复燃”。**解法：在执行任何破坏性重置前，必须先调用 `deactivate()` 主动断开当前活跃元素的追踪，切断回写链条。**

图表或列表在**复用已有的 SVG/DOM 节点**时，最容易忘记处理“数据突然清空（返回 null 或 length=0）”的边界。当查询方法返回 `null`，原本的渲染逻辑如果只是简单地 `continue` 跑到下一个元素，就会**漏掉清理已经存在的该类 DOM 节点**，导致视觉上的“幽灵残留”。**解法：在复用渲染循环中，如果数据变为不存在/null，`continue` 之前必须先 `querySelector` 找到对应的旧元素并 `remove()`，绝不能直接跳过。**

React StrictMode 下，`useEffect` 会执行 mount → cleanup → mount 的双调用。若用 `ref.current = true` 守卫防止重复执行，cleanup 移除的副作用（如动态注入的 `<link>`）在第二次 mount 时会因守卫拦截而**永久消失**。解法：凡是 cleanup 会撤销的副作用，不能放在 `initDone` 守卫内；全局性资源（CDN CSS 等）优先静态写入 HTML。

Nginx alias + try_files 路径拼接 bug：try_files 用 server root（cuberoot-spa）而非 alias 路径解析文件，加上 regex location ~* \.(js|css|png|...)$ 优先拦截静态资源请求。修复：alias → root + ^~ 修饰符。