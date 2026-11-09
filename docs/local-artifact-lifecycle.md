# 本地文件生命周期

## 存放与恢复

| 内容 | 位置 | 维护方式 |
| --- | --- | --- |
| 程序源码、配置模板、依赖清单 | 所属模块，提交 Git | Git 同步；不能只存在某台机器 |
| 常规 solver 表 | `solver/tables/` | 按版本复制；不可自动重建大表 |
| CubeOpt 固定版本表、冻结构件和验证证据 | `.local-data/cubeopt-reverse/` | 保留版本目录；配套辅助表、主表、报告必须完整 |
| ZBLL 输入、计算日志与断点 | `.local-data/double-zbll-*/` | 未完成任务停止写入后交接；已完成 symmetry-v2 按维护者授权只保留最终题库、统计与完整性元数据，见[专项记录](double-zbll-trainer.md) |
| 日常统计运行证据 | `.local-data/scramble-stats-opt10/` | 每次运行独立记录；主数据仍使用原统计数据根目录 |
| 复盘领取状态、待提交结果、测试历史 | `.local-data/recon-*/` | 待提交结果必须保留；在线队列继续按领取/租约协调 |
| 本地复盘数据库和视频 | `core/.local-data/recon-capture/` | 使用既有配置；数据库按逻辑备份恢复，不热同步数据库目录 |
| 其他旧研究结果与未知用途文件 | `.local-data/` 登记目录或 `.local-data/archive/` | 保留待审；不把未知文件当垃圾，不默认加载或执行归档源码 |
| 一次性截图、工作暂存、可恢复缓存 | `.tmp/png/`、`.tmp/scratch/`、`.tmp/cache/` | 不得成为唯一成果或正式运行依赖 |

Git ignored 只表示不提交，绝不代表可以删除。尚未提交的报告、下载失败后要重试提交的结果、计算断点都属于持久数据。完成后需要留作证据的临时产物，先提升到持久目录，再清理工作区。

## 迁移与双机

`local-artifact-paths.json` 记录本轮历史路径映射，不记录密码、令牌或文件内容。`node scripts/local-artifacts/migrate.mjs` 只列计划，`--apply` 同盘移动，不覆盖已有目标，不删除原始证据、不运行引擎。每次移动记入 `.local-data/migrations/tmp-2026-11-09/moves.jsonl`，保留 inode 与前后状态。文件冲突须保留双份再处理。

固定表和冻结版本可在两机各存一份；可变任务结果使用单写者，切换电脑前停止写入并交接。PID、进程锁、领取租约和当前 boot/Swapouts 基线不能复制后冒充另一台机器的有效运行状态。历史证据可归档，不能因此续跑被停止的研究任务。

冻结 manifest、报告及源码快照保持原字节；其中旧 locator 由 `scripts/local-artifacts/paths.mjs` 根据已登记映射解析，不建立 `.tmp` 软链接。活动源码与守卫修改后，旧的源码哈希/机器资源审批可能不再适用；保留失败关闭和既有停止记录，不自动重审或启动。

## 防止再次发生

- Codex `apply_patch` 守卫：拒绝在未登记临时命名空间写文件，拒绝把表、数据库、凭据和断点写入临时目录；拒绝源码新增未登记临时路径依赖。
- `node scripts/local-artifacts/check.mjs` 扫描受管源码；pre-commit 检查暂存区，独立 `Local artifact lifecycle` CI 扫描提交的完整树。
- `local-artifact-policy.json` 的例外精确到文件及完整一行，必须说明可丢弃性或不可改写的历史 locator。不设置整个 solver/job 的豁免。
- 测试 fixture、第三方 vendored 代码及历史实验缓存的范围有明确区分；静态检查无法推断所有动态拼接、外部程序或人工终端写入。它不是操作系统写入权限控制。
- 新会话需要信任更新后的 Hook 定义。向脚本输入 JSON 的逻辑验证不能代表当前会话已启用真实工具拦截。

本轮执行记录见 [迁移跟踪](local-artifact-migration-2026-11-09.md)。
