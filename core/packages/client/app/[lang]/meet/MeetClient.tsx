'use client';

/**
 * /meet — 会议室。多人视频通话,用法与 Zoom / 腾讯会议一致:建一场会,把链接发出去。
 *
 * 四个阶段,顺序固定:
 *   未登录   登录入口。会议要求登录 —— 身份与显示名全部由服务端从 token 里取,
 *            客户端报不了自己是谁,所以会议里不可能出现顶着别人名字的画面。
 *   大厅     新建会议 / 输入会议码。
 *   入会前   PreJoin:先看自己的画面、挑摄像头和麦克风、决定进去时开不开 —— 这一屏是所有
 *            会议软件的标配,少了它人是「先进去再手忙脚乱地关摄像头」。
 *   会议中   MeetStage:宫格 / 焦点布局、屏幕共享、聊天、参与者、设备切换、说话高亮。
 *
 * 与 /timer 对战房里那条视频的**唯一**授权区别:对战房有在册名单(pid 必须在
 * battle_rooms.players 里)且免登录;会议室要登录,进哪一间由 4 位数字会议码决定。
 *
 * 预约保存主题、时间和周期，不保存通话或聊天内容。媒体房在首个人连接时创建、没人时关闭。
 * 刷新页面会带着 ?room= 回到同一场会。
 *
 * 人数上限 6 人 · 1080p:SFU 要把每人的流转发给其余 n-1 人,最坏出向 6*5*3 + 屏幕共享
 * 5*1.5 = 97.5 Mbps,在 140 的预算里还剩得下一间四人对战房。上限由服务端 /video/config
 * 给,不在这里写死。
 *
 * 画面、布局、参与者格这些没有文案的部件直接用 @livekit/components-react 的成品件;
 * 有文案的(控制条、聊天)在 MeetStage 里换成走 tr() 的自己人 —— 库把每一句都写死成英文
 * 且不给参数,/zh 下一进会议全变英文是能一眼看见的断层。外观在 meet.css 里用 --lk-* 变量
 * 接到本站的 token 上,所以它跟着全站主题走。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { LiveKitRoom, PreJoin, type LocalUserChoices } from '@livekit/components-react';
import type { DisconnectReason } from 'livekit-client';
import { Check, Copy, QrCode } from 'lucide-react';

import BoolToggle from '@/components/BoolToggle';
import { RoomQrModal } from '@/components/RoomQrModal';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage, type FailReason } from '@/components/video/video-call';
import { tr } from '@/i18n/tr';
import type { WcaUser } from '@/lib/auth-store';
import {
  VideoDeniedError,
  createMeetCode,
  getMeetToken,
  isMeetCode,
  normalizeMeetCode,
  type VideoConfig,
  type VideoToken,
} from '@/lib/video-room-api';
import MeetStage from './MeetStage';
import MeetLobby from './MeetLobby';

import '@livekit/components-styles';
import '@/components/video/video-call.css';
import './meet.css';

export default function MeetClient({ user, cfg }: { user: WcaUser; cfg: VideoConfig | null }) {
  // 会议码进 URL:刷新、收藏、发给别人都是同一条链接。进出会议是大视图切换,故 push。
  const [roomParam, setRoomParam] = useQueryState('room', { history: 'push' });
  const pathname = usePathname();

  const [token, setToken] = useState<VideoToken | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const joining = useRef<AbortController | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // 返回、换会议码或卸载时，旧请求不能再把用户拉进已离开的会议。
  useEffect(() => {
    setBusy(false);
    return () => {
      joining.current?.abort();
      joining.current = null;
    };
  }, [roomParam]);


  const maxParticipants = cfg?.meetMaxParticipants ?? 0;
  const urlCode = roomParam ? normalizeMeetCode(roomParam) : '';
  /**
   * 会议中显示哪个码,以 **token 为准**而不是地址栏。会议是全屏浮层,手机上一次侧滑返回
   * 就把 ?room= 弹掉了(nuqs 同步 popstate,但连接还在),此时若跟着地址栏走,顶栏的
   * 会议码会变空、「复制邀请链接」复制出一条没有 room 的裸链接 —— 发给谁谁进不来。
   */
  const code = token ? token.room.slice('meet-'.length) : urlCode;
  const inviteUrl = code
    ? `${window.location.origin}${pathname}?room=${code}`
    : '';
  const fail = useCallback(
    (reason: FailReason) => setErr(denyMessage(reason, maxParticipants)),
    [maxParticipants],
  );
  const connectFail = useCallback(
    () => setErr((current) => current ?? denyMessage('connect', maxParticipants)),
    [maxParticipants],
  );
  // PreJoin uses this callback as a capture-effect dependency: keep it stable.
  const mediaFail = useCallback(() => fail('media'), [fail]);

  const join = useCallback((target: string) => {
    // 到这里的码一定过了 isMeetCode,所以服务端再回 invalid 就不是用户抄错(见 stale-api)。
    if (!isMeetCode(target) || joining.current) return;
    const attempt = new AbortController();
    joining.current = attempt;
    setBusy(true);
    setErr(null);
    getMeetToken(target, attempt.signal)
      .then((result) => {
        if (joining.current === attempt && !attempt.signal.aborted) setToken(result);
      })
      .catch((e: unknown) => {
        if (joining.current !== attempt || attempt.signal.aborted) return;
        if (e instanceof Error && e.name === 'TimeoutError') {
          setErr(tr({ zh: '接入超时，请重试。', en: 'Joining timed out. Please try again.' }));
          return;
        }
        if (!(e instanceof VideoDeniedError)) { fail('connect'); return; }
        fail(e.reason === 'invalid' ? 'stale-api' : e.reason);
      })
      .finally(() => {
        if (joining.current !== attempt) return;
        joining.current = null;
        setBusy(false);
      });
  }, [fail]);

  const createMeeting = useCallback(() => {
    setBusy(true);
    setErr(null);
    createMeetCode()
      .then((fresh) => setRoomParam(fresh))
      .catch((e: unknown) => {
        if (!(e instanceof VideoDeniedError)) { fail('connect'); return; }
        fail(e.reason === 'invalid' ? 'stale-api' : e.reason);
      })
      .finally(() => setBusy(false));
  }, [fail, setRoomParam]);

  /**
   * 挂断 = 回大厅。**必须连 ?room= 一起清掉**:只清 token 的话,渲染会退回到「入会前」
   * 那一屏,PreJoin 立刻重新 createLocalTracks —— 用户刚按完红色挂断,摄像头灯又亮了,
   * 而且没有任何出口(整页唯一进会议的入口就是那一屏)。
   *
   * 掉线不是自己按的,就得给话:DUPLICATE_IDENTITY(在另一台设备上进了同一场会)、
   * 服务重启、被移出 —— 静默回到大厅等于「画面突然没了」。
   */
  const leave = useCallback((reason?: DisconnectReason) => {
    setToken(null);
    setQrOpen(false);
    setErr(disconnectMessage(reason));
    // 挂断不能再 push 一条历史:否则按一次返回就回到 PreJoin,摄像头马上重新亮起。
    void setRoomParam(null, { history: 'replace' });
  }, [setRoomParam]);

  const copyInvite = useCallback(() => {
    // 同理,链接从会议码拼,不读 window.location —— 后者可能已经被返回键弹掉了 room。
    void navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => { /* 剪贴板被拒:链接就在地址栏里,不值得报错打断 */ });
  }, [inviteUrl]);

  // 入会前那一屏挑的设备要真的用上,否则「选了摄像头却开了另一个」。
  const roomOptions = useMemo(() => ({
    ...LIVEKIT_ROOM_OPTIONS,
    // Request enough pixels for Retina/phone displays while retaining congestion adaptation.
    adaptiveStream: { pixelDensity: 'screen' as const },
    videoCaptureDefaults: {
      ...LIVEKIT_ROOM_OPTIONS.videoCaptureDefaults,
      deviceId: choices?.videoDeviceId || undefined,
    },
    audioCaptureDefaults: {
      ...LIVEKIT_ROOM_OPTIONS.audioCaptureDefaults,
      deviceId: choices?.audioDeviceId || undefined,
    },
  }), [choices]);

  // ── 会议中 ───────────────────────────────────────────────
  // data-lk-theme 是成品件读主题变量的钩子;meet.css 在同一选择器上把它们接到本站 token。
  if (token) {
    return (
      <main className="meet-live" data-lk-theme="default">
        <header className="meet-bar">
          <span className="meet-code">{code}</span>
          <button type="button" className="meet-copy" onClick={copyInvite}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制邀请链接', en: 'Copy invite link' })}
          </button>
          <button
            type="button"
            className="meet-copy"
            onClick={() => setQrOpen(true)}
            title={tr({ zh: '二维码(扫码加入会议)', en: 'QR code (scan to join meeting)' })}
            aria-label={tr({ zh: '会议二维码', en: 'Meeting QR code' })}
          >
            <QrCode size={14} />
          </button>
          {err && <span className="vc-err">{err}</span>}
        </header>

        <LiveKitRoom
          serverUrl={token.url}
          token={token.token}
          connect
          video={choices?.videoEnabled ?? true}
          audio={choices?.audioEnabled ?? true}
          options={roomOptions}
          onDisconnected={leave}
          // onDisconnected 往往能给出「房满/另一台设备登录」等具体原因;通用错误不能覆盖它。
          onError={connectFail}
          onMediaDeviceFailure={mediaFail}
          className="meet-room"
        >
          <MeetStage speakerEnabled={speakerEnabled} onToggleSpeaker={() => setSpeakerEnabled(value => !value)} />
        </LiveKitRoom>
        {qrOpen && inviteUrl && (
          <RoomQrModal url={inviteUrl} code={code} onClose={() => setQrOpen(false)} />
        )}
      </main>
    );
  }

  // ── 入会前:先看自己的画面、挑设备 ────────────────────────
  if (isMeetCode(code)) {
    return (
      <main className="meet-page is-prejoin" data-lk-theme="default">
        <h1 className="meet-title">{tr({ zh: '准备进入会议', en: 'Ready to join' })}</h1>
        <p className="meet-sub">
          {tr({ zh: `会议 ${code}`, en: `Meeting ${code}` })}
        </p>
        <p className="meet-sub">{user.name}</p>
        <BoolToggle label={tr({ zh: '开启扬声器', en: 'Enable speaker' })}
          value={speakerEnabled} onChange={setSpeakerEnabled} disabled={busy} />
        <fieldset className="meet-prejoin-fields" disabled={busy} aria-busy={busy}>
        <PreJoin
          // 名字来自账号,不给改 —— 输入框由 meet.css 藏掉。
          defaults={{ username: user.name, videoEnabled: false, audioEnabled: true }}
          // PreJoin 默认的校验是「用户名非空」,而输入框藏起来了:显示名为空的账号
          // (社交登录没给名字的那些)会永远卡在一个灰掉的「进入会议」上,无从补救。
          // 服务端本来就不认客户端报的名字(取 token 里的),这个校验对我们没有意义。
          onValidate={() => true}
          onSubmit={(c) => { setChoices(c); join(code); }}
          onError={mediaFail}
          joinLabel={busy ? tr({ zh: '接入中…', en: 'Joining…' }) : tr({ zh: '进入会议', en: 'Join' })}
          micLabel={tr({ zh: '麦克风', en: 'Microphone' })}
          camLabel={tr({ zh: '摄像头', en: 'Camera' })}
        />
        </fieldset>
        <button type="button" className="meet-join" onClick={() => {
          joining.current?.abort();
          joining.current = null;
          setBusy(false);
          setErr(null);
          void setRoomParam(null, { history: 'replace' });
        }}>
          {tr({ zh: '取消入会', en: 'Cancel joining' })}
        </button>
        {err && <p className="vc-err">{err}</p>}
      </main>
    );
  }

  return (
    <MeetLobby key={user.uid ?? user.wcaId} maxParticipants={maxParticipants} busy={busy} error={err}
      onCreate={createMeeting} onJoin={(code) => { setErr(null); void setRoomParam(code); }} />
  );
}
