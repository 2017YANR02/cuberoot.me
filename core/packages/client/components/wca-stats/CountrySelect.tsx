'use client';

// Ported from packages/client-vite/src/pages/wca_stats/CountrySelect.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { countryName } from '@/lib/country-name';
import { ClearButton } from '@/components/ClearButton';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';

export interface CountryOption {
  id: string;
  iso2: string | null;
  name: string;
  continentId?: string;
}

interface Props {
  countries: CountryOption[];
  value: string;
  isZh: boolean;
  onChange: (id: string) => void;
}

export default function CountrySelect({ countries, value, isZh, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const display = (c: CountryOption) => c.iso2 ? countryName(c.iso2, isZh) : c.name;

  const filtered = useMemo(() => {
    if (!query) return countries;
    const q = query.toLowerCase();
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      display(c).toLowerCase().includes(q) ||
      (c.iso2 ?? '').toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, query, isZh]);

  const selected = useMemo(() => countries.find(c => c.id === value) ?? null, [countries, value]);

  return (
    <div className="wse-filter wse-country" ref={ref}>
      <label>{tr({ zh: '国家', en: 'Country'
    })}</label>
      <div className="wse-country-trigger">
        <button type="button" className="wse-country-trigger-btn" onClick={() => setOpen(o => !o)}>
          {selected ? (
            <>
              {selected.iso2 && <Flag iso2={selected.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
              <span>{display(selected)}</span>
            </>
          ) : (
            <span>{tr({ zh: '全球', en: 'Worldwide' })}</span>
          )}
        </button>
        {value && <ClearButton variant="standalone" onClick={() => onChange('')} isZh={isZh} preserveFocus />}
      </div>
      {open && (
        <div className="wse-country-popup">
          <div className="wse-country-search">
            <Search size={14} />
            <input
              className="wse-country-search-input"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr({ zh: '搜索国家...', en: 'Search country...'
            })}
            />
          </div>
          <div className="wse-country-list">
            <button
              className={`wse-country-item ${!value ? 'active' : ''}`}
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
            >{tr({ zh: '全球', en: 'Worldwide' })}</button>
            {filtered.map(c => (
              <button
                key={c.id}
                className={`wse-country-item ${value === c.id ? 'active' : ''}`}
                onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }}
              >
                {c.iso2 && <Flag iso2={c.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                <span>{display(c)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function useCountries(): CountryOption[] {
  const [list, setList] = useState<CountryOption[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/v1/wca/historical-ranks/countries'))
      .then(r => r.json())
      .then((j: { countries: CountryOption[] }) => { if (alive) setList(j.countries); })
      .catch(() => { /* leave empty */ });
    return () => { alive = false; };
  }, []);
  return list;
}
