---
name: country-flag
description: "Use when rendering country flags anywhere in Web or Mobile UI (JSX or popup innerHTML). Canonical entry: @cuberoot/timer-ui/country-flag; the Web Flag file is only a compatibility re-export. The offline WCA Chinese Taipei special case is handled there—never hand-write or direct-link it. Triggers: \"国旗\", \"flag\", \"flag-icons\", \"ChineseTaipei\", \"台湾国旗\"."
---

# 国旗渲染

canonical 实现：`@cuberoot/timer-ui/country-flag`（源码
`core/packages/timer-ui/src/CountryFlag.tsx`）。Web 既有调用继续从
`core/packages/client/components/Flag.tsx` 导入；该文件只能是薄 re-export，不能再放实现。
Mobile 直接从 `@cuberoot/timer-ui` 或其 `country-flag` 子路径导入。

```tsx
<Flag iso2="us" className="cuber-flag" />                              // JSX
flagHtml(iso2, { spanClassName: 'flag-span', imgClassName: 'flag-img' }) // innerHTML / MapLibre popup
```

- 入参接受 **iso2**（"US" / "tw"，2 字母）**或 WCA 全名**（"China" / "Korea"）—— 内部归一化。past JSON 的 `country` 字段是全名（"China"），upcoming JSON 是 iso2（"CN"），直接传进来都行。
- `className` 同时给 img 和 span；span/img 需要不同类（历史原因）时用 `spanClassName` / `imgClassName` 覆盖。
- 底层 `flagInfo(iso2OrCountry)` 返回 `{kind:'img',...}` 或 `{kind:'span',...}`，想完全自定义渲染时再直接用。

## 禁止

- 手写 `iso2 === 'tw' ? <img .../> : <span .../>` —— 就是要消灭这个
- 直接写 `/tools/assets/images/ChineseTaipei.svg`、外网旗帜 URL 或调用系统 emoji。TW
  渲染资产属于 `timer-ui` package，必须由 Next/Vite 打包，确保 Capacitor 离线可用；旧
  `tools` 文件只留给非 React 历史消费者。
- **TW SVG 撑爆兜底**：`CountryFlag.tsx` 给 TW `<img>` 恒定挂低特异度
  `.cr-flag-img`（`country-flag.css`，1.33em 宽 / height:auto），裸 Flag 或传错类名都
  不会撑成 640×480；调用方显式设宽的类按源序覆盖。别删这个兜底，也别在 per-page
  CSS 重定义 `.cr-flag-img`。
- **标准 className**：`spanClassName="country-flag" imgClassName="country-flag-ct"`。
  flag-icons、TW 兜底和多地区样式唯一来源是
  `@cuberoot/timer-ui/country-flag.css`；Web 的 `app/globals.css` 只保留站点尺寸类。
  **禁止任何 per-page CSS 重新定义 `.country-flag` / `.country-flag-ct`**。
- **国旗无圆角**：统一直角矩形(flag-icons 标准),禁给 `.country-flag` 加 `border-radius`。
- **TW 还是大** → playwright 看 `<img>` computed width;先确认 `.cr-flag-img` 兜底已在 stylesheet(改 globals.css 后 dev 不重编需重启/build),再查 className 是否写反或加了页面前缀盖掉了尺寸。

## popup CSS 作用域

MapLibre popup 挂在 map 容器外，**页面前缀 CSS（`.globe-page .flag-span`）不生效**。在 popup 里用国旗要单独写 `.maplibregl-popup .flag-span / .flag-img` 规则（尺寸、vertical-align 等）。

## 相关辅助（不重叠，不渲染）

- `recon_utils.flagClass(iso2)` → 拿 `fi fi-xx` 字符串（TW 不管）
- `country_flags.countryToIso2(wcaCountry)` / `personFlagIso2(wcaId)` / `compFlagIso2(compId)` → 从 WCA 文本或 id 反查 iso2

拿到 iso2 后仍然走 `<Flag>` / `flagHtml` 渲染（统一处理 TW）。

## 渲染选手 / 比赛名:必须带国旗

任何渲染 **WCA 比赛名** 的地方,前面必须有该比赛举办国国旗,走 `<CompCell compId compName isZh />`(`components/CompCell/`),内部 `compFlagIso2` + `localizeCompName`。页面挂载时必须 `loadFlagData()` 一次,否则旗 / 中文名都 miss。裸 `c.name` / `compId` 直显是 bug。

选手名同理:本页含 person 列必须 iso2 + `<Flag>`,见 `cuber-name-display`。
