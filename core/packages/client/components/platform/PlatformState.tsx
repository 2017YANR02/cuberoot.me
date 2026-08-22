'use client';

import { AlertTriangle, Inbox, LoaderCircle, LockKeyhole } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';

type StateKind = 'loading' | 'empty' | 'error' | 'permission';

export function PlatformState({
  kind,
  message,
  onRetry,
}: {
  kind: StateKind;
  message?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  const content = {
    loading: {
      Icon: LoaderCircle,
      title: t('正在加载', 'Loading'),
      detail: t('正在从 Platform 服务获取最新数据。', 'Fetching the latest data from the Platform service.'),
    },
    empty: {
      Icon: Inbox,
      title: t('暂无内容', 'Nothing here yet'),
      detail: t('当前筛选条件下没有可显示的真实数据。', 'No real data matches the current filters.'),
    },
    error: {
      Icon: AlertTriangle,
      title: t('服务暂不可用', 'Service unavailable'),
      detail: message ?? t('请求没有成功。你可以重试；页面不会用演示数据代替。', 'The request did not succeed. You can retry; demo data will not be substituted.'),
    },
    permission: {
      Icon: LockKeyhole,
      title: t('需要权限', 'Permission required'),
      detail: message ?? t('请登录具备相应角色的账号后继续。', 'Sign in with an account that has the required role to continue.'),
    },
  }[kind];
  const { Icon } = content;

  return (
    <div className={`platform-state platform-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon className={kind === 'loading' ? 'platform-spin' : undefined} aria-hidden />
      <div>
        <strong>{content.title}</strong>
        <p>{content.detail}</p>
        <div className="platform-state-actions">
          {kind === 'error' && onRetry ? (
            <button type="button" className="platform-button" onClick={onRetry}>{t('重试', 'Retry')}</button>
          ) : null}
          {kind === 'permission' ? (
            <AppLink href="/account" className="platform-button">{t('前往登录', 'Go to sign in')}</AppLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
