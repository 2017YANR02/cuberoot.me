'use client';

import { Fragment, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Bluetooth, ChevronRight, Database, Dices, Keyboard, Palette, Timer, Trophy, Volume2, X } from 'lucide-react';
import { TIMER_SETTING_ACTION_CATEGORY, TIMER_SETTING_CATEGORY_CONTRACTS, type TimerSettingCategoryId } from '@cuberoot/shared/timer';
import type { TimerMoreMenuItem } from './TimerMoreMenu';
import { useDialogMotion } from './useDialogMotion';
import { useModalDismiss } from './useModalDismiss';
import './timer-settings-panel.css';

const icons = { timer: Timer, 'smart-cube': Bluetooth, scramble: Dices, training: Trophy,
  appearance: Palette, sound: Volume2, data: Database, advanced: Keyboard };

interface SettingsActionLinkProps {
  href: string;
  children: ReactNode;
  className: string;
  onClick: () => void;
}

/** One responsive settings dialog. Hosts supply supported categories and their fields. */
export function TimerSettingsPanel({ language, activeCategory, onCategoryChange, onClose, categories, playersControl, presenceControl, resetControl, actions, renderActionLink, children }: {
  language: 'en' | 'zh';
  activeCategory: TimerSettingCategoryId;
  onCategoryChange(category: TimerSettingCategoryId): void;
  onClose(): void;
  categories?: readonly TimerSettingCategoryId[];
  playersControl?: ReactNode;
  presenceControl?: ReactNode;
  resetControl?: ReactNode;
  actions?: readonly TimerMoreMenuItem[];
  renderActionLink?: (props: SettingsActionLinkProps) => ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { motionRef, close } = useDialogMotion(onClose);
  const backdrop = useModalDismiss(close);
  const items = TIMER_SETTING_CATEGORY_CONTRACTS.filter(category => !categories || categories.includes(category.id));
  const label = (en: string, zh: string) => language === 'zh' ? zh : en;
  const currentActions = actions?.filter(action => action.visible && TIMER_SETTING_ACTION_CATEGORY[action.id] === activeCategory) ?? [];
  const regularActions = currentActions.filter(action => !action.danger);
  const runAction = (action: TimerMoreMenuItem) => {
    // Close before launching the next dialog, prompt or print, preserving user activation.
    flushSync(onClose);
    action.onSelect?.();
  };
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeCategory]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Pointer-opened settings must not leave the trigger focused: pad timing
    // deliberately ignores keys on buttons. Preserve keyboard navigation only.
    const restoreFocus = previous?.matches(':focus-visible') ?? false;
    dialogRef.current?.focus({ preventScroll: true });
    return () => { if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={motionRef} className="timer-settings-overlay" data-no-timer {...backdrop}>
      <div ref={dialogRef} className="timer-modal settings-modal" data-site-surface="panel" role="dialog" aria-modal="true"
        aria-labelledby={titleId} tabIndex={-1} onKeyDown={event => {
          if (event.key !== 'Tab' || !dialogRef.current) return;
          const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
          )].filter(element => !element.closest('[hidden]') && element.getClientRects().length > 0);
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (!first) { event.preventDefault(); dialogRef.current.focus(); }
          else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header className="settings-modal-head">
          <h2 id={titleId}>{label('Settings', '设置')}</h2>
            <label className="settings-category-picker">
              <select className="settings-category-select" aria-label={label('Settings categories', '设置分类')} value={activeCategory}
                onChange={event => onCategoryChange(event.target.value as TimerSettingCategoryId)}>
                {items.map(category => <option key={category.id} value={category.id}>{category.label[language]}</option>)}
              </select>
            </label>
          {resetControl && <div className="settings-global-reset">{resetControl}</div>}
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

          </aside>
          <div ref={mainRef} className="settings-main">

            {activeCategory === 'timer' && (playersControl || presenceControl) && (
              <section className="settings-section">
              {playersControl && <div className="settings-row">
                <span className="settings-row-label">{label('Players', '人数')}</span>
                <span className="settings-row-control">{playersControl}</span>
              </div>}
              {presenceControl && <div className="settings-row">
                <span className="settings-row-label">{label('Currently online', '当前在线')}</span>
                <span className="settings-row-control">{presenceControl}</span>
              </div>}
              </section>
            )}
            {children}
            {regularActions.length > 0 && (
              <div className="timer-settings-actions" aria-label={label('Tools', '工具')}>
                {regularActions.map(action => {
                  const name = action.id === 'more.fullscreen' && action.active
                    ? label('Exit fullscreen', '退出全屏') : action.label;
                  const content = <><span>{name}</span><ChevronRight size={16} aria-hidden="true" /></>;
                  if (action.href && !action.disabled) {
                    const props = { href: action.href, children: content, className: 'timer-settings-action', onClick: onClose };
                    return renderActionLink
                      ? <Fragment key={action.id}>{renderActionLink(props)}</Fragment>
                      : <a key={action.id} {...props} />;
                  }
                  return <button key={action.id} type="button" className="timer-settings-action"
                    disabled={action.disabled || !action.onSelect} onClick={() => runAction(action)}>{content}</button>;
                })}
              </div>
            )}
            {currentActions.filter(action => action.danger).map(action => (
              <div className="settings-reset-row settings-danger-actions" key={action.id}>
                <button type="button" className="hint-btn timer-settings-action-danger"
                  disabled={action.disabled || !action.onSelect} onClick={() => runAction(action)}>{action.label}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>, document.body,
  );
}
