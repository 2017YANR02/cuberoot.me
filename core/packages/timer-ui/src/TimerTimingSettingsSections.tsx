import {
  TIMER_SETTING_FIELD_CONTRACTS,
  normalizeTimerHoldMs,
  normalizeTimerResultPrecision,
  normalizeTimerRunningPrecision,
  normalizeTimerTimingSettings,
  type TimerSettingCopy,
  type TimerSettingFieldContract,
  type TimerSettingFieldId,
  type TimerTimingSettings,
} from '@cuberoot/shared/timer';
import { useId, type ReactNode } from 'react';

export interface TimerBooleanControlProps {
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  settingId: TimerSettingFieldId;
  value: boolean;
}

export interface TimerTimingSettingsSectionsProps {
  /** False keeps non-Timing settings categories out of the DOM, like Web SettingsPanel. */
  active?: boolean;
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerTimingSettings>) => void;
  /** Platform visual primitive; this shared component owns the row and setting behavior. */
  renderBooleanControl: (props: TimerBooleanControlProps) => ReactNode;
  value: TimerTimingSettings;
}

const TIMER_TIMING_SECTION_COPY = {
  eventsAndSessions: { en: 'Events and sessions', zh: '项目与分组' },
  timingDisplay: { en: 'Timing display', zh: '计时显示' },
} as const satisfies Record<string, TimerSettingCopy>;

type TimingStoragePath = keyof TimerTimingSettings;

function timingField(storagePath: TimingStoragePath): TimerSettingFieldContract {
  const field = TIMER_SETTING_FIELD_CONTRACTS.find((candidate) => (
    candidate.category === 'timer' && candidate.storagePath === storagePath
  ));
  if (!field) throw new Error(`Missing timer timing setting contract: ${storagePath}`);
  return field;
}

const TIMING_FIELDS = {
  timingEnabled: timingField('timingEnabled'),
  inspectionSec: timingField('inspectionSec'),
  holdMs: timingField('holdMs'),
  autoSessionForEvent: timingField('autoSessionForEvent'),
  autoEventForSession: timingField('autoEventForSession'),
  hideTime: timingField('hideTime'),
  runningPrecision: timingField('runningPrecision'),
  precision: timingField('precision'),
} as const satisfies Record<TimingStoragePath, TimerSettingFieldContract>;

/** Exact contract-derived set rendered by this shared UI. */
export const TIMER_TIMING_SETTING_FIELD_IDS: readonly TimerSettingFieldId[] =
  TIMER_SETTING_FIELD_CONTRACTS
    .filter((field) => field.category === 'timer')
    .map((field) => field.id as TimerSettingFieldId);

function numberEnumValues(field: TimerSettingFieldContract): readonly number[] {
  if (field.value.kind !== 'enum' || !field.value.values) {
    throw new Error(`Expected enum setting contract: ${field.id}`);
  }
  const values = field.value.values.filter((value): value is number => typeof value === 'number');
  if (values.length !== field.value.values.length) {
    throw new Error(`Expected numeric enum setting contract: ${field.id}`);
  }
  return values;
}

function integerRule(field: TimerSettingFieldContract): Required<Pick<
  NonNullable<TimerSettingFieldContract['value']>,
  'min' | 'max' | 'step'
>> {
  const { max, min, step } = field.value;
  if (field.value.kind !== 'integer' || min === undefined || max === undefined || step === undefined) {
    throw new Error(`Expected bounded integer setting contract: ${field.id}`);
  }
  return { max, min, step };
}

const INSPECTION_VALUES = numberEnumValues(TIMING_FIELDS.inspectionSec);
const INSPECTION_OFF = INSPECTION_VALUES.find((value) => value === 0) ?? 0;
const INSPECTION_ON = INSPECTION_VALUES.find((value) => value > 0);
if (INSPECTION_ON === undefined) {
  throw new Error(`Inspection setting requires an enabled value: ${TIMING_FIELDS.inspectionSec.id}`);
}

const HOLD_RULE = integerRule(TIMING_FIELDS.holdMs);
const RUNNING_PRECISION_VALUES = numberEnumValues(TIMING_FIELDS.runningPrecision);
const RESULT_PRECISION_VALUES = numberEnumValues(TIMING_FIELDS.precision);

function precisionLabel(value: number): string {
  return value === 0 ? 'x' : `x.${'x'.repeat(value)}`;
}

function TimerSettingsSection({
  children,
  headerControl,
  title,
}: {
  children: ReactNode;
  headerControl?: ReactNode;
  title?: string;
}) {
  return (
    <section className="settings-section">
      {(title || headerControl) && (
        <div className="settings-section-head">
          {title && <h4>{title}</h4>}
          {headerControl}
        </div>
      )}
      {children}
    </section>
  );
}

function TimerSettingRow({
  children,
  field,
  label,
}: {
  children: ReactNode;
  field: TimerSettingFieldContract;
  label: string;
}) {
  const labelId = useId();
  return (
    <div className="settings-row" data-setting-id={field.id}>
      <span id={labelId} className="settings-row-label">{label}</span>
      <span className="settings-row-control" role="group" aria-labelledby={labelId}>
        {children}
      </span>
    </div>
  );
}

export function TimerBooleanSettingRow({
  disabled = false,
  field,
  hint,
  label,
  onChange,
  renderBooleanControl,
  value,
}: {
  disabled?: boolean;
  field: TimerSettingFieldContract;
  hint?: ReactNode;
  label: string;
  onChange: (value: boolean) => void;
  renderBooleanControl: TimerTimingSettingsSectionsProps['renderBooleanControl'];
  value: boolean;
}) {
  return (
    <div className="settings-row settings-row-boolean" data-setting-id={field.id}>
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">
        {renderBooleanControl({
          disabled,
          label,
          onChange,
          settingId: field.id as TimerSettingFieldId,
          value,
        })}
        {hint && <span className="hint">{hint}</span>}
      </span>
    </div>
  );
}

/**
 * The complete Web `/timer` Timing category UI.
 *
 * Field identity, order, copy, value ranges and normalization come from the
 * runtime-neutral settings contract. Hosts only persist a patch and inject
 * their already-canonical switch primitive.
 */
export function TimerTimingSettingsSections({
  active = true,
  localize,
  onChange,
  renderBooleanControl,
  value,
}: TimerTimingSettingsSectionsProps) {
  if (!active) return null;
  const settings = normalizeTimerTimingSettings(value);
  const label = (field: TimerSettingFieldContract) => localize(field.copy);

  return (
    <>
      <TimerSettingsSection
        headerControl={(
          <span data-setting-id={TIMING_FIELDS.timingEnabled.id}>
            {renderBooleanControl({
              label: label(TIMING_FIELDS.timingEnabled),
              onChange: (timingEnabled) => onChange({ timingEnabled }),
              settingId: TIMING_FIELDS.timingEnabled.id as TimerSettingFieldId,
              value: settings.timingEnabled,
            })}
          </span>
        )}
      >
        <TimerBooleanSettingRow
          field={TIMING_FIELDS.inspectionSec}
          label={label(TIMING_FIELDS.inspectionSec)}
          onChange={(enabled) => onChange({ inspectionSec: enabled ? INSPECTION_ON : INSPECTION_OFF })}
          renderBooleanControl={renderBooleanControl}
          value={settings.inspectionSec > 0}
        />
        <TimerSettingRow field={TIMING_FIELDS.holdMs} label={label(TIMING_FIELDS.holdMs)}>
          <input
            className="settings-row-control-input"
            max={HOLD_RULE.max}
            min={HOLD_RULE.min}
            onChange={(event) => onChange({ holdMs: normalizeTimerHoldMs(Number(event.target.value)) })}
            step={HOLD_RULE.step}
            type="number"
            value={settings.holdMs}
          />
        </TimerSettingRow>
      </TimerSettingsSection>

      <TimerSettingsSection title={localize(TIMER_TIMING_SECTION_COPY.eventsAndSessions)}>
        <TimerBooleanSettingRow
          field={TIMING_FIELDS.autoSessionForEvent}
          label={label(TIMING_FIELDS.autoSessionForEvent)}
          onChange={(autoSessionForEvent) => onChange({ autoSessionForEvent })}
          renderBooleanControl={renderBooleanControl}
          value={settings.autoSessionForEvent}
        />
        <TimerBooleanSettingRow
          field={TIMING_FIELDS.autoEventForSession}
          label={label(TIMING_FIELDS.autoEventForSession)}
          onChange={(autoEventForSession) => onChange({ autoEventForSession })}
          renderBooleanControl={renderBooleanControl}
          value={settings.autoEventForSession}
        />
      </TimerSettingsSection>

      <TimerSettingsSection title={localize(TIMER_TIMING_SECTION_COPY.timingDisplay)}>
        <TimerBooleanSettingRow
          field={TIMING_FIELDS.hideTime}
          label={label(TIMING_FIELDS.hideTime)}
          onChange={(hideTime) => onChange({ hideTime })}
          renderBooleanControl={renderBooleanControl}
          value={settings.hideTime}
        />
      </TimerSettingsSection>

      <TimerSettingsSection title={label(TIMING_FIELDS.precision)}>
        <TimerSettingRow
          field={TIMING_FIELDS.runningPrecision}
          label={label(TIMING_FIELDS.runningPrecision)}
        >
          <select
            className="settings-row-control-select"
            onChange={(event) => onChange({
              runningPrecision: normalizeTimerRunningPrecision(Number(event.target.value)),
            })}
            value={settings.runningPrecision}
          >
            {RUNNING_PRECISION_VALUES.map((precision) => (
              <option key={precision} value={precision}>{precisionLabel(precision)}</option>
            ))}
          </select>
        </TimerSettingRow>
        <TimerSettingRow field={TIMING_FIELDS.precision} label={label(TIMING_FIELDS.precision)}>
          <select
            className="settings-row-control-select"
            onChange={(event) => onChange({
              precision: normalizeTimerResultPrecision(Number(event.target.value)),
            })}
            value={settings.precision}
          >
            {RESULT_PRECISION_VALUES.map((precision) => (
              <option key={precision} value={precision}>{precisionLabel(precision)}</option>
            ))}
          </select>
        </TimerSettingRow>
      </TimerSettingsSection>
    </>
  );
}
