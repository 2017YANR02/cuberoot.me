'use client';

/**
 * Shared row layout for scramble engine/mode toggles (3x3 engine, 5x5 mode, …).
 * Per-event pickers (Scramble333ModePicker / Scramble555ModePicker) wrap this with
 * their own hook + labels.
 */
import Link from '@/components/AppLink';
import { HelpCircle } from 'lucide-react';
import PillToggle from './PillToggle/PillToggle';

interface Props {
  label: string;
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
  label, value, onChange, onLabel, offLabel, ariaLabel,
  helpHref, helpTitle, helpAriaLabel,
}: Props) {
  return (
    <div className="gen-555-mode-row">
      <span className="gen-555-mode-label">{label}</span>
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
          className="gen-555-mode-info"
          title={helpTitle}
          aria-label={helpAriaLabel}
        >
          <HelpCircle size={16} />
        </Link>
      )}
    </div>
  );
}
