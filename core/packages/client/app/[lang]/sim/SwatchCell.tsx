import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pipette } from 'lucide-react';

/** 模拟器共用色块下拉:trigger 显当前色,面板列出色块选项。 */
export function SwatchPopup({
  trigger, title, children,
}: {
  trigger: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);
  return (
    <div className="sim-color-select" ref={ref}>
      <button
        type="button"
        className="sim-color-select-trigger"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && <div className="sim-color-select-panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export default function SwatchCell({
  color, label, title, active, onPick, onClick, custom,
}: {
  color: string;
  label?: string;
  title?: string;
  active?: boolean;
  onPick?: (c: string) => void;
  onClick?: () => void;
  /** 自定义取色格:角标 Pipette + 区别于预设色块,明示「点这里自选」。 */
  custom?: boolean;
}) {
  const labelEl = label ? <span className="sim-swatch-label">{label}</span> : null;
  const boxEl = custom ? (
    <span className="sim-swatch-box-wrap">
      <span className="sim-swatch-box" style={{ background: color }} />
      <span className="sim-swatch-custom-badge" aria-hidden><Pipette size={9} /></span>
    </span>
  ) : (
    <span className="sim-swatch-box" style={{ background: color }} />
  );
  const cls = 'sim-swatch' + (active ? ' active' : '');
  if (onPick) {
    return (
      <label className={cls} title={title}>
        {labelEl}
        <input
          type="color"
          className="sim-swatch-input"
          value={color}
          onChange={(e) => onPick(e.target.value)}
          aria-label={title}
        />
        {boxEl}
      </label>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} title={title} aria-label={title}>
      {labelEl}
      {boxEl}
    </button>
  );
}
