import { Check, X } from 'lucide-react';
import './filled-status-mark.css';

const icons = { success: Check, error: X, unknown: null };

/** Decorative mark for a status whose accessible label is supplied by its caller. */
export function FilledStatusMark({ variant }: { variant: keyof typeof icons }) {
  const Icon = icons[variant];
  return <span className="filled-status-mark" data-variant={variant} aria-hidden="true">
    {Icon ? <Icon /> : '?'}
  </span>;
}
