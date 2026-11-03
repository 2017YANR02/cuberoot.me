'use client';

import { useState, useSyncExternalStore } from 'react';
import BoolToggle from './BoolToggle';
import { useT } from '@/hooks/useT';
import { analyticsServerSnapshot, analyticsSnapshot, setAnalyticsEnabled, subscribeAnalytics } from '@/lib/product-analytics';

export default function ProductAnalyticsSettings() {
  const t = useT();
  const state = useSyncExternalStore(subscribeAnalytics, analyticsSnapshot, analyticsServerSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <section aria-label={t('产品使用分析', 'Product usage analytics')}>
    <h3>{t('产品使用分析', 'Product usage analytics')}</h3>
    <p>{t('可选。记录页面类型、入口曝光与点击、功能使用、语言及屏幕分类，用于改进功能编排。登录后关联账号以统计使用频率；未登录时仅关联短期会话。原始事件有效期为 30 天，到期后由定时任务分批清理。不记录输入内容、完整网址或 IP。',
      'Optional. Record page categories, entry impressions and clicks, feature usage, language and screen category to improve navigation. Signed-in activity is linked to your account to measure frequency; anonymous activity is linked only to a short-lived session. Raw events expire after 30 days and are removed by scheduled batch cleanup. Input contents, full URLs and IP addresses are not recorded.')}</p>
    <BoolToggle label={t('允许产品使用分析', 'Allow product usage analytics')} value={state.enabled} disabled={!state.ready || busy}
      onChange={value => {
        setBusy(true); setError(false);
        void setAnalyticsEnabled(value).catch(() => setError(true)).finally(() => setBusy(false));
      }} />
    {error && <p role="status">{t('设置未能保存，当前浏览器已停止采集。请检查网络或浏览器隐私设置后重试。', 'Could not save. Collection has stopped in this browser. Check your connection or browser privacy settings and retry.')}</p>}
  </section>;
}
