import {
  normalizeTimerWcaDifficultySettings,
  reconcileTimerWcaDifficultySettings,
  timerColorSubsetOption,
  timerInclusiveRange,
  timerWcaDifficultyUiModel,
  timerWcaSupportsDifficulty,
  type TimerWcaDifficultyCatalog,
  type TimerWcaDifficultyCoverage,
  type TimerWcaDifficultyDataAdapter,
  type TimerWcaDifficultySettings,
} from '@cuberoot/shared/timer';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { TimerPillToggle } from './TimerPillToggle';
import { SubsetColorPicker, type TimerUiLanguage } from './TimerColorSubsetPicker';
import { TimerRangeSlider } from './TimerRangeSlider';

export interface TimerWcaDifficultyLabels {
  colorSubsetAriaLabel: string;
  difficulty: string;
  difficultyAriaLabel: string;
  merge: string;
  mergeAriaLabel: string;
  mergeHelp: string;
  methodAriaLabel: string;
  methodLabel(key: string): string;
  rangeAriaLabel: string;
  scrambleLengthRangeAriaLabel: string;
  stageAriaLabel: string;
  stageLabel(key: string): string;
  unindexedCompetition: string;
}

export interface TimerWcaDifficultyConfigProps {
  adapter: TimerWcaDifficultyDataAdapter;
  disabled?: boolean;
  language: TimerUiLanguage;
  labels: TimerWcaDifficultyLabels;
  /** Reports the exact coverage state used by pool identity/filtering. */
  onCoverageChange?(coverage: TimerWcaDifficultyCoverage): void;
  onChange(patch: Partial<TimerWcaDifficultySettings>): void;
  settings: TimerWcaDifficultySettings & {
    wcaComp: string;
    wcaCompName: string;
    wcaScrambleMode: 'date' | 'comp';
  };
  /** Optional source-row destination for Merge + Difficulty controls. */
  topControlsSlot?: HTMLElement | null;
  /** Optional timer-topbar destination for Difficulty only. */
  toggleSlot?: HTMLElement | null;
  wcaEventId: string | null | undefined;
}

const EMPTY_CATALOG: TimerWcaDifficultyCatalog = {
  distribution: null,
  eventLengths: null,
  layout: null,
};

/** Complete WCA difficulty UI/normalization shared verbatim by every timer host. */
export function TimerWcaDifficultyConfig({
  adapter,
  disabled = false,
  language,
  labels,
  onChange,
  onCoverageChange,
  settings,
  topControlsSlot,
  toggleSlot,
  wcaEventId,
}: TimerWcaDifficultyConfigProps) {
  const [catalog, setCatalog] = useState<TimerWcaDifficultyCatalog>(EMPTY_CATALOG);
  const [coverage, setCoverage] = useState<TimerWcaDifficultyCoverage>('idle');
  const [showUnindexedReason, setShowUnindexedReason] = useState(false);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  const rangeRef = useRef<{ pending: [number, number] | null; timer: number | null }>({
    pending: null,
    timer: null,
  });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const normalized = normalizeTimerWcaDifficultySettings(settings);

  useEffect(() => {
    let current = true;
    setCatalog(EMPTY_CATALOG);
    void adapter.loadCatalog().then((value) => {
      if (current) setCatalog(value);
    });
    return () => { current = false; };
  }, [adapter]);

  useEffect(() => {
    let current = true;
    setShowUnindexedReason(false);
    if (settings.wcaScrambleMode !== 'comp'
      || !settings.wcaComp
      || !wcaEventId
      || !timerWcaSupportsDifficulty(wcaEventId)) {
      setCoverage('idle');
      return () => { current = false; };
    }
    const cached = adapter.getCompetitionCoverage(settings.wcaComp, wcaEventId);
    if (cached !== null) {
      setCoverage(cached ? 'indexed' : 'unindexed');
      return () => { current = false; };
    }
    setCoverage('loading');
    void adapter.probeCompetitionCoverage(
      settings.wcaComp,
      settings.wcaCompName,
      wcaEventId,
    ).then((value) => {
      if (!current) return;
      setCoverage(value === true ? 'indexed' : value === false ? 'unindexed' : 'unknown');
    });
    return () => { current = false; };
  }, [adapter, settings.wcaComp, settings.wcaCompName, settings.wcaScrambleMode, wcaEventId]);

  useEffect(() => { onCoverageChange?.(coverage); }, [coverage, onCoverageChange]);

  const model = useMemo(() => timerWcaDifficultyUiModel(
    wcaEventId,
    normalized,
    catalog,
    coverage,
  ), [catalog, coverage, normalized, wcaEventId]);
  const modelSignature = JSON.stringify([
    model.canDifficulty,
    model.dataVariant,
    model.dataStage,
    model.selectedRange,
    model.stepMin,
    model.stepMax,
  ]);
  const settingsSignature = JSON.stringify([
    normalized.wcaDifficultyOn,
    normalized.wcaDiffVariant,
    normalized.wcaDiffStage,
    normalized.wcaDiffColors,
    normalized.wcaDiffSteps,
    normalized.wcaDiffMerged,
  ]);

  useEffect(() => {
    const patch = reconcileTimerWcaDifficultySettings(normalized, model);
    if (Object.keys(patch).length) onChange(patch);
    // Primitive signatures prevent a host-created settings object from
    // retriggering normalization with no semantic change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSignature, settingsSignature]);

  useEffect(() => () => {
    const state = rangeRef.current;
    if (state.timer !== null) window.clearTimeout(state.timer);
    if (state.pending) onChangeRef.current({
      wcaDiffSteps: timerInclusiveRange(state.pending[0], state.pending[1]),
    });
  }, []);

  if (!model.canDifficulty) return null;

  const colorOption = timerColorSubsetOption(normalized.wcaDiffColors);

  const commitRange = (range: [number, number]) => {
    setDragRange(range);
    const state = rangeRef.current;
    state.pending = range;
    if (state.timer !== null) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.pending = null;
      state.timer = null;
      setDragRange(null);
      onChange({ wcaDiffSteps: timerInclusiveRange(range[0], range[1]) });
    }, 350);
  };

  const difficultyToggle = (
    <span className="timer-wca-difficulty-control settings-row-tight-group">
      <span className="timer-wca-difficulty-label settings-row-label">{labels.difficulty}</span>
      <TimerPillToggle
        ariaLabel={labels.difficultyAriaLabel}
        disabled={disabled}
        onChange={(value) => {
          if (model.locked) {
            setShowUnindexedReason(true);
            return;
          }
          onChange({ wcaDifficultyOn: value });
        }}
        value={!model.locked && normalized.wcaDifficultyOn}
      />
    </span>
  );
  const mergeControl = model.canMerge && normalized.wcaDifficultyOn && !model.locked ? (
    <span className="timer-wca-difficulty-control settings-row-tight-group">
      <span className="timer-wca-difficulty-label settings-row-label">
        {labels.merge}
        <span aria-label={labels.mergeHelp} className="timer-wca-difficulty-help" role="img" title={labels.mergeHelp}>?</span>
      </span>
      <TimerPillToggle
        ariaLabel={labels.mergeAriaLabel}
        disabled={disabled}
        onChange={(wcaDiffMerged) => onChange({ wcaDiffMerged })}
        value={normalized.wcaDiffMerged}
      />
    </span>
  ) : null;
  const localControls: ReactNode = (
    <div className="timer-wca-difficulty-top-row">
      {mergeControl}
      {!toggleSlot && difficultyToggle}
    </div>
  );

  return (
    <div className="timer-wca-difficulty-config">
      {topControlsSlot ? createPortal(<>{mergeControl}{!toggleSlot && difficultyToggle}</>, topControlsSlot) : localControls}
      {toggleSlot && createPortal(difficultyToggle, toggleSlot)}
      {model.locked && showUnindexedReason && (
        <p className="timer-wca-difficulty-warning" role="status">{labels.unindexedCompetition}</p>
      )}
      {normalized.wcaDifficultyOn && !model.locked && (
        <div className="timer-wca-difficulty-body">
          <div className="timer-wca-difficulty-options">
            {model.showColors && (
              <SubsetColorPicker
                ariaLabel={labels.colorSubsetAriaLabel}
                disabled={disabled}
                language={language}
                sel={{
                  colorMode: colorOption.mode,
                  selectByKey: (wcaDiffColors) => onChange({ wcaDiffColors }),
                  selectedColors: [...colorOption.colors],
                  subsetKey: colorOption.key,
                }}
              />
            )}
            <select
              aria-label={labels.methodAriaLabel}
              className="timer-wca-difficulty-select"
              disabled={disabled}
              onChange={(event) => {
                const nextUiVariant = event.target.value;
                const nextStage = model.stageOptions[0]
                  ?? timerWcaDifficultyUiModel(wcaEventId, {
                    ...normalized,
                    wcaDiffVariant: nextUiVariant,
                  }, catalog, coverage).stageOptions[0];
                if (!nextStage) return;
                const next = timerWcaDifficultyUiModel(wcaEventId, {
                  ...normalized,
                  wcaDiffVariant: nextUiVariant,
                  wcaDiffStage: nextStage,
                }, catalog, coverage);
                onChange({ wcaDiffVariant: next.dataVariant, wcaDiffStage: next.dataStage });
              }}
              value={model.uiVariant}
            >
              {model.variantOptions.map((option) => (
                <option key={option} value={option}>{labels.methodLabel(option)}</option>
              ))}
            </select>
            {model.showStage && (
              <select
                aria-label={labels.stageAriaLabel}
                className="timer-wca-difficulty-select"
                disabled={disabled}
                onChange={(event) => {
                  const next = timerWcaDifficultyUiModel(wcaEventId, {
                    ...normalized,
                    wcaDiffVariant: model.uiVariant,
                    wcaDiffStage: event.target.value,
                  }, catalog, coverage);
                  onChange({ wcaDiffVariant: next.dataVariant, wcaDiffStage: next.dataStage });
                }}
                value={model.dataStage}
              >
                {model.stageOptions.map((option) => (
                  <option key={option} value={option}>{labels.stageLabel(option)}</option>
                ))}
              </select>
            )}
          </div>
          <div className="timer-wca-difficulty-range">
            <TimerRangeSlider
              ariaLabel={model.isLength
                ? labels.scrambleLengthRangeAriaLabel
                : labels.rangeAriaLabel}
              disabled={disabled}
              marks={model.marks}
              max={model.stepMax}
              min={model.stepMin}
              onChange={commitRange}
              value={dragRange ?? [...model.selectedRange]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
