import { ArrowRightLeft } from 'lucide-react';
import './recon-cross-toggle.css';

/** The same reversible cross-notation control in public and device reconstructions. */
export function ReconCrossToggle({ normalized, onToggle, label, tabIndex }: {
  normalized: boolean;
  onToggle(): void;
  label: string;
  tabIndex?: number;
}) {
  return <button type="button" className={`recon-cross-toggle${normalized ? ' active' : ''}`}
    aria-label={label} aria-pressed={normalized} title={label} tabIndex={tabIndex}
    onClick={event => { event.stopPropagation(); onToggle(); }}>
    <ArrowRightLeft size={12} />
  </button>;
}
