---
name: new-substep-solver
description: "用户要给 3x3 加一个新的 substep 求解器(某块/某阶段的最优步数求解 + 在线 analyzer + 打乱统计)时用。范本 = block222(2026-06-10);完整流程在 solver/VARIANT_PLAYBOOK.md,先读它再动手。Triggers: \"造个 X 求解器\", \"新求解器\", \"roux s1 求解器\", \"eoline 求解器\", \"petrus 求解器\", \"new substep solver\", \"加一个 step solver\", \"块求解器\", \"新变体\", \"new variant solver\"."
---

# 新 substep 求解器

**先整读 `solver/VARIANT_PLAYBOOK.md`**(语义设计 → Rust → WASM/UI → 统计 → 发布全链路 + cstimer 语义速查表),范本代码 = `solver/src/block222_solver.rs` 全家桶。

一页纸版:

1. 语义:件集合(面交集推导)→ 状态空间(乘积坐标,常量都在 `cube_common::state_space`)→ ≤3000 万态走全空间精确距离表,否则走 pair/eo 启发式模板。
2. 视角:1 个规范位置 + `alg_rotation`(6 底色)× `rot_map`(y^k)共轭;标签用探针法 `face_map`;CSV 每视角列 = 等价位置 min,列序 z0/z2/z3/z1/x3/x1。
3. Rust:solver 模块(双轨 new/from_tables)+ analyzer bin(suffix `_<变体名>`)+ 测试三件套(独立运动学暴力对照是金标准)+ e2e。
4. WASM 重建仪式 7 步(build_wasm.ps1 → copy → worker 手维护 → client TABLE_SETS/V bump → pool → StageSolver → playwright 桌面+手机验收,native↔WASM 逐格相等)。
5. 统计:两套数据集首灌 + update_cross_stats.ps1 五处注册(数字变体名键加引号)+ backfill 两处 + build.ts VariantSpec + stats 页三处 + 发布(**先 push 代码等部署,再 scp static,否则旧 bundle 撞新 JSON 崩**)。
6. `/code/solvers` 看板走 solvers-tables skill;commit 前 typecheck + zh:check。
