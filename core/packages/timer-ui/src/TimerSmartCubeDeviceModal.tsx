import { Bluetooth, Check, RefreshCw, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { modalFocusableElements } from './modal-focus';
import type { TimerUiLanguage } from './TimerColorSubsetPicker';
import type { TimerDeviceCapabilities } from '@cuberoot/shared/timer/device-contract';

export type TimerSmartCubeConnectionPhase =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'error';

export interface TimerSmartCubeDeviceSnapshot {
  battery?: number | null;
  deviceName?: string | null;
  hasGyro?: boolean;
  lastMove?: string | null;
  phase: TimerSmartCubeConnectionPhase;
  protocol?: string | null;
  solved?: boolean | null;
}

export interface TimerSmartCubeAvailableDevice {
  id: string;
  name: string;
  rssi?: number;
}

export interface TimerSmartCubeDeviceModalProps {
  availableDevices?: readonly TimerSmartCubeAvailableDevice[];
  capabilities?: TimerDeviceCapabilities;
  className?: string;
  connectionFailure?: ReactNode;
  intro?: ReactNode;
  language: TimerUiLanguage;
  onClose(): void;
  onConnect?(deviceId?: string): Promise<void> | void;
  onDisconnect?(): Promise<void> | void;
  onResetGyro?(): void;
  onResetState?(): Promise<void> | void;
  onScan?(): Promise<void> | void;
  overrideBody?: ReactNode;
  scanning?: boolean;
  snapshot: TimerSmartCubeDeviceSnapshot;
  title?: string;
}

const COPY = {
  en: {
    battery: 'Battery',
    availableDevices: 'Available devices',
    cancel: 'Cancel',
    close: 'Close',
    connect: 'Connect',
    connected: (solved: boolean | null | undefined) => solved === null || solved === undefined
      ? 'Connected'
      : `Connected, ${solved ? 'solved' : 'unsolved'}`,
    connecting: 'Connecting…',
    connectionFailed: 'Connection failed',
    deviceFallback: 'Smart cube',
    disconnect: 'Disconnect',
    lastMove: 'Last move',
    notConnected: 'Not connected',
    noDevices: 'No supported smart cubes found',
    protocol: 'Protocol',
    resetFailed: 'Software state was reset, but writing to the device failed. Check the connection and retry.',
    resetGyro: 'Reset gyroscope',
    resetGyroHint: 'Hold white on top and green in front, then reset the gyroscope',
    resetState: 'Reset state',
    retry: 'Retry connection',
    scanAgain: 'Scan again',
    scanning: 'Scanning…',
    signalGood: 'Good signal',
    signalLow: 'Weak signal',
    signalMedium: 'Fair signal',
    stateReset: 'State reset',
    title: 'Smart cube',
  },
  zh: {
    battery: '电量',
    availableDevices: '可用设备',
    cancel: '取消',
    close: '关闭',
    connect: '连接',
    connected: (solved: boolean | null | undefined) => solved === null || solved === undefined
      ? '已连接'
      : `已连接，${solved ? '已还原' : '未还原'}`,
    connecting: '连接中…',
    connectionFailed: '连接失败',
    deviceFallback: '智能魔方',
    disconnect: '断开',
    lastMove: '最近一步',
    notConnected: '未连接',
    noDevices: '未发现支持的智能魔方',
    protocol: '协议',
    resetFailed: '软件状态已重置，但设备回写失败，请检查连接后重试',
    resetGyro: '重置陀螺仪',
    resetGyroHint: '按白顶绿前握好魔方，再重置陀螺仪',
    resetState: '重置状态',
    retry: '重新连接',
    scanAgain: '重新扫描',
    scanning: '正在扫描…',
    signalGood: '信号良好',
    signalLow: '信号较弱',
    signalMedium: '信号一般',
    stateReset: '状态已重置',
    title: '智能魔方',
  },
} as const;

type DeviceAction = 'connect' | 'disconnect' | 'reset' | null;

/** Shared smart-cube status and recovery surface. Hosts only provide transport actions. */
export function TimerSmartCubeDeviceModal({
  availableDevices,
  capabilities,
  className,
  connectionFailure,
  intro,
  language,
  onClose,
  onConnect,
  onDisconnect,
  onResetGyro,
  onResetState,
  onScan,
  overrideBody,
  scanning = false,
  snapshot,
  title,
}: TimerSmartCubeDeviceModalProps) {
  const copy = COPY[language];
  const [action, setAction] = useState<DeviceAction>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const backdropStartedOutsideRef = useRef(false);
  const closeBlockedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  onCloseRef.current = onClose;

  const connected = snapshot.phase === 'connected';
  const canConnect = capabilities ? capabilities.connect === true : onConnect !== undefined;
  const canDisconnect = capabilities ? capabilities.disconnect === true : onDisconnect !== undefined;
  const canReset = capabilities ? capabilities.reset === true : onResetState !== undefined;
  const canResetGyro = capabilities ? capabilities.gyro === true : onResetGyro !== undefined;
  const canScan = capabilities ? capabilities.scan === true : onScan !== undefined;
  const listMode = availableDevices !== undefined && canScan && onScan !== undefined;
  const connecting = action === 'connect'
    || snapshot.phase === 'requesting'
    || snapshot.phase === 'connecting';
  const closeBlocked = action === 'disconnect' || action === 'reset';
  closeBlockedRef.current = closeBlocked;

  useEffect(() => {
    mountedRef.current = true;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFirst = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const autofocus = dialog.querySelector<HTMLElement>('[data-autofocus]');
      (autofocus ?? modalFocusableElements(dialog)[0] ?? dialog).focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeBlockedRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = modalFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    focusFirst();
    return () => {
      mountedRef.current = false;
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const autofocus = dialog.querySelector<HTMLElement>('[data-autofocus]');
    autofocus?.focus();
  }, [overrideBody !== undefined]);

  const runConnect = async (deviceId?: string) => {
    if (!onConnect || action !== null) return;
    setFeedback(null);
    setAction('connect');
    setConnectingDeviceId(deviceId ?? '');
    try {
      await onConnect(deviceId);
    } catch {
      // The host owns transport-specific failure state and copy. This catch
      // keeps a rejected picker/GATT attempt from becoming an unhandled task.
    } finally {
      if (mountedRef.current) {
        setAction(null);
        setConnectingDeviceId(null);
      }
    }
  };

  const runScan = async () => {
    if (!onScan || action !== null || scanning) return;
    setFeedback(null);
    try {
      await onScan();
    } catch {
      // The host exposes scan failures through its connection phase and copy.
    }
  };

  const resetState = async () => {
    if (!onResetState || action !== null) return;
    setFeedback(null);
    setAction('reset');
    try {
      await onResetState();
      if (mountedRef.current) setFeedback(copy.stateReset);
    } catch {
      if (mountedRef.current) setFeedback(copy.resetFailed);
    } finally {
      if (mountedRef.current) setAction(null);
    }
  };

  const disconnect = async () => {
    if (!onDisconnect || action !== null) return;
    setFeedback(null);
    setAction('disconnect');
    try {
      await onDisconnect();
      if (mountedRef.current) onCloseRef.current();
    } catch {
      // Keep the status surface open so the host can expose its latest state.
    } finally {
      if (mountedRef.current) setAction(null);
    }
  };

  const stateText = connecting
    ? copy.connecting
    : connected
      ? copy.connected(snapshot.solved)
      : snapshot.phase === 'error' || connectionFailure
        ? copy.connectionFailed
        : copy.notConnected;
  const stateClass = connected && snapshot.solved === true
    ? ' is-ok'
    : connected && snapshot.solved === false
      ? ' is-error'
      : '';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="timer-smart-cube-device__overlay"
      onPointerCancel={() => { backdropStartedOutsideRef.current = false; }}
      onPointerDownCapture={(event) => {
        backdropStartedOutsideRef.current = event.button === 0
          && event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const startedOutside = backdropStartedOutsideRef.current;
        backdropStartedOutsideRef.current = false;
        if (startedOutside && event.target === event.currentTarget && !closeBlocked) {
          event.stopPropagation();
          onCloseRef.current();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`timer-smart-cube-device__modal${className ? ` ${className}` : ''}`}
        data-site-surface="popover"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label={copy.close}
          className="timer-smart-cube-device__close bt-modal-close"
          disabled={closeBlocked}
          onClick={() => onCloseRef.current()}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <h2 id={titleId}>
          <Bluetooth aria-hidden="true" size={20} />
          <span>{title ?? copy.title}</span>
        </h2>

        {overrideBody ?? (
          <>
            {intro}
            {(connected || !listMode) && <section className="timer-smart-cube-device__summary bt-connected-summary modal-section">
              <div className="timer-smart-cube-device__primary bt-connected-primary">
                <strong className="timer-smart-cube-device__name bt-connected-device">
                  {snapshot.deviceName || copy.deviceFallback}
                </strong>
                <span
                  aria-live="polite"
                  className={`timer-smart-cube-device__state bt-connected-state bt-value${stateClass}`}
                  role="status"
                >
                  {connected && snapshot.solved === true && <Check aria-hidden="true" size={13} />}
                  {connected && snapshot.solved === false && <X aria-hidden="true" size={13} />}
                  {stateText}
                </span>
              </div>
              <div className="timer-smart-cube-device__facts bt-connected-meta">
                <DeviceFact label={copy.battery} value={snapshot.battery === null || snapshot.battery === undefined ? '—' : `${snapshot.battery}%`} />
                <DeviceFact label={copy.protocol} value={connected ? snapshot.protocol || '—' : '—'} />
              </div>
            </section>}

            {!connected && !connecting && connectionFailure}
            {!connected && listMode && (
              <section className="timer-smart-cube-device__picker" aria-label={copy.availableDevices}>
                <div className="timer-smart-cube-device__picker-header">
                  <strong>{copy.availableDevices}</strong>
                  <button
                    className="timer-smart-cube-device__scan"
                    disabled={action !== null || scanning || connecting}
                    onClick={() => { void runScan(); }}
                    type="button"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={scanning ? 'is-scanning' : undefined}
                      size={14}
                    />
                    {scanning ? copy.scanning : copy.scanAgain}
                  </button>
                </div>
                {availableDevices.length > 0 ? (
                  <ul className="timer-smart-cube-device__list">
                    {availableDevices.map((device) => (
                      <li key={device.id}>
                        <button
                          aria-label={`${copy.connect} ${device.name}`}
                          className="timer-smart-cube-device__device"
                          disabled={action !== null || connecting}
                          onClick={() => { void runConnect(device.id); }}
                          type="button"
                        >
                          <span className="timer-smart-cube-device__device-copy">
                            <strong>{device.name}</strong>
                            <span>{signalText(device.rssi, copy)}</span>
                          </span>
                          <span className="timer-smart-cube-device__device-action">
                            {action === 'connect' && connectingDeviceId === device.id
                              ? copy.connecting
                              : copy.connect}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="timer-smart-cube-device__empty" role="status">
                    {scanning ? copy.scanning : copy.noDevices}
                  </p>
                )}
              </section>
            )}
            {!connected && !listMode && !connecting && canConnect && onConnect && (
              <button
                className="timer-smart-cube-device__connect bt-connect-btn"
                onClick={() => { void runConnect(); }}
                type="button"
              >
                <Bluetooth aria-hidden="true" size={14} />
                {snapshot.phase === 'error' || connectionFailure ? copy.retry : copy.connect}
              </button>
            )}

            {feedback && <p className="timer-smart-cube-device__feedback" role="status">{feedback}</p>}
            {(canReset && onResetState || canResetGyro && onResetGyro || canDisconnect && onDisconnect) && (
              <div className="timer-smart-cube-device__actions bt-connected-actions modal-actions">
                {canReset && onResetState && (
                  <button
                    className="timer-smart-cube-device__action modal-action-btn"
                    disabled={action !== null || !connected || connecting}
                    onClick={() => { void resetState(); }}
                    type="button"
                  >
                    {copy.resetState}
                  </button>
                )}
                {canResetGyro && onResetGyro && (
                  <button
                    className="timer-smart-cube-device__action modal-action-btn"
                    disabled={action !== null || !connected || connecting || !snapshot.hasGyro}
                    onClick={onResetGyro}
                    title={copy.resetGyroHint}
                    type="button"
                  >
                    {copy.resetGyro}
                  </button>
                )}
                {canDisconnect && onDisconnect && (
                  <button
                    className="timer-smart-cube-device__action timer-smart-cube-device__action--danger modal-action-btn danger"
                    disabled={action !== null}
                    onClick={() => { void disconnect(); }}
                    type="button"
                  >
                    {connected ? copy.disconnect : copy.cancel}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function DeviceFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="timer-smart-cube-device__fact bt-connected-fact">
      <span className="timer-smart-cube-device__label bt-label">{label}</span>{' '}
      <span className="timer-smart-cube-device__value bt-value">{value}</span>
    </span>
  );
}

function signalText(
  rssi: number | undefined,
  copy: { signalGood: string; signalLow: string; signalMedium: string },
): string {
  if (rssi === undefined || rssi >= -60) return copy.signalGood;
  if (rssi >= -75) return copy.signalMedium;
  return copy.signalLow;
}
