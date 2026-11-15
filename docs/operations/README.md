# 运维与发布

先读 contributing/release.md 的授权和发布契约，再按故障、监控、通知或远程接入进入手册；执行前核对真实 workflow 和 ops。

事实源：.github/workflows、ops/、API/服务配置；history 仅保留当时事件证据。

开始：[本专题入口](troubleshooting.md)。

## 分主题

- [auth](auth/README.md)
- [observability](observability/README.md)

## 文档与登记

- [Mac「跑打乱统计」快捷指令](mac-stats-shortcut.md)
- [Mac 断电与整机故障取证](mac-system-recorder.md)
- [CubeRoot production MCP](production-mcp.md)
- [2026-11-10 历史复盘来源恢复](recon-source-recovery-2026-11-10.md)
- [纪录与比赛通知：邮件及 Android / iOS 推送配置](record-notification-setup.md)
- [员工远程连接申请](remote-access-enrollment.md)
- [故障排除](troubleshooting.md)

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [首页加载与双线路静态资源修复](history/homepage-loading-2026-11-08.md)
- [2026-11-10 双机同步发布与磁盘恢复](history/ops-release-2026-11-10.md)
- [全站首屏取数审计](history/perf-alg-index-and-api-tls.md)
- [重组件懒加载审计（three / cubing.js / maplibre）](history/perf-lazy-loading-audit.md)
- [CodeQL review — 2026-10-07](history/security-codeql-review-2026-10-07.md)
- [Dependency security review — 2026-10-07](history/security-dependency-review-2026-10-07.md)
- [Security review — 2026-10-27](history/security-review-2026-10-27.md)
- [2026-09-22—25 流量事件记录](history/traffic-incident-2026-09-22-25.md)
- [2026-09-22 `/zh/calc` traffic spike](history/traffic-incident-2026-09-22.md)
- [Vercel Firewall large-configuration write failure](history/vercel-firewall-support-2026-09-26.md)
