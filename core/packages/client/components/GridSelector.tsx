'use client';

import type { CSSProperties, ReactNode } from 'react';
import './grid-selector.css';

/** Connected cells shared by slot selectors and linked subset grids. */
export default function GridSelector<T>({ items, columns, ariaLabel, className = '', onActivate, renderItem }: {
  items: readonly T[];
  columns: number;
  ariaLabel: string;
  className?: string;
  onActivate?: () => void;
  renderItem: (item: T, className: string) => ReactNode;
}) {
  const Root = onActivate ? 'button' : 'div';
  return <Root type={onActivate ? 'button' : undefined} onClick={onActivate}
    className={`grid-selector ${className}`} role={onActivate ? undefined : 'group'} aria-label={ariaLabel}
    style={{ '--grid-columns': columns } as CSSProperties}>
    {items.map((item, index) => renderItem(item, [
      'grid-selector-cell',
      index === 0 && 'is-top-left',
      index === columns - 1 && 'is-top-right',
      index === items.length - columns && 'is-bottom-left',
      index === items.length - 1 && 'is-bottom-right',
    ].filter(Boolean).join(' ')))}
  </Root>;
}
