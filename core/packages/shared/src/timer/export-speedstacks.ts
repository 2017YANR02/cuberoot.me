import type { Solve } from './types';

function formatMmSsMmm(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = millis.toString().padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

/**
 * Speedstacks export — one line per solve, sorted by ts ascending.
 * - OK:  MM:SS.mmm
 * - +2:  MM:SS.mmm+   (effective time = raw + 2000)
 * - DNF: DNF
 * - DNS: DNS
 */
export function exportSpeedstacks(solves: Solve[]): string {
  if (!solves || solves.length === 0) return '';
  const sorted = solves.slice().sort((a, b) => a.ts - b.ts);
  const lines: string[] = [];
  for (const s of sorted) {
    if (s.penalty === 'DNS') {
      lines.push('DNS');
    } else if (s.penalty === 'DNF') {
      lines.push('DNF');
    } else if (s.penalty === '+2') {
      lines.push(formatMmSsMmm(s.timeMs + 2000) + '+');
    } else {
      lines.push(formatMmSsMmm(s.timeMs));
    }
  }
  return lines.join('\n') + '\n';
}
