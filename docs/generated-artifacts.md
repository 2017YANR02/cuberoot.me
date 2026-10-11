# CubeRoot 生成物登记

状态：`MAINTAINED`。最后更新：2026-09-24。

[generated-artifacts.json](./generated-artifacts.json) 是本仓库受治理生成物、上游快照和数据迁移族的唯一事实源（single source of truth）。artifact ID、来源与 ref、license 证据、生成或同步 owner、patch owner、命令、输出、版本记录和验证入口只在该文件维护，本页不复制清单。

公开页面的第三方署名仍以 `core/packages/client/app/[lang]/about/credits_data.json` 为唯一事实源；artifact ledger 只描述工程归属和可复现性，不能代替面向用户的 credit。

## 生命周期约定

- `checked-in-generated`：只通过登记的 owner 重建并提交；禁止直接手改输出。
- `vendored-sync` / `upstream-fork-deploy`：同步完成且所有后处理成功后，脚本从真实 clone 的 `HEAD` 写入完整 40 位 commit；`--validate-only` 和 `--dry-run` 不得更新版本记录。旧产物缺少可信完整 commit 时，ledger 必须显式登记 `pending-next-successful-sync`，检查器会报告 pending，不能伪装成已验证。
- `immutable-migration-family`：已发布 migration 只读；源数据变化时用登记的 owner 生成新序号 migration，不覆写历史。`.tmp/` 仅是可丢弃中间物。
- `build-output`：由源码和工具链生成、保持 gitignored 的临时产物。五端客户端必须按平台分别记录源码、本机构建、安装、设备/实体电脑、签名/公证和发布证据；一个平台的产物或 unsigned 包不能替代另一层证据。
- 网络同步、全量统计和本机大表不进入普通无网络 CI；廉价且确定的 ledger、generator 和 snapshot 检查可以进入常规守卫。

`outputs`、`outputExclusions` 与 `transientOutputs` 采用仓库相对路径，允许以 `/**` 表示一个 owner 管理的目录树。`runtimeOutputs` 只登记部署或运行时 locator，例如制品根和发布目录模板，不冒充仓库路径。任意实际输出只能有一个 owner；共享 helper 可以复用，但不能因此制造第二个生成入口。

## 维护与验证

从仓库根验证 ledger、owner、输出归属和版本记录接线：

```sh
node scripts/check-generated-artifacts.mjs
```

TNoodle i18n 生成器必须显式接收 checkout 内的 i18n 目录；同一输入可写入或只检查当前 snapshot：

```sh
cd core
node packages/client/scripts/build-tnoodle-i18n.mjs --input <tnoodle-i18n-dir> --write
node packages/client/scripts/build-tnoodle-i18n.mjs --input <tnoodle-i18n-dir> --check
```

新增受治理生成物时，先在 JSON 中登记唯一 ID、owner、source、license、command、outputs 和 verification，再增加生成入口。新增 vendored 条目还必须登记 ref、patch owner 与 version record；禁止把本机绝对路径或手抄 commit 写入生成文件。

不产出稳定源码输出的 build/runtime 临时目录继续由所属 package、workflow 或专题 runbook 管理，不在本页建立第二份 artifact 明细表。

### Page-load data slices

- Competition calendars use `stats/comp_calendar/index.json` for global filters
  and versioned month windows for display. The daily upcoming and weekly history
  workflows rebuild them together. Existing complete catalogs still back global
  lists/search and recover missing or mismatched slices. All month fixtures are
  checked, including adjacent days, source overlap, and 1982.
- Scramble preview shard and synthetic injection checks belong to
  `core/jobs/scramble-stats-build/tests/scramble-example-shards.test.ts` and run
  with the producer's CI aggregation checks. They verify every committed sample;
  the injection fixture copies the existing CLI into a temporary directory,
  uses one solved row, and never invokes a solver or writes published files.
- Cube history retains all research fields in a generated dictionary; source
  citations, domestic-price policy, details, comparisons and JSON export are
  unchanged. After editing research JSON during an open dev session, run
  `pnpm --filter @cuberoot/client build:cube-history` from `core/`. Startup/build
  also regenerate it; CI compares the entire decoded catalog against the source.
- Gallery thumbnails are runtime derivatives, not committed assets. Original
  image URLs/data remain unchanged. Fixed `/v1/article/img/:id/thumb/512|1024?v=1` variants reuse
  `DRIVE_FFMPEG_BIN_DIR` with q90 WebP and no upscaling. Only static WebP without
  ICC/EXIF/XMP is eligible; other images retain their original response. At most
  two single-thread encoders run, eight requests may wait up to one second,
  encoding stops after 2.5 seconds, and the process cache holds at most 16 MiB.
  The native subprocess is registered separately from Drive video compression
  in `core/architecture-boundaries.json`; its 8 MiB input, 4 MiB output,
  8-megapixel decode and 32 MiB per-allocation limits do not constitute a
  process-wide RSS or no-swap guarantee. The API deployment owns the existing
  FFmpeg artifact and its absolute `DRIVE_FFMPEG_BIN_DIR` configuration.
  Failures return original bytes with `no-store`; successful immutable variants
  use dimension paths and version query parameters. An older API returns 404 for
  the new route; the gallery then loads the original URL instead. This prevents
  an old API from caching original bytes as a future thumbnail. Deployment must preserve the query
  string in proxy cache keys. No database migration or new paid service is used.
  The local frontend proxies the live API, so thumbnail delivery only changes
  after the API implementation is separately released (or a local API is used).
