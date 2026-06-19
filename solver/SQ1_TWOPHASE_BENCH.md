# SQ1 两阶段近最优求解器:跨语言基准 + 生成器替换可行性

> 2026-06-18。起因:考虑把 `/scramble/gen` 和 `/timer` 的 SQ1 打乱**生成器**换成我们的 Rust
> (`solver/src/sq1_twophase.rs`)。
>
> **结论先行**:速度上 **Rust ≈ Java(TNoodle),都比 cstimer 的 JS 快约 1.75×**;但
> **「逐字节完全一样」做不到**(§3)。故 **2026-06-18 决定:不改**(cap 留 32,不替换生成器)。

---

## 0. 三个实现

| 实现 | 语言 | `maxlen2`(phase-2 深度上限) | 用途 |
|------|------|------|------|
| **我们的** | Rust(`sq1_twophase.rs`) | `min(32 − length1, 17)` | 从 cstimer JS 逐行移植;曾用于 stats 管道(现已退役) |
| **cstimer** | JavaScript(`scramble_sq1_new.js`) | `min(32 − length1, 17)` | 浏览器计时器出题 |
| **TNoodle** | Java(`cs.sq12phase`) | `min(31 − length1, 17)` | WCA 官方出题(.jar) |

- 三者都是 **cs0x7f 的 sq12phase 两阶段近最优**(踩中第一个完整解即停),**同源不同码**。
- `maxlen2` 已核实:cstimer = **32**(`scramble_sq1_new.js` `Search_solution`),TNoodle = **31**(`Search.java:47`)。
- ⚠️ **`/scramble/gen` 现在实际用的是第三方 cubing.js**(`cubing/scramble`,Lucas Garron;见 `client app/[lang]/scramble/gen/page.tsx`),**既不是 cstimer 也不是 TNoodle**。

## 1. 方法

- 同一批 **81 条真实 WCA SQ1 打乱**(`solver/test_data/sq1_scrambles.txt`),三者解**同一组状态**
  (已验证状态相同:多数解逐字节一致,见 §3)。
- 单线程、warm(JS/Java 先 JIT 预热)、同机。三者都构造**完整解字符串**(对齐口径)。twist(slash)计步。
- 复现脚本曾在 `core/.tmp/sq1bench/`(`.tmp` 会被清,关键复现见 §4)。

## 2. 速度结果(同 81 语料,warm,单线程)

| 实现 | 语言 | `maxlen2` | ms / 解 | 相对 Rust |
|------|------|------|------|------|
| **我们的** | Rust | 32 | **5.74**(solve-only 5.58) | 1.00× |
| **TNoodle** | Java | 31 | **6.00** | 1.05× |
| **cstimer** | JS(Node) | 32 | **10.05** | 1.75× |

- **Rust 只比 Java 快约 5%** —— 基本打平。Java JIT 对这种紧凑整数 / 数组搜索极强;Rust 并没有「碾压」JVM。
- **Rust / Java 都比 cstimer 的 JS 快约 1.7–1.8×**。真正慢的是 JS。
- 把我们的 cap 改成 **31 反而更慢**:实测 **7.23ms**(vs 32 的 5.58ms,慢 ~30%)——phase-2 预算更小 ⇒ phase-1 被推得更深。
- 旁注:`sq1_twophase.rs` 的 `g3_throughput` 测试注释写「≈ cstimer ~2.2×(cstimer ref 12.75ms)」是**旧机器数**;本机实测 cstimer 10.05ms → **~1.75×**。(注释未改,见 §决定。)

## 3. 「完全一样」做不到(关键发现)

把我们的 cap **32 → 31** 想对齐 TNoodle,实测**仍 22 / 81 条不同**(其余 59 条逐字节一致,含 774/775/776):

- **18 条**:我们的 Rust 解**多一刀**(开头一个冗余 slash)⇒ cstimer 端口是个**略差的近最优**;
- **4 条**:解法**完全不同**。

⇒ **`maxlen2` 不是唯一差异。** cstimer 与 TNoodle 在**搜索 / 剪枝**上也有别(例如 TNoodle phase-1 下层 `m >= 6`、phase-2 收尾条件),光改 cap 对不齐。

各实现 81 条 twist 总和(佐证差异 + 状态一致):

| | 我们 (32) | 我们 (31) | TNoodle (31) | cstimer (32, 见注) |
|---|---|---|---|---|
| Σ twist | 946 | 940 | **922** | 930 |

要做到逐字节一致:

| 对标 | 可行性 |
|------|------|
| **TNoodle**(WCA 官方) | 可行,但要把搜索逐步对齐(那 18+4 条),**非平凡,几小时调试级** |
| **cubing.js**(现站) | 不同算法 + 不同 RNG,**基本不可行** |
| 「有效 + 均匀随机 + WCA 记号」即可 | **三者都已满足**,我们的 Rust 现在就行 |

> 而且打乱本就随机生成,**换求解器本来就不会给用户「同一条」打乱**(RNG 不同)。所以对计时器 / 出题,
> **逐字节一致并非必要**,只要每条合法 + 均匀 + WCA 记号即可。

## 决定(2026-06-18)

**不改**:cap 留 **32**,**不替换** `/scramble/gen` 与 `/timer` 的 SQ1 生成器。近最优本身已从 stats 管道 +
前端退役(见 `sq1_twophase.rs` 模块头),代码仅留作对照。若将来要让我们的 Rust 当生成器,要先定对标
(TNoodle = 需对齐搜索;cubing.js = 不可行;或接受「合法但不逐字节同」)。

## 4. 复现要点

- 语料:`solver/test_data/sq1_scrambles.txt`(`id,(x,y) / (x,y) / …`)。三者把 `(x,y)/` 逐步喂给 cube:
  top = `doMove(((x%12)+12)%12)`、bottom = `doMove(-(((y%12)+12)%12))`、slash = `doMove(0)`
  (三者 `doMove` 编码一致;solved = `ul 0x011233 / ur 0x455677 / dl 0x998bba / dr 0xddcffe`,与 Rust `Sq1State` 位等价)。
- **我们的(Rust)**:`cargo test --release --lib g3_throughput -- --nocapture`(吞吐);逐条解 = `solve_with_solution`。
- **TNoodle(Java 21)**:编译 `/d/cube/tnoodle-lib/sq12phase` 的 `cs/sq12phase/*.java`
  (`Shape.java` / `Square.java` 去掉 `org.slf4j` 的 import + logger 字段 + `logger.debug` 共 ~3 行,否则缺依赖)
  + harness:`new Search().solution(cube, 0)`。
- **cstimer(JS,Node)**:`scramble_sq1_new.js` 是 IIFE,需提供全局 `mathlib{setNPerm,getNPerm,circle,rn}`
  (n=8 标准 Lehmer 即可,自洽)+ `scrMgr{reg}` + `$ {noop}` 桩;`SqCubie` 已导出,把内部
  `Search_solution(search, c)` 暴露出来即可解指定 cube。
  ⚠️ 替代 mathlib 让解**不与线上 cstimer 逐字节同**(Σ 930 ≠ 端口 946),但**搜索工作量一致,速度有代表性**。
