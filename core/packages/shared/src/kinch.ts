/** The 17 current WCA events used by the Kinch all-round ranking. */
export const KINCH_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'minx', 'pyram', 'clock', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
] as const;

export type KinchEventId = typeof KINCH_EVENTS[number];
export type KinchResultType = 'single' | 'average';

export interface KinchEventInput {
  eventId: KinchEventId;
  single: number;
  average: number;
  recordSingle: number;
  recordAverage: number;
}

export interface KinchEventScore {
  /** Score in hundredths: 7,412 means 74.12. */
  scoreX100: number;
  value: number;
  type: KinchResultType;
}

const BEST_OF_SINGLE_AND_AVERAGE = new Set<KinchEventId>([
  '333bf', '333fm', '444bf', '555bf',
]);

/** WCA Multi-Blind encoding -> Kinch points, including the fraction of the hour left. */
export function multiBlindKinchPoints(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const seconds = Math.floor(value / 100) % 100_000;
  const points = 99 - (Math.floor(value / 10_000_000) % 100);
  const usedSeconds = seconds === 99_999 ? 3_600 : seconds;
  return Math.max(0, points + (1 - usedSeconds / 3_600));
}

function ratioScoreX100(record: number, personal: number): number {
  if (!Number.isFinite(record) || !Number.isFinite(personal) || record <= 0 || personal <= 0) return 0;
  return Math.max(0, Math.min(10_000, Math.round((record / personal) * 10_000)));
}

/**
 * Compute one event's Kinch score. The special-event rules match kinch2002's
 * definition and CubingApp: blind events and FMC use the better single/average;
 * Multi-Blind uses points plus the remaining fraction of the hour; all other
 * events use the average.
 */
export function calculateKinchEvent(input: KinchEventInput): KinchEventScore {
  const { eventId, single, average, recordSingle, recordAverage } = input;

  if (eventId === '333mbf') {
    const personalPoints = multiBlindKinchPoints(single);
    const recordPoints = multiBlindKinchPoints(recordSingle);
    const scoreX100 = personalPoints > 0 && recordPoints > 0
      ? Math.max(0, Math.min(10_000, Math.round((personalPoints / recordPoints) * 10_000)))
      : 0;
    return { scoreX100, value: single > 0 ? single : 0, type: 'single' };
  }

  if (BEST_OF_SINGLE_AND_AVERAGE.has(eventId)) {
    const singleScore = ratioScoreX100(recordSingle, single);
    const averageScore = ratioScoreX100(recordAverage, average);
    return averageScore >= singleScore
      ? { scoreX100: averageScore, value: average > 0 ? average : 0, type: 'average' }
      : { scoreX100: singleScore, value: single > 0 ? single : 0, type: 'single' };
  }

  return {
    scoreX100: ratioScoreX100(recordAverage, average),
    value: average > 0 ? average : 0,
    type: 'average',
  };
}

export function averageKinchScoreX100(scores: readonly KinchEventScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, item) => sum + item.scoreX100, 0) / scores.length);
}
