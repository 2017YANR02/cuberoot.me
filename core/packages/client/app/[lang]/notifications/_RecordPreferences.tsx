'use client';

import { useEffect, useRef, useState } from 'react';
import { RECORD_NOTIFICATION_EVENTS, type RecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { RegionPicker } from '@/components/RegionPicker';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { fetchRecordNotifySettings, saveRecordNotifySettings, type RecordNotifySettings } from '@/lib/notifications-api';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const EVENTS = new Set(RECORD_NOTIFICATION_EVENTS);

export default function RecordPreferences() {
  const t = useT();
  const isZh = useLang() === 'zh';
  const [settings, setSettings] = useState<RecordNotifySettings | null>(null);
  const [draft, setDraft] = useState<RecordNotificationPreferences | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function load() {
    setError('');
    try {
      const result = await fetchRecordNotifySettings();
      setSettings(result);
      setDraft(result.preferences);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { void load(); }, []);

  async function change(value: Partial<RecordNotificationPreferences>) {
    if (!draft || savingRef.current) return;
    const previous = draft;
    const next = { ...previous, ...value };
    savingRef.current = true;
    setDraft(next);
    setSaving(true);
    setError('');
    try { await saveRecordNotifySettings(next); }
    catch (e) {
      setDraft(previous);
      setError(e instanceof Error ? e.message : String(e));
    }
    finally { savingRef.current = false; setSaving(false); }
  }

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
