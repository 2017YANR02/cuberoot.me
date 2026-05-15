// Thin wrapper around the shared WcaPersonPicker.
// No nemesizer dataset needed — search uses the shared persons_index that
// wca-stats already loads (one ~10MB gz, cached forever after first hit).
import { useCallback } from 'react';
import {
  WcaPersonPicker,
  loadPersonsIndex,
  searchLocalPersons,
  type WcaPerson,
} from '@cuberoot/shared';

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
        placeholder={placeholder ?? (isZh ? '搜索 WCA ID、姓名、国家或年份' : 'Search WCA ID, name, country or year')}
        searchFn={searchFn}
        initialQuery={initialQuery}
        autoConfirmExact={autoConfirmExact}
      />
    </div>
  );
}
