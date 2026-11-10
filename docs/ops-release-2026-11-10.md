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
