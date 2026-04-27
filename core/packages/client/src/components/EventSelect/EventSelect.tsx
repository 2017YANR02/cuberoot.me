/**
 * WCA 项目选择器——自定义下拉，trigger 和选项都用 EventIcon + 文字
 * NOTE: 原生 <option> 渲染不出 cubing-icon 字体；用按钮 + 浮层模拟。
 *       events 列表由调用方传入（不同模块支持的项目集不同：recon 16 项 / wca-stats 21 项）。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EventIcon } from '../EventIcon';
import { eventDisplayName, isWcaEvent } from '../../utils/wca_events';
import './event_select.css';

interface EventSelectProps {
  /** 候选事件 id 列表（可以是短名或 WCA id；按数组顺序展示） */
  events: string[];
  /** 当前选中值——保持与 events 同套命名（调用方决定存短名还是 WCA id） */
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** 提供时支持"全部"——空字符串值，trigger 和 popup 顶部都显示该 label */
  allLabel?: string;
}

export function EventSelect({ events, value, onChange, className, allLabel }: EventSelectProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
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
    <div ref={ref} className={`event-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="event-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="event-select-current">
          {value ? (
            <>
              {isWcaEvent(value) && <EventIcon event={value} />}
              <span className="event-select-label">{eventDisplayName(value, isZh)}</span>
            </>
          ) : (
            <span className={allLabel ? 'event-select-label' : 'event-select-empty'}>
              {allLabel ?? '-'}
            </span>
          )}
        </span>
        <ChevronDown size={14} className="event-select-chevron" />
      </button>
      {open && (
        <div className="event-select-popup">
          {allLabel !== undefined && (
            <button
              type="button"
              className={`event-select-item${value === '' ? ' event-select-item--active' : ''}`}
              onClick={() => select('')}
            >
              <span className="event-select-label">{allLabel}</span>
            </button>
          )}
          {events.map((ev) => (
            <button
              key={ev}
              type="button"
              className={`event-select-item${value === ev ? ' event-select-item--active' : ''}`}
              onClick={() => select(ev)}
            >
              {isWcaEvent(ev) && <EventIcon event={ev} />}
              <span className="event-select-label">{eventDisplayName(ev, isZh)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
