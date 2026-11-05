# 网址、渲染与 URL 状态

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

## 路由与交付约束

- **网址迁移（维护者要求，2026-11-04；2026-11-05 更新）**：页面移动或网址改名后，旧网址默认直接返回 HTTP 404，不自动添加重定向、兼容页面或别名；只有用户明确要求保留跳转时才例外。同步更新站内入口、元数据、站点地图及文档中的有效网址。技术决策已嵌入 `/dev/architecture#decisions`，旧 `/dev/architecture/decisions` 直接 404。代码语言历史已嵌入 `/dev/architecture#code-history` 概览，日志位于 `/dev/architecture/log`；旧 `/dev/code-history`、`/dev/architecture/code-history`、`/dev/architecture/history`（包括语言前缀形式）直接 404。
- 前端调 API 必用 `apiUrl()`(client `lib/api-base.ts`),禁硬编码 origin;`/stats/*.json` 走 `statsUrl()`,禁相对路径。
- API 缓存头:可变数据浏览器 `max-age≤3600`,长缓存只给 nginx `s-maxage`;空/暂态 `no-store`;改响应 shape 必 bump `v=`。CI `tests/server-cache-headers.test.ts`。
- Pattern B:英文裸 URL,中文 `/zh`;内部链接用 `components/AppLink`;非 Link 导航手动 `${lang==='zh'?'/zh':''}`,禁硬编码 `/${lang}`;新路由免登记。
- dev/prod API base 用 `import.meta.env.DEV`,禁 `hostname==='localhost'` 判断(LAN/隧道域名会错走 prod 被 CORS 拦)。
- COOP/COEP 仅 `/scramble/solver` 发;Next `headers()` 与 nginx map 两处同步改。
- client 页面默认 SSG:根 layout 禁动态 API(cookies/headers),全局组件禁 render 调 `useSearchParams`;语言归属在 `[lang]/layout`。
- 省 Vercel 配额:①高基数/响应式 href/离开本页的 `<Link>` 必 `prefetch={false}`;②无 SEO 的动态 `[param]` 页走静态哨兵壳(`dynamicParams=false` + `generateStaticParams` 返 `['_']` + beforeFiles rewrite + client 读 `window.location`);③`public/` 大资产必设 `Cache-Control`;④取证看 `/www/wwwlogs/www.cuberoot.me.log`(全 IP+UA)。

## 页面标题 / SEO metadata

新增路由或修改标题、SEO metadata、sitemap、hreflang、索引策略或长文结构化数据时使用 `document-title` skill，并必须读取其 [SEO 契约](../../.agents/skills/document-title/references/seo-metadata.md)；保留静态 metadata 单一来源与 SSG 边界。

## URL 状态(全站统一 nuqs)

- 页内状态进 URL 一律 `useQueryState`,禁裸 `history.pushState/replaceState` + 手写 `popstate`(maplibre/canvas/video 重组件例外加注释豁免)。CI `tests/url-state-no-raw-history.test.ts`(豁免加 ALLOWLIST + eslint-disable + 理由)。
- 大视图/大 tab/全屏浮层 → `.withOptions({ history: 'push' })`;筛选/排序/搜索 → 默认 replace;默认值 `.withDefault(x)`;枚举 `parseAsStringEnum`。
- 分页、列表/卡片布局、日历日周月显示、项目/轮次筛选、训练范围与练习内换题同样用 replace；URL 仍保留可分享状态，返回不应逐次撤销这些操作。真实内容导航（详情、课程章节、聊天会话、全屏浮层）才用 push。CI `tests/url-state-no-raw-history.test.ts` 用 AST 核对显式 `history: 'push'`（含条件分支及 setter 覆盖）；新增导航须在 `core/packages/client/scripts/navigation-history-allowlist.json` 按具体文件、调用和理由登记，禁止整页放行或为通过检查把筛选冒充导航。此守卫不替代对 router/AppLink 和间接动态配置的审阅。
- 沉浸浮层返回用 `history.back()`,`history.length<=1` fallback 硬导航父路由。
- `useQueryState` 只在页级 client 组件用,禁进全局 chrome;重排 query key 顺序走 `AppNuqsAdapter` 的 `processUrlSearchParams`。
- 范本:`app/[lang]/wca/comp/page.tsx` 的 `viewMode`。
