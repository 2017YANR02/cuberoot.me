/**
 * Canonical parser for the Timer's "Manual input" scramble source.
 *
 * Each non-empty line is one opaque scramble. The Timer deliberately does not
 * validate notation here: the selected puzzle controls preview/support, while
 * the entered text is still the exact scramble stored with the solve. This is
 * also why this contract has no EventId parameter — one saved queue is shared
 * when the user switches puzzle, matching the website.
 */
export function parseManualScrambleQueue(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const TIMER_MANUAL_SCRAMBLE_EMPTY_COPY = Object.freeze({
  en: 'Paste scrambles above — one per line',
  zh: '在上方「打乱来源」粘贴打乱,每行一条',
});

export interface ManualScrambleQueueTake {
  scramble: string;
  /** Cursor to pass into the next call. Zero for an empty queue. */
  nextCursor: number;
}

/**
 * Read one line in order and wrap after the last line.
 *
 * The cursor is normalized at this runtime-neutral boundary so Web, Android,
 * and iOS cannot drift on wraparound or malformed restored state.
 */
export function takeManualScramble(
  queue: readonly string[],
  cursor: number,
): ManualScrambleQueueTake {
  if (queue.length === 0) return { scramble: '', nextCursor: 0 };
  const safeCursor = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  const index = safeCursor % queue.length;
  return {
    scramble: queue[index] ?? '',
    nextCursor: (index + 1) % queue.length,
  };
}
