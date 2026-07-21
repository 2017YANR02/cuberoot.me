'use client';

/**
 * Shared row layout for scramble engine/mode toggles (3x3 engine, 5x5 mode, …).
 * Per-event pickers (Scramble333ModePicker / Scramble555ModePicker) wrap this with
 * their own hook + labels.
 */
import Link from '@/components/AppLink';
import { HelpCircle } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import PillToggle from './PillToggle/PillToggle';
import './scramble-mode-picker-row.css';

interface Props {
  /** 项目图标(WCA event id,如 '222' / '555')替代文字里的「2x2 / 5x5」前缀;省略则只有文字。 */
  iconEvent?: string;
  /** 空/省略 → 不渲染标签(如计时器上,项目图标已在上方,无需重复「2x2」)。 */
  label?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
  ariaLabel: string;
  helpHref?: string;
  helpTitle?: string;
  helpAriaLabel?: string;
}

export default function ScrambleModePickerRow({
  iconEvent, label, value, onChange, onLabel, offLabel, ariaLabel,
  helpHref, helpTitle, helpAriaLabel,
}: Props) {
  return (
    <div className="scramble-mode-row">
      {(iconEvent || label) && (
        <span className="scramble-mode-label">
          {iconEvent && <EventIcon event={iconEvent} className="scramble-mode-icon" />}
          {label}
        </span>
      )}
      <PillToggle
        value={value}
        onChange={onChange}
        onLabel={onLabel}
        offLabel={offLabel}
        ariaLabel={ariaLabel}
      />
      {helpHref && (
        <Link
          href={helpHref}
          className="scramble-mode-info"
          title={helpTitle}
          aria-label={helpAriaLabel}
        >
          <HelpCircle size={16} />
        </Link>
      )}
    </div>
  );
}
