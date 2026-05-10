/**
 * Shared button with an optional thin determinate progress bar pinned to the
 * bottom edge — used by both Quick + TNoodle modes' "Generate" / "PDF" actions.
 */
import type React from 'react';

export interface ProgressButtonProps {
  icon: React.ReactNode;
  label: string;
  /** When non-null, a thin determinate bar fills the button bottom edge. */
  progress: { done: number; total: number } | null;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
}

export default function ProgressButton({
  icon, label, progress, onClick, disabled, title, primary,
}: ProgressButtonProps) {
  const pct = progress && progress.total > 0
    ? Math.max(0, Math.min(100, (progress.done / progress.total) * 100))
    : 0;
  const showBar = progress !== null;
  return (
    <button
      type="button"
      className={`gen-btn${primary ? ' gen-btn-primary' : ''} gen-btn-progress`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
      <span>{label}</span>
      {showBar && (
        <span className="gen-btn-bar" aria-hidden="true">
          <span className="gen-btn-bar-fill" style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}
