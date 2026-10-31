'use client';

import type { ReactNode } from 'react';
import PageBackLink from './PageBackLink';
import './page-heading.css';

/** Shared heading for the home directory's content pages. Keep tools beside it. */
export default function PageHeading({ children, titleClassName = '', backHref = '/' }: {
  children: ReactNode;
  backHref?: string;
  titleClassName?: string;
}) {
  return <div className="page-heading">
    <PageBackLink fallback={backHref} />
    <h1 className={`page-heading-title ${titleClassName}`.trim()}>{children}</h1>
  </div>;
}
