---
name: maintain-sq1-pbl
description: 检查并同步 Daniel's Public PBL Doc 的完整 XLSX 快照。用户说“维护表格”（默认指 SQ1 PBL）、“维护 SQ1 PBL 表格”、“同步 PBL 表格”或“sq1-pbl-drift”，或处理对应 GitHub Issue 时使用。
---

# 维护 SQ1 PBL 表格

在仓库 `core/` 运行唯一入口：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs
```

- `0`：内容和格式一致，或仅讨论批注变化；报告结果后停止。
- `3`：存在内容、结构或格式漂移；按报告逐项同步页面数据和测试，人工检查公式与图片。
- `2`：缺少基线；先确认路径，不要直接创建未知基线。
- `1`：下载或解析失败；修复错误后重跑。

检查本地工作簿时只给 checker 传源文件：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx"
```

完成同步、人工复核 968 个 Raw Algs、963 个推荐 case、频次 10368、四个 unused case 和图片后，才用单一命令同步更新漂移基线与页面快照：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs --write
```

该命令逐文件安全替换生成结果，并在依赖文件写完后最后替换页面 manifest；它不承诺跨目录崩溃事务。命令异常时检查 dirty worktree，修复后重跑，禁止提交半成品。它同时生成 `public/data/sq1-pbl/`、`data/sq1-pbl/cases.json`，并复制已审计的 `finder-defaults.json`。只重建页面数据时用 `--public-write`。

不要直接编辑快照，不要用公式缓存值覆盖规范数据。
