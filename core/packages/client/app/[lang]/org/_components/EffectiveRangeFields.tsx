'use client';

import { useMemo } from 'react';
import { useT } from '@/hooks/useT';

function localDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function readEffectiveRange(data: FormData): { effectiveFrom: string; effectiveTo: string | null } | null {
  const fromValue = String(data.get('effectiveFrom') ?? '').trim();
  const toValue = String(data.get('effectiveTo') ?? '').trim();
  const effectiveFrom = new Date(fromValue);
  const effectiveTo = toValue ? new Date(toValue) : null;
  if (!fromValue || Number.isNaN(effectiveFrom.getTime())) return null;
  if (effectiveTo && (Number.isNaN(effectiveTo.getTime()) || effectiveTo <= effectiveFrom)) return null;
  return {
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo?.toISOString() ?? null,
  };
}

export default function EffectiveRangeFields() {
  const t = useT();
  const defaultFrom = useMemo(() => localDateTimeValue(new Date()), []);
  return (
    <>
      <label>{t('开始时间', 'Effective from')}<input className="org-form-control" name="effectiveFrom" type="datetime-local" defaultValue={defaultFrom} required /></label>
      <label>{t('结束时间（可选）', 'Effective until (optional)')}<input className="org-form-control" name="effectiveTo" type="datetime-local" /></label>
      <p className="org-help org-field-wide">{t('时间范围左闭右开；结束时间必须晚于开始时间。', 'The range includes the start and excludes the end. The end must be later than the start.')}</p>
    </>
  );
}
