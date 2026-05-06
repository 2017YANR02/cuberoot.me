# 完全卸载 MariaDB 步骤(2026-05-06+ 观察期满后)

> **场景**: 2026-05-06 后端从 MariaDB 迁到 PostgreSQL 13。MariaDB 已 stop+disable
> 但数据文件保留作热备。1-2 周观察期满、PG 一切正常后,执行此文档彻底卸载
> MariaDB,释放磁盘 + 清理服务。
>
> **执行时**: 把这整个文档丢给一个 AI 助手让它"跟着做,不要跳步,每一步先验证"。
> 或者用户自己 ssh 进去逐步跑。

---

## ⚠️ 执行前必读

1. **服务器是宝塔面板(BT panel)装的** —— MariaDB 不在 `/var/lib/mysql/`(默认),
   而在 **`/www/server/mysql/`**(binary)+ **`/www/server/data/`**(数据);**绝对**
   不要碰 `/www/server/` 下面其它子目录(nginx / php / panel 本身)。

2. **不能用 `apt purge`**(不是 apt 装的)。卸载 = 直接 rm 文件 + 删 systemd unit。

3. **dump 备份**已存在两份:
   - 生产:`/root/backups/recon_db_mariadb_final_2026-05-06.sql.gz`(~1.2 MB)
   - 本地:`D:\cube\ruiminyan.github.io\.tmp\recon_db_mariadb_final_2026-05-06.sql.gz`
   - 任意一份都能 `gunzip -c | mysql` restore 整个数据库。**这俩文件至少留半年**。

4. **删错了能不能 rollback**?见文末 § 5。简短答案:能,只要 dump 文件还在 + 装回 MariaDB。

---

## 1. Pre-flight 验证(确认现在删是安全的)

ssh 上服务器,逐项确认。**任何一项不通过就停下来,不要继续**。

```bash
ssh root@cuberoot
```

### 1.1 PG 服务正常 + server 在跑

```bash
# PG 应该 active
systemctl is-active postgresql
# expect: active

# server 应该 online (pm2)
pm2 list | grep core-api
# expect: status = online, uptime > 0

# 健康检查 — 直接打到生产 (经 nginx 反代)
curl -sS https://www.cuberoot.me/api/health
# expect: {"status":"ok","timestamp":...,"db":"connected"}
```

### 1.2 MariaDB 当前状态(确认是 disabled 不是 active)

```bash
systemctl is-active mysqld
# expect: inactive

systemctl is-enabled mysqld
# expect: disabled

ss -tnlp | grep ':3306' || echo "✓ port 3306 free"
# expect: ✓ port 3306 free

ps aux | grep -iE 'maria|mysql' | grep -v grep | head
# expect: (empty)
```

### 1.3 dump 备份在

```bash
ls -lh /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz
# expect: 文件存在,~1.2 MB
```

如果备份不见了,**立即停下**,先重启 MariaDB 重做一份 dump 再继续:
```bash
systemctl start mysqld
mysqldump -u recon_user -pRecon2026!Cube --single-transaction --routines --hex-blob recon_db | gzip > /root/backups/recon_db_mariadb_final_$(date +%Y-%m-%d).sql.gz
systemctl stop mysqld
pkill -TERM mariadbd  # 杀 SysV wrapper 留下的子进程
```

### 1.4 server `.env` 确认指向 PG 不是 mariadb

```bash
grep -E '^DB_(HOST|PORT|USER|NAME)' /root/core-api/.env
# expect:
#   DB_HOST=127.0.0.1
#   DB_PORT=5432    ← 关键:5432 不是 3306
#   DB_USER=recon_user
#   DB_NAME=recon_db
```

如果 `DB_PORT=3306`,**绝对不能继续**,server 还在用 MariaDB,删了会全站 502。

---

## 2. 删除 MariaDB 文件

**前提**: § 1 全部 ✓。

### 2.1 看下要释放多少磁盘(可选)

```bash
du -sh /www/server/mysql /www/server/data /etc/my.cnf 2>/dev/null
df -h /
```

### 2.2 真删

```bash
# 服务定义(SysV init script,宝塔装在这)
rm -f /etc/init.d/mysqld
rm -f /usr/lib/systemd/system/mysqld.service
systemctl daemon-reload

# 配置
rm -f /etc/my.cnf /etc/my.cnf.d/*.cnf 2>/dev/null
rmdir /etc/my.cnf.d 2>/dev/null  # 可能不存在,不强求

# 二进制 + 数据(这是大头,几百 MB)
rm -rf /www/server/mysql
rm -rf /www/server/data

# /tmp 里的 socket 残留
rm -f /tmp/mysql.sock /tmp/mysql.sock.lock 2>/dev/null

# /etc/mysql/ 也清掉(以防万一别处装过)
rm -rf /etc/mysql 2>/dev/null
```

### 2.3 删 mysql 系统用户(可选,占用很少)

```bash
# 看是否还有用户
id mysql 2>&1

# 有就删
userdel mysql 2>&1
groupdel mysql 2>&1
```

---

## 3. Post-delete 验证

### 3.1 确认 MariaDB 真的没了

```bash
which mysql mysqld mariadbd 2>&1
# expect: not found

systemctl status mysqld 2>&1 | head
# expect: Unit mysqld.service could not be found.

ls /www/server/mysql /www/server/data 2>&1
# expect: No such file or directory

ss -tnlp | grep ':3306' || echo "✓ port 3306 still free"
# expect: ✓ port 3306 still free
```

### 3.2 确认 PG + server 还正常(没误删)

```bash
systemctl is-active postgresql
# expect: active

pm2 list | grep core-api
# expect: online

curl -sS https://www.cuberoot.me/api/health
# expect: {"status":"ok","db":"connected"}

curl -sS https://www.cuberoot.me/api/recon/list 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'recons')"
# expect: 数百条 (不是 0,不是 error)
```

### 3.3 看磁盘释放了多少

```bash
df -h /
```

应该比 § 2.1 看到的多了几百 MB free space。

---

## 4. dump 备份保留策略

`/root/backups/recon_db_mariadb_final_2026-05-06.sql.gz` **至少留到 2026-11-06**(迁移
后半年)。期间任何时候发现"PG 数据缺了一行/丢了一个旧字段",都能从 dump 里挖。

半年后想清掉:
```bash
rm /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz
```

本地 `D:\cube\ruiminyan.github.io\.tmp\recon_db_mariadb_final_2026-05-06.sql.gz` 同样
保留半年再删。

---

## 5. Rollback(如果某天发现 PG 出严重问题想退回 MariaDB)

理论上**不应该需要**(PG 已经稳定运行,且代码已经全面 PG 方言)。但完整步骤:

```bash
# 1. 装回 MariaDB(用宝塔面板装最稳,跟原来路径一致)
# 或者用 dnf:
dnf install -y mariadb-server mariadb

# 2. 启服务
systemctl enable --now mariadb  # (可能叫 mariadb.service 或 mysqld.service)

# 3. 创建 recon_user + recon_db
mysql -u root -e "
  CREATE DATABASE recon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'recon_user'@'localhost' IDENTIFIED BY 'Recon2026!Cube';
  GRANT ALL ON recon_db.* TO 'recon_user'@'localhost';
"

# 4. restore dump
gunzip -c /root/backups/recon_db_mariadb_final_2026-05-06.sql.gz \
  | mysql -u recon_user -pRecon2026!Cube recon_db

# 5. 改 server .env: DB_PORT=3306
sed -i 's/^DB_PORT=.*/DB_PORT=3306/' /root/core-api/.env

# 6. 但代码已经是 postgres@3 driver,要回到 MariaDB driver 必须 git revert 整个迁移:
#    本地: git revert <PG migration commits>...
#    push 触发 redeploy
```

**注意 rollback 会丢观察期内 PG 上写入的新数据**(2026-05-06 到 rollback 那天之间的所有
新 recons / comments / alg 编辑),除非也从 PG dump 一份再合并回 MariaDB。这种合并很
痛苦,不建议。

---

## 总结一行命令(✓ 跑过 § 1 验证后)

```bash
ssh root@cuberoot bash -c '
  rm -f /etc/init.d/mysqld /usr/lib/systemd/system/mysqld.service /etc/my.cnf /tmp/mysql.sock*;
  systemctl daemon-reload;
  rm -rf /www/server/mysql /www/server/data /etc/mysql /etc/my.cnf.d;
  echo "✓ removed";
  df -h /;
'
```

跑完再 § 3 验证 PG 仍正常即可。
