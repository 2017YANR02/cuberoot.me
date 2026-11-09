'use client';

import { RECORD_NOTIFICATION_EVENTS, type RecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { RegionPicker } from '@/components/RegionPicker';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { fetchRecordNotifySettings, saveRecordNotifySettings, type RecordNotifySettings } from '@/lib/notifications-api';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useNotificationPreferences } from './_useNotificationPreferences';

const EVENTS = new Set(RECORD_NOTIFICATION_EVENTS);

export default function RecordPreferences() {
  const t = useT();
  const isZh = useLang() === 'zh';
  const { settings, draft, error, saving, change, load } = useNotificationPreferences<RecordNotificationPreferences, RecordNotifySettings>(
    fetchRecordNotifySettings, saveRecordNotifySettings);

  return <section className="ntf-record-prefs">
    <h3 className="ntf-record-title">{t('纪录订阅', 'Record subscriptions')}</h3>
    {error && <p role="alert" className="ntf-error">{error}</p>}
    {!draft || !settings ? <button type="button" onClick={load} disabled={!error}>
      {error ? t('重试', 'Retry') : <LoadingIndicator>{t('加载中…', 'Loading…')}</LoadingIndicator>}
    </button> : <>
      {!settings.ownWcaId && <p><AppLink href="/account">{t('绑定 WCA 账号，自动接收本人纪录。', 'Link your WCA account to receive your own records automatically.')}</AppLink></p>}
      {!settings.emailReady && <p><AppLink href="/account">{t('绑定并验证邮箱后可接收邮件通知。', 'Link and verify an email address to receive email notifications.')}</AppLink></p>}
      <fieldset className="ntf-record-fields" disabled={saving} aria-label={t('纪录订阅', 'Record subscriptions')}>
        <div className="ntf-record-options">
          {(['WR', 'CR', 'NR', 'FWR'] as const).map(level => <BoolToggle key={level} label={level}
            value={draft.levels.includes(level)} onChange={enabled => change({
              levels: enabled ? [...draft.levels, level] : draft.levels.filter(item => item !== level),
            })} />)}
        </div>
        {draft.levels.length > 0 && <>
          <div className="ntf-record-options">
            {(['single', 'average'] as const).map(type => <BoolToggle key={type}
              label={type === 'single' ? t('单次', 'Single') : t('平均', 'Average')}
              value={draft.types.includes(type)} onChange={enabled => change({
                types: enabled ? [...draft.types, type] : draft.types.filter(item => item !== type),
              })} />)}
          </div>
          <WcaEventMultiSelector availableEvents={EVENTS} selectedEvents={new Set(draft.events)}
            onChange={events => change({ events: [...events] })} isZh={isZh} />
          <label>{t('选手所属地区', 'Competitor region')}</label>
          <RegionPicker multi value={draft.regions} onChange={regions => change({ regions })}
            restrictTo={settings.countries} isZh={isZh} />
        </>}
      </fieldset>
    </>}
  </section>;
}
