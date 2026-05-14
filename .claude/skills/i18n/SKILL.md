---
name: i18n
description: "Use when adding/editing user-visible text in React client. zh/en 双语:两种 pattern (`t()` + JSON key vs inline `isZh ? 'X' : 'Y'`),en.json/zh.json 必须 parallel。Triggers: \"中英双语\", \"i18n\", \"translate\", \"add Chinese/English\", \"LangToggle\", \"en.json\", \"zh.json\", \"useTranslation\", new page, new user-facing string."
---

# i18n（core/packages/client）

## 两种合法模式

- **`t('ns.key')`** + `src/i18n/{en,zh}.json` — 跨页复用 / `{{var}}` 插值 / 长列表
- **内联三元** `isZh ? '中文' : 'English'` — 页面独占短文本
- **绝不** 写单语裸字（切语言会断）

## 模板

```tsx
const { t, i18n } = useTranslation();
const isZh = i18n.language === 'zh';
```

## 核心规则

- 新 `t()` 键 **必须同时** 加到 en.json 和 zh.json，占位符 `{{x}}` 两边都要有
- `<LangToggle variant="inline" />` 放 header 右端
- 全站 URL 永远带 `?lang=zh|en`：`App.tsx` 的 `<LangParamGuard>` 兜底（每次 location 变化 `replaceState` 补 lang），`<Link>` 推荐仍用 `getLangQuery()` 避免 URL bar 闪一帧无 lang
- store / utils 等非组件模块：**别用 `t`**，把 `isZh` 当参数传进
- `useEffect`/`useCallback` 里用 `t(...)` 要把 `t` 加进依赖

## 例外（不走 JSON）

- `wca_translations.ts`：WCA 领域数据表（event id → 名字），运行时查表
- `GlobePage` 的 `COUNTRY_ZH` / `COUNTRY_EN`：国家名表
- `calc/EventSelector` / `viz/LegendPanel` 等：随语言变化的常量数组用 `useMemo([isZh])`

## 命名空间

看 `src/i18n/en.json` 顶层。复用优先用 `common.*`（loading / back / loadFailed / unknownError / cases）。

## 排查单语裸字

```bash
rg -n '>[^<>{}]*[一-鿿][^<>{}]*<' src/pages --type tsx
rg -n '(title|placeholder|aria-label)="[^"]*[一-鿿A-Za-z]' src/pages --type tsx
```

命中看上下文 —— 已在三元分支里的不是 bug。
