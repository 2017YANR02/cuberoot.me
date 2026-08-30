import { SITE_CREATOR_PROFILE } from '@cuberoot/shared/site-directory';

export const CREATOR_PROFILE = SITE_CREATOR_PROFILE;

export function creatorProfileHrefForWcaId(wcaId: string | null | undefined): string | null {
  return wcaId === CREATOR_PROFILE.wcaId ? CREATOR_PROFILE.href : null;
}
