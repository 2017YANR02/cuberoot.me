# 全站首屏取数审计

起因:`https://cuberoot.me/zh/alg/3x3` 的 19 张魔方图不是瞬间出现,一张张往外蹦。
查下去发现这不是单页问题,是一套模式在全站复制。本文档:

- §0 判据(五条业界标准)
- §1 全站扫描结果 + 线上日志实证
- §2 逐条整改项与优先级
- §3 `/alg/[puzzle]` 详案(最初的那页)
- §4 已结案:所谓"API 握手 15–33s"是本机代理造成的测量假象
- §5 顺手发现的独立 bug

---

## §0 判据

索引页 / 列表页的通用标准,按优先级:

1. **列表接口 ≠ 详情接口** —— 列表只取 `id / 标题 / 数量 / 封面`,详情数据留到详情页。
   拿详情接口渲染列表叫 over-fetching,是教科书级反模式。列表接口必须有分页。
2. **首屏内容不在 `useEffect` 里取** —— 构建期或服务端就填好。
   `useEffect` 取数 = HTML 到 → JS 下载 → JS 执行 → 发请求 → 等响应 → 才渲染,五个串行环节。
3. **缩略图是静态资源,不是接口调用** —— 预生成 / 内联,长缓存,首屏之外才 `loading="lazy"`,
   写死宽高防布局跳动。绝不在请求时让应用服务器现算一张图。
4. **不许有"全到齐才显示"的屏障** —— 服务端流式,或客户端逐个到逐个显示。
5. **关键资源尽量同源** —— 跨域要多付 DNS + TCP + TLS。避不开就 `preconnect`。

共同内核:**把工作从用户等待的那一刻往前挪。**

---

## §1 扫描结果

范围 `core/packages/client`:230 个 `page.tsx`,其中 **186 个是 `'use client'`**。

### 1.1 线上访问日志实证(`api.cuberoot.me`,2026-07-26 03:14 → 07-28 17:28,共 2.6 天)

总请求 363,077 条。按**请求数**排:

| 端点 | 请求数 | 占比 |
|---|---:|---:|
| **`/v1/visualcube.svg`** | **70,035** | **19.3%** |
| `/v1/feedback/mine/unread` | 42,331 | 11.7% |
| `/v1/notifications/unread` | 37,152 | 10.2% |
| `/v1/recon/list` | 16,850 | 4.6% |
| `/v1/alg/sets/:p/:s` | 11,326 | 3.1% |

**整个 API 每五个请求就有一个是在现场画一张魔方缩略图。** 单客户端峰值 **1,111 次/分钟**
(一次打开大公式集页面)。这些图浏览器本地画只要 ~1.4 ms/张。

按**流量**排:

| 端点 | 流量 | 请求数 | 均值 |
|---|---:|---:|---:|
| `/v1/recon/list` | **614.2 MB** | 16,850 | 36 KB |
| `/v1/alg/sets/:p/:s` | **484.4 MB** | 11,326 | 43 KB |
| `/v1/visualcube.svg` | 106.5 MB | 70,035 | 1.5 KB |
| `/v1/recon/wca-results` | 46.3 MB | 3,953 | 12 KB |

前两名合计 **1.1 GB / 2.6 天**,占 API 出口流量约七成 —— **两个都是"列表页拉了详情数据"**。

> 注:`visualcube.svg` 已正确 gzip(单张 4,961 B → 867 B),压缩不是问题;问题是这 7 万次请求
> 本来一次都不该发。

### 1.2 五条标准的违规面

| 标准 | 违规点 | 证据 |
|---|---|---|
| **1 列表≠详情** | `/alg/[puzzle]` 发 19 次详情请求(928 KB)只为拿 19 个封面 + 数量;现成索引接口 `GET /v1/alg/sets` 只要 **1,311 B** —— **700 倍差距** | 直连实测 |
| | `/v1/recon/list` **无分页**,`SELECT ... ORDER BY id DESC` 全量返回,183 KB/次,且 `no-store` 不可缓存 | `routes/recon.ts:78-110` |
| | `/wca/comp` 日历列表拉 `all_past_comps.json` **1.92 MB(gzip 后)** | `use_calendar_data.ts:29` |
| **2 首屏不 useEffect** | 32 个组件在 `useEffect` 里取首屏数据 | 全仓 grep |
| | 其中内容静态、可构建期就绪的:`/alg/*` 系列、`/wca/comp`、`/tutorial`、`/scramble/stats`、`/wca` hub | |
| | 另一类(`/wca/results`、`/grand-slam`、`/success-rate`、`/cohort-ranks`、`/all-events-done`、`/fun-stats`)是筛选驱动,客户端取数**合理**,但默认视图可以服务端渲染 | |
| **3 缩略图静态化** | 17 处 `<CaseThumb>` 调用点,**只有 2 处**传了 `local`(TrainerRunClient、MemoryTrainer),其余全走接口 | 全仓 grep |
| | 网格页无懒加载,一次全拉。**单页真实张数(Playwright 实测,非按 case 数推算)**:`cls` 97、`oll` 57、`ollcp` 57、`adv-f2l` 54、`1lll` 50、`zbll` 47、`zbls` 42 | `AlgCategoryView.tsx` |
| | 全站 58 个 `<img>`,只有 15 个带 `loading="lazy"` | 全仓 grep |

> **更正**:本文档初版按 case 总数推算,写成"`1lll` 一次铺 3,397 张"。实测是 **50 张** ——
> umbrella 集顶层渲染的是**子组封面卡**,不是全部 case。`sq1` / `skewb` 更是 0 张 `<img>`
> (走 `PuzzleSVG` 本地内联)。真实的单页上限在 **97 张**(`/alg/3x3/cls`),不是几千。
> 这个更正把下面 P1 的"网格分页"从必做降级为待观察。
| **4 无屏障** | 28 个文件用 `Promise.all`;确证的首屏屏障:`AlgPuzzleClient.tsx:82` | 需逐个甄别 |
| **5 同源/preconnect** | `api.` 与 `static.` 均为独立域,root layout 只 `preload` 了字体,**全站零 `preconnect`** | `app/layout.tsx:61-67` |

---

## §2 整改项与优先级

按 **(收益 ÷ 成本)** 排,不是按改动量排。

### P0 — 已完成(2026-07-28)

1. **`preconnect` / `dns-prefetch`**(`app/layout.tsx`)—— `api` 每页都被全站 chrome
   (`PageNoticeBar` 等)打,给 `preconnect` 直接建连;`static` 只有统计 / 教程 / 比赛几类页面
   用,给更便宜的 `dns-prefetch` —— 对用不到它的页面 `preconnect` 只是白占一条 socket。
   origin 从 `lib/api-base` / `lib/stats-base` 新增的 `BROWSER_*_ORIGIN` 取(禁硬编码),
   dev 下两者同源故不发。
2. **`/alg/[puzzle]` 的封面改本地渲染** —— 19 张卡改 `local`。
   **不是全局默认**:长网格照抄这条会把几千次渲染压进主线程,比发请求更糟。
3. **长网格改 `loading="lazy"`** —— `AlgCategoryView` 的三处网格(case 网格 + 两处子组封面),
   其中第三处直接用 `<VisualCube>` 不经 `CaseThumb`,靠 Playwright 实测才发现漏改。
4. **拆 `AlgPuzzleClient` 的 `Promise.all` 屏障** —— 改为逐套 resolve 逐套 `setState`。
   增量更新要求换阶时先清空(sq1 与 megaminx 共用 `co/eo/cp/ep` slug,不清会读到上一阶的封面)。

**实测结果**(Playwright,本地 dev):

| 页面 | 改前 | 改后 |
|---|---|---|
| `/zh/alg/3x3` | 19 次 `visualcube.svg` 请求 | **0 次**,20 张内联 SVG |
| `/alg/3x3/cls`(手机 390px) | 97 次 | **43 次**(首屏) |
| `/alg/3x3/1lll`(手机 390px) | 50 次 | **18 次**(首屏) |
| `/alg/3x3/ollcp`(手机 390px) | 57 次 | **21 次**(首屏) |
| 同上三页(桌面 1280px) | — | 无变化 |

**线上实际能砍多少 —— 修正原先"砍掉全 API 约 19%"的估计。** 那个数字假设把所有缩略图都改本地
渲染,而那是错的做法(长网格照做会卡死主线程)。按线上日志的 `size=` 参数拆开 72,391 次
`visualcube.svg` 请求:

| `size=` | 次数 | 占比 | 来自 | 本次处理 |
|---|---:|---:|---|---|
| 88 | 29,373 | 41% | case 网格(`CaseThumb` 默认尺寸) | 懒加载 |
| 140 | 12,993 | 18% | 未定位 —— 待查 | 未动 |
| 110 | 10,772 | 15% | 子组封面卡 | 懒加载 |
| **96** | **6,432** | **8.9%** | `/alg/[puzzle]` 卡片 | **本地渲染,归零** |
| 64 / 44 / 其它 | 12,821 | 17% | 训练器等 | 未动 |

所以诚实的预期:

- **确定性下降 8.9%**(全部视口)—— 本地渲染那部分。
- **窄屏另有大幅下降**,作用在占 56% 的 `size=88` + `size=110` 上,实测首屏能砍五到六成;
  桌面端为零。总体幅度取决于移动端流量占比,**不做数字承诺,上线后看日志**。
- `size=140` 那 18% 还没定位来源,列进 P1 待查。

两点如实记录:

- **懒加载在桌面端是 no-op**。这些页面桌面高度 1981–3956px,整页都落在 Chrome 的预加载阈值内,
  97 张照样全拉。收益全部来自窄屏(整页 5732–10661px)。别对外宣称"砍掉桌面请求"。
- **本地渲染与接口渲染逐字节一致**:19 套封面各自两路渲染对比,**19/19 完全相同**
  (`view`/`mask` 分支覆盖 f2l / oll / pll / iso+vh / pll+coll / pll+cmll)。
  两边调的是同一个 `renderFromSimpleQuery`,画面不会变。

### P1 — 结构性,收益最大

4. **`/alg/[puzzle]` 改走索引接口或构建期常量** —— 928 KB → 几 KB。详见 §3。
5. **`/v1/recon/list` 加分页(keyset/cursor)** —— API 带宽第一名,614 MB / 2.6 天。
   `no-store` 是因为可见性随查看者变,合理;正因如此更需要分页。
6. ~~大公式集网格分页或虚拟化~~ —— **降级为待观察**。实测单页上限 97 张(`/alg/3x3/cls`),
   不是原先按 case 数推算的几千张;懒加载落地后窄屏首屏只剩 43 张。
   97 个 DOM 节点谈不上要虚拟化,现在做属于过度优化。等真出现单页 300+ 张的集再说。

### P2 — 收益明确但工程量大

7. **`/wca/comp` 的 1.92 MB** —— 日历首屏只需要当前月份 + 筛选器选项。
   拆成"按年/按月分片"或服务端预聚合。
8. **静态内容页转 SSG/服务端渲染** —— `/tutorial` 目录、`/scramble/stats`、`/wca` hub。
9. **筛选驱动页的默认视图服务端化** —— `/wca/results` 等,首屏默认参数在服务端渲染好,
   用户改筛选才走客户端。

### P3 — 检查项,未必有问题

10. `feedback/mine/unread` + `notifications/unread` 合计 **79,483 次 / 2.6 天 = 21.9%** 的请求量。
    两个轮询端点。确认轮询间隔是否合理、能否合并成一个端点或改推送。

---

## §3 `/alg/[puzzle]` 详案

### 3.1 现状链路

`app/[lang]/alg/[puzzle]/AlgPuzzleClient.tsx:79-98`

```
SSG 壳渲染(无图)
  → useEffect: 对 catalog 里 19 套各发一次 loadAlg()   ← 下载整个 3x3 公式库
  → Promise.all 屏障:等最慢的那一套回来
  → setState → 19 个 <img src=api.cuberoot.me/v1/visualcube.svg>   ← 第二段瀑布
```

只用到 `d.cases.length` 和 `d.cases[0]`,却把整套公式都拉了下来。

### 3.2 实测(2026-07-28,gzip,**直连**)

19 套合计 **950,474 B ≈ 928 KB**,其中 `1lll` 单套 **660,617 B**,占 70%。

墙钟(直连 + 复用连接并发,3 次):

```
JSON 阶段 569–672 ms   →   SVG 阶段 344–361 ms   →   串行合计 913–1033 ms
```

本地渲染对照(`renderFromSimpleQuery`,Node 冷跑含 JIT):**19 张 96px = 25.7 ms**。

### 3.3 方案

| | 做法 | 效果 | 代价 |
|---|---|---|---|
| **A** | `local` 渲染 + 拆屏障 | 砍掉 SVG 阶段(−350ms),图逐张出 | 最小 |
| **B** | 扩 `GET /v1/alg/sets`(`routes/alg_sets.ts:87`),`DISTINCT ON` 带上每套首个 case | 19 请求 → 1 请求,928 KB → ~2 KB | 改 server + push |
| **C** | 封面 + count 烤进构建期常量,配 `local` | **首帧就有图,零网络** | 需 CI 漂移守卫(照搬 `icons-drift`) |

倾向 **C + A**。与"公式数据单一源在 PG"不冲突:标准做法是构建时从库里拉、内容变了触发重建、
CI 加漂移检查 —— 烤进构建不是复制真相,只是把读取时机往前挪。

---

## §4 已结案:所谓"API 源站握手 15–33s"是本机代理造成的假象

早期采样里 `api.cuberoot.me` 的 TLS 握手出现 `1.02 / 31.65 / 32.94 / 14.72` 秒,
且数值精确落在 TCP RTO 指数退避的和上(1+2+4+8=15,1+2+4+8+16=31)。

**逐个证伪**:自身负载压垮(19 并发肥请求下握手 1.01–1.06s,与空闲无差异)、
PG 连接池(卡点在 TLS 层还没到应用)、恒定路径劣化(70 次采样全 1.02s)、
PMTU 黑洞(`ping -f` 1472 B 全通;证书链 3 张 / DER ≈ 4.2 KB / RSA-2048)、OOM(`dmesg` 无记录)。

**真因**:`time_connect` 恒为 2 ms 而 `time_appconnect` 要 1 s —— TCP 握手 2ms 意味着 RTT≈2ms,
TLS 不可能要一秒。查到本机 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` 与 Windows 系统代理
全部指向 `http://127.0.0.1:10808`(xray),**所有测量都走了隧道**。

| | DNS | TCP | TLS | TTFB |
|---|---|---|---|---|
| **直连** | 10–15 ms | ~15 ms | +28 ms | **68–80 ms** |
| **走 xray** | — | 1.7 ms(到本机) | 1.02 s | **1.36–1.41 s** |

源站侧回环握手(`--resolve` 到 127.0.0.1,排除一切网络路径):**9–24 ms**。源站健康。

**长期影响**:本机浏览器同样走系统代理,所以在这台机器上观察到的站点延迟自带
+1.3s/连接的税,外加偶发 15–33s 卡顿(8 次新握手中 3 次)。
→ 规矩:本机测站点性能一律 `curl --noproxy '*'`;Playwright 量加载速度要显式绕过代理。

已放弃的行动项:开 `ssl_stapling`(反而增大证书 flight,现代浏览器基本不查 OCSP)、
给 api 加边缘缓存层。

---

## §5 顺手发现的独立 bug(未开工)

1. **`[cubing-live] L2 write failed <comp>/wca_db: interval field value out of range: "2592000000 milliseconds"`**
   —— `core-api` 错误日志持续刷屏。30 天被当成毫秒数塞进 PG `interval`,
   导致**这层 L2 缓存写入全部失败**,一直形同虚设。
2. **`[cubing-record] previous cycle still running, skip this tick`** —— 后台轮询周期跑不完,持续跳票。

两条基建事实:

- api vhost 实际住在源站的 `vhost.d/www.cuberoot.me.conf`,**不在 repo 的 `ops/nginx/`**
  → 改 api 的 nginx 没有 `deploy_nginx.yml` 覆盖,属于配置漂移。
- `pm2` 显示 `core-api` 累计重启 **244** 次(`unstable restarts 0`,无 OOM kill),
  大概率每次 deploy 触发,值得确认没混入静默崩溃。

---

## 变更记录

- 2026-07-28 立档。原为单页(`/alg/[puzzle]`)性能记录,扩为全站审计。
  §1 完成扫描 + 线上日志实证;§2 列出 P0–P3;§4 结案。
- 2026-07-28 P0 四项完成并实测;更正初版按 case 数推算得出的"1lll 3,397 张"(实为 50 张),
  据此把 P1 的网格分页降级为待观察。P1–P3 待动工。
