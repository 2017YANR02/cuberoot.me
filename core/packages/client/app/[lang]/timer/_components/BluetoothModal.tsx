'use client';

/**
 * Bluetooth status / env-advice modal.
 *
 * Two roles:
 *  - When Web Bluetooth is unavailable (env != 'available'), show the
 *    advice from `envAdvice()` — particularly recommending Bluefy on iOS.
 *  - When connected, show the live status (brand / battery / last move /
 *    solved indicator) and a "reset state" + "disconnect" button.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { detectBluetoothEnv, envAdvice } from '../_lib/bluetooth';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { normalizeMac } from '../_lib/bluetooth/mac';
import { Bluetooth, Battery, Check, X, RotateCcw, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface Props {
  isZh: boolean;
  cube: BluetoothCubeHandle;
  onClose: () => void;
  onConnect: () => Promise<void>;
  /** Set while connect() is awaiting a manually-entered MAC for this cube. */
  macPrompt?: { deviceName: string; isWrongKey?: boolean } | null;
  onSubmitMac?: (mac: string) => void;
  onCancelMac?: () => void;
}

const SUPPORTED_CUBES_ZH = [
  'GAN 356 i / i3 / 357（完整解码）',
  'GAN 12 / 14（完整解码）',
  'QiYi（完整解码）',
  'GoCube / Rubik’s Connected（完整解码）',
  'MoYu AI（完整解码）',
  'Giiker i3s / Xiaomi（完整解码）',
];
const SUPPORTED_CUBES_EN = [
  'GAN 356 i / i3 / 357 (full decode)',
  'GAN 12 / 14 (full decode)',
  'QiYi (full decode)',
  'GoCube / Rubik’s Connected (full decode)',
  'MoYu AI (full decode)',
  'Giiker i3s / Xiaomi (full decode)',
];

export default function BluetoothModal({ isZh, cube, onClose, onConnect, macPrompt, onSubmitMac, onCancelMac }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState(false);
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
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea',
    );
    focusable?.focus();
  }, []);

  const env = detectBluetoothEnv();
  const advice = envAdvice(env);
  const supported = env === 'available' || env === 'available-bluefy';
  const inBluefy = env === 'available-bluefy';
  const connected = cube.status.connected;

  const overlayStyle = isMobile ? { padding: 8 } : undefined;
  const modalStyle = isMobile
    ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' }
    : undefined;
  const connectBtnStyle = isMobile
    ? { display: 'flex', width: '100%', justifyContent: 'center', padding: '10px 14px' }
    : undefined;
  const statusGridStyle = isMobile
    ? { gridTemplateColumns: '1fr', gap: '6px 0' }
    : undefined;
  const statusRowStyle = isMobile
    ? ({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid #1f1f23',
      } as const)
    : undefined;
  const actionBtnStyle = isMobile
    ? { flex: '1 1 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px' }
    : undefined;

  return (
    <div className="timer-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        ref={dialogRef}
        className="timer-modal bluetooth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          <Bluetooth size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {tr({ zh: '智能魔方', en: 'Smart cube'
        })}
        </h2>

        {macPrompt && (
          <div className="modal-section">
            <h3 style={{ margin: '0 0 6px' }}>{tr({ zh: '输入魔方 MAC 地址', en: 'Enter cube MAC' })}</h3>
            {macPrompt.isWrongKey && (
              <p style={{ fontSize: 12, color: '#e0a96a', margin: '0 0 8px' }}>
                {tr({
                  zh: '刚才那个 MAC 可能不对——魔方连上了但读不到转动。核对后重新输入。',
                  en: 'That MAC looked wrong — the cube connected but no turns registered. Double-check and re-enter.',
                })}
              </p>
            )}
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
              {tr({
                zh: '没能自动识别这颗魔方的 MAC（GAN 用它解码）。在 GAN 官方 App「魔方」的设备 / 蓝牙信息里能找到，形如 AB:CD:EF:12:34:56。',
                en: "Couldn't auto-detect this cube's MAC (GAN needs it to decode). Find it in the GAN / Cube Station app under device info, e.g. AB:CD:EF:12:34:56.",
              })}
            </p>
            <input
              type="text"
              value={macInput}
              onChange={(e) => { setMacInput(e.target.value); setMacError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitMac(); }}
              placeholder="xx:xx:xx:xx:xx:xx"
              spellCheck={false}
              autoComplete="off"
              autoFocus
              style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
            />
            {macError && (
              <p style={{ fontSize: 12, color: '#e06a6a', margin: '6px 0 0' }}>
                {tr({ zh: '格式不对，应为 6 组两位十六进制，用冒号分隔。', en: 'Invalid format — expected 6 colon-separated hex octets.' })}
              </p>
            )}
            <div className="modal-actions" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
              <button className="primary" onClick={submitMac}>{tr({ zh: '确定', en: 'Confirm' })}</button>
              <button onClick={() => onCancelMac?.()}>{tr({ zh: '取消', en: 'Cancel' })}</button>
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
                <a
                  className="bt-install-btn"
                  href={advice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} />
                  <span>{isZh ? advice.urlLabel?.zh ?? advice.url : advice.urlLabel?.en ?? advice.url}</span>
                </a>
              </div>
            )}
            <div className="modal-section bt-tip">
              <p>{tr({ zh: '提示：在 Bluefy 里访问本页后，把它"添加到主屏幕"就能像 App 一样随时打开。', en: 'Tip: once Bluefy loads this page, "Add to Home Screen" so it opens like a native app.'
            })}</p>
            </div>
          </>
        )}

        {supported && inBluefy && !connected && (
          <div className="modal-section bt-tip" style={{ marginBottom: 8 }}>
            <p style={{ color: '#9fd9ad' }}>
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {tr({ zh: '检测到 Bluefy — Web Bluetooth 已启用 ✓', en: 'Bluefy detected — Web Bluetooth ready ✓'
            })}
            </p>
          </div>
        )}

        {supported && !connected && !macPrompt && (
          <div className="modal-section">
            <p>{tr({ zh: '点击下方按钮，从浏览器选择你的智能魔方。', en: 'Click below to pick your smart cube from the browser picker.'
            })}</p>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              <div style={{ marginBottom: 4 }}>{tr({ zh: '当前支持：', en: 'Supported:'
            })}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {((isZh ? SUPPORTED_CUBES_ZH : SUPPORTED_CUBES_EN)).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <button
              className="bt-connect-btn"
              style={connectBtnStyle ? { ...connectBtnStyle, marginTop: 10 } : { marginTop: 10 }}
              onClick={() => { void onConnect(); }}
            >
              <Bluetooth size={14} />
              <span>{tr({ zh: '搜索并连接', en: 'Search & connect'
            })}</span>
            </button>
          </div>
        )}

        {supported && connected && (
          <>
            <div className="modal-section bt-status" style={statusGridStyle}>
              <div className="bt-row" style={statusRowStyle}>
                <span className="bt-label">{tr({ zh: '设备', en: 'Device'
                })}</span>
                <span className="bt-value">{cube.status.deviceName}</span>
              </div>
              <div className="bt-row" style={statusRowStyle}>
                <span className="bt-label">{tr({ zh: '型号', en: 'Brand'
                })}</span>
                <span className="bt-value">{cube.status.brand}</span>
              </div>
              <div className="bt-row" style={statusRowStyle}>
                <span className="bt-label">
                  <Battery size={14} style={{ verticalAlign: 'middle' }} />{' '}
                  {tr({ zh: '电量', en: 'Battery'
                })}
                </span>
                <span className="bt-value">
                  {cube.status.battery !== null ? `${cube.status.battery}%` : '—'}
                </span>
              </div>
              <div className="bt-row" style={statusRowStyle}>
                <span className="bt-label">{tr({ zh: '状态', en: 'State'
                })}</span>
                <span className={`bt-value ${cube.solved ? 'ok' : 'unsolved'}`}>
                  {cube.solved
                    ? <><Check size={14} style={{ verticalAlign: 'middle' }} /> {tr({ zh: '已还原', en: 'Solved'
                    })}</>
                    : <><X size={14} style={{ verticalAlign: 'middle' }} /> {tr({ zh: '未还原', en: 'Unsolved'
                    })}</>}
                </span>
              </div>
              <div className="bt-row" style={statusRowStyle}>
                <span className="bt-label">{tr({ zh: '最近一步', en: 'Last move' })}</span>
                <span className="bt-value mono">{cube.lastMove ?? '—'}</span>
              </div>
            </div>
            <div className="modal-section bt-tip">
              <p>{tr({ zh: '把魔方还原到出厂状态后点击下方"重置状态"，然后开始打乱 → 计时 → 还原，魔方还原瞬间会自动停止计时。', en: 'Set the cube to its solved state, click "Reset state", then scramble → time → solve. The timer auto-stops when the cube is back to solved.'
            })}</p>
            </div>
          </>
        )}

        <div
          className="modal-actions"
          style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}
        >
          {supported && connected && (
            <>
              <button style={actionBtnStyle} onClick={() => cube.resetState()}>
                <RotateCcw size={14} /> {tr({ zh: '重置状态', en: 'Reset state'
                })}
              </button>
              <button
                className="danger"
                style={actionBtnStyle}
                onClick={() => { cube.disconnect(); onClose(); }}
              >
                {tr({ zh: '断开', en: 'Disconnect'
                })}
              </button>
            </>
          )}
          <button className="primary" style={actionBtnStyle} onClick={onClose}>
            {tr({ zh: '关闭', en: 'Close'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
