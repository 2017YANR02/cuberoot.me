'use client';
import type { ReactNode } from 'react';
import { TIMER_RANK_SCOPES, timerSettingFieldContract, type TimerRankScope } from '@cuberoot/shared/timer';
import { CountryInput } from './CountryInput';
import './timer-rank.css';
export function TimerRankSettings({ language, scopes, country, accountCountry, onScopes, onCountry, renderCountry, login }: {
  language: 'en' | 'zh'; scopes: readonly TimerRankScope[]; country: string; accountCountry: string;
  onScopes(value: TimerRankScope[]): void; onCountry(value: string): void;
  renderCountry?(): ReactNode; login?: () => void;
}) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  return <>
    <div className="settings-row" data-setting-id="settings.appearance.rank-scopes"><span className="settings-row-label">{tr(timerSettingFieldContract('settings.appearance.rank-scopes').copy)}</span><span className="settings-row-control"><span className="rank-scope-options">{TIMER_RANK_SCOPES.map(scope => <button key={scope} type="button" className="hint-btn rank-scope-option" aria-pressed={scopes.includes(scope)} onClick={() => onScopes(scopes.includes(scope) ? scopes.filter(value => value !== scope) : [...scopes, scope])}>{scope}</button>)}</span></span></div>
    {!accountCountry && (scopes.includes('NR') || scopes.includes('CR')) && <div className="settings-row" data-setting-id="settings.appearance.ranking-region"><span className="settings-row-label">{tr(timerSettingFieldContract('settings.appearance.ranking-region').copy)}</span><span className="settings-row-control">{renderCountry ? renderCountry() : <CountryInput value={country.toLowerCase()} onChange={value => onCountry(value.toUpperCase())} placeholder="" host={{ language }} />}{login && <button type="button" className="hint-btn" onClick={login} title={tr({ en: 'Sign in with WCA to auto-fill your country', zh: '登录 WCA 自动带入账号国家' })}>{tr({ en: 'Sign in', zh: '登录' })}</button>}</span></div>}
  </>;
}

export const TIMER_RANK_SETTING_FIELD_IDS = [
  "settings.appearance.rank-scopes",
  "settings.appearance.ranking-region"
] as const;
