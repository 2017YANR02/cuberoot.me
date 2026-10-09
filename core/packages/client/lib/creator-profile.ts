import { SITE_CREATOR_PROFILE } from '@cuberoot/shared/site-directory';

export const CREATOR_PROFILE = SITE_CREATOR_PROFILE;

// Owner-confirmed on 2026-10-02; aggregate across social platforms, not
// deduplicated people, website users, current reach or paying customers.
export const CREATOR_AUDIENCE = {
  followersApprox: 500000,
  confirmedOn: '2026-10-02',
  summary: {
    zh: '自媒体平台合计约 50 万关注',
    en: 'Approximately 500,000 aggregate social-media follows',
  },
} as const;

export function creatorProfileHrefForWcaId(wcaId: string | null | undefined): string | null {
  return wcaId === CREATOR_PROFILE.wcaId ? CREATOR_PROFILE.href : null;
}
