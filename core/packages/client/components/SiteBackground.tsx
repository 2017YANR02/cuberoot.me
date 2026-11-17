'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppearanceBackground, AppearanceBackgroundControl } from '@cuberoot/app-ui/appearance';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { HOME_BACKGROUND_ASSETS as ASSET_ROOT, type HomeBackgroundChoice } from '@/lib/home-backgrounds';
import { useLang } from '@/i18n/tr';
import { useEffectiveTheme } from '@/lib/theme';
import './site-background.css';

const BACKGROUND_PREVIEW_EVENT = 'site-background-preview';
type BackgroundPreview = { theme: 'light' | 'dark'; choice: HomeBackgroundChoice } | null;
export function previewBackground(value: BackgroundPreview) {
  window.dispatchEvent(new CustomEvent(BACKGROUND_PREVIEW_EVENT, { detail: value }));
}
export function endBackgroundPreview() { previewBackground(null); }

/** One document-level landscape; preference and assets retain their existing keys. */
export default function SiteBackground({ manageDocument = true }: { manageDocument?: boolean } = {}) {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [savedChoice] = useHomeBackgroundChoice(theme);
  const [preview, setPreview] = useState<BackgroundPreview>(null);
  const choice = preview?.theme === theme ? preview.choice : savedChoice;
  const pathname = usePathname();

  useEffect(() => {
    const sync = (event: Event) => setPreview((event as CustomEvent<BackgroundPreview>).detail);
    window.addEventListener(BACKGROUND_PREVIEW_EVENT, sync);
    return () => window.removeEventListener(BACKGROUND_PREVIEW_EVENT, sync);
  }, []);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const scheme = getComputedStyle(document.documentElement).getPropertyValue('--site-color-scheme').trim();
      setTheme(scheme === 'dark' ? 'dark' : 'light');
      setReady(true);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    sync();
    // CSS is the authority for palette previews and delayed dark-locked roots.
    const rootObserver = new MutationObserver(schedule);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-palette-scheme', 'data-contrast'] });
    // Text updates (timers and counters) cannot change the page's color scheme.
    const pageObserver = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes]
        .some(node => node instanceof Element && (node.classList.length > 0 || node.querySelector('[class]'))))) schedule();
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', schedule);
    window.addEventListener('theme-change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      rootObserver.disconnect();
      pageObserver.disconnect();
      media.removeEventListener('change', schedule);
      window.removeEventListener('theme-change', schedule);
    };
  }, [pathname]);

  return <AppearanceBackground choice={choice} scheme={theme} enabled={ready && !pathname?.startsWith('/auth/')} manageDocument={manageDocument} />;
}

/** The same expanded selector is available in every appearance menu. */
export function SiteBackgroundControl() {
  const theme = useEffectiveTheme();
  const [choice, selectBackground] = useHomeBackgroundChoice(theme);
  const language = useLang();
  useEffect(() => endBackgroundPreview, [theme]);
  return <AppearanceBackgroundControl language={language} choice={choice} scheme={theme} assetRoot={ASSET_ROOT}
    onChange={value => { selectBackground(value); endBackgroundPreview(); }}
    onPreview={value => previewBackground(value === null ? null : { theme, choice: value })} />;
}
