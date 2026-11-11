# 2026-11-10 双机同步发布与磁盘恢复

两台 Mac 的开发启动与同步约定见 [多机开发](contributing/multi-machine.md)。本轮将 Mac mini 与 MBP 的已有修改顺序提交、rebase、推送并同步，保留各机独立的预览通道和本地数据。

## 线上磁盘事件

API 发布期间，生产根分区 79 GB 已满（仅约 351 MB 可用）。2026-11-10 17:16:18 UTC，PostgreSQL checkpointer 因无法写入 `pg_logical/replorigin_checkpoint.tmp` 退出；API 健康检查和依赖 API 的 Vercel 构建随之失败。迁移 0321 已成功执行，未重复修改数据库内容。

维护者明确允许删除旧文件和备份后，删除 `/root/egg-h8-20261109/archives/` 中以下四个旧网页部署压缩包，释放约 1.7 GiB：

- `toolkit-next.bak-1794242240.tar.gz`
- `toolkit-next.bak-1794283248.tar.gz`
- `toolkit-next.bak-1794284712.tar.gz`
- `toolkit-next.bak-1794286977.tar.xz`

这些文件未成功转存到其他电脑；本次是经授权删除。保留线上目录、最近的可用网页回滚目录、数据库、上传文件及求解器表。不要将两处硬链接的 Egg 表误判为独立冗余备份。

恢复 PostgreSQL 后，API 健康检查显示数据库已连接。Deploy Core 运行 `42862353033` 重试通过；Vercel 生产部署 `dpl_D8edYS6RZ1ueX7M5RXuFYAsT2gZF` 达到 READY。清理后根分区约 2.1 GiB 可用，空间仍紧张，后续部署前须核对余量。

## MBP WCA 打乱统计发布

MBP 完成计算后，PG 发布被尚未初始化的双机基线拦截。恢复时从线上导出完整快照，再在正常发布锁内独立重读并核对 SHA256；只有完全一致才经原守卫登记版本。没有伪造旧 token、清空线上表或重新运行求解器。由实际快照生成增量 manifest，保留旧 manifest 和本轮结果。

正式 `stats:scramble --publish-only` 完成四项 PG 发布及 [统计 Release](https://github.com/2017YANR02/cuberoot.me/actions/runs/42929157598)。线上原始打乱共 3,267,370 条、阶段索引 1,150,905 条、最优解 2,079,436 条；数据日期为 2026-11-10。浏览器验收三阶合并池十字样本 1,381,521 条，较前版增加 11,828 条，图表及示例正常。

拔线发生在最后的静态传输期间。WCA 所需的 2,468 个下载包、比赛分片和 steps 元数据经 Wi-Fi 转交后，由 Mac mini 完成发布，并逐文件核对线上 SHA1。另有 407 个既存非 WCA `exact-puzzles/` 文件不属于本轮计算，未随此次恢复发布，原有文件及待发布结果保留。

macOS tar 的 AppleDouble 附带文件导致服务器严格成员校验拒绝原包；本轮只重打包清单中的正式文件，保留原校验。常规静态打包同步 Release 打包器设置 `COPYFILE_DISABLE=1`，避免下次再次带入附带文件。相关本地测试 10 项通过。

SQ1 WCA 仍有 1 条未解状态，本轮计算摘要保持 `partial`；线上精确 WCA/slash 分布包含 134,205 个已解样本，不把未解项算作精确结果。恢复证据、旧数据快照及交接记录保留在两机 `.local-data/ops/stats-publication-20261110/`，不是可丢弃缓存。
