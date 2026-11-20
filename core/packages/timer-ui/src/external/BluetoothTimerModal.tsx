'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ClearButton } from '../ClearButton';
import { Bluetooth, ExternalLink } from 'lucide-react';
import { useDeviceModal } from './use-device-modal';
import type { ExternalTimerLocalize } from './types';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import { BLUETOOTH_TIMER_DIALOG_COPY as copy, BLUETOOTH_TIMER_KIND_LABELS, BLUETOOTH_TIMER_STATE_LABELS, bluetoothTimerMacInstructions } from '@cuberoot/shared/timer/device-contract';
import type { BluetoothTimerHandle } from './use-bluetooth-timer';
import { formatMs } from '@cuberoot/shared/timer';

export interface BluetoothTimerModalProps {
  localize: ExternalTimerLocalize;
  compact?: boolean;
  devices?: readonly {id: string; name: string; rssi?: number}[];
  onSelectDevice?(id: string): void;
  supported?: boolean;
  advice?: { title: {en:string;zh:string}; body: {en:string;zh:string}; url?: string; urlLabel?: {en:string;zh:string} } | null;
  timer: Pick<BluetoothTimerHandle, "status" | "connect" | "disconnect">;
  /** Connection already started by the bottom Bluetooth button's user gesture. */
  connectAttempt?: Promise<void> | null;
  macPrompt: { deviceName: string; suggestedMac?: string } | null;
  onSubmitMac: (mac: string) => void;
  onCancelMac: () => void;
  onClose: () => void;
}

function connectErrorMessage(err: unknown, tr: ExternalTimerLocalize): string {
  const e = err instanceof Error ? err : new Error(String(err));
  if (e.name === 'SecurityError') {
    return tr({
      zh: '浏览器不允许访问蓝牙。请确认页面使用 HTTPS，并检查网站权限。',
      en: 'The browser blocked Bluetooth. Make sure the page uses HTTPS and check site permissions.',
    });
  }
  if (e.name === 'NetworkError') {
    return tr({
      zh: '蓝牙连接失败。请确认计时器已开机、靠近设备，并且没有连接到其他 App。',
      en: 'Bluetooth connection failed. Keep the timer powered on and nearby, and disconnect it from other apps.',
    });
  }
  return tr({ zh: `连接失败：${e.message}`, en: `Connection failed: ${e.message}` });
}

export default function BluetoothTimerModal({
  timer, devices, onSelectDevice,
  localize: tr, compact = false, supported = true, advice,
  connectAttempt,
  macPrompt,
  onSubmitMac,
  onCancelMac,
  onClose,
}: BluetoothTimerModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = compact;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState('');

  const connected = timer.status.connected;
  const close = useCallback(() => {
    if (macPrompt) onCancelMac();
    if (busy && !connected) timer.disconnect();
    onClose();
  }, [macPrompt, onCancelMac, onClose, busy, connected, timer]);



  useEffect(() => {
    if (!macPrompt) return;
    setMacInput(macPrompt.suggestedMac ?? '');
    setMacError('');
  }, [macPrompt]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await timer.connect();
    } catch (err) {
      if ((err as { kind?: unknown } | null)?.kind !== 'no-web-bluetooth') {
        setError(connectErrorMessage(err, tr));
      }
    } finally {
      setBusy(false);
    }
  }, [timer]);

  useEffect(() => {
    if (!connectAttempt) return;
    let active = true;
    setBusy(true);
    setError('');
    void connectAttempt.then(
      () => { if (active) setBusy(false); },
      (reason: unknown) => {
        if (!active) return;
        if ((reason as { kind?: unknown } | null)?.kind !== 'no-web-bluetooth') {
          setError(connectErrorMessage(reason, tr));
        }
        setBusy(false);
      },
    );
    return () => { active = false; };
  }, [connectAttempt]);

  const submitMac = useCallback(() => {
    const normalized = normalizeMac(macInput);
    if (!normalized) {
      setMacError(tr(copy.invalidMac));
      return;
    }
    onSubmitMac(normalized);
  }, [macInput, onSubmitMac]);



  const backdrop = useDeviceModal(dialogRef, close);
  return (
    <div data-no-timer {...backdrop} className="timer-modal-overlay" style={isMobile ? { padding: 8 } : undefined}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        data-site-surface="popover" className="timer-modal bluetooth-modal bt-timer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="bt-timer-heading">
          <Bluetooth size={20} />
          {tr(copy.title)}
        </h2>

        {macPrompt && (
          <div className="modal-section">
            <p style={{ marginTop: 0 }}>
              {tr(bluetoothTimerMacInstructions(macPrompt.deviceName))}
            </p>
            <input
              value={macInput}
              onChange={(event) => {
                setMacInput(event.target.value);
                setMacError('');
              }}
              onKeyDown={(event) => { if (event.key === 'Enter') submitMac(); }}
              aria-label={tr(copy.macLabel)}
              placeholder="AA:BB:CC:DD:EE:FF"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              style={{ width: 'min(100%, 20em)' }}
            />
            {macInput && <ClearButton ariaLabel={tr(copy.clearMac)} onClick={() => { setMacInput(''); setMacError(''); }} />}
            {macError && <p className="bt-error-detail">{macError}</p>}
            <p className="bt-tip">
              {tr(copy.macTip)}
            </p>
            <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
              <button className="primary modal-action-btn" onClick={submitMac}>
                {tr(copy.submitMac)}
              </button>
              <button className="modal-action-btn" onClick={onCancelMac}>
                {tr(copy.cancelMac)}
              </button>
            </div>
          </div>
        )}

        {!macPrompt && !supported && advice && (
          <>
            <div className="modal-section bt-warn">
              <h3 className="bt-warn-title">{tr(advice.title)}</h3>
              <p>{tr(advice.body)}</p>
            </div>
            {advice.url && (
              <div className="modal-section">
                <a className="bt-install-btn" href={advice.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} />
                  <span>{advice.urlLabel ? tr(advice.urlLabel) : advice.url}</span>
                </a>
              </div>
            )}
          </>
        )}

        {!macPrompt && supported && !connected && (
          <div className="modal-section">
            <p style={{ marginTop: 0 }}>
              {tr(copy.instructions)}
            </p>
            <p className="bt-tip">
              {tr(copy.supported)}
            </p>
            <button className="bt-connect-btn" disabled={busy} onClick={() => { void connect(); }}>
              <Bluetooth size={14} />
              <span>{tr(busy ? copy.connecting : copy.connect)}</span>
            </button>
            {busy && devices && <div role="list" aria-label={tr(copy.available)}>
              {devices.map(device => <div role="listitem" key={device.id}><button className="bt-connect-btn" onClick={() => onSelectDevice?.(device.id)}>{device.name}</button></div>)}
              {devices.length === 0 && <p>{tr(copy.searching)}</p>}
            </div>}
            {error && <p className="bt-error-detail">{error}</p>}
          </div>
        )}

        {!macPrompt && supported && connected && (
          <>
            <div className="modal-section bt-connected-summary">
              <div className="bt-connected-primary">
                <strong className="bt-connected-device">{timer.status.deviceName}</strong>
                <span className="bt-value bt-connected-state ok">
                  {tr({ zh: '已连接', en: 'Connected' })}
                </span>
              </div>
              <dl style={{ margin: '10px 0 0', display: 'grid', gridTemplateColumns: 'max-content max-content', gap: '4px 14px' }}>
                <dt className="bt-label">{tr(copy.device)}</dt>
                <dd style={{ margin: 0 }}>{tr(BLUETOOTH_TIMER_KIND_LABELS[timer.status.kind])}</dd>
                <dt className="bt-label">{tr(copy.state)}</dt>
                <dd style={{ margin: 0 }}>{tr(BLUETOOTH_TIMER_STATE_LABELS[timer.status.state])}</dd>
                <dt className="bt-label">{tr(copy.lastResult)}</dt>
                <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {timer.status.lastTimeMs > 0 ? formatMs(timer.status.lastTimeMs) : '—'}
                </dd>
              </dl>
            </div>
            <p className="modal-section bt-connected-help">
              {tr(copy.connectedHelp)}
            </p>
          </>
        )}

        {!macPrompt && (
          <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
            {connected && (
              <button className="danger modal-action-btn" onClick={timer.disconnect}>
                {tr({ zh: '断开', en: 'Disconnect' })}
              </button>
            )}
            <button className="modal-action-btn" onClick={close}>
              {tr({ zh: '关闭', en: 'Close' })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
