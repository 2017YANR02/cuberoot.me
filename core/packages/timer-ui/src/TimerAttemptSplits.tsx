import {
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_ATTEMPT_SPLIT_COPY as COPY,
  timerAttemptSplitChips,
  type TimerAttemptSplitChip,
  type TimerAttemptSplitOptions,
  type TimerAttemptSplitState,
  type TimerSettingCopy,
  type TimerSettingFieldId,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';

export interface TimerAttemptSplitStatusProps {
  bldMemoActive: boolean;
  localize: (copy: TimerSettingCopy) => string;
  multiStageActive: boolean;
  onMarkMemo: () => void;
  onMarkStage: (stage: 'cross' | 'f2l' | 'oll') => void;
  precision?: 2 | 3;
  state: TimerAttemptSplitState;
}

/** Live split controls shared by the website and every installed client. */
export function TimerAttemptSplitStatus({
  bldMemoActive,
  localize,
  multiStageActive,
  onMarkMemo,
  onMarkStage,
  precision = 2,
  state,
}: TimerAttemptSplitStatusProps) {
  const { stages, memo } = timerAttemptSplitChips(state, { bldMemo: bldMemoActive, multiStage: multiStageActive }, precision, localize);
  const renderChip = ({ key, label, action, time }: TimerAttemptSplitChip) => {
    return action && key !== 'executing' ? (
      <button
        aria-label={label}
        className="stage-chip stage-chip-action"
        data-no-timer
        key={key}
        onClick={(event) => {
          event.stopPropagation();
          if (key === 'memo') onMarkMemo();
          else onMarkStage(key);
        }}
        type="button"
      >{label}</button>
    ) : (
      <span key={key} className={time ? 'stage-chip done' : 'stage-chip'}>
        {time ? `${label} ${time}` : label}
      </span>
    );
  };

  return (
    <>
      {multiStageActive && (
        <div className="timer-stage-splits">{stages.map(renderChip)}</div>
      )}
      {bldMemoActive && (
        <div className="timer-stage-splits">{memo.map(renderChip)}</div>
      )}
    </>
  );
}

export interface TimerAttemptSplitBooleanControlProps {
  label: string;
  onChange: (value: boolean) => void;
  settingId: TimerSettingFieldId;
  value: boolean;
}

export interface TimerAttemptSplitSettingsProps {
  bldVisible: boolean;
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerAttemptSplitOptions>) => void;
  renderBooleanControl: (props: TimerAttemptSplitBooleanControlProps) => ReactNode;
  stageVisible: boolean;
  value: TimerAttemptSplitOptions;
}

function trainingField(storagePath: keyof TimerAttemptSplitOptions) {
  const field = TIMER_SETTING_FIELD_CONTRACTS.find((candidate) => (
    candidate.category === 'training' && candidate.storagePath === storagePath
  ));
  if (!field) throw new Error(`Missing timer split setting contract: ${storagePath}`);
  return field;
}

const STAGE_FIELD = trainingField('multiStage');
const BLD_FIELD = trainingField('bldMemo');

function SettingRow({
  control,
  hint,
  label,
  settingId,
}: {
  control: ReactNode;
  hint: string;
  label: string;
  settingId: TimerSettingFieldId;
}) {
  return (
    <div className="settings-row settings-row-boolean timer-attempt-split-setting" data-setting-id={settingId}>
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">
        {control}
      </span>
      <span className="settings-row-hint hint timer-attempt-split-hint">{hint}</span>
    </div>
  );
}

/** Contract-derived split settings rows shared by Web and installed clients. */
export function TimerAttemptSplitSettings({
  bldVisible,
  localize,
  onChange,
  renderBooleanControl,
  stageVisible,
  value,
}: TimerAttemptSplitSettingsProps) {
  const row = (
    field: typeof STAGE_FIELD,
    enabled: boolean,
    hint: TimerSettingCopy,
    onToggle: (next: boolean) => void,
  ) => {
    const settingId = field.id as TimerSettingFieldId;
    const label = localize(field.copy);
    return (
      <SettingRow
        control={renderBooleanControl({ label, onChange: onToggle, settingId, value: enabled })}
        hint={localize(hint)}
        label={label}
        settingId={settingId}
      />
    );
  };

  return (
    <>
      {stageVisible && row(STAGE_FIELD, value.multiStage, COPY.stageHint, (multiStage) => onChange({ multiStage }))}
      {bldVisible && row(BLD_FIELD, value.bldMemo, COPY.bldHint, (bldMemo) => onChange({ bldMemo }))}
    </>
  );
}
