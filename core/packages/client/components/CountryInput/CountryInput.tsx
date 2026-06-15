'use client';

// Ported from packages/client-vite/src/components/CountryInput/CountryInput.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Flag } from '../Flag';
import { searchCountries } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { CONTINENT_NAMES, CONTINENT_TO_ISO2S, ISO2_TO_CONTINENT, isContinentCode, groupByContinent } from '@/lib/continent';
import { ClearButton } from '../ClearButton';
import './country_input.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface SharedProps {
  placeholder?: string;
  className?: string;
  restrictTo?: Iterable<string>;
  allLabel?: string;
  counts?: Record<string, number>;
}
type SingleProps = SharedProps & {
  multi?: false;
  value: string;
  onChange: (iso2: string) => void;
};
type MultiProps = SharedProps & {
  multi: true;
  value: string[];
  onChange: (tokens: string[]) => void;
};
type CountryInputProps = SingleProps | MultiProps;

export function CountryInput(props: CountryInputProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const { restrictTo, allLabel, counts, placeholder, className } = props;
  const isMulti = props.multi === true;
  const selected: string[] = isMulti ? props.value : (props.value ? [props.value] : []);
  const setSelected = (next: string[]) => {
    if (isMulti) (props as MultiProps).onChange(next);
    else (props as SingleProps).onChange(next[0] ?? '');
  };

  const selectedContinents = useMemo(() => new Set(selected.filter(isContinentCode)), [selected]);
  const selectedCountrySet = useMemo(
    () => new Set(selected.filter((t) => !isContinentCode(t)).map((t) => t.toLowerCase())),
    [selected],
  );

  const [query, setQuery] = useState(() => isMulti ? '' : (props as SingleProps).value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // IME 合成中(中文/日文等拼音输入)为 true:此时不要自动选中,否则会改父 value →
  // 受控 value 回写 → 打断合成,表现为"输入法被吃掉"。合成结束再补跑一次匹配。
  const composingRef = useRef(false);

  useEffect(() => {
    if (composingRef.current) return; // 合成中别回写 query,否则受控值打断 IME
    if (!isMulti) setQuery((props as SingleProps).value);
  }, [isMulti, isMulti ? '' : (props as SingleProps).value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const restrictArr = useMemo(() => restrictTo ? Array.from(restrictTo) : null, [restrictTo]);
  const matches = useMemo(() => {
    if (!query.trim() && restrictArr) {
      return restrictArr.map(iso2 => ({ iso2, name: countryName(iso2, isZh) }));
    }
    return searchCountries(query, { restrictTo: restrictArr ?? undefined, limit: 250 });
  }, [query, restrictArr, isZh]);

  const continentGroups = useMemo(() => {
    if (!isMulti || !restrictArr || query.trim()) return [];
    return groupByContinent(restrictArr);
  }, [isMulti, restrictArr, query]);

  const handleCountryClick = (iso2: string) => {
    if (!isMulti) {
      setSelected([iso2]);
      setQuery(iso2);
      setOpen(false);
      return;
    }
    const lc = iso2.toLowerCase();
    if (selectedCountrySet.has(lc)) {
      setSelected(selected.filter((t) => t.toLowerCase() !== lc));
      return;
    }
    const cont = ISO2_TO_CONTINENT[iso2.toUpperCase()];
    if (cont && selectedContinents.has(cont)) {
      const expanded = CONTINENT_TO_ISO2S[cont]
        .filter((c) => c.toUpperCase() !== iso2.toUpperCase())
        .map((c) => c.toLowerCase());
      const otherTokens = selected.filter((t) => t !== cont);
      setSelected([...otherTokens, ...expanded]);
      return;
    }
    setSelected([...selected, lc]);
  };

  const handleAll = () => {
    setSelected([]);
    if (!isMulti) setQuery('');
    setOpen(false);
  };

  const handleContinentClick = (cont: string) => {
    if (selectedContinents.has(cont as never)) {
      setSelected(selected.filter((t) => t !== cont));
    } else {
      const toRemove = new Set(
        selected.filter((t) => !isContinentCode(t) && ISO2_TO_CONTINENT[t.toUpperCase()] === cont)
      );
      const cleaned = selected.filter((t) => !toRemove.has(t));
      setSelected([...cleaned, cont]);
    }
  };

  const handleChange = (raw: string) => {
    setQuery(raw);
    setOpen(true);
    if (isMulti) return;
    // 清空即取消选中。其余值不在敲字时即时选中:那样会(a)打断中文 IME 合成,
    // (b)把"france"前两位 fr 误当 ISO2 顶替成「法国」再续打成「法国ance」。
    // 统一在点击下拉项 / 失焦(handleBlur)时解析。
    if (raw === '') setSelected([]);
  };

  const handleBlur = () => {
    if (isMulti) return;
    const qq = query.trim();
    if (!qq) { setSelected([]); return; }
    const cur = selected.length === 1 ? selected[0] : '';
    if (cur && qq.toLowerCase() === cur.toLowerCase()) return; // 已选中该国,别动
    const lc = qq.toLowerCase();
    // 正好打了个有效 ISO2(如 cn / jp):它就是最高分匹配,直接用
    if (/^[a-z]{2}$/.test(lc) && matches[0]?.iso2 === lc) {
      setSelected([lc]);
      setQuery(lc);
      return;
    }
    // 唯一匹配才自动选,避免多义(如 "united")选错;多义时留给用户点下拉
    if (matches.length === 1) {
      setSelected([matches[0].iso2]);
      setQuery(matches[0].iso2);
    }
  };

  const singleSelected = !isMulti && selected.length === 1 ? selected[0] : '';
  const showFlag = !isMulti && singleSelected.length === 2 && query.toLowerCase() === singleSelected.toLowerCase();
  const multiSingle = isMulti && selected.length === 1;
  const multiSingleIsCountry = multiSingle && !isContinentCode(selected[0]);
  const showFlagMulti = multiSingleIsCountry && !query;
  const displayedQuery = (() => {
    if (!isMulti) return showFlag ? countryName(singleSelected, isZh) : query;
    if (query) return query;
    if (multiSingle) {
      const t = selected[0];
      return isContinentCode(t)
        ? tr(CONTINENT_NAMES[t])
        : countryName(t, isZh);
    }
    if (selected.length >= 2) return (isZh ? `已选 ${selected.length} 项` : `${selected.length} selected`);
    return '';
  })();

  const removeOne = (token: string) => setSelected(selected.filter((t) => t !== token));

  const renderChip = (token: string) => {
    if (isContinentCode(token)) {
      const name = tr(CONTINENT_NAMES[token]);
      return (
        <span key={`cont-${token}`} className="country-input-chip country-input-chip--continent">
          <Globe size={12} className="country-input-continent-icon" aria-hidden />
          <span className="country-input-chip-name">{name}</span>
          <button
            type="button"
            className="country-input-chip-x"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => removeOne(token)}
            aria-label={isZh ? `移除 ${name}` : `Remove ${name}`}
          >×</button>
        </span>
      );
    }
    return (
      <span key={`country-${token}`} className="country-input-chip">
        <Flag iso2={token} className="country-input-flag" />
        <span className="country-input-chip-name">{countryName(token, isZh)}</span>
        <button
          type="button"
          className="country-input-chip-x"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => removeOne(token)}
          aria-label={isZh ? `移除 ${countryName(token, isZh)}` : `Remove ${countryName(token, isZh)}`}
        >×</button>
      </span>
    );
  };

  return (
    <div ref={ref} className={`country-input ${className ?? ''}${isMulti ? ' country-input--multi' : ''}`.trim()}>
      {(showFlag || showFlagMulti) && <Flag iso2={singleSelected || selected[0]} className="country-input-flag" />}
      <input
        type="text"
        className={`country-input-field${(showFlag || showFlagMulti) ? ' country-input-field--with-flag' : ''}${selected.length > 0 ? ' country-input-field--with-clear' : ''}`}
        value={displayedQuery}
        placeholder={placeholder ?? (allLabel ?? tr({ zh: '搜国家名', en: 'Search country'
                }))}
        onChange={(e) => handleChange(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => { composingRef.current = false; handleChange(e.currentTarget.value); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {selected.length > 0 && (
        <ClearButton
          onClick={() => { setSelected([]); setQuery(''); setOpen(false); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {open && (matches.length > 0 || allLabel || continentGroups.length > 0) && (
        <div className="country-input-popup">
          {isMulti && selected.length > 0 && (
            <div className="country-input-chips">
              {selected.map(renderChip)}
            </div>
          )}
          {continentGroups.map(({ continent, iso2s }) => {
            const active = selectedContinents.has(continent);
            return (
              <button
                key={`continent-${continent}`}
                type="button"
                className={`country-input-item country-input-item--continent${active ? ' country-input-item--active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleContinentClick(continent)}
              >
                <Globe size={14} className="country-input-continent-icon" aria-hidden />
                <span className="country-input-name">{tr(CONTINENT_NAMES[continent])}</span>
                <span className="country-input-count">({iso2s.length})</span>
                {active && <span className="country-input-check" aria-hidden>✓</span>}
              </button>
            );
          })}
          {!isMulti && allLabel && (
            <button
              type="button"
              className={`country-input-item${selected.length === 0 ? ' country-input-item--active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAll}
            >
              <span className="country-input-name">{allLabel}</span>
            </button>
          )}
          {matches.map(({ iso2 }) => {
            const cont = ISO2_TO_CONTINENT[iso2.toUpperCase()];
            const direct = selectedCountrySet.has(iso2.toLowerCase());
            const viaContinent = !direct && cont && selectedContinents.has(cont);
            const active = direct || viaContinent;
            return (
              <button
                key={iso2}
                type="button"
                className={`country-input-item${active ? ' country-input-item--active' : ''}${viaContinent ? ' country-input-item--via-continent' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleCountryClick(iso2)}
              >
                <Flag iso2={iso2} className="country-input-flag" />
                <span className="country-input-name">{countryName(iso2, isZh)}</span>
                {counts && counts[iso2] !== undefined && (
                  <span className="country-input-count">({counts[iso2]})</span>
                )}
                {isMulti && active && <span className={`country-input-check${viaContinent ? ' country-input-check--partial' : ''}`} aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
