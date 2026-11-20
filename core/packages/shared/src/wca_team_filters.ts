export const GAN_ROSTER_TEAMS = ['GAN GURUS', '宇宙爆速社-领航队', '宇宙爆速社-启航队'] as const;
export const MOYU_TEAMS = ['魔域战队', '魔域梦之队'] as const;
export const GAN_TEAM_FILTER = 'gan';

export function normalizeWcaTeamFilter(value: string): string {
  return value === '1' ? GAN_TEAM_FILTER : value;
}

// Preserve the original public GAN deep links after the roster was split.
export function wcaTeamFilterNames(value: string): readonly string[] | undefined {
  if (normalizeWcaTeamFilter(value) === GAN_TEAM_FILTER) return GAN_ROSTER_TEAMS;
  if (value === 'moyu') return ['魔域', ...MOYU_TEAMS];
}
