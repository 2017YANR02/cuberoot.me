# Python → TypeScript / Rust 迁移跟踪

更新：2026-09-23。目标：新的一般业务代码、离线统计和自动化优先 TypeScript；求解器与高性能表生成优先 Rust。只有宿主 API 或成熟科研工具链确实要求 Python 时才保留，并在此写明原因。迁移必须以相同输入的输出核对后切换调用方，不能只改扩展名。仓库的旧文档、外部引文和历史实验不等于当前生产入口。

## 当前清点

迁移前 `rg --files -g '*.py' -g '!solver/vendor/**' -g '!**/node_modules/**' -g '!**/.venv/**'`：自有脚本 **73** 个；本轮移除 3 个，现余 **70** 个。另有 `solver/vendor/nissy-core/` 上游 Python 脚本 6 个，随 GPL 上游源码保留，不在本仓库改写。脚本文件之外，工作流的内联 `python3` 和文档里的调用也列在下面。

| 范围 | 数量 | 状态 / 下一步 |
| --- | ---: | --- |
| `core/jobs/scramble-stats-build/incremental.py` | 1 | **已迁移并移除 Python**。`src/incremental.ts` 处理 WCA ZIP 缓存、TSV、增量、多盲和去宽层；一键管道已切换。已用本地 CSV 及 ZIP/TSV fixture 验证，真实 WCA export 全量验证待数据到位。 |
| `core/packages/client/scripts/sq1-pbl/normalize.py`、`test_normalize.py` | 2 | **待迁移**。`sq1-pbl-check.mjs` / CI 仍调用 Python；须保持表格规范化输出逐行一致，再切 TS。 |
| `core/packages/client/scripts/subset-cjk-heading.py` | 1 | **暂留**。实际字体子集由 FontTools + Brotli 完成，现有脚本是构建期工具；替代前须对字形覆盖和 WOFF2 输出做实证核对。 |
| `core/packages/client/scripts/convert-mano.py` | 1 | **暂留待评估**。MANO/SMPL-X 模型及授权素材依赖专用 Python 工具链；先盘点输入、调用者及模型许可，再定 Rust/TS 替代。 |
| `core/packages/client/scripts/ghost/{extract-reference,analyze-reference}.py` | 2 | **暂留历史复现实验**。PDF 解码与 NumPy/SciPy 几何分析，现有 JS 独立验证/渲染。确定是否仍需复现参考资产，再决定移植或归档。 |
| `scripts/build_pyram_{essential,firstface}.py` | 2 | **待迁移**。离线魔方数据生成，适合 TS/Rust；需对现有生成物做确定性对比。 |
| `scripts/music/{import-lrcget,test_import_lrcget}.py` | 2 | **已迁移并移除 Python**。`scripts/music/import-lrcget.ts` 与 `import-lrcget.test.ts` 覆盖编码、时间戳、只读、应用和幂等。 |
| `design/space/scripts/*.py` | 47 | **保留**。Blender `bpy` 是 Blender 内置 Python API，作者建模、灯光和 `.blend` 编辑必须经 Blender。已有首次增量脚本不得重跑覆盖工程。可把外围编排迁 TS，但不能将 `bpy` 文件机械改写。 |
| `research/reconer/**/*.py` | 15 | **暂留**。已存在 `research/reconer/src/` 的 TypeScript 复盘管道和 `MIGRATION.md` 差分记录；部分 OpenCV、PyTorch、scikit-learn 训练/评估仍在 Python。按研究计划逐项迁移或保留可复现实验，不能破坏基准。 |
| `solver/vendor/nissy-core/**/*.py` | 6 | **保留上游**。仅 vendored 源码和测试/工具，随上游许可证保存；本地 `table_generator` 用 C/Rust 入口，不调用这些 Python。 |

## 非 `.py` 入口

- `.github/workflows/sq1_pbl_drift.yml` 的 `setup-python`：随 SQ1 PBL normalizer 迁移一并去掉。
- `.github/workflows/backup_recon.yml` 的内联 Python：**已换为** `core/jobs/stats-build/src/bin/backup_recon.ts`，待下一次定时工作流验证实际 API 响应和备份 diff。
- `core/jobs/stats-build/scripts/smoke_test_endpoints.sh` 的内联 Python：**已换为** `src/bin/smoke_test_endpoints.ts`，旧 shell 命令仍可调用。
- `design/space/README.md` / `batch.mts` 调用的 Blender Python：属于 Blender 宿主约束，保留。
- `research/reconer/MIGRATION.md` 中的 Python 差分命令：保留到模型/视觉实验有等效验证手段。
- `solver/native/*.c` 是调用 vendored nissy-core C API 的薄封装，由 Rust `table_generator` 与 TypeScript 统计入口编排；不是新增 Python 运行时。

## 本轮已做

1. 统一 WCA 增量取数入口为 TypeScript：`core/jobs/scramble-stats-build/src/incremental.ts`；PowerShell 一键管道从 `core/` 调用 `pnpm --filter @cuberoot/scramble-stats-build exec tsx ...`。
2. 去宽层规则复用运行时中立的 `@cuberoot/shared/normalize-wca-scramble`，Web 与统计 job 使用同一个归一化函数。
3. 运行了 shared build、job TypeScript 检查、client typecheck 和本地 CSV、ZIP/TSV fixture。真实 export 与完整统计管道仍需后续验证；旧实现可从 Git 历史中查看。
4. Recon 备份工作流和 WCA endpoint 烟测已移除内联 Python；对应 TypeScript 入口已接入。
5. LRCGET 歌词导入及其测试已改为 TypeScript，两个 Python 文件已移除。

## 完成标准

- 入口、工作流、文档不再要求 Python，除明确保留的 Blender/科研工具链和 vendored 源码。
- 每项迁移有代表性的真实输入输出对比；先切消费者，后移除已替代脚本。
- 对需要 Python 的例外写明宿主/依赖原因、使用范围和下一次复核条件。
