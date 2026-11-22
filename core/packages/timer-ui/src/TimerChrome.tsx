'use client';

import { TIMER_SOLO_STAT_RAIL_KEYS, timerSoloStatRailRows } from '@cuberoot/shared/timer/solo-layout';
import { Bluetooth, Mic } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ViewportRect } from './host-viewport';

export type TimerPlayersValue = 1 | 2 | 3 | 4 | 'net';

export interface TimerPlayersSelectProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onlineAvailable?: boolean;
  onlineLabel: string;
  onChange?: (value: TimerPlayersValue) => void;
  playerLabel: (count: 1 | 2 | 3 | 4) => string;
  readOnly?: boolean;
  value: TimerPlayersValue;
}

export function TimerPlayersSelect({
  ariaLabel,
  className,
  disabled = false,
  onlineAvailable = true,
  onlineLabel,
  onChange,
  playerLabel,
  readOnly = false,
  value,
}: TimerPlayersSelectProps) {
  if (readOnly) {
    return (
      <span
        aria-label={ariaLabel}
        className={`shell-players-select shell-players-select--readonly${className ? ` ${className}` : ''}`}
        data-no-timer
        title={ariaLabel}
      >
        {value === 'net' ? onlineLabel : playerLabel(value)}
      </span>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      className={`shell-players-select${className ? ` ${className}` : ''}`}
      data-no-timer
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next === 'net' ? 'net' : Number(next) as 1 | 2 | 3 | 4);
      }}
      title={ariaLabel}
      value={value}
    >
      {([1, 2, 3, 4] as const).map((count) => (
        <option key={count} value={count}>{playerLabel(count)}</option>
      ))}
      {onlineAvailable && <option value="net">{onlineLabel}</option>}
    </select>
  );
}

export interface TimerTopbarProps {
  brand?: ReactNode;
  controls: ReactNode;
  actions?: ReactNode;
  className?: string;
  availableTopBar?: ViewportRect;
}

export function TimerTopbar({ brand, controls, actions, className, availableTopBar }: TimerTopbarProps) {
  const headerRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const controls = controlsRef.current;
    const actions = actionsRef.current;
    if (!availableTopBar || brand || !header || !controls || !actions) return;

    const { x, y, width, height } = availableTopBar;
    header.style.setProperty('--timer-topbar-left', `${x}px`);
    header.style.setProperty('--timer-topbar-top', `${y}px`);
    header.style.setProperty('--timer-topbar-width', `${width}px`);
    header.style.setProperty('--timer-topbar-height', `${height}px`);

    const fit = () => {
      // Measure the same controls in one row, including their labels.
      header.setAttribute('data-use-top-bar', '');
      const controlSize = controls.getBoundingClientRect();
      const actionSize = actions.getBoundingClientRect();
      const { columnGap, paddingLeft, paddingRight } = getComputedStyle(header);
      const rightLimit = actionSize.width > 0
        ? actionSize.left - parseFloat(columnGap)
        : x + width - parseFloat(paddingRight);
      const fits = x + width <= window.innerWidth && (window.visualViewport?.scale ?? 1) <= 1
        && controlSize.left >= x + parseFloat(paddingLeft)
        && controlSize.right <= rightLimit
        && Math.max(controlSize.height, actionSize.height) <= height;
      header.toggleAttribute('data-use-top-bar', fits);
    };
    fit();
    const sizeObserver = new ResizeObserver(fit);
    sizeObserver.observe(controls);
    sizeObserver.observe(actions);
    const contentObserver = new MutationObserver(fit);
    contentObserver.observe(header, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      sizeObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      header.removeAttribute('data-use-top-bar');
    };
  }, [availableTopBar, brand]);

  return (
    <header ref={headerRef} className={`shell-topbar surface-chrome${className ? ` ${className}` : ''}`} data-topbar-actions={actions ? 'true' : undefined}>
      {brand}
      <div ref={controlsRef} className="shell-topbar-left">{controls}</div>
      <div ref={actionsRef} className="shell-topbar-right">{actions}</div>
    </header>
  );
}

export interface TimerStatItem {
  label?: string;
  value: string;
}

export interface TimerStatRailProps {
  ariaExpanded?: boolean;
  className?: string;
  disabled?: boolean;
  language: 'en' | 'zh';
  summary: {
    count: number;
    solved: number;
    mean: string;
    best: string;
    mo3: string;
    ao5: string;
    ao12: string;
  };
  trainingSummaries?: TimerStatRailProps['summary'][];
  onClick?: () => void;
}

const STAT_RAIL_COPY = {
  en: { count: 'Count', title: 'Open times and statistics' },
  zh: { count: '次数', title: '打开成绩与统计' },
} as const;

export function TimerStatRail({
  ariaExpanded,
  className,
  disabled = false,
  language,
  summary,
  trainingSummaries,
  onClick,
}: TimerStatRailProps) {
  const copy = STAT_RAIL_COPY[language];
  const items = timerSoloStatRailRows(summary);
  return (
    <button
      aria-expanded={ariaExpanded}
      className={`shell-stat-rail surface-chrome${className ? ` ${className}` : ''}`}
      data-no-timer
      disabled={disabled}
      onClick={onClick}
      title={copy.title}
      type="button"
    >
      {trainingSummaries ? <span className="shell-stat-training">
        <span />
        {TIMER_SOLO_STAT_RAIL_KEYS.map(key =>
          <span key={key} className="shell-stat-lbl">{key === 'count' ? copy.count : key}</span>)}
        {[{ en: 'Observation', zh: '观察' }, { en: 'Execution', zh: '执行' }, { en: 'Total', zh: '总时间' }].map((copy, index) =>
          <span className="shell-stat-training-row" key={copy.en}>
            <span className="shell-stat-lbl">{copy[language]}</span>
            {TIMER_SOLO_STAT_RAIL_KEYS.map(key =>
              <span className="shell-stat-val" key={key}>{trainingSummaries[index]?.[key]}</span>)}
          </span>)}
      </span> : items.map(({ label, value }, index) => (
        <span className="shell-stat" key={`${label ?? 'value'}-${index}`}>
          <span className="shell-stat-lbl">{label}</span>
          <span className="shell-stat-val">{value}</span>
        </span>
      ))}
    </button>
  );
}

export interface TimerDeviceActionsProps {
  active?: boolean;
  className?: string;
  connectAriaLabel: string;
  connectLabel: string;
  microphoneActive?: boolean;
  microphoneAriaLabel?: string;
  onConnect: () => void;
  onMicrophone?: () => void;
}

export function TimerDeviceActions({
  active = false,
  className,
  connectAriaLabel,
  connectLabel,
  microphoneActive = false,
  microphoneAriaLabel,
  onConnect,
  onMicrophone,
}: TimerDeviceActionsProps) {
  return (
    <div
      className={`shell-device-actions surface-chrome${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      data-no-timer
    >
      <button
        aria-label={connectAriaLabel}
        className="shell-device-connect"
        onClick={onConnect}
        title={connectAriaLabel}
        type="button"
      >
        <Bluetooth aria-hidden="true" size={16} />
        <span>{connectLabel}</span>
      </button>
      {microphoneAriaLabel && onMicrophone && (
        <button
          aria-label={microphoneAriaLabel}
          className={`shell-stackmat-connect${microphoneActive ? ' is-active' : ''}`}
          onClick={onMicrophone}
          title={microphoneAriaLabel}
          type="button"
        >
          <Mic aria-hidden="true" size={15} />
        </button>
      )}
    </div>
  );
}
