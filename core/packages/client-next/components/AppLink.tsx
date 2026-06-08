'use client';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof NextLink>;

// Internal absolute paths that must NOT get a /zh prefix: route handlers, API,
// auth/OAuth, static asset trees, SEO files. Match prefix + boundary.
const NO_PREFIX = /^\/(v1|api|auth|callback\.html|stats|tools|cubing-chunks|cubeopt|analyze-worker|_next|sitemap\.xml|robots\.txt|sw\.js)(\/|$|\?|#)/;

// Pattern B: English lives at the BARE path; Chinese is prefixed (/zh or
// /zh-Hant). On a bare (English) page useParams().lang is 'en' (the page renders
// via the /en tree behind a proxy rewrite), so English links stay bare; on
// Chinese pages we re-prefix with the current locale. Any stray /en, /zh or
// /zh-Hant already in the href is normalized away first.
export default function AppLink({ href, ...props }: Props) {
  const params = useParams();
  const lang = params?.lang;
  const prefix = lang === 'zh' || lang === 'zh-Hant' ? `/${lang}` : '';
  let h = href;
  if (
    typeof href === 'string' &&
    href.startsWith('/') && // internal absolute
    !href.startsWith('//') && // not protocol-relative external
    !NO_PREFIX.test(href)
  ) {
    const bare = href.replace(/^\/(en|zh-Hant|zh)(?=\/|$)/, '') || '/';
    h = prefix ? `${prefix}${bare === '/' ? '' : bare}` : bare;
  }
  return <NextLink href={h} {...props} />;
}
