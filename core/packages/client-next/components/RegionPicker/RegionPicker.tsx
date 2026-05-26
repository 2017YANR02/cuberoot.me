'use client';

// Ported from packages/client/src/components/RegionPicker/RegionPicker.tsx.
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { countryName } from '@/lib/country-name';
import { isContinentCode, type ContinentCode } from '@/lib/continent';
import './region_picker.css';

interface ContinentInfo {
  slug: string;
  code: ContinentCode;
  zh: string;
  en: string;
}

const CONTINENTS: ContinentInfo[] = [
  { slug: 'africa',       code: 'AF', zh: '非洲',   en: 'Africa' },
  { slug: 'asia',         code: 'AS', zh: '亚洲',   en: 'Asia' },
  { slug: 'europe',       code: 'EU', zh: '欧洲',   en: 'Europe' },
  { slug: 'northAmerica', code: 'NA', zh: '北美洲', en: 'North America' },
  { slug: 'oceania',      code: 'OC', zh: '大洋洲', en: 'Oceania' },
  { slug: 'southAmerica', code: 'SA', zh: '南美洲', en: 'South America' },
];

function ContinentIcon({ slug }: { slug: string }) {
  return (
    <span className="region-picker-continent-icon">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/_assets/continent-icons/${slug}.svg`} alt="" />
    </span>
  );
}

interface SharedProps {
  isZh: boolean;
  className?: string;
  restrictTo?: string[];
  allLabel?: string;
  searchPlaceholder?: string;
}

type SingleProps = SharedProps & {
  multi?: false;
  value: string;
  onChange: (v: string) => void;
};

type MultiProps = SharedProps & {
  multi: true;
  value: string[];
  onChange: (v: string[]) => void;
};

export type RegionPickerProps = SingleProps | MultiProps;

export function RegionPicker(props: RegionPickerProps) {
  const { isZh, className, restrictTo, allLabel, searchPlaceholder } = props;
  const isMulti = props.multi === true;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', handler, { once: true }), 0);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const allText = allLabel ?? (isZh ? '全部区域' : 'All regions');
  const searchText = searchPlaceholder ?? (isZh ? '搜索...' : 'Search...');

  const countries = useMemo(
    () => (restrictTo ? restrictTo.map(c => c.toLowerCase()) : []),
    [restrictTo],
  );

  const singleVal = !isMulti ? (props as SingleProps).value : '';
  const singleSelectedContinent = !isMulti ? CONTINENTS.find(c => c.slug === singleVal) : undefined;
  const singleSelectedCountry =
    !isMulti && singleVal && singleVal !== 'world' && !singleSelectedContinent ? singleVal : '';

  const multiTokens = isMulti ? (props as MultiProps).value : [];
  const selectedContinentCodes = useMemo(
    () => new Set(multiTokens.filter(isContinentCode)),
    [multiTokens],
  );
  const selectedCountrySet = useMemo(
    () => new Set(multiTokens.filter(t => !isContinentCode(t)).map(t => t.toLowerCase())),
    [multiTokens],
  );

  const triggerLabel = (() => {
    if (isMulti) {
      if (multiTokens.length === 0) return allText;
      if (multiTokens.length === 1) {
        const t = multiTokens[0];
        if (isContinentCode(t)) {
          const c = CONTINENTS.find(c => c.code === t);
          return c ? (isZh ? c.zh : c.en) : allText;
        }
        return countryName(t, isZh);
      }
      return isZh ? `已选 ${multiTokens.length} 项` : `${multiTokens.length} selected`;
    }
    if (!singleVal || singleVal === 'world') return allText;
    if (singleSelectedContinent) return isZh ? singleSelectedContinent.zh : singleSelectedContinent.en;
    return countryName(singleVal, isZh);
  })();

  const triggerIcon = (() => {
    if (isMulti) {
      if (multiTokens.length === 1) {
        const t = multiTokens[0];
        if (isContinentCode(t)) {
          const c = CONTINENTS.find(c => c.code === t);
          return c ? <ContinentIcon slug={c.slug} /> : null;
        }
        return <Flag iso2={t} spanClassName="country-flag" imgClassName="country-flag-ct" />;
      }
      return null;
    }
    if (singleSelectedContinent) return <ContinentIcon slug={singleSelectedContinent.slug} />;
    if (singleSelectedCountry) {
      return <Flag iso2={singleSelectedCountry} spanClassName="country-flag" imgClassName="country-flag-ct" />;
    }
    return null;
  })();

  const ql = q.trim().toLowerCase();
  const showWorld = !ql || allText.toLowerCase().includes(ql);
  const continentsFiltered = useMemo(() => {
    if (!ql) return CONTINENTS;
    return CONTINENTS.filter(c => c.en.toLowerCase().includes(ql) || c.zh.includes(q));
  }, [ql, q]);
  const countriesFiltered = useMemo(() => {
    if (!ql) return countries;
    return countries.filter(iso =>
      iso.toLowerCase().includes(ql) ||
      countryName(iso, isZh).toLowerCase().includes(ql) ||
      countryName(iso, false).toLowerCase().includes(ql),
    );
  }, [countries, ql, isZh, q]);

  const closeAndClear = () => { setOpen(false); setQ(''); };
  const selectSingle = (v: string) => {
    if (!isMulti) (props as SingleProps).onChange(v);
    closeAndClear();
  };
  const toggleMultiCountry = (iso2: string) => {
    if (!isMulti) return;
    const lc = iso2.toLowerCase();
    if (selectedCountrySet.has(lc)) {
      (props as MultiProps).onChange(multiTokens.filter(t => t.toLowerCase() !== lc));
    } else {
      (props as MultiProps).onChange([...multiTokens, lc]);
    }
  };
  const toggleMultiContinent = (cont: ContinentCode) => {
    if (!isMulti) return;
    if (selectedContinentCodes.has(cont)) {
      (props as MultiProps).onChange(multiTokens.filter(t => t !== cont));
    } else {
      (props as MultiProps).onChange([...multiTokens, cont]);
    }
  };
  const clearAll = () => {
    if (isMulti) (props as MultiProps).onChange([]);
    else (props as SingleProps).onChange('world');
    closeAndClear();
  };

  const isWorldActive = isMulti ? multiTokens.length === 0 : (!singleVal || singleVal === 'world');
  const isContinentActive = (c: ContinentInfo) =>
    isMulti ? selectedContinentCodes.has(c.code) : singleVal === c.slug;
  const isCountryActive = (iso: string) =>
    isMulti ? selectedCountrySet.has(iso.toLowerCase()) : singleVal === iso.toLowerCase();

  return (
    <div className={`region-picker${className ? ` ${className}` : ''}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="region-picker-trigger" onClick={() => setOpen(o => !o)}>
        {triggerIcon}
        <span className="region-picker-label">{triggerLabel}</span>
        <span className="region-picker-caret">▾</span>
      </button>
      {open && (
        <div className="region-picker-popup">
          <div className="region-picker-search">
            <Search size={14} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchText}
            />
          </div>
          <div className="region-picker-list">
            {showWorld && (
              <button
                className={`region-picker-item${isWorldActive ? ' active' : ''}`}
                onClick={clearAll}
              >{allText}</button>
            )}
            {continentsFiltered.length > 0 && (
              <div className="region-picker-section">{isZh ? '大洲' : 'Continent'}</div>
            )}
            {continentsFiltered.map(c => (
              <button
                key={c.slug}
                className={`region-picker-item${isContinentActive(c) ? ' active' : ''}`}
                onClick={isMulti ? () => toggleMultiContinent(c.code) : () => selectSingle(c.slug)}
              >
                <ContinentIcon slug={c.slug} />
                <span>{isZh ? c.zh : c.en}</span>
              </button>
            ))}
            {countriesFiltered.length > 0 && (
              <div className="region-picker-section">{isZh ? '地区' : 'Region'}</div>
            )}
            {countriesFiltered.map(iso => (
              <button
                key={iso}
                className={`region-picker-item${isCountryActive(iso) ? ' active' : ''}`}
                onClick={isMulti ? () => toggleMultiCountry(iso) : () => selectSingle(iso)}
              >
                <Flag iso2={iso} spanClassName="country-flag" imgClassName="country-flag-ct" />
                <span>{countryName(iso, isZh)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
