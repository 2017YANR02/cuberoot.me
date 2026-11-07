'use client';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, type ComponentProps } from 'react';
import { useTrainingHref } from '@/lib/training-host';
import { currentEntryHref, entryNavigationHref, type EntryNavigationMode } from '@/lib/entry-navigation';
import { LinkPendingIndicator } from '@/components/StartupStatus';

type Props = ComponentProps<typeof NextLink> & { navigation?: EntryNavigationMode };

// Internal absolute paths that must NOT get a /zh prefix: route handlers, API,
// auth/OAuth, static asset trees, SEO files. Match prefix + boundary.
const NO_PREFIX = /^\/(v1|api|auth|callback\.html|stats|tools|cubing-chunks|cubeopt|analyze-worker|_next|sitemap\.xml|robots\.txt|sw\.js)(\/|$|\?|#)/;

// Pattern B: English lives at the BARE path; Chinese is prefixed (/zh). On a
// bare (English) page useParams().lang is 'en' (the page renders via the /en
// tree behind a proxy rewrite), so English links stay bare; on Chinese pages we
// re-prefix with /zh. Any stray /en or /zh already in the href is normalized
// away first.
export default function AppLink({ href, navigation = 'push', prefetch = false, ...props }: Props) {
  const params = useParams();
  const clickedHref = useRef('');
  const trainingHref = useTrainingHref();
  const douyin = useDouyinToolSurface();
  const lang = params?.lang;
  const prefix = lang === 'zh' || !lang && typeof href === 'string' && /^\/zh(?:\/|$)/.test(href) ? '/zh' : '';
  let h = href;
  if (
    typeof href === 'string' &&
    href.startsWith('/') && // internal absolute
    !href.startsWith('//') && // not protocol-relative external
    !NO_PREFIX.test(href)
  ) {
    const bare = href.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    h = prefix ? `${prefix}${bare === '/' ? '' : bare}` : bare;
  }
  if (typeof h === 'string') h = entryNavigationHref(trainingHref(h), '');
  if (douyin && !douyinContentAvailable(typeof h === 'string' ? h : String(h.pathname ?? '/'))) return null;
  return <NextLink href={h} prefetch={prefetch} data-entry-navigation={navigation} {...props}
    onClick={(event) => {
      props.onClick?.(event);
      clickedHref.current = event.currentTarget.getAttribute('href') ?? '';
    }}
    onNavigate={(event) => {
      let cancelled = false;
      props.onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
      if (!cancelled) currentEntryHref(clickedHref.current, props.replace && navigation === 'push' ? 'replace' : navigation);
    }}>
    {props.children}
    <LinkPendingIndicator />
  </NextLink>;
}
