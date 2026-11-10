'use client';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import AdminSectionNavigation from './AdminSectionNavigation';
import CareersManagement from './careers/CareersManagement';
import InterviewPreparation from './interview/InterviewPreparation';
export default function WorkResources({ initialTab = 'careers' }: { initialTab?: 'careers' | 'interview' }) {
  const [tab] = useQueryState('tab', parseAsStringEnum(['careers', 'interview']).withDefault(initialTab));
  return <main className="admin-hub admin-hub--dashboard"><AdminSectionNavigation group="work" active={tab} />
    <div className="admin-section-body" key={tab}>{tab === 'interview' ? <InterviewPreparation /> : <CareersManagement />}</div>
  </main>;
}
