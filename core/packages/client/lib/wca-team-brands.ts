import { GAN_ROSTER_TEAMS, MOYU_TEAMS } from '@cuberoot/shared/wca-team-filters';

/** Separate team identities grouped under the same parent brand. */
export const WCA_TEAM_BRANDS = [
  { name: 'GAN', teams: [...GAN_ROSTER_TEAMS, 'SpeedAce', 'GAN Creators'] },
  { name: '奇艺', teams: ['MFG'] },
  { name: '魔域', teams: MOYU_TEAMS },
] as const;

export function wcaTeamBrand(name: string): string {
  return WCA_TEAM_BRANDS.find(brand => (brand.teams as readonly string[]).includes(name))?.name ?? name;
}
