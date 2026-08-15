export interface RoundResultValues {
  b?: number;
  a?: number;
  v?: readonly number[];
}

/** Preallocated all-zero rows are registrations, not entered round results. */
export function roundHasAnyEnteredResult(rows: readonly RoundResultValues[]): boolean {
  return rows.some(row =>
    (row.b ?? 0) !== 0
    || (row.a ?? 0) !== 0
    || (row.v ?? []).some(value => value !== 0)
  );
}
