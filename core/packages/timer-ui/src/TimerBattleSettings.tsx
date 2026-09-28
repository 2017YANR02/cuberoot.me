import { useEffect, useState, type ReactNode } from 'react';
import { isLocalBattleAssignableKey } from '@cuberoot/shared/timer';
import BoolToggle from './BoolToggle';
import { TimerRoomDialog } from './TimerRoomDialog';

interface Setting<T> { value: T; onChange(value: T): void }
export interface TimerBattleSettingsProps {
  language: 'en' | 'zh';
  onClose(): void;
  keys: readonly string[];
  onKeyChange(playerId: number, key: string): void;
  precision?: Setting<number> & { options?: readonly number[] };
  inspection?: Setting<number> & { options?: readonly number[] };
  hold?: Setting<number>;
  preview?: Setting<boolean>;
  hideTime?: Setting<boolean>;
  source?: ReactNode;
  devices?: ReactNode;
  children?: ReactNode;
}
const COPY = {
  en: { settings: 'Settings', keys: 'Key bindings', player: 'Player', press: 'Press a key…', space: 'Space', precision: 'Precision', inspection: 'Inspection', off: 'Off', hold: 'Hold to start', preview: 'Show scramble preview', hide: 'Hide running time' },
  zh: { settings: '设置', keys: '按键', player: '玩家', press: '按任意键…', space: '空格', precision: '精度', inspection: '观察', off: '关闭', hold: '按住起表', preview: '显示打乱图', hide: '隐藏计时读数' },
};
export function TimerBattleKeyBindings({ language, keys, onChange }: { language: 'en' | 'zh'; keys: readonly string[]; onChange(playerId: number, key: string): void }) {
  const copy = COPY[language];
  const [recording, setRecording] = useState<number | null>(null);
  useEffect(() => {
    if (recording === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape') { setRecording(null); return; }
      if (!isLocalBattleAssignableKey(event.key) || event.repeat) return;
      onChange(recording, event.key); setRecording(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, onChange]);
  return <fieldset className="timer-battle-key-bindings"><legend>{copy.keys}</legend>{keys.map((key, id) => <div key={id}>
    <span>{copy.player} {id + 1}</span><button type="button" aria-pressed={recording === id} onClick={() => setRecording(recording === id ? null : id)}>
      {recording === id ? copy.press : key === ' ' ? copy.space : key.length === 1 ? key.toUpperCase() : key}
    </button>
  </div>)}</fieldset>;
}
export function TimerBattleSettings({ language, onClose, keys, onKeyChange, precision, inspection, hold, preview, hideTime, source, devices, children }: TimerBattleSettingsProps) {
  const copy = COPY[language];
  return <TimerRoomDialog title={copy.settings} language={language} onClose={onClose}>
    <div className="timer-battle-settings">
      {source}
      {precision && <label>{copy.precision}<select value={precision.value} onChange={(event) => precision.onChange(Number(event.target.value))}>{(precision.options ?? [0, 1, 2, 3]).map((value) => <option value={value} key={value}>{(10 ** -value).toFixed(value)}s</option>)}</select></label>}
      {inspection && <label>{copy.inspection}<select value={inspection.value} onChange={(event) => inspection.onChange(Number(event.target.value))}>{(inspection.options ?? [0, 15]).map((value) => <option value={value} key={value}>{value === 0 ? copy.off : value === 9999 ? '∞' : `${value}s`}</option>)}</select></label>}
      {hold && <label>{copy.hold}<span>{(hold.value / 1000).toFixed(2)}s</span><input type="range" min={0} max={1000} step={50} value={hold.value} onChange={(event) => hold.onChange(Number(event.target.value))} /></label>}
      {preview && <BoolToggle label={copy.preview} {...preview} />}
      {hideTime && <BoolToggle label={copy.hide} {...hideTime} />}
      <TimerBattleKeyBindings language={language} keys={keys} onChange={onKeyChange} />
      {devices}
      {children}
    </div>
  </TimerRoomDialog>;
}
