本流程的“顶部授权规则”见 [skill 入口](../SKILL.md)；执行前仍须遵守其中共同规则。

## A. 三阶阶段难度(`update_cross_stats.ps1`)

一键(脚本名留 `cross` 是历史:十字是主阶段,实跑全阶段):

```pwsh
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1
```

下 results export → 增量挑新打乱 → std_analyzer 全 5 阶段 → 追加 std.csv → 默认再跟 std 锁步补全 6 变体 eo/pseudo/pseudo_pair/pair/f2leo/pseudo_f2leo(按 id 缺补,分块可续)→ 重算 distribution/wca_cross/comp_steps → git push + scp static。

- **交互向导**:真人终端裸跑(无参数)自动进向导,全程**方向键菜单**(↑↓ / Space 多选 / 数字字母快捷 / Enter / Esc)—— 取数前问「TSV 来源(下载官方最新 / 用本地缓存不联网)」,取数后列各变体待补 + 估时,多选「跑哪些变体」+ 单选「每变体几块 / 是否发布」,总览确认再跑;`-Interactive` 强制开,`-UseCached` 单独走不联网取数。AI/带任意 flag/非交互终端不弹;AI 必须按顶部授权规则显式决定是否加 `-NoPublish`。
- **长操作都有进度**:下载(每 5%)、解压大 TSV(每 128MB)、扫描(每 2M 行)、solver([PROG] 每 1%)、build(每 20 万行 `\r`)、scp(每 3s 远端字节)。
- 先 `-DryRun` 看新增规模(只读);落后多就大补、solver 跑几小时。
- **pair / f2leo / pseudo_f2leo 已入默认**(2026-06-09);增量只补 delta。瓶颈始终是 eo ~0.9/s。想快跑显式 `-Variants eo,pseudo,pseudo_pair` 跳过三重型项。
- f2leo/pseudo_f2leo 走大表快路径(`CUBE_ALLOW_HUGE_TABLES=1` 已默认;f2leo huge ~31/s、pseudo_f2leo huge ~81/s)。
- 想本地看不发布:`-NoPublish`。细节/开关/排错:`core/jobs/scramble-stats-build/RUNBOOK.md`。

### 第二套数据集:xcross_2_col_10f(双色底 10f xcross)

`/scramble/stats` 三阶有**两个 set**(`config.yml`):`wca`(全 7 变体,走上面)+ `xcross_2_col_10f`(静态 1,271,727 条难打乱,数据在 `D:\cube\scramble\xcross_2_col_10f\stat\`,master=同目录 `scrambles.txt`)。后者**只缺 f2leo/pseudo_f2leo**,与 update_cross_stats **解耦**,走独立脚本:

```pwsh
pwsh core/jobs/scramble-stats-build/backfill_xcross_variant.ps1 -Variant pseudo_f2leo -Hours 5 -Threads 10
```

- 限时(`-Hours`,到点 chunk 边界停 + 末块裁剪;省略=补满)/ 限线程 / 分块可续。两变体都要补:`-Variant pseudo_f2leo`(暖态 ~21/s,全集 ~17h)、`-Variant f2leo`(暖态 ~40/s,全集 ~8.8h,但 20GB pair huge 表冷启慢)。
- **只攒 csv,partial 千万别 build**(否则该变体 sample_count 残缺误导)。补满 1,271,727 后才 `pnpm -F @cuberoot/scramble-stats-build build` → 验 `distribution.json` `sets.xcross_2_col_10f.variants.pseudo_f2leo.sample_count==1271727` → push + tar/scp static。
- 进度:`D:\cube\scramble\xcross_2_col_10f\_backfill\backfill_<variant>.log`。详见 memory `project_xcross_2col_f2leo_backfill`。

---

