import { useMemo, useState, type ReactNode } from 'react';
import { TIMER_WCA_COMPETITION_PERIODS, timerWcaCompetitionPeriodStart, type TimerWcaCompetitionPeriod } from '@cuberoot/shared/timer/wca-source-config';
import { CountryInput, type CountryInputProps } from './CountryInput';
import type { TimerWcaSourceConfigProps } from './TimerWcaSourceConfig';
import './wca-competition-filters.css';

export function useTimerWcaCompetitionFilters({ today, language, disabled, renderCountry }: {
  today: string;
  language: 'en' | 'zh';
  disabled?: boolean;
  renderCountry?(props: CountryInputProps): ReactNode;
}): NonNullable<TimerWcaSourceConfigProps['competitionFilters']> {
  const [period, setPeriod] = useState<TimerWcaCompetitionPeriod>('all');
  const [country, setCountry] = useState('');
  const from = useMemo(() => timerWcaCompetitionPeriodStart(today, period), [period, today]);
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
        value={period} onChange={event => setPeriod(event.target.value as TimerWcaCompetitionPeriod)}>
        {TIMER_WCA_COMPETITION_PERIODS.map(option => <option key={option.id} value={option.id}>{tr(option.label)}</option>)}
      </select>
      {renderCountry ? renderCountry(props) : <CountryInput {...props} host={{ language }} />}
    </fieldset>;
  } };
}
