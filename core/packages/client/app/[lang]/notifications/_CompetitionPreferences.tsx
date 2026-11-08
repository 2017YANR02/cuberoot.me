'use client';

import { COMPETITION_REMINDER_MINUTES, type CompetitionNotificationPreferences } from '@cuberoot/shared/competition-notifications';
import { RECORD_NOTIFICATION_EVENTS } from '@cuberoot/shared/record-notifications';
import BoolToggle from '@/components/BoolToggle';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { RegionPicker } from '@/components/RegionPicker';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { fetchCompetitionNotifySettings, saveCompetitionNotifySettings, type CompetitionNotifySettings } from '@/lib/notifications-api';
import { useNotificationPreferences } from './_useNotificationPreferences';

const EVENTS = new Set(RECORD_NOTIFICATION_EVENTS);
export default function CompetitionPreferences() {
  const t = useT();
  const isZh = useLang() === 'zh';
  const { settings, draft, error, saving, change, load } = useNotificationPreferences<CompetitionNotificationPreferences, CompetitionNotifySettings>(
    fetchCompetitionNotifySettings, saveCompetitionNotifySettings);
  const leadLabel = (minutes: number) => ({
    0: t('准点', 'At the scheduled time'), 10: t('提前 10 分钟', '10 minutes before'),
    60: t('提前 1 小时', '1 hour before'), 1440: t('提前 1 天', '1 day before'),
  })[minutes];
  return <section className="ntf-record-prefs">
    <h3 className="ntf-record-title">{t('比赛通知', 'Competition notifications')}</h3>
    {error && <p role="alert" className="ntf-error">{error}</p>}
    {!draft || !settings ? <button type="button" onClick={load} disabled={!error}>
      {error ? t('重试', 'Retry') : <LoadingIndicator>{t('加载中…', 'Loading…')}</LoadingIndicator>}
    </button> : <fieldset className="ntf-record-fields" disabled={saving} aria-label={t('比赛通知', 'Competition notifications')}>
      <BoolToggle label={t('WCA 新比赛公示', 'New WCA competition announcements')} value={draft.announcements}
        onChange={announcements => change({ announcements })} />
      {draft.announcements && <>
        <WcaEventMultiSelector availableEvents={EVENTS} selectedEvents={new Set(draft.events)}
          onChange={events => change({ events: [...events] })} isZh={isZh} />
        <label>{t('比赛举办地区', 'Competition region')}</label>
        <RegionPicker multi value={draft.regions} onChange={regions => change({ regions })}
          restrictTo={settings.countries} isZh={isZh} />
      </>}
      <p>{t('报名提醒仅用于已关注的比赛。', 'Registration reminders apply to competitions you follow.')}</p>
      {(['registrationOpenMinutes', 'registrationCloseMinutes'] as const).map(key => <label key={key}>
        {key === 'registrationOpenMinutes' ? t('报名开放', 'Registration opens') : t('报名截止', 'Registration closes')}
        {' '}<select value={draft[key] ?? 'off'} onChange={e => {
          const value = e.target.value;
          void change({ [key]: value === 'off' ? null : Number(value) });
        }}>
          <option value="off">{t('关闭', 'Off')}</option>
          {COMPETITION_REMINDER_MINUTES.map(minutes => <option key={minutes} value={minutes}>{leadLabel(minutes)}</option>)}
        </select>
      </label>)}
      <BoolToggle label={t('同时发送手机系统通知', 'Also send mobile push notifications')} value={draft.systemPush}
        onChange={systemPush => change({ systemPush })} />
      <p>{t('系统通知需要新版 App 已登录并允许通知。开启后不补发历史提醒。', 'Push notifications require a signed-in, updated app with notification permission. Past reminders are not sent when enabled.')}</p>
    </fieldset>}
  </section>;
}
