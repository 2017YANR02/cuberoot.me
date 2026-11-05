# 发布授权与部署契约

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

## 部署

- 提交发布不等待或跟进 CodeQL；其他必要 CI 和部署正常确认。

> **团队提交政策（2026-10-11）**：默认只改本地，不自动提交或推送。用户要求发布时，所有已有仓库写入权限的成员及使用其已授权账号的 AI 均可直接 commit → push main，无需 PR、他人审批或个人豁免。PR 可按需使用。推送前同步最新 main、解决冲突并完成必要验证，推送后确认适用的 CI 和部署结果；GitHub 不再以 PR 或检查通过作为普通推送的前置门槛。保留禁止强推、禁止删除主分支的保护，不夹带他人改动。当次指令优先。

- 小改动不单独提交；同一功能积累较多代码改动后再集中提交，明确要求立即提交时除外。
- 当次明确指令优先：用户说“仅本地/不 push”“只建 PR/先别合并”“不要部署”等时按当次范围执行；仅要求分析或评审的任务不自动变成修改与发布任务。
- 发布授权以本节和当次任务为准；Skill 中的常规 push/上传/workflow 提示不另设重复确认关卡。沿用平台和工具实际提供的权限与交互要求；本授权不授予新账号访问权，也不替代必须由用户完成的安全交接。
- 充分使用用户已经授予且实际可用的仓库写入权限，不擅自扩大账号权限。没有写入权限的贡献者仍通过 PR 交付。需要用户亲自操作或缺少必要信息时，说明具体原因和所需的一步。
- 推送、合并会按当前 workflow 和 Vercel 路径规则触发构建与部署；先核对实际范围，完成后据实报告。纯文档等未触发应用构建的变更不要求手动制造部署。
- 云工作区的终端 `git push` 缺凭据时，先核对已授权 GitHub 连接器的实际写入能力；可用则按团队直推政策或用户指定的 PR 流程继续。流程见 [GitHub 提交通道](../../docs/troubleshooting.md#github-提交通道)。新会话重新核对能力，分别报告终端认证、远端提交和正式部署状态。
- 主域 DNS 分线路:一路自有服务器 nginx→127.0.0.1:3002(systemd `cuberoot-next`;vhost `ops/nginx/`,改 nginx 走 `deploy_nginx.yml`);一路 Vercel(push 自动 build)。
- `static.cuberoot.me`:服 `{tools,stats}/`,CORS:*。`next.cuberoot.me`:同一自有 Next 服务的直连别名,同 :3002,不是独立预发布实例。
- Next standalone:`deploy_next.yml`(push client/shared/visualcube 触发)CI build→scp→原子换+健康检查+失败回滚;unit `ops/systemd/cuberoot-next.service`。
- Vercel 用 `VERCEL=1` gate 跳过 standalone;`app/{stats,tools}/[...slug]/route.ts` 在 Vercel fallback 拉 static.cuberoot.me。
- Vercel CLI 本机已登录:`vercel logs https://www.cuberoot.me` 自查 5xx,免截图。
- CORS allowlist:server `src/index.ts`,函数式放行 `*.vercel.app` + 主域。
- 后端 Hono 服 api.cuberoot.me(nginx→127.0.0.1:3001)。
- DB 迁移随 push 自动跑(`deploy_core.yml` reload 前 `apply_migrations.sh`),禁说要手动 ssh。
- 主域 `/blog` redirect → blog.cuberoot.me(独立 repo)。
