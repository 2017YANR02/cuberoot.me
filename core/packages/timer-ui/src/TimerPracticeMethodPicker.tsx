import { CompactSelect } from './CompactSelect';
import './compact-select.css';
import './timer-practice-controls.css';

export type TimerPracticeMethod = 'train' | 'recognize' | 'memo';
export function TimerPracticeMethodPicker({ value, recall, recognize, disabled, language, onChange, open, onOpenChange }: {
  value: TimerPracticeMethod;
  recall: boolean;
  recognize: boolean;
  disabled?: boolean;
  language: 'en' | 'zh';
  onChange(value: TimerPracticeMethod): void;
  open?: boolean;
  onOpenChange?(open: boolean): void;
}) {
  const labels = language === 'zh' ? { train: '训练', recognize: '识别', memo: '记忆' }
    : { train: 'Training', recognize: 'Recognition', memo: 'Recall' };
  return <span className="timer-practice-control">
    <CompactSelect<TimerPracticeMethod> align="center" variant="plain" showArrow={false} dataNoTimer
      disabled={disabled} ariaLabel={language === 'zh' ? '练习方式' : 'Practice method'}
      label={labels[value]} value={value} open={open} onOpenChange={onOpenChange}
      items={[{ value: 'train', label: labels.train },
        ...(recognize ? [{ value: 'recognize' as const, label: labels.recognize }] : []),
        ...(recall ? [{ value: 'memo' as const, label: labels.memo }] : [])]}
      onChange={onChange} />
  </span>;
}
