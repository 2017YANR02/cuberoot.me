import type { TimerPracticeContent } from '@cuberoot/shared/timer';
import { TimerPuzzlePicker } from './TimerPuzzlePicker';
import { TIMER_OVERLAY_IDS, type TimerOverlayControlProps } from './timer-overlay-control';
import './timer-practice-controls.css';

export function TimerPracticeContentPicker({ entries, selectedId, label, disabled, language, onSelect, open, onOpenChange }: TimerOverlayControlProps & {
  entries: readonly TimerPracticeContent[];
  selectedId?: string;
  label: string;
  disabled?: boolean;
  language: 'en' | 'zh';
  onSelect(id: string): void;
}) {
  const groups = [...new Map(entries.filter(item => item.group).map(item => [item.group!.id, item.group!])).values()];
  return <span className="timer-practice-control timer-practice-control--content">
    <TimerPuzzlePicker showArrow={false} disabled={disabled} dataNoTimer
      puzzleLabel={language === 'zh' ? '内容' : 'Content'} triggerLabel={label}
      selectedEvent={selectedId ?? ''} showSubmenuHeading={false} showItemIcons={false}
      open={open} onOpenChange={(next, details) => onOpenChange?.(next, { ...details, id: TIMER_OVERLAY_IDS.practiceContent })}
      groups={[{ id: 'content', label: '', items: entries.filter(item => !item.group).map(item => ({ id: item.id, label: item.title[language] })) },
        { id: 'tools', label: '', items: groups.map(group => ({ id: group.id, label: group.title[language],
          children: entries.filter(item => item.group?.id === group.id).map(item => ({ id: item.id, label: item.title[language] })),
        })) }]}
      onSelect={onSelect} />
  </span>;
}
