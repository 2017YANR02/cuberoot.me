'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bluetooth, ExternalLink } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
import { detectBluetoothEnv, envAdvice } from '../_lib/bluetooth';
import { normalizeMac } from '../_lib/bluetooth/mac';
import type {
  BluetoothTimerHandle,
  ExternalTimerKind,
  ExternalTimerState,
} from '../_lib/bluetooth/timer';
import { formatMs } from '../_lib/stats';

interface Props {
  timer: BluetoothTimerHandle;
  /** Connection already started by the bottom Bluetooth button's user gesture. */
  connectAttempt?: Promise<void> | null;
  macPrompt: { deviceName: string; suggestedMac?: string } | null;
  onSubmitMac: (mac: string) => void;
  onCancelMac: () => void;
  onClose: () => void;
}

function kindLabel(kind: ExternalTimerKind): string {
  switch (kind) {
    case 'gan-timer': return tr({ zh: 'GAN 智能计时器', en: 'GAN Smart Timer' });
    case 'qiyi-timer': return tr({ zh: '奇艺智能计时器 / 转接器', en: 'QiYi Timer / Adapter' });
    case 'stackmat-mic': return 'Stackmat';
    case 'unknown': return '—';
  }
}

function stateLabel(state: ExternalTimerState): string {
  switch (state) {
    case 'DISCONNECT': return tr({ zh: '未连接', en: 'Disconnected' });
    case 'GET_SET': return tr({ zh: '已就绪', en: 'Ready' });
    case 'HANDS_OFF': return tr({ zh: '手已离开', en: 'Hands off' });
    case 'RUNNING': return tr({ zh: '计时中', en: 'Running' });
    case 'STOPPED': return tr({ zh: '已停表', en: 'Stopped' });
    case 'IDLE': return tr({ zh: '空闲', en: 'Idle' });
    case 'HANDS_ON': return tr({ zh: '双手在垫上', en: 'Hands on' });
    case 'FINISHED': return tr({ zh: '成绩已记录', en: 'Result recorded' });
    case 'INSPECTION': return tr({ zh: '观察中', en: 'Inspection' });
    case 'GAN_RESET': return tr({ zh: '已复位', en: 'Reset' });
  }
}

function connectErrorMessage(err: unknown): string {
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
  timer,
  connectAttempt,
  macPrompt,
  onSubmitMac,
  onCancelMac,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState('');

  const env = detectBluetoothEnv();
  const advice = envAdvice(env);
  const supported = env === 'available' || env === 'available-bluefy';
  const connected = timer.status.connected;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (macPrompt) onCancelMac();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [macPrompt, onCancelMac, onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, []);

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
        setError(connectErrorMessage(err));
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
          setError(connectErrorMessage(reason));
        }
        setBusy(false);
      },
    );
    return () => { active = false; };
  }, [connectAttempt]);

  const submitMac = useCallback(() => {
    const normalized = normalizeMac(macInput);
    if (!normalized) {
      setMacError(tr({
        zh: '请输入 6 组十六进制地址，例如 AA:BB:CC:DD:EE:FF。',
        en: 'Enter six hexadecimal pairs, for example AA:BB:CC:DD:EE:FF.',
      }));
      return;
    }
    onSubmitMac(normalized);
  }, [macInput, onSubmitMac]);

  const close = useCallback(() => {
    if (macPrompt) onCancelMac();
    onClose();
  }, [macPrompt, onCancelMac, onClose]);

  return (
    <div className="timer-modal-overlay" style={isMobile ? { padding: 8 } : undefined} onClick={close}>
      <div
        ref={dialogRef}
        className="timer-modal bluetooth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>
          <Bluetooth size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {tr({ zh: '蓝牙智能计时器', en: 'Bluetooth smart timer' })}
        </h2>

        {macPrompt && (
          <div className="modal-section">
            <p style={{ marginTop: 0 }}>
              {tr({
                zh: `没有自动读到 ${macPrompt.deviceName || '奇艺计时器'} 的蓝牙地址，请输入设备的 MAC 地址。`,
                en: `The Bluetooth address for ${macPrompt.deviceName || 'the QiYi timer'} could not be detected. Enter its MAC address.`,
              })}
            </p>
            <input
              value={macInput}
              onChange={(event) => {
                setMacInput(event.target.value);
                setMacError('');
              }}
              onKeyDown={(event) => { if (event.key === 'Enter') submitMac(); }}
              placeholder="AA:BB:CC:DD:EE:FF"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              style={{ width: 'min(100%, 20em)' }}
            />
            {macError && <p className="bt-error-detail">{macError}</p>}
            <p className="bt-tip">
              {tr({
                zh: '地址通常可在奇艺 App 的设备信息或计时器标签中找到。取消后不会建立一个无数据的连接。',
                en: 'The address is usually shown in the QiYi app device info or on the timer label. Cancelling will not create a silent connection.',
              })}
            </p>
            <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
              <button className="primary modal-action-btn" onClick={submitMac}>
                {tr({ zh: '确定', en: 'Confirm' })}
              </button>
              <button className="modal-action-btn" onClick={onCancelMac}>
                {tr({ zh: '取消连接', en: 'Cancel connection' })}
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
              {tr({
                zh: '打开计时器蓝牙，点击搜索，然后在浏览器里选择 QY-Timer、QY-Adapter 或 GAN Timer。',
                en: 'Turn on the timer’s Bluetooth, search, then choose QY-Timer, QY-Adapter, or GAN Timer in the browser picker.',
              })}
            </p>
            <p className="bt-tip">
              {tr({
                zh: '支持 GAN 智能计时器、奇艺智能计时器和奇艺转接器。停表后会自动记入当前项目。',
                en: 'Supports GAN Smart Timer, QiYi Timer, and QiYi Adapter. A stopped time is recorded in the current event automatically.',
              })}
            </p>
            <button className="bt-connect-btn" disabled={busy} onClick={() => { void connect(); }}>
              <Bluetooth size={14} />
              <span>{busy
                ? tr({ zh: '连接中…', en: 'Connecting…' })
                : tr({ zh: '搜索并连接', en: 'Search & connect' })}</span>
            </button>
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
                <dt className="bt-label">{tr({ zh: '设备', en: 'Device' })}</dt>
                <dd style={{ margin: 0 }}>{kindLabel(timer.status.kind)}</dd>
                <dt className="bt-label">{tr({ zh: '状态', en: 'State' })}</dt>
                <dd style={{ margin: 0 }}>{stateLabel(timer.status.state)}</dd>
                <dt className="bt-label">{tr({ zh: '最近成绩', en: 'Last result' })}</dt>
                <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {timer.status.lastTimeMs > 0 ? formatMs(timer.status.lastTimeMs) : '—'}
                </dd>
              </dl>
            </div>
            <p className="modal-section bt-connected-help">
              {tr({
                zh: '现在直接使用计时器。停表时，设备读数会自动保存并换下一条打乱。',
                en: 'Use the timer normally. When it stops, the device reading is saved and the next scramble is loaded.',
              })}
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
