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
   - `0000_bootstrap_updated_at_function.sql` 是唯一 grandfathered bootstrap 例外：它只修复具备 pre-ledger baseline 表时重放 `0001` / `0010` 的函数顺序，不代表支持绝对空库重放；不得改名、删除或复制这种倒序补号模式。
   - 多人协作时，创建文件前重新确认当前最大编号。

2. 同步更新 `../src/db/schema.pg.sql`，将新结构写入对应的最终态 `CREATE TABLE`。
   - `schema.pg.sql` 是便于审阅的当前结构快照。
   - `migrations/` 是部署实际执行的权威来源。

3. 同步业务代码、共享类型、`/dev/schema`、`/dev/api`、账号删除策略和回归测试。

4. 推送后，部署流水线会先应用 migration，再重载服务。

## 历史基线与新库恢复

当前 migration 链记录的是旧生产 schema 之后的增量变化，不是可从绝对空库独立重放的 bootstrap。早期文件会 `ALTER` 基线中已有的表；`schema.pg.sql` 是当前最终态审阅快照，也不能先执行后再重放全部 migration。

部署只在已有 ledger 与历史基线的数据库上向前升级。新库或灾难恢复必须使用已验证的数据库备份；若以后要支持从零初始化，应另行提交带版本的 baseline、ledger 初始化规则和空库集成测试，不能改写历史 migration。

当前教学 CRM 增量 `0149_teaching_campuses_groups_assignments.sql` 的升级基线是已应用至 `0148_fix_teaching_owner_guard.sql` 的现有数据库。它新增校区、班级、有效期关系和永久并发锁，并把 `session_teachers` 姓名快照扩到 200 字符；不能把 `0149` 当作空库初始化脚本单独执行。

训练底座增量 `0150_teaching_training_foundation.sql` 的升级基线是已应用至 `0149_teaching_campuses_groups_assignments.sql` 的现有数据库。它为既有学员账号关联补记非未来的关联时间，新增版本化模板、任务目标快照、只追加证据与批改、可信来源每日汇总和只存哈希的账号绑定邀请，并把永久关系锁扩展到证据自然键。该 migration 只建立数据库与共享契约，不开放半成品业务路由；不能把 `0150` 当作空库初始化脚本单独执行。

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
