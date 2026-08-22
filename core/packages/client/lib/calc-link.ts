import { decodeMbldFields, isMbldEvent } from '@/lib/mbf-average';

export interface CalcCompetitionLinkInput {
  eventId: string;
  attempts: number[];
  personName?: string;
  wcaId?: string;
  competitionId: string;
  competitionName?: string;
  roundTypeId: string;
}

/** Convert a raw WCA attempt into the calculator's internal numeric unit. */
export function wcaAttemptToCalcValue(eventId: string, value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  if (value < 0) return -1;
  if (eventId === '333fm') return Math.round(value * 100);
  if (!isMbldEvent(eventId)) return Math.round(value);

  // MBLD calculator rows compare points, while WCA results use packed result values.
  return Math.max(0, (99 - decodeMbldFields(value).dd) * 100);
}

/** Build the canonical result-row deep link into /calc. */
export function calcCompetitionHref(input: CalcCompetitionLinkInput): string {
  const params = new URLSearchParams();
  params.set('event', input.eventId);
  params.set('sourceEvent', input.eventId);

  const attempts = input.attempts.map(value => wcaAttemptToCalcValue(input.eventId, value));
  if (attempts.some(value => value !== 0)) params.set('t0', attempts.join(','));
  if (input.personName) params.set('name0', input.personName);
  params.set('comp', input.competitionId);
  if (input.competitionName) params.set('compName', input.competitionName);
  params.set('round', input.roundTypeId);
  if (input.wcaId) params.set('wcaId', input.wcaId);

  return `/calc?${params.toString()}`;
}
