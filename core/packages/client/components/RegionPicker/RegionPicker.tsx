'use client';

// Ported from packages/client-vite/src/components/RegionPicker/RegionPicker.tsx.
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { ContinentIcon, type ContinentSlug } from '@/components/ContinentIcon';
import { countryName } from '@/lib/country-name';
import { isContinentCode, type ContinentCode } from '@/lib/continent';
import './region_picker.css';
import { tr } from '@/i18n/tr';

interface ContinentInfo {
  slug: ContinentSlug;
  code: ContinentCode;
  zh: string;
  en: string;
}

const CONTINENTS: ContinentInfo[] = [
  { slug: 'africa',       code: 'AF', zh: '非洲',   en: 'Africa' },
  { slug: 'asia',         code: 'AS', zh: '亚洲',   en: 'Asia'
},
  { slug: 'europe',       code: 'EU', zh: '欧洲',   en: 'Europe'
},
  { slug: 'northAmerica', code: 'NA', zh: '北美洲', en: 'North America' },
  { slug: 'oceania',      code: 'OC', zh: '大洋洲', en: 'Oceania' },
  { slug: 'southAmerica', code: 'SA', zh: '南美洲', en: 'South America' },
];

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

  const allText = allLabel ?? tr({ zh: '全部区域', en: 'All regions'
  });
  const searchText = searchPlaceholder ?? tr({ zh: '搜索...', en: 'Search...'
  });

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
          return c ? tr(c) : allText;
        }
        return countryName(t, isZh);
      }
      return (isZh ? `已选 ${multiTokens.length} 项` : `${multiTokens.length} selected`);
    }
    if (!singleVal || singleVal === 'world') return allText;
    if (singleSelectedContinent) return tr(singleSelectedContinent);
    return countryName(singleVal, isZh);
  })();

  const triggerIcon = (() => {
    if (isMulti) {
      if (multiTokens.length === 1) {
        const t = multiTokens[0];
        if (isContinentCode(t)) {
          const c = CONTINENTS.find(c => c.code === t);
          return c ? <ContinentIcon slug={c.slug} className="region-picker-continent-icon" /> : null;
        }
        return <Flag iso2={t} spanClassName="country-flag" imgClassName="country-flag-ct" />;
      }
      return null;
    }
    if (singleSelectedContinent) return <ContinentIcon slug={singleSelectedContinent.slug} className="region-picker-continent-icon" />;
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
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { closeAndClear(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (showWorld) { clearAll(); return; }
    if (continentsFiltered.length > 0) {
      const c = continentsFiltered[0];
      if (isMulti) { toggleMultiContinent(c.code); closeAndClear(); }
      else selectSingle(c.slug);
      return;
    }
    if (countriesFiltered.length > 0) {
      if (isMulti) { toggleMultiCountry(countriesFiltered[0]); closeAndClear(); }
      else selectSingle(countriesFiltered[0]);
    }
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
              className="region-picker-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchText}
            />
          </div>
          <div className="region-picker-list">
            {isMulti && multiTokens.length > 0 && !ql && (
              <>
                <div className="region-picker-section">{tr({ zh: '已选', en: 'Selected'
                })}</div>
                {multiTokens.map(t => {
                  const cont = isContinentCode(t) ? CONTINENTS.find(c => c.code === t) : undefined;
                  return (
                    <button
                      key={`sel-${t}`}
                      className="region-picker-item region-picker-selected"
                      onClick={cont ? () => toggleMultiContinent(cont.code) : () => toggleMultiCountry(t)}
                    >
                      {cont
                        ? <ContinentIcon slug={cont.slug} className="region-picker-continent-icon" />
                        : <Flag iso2={t} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                      <span>{cont ? tr(cont) : countryName(t, isZh)}</span>
                      <X size={13} className="region-picker-remove" />
                    </button>
                  );
                })}
              </>
            )}
            {showWorld && (
              <button
                className={`region-picker-item${isWorldActive ? ' active' : ''}`}
                onClick={clearAll}
              >{allText}</button>
            )}
            {continentsFiltered.length > 0 && (
              <div className="region-picker-section">{tr({ zh: '大洲', en: 'Continent' })}</div>
            )}
            {continentsFiltered.map(c => (
              <button
                key={c.slug}
                className={`region-picker-item${isContinentActive(c) ? ' active' : ''}`}
                onClick={isMulti ? () => toggleMultiContinent(c.code) : () => selectSingle(c.slug)}
              >
                <ContinentIcon slug={c.slug} className="region-picker-continent-icon" />
                <span>{tr(c)}</span>
              </button>
            ))}
            {countriesFiltered.length > 0 && (
              <div className="region-picker-section">{tr({ zh: '地区', en: 'Region'
            })}</div>
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
