'use client';

import type { ReactNode } from 'react';
import PageBackLink from '@/components/PageBackLink';
import { Tooltip } from '@/components/Tooltip';
import { tr } from '@/i18n/tr';
import './course-header.css';

export default function CourseHeader({ title, catalogHref, action }: {
  title: ReactNode;
  catalogHref?: string;
  action?: ReactNode;
}) {
  const label = tr({ zh: '返回教程选择', en: 'Back to tutorial selection' });
  return <header className="course-header" data-course-header>
    {catalogHref && <Tooltip content={label}>{trigger =>
      <PageBackLink {...trigger} className="course-back-link" fallback={catalogHref} label={label}
        acceptEntry={entry => entry.replace(/^\/(?:en|zh)(?=\/)/, '') === catalogHref} />
    }</Tooltip>}
    <h1>{title}</h1>
    {action && <div className="course-header-action">{action}</div>}
  </header>;
}
