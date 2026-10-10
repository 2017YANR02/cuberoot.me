# 比赛目录增量同步

前端读取 Git 中保存并发布到 static 的 JSON。CI 是否当天成功不影响已有比赛的展示；CI 只更新快照。所有生成数据由脚本产生，不能手改比赛条目。

## 每日工作

`update_upcoming.yml` 运行 `fetch_upcoming_comps.ts --incremental`：

1. 完整遍历 WCA `competition_index` 轻量索引（每页 100 场，包含最近 14 天）。这是发现新增、改期、改名、地点、项目及报名时间变化的来源；WCA 没有统一的比赛修改游标。不是逐场下载完整资料。
2. 按比赛 id 合并已提交目录。索引缺席不是删除证据；额外查询缺席比赛，只有 `cancelled_at` 明确取消才删除。结束日期早于今天且 `all_past_comps.json` 已收录时交给历史目录；历史更新延迟不会让比赛消失。
3. WCIF 保存响应正文及 ETag/Last-Modified。每天条件请求，304 复用正文，200 才替换。20 小时内复用缓存，基本资料有变化可提前校验。人数不作为跳过依据，因为相同人数仍可能换人。
4. 单场基本详情使用同一机制，未发现索引变化时每 6 天校验一次。WCIF 满 7 天、基本详情满 28 天分批无条件复核，防止关联报名数据变化未更新官方 ETag。周期是进入复核队列的时间，不保证故障或积压时的最大延迟。
5. 每个端点族每轮最多补 100 份缺失快照、复核 100 份过期正文（`--cold-limit` 可降低）。新/已变化比赛优先；其余继续使用保存的数据。缓存丢失不会启动全量详情下载；新比赛基本信息立即进入目录，补充资料逐日补齐。
6. cubing.com 缺少可靠的名单变更标识，沿用当前比赛列表与报名名单的 20 小时缓存；每天核对这些活跃名单，不扫描全部历史比赛。中文名称复用本轮索引，通过共享 `mergeCompetitionNames` 合并，历史名称不会清空。历史名称专项补齐仍可手动运行 `fetch_comp_names_zh.ts`。

所有 WCA 请求共用约 600ms 的启动间隔；详情并发默认 2、最大 4，并遵循 429 退避。无需更改网页消费者及现有 JSON schema。

## 持久化与失败边界

- Git 中五个 JSON 是展示所需的持久数据；Actions 的 `.upcoming_cache` 是可丢失的同步加速层，缓存正文与验证器必须一起保存。
- 快照通过临时文件 + rename 写入；只缓存验证通过的响应。304 没有匹配正文、损坏缓存、HTTP 失败都不能当作空报名覆盖。
- 索引任一页失败、重复整页、异常记录、空目录或页数超限会失败退出，不能发布部分索引。
- 个别 WCA 详情失败发出 workflow warning 并保留旧补充字段；日志记录 downloaded/notModified/reused/deferred/failed。保留旧值意味着信息可能暂时陈旧，不能承诺实时一致。
- 取消的正面证据缺失（例如详情变 404）时继续保留，等待下一次核实；不根据一次 404 删除。
- 缓存使用每次运行独立的 Actions key 并恢复最新快照，单 workflow 并发锁避免相互覆盖；即使作业中途失败，也保存已完成的有效缓存以便续跑。
- 只提交内容变化的文件；Top 列表未变时不单独更新时间戳。数据提交完成后显式触发 `sync_toolkit.yml` 发布 static。

## 审阅与恢复

在 `core/` 运行：

```bash
pnpm --filter @cuberoot/stats-build exec tsx src/bin/fetch_upcoming_comps.ts --incremental --output-dir /tmp/upcoming-review --cache-dir /tmp/upcoming-cache --cold-limit 2
pnpm --filter @cuberoot/stats-build exec tsx src/bin/fetch_upcoming_comps.ts --catalog-only --output /tmp/all_upcoming_comps.json
```

输出目录未提供旧文件时从仓库 stats 读取旧快照；`--output-dir` 便于不改正式生成物的试跑。`catalog_only=true` workflow 输入只恢复目录，保留已有报名/轮次。旧 `--refresh` 参数兼容为增量校验，不再清空缓存。

部署顺序：先发布支持轻量索引及条件请求头/304 响应的 WCA 代理，再执行增量工作流。代理不缓存带鉴权请求、不把代理密钥传给 WCA。
