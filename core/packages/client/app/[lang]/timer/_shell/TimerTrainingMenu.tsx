'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { TimerPuzzlePicker } from '@cuberoot/timer-ui';
import { TIMER_EVENT_PICKER_GROUPS, timerEventIdFromSelector, type EventId } from '@cuberoot/shared/timer';
import { useSearchParams } from 'next/navigation';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { CompactSelect } from '@/components/CompactSelect';
import BoolToggle from '@/components/BoolToggle';
import { SettingsPopover } from '@/components/TrainingSettings';
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

type PracticeMethod = 'timed' | 'untimed' | 'memo' | 'recognize';

/** One content identity, with existing timer/trainer engines as its practice methods. */
export default function TimerTrainingMenu({ currentEvent, disabled = false, showProject = false, onTimerEventChange, sourceControl, settingsOnly = false, onAdvancedSettings, onSettingsOpenChange }: {
  currentEvent?: string;
  disabled?: boolean;
  showProject?: boolean;
  onTimerEventChange?: (event: EventId) => void;
  sourceControl?: (onSelectCases?: () => void) => ReactNode;
  settingsOnly?: boolean;
  onAdvancedSettings?: () => void;
  onSettingsOpenChange?: (open: boolean) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const changeSettingsOpen = (open: boolean) => {
    setSettingsOpen(open);
    onSettingsOpenChange?.(open);
  };
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
  const [type222, setType222] = use222Type();
  const content = training === 'home' ? undefined : selectedTimerPracticeContent(contents, event, type222, target);
  const settings = useSettings();
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const storeMode = useTrainerStore(s => s.mode);
  const storeTiming = useTrainerStore(s => s.timing);
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
  const actualTiming = ownsSession && target?.kind === 'alg-run' ? storeTiming
    : params.has('train.timing') ? params.get('train.timing') === '1' : settings.timingEnabled;
  const method: PracticeMethod = target?.kind === 'recognize' || target?.kind === 'recognize-guide' ? 'recognize'
    : training && actualMode === 'memo' ? 'memo'
      : (training ? actualTiming : settings.timingEnabled) ? 'timed' : 'untimed';

  const queryParsers = useMemo(() => {
    const keys = new Set(['training', 'event', 'train.mode', 'train.draw', 'train.timing', 'train.split', 'train.room', 'train.multi']);
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
    if (href) for (const [key, value] of new URLSearchParams(href.split('?')[1])) next[`train.${key}`] = value;
    Object.assign(next, options);
    if (!href) {
      if (onTimerEventChange) onTimerEventChange(nextEvent);
      else if (training) selectSessionForEvent(nextEvent, settings.autoSessionForEvent);
    }
    void setNavigation(next);
  };

  const startTimer = (entry: TimerPracticeContent, nextMethod: PracticeMethod, sameContent = true, source?: 'random' | 'manual') => {
    if (!entry.timer) return;
    if (entry.timer.type222) setType222(entry.timer.type222);
    updateSettings({ timingEnabled: nextMethod !== 'untimed', ...(source ? { scrambleSource: source } : entry.id !== 'solve' ? { scrambleSource: 'random' as const } : {}) });
    navigate(null, entry.timer.event, sameContent);
  };

  const startTraining = (entry: TimerPracticeContent, nextMethod: PracticeMethod, sameContent: boolean, select = false) => {
    const href = nextMethod === 'recognize' ? entry.recognizePath
      : select ? entry.selectPath ?? entry.runPath : entry.runPath ?? entry.path;
    if (!href) return;
    // Coverage and random draws are trainer preferences, separate from timing.
    const drawMode = sameContent && (actualMode === 'train' || (actualMode === 'memo' && params.get('train.draw') === 'train')) ? 'train' : 'recap';
    const nextMode = nextMethod === 'memo' ? 'memo' : drawMode;
    navigate(href, entry.timer?.event ?? event, sameContent, {
      // These belong to the run surface, not its selector, guide or recognition task.
      'train.split': null, 'train.room': null, 'train.multi': null,
      ...(nextMethod === 'recognize' ? {} : {
        'train.mode': nextMode, 'train.timing': (nextMethod === 'memo' ? actualTiming : nextMethod === 'timed') ? '1' : '0',
        // Recall has its own queue; remember the action drill's draw preference.
        'train.draw': nextMethod === 'memo' ? drawMode : null,
      }),
    });
  };

  const chooseContent = (id: string) => {
    const entry = contents.find(item => item.id === id);
    if (!entry) return;
    if (entry.id === content?.id && (!training || isTrainer || target?.kind === 'recognize')) return;
    const executionMethod = actualTiming ? 'timed' : 'untimed';
    if (entry.id === 'solve') return startTimer(entry, executionMethod, false);
    if (method === 'recognize' && entry.recognizePath) return startTraining(entry, 'recognize', false);
    if (method === 'memo' && entry.runPath) return startTraining(entry, 'memo', false);
    if (entry.timer && onTimerEventChange) return startTimer(entry, executionMethod, false);
    if (entry.runPath) return startTraining(entry, executionMethod, false, true);
    if (entry.timer) return startTimer(entry, executionMethod, false);
    navigate(entry.path ?? entry.recognizePath ?? null, event, false);
  };
  const chooseMethod = (nextMethod: PracticeMethod) => {
    if (!content || (nextMethod === method && (!training || isTrainer || target?.kind === 'recognize'))) return;
    if (ownsSession && target?.kind === 'alg-run' && (nextMethod === 'timed' || nextMethod === 'untimed')) {
      useTrainerStore.getState().setTiming(nextMethod === 'timed');
      // Rooms/double-bottom keep their own draw mode; timing remains switchable.
      if (restrictMethod) {
        void setNavigation({ 'train.timing': nextMethod === 'timed' ? '1' : '0' });
        return;
      }
    }
    if (nextMethod === 'recognize' || nextMethod === 'memo') return startTraining(content, nextMethod, true);
    if (!training && content.timer) {
      updateSettings({ timingEnabled: nextMethod === 'timed' });
    } else if (content.runPath) {
      const needsSelection = (target?.kind === 'recognize' || target?.kind === 'recognize-guide')
        && (!ownsSession || selectedCount === 0);
      startTraining(content, nextMethod, true, target?.kind === 'alg-select' || needsSelection);
    } else startTimer(content, nextMethod);
  };
  const hasPractice = !!(content?.runPath || content?.timer);
  const specialGroups = [...new Map(contents.filter(item => item.group).map(item => [item.group!.id, item.group!])).values()];
  const contentLabel = content ? tr(content.title) : tr(target?.title ?? { zh: '请选择', en: 'Choose content' });
  const casesLabel = method === 'memo' && ownsSession && selectedCount === 0
    ? params.get('train.scope') ? tr({ zh: '当前分组', en: 'Current group' }) : tr({ zh: '全部情况', en: 'All cases' })
    : tr({ zh: '选定情况', en: 'Selected cases' });
  const sourceItems = [
    ...(content?.timer ? [{ value: 'random', label: tr({ zh: '随机状态', en: 'Random state' }) }] : []),
    ...(content?.selectPath ? [{ value: 'cases', label: tr({ zh: '选定情况', en: 'Selected cases' }) }] : []),
    ...(content?.timer ? [{ value: 'manual', label: tr({ zh: '手动输入', en: 'Manual input' }) }] : []),
  ];

  const practiceSettings = hasPractice && method !== 'recognize' && <div className="timer-practice-settings">
    {content?.runPath && <label className="timer-practice-settings__row">
      <span>{tr({ zh: '练习', en: 'Practice' })}</span>
      <select className="native-select" aria-label={tr({ zh: '练习内容', en: 'Practice type' })}
        value={method === 'memo' ? 'memo' : 'action'} disabled={methodLocked || restrictMethod}
        onChange={e => chooseMethod(e.target.value === 'memo' ? 'memo' : actualTiming ? 'timed' : 'untimed')}>
        <option value="action">{tr({ zh: '动作练习', en: 'Execution' })}</option>
        <option value="memo">{tr({ zh: '公式记忆', en: 'Algorithm recall' })}</option>
      </select>
    </label>}
    {method !== 'memo' && <BoolToggle label={tr({ zh: '计时', en: 'Timing' })}
      value={method === 'timed'} disabled={methodLocked}
      onChange={timed => chooseMethod(timed ? 'timed' : 'untimed')} />}
    {method === 'memo' && content?.selectPath ? <button type="button" className="timer-practice-settings__action"
      disabled={sourceLocked} onClick={() => startTraining(content, method, true, true)}>
      {tr({ zh: '选择情况', en: 'Choose cases' })}
    </button> : <div className="timer-practice-settings__row">
      <span>{tr({ zh: '出题', en: 'Source' })}</span>
      {!training && sourceControl ? sourceControl(content?.selectPath
        ? () => startTraining(content, method, true, true) : undefined)
        : <CompactSelect variant="plain" showArrow={false} dataNoTimer
          disabled={sourceLocked || sourceItems.length === 0}
          ariaLabel={tr({ zh: '出题来源', en: 'Question source' })}
          label={training ? casesLabel : settings.scrambleSource === 'manual'
            ? tr({ zh: '手动输入', en: 'Manual input' }) : tr({ zh: '随机状态', en: 'Random state' })}
          value={training ? 'cases' : settings.scrambleSource === 'manual' ? 'manual' : 'random'}
          items={sourceItems}
          onChange={source => {
            if (!content) return;
            if (source === 'cases') startTraining(content, method, true, true);
            else startTimer(content, method, true, source === 'manual' ? 'manual' : 'random');
          }} />}
    </div>}
    {onAdvancedSettings && <button type="button" className="timer-practice-settings__action" onClick={() => {
      changeSettingsOpen(false);
      onAdvancedSettings();
    }}>{tr({ zh: '更多设置', en: 'More settings' })}</button>}
  </div>;

  if (settingsOnly) return practiceSettings;

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
    <span className="timer-practice-control">
      <TimerPuzzlePicker
        showArrow={false}
        disabled={navigationDisabled} puzzleLabel={tr({ zh: '内容', en: 'Content' })}
        triggerLabel={contentLabel} selectedEvent={content?.id ?? ''} showSubmenuHeading={false}
        showItemIcons={false} dataNoTimer
        groups={[{ id: 'content', label: '', items: contents.filter(item => !item.group).map(item => ({ id: item.id, label: tr(item.title) })) },
          { id: 'tools', label: '', items: specialGroups.map(group => ({
            id: group.id, label: tr(group.title),
            children: contents.filter(item => item.group?.id === group.id).map(item => ({ id: item.id, label: tr(item.title) })),
          })) }]}
        onSelect={chooseContent}
      />
    </span>
    {hasPractice && <span className="timer-practice-control">
      {content?.recognizePath ? <CompactSelect<'train' | 'recognize'>
        variant="plain" showArrow={false} disabled={methodLocked || restrictMethod} dataNoTimer
        ariaLabel={tr({ zh: '练习方式', en: 'Practice method' })}
        label={method === 'recognize' ? tr({ zh: '识别', en: 'Recognition' }) : tr({ zh: '训练', en: 'Training' })}
        value={method === 'recognize' ? 'recognize' : 'train'}
        items={[
          { value: 'train', label: tr({ zh: '训练', en: 'Training' }) },
          { value: 'recognize', label: tr({ zh: '识别', en: 'Recognition' }) },
        ]} onChange={task => {
          if (task === 'recognize') chooseMethod('recognize');
          else if (method === 'recognize') chooseMethod(actualMode === 'memo' ? 'memo' : actualTiming ? 'timed' : 'untimed');
        }}
      /> : <span>{tr({ zh: '训练', en: 'Training' })}</span>}
    </span>}
    {practiceSettings && !isRun && <SettingsPopover label={tr({ zh: '训练设置', en: 'Training settings' })}
      open={settingsOpen} onOpenChange={changeSettingsOpen} ignoreTimer>
      {practiceSettings}
    </SettingsPopover>}
  </>;
}
