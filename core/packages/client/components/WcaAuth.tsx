'use client';

/**
 * 登录 / 我的 入口 — 全站通用。两态都是真链接、都指 /account,没有弹层:
 *   未登录 → /account 渲染登录表单(带 ?next= 回跳本页)
 *   已登录 → /account 就是「我的」页
 * 地址里不带 wcaId:那是当前登录者的页面,不随看的是谁而变。
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLink from '@/components/AppLink';
import { useAuthStore, nextQuery } from '@/lib/auth-store';
import './wca_auth.css';

export default function WcaAuth({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);

  // SSR 拿不到 localStorage 的 auth-store hydrated user → server 永远渲染登录入口,
  // client hydrated 出已登录 → DOM 不一致。mount 前固定渲染登录入口占位,mount 后切真值。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !user) {
    const label = t('recon.wcaLogin');
    return (
      <AppLink
        href={`/account${nextQuery(pathname)}`}
        className="wca-auth-btn"
        title={label}
        aria-label={label}
        prefetch={false}
        onClick={onNavigate}
      >
        <Key size={18} />
      </AppLink>
    );
  }

  const label = user.name || user.wcaId || t('recon.wcaLogin');
  const face = user.avatar ? (
    <img src={user.avatar} alt="" className="wca-auth-avatar" />
  ) : (
    <span className="wca-auth-fallback">
      {(user.name || '?').charAt(0).toUpperCase()}
    </span>
  );

  return (
    <AppLink
      href="/account"
      className="wca-auth-trigger"
      title={label}
      aria-label={label}
      prefetch={false}
      onClick={onNavigate}
    >
      {face}
    </AppLink>
  );
}
