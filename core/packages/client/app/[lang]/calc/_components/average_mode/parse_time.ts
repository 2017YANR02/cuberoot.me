/**
 * Parse a single time token into centiseconds.
 *  - "12.34"          → 1234
 *  - "1:23.45"        → 8345
 *  - "1:02:03.45"     → 372345
 *  - "DNF" / "dnf"    → -1
 *  - "DNS" / "dns"    → -2
 *
 * 纯数字串 (无 . :) 按 csTimer 风格解析,从右往左每两位为 cs/sec/min/hr:
 *  - "1234"  → 12.34s = 1234
 *  - "12345" → 1:23.45 = 8345
 *  - "32"    → 0.32s = 32
 *
 * event === '333fm' 时纯整数为步数 (内部用步数*100 编码):
 *  - "32" → 3200
 */
export function parseTimeToken(raw: string, event?: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (upper === 'DNF') return -1;
  if (upper === 'DNS') return -2;

  const cleaned = t.replace(/[(),]/g, '').trim();
  if (!cleaned) return null;

  if (/^\d+$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    if (!Number.isFinite(n)) return null;
    if (event === '333fm') return n * 100;
    const cs = n % 100;
    let rest = Math.floor(n / 100);
    const sec = rest % 100;
    rest = Math.floor(rest / 100);
    const min = rest % 100;
    const hr = Math.floor(rest / 100);
    return ((hr * 60 + min) * 60 + sec) * 100 + cs;
  }

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

export function parseTimeList(text: string, event?: string): number[] {
  return text
    .split(/[\n,;]+/g)
    .map((s) => parseTimeToken(s, event))
    .filter((x): x is number => x !== null);
}
