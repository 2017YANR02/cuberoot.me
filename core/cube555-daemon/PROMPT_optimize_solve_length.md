# 任务:优化五阶魔方求解器的打乱步数(本地版)

## 背景

`cuberoot.me` 提供 5×5 随机状态打乱。数学做法:在 2.27 × 10⁷⁴ 个 5×5 合法状态里
均匀采样,**求解器算出从复原态到该状态的步骤,反序输出**作为打乱。求解器是
cs0x7f/cube555,5-phase reduction + 末段 Kociemba two-phase。

**现状**:平均输出 **~70 步** / 条。

**目标**:把每条打乱平均长度降到 **≤ 60 步**,理想 ~55。

## 全程本地,不动 CI 不动服务器

- 你**本地有 cube555 源码** clone 在 `D:\cube\cube555\`(只读,不要改里面)
- 改我们自己的 `Daemon.java`(`D:\cube\cuberoot.me\core\cube555-daemon\Daemon.java`)
- 内存上限 **10 GB**(物理 32GB,放心用 `-Xmx10g`)
- **磁盘紧!**`C:` 只剩 ~13 GB,`D:` 剩 ~24 GB。一次 cold-build 落盘 230MB 表
  到 `D:\cube\cube555\Phase*.j*data`(只做一次,后续复用)。**别在 C:\ 上
  build,别留 native-image 几 GB 临时文件。**
- **不需要 `git push`**,不需要服务器,不需要 GraalVM。普通 JDK 直接跑。

## 准备(只做一次)

```pwsh
# 1. 验证 JDK
java --version       # 需要 11+,21 最稳

# 2. 把 Daemon.java 拷进 cube555 source tree
copy "D:\cube\cuberoot.me\core\cube555-daemon\Daemon.java" "D:\cube\cube555\example\Daemon.java"

# 3. 编译 (Windows 用 ; 当 classpath 分隔符)
cd D:\cube\cube555
mkdir dist -Force
javac -d dist -cp "lib/twophase.jar" src/*.java example/Daemon.java

# 4. 首次启动: cold-build 13 张剪枝表 (~5 分钟, 落盘到 D:\cube\cube555\*.j*data)
#    成功标志:emit "READY\t<N>" 到 stdout
echo QUIT | java -Xmx2g -cp "dist;lib/twophase.jar" cs.cube555.Daemon
```

剪枝表落盘后,后续启动 ~3s 从盘 reload,**不会再 cold-build**。

如果 D:\cube\cube555\ 已有 `.jpdata` / `.jhdata` 文件,跳过步骤 4。

## 关键文件

```
D:\cube\cuberoot.me\core\cube555-daemon\
  Daemon.java           # ★ 主战场, 改这里
  BENCHMARKS.md         # ★ 每轮 bench 数据落地
  README.md             # 协议说明

D:\cube\cube555\
  src/Search.java       # ★ 看 solveReduction 签名 (只读)
  src/*.java            # cube555 上游, 别动
  lib/twophase.jar      # Kociemba 求解器 jar
  Phase*Prun.j*data     # 13 张剪枝表 (cold-build 产物, ~230MB, 别删)
  dist/                  # 你的 javac 输出
```

## 协议(改 Daemon.java 时别破坏)

stdio 行协议,**id-tab-分隔**:

```
启动:    emit "READY\t<workers>" 到 stdout
请求:    一行 id (任意字符串)
响应 OK: "<id>\t<scramble>\t<source_state>\tOK"
响应 FAIL: "<id>\t<scramble>\t<source_state>\tFAIL"  (self-verify 没过)
响应 ERR: "<id>\tERROR\t<class>:<msg>"
退出:    一行 "QUIT"
```

`OK` 必须通过 round-trip self-verify(用 CubieCube 模拟 scramble 应用到复原态,
facelet 等于 source_state)。**改完不能让 OK 变 FAIL**,否则就是 bug。

## 可动的方向(按代价排序)

### A. solver 调用参数(Daemon.java 里改)

看 `Daemon.java` 第 87-94 行 `handle()`:

```java
String state = Tools.randomCube(w.rng);
String[] ret = w.reducer.solveReduction(state, 0);    // ← 第二参 = quality
String solve333 = w.solver333.solution(ret[1], 21, Integer.MAX_VALUE, 500, 0);
//                                            ↑     ↑                  ↑
//                                            maxL  probeMax           timeout(ms)
```

- `solveReduction(state, quality)`:第二参档位。先看 `D:\cube\cube555\src\Search.java`
  里 `solveReduction` 签名接受什么(0/1/2 或更高?)。试更高档,看步数 / 耗时
  trade-off。
- `solution(facelet, maxL, ...)`:Kociemba 最大步数。21 = 神之数+1。试 18/19/20,
  fail 时 retry maxL=21 兜底。
- `probeMax` (MAX_VALUE) 和 `timeout` (500ms) 是搜索深度上限,加大可能换更短解。

### B. Multi-seed 选最短

每个请求里跑 K 个 `randomCube + solveReduction + solution`,**保留步数最少**那条。

- K=3 经验上能砍 ~5 步,但需要实测
- 注意 `Search` / `min2phase.Search` 实例 **不可重入** —— 每 seed 用同一 Worker
  内的实例串行复用即可
- 时间成本 K 倍,但 daemon 内 worker 并行,**多 worker 时整体 throughput 不变**

### C. Reduction 末态 + Kociemba 联合优化

Phase 1-4 reduction 完产出一个 `ret[1]`(reduction 末态 facelet),Kociemba 从这
起。如果能枚举多个 reduction 末态候选(末态稍微不同),Kociemba 部分可能因为
"更友好"的局面缩短 3-5 步。需要看 `src/Search.java` 的 solveReduction 是否能
返回多个候选。**深度大,后做。**

## 怎么测(必跑)

写一个 Node bench 脚本,直接 spawn 本地 daemon,扔 30 条请求,数 scramble 的
move count,输出 avg / median / 耗时。

参考脚本(放 `D:\cube\cuberoot.me\core\cube555-daemon\local_bench.mjs`):

```javascript
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';

const N = 30;
const HOME = 'D:\\cube\\cube555';
const CLASSPATH = 'dist;lib/twophase.jar';

const proc = spawn('java', ['-Xmx10g', '-cp', CLASSPATH, 'cs.cube555.Daemon'], {
  cwd: HOME,
  env: { ...process.env, CUBE555_WORKERS: '3' },
});
const rl = createInterface({ input: proc.stdout });
const pending = new Map();
const lats = [];
const moveCounts = [];
let nextId = 1;
let ready = false;
const t0 = performance.now();

rl.on('line', (line) => {
  if (!ready) { if (line.startsWith('READY')) ready = true; sendNext(); return; }
  const [id, ...rest] = line.split('\t');
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  const lat = performance.now() - p.start;
  const [scramble, , tag] = rest;
  if (tag === 'OK') {
    const moves = scramble.trim().split(/\s+/).length;
    moveCounts.push(moves);
    lats.push(lat);
  } else {
    console.error('FAIL/ERR:', line);
  }
  if (moveCounts.length + 1 < N) sendNext(); else proc.stdin.write('QUIT\n');
});
proc.stderr.on('data', (d) => process.stderr.write(d));
proc.on('exit', () => {
  const sorted = [...moveCounts].sort((a,b)=>a-b);
  console.log(`\nn=${moveCounts.length}`);
  console.log(`moves: avg=${(moveCounts.reduce((a,b)=>a+b)/moveCounts.length).toFixed(1)} median=${sorted[Math.floor(sorted.length/2)]} min=${sorted[0]} max=${sorted[sorted.length-1]}`);
  console.log(`latency: avg=${(lats.reduce((a,b)=>a+b)/lats.length).toFixed(0)}ms median=${(lats.sort((a,b)=>a-b)[Math.floor(lats.length/2)]).toFixed(0)}ms`);
  console.log(`total wall: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
});

function sendNext() {
  const id = `q${nextId++}`;
  pending.set(id, { start: performance.now() });
  proc.stdin.write(id + '\n');
}
```

跑:`node cube555-daemon/local_bench.mjs`(从 `core/`)。

第一次跑会看到 ~3s 启动(table reload),然后 30 条 sequential。

**单次 bench n=30,看 avg moves。**

## 工作流

每轮:

1. 改 `Daemon.java`
2. `cd D:\cube\cube555 && javac -d dist -cp "lib/twophase.jar" example/Daemon.java`
   (只重编 Daemon,其他 .class 缓存)
3. `cd D:\cube\cuberoot.me\core && node cube555-daemon/local_bench.mjs`
4. 看 `avg moves`、`latency`、有没有 FAIL/ERR
5. 写一段进 BENCHMARKS.md(见下方 schema)
6. **如果改善** → git commit(commit 不 push,user 设的规矩),继续下一轮
7. **如果没改善** → 决定 revert 或换方向,记录尝试

## BENCHMARKS.md 追加格式

每次跑完,追加这样一段到 `core/cube555-daemon/BENCHMARKS.md` 末尾:

```markdown
### Attempt N — <一句话改动>

- commit: <sha 或 "未 commit, 测试中">
- change: solveReduction(state, **2**) (was 0) — 提高 reduction quality
- bench (n=30, local java -Xmx10g, workers=3):
  - **avg moves: 64.3** (was 71.2, -6.9)
  - median moves: 64
  - min/max: 58/72
  - avg latency: 3120 ms (was 1480 ms, +110%)
  - wall total: 38.5 s
- self-verify: 30/30 OK ✓
- decision: keep — 步数显著降, 耗时翻倍但仍 < 7s 上限
```

## Stop 条件(必须遵守 — 防死循环)

### 成功停止

`avg moves ≤ 60` && `avg latency ≤ 7000ms` && `self-verify 100% OK`

写一段最终结论 + commit,结束。

### 放弃停止

如果连续 **5 个**不同方向(不是 5 次相同方向调参)都没把 avg moves 砍到 60 以下,
停。在 BENCHMARKS.md 写一段:

```
## 优化失败结论

试过 5 方向: <列表>
最好结果: avg moves <X>, latency <Y>ms
瓶颈分析: <你的判断>
下一步可能路径: <比如 "动 cube555 内部 phase 顺序, 月级工程">
```

然后 commit + 结束。

### 即时回滚条件

下面任一条件触发,**当前改动立刻 git revert**,不要叠加新改动:

- self-verify FAIL/ERR > 1/30
- avg latency > 10000 ms(超出 7s 上限 + 50%)
- daemon 启动报错或 OOM
- avg moves 没改善但 latency 涨 > 2x

## 不动的东西

- `core/packages/client/**`(那是前端,跟 solver 步数无关)
- `core/packages/server/src/**`(那是 Hono spawn 逻辑)
- `D:\cube\cube555\src\*.java`(上游 cube555,不是本仓库的)
- `Phase*.j*data` 剪枝表(BFS 算的,跟当前任务无关)
- `core/cube555-daemon/native-image/`(GraalVM 元数据,本地不用)
- `.github/workflows/cube555_native.yml`(CI 不用)

## 一些 cube555 内部线索(可选读)

- `src/Search.java`:`solveReduction(String facelet, int level)` 实际接受的 level
  范围在这定义。
- `src/Search.java` 的 `init()` 触发 13 张 prun 表 load(daemon 启动时已跑)。
- min2phase 来自 `lib/twophase.jar`(`cs.min2phase.Search`),`solution()` 完整签名
  可以 `javap -p -cp D:\cube\cube555\lib\twophase.jar cs.min2phase.Search`。

## 几个易踩的坑

1. **Java classpath 分隔符**:Windows 是 `;`,Linux/Mac 是 `:`。**Windows 上 pwsh
   命令一定用 `";"` 包起来**:`-cp "dist;lib/twophase.jar"`。否则 `;` 被 shell 当
   命令分隔符,classpath 解析错。
2. **Daemon.java 拷贝**:每次改 `core/cube555-daemon/Daemon.java`,记得拷到
   `D:\cube\cube555\example\Daemon.java` 再 javac。或者用 symlink。
3. **stderr 噪声**:cube555 内部 Logger 会打很多 phase 时间到 stderr,不是 bug,
   忽略就好。bench 脚本里把 stderr 转发到本地 stderr 即可。
4. **Worker 不可重入**:同一 `Worker` 内的 `reducer` 不能并发用,但**不同 Worker
   实例**之间可以并行(daemon 内部 ExecutorService + ArrayBlockingQueue 已经管好)。
   你只在 `handle(id)` 内部串行用 worker.reducer 就行,别在 handle 里再开线程。
5. **磁盘**:`D:` 剩 ~24GB,够。但**不要把测试日志或 dump 文件写 C:\Users 下面**
   (C: 只剩 13GB)。bench 输出走 stdout 就行,不落地。

## 初始建议路线(按数据走,不机械执行)

| # | 改动 | 预期效果 | CI/本地 |
|---|---|---|---|
| 1 | `solveReduction(state, **2**)` quality 升档 | -5~10 步, +50-100% 延迟 | 本地 ~10s |
| 2 | Kociemba `solution(..., 19, ...)` + fail retry 21 | -2~4 步, 偶尔慢 | 本地 ~10s |
| 3 | Multi-seed K=3 in `handle()` | -3~5 步, 3x 延迟 | 本地 ~30s |
| 4 | A1 + A2 + B1 combined | 综合 -8~15 步 | 本地 ~40s |
| 5 | (探索 C 方向 OR 宣告极限) | — | — |

每改完跑 bench → 看数据 → 决定下一步。**不要不看 BENCHMARKS 就连续 push 3 个改
动。**

## 给你的承诺

用户已经外出,可以放心自主决策。前面 session 已经把:
- 服务端 SSE batch endpoint(`X-Accel-Buffering: no` 防 nginx buffer)
- GraalVM AOT native binary
- 客户端 pooledScramble 冷路径修(17.6s→9.69s)

跑完了。**那些跟当前任务无关**,不要去重做或质疑那些方向。当前任务**只是 solver
内部步数优化**,改 Daemon.java 那 5 行调用。

加油 —— 跑完 commit,该停就停。
