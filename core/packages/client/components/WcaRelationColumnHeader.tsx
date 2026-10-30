'use client';

import { useState } from 'react';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import type { WcaTeacherDirectory } from '@/components/WcaTeacherCell';
import { displayCuberName } from '@/lib/cuber-name-display';
import { tr } from '@/i18n/tr';
import './wca-relation-filter.css';

export interface WcaColumnFilter {
  value: string;
  onChange: (value: string) => void;
  items: ListSelectItem[];
  disabled?: boolean;
}

export function WcaRelationColumnHeader({ label, filter, className }: { label: string; filter: WcaColumnFilter; className?: string }) {
  const items = filter.items.map(item => ({ ...item, disabled: filter.disabled || item.disabled }));
  if (filter.value && !items.some(item => item.value === filter.value)) items.push({ value: filter.value, label: filter.value, disabled: true });
  return <th className={className}>
    <ListSelect portal className="wca-relation-filter" ariaLabel={label} allLabel={label} searchable clearable={false}
      searchPlaceholder={tr({ zh: '搜索', en: 'Search' })}
      value={filter.value} onChange={filter.onChange}
      items={[{ value: '', label }, ...items]} />
  </th>;
}

export function teacherFilterItems(teachers: Iterable<{ teacherWcaId: string | null; teacherName: string | null }>, isZh: boolean): ListSelectItem[] {
  const names = new Map<string, string>();
  for (const teacher of teachers) {
    if (teacher.teacherWcaId) names.set(teacher.teacherWcaId, teacher.teacherName || teacher.teacherWcaId);
  }
  return [
    { value: 'none', label: tr({ zh: '未设置', en: 'Not set' }) },
    { value: 'self', label: tr({ zh: '自学', en: 'Self-taught' }) },
    ...[...names].map(([value, name]) => ({ value, label: displayCuberName(name, isZh), searchTerms: `${name} ${value}` })),
  ];
}

/** Full-data tables filter their original rows before truncation or pagination. */
export function useTeacherTableFilter(directory: WcaTeacherDirectory, isZh: boolean) {
  const [value, onChange] = useState('');
  const filter: WcaColumnFilter = { value, onChange, items: teacherFilterItems(directory.teachers.values(), isZh), disabled: !directory.ready };
  const matches = (studentWcaId: string, eventIds: readonly string[]) => {
    if (!value) return true;
    if (!directory.ready) return false;
    const relations = eventIds.map(event => directory.teachers.get(`${studentWcaId}:${event}`)).filter(r => r !== undefined);
    if (value === 'none') return relations.length === 0;
    if (value === 'self') return relations.some(r => r.isSelfTaught);
    return relations.some(r => r.teacherWcaId === value);
  };
  return { filter, matches };
}
