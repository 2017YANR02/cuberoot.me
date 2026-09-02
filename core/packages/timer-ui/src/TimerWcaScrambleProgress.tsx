'use client';

import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import {
  timerWcaScrambleProgressLabels,
  type TimerWcaScrambleProgressLabels,
} from '@cuberoot/shared/timer';
import { CheckCircle2, Repeat } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { Flag } from './CountryFlag';
import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';
import { usePopoverDismiss } from './usePopoverDismiss';

export type { TimerWcaScrambleProgressLabels } from '@cuberoot/shared/timer';

export interface TimerWcaScrambleMark {
  country?: string;
  dateLabel: string;
  name: string;
  personHref?: string;
  timeLabel?: string;
  wcaId: string;
}

export interface TimerWcaScrambleProgressProps extends TimerOverlayControlProps {
  allMarksHref?: string;
  language: 'en' | 'zh';
  labels?: TimerWcaScrambleProgressLabels;
  markCount?: number;
  marked?: boolean;
  marks?: readonly TimerWcaScrambleMark[];
  onNavigateAllMarks?: () => void;
  onNavigatePerson?: (mark: TimerWcaScrambleMark) => void;
  progress?: Readonly<{ seen: number; total: number }>;
  /** Fixed content below the popup, such as Mobile's bottom navigation. */
  viewportBottomInset?: number;
}

interface PanelGeometry {
  left: number;
  maxHeight: number;
  maxWidth: number;
  top: number;
}

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;

/** Rare-pool progress and public WCA scramble marks shared by every timer host. */
export function TimerWcaScrambleProgress({
  allMarksHref,
  language,
  labels: suppliedLabels,
  markCount = 0,
  marked = false,
  marks = [],
  onNavigateAllMarks,
  onNavigatePerson,
  onOpenChange,
  open: controlledOpen,
  progress,
  viewportBottomInset = 0,
}: TimerWcaScrambleProgressProps) {
  const labels = suppliedLabels ?? timerWcaScrambleProgressLabels(language);
  const [open, changeOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
    onOpenChange,
    open: controlledOpen,
  });
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);
  const panelId = useId();
  const hasMarks = markCount > 0;
  const hasProgress = !!progress && progress.total > 0;
  const progressDone = hasProgress && progress.seen >= progress.total;

  const restoreFocusWhenSafe = useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) {
        triggerRef.current?.focus();
      }
    });
  }, []);

  const close = useCallback((reason: TimerOverlayOpenReason) => {
    changeOpen(false, reason);
    if (controlledOpen === undefined) restoreFocusWhenSafe();
  }, [changeOpen, controlledOpen, restoreFocusWhenSafe]);

  usePopoverDismiss(open, close, panelRef, triggerRef);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (controlledOpen !== undefined && wasOpen && !open) restoreFocusWhenSafe();
  }, [controlledOpen, open, restoreFocusWhenSafe]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      (panel?.querySelector<HTMLElement>('a[href], button:not(:disabled)') ?? panel)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setGeometry(null);
      return;
    }
    const positionPanel = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
      const safeLeft = viewportLeft + VIEWPORT_MARGIN;
      const safeRight = viewportLeft + viewportWidth - VIEWPORT_MARGIN;
      const safeTop = viewportTop + VIEWPORT_MARGIN;
      const safeBottom = Math.max(
        safeTop,
        viewportTop + viewportHeight - VIEWPORT_MARGIN - Math.max(0, viewportBottomInset),
      );
      const anchor = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const safeWidth = Math.max(0, safeRight - safeLeft);
      const naturalWidth = panel.scrollWidth || panelRect.width || anchor.width;
      const width = Math.min(naturalWidth, safeWidth);
      const left = Math.min(
        Math.max(anchor.left + (anchor.width - width) / 2, safeLeft),
        Math.max(safeLeft, safeRight - width),
      );
      const belowTop = Math.max(anchor.bottom + PANEL_GAP, safeTop);
      const belowSpace = Math.max(0, safeBottom - belowTop);
      const aboveBottom = Math.min(anchor.top - PANEL_GAP, safeBottom);
      const aboveSpace = Math.max(0, aboveBottom - safeTop);
      const desiredHeight = panel.scrollHeight || panelRect.height;
      const placeBelow = belowSpace >= Math.min(desiredHeight, aboveSpace);
      const availableHeight = placeBelow ? belowSpace : aboveSpace;
      const maxHeight = Math.min(Math.max(0, desiredHeight), availableHeight);
      const top = placeBelow
        ? Math.max(safeTop, belowTop)
        : Math.max(safeTop, aboveBottom - maxHeight);
      setGeometry({ left, maxHeight, maxWidth: safeWidth, top });
    };

    positionPanel();
    const frame = requestAnimationFrame(positionPanel);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    window.visualViewport?.addEventListener('resize', positionPanel);
    window.visualViewport?.addEventListener('scroll', positionPanel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      window.visualViewport?.removeEventListener('resize', positionPanel);
      window.visualViewport?.removeEventListener('scroll', positionPanel);
    };
  }, [markCount, marks.length, open, viewportBottomInset]);

  const panelStyle = geometry ? {
    left: geometry.left,
    maxHeight: geometry.maxHeight,
    maxWidth: geometry.maxWidth,
    top: geometry.top,
    visibility: 'visible',
  } satisfies CSSProperties : undefined;

  const navigate = (
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    callback?: () => void,
  ) => {
    event.stopPropagation();
    close('select');
    if (!callback) return;
    event.preventDefault();
    callback();
  };

  if (!hasMarks && !hasProgress) return null;

  return (
    <>
      {hasMarks && (
        <span
          className="scramble-marks"
          data-no-timer
          onClick={(event) => event.stopPropagation()}
        >
          <button
            aria-controls={open ? panelId : undefined}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={`scramble-marks-chip${marked ? ' marked' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              changeOpen(!open, 'trigger');
            }}
            ref={triggerRef}
            title={labels.marksTitle}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={12} />
            {labels.marks(markCount)}
          </button>
          {open && typeof document !== 'undefined' && createPortal(
            <div
              aria-label={labels.marksTitle}
              className="scramble-marks-pop"
              data-no-timer
              id={panelId}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              ref={panelRef}
              role="dialog"
              style={panelStyle}
              tabIndex={-1}
            >
              <ul className="scramble-marks-list">
                {marks.map((mark) => (
                  <li key={mark.wcaId}>
                    {mark.country && (
                      <span aria-hidden="true" className="scramble-marks-flag">
                        <Flag
                          imgClassName="country-flag-ct"
                          iso2={mark.country}
                          spanClassName="country-flag"
                        />
                      </span>
                    )}
                    {mark.personHref ? (
                      <a
                        className="scramble-marks-name"
                        href={mark.personHref}
                        onClick={(event) => navigate(
                          event,
                          onNavigatePerson ? () => onNavigatePerson(mark) : undefined,
                        )}
                      >
                        {displayCuberName(mark.name, language === 'zh') || mark.wcaId}
                      </a>
                    ) : (
                      <span className="scramble-marks-name scramble-marks-name--static">
                        {displayCuberName(mark.name, language === 'zh') || mark.wcaId}
                      </span>
                    )}
                    {mark.timeLabel && (
                      <span className="scramble-marks-time">{mark.timeLabel}</span>
                    )}
                    <span className="scramble-marks-date">{mark.dateLabel}</span>
                  </li>
                ))}
              </ul>
              {(allMarksHref || onNavigateAllMarks) && (
                allMarksHref ? (
                  <a
                    className="scramble-marks-all"
                    href={allMarksHref}
                    onClick={(event) => navigate(event, onNavigateAllMarks)}
                  >
                    {labels.allMarks}
                  </a>
                ) : (
                  <button
                    className="scramble-marks-all"
                    onClick={(event) => navigate(event, onNavigateAllMarks)}
                    type="button"
                  >
                    {labels.allMarks}
                  </button>
                )
              )}
            </div>,
            document.body,
          )}
        </span>
      )}
      {hasProgress && (
        <span
          className={`scramble-pool-run${progressDone ? ' done' : ''}`}
          data-no-timer
          title={progressDone
            ? labels.allPracticedTitle(progress.total)
            : labels.practicedTitle(progress.seen, progress.total)}
        >
          {progressDone && <Repeat aria-hidden="true" size={12} />}
          {progressDone
            ? labels.allPracticed(progress.total)
            : labels.practiced(progress.seen, progress.total)}
        </span>
      )}
    </>
  );
}
