'use client';

// Thin wrapper around shared WcaPersonPicker.
import { useCallback } from 'react';
import {
  WcaPersonPicker,
  loadPersonsIndex,
  searchLocalPersons,
  type WcaPerson,
} from '@cuberoot/shared';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  initialQuery?: string;
  onPick: (wcaId: string) => void;
  placeholder?: string;
  autoConfirmExact?: boolean;
}

export default function NemesizerPersonPicker({
  isZh, initialQuery, onPick, placeholder, autoConfirmExact = true,
}: Props) {
  const searchFn = useCallback(async (query: string): Promise<WcaPerson[]> => {
    await loadPersonsIndex();
    return searchLocalPersons(query, 20) ?? [];
  }, []);

  const handleSelect = useCallback((person: WcaPerson) => {
    onPick(person.wcaId);
  }, [onPick]);

  return (
    <div className="nemesizer-picker-wrap">
      <WcaPersonPicker
        mode="inline"
        onSelect={handleSelect}
        placeholder={placeholder ?? tr({ zh: '搜索 WCA ID、姓名、国家或年份', en: 'Search WCA ID, name, country or year'
                })}
        searchFn={searchFn}
        initialQuery={initialQuery}
        autoConfirmExact={autoConfirmExact}
      />
    </div>
  );
}
