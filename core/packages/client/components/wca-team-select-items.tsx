import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import type { ListSelectItem } from '@/components/ListSelect';
import type { WcaTeam } from '@/lib/wca-teams-api';
import { tr } from '@/i18n/tr';

export function wcaTeamSelectItems(teams: WcaTeam[], mode: 'filter' | 'edit' = 'filter', selectedValue = ''): ListSelectItem[] {
  return teams.flatMap((team): ListSelectItem[] => {
    if (team.name === '魔域') {
      // Preserve the current legacy assignment in the editor without offering it for new selections.
      return mode === 'edit' && selectedValue === String(team.id)
        ? [{ value: String(team.id), label: tr({ zh: '魔域（未细分）', en: 'MoYu (unspecified)' }), disabled: true }]
        : [];
    }
    return [{ hideLabel: true, value: String(team.id), label: team.name,
      icon: <CubingBrandLabel name={team.name} logoOnly fallbackToName /> }];
  });
}
