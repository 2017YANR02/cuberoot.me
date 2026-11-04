/** Applied moves only, including setup; never the unplayed algorithm suffix. */
export function engineHistoryAlgorithm(history: { init: string; exp?: string; moves?: readonly string[] | number }): string {
  const body = Array.isArray(history.moves) ? history.moves.join(' ') : (history.exp ?? '');
  return `${history.init ?? ''} ${body}`.trim();
}
