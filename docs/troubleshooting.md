# 故障排除

## CI/CD 问题

### 统计未更新？
1. 检查 [Actions 页面](https://github.com/2017YANR02/cuberoot.me/actions) 中的 `Update Stats` 与 `Sync static toolkit` 是否成功。
2. `stats.yml` 定时或手动运行全量 WCA 统计；普通代码 push 只触发语法检查。打乱统计另走 `core/` 下的 `pnpm stats:scramble`，统计成功后自动发布。明确只要本地产物时用 `pnpm stats:scramble:local`。
3. 核对生成的 JSON 已提交、`sync_toolkit.yml` 已同步静态文件；CI 自动提交会自行处理 `[skip ci]` 和静态同步，不要靠手工加提交标记修复发布。

### 镜像未更新？
1. 检查 `Sync static toolkit` workflow 是否成功；大量文件变更导致路径过滤未触发时，可在获得发布授权后手动运行 `gh workflow run sync_toolkit.yml`。
2. 查看该 workflow 的 rsync/SSH 日志与 `static.cuberoot.me` 实际资源响应。

### 页面 404？
- 核对对应 Next 路由与 `ops/nginx/www.cuberoot.me.conf`；nginx 配置由 `deploy_nginx.yml` 发布，普通页面代码由 `deploy_next.yml` 发布。

### SSH 连接失败？
- 检查服务器安全组的 SSH 端口
- 确认 `/root/.ssh/authorized_keys` 包含部署公钥

### SSL 证书过期？
- `certbot-renew.timer` (systemd) 每 12h 检查，<30 天自动续，续后 deploy hook reload nginx
- 手动 dry-run：`ssh root@cuberoot 'certbot renew --dry-run --no-random-sleep-on-renew'`

## 常见开发问题

### 内存不足
- WCA 统计的 CI 内存参数以 `.github/workflows/stats.yml` 为准；本地从 `core/` 运行 `pnpm --filter @cuberoot/stats-build compute:all` 前先确认 MySQL 和可用内存。
- 全量查询统计（如 `wr_dominance`）在 333 上可能很慢，建议先用小项目验证

### GitHub Actions 默认权限
- `GITHUB_TOKEN` 默认只读（2023 年后的新仓库）
- 解决：workflow 中声明 `permissions: contents: write`

### TypeScript 类型检查
从 `core/` 运行：

```sh
pnpm --filter @cuberoot/stats-build typecheck
```

## 自动化测试（Playwright）

需要验证 DOM 交互时，使用仓库现有的 Playwright MCP 或 `@playwright/test` TypeScript 测试；本地 Web 默认在 `http://127.0.0.1:3000/`。验证命令须对应实际测试文件，不再安装 Python Playwright 或沿用旧的 `localhost:4000/stats` 示例。
