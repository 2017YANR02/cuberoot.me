/**
 * 纪录选择器——自定义下拉，选项渲染为彩色 RecordBadge（与显示侧一致）
 * NOTE: 原生 <select> 的 <option> 无法渲染样式化内容；用按钮 + 浮层模拟下拉。
 *
 * 两种用法:
 * - 提交场景 (ReconSubmitPage): 不传 records,用全集 RECORD_OPTIONS,顶部 "-" 表示无纪录
 * - 筛选场景 (ReconListPage): 传 records=[{code,count}] 限定可选项,显示 count;有值时显示 × 清除
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { RECORD_OPTIONS } from '../../utils/recon_utils';
import { RecordBadge } from '../RecordBadge';
import './record_select.css';

interface RecordSelectProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** 仅展示这些代码;每项的 count 会显示在 badge 后 */
  records?: { code: string; count: number }[];
  /** trigger / popup 顶部 "未选" 占位文字;默认 "-" */
  placeholder?: string;
}

export function RecordSelect({ value, onChange, className, records, placeholder }: RecordSelectProps) {
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

  const items: { code: string; count?: number }[] = records ?? RECORD_OPTIONS.map(c => ({ code: c }));
  const current = records?.find(r => r.code === value);
  const emptyLabel = placeholder ?? '-';

  return (
    <div ref={ref} className={`record-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="record-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="record-select-current">
          {value ? (
            <>
              <RecordBadge record={value} />
              {current?.count != null && <span className="record-select-count">({current.count})</span>}
            </>
          ) : (
            <span className="record-select-empty">{emptyLabel}</span>
          )}
        </span>
        {records && value && (
          <span
            className="record-select-clear"
            role="button"
            aria-label="clear"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={14} className="record-select-chevron" />
      </button>
      {open && (
        <div className="record-select-popup">
          {/* NOTE: 提交场景顶部展示 "-" 让用户清空;筛选场景已有 × 按钮,不需要这一行 */}
          {!records && (
            <button
              type="button"
              className={`record-select-item${value === '' ? ' record-select-item--active' : ''}`}
              onClick={() => select('')}
            >
              <span className="record-select-empty">{emptyLabel}</span>
            </button>
          )}
          {items.map(({ code, count }) => (
            <button
              key={code}
              type="button"
              className={`record-select-item${value === code ? ' record-select-item--active' : ''}`}
              onClick={() => select(code)}
            >
              <RecordBadge record={code} />
              {count != null && <span className="record-select-count">({count})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
