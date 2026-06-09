---
name: update-cross-stats
description: "用户要更新 WCA 十字步数分布统计(/scramble/stats + /scramble/gen + /scramble/analyzer 的数据)时执行本地手动增量刷新管道(按需触发,非定时);含第二套 xcross_2_col_10f 难打乱集补 f2leo/pseudo_f2leo 变体。Triggers: \"更新十字统计\", \"重跑十字统计\", \"更新打乱分布\", \"update cross stats\", \"scramble 周更\", \"跑十字管道\", \"补 xcross 变体\", \"双色底 10f xcross\", \"backfill_xcross_variant\", \"pseudo_f2leo 回填\", \"难打乱补变体\"."
---

# 更新十字统计

本地手动一键(只能本地跑,需 solver 34GB 表):

```pwsh
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1
```

下 results export → 增量挑新打乱 → std_analyzer 全 5 阶段 → 追加 std.csv → 默认再跟 std 锁步补全 6 变体 eo/pseudo/pseudo_pair/pair/f2leo/pseudo_f2leo(按 id 缺补,分块可续)→ 重算 distribution/wca_cross/comp_steps → git push + scp static。

- **交互向导**:真人终端裸跑(无任何参数)自动进向导,全程**方向键菜单**(↑↓ 移动 / Space 多选 / 数字字母快捷 / Enter 确认 / Esc 取消)—— 取数前问「TSV 来源(下载官方最新 / 用本地缓存不联网)」,取数后列出各变体待补 + 估时,多选「跑哪些变体」+ 单选「每变体几块 / 是否发布」,总览确认再跑;`-Interactive` 可强制开,`-UseCached` 单独走不联网取数。AI/带任意 flag/非交互终端(stdin 重定向)不弹,走旧一键。
- **长操作都有进度**:下载(每 5%)、解压大 TSV(每 128MB)、扫描(每 2M 行)、solver 解算([PROG] 每 1%)、build(每 20 万行 `\r`)、scp(每 3s 远端字节)。
- 先 `-DryRun` 看新增规模(只读,不解算不发布);落后多就大补、solver 跑几小时。
- **pair / f2leo / pseudo_f2leo 现已入默认**(2026-06-09);增量只补 delta。瓶颈始终是 eo ~0.9/s。想快跑显式 `-Variants eo,pseudo,pseudo_pair` 跳过这三重型项。
- pair 速率两处记法不一(RUNBOOK 暖表 ~200/s vs 脚本 `$VARIANT_RATE` 2/s,未现测,沿用脚本估时偏保守);f2leo/pseudo_f2leo 走大表快路径(`CUBE_ALLOW_HUGE_TABLES=1` 已默认设,真实打乱 f2leo huge 联合表 ~31/s、pseudo_f2leo huge 电池 ~81/s),首跑要全量回填 ~1.29M id(WCA 集现已近满,只差增量)。
- 想本地看不发布:`-NoPublish`。
- 细节/开关/排错:`core/packages/scramble-stats-build/RUNBOOK.md`。

## 第二套数据集:xcross_2_col_10f(双色底 10f xcross)

`/scramble/stats` 有**两个 set**(`config.yml`):`wca`(全 7 变体齐,走上面的 update_cross_stats)+ `xcross_2_col_10f`(静态 1,271,727 条难打乱,数据在 `D:\cube\scramble\xcross_2_col_10f\stat\` 单数,master=同目录 `scrambles.txt`)。后者**只缺 f2leo/pseudo_f2leo**,与 update_cross_stats **解耦**,走独立脚本:

```pwsh
pwsh core/packages/scramble-stats-build/backfill_xcross_variant.ps1 -Variant pseudo_f2leo -Hours 5 -Threads 10
```

- 限时(`-Hours`,到点 chunk 边界停 + 末块裁剪贴整点;**省略=补满**)/ 限线程(`-Threads` 默认 14)/ 分块可续(重跑读已有 id 跳过)。**两个变体都要补**:`-Variant pseudo_f2leo`(10 线程难打乱暖态 ~21/s,全集 ~17h/~3 次 5h)、`-Variant f2leo`(暖态 ~40/s,全集 ~8.8h/~2 次 5h,但 20GB pair huge 表冷启慢)。难打乱上 f2leo 反比 pseudo_f2leo 快(与 WCA 集相反)。
- **只攒 csv,不 build/不发布**。**partial 千万别 build**(否则页面该变体 sample_count 残缺误导)。补满 1,271,727 后才发布:`pnpm -F @cuberoot/scramble-stats-build build`(读所有 set/变体自动纳入)→ 验 `distribution.json` `sets.xcross_2_col_10f.variants.pseudo_f2leo.sample_count==1271727` → `git add stats/scramble` + push + tar/scp static(xcross set 无 wca_cross/comp_steps,只需 `build`)。
- 进度日志:`D:\cube\scramble\xcross_2_col_10f\_backfill\backfill_<variant>.log`。详见 memory `project_xcross_2col_f2leo_backfill`。
