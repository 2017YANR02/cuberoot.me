/** Official result slots: successful solves and DNF are attempts; DNS/empty are not. */
export function countSolveAttempts(values: readonly (number | null)[]): [number, number] {
  let solve = 0, attempt = 0;
  for (const value of values) {
    if (value != null && value > 0) { solve++; attempt++; }
    else if (value === -1) attempt++;
  }
  return [solve, attempt];
}

export interface AnnualParticipation {
  wcaId: string;
  countryId: string;
  year: number;
  solve: number;
  attempt: number;
  rounds: number;
}

/** One accumulator per event; input is one official result row per person/round. */
export function addAnnualParticipation(
  totals: Map<string, AnnualParticipation>,
  row: { pid: string; countryId: string; compDate: string },
  counts: readonly [number, number],
): void {
  const [solve, attempt] = counts;
  // DNS-only rounds do not represent participation. An all-DNF round does.
  if (attempt === 0) return;
  const year = Number(row.compDate.slice(0, 4));
  const key = `${row.pid}\x1f${row.countryId}\x1f${year}`;
  const total = totals.get(key) ?? { wcaId: row.pid, countryId: row.countryId, year, solve: 0, attempt: 0, rounds: 0 };
  total.solve += solve;
  total.attempt += attempt;
  total.rounds++;
  totals.set(key, total);
}
