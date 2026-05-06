# 删除生产 MariaDB 上的 `recon_db` 库(2026-05-06+ 观察期满后)

> **场景**: 2026-05-06 后端从 MariaDB 迁到 PostgreSQL 13,生产 server 已经接 PG。
> 1-2 周观察期满、PG 一切正常后,执行此文档**只删 `recon_db` 这一个库**,
> MariaDB 服务和 `wordpress` 库都保留。
>
> **为什么不卸载整个 MariaDB?** —— 同一个 MariaDB 实例还托管 WordPress
> 站点(`https://www.cuberoot.me/blog/`),用 `wordpress` 库,WordPress 强依赖
> MySQL/MariaDB 跑不了 PG。一开始没意识到这点(2026-05-06 试着 stop 了
> mysqld 之后 blog 504,立刻 restart 恢复)。
>
> **执行时**: 把这整个文档丢给 AI 助手让它"严格跟着做,不要跳步,每一步先
> 验证"。或者用户自己 ssh 进去逐步跑。

---

## ⚠️ 执行前必读

1. **不要碰 `wordpress` 库** —— blog 在用。**只 DROP `recon_db`**。
2. **不要 stop/disable mysqld** —— 服务保留给 WordPress。
3. **dump 备份**已存在两份:
   - 生产:`/root/backups/recon_db_mariadb_final_2026-05-06.sql.gz`(~1.2 MB)
   - 本地:`D:\cube\ruiminyan.github.io\.tmp\recon_db_mariadb_final_2026-05-06.sql.gz`
   - 任意一份都能 `gunzip -c | mysql recon_db` restore。**至少留半年**。

---

## 1. Pre-flight 验证

ssh 上服务器,逐项确认。**任何一项不通过就停下来**。

```bash
ssh root@cuberoot
```

### 1.1 PG server 跑得好

```bash
# 健康检查 (经 nginx 反代 → core-api → PG)
curl -sS https://www.cuberoot.me/api/health
# expect: {"status":"ok","timestamp":...,"db":"connected"}

# 数据完整
curl -sS https://www.cuberoot.me/api/recon/list 2>&1 | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'recons')"
# expect: 数千条 (不是 0)
```

### 1.2 MariaDB 还活着,WordPress 也活着

```bash
systemctl is-active mysqld
# expect: active

curl -sS -o /dev/null -w "blog: %{http_code}\n" https://www.cuberoot.me/blog/
# expect: blog: 200
```

### 1.3 server `.env` 已经指向 PG

```bash
grep DB_PORT /root/core-api/.env
# expect: DB_PORT=5432  (不是 3306)
```

如果是 3306,**绝对不能继续**,server 还在用 MariaDB,删了 recon_db 全站 502。

### 1.4 dump 备份还在

```bash
ls -lh /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz
# expect: 文件存在,~1.2 MB
```

如果不见了,先重做一份:
```bash
mysqldump -u recon_user -pRecon2026!Cube --single-transaction --routines --hex-blob recon_db | gzip > /root/backups/recon_db_mariadb_final_$(date +%Y-%m-%d).sql.gz
```

### 1.5 确认 recon_db 跟 wordpress 是分开的两个库

```bash
mysql -u recon_user -pRecon2026!Cube -e "SHOW DATABASES" 2>/dev/null
# expect: recon_db 在列表里(也会看到 information_schema 之类系统库)
```

---

## 2. DROP recon_db

走完 § 1 全部 ✓ 后:

```bash
# 用 recon_user 自己 drop (这个用户对 recon_db 有 ALL 权限)
mysql -u recon_user -pRecon2026!Cube -e "DROP DATABASE recon_db;"

# 顺便清掉 recon_user 账号(不再用,但需要 root 或 DROP USER 权限)
# recon_user 自己没 DROP USER 权限,需要 root 或 sudo unix_socket 接 root
# 或者 sudo mysql (如果 unix_socket 配了 root):
#   sudo mysql -e "DROP USER 'recon_user'@'localhost';"
```

---

## 3. Post-drop 验证

### 3.1 库真的没了

```bash
mysql -u recon_user -pRecon2026!Cube -e "SHOW DATABASES" 2>&1
# expect: recon_db 不在列表里(若用户已删,会报 "Access denied")
```

### 3.2 PG / server / blog 都还正常

```bash
curl -sS https://www.cuberoot.me/api/health
# expect: {"status":"ok","db":"connected"}

curl -sS -o /dev/null -w "blog: %{http_code}\n" https://www.cuberoot.me/blog/
# expect: blog: 200

curl -sS https://www.cuberoot.me/api/recon/list 2>&1 | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'recons')"
# expect: 数千条
```

### 3.3 看磁盘释放(其实很少 — recon_db 数据 < 10 MB)

```bash
df -h /
```

InnoDB 即使 DROP DATABASE 也可能不立即释放(`ibdata1` 不缩),但磁盘占用基本可忽略。

---

## 4. dump 备份保留策略

`/root/backups/recon_db_mariadb_final_2026-05-06.sql.gz` **至少留到 2026-11-06**。
半年后想清掉:
```bash
rm /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz
```

本地 `.tmp/recon_db_mariadb_final_2026-05-06.sql.gz` 同样保留半年。

---

## 5. Rollback(发现 PG 出严重问题想退回 MariaDB)

```bash
# 1. 重建 recon_db + recon_user (MariaDB 服务一直在跑,不需要装)
mysql -u root -e "
  CREATE DATABASE recon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'recon_user'@'localhost' IDENTIFIED BY 'Recon2026!Cube';
  GRANT ALL ON recon_db.* TO 'recon_user'@'localhost';
"
# 服务器原本配的 root 密码,或 sudo mysql 直连。

# 2. restore dump
gunzip -c /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz \
  | mysql -u recon_user -pRecon2026!Cube recon_db

# 3. 改 .env: DB_PORT=3306
sed -i 's/^DB_PORT=.*/DB_PORT=3306/' /root/core-api/.env

# 4. 代码 git revert PG 迁移整套 commits, push 触发 redeploy
#    (server 用 mariadb driver 才能连 MariaDB)
```

**会丢 PG 上写入的新数据**(2026-05-06 到 rollback 之间),除非也从 PG dump 一份合并。

---

## 总结一行命令(✓ 跑完 § 1 后)

```bash
ssh root@cuberoot 'mysql -u recon_user -pRecon2026!Cube -e "DROP DATABASE recon_db;"'
```

跑完再 § 3 验证。
