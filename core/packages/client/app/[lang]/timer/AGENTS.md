# Timer

- 复盘 ground truth 在 `/recon/ground-truth` 逐条确认；`tests/fixtures/recon-ground-truth.json` 是 API 导出的 CI 快照，禁手改。改复盘、陀螺仪、转体、中层识别或 ground-truth 管道后必须跑 `pnpm --filter @cuberoot/client test:recon-ground-truth`，测试全部 confirmed 条目，禁止写死数量。
