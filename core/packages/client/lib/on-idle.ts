// 把「首屏用不上、但迟早要拉」的活推到浏览器空闲(requestIdleCallback,无则退化成
// setTimeout)。返回 cancel,直接用在 useEffect 的清理里。
//
// 用途:次要 tab 的判据数据 —— 它们只决定某个 tab 亮不亮,却和成绩数据抢同一批
// HTTP 连接,不推迟就会拖慢首屏。

type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
type CIC = (id: number) => void;

export function onIdle(fn: () => void, opts?: { timeout?: number; fallbackDelay?: number }): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: CIC };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: opts?.timeout ?? 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, opts?.fallbackDelay ?? 200);
  return () => clearTimeout(id);
}
