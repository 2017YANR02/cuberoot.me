'use client';

import { Suspense } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import Onboarding from './Onboarding';
import Offboarding from './Offboarding';
import Sop from './Sop';
import './get-started.css';

const sections = ['onboarding', 'offboarding', 'sop'] as const;
type Section = typeof sections[number];

function TeamHandbook() {
  const t = useT();
  const [section, setSection] = useQueryState('section', parseAsStringEnum<Section>([...sections]).withDefault('onboarding').withOptions({ history: 'push' }));
  return <main className="staff-start">
    <header className="staff-start-header">
      <h1>{t('团队手册', 'Team handbook')}</h1>
      <label className="staff-start-account-link">
        <select aria-label={t('手册栏目', 'Handbook section')} className="staff-start-preview-control" value={section} onChange={event => void setSection(event.target.value as Section)}>
          <option value="onboarding">{t('入职', 'Onboarding')}</option>
          <option value="offboarding">{t('离职', 'Offboarding')}</option>
          <option value="sop">{t('SOP', 'SOP')}</option>
        </select>
      </label>
      {' '}
      <AppLink className="staff-start-account-link" href="/workspace" target="_blank" rel="noopener noreferrer" prefetch={false}>{t('工作台', 'Workspace')} ↗</AppLink>
    </header>
    {section === 'offboarding' ? <Offboarding /> : section === 'sop' ? <Sop /> : <Onboarding />}
  </main>;
}

export default function TeamPage() {
  return <Suspense><TeamHandbook /></Suspense>;
}
