'use client';

/**
 * Stackmat (microphone) connection panel.
 *
 * A Stackmat that "doesn't work" is almost always one of three things: the
 * browser is listening to the wrong input, the input level is too low, or the
 * cable is in the headphone jack. None of that is diagnosable from a menu item
 * that just says "listening", so this panel shows what the decoder actually
 * sees — input picker, live level, and whether frames are decoding — the same
 * information csTimer's Stackmat dialog exposes.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { ClearButton } from '../ClearButton';
import { useDeviceModal } from './use-device-modal';
import type { ExternalTimerLocalize } from './types';

import { formatMs } from '@cuberoot/shared/timer';
import type { StackmatHandle, StackmatInputDevice } from './use-stackmat';
import { STACKMAT_DIALOG_COPY as copy, STACKMAT_HEALTH_LABELS, STACKMAT_PHASE_LABELS, stackmatHealth, type StackmatHealth } from '@cuberoot/shared/timer/external/stackmat-state';

export interface StackmatModalProps {
  localize: ExternalTimerLocalize;
  compact?: boolean;
  stackmat: StackmatHandle;
  onClose: () => void;
  /**
   * A connection already started by the bottom microphone button. Keeping
   * getUserMedia() in that click makes the permission prompt immediate; this
   * modal observes the same promise so it can own progress and failure UI.
   */
  connectAttempt?: Promise<void> | null;
}

const HEALTH_COLOR: Record<StackmatHealth, string> = {
  off: 'var(--faint-foreground)',
  silent: 'var(--muted-foreground)',
  'wrong-signal': 'var(--signal-warning)',
  ok: 'var(--signal-success)',
};

function micErrorMessage(err: unknown, tr: ExternalTimerLocalize): string {
  const detail = typeof err === 'object' && err !== null
    ? err as { name?: unknown; message?: unknown }
    : null;
  const name = typeof detail?.name === 'string' ? detail.name : '';
  const message = typeof detail?.message === 'string' ? detail.message : String(err);
  return name === 'NotAllowedError'
    ? tr({ zh: '麦克风权限被拒绝。请在系统或网站权限设置中允许后重试。', en: 'Microphone access was denied. Allow it in system or site permissions and retry.' })
    : name === 'NotFoundError'
      ? tr({ zh: '没有找到音频输入设备。', en: 'No audio input device found.' })
      : message === 'mic-not-supported'
        ? tr({ zh: '当前环境无法采集麦克风，请检查系统权限；网页需使用 HTTPS。', en: 'Microphone capture is unavailable. Check system permissions; web pages require HTTPS.' })
        : tr({ zh: `麦克风启用失败：${message}`, en: `Mic error: ${message}` });
}

export default function StackmatModal({ stackmat, onClose, connectAttempt, localize: tr, compact = false }: StackmatModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = compact;
  const [devices, setDevices] = useState<StackmatInputDevice[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { status, signalLevel, start, stop, listInputDevices } = stackmat;
  const close = useCallback(() => { if(busy && !status.listening) stop(); onClose(); }, [busy, status.listening, stop, onClose]);
  const listening = status.listening;

  const refreshDevices = useCallback(() => {
    void listInputDevices().then(setDevices).catch(error => setError(micErrorMessage(error, tr)));
  }, [listInputDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // Device labels stay blank until mic permission is granted, so re-read the
  // list once we are listening.
  useEffect(() => { if (listening) refreshDevices(); }, [listening, refreshDevices]);



  useEffect(() => {
    if (!connectAttempt) return;
    let active = true;
    setBusy(true);
    setError('');
    void connectAttempt.then(
      () => {
        if (active) setBusy(false);
      },
      (err: unknown) => {
        if (!active) return;
        setError(micErrorMessage(err, tr));
        setBusy(false);
      },
    );
    return () => { active = false; };
  }, [connectAttempt]);

  const begin = useCallback(async (deviceId?: string) => {
    setBusy(true);
    setError('');
    try {
      await start(deviceId);
    } catch (err) {
      setError(micErrorMessage(err, tr));
    } finally {
      setBusy(false);
    }
  }, [start]);

  const onPickDevice = useCallback(async (deviceId: string) => {
    stop();
    await begin(deviceId);
  }, [begin, stop]);

  const health = stackmatHealth({ ...status, signalLevel });

  const backdrop = useDeviceModal(dialogRef, close);
  return (
    <div data-no-timer {...backdrop} className="timer-modal-overlay" style={isMobile ? { padding: 8 } : undefined}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        data-site-surface="popover" className="timer-modal stackmat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile ? { padding: 14, maxWidth: '100%' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="bt-timer-heading">
          <Mic size={20} />
          {tr(copy.title)}
        </h2>

        <div className="modal-section">
          <p style={{ margin: 0 }}>
            {tr(copy.instructions)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>
            {tr(copy.compatibility)}
          </p>
        </div>

        <div className="modal-section">
          <div className="stackmat-health-summary" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              aria-hidden
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: HEALTH_COLOR[health],
                flex: '0 0 auto',
              }}
            />
            <span style={{ color: HEALTH_COLOR[health] }}>{tr(STACKMAT_HEALTH_LABELS[health])}</span>
          </div>

          {listening && (
            <>
              {/* Input level meter — the fastest way to tell "wrong input" from
                  "nothing plugged in". */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: '3.5em' }}>
                  {tr(copy.level)}
                </span>
                <span
                  style={{
                    display: 'block', height: 6, width: 160, maxWidth: '50vw', borderRadius: 3,
                    background: 'color-mix(in srgb, var(--foreground) 10%, transparent)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block', height: '100%',
                      width: `${Math.min(100, Math.round(signalLevel * 100))}%`,
                      background: health === 'ok' ? 'var(--signal-success)' : 'var(--accent)',
                      transition: 'width 80ms linear',
                    }}
                  />
                </span>
              </div>

              <dl
                style={{
                  margin: '10px 0 0', display: 'grid',
                  gridTemplateColumns: 'max-content max-content', gap: '4px 14px',
                  fontSize: 13,
                }}
              >
                <dt style={{ color: 'var(--muted-foreground)' }}>{tr(copy.state)}</dt>
                <dd style={{ margin: 0 }}>{tr(STACKMAT_PHASE_LABELS[status.phase])}</dd>
                <dt style={{ color: 'var(--muted-foreground)' }}>{tr(copy.reading)}</dt>
                <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {status.signalPresent ? formatMs(status.ms) : '—'}
                </dd>
                <dt
                  aria-hidden={status.unit === 0}
                  style={{ color: 'var(--muted-foreground)', visibility: status.unit === 0 ? 'hidden' : undefined }}
                >
                  {tr(copy.resolution)}
                </dt>
                <dd
                  aria-hidden={status.unit === 0}
                  style={{ margin: 0, visibility: status.unit === 0 ? 'hidden' : undefined }}
                >
                  {status.unit === 1
                    ? tr(copy.ms)
                    : tr(copy.cs)}
                </dd>
              </dl>
            </>
          )}

          {listening && (
            <p className="stackmat-health-guidance" style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>
              {health === 'wrong-signal'
                ? tr(copy.wrongSignal)
                : health === 'silent'
                  ? tr(copy.silent)
                  : '\u00a0'}
            </p>
          )}
        </div>

        {listening && (
          <div className="modal-section">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                {tr(copy.input)}
              </span>
              <select
                value={status.deviceId}
                disabled={busy}
                onChange={(e) => { void onPickDevice(e.target.value); }}
                style={{ width: 'fit-content', maxWidth: '100%', fontSize: 14, padding: '4px 6px' }}
              >
                <option value="">{tr(copy.defaultInput)}</option>
                {devices.filter(d => d.deviceId && d.deviceId !== 'default').map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && (
          <div className="modal-section">
            <p style={{ fontSize: 12, color: 'var(--destructive)', margin: 0 }}>{error}</p>
          </div>
        )}

        <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
          {listening ? (
            <button className="modal-action-btn" onClick={stop}>
              {tr(copy.stop)}
            </button>
          ) : (
            <button className="primary modal-action-btn" disabled={busy} onClick={() => { void begin(); }}>
              {busy ? tr(copy.starting) : tr(copy.start)}
            </button>
          )}
          <ClearButton
            variant="standalone"
            ariaLabel={tr(copy.close)}
            onClick={close}
          />
        </div>
      </div>
    </div>
  );
}
