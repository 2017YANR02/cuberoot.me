/** Public position identifiers accepted by the recruitment API. */
export const CAREER_POSITION_IDS = ['engineering', 'content-operations'] as const;
export type CareerPositionId = typeof CAREER_POSITION_IDS[number];
