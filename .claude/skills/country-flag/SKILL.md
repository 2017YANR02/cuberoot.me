---
name: country-flag
description: "Use when rendering country flags anywhere in UI (JSX or popup innerHTML). Single entry point: utils/flag.tsx. TW special case (WCA uses Chinese Taipei SVG not flag-icons default) is handled there — do not hand-write. Triggers: \"国旗\", \"flag\", \"flag-icons\", \"ChineseTaipei\", \"台湾国旗\"."
---

# 国旗渲染

唯一入口：`core/packages/client/src/utils/flag.tsx`。TW 特判只在这里。

```tsx
<Flag iso2="us" className="cuber-flag" />                              // JSX
flagHtml(iso2, { spanClassName: 'flag-span', imgClassName: 'flag-img' }) // innerHTML / MapLibre popup
```

- 入参接受 **iso2**（"US" / "tw"，2 字母）**或 WCA 全名**（"China" / "Korea"）—— 内部归一化。past JSON 的 `country` 字段是全名（"China"），upcoming JSON 是 iso2（"CN"），直接传进来都行。
- `className` 同时给 img 和 span；span/img 需要不同类（历史原因）时用 `spanClassName` / `imgClassName` 覆盖。
- 底层 `flagInfo(iso2OrCountry)` 返回 `{kind:'img',...}` 或 `{kind:'span',...}`，想完全自定义渲染时再直接用。

## 禁止

- 手写 `iso2 === 'tw' ? <img .../> : <span .../>` —— 就是要消灭这个
- 直接写 `/tools/assets/images/ChineseTaipei.svg` —— 路径只应出现在 `flag.tsx`
- **裸 `<SharedFlag iso2={...} />` 不带 className**：TW 走 SVG `<img>`，没尺寸约束会撑爆布局。加旗前 grep 同文件本地 `Flag` wrapper（多数页面自带，已绑 `flag-span/flag-img`），没 wrapper 必须自带 `className` 或 `spanClassName`+`imgClassName`。
- **新建 page CSS 但 className 没生效**：仅传 className 不够,对应 `.country-flag-ct { width:..; height:.. }` 必须在该页 import 的 CSS 里。**直接照抄 `wca_stats.css` 的两条规则**(`.country-flag` 和 `.country-flag-ct`),**别加页面前缀**(`.my-page .country-flag-ct` 在某些情况下莫名失效),保留全局选择器 + width/height `!important`。

## popup CSS 作用域

MapLibre popup 挂在 map 容器外，**页面前缀 CSS（`.globe-page .flag-span`）不生效**。在 popup 里用国旗要单独写 `.maplibregl-popup .flag-span / .flag-img` 规则（尺寸、vertical-align 等）。

## 相关辅助（不重叠，不渲染）

- `recon_utils.flagClass(iso2)` → 拿 `fi fi-xx` 字符串（TW 不管）
- `country_flags.countryToIso2(wcaCountry)` / `personFlagIso2(wcaId)` / `compFlagIso2(compId)` → 从 WCA 文本或 id 反查 iso2

拿到 iso2 后仍然走 `<Flag>` / `flagHtml` 渲染（统一处理 TW）。
