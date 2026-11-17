'use client';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/lib/auth-store';
import QualityStandards from './QualityStandards';
import WorkflowGuide from './WorkflowGuide';
import TeamAnnouncement from './TeamAnnouncement';
import './development-standards.css';

const sections = ['notice', 'quality', 'workflow', 'collaboration', 'delivery', 'office'] as const;
export default function StaffSopPage() {
  const t = useT();
  const admin = useIsAdmin();
  const [tab, setTab] = useQueryState('standard', parseAsStringEnum([...sections]).withDefault('notice').withOptions({ scroll: false }));
  const labels = [t('团队公告', 'Announcements'), t('质量标准', 'Quality standards'), t('工作流程', 'Workflow'), t('协作交接', 'Collaboration'), t('发布验收', 'Delivery'), t('工作约定', 'Team conventions')];
  const visible = sections.filter(key => admin || key !== 'notice');
  const active = !admin && tab === 'notice' ? 'quality' : tab;
  return <section className="development-standards">
    <h2>{t('开发规范', 'Development standards')}</h2>
    <div className="development-standards-tabs" role="tablist" aria-label={t('开发规范分类', 'Development standards sections')}>
      {visible.map((key, index) => <button className="development-standards-tab" key={key} id={`standard-${key}`} type="button" role="tab" aria-controls="standard-panel" aria-selected={active === key} tabIndex={active === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % visible.length : event.key === 'ArrowLeft' ? (index + visible.length - 1) % visible.length : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); void setTab(visible[next]); document.getElementById(`standard-${visible[next]}`)?.focus();
      }}>{labels[sections.indexOf(key)]}</button>)}
    </div>
    <div id="standard-panel" role="tabpanel" aria-labelledby={`standard-${active}`} tabIndex={0}>
      {active === 'notice' ? <TeamAnnouncement /> : active === 'quality' ? <QualityStandards /> : <WorkflowGuide area={active} />}
    </div>
  </section>;
}
