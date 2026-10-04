# Timer

- 打乱与比赛来源区域必须完整显示，禁止用固定高度、裁切或内部滚动视口容纳长内容。长打乱在共享 `TimerScrambleStrip` 中按长度缩小字号，保留可读下限和用户字体设置；达到下限后自然换行、扩展布局，不能遮挡计时数字。
- 复盘 ground truth 在 `/recon/ground-truth` 逐条确认；`tests/fixtures/recon-ground-truth.json` 是 API 导出的 CI 快照，禁手改。改复盘、陀螺仪、转体、中层识别或 ground-truth 管道后必须跑 `pnpm --filter @cuberoot/client test:recon-ground-truth`，测试全部 confirmed 条目，禁止写死数量。
