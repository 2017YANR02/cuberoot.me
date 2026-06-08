'use client';

// HomeLink — drop-in replacement for `<Link href="/">` or `<a href="/">` that
// resolves to the current locale's home (`/zh` or `/en`). Without this, a
// bare `/` link triggers a proxy 308 redirect (cookie-tracked) — works but
// flashes the URL bar and adds a network hop. Use HomeLink for any
// user-facing nav link that should land on the lang-prefixed landing.

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import i18n from '@/i18n/i18n-client';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode;
};

export default function HomeLink({ children, ...rest }: Props) {
  const { i18n } = useTranslation();
  const home = (i18n.language.startsWith('zh') ? '/zh' : '/en');
  return <Link href={home} {...rest}>{children}</Link>;
}
