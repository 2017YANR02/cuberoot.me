import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import PlaybackBar, { type PlaybackBarLabels } from '@cuberoot/timer-ui/PlaybackBar';
import { usePopoverDismiss } from '@cuberoot/timer-ui/popover-dismiss';
import { usePopoverPosition } from '@cuberoot/timer-ui/popover-position';
import { SIM_MAX_TPS, SIM_MIN_TPS } from '@cuberoot/puzzle-render-core/support/sim-timing';
import { STEP_DURATION_MS } from './replay-timing.js';
import type { Player, PlayerState } from './index.js';

export interface ReplayControlLabels extends PlaybackBarLabels {
  speed: string;
  speedPresets: string;
  settings: string;
  step: (current: number, total: number) => string;
}

const TURNS_PER_SECOND = 1000 / STEP_DURATION_MS;
const SPEED_PRESETS = [1, TURNS_PER_SECOND, 4, SIM_MAX_TPS];

function ReplaySpeed({ label, className, value, onChange }: {
  label: string;
  className: string;
  value: number;
  onChange: (tps: number) => void;
}) {
  return (
    <label className={`replay-speed ${className}`}>
      <span>TPS</span><span className="replay-speed-value" aria-hidden="true">{value.toFixed(1)}</span>
      <input type="range" min={SIM_MIN_TPS} max={SIM_MAX_TPS} step={0.1}
        aria-label={label} value={Math.max(SIM_MIN_TPS, Math.min(SIM_MAX_TPS, value))}
        onChange={event => onChange(event.currentTarget.valueAsNumber)} />
    </label>
  );
}

function ReplaySettings({ labels, speed, setSpeed }: {
  labels: ReplayControlLabels;
  speed: number;
  setSpeed: (tps: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelStyle = usePopoverPosition({ open, triggerRef, panelRef, side: 'top', align: 'end', contentKey: labels.settings });
  usePopoverDismiss(open, () => setOpen(false), panelRef, triggerRef);
  return (
    <div className="replay-settings">
      <button ref={triggerRef} type="button" part="settings" className="playback-bar-btn"
        aria-label={labels.settings} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Settings size={14} aria-hidden="true" />
      </button>
      {open && (
        <div ref={panelRef} role="dialog" aria-label={labels.settings} popover="manual"
          className="replay-settings-panel" data-site-surface="popover" style={panelStyle}>
          <ReplaySpeed className="replay-settings-speed" label={labels.speed} value={speed} onChange={setSpeed} />
          <div className="replay-speed-presets" role="group" aria-label={labels.speedPresets}>
            {SPEED_PRESETS.map(tps => (
              <button key={tps} type="button" className="playback-bar-btn" aria-pressed={speed === tps}
                onClick={() => { setSpeed(tps); setOpen(false); triggerRef.current?.focus(); }}>
                {tps} TPS
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReplayControls({ player, state, labels }: {
  player?: Player;
  state?: PlayerState;
  labels: ReplayControlLabels;
}) {
  const step = state?.step ?? 0;
  const total = state?.moveCount ?? 0;
  const speed = Math.min(Number.MAX_VALUE, (state?.playbackRate ?? 1) * TURNS_PER_SECOND);
  const setSpeed = (tps: number) => player?.setPlaybackRate(tps / TURNS_PER_SECOND);
  return (
    <PlaybackBar layout="balanced" step={step} total={total} playing={state?.playing ?? false}
      disabled={!state?.ready} labels={labels} scrubValueText={labels.step(step, total)}
      onScrub={next => player?.seek(next)}
      onSkipStart={() => player?.seek(0)}
      onStepBack={() => player?.seek(player.state.step - 1)}
      onTogglePlay={() => player?.state.playing ? player.pause() : player?.play()}
      onStepForward={() => player?.seek(player.state.step + 1)}
      onSkipEnd={() => player?.seek(player.state.moveCount)}
      leading={state?.ready
        ? <ReplaySpeed className="replay-speed-inline" label={labels.speed} value={speed} onChange={setSpeed} />
        : <span className="replay-speed-inline" />}
      trailing={state?.ready ? <ReplaySettings labels={labels} speed={speed} setSpeed={setSpeed} /> : <span />}
    />
  );
}
