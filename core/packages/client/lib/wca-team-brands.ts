/** Separate team identities grouped under the same parent brand. */
export const MOYU_TEAMS = ['魔域战队', '魔域梦之队'] as const;

export function wcaTeamBrand(name: string): string {
  return (MOYU_TEAMS as readonly string[]).includes(name) ? '魔域' : name;
}
