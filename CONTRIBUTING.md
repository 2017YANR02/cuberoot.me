# PR 提交与合并规范

本仓库采用小团队自查流程：**人工改动通过 PR 合并到 `main`；作者自查并通过必要检查后，有写入权限的作者可以自行合并，不要求其他成员审批。** 外部贡献者仍需由有合并权限的成员执行合并。

## 新员工从这里开始

内部员工统一在 **`2017YANR02/cuberoot.me` 原仓库建立自己的功能分支**，再向同一仓库的 `main` 提 PR。不要把个人 Fork 当作日常团队提交入口。外部贡献者没有原仓库写入权限时，仍可通过 Fork 提交。

阅读顺序：本页（协作流程）→ [AGENTS.md](./AGENTS.md)（开发约定）→ [README 的本地开发入口](./README.md#local-development) / [开发环境说明](./docs/development.md) → 所改模块适用的 [.agents/skills](./.agents/skills/)。不需要一次读完所有模块 skill。

### 1. 维护者开通权限

1. 新员工提供自己的 GitHub 用户名。
2. 仓库所有者打开本仓库的 **Settings → Collaborators → Add people**，邀请该用户；员工接受邀请后获得协作者读写权限。当前仓库属于个人账号，不需要寻找组织仓库的角色下拉框。参见 [GitHub 官方邀请步骤](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)。
3. 员工使用自己的 GitHub 身份进行 Git 认证。公开仓库能 clone 不代表有写入权限；应确认已接受协作者邀请。
4. 写入权限用于推送自己的功能分支；`main` 仍由 PR 与必需检查保护。普通开发不需要仓库管理员权限，也不需要维护者的服务器、数据库密码或自动任务 Deploy Key。

### 2. 克隆原仓库，检查 origin

在准备存放项目的目录运行（示例使用新目录，保留已有个人 Fork 的工作副本）：

```sh
git clone https://github.com/2017YANR02/cuberoot.me.git cuberoot-team
cd cuberoot-team
git remote -v
```

`origin` 的 fetch 和 push 地址都应指向 **`2017YANR02/cuberoot.me`**。使用 SSH 时，`git@github.com:2017YANR02/cuberoot.me.git` 也正确；若显示自己的 GitHub 用户名，说明当前工作副本仍指向个人 Fork。

已有个人 Fork 时，不要删除旧目录或覆盖未提交改动。可以继续完成旧 PR，后续任务从上述新目录开始；在原仓库创建新分支不会自动把旧 Fork PR 的来源迁过来。若确需迁移进行中的改动，先保存工作，再将选定提交移到原仓库功能分支，并在新旧 PR 中说明关系，避免重复合并。

### 3. 建功能分支并开发

以下命令在原仓库工作副本的根目录执行；先确认工作目录没有需要保留的未提交改动。示例分支名每个任务换一个，不复用同事的分支。

```sh
git status --short
git fetch origin
git switch -c fix/my-first-change origin/main
```

按 `.node-version` 安装 Node，按 `core/package.json` 的 `packageManager` 使用 pnpm。首次安装依赖在 `core/` 运行：

```sh
cd core
pnpm install --frozen-lockfile
```

随后按 README 和 AGENTS.md 启动开发服务、执行必要验证。个人电脑上的 `cuberoot` 快捷命令或预览域名不会随 clone 自动配置；需要设备预览域名时走 [开发预览接入说明](./docs/dev-preview-onboarding.md)。

### 4. 第一次提交 PR

完成改动后回到仓库根目录，先用 `git status` 和 `git diff` 审阅差异，再 `git add` 本次明确修改的文件，提交并推送自己的分支：

```sh
git commit -m "fix(module): describe the change"
git push -u origin fix/my-first-change
```

在原仓库 GitHub 页面点击 **Compare & pull request**（或 **Pull requests → New pull request**），确认：

| 项目 | 应选择的值 |
| --- | --- |
| 目标仓库 / base repository | `2017YANR02/cuberoot.me` |
| 目标分支 / base | `main` |
| 来源仓库 / head repository（如显示） | `2017YANR02/cuberoot.me` |
| 来源分支 / compare | 自己的功能分支，例如 `fix/my-first-change` |

按自动出现的模板填写问题、改动和验证。后续修正继续提交、推送同一分支，PR 会自动更新。作者完成自查，`PR checks` 通过且无冲突后，可自行合并；不需要再找同事批准。

### 5. 预览与正式上线

内部原仓库分支的适用改动按 Vercel 项目配置自动创建预览，通常不需要 Fork 授权。预览构建变为 **Ready** 后再打开 **Preview / Visit Preview**；纯文档等未影响应用的改动可能被忽略构建，不必为了预览强制部署。

Fork PR 可能需要 Vercel 团队成员授权。授权时从 **最新提交的 Vercel 检查 → Details** 进入，并核对提交 SHA；旧机器人评论里的链接可能只批准旧提交。GitHub 仓库协作者和 Vercel 团队成员是两套权限，不要把“接受 GitHub 邀请”当成“已加入 Vercel 团队”。参见 [Vercel 的 Git 部署说明](https://vercel.com/docs/git)。

预览成功不等于正式上线。合并 `main` 后核对该提交实际触发的部署，再检查线上效果；未合并的预览不会自动替换正式网站。

## 开始工作

- 阅读 [AGENTS.md](./AGENTS.md) 和所改模块适用的 skill，复用现有组件、契约与生成入口。
- 内部员工先确认 `origin` 指向 `2017YANR02/cuberoot.me`，再从最新 `origin/main` 创建分支；一个 PR 解决一个明确问题，保留其他人的未提交改动。
- 人工分支建议用 `fix/简短主题`、`feat/简短主题` 或 `docs/简短主题`；Codex 默认用 `codex/简短主题`。
- 不提交凭据、个人配置、构建缓存或无关文件；生成物按 [生成物契约](./docs/generated-artifacts.md) 更新。

## 提交 PR

- 目标分支选 `main`。尚未完成时可以开 Draft，准备好后标记 Ready for review；这个按钮表示可合并准备阶段，不代表必须找别人审批。
- 标题使用 `类型(模块): 改动内容`，例如 `fix(stats): 自动刷新纪录保持天数`。常用类型为 `fix`、`feat`、`refactor`、`docs`、`chore`。
- 按 [PR 模板](./.github/pull_request_template.md) 写明原问题、最终行为、验证结果及未验证项。UI 改动附必要截图或录屏，注明语言、主题和设备。
- 验证只覆盖实际风险；简单文档、文案或样式修改无需为了凑数新增测试。涉及计算、安全或明确回归风险时做最小必要检查。必要构建仍须完成。
- 所有 pnpm 命令在 `core/` 运行，版本以 `core/package.json` 为准。Web 常用验证为 `pnpm --filter @cuberoot/client typecheck`；单文件测试用 `pnpm --filter @cuberoot/client exec vitest run tests/文件名.test.ts`。不要用 `test -- 文件名`。
- dev 正在运行时不要在同一个工作目录运行 Next build。shared 源码改动后刷新 shared 构建；小程序源码改动后刷新小程序 dist，具体遵守 AGENTS.md。
- 首屏 render / useState 初始化不能读取当前时间、随机数或浏览器存储；先提供稳定首屏，再按项目约定更新。

## 作者自查与合并

1. 在 Files changed 检查完整差异，确认没有无关修改；按模板记录自查结果，无需自己提交 GitHub Approve（作者不能批准自己的 PR）。
2. 查看 Checks。失败时阅读对应日志，在原分支修复并推送；同一 PR 会自动更新，不用重新开 PR。检查取消、未运行或等待均不等于通过。
3. 必需检查为 GitHub Actions 的 **PR checks**。它汇总 Test 工作流中全部测试任务：变更检测和主检查必须成功，其他任务允许按影响范围跳过；任一失败或取消都会阻止合并。
4. 每个 PR 都会触发 Test 工作流，纯文档变更也能得到合并检查结果，昂贵任务仍按影响范围选择。不要在人工 PR 提交信息中使用 `[skip ci]` 等跳过标记，否则必需检查可能一直等待。
5. CodeQL、Vercel 等其他检查有自己的触发条件，应查看并处理其结果，但不把有条件出现的状态作为所有 PR 的固定必需项。Vercel 提示授权时，由已有权限的团队成员从最新提交的 Vercel 检查 → Details 进入并核对提交 SHA 后授权；它不代表编译失败。
6. 自查完成、必要检查通过且无冲突后，有写入权限的作者可自行合并。单一主题通常选 **Squash and merge**，合并标题和描述须准确概括最终改动。需要保留独立提交历史时可使用其他仓库允许的方式。
7. 合并后核对该提交实际触发的 CI、部署和线上效果。提交、合并、部署成功、设备或业务验收分别报告；纯文档未触发应用部署时无需手动部署。

## main 保护与自动任务例外

- 人工提交必须经过 PR，必需检查通过；审批人数为 **0**，不要求 Code Owner 或最新推送者以外的人审批。
- 必需检查绑定 GitHub Actions 来源，禁止用同名个人状态替代；管理员不设人工绕过例外。
- 不强制每次合并前同步最新 main，避免统计自动更新反复使已通过检查过期；有冲突或基础实现变化影响本 PR 时，作者应同步 main 并重新验证。
- 经维护者确认，现有 GitHub Actions 统计、比赛列表和备份任务保留直接更新 main 的能力。四个工作流（`stats.yml`、`update_upcoming.yml`、`elev_backfill.yml`、`backup_recon.yml`）使用仓库专用 Deploy Key，私钥保存在 Actions secret `AUTOMATION_PUSH_SSH_KEY`，不进入 Git。GitHub 的 Deploy Key 绕过规则覆盖仓库所有 Deploy Key，不按单个密钥、文件或工作流名称限制；当前只配置这一个自动推送密钥，后续新增可写密钥须同时评估其绕过权限，不得借它代发人工代码。
- 禁止删除 main 和强推的现有规则独立保留，自动任务同样不能绕过。维护规则时不要把自动任务例外加到这两条规则上。
- 自动任务继续使用 `[skip ci]` 提交生成物，并保留现有显式部署/同步步骤；Git 推送用 Deploy Key，GitHub API 操作继续用 GITHUB_TOKEN。Deploy Key 推送可能触发 push 工作流，不能再依赖 GITHUB_TOKEN 的递归触发抑制。
- 轮换自动推送密钥时，同步更新仓库 Deploy Key 和 `AUTOMATION_PUSH_SSH_KEY`，验证后移除旧密钥。撤销自动直推例外前，先把这些任务迁为 PR 流程，避免定时发布失败。

实际配置以仓库 [Rules](https://github.com/2017YANR02/cuberoot.me/rules) 为准；修改 CI 任务时同步维护 `PR checks` 的依赖列表与工作流契约测试。必需检查的路径过滤与 `always()` 原则见 [GitHub 官方说明](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)。
