import { analyzeMccGrip, type MccGripAnalysis } from '../../../core/packages/client/lib/mcc.ts';

export const GRIP_WEIGHTS = { extraPerRegrip: 3, extraPerSupportSwitch: 0.5 } as const;

/** Continuous R/l versus r/L mode alternations. The first mode is free.
 * This heuristic is separate from MCC's segment-local support penalties. */
export function supportSwitches(tokens: string[]): number[] {
  let last: number | undefined;
  const positions: number[] = [];
  tokens.forEach((t, i) => {
    const next = ['R', 'l'].includes(t[0]) ? 1 : ['r', 'L'].includes(t[0]) ? -1 : undefined;
    if (next === undefined) return;
    if (last !== undefined && last !== next) positions.push(i + 1);
    last = next;
  });
  return positions;
}

export function startLabel(trace: MccGripAnalysis): string {
  const parts = (['left', 'right'] as const).filter(hand => trace.start[hand] !== 0)
    .map(hand => `${hand === 'left' ? '左' : '右'}拇指朝${trace.start[hand] < 0 ? '下' : '上'}`);
  return parts.length ? parts.join('、') + '预握' : '双手平握';
}

export function scoreGripCandidate(algorithm: string, mcc: number) {
  const grip = analyzeMccGrip(algorithm);
  const midRegrips = grip.events.filter(e => e.kind === 'regrip' && e.beforeMove > 1);
  const initialResets = grip.events.filter(e => e.kind === 'regrip' && e.beforeMove === 1);
  const switches = supportSwitches(algorithm.split(' '));
  const trialScore = Math.round((mcc + GRIP_WEIGHTS.extraPerRegrip * midRegrips.length
    + GRIP_WEIGHTS.extraPerSupportSwitch * switches.length) * 10) / 10;
  return { trialScore, grip, midRegrips, initialResets, supportSwitches: switches };
}
