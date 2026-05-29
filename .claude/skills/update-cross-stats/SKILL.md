---
name: update-cross-stats
description: "用户要更新 WCA 十字步数分布统计(/scramble/stats + /scramble/gen + /scramble/analyzer 的数据)时执行本地周更增量管道。Triggers: \"更新十字统计\", \"重跑十字统计\", \"更新打乱分布\", \"update cross stats\", \"scramble 周更\", \"跑十字管道\"."
---

# 更新十字统计

本地手动一键(只能本地跑,需 solver 34GB 表):

```pwsh
pwsh core/packages/scramble-stats-build/run_weekly.ps1
```

下 results export → 增量挑新打乱 → std_analyzer 全 5 阶段 → 追加 std.csv → 默认再跟 std 锁步补 eo/pseudo/pseudo_pair(按 id 缺补,分块可续)→ 重算 distribution/wca_cross/comp_steps → git push + scp static。

- 先 `-DryRun` 看新增规模(只读,不解算不发布);落后多就大补、solver 跑几小时。
- pair 变体 ~2/s 太慢,不在默认;补齐/跟进单独跑 `-Variants pair`(全量 ~165h,分块可中断续跑)。
- 想本地看不发布:`-NoPublish`。
- 细节/开关/排错:`core/packages/scramble-stats-build/WEEKLY.md`。
