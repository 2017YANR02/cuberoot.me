export const CREATOR_PROFILE = {
  href: '/about/ruimin',
  wcaId: '2017YANR02',
  nameZh: '颜瑞民',
  nameEn: 'Ruimin Yan',
} as const;

export function creatorProfileHrefForWcaId(wcaId: string | null | undefined): string | null {
  return wcaId === CREATOR_PROFILE.wcaId ? CREATOR_PROFILE.href : null;
}
