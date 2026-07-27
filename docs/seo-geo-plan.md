# SEO / GEO 现状与改造方案

调查日期 2026-07-27。全部结论基于线上实测（curl 抓 server HTML、nginx 访问日志、源码核对），
标注「推断」的地方是没能实证的部分。

> **执行状态**：§4 的第一至第四批已于同日全部落地，见 §6「已执行」。
> §1–§3 保留调查当时的原始现状，作为改动前的基线 —— 不要当成当前状态回读。

---

## 0. 一句话结论

基建层（canonical / hreflang / sitemap / OG）已经在及格线以上，**瓶颈 100% 在「爬虫看不到内容」**：
全站 server HTML 没有 `<title>`，多数页面正文 0 字符。这一层同时是 SEO 和 GEO 的共同前置。

GEO 不是「还没做」，是 `robots.txt` 把引用型 AI 爬虫一起关掉了——而实测数据显示，
**当初关它们所依据的流量担忧不成立**。

---

## 1. 代价分析（先回答「会不会很贵」）

### 1.1 钱：零

- Vercel 是 Hobby、未绑卡。Vercel 官方原文：free tier "there are no billing cycles"；
  超额的后果不是扣费，而是**该功能暂停，直到 30 天滚动窗口过去**。
- 花钱的唯一路径是手动点 Upgrade 填卡。**不存在被动扣费的可能。**
- 真正的风险不是钱，是「海外 Vercel 线被暂停 → 国外访客打不开」。
  DNS 是分线路的，国内走自有服务器 nginx，那条线不受 Vercel 配额影响。

所以「高昂代价」这个担忧，在金钱维度上是空的。需要防的是**配额暂停**，而不是账单。

### 1.2 放开 AI 爬虫会增加多少负载？——实测

源站 nginx 日志，窗口 `2026-07-26 03:14` → `2026-07-27 07:59`（约 29 小时），
共 **198,709** 条请求。（已剔除本次调查我自己用 Googlebot UA 发的探测请求——
第一版统计被我自己污染了，这里是修正后的数字。）

| UA | 请求数 | 占比 |
|---|---:|---:|
| **Sogou web spider** | **38,524** | **19.4 %** |
| 360Spider / YisouSpider | ~370 | 0.19 % |
| Baiduspider（含 -render） | ~100 | 0.05 % |
| Applebot | 17 | 0.009 % |
| Googlebot | 12 | 0.006 % |
| bingbot / YandexBot / DuckDuckBot | 0 | 0 |
| AhrefsBot / SemrushBot / DataForSeoBot | 0 | 0（robots 拦住了，有效） |
| **全部 AI 爬虫合计** ¹ | **77** | **0.04 %** |

¹ GPTBot 7 + OAI-SearchBot 9 + ChatGPT-User 9 + PerplexityBot 8 + ClaudeBot 6 +
CCBot 7 + Bytespider 15 + Amazonbot 16。

**而且这 77 条里大部分不是真 AI 爬虫。** 抽查它们请求的路径：

```
/.env, /id_rsa, /id_ed25519, /serviceAccountKey.json, /.ssh/known_hosts,
/private-key, /staging/.env, /production/.env, /ssl/localhost.key ...
```

这是**伪装成 AI 爬虫 UA 的漏洞扫描器**。真 AI 爬虫的实际访问量接近 0。

### 1.3 复盘：当初封 AI 爬虫的依据站不住

`app/robots.ts` 的注释写的理由是「AI 爬虫刷 20 万选手页 + 1.7 万比赛页，零 SEO 收益」。
但项目记录（2026-06-09）的原话是 **"Vercel 的西方/AI bot 占比测不到"** ——
封禁是基于推断，从来没有数据支撑。

同一次事故的 **#1 真凶已经查明并修好了**：`public/` 静态资源没有缓存头，
每次翻页都回源 304 校验，占 22.5% 的请求。封 AI 爬虫是顺手加的，不是主因。

**对照组更说明问题**：真正在吃流量的是 Sogou，19.4%，是所有 AI 爬虫总和的 **500 倍**，
而它根本不在黑名单里。

### 1.4 放开的代价上界

- 增量请求：按当前观测量级，**即使放开后涨 10 倍也 <0.5% 流量**。
- 阀门仍在手里：可以只 `Disallow` `/wca/persons/` 和 `/wca/comp/` 两棵高基数树
  （20 万 + 1.7 万 URL），把爬虫挡在真正贵的地方，其余全放。
- 这两棵树已经是**静态哨兵壳**（`dynamicParams=false` + build 时预渲染），
  被爬只算 Edge Request，**不烧 Fluid CPU**。抗部署，不会重演 2026-06-06 那次事故。

### 1.5 训练型 vs 引用型：这是两个决定

| 类别 | UA | 拦了会怎样 |
|---|---|---|
| **引用型 / 搜索型** | `OAI-SearchBot`(ChatGPT 搜索)、`ChatGPT-User`(用户点链接时实时抓)、`PerplexityBot`、`Amazonbot`、`YouBot`、`FacebookBot` | **直接从 AI 答案的引用里消失** |
| **训练型** | `GPTBot`、`ClaudeBot`、`Claude-Web`、`anthropic-ai`、`CCBot`、`Google-Extended`、`Applebot-Extended`、`Bytespider`、`meta-externalagent`、`cohere-ai` | 不影响可见性，纯版权/立场问题 |

目前两类一起拦了。**引用型该放（这就是 GEO 本身），训练型放不放是你的立场，与流量无关。**

补充：robots.txt 只是君子协定。实测这些 UA 打 `/` 仍返回 200，服务端没有 UA 硬拦。
所以现状是「**拦住了守规矩的引用源，没拦住不守规矩的抓取**」——拿到了代价，没拿到收益。

---

## 2. 改造代价（工作量与风险）

### 2.1 便宜 + 低风险

| 项 | 改动 | 风险 |
|---|---|---|
| **A. robots 拆分** | `app/robots.ts` 约 10 行 | 零，随时回滚 |
| **B. 修 recon 双 canonical** | `proxy.ts` 加一个路径判断，约 3 行 | 零 |
| **C. llms.txt** | 新增 1 个 route handler | 零 |

### 2.2 D. 全站 title / description 服务端化 —— 比看起来便宜得多

**问题**：228 个页面里 180 个是 `'use client'`，client 组件不能 export `metadata`，
所以现在全靠 `useDocumentTitle` 在客户端设标题 → server HTML 里 `<title>` 标签数 = **0**。

**贵的做法**（我一开始以为只能这样）：把 180 个页面拆成 server `page.tsx` + client `*Client.tsx`。
这是 `project_vercel_fluid_cpu_static_routes` 里踩过一遍的活，坑很多（shared barrel 不能进
server 组件、CSS import 路径、hydration mismatch），180 个页面做完是周级工作量。

**便宜的做法**：`page.tsx` **完全不动**，在同目录加一个 server `layout.tsx`：

```tsx
// app/[lang]/calc/layout.tsx  —— 3 行，不碰任何业务代码
import { pageMeta } from '@/lib/page-meta';
export const generateMetadata = pageMeta('calc');
export default function L({ children }: { children: React.ReactNode }) { return children; }
```

Next 的 metadata 从 layout 向下合并到 page。180 个 3 行文件，全部从一张中央双语标题表
（`lib/page-meta.ts`）生成，**零业务代码改动**。

`generateMetadata({ params })` 能拿到 `lang`，中英标题各出各的。

> ⚠️ **这一步我没能实证。** 我正准备在本地 dev 上建一个 throwaway 路由验证时被叫停了。
> 这是 Next 官方文档记载的标准做法（client page 不能 export metadata，parent layout 可以），
> 我把握很高，但**动手前应该先花 5 分钟在 dev 上验一次，别直接铺 180 个文件**。

两个已知的配套问题：

1. 根 `layout.tsx:15-18` 现在故意不设 title，注释说怕被 `useDocumentTitle` 客户端 clobber。
   加了 per-route metadata 后这个冲突还在——但两边值一致，clobber 无害。
   长期可以让 `useDocumentTitle`（197 个文件在用）退役，短期两者并存即可。
2. **禁止用 `headers()` 在 `[lang]/layout` 里读路径来做动态 metadata。** 那会把全站打成
   dynamic rendering，直接撞 Vercel Fluid CPU 上限，重演 2026-06-06 事故。这是硬红线。

### 2.3 E. `/math/group` 63 节去掉 `ssr: false` —— 实测风险比预想低

现状：`math/group/page.tsx:27+` 把 §33–§62 全部 `dynamic(..., { ssr: false })`，
62 节群论长文一个字都不进 HTML。`/math/group/lagrange` 的 server HTML 只有 155 字符
（仅上下节导航条）。

实测这 63 个 section 文件（共 2.9 MB 源码）：

- 只有 **1 个**直接碰浏览器 API
- **8 个**用 `TwistyMini`（cubing.js），而 `TwistyMini.tsx` 已经把 `import('cubing/twisty')`
  放在 `useEffect` 里 → **本身就是 SSR 安全的**

结论：`ssr: false` 是当初为了懒加载**顺手加的**，不是因为真需要浏览器环境。去掉是安全的。

代价：
- build 时间小幅上升（section 代码进服务端 bundle）
- 每个 URL 只渲染一节，不是 63 节全渲 → HTML 从 155 字符涨到几 KB，**不是 2.9 MB**

### 2.4 F. sitemap 收录 `[slug]` 长尾

`sitemap.ts` 的 `scanRoutes()` 跳过所有 `[param]` 目录。该补的：

- `math/group/[slug]` — 63 节，站里密度最高的原创内容
- `tutorial/[slug]` + `tutorial/c/[cat]`
- `alg/[puzzle]/[set]/[subgroup]`

**不要补** `wca/persons/[wcaId]`（20 万）和 `wca/comp/[slug]`（1.7 万）——
那是故意排除的，收进去就是自找 Edge Request 爆表。

### 2.5 G. 建议不做的

**把 `/wca/*`、`/forum`、`/recon` 列表页改成 SSR。**

这些是数据密集页，SSR 意味着服务端 fetch API → 从静态变动态 → 直接撞 Vercel Fluid CPU
4h/月上限，重演 2026-06-06。而且它们 SEO 价值本来就低（是工具和列表，不是内容）。

**代价高、收益低，不做。**

---

## 3. 现状清单（实测数据）

### 3.1 server HTML 正文字符数

| 页面 | 正文字符 | 判定 |
|---|---:|---|
| `/calc` `/wiki` `/recon` `/scramble/stats` | 0 | 空壳 |
| `/wca/records` | 8（`Loading…`） | 空壳 |
| `/wca` | 10 | 空壳 |
| `/forum` | 86 | 空壳 |
| `/math/group/lagrange` | 155 | 只有导航条 |
| `/alg/3x3` | 335 | 只有目录 |
| `/math/group` | 4,722 | 63 节只露 1 节 |
| `/regulation/notation` | 5,558 | 尚可 |
| `/why-cube` | 19,628 | ✅ 好 |
| `/regulation/full` | 132,473 | ✅ 好 |

### 3.2 全站性问题

| 问题 | 实测 |
|---|---|
| server HTML 无 `<title>` | **0 / 202** sitemap 页有 title 标签 |
| description 全站同一句 | 202 页共用 `"Cubing toolkit — solver, recon, training, WCA statistics."` |
| `og:title` 全站同一值 | 全是 `"CubeRoot"` |
| JSON-LD | 仅 `/recon/[id]` 的 VideoObject（3 条抽样中 1 条有） |
| `/llms.txt` `/llms-full.txt` | 404 |
| sitemap `lastModified` | `sitemap.ts:58` 用 `new Date()` → 每次部署 202 条一起跳，零信号 |
| `twitter:card` | `summary`（小图），不是 `summary_large_image` |

### 3.3 recon 双 canonical 冲突（实测复现）

```
GET /recon/2523
  HTTP  Link:  <https://cuberoot.me/recon/2523>; rel="canonical"
  HTML  <link rel="canonical" href=".../recon/2523-zhen-chen-oh-2026wca-f">
```

根因：`proxy.ts:90` 的 `setSeoLinkHeaders` 无条件按 pathname 算 canonical，
不知道 `recon/[id]/page.tsx:62` 自己设了 slug 版。两个来源给不同值 → Google 两个都不信 →
恰好废掉了 slug 合并机制本身。

### 3.4 做得好的部分（别动）

- `proxy.ts` 集中发 canonical + hreflang（en / zh-Hans / x-default），SSG 安全，一处覆盖全站
- Pattern B 路由（英文裸 URL / 中文 `/zh`），`/en/*` 老链接靠 canonical 合并
- sitemap 与 recon-sitemap 拆分（慢 API 不会拖垮 build）
- `/recon/[id]` 是全站唯一做全的页面：真 title/description、per-item canonical、
  薄内容 noindex、VideoObject JSON-LD ——**这就是其余页面的样板**
- robots 拦第三方审计爬虫（Ahrefs/Semrush/DataForSeo 实测 0 命中，有效）

---

## 4. 执行顺序

### 第一批 —— 半天，零风险，先落地

1. **robots 拆分**：放开引用型（`OAI-SearchBot` / `ChatGPT-User` / `PerplexityBot` /
   `Amazonbot` / `YouBot` / `FacebookBot`）；把整站 `Disallow: /` 换成只挡
   `/wca/persons/` + `/wca/comp/`。训练型是否保留由你决定。
2. **顺手把 Sogou 限流**：19.4% 的流量，比所有 AI 爬虫加起来多 500 倍，
   目前完全没管。加 `Crawl-delay` 或挡掉高基数子树。
3. **修 recon 双 canonical**：`proxy.ts` 对 `/recon/` 跳过 Link 头。
4. **加 `llms.txt`**：站点导览 + 关键内容页清单。

### 第二批 —— 1~2 天，需要先验证

5. **先在 dev 建一个 throwaway 路由，验证 server `layout.tsx` 能给 client `page.tsx` 发
   metadata。** 验过了再往下走。
6. 建 `lib/page-meta.ts` 中央双语标题/描述表，铺 per-route `layout.tsx`。
   先做流量 top 30，验证无回归后再铺满。

### 第三批 —— 内容层，收益最大

7. `/math/group` 去掉 `ssr: false`（63 节 → 真内容进 HTML）。
8. sitemap 收 `math/group/[slug]`、`tutorial/[slug]`、`alg` 套装。
9. `/tutorial/[slug]`、`/wiki` 补 SSR 正文。

### 第四批 —— 锦上添花

10. JSON-LD：首页 `WebSite` + `SearchAction`；math / tutorial / regulation 用 `Article`；
    工具页 `SoftwareApplication`；全站 `BreadcrumbList`。
11. sitemap `lastModified` 改用 git 文件 mtime。
12. per-page `og:image` + `twitter:card` 升 `summary_large_image`。

---

## 5. 本次调查的方法与局限

**做了什么**：用 curl 以 Googlebot UA 抓线上 server HTML（不执行 JS，模拟非渲染爬虫），
用 node 脚本正确剥离 script/style 后统计可见正文字符数；ssh 只读源站 nginx 日志统计 UA 分布；
核对 `robots.ts` / `sitemap.ts` / `proxy.ts` / `layout.tsx` / `recon/[id]/page.tsx` 源码。

**局限**：

1. **第一版正文统计用 `sed` 剥 script，行内贪婪匹配把 script 之间的正文一起吞了，
   得出「大量页面 1523 字符」的错误结论。** 已用 node 脚本重测，本文数字是修正后的。
2. **第一版日志统计包含了我自己用 Googlebot UA 发的探测请求。** 已按时间窗剔除。
3. **AI 爬虫量只测到了源站（国内线）。** 海外流量走 Vercel，那条线的 per-path/UA 拆分
   锁在 Observability Plus 付费墙后（Hobby 返 402），拿不到。所以 0.04% 这个数字
   **是源站的实测值，对 Vercel 线是推断**。不过考虑到它们正被 robots 拦着，
   放开后的量级仍属可控，且阀门（只挡两棵高基数树）随时可收。
4. ~~**server `layout.tsx` 给 client `page.tsx` 发 metadata 这条没有实证**，见 §2.2 的警告。~~
   **已实证**（见 §6.1）。§2.2 的警告作为当时的判断留在原处。

---

## 6. 已执行

同日落地。每一项都在本地 dev 上抓 server HTML 验过，非「改完即认为生效」。

### 6.1 先验掉那个地基假设

§2.2 整套方案压在一个未验证的假设上：server `layout.tsx` 能不能给 `'use client'` 的
`page.tsx` 提供 metadata。**先建了一个 throwaway 路由验它**，验完删除：

| 检查 | 结果 |
|---|---|
| `<title>` 进 server HTML | ✅ `<title>Probe English Title \| CubeRoot</title>` |
| `generateMetadata` 拿得到 `lang` | ✅ `/zh/seoprobe` → `探针中文标题` |
| client 组件照常工作 | ✅ `useState` 正常 |

结论成立 → **180 个 `'use client'` 页面一个都不用拆**。这是整轮改造能便宜下来的原因。

### 6.2 改了什么

| # | 改动 | 关键文件 |
|---|---|---|
| 1 | robots 从「封爬虫」改成「封贵的 URL 空间」 | `app/robots.ts` |
| 2 | 全站 per-route title / description | `lib/page-meta.ts` + 199 个 `layout.tsx` |
| 3 | `/math/group` 63 节正文进 server HTML | `math/group/page.tsx` |
| 4 | 63 节各自的 title / description / h1 | `math/group/[slug]/layout.tsx` + 63 个 section |
| 5 | recon 双 canonical 冲突 | `proxy.ts` |
| 6 | sitemap 收 63 节、去掉假 lastmod | `app/sitemap.ts` |
| 7 | llms.txt | `app/llms.txt/route.ts` |
| 8 | JSON-LD | `components/JsonLd.tsx` 等 |

**robots** — 引用型（`OAI-SearchBot` / `ChatGPT-User` / `PerplexityBot` / `Amazonbot` /
`YouBot` / `FacebookBot`）放开；训练型维持封禁（立场问题，与流量无关，故按现状保留）；
整站 `Disallow: /` 收窄为 `/wca/persons/` + `/wca/comp/`；Sogou 加 `Crawl-delay: 5`。
**自己挖出的坑**：`/wca/comp/stats` 和 `/wca/comp/sources` 是真内容页且在 sitemap 里，
被 `/wca/comp/` 前缀误伤 → 补 `Allow` 例外，否则 robots 与 sitemap 自相矛盾。

**title / description** — 标题从现有 `useDocumentTitle(zh, en)` 调用里机械抽取 162 条
（所以 tab 标题不变），手写补 26 条；26 个高价值页手写描述，其余继承站级默认。
regulation 16 章的标题与描述**从 `REG_ARTICLES` 派生而非复制**，章节改名不会漂移
（`_data/reg-metadata.ts`）。首页是唯一拿不到 sibling layout 的路由（那一层就是包住全站的
`[lang]/layout.tsx`，在那里设标题会漏给所有无 layout 的 `[param]` 哨兵页），故单独拆成
server wrapper + `LandingClient.tsx`。

**`/math/group`** — 去掉 63 处 `ssr: false`。实测风险远低于预期：63 个 section 只有 1 个
直接碰浏览器 API，8 个用 `TwistyMini` 而它已把 `import('cubing/twisty')` 放进 effect。
同时把 63 个 `<h2 class="gt-sec-title">` 提成 `<h1>`（CSS 是纯 class 选择器，视觉零变化）——
此前这 63 页一个 h1 都没有。TOC 抽到 `_data/toc.ts`（无 import 的纯数据），
让 sitemap 与 `[slug]/layout.tsx` 都能读，避免把 client 页拖进 build 期服务端模块。

**sitemap** — `lastModified` 直接删掉而非改进：原来是 `new Date()`，一次部署就把全部 URL
标成「今天改过」。Google 明说 lastmod 不可靠时整个字段作废,所以统一时间戳比没有更糟；
而真实日期在此拿不到（CI 里 git 不保留 mtime，本文件又必须无 I/O）。recon sitemap 有真
日期，继续发。

**JSON-LD** — 首页 `WebSite` + `Organization`，math 63 节与 regulation 16 章各一个
`Article`。**刻意不加 `SearchAction`**：站内没有全局搜索端点，声明了就是站点兑现不了的承诺。

### 6.3 效果（本地 dev 实测）

| 指标 | 改前 | 改后 |
|---|---:|---:|
| 有 `<title>` 的路由 | 0 | 抽查 30/30 |
| 唯一 description | 1 条全站共用 | 26 条手写 + 16 章派生 |
| `/math/group/lagrange` 正文 | 155 字符 | 5,471 |
| `/math/group/cayley` 正文 | — | 26,985 |
| sitemap URL | 202 | 264 |
| JSON-LD 页面 | 仅 recon | + 首页 / 63 节 / 16 章 |

`typecheck` 干净；`pnpm test` 3,130 通过 / 3 跳过，含 i18n 棘轮、catalog、url-state 等守卫。

### 6.4 第二轮（同日）——把 6.4 原本列的遗留项做掉

第一轮之后重读遗留清单，发现其中三条的前提是错的，一条是真 bug。

**动态路由并非「多数不在 sitemap 里、优先级低」。** 逐个读 `generateStaticParams` 才看清：
这些 `[param]` 路由分两类，能做的远比想的多。

- **哨兵壳**（`dynamicParams = false` + 返回 `[{x:'_'}]`，URL 被 rewrite 到 `/_`）：服务端
  根本拿不到真 param，不转 dynamic 就无解 —— `/wca/persons/` `/wca/comp/` `/forum/f/`
  `/alg/[puzzle]/[set]/[subgroup]` 属此类，维持现状（前两个本来就被 robots 挡着）。
- **静态可枚举**：`ALG_CATALOG`（41 套公式）、`CATEGORIES`（LSLL 42 类）、`STACK_TOOLS_META`、
  `LLM_TOOLS_META`、`ABOUT_REGISTRY` 全是代码里的静态数组，路由已经在 build 时全量预渲染。
  既然如此，**per-param metadata 是免费的，进 sitemap 也是免费的** —— 原先「alg 套装需要调
  API 才能枚举」的判断是错的，`generateStaticParams` 本身就证明了它们可枚举。

于是补了 11 个动态 layout：`alg/[puzzle]`、`alg/[puzzle]/[set]`（含 `/run` `/select`）、
`alg/lsll/[group]`、`code/stack/[slug]`、`code/llm/[slug]`、`wca/about/[id]`、
`recognize/[algSetId]`、`tutorial/[slug]`、`tutorial/c/[cat]`。

**`/tutorial` 是最大的一个洞**：609 篇教程 + 31 个分类页，全部顶着 "Cubing Tutorials" 一个
标题，且一条都不在 sitemap 里。catalog 是 static origin 上的 JSON（253KB），所以：

- metadata 走 `lib/tutorial-seo.ts` 在 `generateMetadata` 里 fetch。**不会拖慢 build**：该路由
  `generateStaticParams` 返回空，build 期不生成任何 slug，fetch 只在首次请求某 slug 时发生。
- sitemap 另开 `app/tutorial-sitemap.xml/route.ts`（`force-dynamic`，照抄 recon 的失败降级：
  出错返回空 urlset + 短缓存，绝不 500）。
- **只有 60/609 是双语**（411 篇仅英文、138 篇仅中文）。客户端会回退到存在的那个语言，所以
  另一语言的 URL 是「同一篇文章的错语言副本」。因此 sitemap 只列真实存在的语言，hreflang 只
  在双语篇目上成对出现；缺失语言的那个 URL 由 layout 发 `noindex, follow`。
- catalog 的 `mtime` 是真实的每篇日期，所以这个 sitemap **发** `lastmod`（与 6.2 里静态
  sitemap 删掉 lastmod 的理由并不矛盾：那里没有真日期，这里有）。

**`eventProseName`（新增）**：`DISPLAY_EN` 是给 chip / 表头用的紧凑名 —— `minx` → `Mega`、
`333` → `3×3`。放进标题就成了 "Mega Algorithms"，没人这么搜，`×` 也没人这么打。新增
`PROSE_EN` 只覆盖写法不同的 id，其余回落 `DISPLAY_EN`，事件命名仍是一处。

**真 bug：7 个标题里有多余反斜杠。** 第一轮生成 `page-meta.ts` 的脚本把撇号写成了三个反斜杠
加撇号，在单引号串里等于「转义反斜杠 + 转义撇号」，页面上就渲染成 `Hejlsberg\'s third
language`（多一个反斜杠）。已修，
7 处全部实测确认（csharp / php / sql / wca-site / cubingchina / mojo / demigod）。

**`useDocumentTitle` 不是「无害」的。** 第一轮把 11 个标题改好了（Sim → Puzzle Simulator、
Wiki → Cubing Glossary、去掉 `·` 等），但这些页的 hook 还在，hydration 之后 **把服务端标题
覆盖回旧文案**。真正的重复也是隐患：两个源迟早会漂。所以按 CLAUDE.md 的「一处只留一个标题源」
清了 167 处：

| 类别 | 数量 | 处理 |
|---|---:|---|
| 与 layout metadata 完全一致 | 146 | 删（行为零变化） |
| layout 标题更好、hook 是旧文案 | 12 | 删（hydration 不再回退） |
| 动态标题、已被新 layout 接管 | 9 | 删 |
| 运行时才知道的标题（`?event=` 分发、无自己的 layout） | 5 | **留**，并把路由 metadata 改成通用名 |
| 非字面量、未逐个核对 | 19 | 留 |

`/scramble/solver` 的 metadata 原本写着「魔表求解器 / Rubik's Clock Solver」—— 那是从兄弟
组件里seed错的，这个路由按 `?event=` 分发 28 种魔方。已改成通用名，各求解器仍在运行时细化
tab 标题（puzzle 在 query 里，服务端看不见）。

### 6.5 第二轮效果（本地 dev 实测）

| 指标 | 第一轮后 | 第二轮后 |
|---|---:|---:|
| 静态 sitemap URL | 264 | **471** |
| 教程 sitemap URL | 0 | **640**（609 篇 + 31 分类） |
| 有独立标题的动态路由 | 63（仅 math/group） | 63 + 41 公式集 + 42 LSLL + 609 教程 + 31 分类 + 67 about + 46 stack/llm |
| 标题被 hydration 覆盖回旧文案的页 | 12 | 0 |
| 标题含多余反斜杠 | 7 | 0 |

`typecheck` 干净；`pnpm test` **3,165 通过 / 3 跳过**。Playwright 实测 hydration 之后
`/zh/sim` = 魔方模拟器、`/zh/alg/megaminx` = 五魔公式、`/zh/tutorial/pll` = PLL公式、
`/zh/scramble/solver?event=sq1` 仍能细化成 SQ1 求解器。

### 6.6 仍然留下的

- **哨兵壳路由拿不到 param**（`/wca/persons/<id>` `/wca/comp/<slug>` `/forum/f/<slug>`
  `/alg/[puzzle]/[set]/[subgroup]`）。要给它们真标题只能转 dynamic 渲染，而那正是唯一会撞
  Vercel 配额的改动，不做。这些页的 tab 标题仍由客户端 hook 提供，用户看得对，爬虫看不到。
- **`/math/group/[slug]` 仍未改成 build 时预渲染**：理由同上一轮 —— dev 在跑，本地跑不了
  `next build`，未经验证的 build 形态改动不上。
- **19 处非字面量 `useDocumentTitle` 未逐个核对**（forum / recon 详情 / persons / comp /
  globe / 各 trainer 等）。它们所在路由要么是哨兵壳、要么标题真的随运行时状态变，留着是对的；
  但没有一条条验证「服务端 metadata 与它是否冲突」。

## 7. 守卫（2026-07-27 加）

第二轮之后补的一层：`tests/page-metadata-coverage.test.ts`（登记在 `/code/guards`）。

**为什么需要**：漏配标题是**静默失败** —— `app/sitemap.ts` 是扫目录生成的，新页面会自动
进站点地图（等于主动请爬虫来看），标题却不会自动有。结果不是"没效果"，是"招来爬虫看一个
没标题的页"。当初全站 0 个 `<title>` 就是这么攒出来的，靠约定文档防它，等于用已经失败过
一次的机制再防一次（CLAUDE.md「立约束要分层」）。

守卫查四件事，全部硬红（不是棘轮）：

1. 每个含 `page.tsx` 的路由，必须在**它自己的目录**里有 metadata 来源 ——
   `layout.tsx` 调 `pageMetadata('<route>')`、`layout.tsx`/`page.tsx` 自带
   `generateMetadata`。**祖先 layout 不算**，否则人人都能"继承"到站级默认，守卫就废了。
2. `pageMetadata('<key>')` 的 key 必须真在 `PAGE_META` 里 —— 拼错同样静默退回默认标题。
3. `PAGE_META` 不许留孤儿条目（路由改名/删除后的残留）。
4. ALLOWLIST 本身不许腐烂：豁免的路由必须还存在，且不许已经有了自己的 metadata。

**实测触发过**：临时建了个无 layout 的 `zzprobe` 路由 → 第 1 条红；再给它一个 key 拼错的
layout → 第 2 条红。不是只跑一遍看绿。

**加守卫时顺手补齐的路由**（覆盖率 213/228 → 219/228）：

- `/wca/<statId>` 62 个统计页 —— 没有 build 期 id 列表，但 `/stats/index.json` 里有双语名，
  照教程那套在 `generateMetadata` 里 fetch。
- `/wca/prediction/333/<sectionId>` 25 节 —— `SECTIONS` 从 client 组件抽到
  `_data/sections.ts`，服务端与客户端共用一份。
- `/recon/<id>/alt` 及其 3 个子路由 —— 静态通用标题，好过继承 `/recon` 的"复盘"。

**剩下 9 条豁免**（每条在测试文件里带理由）：7 个哨兵壳（`dynamicParams=false` + 参数
rewrite 成 `_`，服务端拿不到值；要给标题只能转 dynamic 渲染 = 唯一撞 Vercel 配额的改动）
+ 2 个 dev/poc 页（`app/sitemap.ts` 的 `EXCLUDE` 也排除它们）。
