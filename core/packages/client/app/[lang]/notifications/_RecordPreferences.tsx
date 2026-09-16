'use client';

import { useEffect, useState } from 'react';
import { RECORD_NOTIFICATION_EVENTS, type RecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { RegionPicker } from '@/components/RegionPicker';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { fetchRecordNotifySettings, saveRecordNotifySettings, type RecordNotifySettings } from '@/lib/notifications-api';

const EVENTS = new Set(RECORD_NOTIFICATION_EVENTS);

export default function RecordPreferences() {
  const t = useT();
  const isZh = useLang() === 'zh';
  const [settings, setSettings] = useState<RecordNotifySettings | null>(null);
  const [draft, setDraft] = useState<RecordNotificationPreferences | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    setError('');
    try {
      const result = await fetchRecordNotifySettings();
      setSettings(result);
      setDraft(result.preferences);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { void load(); }, []);

  function change(value: Partial<RecordNotificationPreferences>) {
    setDraft(previous => previous && { ...previous, ...value });
    setSaved(false);
  }
  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try { await saveRecordNotifySettings(draft); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <details className="ntf-record-prefs">
    <summary>{t('纪录订阅', 'Record subscriptions')}</summary>
    {error && <p role="alert" className="ntf-error">{error}</p>}
    {!draft || !settings ? <button type="button" onClick={load} disabled={!error}>
      {error ? t('重试', 'Retry') : t('加载中…', 'Loading…')}
    </button> : <>
      <p>{settings.ownWcaId
        ? t(`本人纪录自动通知（${settings.ownWcaId}），包括个人纪录，不受下方筛选影响。`,
          `Your own records (${settings.ownWcaId}), including personal records, are always included regardless of these filters.`)
        : <AppLink href="/account">{t('绑定 WCA 账号，自动接收本人纪录。', 'Link your WCA account to receive your own records automatically.')}</AppLink>}
      </p>
      {!settings.emailReady && <p><AppLink href="/account">{t('绑定并验证邮箱后可接收邮件通知。', 'Link and verify an email address to receive email notifications.')}</AppLink></p>}
      <fieldset className="ntf-record-fields" disabled={saving}>
        <legend>{t('订阅其他选手的纪录', 'Subscribe to other competitors’ records')}</legend>
        <div className="ntf-record-options">
          {([
            ['WR', t('世界纪录', 'World records')], ['CR', t('洲际纪录', 'Continental records')],
            ['NR', t('国家纪录', 'National records')], ['FWR', t('女子世界纪录', 'Female world records')],
          ] as const).map(([level, label]) => <BoolToggle key={level} label={`${label} ${level}`}
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
        <div className="ntf-record-options">
          <button type="button" className="ntf-login-btn" onClick={save}>
            {saving ? t('保存中…', 'Saving…') : t('保存订阅', 'Save subscriptions')}
          </button>
          {saved && <span role="status">{t('已保存', 'Saved')}</span>}
        </div>
      </fieldset>
    </>}
  </details>;
}
