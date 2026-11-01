import type { ComponentProps } from 'react';
import './wca-stats-table.css';

/** Borderless table region; reuse the site's sticky header / overflow guard. */
export function WcaStatsTableSection({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`wse-table-wrapper sticky-scroll wca-stats-table-section ${className}`.trim()} />;
}

/** Native table slots keep each statistic's columns, formatting and sorting intact. */
export function WcaStatsTable({ className = '', ...props }: ComponentProps<'table'>) {
  return <table {...props} className={`wse-table sticky-thead wca-stats-data-table ${className}`.trim()} />;
}
