import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useId, type ReactNode } from 'react';
import { type LucideIcon } from '@app-foundation/icons/lucide';

/** Keep visited panels mounted so both sides of the accordion can animate. */
export default function CollapsibleSection({ open, onToggle, icon: Icon, label, children, className = '', keepMounted = false }: {
  open: boolean;
  onToggle?: () => void;
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  className?: string;
  keepMounted?: boolean;
}) {
  const bodyId = useId();
  return (
    <section className={`sim-puzzle ${className}`}>
      <MoreToggle type="button" className="sim-puzzle-head" onClick={onToggle} expanded={open} aria-controls={bodyId} title={label}>

        <Icon size={14} /><span className="sim-puzzle-title">{label}</span>
      </MoreToggle>
      <MoreTogglePanel id={bodyId} expanded={open} keepMounted={keepMounted}
        className="sim-section-body" contentClassName="sim-section-content">{children}</MoreTogglePanel>
    </section>
  );
}
