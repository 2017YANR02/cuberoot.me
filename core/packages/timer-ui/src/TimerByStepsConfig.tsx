import {
  stepMetricsFor,
  timerByStepsNormalizationPatch,
  timerByStepsSelection,
  type TimerByStepsSettings,
  type TimerByStepsSource,
} from '@cuberoot/shared/timer';
import { useEffect, type ReactNode } from 'react';
import { TimerPillToggle } from './TimerPillToggle';
import { TimerRangeSlider } from './TimerRangeSlider';

export interface TimerByStepsLabels {
  bySteps: string;
  byStepsAriaLabel: string;
  metricAriaLabel: string;
  metricOptions: Readonly<Record<string, string>>;
  stepRangeAriaLabel: string;
}

export interface TimerByStepsConfigProps {
  disabled?: boolean;
  event: string;
  /** Optional source-specific controls rendered on the same top row. */
  extraTopRow?: ReactNode;
  labels: TimerByStepsLabels;
  onChange: (patch: Partial<TimerByStepsSettings>) => void;
  settings: TimerByStepsSettings;
  source: TimerByStepsSource;
}

/** Controlled by-steps configuration shared verbatim by Web, Android and iOS. */
export function TimerByStepsConfig({
  disabled = false,
  event,
  extraTopRow,
  labels,
  onChange,
  settings,
  source,
}: TimerByStepsConfigProps) {
  const metrics = stepMetricsFor(event);
  const selection = timerByStepsSelection(event, source, settings);
  const settingsSignature = `${settings.genByStepsOn}|${settings.genStepsMetric}|${settings.genSteps.join('.')}`;

  useEffect(() => {
    const patch = timerByStepsNormalizationPatch(event, source, settings);
    if (patch) onChange(patch);
    // A primitive signature keeps controlled arrays from retriggering this
    // effect when a host recreates an equivalent settings object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, source, settingsSignature]);

  if (!metrics || !selection) return null;

  return (
    <div className="timer-by-steps-config wca-src-config">
      <div className="timer-by-steps-top-row settings-row wca-src-toprow">
        {extraTopRow}
        <span className="timer-by-steps-toggle-group settings-row-tight-group">
          <span className="timer-by-steps-label settings-row-label">{labels.bySteps}</span>
          <TimerPillToggle
            ariaLabel={labels.byStepsAriaLabel}
            disabled={disabled}
            onChange={(genByStepsOn) => onChange({ genByStepsOn })}
            value={settings.genByStepsOn}
          />
        </span>
        {settings.genByStepsOn && (
          <select
            aria-label={labels.metricAriaLabel}
            className="timer-by-steps-metric settings-row-control-select"
            disabled={disabled}
            onChange={(changeEvent) => onChange({
              genStepsMetric: changeEvent.target.value,
              genSteps: [],
            })}
            value={selection.metric}
          >
            {metrics.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {labels.metricOptions[metric.key] ?? metric.key}
              </option>
            ))}
          </select>
        )}
      </div>
      {settings.genByStepsOn && (
        <div className="timer-by-steps-range wca-src-steps-range">
          <TimerRangeSlider
            ariaLabel={labels.stepRangeAriaLabel}
            disabled={disabled}
            marks={Array.from(
              { length: selection.max - selection.min + 1 },
              (_, index) => selection.min + index,
            )}
            max={selection.max}
            min={selection.min}
            onChange={([lo, hi]) => onChange({
              genSteps: Array.from({ length: hi - lo + 1 }, (_, index) => lo + index),
            })}
            value={[selection.lo, selection.hi]}
          />
        </div>
      )}
    </div>
  );
}
