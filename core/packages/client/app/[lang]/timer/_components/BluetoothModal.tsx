'use client';

/**
 * Bluetooth status / env-advice modal.
 *
 * Two roles:
 *  - When neither Web Bluetooth nor the Mini Program native bridge is
 *    available, show the platform advice from `envAdvice()`.
 *  - When connected, show the live status (brand / battery / last move /
 *    solved indicator) and a "reset state" + "disconnect" button.
 */

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  BluetoothConnectError,
  clientEnvironmentLabel,
  describeError,
  detectBluetoothEnv,
  detectClientEnvironment,
  envAdvice,
  mayUseMiniProgramBridge,
} from '../_lib/bluetooth';
import type { BluetoothCubeHandle, ConnectStage, ConnectPickOptions } from '../_lib/bluetooth';
import { normalizeMac } from '../_lib/bluetooth/mac';
import { Bluetooth, Check, X, RotateCcw, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { ClearButton } from '@/components/ClearButton';
import { useModalBackdrop } from '@/hooks/useModalDismiss';

interface Props {
  isZh: boolean;
  cube: BluetoothCubeHandle;
  onClose: () => void;
  /**
   * A connection already started by the icon's click handler. Web Bluetooth's
   * picker needs that direct user gesture, so the modal observes the promise
   * instead of starting it later from an effect.
   */
  connectAttempt?: Promise<void> | null;
  /**
   * Start a connection. Allowed — expected — to reject: this modal owns the
   * failure UI. It used to be each caller's job, and all three did it
   * differently (two `alert(err.message)` variants, and BattleCubes not at all,
   * which turned every failure there into a silent unhandled rejection).
   */
  onConnect: (pick?: ConnectPickOptions) => Promise<void>;
  /** Set while connect() is awaiting a manually-entered MAC for this cube. */
  macPrompt?: { deviceName: string; isWrongKey?: boolean } | null;
  onSubmitMac?: (mac: string) => void;
  onCancelMac?: () => void;
  onResetGyro?: () => void;
}

/** Device groups shown only after a failed connection. */
const SUPPORTED_CUBE_GROUPS = [
  { zh: 'GAN 智能：', en: 'GAN smart cubes:', devices: [
    { zh: 'GAN356 i Carry / i Carry S / i Carry 2 / Monster Go 3Ai', en: 'GAN356 i Carry / i Carry S / i Carry 2 / Monster Go 3Ai', gyro: false },
    { zh: 'GAN356 i3 / GAN Mini ui FreePlay / GAN12 ui / GAN12 ui FreePlay', en: 'GAN356 i3 / GAN Mini ui FreePlay / GAN12 ui / GAN12 ui FreePlay', gyro: true },
  ] },
  { zh: '魔域智能：', en: 'MoYu smart cubes:', devices: [
    { zh: 'V10 AI / V11 AI / 超级威龙 V2 18周年 AI', en: 'V10 AI / V11 AI / Super WeiLong V2 18th Anniversary AI', gyro: true },
  ] },
  { zh: '奇艺智能：', en: 'QiYi smart cubes:', devices: [
    { zh: 'QYSC', en: 'QYSC', gyro: false },
    { zh: 'Tornado V4', en: 'Tornado V4', gyro: true },
  ] },
  { zh: '其他：', en: 'Other cubes:', devices: [
    { zh: 'GoCube / GoCube Edge', en: 'GoCube / GoCube Edge', gyro: true },
    { zh: 'Rubik’s Connected 三阶', en: 'Rubik’s Connected 3x3', gyro: false },
    { zh: 'GiiKER i3 / i3S / 小米米家智能魔方', en: 'GiiKER i3 / i3S / Xiaomi Mi Smart Magic Cube', gyro: false },
  ] },
];

/** Small inline badge marking a gyro-capable model. Inline rather than a CSS
 *  class so this file stays self-contained (it already styles inline). */
const GYRO_TAG_STYLE: CSSProperties = {
  marginLeft: 6,
  padding: '0 5px',
  borderRadius: 3,
  fontSize: 10,
  lineHeight: '15px',
  display: 'inline-block',
  verticalAlign: 'middle',
  color: 'var(--accent)',
  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
};

function ConnectFailure() {
  return (
    <div className="modal-section bt-warn" role="alert">
      <h3 className="bt-warn-title">{tr({ zh: '连接的设备型号暂不支持', en: 'This device model is not currently supported' })}</h3>
      <p>{tr({ zh: '暂只支持智能三阶魔方，二阶和异形智能魔方暂不支持', en: 'Only smart 3x3 cubes are supported. Smart 2x2 and shape-mod cubes are not currently supported.' })}</p>
      {SUPPORTED_CUBE_GROUPS.map(group => (
        <div key={group.en}>
          <strong>{tr(group)}</strong>
          <ul style={{ margin: '4px 0 10px', paddingLeft: 18, lineHeight: 1.55 }}>
            {group.devices.map(device => (
              <li key={device.en}>
                {tr(device)}
                {device.gyro && <span style={GYRO_TAG_STYLE}>{tr({ zh: '陀螺仪', en: 'gyro' })}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function BluetoothModal({ cube, onClose, onConnect, connectAttempt, macPrompt, onSubmitMac, onCancelMac, onResetGyro }: Props) {
  const titleId = useId();
  const backdropProps = useModalBackdrop(onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState(false);
  const [connecting, setConnecting] = useState(Boolean(connectAttempt) && !cube.status.connected);
  const [connectError, setConnectError] = useState<{ stage: ConnectStage | null; detail: string } | null>(null);

  const runConnect = async (pick?: ConnectPickOptions): Promise<void> => {
    setConnectError(null);
    setConnecting(true);
    try {
      await onConnect(pick);
    } catch (err) {
      // NO_WEB_BLUETOOTH already has its own section above (envAdvice) — don't
      // say it twice.
      if ((err as { kind?: unknown } | null)?.kind === 'no-web-bluetooth') return;
      setConnectError(err instanceof BluetoothConnectError
        ? { stage: err.stage, detail: err.detail }
        : { stage: null, detail: describeError(err) });
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!connectAttempt) return;
    let active = true;
    setConnectError(null);
    setConnecting(true);
    void connectAttempt.then(
      () => {
        if (active) setConnecting(false);
      },
      (err: unknown) => {
        if (!active) return;
        if ((err as { kind?: unknown } | null)?.kind !== 'no-web-bluetooth') {
          setConnectError(err instanceof BluetoothConnectError
            ? { stage: err.stage, detail: err.detail }
            : { stage: null, detail: describeError(err) });
        }
        setConnecting(false);
      },
    );
    return () => { active = false; };
  }, [connectAttempt]);

  const submitMac = (): void => {
    const norm = normalizeMac(macInput);
    if (!norm) { setMacError(true); return; }
    setMacError(false);
    setMacInput('');
    onSubmitMac?.(norm);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector<HTMLElement>(macPrompt
      ? '[data-mac-input]' : 'button, [href], input, select, textarea');
    focusable?.focus();
  }, [macPrompt?.deviceName]);

  const clientEnvironment = detectClientEnvironment();
  const env = detectBluetoothEnv();
  const advice = envAdvice(env);
  const miniProgramBridge = mayUseMiniProgramBridge();
  const canConnect = miniProgramBridge || env === 'available' || env === 'available-bluefy';
  const connected = cube.status.connected;

  const overlayStyle = isMobile ? { padding: 8 } : undefined;
  const modalStyle = isMobile
    ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' }
    : undefined;
  const connectBtnStyle = isMobile
    ? { display: 'flex', width: '100%', justifyContent: 'center', padding: '10px 14px' }
    : undefined;
  const actionBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    ...(isMobile ? { flex: '1 1 100%', padding: '10px 14px' } : {}),
  } as const;

  return (
    <div className="timer-modal-overlay" style={overlayStyle} {...backdropProps}>
      <div
        ref={dialogRef}
        className={`timer-modal bluetooth-modal${!macPrompt && !connectError ? ' bt-connected-modal' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <ClearButton
          variant="standalone"
          className="bt-modal-close"
          onClick={onClose}
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
        />
        <h2 id={titleId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bluetooth size={20} />
          <span>{macPrompt ? tr({ zh: '输入 MAC 地址', en: 'Enter MAC address' }) : tr({ zh: '智能魔方', en: 'Smart cube' })}</span>
        </h2>

        {!macPrompt && !connected && !canConnect && (
          <p className="bt-tip" style={{ margin: '0 0 10px' }}>
            {tr({ zh: '检测到：', en: 'Detected: ' })}
            <strong style={{ color: 'var(--foreground)' }}>
              {tr(clientEnvironmentLabel(clientEnvironment))}
            </strong>
          </p>
        )}

        {macPrompt && (
          <div className="modal-section">
            <p style={{ margin: '0 0 8px' }}><strong>{macPrompt.deviceName}</strong></p>
            {macPrompt.isWrongKey && (
              <p style={{ fontSize: 12, color: 'var(--signal-warning)', margin: '0 0 8px' }}>
                {tr({
                  zh: '刚才那个 MAC 可能不对——魔方连上了但读不到转动。核对后重新输入。',
                  en: 'That MAC looked wrong — the cube connected but no turns registered. Double-check and re-enter.',
                })}
              </p>
            )}
            <p>
              {tr({ zh: '受 Web 浏览器限制，首次连接需要手动填写魔方的 MAC 地址。连接成功后会记住，下次无需重复输入。', en: 'Your browser cannot provide the cube’s MAC address to this page. Enter it for the first connection; it will be remembered after a successful connection.' })}
            </p>
            <p>{tr({ zh: '在浏览器新标签页的地址栏中打开：', en: 'Open this address in a new browser tab:' })}</p>
            <ul style={{ paddingLeft: 20, overflowWrap: 'anywhere' }}>
              <li>Chrome: <code>chrome://bluetooth-internals/#devices</code></li>
              <li>Edge: <code>edge://bluetooth-internals/#devices</code></li>
            </ul>
            <p>{tr({ zh: '在 Name 列找到自己的智能魔方，复制同一行的 Address，粘贴到下方。', en: 'Find your cube in the Name column, copy the Address from that row, and paste it below.' })}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              data-mac-input
              aria-label={tr({ zh: '魔方 MAC 地址', en: 'Cube MAC address' })}
              value={macInput}
              onChange={(e) => { setMacInput(e.target.value); setMacError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitMac(); }}
              placeholder="xx:xx:xx:xx:xx:xx"
              spellCheck={false}
              autoComplete="off"
              autoFocus
              style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
            />
              {macInput && <ClearButton onClick={() => { setMacInput(''); setMacError(false); }} ariaLabel={tr({ zh: '清除地址', en: 'Clear address' })} />}
            </div>
            {macError && (
              <p style={{ fontSize: 12, color: 'var(--destructive)', margin: '6px 0 0' }}>
                {tr({ zh: '格式不对，应为 6 组两位十六进制，用冒号分隔。', en: 'Invalid format — expected 6 colon-separated hex octets.' })}
              </p>
            )}
            <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
              <button className="primary modal-action-btn" onClick={submitMac}>{tr({ zh: '确定', en: 'Confirm' })}</button>
              <button className="modal-action-btn" onClick={() => onCancelMac?.()}>{tr({ zh: '取消', en: 'Cancel' })}</button>
            </div>
          </div>
        )}

        {!macPrompt && !connected && !canConnect && advice && (
          <>
            <div className="modal-section bt-warn">
              <h3 className="bt-warn-title">{tr(advice.title)}</h3>
              <p>{tr(advice.body)}</p>
            </div>
            {advice.url && (
              <div className="modal-section">
                <a
                  className="bt-install-btn"
                  href={advice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} />
                  <span>{advice.urlLabel ? tr(advice.urlLabel) : advice.url}</span>
                </a>
              </div>
            )}
            {clientEnvironment.os === 'ios' && advice.url && (
              <div className="modal-section bt-tip">
                <p>{tr({ zh: '提示：在 Bluefy 里访问本页后，把它“添加到主屏幕”就能像 App 一样随时打开。', en: 'Tip: once Bluefy loads this page, “Add to Home Screen” so it opens like a native app.'
              })}</p>
              </div>
            )}
          </>
        )}

        {!macPrompt && (
          <>
            <div className="modal-section bt-connected-summary">
              <div className="bt-connected-primary">
                <strong className="bt-connected-device">{cube.status.deviceName || tr({ zh: '智能魔方', en: 'Smart cube' })}</strong>
                <span className={`bt-value bt-connected-state ${connected && cube.solved ? 'ok' : 'unsolved'}`}>
                  {connected && (cube.solved ? <Check size={13} /> : <X size={13} />)}
                  <span role="status" aria-live="polite">{connecting
                    ? tr({ zh: '连接中…', en: 'Connecting…' })
                    : connected
                      ? tr({ zh: `已连接，${cube.solved ? '已还原' : '未还原'}`, en: `Connected, ${cube.solved ? 'solved' : 'unsolved'}` })
                      : connectError ? tr({ zh: '连接失败', en: 'Connection failed' }) : tr({ zh: '未连接', en: 'Not connected' })}</span>
                </span>
              </div>
              <div className="bt-connected-meta">
                <span className="bt-connected-fact">
                  <span className="bt-label">{tr({ zh: '电量', en: 'Battery' })}</span>{' '}
                  <span className="bt-value">{cube.status.battery !== null ? `${cube.status.battery}%` : '—'}</span>
                </span>
                <span className="bt-connected-fact">
                  <span className="bt-label">{tr({ zh: '最近一步', en: 'Last move' })}</span>{' '}
                  <span className="bt-value mono">{cube.lastMove ?? '—'}</span>
                </span>
                <span className="bt-connected-fact">
                  <span className="bt-label">{tr({ zh: '协议', en: 'Protocol' })}</span>{' '}
                  <span className="bt-value">{connected ? cube.status.brand : '—'}</span>
                </span>
              </div>
            </div>
          </>
        )}

        {!macPrompt && !connected && !connecting && connectError && <ConnectFailure />}
        {!macPrompt && !connected && !connecting && canConnect && (
          <button type="button" className="bt-connect-btn" style={connectBtnStyle} onClick={() => { void runConnect(); }}>
            <Bluetooth size={14} /> {connectError ? tr({ zh: '重新连接', en: 'Retry connection' }) : tr({ zh: '连接', en: 'Connect' })}
          </button>
        )}

        {!macPrompt && (
          <div
            className="modal-actions"
            style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}
          >
              <button className="modal-action-btn" style={actionBtnStyle} disabled={!connected || connecting} onClick={() => cube.resetState()}>
                <RotateCcw size={14} /> {tr({ zh: '重置状态', en: 'Reset state'
                })}
              </button>
              {onResetGyro && (
                <button type="button" className="modal-action-btn" style={actionBtnStyle}
                  disabled={!connected || connecting || !cube.status.hasGyro} onClick={onResetGyro}
                  title={tr({ zh: '按白顶绿前握好魔方，再重置陀螺仪', en: 'Hold white on top and green in front, then reset the gyroscope' })}>
                  <RotateCcw size={14} /> {tr({ zh: '重置陀螺仪', en: 'Reset gyroscope' })}
                </button>
              )}
              <button
                className="danger modal-action-btn"
                style={actionBtnStyle}
                onClick={() => { cube.disconnect(); onClose(); }}
              >
                {connected ? tr({ zh: '断开', en: 'Disconnect' }) : tr({ zh: '取消', en: 'Cancel' })}
              </button>
          </div>
        )}
      </div>
    </div>
  );
}
