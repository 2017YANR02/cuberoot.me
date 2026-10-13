# 九档坐标验证状态

此表只记录九档通用化后的完整差分。Opt1–Opt9 已由主流程统一监控运行通过，下面的数值和摘要直接读取保存的报告，没有新增求解或建表。Opt1 已用新版通用 binary 重跑，旧差分也保留；静态恢复证据见 [coordinate-variants.md](coordinate-variants.md)，命令和断言见 [coordinate-validation.md](coordinate-validation.md)。

| 档位 | 独立 cubing.js 407 态 | 19,536 个共轭 | 54,538 次优化/标量索引 | 原版正/逆索引 814 项 | >u32 覆盖 | 新版报告 |
| --- | --- | --- | --- | --- | --- | --- |
| Opt1 | 通过 | 通过 | 通过 | 通过 | 0 项 | [报告](../../../.tmp/cubeopt-reverse/opt1-generic-coordinate.json) |
| Opt2 | 通过 | 通过 | 通过 | 通过 | 0 项 | [报告](../../../.tmp/cubeopt-reverse/opt2-coordinate.json) |
| Opt3 | 通过 | 通过 | 通过 | 通过 | 0 项 | [报告](../../../.tmp/cubeopt-reverse/opt3-coordinate.json) |
| Opt4 | 通过 | 通过 | 通过 | 通过 | 0 项 | [报告](../../../.tmp/cubeopt-reverse/opt4-coordinate.json) |
| Opt5 | 通过 | 通过 | 通过 | 通过 | 0 项 | [报告](../../../.tmp/cubeopt-reverse/opt5-coordinate.json) |
| Opt6 | 通过 | 通过 | 通过 | 通过 | 243 项 | [报告](../../../.tmp/cubeopt-reverse/opt6-coordinate.json) |
| Opt7 | 通过 | 通过 | 通过 | 通过 | 283 项 | [报告](../../../.tmp/cubeopt-reverse/opt7-coordinate.json) |
| Opt8 | 通过 | 通过 | 通过 | 通过 | 295 项 | [报告](../../../.tmp/cubeopt-reverse/opt8-coordinate.json) |
| Opt9 | 通过 | 通过 | 通过 | 通过 | 307 项 | [报告](../../../.tmp/cubeopt-reverse/opt9-coordinate.json) |

九档的 `coordinateBackend`、`pairedMoveBackend` 均为 `neon`，各自 7,326 对移动逐字节与标量一致，`allEqual=true`。独立物理报告位于各 `optN-small/physical-verification.json`，其 SHA-256 已嵌入对应坐标报告。Opt1 重用已加载原表的 `step1_query` 输出；Opt2–9 的原版索引来自该函数首次 PDB 读取前的预期 OOB trap，未分配 PDB。

| 档位 | 实际最大索引 maxObservedIndex | 坐标报告 SHA-256 |
| --- | ---: | --- |
| Opt1 | 115,268,038 | `fc6b5cefda8021dcacc42110ad012f5aa462f20518f50dcd36a0abf34d5ed1fc` |
| Opt2 | 461,070,790 | `c6d6f8982a76d73b83d5b292b0a0f3c786fbbc85d5725bdf2f88e4716c7695ed` |
| Opt3 | 922,141,638 | `9ea7c95a72ae169edb93b6d3bb0c9a30afea3baae51b77895b61b2fde52cc40d` |
| Opt4 | 1,844,282,822 | `28b9f49fcab6e0eff92dc397acfb0b63830671d2cf964cafbd418e758382f2f2` |
| Opt5 | 3,688,565,190 | `99eff3c9c31db9a0bef09b066ef251507670f271a1035bf18e2c4e4f343fd8cb` |
| Opt6 | 7,377,129,926 | `1f0c8565d4d6e7fb3f0bd26990487e3e3dbce33e160c7977572b1c58937927c8` |
| Opt7 | 14,754,259,398 | `0d8eb429a951d601e5a41e1575750849c2d37a06b2db51689d11bec6173b344b` |
| Opt8 | 29,508,518,854 | `6758c5229919c7762bed9c1b57ac2aef7d6e137baf1cf190ac38af65be31b299` |
| Opt9 | 59,017,037,766 | `c1c3869aa0f3867b3be2de206010d212cf09e6d0d53e3963536c3f8e6265d3a4` |

九档共覆盖 3,663 个独立物理状态实例、175,824 个共轭、490,842 次优化/标量索引及 7,326 个原版正/逆查询索引，未抽样减少任何单档集合。上述 `.tmp` 报告只存在本机，本页保留其完整摘要；不将本机产物说成已发布或仓库自带。更新为通过时须保留每档原 WASM、native binary、小表、fixture、独立物理验证和查询输出的摘要。任何失败保留原始输出，不放宽数量、索引或状态相等断言。OOB 索引导出不提供剪枝值；此矩阵也不等同于搜索最优性或性能验证。
