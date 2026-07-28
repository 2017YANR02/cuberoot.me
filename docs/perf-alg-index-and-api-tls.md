# /alg/[puzzle] 首屏缩略图慢

起因:`https://cuberoot.me/zh/alg/3x3` 的 19 张魔方缩略图不是瞬间出现,肉眼可见地一张张往外蹦,
旁边那张 LSLL 卡片却永远第一个到位。

结论:**是前端的数据形状 + 双段瀑布问题(§1)**。
调查途中一度以为 API 源站有 15–33s 的 TLS 握手抖动,后证实是**本机代理造成的测量假象**(§2),
源站本身健康。另有两个顺手发现的独立 bug 记在 §3。

状态:§1 待动工;§2 已结案(非站点问题);§3 未开工。

---

## §1 /alg/[puzzle] 首屏

### 1.1 现状链路

`core/packages/client/app/[lang]/alg/[puzzle]/AlgPuzzleClient.tsx:79-98`

```
SSG 壳渲染(无图)
  → useEffect: 对 catalog 里 19 套各发一次 loadAlg()   ← 下载整个 3x3 公式库
  → Promise.all 屏障:等最慢的那一套回来
  → setState → 19 个 <img src=api.cuberoot.me/v1/visualcube.svg>   ← 第二段瀑布
```

代码只用到 `d.cases.length` 和 `d.cases[0]`,却把整套公式都拉了下来。

### 1.2 实测(2026-07-28,gzip 后,**直连**)

19 套合计 **950,474 B ≈ 928 KB**,换来 19 个数字 + 19 张缩略图:

| 套 | 大小 | | 套 | 大小 |
|---|---|---|---|---|
| `1lll` | **660,617 B** | | `ell` | 6,481 B |
| `zbll` | 138,928 B | | `wv` | 5,854 B |
| `ollcp` | 31,487 B | | `cls` | 5,643 B |
| `zbls` | 28,547 B | | `sbls` | 4,322 B |
| `vls` | 14,600 B | | `coll` | 4,127 B |
| `f2l` | 12,379 B | | `cmll` | 4,105 B |
| `adv-f2l` | 9,621 B | | `fruf` | 2,708 B |
| `pll` | 8,586 B | | `anti-pll` | 2,654 B |
| `oll` | 7,172 B | | `sv` | 1,774 B |
| | | | `eo4a` | 869 B |

单 `1lll` 一套就占了全部流量的 **70%**。

墙钟(直连 + 复用连接并发,3 次):

```
JSON 阶段 569–672 ms   →   SVG 阶段 344–361 ms   →   串行合计 913–1033 ms
```

本地渲染成本对照(`renderFromSimpleQuery`,Node 冷跑含 JIT):

```
19 张 96px 立方体:25.7 ms      平均 SVG 6,713 bytes
```

即:**当前这一秒的等待,可以换成 26 毫秒的主线程工作**。而且以上是理想网络下的数字
(源站 RTT ≈ 15ms),换成慢网 / 移动网 / 远距离用户会成比例放大。

### 1.3 四个可分别修的缺陷

1. **数据形状错** —— 为 count + 封面拉全库(§1.2)。
2. **`Promise.all` 屏障** —— 最慢一套没回来,19 张图一张都不显示。
3. **第二段瀑布** —— JSON 全到齐后才开始发 19 个 `visualcube.svg` 请求,又多一轮 RTT。
   `components/VisualCube.tsx:39-57` 早就有 `local` 模式(同一个渲染函数,画面完全一致),这页没传。
4. **对照组** —— 旁边 LSLL 卡走 `FaceletsCube` + 本地算的 facelets,零网络,所以它永远先到。
   这就是截图里"一张先出、其余后到"的观感来源。

### 1.4 候选方案

| | 做法 | 效果 | 代价 |
|---|---|---|---|
| **A** | thumb 传 `local` + 拆掉 `Promise.all` 改逐个 setState | 砍掉整个 SVG 阶段(−350ms);图逐张出而非齐步走 | 最小改动;图仍等各自 JSON |
| **B** | 扩已有 `GET /v1/alg/sets`(`packages/server/src/routes/alg_sets.ts:87`),用 `DISTINCT ON` 带上每套首个 case 的 `sticker/setup/alg` | 19 请求 → 1 请求,928 KB → 几 KB,图与数字同帧 | 改 server + 需 push |
| **C** | 把封面 case + count 烤进构建期常量,配 `local` 渲染 | **首帧就有图,零网络** | 引入需守卫的快照(照搬 `icons-drift` 的 CI 漂移检查) |

倾向:**C + A 的屏障修复**;B 留给 `/alg/progress` 那类真需要 count 的地方。

顺带:`1lll` 单套 660 KB,凡是真要进 `/alg/3x3/1lll` 的页面都得吞一次,值得单独看看能不能分页 / 瘦身。

---

## §2 已结案:所谓"API 源站握手 15–33s"是本机代理造成的假象

### 2.1 曾经的观测

早期采样里,`api.cuberoot.me` 的 TLS 握手(`time_appconnect`)出现:

```
1.02  31.65  32.94  14.72  1.02  1.03 ...
```

且 14.72 / 31.65 / 32.94 精确落在 TCP RTO 指数退避的和上(1+2+4+8=15,1+2+4+8+16=31),
一度看起来像握手报文被丢弃后走重传退避。

### 2.2 逐个证伪

| 假设 | 检验 | 结论 |
|---|---|---|
| 源站被自己的页面压垮 | 空闲 8 次 vs 19 并发肥请求下 10 次握手对照 | **证伪**。burst 期间 1.01–1.06s,与空闲无差异 |
| PG 连接池耗尽 | 卡在 `appconnect` 而非 `starttransfer` | **不成立**,卡点在 TLS 层,还没到应用 |
| 恒定的跨境路径劣化 | 14 轮 × 5 目标 = 70 次采样 | **证伪**,全部 1.02s 稳定 |
| PMTU 黑洞(证书 flight 是握手里唯一的多满包段) | `ping -f` 到 1472 B payload 全通;证书链 3 张 / DER ≈ 4.2 KB / RSA-2048 | **证伪** |
| 源站 OOM kill | `dmesg` 无 `oom-kill` | 无证据 |

### 2.3 真因

`time_connect` 恒为 **2 ms** 而 `time_appconnect` 要 **1 s** —— TCP 三次握手 2ms 意味着 RTT ≈ 2ms,
那 TLS 不可能要一秒。顺着这个矛盾查到本机:

```
HTTP_PROXY / HTTPS_PROXY / ALL_PROXY = http://127.0.0.1:10808   (xray)
Windows 系统代理 ProxyEnable=1, ProxyServer=127.0.0.1:10808
```

**全部测量都走了本机 xray 隧道**,`time_connect` 量的是到 127.0.0.1 的距离。同一个 API 直连对比:

| | DNS | TCP | TLS | TTFB |
|---|---|---|---|---|
| **直连** | 10–15 ms | ~15 ms | +28 ms | **68–80 ms** |
| **走 xray** | — | 1.7 ms(到本机) | 1.02 s | **1.36–1.41 s** |

源站侧回环握手(`--resolve api.cuberoot.me:443:127.0.0.1`,排除一切网络路径):**9–24 ms**。

结论:**源站健康**,15–33s 卡顿是 xray 隧道抖动。已放弃的行动项:开 `ssl_stapling`
(反而会让证书 flight 变大,且现代浏览器基本不做 OCSP 查询)、给 api 加边缘缓存层。

### 2.4 但对本机测量的影响是长期的

用户浏览器同样走系统代理,所以**在这台机器上用浏览器观察到的任何站点延迟,都自带
+1.3s/连接的税,外加偶发 15–33s 卡顿**(观测到约 8 次新握手里 3 次)。

→ 规矩:本机测站点性能一律 `curl --noproxy '*'`;Playwright 量加载速度要显式绕过代理,
否则量的是隧道不是站点。

---

## §3 顺手发现的两个独立 bug(未开工)

1. **`[cubing-live] L2 write failed <comp>/wca_db: interval field value out of range: "2592000000 milliseconds"`**
   —— `core-api` 错误日志里持续刷屏。30 天被当成毫秒数塞进 PG `interval`,
   导致**这层 L2 缓存写入全部失败**,等于一直形同虚设。
2. **`[cubing-record] previous cycle still running, skip this tick`** —— 后台轮询周期跑不完,持续跳票。

另记两条基建事实:

- api vhost 实际住在源站的 `vhost.d/www.cuberoot.me.conf` 里,**不在 repo 的 `ops/nginx/`**
  → 改 api 的 nginx 没有 `deploy_nginx.yml` 覆盖,属于配置漂移,值得补进仓库。
- `pm2` 显示 `core-api` 累计重启 **244** 次(`unstable restarts 0`,无 OOM kill),
  大概率是每次 deploy 触发,但值得确认没混入静默崩溃。

---

## 变更记录

- 2026-07-28 立档。§1 完成测量与方案对比(待动工);§2 结案(测量假象);§3 记录待开工。
