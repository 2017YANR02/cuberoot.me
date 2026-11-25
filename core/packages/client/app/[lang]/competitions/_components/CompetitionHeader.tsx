import HeaderToggles from '@/components/HeaderToggles';
import PageBackLink from '@/components/PageBackLink';
import PageHeading from '@/components/PageHeading';
import type { ReactNode } from 'react';

export function CompetitionHeader({ title, actions, fallback = '/' }: { title?: string; actions?: ReactNode; fallback?: string }) {
  return <header className="competition-center-navigation">
    {title ? <PageHeading backHref={fallback}>{title}</PageHeading> : <PageBackLink className="competition-center-back" fallback={fallback} />}
    <div className="competition-center-actions">{actions}<HeaderToggles /></div>
  </header>;
}
