import BoolToggle from './BoolToggle';
import './compact-select.css';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { eventInfo, formatTargetTime, parseTargetTime, parseDailySolveGoal, timerSettingFieldContract,
  type EventId, type RoundConfig, type RoundFormat, type TimerSettingCopy, type TimerSettingFieldId, type TimerTrainingSettings } from '@cuberoot/shared/timer';
import { TimerSettingRow, TimerSettingsSection } from './TimerTimingSettingsSections';

export const TIMER_TRAINING_SETTING_FIELD_IDS = [
  'settings.training.target-time', 'settings.training.daily-goal', 'settings.training.round-enabled',
  'settings.training.round-format', 'settings.training.round-cutoff', 'settings.training.round-time-limit',
  'settings.training.round-cumulative',
] as const satisfies readonly TimerSettingFieldId[];

interface Props {
  value: TimerTrainingSettings;
  onChange(patch: Partial<TimerTrainingSettings>): void;
  localize(copy: TimerSettingCopy): string;
}

/** Original Web editing semantics, shared with all installed clients. */
export function TimerGoalSettings({ value: s, onChange: updateSettings, localize: tr, event }: Props & { event: EventId }) {
  // Target-time input is a free-form string while editing; commit on blur /
  // Enter. Empty / invalid / non-positive → clear the per-event target.
  const currentTargetMs: number | null = (() => {
    const v = s.targetMsByEvent[event];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  })();
  const [targetInput, setTargetInput] = useState<string>(() => formatTargetTime(currentTargetMs));
  // Keep input in sync when user changes event while modal is open.
  useEffect(() => {
    setTargetInput(formatTargetTime(currentTargetMs));
  }, [event, currentTargetMs]);

  function commitTargetInput(raw: string): void {
    const parsed = parseTargetTime(raw);
    const next = { ...s.targetMsByEvent };
    if (parsed === null) {
      delete next[event];
    } else {
      next[event] = parsed;
    }
    updateSettings({ targetMsByEvent: next });
    setTargetInput(formatTargetTime(parsed));
  }

  // Daily solve-count goal — free-form string while editing, commit on
  // blur / Enter. Empty / 0 / non-positive → null (disable the pill).
  const currentDailyGoal: number | null =
    typeof s.dailySolveGoal === 'number' && Number.isFinite(s.dailySolveGoal) && s.dailySolveGoal > 0
      ? Math.floor(s.dailySolveGoal)
      : null;
  const [goalInput, setGoalInput] = useState<string>(() =>
    currentDailyGoal === null ? '' : String(currentDailyGoal),
  );
  useEffect(() => {
    setGoalInput(currentDailyGoal === null ? '' : String(currentDailyGoal));
  }, [currentDailyGoal]);
  function commitGoalInput(raw: string): void {
    const parsed = parseDailySolveGoal(raw);
    updateSettings({ dailySolveGoal: parsed });
    setGoalInput(parsed === null ? '' : String(parsed));
  }

  return <>
          <TimerSettingRow field={timerSettingFieldContract('settings.training.target-time')} label={tr(timerSettingFieldContract('settings.training.target-time').copy)}>
            <input
              className="settings-row-control-input"
              type="text"
              value={targetInput}
              placeholder={tr({ zh: '例：0:10.50（留空关闭）', en: 'e.g. 0:10.50 (blank = off)'
            })}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => commitTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTargetInput((e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
            <span className="hint">
              <Target size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {currentTargetMs === null
                ? tr({ zh: `当前 ${eventInfo(event).nameZh}：关闭`, en: `${eventInfo(event).nameEn}: off` })
                : tr({ zh: `当前 ${eventInfo(event).nameZh}：${formatTargetTime(currentTargetMs)}`, en: `${eventInfo(event).nameEn}: ${formatTargetTime(currentTargetMs)}` })}
            </span>
          </TimerSettingRow>
          <TimerSettingRow field={timerSettingFieldContract('settings.training.daily-goal')} label={tr(timerSettingFieldContract('settings.training.daily-goal').copy)}>
            <input
              className="settings-row-control-input"
              type="number"
              min={0}
              step={1}
              value={goalInput}
              placeholder={tr({ zh: '例：50（留空 / 0 关闭）', en: 'e.g. 50 (blank / 0 = off)'
            })}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={(e) => commitGoalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitGoalInput((e.target as HTMLInputElement).value); }}
            />
            <span className="hint">{currentDailyGoal === null
              ? tr({ zh: '关闭', en: 'off'
                                      })
              : tr({ zh: `每天 ${currentDailyGoal} 次（全部项目合计）`, en: `${currentDailyGoal} solves/day (all events)` })}</span>
          </TimerSettingRow>

  </>;
}

export function TimerRoundSettings({ value: s, onChange, localize: tr }: Omit<Props, 'onChange'> & { onChange(patch: Partial<RoundConfig>): void }) {
  const settingLabel = (id: TimerSettingFieldId) => tr(timerSettingFieldContract(id).copy);
  // Round-simulation cutoff / time limit. Free-form while editing, committed on
  // blur or Enter, exactly like the target-time field above — and parsed by the
  // same `parseTargetTime`, so `1:00`, `60`, `10.50` all mean what they look like.
  const [roundCutoffInput, setRoundCutoffInput] = useState<string>(() => formatTargetTime(s.round.cutoffMs));
  const [roundLimitInput, setRoundLimitInput] = useState<string>(() => formatTargetTime(s.round.limitMs));
  useEffect(() => {
    setRoundCutoffInput(formatTargetTime(s.round.cutoffMs));
  }, [s.round.cutoffMs]);
  useEffect(() => {
    setRoundLimitInput(formatTargetTime(s.round.limitMs));
  }, [s.round.limitMs]);
  function commitRoundLimitField(field: 'cutoffMs' | 'limitMs', raw: string): void {
    const parsed = parseTargetTime(raw);
    onChange({ [field]: parsed });
    (field === 'cutoffMs' ? setRoundCutoffInput : setRoundLimitInput)(formatTargetTime(parsed));
  }

  return (
        <TimerSettingsSection

          title={tr({ zh: '轮次模拟', en: 'Round simulation' })}
          headerControl={
            <span data-setting-id="settings.training.round-enabled">
              <BoolToggle
                label=""
                value={s.round.on}
                onChange={on => onChange({ on })}
                ariaLabel={settingLabel('settings.training.round-enabled')}
              />
            </span>
          }
        >
          {s.round.on && (
            <>
          <TimerSettingRow field={timerSettingFieldContract('settings.training.round-format')} label={tr(timerSettingFieldContract('settings.training.round-format').copy)}>
            <select
              className="settings-row-control-select"
              value={s.round.format}
              onChange={(e) => onChange({ format: e.target.value as RoundFormat })}
            >
              <option value="ao5">{tr({ zh: '五次去头尾平均 (ao5)', en: 'Average of 5' })}</option>
              <option value="mo3">{tr({ zh: '三次均值 (mo3)', en: 'Mean of 3' })}</option>
              <option value="bo3">{tr({ zh: '三次取最好 (bo3)', en: 'Best of 3' })}</option>
              <option value="bo1">{tr({ zh: '一次 (bo1)', en: 'Best of 1' })}</option>
            </select>
          </TimerSettingRow>
          <TimerSettingRow field={timerSettingFieldContract('settings.training.round-cutoff')} label={tr(timerSettingFieldContract('settings.training.round-cutoff').copy)}>
            <input
              className="settings-row-control-input"
              type="text"
              value={roundCutoffInput}
              placeholder={tr({ zh: '留空 = 无', en: 'blank = none' })}
              onChange={(e) => setRoundCutoffInput(e.target.value)}
              onBlur={(e) => commitRoundLimitField('cutoffMs', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRoundLimitField('cutoffMs', (e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </TimerSettingRow>
          <TimerSettingRow field={timerSettingFieldContract('settings.training.round-time-limit')} label={tr(timerSettingFieldContract('settings.training.round-time-limit').copy)}>
            <input
              className="settings-row-control-input"
              type="text"
              value={roundLimitInput}
              placeholder={tr({ zh: '留空 = 无', en: 'blank = none' })}
              onChange={(e) => setRoundLimitInput(e.target.value)}
              onBlur={(e) => commitRoundLimitField('limitMs', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRoundLimitField('limitMs', (e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
            <span data-setting-id="settings.training.round-cumulative">
              <select
                value={String(s.round.cumulative)}
                onChange={event => { const v = event.currentTarget.value === 'true'; onChange({ cumulative: v }); }}
                aria-label={settingLabel('settings.training.round-cumulative')}
                className="native-select"
              >
                <option value="true">{tr({ zh: '累计', en: 'cumulative' })}</option>
                <option value="false">{tr({ zh: '每把', en: 'per attempt' })}</option>
              </select>
            </span>
          </TimerSettingRow>
            </>
          )}
        </TimerSettingsSection>
  );
}
