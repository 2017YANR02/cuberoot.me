import type { Solve, TimerScrambleSourceSnapshot } from '@cuberoot/shared/timer';

export function showReconTestEntry(admin: boolean, connected: boolean, event: string, competition: boolean): boolean {
  return admin && connected && event === '333' && !competition;
}

/** The timer already snapshots this identity at attempt start and persists it with the solve. */
export function reconTestScrambleSource(id: number, sourceHash: string): TimerScrambleSourceSnapshot {
  return { kind: 'manual', identity: `recon-test:${id}:${sourceHash}` };
}

export function reconTestSource(solve: Solve): { sourceReconId: number; sourceReconHash: string } | undefined {
  if (solve.event !== '333' || solve.scrambleSource?.kind !== 'manual') return undefined;
  const match = /^recon-test:([1-9]\d*):([a-f0-9]{32})$/.exec(solve.scrambleSource.identity);
  const id = match ? Number(match[1]) : 0;
  return match && Number.isSafeInteger(id) && id <= 2147483647 && id > 0
    ? { sourceReconId: id, sourceReconHash: match[2] } : undefined;
}
