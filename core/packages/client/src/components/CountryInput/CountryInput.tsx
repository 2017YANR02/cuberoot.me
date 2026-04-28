/**
 * 国家选择器——支持 ISO2 直输（cn / us）+ 国名搜索（USA / United States 都能找到）。
 * 存储值是小写 ISO2（'us' / 'cn' / ''）。
 *
 * 两种用法：
 *   1. 自由输入（如 SubmitPage 国家字段）：不传 restrictTo
 *   2. 受限筛选（如 UpcomingComps "All Countries"）：传 restrictTo + allLabel + counts
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../../utils/flag';
import { searchCountries } from '../../utils/country_flags';
import { countryName } from '../../utils/country_name';
import './country_input.css';

interface CountryInputProps {
  /** 当前 ISO2 值（小写 2 字母，'' 表示空） */
  value: string;
  onChange: (iso2: string) => void;
  placeholder?: string;
  className?: string;
  /** 限定可选范围（仅这些 iso2 出现在下拉中） */
  restrictTo?: Iterable<string>;
  /** 提供时下拉顶部出现"全部"项，对应空值 */
  allLabel?: string;
  /** iso2 → count，每个选项后面附加计数 */
  counts?: Record<string, number>;
}

export function CountryInput({
  value, onChange, placeholder, className, restrictTo, allLabel, counts,
}: CountryInputProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // NOTE: 外部 value 变化时同步本地 query
  useEffect(() => { setQuery(value); }, [value]);

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
    // NOTE: 受限模式空 query——按受限列表原顺序展示全部
    if (!query.trim() && restrictArr) {
      return restrictArr.map(iso2 => ({ iso2, name: countryName(iso2, isZh) }));
    }
    // NOTE: searchCountries 仍按英文别名搜（typing "USA" / "United States" 都能命中），
    //       下面渲染时用 countryName(iso, isZh) 重算显示名。
    return searchCountries(query, { restrictTo: restrictArr ?? undefined, limit: 250 });
  }, [query, restrictArr, isZh]);

  const select = (iso2: string) => {
    onChange(iso2);
    setQuery(iso2);
    setOpen(false);
  };

  const handleChange = (raw: string) => {
    setQuery(raw);
    setOpen(true);
    if (/^[a-zA-Z]{2}$/.test(raw)) {
      onChange(raw.toLowerCase());
    } else if (raw === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!/^[a-zA-Z]{2}$/.test(query) && matches.length === 1) {
      onChange(matches[0].iso2);
      setQuery(matches[0].iso2);
    }
  };

  // NOTE: 已选中且未在搜索时——左侧浮动国旗
  const showFlag = value.length === 2 && query.toLowerCase() === value.toLowerCase();
  // NOTE: 选中后显示本地化国家名（"美国" / "USA"），原始 iso2 没意义
  const displayedQuery = showFlag ? countryName(value, isZh) : query;

  return (
    <div ref={ref} className={`country-input ${className ?? ''}`.trim()}>
      {showFlag && <Flag iso2={value} className="country-input-flag" />}
      <input
        type="text"
        className={`country-input-field${showFlag ? ' country-input-field--with-flag' : ''}${value ? ' country-input-field--with-clear' : ''}`}
        value={displayedQuery}
        placeholder={placeholder ?? (allLabel ?? (isZh ? 'ISO2 / 国家名' : 'ISO2 / Country name'))}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="country-input-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
          aria-label={isZh ? '清除' : 'Clear'}
          title={isZh ? '清除' : 'Clear'}
        >×</button>
      )}
      {open && (matches.length > 0 || allLabel) && (
        <div className="country-input-popup">
          {allLabel && (
            <button
              type="button"
              className={`country-input-item${value === '' ? ' country-input-item--active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select('')}
            >
              <span className="country-input-name">{allLabel}</span>
            </button>
          )}
          {matches.map(({ iso2, name }) => (
            <button
              key={iso2}
              type="button"
              className={`country-input-item${value === iso2 ? ' country-input-item--active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(iso2)}
            >
              <Flag iso2={iso2} className="country-input-flag" />
              <span className="country-input-name">{name}</span>
              {counts && counts[iso2] !== undefined && (
                <span className="country-input-count">({counts[iso2]})</span>
              )}
              <span className="country-input-iso2">{iso2.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
