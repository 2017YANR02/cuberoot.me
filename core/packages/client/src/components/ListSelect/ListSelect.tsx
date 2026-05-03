/**
 * 通用列表筛选下拉——button + popup,支持国旗 + 搜索 + × 清除 + (空) 桶
 * NOTE: 取代原 SolverSelect / CompFilterSelect 各自一份的重复实现。
 *       caller 预格式化 label / hint / country / searchTerms,组件不做本地化。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Flag } from '../../utils/flag';
import './list_select.css';

export interface ListSelectItem {
  /** 唯一 key,也是 onChange 回传值 */
  value: string;
  /** 已本地化的显示文本 */
  label: string;
  /** 次要文字 (如 count) — 显示在 label 后,带括号自己写好 */
  hint?: string;
  /** 用于搜索过滤的额外文本 (如中文模式下也想被英文名命中) */
  searchTerms?: string;
  /** ISO2 国家码;非空时 label 前渲染 <Flag> */
  country?: string;
}

interface ListSelectProps {
  items: ListSelectItem[];
  value: string;
  onChange: (next: string) => void;
  allLabel: string;
  className?: string;
  /** popup 顶部加搜索框 (列表长时建议开) */
  searchable?: boolean;
}

export function ListSelect({ items, value, onChange, allLabel, className, searchable }: ListSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.value.toLowerCase().includes(q) ||
      (i.searchTerms ?? '').toLowerCase().includes(q),
    );
  }, [items, query, searchable]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const current = items.find(i => i.value === value);

  return (
    <div ref={ref} className={`list-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="list-select-trigger"
        onClick={() => setOpen(o => !o)}
      >
        <span className="list-select-current">
          {current ? (
            <>
              {current.country && <Flag iso2={current.country} className="list-select-flag" />}
              <span className="list-select-label">
                {current.label}{current.hint ? ` ${current.hint}` : ''}
              </span>
            </>
          ) : (
            <span className="list-select-label">{allLabel}</span>
          )}
        </span>
        {value && (
          <span
            className="list-select-clear"
            role="button"
            aria-label="clear"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={14} className="list-select-chevron" />
      </button>
      {open && (
        <div className="list-select-popup">
          {searchable && (
            <input
              ref={inputRef}
              type="text"
              className="list-select-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <div className="list-select-list">
            {filtered.map(i => (
              <button
                key={i.value}
                type="button"
                className={`list-select-item${value === i.value ? ' list-select-item--active' : ''}`}
                onClick={() => select(i.value)}
              >
                {i.country && <Flag iso2={i.country} className="list-select-flag" />}
                <span className="list-select-label">
                  {i.label}{i.hint ? ` ${i.hint}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
