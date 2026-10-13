# 可复现的小表坐标差分

`verify-coordinates.mjs` 加 `examples/verify_coordinates.rs` 将早期 `.tmp` 检查固定为仓库入口。两者都通过 `CUBEOPT_VARIANT=1..9` 选档，默认 1。Rust example 无新增依赖，只加载该档不足 1 MiB 的小表；JS 复用 `variants.mjs` 的原版摘要、地址及容量，校验来源和完整覆盖，将已有 JSON 转为 stdin TSV。入口不实例化 WASM、不加载 PDB、不调用搜索，也不自动编译或生成输入。

输入来自同目录 [oracle.mjs](oracle.mjs) 的小表及原查询导出；这些导出仍由主流程统一安排监控。需要 `small-memory.bin`、`small-tables.json`、`fixtures.json`、`physical-verification.json` 和与 fixture SHA-256 严格绑定的 `hot-query.json`。`physical-verification.json` 必须来自该档 `verify-small` 的独立 cubing.js 模型检查；本入口读取和绑定该证据，不隐式再跑模型。原 WASM/包装摘要逐档固定，输入/输出不能以另一版快照静默替代；报告路径必须不存在。

从仓库根目录构建验证 example：

```sh
cargo build --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml --example verify_coordinates
```

已有本轮输入时，从仓库根目录运行：

```sh
node solver/experiments/cube48opt-rust/verify-coordinates.mjs \
  solver/experiments/cube48opt-rust/target/release/examples/verify_coordinates \
  .tmp/cubeopt-reverse/opt1-small \
  .tmp/cubeopt-reverse/hot-query.json \
  .tmp/cubeopt-reverse/coordinate-differential-reproduced.json
```

必须全部严格相等：407 条状态和 fastcube 有效字段、19,536 个对称变换、7,326 个逆态移动恒等式、407 个从 WASM 共轭状态重算的参考坐标、54,538 个优化/标量坐标、814 个原 WASM 热路径正逆索引。额外检查逆态乘积、对称类不变和复原坐标 2。fastcube 的 `[28,32)`、`[44,48)` 是原版未定义 padding，只检查 Rust 自己输出为零。

九档共用同一套 fixture 定义，不复制另一组测试魔方；分别消费各档原 WASM 导出的 golden 输出。最终索引全程使用 Rust u64、JS safe integer（最大档仍小于 2^53）。Opt6–9 必须实际覆盖大于 u32::MAX 的正/逆索引，报告记录 `maxObservedIndex` 和 `indicesAboveU32`，不能只让复原态掩盖截断。

例如已由主流程准备好 Opt9 小表、独立物理验证及 OOB 查询导出后：

```sh
CUBEOPT_VARIANT=9 node solver/experiments/cube48opt-rust/verify-coordinates.mjs \
  solver/experiments/cube48opt-rust/target/release/examples/verify_coordinates \
  .tmp/cubeopt-reverse/opt9-small \
  .tmp/cubeopt-reverse/opt9-hot-query.json \
  .tmp/cubeopt-reverse/opt9-coordinate-differential.json
```

上述路径为调用范式，不能据此断言文件已生成。原 OOB 查询只读取首次查表前已写出的真实索引，不应把没有读取 PDB 的运行报告成剪枝值已验证。各档状态见 [coordinate-matrix.md](coordinate-matrix.md)。

Mac AArch64 的优化路径是 NEON，其它架构走标量；报告中的 `coordinateBackend` 明确实际编译路径。本入口不证明剪枝值、搜索最优性或性能，相关验证见 [validation.md](validation.md)。通用入口已编译，Opt1–Opt9 在主流程监控下全部通过上述差分，各档完整报告摘要和最大索引见 [coordinate-matrix.md](coordinate-matrix.md)。Opt1 已用新版通用 binary 重跑，同时保留原入口的历史证据。

## 成对移动 NEON 实现

`cube::moved_pair(&cube, &inverse, movement)` 返回 `(cube * move, move^-1 * inverse)`。默认开启 `neon-moves`，在 AArch64 以原 WASM `step4_domove` 的三个 SIMD 块更新；其它架构或 `--no-default-features` 则调用原有 `moved` 和 `premoved`。接口不改变动作选择、NISS、剪枝界或缓存。

对照入口额外检查全部 407 × 18 = 7,326 对移动的两份 20-byte 输出严格等于标量，并记录 `pairedMoveBackend`。以下命令单独构建以保留其它程序；已有报告时需使用新输出文件名：

```sh
cargo build --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml \
  --example verify_coordinates --features neon-moves \
  --target-dir .tmp/cubeopt-reverse/neon-moves-target
node solver/experiments/cube48opt-rust/verify-coordinates.mjs \
  .tmp/cubeopt-reverse/neon-moves-target/release/examples/verify_coordinates \
  .tmp/cubeopt-reverse/opt1-small \
  .tmp/cubeopt-reverse/hot-query.json \
  .tmp/cubeopt-reverse/coordinate-differential-neon-moves.json
```

Mac 报告明确为 `pairedMoveBackend: "neon"`，7,326 对移动差分已通过。随后 18 例 × 4 轮原生输出（72 行）除耗时外逐字段与标量移动基线一致，包含解序列、节点数、查表数、缓存和剪枝计数；证据为 `.tmp/cubeopt-reverse/neon-search-equivalence.json`。与原 WASM 的交错计时另见跟踪 MD，不能将状态差分本身当作性能证据。
