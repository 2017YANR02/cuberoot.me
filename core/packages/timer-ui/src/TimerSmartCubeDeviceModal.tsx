import { Bluetooth, CircleCheck, LoaderCircle, RefreshCw, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import { useModalBackdrop } from './useModalDismiss';
import { ClearButton } from './ClearButton';
import { Tooltip } from './Tooltip';
import { usePanelClamp } from './usePanelClamp';
import { usePopoverDismiss } from './usePopoverDismiss';

import { modalFocusableElements } from './modal-focus';
import type { TimerUiLanguage } from './TimerColorSubsetPicker';
import type {
  TimerDeviceAvailableDevice,
  TimerDeviceCapabilities,
  TimerDeviceConnectionPhase,
  TimerDeviceSnapshot,
} from '@cuberoot/shared/timer/device-contract';

export type TimerSmartCubeConnectionPhase = TimerDeviceConnectionPhase;

export type TimerSmartCubeDeviceSnapshot = TimerDeviceSnapshot;

export type TimerSmartCubeAvailableDevice = TimerDeviceAvailableDevice;

export interface TimerSmartCubeDeviceModalProps {
  anchorRef?: RefObject<HTMLButtonElement | null>;
  availableDevices?: readonly TimerSmartCubeAvailableDevice[];
  capabilities?: TimerDeviceCapabilities;
  className?: string;
  connectionFailure?: ReactNode;
  intro?: ReactNode;
  language: TimerUiLanguage;
  macPrompt?: {
    deviceName: string;
    instructions?: ReactNode;
    onSubmit(mac: string): void;
    onCancel(): void;
  };
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
    macLabel: 'Cube MAC address',
    macHint: 'Enter the real Bluetooth MAC address shown for this cube on your Windows computer or in the manufacturer’s app. The name suffix is not a complete address.',
    macInvalid: 'Enter six colon-separated hex octets.',
    clearMac: 'Clear address',
    confirm: 'Confirm',
    battery: 'Battery',
    availableDevices: 'Available devices',
    cancel: 'Cancel',
    close: 'Close',
    connect: 'Connect',
    connected: 'Connected',
    connecting: 'Connecting…',
    connectionFailed: 'Connection failed',
    disconnect: 'Disconnect',
    lastMove: 'Last move',
    notConnected: 'Not connected',
    noDevices: 'No supported smart cubes found',
    resetFailed: 'Software state was reset, but writing to the device failed. Check the connection and retry.',
    resetGyroHint: 'Solve the cube and hold white on top and green in front, then reset the cube',
    resetState: 'Reset',
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
    macLabel: '魔方 MAC 地址',
    macHint: '请输入在 Windows 电脑或厂商 App 中查到的这颗魔方的真实蓝牙 MAC 地址。名称末尾的四位字符不是完整地址。',
    macInvalid: '请输入六组用冒号分隔的两位十六进制数。',
    clearMac: '清除地址',
    confirm: '确定',
    battery: '电量',
    availableDevices: '可用设备',
    cancel: '取消',
    close: '关闭',
    connect: '连接',
    connected: '已连接',
    connecting: '连接中…',
    connectionFailed: '连接失败',
    disconnect: '断开',
    lastMove: '最近一步',
    notConnected: '未连接',
    noDevices: '未发现支持的智能魔方',
    resetFailed: '软件状态已重置，但设备回写失败，请检查连接后重试',
    resetGyroHint: '还原魔方并按白顶绿前握好，再重置魔方',
    resetState: '重置',
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
  anchorRef,
  availableDevices,
  capabilities,
  className,
  connectionFailure,
  intro,
  language,
  macPrompt,
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
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState(false);
  const [action, setAction] = useState<DeviceAction>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const closeBlockedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  onCloseRef.current = onClose;

  const connected = snapshot.phase === 'connected';
  const deviceName = snapshot.deviceName?.trim();
  const anchored = Boolean(anchorRef?.current);
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
  const backdropProps = useModalBackdrop(() => onCloseRef.current(), closeBlocked);
  usePopoverDismiss(anchored && !closeBlocked, () => onCloseRef.current(), dialogRef, anchorRef);
  useLayoutEffect(() => {
    if (!anchored) return;
    const position = () => {
      const panel = dialogRef.current;
      const anchor = anchorRef?.current;
      if (!panel || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      panel.style.left = `${Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - panel.offsetWidth - 8))}px`;
      const below = bottom - rect.bottom - 14;
      panel.style.maxHeight = `${Math.max(80, below >= 160 ? below : rect.top - 14)}px`;
      panel.style.top = `${below >= 160 ? rect.bottom + 6 : Math.max(8, rect.top - panel.offsetHeight - 6)}px`;
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    if (dialogRef.current) observer?.observe(dialogRef.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
    };
  }, [anchored, anchorRef]);
  usePanelClamp(anchored, dialogRef);

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
      if (anchored) return;
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
      if (anchored) return;
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
      const previousFocus = anchorRef?.current ?? previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [anchored]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const autofocus = dialog.querySelector<HTMLElement>('[data-autofocus]');
    autofocus?.focus();
  }, [overrideBody !== undefined, macPrompt?.deviceName]);

  useEffect(() => { setMacInput(''); setMacError(false); }, [macPrompt?.deviceName]);

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
    if (action !== null) return;
    setFeedback(null);
    setAction('reset');
    try {
      // Calibrate even if writing the solved state back to the device fails.
      if (canResetGyro && snapshot.hasGyro) onResetGyro?.();
      if (canReset) await onResetState?.();
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

  const stateText = connected
    ? copy.connected
    : connecting ? copy.connecting
    : snapshot.phase === 'error' || connectionFailure
        ? copy.connectionFailed
        : copy.notConnected;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={anchored ? 'timer-smart-cube-device__anchor' : 'timer-smart-cube-device__overlay'}
      {...(anchored ? {} : backdropProps)}
    >
      <div
        aria-labelledby={titleId}
        aria-modal={anchored ? undefined : true}
        className={`timer-smart-cube-device__modal${anchored ? ' timer-smart-cube-device__popover' : ''}${className ? ` ${className}` : ''}`}
        data-no-timer
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
          {!macPrompt && !overrideBody && (connected || !listMode) && <DeviceBattery label={copy.battery} level={snapshot.battery} />}
        </h2>

        {macPrompt ? (
          <form className="modal-section" onSubmit={(event) => {
            event.preventDefault();
            const mac = normalizeMac(macInput);
            if (!mac || mac === '00:00:00:00:00:00') { setMacError(true); return; }
            macPrompt.onSubmit(mac);
          }}>
            <strong>{macPrompt.deviceName}</strong>
            {macPrompt.instructions ?? <p>{copy.macHint}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input aria-label={copy.macLabel} autoComplete="off" data-autofocus data-mac-input
                onChange={(event) => { setMacInput(event.target.value); setMacError(false); }}
                placeholder="xx:xx:xx:xx:xx:xx" spellCheck={false} type="text" value={macInput}
                style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
              {macInput && <ClearButton ariaLabel={copy.clearMac} onClick={() => { setMacInput(''); setMacError(false); }} />}
            </div>
            {macError && <p role="alert">{copy.macInvalid}</p>}
            <div className="modal-actions bt-mac-actions">
              <button className="primary modal-action-btn" type="submit">{copy.confirm}</button>
              <button className="modal-action-btn" onClick={macPrompt.onCancel} type="button">{copy.cancel}</button>
            </div>
          </form>
        ) : overrideBody ?? (
          <>
            {!connected && intro}
            {(connected || !listMode) && <section className="timer-smart-cube-device__summary bt-connected-summary modal-section">
              <div className="timer-smart-cube-device__primary bt-connected-primary">
                {deviceName && <strong className="timer-smart-cube-device__name bt-connected-device">
                  {deviceName}
                </strong>}
                <span
                  key={connected ? 'connected' : connecting ? 'connecting' : snapshot.phase}
                  aria-live="polite"
                  aria-label={connected ? stateText : undefined}
                  className={`timer-smart-cube-device__state bt-connected-state bt-value${connected ? ' is-ok' : connecting ? ' is-connecting' : snapshot.phase === 'error' ? ' is-error' : ''}`}
                  role="status"
                >
                  {connected ? <CircleCheck size={16} aria-hidden="true" /> : connecting ? <LoaderCircle size={16} aria-hidden="true" /> : null}
                  {!connected && stateText}
                </span>
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
                            {action === 'connect' && connectingDeviceId === device.id && <LoaderCircle className="is-connecting" size={16} aria-hidden="true" />}
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
                {(canReset && onResetState || canResetGyro && onResetGyro && snapshot.hasGyro) && (
                  <button
                    className="timer-smart-cube-device__action modal-action-btn"
                    disabled={action !== null || !connected || connecting}
                    onClick={() => { void resetState(); }}
                    title={canResetGyro && snapshot.hasGyro ? copy.resetGyroHint : undefined}
                    type="button"
                  >
                    {copy.resetState}
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

function DeviceBattery({ label, level }: { label: string; level?: number | null }) {
  const clipId = useId();
  const percent = typeof level === 'number' && Number.isFinite(level) ? Math.round(Math.max(0, Math.min(100, level))) : null;
  const description = `${label} ${percent === null ? '—' : `${percent}%`}`;
  return (
    <Tooltip content={description} openOnClick>
      {tip => <button {...tip} type="button" className="timer-smart-cube-device__battery" aria-label={description}
        data-low={percent !== null && percent <= 20 ? 'true' : undefined}>
        <svg width="30" height="16" viewBox="0 0 30 16" fill="currentColor" aria-hidden="true">
          <defs><clipPath id={clipId}><rect x="3" y="3" width="21" height="10" rx="2" /></clipPath></defs>
          <rect x="1" y="1" width="25" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <path d="M28 5v6c2-0.5 2-5.5 0-6Z" opacity="0.45" />
          {percent === null ? <path d="M10 7h7v2h-7Z" opacity="0.45" /> :
            <rect x="3" y="3" width={21 * percent / 100} height="10" clipPath={`url(#${clipId})`} />}
        </svg>
      </button>}
    </Tooltip>
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
