# PR 提交与合并规范

**内部员工在 `2017YANR02/cuberoot.me` 原仓库建分支、提 PR，不使用个人 Fork。**

## 首次开始

- 联系维护者开通仓库写入权限，并接受 GitHub 邀请。
- 克隆原仓库，确认 `git remote -v` 中的 `origin` 指向 `2017YANR02/cuberoot.me`。
- 环境与启动命令见 [README](./README.md#local-development)，开发约定见 [AGENTS.md](./AGENTS.md)。

## 日常流程

1. 从最新 `origin/main` 新建自己的功能分支，一个 PR 解决一个问题。
2. 完成修改和必要验证，检查差异，只提交相关文件。
3. 推送分支，向原仓库 `main` 提 PR。标题写成 `fix(模块): 改动内容` 或 `feat(模块): 改动内容`，按模板填写改动和验证结果。
4. 自查代码并查看检查结果；失败就在原分支修复、推送，PR 会自动更新。
5. **`PR checks` 通过、无冲突后，作者可自行合并，不需要其他人审批。** 通常选择 **Squash and merge**。

想提前看效果，等 Vercel 预览变为 **Ready** 后点 **Preview**。正式网站要等合并后部署成功，再确认线上效果。
