'use client';

// Sticky desktop mini-TOC + scroll-reveal for the long /why-cube page. Scans
// the rendered .wc-sec sections (no per-section wiring needed), builds nav
// entries from their titles, scroll-spies the active one, and fades each
// section in as it enters. Uses real <a href="#id"> so middle-click / new-tab
// works; smooth scroll via scrollIntoView (no history.* — CI bans raw history).
// Hidden on narrow screens (the page just scrolls).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './_StickyToc.css';

type Item = { id: string; label: string };

export default function StickyToc() {
  const { i18n } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState('');

  // (Re)build the list from the DOM whenever language changes (titles localize).
  useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>('.wc-page .wc-sec'));
    const next = secs.map((el, i) => {
      if (!el.id) el.id = `wc-sec-${i}`;
      const label = el.querySelector('.wc-sec-title')?.textContent?.trim() || `#${i + 1}`;
      return { id: el.id, label };
    });
    setItems(next);
  }, [i18n.language]);

  // Scroll-spy + reveal in one observer.
  useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>('.wc-page .wc-sec'));
    if (!secs.length) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const root = document.querySelector('.wc-page');
    if (root && !reduce) root.classList.add('wc-reveal-armed');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('wc-reveal-in');
        }
        let cur = '';
        for (const s of secs) {
          if (s.getBoundingClientRect().top <= 150) cur = s.id;
        }
        if (cur) setActive(cur);
      },
      { rootMargin: '0px 0px -55% 0px', threshold: [0, 0.01] },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items.length]);

  function go(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (items.length < 3) return null;

  return (
    <nav className="wc-toc" aria-label={i18n.language.startsWith('zh') ? '目录' : 'Contents'}>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={`wc-toc-link${active === it.id ? ' is-active' : ''}`}
              onClick={(e) => go(e, it.id)}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
