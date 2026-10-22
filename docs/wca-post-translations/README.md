# WCA 全部历史公告中文翻译

用户指定范围：公开 /posts 全部历史公告。2026-10-22 用户确认全文中文译载许可。当前网站工作仅本地保存，不提交、不部署；单独获授权的 GitHub 监测扩展已提交。

## 进度与恢复

完整来源见 snapshots/2026-10-22.json，共 494 篇，2006-03-24 至 2026-10-19；其中 44 篇与既有纪律日志同 URL，按 existingKey 关联 ../wca-log-translations/progress.json，不重复翻译。新增 450 篇以本目录 progress.json 逐条记账，entries/ 保存全文及来源哈希，checkpoints/ 保存逐批恢复点；修改旧版先归档 versions/。

每条待导入译稿 JSON 必须包含 key、sourceHash、title、content、notes。运行：

```sh
node docs/wca-post-translations/import.mts --input <已审阅译稿目录>
node core/packages/client/scripts/build-wca-posts.mts
```

导入时校验来源版本、中文正文及原链接保留；先保存正文再原子替换进度。自行翻译及自查不能标为独立复核。内部疑点记 notes，不显示成网站说明文字。

本地展示：/zh/regulation/post，按日期倒序，只显示日期标题，支持标题搜索、年份筛选及分页；点击进入 /zh/regulation/post/<slug>。英文正文随全站语言切换展示；保留官方来源与匿名，不将历史条目改写成当前状态。不展开文章外链的论坛、附件、申请材料等正文。

## 每日监测与翻译

GitHub .github/workflows/wca_news_drift.yml 每日 08:23 UTC 和手动运行 check.mts --posts --publish。扩展提交 5573dfbc3aa3f43a8e89f930fb4deca57b1e1da0，仅包含监测工作流、脚本、测试、README 和 Posts 基线。验证运行：https://github.com/2017YANR02/cuberoot.me/actions/runs/39746617954 ，成功。

原 incidents:<id> 与 disciplinary:/posts/<slug> 处理规则见 ../wca-log-translations/daily-processing.md。新增 posts:/posts/<slug> 进入本目录；同 URL 纪律公告沿用原纪律 key。保留 Issue 的 wca-news-drift key/hash 标记，按版本去重；修订前归档旧译文，新来源保存新快照，禁止重置基线吞掉变更。当前抓取失败、缺失旧 key、分页移动都禁止发布部分结果。

新指纹已有全文译文则复用，不能把基线当作翻译完成清单。导入脚本读取 progress.snapshot；新增来源须先保存完整快照并更新该引用，再导入；不要把旧版本强行匹配新 hash。完成翻译后重建网站数据，按授权发布并验收后才关闭对应 Issue。

现有每日处理任务继续使用，不新建定时任务。网站生成文件由 build-wca-posts.mts 产生，禁止手工改写。所有进行中的网页及译文改动保持未提交。

## 中文表达约定

采用中文魔方圈惯用表达，术语以站内 wiki/glossary.json 为准。保留完整原意和历史背景，按中文语序组织句子，避免机械直译、英文句式和宣传套话；不添加原文没有的评价。日期、数字、规则条件、证据强弱和处分范围优先保证准确。源文有疑点时写入内部 notes，不靠改写消除歧义。

## 本轮完成记录

2026-10-22：494/494 篇历史公告已在本地网站收录，450 篇新增全文译文、44 篇复用既有纪律译文，待译 0。原文覆盖 2006-03-24 至 2026-10-19。最终恢复点 `checkpoints/450-complete.json`；结构与版本校验报告 `validation/450-complete.json`；导入中断恢复实测 `validation/import-recovery.json`。全部译文已完成译者自检，450 篇仍保留 `pending_independent_review`，不冒充独立逐条审校。

23 篇含内部备注，汇总 `notes-index.json`。既有日志 188 条仍保持175条审校通过、13条源文待核验，详原日志账本。新公告的正文、源链接、日期、条件和历史语境完整保留；未扩展翻译外部附件。

本地浏览器已核验最新公告单篇阅读与2006年筛选/最早公告正文；列表仅日期、标题及分页筛选。8项页面元数据/术语检查、6项安全渲染检查通过。08:53 UTC 的页面类型检查通过；最终 09:00 UTC 前后全项目复验受同期模拟器未提交改动阻挡：PuzzleDrawWorkspace.tsx 的 DrawExport/null 回调类型，以及 SimPage.tsx 引用已删除的 FtoImageGenerator 和相关属性类型。相关模拟器文件不属于本任务，未修改。最新数据以构建脚本从账本生成。网站、译文及交接文档没有提交、推送或部署；仅明确获授权的监测工作流已更新并通过GitHub运行。

2026-10-22 路径调整：公告列表及正文迁至 `/zh/regulation/post`（英文 `/regulation/post`），旧 `/news` 列表及正文直接404，不设重定向。规则首页新增“全部公告”入口，最新动态卡片继续保留。既有论坛声明路径为 `/zh/regulation/post/wic-investigation-2026`。当前站内链接、页面元数据和站点地图均已更新；历史数据库通知的旧目标在读取时规范为新链接，不修改远端数据库。HTTP验收见 `validation/post-route-migration.json`。
