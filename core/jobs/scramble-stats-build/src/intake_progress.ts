/** Intake status is sparse so long jobs remain visible without flooding Terminal. */
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

export function intakeProgress(label: string, detail: () => string = () => ''): (completed?: boolean) => void {
  const started = Date.now();
  let lastDetail = detail();
  let lastPercent = -1;
  let printed = false;
  const render = (final = false, completed = true) => {
    const extra = detail();
    const match = /\((\d+(?:\.\d+)?)%\)/.exec(extra);
    const percent = match ? Math.floor(Number(match[1])) : null;
    if (percent !== null) {
      if (!final && percent === 0 && lastPercent < 0) return;
      if (percent <= lastPercent || (!final && lastPercent >= 0 && percent - lastPercent < 10)) return;
    } else if (!final || (printed && extra === lastDetail)) return;
    console.log(`[取数] ${label}${extra ? ` | ${extra}` : ''}${final && !extra.includes('%') ? ` | ${completed ? '100%' : '中断'}` : ''} | ${final ? '用时' : '已运行'} ${duration((Date.now() - started) / 1000)}`);
    lastDetail = extra;
    if (percent !== null) lastPercent = percent;
    printed = true;
  };
  const timer = setInterval(render, 30_000);
  timer.unref();
  return (completed = true) => {
    clearInterval(timer);
    render(true, completed);
  };
}
