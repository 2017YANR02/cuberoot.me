export function startWebSurfaceHandshake(
  postInit: () => void,
  retryMs: number,
  maxAttempts: number,
): () => void {
  let attempts = 0;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  const stop = () => {
    if (timer !== null) globalThis.clearInterval(timer);
    timer = null;
  };
  const send = () => {
    attempts += 1;
    postInit();
    if (attempts >= maxAttempts) stop();
  };
  send();
  if (attempts < maxAttempts) timer = globalThis.setInterval(send, retryMs);
  return stop;
}
