'use client';

/**
 * 全局会员到期提醒:登录会员「即将到期 / 已过期」时,在站内任意页弹一条提醒条,
 * 点击关闭后在当前浏览器按会员账号隐藏。点击续费只隐藏当前到期日的提醒。
 * /membership 页自身不显示(那里有更完整的状态块)。
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Crown, X } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { useMembership } from '@/hooks/useMembership';
import { membershipExpiry } from '@/lib/membership-api';
import { persistItem } from '@/lib/safe-storage';
import './membership-reminder.css';

const DISMISSED_FOR_EXPIRY_KEY = 'cuberoot_mem_reminder_dismissed';
const DISMISSED_BY_MEMBER_PREFIX = 'cuberoot_mem_reminder_dismissed:';

export default function MembershipReminder() {
  const { membership } = useMembership();
  const pathname = usePathname();
  const memberId = membership?.wcaId;
  const dismissKey = memberId ? DISMISSED_BY_MEMBER_PREFIX + memberId : null;
  const [dismissal, setDismissal] = useState<{
    key: string;
    dismissed: boolean;
    dismissedForExpiry: string | null;
  } | null>(null);

  useEffect(() => {
    if (!dismissKey) return;
    let dismissed = false;
    let dismissedForExpiry: string | null = null;
    try {
      dismissed = localStorage.getItem(dismissKey) === '1';
      dismissedForExpiry = localStorage.getItem(DISMISSED_FOR_EXPIRY_KEY);
    } catch { /* ignore */ }
    setDismissal({ key: dismissKey, dismissed, dismissedForExpiry });
  }, [dismissKey]);

  if (!membership || !dismissal || dismissal.key !== dismissKey || dismissal.dismissed) return null;
  if (pathname?.includes('/membership')) return null;
  const exp = membershipExpiry(membership);
  if (!exp || (!exp.expiringSoon && !exp.expired)) return null;

  const expiresAt = membership.expiresAt ?? '';
  if (dismissal.dismissedForExpiry === expiresAt) return null;

  const dismiss = () => {
    persistItem(dismissal.key, '1');
    setDismissal({ ...dismissal, dismissed: true });
  };

  const dismissForRenewal = () => {
    persistItem(DISMISSED_FOR_EXPIRY_KEY, expiresAt);
    setDismissal({ ...dismissal, dismissedForExpiry: expiresAt });
  };

  return (
    <div className={`mem-reminder${exp.expired ? ' is-expired' : ''}`} role="status">
      <Crown size={15} className="mem-reminder-icon" />
      <span className="mem-reminder-text">
        {exp.expired
          ? tr({ zh: '你的 CubeRoot 会员已到期', en: 'Your CubeRoot membership has expired'
        })
          : tr({ zh: 'CubeRoot 会员还有 {n} 天到期', en: 'Your CubeRoot membership expires in {n} day(s)'
        }).replace('{n}', String(Math.max(0, exp.daysLeft ?? 0)))}
      </span>
      <AppLink href="/membership?renew=1" className="mem-reminder-cta" onClick={dismissForRenewal}>
        {tr({ zh: '续费', en: 'Renew'
      })}
      </AppLink>
      <button type="button" className="mem-reminder-close" onClick={dismiss} aria-label={tr({ zh: '关闭', en: 'Dismiss'
      })}>
        <X size={15} />
      </button>
    </div>
  );
}
