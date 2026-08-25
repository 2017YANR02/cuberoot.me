# tools/ — gen_title 视频标题生成器(TS)

WCA 比赛视频标题生成工具(本地用,生成 YouTube/B站双语标题 + 话题标签)。
2026-06-04 从退役的 Python(`scripts/video-title/`)整体重写为 TS,落在 server 包是为了**直接复用权威的
`../utils/record_format.ts`,消灭原先的 `record_format.py` 副本**(全站纪录文案只此一份)。

这些文件**不被 `index.ts` 引用**,不进 server bundle(esbuild 只从 index.ts 打包),只被 typecheck。
是手动 CLI,不跑任何后台监控、不推 Bark、不发邮件。

## 用法(从 `core/` 跑)

```bash
# 交互模式
pnpm --filter @cuberoot/server gen-title
# 命令行:给标题关键词,自动匹配近期纪录或回退 WCA REST 查
pnpm --filter @cuberoot/server exec tsx src/tools/gen_title.ts "5.55 3x3 NR Avg Nahm"
# 列出 WCA Live 全部近期纪录
pnpm --filter @cuberoot/server exec tsx src/tools/gen_title.ts --list
# 指定视频发布者(选手名优先从这取)+ 频道 ID
pnpm --filter @cuberoot/server exec tsx src/tools/gen_title.ts "标题" --uploader "频道名" --channel-id "ID"
# --write <目录>:把 info_chs.md / info_eng.md 写到上传目录
pnpm --filter @cuberoot/server exec tsx src/tools/gen_title.ts "标题" --write "D:\cube\upload-video"
```

无第三方运行时依赖(只用 Node 内置 fetch/fs + 已装的 tsx)。**自包含:只联网,不碰 PG**
(世界排名 live 拉 WCA Top100,本地名走 WCA REST,各自 3 天/进程级缓存)。

## 文件

| 文件 | 作用 |
|------|------|
| `gen_title.ts` | 主程序(纪录匹配 + WCA REST 回退 + 话题标签 + 交互/命令行) |
| `wca_live_records.ts` | WCA Live recentRecords 查询 + 单条格式化(包装 `../utils/record_format.ts`) |
| `wca_rankings.ts` | WCA Top100 世界排名(算 `/WRxx` 后缀),自带 3 天缓存 |
| `wca_local_names.ts` | WCA Live 英文名 → "English (本地名)" 补全,自带缓存 |
| `build_channel_aliases.ts` | 从 YouTube 订阅导出(subscriptions.txt)批量精确匹配 WCA 选手,填 `channel_aliases.json` |
| `channel_aliases.json` | YouTube 频道名/ID → WCA ID 映射(命中即跳过搜人;运行时自动追加) |
| `rankings_cache.json` `wca_local_names_cache.json` | 本地缓存(gitignored,缺了会重拉) |
| `run_tests.ts` `test_input.csv` | 联网整合回归(7 真实用例,黑盒 spawn gen_title 对比期望;`/WRn` 排名做模糊匹配抗漂移) |
| `test_rankings.ts` | wca_rankings 冒烟测试 |

测试跑法(联网,不进 CI):`pnpm --filter @cuberoot/server exec tsx src/tools/run_tests.ts`(输出写
`test_output.txt`,gitignored)。

## 与服务器监控的关系

线上纪录/比赛/PR 推送已用 TS 重写在 `../monitors/`,那套查**本地 PG**(`monitors/names.ts` enrichName、
`routes/wca_stats_extra.ts` worldRankTop100)。本工具是离线 CLI,刻意走 live-fetch 而非 DB,所以
`wca_rankings.ts` / `wca_local_names.ts` 与监控那套是两份不同实现(不同语境),不冲突。**唯一共享的是
`record_format.ts`**(权威纪录文案)。
