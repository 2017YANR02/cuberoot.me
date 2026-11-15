# 代码与文档对齐记录（2026-11-15）

状态：`REFERENCE`。基线从 `74327cb685` 开始，检查期间其他任务继续提交至 `8c4ea0ac38`；以当前 checkout 的实际文件为准。本轮只修改文档，不修改产品代码、运行配置或外部审核状态，不自动提交或发布。

## 核对范围与结论

扫描根/Core README、贡献入口、`docs/**/*.md`、`core/docs/**/*.md` 和各 app/package 顶层 README。初次覆盖 221 份文档的相对文件链接；另按以下事实源核对主要现行入口。链接扫描不是全仓所有功能、API 字段和页面行为的逐项验收，也不包括 vendored/upstream 和 `research/reconer` 内部文档。

| 领域 | 当前代码/配置依据（路径相对仓库根） | 文档处理 |
| --- | --- | --- |
| 应用与包边界 | `core/pnpm-workspace.yaml`、`core/apps/{mobile,desktop,harmony}/package.json`、`core/packages/app-ui/src/App.tsx` | 根/Core README 补齐三类薄宿主、五端共享 UI、微信与抖音；移除“iOS 未来增加”和固定 app 数量 |
| Web/API 归属 | `core/packages/client/package.json`、`core/apps/api/package.json`、`core/architecture-boundaries.json` | 保留现役目录和 npm 身份；不将计划中的 apps/web 或重命名写成现状 |
| 架构及部署 | `core/scripts/check-architecture-boundaries.mjs`、`.github/workflows/deploy_{next,core}.yml` | 现行 tracker 指向当前 Platform 验收入口；不根据代码存在补记发布成功 |
| 统计数据 | `.gitignore`、`core/package.json`、`.github/workflows/{stats,wca_data_release}.yml`、`scripts/wca-data/` | 修正根 README 中“统计 JSON committed”；数据通过 Release 管理。统计 MySQL 与在线 API PostgreSQL 分开描述 |
| 好友聊天 | `core/apps/api/src/routes/chat.ts`、`src/utils/chat_repository.ts`、`src/index.ts`、`core/packages/shared/src/chat/contract.ts`、`core/packages/app-ui/src/chat/` | 索引改为已有实现；补充贴纸能力；首版纯文字、轮询与不引入第二账号系统的决策原文保留为历史 |
| Workspace | `core/apps/api/src/workspace/planning.ts`、`routes/workspace.ts` | 核对清单最多 200 项、排期最多 150 项/732 天、版本冲突及接口边界，与 `workspace.md` 对应；不改线上数据 |
| 已安装客户端与小程序 | 宿主 manifests、`app-ui/src/App.tsx`、`core/apps/miniprogram/README.md` 与源码边界 | 路线图区分 Web Bluetooth 和原生 BLE；现行合同不因旧首版范围被降级；小程序继续独立运行时 |
| 双机协作 | 根 `AGENTS.md` 的 2026-11-11 维护者约束 | 删除双机细则中允许 worktree 的过时例外，保持当前 checkout、备份和顺序整合 |
| 备案及商店 | 本轮此前已核实的操作记录 | 保留已完成/审核中/预计日期；代码不能证明备案、交易者审核、银行或税务状态 |

## 清理方式与历史保留

- App 路线图开头 402 行日期批次移入 [mobile-app-history.md](../../mobile-app-history.md)；小程序迭代区 888 行移入 [MINIPROGRAM-history.md](../../../core/docs/MINIPROGRAM-history.md)。原文完整保留，仅把必要的页内链接改为原文档链接；原小节锚点保留查找入口。产品合同、当前状态和待验收清单仍在主文档。
- Platform 旧迁移/完整移植记录明确为 `HISTORICAL`，当前入口统一指向 [platform-modernization-2026-11.md](../../platform-modernization-2026-11.md)。不删除不恢复独立运行时、不迁移虚构数据、复用主站账号等重要取舍。
- 640 处失效相对链接中，628 处指向本机临时或本地资料，12 处指向已不存在的源码路径。将这些链接/图片改为明确的历史引用文本，保留原路径与说明，避免空白图片或把旧路径当当前事实。没有恢复、伪造或删除附件，也没有以附件缺失否定历史决策。
- 不因清理历史而解除原有计算保护、upstream 修改限制、发布条件或真机验收要求。旧批次授权不作为新任务授权。

## 验证与边界

- 架构守卫通过：229 个精确历史依赖身份、252 处引用、38 项手工合同；这些是本次扫描结果，不是永久包数量。
- 两段迁出日志按全文后缀比对通过（仅归一化页内链接），重要决策、失败修正、提交与验证范围没有删减。
- 清理后扫描 225 份文档，相对文件链接缺失为 0；迁移相关文档的 185 个跨文档小节链接检查通过；`git diff --check` 通过。不执行产品构建、全量测试、求解、建表或部署。
- 外部网站、云端配置、真实支付、真机 BLE、审核结果不属于本次代码核对证明范围。过往日期的“未发布/未验收”仅描述当时，不改写为今天的通过状态。
- 其他会话的源码修改保留，不纳入本轮文档改动；新的并行提交可能继续改变事实源，后续实现应同步所属文档。
