# CubeRoot 生成物登记

状态：`MAINTAINED`。最后更新：2026-08-25。

[generated-artifacts.json](./generated-artifacts.json) 是本仓库受治理生成物、上游快照和数据迁移族的唯一事实源（single source of truth）。artifact ID、来源与 ref、license 证据、生成或同步 owner、patch owner、命令、输出、版本记录和验证入口只在该文件维护，本页不复制清单。

公开页面的第三方署名仍以 `core/packages/client/app/[lang]/about/credits_data.json` 为唯一事实源；artifact ledger 只描述工程归属和可复现性，不能代替面向用户的 credit。

## 生命周期约定

- `checked-in-generated`：只通过登记的 owner 重建并提交；禁止直接手改输出。
- `vendored-sync` / `upstream-fork-deploy`：同步完成且所有后处理成功后，脚本从真实 clone 的 `HEAD` 写入完整 40 位 commit；`-ValidateOnly` 和 `-DryRun` 不得更新版本记录。旧产物缺少可信完整 commit 时，ledger 必须显式登记 `pending-next-successful-sync`，检查器会报告 pending，不能伪装成已验证。
- `immutable-migration-family`：已发布 migration 只读；源数据变化时用登记的 owner 生成新序号 migration，不覆写历史。`.tmp/` 仅是可丢弃中间物。
- 网络同步、全量统计和本机大表不进入普通无网络 CI；廉价且确定的 ledger、generator 和 snapshot 检查可以进入常规守卫。

`outputs`、`outputExclusions` 与 `transientOutputs` 采用仓库相对路径，允许以 `/**` 表示一个 owner 管理的目录树。`runtimeOutputs` 只登记部署或运行时 locator，例如制品根和发布目录模板，不冒充仓库路径。任意实际输出只能有一个 owner；共享 helper 可以复用，但不能因此制造第二个生成入口。

## 维护与验证

从仓库根验证 ledger、owner、输出归属和版本记录接线：

```powershell
node scripts/check-generated-artifacts.mjs
```

TNoodle i18n 生成器必须显式接收 checkout 内的 i18n 目录；同一输入可写入或只检查当前 snapshot：

```powershell
Set-Location core
node packages/client/scripts/build-tnoodle-i18n.mjs --input <tnoodle-i18n-dir> --write
node packages/client/scripts/build-tnoodle-i18n.mjs --input <tnoodle-i18n-dir> --check
```

新增受治理生成物时，先在 JSON 中登记唯一 ID、owner、source、license、command、outputs 和 verification，再增加生成入口。新增 vendored 条目还必须登记 ref、patch owner 与 version record；禁止把本机绝对路径或手抄 commit 写入生成文件。

不产出稳定源码输出的 build/runtime 临时目录继续由所属 package、workflow 或专题 runbook 管理，不在本页建立第二份 artifact 明细表。
