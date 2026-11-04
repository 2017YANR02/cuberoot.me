export function parseTimeValue(s: string): number {
  if (!s || s === 'DNF' || s === 'DNS') return NaN;
  const m = s.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v;
}

export function extractSolvesCell(row: unknown[]): { _type: 'solves'; csv: string } | null {
  for (const cell of row) {
    if (cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves') {
      return cell as { _type: 'solves'; csv: string };
    }
  }
  return null;
}
