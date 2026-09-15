'use client';

import { Pin, PinOff } from 'lucide-react';
import { tr } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { useLiveUrlSuffix } from '@/hooks/useLiveUrlSuffix';
import './country-pins.css';

export function CountryPinButton({ name, pinned, onToggle }: {
  name: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  const user = useAuthUser();
  const returnTo = useLiveUrlSuffix();
  const label = pinned
    ? tr({ zh: `取消置顶 ${name}`, en: `Unpin ${name}` })
    : tr({ zh: `置顶 ${name}`, en: `Pin ${name}` });
  const Icon = pinned ? PinOff : Pin;
  if (!user) {
    const loginLabel = tr({ zh: `登录后置顶 ${name}`, en: `Sign in to pin ${name}` });
    return <AppLink href={`/account${nextQuery(returnTo)}`} prefetch={false}
      className="country-pin-button" aria-label={loginLabel} title={loginLabel}
      onMouseDown={event => event.preventDefault()}
      onClick={event => event.stopPropagation()}
    ><Pin size={15} aria-hidden /></AppLink>;
  }
  return (
    <button type="button" className="country-pin-button" aria-label={label} title={label}
      aria-pressed={pinned}
      onMouseDown={event => event.preventDefault()}
      onClick={event => { event.stopPropagation(); onToggle(); }}
    ><Icon size={15} aria-hidden /></button>
  );
}
