/** Public position identifiers accepted by the recruitment API. */
export const CAREER_POSITION_IDS = ['engineering', 'content-operations'] as const;
export type CareerPositionId = typeof CAREER_POSITION_IDS[number];

/** The legacy city field also identifies remote internship applications. */
export const CAREER_WORK_ARRANGEMENT_IDS = ['shanghai', 'remote-internship'] as const;
export type CareerWorkArrangementId = typeof CAREER_WORK_ARRANGEMENT_IDS[number];
export const CAREER_WORK_ARRANGEMENTS = {
  shanghai: { zh: '上海线下', en: 'On-site in Shanghai' },
  'remote-internship': { zh: '线上实习', en: 'Remote internship' },
} satisfies Record<CareerWorkArrangementId, { zh: string; en: string }>;
