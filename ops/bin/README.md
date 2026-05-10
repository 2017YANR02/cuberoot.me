# server scripts (cuberoot.me /usr/local/bin/)

云服务器上 `/usr/local/bin/*_apply.sh` 的 source-of-truth。

## 当前脚本

- `historical_ranks_apply.sh` — `stats.yml` build 触发, 灌 `historical_ranks_snapshot` + `historical_ranks_monthly_snapshot` + persons/countries/continents
- `wca_stats_extra_apply.sh` — `stats.yml` build 触发, 灌 wca_competitions / wca_grand_slam / wca_results_top 等 8 张表

## 部署流程

改动 `ops/bin/*.sh` → push main → `.github/workflows/deploy_ops_bin.yml` 自动:

1. scp 新脚本到服务器 `/tmp/*.sh`
2. `bash -n` 语法检查 — 失败 abort 不动现网
3. 现网无变化 → no-op 跳过
4. 否则备份现网 `${target}.bak-<unix-ts>` + cp + `chmod +x`

## 设计注记

- `psql -e` 让 server 收到的每条 SQL 回显到 stdout(`\copy` / TRUNCATE / CREATE INDEX 等),配合 `tee >(logger)` 同时给 GitHub Actions 实时日志和服务器 syslog
- `ON_ERROR_STOP=1` 任何 SQL 错误立即 abort 整个事务(防 silent failure,见 `stats-pipeline-dry-run` skill)
- REQUIRED 数组列出所有必备 `.copy.tsv`,任一缺失或空文件即 abort —— 这是抵御 stats.yml scp 清单漏文件的最后一道防线

## 回滚

```bash
ssh root@cuberoot
cd /usr/local/bin/
ls -t historical_ranks_apply.sh.bak-* | head -3
cp historical_ranks_apply.sh.bak-1778100000 historical_ranks_apply.sh
```

或本地 git revert + push。
