'use client';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof NextLink>;

// Internal absolute paths that must NOT get a /<lang> prefix: route handlers,
// API, auth/OAuth, static asset trees, SEO files. Match prefix + boundary.
const NO_PREFIX = /^\/(v1|api|auth|callback\.html|stats|tools|cubing-chunks|cubeopt|analyze-worker|_next|sitemap\.xml|robots\.txt|sw\.js)(\/|$|\?|#)/;

export default function AppLink({ href, ...props }: Props) {
  const params = useParams();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';
  let h = href;
  if (
    typeof href === 'string' &&
    href.startsWith('/') &&                  // internal absolute
    !href.startsWith('//') &&                // not protocol-relative external
    !/^\/(en|zh)(\/|$|\?|#)/.test(href) &&   // not already lang-prefixed
    !NO_PREFIX.test(href)
  ) {
    h = `/${lang}${href === '/' ? '' : href}`;
  }
  return <NextLink href={h} {...props} />;
}
