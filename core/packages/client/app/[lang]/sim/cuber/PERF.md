# /sim setup 性能优化记录

---

# ⛔ perSlab 试过了 — 不走 (2026-05-17)

**实测 perSlab 单 pass 比 flat 慢 4× (N=200: 5s → 20s),回滚不留代码。**

paired 实测 (hash 严格等于 JS path,correctness 都 OK):

| N | flat (ms) | perslab (ms) | ratio |
|---:|---:|---:|---:|
|  50 |  103 |  181 | 1.75× 慢 |
| 100 |  567 | 1069 | 1.89× 慢 |
| 200 | 4963 | 19766 | **3.98× 慢** |

**root cause**: 替换 flat 不是零成本。

- flat: 每 iter 2 random ops (gather + scatter)。32MB → 部分 DRAM hit (~50ns)。
- perSlab single-pass: 每 iter ~6 random ops (vec×3 + slab_flat + posInSlab + slab_count,× 2 axes)。10MB → L3 hit (~10ns)。
- 算账: 6×10 = 60ns/iter > 2×50 = 100ns/iter? 实际更糟,因为还有非 random ops 的常量。net 4× 慢。

**底线: 替换 flat 的方案必须把 ops/iter 控在 ~14 以内** (现 flat ~12)。perSlab 维护开销天然 > 这个。

没试过但理论上可能拉回:
- u16 posInSlab (N≤255 face slab fits): -1.5MB working set
- 3-pass (vec / B / C 分开): 同 ops 但 cache 更友好
- 混合 flat (face) + perSlab (inner): 复杂度爆炸,理论上有戏 (face slab scatter 已经够 localized; inner ring 才是 DRAM hit 大头)

但任何一条想打到 5s → 2s 都不容易。**flat 已经接近 DRAM-bandwidth 极限,纯 CPU 加速很难再拿数量级。**

---

# 🎯 下一阶段交接(给接力 AI)

**目标:N=200 setup 5238ms → 用户感知 < 1s**

CPU 5s 几乎打不动了。换思路:**Web Worker offload,主线程 UI 不卡,perceived latency 0**。

## Web Worker 方向

`Twister.setup` 整个甩到 worker:

```
点 scramble → postMessage(worker, exp)
  ↓ 主线程立刻空闲,60fps 渲染照转
worker 算 5s (主线程感知不到)
  ↓ postMessage 回主线程,带 vec[] + rotIdx[] (transferable ArrayBuffer)
主线程 end sweep + rebuildAll (~400ms,可拆 chunks 用 requestIdleCallback)
  ↓
画面跳到 scrambled 状态
```

总 CPU 还是 5s 但 UI 0 卡顿。

### 已知坑

1. **THREE.js 对象不能跨 worker** (Vector3 / Matrix4 带方法,structured clone 失败)。worker 端只用 SoA typed array (vecX/Y/Z, rotIdx) — 这跟现在 hot loop 已经一致,接口面其实小。
2. **WASM 模块 worker 端单独 init 一次**。`@cuberoot/stack-kernel` 用 `?worker` import 或 worker 内重新 `initStackKernel()`。
3. **end sweep 只能主线程**: sync 回 `cubelet.position` / `cubelet.quaternion` (THREE 对象绑 GPU),不能 worker 改。把 sweep 数据 (vec + rotIdx) transferable 传回主线程批量 apply。
4. **rebuildAll 也只能主线程** (写 GPU buffer)。
5. **scramble parse 留主线程或 worker 都行**,反正小。

### 切口

`Twister.setup` 拆两半:
- `setup_part1(exp)`: 主线程,reset + parse + 准备 vec/rotIdx/groupRegistry typed arrays。
- worker.compute(rotatesDesc, vecXYZ, rotIdx, flat, ...): worker 端跑 kernel loop,return vec + rotIdx。
- `setup_part2(vec, rotIdx)`: 主线程,end sweep + rebuildAll。

异步化:`Twister.setup` 返回 Promise,callers 必须 `await`。**这是 API breaking,需要看 call sites**。`SimPage.tsx` 里点击 scramble 是个 handler,await 没问题。

## 不要走的方向

- perSlab 任何 variant (上面证伪了,除非用户特别要求再 revisit)
- 算法层突破 (cube symmetry 代数解 — 没现成方案,research 级)
- GPU compute shader (工程量大,不值)

## Bench 方法 (沿用)

```js
// playwright eval,N=200,paired A/B:
// 8 samples + 2 warmup,fresh scramble per sample
// 注意:连续多 path setup 在 N=200 容易堆出 Chrome unresponsive,一次一个 path + cooldown
```

scramble 用 `randomMoveScrambleNxN` (20*(N-2) moves, wide notation, prefix 1..N/2)。**不要用 `twister.scrambler()`** — 只生成 9*N moves。

## 文件 / 命令速查

| | |
|---|---|
| WASM kernel | `core/packages/stack-kernel/src/lib.rs` |
| WASM build | `pnpm --filter @cuberoot/stack-kernel build` |
| WASM 入口 (JS) | `core/packages/client/src/pages/sim/cuber/twister.ts` setup() 函数 |
| Dev server | `http://127.0.0.1:5173/sim` |
| Playwright | MCP 已加载,`mcp__playwright__browser_*` |
| Toolchain | rustc 1.95 + wasm-pack 0.15 + wasm-bindgen-cli 0.2.121 (`cargo install wasm-bindgen-cli --version 0.2.121` 装一次) |
| pkg/ 委 git | rebuild 完手动 `git add core/packages/stack-kernel/pkg/` |
| typecheck | `pnpm --filter @cuberoot/client typecheck`(改 .ts 后必跑) |

## 验证

```js
window.__STACK_KERNEL_WASM = false; tw.setup(SC); const a = hash(cube);
window.__STACK_KERNEL_WASM = true;  tw.setup(SC); const b = hash(cube);
assert(a === b);
```

hash: `for (const c of cubelets.values()) h = (h*31 + c._index + (c.quaternion.x*1000|0) + (c.quaternion.y*1000|0)) >>> 0`

## 坑 / 注意

- **wasm-pack rebuild 后 Vite 模块图不一定 invalidate** (Windows + symlink + rename): import 报 "no export X",需重启 dev (`pnpm --filter @cuberoot/client dev`) 救
- **偶数 N 的 half = (N-1)/2.0 = half-integer (99.5 @ N=200)**: vec → layer 必须 `(vec + half_f as f32) as usize`,整数除会错
- **不要做 N=75 优化** (218ms 不是痛点;主目标 N=200)
- **不要碰 Sq1 / Twister.push** (完全不同代码路径)
- **paired bench 必须**: 同 session,不要跨 navigate
- **不要相信纸面预估**: PERF.md 原 perslab 4-7× 预估实测 0.25×,反向。所有改动实测

---

## 项目背景

- 路由 `/sim`(`packages/client/src/pages/sim/`):NxN 魔方 3D 工具,基于 three.js + InstancedMesh
- 上游:port 自 [huazhechen/cuber](https://github.com/huazhechen/cuber),已重写渲染层为 instanced(单 mesh 多 instance),支持 N=2..250+
- 关键概念:
  - **cubelet**:单个小方块,有 `_vector`(当前坐标)、`_index`(position key)、`_instIdx`(GPU instance idx)、quaternion、matrix
  - **slab/slice/group**:一次 rotation 影响的一层 cubelets(`group.indices` 是该 slab 的固定位置集合)
  - **wide move** `kRw`:同时旋转 k 层(k 个 slab)
  - **scramble**:一串 move 字符串,如 `R U' 3Rw2 ...`,WCA 标准长度 = 20·(N-2)
- `Twister.setup(exp)` 是核心:从 solved 状态出发,把 scramble 字符串里所有 move 同步施加到 cube,**画面中间帧不渲染**(只末尾 `instancedRenderer.rebuildAll` 一次写 GPU)
- 跟 `Twister.push(exp)` 区分:push 是给动画播放队列用的,每个 move 慢动画播,完全不同代码路径,**别动**
- 用户场景:点"随机打乱"按钮(`.sim-player-scramble`),N 越大 setup 越慢,N=75 原始 ~9s,N=175 ~3.6s(当前)。优化目标是让大阶魔方打乱后秒出。

入口文件:`packages/client/src/pages/sim/cuber/twister.ts` 的 `Twister.setup` 函数。

## 现状

- N=75 setup CPU 中位数:**9460ms → 251ms**(~38× 加速)
- N=200 setup CPU 中位数(button 路径口径,3960 moves):
  - JS path:**6313ms**(median of 8)
  - WASM kernel:**5303ms**(1.19×,first call 冷启 ~7.5s)
- N=175 setup CPU 中位数:**~3.6s**(历史数据)
- 测试方法:fresh navigate + 1 warmup + 8 samples,取 median;每个 sample 新生成 scramble
- 入口:`packages/client/src/pages/sim/cuber/twister.ts` 的 `Twister.setup`
- WASM kernel 源:`packages/stack-kernel/src/lib.rs`,wasm-pack target web,SIMD 启用但未显式用 v128

## 关键设计

setup 走 logic-only fast path,与 `push`(动画播放)分离:
- 内层循环只更新 cubelet 在 SoA Float32Array 里的 `_vector`
- `_index` / `position` / `quaternion` / `matrix` 全部延迟到末尾 sweep
- 末尾扫一次 `cube.initials` (32k cubelets),sync 回 cubelet 对象 + rebuild GPU buffer
- 中间帧不渲染,所以中间态可以暴力延迟

## 已经成功的尝试

按 commit 顺序,均经 paired Playwright A/B 验证。

### F:`cube.reset` 加 `skipRebuild`
- setup 起手调 `reset` 会 `rebuildAll` 写满 solved 状态的 GPU buffer,但 setup 末尾会再 `rebuildAll` 覆盖
- 加可选参数,setup 传 `true` 跳掉这次
- N=75 中位数:9460 → 7598ms(-20%)
- 改动:`cube.ts` reset 函数

### C:循环里跳 `cubelet.updateMatrix`
- `Matrix4.compose` 约 50 ops × 16M 次调用是绝对热点
- 改成末尾一次 sweep,32k 次调用足够
- N=75 中位数:7598 → 3365ms(-56%)
- 这是**单笔最大提升**

### E:`cube.cubelets` Map → flat array
- 16M 次 `Map.get/set` (~50ns) → typed array indexed access (~5ns)
- 末尾 sweep 时再 sync 回 `cube.cubelets` Map(其它代码依赖)
- N=75 中位数:3365 → 3108ms(-8%,paired A/B 实测 -9%)

### D:`quaternion.premultiply` → integer rotIdx 累加器
- 每 cubelet `quaternion.premultiply(qRot)` ~16 ops + 4 setter callback × 16M 次
- 改成 per-cubelet 0..23 整数 rotIdx(cube symmetry group 24 元素)
- BFS 预算 24 个 quaternion + (24×12) compose 表(Uint8Array)
- 内层:`rotIdx[i] = composeTable[rotIdx[i] * 12 + dispatch]`(1 op)
- 末尾 sweep 时按 rotIdx 从 24-quat 表 set 回 cubelet.quaternion
- N=75 中位数:4288 → 3389ms(-21%,paired)

### H:循环内只更新 `_vector`,其它字段延迟末尾
- `c.position.x/y/z` 写、`c._index = ...` 都从循环里挪走,只在末尾 sweep 算一次
- 内层用 local `newIdx` 直接计算 flat[] 索引,不写回 cubelet
- N=75 中位数:3389 → 2195ms(-35%)

### J:SoA Float32Array 替 `cubelet._vector`
- 内层避免 `cubelet → _vector → x/y/z` 两层对象寻址
- 3 个 Float32Array(visCount) (vecX/Y/Z) indexed by `_instIdx`
- flat 改 Int32Array 存 `instIdx + 1`(0 = empty)
- 末尾 sweep sync 回 cubelet._vector + 其它字段
- N=75 中位数:2195 → 321ms(-85%,**单笔第二大提升**)
- typed array 不仅快(IC 命中率高),还避开 Cubelet 对象隐藏类 polymorphism

### K:预分配 sliceInsts 缓冲
- 之前每 slice `new Int32Array(sliceLen)`,28k slice = 28k 次 alloc
- 提到 setup 顶层 `new Int32Array(N²)` 一次,所有 slice 共用
- N=75 中位数:321 → 251ms(-22%)

### 辅助:bench 基础设施
- `Twister.lastSetupCpuMs` + `lastSetupParts`(finish/reset/parse/loop/rebuild 子时间)
- `PerfOverlay` 显示 "出图 NNNms · setup NNNms"(DEV)
- `window.__sim_stats__` 暴露给 Playwright 自动化
- `window.__STACK_KERNEL_WASM = false` 强制走 JS 路径(WASM A/B 对比用)

### WASM kernel(2026-05-17,N=200 1.19×)
- 新 workspace `packages/stack-kernel/`,Rust + wasm-bindgen,`pkg/` 委进 git
- Kernel 接管 setup 内层 rotate apply loop:rotatesDesc + groupIndicesFlat 一次 JS→WASM 调用
- Per-cube `groupRegistry` 缓存(flat indices + offsets,~3MB @ N=200,WeakMap by cube)
- N=200 paired bench:WASM 5303ms vs JS 6313ms,1.19×,WASM 一致性更好(没 GC stop-world 大尾)
- 实测远低于 PERF.md 原本 4-7× 预估;真因见下面"失败"章节

## 失败的尝试(已 git checkout 回滚,别再试)

### G:cube.reset 内循环重写
- 想法:跳 `new THREE.Euler(0,0,0)` + `updateMatrix`,直接写 quaternion + matrix.elements
- 理论 ~50ms 节省,实测被 ~500ms 测试噪声完全淹没
- 而且直接写 Object3D 内部状态有隐性风险

### I:dispatch switch 提到 slice 外
- 把内层 switch 的 9 cases 分成 9 个特化 loop(每个 dispatch 一个直线代码循环)
- 想法是给 JIT monomorphic 信号
- 实测持平,V8 已对 small switch 优化得很好

### L:vecX/Y/Z 合并成 stride-3 Float32Array
- 想法:同 cubelet 的 (x,y,z) 在同一 cache line
- 实测持平,可能因为 Float32Array IC 已经够快,或 V8 已自动合并访问模式
- 代码可读性反而下降(`vec[i3+1]` vs `vecY[i]`)

### 跳 `quaternion.premultiply` 而不替代
- 早期实验,想看跳掉能省多少
- 但 cube state 会错乱,后续 scramble 在错误状态上叠加导致 setup 反而变慢
- 教训:破坏状态的实验得跑一次就清状态,否则数据骗人

### M:per-slice compose row
- 把 `rotIdx[i] = cubeCompose[rotIdx[i]*12 + dispatch]` 改成预算 24-entry sliceCompose,内层 `rotIdx[i] = sliceCompose[rotIdx[i]]`
- N=200 实测 6087 vs 6062ms (within noise)
- V8 已把 `*12 + dispatch` 当 loop-invariant 优化掉了,改不动

### WASM kernel 1.19× 而不是 4-7×(2026-05-17)
- 最初 naive 实现 9.6s,**比 JS 还慢 60%**
- 加 `unsafe get_unchecked` 跳 bounds check → 5.3s,赢 JS 1.19×
- 为什么离 PERF.md 4-7× 预估这么远:
  - 内层不是 compute-bound 而是 **memory-bandwidth bound**:每 iter 5 random reads + 5 random writes,主要打 `flat[N³]` (32MB @ N=200,远超 L3 cache)
  - 313M iter × ~20ns DRAM 延迟 = 6s,接近实测,跟 runtime 无关
  - SIMD 帮不上忙(wasm SIMD 没 scatter/gather 指令)
  - V8 对 TypedArray hot loop 已经做了大量优化(IC、auto-vec、register allocation),wasm naive 实现纯换语言打不过 V8 JIT
  - PERF.md 原 4-7× 预估假设了 compute bound 工作负载,不适用这里
- 教训:基准前先评估是 memory bound 还是 compute bound,memory bound 工作负载 WASM 换语言收益很小

## 经验教训

1. **变异大,paired A/B 必须**。同 session 内一前一后测试,跨 navigate 跨分钟可能有 1000ms+ 漂移。
2. **CPU-only metric 比 end-to-end metric 稳得多**。`scrambleMs`(end-to-end with paint)噪声 ±10%,`setupCpuMs`(纯同步 CPU)噪声 ±3%。
3. **直接写 typed array 比看似等价的 Vector3 / Matrix4 库调用快得多**,V8 对 typed array 的 IC 优化极好。
4. **Matrix4.compose / Quaternion.premultiply 在 16M 次循环里是绝对杀手**,首要目标是把它们挪出循环。
5. **延迟写入**:循环只更新必需的中间态,其它字段在末尾一次 sweep。N 个独立字段 ⇒ N 个 sweep 都比循环内更新便宜。
6. **诊断比优化更难**:加 sub-timing(finish/reset/parse/loop/rebuild)是单次最有价值的投入,直接告诉你 99.5% 时间在哪儿。

## 当前瓶颈分析(N=75)

```
loop      211ms (84%)
rebuild    21ms  (8%)
end sweep ~16ms  (6%)
reset       7ms  (3%)
parse       3ms  (1%)
finish      0ms
total     ~251ms
```

loop 内每次迭代成本(~13ns):
- 5 typed array reads(vec×3, sliceInsts, rotIdx, cubeCompose)
- 5 typed array writes(vec×3, flat, rotIdx)
- ~10 arithmetic ops(switch dispatch + index 计算)

≈ 40 CPU 周期/iter @ 3GHz。**接近 JS 硬件极限。**

## 后续方向(2026-05-17 后)

按 N=200 实测,memory bandwidth 是硬天花板,前面 PERF.md 写的 WASM 4-7× 那个段落已过期(留作教训档案)。剩下能继续打的:

### -1. 减少 flat 数组打到主存(核心方向)
- 内层每 iter 1 个 `flat[new_pos]` 写,32MB 数组 random scatter,大概率 cache miss
- 思路:换数据结构,把 cubelet identity 维护从 flat 改成"per-slab ordered list"
  - 每个 slab 维护 `cubelet_at_position: indices` 列表(N² 或 4N-4 长)
  - rotation 在 slab 内就是数组旋转(4 个角分组循环交换)
  - 不需要再去 flat 查"这个位置当前是谁"
- 难点:slab membership 一旦旋转就乱了(原本 X-axis 0 层的 cubelet 转 R 后可能挪到 X-axis 1 层),除非 R 永远在 X-axis;但 R 和 U 在不同 axis,数据结构必须支持任意 axis 视图
- 设计复杂,但理论上能从 6s 打到 1-2s

## 后续方向(历史预估,已部分作废)

### 1. 算法层(高 risk / 高 reward)

scramble 是 rotation group 元素,理论上可以代数化解。

**思路 A:per-cubelet 累积变换,延迟应用**
- 维护每个 cubelet 当前的 `rotIdx`(已有)和**累积位移**(没有)
- 每个 cubelet 在每次 rotation 中的位移可以用 rotIdx 间接推:已知 cubelet 在初始位置 P₀,经历过的所有 rotation 复合可以从初始 rotIdx 累加到当前 rotIdx,combined rotation 直接作用在 P₀ 上得到 final position
- 但每个 cubelet 在不同 rotation 里"是否参与"取决于它当前位置是否在某个 slab 里 —— 这是个**位置依赖的**问题,无法纯 rotIdx 累加
- 难点:slab membership 随当前位置动态变化,不能预计算

**思路 B:批量同轴 move**
- 连续同轴 move 可以合并(`R R2` ≡ `R'`),但 random scramble 主动避开同轴相邻 → 应用面窄

**思路 C:rotation group 算子代数**
- WCA 标准 scramble 长度 = 20(N-2),其中每个 wide 是不同 layer + twist 的组合
- 直接 simulate 已经是 O(moves × N²) 最坏,理论下界
- 想突破得改 problem:不再"模拟"而是"直接算 final cubelet positions"。但 random scramble 没有闭式解

**思路 D:增量更新**
- 用户反复点 scramble 时,从上一次状态增量算到新状态,而不是 reset + 全模拟
- 但 reset 本身才 7ms,不是瓶颈
- 不适用第一次 scramble

**结论**:算法层突破有限,主要是 ~2x 而非数量级。

### 2. WASM(中 risk / 中-高 reward)

inner loop 16M 次迭代,WASM 典型 5-10x 于 JS typed array(主要是 SIMD 和分支预测)。

**实现方案**

| 选项 | 优点 | 缺点 |
|---|---|---|
| Rust + wasm-bindgen | 性能最好,Cargo 生态成熟 | 工具链重(Cargo 进 pnpm),new build step |
| AssemblyScript | TS 语法,无新工具链 | 性能不如 Rust,生态小 |
| 手写 .wat / wat2wasm | 最大控制 | 维护难,只适合极小 kernel |

**推荐 Rust + wasm-bindgen,SIMD 启用(`wasm-bindgen --target web` + `-C target-feature=+simd128`)**。

**接口设计**

```rust
// Rust side
#[wasm_bindgen]
pub fn setup_kernel(
  vec: &mut [f32],           // visCount * 3, interleaved
  rot_idx: &mut [u8],        // visCount
  flat: &mut [i32],          // N³
  slice_insts: &mut [i32],   // N² (scratch)
  compose: &[u8],            // 24 * 12, immutable
  // Per-move 输入:
  rotates: &[u32],           // packed: (axis_idx<<2 | t01)
  group_indices_flat: &[u32], // 拍平的每个 group.indices
  group_indices_offsets: &[u32], // 每个 rotate 的偏移 + length
  order: u32,
) {
  // pure compute, 无 alloc
}
```

JS 侧 setup 流程:
1. 准备 typed array views(已有的 vecX/Y/Z 合并成 interleaved)
2. 调一次 `setup_kernel`(传入所有 move 的 RotateAction 数据)
3. 末尾 sweep(JS 侧,跟现在一样)

**预期收益**

- Loop 211ms → 30-50ms(4-7x SIMD + 紧凑代码)
- 加上 sweep + rebuild,total 251ms → ~70-100ms
- N=175:3.6s → ~600-1000ms

**坑**

- 跨边界数据传递:cube.table.convert 输出的 RotateAction 结构要拍平成 typed array 才能传 WASM,这层 marshal 本身有开销
- WASM module load:首次 ~100-200ms,需 cache(IndexedDB or `<link rel=preload as=fetch>`)
- Vite 集成:`vite-plugin-wasm` + topLevelAwait,build/serve 双路径
- 现在 Cubelet.SIZE=64 是 const,WASM 里也要保持一致

**先做实验**:把 inner loop 抽成一个 plain JS function `setupInnerLoop(vec, rotIdx, flat, sliceInsts, dispatch, indices)`,改成"JS impl 和 WASM impl 二选一"的 feature flag,benchmark 对比。这样能 isolate WASM 收益,不用一次性大改。

### 3. WebWorker(低 reward,不推荐)

setup 整个甩 worker 后,主线程画面不卡 → 公式可以更早出现。

但:
- 现在 `setup CPU` 才 251ms,主线程卡 250ms 用户基本感知不到
- worker 跑完还要回主线程 rebuildAll(GPU 操作只能主线程做),省不了多少
- 跨 worker 传 Cubelet/Map 结构复杂
- 不解决 N=175 慢的根本

不建议。

### 4. 进一步 micro-opt(小 reward)

- **M:per-slice 预算 24-element compose row**:内层 `rotIdx[i] = sliceCompose[rotIdx[i]]` 替代 `cubeCompose[rotIdx[i]*12 + dispatch]`。理论省 1 mul + 1 add × 16M = ~10-20ms。**值得做**,改动小风险低。
- **N:压缩 instIdx 编码**:visCount ≤ 65535 时用 Uint16Array(N≤100 范围)。L1 cache 占用减半,可能 ~5-10ms。
- **O:`order2 / half / SIZE` 提到 hot loop 外 const local**:V8 应已优化,但显式不会错。

## 给下一阶段 AI 的接力指南

详见 git log + 本文档。要点:

1. 测试用 N=175(用户要求)
2. dev server 在 127.0.0.1:5173,**不要重启**
3. 用 Playwright MCP 自动化测,paired A/B 必须
4. 每次改动:有提升 → commit;没提升或退步 → `git checkout --`
5. 只动 NxN 相关(`packages/client/src/pages/sim/cuber/`),不动 Sq1
6. commit message 用中文,带前后 median 对比
7. 提交时 Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

推荐顺序:
1. 先做 **M**(per-slice compose row),~15min 工作量,稳妥拿 10-20ms
2. 然后上 **WASM**,这是 N=175 数量级提升的唯一路径
3. 算法层除非有非常具体的洞察,否则跳过
