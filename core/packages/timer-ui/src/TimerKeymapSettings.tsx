import { useEffect, useMemo, useState } from 'react';
import { TIMER_ACTIONS, bindingsForAction, formatBinding, rebindTimerAction, resolveKeymap,
  timerRebindCaptureDecision, unbindTimerAction, timerSettingFieldContract,
  type TimerActionId, type TimerKeymapOverrides, type TimerSettingCopy } from '@cuberoot/shared/timer';
import './timer-keymap-settings.css';

export const TIMER_KEYMAP_SETTING_FIELD_IDS = ['settings.advanced.keymap', 'settings.advanced.reset-keymap'] as const;
/**
 * Keyboard-binding editor for the rebindable timer actions.
 *
 * Capture-on-press rather than an on-screen keyboard grid: /sim's keymap UI
 * uses a grid because its bindings are one key → one move, but the timer needs
 * `Shift+` combinations, which a flat grid cannot express. `keyLabel` (the part
 * that IS shared) is reused via `formatBinding`.
 *
 * Only Shift is offered as a modifier — Ctrl/Meta belong to the browser and the
 * OS, and shadowing Ctrl+D or Cmd+F would be hostile.
 */
export function TimerKeymapSettings({ value, onChange, localize: tr }: {
  value: TimerKeymapOverrides;
  onChange(update: (current: TimerKeymapOverrides) => TimerKeymapOverrides): void;
  localize(copy: TimerSettingCopy): string;
}) {

  const keymap = useMemo(() => resolveKeymap(value), [value]);
  const [capturing, setCapturing] = useState<TimerActionId | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const capture = timerRebindCaptureDecision(e);
      if (capture.kind === 'cancel') {
        setCapturing(null);
        setRejected(null);
        return;
      }
      if (capture.kind === 'wait-for-key') return;
      if (capture.kind === 'reject') {
        setRejected(capture.reason === 'browser-modifier'
          ? tr({ zh: 'Ctrl / Cmd / Alt 组合键留给浏览器，不能占用', en: 'Ctrl / Cmd / Alt combinations belong to the browser' })
          : tr({
              zh: `${formatBinding(capture.binding!)} 是计时器自己的按键（开始 / 停止 / 取消），不能改绑`,
              en: `${formatBinding(capture.binding!)} is the timer's own key (start / stop / cancel) and can't be rebound`,
            }));
        return;
      }
      onChange(current => rebindTimerAction(current, resolveKeymap(current), capturing, capture.binding));
      setCapturing(null);
      setRejected(null);
    };
    // Capture phase: the timer's own window listener must not see these.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, keymap, value, onChange, tr]);

  return (
    <div className="timer-keymap-settings" data-setting-id="settings.advanced.keymap" data-no-timer>
      {TIMER_ACTIONS.map(action => {
        const bindings = bindingsForAction(keymap, action.id);
        const active = capturing === action.id;
        return (
          <div className="settings-row" key={action.id}><span className="settings-row-label">{tr(action)}</span><span className="settings-row-control" role="group" aria-label={tr(action)}>
            <button
              type="button"
              className="keymap-bind-btn"
              data-capturing={active ? 'true' : undefined}
              onClick={() => { setCapturing(active ? null : action.id); setRejected(null); }}
            >
              {active
                ? tr({ zh: '按下新按键…（Esc 取消）', en: 'Press a key… (Esc to cancel)' })
                : bindings.length > 0
                  ? bindings.map(formatBinding).join(' / ')
                  : tr({ zh: '未绑定', en: 'Unbound' })}
            </button>
            {bindings.length > 0 && !active && (
              <button
                type="button"
                className="hint-btn"
                onClick={() => {
                  onChange(current => unbindTimerAction(current, resolveKeymap(current), action.id));
                }}
              >
                {tr({ zh: '解除', en: 'Unbind' })}
              </button>
            )}
          </span></div>
        );
      })}
      {rejected && <div className="keymap-reject">{rejected}</div>}
      <div className="keymap-actions">
        <button
          type="button"
          data-setting-id="settings.advanced.reset-keymap"
          className="hint-btn"
          onClick={() => onChange(() => ({}))}
        >
          {tr(timerSettingFieldContract('settings.advanced.reset-keymap').copy)}
        </button>
      </div>
    </div>
  );
}
