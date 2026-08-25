export type RuntimeTimer = ReturnType<typeof setTimeout>;

export function scheduleRuntimeTimeout(
  callback: () => void,
  delayMs: number,
): RuntimeTimer | null {
  let firedSynchronously = false;
  let scheduling = true;

  try {
    const timer = setTimeout(() => {
      if (scheduling) firedSynchronously = true;
      callback();
    }, delayMs);
    scheduling = false;
    return firedSynchronously ? null : timer;
  } catch {
    scheduling = false;
    return null;
  }
}

export function clearRuntimeTimeout(timer: RuntimeTimer | null | undefined): void {
  if (timer == null) return;

  try {
    clearTimeout(timer);
  } catch {
    // Logical settlement must not depend on optional timer cleanup.
  }
}
