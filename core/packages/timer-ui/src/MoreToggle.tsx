'use client';

import { useState, type ComponentPropsWithRef } from 'react';
import { ChevronDown } from 'lucide-react';
import './more_toggle.css';

type MotionProps = { animate?: boolean };

export type ButtonProps = Omit<ComponentPropsWithRef<'button'>, 'onToggle'> & MotionProps & {
  as?: 'button';
  expanded: boolean;
  onToggle?: () => void;
};
export type SummaryProps = ComponentPropsWithRef<'summary'> & MotionProps & {
  as: 'summary';
};

/** Shared disclosure trigger. Summary keeps native details semantics and needs no state. */
export default function MoreToggle(props: ButtonProps | SummaryProps) {
  if (props.as === 'summary') {
    const { as: _as, children, className, animate = true, ...rest } = props;
    return <summary {...rest} data-animate={animate} className={`more-toggle-summary${className ? ` ${className}` : ''}`}>
      {children}<ChevronDown size={15} className="more-toggle-chevron" aria-hidden="true" />
    </summary>;
  }
  const { as: _as, expanded, onToggle, onClick, children, className, animate = true, ...rest } = props;
  return <button {...rest} data-animate={animate} type={props.type ?? 'button'}
    className={`more-toggle${expanded ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    onClick={onClick ?? onToggle} aria-expanded={expanded}>
    {children}
    <ChevronDown size={15} className="more-toggle-chevron" aria-hidden="true" />
  </button>;
}

export type PanelProps = ComponentPropsWithRef<'div'> & MotionProps & {
  expanded: boolean;
  /** Mount before the first expansion; visited content stays mounted for closing. */
  keepMounted?: boolean;
  contentClassName?: string;
};

/** Content companion for controlled buttons. Keep the panel itself mounted. */
export function MoreTogglePanel({ expanded, animate = true, keepMounted = false, children,
  className, contentClassName, onTransitionEnd, ...rest }: PanelProps) {
  const [visited, setVisited] = useState(expanded);
  const [motion, setMotion] = useState({ expanded, settled: expanded });
  if (expanded && !visited) setVisited(true);
  if (motion.expanded !== expanded) setMotion({ expanded, settled: false });
  return <div {...rest} className={`more-toggle-panel${className ? ` ${className}` : ''}`}
    data-open={expanded} data-animate={animate} data-settled={motion.settled}
    inert={!expanded} aria-hidden={!expanded} onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
        setMotion({ expanded, settled: expanded });
      }
      onTransitionEnd?.(event);
    }}>
    <div className={`more-toggle-panel-content${contentClassName ? ` ${contentClassName}` : ''}`}>
      {(keepMounted || visited || expanded) && children}
    </div>
  </div>;
}
