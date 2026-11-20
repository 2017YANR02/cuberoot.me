'use client';

import { GAN_ROSTER_TEAMS, GAN_TEAM_FILTER, normalizeWcaTeamFilter } from '@cuberoot/shared/wca-team-filters';
import { ListSelect } from '@/components/ListSelect';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import { tr } from '@/i18n/tr';
import type { WcaTeam } from '@/lib/wca-teams-api';

export function WcaTeamFilterSelect({ teams, value, onChange }: {
  teams: WcaTeam[];
  value: string;
  onChange: (value: string) => void;
}) {
  const items = wcaTeamSelectItems(teams).map(({ value, label }) => ({ value, label }));
  const ganTeams = GAN_ROSTER_TEAMS.flatMap(name => items.filter(item => item.label === name));
  const ordered = ganTeams.length
    ? [{ value: GAN_TEAM_FILTER, label: 'GAN' }, ...ganTeams, ...items.filter(item => !ganTeams.includes(item))]
    : items;
  const allLabel = tr({ zh: '不限战队', en: 'Any team' });
  const selected = normalizeWcaTeamFilter(value);
  return <ListSelect ariaLabel={tr({ zh: '战队', en: 'Team' })} allLabel={allLabel}
    value={selected} onChange={onChange} clearable={false}
    items={[{ value: '', label: allLabel }, { value: 'none', label: tr({ zh: '未设置', en: 'Not set' }) }, ...ordered]} />;
}
