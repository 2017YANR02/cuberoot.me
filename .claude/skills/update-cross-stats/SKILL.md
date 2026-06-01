---
name: update-cross-stats
description: "用户要更新 WCA 十字步数分布统计(/scramble/stats + /scramble/gen + /scramble/analyzer 的数据)时执行本地手动增量刷新管道(按需触发,非定时)。Triggers: \"更新十字统计\", \"重跑十字统计\", \"更新打乱分布\", \"update cross stats\", \"scramble 周更\", \"跑十字管道\"."
---

# 更新十字统计

本地手动一键(只能本地跑,需 solver 34GB 表):

```pwsh
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1
```

下 results export → 增量挑新打乱 → std_analyzer 全 5 阶段 → 追加 std.csv → 默认再跟 std 锁步补 eo/pseudo/pseudo_pair(按 id 缺补,分块可续)→ 重算 distribution/wca_cross/comp_steps → git push + scp static。

- **交互向导**:真人终端裸跑(无任何参数)自动进向导,全程**方向键菜单**(↑↓ 移动 / Space 多选 / 数字字母快捷 / Enter 确认 / Esc 取消)—— 取数前问「TSV 来源(下载官方最新 / 用本地缓存不联网)」,取数后列出各变体待补 + 估时,多选「跑哪些变体」+ 单选「每变体几块 / 是否发布」,总览确认再跑;`-Interactive` 可强制开,`-UseCached` 单独走不联网取数。AI/带任意 flag/非交互终端(stdin 重定向)不弹,走旧一键。
- **长操作都有进度**:下载(每 5%)、解压大 TSV(每 128MB)、扫描(每 2M 行)、solver 解算([PROG] 每 1%)、build(每 20 万行 `\r`)、scp(每 3s 远端字节)。
- 先 `-DryRun` 看新增规模(只读,不解算不发布);落后多就大补、solver 跑几小时。
- pair 变体 ~2/s 太慢,不在默认;补齐/跟进单独跑 `-Variants pair`(全量 ~165h,分块可中断续跑)。
- f2leo / pseudo_f2leo 是小表分析器(常驻 ~40MB,只用 mt_* + 自建 xcross/cross 剪枝表,**不碰 huge 表**),同 pair 一样 opt-in,不在默认:`-Variants f2leo,pseudo_f2leo`;首跑要全量回填全部 ~1.29M id。
- 想本地看不发布:`-NoPublish`。
- 细节/开关/排错:`core/packages/scramble-stats-build/RUNBOOK.md`。
