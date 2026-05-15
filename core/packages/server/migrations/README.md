# DB Migrations

PostgreSQL schema 变更的 source-of-truth。`apply_migrations.sh` 在 deploy 时自动跑没跑过的。

## 流程

加新列 / 新表 / 改索引:

1. **写 migration 文件**,文件名格式 `NNNN_short_description.sql`(必须 `^[0-9a-z_]+\.sql$`):
   ```sql
   -- 0042_add_pinned_to_comments.sql
   ALTER TABLE comments ADD COLUMN pinned SMALLINT NOT NULL DEFAULT 0;
   ```
   - **不要写 `BEGIN;` / `COMMIT;`** — runner 会自己包(每个 migration 一个事务)
   - **数字前缀必须严格单调递增**(否则排序 = 应用顺序乱)
   - 多人协作合并冲突:用 `git pull` 后看 `0042` 还是 `0043`,改自己那个

2. **同步更新 `../src/db/schema.pg.sql`**:把新列加进对应 CREATE TABLE
   - schema.pg.sql 是"当前 schema 全貌"的人读快照;migrations/ 是 CI 实际跑的权威
   - 两者靠纪律同步;偏离了用 `pg_dump --schema-only` 重生成 schema.pg.sql

3. **改业务代码**(server 路由 / 类型),引用新列

4. **`git push`** → CI 自动:
   - rsync `migrations/` 到云服务器 `/root/core-api/migrations/`
   - ssh 跑 `apply_migrations.sh /root/core-api/migrations`
   - 之后才 `pm2 restart core-api`(不会出现"新代码部上去查不到列"的窗口)

## 已应用 migration **不能改**

`apply_migrations.sh` 计算每个文件的 sha256 存在 ledger 里;下次跑发现已应用 + sha256 不一致 = abort 报错。要回滚或修正:
- **写新 migration 反向**(简单情况:`DROP COLUMN` / `DROP INDEX`)
- 或 `pg_dump` restore(每天 03:00 UTC 自动 dump,见 memory `reference_pg_dump_backup.md`)

## 失败 = 立即 abort,不会半灌

`ON_ERROR_STOP=1` + 每个 migration 包 `BEGIN; ... COMMIT;`:任一 SQL 错误 → 当前 migration 事务回滚 + 后续 migration 不跑。前面已 COMMIT 的保留(每个 migration 独立事务)。下次重跑从失败点继续。

## 没有 down migration

YAGNI。要回滚:
- 简单情况(加列/加索引):写新 migration `DROP COLUMN` / `DROP INDEX`
- 复杂情况:`pg_dump` restore(每天 03:00 UTC 自动 dump,见 memory `reference_pg_dump_backup.md`)

## 看哪些 migration 已应用

```bash
ssh root@cuberoot "PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
  -c 'SELECT filename, applied_at FROM _schema_migrations ORDER BY filename;'"
```
