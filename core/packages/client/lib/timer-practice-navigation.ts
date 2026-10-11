import type { AlgPuzzle } from '@cuberoot/shared/alg';
import {
  SCRAMBLE_222_TYPE_CATALOG, TIMER_333_SCRAMBLE_TYPES, eventInfo,
  isScramble222Type, timerEventIdFromSelector,
  type EventId, type Scramble222Type,
} from '@cuberoot/shared/timer';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import {
  TRAINING_DIRECTORY, resolveTrainingTarget, trainingDirectoryForEvent, trainingPuzzleForEvent,
  type TrainingTarget, type TrainingTitle,
} from './timer-training-catalog';

export interface TimerPracticeContent {
  id: string;
  title: TrainingTitle;
  group?: { id: string; title: TrainingTitle };
  /** Existing timer provider/session identity; choosing a content must not rename it. */
  timer?: { event: EventId; type222?: Scramble222Type };
  selectPath?: string;
  runPath?: string;
  recognizePath?: string;
  /** Dedicated tools retain the directory URL, including its query defaults. */
  path?: string;
  puzzle?: AlgPuzzle;
  set?: string;
}

const FORMULA_DIRECTORY = TRAINING_DIRECTORY.filter(group => group.id.startsWith('alg:'));

/** Only naming differences between the existing timer and formula registries. */
function formulaSetForTimer(event: EventId, type222?: Scramble222Type): string {
  if (event === 'll') return '1lll';
  if (type222 === 'tcllp') return 'tcll-plus';
  if (type222 === 'tclln') return 'tcll-minus';
  return type222 ?? event;
}

/**
 * One content may offer random timing, selected cases, and recognition. The
 * catalog owns membership and labels; this projection only joins those routes.
 */
export function timerPracticeContents(event: string): readonly TimerPracticeContent[] {
  const timerEvent = timerEventIdFromSelector(event) ?? '333';
  const puzzle = trainingPuzzleForEvent(timerEvent);
  const directory = trainingDirectoryForEvent(timerEvent);
  const visiblePaths = new Set(directory.flatMap(group => group.items.map(item => item.path)));
  const formulas: TimerPracticeContent[] = FORMULA_DIRECTORY.flatMap(group => group.items.flatMap(item => {
    if (!visiblePaths.has(item.path)) return [];
    const target = resolveTrainingTarget(item.path);
    const algPuzzle = target && resolveAlgPuzzle(target.params.puzzle ?? '');
    if (!target || !algPuzzle || !target.params.set) return [];
    return [{
      id: item.path,
      title: item.title,
      puzzle: algPuzzle,
      set: target.params.set,
      ...(target.kind === 'alg-select' ? { selectPath: item.path } : {}),
      runPath: target.kind === 'alg-run' ? item.path : item.path.replace(/\/select$/, '/run'),
    }];
  }));

  const tools: TimerPracticeContent[] = [];
  for (const group of directory) {
    if (group.id.startsWith('alg:')) continue;
    for (const item of group.items) {
      const target = resolveTrainingTarget(item.path);
      // Virtual LSLL uses its existing custom selector, not the PG set selector.
      const lsll = target?.kind === 'lsll'
        ? formulas.find(content => content.puzzle === '3x3' && content.set === 'lsll') : undefined;
      if (lsll) {
        lsll.selectPath = item.path;
        continue;
      }
      const recognized = target?.kind === 'recognize'
        ? formulas.find(content => content.puzzle === '3x3' && content.set === target.params.algSetId) : undefined;
      if (recognized) {
        recognized.recognizePath = item.path;
        continue;
      }
      tools.push({ id: item.path, path: item.path, title: item.title, group: { id: group.id, title: group.title } });
    }
  }

  const randomOnly: TimerPracticeContent[] = [];
  const addTimer = (
    id: string, title: TrainingTitle, algPuzzle: AlgPuzzle, set: string,
    timer: NonNullable<TimerPracticeContent['timer']>,
  ) => {
    const formula = formulas.find(content => content.puzzle === algPuzzle && content.set === set);
    if (formula) formula.timer = timer;
    else randomOnly.push({ id, title, timer });
  };
  if (puzzle === '333') {
    for (const type of TIMER_333_SCRAMBLE_TYPES) {
      if (type.event === '333') continue;
      const info = eventInfo(type.event);
      addTimer(`timer:${type.event}`, { zh: info.nameZh, en: info.nameEn }, '3x3',
        formulaSetForTimer(type.event), { event: type.event });
    }
  } else if (puzzle === '222') {
    for (const type of SCRAMBLE_222_TYPE_CATALOG) {
      if (type.id === 'full') continue;
      const separateEvent = type.id === 'eg1' || type.id === 'eg2';
      addTimer(`timer:222:${type.id}`, type.label, '2x2', formulaSetForTimer('222', type.id), {
        event: separateEvent ? type.id : '222', type222: separateEvent ? 'full' : type.id,
      });
    }
  }

  // Only scramble subtypes return to their full-solve event. OH/FMC/BLD and
  // other real event identities must survive choosing their ordinary solve.
  const solveEvent = timerEvent === 'eg1' || timerEvent === 'eg2' ? '222'
    : TIMER_333_SCRAMBLE_TYPES.some(type => type.event === timerEvent) ? '333' : timerEvent;
  return [{
    id: 'solve', title: { zh: '完整', en: 'Full solve' },
    timer: { event: solveEvent, ...(solveEvent === '222' ? { type222: 'full' as const } : {}) },
  }, ...formulas, ...randomOnly, ...tools];
}

function matchesTarget(path: string | undefined, target: TrainingTarget): boolean {
  const route = path ? resolveTrainingTarget(path) : null;
  return !!route && (route.path === target.path || (
    route.kind === target.kind
    && Object.keys(route.params).length === Object.keys(target.params).length
    && Object.entries(route.params).every(([key, value]) => target.params[key] === value)
  ));
}

/** Select/run/case/guide deep links select their content, independent of the current activity. */
export function selectedTimerPracticeContent(
  entries: readonly TimerPracticeContent[], event: string, type222: string | null | undefined,
  target: TrainingTarget | null,
): TimerPracticeContent | undefined {
  if (target) {
    const puzzle = resolveAlgPuzzle(target.params.puzzle ?? '');
    if (puzzle && target.params.set) {
      return entries.find(content => content.puzzle === puzzle && content.set === target.params.set);
    }
    if (target.kind === 'recognize' || target.kind === 'recognize-guide') {
      const formula = entries.find(content => content.recognizePath
        && resolveTrainingTarget(content.recognizePath)?.params.algSetId === target.params.algSetId);
      if (formula) return formula;
    }
    if (target.kind === 'lsll' || target.kind === 'lsll-group' || target.kind === 'lsll-case' || target.kind === 'lsll-route') {
      return entries.find(content => content.puzzle === '3x3' && content.set === 'lsll');
    }
    if (target.kind === 'sq1-shape-guide') {
      return entries.find(content => content.path && resolveTrainingTarget(content.path)?.params.algSetId === 'sq1-shape');
    }
    return entries.find(content => [content.path, content.selectPath, content.runPath, content.recognizePath]
      .some(path => matchesTarget(path, target)));
  }

  const timerEvent = timerEventIdFromSelector(event);
  const selectedType = isScramble222Type(type222) ? type222 : 'full';
  // Existing persisted 222+EG subtype URLs still highlight the same EG content.
  const selectedEvent = timerEvent === '222' && (selectedType === 'eg1' || selectedType === 'eg2')
    ? selectedType : timerEvent;
  return entries.find(content => content.timer?.event === selectedEvent
    && (selectedEvent !== '222' || content.timer.type222 === selectedType));
}
