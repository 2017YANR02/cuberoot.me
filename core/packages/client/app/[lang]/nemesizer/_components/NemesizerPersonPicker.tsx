'use client';

import { useEffect, useState } from 'react';
import { getPerson, type WcaPersonLite } from '@/lib/wca-api';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  initialQuery?: string;
  onPick: (wcaId: string) => void;
  placeholder?: string;
  showSelectedPerson?: boolean;
}

export default function NemesizerPersonPicker({ isZh, initialQuery, onPick, placeholder, showSelectedPerson = false }: Props) {
  const [selected, setSelected] = useState<WcaPersonLite | null>(null);
  useEffect(() => {
    if (!showSelectedPerson || !initialQuery) return;
    let active = true;
    getPerson(initialQuery).then(person => { if (active) setSelected(person); }).catch(() => {});
    return () => { active = false; };
  }, [initialQuery, showSelectedPerson]);
  const value = showSelectedPerson && selected?.id === initialQuery ? selected : null;
  return <div className="nemesizer-picker-wrap">
    <WcaPersonPicker key={initialQuery ?? ''} value={value} defaultQuery={initialQuery}
      isZh={isZh} onChange={person => { setSelected(person); onPick(person?.id ?? ''); }}
      placeholder={placeholder ?? tr({ zh: '搜索姓名或 WCA ID', en: 'Search name or WCA ID' })} />
  </div>;
}
