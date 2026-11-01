import MoreToggle from '@/components/MoreToggle';
import { useId, useState, type ReactNode } from 'react';
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
  const [visited, setVisited] = useState(open);
  const [motion, setMotion] = useState({ open, settled: open });
  if (open && !visited) setVisited(true);
  if (motion.open !== open) setMotion({ open, settled: false });
  return (
    <section className={`sim-puzzle ${className}`}>
      <MoreToggle type="button" className="sim-puzzle-head" onClick={onToggle} expanded={open} aria-controls={bodyId} title={label}>

        <Icon size={14} /><span className="sim-puzzle-title">{label}</span>
      </MoreToggle>
      <div id={bodyId} className="sim-section-body" data-open={open} data-settled={motion.settled} onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') setMotion({ open, settled: open });
      }} inert={!open} aria-hidden={!open}>
        <div className="sim-section-content">{(keepMounted || visited || open) && children}</div>
      </div>
    </section>
  );
}
