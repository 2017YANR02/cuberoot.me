# nginx config (cuberoot.me)

云服务器 nginx vhost 配置的 source-of-truth。

## 部署流程

改动 `ops/nginx/*` 文件 → push main → `.github/workflows/deploy_nginx.yml` 自动:

1. scp 新 conf 到服务器 `/tmp/`
2. 备份当前线上 conf 为 `<原文件>.bak-<unix-ts>`
3. 用新 conf 替换 `/etc/nginx/vhost.d/<file>`
4. `nginx -t` 校验
5. **失败则自动回滚**到刚才的 .bak,workflow 标失败
6. **成功则** `nginx -s reload`

## 回滚

线上服务器:

```bash
ssh root@cuberoot
cd /etc/nginx/vhost.d/
ls -t www.cuberoot.me.conf.bak-* | head -3   # 找最近的 .bak
cp www.cuberoot.me.conf.bak-1778088000 www.cuberoot.me.conf
nginx -t && nginx -s reload
```

历史 `.bak` (Phase F 之前的,在 panel 路径下) 已归档至 `/root/archive/nginx-vhost-backups/`。

或直接在本地 git revert 生成 conf 的提交,push,workflow 会重新部上去。

## 注意

- 2026-05-06 Phase F 把 vhost 从 `/www/server/panel/vhost/nginx/` 迁到 `/etc/nginx/vhost.d/`,nginx.conf include 路径同步改了。卸 panel 不再影响 vhost。
- ssl_certificate 路径 `/etc/letsencrypt/live/cuberoot.me/` 是 certbot 标准位置,跟 panel 无关。
- 改动 conf 时,**不要**改 `proxy_cache cache_one;` 这种全局开关 —— 那是宝塔 `/www/server/nginx/conf/proxy.conf` 注入的;之前已 disabled。
