# WCA 历史日志中文翻译进度

本目录保存 **2026-10-22 05:46 UTC** 读取的官方日志正文、中文译文、版本与独立审校证据。历史裁定、人员任职及处分不能自动视为当前状态。仅在本地保存，未提交、推送或发布。

## 覆盖与验收

- Incidents：144 条公开已解决事件，144 条官网正文已译。
- Disciplinary：44 篇官网正文已译，含招募、任命等文章。
- 合计 188 条；已逐条独立对照 188 条，21 条共 24 处修正已保存为 v2 并再次独立对照。
- 独立验收通过 175 条；13 条原文歧义/矛盾待核验。没有待应用的语言修正。
- `independentReviewCoverage=188` 表示实际对照覆盖；历史字段 `independentlyReviewed=175` 表示通过验收，`pendingIndependentReview=13` 表示未最终通过，不表示这 13 条未被阅读。
- 审校由六个与初稿编写过程分离的代理完成，不是人工审校或外部事实验证。每条审校绑定来源指纹和被审译文指纹；修正后再次核对当前版本。
- **另补齐链接公告首帖全文 1 篇**：`disciplinary:/posts/important-announcement-about-blindfolded-solving` 官网正文只是一句引导。已找到官方归档 `https://www.worldcubeassociation.org/archive/forum_topics/388#p1640`，首帖 Ron，2008-02-26 22:11:59 UTC。旧 phpBB 链接由父任务确认 404。用户确认首帖翻译许可后已完整翻译并独立对照，未纳入社区回帖；仍未授权公开发布。
- 其他外链论坛、报告、政策、图像保持引用，未计入正文分母；`not_fetched` 仅表示未读取。

## 文件与恢复

- `progress.json`：唯一任务清单，逐条 ID、URL、来源日期/指纹、译文版本/指纹及翻译、审校、发布状态。`core/scripts/wca-news/baseline.json` 只是监测基线，不能代替翻译进度。
- `snapshots/2026-10-22.json`：188 条原始完整正文快照，未因译文修改而覆盖。
- `entries/*.json`：188 个现行双语条目，保留历史原文、引用、匿名和处分范围。
- `versions/<key-safe>/<translationHash>-v<version>.json`：本轮修订前 188 条归档；旧检查点可按译文 hash 恢复，不能覆盖旧文件。
- `checkpoints/188-review-round-1-applied.json`：修正应用后的安全检查点；`188-review-round-1-final.json`：再次审校后的最终检查点。此前 12 个检查点原样保留。
- `reviews/round-1/report-1.json` 至 `report-6.json`：完整逐条独立意见；`recheck-1.json` 至 `recheck-6.json`：21 条修正后的再次核对。
- `reviews/round-1/summary.json`：最终计数、修正次数及剩余条目；`priority-notes.json`：初始 17 条专项疑点的逐条处理结果。
- `review-notes.json`：21 条保留备注的记录，其中部分为已通过正文审校的范围说明；以状态和 `unresolvedNotes` 判断是否未决。
- `supplements/forum-388-full.json`：旧论坛首帖原文、译文、来源/译文指纹及审校；证据见 `reviews/round-1/recheck-forum-full.json`。早期摘要保留并标记已由全文替代。
- `rights-audit.json`：许可边界证据。网站代码 GPL 和成绩导出许可不能自动覆盖日志/论坛全文；用户已确认归档388首帖翻译许可，其余内容未取得明确公开译载许可，全部内容均未授权发布。
- `external-references.json`：外链获取/覆盖状态；`source-audit.json`：来源和 GitHub 清点证据。
- `verification.json`、`checkpoint-recovery.json`：结构/指纹/链接/审校证据/检查点恢复校验结果。
- `daily-processing.md`：父任务现有每日任务的准确交接规则。

只读验证（仓库根目录，Node 24+）：

```sh
node docs/wca-log-translations/validate.mts
```

本命令不联网、不构建、不运行求解或统计。检查 188 个来源与现行译文、293 个来源链接关联、独立审校证据绑定及全部 14 个检查点的 1816 个历史译文绑定。不能替代语义或许可核验。

## 剩余项

原文待核验 13 条：Incidents `4, 11, 26, 48, 53, 62, 74, 115, 169`；Disciplinary `integrity-committee-digest-2024-q4`、`integrity-committee-digest-2025-q2`、`wdc-monthly-digest-july-2019`、`wic-digest-2024-q3`。详见逐条备注，不猜改数字、主体、机构或条款号。旧论坛首帖全文缺口已补齐，未扩展到其他外链报告。

公开 push、PR、merge、部署或将内容写入网站/Issue 评论前，需确认内容许可并取得对具体材料及目标的用户授权。审校通过不等于公开授权，也不自动关闭 drift Issues。本轮没有新建定时任务、修改监测基线或合并旧 main；仓库内其他并发工作的改动均未触碰。
