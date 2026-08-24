# CubeRoot 生成物登记

状态：`REFERENCE / PARTIAL`。最后更新：2026-08-23。

本页登记生成、同步或发布时产生的主要 artifact 类别。`source` 是可修改事实源；`output` 若标为生成物则不得直接手改。命令从所列 cwd 执行，workflow 或专题 runbook 比本表的简写更具体时，以它们为准。

`PARTIAL` 是有意保留的：表内 `GAP` 表示目前还不能从任意 clone 稳定重建或自动证明零漂移。本页先把事实写准，不把缺失的 generator、版本记录或 CI 守卫描述成已经存在。

## 类型与漂移策略

| 类型 | 处理方式 |
| --- | --- |
| checked-in generated | 生成后提交；廉价且确定性的生成器适合在 CI 重跑并检查 diff |
| upstream snapshot / vendored sync | 记录上游 URL、branch、commit、license 与本地 patch owner；人工审阅后同步 |
| build output | 不提交，或由平台工具维护必要的 tracked 配置；build/release check 证明可生成 |
| runtime generated | workflow 或启动流程临时产生，不作为源码手改 |
| immutable history | migration 等一旦发布只读；修改 source 后生成新版本，不重写旧文件 |
| local heavy artifact | 依赖本机大表或原生工具；普通 CI 只校验 schema、manifest、hash 或小 fixture |

## 已核实登记

| ID / 类型 | Source → Output | 重建入口 | Owner | Drift check / 编辑政策 |
| --- | --- | --- | --- | --- |
| `stats.wca` / checked-in generated | `core/packages/stats-build/src/**`、WCA dump → `stats/` 下的主统计产物（根 JSON、`records/**`、`historical/**`、`sor_over_time/**` 等）与加载用临时 TSV；不含另有 owner 的 `scramble/**`、`tutorial/**` 和下行 upcoming 文件 | 单项调试：cwd `core`，`pnpm --filter @cuberoot/stats-build compute <stat-id>`；全量只按 `.github/workflows/stats.yml` 的 `compute_all.ts` 与后续步骤运行 | `@cuberoot/stats-build` + `stats.yml` | workflow 自己生成、校验、提交并加载，不是独立的 regen-diff 守卫；builder、传输清单和 load SQL 三处必须同步 |
| `stats.upcoming` / checked-in generated | WCA/WCIF 与比赛名数据 → `stats/{upcoming_comps,all_upcoming_comps,cn_upcoming_registrations,comp_names_zh,comp_elevations}.json` | `.github/workflows/update_upcoming.yml` | `update_upcoming.yml` | 日更 workflow 生成并提交；与主统计管线分开 |
| `stats.scramble` / local heavy artifact | `core/packages/scramble-stats-build/src/**`、`solver/` 本机表和样本 → `stats/scramble/**` | cwd `core`：按目标运行 `pnpm --filter @cuberoot/scramble-stats-build build:*`；完整流程按对应 runbook/Skill | `@cuberoot/scramble-stats-build` + solver owner | 普通 CI 不重算大表；用 fixture、schema、数值 baseline 和已提交结果测试，产物不得手调数字 |
| `tools.blddb` / vendored sync | blddb 上游与 `scripts/upstream/sync-blddb.ps1` → `tools/blddb/**` | cwd repo root：`pwsh -NoProfile -File .\sync_upstream.ps1 -Only blddb` | `scripts/upstream/sync-blddb.ps1` + `tools/blddb/UPSTREAM.txt` | 已有上游记录；根 `_sync_blddb.ps1` 仅为已确认仓外调用保留兼容；同步后审阅本地包装与 license |
| `tools.cstimer-scramble` / vendored sync | csTimer 上游与 `scripts/upstream/sync-cstimer-scramble.ps1` → `tools/cstimer-scramble/**` | cwd repo root：`pwsh -NoProfile -File .\sync_upstream.ps1 -Only cstimer` | `scripts/upstream/sync-cstimer-scramble.ps1` + `tools/cstimer-scramble/UPSTREAM.txt` | 已有上游记录；同步后审阅站内调用契约 |
| `client.regulation-verbatim` / upstream snapshot | WCA 规则源、`reg-check.mjs`、`build-reg-clauses.mjs` → source snapshot、hash 与 `_data/reg-clauses/_full.json` | cwd `core`：`node packages/client/scripts/reg-check.mjs --write`，再运行 `node packages/client/scripts/build-reg-clauses.mjs` | client regulation + `regulation_drift.yml` | workflow 检测漂移后自动重建逐字全文镜像并开 PR |
| `client.regulation-illustrated` / human-authored derivative | 已审阅的规则变化 → `/regulation/<slug>` 图文讲解 | 按 `update-regulation` 流程人工改写 | client regulation | workflow 只开或更新 issue；不得把图文版描述成自动生成 |
| `client.event-icons` / checked-in generated | `components/EventIcon/svg/**` → `svg-map*.ts` | cwd `core/packages/client/components/EventIcon`：`node gen-svg-map.mjs` | `components/EventIcon` | `icons_drift.yml` 只比较上游和本地 SVG；当前没有在普通 CI 重生成 map 并检查 diff |
| `client.place-zh` / checked-in generated | WCA 城市、GeoNames、`scripts/place-tail-zh.json` → `lib/data/place-zh.ts` | cwd `core/packages/client`：`node scripts/gen-place-zh.mjs`，再运行 `node scripts/merge-place-zh.mjs` | client localization | coverage test 检查新增城市；外部数据与人工审阅的尾部翻译属于 source，不直接改输出 |
| `client.cn-region` / checked-in generated | cubingchina `data.sql` → `lib/data/cn-region.ts` | cwd `core`：`node packages/client/scripts/gen-cn-region.mjs [data.sql]` | client localization | 生成物头禁止手改；输入默认路径只是本机便利值，CI 不假装拥有外部 source |
| `client.pg-facts` / checked-in generated | simulator engine → `app/[lang]/sim/engine/pgFacts.generated.ts` | cwd `core`（PowerShell）：`$env:GEN_PG_FACTS='1'; pnpm --filter @cuberoot/client exec vitest run tests/gen_pg_facts.gen.test.ts` | client simulator | 输出路径从测试文件位置推导，可跨 clone；生成较慢，普通测试默认 skip，改 bridge/generator 时必须显式重建并审阅 diff |
| `client.sq1-pbl` / upstream snapshot + immutable history | 公共表格、normalize/checker → `data/sq1-pbl/**` 与新 migration | cwd `core`：`node packages/client/scripts/sq1-pbl-check.mjs [--write]` | client alg data + `sq1_pbl_drift.yml` | scheduled workflow 只报 drift；人工复核后写 snapshot，并以新 migration 发布，不改旧 migration |
| `client.best2x2-source` / upstream snapshot | 公共表格 → `scripts/best2x2/source-snapshot/*.jsonl` 与 `source.hashes.json` | cwd `core`：`node packages/client/scripts/best2x2-check.mjs [--write]` | client alg data + `best2x2_drift.yml` | 21 sheet hash 定时检查；`--write` 只更新已审阅 source snapshot |
| `client.best2x2-import` / local intermediate + immutable history | source snapshot / 抓取结果 → `.tmp/best2x2/**` → import JSON → 新 migration | 按 `core/docs/best-2x2-algs-port.md` 的 fetch、report、build-import、SQL generator 与 verify 顺序运行 | client alg data + alg-build + server schema | `.tmp` 是 gitignored 中间物；发布结果是新的顺序 migration，不能把 snapshot、中间物与已发布 migration 当成同一生命周期 |
| `client.cubing-worker` / build output | cubing 依赖与 `scripts/build-cubing-worker.mjs` → `public/cubing-chunks/**` | cwd `core`：`pnpm --filter @cuberoot/client build` | client build | gitignored；build 成功和 bundle smoke 是验收，不提交构建目录 |
| `client.deskpet-cube` / checked-in generated | `scripts/deskpet-cube/**` → `public/deskpet/cubing/**` | cwd `core/packages/client`：`node scripts/deskpet-cube/build-cubing.mjs` | client deskpet | 文件头禁止手改；目前没有廉价的 stale-output diff 守卫 |
| `mobile.android-assets` / checked-in generated | 品牌 SVG 与 `gen-android-assets.mjs` → PWA、Android density 与 splash assets | cwd `core`：`pnpm --filter @cuberoot/mobile assets:android` | `@cuberoot/mobile` | Test workflow 重建并检查 tracked/untracked diff，是推荐范本 |
| `mobile.capacitor-tracked` / tool-managed source tree | `capacitor.config.ts`、依赖与 Capacitor CLI → tracked Android Gradle/config 文件 | cwd `core`：`pnpm --filter @cuberoot/mobile cap:sync` | Capacitor/mobile | 带 `DO NOT EDIT` 的 tracked 文件由 Capacitor 更新；审阅并提交必要变化 |
| `mobile.capacitor-build` / build output | mobile Web source 与 Android project → `dist/`、`.gradle/`、`**/build/`、本机配置 | mobile build / Gradle | Capacitor/mobile | 这些目录已 gitignore，不作为 source 或 tracked generated artifact |
| `miniprogram.dist` / build output | `packages/miniprogram/src/**`、project config → `packages/miniprogram/dist/**` | cwd `core`：`pnpm --filter @cuberoot/miniprogram release:check` | `@cuberoot/miniprogram` | build state 与 fingerprint 校验源码一致性；dist 不作为手改 source |
| `server.cubeopt-runtime` / local heavy artifact | 经审阅且 variant 一致的 CubeOpt opt5/h5 或 opt6/h6 构建 → `CUBEOPT_ARTIFACT_DIR/current.json` 指向 `bundles/<bundle>/{manifest.json,module,wasm,table}`；manifest 锁 schema、bundle、variant、protocol、固定文件名、source、bytes 与 SHA-256 | cwd `core`：`pnpm --filter @cuberoot/server cubeopt:prepare -- --store <store> <args>`；`cubeopt:promote -- --store <store> --bundle <id>`；`cubeopt:verify -- <store>`；发布后 `cubeopt:smoke -- --store <store>` | `@cuberoot/server` + `packages/server/CUBEOPT_ARTIFACT.md` | 大表和 bundle 不入 Git/普通 CI；prepare 先在同文件系统 staging 校验再原子 rename 为不可变 bundle，promote 校验后原子替换 current 指针；首次启用新 store 时，部署期 `provision.mjs` 从旧 module 文件名派生真实 variant，并严格校验同 variant WASM/table 后幂等迁移；校验同时锁定 wrapper 引用与 WASM 内嵌 variant 标记，改名重哈希不能伪装另一 variant；Server runtime 不保留 legacy fallback；普通测试用 opt5/opt6 小 fixture 验契约与无 Web 路径回退，真实 daemon smoke 属制品/发布验收；不得独立覆盖 module、WASM 或 table |
| `deploy.next-start` / runtime generated | `deploy_next.yml` 模板步骤 → 发布包内 `start.sh` | `.github/workflows/deploy_next.yml` | Next deploy workflow | workflow 临时生成并随产物验证，不在源码树手建副本 |
| `solver.tables-wasm` / local heavy artifact | `solver/` Rust source、表生成器与本机 tables → native/WASM/`pkg-*` | 按 `solver/` 对应 loop/runbook，重计算最多 14 线程 | solver | 大表和 build output 不入库；用版本、表大小/hash、fixture 与目标 runtime smoke 验收 |

## 已核实但尚未闭环的登记

| ID | 当前事实 | 缺口 |
| --- | --- | --- |
| `tools.other-vendored` | 各 vendor 实现已集中到 `scripts/upstream/`，根目录只保留统一入口与 BLDDB 兼容 shim | 缺统一的逐 vendor URL、branch、commit、license、patch owner 清单；`sync_toolkit.yml` 是发布 workflow，不是 source 生成器或 drift owner |
| `client.tnoodle-i18n` | `_tnoodle-i18n.ts` 文件头称由 `scripts/build_tnoodle_i18n.mjs` 从外部 checkout 生成 | 仓库内没有该脚本，文件头还记录本机绝对 source 路径；补回可复现 generator 前只能视为 legacy checked-in snapshot |
| `client.event-icons-map-drift` | `gen-svg-map.mjs` 可重建映射 | 缺普通 CI 的 generator-diff 检查；现有 `icons_drift.yml` 不覆盖 map 是否过期 |
| `client.deskpet-cube-drift` | builder 命令明确且输出已提交 | 缺只重建并检查 diff 的廉价守卫 |
| `server.generated-migrations` | 部分 alg/wiki/import 流程会产出新 migration；已发布 migration 属 immutable history | 没有一个通用 generator；需要按数据族分别登记 source、命令与 owner，不能笼统写成单一 server 生成管线。已发布 migration 的 drift check 为 N/A，验证点是 PG13 fresh/upgrade |

## 明确不是生成物

- `app/[lang]/dev/stack/_lib/stack_meta.ts` 是人工维护的 landing-card metadata；完整说明仍由 `stack_tools/<slug>.tsx` 维护。
- `docs/generated-artifacts.md` 当前是人工 SSOT，不是机器 manifest。

## 下一步验收

1. 为 vendored tool 补逐项 source/version/license/patch owner 矩阵。
2. 恢复或重写 TNoodle i18n generator，去掉 clone 绝对路径并验证确定性输出。
3. 增加机器可读 artifact manifest 与路径唯一 owner 检查。
4. 只把廉价、确定、无网络的 generator-diff 放进普通 CI；网络同步、全量统计和本机大表继续走独立 workflow/runbook。
