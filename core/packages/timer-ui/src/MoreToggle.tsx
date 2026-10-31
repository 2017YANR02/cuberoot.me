'use client';

import type { ComponentPropsWithRef } from 'react';
import { ChevronDown } from 'lucide-react';
import './more_toggle.css';

export type ButtonProps = Omit<ComponentPropsWithRef<'button'>, 'onToggle'> & {
  as?: 'button';
  expanded: boolean;
  onToggle?: () => void;
};
export type SummaryProps = ComponentPropsWithRef<'summary'> & {
  as: 'summary';
};

/** Shared disclosure trigger. Summary keeps native details semantics and needs no state. */
export default function MoreToggle(props: ButtonProps | SummaryProps) {
  if (props.as === 'summary') {
    const { as: _as, children, className, ...rest } = props;
    return <summary {...rest} className={`more-toggle-summary${className ? ` ${className}` : ''}`}>
      {children}<ChevronDown size={15} className="more-toggle-chevron" aria-hidden="true" />
    </summary>;
  }
  const { as: _as, expanded, onToggle, onClick, children, className, ...rest } = props;
  return <button {...rest} type={props.type ?? 'button'}
    className={`more-toggle${expanded ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    onClick={onClick ?? onToggle} aria-expanded={expanded}>
    {children}
    <ChevronDown size={15} className="more-toggle-chevron" aria-hidden="true" />
  </button>;
}
