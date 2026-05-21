// 比赛搜索输入框 — 文本输入 + 下拉建议。允许自由文本（非 WCA 比赛）。
// 选中时通过 onPick 回调把整条 Comp 记录给父组件（父决定回填哪些字段）。
// 用户粘贴 cubing.com 或 WCA 比赛链接时,自动解出 WCA ID 触发 onUrlPaste(若有传)。
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Flag } from '../utils/flag';
import { loadComps, searchComps, isCancelledComp, type Comp } from '../utils/comp_search';
import { localizeCompName } from '../utils/comp_localize';
import { localizeCity } from '../utils/city_localize';
import { formatDateRangeIso } from '../utils/date_range';
import { ClearButton } from './ClearButton';
import './comp_picker.css';

/** 下拉里的快速预设项(非 WCA 时可用,如"家/Home") */
export interface CompPickerPreset {
  icon?: ReactNode;
  label: string;
  /** 选中时填入 input 的字符串 */
  value: string;
}

/** 识别 cubing.com / WCA 比赛链接,返回归一的 WCA ID(无横杠);不是链接返 null. */
export function extractWcaIdFromUrl(input: string): string | null {
  // 用户用 × (U+00D7) 替代 x 的偶发场景(中文输入法 / 复制时被替换)兜底归一化
  const t = input.trim().replace(/×/g, 'x');
  const cubing = t.match(/cubing\.com\/(?:live|competition)\/([A-Za-z0-9_-]+)/i);
  if (cubing) return cubing[1].replace(/-/g, '');
  const wca = t.match(/worldcubeassociation\.org\/competitions\/([A-Za-z0-9_]+)/i);
  if (wca) return wca[1];
  return null;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onPick: (comp: Comp) => void;
  placeholder?: string;
  isZh?: boolean;
  className?: string;
  /** true 时不查 WCA 比赛建议(用于非 WCA 比赛场景);仍可显示 presets */
  disableSuggestions?: boolean;
  /** 下拉顶部的固定预设项(常驻显示,与 disableSuggestions 无关) */
  presets?: CompPickerPreset[];
  /** 用户粘贴 cubing.com / WCA 比赛链接时回调(参数=归一化 WCA ID,无横杠).
   *  不传则按普通文本输入处理. */
  onUrlPaste?: (wcaId: string) => void;
}

export function CompPicker({ value, onChange, onPick, placeholder, isZh, className, disableSuggestions, presets, onUrlPaste }: Props) {
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Comp[]>([]);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 中文模式下,失焦时把已知 WCA 比赛名(英文)显示成中文(用户未输入仍可通过原值搜索)。聚焦/编辑时显原值
  const displayValue = (() => {
    if (!isZh || focused || !value) return value;
    return localizeCompName('', value, true);
  })();

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
        value={displayValue}
        onChange={e => {
          const v = e.target.value;
          if (onUrlPaste) {
            const wcaId = extractWcaIdFromUrl(v);
            if (wcaId) { onUrlPaste(wcaId); return; }
          }
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => { setFocused(true); setOpen(true); if (!disableSuggestions) ensureLoaded(); }}
        onBlur={() => { setFocused(false); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value && (
        <ClearButton
          onClick={() => { onChange(''); setOpen(false); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {open && ((presets && presets.length > 0) || (!disableSuggestions && results.length > 0)) && (
        <div className="comp-picker-popup">
          {presets?.map((p, i) => (
            <button
              key={`preset-${i}`}
              type="button"
              className="comp-picker-item comp-picker-item--preset"
              onClick={() => { onChange(p.value); setOpen(false); }}
            >
              {p.icon && <span className="comp-picker-preset-icon">{p.icon}</span>}
              <span className="comp-picker-main">
                <span className="comp-picker-name">{p.label}</span>
              </span>
            </button>
          ))}
          {!disableSuggestions && results.map(c => {
            const displayName = localizeCompName(c.id, c.name, !!isZh);
            const cancelled = isCancelledComp(c);
            return (
              <button
                key={c.id}
                type="button"
                className={`comp-picker-item${cancelled ? ' is-cancelled' : ''}`}
                onClick={() => handlePick(c)}
              >
                <Flag iso2={c.country} />
                <span className="comp-picker-main">
                  <span className="comp-picker-name">{displayName}</span>
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
