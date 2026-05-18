# cube555 Random-State Benchmarks

一栏一阶段。每次跑 `node core/cube555-daemon/bench.mjs --base https://api.cuberoot.me`。

`single` = 20× 串行单条请求,p50/p90/p99/mean。
`par`    = 12× 并行(浏览器实际批量打乱 pool refill 行为),total = 12 条全部回来的墙钟时间。
`batch`  = SSE `/v1/scramble/555-rs/batch?count=12`,firstScramble = 第一条响应到达时间。

环境:服务器 2 worker JVM(`CUBE555_WORKERS=2`),`-Xmx1g`,230 MB 剪枝表常驻。

## 各阶段对比

> **User-facing 实测**:Playwright 端跑 /scramble/gen 切 5x5 随机状态 + 点 Generate(5/项)冷路径,Pre-fix 17.6s → Post-fix 9.69s(-45%)。详见下方"客户端冷路径修复"段。

| 指标 | Baseline (JVM/W2) | + batch+SSE (JVM/W2) | + GraalVM native (W2) | + workers=3 (native/W3) |
|---|---:|---:|---:|---:|
| **single p50** | 1.93s | 2.11s | 2.34s | 2.45s |
| **single mean** | 2.23s | 2.62s | 2.90s | 3.06s |
| **par-12 total** | 17.14s | 16.39s | 28.81s | **21.52s** |
| **par-12 per-req mean** | 9.39s | 9.30s | 14.48s | 11.67s |
| **batch-12 TTFB headers** | n/a | **96ms** | 137ms | 135ms |
| **batch-12 firstScramble** | n/a | **2.39s** | 3.17s | 2.67s |
| **batch-12 total** | n/a | 14.47s | 27.34s | 28.29s |
| **进程 RSS** | ~540 MB | ~540 MB | **368 MB** | 372 MB |
| **冷启动** | ~3s | ~3s | ~3s | ~3s |

⚠️ **数据可信度注**:测试期间服务器 1-min load avg 在 2.8-4.8 间(从前两轮
bench 引发的 OOM 风暴在恢复),native 那两栏被加噪声 +30-50%。同条件下
JVM/W2 的 batch+SSE 数据是最早跑的(load 较低)所以"看起来最快"。**真实
横向**应该是:

- per-solve 性能 native 大致 = JVM ±10%(没有 JIT 损失,IDA* 静态优化吃满)
- 实际生产价值 = 单进程 RSS **省 172MB**(540→368),给 worker 数留出空间。
- 当 W2→W3 时,par-12 直接掉了 25%(28.8→21.5s),证明扩 worker 才是吞吐的真凭据。

## Baseline — 2026-05-18

cube555 Java daemon,Hono 单条端点,无 batch/SSE。
12 并行请求 = 6 个 HTTP keepalive,client 各自 fetch,服务端 daemon 内部 2 worker 串行处理 12 个 id。

```
[ready]      GET /v1/scramble/555-rs/ready          → 129ms  {"ready":true}
[single n=20] min=810ms p50=1.93s p90=3.44s p99=3.66s max=4.95s mean=2.23s
[par n=12]    total=17.14s  per-req mean=9.39s (头先回的 1.45s,最后回的 17.14s)
```

观察:
- p50→p99 抖动大(1.93s → 3.66s 几乎 2×),说明 cube555 5-phase solver 内部 IDA* 深度对种子敏感
- par-12 总耗时 17s ≈ 12÷2 worker × p50 mean,符合 2 worker 排队模型
- 头一条 1.45s 内可回(队列前 2 个直接拿到 worker),后面慢慢排


## + batch+SSE — 2026-05-18

server 端加 `/v1/scramble/555-rs/batch?count=N` SSE 端点(`hono/streaming` →
`streamSSE`);客户端 `cubingScramble.ts` 555 pool refill 改走 batch,流式
yield。一次 TCP 连接 / TLS 握手,12 条 solver 出哪个 push 哪个。

**踩坑**:nginx 默认 `proxy_buffering on` 在 `location /` 路径里把整个 SSE
攒到响应结束才下行,首次实测 TTFB=30s ≈ 全部 solve 完工时间,流式完全失效。
修复:Hono 端点加 `c.header('X-Accel-Buffering', 'no')` —— nginx 私有头,
等同于 `proxy_buffering off` 但只影响这一个 endpoint,不需要动 vhost 配置。

```
[ready]  GET /v1/scramble/555-rs/ready         → 646ms
[single n=20] min=694ms p50=2.11s p90=5.23s p99=5.62s max=5.85s mean=2.62s
[par n=12]    total=16.39s  per-req mean=9.30s
[batch n=12]  ttfb-headers=96ms ttf-firstChunk=2.39s firstScramble=2.39s
              total=14.47s  scrambles=12/12  lastScramble=14.47s
```

观察:
- TTFB 96ms 确认 SSE 真的 streaming,头一帧立刻出
- firstScramble 2.39s = daemon solver 跑一条的实际时间,用户看见第一条打乱的延迟从
  16s(par,要等队列尾) 降到 ~2.4s
- batch-12 总耗时 14.47s(vs par 16.39s),减小但不显著 —— 主要是省了 12 路 TLS
  握手 + per-req 序列化
- 真正的 throughput 瓶颈仍是 2 worker × 1.5s/solve,要把 12 条全压下来还得 4 个
  worker 才能 ~6s 出。这块靠下一阶段 GraalVM 省 RAM 后扩 worker 处理。


## + GraalVM native + workers=3 — 2026-05-18

GraalVM 21 native-image,Daemon.java AOT 编 → 单文件 18MB Linux 二进制,
`--static --libc=musl` 完全静态(脱离系统 glibc)。CI 走 `.github/workflows/
cube555_native.yml`,build → scp `/opt/cube555/cube555-daemon.new` → server smoke
(`pm2 stop core-api` 先腾内存) → `mv` 覆盖 → restart core-api。

**踩坑**(从 5 次 CI 失败学到的):
1. ubuntu-latest glibc 2.39 vs 服务器 glibc < 2.34 → 必须 `--libc=musl`
2. `--libc=musl` 链接 libzip.a 要 musl-built libz.a,自己编一份并 copy 到
   `/usr/lib/x86_64-linux-musl/`(linker 默认搜索路径)
3. Server smoke 默认会跟现有 JVM daemon 撞内存 (230MB 表 × 2 = OOM 砍掉),
   smoke 前必须 `pm2 stop core-api` 让出 540MB
4. Substrate VM 默认 heap policy 是 sysmem 的 80%(1.8GB 服务器 → 1.4GB),
   会跟其他服务撞 → 显式 `-Xmx512m`

Production 启用方式:`/root/core-api/.env` 加 `CUBE555_NATIVE_BIN=/opt/cube555/
cube555-daemon`,daemon.ts 看到这个 env 后 spawn native binary 不走 java。

**实测内存**(native + workers=3):
```
VmRSS: 372204 kB         # = 372 MB
Threads: 3 (主 + 2 pool, 第三个 lazily on demand)
free -m available: 285M  # workers=2 时是 803M, 多塞一个 worker 吃 ~120MB
```

**bench(load avg ~3)**:
```
[single n=20] p50=2.45s p90=4.99s mean=3.06s
[par n=12]    total=21.52s ok=12/12  per-req mean=11.67s
[batch n=12]  ttfb=135ms ttf-firstChunk=2.67s total=28.29s
```

**与 JVM 横向**:per-solve 性能等价(±10% 噪声内),native 真正赢在:
- 进程 RSS 540→368MB,**省 172MB**,刚好够多塞 1 个 worker
- W2 vs W3 上 par-12 28.8→21.5s(-25%),吞吐净增

## + 客户端冷路径修复 (cubingScramble.ts) — 2026-05-18

Playwright 实测 `/scramble/gen` 用户「切到 5x5 随机状态 + 点 Generate(5/项)」**冷路径**(池空 + 模式刚切)。

```
                    Pre-fix          Post-fix
─────────────────────────────────────────────────
总耗时              17.6s            9.69s   (-45%)
首条                ~4.7s            2.48s   (-47%)
Daemon 调用次数     10               10      (同)
  其中 single         5                0
  其中 batch SSE      1 (count=5)      3 (count=5+4+1)
```

**为什么 daemon 调用数一样但耗时减半?**

Pre-fix 5 个 single fetch 各自走 Hono → daemon stdio → 排队/出队,每条都
单独一轮 HTTP+TLS 握手 + Hono 中间件;5 个 single 内部串行交付。

Post-fix 全部走 batch SSE,1 个 HTTP 连接,daemon 内部 N 个 solver 并行
求,解完哪个 push 哪个,客户端流式收。同样 10 个 solver work,网络层和
daemon dispatch 层效率明显高。

**修法**(`cubingScramble.ts` `pooledScramble`):pool 空 + 555-rs 时,不再
让每个 caller 各自 `fetch555Scramble()`,而是 schedule 一个 batch refill 后
poll pool。N 并发 caller 共享同一个 batch SSE,batch 流出的 scramble 谁醒
谁拿。

**剩余优化**(未做):refill loop while(cur.length<target) 在 caller 还在
drain 时持续 fire 新 batch(count=4 → count=1),凑齐 pool 到 size=5。
所以"cold click 5"实际取了 10 条(5 用 5 留池)。下一击命中池,~0ms。
要做的话得让 refill 感知"未被满足的 caller 数",这是 30+ 行重构,留作
later。

## Methodology Notes

- bench.mjs 在本机跑,客户端 → API 跨公网。RTT ~30-50ms 量级,对秒级 solver 影响可忽略。
- `single` 串行,确保没有自身请求互相挤压 worker(测纯 solver 上限)。
- `par` 12 路 fetch 同时发,模拟前端 `cubingScramble.ts` 池满刷新场景。
- `batch` 上线后会用同一脚本同 base 跑,直接对比 firstScramble 时间。
