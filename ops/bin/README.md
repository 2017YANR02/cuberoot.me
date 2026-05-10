# server scripts (cuberoot.me /usr/local/bin/)

云服务器上 `/usr/local/bin/*.sh` 的 source-of-truth。

## 当前脚本

- `apply_load.sh` — 通用 PG 加载器,接受 `<import_dir> <log_tag>` 两参数。
  - `stats.yml` build job 用它灌两条管道:`historical_ranks_apply` 和 `wca_stats_extra_apply`
  - 脚本本身跟具体表无关:扫 `$IMPORT_DIR/*.copy.tsv` 全部非空 + 跑 `psql -e -v ON_ERROR_STOP=1 -f load.sql`
  - 新增第三条数据流不用复制脚本,只要 builder 在新目录里写好 `load.sql + *.copy.tsv`,stats.yml 加一行 `ssh ... apply_load.sh /tmp/<dir> <tag>` 即可

## 部署流程

改动 `ops/bin/*.sh` → push main → `.github/workflows/deploy_ops_bin.yml` 自动:

1. scp 新脚本到服务器 `/tmp/*.sh`
2. `bash -n` 语法检查 — 失败 abort 不动现网
3. 现网无变化 → no-op 跳过
4. 否则备份现网 `${target}.bak-<unix-ts>` + cp + `chmod +x`

case 列表写死了 `apply_load.sh`(防误传别的 .sh 上去)。新增脚本要先在 deploy_ops_bin.yml 的 case 加上。

## 设计注记

- `psql -e` 让 server 收到的每条 SQL 回显到 stdout(`\copy` / TRUNCATE / CREATE INDEX 等),配合 `tee >(logger)` 同时给 GitHub Actions 实时日志和服务器 syslog
- `ON_ERROR_STOP=1` 任何 SQL 错误立即 abort 整个事务(防 silent failure,见 `stats-pipeline-dry-run` skill)
- `*.copy.tsv` 全部非空预检 + ON_ERROR_STOP 双重抵御 stats.yml scp 清单漏文件

## 回滚

```bash
ssh root@cuberoot
cd /usr/local/bin/
ls -t apply_load.sh.bak-* | head -3
cp apply_load.sh.bak-1778100000 apply_load.sh
```

或本地 git revert + push。

## 历史

- 2026-05-10 之前是两个脚本 `historical_ranks_apply.sh` + `wca_stats_extra_apply.sh`,99% 一样,合并为 `apply_load.sh`
