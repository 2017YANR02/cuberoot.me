'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { HOME_BACKGROUND_ASSETS as ASSET_ROOT, HOME_BACKGROUNDS as SCENES, resolveHomeBackground } from '@/lib/home-backgrounds';
import { tr } from '@/i18n/tr';
import './site-background.css';

/** One document-level landscape; preference and assets retain their existing keys. */
export default function SiteBackground() {
  const [choice] = useHomeBackgroundChoice();
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [failedScene, setFailedScene] = useState<string | null>(null);
  const pathname = usePathname();

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

  const scene = resolveHomeBackground(choice, theme);
  // A different choice permits retrying a previously unavailable image.
  useEffect(() => setFailedScene(null), [choice]);
  const active = ready && !pathname?.startsWith('/auth/') && scene && failedScene !== scene.id;
  useEffect(() => {
    if (active) document.body.dataset.siteScenery = scene.id;
    else delete document.body.dataset.siteScenery;
    return () => { delete document.body.dataset.siteScenery; };
  }, [active, scene]);

  // Auth callbacks already show the returning page in their own background iframe.
  if (!active) return null;
  return <div className="site-scenery" aria-hidden="true"
    style={{ '--site-scene-position': scene.position } as CSSProperties}>
    {/* eslint-disable-next-line @next/next/no-img-element -- One local precompressed decorative image. */}
    <img key={scene.id} src={`${ASSET_ROOT}/${scene.id}.webp`} alt="" onError={() => setFailedScene(scene.id)} />
  </div>;
}

/** The same expanded selector is available in every appearance menu. */
export function SiteBackgroundControl() {
  const [choice, selectBackground] = useHomeBackgroundChoice();
  const autoLabel = tr({ zh: '随明暗切换', en: 'Follow light / dark' });
  const noneLabel = tr({ zh: '无背景', en: 'No background' });
  return <div className="site-background-control" role="group" aria-label={tr({ zh: '全站背景', en: 'Site background' })}>
      <div className="appearance-sec-label">{tr({ zh: '全站背景', en: 'Site background' })}</div>
      <div className="site-background-modes">
        {([{ value: 'auto', label: autoLabel }, { value: 'none', label: noneLabel }] as const).map(item => (
          <button key={item.value} type="button" role="menuitemradio" aria-checked={choice === item.value}
            className="site-background-mode" onClick={() => selectBackground(item.value)}>
            <span className="site-background-check">{choice === item.value && <Check size={13} />}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="site-background-grid">
        {SCENES.map(item => (
          <button key={item.id} type="button" role="menuitemradio" aria-checked={choice === item.id}
            className="site-background-option" onClick={() => selectBackground(item.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Tiny local WebP thumbnails. */}
            <img src={`${ASSET_ROOT}/${item.id}-thumb.webp`} alt="" width={128} height={72} />
            <span className="site-background-caption"><span>{tr(item)}</span>
              <span className="site-background-check">{choice === item.id && <Check size={13} />}</span>
            </span>
          </button>
        ))}
      </div>
    </div>;

}
