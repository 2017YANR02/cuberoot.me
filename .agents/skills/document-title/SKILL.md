---
name: document-title
description: "Use when adding or changing a page's browser tab title. Use the canonical useDocumentTitle hook, keep subpage titles unbranded, and never assign document.title directly."
---

# 浏览器 tab 标题(document.title)

唯一入口:`core/packages/client/hooks/useDocumentTitle.ts`。**所有新页一律走这个 hook,严禁手写 `document.title = ...`**。

## 用法

```tsx
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function MyPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('页面中文名', 'Page English Name');
  // ...
}
```

输出 `页面中文名` / `Page English Name`。只有首页显示 `CubeRoot`;unmount 自动 reset 回 `CubeRoot`。

## 动态标题(数据驱动)

数据加载完用 data,没加载用 fallback。参考 `app/[lang]/wca/comp/[slug]/CompDetailPage.tsx`:

```tsx
const [data, setData] = useState<CompData | null>(null);
const title = data ? localizeCompName(slug, data.name, isZh) : slug;
useDocumentTitle(title, title);  // 已本地化字符串就两个参数传同一个
```

## 路径

统一走 `@/` 别名:`import { useDocumentTitle } from '@/hooks/useDocumentTitle';`(client 任意深度都一样,不用数 `../`)。

## 禁

- ❌ `document.title = '...'` — bypass hook,会忘 cleanup、忘双语。
- ❌ `react-helmet` / `react-helmet-async` — 纯 SPA 不需要,这个 hook 已够。
- ❌ 自己拼 `CubeRoot` 前后缀 — favicon 已承担品牌识别,窄 tab 只留页面名。
- ❌ 写带 emoji 的 title — tab 字体下错位,且 fatigue。
- ❌ 给 LandingPage(`/`)加 hook — 首页已有服务端 `<title>CubeRoot</title>`。

## 历史遗留(技术债,不主动碰)

`pages/code/*` 系列 ~17 个页 + ArchitecturePage / StackToolPage / AlgorithmsLandingPage / CompareScramblePage / CompareAo5Page / OpsPage / CodeIndexPage / StackLandingPage / Latex / Katex / Powershell / PersonDetailPage 等共 37 个文件仍用 ad-hoc `useEffect(() => { document.title = ...; })`。能跑,不动它们。下次顺手改到这些文件再迁。

## 已接 hook 的页(参考)

`GenPage` / `GenAboutPage` / `ScrambleHubPage` / `ReconListPage` / `CalendarPage` / `WcaStatsPage`(动态) / `CompDetailPage`(动态) / 加 LandingPage 上 16 张卡对应的页 + 后续 35 个二级页 — 总计 ~55 个。**新增页前先 grep `useDocumentTitle` 找最近一例抄结构**。
