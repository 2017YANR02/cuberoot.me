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
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
import { formatMs } from '../_lib/stats';
import type { StackmatHandle, StackmatInputDevice } from '../_lib/stackmat';

interface Props {
  stackmat: StackmatHandle;
  onClose: () => void;
  /**
   * A connection already started by the bottom microphone button. Keeping
   * getUserMedia() in that click makes the permission prompt immediate; this
   * modal observes the same promise so it can own progress and failure UI.
   */
  connectAttempt?: Promise<void> | null;
}

/** Level below which we call the input silent. */
const SILENT_LEVEL = 0.02;

type Health = 'off' | 'silent' | 'wrong-signal' | 'ok';

function healthOf(s: StackmatHandle): Health {
  if (!s.status.listening) return 'off';
  if (s.status.signalPresent) return 'ok';
  return s.signalLevel < SILENT_LEVEL ? 'silent' : 'wrong-signal';
}

const HEALTH_COLOR: Record<Health, string> = {
  off: 'var(--faint-foreground)',
  silent: 'var(--muted-foreground)',
  'wrong-signal': 'var(--signal-warning)',
  ok: 'var(--signal-success)',
};

function healthLabel(h: Health): string {
  switch (h) {
    case 'off': return tr({ zh: '未监听', en: 'Not listening' });
    case 'silent': return tr({ zh: '没有输入信号', en: 'No input signal' });
    case 'wrong-signal': return tr({ zh: '有声音，但不是 Stackmat 数据', en: 'Audio present, but not Stackmat data' });
    case 'ok': return tr({ zh: '已连接，正在解码', en: 'Connected, decoding' });
  }
}

function phaseLabel(phase: StackmatHandle['status']['phase']): string {
  switch (phase) {
    case 'idle': return tr({ zh: '空闲', en: 'Idle' });
    case 'one-hand': return tr({ zh: '单手在垫上', en: 'One hand down' });
    case 'starting': return tr({ zh: '双手就绪', en: 'Both hands, ready' });
    case 'running': return tr({ zh: '计时中', en: 'Running' });
    case 'stopped': return tr({ zh: '已停表', en: 'Stopped' });
    case 'unknown': return tr({ zh: '—', en: '—' });
  }
}

function micErrorMessage(err: unknown): string {
  const detail = typeof err === 'object' && err !== null
    ? err as { name?: unknown; message?: unknown }
    : null;
  const name = typeof detail?.name === 'string' ? detail.name : '';
  const message = typeof detail?.message === 'string' ? detail.message : String(err);
  return name === 'NotAllowedError'
    ? tr({ zh: '浏览器拒绝了麦克风权限。请在地址栏的权限设置里允许后重试。', en: 'The browser denied microphone access. Allow it in the site permissions and retry.' })
    : name === 'NotFoundError'
      ? tr({ zh: '没有找到音频输入设备。', en: 'No audio input device found.' })
      : message === 'mic-not-supported'
        ? tr({ zh: '当前浏览器不支持麦克风采集（需要 HTTPS）。', en: 'This browser cannot capture microphone audio (HTTPS required).' })
        : tr({ zh: `麦克风启用失败：${message}`, en: `Mic error: ${message}` });
}

export default function StackmatModal({ stackmat, onClose, connectAttempt }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [devices, setDevices] = useState<StackmatInputDevice[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { status, signalLevel, start, stop, listInputDevices } = stackmat;
  const listening = status.listening;

  const refreshDevices = useCallback(() => {
    void listInputDevices().then(setDevices);
  }, [listInputDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // Device labels stay blank until mic permission is granted, so re-read the
  // list once we are listening.
  useEffect(() => { if (listening) refreshDevices(); }, [listening, refreshDevices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button, select')?.focus();
  }, []);

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
        setError(micErrorMessage(err));
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
      setError(micErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [start]);

  const onPickDevice = useCallback(async (deviceId: string) => {
    stop();
    await begin(deviceId);
  }, [begin, stop]);

  const health = healthOf(stackmat);

  return (
    <div className="timer-modal-overlay" style={isMobile ? { padding: 8 } : undefined} onClick={onClose}>
      <div
        ref={dialogRef}
        className="timer-modal stackmat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile ? { padding: 14, maxWidth: '100%' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          <Mic size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {tr({ zh: 'Stackmat 计时器', en: 'Stackmat timer' })}
        </h2>

        <div className="modal-section">
          <p style={{ margin: 0 }}>
            {tr({
              zh: '用一根 3.5 mm 音频线把计时器的数据口接到电脑的麦克风输入，本页直接解码它发出的信号，停表后自动记成绩。',
              en: 'Run a 3.5 mm cable from the timer’s data jack into your computer’s microphone input. This page decodes the signal directly and records the solve when the timer stops.',
            })}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>
            {tr({
              zh: '支持 Gen 3 / Gen 4，毫秒和百分秒两种固件都行，线的极性接反也能解。',
              en: 'Works with Gen 3 / Gen 4, both millisecond and centisecond firmwares, and with either cable polarity.',
            })}
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
            <span style={{ color: HEALTH_COLOR[health] }}>{healthLabel(health)}</span>
          </div>

          {listening && (
            <>
              {/* Input level meter — the fastest way to tell "wrong input" from
                  "nothing plugged in". */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: '3.5em' }}>
                  {tr({ zh: '电平', en: 'Level' })}
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
                <dt style={{ color: 'var(--muted-foreground)' }}>{tr({ zh: '计时器状态', en: 'Timer state' })}</dt>
                <dd style={{ margin: 0 }}>{phaseLabel(status.phase)}</dd>
                <dt style={{ color: 'var(--muted-foreground)' }}>{tr({ zh: '显示读数', en: 'Reading' })}</dt>
                <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {status.signalPresent ? formatMs(status.ms) : '—'}
                </dd>
                <dt
                  aria-hidden={status.unit === 0}
                  style={{ color: 'var(--muted-foreground)', visibility: status.unit === 0 ? 'hidden' : undefined }}
                >
                  {tr({ zh: '精度', en: 'Resolution' })}
                </dt>
                <dd
                  aria-hidden={status.unit === 0}
                  style={{ margin: 0, visibility: status.unit === 0 ? 'hidden' : undefined }}
                >
                  {status.unit === 1
                    ? tr({ zh: '毫秒（Gen 4）', en: 'milliseconds (Gen 4)' })
                    : tr({ zh: '百分秒（Gen 3）', en: 'centiseconds (Gen 3)' })}
                </dd>
              </dl>
            </>
          )}

          {listening && (
            <p className="stackmat-health-guidance" style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>
              {health === 'wrong-signal'
                ? tr({
                    zh: '听到的多半是内置麦克风。在下面选中计时器所接的那个输入设备。',
                    en: 'That is probably the built-in microphone. Pick the input the timer is plugged into below.',
                  })
                : health === 'silent'
                  ? tr({
                      zh: '检查：线是否插在麦克风/输入口（不是耳机口）、计时器是否开机、系统输入音量是否为 0。',
                      en: 'Check: cable in the mic/line input (not the headphone jack), timer powered on, and system input volume above zero.',
                    })
                  : '\u00a0'}
            </p>
          )}
        </div>

        {listening && (
          <div className="modal-section">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                {tr({ zh: '输入设备', en: 'Input device' })}
              </span>
              <select
                value={status.deviceId}
                disabled={busy}
                onChange={(e) => { void onPickDevice(e.target.value); }}
                style={{ width: 'fit-content', maxWidth: '100%', fontSize: 14, padding: '4px 6px' }}
              >
                <option value="">{tr({ zh: '系统默认', en: 'System default' })}</option>
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
              {tr({ zh: '停止监听', en: 'Stop listening' })}
            </button>
          ) : (
            <button className="primary modal-action-btn" disabled={busy} onClick={() => { void begin(); }}>
              {busy ? tr({ zh: '正在启用…', en: 'Starting…' }) : tr({ zh: '开始监听', en: 'Start listening' })}
            </button>
          )}
          <ClearButton
            variant="standalone"
            ariaLabel={tr({ zh: '关闭', en: 'Close' })}
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}
