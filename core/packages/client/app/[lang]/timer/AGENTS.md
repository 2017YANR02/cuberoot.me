# Timer

- 复盘 ground truth 唯一手工源是 `tests/fixtures/recon-ground-truth.xlsx`；只往表尾加行，禁手改生成的 JSON。改复盘、陀螺仪、转体、中层识别或工作簿后必须跑 `pnpm --filter @cuberoot/client test:recon-ground-truth`，它会同步 JSON 并测试全部有效行，禁止写死数量。
