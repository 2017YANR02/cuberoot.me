'use client';
import type { useWcaInstitutions } from '@/hooks/useWcaInstitutions';
import { tr } from '@/i18n/tr';

export function WcaInstitutionSelect({ directory, value, onChange, disabled }: {
  directory: ReturnType<typeof useWcaInstitutions>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return <label className="wca-teacher-mode-picker">
    <span>{tr({ zh: '培训机构', en: 'Training institution' })}</span>
    <select className="native-select" aria-label={tr({ zh: '培训机构', en: 'Training institution' })}
      value={value} onChange={event => onChange(event.currentTarget.value)} disabled={disabled || !directory.ready}>
      <option value="">{tr({ zh: '未设置', en: 'Not set' })}</option>
      {directory.institutions.map(institution => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
    </select>
    {directory.failed && <button type="button" disabled={disabled} onClick={directory.retry}>{tr({ zh: '重新加载机构', en: 'Reload institutions' })}</button>}
  </label>;
}
