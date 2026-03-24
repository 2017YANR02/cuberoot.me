# cuberoot.me 服务器环境

## 服务器信息

| 项目 | 值 |
|------|-----|
| **域名** | `cuberoot.me` → 301 到 `www.cuberoot.me` |
| **服务器 IP** | `47.97.30.181` |
| **托管** | 阿里云 ECS |
| **OS** | Alibaba Cloud Linux 3.2104 U10（基于 CentOS/RHEL，包管理用 `dnf`） |
| **Web 服务器** | Nginx 1.26.2 |
| **管理面板** | 宝塔面板（端口 8888） |
| **WordPress 路径** | `/www/wwwroot/wordpress/` |
| **Nginx 主配置** | `/www/server/nginx/conf/nginx.conf` |
| **HTTPS** | ✅ 已启用（HSTS + QUIC/h3，SSL 由宝塔管理，Let's Encrypt 自动续签） |
| **多语言** | Polylang 插件（中/英双语，`/zh/` 路径） |
| **磁盘** | 40GB 总量，约 17GB 可用 |
| **Node.js** | v24.14.0（通过 nvm 安装，路径 `~/.nvm/versions/node/v24.14.0/`） |
| **npm** | v11.9.0 |
| **pm2** | v6.0.14（进程守护，`pm2 startup` 已配置开机自启） |
| **pnpm** | v10.32.1（monorepo 包管理器） |

## 国内镜像站 toolkit.cuberoot.me

### 概述

`ruiminyan.github.io`（GitHub Pages）在国内无法访问，因此在阿里云 ECS 上部署了静态镜像。

| 项目 | 值 |
|------|-----|
| **地址** | [toolkit.cuberoot.me](https://toolkit.cuberoot.me) |
| **内容** | `ruiminyan.github.io` 的完整 1:1 镜像（Jekyll `_site/` 构建产物） |
| **根目录** | `/www/wwwroot/toolkit/` |
| **Nginx 站点配置** | `/www/server/panel/vhost/nginx/toolkit.cuberoot.me.conf` |
| **SSL 证书** | `/www/server/panel/vhost/cert/toolkit.cuberoot.me/`（Let's Encrypt，自动续签） |
| **CI 配置** | `.github/workflows/deploy_mirror.yml` |

### 同步机制

```
push 到 main 分支
      │
      ▼
GitHub Actions（deploy_mirror.yml）
      │
      ├── 1. Jekyll build（生成 _site/）
      ├── 2. SSH 连接阿里云
      └── 3. rsync 同步 _site/ → /www/wwwroot/toolkit/
      │
      ▼
toolkit.cuberoot.me 更新（约 40 秒）
```

**自动触发条件**：
| 事件 | 说明 |
|------|------|
| `push` 到 main | 手动推代码/数据时触发 |
| Update Stats CI 完成 | 每周统计更新后自动同步 |
| Update Upcoming Comps CI 完成 | 每日比赛数据更新后自动同步 |

### GitHub Secrets（部署凭据）

存储在 [仓库 Settings → Secrets](https://github.com/RuiminYan/ruiminyan.github.io/settings/secrets/actions)：

| Secret | 用途 |
|--------|------|
| `DEPLOY_SSH_KEY` | SSH 私钥（服务器 `/root/.ssh/github_deploy`） |
| `DEPLOY_HOST` | 服务器 IP |
| `DEPLOY_USER` | SSH 用户名（`root`） |
| `DEPLOY_PATH` | 部署目录（`/www/wwwroot/toolkit`） |

> 对应的公钥已加入服务器 `/root/.ssh/authorized_keys`。

### Nginx 关键配置

宝塔自动生成的站点配置在 `/www/server/panel/vhost/nginx/toolkit.cuberoot.me.conf`，其中有一条**关键规则**：

```nginx
# Jekyll 生成的 .html 文件在 GitHub Pages 上无需扩展名访问
# 例如 /stats/wr_current 实际对应 /stats/wr_current.html
location / {
    try_files $uri $uri/ $uri.html $uri/index.html =404;
}

# Recon 详情页旧链接兼容：/recon/2263 → 301 重定向到 /recon/detail/?id=2263
# NOTE: 新链接统一使用 /recon/detail/?id=X，此规则仅兼容旧书签/分享链接
location ~ ^/recon/(\d+)/?$ {
    return 301 /recon/detail/?id=$1;
}
```

> 如果通过宝塔面板重新配置站点（如改 SSL），可能会覆盖此文件，需要重新加上 `$uri.html` 规则。

### rsync 参数说明

```bash
rsync -rltz --delete --exclude='.user.ini' --chmod=D755,F644 ...
```

| 参数 | 说明 |
|------|------|
| `-rltz` | 递归(r) + 保留软链接(l) + 保留时间戳(t) + 压缩传输(z) |
| `--delete` | 删除远程有但本地 `_site/` 中没有的文件 |
| `--exclude='.user.ini'` | 排除宝塔自动创建的不可删除文件（设了 `chattr +i`） |
| `--chmod=D755,F644` | 目录 755、文件 644，避免权限错误 |

> 不用 `-a`（archive）是因为 `-a` 会尝试同步 owner/group/perms，在 CI 环境下会导致 code 23 错误。

## 故障排除

### 镜像未更新？
1. 检查 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) → "Deploy Mirror to China" 是否全绿
2. 如果红叉，查看日志定位错误（通常是 SSH 连接或 rsync 问题）

### 页面 404？
- 检查 Nginx 配置是否包含 `$uri.html`（见上方 Nginx 关键配置）
- 宝塔面板修改站点后可能覆盖配置，需要重新添加

### SSH 连接失败？
- 检查阿里云安全组是否放行了 22 端口
- 确认 `/root/.ssh/authorized_keys` 包含部署公钥
- 如果密钥丢失，在服务器重新生成并更新 GitHub Secret `DEPLOY_SSH_KEY`

### SSL 证书过期？
- 宝塔默认自动续签，通常无需操作
- 手动续签：宝塔面板 → 网站 → `toolkit.cuberoot.me` → SSL → 续签

## Hono 后端（Trainer API）

| 项目 | 值 |
|------|------|
| **框架** | Hono 4.x + @hono/node-server |
| **部署目录** | `/root/trainer-api/` |
| **端口** | 3001 |
| **进程管理** | PM2（`trainer-api`，`pm2 startup` 已配置开机自启） |
| **凭据文件** | `/root/trainer-api/.env`（DB_*, JWT_SECRET） |
| **API 入口** | `https://toolkit.cuberoot.me/trainer/api/recon/list` 等 |
| **CI 部署** | `deploy_trainer.yml` → build server dist → rsync → `pm2 restart` |

> Nginx 反代配置：`location /trainer/api/` → `proxy_pass http://127.0.0.1:3001/api/`

## MariaDB 数据库（Recon 复盘）

| 项目 | 值 |
|------|-----|
| **数据库** | MariaDB 10.5.27 |
| **数据库名** | `recon_db` |
| **用户** | `recon_user`（仅限 localhost 连接，外网不可直连） |
| **凭据文件** | PHP：`/www/wwwroot/toolkit/recon/api/db_config.php`；Hono：`/root/trainer-api/.env`；本地：`.secrets.md`（均不在 git 中） |
| **表** | `recons`（复盘数据）、`edits`（编辑覆盖）、`edit_history`（编辑历史）、`wca_users`（认证）、`timer_sessions`（计时器同步）、`train_results`（训练记录） |

### 备份策略

| 备份层 | 方式 | 频率 | 位置 |
|--------|------|------|------|
| API 备份 | `backup_recon.yml` CI | 每天 | GitHub 仓库（`recon/backup/recons_backup.json`） |
| 数据库备份 | 宝塔计划任务（Shell 脚本 `mysqldump`） | 每天 03:00 | ECS `/www/backup/recon_db_*.sql.gz`（保留 7 天） |

> ⚠️ 宝塔内置的"备份数据库"任务**不会**备份命令行创建的数据库，必须用 Shell 脚本方式。

### 数据库列重命名

列重命名通过 `index.php` 中的临时管理员端点 `renameColumns2` 执行。流程：

1. **修改代码**：更新 `db.php`（映射表、白名单、MAX_FIELD_LENGTHS、CREATE TABLE）和前端 JS 中的字段引用
2. **更新迁移 SQL**：在 `index.php` 的 `renameColumns2` case 中添加/替换 `ALTER TABLE` 语句
3. **Push 并等 CI 部署**（约 40 秒）
4. **在已登录的 Recon 页面控制台执行**：

```javascript
fetch('https://toolkit.cuberoot.me/recon/api/?action=renameColumns2', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + WcaAuth.getAccessToken() }
}).then(r => r.json()).then(console.log)
```

> 必须先在页面上登录 WCA 账号（管理员），`WcaAuth.getAccessToken()` 从 `localStorage` 读取 token。localhost 和线上均可，只要已登录。

> 获取 WCA access token（用于脚本/API 调用）：在已登录的 Recon 页面控制台执行 `console.log(localStorage.getItem('wca_access_token'))`。Token 有效期约 2 小时（WCA Doorkeeper 默认配置）。

> 已执行过的 ALTER TABLE 会报错但不影响新增的 SQL（`try/catch` 逐条执行）。

## SSH 登录方式

```bash
# 密码登录（密码在阿里云控制台 → ECS → 重置密码）
ssh root@47.97.30.181

# 或使用阿里云网页终端
# 阿里云控制台 → ECS → 实例列表 → 远程连接 → Workbench
```

## 邮件发送（Postfix + Gmail SMTP 中继）

PHP `mail()` 依赖 postfix 通过 Gmail SMTP 中继发送。用于复盘评论通知等场景。

> 阿里云 ECS 封锁出站端口 25，必须通过 587 端口中继。

**迁移服务器时需重新执行以下命令：**

```bash
# 1. 安装
dnf install -y postfix cyrus-sasl-plain

# 2. 配置 Gmail 中继
cat >> /etc/postfix/main.cf << 'EOF'
relayhost = [smtp.gmail.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
smtp_tls_CAfile = /etc/ssl/certs/ca-bundle.crt
EOF

# 3. 创建密码文件（密码从 Google App Passwords 生成，去掉空格）
echo "[smtp.gmail.com]:587 yrmfxc@gmail.com:APP_PASSWORD_HERE" > /etc/postfix/sasl_passwd
chmod 600 /etc/postfix/sasl_passwd
postmap /etc/postfix/sasl_passwd

# 4. 启动
systemctl enable postfix
systemctl restart postfix

# 5. 测试
echo "Test" | mail -s "Postfix Test" yrmfxc@gmail.com
```
