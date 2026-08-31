'use client';

/** Thin Web settings adapter over the shared Web/Capacitor by-steps UI. */
import {
  TIMER_BY_STEPS_UI_LABELS,
  stepMetricsFor,
  type TimerByStepsSettings,
} from '@cuberoot/shared/timer';
import { TimerByStepsConfig, type TimerByStepsLabels } from '@cuberoot/timer-ui';
import { useMemo, type ReactNode } from 'react';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  event: string;
  source: 'random' | 'wca';
  settings: TimerByStepsSettings;
  updateSettings: (patch: Partial<TimerByStepsSettings>) => void;
  extraToprow?: ReactNode;
}

export default function GenStepsConfig({
  isZh,
  event,
  source,
  settings,
  updateSettings,
  extraToprow,
}: Props) {
  const labels = useMemo<TimerByStepsLabels>(() => ({
    bySteps: tr(TIMER_BY_STEPS_UI_LABELS.bySteps),
    byStepsAriaLabel: tr(TIMER_BY_STEPS_UI_LABELS.byStepsAriaLabel),
    metricAriaLabel: tr(TIMER_BY_STEPS_UI_LABELS.metricAriaLabel),
    metricOptions: Object.fromEntries(
      (stepMetricsFor(event) ?? []).map((metric) => [
        metric.key,
        tr({ zh: metric.zh, en: metric.en }),
      ]),
    ),
    stepRangeAriaLabel: tr(TIMER_BY_STEPS_UI_LABELS.stepRangeAriaLabel),
  }), [event, isZh]);

  return (
    <TimerByStepsConfig
      event={event}
      extraTopRow={extraToprow}
      labels={labels}
      onChange={updateSettings}
      settings={settings}
      source={source}
    />
  );
}
