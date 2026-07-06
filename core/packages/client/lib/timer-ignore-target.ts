// Shared press-target guard for timing surfaces (/timer SoloView + /trainer run).
// A press that starts on an interactive child (button/link/input/…) must NOT
// arm the timer — it's a real click, not a "start timing" gesture. Passed as
// `ignoreTarget` to useGestureWheel. Keeping this in one place stops the two
// call sites from drifting out of sync.
export function shouldIgnoreTimerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-timer]') !== null;
}
