# Request failure diagnostics

As of 2026-09-13, page delivery no longer queries homepage locks or session roles.
Homepage locks control card visibility only. Competition Practice is also public,
including its client UI; guest practice uses its existing local storage flow.
API authorization and account lifecycle checks are unchanged. The gateway and
older diagnostic helpers remain for compatibility, but proxy no longer calls them.
The page-access incident and correlation steps below describe the retired gate;
API, database and host instrumentation remain active.

## Correlating a failure

1. Open the Vercel request log and find the structured `page_access` event.
   Copy its generated `requestId`, timestamp and `region`. `stepsMs` separates
   `home-locks` from `auth-me`; `homeLocksStatus` is only the locks response status.
2. On `ssh cuberoot`, search that ID in
   `/www/wwwlogs/timing.api.cuberoot.me.log` and
   `/root/.pm2/logs/core-api-out.log` / `core-api-error.log` (including rotations).
   Every permission check is sent fresh with the ID; it is not a credential.
3. nginx records `connectSeconds`, `headerSeconds`, `upstreamSeconds` and
   `requestSeconds`. Its original combined log remains in place. The new log
   includes permission endpoints plus all API 5xx/499 and requests taking >=1s.
4. API `api_request` records route **templates**, status, handler duration and
   `dbCalls`, `dbCallMs`, `dbMaxCallMs`, `dbErrors`. `api_request_pending` is emitted
   after four seconds even if the handler has not completed. Calls through the
   `query()` and transaction query helpers are instrumented; raw tagged `sql`
   usage is not. DB wall time includes pool queuing, execution and result transfer;
   it is not pure SQL execution time. Parallel DB calls can make the sum exceed
   the request wall time. Streaming response completion is measured by nginx,
   not the API middleware's handler-return duration.
5. Inspect nearby `api_runtime`, `database_activity` and `host_disk` events. Every
   30 seconds they record process CPU, RSS, event-loop delay, helper calls in
   flight, database wait categories/blocking counts and filesystem free space.
   Each DB snapshot uses one independent read-only connection with a 1.5s SQL
   limit, 2s connect timeout and a 3s forced transport cutoff. Statistics visibility
   follows the existing DB role; no new privileges are granted. Boot events and
   PIDs distinguish restarts. `DIAGNOSTICS_DISK_PATH` defaults to `/`, where this
   server's DB, WAL and uploads reside; change it if that layout changes.

## Interpretation and thresholds

- Page failure with no matching nginx entry: check a sufficiently wide window,
  since nginx logs at request completion. Absence alone is not proof of a network
  fault. Log retention, incomplete requests and sampling boundaries also matter.
- Fast matching nginx/API response but a five-second Vercel timeout: investigate
  the edge-to-origin transport. These metrics do not split DNS, TCP and TLS at
  Vercel; a regional network probe may still be necessary.
- High nginx header time plus large DB-call wall time, blocked database sessions
  and many calls in flight: evidence for database/pool contention.
- High event-loop lag with multiple unrelated slow routes: inspect CPU work,
  garbage collection and host pressure. CPU percentages can exceed 100% when
  the process uses more than one core.

Warnings: API/DB calls >=1s, pending API calls >=4s, page failures, event-loop
maximum >=250ms, any blocked DB session or active query >=5s, and disk space <3GiB.
These are structured log warnings, not a new external notification service.
Existing Vercel 5xx alerts remain the external incident signal. Thirty-second
snapshots can miss shorter events; a stopped process cannot emit its own metrics.

## Historical Vercel page verification placement

`core/packages/client/vercel.json` pins `/api/page-access` to `iad1`. Production
Node.js middleware runs globally and calls this regional gateway through the
existing Vercel-only `cuberoot-me.vercel.app` production alias. The gateway
performs the original live API request. Using the custom domain here would
reintroduce the origin connection through its split DNS. Preview middleware and
self-hosted/dev Next keep calling the original API directly. Static assets
continue to use the global CDN.

The gateway accepts only fixed `locks` and `session` GET checks. It forwards
Authorization only for session verification, never forwards cookies, refuses
upstream redirects, preserves the request UUID, and marks every response
`private, no-store`. Backend role and lock-state validation remain unchanged.
The gateway consumes the upstream body within the original five-second
deadline. It exposes `X-Page-Access-Region` for deployment verification.

A direct `functions["proxy.ts"]` setting passed the published JSON schema but
was rejected by Vercel CLI 59.11.7 before building. Its Next.js function matcher
accepts app routes but not the renamed proxy entrypoint. Do not use that
configuration or assume the project default region constrains middleware.

On 2026-09-13 UTC, production request
`86fab93b-eb3b-4808-ba4c-5c190905cb2c` failed in `sfo1` after exactly 5000 ms
at `home-locks`, with no upstream HTTP status or matching origin log. Other
failures occurred in `hkg1` and `sin1`. Successful correlated requests spent
only 1–3 ms in nginx/API; the concurrent DB snapshots had no blocked sessions.

A separate preview probe compared Node 24 native HTTPS, fixed-IP HTTPS, fetch,
and fetch with `Connection: close`. In `hkg1`, DNS resolved the correct IPv4
address in 5 ms, but both fresh HTTPS connections reached their five-second
deadline before the TCP `connect` event. Both fetch variants also timed out.
This isolates a connection-path failure before TLS/HTTP, rather than an API
query, stale keep-alive socket, or DNS lookup. It does not identify which
network operator dropped the connection. The `iad1` control completed all four
request variants in six consecutive probe rounds; `sfo1` was intermittent.

The visible regression began with `9fd37b606` on 2026-09-11: page routes began
checking live homepage locks before serving documents and RSC. This made the
regional API connection a prerequisite for otherwise static pages. The regional
gateway first repaired that path. The subsequent product decision removed the
page gate entirely, so locks and session verification no longer block page delivery.

After a placement change, inspect the deployed `/api/page-access` region and
correlate new main-domain requests through the gateway with the origin. A successful preview
alone is insufficient because preview and production middleware placement can
differ. Recheck anonymous access to permanently locked pages as well as public
pages in both languages.

No new diagnostic log contains IPs, raw URLs/query strings, authorization headers,
cookies, request/response bodies, SQL text/parameters, or arbitrary error messages.
Only endpoint categories/templates, validated IDs, static labels and metrics are
recorded. No telemetry is sent to an additional external service.

## Retention and rollout

The nginx timing log is covered by the existing seven-rotation logrotate policy.
The same deployed policy now rotates the two core-api PM2 logs with copytruncate,
compression and seven retained rotations. `maxsize 100M` is checked when the host
logrotate job runs; it is not a continuously enforced quota. copytruncate may lose
a small number of lines during rotation; it avoids restarting the API.

Ship API and Web code through their existing Actions/Vercel workflows; ship nginx
and logrotate through `deploy_nginx.yml`. A local test or syntax check does not
mean collection is active. After deployment, make a harmless public permission
request carrying a fresh UUID and verify the ID appears in both nginx and API;
then verify one runtime/database/disk snapshot. Do not manufacture a production
lock, fill the disk, or force real visitor timeouts to test warnings.

## CubeOpt 最优求解监控（2026-09-28）

`/scramble/solver` 与计时器的三阶随机最优打乱共用此监控。
复用上面的 `diagnosticLog`、PM2 日志和已部署的七天轮换；不增加外部收费服务。
采集启用条件为 `CUBEOPT_SOLVE_ENABLED=1`，不会为了监控主动加载或求解大表。

- `cubeopt_request_started/slow/aborted/finished`：真实 SSE 请求的完整耗时、
  加载等待、条数和成功/失败数，以现有 `X-Request-ID` 对照 nginx。
  不把 Hono handler 返回时间当作 SSE 完成时间。
- `cubeopt_job_received/queued/started/slow/finished`：每条任务的加载、排队、
  求解耗时、HTM、结果分类。用 `pid + jobId` 区分进程重启，用 `requestId` 关联请求。
  `solve_timeout`、`queue_timeout`、`queue_full`、`load_error`、`solver_error`
  分别记录；其他进程退出/异常同时对照 `cubeopt_daemon_*`。
- `cubeopt_daemon_spawned/ready/load_failed/recycle/exited`：记录表加载耗时、
  子进程 PID、退出信号和回收原因（超时、低内存、空闲或内存仲裁）。
- `cubeopt_sample`：Linux 每 10 秒采集 host MemAvailable、swap 空间及换入/换出速率、
  CPU I/O wait，求解进程 RSS、swap、major faults/s、CPU%、进程状态，
  队列深度及当前任务；同时记录全局与实际 cgroup v1 的 swappiness。
  首次采样及 PID/进程启动时间变化时速率为空，避免把累计数当瞬时值。
  不支持或不可读的 cgroup 值为空，不声称为 0。
- `cubeopt_snapshot`：每分钟保存最多 12 个 RSS+swap 最大进程的 PID、短名称、
  RSS/swap、cgroup，以及最多 100 个正在运行的 systemd service 名称。
  慢请求/失败/资源异常也触发，但共享 60 秒冷却、不可重入；若被限频，使用最近快照。
  `/proc` 扫描最多 4,096 个 PID、8 路并发；systemctl 最多 1.5 秒和 64 KiB 输出。
  快照不是 PSS 统计，共享页可能重复计数，不应直接相加作为总内存。

告警为结构化 warning 日志：请求/任务持续 10 秒；major faults >=100/s；
I/O wait >=20%；swap-out >=256 页/s；MemAvailable <512 MiB。
残留 swap 量单独不判定故障。后台定时任务的名字也可通过快照的 cgroup 对照
`journalctl -u <unit> --since ... --until ...`。目前没有新增外部消息通知。

只读取数值、进程短名称及服务/cgroup 名称；不读取 cmdline、environ、请求输入、
打乱/解法、账号、cookie、密钥或任意异常消息。采集失败只记 unavailable 并在下次重试，
不改变求解调度、超时、表、内存保护或用户响应。进程停止不能继续自报；10 秒/60 秒
采样可能错过更短的尖峰，因此不能保证每次都能锁定最初触发者。

排查入口（服务器 UTC）：

```sh
# 当前与最近一天未压缩的日志；更旧的 .gz 用 zgrep 同样过滤。
grep '"event":"cubeopt_' /root/.pm2/logs/core-api-out.log /root/.pm2/logs/core-api-error.log
# 拿请求 ID 关联上游；不要只用 /ready 的布尔值判断性能。
grep '<request-id>' /www/wwwlogs/timing.api.cuberoot.me.log /root/.pm2/logs/core-api-*.log
```

验证先跑解析/限频/阶段计时/日志隐私 fixtures，再通过真实正常求解确认
request → job → finished 的 ID 一致、至少两个资源样本以及一个进程快照。
异常路径用合成 fixture 验证，不在生产主动制造 swap/OOM/超时。

上线验收：2026-09-28 09:24 UTC，API 发布 `827ac576e0` 的三个公网求解请求
分别耗时 3,166 / 1,423 / 2,637 ms，返回解法均经 cubing.js 独立还原验证。
请求 `307a3bb1-a700-47c1-9d89-bf909f3dd3e6` 在 nginx timing、
`cubeopt_request_*` 和 `cubeopt_job_*` 中一致；求解子进程 swap=0，
三个请求新增 major faults=0。连续 10 秒样本和含 cgroup/service 的分钟快照
均已在生产日志中观察到；现有 PM2 七天轮换配置已核对。
此次验收没有制造真实慢请求或内存故障，阈值路径由合成测试覆盖。
