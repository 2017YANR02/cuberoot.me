# Mac「跑打乱统计」快捷指令

这是本机 Mac mini 的个人启动方式。仓库内跨平台的正式入口仍是在 `core/` 运行 `pnpm stats:scramble:local`；统计编排由 `scripts/stats/update-local.ts` 实现。只看计划可运行 `pnpm stats:scramble:local --plan`。

## 本机配置

- Apple「快捷指令」中有「跑打乱统计」，已添加到 Dock。
- 该快捷指令只有一个「运行Shell脚本」操作，内容为 `open -a Terminal "$HOME/.local/bin/跑打乱统计.command"`，Shell 选 `zsh`，不以管理员身份运行。
- 在「快捷指令 → 设置 → 高级」中，用户已开启「允许运行脚本」。
- `~/.local/bin/跑打乱统计.command` 是本机文件，不在仓库中。它进入 `${CUBEROOT_REPO:-$HOME/Documents/cuberoot.me}/core`，检测是否已有 `scripts/stats/update-local.ts` 进程；没有时运行 `pnpm stats:scramble:local`，结束后保留终端窗口以便查看结果。换电脑时先确认文件和仓库路径是否存在，不能只复制快捷指令。

## 2026-09-24 排查记录

第一次把同一个 `.command` 放在 `~/Documents/`，快捷指令执行 `open -a Terminal` 打开它时持续卡住。把内容和执行权限相同的副本放在 `~/.local/bin/` 后，快捷指令成功打开终端；从 `/tmp/` 打开一个临时测试脚本也成功。卡住时，`open` 进程的采样栈停在 `_sandbox_extension_issue`。这支持文件访问授权相关的判断，但尚不能证明 macOS 为什么没有弹出提示，也不能推断所有 Mac 都会这样。

Apple 文档确认「文稿」属于受文件访问保护的目录；「允许运行脚本」只负责允许快捷指令执行脚本，不代表授予「文稿」访问权限。无需为了这个个人入口扩大系统隐私权限。

- [Apple：控制 App 对文件的访问](https://support.apple.com/en-ca/guide/security/secddd1d86a6/web)
- [Apple：快捷指令的高级隐私与安全设置](https://support.apple.com/en-au/guide/shortcuts-mac/apdfeb05586f/mac)
