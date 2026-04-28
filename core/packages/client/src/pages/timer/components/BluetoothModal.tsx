/**
 * Bluetooth status / env-advice modal.
 *
 * Two roles:
 *  - When Web Bluetooth is unavailable (env != 'available'), show the
 *    advice from `envAdvice()` — particularly recommending Bluefy on iOS.
 *  - When connected, show the live status (brand / battery / last move /
 *    solved indicator) and a "reset state" + "disconnect" button.
 */

import { useEffect, useId, useRef } from 'react';
import { detectBluetoothEnv, envAdvice } from '../bluetooth';
import type { BluetoothCubeHandle } from '../bluetooth';
import { Bluetooth, Battery, Check, X, RotateCcw, ExternalLink } from 'lucide-react';

interface Props {
  isZh: boolean;
  cube: BluetoothCubeHandle;
  onClose: () => void;
  onConnect: () => Promise<void>;
}

export default function BluetoothModal({ isZh, cube, onClose, onConnect }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus → first focusable element (button/link) in dialog. Mount-only.
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

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="timer-modal bluetooth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          <Bluetooth size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {isZh ? '智能魔方' : 'Smart cube'}
        </h2>

        {!supported && advice && (
          <>
            <div className="modal-section bt-warn">
              <h3 className="bt-warn-title">{isZh ? advice.title.zh : advice.title.en}</h3>
              <p>{isZh ? advice.body.zh : advice.body.en}</p>
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
              <p>{isZh
                ? '提示：在 Bluefy 里访问本页后，把它"添加到主屏幕"就能像 App 一样随时打开。'
                : 'Tip: once Bluefy loads this page, "Add to Home Screen" so it opens like a native app.'}</p>
            </div>
          </>
        )}

        {supported && inBluefy && !connected && (
          <div className="modal-section bt-tip" style={{ marginBottom: 8 }}>
            <p style={{ color: '#9fd9ad' }}>
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {isZh ? '检测到 Bluefy — Web Bluetooth 已启用 ✓' : 'Bluefy detected — Web Bluetooth ready ✓'}
            </p>
          </div>
        )}

        {supported && !connected && (
          <div className="modal-section">
            <p>{isZh
              ? '点击下方按钮，从浏览器选择你的智能魔方。'
              : 'Click below to pick your smart cube from the browser picker.'}</p>
            <p style={{ fontSize: 12, color: '#888' }}>{isZh
              ? '当前支持：GAN 356 i / i3 / 357（完整解码）、GAN 12/14（完整解码）、QiYi（完整解码）、GoCube / Rubik\'s Connected（完整解码）、MoYu AI（完整解码）、Giiker i3s / Xiaomi（完整解码）。'
              : 'Supported: GAN 356 i / i3 / 357 (full decode), GAN 12/14 (full decode), QiYi (full decode), GoCube / Rubik\'s Connected (full decode), MoYu AI (full decode), Giiker i3s / Xiaomi (full decode).'}</p>
            <button className="bt-connect-btn" onClick={() => { void onConnect(); }}>
              <Bluetooth size={14} />
              <span>{isZh ? '搜索并连接' : 'Search & connect'}</span>
            </button>
          </div>
        )}

        {supported && connected && (
          <>
            <div className="modal-section bt-status">
              <div className="bt-row">
                <span className="bt-label">{isZh ? '设备' : 'Device'}</span>
                <span className="bt-value">{cube.status.deviceName}</span>
              </div>
              <div className="bt-row">
                <span className="bt-label">{isZh ? '型号' : 'Brand'}</span>
                <span className="bt-value">{cube.status.brand}</span>
              </div>
              <div className="bt-row">
                <span className="bt-label">
                  <Battery size={14} style={{ verticalAlign: 'middle' }} />{' '}
                  {isZh ? '电量' : 'Battery'}
                </span>
                <span className="bt-value">
                  {cube.status.battery !== null ? `${cube.status.battery}%` : '—'}
                </span>
              </div>
              <div className="bt-row">
                <span className="bt-label">{isZh ? '状态' : 'State'}</span>
                <span className={`bt-value ${cube.solved ? 'ok' : 'unsolved'}`}>
                  {cube.solved
                    ? <><Check size={14} style={{ verticalAlign: 'middle' }} /> {isZh ? '已还原' : 'Solved'}</>
                    : <><X size={14} style={{ verticalAlign: 'middle' }} /> {isZh ? '未还原' : 'Unsolved'}</>}
                </span>
              </div>
              <div className="bt-row">
                <span className="bt-label">{isZh ? '最近一步' : 'Last move'}</span>
                <span className="bt-value mono">{cube.lastMove ?? '—'}</span>
              </div>
            </div>
            <div className="modal-section bt-tip">
              <p>{isZh
                ? '把魔方还原到出厂状态后点击下方"重置状态"，然后开始打乱 → 计时 → 还原，魔方还原瞬间会自动停止计时。'
                : 'Set the cube to its solved state, click "Reset state", then scramble → time → solve. The timer auto-stops when the cube is back to solved.'}</p>
            </div>
          </>
        )}

        <div className="modal-actions">
          {supported && connected && (
            <>
              <button onClick={() => cube.resetState()}>
                <RotateCcw size={14} /> {isZh ? '重置状态' : 'Reset state'}
              </button>
              <button className="danger" onClick={() => { cube.disconnect(); onClose(); }}>
                {isZh ? '断开' : 'Disconnect'}
              </button>
            </>
          )}
          <button className="primary" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
