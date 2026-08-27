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
  CONNECT_STAGE_LABEL,
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
}

/** One supported device. `gyro` means this site can read the cube's
 * orientation and drive the live 3D view; it does not merely mean that the
 * product contains a motion sensor. */
interface SupportedDevice {
  zh: string;
  en: string;
  gyro?: boolean;
}

/**
 * This is a consumer-facing list of the 3x3 families/protocols the timer
 * implements. Do not derive it from the deliberately broad Bluetooth name
 * filters: those also see non-smart names and unsupported 2x2/shape-mod
 * products. GATT service UUIDs choose the actual driver after connection.
 */
const SUPPORTED_CUBES: SupportedDevice[] = [
  { zh: 'GAN356 i3', en: 'GAN356 i3', gyro: true },
  { zh: 'GAN356 i Carry / i Carry S / i Carry 2', en: 'GAN356 i Carry / i Carry S / i Carry 2' },
  { zh: 'GAN Mini ui FreePlay / GAN12 ui / GAN14 ui FreePlay', en: 'GAN Mini ui FreePlay / GAN12 ui / GAN14 ui FreePlay', gyro: true },
  { zh: 'Monster Go 3Ai', en: 'Monster Go 3Ai' },
  { zh: '魔域 AI 2023 三阶（MHC / AiCube 协议）', en: 'MoYu AI 2023 3x3 (MHC / AiCube protocol)' },
  { zh: '魔域 WCU_MY3 协议三阶（如威龙 V10 AI）', en: 'MoYu WCU_MY3-protocol 3x3 (e.g. WeiLong V10 AI)' },
  { zh: '奇艺 QY SC-S / SC-A / X-Man 风暴 V4 AI', en: 'QiYi QY SC-S / SC-A / X-Man Tornado V4 AI' },
  { zh: 'GoCube / GoCube Edge 三阶', en: 'GoCube / GoCube Edge 3x3', gyro: true },
  { zh: 'Rubik’s Connected 三阶', en: 'Rubik’s Connected 3x3' },
  { zh: 'GiiKER i3 / i3S / 小米米家智能魔方', en: 'GiiKER i3 / i3S / Xiaomi Mi Smart Magic Cube' },
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
function ConnectFailure({ failure, inBluefy, busy, onShowAllDevices }: {
  failure: { stage: ConnectStage | null; detail: string };
  inBluefy: boolean;
  busy: boolean;
  onShowAllDevices: () => void;
}) {
  const step = failure.stage === null ? null : CONNECT_STAGE_LABEL[failure.stage];
  return (
    <div className="modal-section bt-warn" style={{ marginTop: 10 }} role="alert">
      <h3 className="bt-warn-title" style={{ margin: 0 }}>
        {/* "…这一步" reads as "it got that far and tripped", which is exactly
            wrong for adapter-asleep: nothing was attempted at all. */}
        {failure.stage === 'adapter-asleep'
          ? tr({ zh: '蓝牙还没准备好', en: 'Bluetooth is not ready yet' })
          : step
            ? tr({ zh: `连接失败：${step.zh}这一步`, en: `Connection failed while ${step.en}` })
            : tr({ zh: '连接失败', en: 'Connection failed' })}
      </h3>
      <p className="bt-error-detail">{failure.detail}</p>
      {/* The one failure whose cause we actually know. Say it plainly instead of
          leaving the user staring at whatever the bridge threw. */}
      {failure.stage === 'adapter-asleep' && (
        <p className="bt-retry-hint">
          {tr({
            zh: '浏览器报告蓝牙还没就绪，这时候它会拒绝一切搜索。多数情况下再点一次「搜索并连接」就好；还是不行就把手机蓝牙关掉再打开，或者彻底退出浏览器重开。',
            en: 'The browser reports Bluetooth as not ready, and refuses every scan while that lasts. Tapping “Search & connect” again usually clears it; if not, toggle Bluetooth off and on, or fully quit and reopen the browser.',
          })}
        </p>
      )}
      {/* Only when the chooser opened and came back empty-handed. Past the
          picker a device was already chosen, so re-opening it fixes nothing;
          before it — a sleeping adapter — the browser refuses this search too. */}
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
              zh: '不带过滤条件重搜一次，列表会长很多，按名字认你的魔方。',
              en: 'Search again with no filters. The list will be much longer, so find your cube by name.',
            })}
          </p>
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

export default function BluetoothModal({ cube, onClose, onConnect, connectAttempt, macPrompt, onSubmitMac, onCancelMac }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(480);
  const [macInput, setMacInput] = useState('');
  const [macError, setMacError] = useState(false);
  const [connecting, setConnecting] = useState(false);
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
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea',
    );
    focusable?.focus();
  }, []);

  const clientEnvironment = detectClientEnvironment();
  const env = detectBluetoothEnv();
  const advice = envAdvice(env);
  const miniProgramBridge = mayUseMiniProgramBridge();
  const canConnect = miniProgramBridge || env === 'available' || env === 'available-bluefy';
  const inBluefy = env === 'available-bluefy';
  const connected = cube.status.connected;
  const advertisementDiagnostic = cube.advertisementDiagnostic;

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
    <div className="timer-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`timer-modal bluetooth-modal${connected ? ' bt-connected-modal' : ''}`}
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
          <span>{tr({ zh: '智能魔方', en: 'Smart cube' })}</span>
        </h2>

        {!macPrompt && !connected && (
          <p className="bt-tip" style={{ margin: '0 0 10px' }}>
            {tr({ zh: '检测到：', en: 'Detected: ' })}
            <strong style={{ color: 'var(--foreground)' }}>
              {tr(clientEnvironmentLabel(clientEnvironment))}
            </strong>
          </p>
        )}

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

        {canConnect && inBluefy && !connected && (
          <div className="modal-section bt-tip" style={{ marginBottom: 8 }}>
            <p style={{ color: 'var(--signal-success)' }}>
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {tr({ zh: '检测到 Bluefy — Web Bluetooth 已启用 ✓', en: 'Bluefy detected — Web Bluetooth ready ✓'
            })}
            </p>
          </div>
        )}

        {canConnect && !connected && !macPrompt && (
          <div className="modal-section">
            <p>{tr({ zh: '点击下方按钮，选择并连接你的智能魔方。', en: 'Click below to choose and connect your smart cube.'
            })}</p>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>
              <div style={{ marginBottom: 4 }}>{tr({ zh: '支持的三阶智能魔方（按协议）：', en: 'Supported 3x3 smart cubes (by protocol):'
            })}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {SUPPORTED_CUBES.map((c) => (
                  <li key={c.en}>
                    {tr(c)}
                    {c.gyro && <span style={GYRO_TAG_STYLE}>{tr({ zh: '陀螺仪', en: 'gyro' })}</span>}
                  </li>
                ))}
              </ul>
              <p style={{ margin: '5px 0 0' }}>
                {tr({
                  zh: '兼容性取决于蓝牙协议和固件。GAN i4、i Carry 4、GAN16 ui、魔域威龙 V11 AI 等新型号可能兼容，但本站尚未实机确认。同名普通版、2×2 和异形智能魔方不支持。「陀螺仪」表示本站可读取姿态。',
                  en: 'Compatibility depends on the Bluetooth protocol and firmware. New models such as GAN i4, i Carry 4, GAN16 ui, and MoYu WeiLong V11 AI may work but are not yet hardware-verified here. Similarly named non-smart, 2×2, and shape-mod smart cubes are not supported. “Gyro” means this site can read orientation.',
                })}
              </p>
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
            {advertisementDiagnostic && (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>
                {advertisementDiagnostic.phase === 'advertisement'
                  ? tr({
                      zh: `已收到 ${advertisementDiagnostic.eventNumber} 条广播，正在等待完整信息。`,
                      en: `${advertisementDiagnostic.eventNumber} advertisements received; waiting for complete data.`,
                    })
                  : advertisementDiagnostic.phase === 'gatt'
                    ? tr({ zh: '广播已完成，正在建立蓝牙连接。', en: 'Advertisement complete; establishing the Bluetooth connection.' })
                    : advertisementDiagnostic.phase === 'discovery'
                      ? tr({ zh: '蓝牙已连接，正在读取设备服务。', en: 'Bluetooth connected; reading device services.' })
                      : tr({ zh: '设备服务已识别，正在完成协议握手。', en: 'Device services identified; completing the protocol handshake.' })}
              </p>
            )}
            {connectError && (
              <ConnectFailure
                failure={connectError}
                inBluefy={inBluefy}
                busy={connecting}
                onShowAllDevices={() => { void runConnect({ acceptAllDevices: true }); }}
              />
            )}
          </div>
        )}

        {connected && (
          <>
            <div className="modal-section bt-connected-summary">
              <div className="bt-connected-primary">
                <strong className="bt-connected-device">{cube.status.deviceName}</strong>
                <span className={`bt-value bt-connected-state ${cube.solved ? 'ok' : 'unsolved'}`}>
                  {cube.solved ? <Check size={13} /> : <X size={13} />}
                  {tr({ zh: `已连接，${cube.solved ? '已还原' : '未还原'}`, en: `Connected, ${cube.solved ? 'solved' : 'unsolved'}` })}
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
                  <span className="bt-value">{cube.status.brand}</span>
                </span>
              </div>
            </div>
            <p className="modal-section bt-connected-help">
              {tr({
                zh: '不同步？还原实物后重置；还原会自动停表。',
                en: 'Out of sync? Solve, then reset. Solving automatically stops the timer.',
              })}
            </p>
            {advertisementDiagnostic?.phase === 'connected' && advertisementDiagnostic.complete && (
              <p className="modal-section bt-connected-help">
                {tr({
                  zh: `连接诊断：选中设备后共 ${(advertisementDiagnostic.totalElapsedMs / 1000).toFixed(2)} 秒。广播第 ${advertisementDiagnostic.eventNumber} 条拿到完整信息 ${(advertisementDiagnostic.advertisementMs! / 1000).toFixed(2)} 秒，GATT ${(advertisementDiagnostic.gattMs! / 1000).toFixed(2)} 秒，读取服务 ${(advertisementDiagnostic.discoveryMs! / 1000).toFixed(2)} 秒，协议握手 ${(advertisementDiagnostic.handshakeMs! / 1000).toFixed(2)} 秒。`,
                  en: `Connection diagnostic: ${(advertisementDiagnostic.totalElapsedMs / 1000).toFixed(2)} seconds after device selection. Complete data arrived in advertisement ${advertisementDiagnostic.eventNumber}: advertisement ${(advertisementDiagnostic.advertisementMs! / 1000).toFixed(2)}s, GATT ${(advertisementDiagnostic.gattMs! / 1000).toFixed(2)}s, service discovery ${(advertisementDiagnostic.discoveryMs! / 1000).toFixed(2)}s, protocol handshake ${(advertisementDiagnostic.handshakeMs! / 1000).toFixed(2)}s.`,
                })}
              </p>
            )}
          </>
        )}

        {connected && (
          <div
            className="modal-actions"
            style={isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}
          >
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
          </div>
        )}
      </div>
    </div>
  );
}
