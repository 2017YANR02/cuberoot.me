'use client';

// HomeLink — drop-in replacement for `<Link href="/">` or `<a href="/">` that
// resolves to the current locale's home (`/zh` or `/en`). Without this, a
// bare `/` link triggers a proxy 308 redirect (cookie-tracked) — works but
// flashes the URL bar and adds a network hop. Use HomeLink for any
// user-facing nav link that should land on the lang-prefixed landing.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mayUseMiniProgramBridge, openMiniProgramHome } from '@/lib/miniprogram-bridge';
import { useTranslation } from 'react-i18next';
import type { ReactNode, AnchorHTMLAttributes, ComponentProps } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode;
  miniProgramTarget?: 'tools' | 'account';
  // Home links appear across the site; only prefetch when explicitly requested.
  prefetch?: ComponentProps<typeof Link>['prefetch'];
};

export default function HomeLink({ children, prefetch = false, onClick, miniProgramTarget = 'tools', ...rest }: Props) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const home = (i18n.language.startsWith('zh') ? '/zh' : '/');
  return <Link href={home} data-mini-program-target={miniProgramTarget} {...rest} prefetch={prefetch} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || (rest.target && rest.target !== '_self')
      || !mayUseMiniProgramBridge()) return;
    event.preventDefault();
    void openMiniProgramHome(miniProgramTarget).then((handled) => {
      if (!handled) router.push(home);
    }).catch(() => { /* Keep the native-container page available for retry. */ });
  }}>{children}</Link>;
}
