import {
  TIMER_HISTORY_TAG_DEFS,
  TIMER_HISTORY_TAG_IDS,
  type TimerHistoryTagId,
  type RollingStatKey,
} from '@cuberoot/shared/timer';

export type TimerHistoryTagLanguage = 'en' | 'zh';

export interface TimerHistoryTagBadgesProps {
  hiddenTagIds?: ReadonlySet<TimerHistoryTagId>;
  language: TimerHistoryTagLanguage;
  rollingColumns?: readonly RollingStatKey[];
  tagIds: readonly TimerHistoryTagId[];
}

const RESULT_REDUNDANT_TAGS = new Set<TimerHistoryTagId>(['dnf', 'dns', 'plus2']);

export function TimerHistoryTagBadges({
  hiddenTagIds = new Set(),
  language,
  rollingColumns = [],
  tagIds,
}: TimerHistoryTagBadgesProps) {
  const hidden = new Set(hiddenTagIds);
  if (rollingColumns.includes('ao5')) hidden.add('pb-ao5');
  if (rollingColumns.includes('ao12')) hidden.add('pb-ao12');
  const selected = new Set(tagIds);
  const visible = TIMER_HISTORY_TAG_IDS.filter(
    tagId => selected.has(tagId) && !RESULT_REDUNDANT_TAGS.has(tagId) && !hidden.has(tagId),
  );
  if (visible.length === 0) return null;
  const overflow = visible.length - 2;
  const fullLabel = visible.map(tagId => TIMER_HISTORY_TAG_DEFS[tagId].label[language]).join(', ');

  return (
    <span
      aria-label={fullLabel}
      className="timer-history-tag-badges"
      role="group"
      title={fullLabel}
    >
      {visible.map((tagId) => {
        const definition = TIMER_HISTORY_TAG_DEFS[tagId];
        return (
          <span
            aria-hidden="true"
            className="timer-history-tag timer-history-tag-item"
            data-tag-id={tagId}
            data-tone={definition.tone}
            key={tagId}
          >
            {definition.label[language]}
          </span>
        );
      })}
      {overflow > 0 && (
        <span aria-hidden="true" className="timer-history-tag timer-history-tag-overflow" data-tone="muted" title={fullLabel}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

export interface TimerHistoryTagFilterProps {
  language: TimerHistoryTagLanguage;
  legend: string;
  onToggle: (tagId: TimerHistoryTagId) => void;
  selected: ReadonlySet<TimerHistoryTagId>;
}

export function TimerHistoryTagFilter({
  language,
  legend,
  onToggle,
  selected,
}: TimerHistoryTagFilterProps) {
  return (
    <fieldset className="timer-history-tag-filter">
      <legend>{legend}</legend>
      <div className="timer-history-tag-filter-options">
        {TIMER_HISTORY_TAG_IDS.map((tagId) => (
          <button
            aria-pressed={selected.has(tagId)}
            className="timer-history-tag-filter-option"
            data-history-tag-id={tagId}
            key={tagId}
            onClick={() => onToggle(tagId)}
            type="button"
          >
            {TIMER_HISTORY_TAG_DEFS[tagId].label[language]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
