import { useMemo, useState, type ReactNode } from 'react';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { CountryInput, type CountryInputProps } from './CountryInput';
import type { TimerWcaSourceConfigProps } from './TimerWcaSourceConfig';
import './wca-competition-filters.css';

export function useTimerWcaCompetitionFilters({ today, language, disabled, renderCountry }: {
  today: string;
  language: 'en' | 'zh';
  disabled?: boolean;
  renderCountry?(props: CountryInputProps): ReactNode;
}): NonNullable<TimerWcaSourceConfigProps['competitionFilters']> {
  const [period, setPeriod] = useState('all');
  const [country, setCountry] = useState('');
  const from = useMemo(() => {
    if (!today || period === 'all') return '';
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - Number(period) + 1);
    return toLocalIsoDate(date);
  }, [period, today]);
  const tr = (text: { en: string; zh: string }) => text[language];
  return { from, country, render: countries => {
    const props: CountryInputProps = {
      ariaLabel: tr({ zh: '国家', en: 'Country' }),
      placeholder: tr({ zh: '全部国家', en: 'All countries' }),
      allLabel: tr({ zh: '全部国家', en: 'All countries' }),
      restrictTo: country ? [...new Set([...countries, country])] : countries,
      value: country, onChange: iso2 => setCountry(iso2.toUpperCase()),
    };
    return <fieldset className="wca-src-filters" disabled={disabled} aria-label={tr({ zh: '筛选比赛', en: 'Filter competitions' })}>
      <select className="timer-wca-source-select" aria-label={tr({ zh: '时间范围', en: 'Time range' })}
        value={period} onChange={event => setPeriod(event.target.value)}>
        <option value="all">{tr({ zh: '全部时间', en: 'All time' })}</option>
        <option value="7">{tr({ zh: '近一周', en: 'Past week' })}</option>
        <option value="30">{tr({ zh: '近一个月', en: 'Past month' })}</option>
        <option value="365">{tr({ zh: '近一年', en: 'Past year' })}</option>
      </select>
      {renderCountry ? renderCountry(props) : <CountryInput {...props} host={{ language }} />}
    </fieldset>;
  } };
}
