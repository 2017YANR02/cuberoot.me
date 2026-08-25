/**
 * 轮询守卫 —— 立即跑一次 + 定时轮询,但上一轮没跑完则跳过本次,
 * 防止慢周期(WCA REST ~30s / cubing WS 扫多场)在 60s 间隔下重叠堆叠刷屏 + 抢出口。
 */
export function startPoller(label: string, fn: () => Promise<void>, intervalMs: number): void {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) {
      console.warn(`[${label}] previous cycle still running, skip this tick`);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[${label}] cycle error:`, e);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(() => void tick(), intervalMs);
}
