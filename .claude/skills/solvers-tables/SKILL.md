---
name: solvers-tables
description: "改 solver-rust 的表(新增/删/改大小/改某分析器加载哪些表, 尤其优化 f2leo/pseudo_f2leo 加大表)后必须同步 /code/solvers 页的 TABLES 常量。该数据是硬编码快照(solver-rust 与 *.bin 是外部本地仓库, repo/CI/线上都没有 → 无法 build/runtime 自动拉, 只能手维护)。Triggers: \"solvers 页\", \"求解器看板\", \"/code/solvers\", \"优化 f2leo\", \"f2leo 性能\", \"pseudo_f2leo\", \"加大表\", \"新增剪枝表/移动表\", \"改 solver-rust 表\", \"table_generator\", \"analyzer 加载表\"."
---

# Solvers 看板表数据同步

`/code/solvers` 页按分析器列出实际 mmap 的移动表 / 剪枝表 + 大小。数据是**硬编码快照**(solver-rust + `*.bin` 是外部本地仓库, repo/CI/线上都没有 → 没法 build/runtime 自动拉, 只能手维护)。改了表就得同步。

## 改表后要同步的常量(`core/packages/client-next/app/[lang]/code/solvers/page.tsx`)

- `TABLES`: 每分析器 `move`/`prune` 的表名 + 字节 `b`(+ `cnt` 同规格组, `cond:true` 对角表)。
- `NATIVE`: 若某分析器 `tier`(huge/small)/`rate`/`stages` 变了, 一并改。
- hero stat `~34GB` 与「内存与剪枝表」概览卡的 huge/small 名单 + 文案, 若 tier 变了也要改。

## 大小: 一行重导(真值, 别估)

```pwsh
Get-ChildItem D:\cube\solver-rust\tables\*.bin | Sort Length -Desc | % { '{0}  {1}' -f $_.Length, $_.Name }
```

## 成员关系: 从源码推导并引证(别靠记忆/文件名猜)

口径 = 权威 full 全模式(`CUBE_ALLOW_HUGE_TABLES=1`, 无 `*_NO_DIAG` / `*_SKIP`)。

- 读 `D:\cube\solver-rust\src\bin\<v>_analyzer.rs` 的 `global_init` + `src\<v>_solver.rs` 的 `new()` / `global_init`, grep `ensure_` 调用。
- `ensure_pt_xxx` / `ensure_xxx` → 文件名: 查 `src\prune_tables.rs`(pt_*)/`src\move_tables.rs`(mt_*)里的映射。
- 条件加载(如 `if with_diagonal { ensure_pt_cross_c4c6e0e2 }`)标 `cond:true`, 注明哪个 `*_NO_DIAG=1` 跳过。
- 小表分析器现场 BFS 建在内存的表**不落盘**, 不进 move/prune 列表, 写进 `builtZh`/`builtEn`。

## f2leo / pseudo_f2leo 加大表时(预期任务)

除把新表加进 `TABLES`, 必须:① `NATIVE` 里它 `tier: 'small'→'huge'`;② 概览把它从 small 卡挪到 huge 卡, 改掉「不碰 huge 表 / 深阶段慢 / ~40MB」等文案;③ 更新 `rate` 常量;④ 若不再现场建表则删 `builtZh/En`。

## 收尾

- `pnpm --filter @cuberoot/client-next typecheck`。
- `TABLES` 摘要总大小 = `tblTotal`(move+prune 字节和), 跟一行命令导出的实际大小对一下数量级。
