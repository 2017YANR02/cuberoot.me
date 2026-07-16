# monitors/ — wca-monitor 推送套件(TS 移植)

把生产 Python `/opt/wca-monitor`(独立进程 + 4 个 systemd)整套搬进 core-api(Hono)进程,
去掉跨 repo Python spawn 与本地 JSON 台账,统一走 PG + env。文案渲染复用已 1:1 移植的
`../utils/record_format.ts`(经 `../routes/wca_format.ts` 的 `formatRecords()`,自动注入 `/WRn` 世界排名)。

## 5 个监控

| 监控 | 文件 | Python 源 | 作用 | 轮询 |
|------|------|-----------|------|------|
| WCA Live 纪录 | `wca_live_record.ts` | `wca_record_monitor.py` | WCA Live `recentRecords` 扫新 WR/CR/NR | 60s |
| cubing.com 纪录 + PR | `cubing_record.ts` | `cubing_record_monitor.py` | 近期中国比赛 WS 扫 sr/ar 纪录 + 关注选手 `result.user` nb/na PR | 60s |
| cubing.com 比赛 | `cubing_comp.ts` | `cubing_com_monitor.py` | 新公示的中国比赛 | 60s |
| WCA 比赛 | `wca_comp.ts` | `wca_comp_monitor.py` | 新公示的 WCA 比赛(全球) | 60s |
| WCA Live PR | `wca_live_pr.ts` | `wca_pr_detector.py` / `wca_pr_cache.py` | 关注选手生涯 PR 检测(自管基线) | 60s |

另有两个**独立门控**的慢周期监控(不在 `startMonitors()` 套件里,`src/index.ts` 单独启动):

| 监控 | 文件 | 门控 | 作用 | 轮询 |
|------|------|------|------|------|
| 往期成绩变更 | `wca_past_results.ts` | `RESULT_WATCH_ENABLED` | diff 关注选手全生涯成绩,写 `wca_result_changes` | 6h |
| 报名国外比赛 | `watched_foreign_reg.ts` | `FOREIGN_REG_WATCH_ENABLED` | 扫非 CN upcoming 比赛 registrations,命中关注选手(文件内 `WATCHED` 写死 wcaId+userId)发 站内通知+邮件(`utils/notify`→admin)+ Bark(issue #34) | 3h |

## 文件分工(monitors/)

| 文件 | 内容 |
|------|------|
| `index.ts` | `startMonitors()` 总启动,受 `MONITORS_ENABLED` 门控 |
| `bark.ts` | Bark 推送 + `MONITOR_PUSH_ENABLED` 安全门 |
| `state.ts` | `monitor_pushed_state` 去重台账(替代 `known_*.json`) |
| `watched.ts` | 从 `watched_persons` 读关注名单(60s 缓存) |
| `pr_baseline.ts` | `watched_pr_baseline` 生涯 PR 基线 + `warmBaseline`(唯一联网:WCA `/personal_records` 裸数组) |
| `names.ts` | 本地名补全,改查 `wca_persons`(无网络) |
| `config.ts` | env:tags / nr_countries / 轮询间隔 |
| `region.ts` | `COUNTRY_EN_MAP`(英文国名→ISO2)+ `isContinentalTag`(纯常量) |
| `seed_watched.ts` | 关注选手一次性灌库脚本(手动跑,读本地 gitignored cache) |

> **本地视频工具** `gen_title`(标题生成器)2026-06-04 已 TS 化进 `../tools/gen_title.ts`(复用本目录同款
> `../utils/record_format.ts`,不再有 Python 副本;`scripts/video-title/` Python 全删)。`D:\cube\wca-monitor`
> 仓随后整体退役。Gmail `email_notifier.py`(WR 邮件)未移植 = 已废弃。

## 两张新表(0023 / 0024 migration)

- `monitor_pushed_state(monitor, uid, pushed_at)` — 各监控已推送 uid 去重台账。
- `watched_persons(wca_id, match_key, note, added_at)` + `watched_pr_baseline(wca_id, event_id, rec_type, value, updated_at)`
  — 关注选手 + 生涯 PR 基线(厘秒)。

## env 变量

```
MONITORS_ENABLED=0        # 0=5 个监控休眠(代码随版本上线但不跑),1=启动
BARK_DEVICE_KEY=          # Bark 设备 key(机密,走 .env 不进仓)
BARK_SERVER=https://api.day.app
MONITOR_PUSH_ENABLED=0    # 0=跑但只 DRY 日志不真发,1=真发 Bark
MONITOR_RECORD_TAGS=WR,CR,NR
MONITOR_NR_COUNTRIES=CN,US,AU,CA,PL,KR,RU
```

## 两道门 / 双跑安全设计

- **`MONITORS_ENABLED`**(`index.ts`):0 时 `startMonitors()` 直接返回,代码可随版本上线但不跑。
- **`MONITOR_PUSH_ENABLED`**(`bark.ts`):`!ENABLED || !KEY` 时 `sendBark` 不真发,只打一行
  `[monitor] DRY (push disabled) would push: ...`,**仍返回 true** → 调用方照常 `markPushed`。
  这样灰度期持续把当下纪录当「已知」吸收进 `monitor_pushed_state`,一条不发(对齐 Python 首跑静默吸收);
  翻 `=1` 后只发翻 flag 之后真正新增的,不会把灰度期攒的全炸出来。

## 上线 / 灰度 / 退役 runbook

1. **部署**(都 0):push 触发 `deploy_core.yml` → esbuild bundle → rsync → `apply_migrations.sh`
   建 0023/0024 表 → `pm2 reload core-api`。代码上线但监控休眠。
2. **灌关注名单**(一次性,prod DB):
   `node --env-file=.env dist/monitors/seed_watched.js <path/to/watched_wca_ids_cache.json>`
   (名单个人、gitignored,不进仓;从本机 cache 文件读)。
3. **双跑**:服务器 `.env` 设 `MONITORS_ENABLED=1`(`MONITOR_PUSH_ENABLED` 仍 0),`pm2 restart core-api`。
   TS 监控跑但只 DRY 日志;Python `/opt/wca-monitor` 继续真发。`pm2 logs core-api | grep '\[monitor\] DRY'`
   对照 Python Bark,确认两边检出的纪录/比赛/PR 集合 + 文案一致。
4. **翻 flag**:一致后先停 Python(`systemctl stop wca-record-monitor wca-cubing-record-monitor
   wca-comp-monitor wca-wca-comp-monitor` + 关 timer),再 `.env` 设 `MONITOR_PUSH_ENABLED=1` +
   `pm2 restart core-api`,改由 TS 真发。
5. **退役**:稳定后 `bash /opt/wca-monitor/deploy.sh --uninstall` 下线 Python 服务(数据目录保留)。

## 与 Python 的已知差异(双跑时不算 bug)

- WCA Live 纪录的中文比赛名:本移植推**英文**比赛名(与 Python 一致);中文化是后续可选项。
- 世界排名 `/WRn`:源从 WCA 官网实时 Top100 → 本地 `wca_results_flat`(stats 周更),两次周更间新纪录
  名次可能偏小几名(WR/Top10 无感)。见 `record_format.ts` / `wca_stats_extra.ts`。
- `cubing_record` 的日期/时区:cubing 比赛日期按 `Asia/Shanghai` 取(中国比赛),旧 Python 走服务器本地 TZ。
