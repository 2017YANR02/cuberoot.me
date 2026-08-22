'use client';

import { useEffect, useState } from 'react';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import {
  executePlatformAction,
  loadPlatformPrivacyConsents,
  PLATFORM_PRIVACY_POLICY_VERSION,
  PlatformPermissionError,
} from '@/lib/platform-gateway';
import type {
  PlatformPrivacyConsent,
  PlatformPrivacyConsentWrite,
  PlatformRouteDefinition,
} from '@/lib/platform-types';
import { PlatformState } from './PlatformState';

function isActive(consent: PlatformPrivacyConsent | undefined): boolean {
  if (consent?.status !== 'granted') return false;
  return !consent.expiresAt || Date.parse(consent.expiresAt) > Date.now();
}

export function PlatformPrivacySettings({ definition }: { definition: PlatformRouteDefinition }) {
  const t = useT();
  const [consents, setConsents] = useState<PlatformPrivacyConsent[] | null>(null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setConsents(null);
    setError(null);
    void loadPlatformPrivacyConsents(controller.signal)
      .then((items) => {
        setConsents(items);
        setAnalyticsEnabled(isActive(items.find((item) => item.purpose === 'analytics')));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [retry]);

  if (error instanceof PlatformPermissionError) {
    return <PlatformState kind="permission" message={error.status === 403 ? t('当前账号没有管理此设置的权限。', 'Your account cannot manage this setting.') : undefined} />;
  }
  if (error) return <PlatformState kind="error" message={error.message} onRetry={() => setRetry((value) => value + 1)} />;
  if (!consents) return <PlatformState kind="loading" />;

  const analyticsConsent = consents.find((item) => item.purpose === 'analytics');
  const currentlyEnabled = isActive(analyticsConsent);
  const changed = analyticsEnabled !== currentlyEnabled;
  const status = analyticsConsent?.status === 'granted' && !currentlyEnabled
    ? t('授权已过期', 'Consent expired')
    : analyticsConsent?.status === 'granted'
      ? t('已授权', 'Granted')
      : analyticsConsent?.status === 'withdrawn'
        ? t('已撤回', 'Withdrawn')
        : analyticsConsent?.status === 'denied'
          ? t('未授权', 'Denied')
          : t('尚未选择，默认关闭', 'No choice yet; off by default');

  const save = async () => {
    if (!changed) return;
    setBusy(true);
    setMessage(null);
    const payload = {
      purpose: 'analytics',
      status: analyticsEnabled ? 'granted' : 'withdrawn',
      policyVersion: PLATFORM_PRIVACY_POLICY_VERSION,
      source: 'account',
    } satisfies PlatformPrivacyConsentWrite;
    try {
      await executePlatformAction(definition, { action: 'save-privacy-consent', payload });
      setMessage(analyticsEnabled
        ? t('已保存分析授权。授权本身不会自动发送事件。', 'Analytics consent saved. Granting consent does not itself send an event.')
        : t('已撤回分析授权。后续分析事件将被服务端拒绝。', 'Analytics consent withdrawn. Future analytics events will be rejected by the server.'));
      setRetry((value) => value + 1);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t('隐私设置保存失败。', 'Privacy setting could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="platform-domain-form platform-domain-content" aria-labelledby="platform-analytics-consent-title">
      <h2 id="platform-analytics-consent-title">{t('可选的产品分析', 'Optional product analytics')}</h2>
      <p className="platform-domain-note">
        {t(
          'Platform 分析接口只接受事件名、页面范围和少量白名单维度，原始事件保留 30 天。打开本页、切换开关或完成授权都不会自动发送分析事件。',
          'The Platform analytics API accepts only an event name, surface, and a small allowlist of dimensions; raw events are retained for 30 days. Opening this page, changing the switch, or granting consent does not automatically send an analytics event.',
        )}
      </p>
      <BoolToggle
        value={analyticsEnabled}
        onChange={(value) => { setAnalyticsEnabled(value); setMessage(null); }}
        disabled={busy}
        label={t('允许记录可选的 Platform 产品使用事件', 'Allow optional Platform product-usage events')}
      />
      <dl>
        <div><dt>{t('当前状态', 'Current status')}</dt><dd>{status}</dd></div>
        {analyticsConsent?.decidedAt ? (
          <div>
            <dt>{t('最近决定', 'Latest decision')}</dt>
            <dd>{new Date(analyticsConsent.decidedAt).toLocaleString(t('zh-CN', 'en'))}</dd>
          </div>
        ) : null}
        {analyticsConsent?.policyVersion ? <div><dt>{t('授权版本', 'Consent version')}</dt><dd>{analyticsConsent.policyVersion}</dd></div> : null}
      </dl>
      <div className="platform-write-actions">
        <button type="button" className="platform-button platform-button-primary" disabled={!changed || busy} onClick={() => { void save(); }}>
          {busy ? t('保存中…', 'Saving…') : t('保存设置', 'Save setting')}
        </button>
      </div>
      {message ? <p className="platform-action-message" role="status">{message}</p> : null}
    </section>
  );
}
