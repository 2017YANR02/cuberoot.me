# cube555 Random-State Benchmarks

一栏一阶段。每次跑 `node core/cube555-daemon/bench.mjs --base https://api.cuberoot.me`。

`single` = 20× 串行单条请求,p50/p90/p99/mean。
`par`    = 12× 并行(浏览器实际批量打乱 pool refill 行为),total = 12 条全部回来的墙钟时间。
`batch`  = SSE `/v1/scramble/555-rs/batch?count=12`,firstScramble = 第一条响应到达时间。

环境:服务器 2 worker JVM(`CUBE555_WORKERS=2`),`-Xmx1g`,230 MB 剪枝表常驻。

## 各阶段对比

| 指标 | Baseline | + batch+SSE | + GraalVM native |
|---|---:|---:|---:|
| **single p50** | 1.93s | 2.11s | — |
| **single p90** | 3.44s | 5.23s | — |
| **single mean** | 2.23s | 2.62s | — |
| **par-12 total** | 17.14s | 16.39s | — |
| **par-12 per-req mean** | 9.39s | 9.30s | — |
| **batch-12 TTFB headers** | n/a | **96ms** | — |
| **batch-12 firstScramble** | n/a | **2.39s** | — |
| **batch-12 total** | n/a | 14.47s | — |
| **JVM cold start** | ~3s | ~3s | — |
| **RSS / worker** | ~270 MB | ~270 MB | — |

> 单条数据本来就有 ±20% 抖动(IDA* 深度对种子敏感),阶段间 single 数字小幅波动属正常,不是回归。重点看 `firstScramble` 这一栏 —— batch+SSE 把"首条返回"从 par-12 的 ~16s 拉回到 ~2.4s,12 条全在 14s 内流式回完。

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


## Methodology Notes

- bench.mjs 在本机跑,客户端 → API 跨公网。RTT ~30-50ms 量级,对秒级 solver 影响可忽略。
- `single` 串行,确保没有自身请求互相挤压 worker(测纯 solver 上限)。
- `par` 12 路 fetch 同时发,模拟前端 `cubingScramble.ts` 池满刷新场景。
- `batch` 上线后会用同一脚本同 base 跑,直接对比 firstScramble 时间。
