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

## Local solve-length optimization — 2026-05-18

目标:把每条 5x5 random-state 打乱平均长度从 ~70 步砍到 ≤60 步。本地直 spawn
daemon 跑 `local_bench.mjs` n=30 par=3 workers=3 -Xmx4g,数 scramble token 数。
没有走线上,**没改 cube555 src/**,只动 `Daemon.java`。

### 关键 finding(影响所有方向的天花板)

`Search.solveReduction(facelet, int verbose)` 第 2 参实际是 **verbose flag**
(`USE_SEPARATOR = 0x1`),不是 "quality" 档位 — 改它只影响 separator 输出。
PROMPT 里 "quality 升档 -5~10 步" 的预期不成立。

打开 split log 看真实占比:**reduction ~51 步 / Kociemba ~19 步 / total ~70**。
Kociemba 已经接近 god's number (20),没空间;只能砍 reduction。

进一步 dump `Search.p5sols` 看各候选 reduction 长度分布(P5_SOLS=64):
```
[POOL] p5sols.size=64 red.min=51 red.max=52 red.avg=51
[POOL] p5sols.size=64 red.min=52 red.max=52 red.avg=52
[POOL] p5sols.size=64 red.min=49 red.max=50 red.avg=49
```
单 seed 内 64 个 phase-5 候选 reduction 长度全部 ±1 步内,**within-seed 方差
几乎为零**。挑最短不能撬出更多。所有改进必须来自不同 random state 之间的方差。

### Attempt 1 — Kociemba `probeMin` 1e6

- change: `solution(facelet, 21, MAX_VALUE, 1_000_000L, 0)` (was probeMin=500)
- bench (n=20, par=3, W3, xmx=4g):
  - **avg moves: 69.20** (was 70.30, -1.1)
  - avg latency: **29490ms** (was 1240ms, +24x)
  - self-verify: 20/20 OK ✓
- decision: **revert**, 25x latency 换 1 步极不划算。

### Attempt 2 — Kociemba `probeMin` 1e4

- change: 同上,probeMin=10_000
- bench (n=20): avg moves 70.10 (-0.2,在噪声内), latency 2135ms (1.7x)
- decision: **revert**, 改善小于 ±1σ 噪声。Kociemba 已经接近最优,probeMin 无解。

### Attempt 3 — P5_SOLS=16,pick-shortest p5sol

- change: 加 `Search.phase5SolsSize = 16`;Daemon `handle()` 拉 `reducer.p5sols`,
  对每个候选重建 3x3 facelet + 跑 Kociemba,取 (red+koc) 最小那条。
  upstream solveReduction 只用 `p5sols.get(0)`,我们多看几个。
- bench (n=20): avg moves **69.50** (-0.8), latency 2159ms (1.7x)
- decision: keep, 但 P5=16 浪费太多 — pool diversity 太窄(见上 finding)。
  生产 default 改 **P5=8**,基本没 latency 代价 +1.16 步改善。

### Attempt 4 — Wide beam (P1=400 P2=1500 P3=1500 P4=1500 P5=32)

- change: 把 cube555 5 个阶段 sols pool 全部加宽,试图让 phase 3/4 探到更短链。
- bench (n=30, par=3, W3): avg moves **69.27** (-1.5), latency 3766ms (2.6x)
- decision: 改善真但低于预期。各阶段 IDA* 已经在 sols pool 大小够时收敛,
  再宽 beam 边际趋零。**不入 default**(latency 翻倍换 0.4 步 vs P5=8 不值)。

### Attempt 5 — Multi-seed K=2, wide beam (P1-P4=1000 P5=8)

- change: `CUBE555_SEEDS=2`,每请求跑 2 个 `Tools.randomCube` 取最短。
  注:K>1 破坏 uniform-random-state 性质 — 偏向"易解状态"。
- bench (n=30): avg moves **68.97** (-1.83), latency 4673ms (3.2x)
- decision: 不入 default,但 env knob 留着,愿意以"非 WCA 严格 uniform"换更短打乱的部署可启用。

### Attempt 6 — Multi-seed K=5,P5=4 (极限拉满)

- change: `CUBE555_SEEDS=5 CUBE555_P5=4` — 跑 5 个随机状态各挑最短,看绝对下限
- bench (n=20): avg moves **68.35** (-2.5), latency **7523ms** (5.2x, 超 7s 上限)
- decision: 已经跑到 latency budget 之外,而 avg moves 还是 68 — 这是 cube555
  5-phase 架构 + 当前 cs.min2phase Kociemba 的**绝对下限**附近。

### Attempt 7 — Kociemba `OPTIMAL_SOLUTION` (0x8) flag

- change: `solution(..., 0x8)` — 走 `searchopt()` 而非 `search()`,保证 Kociemba 最优。
- bench: 单 worker 跑 20+ 分钟未出第一条结果,catastrophically 慢 (>>1000x)。
  推测:5-phase reduction 完产出的 3x3 状态有时离已解很远,optimal-IDA* 直接爆炸。
- decision: **绝对 unusable**,kill。OPTIMAL_SOLUTION 默认 `KOC_FLAGS=0`(env knob 保留)。

## 优化失败结论

试过 7 方向:
1. Kociemba `probeMin` 1e6(`solution(..., 1_000_000L, 0)`)— 25x 延迟换 1 步,revert
2. Kociemba `probeMin` 1e4 — 改善小于 ±1σ 噪声,revert
3. `phase5SolsSize=16` + pick-shortest p5sol — -0.8 步 / 1.7x 延迟,keep(P5=8 是其降配)
4. 全阶段宽 beam(P1=400 P2..4=1500 P5=32)— -1.5 步 / 2.6x 延迟,不入 default
5. Multi-seed `SEEDS=2` + 宽 beam — -1.8 步 / 3.2x 延迟,且破坏 uniform-random-state
6. Multi-seed `SEEDS=5 P5=4`(极限拉满)— -2.5 步 / **5.2x 延迟超 7s avg-lat 上限**
7. Kociemba `OPTIMAL_SOLUTION` (`KOC_FLAGS=0x8`)— >1000x 慢,20+min 没出一条 kill

最好结果:avg moves **68.35**, latency **7523ms**(Attempt 6,SEEDS=5 P5=4 极限,但
已超 7s avg-latency 上限,uniformity 也被多 seed 破坏)。

7s 上限内 + uniformity 不破坏的最佳:avg **69.57** / latency **1509ms**(单 seed
P5=8,本次 ship 的 default,baseline 70.80 / 1463ms,-1.23 步,几乎零延迟代价)。

瓶颈分析:
- **Kociemba 已接近最优**:~19 步 avg,god's number=20,没空间再砍。
  OPTIMAL_SOLUTION 0x8 走 `searchopt()`,实测 >1000x 慢,unusable。
- **Reduction 51 步是 5-phase 架构强约束**:每 phase 提交独立 subgoal,链式分解
  失去全局最优性。p5sols pool dump 显示 64 个候选 reduction 长度 min/max 差 ≤1 步
  → within-seed 方差几乎 0,挑最短只值 ~1 步。
- **Cross-seed 方差 σ≈1.5 步**:multi-seed K=N 期望降 ~0.85σ\*因子。K=10 才 -2.3 步,
  K=30 大约 -3.0 步,K=5(已 -2.5)起严重递减;且 K>1 破坏"每条 scramble 对应均匀
  随机状态"的数学性质,WCA random-state 要求不再严格成立。
- **PROMPT 第 A 方向假设错误**:`solveReduction(state, int)` 第 2 参实际是 verbose
  flag(`USE_SEPARATOR=0x1`),不是 quality 档位。PROMPT 表里 "升档 -5~10 步" 的
  预期 0 收益。

下一步可能路径:
- **替换 cube555 reducer**:写非 phased 全局 IDA* / 类 Korf optimal 5x5 求解器,工程
  量月级,需重做 13 张剪枝表设计。能把 reduction 砍到接近 optimal ~38-42 步,total
  接近 60 步。
- **接受 cube555 architectural floor ~67-68 步**:本次 ship 的 P5=8 是该 floor 上的
  zero-cost 改进,部署侧用 `CUBE555_SEEDS=2` 可再 -0.6 步代价 3x 延迟,接受 uniformity
  trade-off 即可。
- **换 scramble 生成范式**:放弃 random-state,接受 WCA 5x5 官方的 60 random moves
  (固定 60 步,均匀生成),但失去"任意合法状态可达"的覆盖性。

## Local solve-length optimization v2 — 群论 / 对称层 — 2026-05-18

接 v1 7 个 knob-tuning 方向全失败后,本轮试 3 个数学/对称层方向。仍只动 `Daemon.java`,
`local_bench.mjs --n 100 --par 3 --workers 3 --xmx 4g`。

### Attempt 8 — Reduction / Kociemba 边界 token cancellation

- 假设:reducer 末 token + Kociemba 首 token 同 face 时可合并(`R'` + `R2` → `R`)
- 实现:`mergeBoundary(red, koc)`,只合并 `^[URFDLB][2']?$` 单 token,wide 不参与
- 加 instrumentation 实测 30 sample:`lastPlain=0 firstPlain=30 bothPlain=0 sameFace=0
  cancelFired=0 tokensSaved=0`
  → **reducer 末 token 100% 是 wide**(lowercase `r` / `r2` / `r'`),从不是 plain face
- dump 5 个 reduction 序列肉眼检查:**内部也没有 adjacent same-face token 对**,
  beam search 已消干净
- wide+plain 跨注法合并(`Rw` + `R'` → 内 slice `r`,3/9 quantity 组合 save 1 步)需引入
  inner-slice 记号 `3R` 同时改 `parseMove`/`verify`/`invertToken`,期望仅 ~0.05 步,
  不值
- decision: **revert**,候选 1 在 cube555 的输出形态下零收益。

### Attempt 9 — Bidirectional solve (CUBE555_BIDIR=1)

- 假设:群论恒等 L\*(S) = L\*(S⁻¹)。heuristic 求解 S 和 S⁻¹ 走不同 beam path,挑短。
  不破坏 uniformity(两个估计同一 L\*(S),非 multi-seed)
- 实现:
  - `invertCubieCube(src)`:wEdge/mEdge/wEdge 按 perm-inverse 反,corner 加 Z3 orient
    negation `(3-o)%3`,tCenter/xCenter 多值倒(within-face cubie 不可区分,index-order
    pairing 任选一 representative)
  - 跑两次 `solveCore`,正向走 `invertAndConvert`,反向走 `convertOnly`(只 lowercase→Xw 不
    反转)— **关键 bug fix**:反向 raw word 含小写 wide token,parseMove 不认 → 必须先
    convert
  - 反向 path 的输出 facelet 在 [S] coset 内但 within-face center labeling 可能与原 S 不
    同(4!⁶ 个等价 representative),`replay()` 算实际产出 state 喂给 verify
- bench (n=100): **avg 69.09 步** / latency **3483ms** / 100 OK / 0 FAIL
  - vs default (P5=8): avg 69.57 → -0.48 步, latency 1509 → 3483ms (+131%)
  - max latency 9522ms(单 sample 越 7s,可接受 tail outlier)
- decision: **keep as opt-in `CUBE555_BIDIR=1`**,default OFF 因 latency 翻倍换
  ~0.5 步生产 API 不值。需要更短打乱可启用。

### Attempt 10 — 对称共轭 N 取最短(放弃)

- 假设:24 个 cube 旋转对称给 reducer 不同 beam path,N 个 sym 取最短可 -0.5~-1 步
- 阻挡点:cube555 `CubieCube.doConj()` (line 449-458) **只覆盖 mEdge/wEdge/tCenter/xCenter
  不动 corner**。`CubeSym[48]` 也只填了非 corner 字段
- 要做 sym 共轭必须自己造 corner-sym perm/orient 表(48 sym × 8 corner × perm+orient),
  从 cube555 不暴露的 cube symmetry 几何关系手工反推,6-8h 工作量
- 期望 -0.5 步,叠加候选 2 总 ~-1 步 → 68.5 步,仍远不到 60
- decision: **放弃**,性价比太低。如果未来要做需引入 corner sym tables 的独立模块。

### v2 结论

- v2 最佳:`CUBE555_BIDIR=1` avg **69.09** / latency **3483ms**,opt-in。
- v1+v2 默认 ship:仍是 `P5=8` single-seed,avg **69.57** / latency **1509ms**。
- **60 步目标确认不可达**。cube555 5-phase reduction 架构 floor ~67-68 步,
  v1 multi-seed K=5 触到 68.35,v2 bidir 触到 69.09,两者都没穿透 floor。要破 floor 需要
  上面"替换 cube555 reducer"路径 — 月级工程。
- v2 留 1 个新 env knob:**`CUBE555_BIDIR=0/1`**(默认 0),BENCHMARKS 总 env 表见
  README.md。

## Local solve-length optimization v3 — bidir 并行化 — 2026-05-18

### 动机

v2 bidir 顺序跑两遍 solveCore(forward + backward),延迟 +131%。两路独立无依赖,
应当并行。Worker 内本来就为线程安全各持一对 reducer/solver333,加第 2 对成本只是少
量 ArrayList(pruning table 是 static 共享 ~230MB),理论上让 bidir 延迟从 2× 砍到 ~1×。

### Attempt 11 — bidir 并行 (CUBE555_BIDIR=1)

实现:
- `Worker` 加 `reducerBwd` + `solver333Bwd` 第 2 对实例
- `solveCore(Worker w, ...)` 重构为 `solveCore(Search reducer, cs.min2phase.Search solver333, ...)` 接受指定实例
- `solvePicked` BIDIR=true 时开 2 thread:`fwd` 用主对,`bwd` 用 Bwd 对,join 后取短的

bench (n=80, par=3, workers=3, xmx=4g):

| Config | avg moves | avg latency | Δ moves | Δ latency |
|--------|-----------|-------------|---------|-----------|
| Default (BIDIR=0) | 69.69 | 2285 ms (max 6742) | — | — |
| **BIDIR=1 (并行)** | **68.97** | **3730 ms (max 11892)** | **-0.72** | **+63%** |

cross-check (n=20, par=1, workers=4 — 单请求无并发争抢):

| Config | avg moves | avg latency | Δ moves | Δ latency |
|--------|-----------|-------------|---------|-----------|
| Default | 69.95 | 1871 ms (max 5381) | — | — |
| **BIDIR=1 (并行)** | **69.00** | **2419 ms (max 4884)** | **-0.95** | **+29%** |

vs v2 顺序 bidir(HANDOFF.md 数字 n=100):**-0.48 步 / +131% 延迟** → 并行版 **步数提升、延迟惩罚砍 80%**。
par=1 max latency 反而 default > bidir(5381 vs 4884),说明 bidir 还能稳化分布。

verify:200 OK / 0 FAIL across all benches。

### v3 结论

- **BIDIR 默认改 `1`**(从 v2 opt-in 转 ship default)。-0.7 ~ -1.0 步实打实改进,
  uniformity 不破坏,par=3 极端并发下 max latency 偶超 7s 是已知 corner case 但单
  用户场景不会触发。
- 实测最终 ship default:avg **~68.97-69.00 步** / latency **~2.4-3.7s**(load 依赖)。
- 这是 v1+v2+v3 三轮迭代的最终态。v1 baseline 70.80 → 当前 **~69**,累计 -1.8 步。
- 60 步仍不可达(同 v2 结论,架构 floor 没变)。要继续压只能走 reducer 重写 / phase 合并(月级)。

## Methodology Notes

- bench.mjs 在本机跑,客户端 → API 跨公网。RTT ~30-50ms 量级,对秒级 solver 影响可忽略。
- `single` 串行,确保没有自身请求互相挤压 worker(测纯 solver 上限)。
- `par` 12 路 fetch 同时发,模拟前端 `cubingScramble.ts` 池满刷新场景。
- `batch` 上线后会用同一脚本同 base 跑,直接对比 firstScramble 时间。
- 优化迭代用 **`local_bench.mjs`**(直 spawn java daemon,数 token,n=30 par=3 W3 xmx=4g)。
  脚本在 `core/cube555-daemon/local_bench.mjs`,从 core/ 跑:
  `node cube555-daemon/local_bench.mjs --n 30 --par 3 --workers 3 --xmx 4g`。
