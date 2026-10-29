/** Zero means not attempted; DNF (-1) and DNS (-2) are recorded results. */
export function hasPersonLiveResult(best: number, average: number, attempts: readonly number[] | null | undefined): boolean {
  const recorded = (value: number) => Number.isFinite(value) && (value > 0 || value === -1 || value === -2);
  return recorded(best) || recorded(average) || (Array.isArray(attempts) && attempts.some(recorded));
}
