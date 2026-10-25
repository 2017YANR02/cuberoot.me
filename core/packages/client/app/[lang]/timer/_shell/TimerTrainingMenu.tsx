'use client';
import '@/components/training-settings.css';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { DOUYIN_BASIC_TIMER_EVENTS } from '@cuberoot/shared/douyin-content';

import { useMemo, type ReactNode } from 'react';
import { Settings } from '@app-foundation/icons/lucide';
import { TimerPracticeMethodPicker, TimerPracticeContentPicker, TimerPuzzlePicker } from '@cuberoot/timer-ui';
import { TIMER_EVENT_PICKER_GROUPS, timerEventIdFromSelector, type EventId } from '@cuberoot/shared/timer';
import { useTimerSearchParams as useSearchParams } from '@/lib/timer-practice-url-adapter';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { CompactSelect } from '@/components/CompactSelect';
import { useTrainerSplitScreen } from '@/hooks/useTrainerSplitScreen';
import { tr } from '@/i18n/tr';
import { TRAINING_DIRECTORY, resolveTrainingTarget, trainingEventForTarget, trainingPuzzleForEvent } from '@/lib/timer-training-catalog';
import { timerPracticeContents, selectedTimerPracticeContent, type TimerPracticeContent } from '@/lib/timer-practice-navigation';
import { use222Type } from '@/lib/scramble-222-mode';
import { TimerState, trainerPool, mixSessionId, useTrainerStore } from '@/lib/trainer-store';
import { parseMixSets } from '@/lib/alg-mix';
import { virtualTrainingSessionId } from '@/lib/training-set-metadata';
import { useSettings, updateSettings } from '../_lib/settings';
import { selectSessionForEvent } from '../_lib/storage/db';

type PracticeMethod = 'train' | 'memo' | 'recognize';

/** One content identity, with existing timer/trainer engines as its practice methods. */
export default function TimerTrainingMenu({ currentEvent, disabled = false, showProject = false, onTimerEventChange, sourceControl, onAdvancedSettings, beforeSettings }: {
  currentEvent?: string;
  disabled?: boolean;
  showProject?: boolean;
  onTimerEventChange?: (event: EventId) => void;
  sourceControl?: (onSelectCases?: () => void) => ReactNode;
  onAdvancedSettings?: () => void;
  beforeSettings?: ReactNode;
}) {
  const douyin = useDouyinToolSurface();
  const [training] = useQueryState('training');
  const search = useSearchParams().toString();
  const params = new URLSearchParams(search);
  const target = training && training !== 'home' ? resolveTrainingTarget(training) : null;
  const timerEvent = timerEventIdFromSelector(params.get('event')?.split(',')[0] || '333') ?? '333';
  const selectedEvent = timerEventIdFromSelector(currentEvent ?? timerEvent) ?? timerEvent;
  const trainingEvent = target ? trainingEventForTarget(target) : null;
  const event = trainingEvent && trainingEvent !== trainingPuzzleForEvent(selectedEvent)
    ? timerEventIdFromSelector(trainingEvent) ?? selectedEvent : selectedEvent;
  const contents = useMemo(() => timerPracticeContents(event), [event]);
  const [savedType222, setType222] = use222Type();
  const type222 = params.get('scramble222') ?? savedType222;
  const content = training === 'home' ? undefined : selectedTimerPracticeContent(contents, event, type222, target);
  const settings = useSettings();
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const storeMode = useTrainerStore(s => s.mode);
  const storeTimerState = useTrainerStore(s => s.timerState);
  const selectedCount = useTrainerStore(s => trainerPool(s.selected, s.scope).length);
  const room = useTrainerStore(s => s.room);
  const roomBusy = useTrainerStore(s => s.roomBusy);
  const roomError = useTrainerStore(s => s.roomError);
  const doubleZbll = useTrainerStore(s => s.doubleZbll);
  const sessionId = content?.puzzle && content.set ? (content.set === 'mix'
    ? mixSessionId(parseMixSets(content.puzzle, params.get('train.sets')))
    : virtualTrainingSessionId(content.puzzle, content.set,
      params.get('train.scope')?.trim().toLowerCase() || null, params.get('train.drill') === '1')) : null;
  const isTrainer = target?.kind === 'alg-run' || target?.kind === 'alg-select';
  const isRun = target?.kind === 'alg-run';
  const ownsSession = !!training && !!content?.puzzle && storePuzzle === content.puzzle && storeSet === sessionId;
  const running = ownsSession && isRun && storeTimerState !== TimerState.NOT_RUNNING;
  const { eligible: splitActive } = useTrainerSplitScreen({
    requested: params.get('train.split') === '1', sessionReady: ownsSession && isRun,
    doubleZbll, room: !!room, caseCount: selectedCount,
  });
  const roomLocked = isRun && (!!(ownsSession && room) || !!(params.get('train.room') && !(ownsSession && roomError)));
  const navigationDisabled = disabled || running || !!(ownsSession && isRun && roomBusy);
  const methodLocked = navigationDisabled || splitActive;
  const restrictMethod = roomLocked || !!(ownsSession && doubleZbll);
  // Split/double practice can return to selection just like the trainer's own back link.
  const sourceLocked = navigationDisabled || roomLocked;
  const actualMode = ownsSession && target?.kind === 'alg-run' ? storeMode : params.get('train.mode');
  const method: PracticeMethod = target?.kind === 'recognize' || target?.kind === 'recognize-guide' ? 'recognize'
    : training && actualMode === 'memo' ? 'memo' : 'train';

  const queryParsers = useMemo(() => {
    const keys = new Set(['training', 'event', 'source', 'scramble222', 'train.mode', 'train.draw', 'train.split', 'train.room', 'train.multi']);
    for (const key of new URLSearchParams(search).keys()) if (key.startsWith('train.')) keys.add(key);
    for (const group of TRAINING_DIRECTORY) for (const item of group.items) {
      for (const key of new URLSearchParams(item.path.split('?')[1]).keys()) keys.add(`train.${key}`);
    }
    return Object.fromEntries([...keys].map(key => [key, parseAsString]));
  }, [search]);
  const [, setNavigation] = useQueryStates(queryParsers, { history: 'push' });

  const navigate = (href: string | null, nextEvent: EventId, sameContent: boolean, options: Record<string, string | null> = {}) => {
    const next: Record<string, string | null> = sameContent && href ? {} : Object.fromEntries(
      Object.keys(queryParsers).filter(key => key.startsWith('train.')).map(key => [key, null]),
    );
    next.event = nextEvent;
    next.training = href?.split('?')[0] ?? null;
    next.source = null;
    next.scramble222 = null;
    if (href) for (const [key, value] of new URLSearchParams(href.split('?')[1])) next[`train.${key}`] = value;
    Object.assign(next, options);
    if (!href) {
      if (onTimerEventChange) onTimerEventChange(nextEvent);
      else if (training) selectSessionForEvent(nextEvent, settings.autoSessionForEvent);
    }
    void setNavigation(next);
  };

  if (douyin) return <>
    <TimerPuzzlePicker showArrow={false} disabled={disabled} dataNoTimer
      puzzleLabel={tr({ zh: '项目', en: 'Puzzle' })} selectedEvent={event}
      groups={TIMER_EVENT_PICKER_GROUPS.map(group => ({
        id: group.id, label: tr({ zh: group.nameZh, en: group.nameEn }),
        items: group.items.filter(item => DOUYIN_BASIC_TIMER_EVENTS.includes(item.id)).map(item => ({
          id: item.id, label: tr({ zh: item.nameZh, en: item.nameEn }), iconClass: item.iconClass,
        })),
      })).filter(group => group.items.length > 0)}
      onSelect={id => { const next = timerEventIdFromSelector(id); if (next && DOUYIN_BASIC_TIMER_EVENTS.includes(next)) onTimerEventChange?.(next); }}
    />
    {beforeSettings}
    {onAdvancedSettings && <button type="button" className="settings-popover-trigger" data-no-timer
      aria-label={tr({ zh: '设置', en: 'Settings' })} onClick={onAdvancedSettings}><Settings size={18} /></button>}
  </>;

  const startTimer = (entry: TimerPracticeContent, sameContent = true, source?: 'random' | 'manual') => {
    if (!entry.timer) return;
    if (entry.timer.type222) setType222(entry.timer.type222);
    updateSettings({ ...(source ? { scrambleSource: source } : entry.id !== 'solve' ? { scrambleSource: 'random' as const } : {}) });
    navigate(null, entry.timer.event, sameContent, {
      source: source === 'manual' ? 'manual' : null,
      scramble222: entry.timer.type222 ?? null,
    });
  };

  const startTraining = (entry: TimerPracticeContent, nextMethod: PracticeMethod, sameContent: boolean, select = false) => {
    const href = nextMethod === 'recognize' ? entry.recognizePath
      : select ? entry.selectPath ?? entry.runPath : entry.runPath ?? entry.path;
    if (!href) return;
    // Coverage and random draws are trainer preferences, separate from timing.
    const drawMode = sameContent && (actualMode === 'train' || (actualMode === 'memo' && params.get('train.draw') === 'train')) ? 'train' : 'recap';
    const nextMode = nextMethod === 'memo' ? 'memo' : drawMode;
    // The selected project (for example OH) belongs to the URL. The formula
    // set already identifies its engine; a scramble subtype is not a project.
    navigate(href, event, sameContent, {
      // These belong to the run surface, not its selector, guide or recognition task.
      'train.split': null, 'train.room': null, 'train.multi': null,
      ...(nextMethod === 'recognize' ? {} : {
        'train.mode': nextMode,
        // Recall has its own queue; remember the action drill's draw preference.
        'train.draw': nextMethod === 'memo' ? drawMode : null,
      }),
    });
  };

  const chooseContent = (id: string) => {
    const entry = contents.find(item => item.id === id);
    if (!entry) return;
    if (entry.id === content?.id && (!training || isTrainer || target?.kind === 'recognize')) return;
    if (entry.id === 'solve') return startTimer(entry, false);
    if (method === 'recognize' && entry.recognizePath) return startTraining(entry, 'recognize', false);
    if (method === 'memo' && entry.runPath) return startTraining(entry, 'memo', false);
    if (entry.timer && onTimerEventChange) return startTimer(entry, false);
    if (entry.runPath) return startTraining(entry, 'train', false, true);
    if (entry.timer) return startTimer(entry, false);
    navigate(entry.path ?? entry.recognizePath ?? null, event, false);
  };
  const chooseMethod = (nextMethod: PracticeMethod) => {
    if (!content || (nextMethod === method && (!training || isTrainer || target?.kind === 'recognize'))) return;
    if (nextMethod === 'recognize' || nextMethod === 'memo') return startTraining(content, nextMethod, true);
    if (!training && content.timer) {
      startTimer(content);
    } else if (content.runPath) {
      const needsSelection = (target?.kind === 'recognize' || target?.kind === 'recognize-guide')
        && (!ownsSession || selectedCount === 0);
      startTraining(content, nextMethod, true, target?.kind === 'alg-select' || needsSelection);
    } else startTimer(content);
  };
  const hasPractice = !!(content?.runPath || content?.timer);
  const contentLabel = content ? tr(content.title) : tr(target?.title ?? { zh: '请选择', en: 'Choose content' });
  const casesLabel = method === 'memo' && ownsSession && selectedCount === 0
    ? params.get('train.scope') ? tr({ zh: '当前分组', en: 'Current group' }) : tr({ zh: '全部情况', en: 'All cases' })
    : tr({ zh: '选定', en: 'Selected' });
  const sourceItems = [
    ...(content?.timer ? [{ value: 'random', label: tr({ zh: '随机状态', en: 'Random state' }) }] : []),
    ...(content?.selectPath ? [{ value: 'cases', label: tr({ zh: '选定情况', en: 'Selected cases' }) }] : []),
    ...(content?.timer ? [{ value: 'manual', label: tr({ zh: '手动输入', en: 'Manual input' }) }] : []),
  ];

  const practiceSource = hasPractice && method !== 'recognize' && <span className="timer-practice-control">
    {method === 'memo' && content?.selectPath ? <button type="button" className="timer-practice-settings__action"
      disabled={sourceLocked} onClick={() => startTraining(content, method, true, true)}>
      {tr({ zh: '选择情况', en: 'Choose cases' })}
    </button> : <>
      {!training && sourceControl ? sourceControl(content?.selectPath
        ? () => startTraining(content, method, true, true) : undefined)
        : <CompactSelect align="center" variant="plain" showArrow={false} dataNoTimer
          disabled={sourceLocked || sourceItems.length === 0}
          ariaLabel={tr({ zh: '出题来源', en: 'Question source' })}
          label={training ? casesLabel : settings.scrambleSource === 'manual'
            ? tr({ zh: '手动', en: 'Manual' }) : tr({ zh: '随机', en: 'Random' })}
          value={training ? 'cases' : settings.scrambleSource === 'manual' ? 'manual' : 'random'}
          items={sourceItems}
          onChange={source => {
            if (!content) return;
            if (source === 'cases') startTraining(content, method, true, true);
            else startTimer(content, true, source === 'manual' ? 'manual' : 'random');
          }} />}
    </>}
  </span>;

  return <>
    {(showProject || training) && <span className="timer-practice-control">
      <TimerPuzzlePicker
        showArrow={false}
        disabled={navigationDisabled} puzzleLabel={tr({ zh: '项目', en: 'Puzzle' })}
        selectedEvent={event} groups={TIMER_EVENT_PICKER_GROUPS.map(group => ({
          id: group.id, label: tr({ zh: group.nameZh, en: group.nameEn }),
          items: group.items.map(item => ({ id: item.id, label: tr({ zh: item.nameZh, en: item.nameEn }), iconClass: item.iconClass, textLabel: item.textLabel })),
        }))}
        scrambleTypeLabel={tr({ zh: '内容', en: 'Content' })} combineScrambleTypes dataNoTimer
        onSelect={id => {
          const next = timerEventIdFromSelector(id);
          if (!next) return;
          if (next === '222') setType222('full');
          navigate(null, next, false);
        }}
      />
    </span>}
    <TimerPracticeContentPicker entries={contents} selectedId={content?.id} label={contentLabel}
      disabled={navigationDisabled} language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} onSelect={chooseContent} />
    {hasPractice && (content?.runPath || content?.recognizePath) && <TimerPracticeMethodPicker
      value={method} recall={!!content.runPath} recognize={!!content.recognizePath} disabled={methodLocked || restrictMethod}
      language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} onChange={chooseMethod} />}
    {practiceSource}
    {beforeSettings}
    {practiceSource && !isRun && onAdvancedSettings && <>
      <button type="button" className="settings-popover-trigger" data-no-timer
        aria-label={tr({ zh: '设置', en: 'Settings' })} aria-haspopup="dialog"
        onClick={onAdvancedSettings}>
        <Settings size={18} aria-hidden="true" />
      </button>
    </>}
  </>;
}
