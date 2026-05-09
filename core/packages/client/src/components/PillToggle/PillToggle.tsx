/**
 * iOS 风胶囊 toggle:左右两端文字 + 滑块.
 * 关 → 灰色背景显示 offLabel;开 → 蓝色背景显示 onLabel.
 */
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
