'use client';

/**
 * 全局会员到期提醒:登录会员「即将到期 / 已过期」时,在站内任意页弹一条提醒条,
 * 点击关闭后在当前浏览器按会员账号隐藏。点击续费只隐藏当前到期日的提醒。
 * /membership 页自身不显示(那里有更完整的状态块)。
 */
import { useSyncExternalStore } from 'react';
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

const changeEvent = 'membership-reminder-change';
const unsaved = new Map<string, string>();

function readMarker(key: string) {
  if (unsaved.has(key)) return unsaved.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeMarker(key: string, value: string) {
  if (persistItem(key, value)) unsaved.delete(key);
  else unsaved.set(key, value);
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DISMISSED_FOR_EXPIRY_KEY || event.key.startsWith(DISMISSED_BY_MEMBER_PREFIX)) notify();
  };
  window.addEventListener(changeEvent, notify);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', notify);
  document.addEventListener('visibilitychange', notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', notify);
    document.removeEventListener('visibilitychange', notify);
  };
}

export default function MembershipReminder() {
  const { membership } = useMembership();
  const pathname = usePathname();
  const memberId = membership?.wcaId;
  const dismissKey = memberId ? DISMISSED_BY_MEMBER_PREFIX + memberId : null;
  const expiresAt = membership?.expiresAt ?? '';
  const dismissed = useSyncExternalStore(subscribe, () =>
    !dismissKey || readMarker(dismissKey) === '1' || readMarker(DISMISSED_FOR_EXPIRY_KEY) === expiresAt,
  () => true);

  if (!membership || !dismissKey || dismissed || pathname?.includes('/membership')) return null;
  const exp = membershipExpiry(membership);
  if (!exp || (!exp.expiringSoon && !exp.expired)) return null;

  const dismiss = () => writeMarker(dismissKey, '1');
  const dismissForRenewal = () => writeMarker(DISMISSED_FOR_EXPIRY_KEY, expiresAt);

  return (
    <div className={`mem-reminder${exp.expired ? ' is-expired' : ''}`} role="status">
      <Crown size={15} className="mem-reminder-icon" />
      <span className="mem-reminder-text">
        {exp.expired
          ? tr({ zh: '你的 Pro 会员已到期', en: 'Your Pro membership has expired'
        })
          : tr({ zh: 'Pro 会员还有 {n} 天到期', en: 'Your Pro membership expires in {n} day(s)'
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
