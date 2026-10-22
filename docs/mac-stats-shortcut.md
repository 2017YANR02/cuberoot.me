# Mac「跑打乱统计」快捷指令

这是本机 Mac mini 的个人启动方式。仓库内跨平台的日常入口是在 `core/` 运行 `pnpm stats:scramble`，统计成功后自动发布；只生成本地产物用 `pnpm stats:scramble:local`，只看计划用 `pnpm stats:scramble:local --plan`。

## 进度、断点与资源保护

- 标准阶段及各变体每完成一条就写入输入对应的 `.csv.checkpoint`；进程中断后先校验输入、分析器版本和配置，再只算缺失行。每批完成后按原顺序生成 CSV、同步保存并按 ID 合并，最后清理断点。同一变体跨批次保持同一个分析器 PID 和大表；日志中的 `resident analyzer PID` 可核对。逐行写入可保留进程被强制结束前已完成的记录；磁盘同步在批次结束执行，不保证逐行抵抗断电。
- Mac 整条管道持续监测进程树、内存压力、Swapouts 和至少 2 GiB 保守余量，按当前分析器实际表文件及工作空间设置预算。触线先保存原因再停止本任务，保留结果，不自动重启。记录在 `solver/tables/stats-resources/`（自定义 `CUBE_TABLE_DIR` 时跟随该目录），失败原因也写入 `stats-local-*.json`；监控不代表系统禁用了 swap。
- EO 自动档按启动时可用内存选择现有表配置；显式指定的档位保持不变。实际档位在生成断点校验标识前固定，并记录到本轮资源日志。
- 日常 SQ1 历史难题的可选重试在启动预算不足时跳过，保留 `M` 待解记录和 `partial` 状态，其余产物继续生成、发布；手动指定的求解仍严格校验预算。
- 若历史难题重试已完成，维护续跑可从 `core/` 使用 `CUBEROOT_DATA_ROOT="$HOME/Documents/scramble" pnpm stats:scramble --skip-sq1-grind`。该参数只跳过难题重试，不清除 `M`，仍处理新增 WCA、slash、333opt、构建和发布；资源保护停止后仍须先完成复核。
- 资源保护停止后，先查清原因，核对停止记录与原始启动/Swapouts 基线，完成资源复核后再手动恢复；反复点击快捷指令不会清除保护记录。普通进度仍在终端显示，详细结果看时间戳日志。

2026-10-21 的首次运行因临时监控误设统一 36 GiB 上限而在 EO 阶段停止；当时无新增 Swapouts。高内存 EO 的现有表合计约 40.19 GiB，已改为按表和分析器预算。std、222、223、daisy、first_layer 当时已各保存 479 条增量；旧执行器仅在整批结束写 CSV，EO 当时显示完成的 68 条没有保存，恢复时需重算。

## 本机配置

2026-10-21 退出码修复：本地统计的退出码 `2` 表示全部产物已生成，但 SQ1 等仍有待解/待定状态；原因同时写入终端末尾和 `solver/tables/stats-local-*.json` 的 `partial`。日常发布入口将此状态作为警告继续发布，未解 `M` 不计入精确分布，原始记录保留供续算；真正的子任务失败仍阻止发布。2026-10-20 这一轮为 SQ1 ID `5886113` 在三轮有时限求解后仍未解出，其余结果已保存。若只恢复该轮发布，在确认本地产物仍是该轮结果后，从 `core/` 使用 `CUBEROOT_DATA_ROOT="$HOME/Documents/scramble" pnpm stats:scramble --publish-only`，不重跑计算；该命令会灌 PG、发布最新 Release 快照并上传独立在线分片，统计文件不再提交 Git。

2026-10-17 路径修复：仓库在 `~/Developer/cuberoot.me`，历史统计数据仍在 `~/Documents/scramble`。本机 `.command` 明确导出 `CUBEROOT_DATA_ROOT` 指向后者；尊重显式环境覆盖，并在历史 `wca_scramble/stats/std.csv` 缺失时退出，避免把仓库移动误判为首次全量计算。不要移动、清空旧数据或把 `~/Developer/scramble` 中误启动生成的输入当作历史结果。重新启动前可用 `incremental.ts --dry-run --tsv-dir <现有导出目录> --data-dir <历史 WCA 目录>` 只读核对新增量。

- Apple「快捷指令」中有「跑打乱统计」，已添加到 Dock。
- 该快捷指令只有一个「运行Shell脚本」操作，内容为 `open -a Terminal "$HOME/.local/bin/跑打乱统计.command"`，Shell 选 `zsh`，不以管理员身份运行。
- 在「快捷指令 → 设置 → 高级」中，用户已开启「允许运行脚本」。
- `~/.local/bin/跑打乱统计.command` 是本机文件，不在仓库中。它进入 `${CUBEROOT_REPO:-$HOME/Developer/cuberoot.me}/core`，检测是否已有统计管道进程；没有时运行 `pnpm stats:scramble`。终端把当前任务的百分比在同一行原地刷新，不为 25%、37%、50% 等更新新增行；阶段、错误和最终结果各保留一行。短操作只显示完成结果，重复 ZIP 校验不显示。网络或远端操作若无法可靠测出中途完成量，只显示 0% 和 100%，不按耗时猜测。完整输出写入 `~/.local/state/cuberoot/scramble-stats/` 的时间戳日志，失败时附上日志末尾。结束后窗口保留，便于查看结果。换电脑时先确认文件和仓库路径是否存在，不能只复制快捷指令。

## 2026-09-24 排查记录

2026-09-27 的一次运行已完成 PG 和 static 发布，但最后因本地与远端 `main` 分叉而推送失败。当时的 Git 发布仅将本轮统计提交的差异应用到远端最新提交后推送，不会连带推送本地代码；内容冲突会停止。单行进度显示由启动时加载的过滤器负责，已经运行的旧窗口要到下次启动才使用新版显示。

第一次把同一个 `.command` 放在 `~/Documents/`，快捷指令执行 `open -a Terminal` 打开它时持续卡住。把内容和执行权限相同的副本放在 `~/.local/bin/` 后，快捷指令成功打开终端；从 `/tmp/` 打开一个临时测试脚本也成功。卡住时，`open` 进程的采样栈停在 `_sandbox_extension_issue`。这支持文件访问授权相关的判断，但尚不能证明 macOS 为什么没有弹出提示，也不能推断所有 Mac 都会这样。

Apple 文档确认「文稿」属于受文件访问保护的目录；「允许运行脚本」只负责允许快捷指令执行脚本，不代表授予「文稿」访问权限。无需为了这个个人入口扩大系统隐私权限。

- [Apple：控制 App 对文件的访问](https://support.apple.com/en-ca/guide/security/secddd1d86a6/web)
- [Apple：快捷指令的高级隐私与安全设置](https://support.apple.com/en-au/guide/shortcuts-mac/apdfeb05586f/mac)
