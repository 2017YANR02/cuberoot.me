'use client';

import type { ComponentProps } from 'react';
import Link from '@/components/AppLink';
import { useLang } from '@/i18n/tr';
import { resolveRegulationHref } from '@/lib/regulation-links';

type Props = ComponentProps<'a'> & { source?: boolean };

/** Source attribution remains external; reading references prefer the local copy. */
export default function RegulationLink({ href, source = false, target, rel, children, ...props }: Props) {
  const language = useLang();
  const internal = !source && href ? resolveRegulationHref(href, language) : null;
  const internalPathname = internal?.split(/[?#]/, 1)[0];
  // Public documents are language-neutral. AppLink adds the page-language
  // prefix, so downloads and file references retain native anchor navigation.
  if (internal && internalPathname && /\.[a-z\d]+$/i.test(internalPathname)) return <a {...props} href={internal}>{children}</a>;
  if (internal) return <Link {...props} href={internal} prefetch={false}>{children}</Link>;
  return <a {...props} href={href} target={target} rel={rel}>{children}</a>;
}
