'use client';

import { tr } from '@/i18n/tr';
import type { CaseSetupMode } from '@/lib/alg_case_alignment';

export default function AlgSetupModeSelect({ value, onChange }: {
  value: CaseSetupMode;
  onChange: (mode: CaseSetupMode) => void;
}) {
  return <label className="alg-view-angle">
    <span>{tr({ zh: '打乱方式', en: 'Scramble source' })}</span>
    <select className="alg-header-select" value={value}
      onChange={event => onChange(event.target.value as CaseSetupMode)}>
      <option value="inverse">{tr({ zh: '首条公式取逆', en: 'Inverse of first algorithm' })}</option>
      <option value="preset">{tr({ zh: '预设打乱', en: 'Preset' })}</option>
    </select>
  </label>;
}
