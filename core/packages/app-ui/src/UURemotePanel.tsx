import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { InstalledAppHost } from './platform';
import type { UURemoteClient } from './uu-remote';

const copy = {
  zh: { title: 'UU 远程', help: '连接自己的 Windows / Mac 电脑。手机需安装 UU 远程 4.42.0 或更新版本，并在 UU 中登录、添加电脑和允许被控。iOS 小窗需要 iOS 18 或更新版本。', unsupported: 'UU 的调用协议目前仅支持 Android / iOS 手机客户端。请在手机 CubeRoot App 中使用。', bind: '绑定电脑', rebind: '更换电脑', bound: '已绑定一台电脑', unbound: '尚未绑定电脑', full: '全屏远控', pip: '小窗观看', cancel: '停止等待', forget: '移除本机绑定', install: '安装 / 更新 UU 远程', privacy: '绑定仅保存在本机安全存储，不上传 CubeRoot。移除绑定或停止等待不会结束 UU 中正在进行的远控。' },
  en: { title: 'UU Remote', help: 'Connect to your Windows / Mac computer. Install UU Remote 4.42.0 or later on your phone, sign in, add your computer and allow remote access in UU. PiP on iOS requires iOS 18 or later.', unsupported: 'UU’s integration protocol currently supports Android / iOS phones only. Use CubeRoot on your phone.', bind: 'Bind computer', rebind: 'Change computer', bound: 'One computer bound', unbound: 'No computer bound', full: 'Full-screen control', pip: 'Picture in picture', cancel: 'Stop waiting', forget: 'Remove local binding', install: 'Install / update UU Remote', privacy: 'The binding stays in this device’s secure storage and is not uploaded to CubeRoot. Removing it or stopping the wait does not end an active UU remote session.' },
};
const messages: Record<string, { zh: string; en: string }> = {
  waiting: { zh: '请在 UU 远程中完成操作。返回后仍在等待时，可停止等待再重试。', en: 'Complete the action in UU Remote. If still waiting after returning, stop waiting and retry.' },
  opened: { zh: '已打开 UU 远程，请在 UU 中查看连接结果。', en: 'UU Remote opened. Check the connection there.' },
  bound: { zh: '电脑已绑定，可以发起远控。', en: 'Computer bound. You can now connect.' },
  connected: { zh: 'UU 远程已确认小窗启动成功。', en: 'UU Remote confirmed that picture in picture started.' },
  failed: { zh: '操作失败，请重试；若持续失败，请重新打开 CubeRoot。', en: 'Action failed. Retry, or reopen CubeRoot if the problem persists.' },
  not_installed: { zh: '未检测到 UU 远程，请先安装或更新到 4.42.0 以上。', en: 'UU Remote was not detected. Install or update to 4.42.0 or later.' },
  open_failed: { zh: '无法打开 UU 远程，请确认已安装最新版本后重试。', en: 'Could not open UU Remote. Check that it is up to date and retry.' },
  no_binding: { zh: '请先绑定电脑。', en: 'Bind a computer first.' },
  no_device: { zh: 'UU 账号下没有 Windows / Mac 电脑，请先在 UU 中添加。', en: 'No Windows / Mac computer on this UU account. Add one in UU first.' },
  device_not_found: { zh: '电脑不存在、已解绑或 UU 账号已切换，请重新绑定。', en: 'Computer removed or UU account changed. Bind again.' },
  device_offline: { zh: '电脑离线，请开启或唤醒电脑后重试。', en: 'Computer offline. Turn it on or wake it, then retry.' },
  pip_unsupported: { zh: '当前无法使用小窗，请尝试全屏远控。iOS 小窗需 iOS 18 以上及设备支持。', en: 'PiP is unavailable. Try full-screen control. iOS PiP needs iOS 18+ and device support.' },
  busy: { zh: 'UU 正在进行其他操作，请先在 UU 中处理后重试。', en: 'UU is busy. Finish the current action in UU, then retry.' },
  not_allowed: { zh: '请在电脑端 UU 中开启允许被控，并确认电脑为 Windows / Mac。', en: 'Enable remote access in UU on your Windows / Mac computer.' },
  network_unavailable: { zh: '网络不可用，请检查网络后重试。', en: 'Network unavailable. Check your connection and retry.' },
  timeout: { zh: '等待超时，请重试。', en: 'Timed out. Please retry.' },
  login_timeout: { zh: '登录等待超时，请先在 UU 中完成登录。', en: 'Login timed out. Sign in to UU first.' },
  not_logined: { zh: '请先在 UU 中登录后重试。', en: 'Sign in to UU and retry.' },
  logout: { zh: 'UU 已退出登录，请重新登录后重试。', en: 'Signed out of UU. Sign in and retry.' },
  user_cancel: { zh: '已取消操作。', en: 'Action cancelled.' },
  cancelled: { zh: '已停止等待，之后返回的旧结果将被忽略。', en: 'Stopped waiting. Late results will be ignored.' },
  forgotten: { zh: '本机绑定已移除。', en: 'Local binding removed.' },
  expired: { zh: '请求已过期，请重试。', en: 'Request expired. Please retry.' },
  superseded: { zh: '请求已被 UU 中的新请求替代，请重试。', en: 'Request superseded in UU. Please retry.' },
  connect_timeout: { zh: '连接超时，请重试。', en: 'Connection timed out. Please retry.' },
  connect_failed: { zh: '连接失败，请在 UU 中检查设备和网络后重试。', en: 'Connection failed. Check the device and network in UU and retry.' },
};

function RemoteControls({ client, language }: { client: UURemoteClient; language: 'zh' | 'en' }) {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const text = copy[language];
  useEffect(() => { void client.initialize(); }, [client]);
  const disabled = !state.ready || state.busy || Boolean(state.pending);
  const message = Object.hasOwn(messages, state.message) ? messages[state.message] : messages.connect_failed;
  return <>
    <p>{state.bound ? text.bound : text.unbound}</p>
    <div className="action-row">
      <button type="button" className="secondary-action" disabled={disabled} onClick={() => void client.start('bind')}>{state.bound ? text.rebind : text.bind}</button>
      <button type="button" className="secondary-action" disabled={disabled || !state.bound} onClick={() => void client.start('fullscreen')}>{text.full}</button>
      <button type="button" className="secondary-action" disabled={disabled || !state.bound} onClick={() => void client.start('pip')}>{text.pip}</button>
      {state.pending && <button type="button" className="secondary-action" disabled={state.busy} onClick={() => void client.cancel()}>{text.cancel}</button>}
      {state.bound && <button type="button" className="secondary-action" disabled={state.busy} onClick={() => void client.forget()}>{text.forget}</button>}
    </div>
    <p role="status">{state.message ? message[language] : ''}</p>
    {!state.ready && !state.busy && <button type="button" className="secondary-action" onClick={() => void client.initialize()}>{text.bind}</button>}
  </>;
}

/** App-owned native utility beside, not inside, the canonical account website. */
export function UURemotePanel({ host, language }: { host: InstalledAppHost; language: 'zh' | 'en' }) {
  const text = copy[language];
  const [openFailed, setOpenFailed] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const client = host.uuRemote;
    if (!client) return;
    let returned = 0;
    const update = () => {
      const next = client.getSnapshot().returned;
      if (next > returned && details.current) details.current.open = true;
      returned = next;
    };
    update();
    return client.subscribe(update);
  }, [host.uuRemote]);
  return <details className="uu-remote-panel" ref={details}>
    <summary>{text.title}</summary>
    {host.uuRemote ? <>
      <p>{text.help}</p>
      <RemoteControls client={host.uuRemote} language={language} />
      <button type="button" className="secondary-action" onClick={() => {
        setOpenFailed(false);
        void host.openExternal('https://uuyc.163.com/').catch(() => setOpenFailed(true));
      }}>{text.install}</button>
      {openFailed && <p role="alert">{messages.open_failed[language]}</p>}
      <p>{text.privacy}</p>
    </> : <p>{text.unsupported}</p>}
  </details>;
}
