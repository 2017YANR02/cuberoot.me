/**
 * Parse a single time token into centiseconds.
 *  - "12.34"          → 1234
 *  - "1:23.45"        → 8345
 *  - "1:02:03.45"     → 372345
 *  - "DNF" / "dnf"    → -1
 *  - "DNS" / "dns"    → -2
 *  - empty / garbage  → null (caller skips)
 */
export function parseTimeToken(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (upper === 'DNF') return -1;
  if (upper === 'DNS') return -2;

  const cleaned = t.replace(/[(),]/g, '').trim();
  if (!cleaned) return null;

  const parts = cleaned.split(':');
  if (parts.length > 3) return null;

  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n) || n < 0) return null;
    if (i < parts.length - 1 && n !== Math.floor(n)) return null;
    total = total * 60 + n;
  }
  return Math.round(total * 100);
}

export function parseTimeList(text: string): number[] {
  return text
    .split(/[\n,;]+/g)
    .map(parseTimeToken)
    .filter((x): x is number => x !== null);
}
