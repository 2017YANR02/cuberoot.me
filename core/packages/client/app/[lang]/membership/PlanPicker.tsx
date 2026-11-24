'use client';
import { useId } from 'react';
import { tr } from '@/i18n/tr';

export interface PeriodOption<T extends string> {
  id: T;
  price: string;
  caption: string;
  shortCaption?: string;
  savings?: number | null;
}

export default function PlanPicker<T extends string>({ options, selected, onSelect, busy, disabled, onSubmit, submitLabel, desktopPricing }: {
  options: PeriodOption<T>[];
  selected: T | undefined;
  onSelect: (id: T) => void;
  busy?: boolean;
  disabled?: boolean;
  desktopPricing?: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const name = useId();
  const current = options.find(option => option.id === selected);
  return <div className={desktopPricing ? 'mem-picker mem-tier-picker' : 'mem-picker'}>
    <fieldset className="mem-store-periods" data-pair={options.length === 2 || undefined} disabled={busy}>
      <legend className="sr-only">{tr({ zh: '计费周期', en: 'Billing period' })}</legend>
      {options.map(option => <label key={option.id} className="mem-store-period" data-selected={option.id === selected}>
        <span className="mem-store-period-heading">
          <input className="mem-store-period-radio" type="radio" name={name} checked={option.id === selected} onChange={() => onSelect(option.id)} />
          {!!option.savings && <small className="mem-store-saving">{tr({ zh: '怒省 {percent}%', en: 'Save ~{percent}%' }).replace('{percent}', String(option.savings))}</small>}
        </span>
        <strong className="mem-plan-amount">{option.price}</strong>
        <span className="mem-period-caption">{option.caption}</span>
        {desktopPricing && <span className="mem-short-period">{option.shortCaption}</span>}
      </label>)}
    </fieldset>
    {desktopPricing && current && <div key={current.id + current.price} className="mem-tier-price"><strong>{current.price}</strong><span>{current.caption}</span></div>}
    <button type="button" className="mem-plan-cta" disabled={busy || disabled || !selected} onClick={onSubmit}>{submitLabel}</button>
  </div>;
}
