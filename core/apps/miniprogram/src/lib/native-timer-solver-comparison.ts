import {
  initialTimer333Comparison, scheduleTimer333Comparison, timer333ComparisonRows,
} from '@cuberoot/puzzle-solvers/timer-333-step';
import { getMiniProgramLocale, type MiniProgramLocale } from './i18n';

export function startNativeTimerSolverComparison(
  scramble: string,
  publish: (rows: ReturnType<typeof timer333ComparisonRows>, loading: boolean) => void,
  language: MiniProgramLocale = getMiniProgramLocale(),
) {
  const outcomes = initialTimer333Comparison();
  publish(timer333ComparisonRows(outcomes, language), true);
  return scheduleTimer333Comparison(scramble, outcome => {
    const index = outcomes.findIndex(current => current.id === outcome.id);
    outcomes[index] = outcome;
    publish(timer333ComparisonRows(outcomes, language), true);
  }, () => publish(timer333ComparisonRows(outcomes, language), false), run => {
    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  });
}
