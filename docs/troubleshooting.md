# 故障排除

## CI/CD 问题

### GitHub 提交通道

终端的 Git/`gh` 认证与 AI 已连接的 GitHub 权限是两个独立通道。本仓库已通过授权的 GitHub 连接器完成过提交、PR、合并及发布验收；终端缺少写入凭据不自动代表无法交付。每个新会话都重新核对可用工具与权限，不把某一次云工作区的状态当作永久限制。

1. **先确认授权与环境。** 遵守根 `AGENTS.md` 的部署规则和当前任务授权，用户明确“仅本地/不 push”时同样禁止通过 API 发布。区分维护者电脑、当前云工作区和生产服务器；安装 `gh` 或配置 credential helper 不等于已经登录。只检查必要的非秘密状态，不输出 token、私钥或带凭据的 URL。
2. **核对连接器能力。** 从当前工具列表发现 GitHub 能力，读取目标仓库、最新 `main` 和目标分支；确认工具支持所需写入且连接有相应权限，不能只凭公开仓库可读就宣称可写。缺少终端凭据但连接器可写时，直接继续已获授权的交付流程。
3. **保留本地验证过的完整变更。** 从最新 `main` 建任务分支，保留其他任务的未提交工作，只暂存本次文件。通过 Git Data API 的 tree → commit → branch/ref，或连接器提供的等价操作发布；基于原 tree 应用精确变更，保留未修改文件、删除项和文件模式。核对远端 tree 与本地 `git write-tree` 一致；API 生成的 commit SHA 可能与本地提交不同，后续以实际远端 SHA 为准。工具无法完整表达二进制、LFS 或其他变更时，不静默丢弃。更新已有分支前核对原 head，并使用接口提供的预期 SHA 校验；分支已变化时重新读取并整合，不覆盖其他提交。
4. **按相同规则完成 PR 和发布。** 核对远端分支 SHA、PR head 与改动范围，观察该提交适用的检查；获准合并时按分支保护及当前授权执行。合并后依据 workflow 路径范围检查实际部署和正式入口。连接器/API 不绕过发布授权、分支保护或检查；文档变更按现有路径规则未触发构建时，如实记录，不为制造部署结果手动重建。

向用户和下一位 AI 分别交接：

- **终端状态**：`git push` 是否可用、凭据助手是否只是配置完成、还有什么具体限制。
- **仓库状态**：实际使用的提交途径、分支、提交 SHA、PR 链接及是否已合并。
- **发布状态**：对应提交的检查、实际部署和验收结果；尚未完成的项目单独列明。

已通过连接器提交时，不笼统报告“无法 push，项目未完成”；没有完成终端认证时，也不声称“终端 git push 已配置成功”。只有所有可用且获授权的提交途径都确实受阻，才报告交付阻塞。

确需用户参与认证时，先准备当前环境实际支持的安全登录交接，再说明用户需要完成的具体一步。不要让用户把密码、token 或认证码发到聊天，也不要让用户在自己的电脑登录来替另一台云终端认证。SSH 密钥方案先确认正常连接通道可用；DNS/网络失败与凭据缺失分别诊断，不要求用户添加尚不能使用的公钥。

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
