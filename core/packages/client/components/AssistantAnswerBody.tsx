'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SectionMenu from '@/app/[lang]/tutorial/components/SectionMenu';
import { useT } from '@/hooks/useT';

const sectionSelector = [
  '.site-assistant-prose > :is(h1,h2,h3,h4)',
  '.replay-reply h4',
  '.replay-reply [data-report-section]',
  '.replay-reply > details > summary',
].join(',');
type Section = { target: HTMLElement; label: string };

function placeOpenMenu(event: Event) {
  const menu = event.target;
  if (!(menu instanceof HTMLDetailsElement) || !menu.open) return;
  const log = menu.closest('.site-assistant-messages');
  const composer = log?.closest('.site-assistant-dialog')?.querySelector('.site-assistant-compose');
  if (!log || !composer) return;
  const rect = menu.getBoundingClientRect();
  const above = rect.top - log.getBoundingClientRect().top;
  const below = composer.getBoundingClientRect().top - rect.bottom;
  menu.dataset.side = below < Math.min(240, menu.querySelector('.tutorial-section-popover')?.scrollHeight ?? 0) + 8 && above > below ? 'above' : 'below';
  menu.style.setProperty('--section-menu-room', Math.max(0, (menu.dataset.side === 'above' ? above : below) - 8) + 'px');
}

export default function AssistantAnswerBody({ turn, enabled, report, onNavigate, children }: {
  turn: number; enabled: boolean; report: boolean; onNavigate: () => void; children: ReactNode;
}) {
  const t = useT();
  const content = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  useEffect(() => {
    const body = content.current;
    const mobile = window.matchMedia?.('(max-width: 767px)');
    if (!enabled || !body || !mobile) return;
    const collect = () => {
      const next = Array.from(body.querySelectorAll<HTMLElement>(sectionSelector), target => ({
        target, label: (target.dataset.reportSection || target.textContent || '').trim(),
      })).filter(section => section.label);
      setSections(previous => previous.length === next.length && previous.every((item, i) =>
        item.target === next[i].target && item.label === next[i].label) ? previous : next);
    };
    // Both Markdown and the report are lazy. A report can also switch views in place.
    const observer = new MutationObserver(collect);
    const sync = () => {
      observer.disconnect();
      if (mobile.matches) {
        collect();
        observer.observe(body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-report-section'] });
      } else setSections([]);
    };
    sync();
    mobile.addEventListener?.('change', sync);
    return () => { observer.disconnect(); mobile.removeEventListener?.('change', sync); };
  }, [enabled]);

  const showMenu = enabled && sections.length >= 2;
  useEffect(() => {
    const nav = bar.current;
    if (!showMenu || !nav) return;
    nav.addEventListener('toggle', placeOpenMenu, true);
    return () => nav.removeEventListener('toggle', placeOpenMenu, true);
  }, [showMenu]);

  function jump(target: HTMLElement) {
    const log = content.current?.closest<HTMLElement>('.site-assistant-messages');
    if (!log || !bar.current) return;
    onNavigate();
    for (let detail = target.closest('details'); detail; detail = detail.parentElement?.closest('details') ?? null) {
      detail.open = true;
    }
    // SectionMenu first closes the picker and restores focus to its trigger.
    requestAnimationFrame(() => {
      if (!target.isConnected || !bar.current) return;
      if (target.tagName !== 'SUMMARY') target.tabIndex = -1;
      target.focus({ preventScroll: true });
      const readingTop = log.getBoundingClientRect().top + log.clientTop + parseFloat(getComputedStyle(log).paddingTop) + bar.current.offsetHeight;
      log.scrollBy({ top: target.getBoundingClientRect().top - readingTop - 8,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  const label = report ? t('复盘目录', 'Report contents') : t('回答目录', 'Answer contents');
  return <div className="assistant-answer-block">
    {showMenu && <nav className="assistant-section-nav" ref={bar} aria-label={label}
      onKeyDown={event => {
        const menu = bar.current?.querySelector('details[open]');
        if (event.key !== 'Escape' || !(menu instanceof HTMLDetailsElement)) return;
        event.preventDefault();
        event.stopPropagation();
        menu.open = false;
        menu.querySelector('summary')?.focus({ preventScroll: true });
      }}>
      <SectionMenu label={label}>{sections.map(({ target, label: title }, index) =>
        <button type="button" key={index} onClick={() => jump(target)}>{title}</button>)}</SectionMenu>
    </nav>}
    <div ref={content} className="site-assistant-response" data-assistant-message="assistant" data-turn={turn}>{children}</div>
  </div>;
}
