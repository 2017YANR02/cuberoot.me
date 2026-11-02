/** Separate team identities grouped under the same parent brand. */
export const MOYU_TEAMS = ['魔域战队', '魔域梦之队'] as const;
export const WCA_TEAM_BRANDS = [
  { name: 'GAN', teams: ['GAN GURUS', '宇宙爆速社-领航队', '宇宙爆速社-启航队', 'SpeedAce', 'GAN Creators'] },
  { name: '奇艺', teams: ['MFG'] },
  { name: '魔域', teams: MOYU_TEAMS },
] as const;

export function wcaTeamBrand(name: string): string {
  return WCA_TEAM_BRANDS.find(brand => (brand.teams as readonly string[]).includes(name))?.name ?? name;
}
