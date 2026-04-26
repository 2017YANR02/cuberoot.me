// Thin wrapper around shared WcaPersonPicker, plumbed to the local nemesizer
// binary index (already loaded for the nemesis algorithms — no extra fetch).
import { useCallback } from 'react';
import { WcaPersonPicker, type WcaPerson } from '@cuberoot/shared';
import type { NemesizerDataset } from '../data/nemesizerData';
import { findPersons } from '../data/nemesizerData';

interface Props {
  ds: NemesizerDataset;
  isZh: boolean;
  initialQuery?: string;
  onPick: (wcaId: string) => void;
  placeholder?: string;
  autoConfirmExact?: boolean;
}

export default function NemesizerPersonPicker({
  ds, isZh, initialQuery, onPick, placeholder, autoConfirmExact = true,
}: Props) {
  const searchFn = useCallback((query: string): WcaPerson[] => {
    const idxs = findPersons(ds, query);
    return idxs.slice(0, 20).map(i => {
      const p = ds.persons[i];
      return { wcaId: p.wcaId, name: p.name, iso2: p.countryIso2, avatarUrl: '' };
    });
  }, [ds]);

  const handleSelect = useCallback((person: WcaPerson) => {
    onPick(person.wcaId);
  }, [onPick]);

  return (
    <WcaPersonPicker
      mode="inline"
      onSelect={handleSelect}
      placeholder={placeholder ?? (isZh ? '搜索 WCA ID、姓名、国家或年份' : 'Search WCA ID, name, country or year')}
      searchFn={searchFn}
      initialQuery={initialQuery}
      autoConfirmExact={autoConfirmExact}
    />
  );
}
