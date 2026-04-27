/**
 * 纪录选择器——自定义下拉，选项渲染为彩色 RecordBadge（与显示侧一致）
 * NOTE: 原生 <select> 的 <option> 无法渲染样式化内容；用按钮 + 浮层模拟下拉。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RECORD_OPTIONS } from '../../utils/recon_utils';
import { RecordBadge } from '../RecordBadge';
import './record_select.css';

interface RecordSelectProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

export function RecordSelect({ value, onChange, className }: RecordSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`record-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="record-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="record-select-current">
          {value
            ? <RecordBadge record={value} />
            : <span className="record-select-empty">-</span>}
        </span>
        <ChevronDown size={14} className="record-select-chevron" />
      </button>
      {open && (
        <div className="record-select-popup">
          <button
            type="button"
            className={`record-select-item${value === '' ? ' record-select-item--active' : ''}`}
            onClick={() => select('')}
          >
            <span className="record-select-empty">-</span>
          </button>
          {RECORD_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`record-select-item${value === r ? ' record-select-item--active' : ''}`}
              onClick={() => select(r)}
            >
              <RecordBadge record={r} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
