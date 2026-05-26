'use client';

// Ported from packages/client/src/components/PillToggle/PillToggle.tsx.
import './PillToggle.css';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
  ariaLabel?: string;
}

export default function PillToggle({ value, onChange, onLabel, offLabel, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      className={`pill-toggle${value ? ' is-on' : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className="pill-toggle-label">{value ? onLabel : offLabel}</span>
      <span className="pill-toggle-dot" />
    </button>
  );
}
