/** Intake status stays on one terminal line; redirected logs get sparse updates. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
}

export function downloadStatus(done: number, total: number, received: number, seconds: number): string {
  const rate = seconds > 0 ? received / seconds : 0;
  const size = `${(done / 1e6).toFixed(1)}${total > 0 ? `/${(total / 1e6).toFixed(1)}` : ''} MB`;
  const percent = total > 0 ? ` (${(done / total * 100).toFixed(1)}%)` : '';
  const eta = total > 0 && done >= total ? '00:00:00'
    : total > 0 && rate > 0 && seconds >= 3 ? `约 ${duration((total - done) / rate)}` : '估算中';
  return `${size}${percent} | ${(rate / 1e6).toFixed(1)} MB/s | 剩余 ${eta}`;
}

export function intakeProgress(label: string, detail: () => string = () => ''): () => void {
  const started = Date.now();
  const tty = !!process.stdout.isTTY;
  const render = () => {
    const extra = detail();
    const line = `[取数] ${label}${extra ? ` | ${extra}` : ''} | 已运行 ${duration((Date.now() - started) / 1000)}`;
    process.stdout.write(tty ? `\r\x1b[2K${line}` : `${line}\n`);
  };
  render();
  const timer = setInterval(render, tty ? 1000 : 60_000);
  timer.unref();
  return () => {
    clearInterval(timer);
    render();
    if (tty) process.stdout.write('\n');
  };
}
