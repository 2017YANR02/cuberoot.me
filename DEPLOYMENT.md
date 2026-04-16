# 部署与运维

## 当前状态

✅ **WCA 统计自动更新已上线**

- **地址**：[ruiminyan.github.io/wca-stats/](https://ruiminyan.github.io/wca-stats/)
- **镜像**：[www.cuberoot.me](https://www.cuberoot.me)（自动同步）

## CI 策略

| Workflow | 触发条件 | 内容 | 耗时 |
|----------|----------|------|------|
| **Update Stats** | 定时（每周）/ 手动 | TS 下载 WCA 数据库 + 计算统计 | ~47 分钟 |
| **Deploy Core** | push main 且 `core/` 有变更 / 手动 | pnpm build → commit dist → rsync ECS | ~1 分钟 |
| **Deploy Mirror** | push main / 其他 CI 完成 | 组装静态文件 + rsync 到云 | ~15 秒 |
| **Backup Recon** | 定时（每周一凌晨 4:00）/ 手动 | API 拉取复盘备份 + 增量 WCA 成绩 | ~10 秒 |
| **Update Upcoming** | 定时（每日）/ 手动 | 拉取顶尖选手近期比赛 | ~15 分钟 |

> Push 代码不触发统计 CI。手动触发：[Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) → 选择 workflow → "Run workflow"。

## 部署流

```
push main
  ├── core/ 有变更 → Deploy Core → build + rsync ECS → pm2 restart core-api
  └── 任何 push  → Deploy Mirror → 组装 _deploy/ → rsync ECS
```

## GitHub Secrets

| Secret | 用途 |
|--------|------|
| `DEPLOY_SSH_KEY` | SSH 私钥 |
| `DEPLOY_HOST` | ECS IP |
| `DEPLOY_USER` | SSH 用户（root） |
| `DEPLOY_PATH` | 部署目录 |

## 详细文档

| 主题 | 文件 |
|------|------|
| 项目结构与目录树 | [docs/architecture.md](docs/architecture.md) |
| 本地开发环境搭建 | [docs/development.md](docs/development.md) |
| 统计数据管道 | [docs/stats-pipeline.md](docs/stats-pipeline.md) |
| Recon 复盘 API | [docs/recon-api.md](docs/recon-api.md) |
| 故障排除 | [docs/troubleshooting.md](docs/troubleshooting.md) |
| ECS 运维手册 | [CUBEROOT_ME.md](CUBEROOT_ME.md) |
| Monorepo 开发 | [core/README.md](core/README.md) |


