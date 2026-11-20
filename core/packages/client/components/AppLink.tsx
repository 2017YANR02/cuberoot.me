'use client';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useContext, useRef, useSyncExternalStore, type ComponentProps } from 'react';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';
import { platformNavigationHref, platformPathname } from '@/lib/platform-navigation';
import { useTrainingHref } from '@/lib/training-host';
import { currentEntryHref, entryNavigationHref, type EntryNavigationMode } from '@/lib/entry-navigation';
import { LinkPendingIndicator } from '@/components/StartupStatus';
import { isInstalledForumHref, isInstalledWebsiteSurface, useInstalledForumDisabled } from '@/lib/installed-content';

type Props = ComponentProps<typeof NextLink> & { navigation?: EntryNavigationMode; loadingOverlay?: boolean };

// Internal absolute paths that must NOT get a /zh prefix: route handlers, API,
// auth/OAuth, static asset trees, SEO files. Match prefix + boundary.
const NO_PREFIX = /^\/(v1|api|auth|callback\.html|stats|tools|cubing-chunks|cubeopt|analyze-worker|_next|sitemap\.xml|robots\.txt|sw\.js)(\/|$|\?|#)/;

// A browsing context's installed frame identity is fixed for its lifetime.
// Keep the canonical server/first hydration render identical, then read it.
const subscribeInstalledSurface = () => () => undefined;
const serverInstalledSurface = () => false;
function isInstalledProductHref(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) return false;
  const pathname = href.split(/[?#]/, 1)[0].replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  return !NO_PREFIX.test(pathname)
    && !/^\/(assets|icons|images|fonts)(\/|$)/.test(pathname)
    && !/\.[^/]+$/.test(pathname);
}

// Pattern B: English lives at the BARE path; Chinese is prefixed (/zh). On a
// bare (English) page useParams().lang is 'en' (the page renders via the /en
// tree behind a proxy rewrite), so English links stay bare; on Chinese pages we
// re-prefix with /zh. Any stray /en or /zh already in the href is normalized
// away first.
export default function AppLink({ href, navigation = 'push', prefetch = false, loadingOverlay, ...props }: Props) {
  const params = useParams();
  const platform = useContext(PlatformNavigationContext);
  const clickedHref = useRef('');
  const trainingHref = useTrainingHref();
  const douyin = useDouyinToolSurface();
  const installed = useSyncExternalStore(subscribeInstalledSurface, isInstalledWebsiteSurface, serverInstalledSurface);
  const lang = params?.lang;
  const prefix = lang === 'zh' || !lang && typeof href === 'string' && /^\/zh(?:\/|$)/.test(href) ? '/zh' : '';
  let h = href;
  if (
    typeof href === 'string' &&
    href.startsWith('/') && // internal absolute
    !href.startsWith('//') && // not protocol-relative external
    !NO_PREFIX.test(href) &&
    (!installed || isInstalledProductHref(href))
  ) {
    const bare = href.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    h = prefix ? `${prefix}${bare === '/' ? '' : bare}` : bare;
  }
  if (typeof h === 'string') h = entryNavigationHref(trainingHref(platform && navigation === 'push' ? platformNavigationHref(h) : h), '');
  // Embedded requests cannot rely on accepting a SameSite=Lax language cookie.
  // Apply after navigation cleanup, which can canonicalize an old /en URL.
  if (installed && (lang === 'en' || lang === 'zh') && typeof h === 'string' && isInstalledProductHref(h)) {
    const pathname = h.split(/[?#]/, 1)[0];
    const bare = pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    h = `/${lang}${bare === '/' ? '' : bare}${h.slice(pathname.length)}`;
  }
  const contentHref = typeof h === 'string' ? h : String(h.pathname ?? '/');
  const forumDisabled = useInstalledForumDisabled(isInstalledForumHref(contentHref));
  if (forumDisabled || (douyin && !douyinContentAvailable(contentHref))) return null;
  // The Platform layout owns its local loading state. Internal links should
  // not replace the persistent workspace chrome with the site-wide overlay.
  const targetPath = typeof h === 'string' ? platformPathname(h) : '';
  const showLoadingOverlay = loadingOverlay ?? !(platform && (targetPath === '/platform' || targetPath.startsWith('/platform/')));
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
    {/* allow-nested-link: LinkPendingIndicator only subscribes to pending state and returns null, never an anchor. */}
    {showLoadingOverlay && <LinkPendingIndicator />}
  </NextLink>;
}
