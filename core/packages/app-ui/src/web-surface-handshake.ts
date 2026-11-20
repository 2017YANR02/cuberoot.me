export function startWebSurfaceHandshake(
  postInit: () => void,
  retryMs: number,
  maxAttempts: number,
  onExhausted?: () => void,
): () => void {
  let attempts = 0;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  let deadline: ReturnType<typeof globalThis.setTimeout> | undefined;
  const stop = () => {
    if (timer !== null) globalThis.clearInterval(timer);
    timer = null;
    globalThis.clearTimeout(deadline);
  };
  const send = () => {
    attempts += 1;
    postInit();
    if (attempts >= maxAttempts) {
      stop();
      // Give the final message the same response window as earlier attempts.
      if (onExhausted) deadline = globalThis.setTimeout(onExhausted, retryMs);
    }
  };
  send();
  if (attempts < maxAttempts) timer = globalThis.setInterval(send, retryMs);
  return stop;
}
