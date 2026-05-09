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
- **裸 Flag 不带 className**：TW 走 SVG `<img>`,会撑爆布局。
- **标准 className**：`spanClassName="country-flag" imgClassName="country-flag-ct"`,尺寸规则在全局 `index.css`,**新 page 别重写**。
- **TW 还是大** → playwright 看 `<img>` computed width;90% 是 className 写反或加了页面前缀。

## popup CSS 作用域

MapLibre popup 挂在 map 容器外，**页面前缀 CSS（`.globe-page .flag-span`）不生效**。在 popup 里用国旗要单独写 `.maplibregl-popup .flag-span / .flag-img` 规则（尺寸、vertical-align 等）。

## 相关辅助（不重叠，不渲染）

- `recon_utils.flagClass(iso2)` → 拿 `fi fi-xx` 字符串（TW 不管）
- `country_flags.countryToIso2(wcaCountry)` / `personFlagIso2(wcaId)` / `compFlagIso2(compId)` → 从 WCA 文本或 id 反查 iso2

拿到 iso2 后仍然走 `<Flag>` / `flagHtml` 渲染（统一处理 TW）。

## 渲染选手 / 比赛名:必须带国旗

任何渲染 **WCA 比赛名** 的地方,前面必须有该比赛举办国国旗,走 `<CompCell compId compName isZh />`(`components/CompCell/`),内部 `compFlagIso2` + `localizeCompName`。页面挂载时必须 `loadFlagData()` 一次,否则旗 / 中文名都 miss。裸 `c.name` / `compId` 直显是 bug。

选手名同理:本页含 person 列必须 iso2 + `<Flag>`,见 `cuber-name-display`。
