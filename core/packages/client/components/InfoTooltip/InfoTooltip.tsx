'use client';
/**
 * 小 popover:Info 图标点击展开多行说明,点外面 / Esc 关.
 * native title= 只在 hover 出, 这个是 click-toggle 兼桌面 + 移动.
 */
import { useState, useEffect, useRef } from 'react';
import { Info, X, type LucideIcon } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './info_tooltip.css';

interface Props {
  /** 多行内容,字面 \n 分隔会逐行渲染(段落间用 \n\n 空行分段) */
  content: string;
  /** Info 图标尺寸 (px),默认 11 配合 th 字号 */
  iconSize?: number;
  className?: string;
  /** 触发图标,默认 Info(ⓘ);传 HelpCircle 等换成圆圈问号 */
  icon?: LucideIcon;
  /** 展示形态:'popover'(默认,贴着图标的小气泡) / 'modal'(居中弹窗,内容多段时更从容) */
  variant?: 'popover' | 'modal';
}

export function InfoTooltip({ content, iconSize = 11, className, icon: Icon = Info, variant = 'popover' }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`info-tooltip ${className ?? ''}`}>
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="More info"
      >
        <Icon size={iconSize} />
      </button>
      {open && variant === 'modal' && (
        <div className="info-modal-overlay" onClick={() => setOpen(false)}>
          <div className="info-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="info-modal-close" onClick={() => setOpen(false)} aria-label={tr({ zh: '关闭', en: 'Close' })}>
              <X size={16} />
            </button>
            <div className="info-modal-body">
              {content.split('\n').map((line, i) => (
                <div key={i}>{line || ' '}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {open && variant === 'popover' && (
        <div className="info-tooltip-pop" role="tooltip">
          {content.split('\n').map((line, i) => (
            <div key={i}>{line || ' '}</div>
          ))}
        </div>
      )}
    </span>
  );
}
