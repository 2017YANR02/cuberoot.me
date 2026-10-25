export { TRAINING_DIRECTORY, trainingEventForTarget, trainingPuzzleForEvent, trainingDirectoryForEvent, resolveTrainingTarget, isRetiredAlgTrainer, type TrainingTitle, type TrainingTargetKind, type TrainingTarget, type TrainingDirectoryItem, type TrainingDirectoryGroup } from '@cuberoot/shared/timer';
import { isRetiredAlgTrainer } from '@cuberoot/shared/timer';
import { canonicalTimerHref, timerTrainingHref } from './timer-training-location';

/** Shared by old bookmarks, site links and the sitemap; preserve every trainer query value. */
export function retiredAlgTrainerHref(href: string): string {
  if (!isRetiredAlgTrainer(href)) return canonicalTimerHref(href);
  return timerTrainingHref(href, {
    timerPathname: /^\/zh(?:\/|$)/.test(href) ? '/zh/timer' : '/timer',
    currentSearch: '',
    acceptsPath: isRetiredAlgTrainer,
  });
}
