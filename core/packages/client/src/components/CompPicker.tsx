// 比赛搜索输入框 — 文本输入 + 下拉建议。允许自由文本（非 WCA 比赛）。
// 选中时通过 onPick 回调把整条 Comp 记录给父组件（父决定回填哪些字段）。
import { useEffect, useRef, useState, useCallback } from 'react';
import { Flag } from '../utils/flag';
import { loadComps, searchComps, type Comp } from '../utils/comp_search';
import { compNameZh } from '../utils/country_flags';
import { stripWcaPrefix } from '../utils/comp_localize';
import { localizeCity } from '../utils/city_localize';
import { formatDateRangeIso } from '../utils/date_range';
import './comp_picker.css';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onPick: (comp: Comp) => void;
  placeholder?: string;
  isZh?: boolean;
  className?: string;
}

export function CompPicker({ value, onChange, onPick, placeholder, isZh, className }: Props) {
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Comp[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const ensureLoaded = useCallback(async () => {
    if (comps) return comps;
    const loaded = await loadComps();
    setComps(loaded);
    return loaded;
  }, [comps]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !value.trim()) { setResults([]); return; }
    (async () => {
      const data = await ensureLoaded();
      if (cancelled) return;
      setResults(searchComps(value, data, 20));
    })();
    return () => { cancelled = true; };
  }, [value, open, ensureLoaded]);

  const handlePick = (c: Comp) => {
    onPick(c);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`comp-picker ${className ?? ''}`.trim()}>
      <input
        type="text"
        className={value ? 'comp-picker-input--with-clear' : ''}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); ensureLoaded(); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="comp-picker-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(''); setOpen(false); }}
          aria-label={isZh ? '清除' : 'Clear'}
          title={isZh ? '清除' : 'Clear'}
        >×</button>
      )}
      {open && results.length > 0 && (
        <div className="comp-picker-popup">
          {results.map(c => {
            const zh = isZh ? compNameZh(c.name) : '';
            return (
              <button key={c.id} type="button" className="comp-picker-item" onClick={() => handlePick(c)}>
                <Flag iso2={c.country} />
                <span className="comp-picker-main">
                  <span className="comp-picker-name">{stripWcaPrefix(zh || c.name)}</span>
                  <span className="comp-picker-meta">
                    <span className="comp-picker-id">{c.id}</span>
                    {c.city ? <> · {localizeCity(c.city, !!isZh)}</> : null}
                    {' · '}{formatDateRangeIso(c.start_date, c.end_date)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
