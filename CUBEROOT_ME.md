# cuberoot.me 服务器环境

## 服务器信息

| 项目 | 值 |
|------|-----|
| **域名** | `cuberoot.me` → 301 到 `www.cuberoot.me` |
| **服务器 IP** | `47.97.30.181` |
| **托管** | 阿里云 ECS |
| **OS** | Alibaba Cloud Linux 3.2104 U10（基于 CentOS/RHEL） |
| **Web 服务器** | Nginx 1.26.2 |
| **管理面板** | 宝塔面板（端口 8888） |
| **WordPress 路径** | `/www/wwwroot/wordpress/` |
| **Nginx 配置** | `/www/server/nginx/conf/nginx.conf` |
| **HTTPS** | ✅ 已启用（HSTS + QUIC/h3，SSL 由宝塔管理） |
| **多语言** | Polylang 插件（中/英双语，`/zh/` 路径） |
| **磁盘** | 40GB 总量，17GB 可用 |

## 镜像部署

`ruiminyan.github.io` 的静态镜像通过 `toolkit.cuberoot.me` 子域名提供国内访问。
详见 `implementation_plan.md`。
