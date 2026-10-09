# CubeOpt 内存耗尽调查与修复

服务器时间为 UTC，事件发生于 2026-10-02；维护者 Mac 日期仍为 2026-10-01。保持服务器 16 GB，不扩容，不增加交换空间。

## 实测原因

- `MemTotal=15564184 KiB`（14.84 GiB），交换空间 4 GiB。
- Deploy Core `36952976973` 在实际 opt8 冒烟中失败。01:59:52 内核 OOM 日志记录求解器 RSS `7544964 KiB`。加载前 `MemAvailable=8003664 KiB`，随后下降至 `160236 KiB`。完整进程列表中只有一个大表求解器，不是双份大表同时加载。
- 约 3,900 个闲置 root SSH 会话，约 7,800 个 sshd 进程持续占用资源。`smaps_rollup` 汇总：PSS `3344135 KiB`，SwapPss `3148060 KiB`；页表约 `540224 KiB`。普通 RSS/VmSwap 求和会重复计算共享页面，不能当作物理总量。
- Mac Codex 日志显示 `cuberoot` 和 `mira-server` 两个发现的远程连接反复进行 `codex_path_probe`，返回 code 86 / `remote-codex-not-found`，约 14 秒重复。两条 SSH 别名指向同一服务器；认证日志的两个本机公钥与重试对应。
- 短 SSH 命令退出、本机客户端退出之后，服务器 root@notty 和 TCP established 仍留存。清理候选必须来自已核实的本机出口、超过 600 秒、没有命令子进程，且其父 sshd 只有这一个子进程。
- 当时 `vmstat` 的 si/so 为 0；交换空间几乎满不等于正在持续换页。本次 OOM 的直接触发是可用内存不足。

## 已实施

1. `/etc/ssh/sshd_config` 增加 [root 超时策略](../ops/ssh/root-session-guard.conf)。`sshd -t` 通过后 reload；root 生效值 60 秒 / 3 次，macmini-tunnel 保持原策略。新失效会话在认证日志出现 `Timeout, client not responding`，短命令 canary 已回收。
2. 原配置备份：`/var/backups/sshd_config.before-session-guard-20261002T025009Z`。reload 不改变旧连接的设置。
3. 先清理一个确定闲置会话，确认其父子进程均退出、SSH/API/Next 正常，再对候选重新核对并 SIGTERM 3,897 个闲置会话。审计保存在服务器 `/var/backups/cuberoot-idle-ssh-cleanup-20261002T0300.json`。不使用全局 pkill，不影响正在执行命令的连接。
4. CubeOpt 加载前按实际表大小加 1 GiB 余量检查 Linux MemAvailable；不足时拒绝加载。流式加载期间保留 256 MiB 最低余量并处理短读。这是资源保护，不能代替连接泄漏的修复。
5. 诊断快照增加进程名称计数，扩大扫描上限至 16,384，并优先采集当前求解器，避免大量 sshd 把求解器挤出旧的 4,096 上限。

Codex 两个远程连接仍可能继续失败重试。服务器已限制失联连接的驻留时间；若不需要远程 Codex，应在 Codex 远程连接设置里关闭这两个条目的自动连接。工具禁止自动操作 Codex 本身，本次未绕过限制修改应用状态文件。

## 发布与复核

上线通过 Deploy Core；确认实际 release、API/数据库健康、真实最优求解，以及求解器 RSS/VmSwap、MemAvailable、进程计数和新的 OOM 记录。`/ready` 单独不能证明求解性能或内存安全。
