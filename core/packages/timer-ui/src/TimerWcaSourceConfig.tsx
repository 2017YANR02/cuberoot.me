import {
  searchTimerWcaCompetitions,
  timerWcaRoundGroupOptions,
  type TimerWcaCompetition,
  type TimerWcaScrambleSourceRow,
  type TimerWcaSourceCoreSettings,
  type TimerWcaSourceMode,
} from '@cuberoot/shared/timer';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';

export interface TimerWcaSourceLabels {
  all: string;
  clearCompetition: string;
  comp: string;
  competitionListFailed: string;
  competitionListLoading: string;
  competitionSearch: string;
  competitionScramblesFailed: string;
  competitionScramblesLoading: string;
  date: string;
  dateRange: string;
  group: string;
  groupOption(group: string): string;
  noEventScrambles: string;
  noMatchingCompetitions: string;
  retry: string;
  round: string;
  sourceMode: string;
}

export interface TimerWcaDateRangeRenderProps {
  ariaLabel: string;
  disabled: boolean;
  from: string;
  max: string;
  min: string;
  onChange(from: string, to: string): void;
  to: string;
}

export interface TimerWcaSourceDataAdapter {
  loadCompetitions(): Promise<readonly TimerWcaCompetition[]>;
  loadCompetitionScrambles(
    competitionId: string,
    signal?: AbortSignal,
  ): Promise<readonly TimerWcaScrambleSourceRow[] | null>;
}

export interface TimerWcaSourceConfigProps extends TimerOverlayControlProps {
  adapter: TimerWcaSourceDataAdapter;
  competitionDisplayName(competitionId: string, canonicalName: string): string;
  disabled?: boolean;
  labels: TimerWcaSourceLabels;
  maxDate: string;
  minDate: string;
  onChange(patch: Partial<TimerWcaSourceCoreSettings>): void;
  renderCountry(country: string): ReactNode;
  renderDateRange(props: TimerWcaDateRangeRenderProps): ReactNode;
  roundLabel(roundTypeId: string): string;
  settings: TimerWcaSourceCoreSettings;
  trailingControls?: ReactNode;
  wcaEventId: string | null | undefined;
}

function ClearCompetitionButton({
  ariaLabel,
  buttonRef,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onClick(): void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="timer-wca-clear"
      disabled={disabled}
      onClick={onClick}
      ref={buttonRef}
      title={ariaLabel}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 10 10">
        <path d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4" />
      </svg>
    </button>
  );
}

const POPUP_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const PREFERRED_POPUP_WIDTH_PX = 260;
const MAX_POPUP_WIDTH_PX = 480;

interface VisibleRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function viewportRect(): VisibleRect {
  const visualViewport = window.visualViewport;
  const fallbackWidth = document.documentElement.clientWidth || window.innerWidth;
  const fallbackHeight = document.documentElement.clientHeight || window.innerHeight;
  const width = visualViewport && visualViewport.width > 0
    ? visualViewport.width
    : fallbackWidth;
  const height = visualViewport && visualViewport.height > 0
    ? visualViewport.height
    : fallbackHeight;
  const left = visualViewport?.offsetLeft ?? 0;
  const top = visualViewport?.offsetTop ?? 0;
  return { bottom: top + height, left, right: left + width, top };
}

function clipsAxis(value: string): boolean {
  return /(?:auto|clip|hidden|scroll)/.test(value);
}

/**
 * A body portal escapes overflow ancestors, but their visible rectangle is
 * still part of the product layout contract (notably Mobile's scrolling timer
 * row above the bottom navigation). Intersect those ancestors so the portal
 * cannot cover chrome that the anchor itself is clipped below.
 */
function visibleRectForAnchor(anchor: HTMLElement): VisibleRect {
  const visible = viewportRect();
  for (let element = anchor.parentElement; element; element = element.parentElement) {
    if (element === document.body || element === document.documentElement) continue;
    const style = window.getComputedStyle(element);
    const clipX = clipsAxis(`${style.overflow} ${style.overflowX}`);
    const clipY = clipsAxis(`${style.overflow} ${style.overflowY}`);
    if (!clipX && !clipY) continue;
    const rect = element.getBoundingClientRect();
    // jsdom and display:none ancestors report a zero rectangle. A visible
    // browser clipping ancestor always has a positive extent.
    if (clipX && rect.width > 0) {
      visible.left = Math.max(visible.left, rect.left);
      visible.right = Math.min(visible.right, rect.right);
    }
    if (clipY && rect.height > 0) {
      visible.top = Math.max(visible.top, rect.top);
      visible.bottom = Math.min(visible.bottom, rect.bottom);
    }
  }
  return visible;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function TimerWcaSourceConfig({
  adapter,
  competitionDisplayName,
  disabled = false,
  labels,
  maxDate,
  minDate,
  onChange,
  onOpenChange,
  open: controlledOpen,
  renderCountry,
  renderDateRange,
  roundLabel,
  settings,
  trailingControls,
  wcaEventId,
}: TimerWcaSourceConfigProps) {
  const [competitions, setCompetitions] = useState<readonly TimerWcaCompetition[] | null>(null);
  const [competitionListStatus, setCompetitionListStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [suggestionsOpen, changeSuggestionsOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.wcaCompetition,
    onOpenChange,
    open: controlledOpen,
  });
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [competitionRows, setCompetitionRows] = useState<readonly TimerWcaScrambleSourceRow[] | null>(null);
  const [competitionRowsStatus, setCompetitionRowsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [competitionRowsRetry, setCompetitionRowsRetry] = useState(0);
  const competitionListRequestRef = useRef(0);
  const competitionListPromiseRef = useRef<{
    adapter: TimerWcaSourceDataAdapter;
    promise: Promise<readonly TimerWcaCompetition[]>;
  } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedClearRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const previousSuggestionsOpenRef = useRef(suggestionsOpen);
  const popupId = useId();
  const noMatchesId = `${popupId}-empty`;
  const mode = settings.wcaScrambleMode;

  const focusAfterRender = useCallback((target: 'input' | 'selected-clear') => {
    requestAnimationFrame(() => {
      if (target === 'input') inputRef.current?.focus();
      else selectedClearRef.current?.focus();
    });
  }, []);

  const closeSuggestions = useCallback((
    reason: TimerOverlayOpenReason,
    restoreInputFocus = false,
  ) => {
    changeSuggestionsOpen(false, reason);
    setActiveSuggestionIndex(-1);
    if (restoreInputFocus) focusAfterRender('input');
  }, [changeSuggestionsOpen, focusAfterRender]);

  useEffect(() => {
    const wasOpen = previousSuggestionsOpenRef.current;
    previousSuggestionsOpenRef.current = suggestionsOpen;
    if (controlledOpen !== undefined && wasOpen && !suggestionsOpen) {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body || popupRef.current?.contains(active)) {
          inputRef.current?.focus();
        }
      });
    }
  }, [controlledOpen, suggestionsOpen]);

  const ensureCompetitions = useCallback(async () => {
    if (competitions) return competitions;
    const pending = competitionListPromiseRef.current;
    if (pending?.adapter === adapter) return pending.promise;

    const request = ++competitionListRequestRef.current;
    let promise!: Promise<readonly TimerWcaCompetition[]>;
    promise = (async () => {
      setCompetitionListStatus('loading');
      try {
        const loaded = await adapter.loadCompetitions();
        if (competitionListRequestRef.current === request) {
          setCompetitions(loaded);
          setCompetitionListStatus('idle');
        }
        return loaded;
      } catch (error) {
        if (competitionListRequestRef.current === request) {
          setCompetitionListStatus('error');
        }
        throw error;
      } finally {
        if (competitionListPromiseRef.current?.promise === promise) {
          competitionListPromiseRef.current = null;
        }
      }
    })();
    competitionListPromiseRef.current = { adapter, promise };
    return promise;
  }, [adapter, competitions]);

  useEffect(() => {
    // Competition names/cities are localized by the host adapter. Treat a new
    // adapter as a new cache identity, and invalidate any unresolved request so
    // a language switch cannot repopulate the list with the previous locale.
    competitionListRequestRef.current += 1;
    competitionListPromiseRef.current = null;
    setCompetitions(null);
    setCompetitionListStatus('idle');
    closeSuggestions('data-change');
  }, [adapter, closeSuggestions]);

  useEffect(() => {
    if (disabled || mode !== 'comp' || settings.wcaComp) {
      closeSuggestions(disabled ? 'disabled' : 'data-change');
    }
  }, [closeSuggestions, disabled, mode, settings.wcaComp]);

  useEffect(() => {
    if (mode === 'comp' && settings.wcaComp && competitions === null) {
      void ensureCompetitions().catch(() => undefined);
    }
  }, [competitions, ensureCompetitions, mode, settings.wcaComp]);

  useEffect(() => {
    if (mode !== 'comp' || !settings.wcaComp || !wcaEventId) {
      setCompetitionRows(null);
      setCompetitionRowsStatus('idle');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setCompetitionRows(null);
    setCompetitionRowsStatus('loading');
    void adapter.loadCompetitionScrambles(settings.wcaComp, controller.signal).then((rows) => {
      if (cancelled) return;
      setCompetitionRows(rows);
      setCompetitionRowsStatus(rows === null ? 'error' : 'ready');
    }).catch(() => {
      if (!cancelled) {
        setCompetitionRows(null);
        setCompetitionRowsStatus('error');
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [adapter, competitionRowsRetry, mode, settings.wcaComp, wcaEventId]);

  const options = useMemo(() => timerWcaRoundGroupOptions(
    competitionRows,
    wcaEventId,
    settings.wcaRound,
  ), [competitionRows, settings.wcaRound, wcaEventId]);

  useEffect(() => {
    if (settings.wcaRound && options.rounds.length > 0
      && !options.rounds.includes(settings.wcaRound)) {
      onChange({ wcaRound: '', wcaGroup: '' });
    }
  }, [onChange, options.rounds, settings.wcaRound]);

  useEffect(() => {
    if (settings.wcaGroup && options.groups.length > 0
      && !options.groups.includes(settings.wcaGroup)) {
      onChange({ wcaGroup: '' });
    }
  }, [onChange, options.groups, settings.wcaGroup]);

  const suggestions = useMemo(() => {
    if (!settings.wcaCompName.trim() || !competitions) return [];
    return searchTimerWcaCompetitions(
      settings.wcaCompName,
      competitions.filter((competition) => !competition.startDate || competition.startDate <= maxDate),
    );
  }, [competitions, maxDate, settings.wcaCompName]);
  const selectedCompetition = useMemo(
    () => competitions?.find((competition) => competition.id === settings.wcaComp),
    [competitions, settings.wcaComp],
  );
  const hasSearchQuery = settings.wcaCompName.trim().length > 0;
  const popupVisible = suggestionsOpen && hasSearchQuery && suggestions.length > 0;
  const noMatchesVisible = suggestionsOpen
    && hasSearchQuery
    && competitions !== null
    && competitionListStatus === 'idle'
    && suggestions.length === 0;

  const optionId = useCallback((index: number) => `${popupId}-option-${index}`, [popupId]);

  useEffect(() => {
    if (!popupVisible) {
      if (activeSuggestionIndex !== -1) setActiveSuggestionIndex(-1);
      return;
    }
    if (activeSuggestionIndex >= suggestions.length) setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, popupVisible, suggestions.length]);

  useLayoutEffect(() => {
    if (!popupVisible || activeSuggestionIndex < 0) return;
    document.getElementById(optionId(activeSuggestionIndex))?.scrollIntoView?.({ block: 'nearest' });
  }, [activeSuggestionIndex, optionId, popupVisible]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const inside = (target: Node | null) => !!target && (
      !!wrapRef.current?.contains(target) || !!popupRef.current?.contains(target)
    );
    const dismiss = (event: PointerEvent) => {
      if (!inside(event.target as Node)) closeSuggestions('outside');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSuggestions('escape', true);
    };
    const dismissFocus = (event: FocusEvent) => {
      if (!inside(event.target as Node)) closeSuggestions('focus-out');
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', dismissFocus);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', dismissFocus);
    };
  }, [closeSuggestions, suggestionsOpen]);

  useLayoutEffect(() => {
    const popup = popupRef.current;
    const wrap = wrapRef.current;
    if (!popupVisible || !popup || !wrap) return;
    const position = () => {
      popup.style.visibility = 'hidden';
      popup.style.maxHeight = 'none';
      const wrapRect = wrap.getBoundingClientRect();
      const visible = visibleRectForAnchor(wrap);
      const visibleWidth = Math.max(0, visible.right - visible.left);
      const visibleHeight = Math.max(0, visible.bottom - visible.top);
      const horizontalMargin = Math.min(VIEWPORT_MARGIN_PX, visibleWidth / 4);
      const verticalMargin = Math.min(VIEWPORT_MARGIN_PX, visibleHeight / 4);
      const leftBound = visible.left + horizontalMargin;
      const rightBound = visible.right - horizontalMargin;
      const topBound = visible.top + verticalMargin;
      const bottomBound = visible.bottom - verticalMargin;
      const availableWidth = Math.max(0, rightBound - leftBound);
      const width = Math.min(
        MAX_POPUP_WIDTH_PX,
        Math.max(wrapRect.width, PREFERRED_POPUP_WIDTH_PX),
        availableWidth,
      );
      popup.style.width = `${width}px`;
      popup.style.maxWidth = `${width}px`;
      popup.style.left = `${clamp(wrapRect.left, leftBound, rightBound - width)}px`;

      const belowTop = clamp(wrapRect.bottom + POPUP_GAP_PX, topBound, bottomBound);
      const aboveBottom = clamp(wrapRect.top - POPUP_GAP_PX, topBound, bottomBound);
      const spaceBelow = Math.max(0, bottomBound - belowTop);
      const spaceAbove = Math.max(0, aboveBottom - topBound);
      const naturalHeight = popup.scrollHeight;
      const preferredHeight = naturalHeight > 0 ? Math.min(180, naturalHeight) : 180;
      const openAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const maxHeight = openAbove ? spaceAbove : spaceBelow;
      popup.style.maxHeight = `${maxHeight}px`;
      const renderedHeight = Math.min(naturalHeight || maxHeight, maxHeight);
      popup.style.top = `${openAbove ? aboveBottom - renderedHeight : belowTop}px`;
      popup.style.visibility = 'visible';
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [popupVisible, suggestions.length]);

  const clearCompetition = () => onChange({
    wcaComp: '',
    wcaCompName: '',
    wcaCompCountry: '',
    wcaRound: '',
    wcaGroup: '',
  });

  const chooseCompetition = (competition: TimerWcaCompetition) => {
    onChange({
      wcaComp: competition.id,
      wcaCompName: competition.name,
      wcaCompCountry: competition.country,
      wcaRound: '',
      wcaGroup: '',
    });
    closeSuggestions('select');
    focusAfterRender('selected-clear');
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && suggestionsOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeSuggestions('escape', true);
      return;
    }
    if (event.key === 'Enter') {
      const competition = suggestions[activeSuggestionIndex];
      if (popupVisible && competition) {
        event.preventDefault();
        chooseCompetition(competition);
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    changeSuggestionsOpen(true, 'keyboard');
    void ensureCompetitions().catch(() => undefined);
    if (suggestions.length === 0) return;
    setActiveSuggestionIndex((current) => {
      if (event.key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % suggestions.length;
      return current < 0 ? suggestions.length - 1 : (current - 1 + suggestions.length) % suggestions.length;
    });
  };

  return (
    <div className="timer-wca-source-config">
      <div className="timer-wca-source-toprow">
        <select
          aria-label={labels.sourceMode}
          className="timer-wca-source-select"
          disabled={disabled}
          onChange={(event) => onChange({
            wcaScrambleMode: event.target.value as TimerWcaSourceMode,
          })}
          value={mode}
        >
          <option value="comp">{labels.comp}</option>
          <option value="date">{labels.date}</option>
        </select>
        {mode === 'date' && renderDateRange({
          ariaLabel: labels.dateRange,
          disabled,
          from: settings.wcaDateFrom,
          max: maxDate,
          min: minDate,
          onChange: (wcaDateFrom, wcaDateTo) => onChange({ wcaDateFrom, wcaDateTo }),
          to: settings.wcaDateTo,
        })}
        {mode === 'comp' && (
          <span
            className={`timer-wca-competition${settings.wcaComp ? ' is-picked' : ''}`}
            ref={wrapRef}
          >
            {settings.wcaComp ? (
              <span className="timer-wca-competition-selected">
                <span className="timer-wca-competition-flag">{renderCountry(settings.wcaCompCountry)}</span>
                <span className="timer-wca-competition-name">
                  {selectedCompetition?.selectedDisplayName ?? competitionDisplayName(
                    settings.wcaComp,
                    settings.wcaCompName || settings.wcaComp,
                  )}
                </span>
                <ClearCompetitionButton
                  ariaLabel={labels.clearCompetition}
                  buttonRef={selectedClearRef}
                  disabled={disabled}
                  onClick={() => {
                    clearCompetition();
                    focusAfterRender('input');
                  }}
                />
              </span>
            ) : (
              <>
                <input
                  aria-activedescendant={popupVisible && activeSuggestionIndex >= 0
                    ? optionId(activeSuggestionIndex)
                    : undefined}
                  aria-autocomplete="list"
                  aria-busy={competitionListStatus === 'loading'}
                  aria-controls={popupVisible ? popupId : undefined}
                  aria-describedby={noMatchesVisible ? noMatchesId : undefined}
                  aria-expanded={popupVisible}
                  aria-haspopup="listbox"
                  aria-label={labels.competitionSearch}
                  autoComplete="off"
                  className="timer-wca-competition-input"
                  disabled={disabled}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) clearCompetition();
                    else onChange({ wcaCompName: value });
                    setActiveSuggestionIndex(-1);
                    changeSuggestionsOpen(true, 'input');
                  }}
                  onFocus={() => {
                    changeSuggestionsOpen(true, 'focus');
                    void ensureCompetitions().catch(() => undefined);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={labels.competitionSearch}
                  ref={inputRef}
                  role="combobox"
                  type="search"
                  value={settings.wcaCompName}
                />
                {settings.wcaCompName && (
                  <ClearCompetitionButton
                    ariaLabel={labels.clearCompetition}
                    disabled={disabled}
                    onClick={() => {
                      clearCompetition();
                      closeSuggestions('clear');
                      focusAfterRender('input');
                    }}
                  />
                )}
                {popupVisible && createPortal(
                  <div
                    aria-label={labels.competitionSearch}
                    className="timer-wca-competition-popup"
                    data-no-timer
                    id={popupId}
                    ref={popupRef}
                    role="listbox"
                  >
                    {suggestions.map((competition, index) => {
                      const active = index === activeSuggestionIndex;
                      return (
                        <button
                          aria-selected={active}
                          className={`timer-wca-competition-option${active ? ' is-active' : ''}`}
                          id={optionId(index)}
                          key={competition.id}
                          onClick={() => chooseCompetition(competition)}
                          onPointerEnter={() => setActiveSuggestionIndex(index)}
                          role="option"
                          tabIndex={-1}
                          type="button"
                        >
                          <span className="timer-wca-competition-flag">{renderCountry(competition.country)}</span>
                          <span className="timer-wca-competition-option-main">
                            <span className="timer-wca-competition-option-name">
                              {competition.displayName || competition.name}
                            </span>
                            <span className="timer-wca-competition-option-meta">
                              {competition.id}
                              {competition.displayCity || competition.city
                                ? ` · ${competition.displayCity || competition.city}`
                                : ''}
                              {competition.startDate
                                ? ` · ${formatDateRangeIso(competition.startDate, competition.endDate)}`
                                : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>,
                  document.body,
                )}
              </>
            )}
          </span>
        )}
        {trailingControls}
      </div>

      {mode === 'comp' && !settings.wcaComp && competitionListStatus === 'loading' && (
        <p className="timer-wca-source-hint" role="status">{labels.competitionListLoading}</p>
      )}
      {mode === 'comp' && !settings.wcaComp && competitionListStatus === 'error' && (
        <p className="timer-wca-source-hint is-warning" role="alert">
          {labels.competitionListFailed}{' '}
          <button
            className="timer-wca-source-retry"
            disabled={disabled}
            onClick={() => void ensureCompetitions().catch(() => undefined)}
            type="button"
          >{labels.retry}</button>
        </p>
      )}
      {mode === 'comp' && settings.wcaComp && competitionListStatus === 'error' && (
        <p className="timer-wca-source-hint is-warning" role="alert">
          {labels.competitionListFailed}{' '}
          <button
            className="timer-wca-source-retry"
            disabled={disabled}
            onClick={() => void ensureCompetitions().catch(() => undefined)}
            type="button"
          >{labels.retry}</button>
        </p>
      )}
      {mode === 'comp' && !settings.wcaComp && noMatchesVisible && (
          <p
            aria-live="polite"
            className="timer-wca-source-hint"
            id={noMatchesId}
            role="status"
          >{labels.noMatchingCompetitions}</p>
        )}

      {mode === 'comp' && settings.wcaComp && competitionRowsStatus === 'loading' && (
        <p className="timer-wca-source-hint" role="status">
          {labels.competitionScramblesLoading}
        </p>
      )}
      {mode === 'comp' && settings.wcaComp && competitionRowsStatus === 'error' && (
        <p className="timer-wca-source-hint is-warning" role="alert">
          {labels.competitionScramblesFailed}{' '}
          <button
            className="timer-wca-source-retry"
            disabled={disabled}
            onClick={() => setCompetitionRowsRetry((value) => value + 1)}
            type="button"
          >{labels.retry}</button>
        </p>
      )}

      {mode === 'comp' && settings.wcaComp && options.hasEvent === false && (
        <p className="timer-wca-source-hint is-warning">{labels.noEventScrambles}</p>
      )}

      {mode === 'comp' && settings.wcaComp && options.hasEvent && (
        <div className="timer-wca-round-groups">
          <label>
            <span>{labels.round}</span>
            <select
              aria-label={labels.round}
              disabled={disabled}
              onChange={(event) => onChange({ wcaRound: event.target.value, wcaGroup: '' })}
              value={settings.wcaRound}
            >
              <option value="">{labels.all}</option>
              {options.rounds.map((round) => (
                <option key={round} value={round}>{roundLabel(round)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{labels.group}</span>
            <select
              aria-label={labels.group}
              disabled={disabled || options.groups.length === 0}
              onChange={(event) => onChange({ wcaGroup: event.target.value })}
              value={settings.wcaGroup}
            >
              <option value="">{labels.all}</option>
              {options.groups.map((group) => (
                <option key={group} value={group}>{labels.groupOption(group)}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
