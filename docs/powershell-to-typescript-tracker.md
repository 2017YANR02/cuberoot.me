# PowerShell → TypeScript 迁移跟踪

目标：仓库自有自动化统一由 TypeScript 编排，求解和大表计算继续由 Rust 执行；Mac、Windows 的日常入口使用同一条 `pnpm` 命令，不要求安装 `pwsh`。不能用 TypeScript 包一层再调用旧 `.ps1` 冒充完成。上游源码、产品中介绍 PowerShell 的内容不属于自动化迁移对象。

2026-09-24 清点方式：`rg --files --hidden -g '*.ps1'`，排除 `.git`、`node_modules`、`target`、`.next`。起点 **52 个文件、约 10,140 行**，当前余 **0 个**；含隐藏的 `.codex/hooks` 和 `.sync`，普通 `rg --files` 起初只看到 34 个。全部仓库自有 `.ps1` 已迁移或退役；真实发布与长跑仍按下面的验收边界单独执行。

| 范围 | 起点 | 当前 | 工作与验收 |
| --- | ---: | --- | --- |
| API 本地开发 | 3 | 全部迁移：本地开发、种表与 `apps/api/scripts/update_sor.mts` 均有 TS 入口 | SOR `--dry-run` 与四套 TSV 小 fixture 已验；真实 sorcalc 长跑和线上 PG 未执行。 |
| 打乱统计 | 12 | 全部迁移：`scripts/stats/` 提供本地一键、增量静态发布、PG 灌库、SQ1 和 xcross 入口 | `pnpm stats:scramble:local` 默认不发布；隔离测试和类型检查通过。全量统计、真实 scp/PG/push 未执行。 |
| `.codex/hooks` | 17 | 已迁移：17 个 PS1 包装层移入回收站；活动 hook 与适配器现为 `.mts`，共用现有 Node 精判器 | `.codex/hooks.json`、`/dev/guards`、测试与文档已同步；Node 24 可直接运行 `.mts`。真实 JSON 的允许/拒绝路径已由针对性测试覆盖；新 Codex 会话中的 `/hooks` 信任和工具拦截仍需会话级验收。 |
| 上游同步与 `.sync` | 9 | 已迁移为 `scripts/upstream/*.ts` 和共享 `lib.ts`；旧入口已移除（根入口另计） | 保留 `--only`、dry-run、版本标记及 fork 边界；TypeScript 合同测试和 workflow 已切换。真实上游同步未在本次迁移中执行。 |
| 音乐 | 2 | 已迁移：`scripts/music/prepare-music.ts` 与 `publish-music.ts`；旧 PS1 移入回收站 | 预处理保留一个批次、20 GiB 硬门槛、保守分类与幂等；发布默认仅本地校验，显式 `--publish` 才连接远端。临时 fixture 验证了只读源、sidecar 绑定、重跑一致、哈希拒绝与本地 rollback；未执行线上发布。 |
| 求解器 | 6 | 全部迁移或退役：WASM、验证、First Layer 和 LSLL 入口均为 TS；opt8 建表入口退役 | `table_generator` 仍是唯一磁盘建表入口；First Layer Rust 固定 14 线程上限已移除。LSLL 长跑和 PG 发布未执行。 |
| 其他 job | 1 | 已退役 `run_all_tests.ps1`；统一使用现有 `src/bin/compute_all.ts`，新增 `compute:all` 命令 | 旧脚本维护一份过时的手工统计名单并在结束后自动休眠；现有 TS runner 从 `REGISTRY` 取清单、逐项记录耗时和成功/失败。 |
| Space | 1 | 已迁移为 `design/space/scripts/batch.mts`，`pnpm space:batch --plan` 已验证 | 编排使用可用 CPU 并行度；Blender 内部 `bpy` 仍必须用 Python，未执行重型导出。 |
| 根入口 | 1 | 已迁移 | `sync_upstream.ts` 由 `pnpm upstream:sync` 调用。 |

## 已切换的命令

在 `core/` 执行：

```sh
pnpm --filter @cuberoot/server dev:local
pnpm --filter @cuberoot/server seed:local-alg
pnpm --filter @cuberoot/server seed:local wiki_terms
pnpm solver:build-wasm
pnpm solver:verify --plan
pnpm solver:first-layer --help
pnpm solver:lsll --help
pnpm sor:update --dry-run
pnpm space:batch --mode city --plan
pnpm stats:progress:sq1 --json
pnpm stats:scramble:local --plan
pnpm stats:scramble:local
pnpm upstream:sync --validate-only
pnpm music:prepare --source-root <只读媒体目录> --staging-root <暂存目录> --plan
pnpm music:publish --library <暂存目录/library>
```

`seed:local` 会重建指定本地表，不能在迁移验证中实际运行到 pg13；已验证 TypeScript 构建和无效表名拒绝。实际远端 dump 与本地恢复尚待有意进行的端到端验收。

## 完成标准

1. 自有脚本无 `.ps1`，活动入口、workflow、hook 配置和运维文档不再调用 `pwsh`。
2. 一键本地统计从表读取到全部 JSON/CSV 产物都由 TS/Rust 管道完成，并自动记录耗时；默认发布语义与迁移前一致，调用方可以显式只本地运行。
3. 关键路径用代表性输入对照旧行为；涉及发布、线上 PG 与大表的步骤先做只读或隔离验证，不能把未执行的真实端到端运行写成通过。
