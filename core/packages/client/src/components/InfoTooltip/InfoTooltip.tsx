/**
 * 小 popover:Info 图标点击展开多行说明,点外面 / Esc 关.
 * native title= 只在 hover 出, 这个是 click-toggle 兼桌面 + 移动.
 */
import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import './info_tooltip.css';

interface Props {
  /** 多行内容,字面 \n 分隔会逐行渲染 */
  content: string;
  /** Info 图标尺寸 (px),默认 11 配合 th 字号 */
  iconSize?: number;
  className?: string;
}

export function InfoTooltip({ content, iconSize = 11, className }: Props) {
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
        <Info size={iconSize} />
      </button>
      {open && (
        <div className="info-tooltip-pop" role="tooltip">
          {content.split('\n').map((line, i) => (
            <div key={i}>{line || ' '}</div>
          ))}
        </div>
      )}
    </span>
  );
}
