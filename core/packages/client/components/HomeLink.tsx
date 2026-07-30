'use client';

// HomeLink — drop-in replacement for `<Link href="/">` or `<a href="/">` that
// resolves to the current locale's home (`/zh` or `/en`). Without this, a
// bare `/` link triggers a proxy 308 redirect (cookie-tracked) — works but
// flashes the URL bar and adds a network hop. Use HomeLink for any
// user-facing nav link that should land on the lang-prefixed landing.

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { ReactNode, AnchorHTMLAttributes, ComponentProps } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode;
  // Pass `false` where the link is chrome the user rarely takes (a desk-pet
  // toolbar icon, a footer): prefetching the landing RSC payload every time
  // that chrome mounts is a wasted edge request, most often for the page the
  // user is already on.
  prefetch?: ComponentProps<typeof Link>['prefetch'];
};

export default function HomeLink({ children, ...rest }: Props) {
  const { i18n } = useTranslation();
  const home = (i18n.language.startsWith('zh') ? '/zh' : '/en');
  return <Link href={home} {...rest}>{children}</Link>;
}
