/**
 * Pre-pass for fc / sch / fd that expands repeat-count syntax (PHP V0.6.5).
 *
 * Examples:
 *   `y3r6`  -> `yyyrrrrrr`
 *   `y20`   -> 20 y's
 *   `y`     -> `y`
 *
 * Any letter is accepted; downstream parser validates which letters are legal
 * for the given option. Comma-separated input is left untouched.
 */
export function expandRepeats(s: string): string {
  if (!s || s.indexOf(',') > -1) return s
  // Lowercase only — color/facelet codes are lowercase; uppercase would
  // silently miss the lookup table downstream.
  // Count `0` drops the letter entirely (matches PHP); explicit count `1` is
  // also valid (just a no-op compaction).
  return s.replace(/([a-z])(\d+)?/g, (_m, ch: string, count?: string) => {
    const n = count ? parseInt(count, 10) : 1
    return ch.repeat(n)
  })
}
