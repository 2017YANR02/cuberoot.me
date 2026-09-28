'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bluetooth, Database, Dices, Keyboard, Palette, Timer, Trophy, Volume2, X } from 'lucide-react';
import { TIMER_SETTING_CATEGORY_CONTRACTS, type TimerSettingCategoryId } from '@cuberoot/shared/timer';
import { useModalDismiss } from './useModalDismiss';
import './timer-settings-panel.css';

const icons = { timer: Timer, 'smart-cube': Bluetooth, scramble: Dices, training: Trophy,
  appearance: Palette, sound: Volume2, data: Database, advanced: Keyboard };

/** One responsive settings dialog. Hosts supply supported categories and their fields. */
export function TimerSettingsPanel({ language, activeCategory, onCategoryChange, onClose, categories, children }: {
  language: 'en' | 'zh';
  activeCategory: TimerSettingCategoryId;
  onCategoryChange(category: TimerSettingCategoryId): void;
  onClose(): void;
  categories?: readonly TimerSettingCategoryId[];
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useRef(() => closeRef.current()).current;
  const backdrop = useModalDismiss(close);
  const items = TIMER_SETTING_CATEGORY_CONTRACTS.filter(category => !categories || categories.includes(category.id));
  const label = (en: string, zh: string) => language === 'zh' ? zh : en;
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeCategory]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="timer-settings-overlay" data-no-timer {...backdrop}>
      <div ref={dialogRef} className="timer-modal settings-modal" role="dialog" aria-modal="true"
        aria-labelledby={titleId} tabIndex={-1} onKeyDown={event => {
          if (event.key !== 'Tab' || !dialogRef.current) return;
          const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          )].filter(element => !element.closest('[hidden]') && element.getClientRects().length > 0);
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (!first) { event.preventDefault(); dialogRef.current.focus(); }
          else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header className="settings-modal-head">
          <h2 id={titleId}>{label('Settings', '设置')}</h2>
          <button type="button" className="settings-modal-close" onClick={close} aria-label={label('Close settings', '关闭设置')}><X size={18} /></button>
        </header>
        <div className="settings-layout">
          <aside className="settings-category-rail" aria-label={label('Settings categories', '设置分类')}>
            <nav className="settings-category-nav">
              {items.map(category => {
                const Icon = icons[category.id];
                return <button key={category.id} type="button" className="settings-category-button"
                  data-active={activeCategory === category.id ? 'true' : undefined}
                  aria-current={activeCategory === category.id ? 'page' : undefined}
                  onClick={() => onCategoryChange(category.id)}><Icon size={16} aria-hidden /><span>{category.label[language]}</span></button>;
              })}
            </nav>
            <label className="settings-category-picker">
              <span>{label('Category', '分类')}</span>
              <select className="settings-category-select" value={activeCategory}
                onChange={event => onCategoryChange(event.target.value as TimerSettingCategoryId)}>
                {items.map(category => <option key={category.id} value={category.id}>{category.label[language]}</option>)}
              </select>
            </label>
          </aside>
          <div ref={mainRef} className="settings-main">
            <div className="settings-category-intro"><h3>{items.find(category => category.id === activeCategory)?.label[language]}</h3></div>
            {children}
          </div>
        </div>
      </div>
    </div>, document.body,
  );
}
