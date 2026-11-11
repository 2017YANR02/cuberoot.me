# 两台电脑同时开发

GitHub `origin` 是代码交换中心；每台电脑保留独立 checkout、依赖、缓存和开发服务。两机同时开发时，未提交内容本来就可能不同；“同步完成”指双方已交付的改动进入同一远端提交，不代表实时镜像硬盘。

## 日常工作

- 开始任务先 `git status --short --branch`。工作区干净时执行 `git sync`（`git pull --rebase --no-autostash`）；有改动时先检查归属，不自动暂存、提交或切分支。
- 短任务沿用当前 checkout/main。需要跨天、跨设备交接或与其他任务改同一模块时，使用 `codex/<任务名>` 功能分支；不要建立长期的 mini/mbp 分支。分支跟任务走，同一分支同一时刻由一台机器写入。
- 同一 checkout 的多个 AI 不同时执行 Git 提交、rebase、切分支。发布者先收拢本轮已完成改动；其他任务继续编辑时，重新核对文件差异后再提交。需要真正隔离的并行任务才使用独立 worktree，遵循仓库的创建入口。
- 普通任务仍不自动 commit/push。获准发布后先审阅并提交本轮改动，再 `git sync`、解决冲突、做必要验证，最后 `git push`。先提交形成可追溯快照，避免 dirty pull 的自动 stash 恢复冲突。
- push 被拒绝表示别人先推送了：重新 fetch/rebase、核对冲突和验证，再正常 push；不使用强推。已经分享的功能分支如需重写历史，先协调所有消费者，不直接 force-push。

## 两台电脑一起发布

由一个会话顺序操作，不在两机同时发布：

1. 核对双方身份、分支、HEAD、未提交和未推送改动；读取对端 AGENTS。明确“所有人”时才包含其他任务已完成的改动。
2. 第一台审阅、提交、rebase 到最新 `origin/main`，验证并 push。
3. 第二台将自己的改动先提交，再 rebase 到新的 `origin/main`。逐项保留双方意图；相同修改不重复添加。验证并 push。
4. 第一台再次同步最终提交；核对两台 HEAD 与 `origin/main` 一致，工作区状态如实报告。若期间又出现新改动，保留并单独说明，不为了清空状态而覆盖。
5. 跟踪最终变更实际影响的 CI 和部署；没有改动的新 HEAD 不会重新触发所有 workflow，结合最后一次触及该模块的提交核验。遵守[发布验证范围](release.md#发布验证范围)，不额外运行无关原生打包，不跟进 CodeQL。

不以 rsync、网盘或双向文件同步镜像工作仓库，尤其不同步 `.git`、`node_modules`、`.next`、PID、锁、`.env`、私钥和运行中的数据库。大表、断点与结果按[本地文件生命周期](../local-artifact-lifecycle.md)交接，保持单写者。新电脑不能凭复制来的 PID/资源基线续跑旧任务。

## 本仓库 Git 配置

以下设置仅作用于当前仓库；不会修改全局 Git 身份、凭据或其他项目。两台维护者 Mac 已采用相同设置，新设备按此配置：

```sh
git config --local pull.rebase true
git config --local branch.main.rebase true
git config --local rebase.autoStash false
git config --local pull.autoStash false
git config --local fetch.prune true
git config --local push.default simple
git config --local rerere.enabled true
git config --local rerere.autoupdate false
git config --local alias.sync 'pull --rebase --no-autostash'
```

`rerere` 记住本机已解决的冲突；关闭自动暂存后仍须审阅结果。`git sync` 不自动提交、push 或部署。遇到冲突保留现场，用 `git status` 找到冲突文件，修复后 `git add <文件>`、`git rebase --continue`；要退出本轮 rebase 用 `git rebase --abort`，不要 hard reset。

维护者双向 SSH 与自动有线优先配置见各机 `~/.config/devsite/ssh.md`：mini → `ssh mbp`，MBP → `ssh mini`。机器配置通过各机登记维护，Git 仅共享启动逻辑和说明。`cuberoot` 负责重启开发服务，不偷偷执行 Git 同步、提交或发布。

依据：[Git 工作流](https://git-scm.com/docs/gitworkflows)、[git pull 与 autostash](https://git-scm.com/docs/git-pull)、[Git 配置](https://git-scm.com/docs/git-config)。
