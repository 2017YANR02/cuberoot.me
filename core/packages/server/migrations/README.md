# DB Migrations

PostgreSQL schema 变更的 source of truth。`apply_migrations.sh` 会在部署时自动执行尚未应用的文件。

## 流程

增加列、表或索引时：

1. 写 migration 文件，文件名格式为 `NNNN_short_description.sql`，且必须匹配 `^[0-9a-z_]+\.sql$`。

   ```sql
   -- 0042_add_pinned_to_comments.sql
   ALTER TABLE comments ADD COLUMN pinned SMALLINT NOT NULL DEFAULT 0;
   ```

   - 不要写 `BEGIN;` 或 `COMMIT;`，runner 会为每个文件单独开启事务。
   - 数字前缀必须严格单调递增；历史重复编号 `0062`、`0087` 不得改名或改写。
   - `0000_bootstrap_updated_at_function.sql` 是唯一 grandfathered bootstrap 例外：它修复 `0001` 早于 `0010` 引用共用 trigger 函数的历史 fresh-replay 缺口，不得改名、删除或复制这种倒序补号模式。
   - 多人协作时，创建文件前重新确认当前最大编号。

2. 同步更新 `../src/db/schema.pg.sql`，将新结构写入对应的最终态 `CREATE TABLE`。
   - `schema.pg.sql` 是便于审阅的当前结构快照。
   - `migrations/` 是部署实际执行的权威来源。

3. 同步业务代码、共享类型、`/dev/schema`、`/dev/api`、账号删除策略和回归测试。

4. 推送后，部署流水线会先应用 migration，再重载服务。

## 已应用 migration 不能改

`apply_migrations.sh` 会把每个文件的 SHA-256 写入 ledger。已应用文件的摘要发生变化时会终止执行。修正已上线结构只能新增 migration；需要恢复数据时使用已验证的备份。

## 失败会立即终止

`ON_ERROR_STOP=1`，且每个 migration 各自处于一个事务内。任一 SQL 失败时，当前文件回滚，后续文件不执行；此前已经提交的 migration 保留，下次从失败点继续。

## 没有 down migration

简单回滚通过新的反向 migration 完成；复杂恢复使用经过验证的数据库备份。不要改写已经应用的文件。

## 查看已应用 migration

使用运行环境已经配置的数据库连接，不要把密码或连接串写入命令、文档、仓库或日志：

```bash
psql "$DATABASE_URL" -c 'SELECT filename, applied_at FROM _schema_migrations ORDER BY filename;'
```
