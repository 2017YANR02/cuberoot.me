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

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { detectBluetoothEnv, envAdvice, BluetoothConnectError, CONNECT_STAGE_LABEL, describeError } from '../_lib/bluetooth';
import type { BluetoothCubeHandle, ConnectStage, ConnectPickOptions } from '../_lib/bluetooth';
import { normalizeMac } from '../_lib/bluetooth/mac';
import { probePicker, type ProbeStep } from '../_lib/bluetooth/picker_probe';
import { Bluetooth, Battery, Check, X, RotateCcw, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  cube: BluetoothCubeHandle;
  onClose: () => void;
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
}

/** One supported device. `gyro` marks models whose protocol also carries an
 *  orientation quaternion, which drives the live 3D view. */
interface SupportedDevice {
  zh: string;
  en: string;
  gyro?: boolean;
}

/**
 * 这张表是**说明**,不是白名单 —— 真正决定认不认的是连上之后读到的 GATT service
 * UUID(见 `_lib/bluetooth/index.ts` 的 connect:先按 service 选驱动,名字只是
 * 兜底)。所以同一代协议的新型号不用改代码就能用,这里写「及同代新款」而不是把型
 * 号一个个列全:列表逐个列型号,只会在厂商出新款时把「没写=不支持」这个错觉留给
 * 用户 —— GAN 16 ui 就是这么被问出来的。
 */
const SUPPORTED_CUBES: SupportedDevice[] = [
  { zh: 'GAN 356 i / i3 / 357', en: 'GAN 356 i / i3 / 357', gyro: true },
  { zh: 'GAN 12 / 14 / 16 ui / i Carry 及同代新款', en: 'GAN 12 / 14 / 16 ui / i Carry and newer of the same generation', gyro: true },
  { zh: 'MoYu 32 系列（威龙 V10 AI 及之后）', en: 'MoYu 32 series (WeiLong V10 Ai onward)', gyro: true },
  { zh: 'MoYu AI（旧 MHC 协议）', en: 'MoYu AI (legacy MHC protocol)' },
  { zh: 'QiYi 奇艺智能 / 风 AI Tornado V4', en: 'QiYi Smart Cube / Tornado V4 Ai' },
  { zh: 'GoCube / Rubik’s Connected', en: 'GoCube / Rubik’s Connected', gyro: true },
  { zh: 'Giiker i3s / 小米魔方', en: 'Giiker i3s / Xiaomi' },
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

const SUPPORTED_TIMERS: SupportedDevice[] = [
  { zh: 'GAN 智能计时器', en: 'GAN Smart Timer' },
  { zh: '奇艺智能计时器 / 转接器', en: 'QiYi Timer / Adapter' },
  { zh: 'Stackmat（走麦克风，不是蓝牙）', en: 'Stackmat (via microphone, not Bluetooth)' },
];

/**
 * What failed, at which step, and what to try next.
 *
 * The detail line is shown verbatim and in mono on purpose. It is whatever the
 * browser threw, and on iOS Bluefy that is a bare native code with no text at
 * all (the report this was built for read only "连接失败：2"). Naming the step
 * turns that same code into something actionable — "2 while opening the GATT
 * connection" is a different problem from "2 while choosing the device" — and
 * makes it worth screenshotting, which is how it will reach us.
 */
function ConnectFailure({ failure, inBluefy, busy, onShowAllDevices, probe, probing, onProbe }: {
  failure: { stage: ConnectStage | null; detail: string };
  inBluefy: boolean;
  busy: boolean;
  onShowAllDevices: () => void;
  probe: ProbeStep[] | null;
  probing: boolean;
  onProbe: () => void;
}) {
  const step = failure.stage === null ? null : CONNECT_STAGE_LABEL[failure.stage];
  return (
    <div className="modal-section bt-warn" style={{ marginTop: 10 }} role="alert">
      <h3 className="bt-warn-title" style={{ margin: 0 }}>
        {step
          ? tr({ zh: `连接失败：${step.zh}这一步`, en: `Connection failed while ${step.en}` })
          : tr({ zh: '连接失败', en: 'Connection failed' })}
      </h3>
      <p className="bt-error-detail">{failure.detail}</p>
      {/* Only for a picker-stage failure: past that point a device was already
          chosen, so re-opening the chooser unfiltered would fix nothing. */}
      {failure.stage === 'picker' && (
        <>
          <button
            type="button"
            className="bt-retry-btn"
            disabled={busy}
            onClick={onShowAllDevices}
          >
            <Bluetooth size={14} />
            <span>{tr({ zh: '显示全部蓝牙设备', en: 'Show all Bluetooth devices' })}</span>
          </button>
          <p className="bt-retry-hint">
            {tr({
              zh: '不带过滤条件重搜一次。有的浏览器会连过滤条件本身一起拒掉，列表会长很多，按名字认你的魔方。',
              en: 'Search again with no filters. Some browsers reject the filter set itself; the list will be much longer, so find your cube by name.',
            })}
          </p>
          <button type="button" className="bt-retry-btn" disabled={busy || probing} onClick={onProbe}>
            <span>{probing
              ? tr({ zh: '试探中…', en: 'Probing…' })
              : tr({ zh: '逐项试探是哪一项被拒', en: 'Find which option is refused' })}</span>
          </button>
          <p className="bt-retry-hint">
            {tr({
              zh: '会连着弹几次选择框，每次点「取消」就行 —— 弹出来本身就说明那一项没问题。跑完把结果截图发我。',
              en: 'It opens the chooser a few times; tap Cancel each time — the chooser appearing is itself the result. Screenshot what it prints.',
            })}
          </p>
          {probe && probe.length > 0 && (
            <ul className="bt-probe-list">
              {probe.map((s, i) => (
                <li key={i} className={s.outcome === 'refused' ? 'is-refused' : undefined}>
                  {`${i + 1}. ${tr(s.adds)} — `}
                  {s.outcome === 'opened'
                    ? tr({ zh: '弹出了', en: 'opened' })
                    : `${tr({ zh: '被拒', en: 'refused' })}: ${s.detail}`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {inBluefy && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
          <li>{tr({
            zh: 'iOS「设置 → Bluefy → 蓝牙」要允许，否则一台设备都搜不到。',
            en: 'iOS Settings → Bluefy → Bluetooth must be allowed, or nothing will be found.',
          })}</li>
          <li>{tr({
            zh: '打开 Bluefy 设置里的 Enable BLE Advertisements —— GAN、魔域 32、奇艺都要从蓝牙广播里取 MAC 才能解密。',
            en: 'Turn on “Enable BLE Advertisements” in Bluefy’s settings — GAN, MoYu 32 and QiYi all read their MAC out of the advertisement to derive the key.',
          })}</li>
          <li>{tr({
            zh: '魔方同一时刻只接受一个连接：先在其他 App 和 iOS 蓝牙设置里把它断开。',
            en: 'A cube accepts one connection at a time — disconnect it in other apps and in iOS Bluetooth settings first.',
          })}</li>
          <li>{tr({
            zh: '转一下魔方唤醒它，休眠时它不发广播。',
            en: 'Turn a face to wake the cube — it stops advertising while asleep.',
          })}</li>
        </ul>
      )}
    </div>
  );
}

export default function BluetoothModal({ isZh, cube, onClose, onConnect, macPrompt, onSubmitMac, onCancelMac }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<{ stage: ConnectStage | null; detail: string } | null>(null);
  const [probe, setProbe] = useState<ProbeStep[] | null>(null);
  const [probing, setProbing] = useState(false);

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
        borderBottom: '1px solid var(--border-default)',
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
              <p style={{ fontSize: 12, color: 'var(--signal-warning)', margin: '0 0 8px' }}>
                {tr({
                  zh: '刚才那个 MAC 可能不对——魔方连上了但读不到转动。核对后重新输入。',
                  en: 'That MAC looked wrong — the cube connected but no turns registered. Double-check and re-enter.',
                })}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
              {tr({
                zh: '没能自动识别这颗魔方的 MAC。GAN、魔域 32 和奇艺都用 MAC 派生解密密钥，所以少了它读不出转动。格式形如 AB:CD:EF:12:34:56。',
                en: "Couldn't auto-detect this cube's MAC. GAN, MoYu 32 and QiYi all derive their decryption key from it, so turns can't be decoded without it. Format: AB:CD:EF:12:34:56.",
              })}
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint-foreground)', margin: '0 0 8px' }}>
              {tr({
                zh: '在哪找：GAN 看官方 App「Cube Station」的设备信息；魔域 32 看「WCU CUBE」App；奇艺看「QiYi Cube」App。系统蓝牙设置里通常也能看到。',
                en: 'Where to look: GAN → Cube Station app, device info. MoYu 32 → WCU CUBE app. QiYi → QiYi Cube app. Your OS Bluetooth settings often show it too.',
              })}
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint-foreground)', margin: '0 0 8px' }}>
              {tr({
                zh: '为什么要手输：Web Bluetooth 规范刻意不向网页暴露 MAC 地址（原生 App 则可以直接读到），我们只能先尝试从蓝牙广播里恢复，失败才问你。',
                en: 'Why we ask: the Web Bluetooth spec deliberately hides MAC addresses from web pages (native apps can just read them). We try to recover it from the BLE advertisement first, and only ask when that fails.',
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
            <p style={{ color: 'var(--signal-success)' }}>
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
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>
              <div style={{ marginBottom: 4 }}>{tr({ zh: '支持的智能魔方：', en: 'Supported smart cubes:'
            })}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {SUPPORTED_CUBES.map((c) => (
                  <li key={c.en}>
                    {tr(c)}
                    {c.gyro && <span style={GYRO_TAG_STYLE}>{tr({ zh: '陀螺仪', en: 'gyro' })}</span>}
                  </li>
                ))}
              </ul>
              <div style={{ margin: '8px 0 4px' }}>{tr({ zh: '支持的计时设备：', en: 'Supported timing devices:'
            })}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {SUPPORTED_TIMERS.map((t) => (
                  <li key={t.en}>{tr(t)}</li>
                ))}
              </ul>
            </div>
            <button
              className="bt-connect-btn"
              style={connectBtnStyle ? { ...connectBtnStyle, marginTop: 10 } : { marginTop: 10 }}
              disabled={connecting}
              onClick={() => { void runConnect(); }}
            >
              <Bluetooth size={14} />
              <span>{connecting
                ? tr({ zh: '连接中…', en: 'Connecting…' })
                : tr({ zh: '搜索并连接', en: 'Search & connect' })}</span>
            </button>
            {connectError && (
              <ConnectFailure
                failure={connectError}
                inBluefy={inBluefy}
                busy={connecting}
                onShowAllDevices={() => { void runConnect({ acceptAllDevices: true }); }}
                probe={probe}
                probing={probing}
                onProbe={() => {
                  setProbe(null);
                  setProbing(true);
                  void probePicker()
                    .then(setProbe)
                    .finally(() => { setProbing(false); });
                }}
              />
            )}
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
              <button className="modal-action-btn" style={actionBtnStyle} onClick={() => cube.resetState()}>
                <RotateCcw size={14} /> {tr({ zh: '重置状态', en: 'Reset state'
                })}
              </button>
              <button
                className="danger modal-action-btn"
                style={actionBtnStyle}
                onClick={() => { cube.disconnect(); onClose(); }}
              >
                {tr({ zh: '断开', en: 'Disconnect'
                })}
              </button>
            </>
          )}
          <button className="primary modal-action-btn" style={actionBtnStyle} onClick={onClose}>
            {tr({ zh: '关闭', en: 'Close'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
