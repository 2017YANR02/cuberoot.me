import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import type { ListSelectItem } from '@/components/ListSelect';
import type { WcaTeam } from '@/lib/wca-teams-api';
import { MOYU_TEAMS } from '@/lib/wca-team-brands';
import { tr } from '@/i18n/tr';

export function wcaTeamSelectItems(teams: WcaTeam[], mode: 'filter' | 'edit' = 'filter', selectedValue = ''): ListSelectItem[] {
  const group = { hideLabel: true, value: 'moyu', label: tr({ zh: '魔域', en: 'MoYu' }), icon: <CubingBrandLabel name="魔域" logoOnly fallbackToName /> };
  const moyu = teams.filter(team => team.name === '魔域' || (MOYU_TEAMS as readonly string[]).includes(team.name));
  const items: ListSelectItem[] = [];
  let addedMoyu = false;
  for (const team of teams) {
    if (moyu.includes(team)) {
      if (addedMoyu) continue;
      addedMoyu = true;
      if (mode === 'filter') items.push({ hideLabel: true, value: 'moyu', label: tr({ zh: '全部魔域', en: 'All MoYu' }), icon: group.icon, group });
      for (const child of moyu) {
        if (child.name === '魔域' && mode === 'edit' && selectedValue !== String(child.id)) continue;
        items.push({ hideLabel: true, value: String(child.id), label: child.name === '魔域' ? tr({ zh: '魔域（未细分）', en: 'MoYu (unspecified)' }) : child.name,
          icon: <CubingBrandLabel name={child.name} logoOnly fallbackToName />, group });
      }
    } else items.push({ hideLabel: true, value: String(team.id), label: team.name, icon: <CubingBrandLabel name={team.name} logoOnly fallbackToName /> });
  }
  return items;
}
