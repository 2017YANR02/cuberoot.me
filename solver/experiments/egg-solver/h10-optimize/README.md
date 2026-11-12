# 32G Egg：保留原版的独立实验

结果与维护者约束见[跟踪报告](../../../../docs/egg-h10-optimization-tracker.md)。本轮没有晋升候选；此目录不接入日常统计或线上 Timer。

来源为 [ArhanChaudhary/egg-solver](https://github.com/ArhanChaudhary/egg-solver) 的本地固定提交 `8810d69b5f9b6a82d7c72d3a709e93acc319958d`，即上游 `947c20d93564f150aad9c292486ab730a329b86c` 加已验收的 macOS 无缓存文件 I/O 修复。本机原仓库 `/Users/cuberoot/Developer/egg-solver` 未修改。完整来源、上游材料和依赖许可文件保留在源码归档；本目录只保存实验补丁与编排。

## 文件

| 文件 | 用途 |
| --- | --- |
| `arm-keep.patch` | 仅在 ARM 上更换主表预取提示，结果更慢 |
| `ternary-coordinate.patch` | 三进制整表索引及与原算法的穷举检查，完整求解更慢 |
| `split-ternary-coordinate.patch` | 两个六位三进制索引，仅 1458 字节常量，完整求解更慢 |
| `policy.mts` | 固定 h10、语料、程序摘要、资源预算和一次性执行边界 |
| `benchmark.mts` | 复用共享资源监控，逐程序一次驻留主表完成全部题目 |
| `verify.mts` | 用独立 cubing.js 模型复原每条解，核对既有最优步数 |

原始数据在仓库根 `.local-data/egg-h10-optimize-20261112/`。`source.tar` 是运行前的完整固定源码；`source*` 为无 Git 元数据的独立快照，不是工作树。`bin/` 为独立程序；`preserved/original.json` 固定原版 6304 个文件、原程序与主表元数据。没有复制或改写 32G 主表，也没有重新扫描整表校验和。

普通重编译使用默认 Cargo release 配置；Apple M5 版本单独设置 `RUSTFLAGS='-C target-cpu=apple-m5'`。所有构建均使用独立 `CARGO_TARGET_DIR`、`--locked --offline --bin solve`，没有写入原 egg 的 target。24 lanes 只通过 CLI 传参，不写主表旁的 `.tune`。

三个完成的执行目录为根目录、`coordinate-followup/` 和 `split-coordinate-followup/`，分别运行五种配置、一个整表索引候选、一个拆半索引候选。各目录保存固定计划、程序摘要、`used.json`、逐题结果、执行报告、精确执行源码副本及资源监控目录指针；后两项复用首轮基线成绩，没有重跑基线。

从仓库根查看冻结计划：

```sh
node --import ./core/node_modules/tsx/dist/loader.mjs solver/experiments/egg-solver/h10-optimize/benchmark.mts --plan
node --import ./core/node_modules/tsx/dist/loader.mjs solver/experiments/egg-solver/h10-optimize/benchmark.mts --plan-ternary
node --import ./core/node_modules/tsx/dist/loader.mjs solver/experiments/egg-solver/h10-optimize/benchmark.mts --plan-split-ternary
```

相应 `--run*` 入口已消费并拒绝再次运行。不能覆盖计划、删消费记录、重置保护基线或重跑取最好成绩。新研究应保留本轮证据，提出真正不同的候选与计划；资源与授权继续遵循[计算规则](../../../../docs/contributing/compute.md)。

## 32 / 24 lanes 的重复性验证

维护者随后要求确认 3% 收益是否能重复观察到；这一新问题使用独立目录 `.local-data/egg-h10-lanes-repeatability-20261112/`，不覆盖或重新消费上述单轮实验。固定八个配对、16 次独立完整语料运行，四组先 32 后 24、四组顺序相反；全部使用同一个已验收原版程序，不重编译。

`--plan-lanes-repeatability` 查看固定计划，`--run-lanes-repeatability` 只允许消费该计划一次。原版程序、主表及默认设置仍不修改，报告不自动启用任何参数。

`repeat-report.mts` 分析全部八个配对，输出胜负、范围、总耗时、先后顺序影响及探索性的配对 95% 区间。这项验证没有最低 5% 提速门槛，关注能否稳定观察到正收益；详细的预设条件和最终结论见跟踪报告。

本次已完成：24 路五胜三负，合计耗时少 0.65%，探索性区间包含零收益，尚未确认稳定的 3% 提升。16000 条解全部正确，旧版本和默认设置保留；重复性入口已消费。全部新证据保存在上述独立目录。
