---
name: cubing-anim-alg
description: "Use when building UI with cubing.js TwistyPlayer + alg input + caret-driven move sync (alg/recon/admin/training pages). Code uses `alg`, not `formula`. Triggers: \"cubing.js\", \"TwistyPlayer\", \"AlgPlayer\", \"TwistySection\", \"光标同步\", \"caret sync\", \"syncPlayerToMoveCount\", \"AlgInput\", \"alg input\", \"输入 alg\", \"虚拟键盘\", \"CubeKeyboardSection\", \"动画跟随\", \"alg player\"."
---

## 入口 — 选哪个

- 单卡片 / 弹层 / 列表项的 cube 动画 → `<AlgPlayer>` (`components/AlgPlayer`)
- 整页左栏式动画 (recon submit / detail) → `<TwistySection>` (`components/TwistySection`)
- alg 输入框 → `<AlgInput>` (`components/AlgInput`)
- **NEVER 直接 `new TwistyPlayer({...})`** — 包装组件已经处理了 lazy import / 重 mount / size sync,自己写一份就是造轮子。

## 命名:用 alg,不用 formula

英文代码 / 类型 / 文件名 / CSS class / data-attr / 字段名一律 `alg`,**不要再写 `formula` / `Formula`**(2026-05-08 已把历史 `FormulaInput` / `formula_autospace` / `tokenizeFormula` / `data-formula` 全部 rename)。中文 UI / 注释 / zh.json 里的"公式"是 cubing 圈通用词,保留;但变量 / 类型仍走英文 alg。

数学公式 (`frames = ⌈⌋ × ...`) / 数学注释里写 `formula` 是 OK 的(跟 cubing alg 无关)。

## fillPane vs 固定 size

- 固定方框(列表缩略 / 弹层小预览):传 `size={N}`,player 是 N×N。
- 撑满父容器(分栏布局):传 `fillPane`,内部用 `ResizeObserver` 把父容器像素尺寸写到 `player.style`。**不能只设 CSS 宽高百分比** — TwistyPlayer 内部 WebGL canvas 不会因为 CSS 百分比变化触发 repaint,会错位。
- player 的 control panel 渲染在 player 框 *内部*(占底部 ~40px),所以 `size=300` 时 cube 实际只剩 ~260px。要更宽就给 fillPane + 让父容器宽高足够。

## alg=空 → 控件全灰

`experimentalSetupAlg` 是 *起始状态*,不入播放序列。`alg=""` 时序列长 0,进度条停在末尾、播放/前进按钮全灰。要播必须给非空 `alg`。比如 admin editor 默认拿第一条 alg 做 preview,blur 后保留最后一次而不是清空。

## 光标 → 动画同步

复用 `utils/recon_alg_utils.ts` 里的:
- `extractAlgFromText(text)` — 从含注释 (`//`) 的文本里抠出可播放 alg
- `syncPlayerToMoveCount(player, n)` — 把 player.timestamp 设到第 n 步
- `countMovesExpanded(alg)` — 展开 `(...)N` 重复组的真实步数

读 caret offset:
- `<textarea>` → `el.selectionStart`
- AlgInput `markable=true` (contenteditable) → `getTextBeforeCaret(el).length` (`utils/alg_autospace`),或者直接用 AlgInput 的 `onCaretChange(text, caretIndex)` callback

prefix → moves:`text.slice(0, caret).trim().split(/\s+/).filter(Boolean).length`(简单文本) 或 `extractAlgFromText` + 同样拆分(含注释)。

## 重建后再 sync 一次(必做)

打字时 alg 在 debounce → player 重建 → 此时 player 还没 ready,sync 调用 silently no-op,光标停在 0。两种兜底:

1. `useEffect` 监听 `debouncedAlg`,变了就再 sync 一次(`ReconSubmitPage.tsx:784`)。
2. 50/200/500ms 三次重试(`AdminCaseEditor.tsx`)— player ready 时机不确定时用。

## 必须 debounce alg 输入

每次按键都换 player.alg → 销毁重建 TwistyPlayer (~150KB lazy bundle 已加载但 WebGL ctx 重建仍卡)。打字 → 400-500ms debounce → 再换 player 的 alg。recon / admin editor 都是 400-500ms。

## AlgInput 关键 props

- `markable=true` → contenteditable + 支持 finger-trick 标签 (`<u>` / `<s>` / `<em>`),`autoSpace` 默认开
- `markable=false` → 普通 textarea
- `onCaretChange(text, caretIndex)` → 已经存在,driver player sync 直接用,别自己监听 selectionchange
- `elementRef` → 暴露底层 DOM 给虚拟键盘 target
- handle.`getText()` / `getHtml()` / `getElement()` 通过 ref 取

## CubeKeyboardSection 用法

- 桌面默认收起、按钮展开;移动端强制开,无按钮。
- `target` 必须是 textarea/contenteditable 的 ref (从 AlgInput 的 `elementRef` 拿)
- **column-flex 容器陷阱**:`.vkb-toggle` 是 `inline-flex`,但 column-flex 父容器默认 `align-items: stretch` 会拉满宽度。给 `align-self: flex-start`(参考 `alg.css` `.alg-admin-modal-body .vkb-toggle`)。

## sq1 / 大魔方特殊

- sq1 alg `1,0/-1,0` parser 不认,必须 `normalizeAlgForTwisty(puzzle, alg)` 加括号 → `(1,0)/(-1,0)`。AlgPlayer 内部已经调过了。
- recon submit 看到 `event === 'sq1'` 直接不渲染 player(`ReconSubmitPage.tsx:853`)— sq1 解法太特殊,player 帮不上忙。

## stickering 映射

`pickStickering(puzzle, set)` 在 `AlgPlayer.tsx`,把我们的 set slug 映射到 cubing.js 的 `experimentalStickering`(F2L / OLL / PLL / COLL / ZBLS / WVLS …)。新 alg set 要在那加一行。返回 undefined 时 player 不传 `experimentalStickering`,所有贴纸正常显示。

## 暴露 player 实例(高级)

`<AlgPlayer ref>` 拿 `AlgPlayerHandle`,`getPlayer()` 返回内部 TwistyPlayer。给 `syncPlayerToMoveCount` 用。`<TwistySection playerRef={ref}>` 直接走 ref.current = player,二者风格不同,选 component 时注意。

## 禁忌

- 直接 new TwistyPlayer
- alg 不 debounce 直接喂 player
- size 模式硬塞大尺寸期望填充父容器(改 fillPane)
- 自己写 selectionchange 监听代替 onCaretChange
- alg=空 还期望 player 能播
- column-flex 容器里放 vkb-toggle 不加 `align-self`
- 在 cubing 上下文里写 `formula` / `Formula`(用 `alg`)
