# CubeOpt 云端求解换页阻塞（2026-09-28 UTC）

## 结论与边界

`/scramble/solver` 的云端最优解和 `/timer` 的随机最优打乱共用
`POST /v1/scramble/optimal-solve`。03:17–03:18 UTC 的现场证据确认求解器
受到严重磁盘换页阻塞。08:35 UTC 重测时服务已经可以快速求解；随后修正了
PM2 cgroup 与全局换页策略不一致的问题。不能把后续快速求解全部归因于配置修改，
也没有证据确认最初是哪项负载触发了内存回收。

当前服务器运行已有 opt8 制品 `cubeopt-opt8-0c742e0ad31d-20260826`，
4 个求解线程；本次没有重建表、重载表或启动第二份大表进程。

## 现场证据

- 03:17 UTC：服务器总内存 15,199 MiB；`vmstat 1` 连续样本的 `wa` 为
  74%、74%、79%、76%，同时持续 swap-in/swap-out。
- 03:18:11 UTC：求解 PID `3856040` 的 `VmSwap=1,205,428 kB`；
  03:18:31 UTC 的 4 个求解工作线程均为 `D`（不可中断等待）。
- 03:18:42–45 UTC：`pidstat` 平均 `majflt/s=4,815`，
  `kB_rd/s=32,138.67`。这把大量缺页和磁盘读取直接关联到求解进程。
- 全局 `/proc/sys/vm/swappiness=0`，但 cgroup v1 的
  `/sys/fs/cgroup/memory/system.slice/pm2-root.service/memory.swappiness=60`。
  父级 `system.slice` 同样为 60。PM2 组只有 PM2、API 和 CubeOpt 三个进程。
- PM2 组 memory hard/soft limit 均无限制，`memory.failcnt=0`；未发现该组
  达到内存硬上限的证据。全局可用内存数 GB 不代表求解表全部驻留。
- API 的内存保护只检查 `MemAvailable` 低于默认 200 MiB，并不监测进程的
  swap 或 major faults；因此此前保护未触发不能证明求解性能健康。
- `/var/log/sa` 没有历史样本，所查内核日志没有 OOM 记录；不能据此推定
  最初内存回收来自哪个进程。

Linux 的 cgroup v1 `memory.swappiness` 会覆盖该组的全局值，见
[内核 5.10 文档 §5.3](https://docs.kernel.org/5.10/admin-guide/cgroup-v1/memory.html#swappiness)。
设为 0 是降低换页倾向，不是锁定内存，也不保证永不发生全局回收。

## 已执行的修复

1. 将运行中的 PM2 cgroup `memory.swappiness` 从 60 写为 0，回读确认。
2. 安装仓库中的 `ops/systemd/pm2-root.service.d/10-cuberoot-memory.conf` 到
   `/etc/systemd/system/pm2-root.service.d/10-cuberoot-memory.conf`。
3. `systemctl daemon-reload` 后确认 drop-in 和 `ExecStartPre` 已被加载，
   PM2 仍为 active，求解器仍为原 PID `3856040`。

启动配置会在 PM2 恢复子进程之前设置该 cgroup 的换页参数；cgroup v2 下跳过。
本次没有重启 PM2/API/求解器，没有关闭 swap，也没有更改现有 OOM 保护。
`systemd-analyze verify` 未报告新增配置错误；它同时报告了其他既有 unit 的警告。
没有通过重启整机验证启动路径。

## 实际求解验证

使用服务器内存中的既有 daemon，经正常鉴权和 SSE 请求串行测试。
诊断凭证仅在远端进程内使用，10 分钟过期，没有写入仓库或日志。

| 检查 | 修复前（08:35 UTC） | 修复后（08:38 UTC） |
| --- | --- | --- |
| `R` → `R'` | 59 ms | 53 ms |
| 固定 20 步输入 → 17 HTM 解 | 145 ms | 127 ms |

固定输入：`R U F2 D' L2 B U2 R2 F' D2 L' B2 U R' F D L2 U' B' R2`。
这些相同输入经本机 API 测试；不能将微小时间差解释为性能提升。

另由本地 cubing.js 生成 3 条随机状态打乱，08:37 UTC 经
`https://api.cuberoot.me/v1/scramble/optimal-solve` 公网入口依次测试：

| 输入 | HTM | 完整请求耗时 | 求解进程新增 major faults |
| --- | --- | --- | --- |
| `D F' B D' R' F' R F2 L' U' B2 R2 U D2 B2 U' F2 D' L2 U2 L2` | 18 | 2,883 ms | 27 |
| `D' B2 F2 U2 L2 F2 R2 U' L2 D U2 B U L' F U2 R B R2 F'` | 18 | 1,898 ms | 18 |
| `U2 L2 D2 L' B U' F' D R' F' L2 F2 D2 B L2 B U2 F D2 R2 D2` | 18 | 2,864 ms | 46 |

5 条修复后结果均通过 cubing.js 独立验证：对普通三阶的 defaultPattern
应用「输入打乱 + 返回解法」后与还原态相同，解法招式数与返回 HTM 相同。
这里只独立验证还原正确性，最优性由既有 CubeOpt 引擎提供。
API health 返回 `status:ok, db:connected`。
网页视觉和用户原始涂色状态尚未重新验收；截图没有提供完整六面状态。

## 复查与回退

复查全局和实际 cgroup 参数、求解进程 `VmSwap`、求解期间 `pidstat -r -u -d`，
不能仅看 `/ready` 或系统 swap 总量。残留 swap 不会因为调整参数立即消失。

如需回退本次配置，可将 drop-in 改名为不以 `.conf` 结尾的备份，执行
`systemctl daemon-reload`，并把 PM2 cgroup 的 `memory.swappiness` 写回 60。
不需要重启 PM2。

## 旁支发现与后续修复

`pg-dump-recon.service` 在 03:09:54 UTC 立即失败，日志为
`database credentials unavailable: node is required to read CUBEROOT_DB_ENV_FILE`。
该次备份未进入数据导出，不能将其认定为此次换页的来源。

09:19 UTC 后续 API 发布 `827ac576e0` 已增加持续诊断，详见
[请求观测说明](request-observability.md#cubeopt-最优求解监控2026-09-28)。
这次发布按标准流程重启 API 并重新预热求解器；与上面的免重启 cgroup 修改分开记账。
09:24 UTC 三个相同随机状态样本完整请求分别为 3,166、1,423、2,637 ms，
全部返回 18 HTM 解且经 cubing.js 校验还原正确。求解进程 swap 为 0，
三个请求都没有新增 major faults。nginx、SSE 请求与求解任务的 requestId 已确认一致。

每日备份已由 systemd `EnvironmentFile` 直接提供数据库凭据，绕开定时任务的
NVM PATH；脚本改为失败不轮换、成功后最多保留两个日期。
09:24 UTC 前补跑成功，新 dump 为 216,555,810 字节，gzip 校验通过。
当前仅保留 2026-08-28 与 2026-09-28 两份 dump 及对应配置副本，权限均为 600。
下载新 dump 后在独立本地 PostgreSQL 完整恢复，`ON_ERROR_STOP=1` 退出 0：
288 张 public 表，recons 2,693 行、alg_cases 9,298 行、wca_users 406 行、
迁移账本 253 行；恢复库约 1,406 MB。派生数据沿用原有排除清单，未改变备份范围。
下一次定时备份为 2026-09-29 03:02:04 UTC；这是当时 timer 的下一次计划，非固定分钟承诺。
