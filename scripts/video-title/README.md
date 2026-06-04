# video-title

WCA 比赛视频标题生成工具(本地用,生成 YouTube/B站 双语标题 + 话题标签)。
从已退役的 `D:\cube\wca-monitor` 仓搬入(2026-06-04),只摘了 `gen_title.py` 真正
需要的纯函数闭包,不含任何监控/推送/邮件代码。

## 用法

```bash
# 交互模式
uv run --with requests python gen_title.py
# 命令行:给标题关键词,自动匹配近期纪录或回退 WCA REST 查
uv run --with requests python gen_title.py "5.55 3x3 NR Avg Nahm"
# 列出 WCA Live 全部近期纪录
uv run --with requests python gen_title.py --list
# 指定视频发布者(选手名优先从这取,不从标题猜)+ 频道 ID
uv run --with requests python gen_title.py "标题" --uploader "频道名" --channel-id "ID"
# --write <目录>:把 info_chs.md / info_eng.md 写到上传目录
uv run --with requests python gen_title.py "标题" --write "D:\cube\upload-video"
```

唯一第三方依赖是 `requests`。

## 文件

| 文件 | 作用 |
|------|------|
| `gen_title.py` | 主程序(纪录匹配 + WCA REST 回退 + 话题标签) |
| `wca_live_records.py` | WCA Live recentRecords 查询 + 单条格式化(从 wca_record_monitor.py 抽出的精简子集) |
| `record_format.py` | 纪录文案格式化(中英双语、国旗、洲际/国家纪录后缀) |
| `wca_rankings.py` | WCA Top100 世界排名(算 `/WRxx` 后缀),自带 3 天缓存 |
| `wca_local_names.py` | WCA Live 英文名 → "English (本地名)" 补全,自带缓存 |
| `monitor_utils.py` | `country_flag` 等共享小工具 |
| `build_channel_aliases.py` | 从 YouTube 订阅导出(subscriptions.txt)批量精确匹配 WCA 选手,填 `channel_aliases.json` |
| `channel_aliases.json` | YouTube 频道名/ID → WCA ID 映射(命中即跳过搜人;运行时自动追加) |
| `rankings_cache.json` `wca_local_names_cache.json` | 本地缓存(gitignored,缺了会重新拉) |

## 边界说明(重要)

- **线上监控(纪录/比赛/PR 推送)已用 TS 重写在 `core/packages/server/src/monitors/`,Python 监控全退役。**
  本目录只是本地视频标题工具,**不跑任何后台监控、不推 Bark、不发邮件**。
- `record_format.py` 是 `core/packages/server/src/utils/record_format.ts` 的**独立 Python 副本**,
  供本工具离线用。两者各自演进;若改了纪录文案口径需要本工具同步,手动改这份 Python。
- 原 `gen_title.py` 通过 `import wca_record_monitor` 间接拽进 email_notifier(google OAuth)、
  pr_cache、watched_ids、config.json 整条监控链。搬入时改为只 import 精简的 `wca_live_records.py`,
  因此 **不需要 config.json / token.json / credentials.json**(那些是邮件 + 监控的,Bark key 已在服务器 env)。
