'use client';

/**
 * 全局会员到期提醒:登录会员「即将到期 / 已过期」时,在站内任意页弹一条提醒条,
 * 一键跳 /membership 续费(?renew=1 自动打开续费弹窗)。可关闭 —— 按当前到期日记忆,
 * 续费后到期日变化自然复位(且续费后不再「即将到期」也就不再弹)。
 * /membership 页自身不显示(那里有更完整的状态块)。
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Crown, X } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { useMembership } from '@/hooks/useMembership';
import { membershipExpiry } from '@/lib/membership-api';
import { persistItem } from '@/lib/safe-storage';
import './membership-reminder.css';

const DISMISS_KEY = 'cuberoot_mem_reminder_dismissed';

export default function MembershipReminder() {
  const { membership } = useMembership();
  const pathname = usePathname();
  // localStorage 在 effect 里读,避免 SSR / 首帧 hydration 不一致(首帧统一渲染 null)。
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setDismissedFor(localStorage.getItem(DISMISS_KEY)); } catch { /* ignore */ }
    setReady(true);
  }, []);

  if (!ready || !membership || pathname?.includes('/membership')) return null;
  const exp = membershipExpiry(membership);
  if (!exp || (!exp.expiringSoon && !exp.expired)) return null;

  const dismissKey = membership.expiresAt ?? '';
  if (dismissedFor === dismissKey) return null;

  const dismiss = () => {
    persistItem(DISMISS_KEY, dismissKey);
    setDismissedFor(dismissKey);
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
      <AppLink href="/membership?renew=1" className="mem-reminder-cta" onClick={dismiss}>
        {tr({ zh: '续费', en: 'Renew'
      })}
      </AppLink>
      <button className="mem-reminder-close" onClick={dismiss} aria-label={tr({ zh: '关闭', en: 'Dismiss'
      })}>
        <X size={15} />
      </button>
    </div>
  );
}
