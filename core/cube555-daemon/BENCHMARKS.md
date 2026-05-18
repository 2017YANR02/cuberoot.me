# cube555 Random-State Benchmarks

一栏一阶段。每次跑 `node core/cube555-daemon/bench.mjs --base https://api.cuberoot.me`。

`single` = 20× 串行单条请求,p50/p90/p99/mean。
`par`    = 12× 并行(浏览器实际批量打乱 pool refill 行为),total = 12 条全部回来的墙钟时间。
`batch`  = SSE `/v1/scramble/555-rs/batch?count=12`,firstScramble = 第一条响应到达时间。

环境:服务器 2 worker JVM(`CUBE555_WORKERS=2`),`-Xmx1g`,230 MB 剪枝表常驻。

## 各阶段对比

| 指标 | Baseline | + batch+SSE | + GraalVM native |
|---|---:|---:|---:|
| **single p50** | 1.93s | — | — |
| **single p90** | 3.44s | — | — |
| **single mean** | 2.23s | — | — |
| **par-12 total** | 17.14s | — | — |
| **par-12 per-req mean** | 9.39s | — | — |
| **batch-12 firstScramble** | n/a | — | — |
| **batch-12 total** | n/a | — | — |
| **JVM cold start** | ~3s | — | — |
| **RSS / worker** | ~270 MB | — | — |

> 单条 mean 高于预期(理论 ~1.5s),说明现在 server 上即便单串行也有抖动(p99 = 3.7s),不是负载导致 —— 后面 `+native` 看是否稳定。

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


## Methodology Notes

- bench.mjs 在本机跑,客户端 → API 跨公网。RTT ~30-50ms 量级,对秒级 solver 影响可忽略。
- `single` 串行,确保没有自身请求互相挤压 worker(测纯 solver 上限)。
- `par` 12 路 fetch 同时发,模拟前端 `cubingScramble.ts` 池满刷新场景。
- `batch` 上线后会用同一脚本同 base 跑,直接对比 firstScramble 时间。
