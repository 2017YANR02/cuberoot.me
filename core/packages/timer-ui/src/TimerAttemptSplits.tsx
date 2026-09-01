import {
  TIMER_SETTING_FIELD_CONTRACTS,
  formatMs,
  type TimerAttemptSplitOptions,
  type TimerAttemptSplitState,
  type TimerSettingCopy,
  type TimerSettingFieldId,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';

const COPY = {
  cross: { en: 'Cross', zh: '十字' },
  executing: { en: 'Executing…', zh: '执行中…' },
  memo: { en: 'Memo', zh: '记忆' },
  memoAction: { en: 'Memo… press Enter or tap', zh: '记忆中… 按 Enter 或点这里' },
  stageHint: {
    en: 'Press 1=Cross, 2=F2L, 3=OLL; auto-detected with a smart cube',
    zh: '按 1=Cross 完成，2=F2L，3=OLL；智能魔方连接时自动检测',
  },
  bldHint: {
    en: 'Press Enter while running to mark memo complete',
    zh: '运行中按 Enter 标记记忆完成',
  },
} as const satisfies Record<string, TimerSettingCopy>;

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
  const stageChip = (stage: 'cross' | 'f2l' | 'oll', label: string) => {
    const time = state.stages[stage];
    return time === undefined ? (
      <button
        aria-label={label}
        className="stage-chip stage-chip-action"
        data-no-timer
        onClick={(event) => {
          event.stopPropagation();
          onMarkStage(stage);
        }}
        type="button"
      >{label}</button>
    ) : (
      <span className={`stage-chip ${time === undefined ? '' : 'done'}`.trim()}>
        {label} {formatMs(time, precision)}
      </span>
    );
  };

  return (
    <>
      {multiStageActive && (
        <div className="timer-stage-splits">
          {stageChip('cross', localize(COPY.cross))}
          {stageChip('f2l', 'F2L')}
          {stageChip('oll', 'OLL')}
        </div>
      )}
      {bldMemoActive && (
        <div className="timer-stage-splits">
          {state.memoMs === undefined ? (
            <button
              className="stage-chip stage-chip-action"
              data-no-timer
              onClick={(event) => {
                event.stopPropagation();
                onMarkMemo();
              }}
              type="button"
            >{localize(COPY.memoAction)}</button>
          ) : (
            <>
              <span className="stage-chip done">
                {localize(COPY.memo)} {formatMs(state.memoMs, precision)}
              </span>
              <span className="stage-chip">{localize(COPY.executing)}</span>
            </>
          )}
        </div>
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
        <span className="hint timer-attempt-split-hint">{hint}</span>
      </span>
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
