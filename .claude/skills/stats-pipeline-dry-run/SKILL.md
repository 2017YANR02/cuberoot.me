---
name: stats-pipeline-dry-run
description: "Use whenever modifying the stats-build → server PG 数据流 — 加新 .copy.tsv / 改 builder 输出 / 改 stats.yml scp 清单 / 改 load.sql。三处必须严格一致(builder 写 ↔ scp 传 ↔ load.sql \\copy 引),少一处 = 服务器表静默空 + nginx cache + 24h 才发现。提供 30 秒的 grep 三段对照命令。Triggers: \"stats.yml\", \"historical_ranks_build\", \"wca_stats_extra_build\", \"load.sql\", \"\\\\copy\", \".copy.tsv\", \"scp historical_ranks\", \"stats workflow scp\", \"加新 stat 表\", \"新 builder 输出\"."
---

# Stats Pipeline Dry-Run

`core/packages/stats-build/` 的两条 deploy 管道都是**三段式**:

```
builder.ts                  →   stats.yml (scp)             →   server load.sql (\copy)
historical_ranks_build.ts       scp historical_ranks_*           \copy historical_ranks_snapshot ...
wca_stats_extra_build.ts        scp wca_stats_extra_*            \copy wca_grand_slam ...
```

**任意一段漏文件 = 服务器表 0 行,但年级表 / 其它表正常 → 不报错,等 24h nginx cache 过期才暴露**。
2026-05-09 真发生过:加月级 `historical_ranks_monthly_snapshot.copy.tsv` 时漏改 stats.yml 的 scp 清单,用户白等 1h 53min CI run。

## 30 秒 dry-run

改完任何一段都立刻跑下面三段对照,**全相等才能 commit**:

```bash
# Historical Ranks 管道
echo "=== HR builder writes ==="
grep -oE "[a-z_]+\.copy\.tsv" core/packages/stats-build/src/bin/historical_ranks_build.ts | sort -u

echo "=== HR scp uploads ==="
awk '/scp.*hr_id.*load\.sql wca_continents/,/wca_import\/"/' .github/workflows/stats.yml \
  | grep -oE "[a-z_]+\.copy\.tsv" | sort -u

echo "=== HR load.sql \\copy refs ==="
grep -oE "FROM '[a-z_]+\.copy\.tsv'" core/packages/stats-build/src/bin/historical_ranks_build.ts \
  | grep -oE "[a-z_]+\.copy\.tsv" | sort -u
```

WCA Stats Extra 管道同模式,把上面三处替换:
- builder → `wca_stats_extra_build.ts`
- scp awk pattern → `/scp.*hr_id.*load\.sql wca_competitions/,/wca_stats_extra\/"/`
- load.sql refs 仍在同一 builder 文件里

三段输出**完全相同** = 通过。任一行 missing = 修。

## 修过的位置(改动 checklist)

加新 `.copy.tsv` 输出时**必改三处**:

1. **builder.ts**:
   - 写 TSV 流(`createWriteStream` + `.write(...)`)
   - load.sql heredoc 里加 `TRUNCATE` + `\\copy ... FROM 'xxx.copy.tsv'`
2. **`.github/workflows/stats.yml`**: 对应 pipeline 的 `scp -i ~/.ssh/hr_id ...` 清单加文件名
3. **server schema**(可选): 是否要加新 PG 表 / 索引?改 `core/packages/server/src/db/schema_*.pg.sql`,先在云服务器 ALTER 再 push(参考 `server-deploy` skill)

## 服务器侧 apply 脚本(只读,别改)

- `/usr/local/bin/historical_ranks_apply.sh` — `psql -f /tmp/wca_import/load.sql`
- `/usr/local/bin/wca_stats_extra_apply.sh` — 同样 pattern,在 `/tmp/wca_stats_extra/`
- 都是 `set -e`,**但 psql 默认不 ON_ERROR_STOP** → `\copy` 找不到文件**不会** abort 事务,COMMIT 照样过 → 服务器存量数据正常,新表静默 0 行。这是 silent failure 的根源。

## 验证服务器是否灌进去了

```bash
ssh root@cuberoot 'sudo -u postgres psql -d recon_db \
  -c "SELECT COUNT(*) FROM historical_ranks_snapshot;" \
  -c "SELECT COUNT(*) FROM historical_ranks_monthly_snapshot;"'
```

灌完应当两张表都有数据。如果新增表是 0 → 99% 是 scp 清单漏了。

## 改完后让用户跑

新加 `.copy.tsv` 后 commit + push,提示用户**手动触发**:
```
gh workflow run stats.yml
```
等 1h 53min。push 触发不跑 build job(只跑 syntax-check,见 stats.yml `if: github.event_name == 'push'`)。

## 也参考

- `server-deploy` — schema 变更顺序 / SSH 凭据 / pm2 重启
- `stats-build` — 单个 stat 怎么写 / compute.ts CLI
- memory `reference_historical_ranks.md` — 这条管道的 ENV 变量 / Hono 端点 / nginx cache 位置
- memory `feedback_ci_pipeline_dry_run.md` — 这条 skill 的根因故事
