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
 *   会议中   VideoConference:宫格 / 焦点布局、屏幕共享、聊天、参与者、设备切换、说话高亮。
 *
 * 与 /timer 对战房里那条视频的**唯一**授权区别:对战房有在册名单(pid 必须在
 * battle_rooms.players 里)且免登录;会议室要登录,进哪一间由 9 位 45 bit 的会议码决定
 * (见 lib/video-room-api.ts 的 MEET_CODE_ALPHABET)。
 *
 * 本站不存任何会议记录:LiveKit 在第一个人进来时自动建房、没人了自动关。因此既没有
 * 「会议列表」可以被人翻,也不需要清理任务。刷新页面会带着 ?room= 回到同一场会。
 *
 * 人数上限 6 人 · 1080p:SFU 要把每人的流转发给其余 n-1 人,最坏出向 6*5*3 + 屏幕共享
 * 5*1.5 = 97.5 Mbps,在 140 的预算里还剩得下一间四人对战房。上限由服务端 /video/config
 * 给,不在这里写死。
 *
 * UI 用 @livekit/components-react 的成品件(VideoConference / PreJoin)而不是自己画:
 * 它们已经把会议软件那套交互做全了(说话高亮、静音角标、网络质量、屏幕共享自动切焦点、
 * 移动端收起屏幕共享按钮…),自己重写只会少功能。外观在 meet.css 里用 --lk-* 变量接到
 * 本站的 token 上,所以它跟着全站主题走。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { LiveKitRoom, PreJoin, VideoConference, type LocalUserChoices } from '@livekit/components-react';
import { Check, Copy, LogIn, Video } from 'lucide-react';

import AppLink from '@/components/AppLink';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, type FailReason } from '@/components/video/video-call';
import { tr } from '@/i18n/tr';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import {
  MEET_CODE_LEN,
  VideoDeniedError,
  getMeetToken,
  getVideoConfig,
  isMeetCode,
  newMeetCode,
  normalizeMeetCode,
  type VideoConfig,
  type VideoToken,
} from '@/lib/video-room-api';

import '@livekit/components-styles';
import './meet.css';

export default function MeetPage() {
  // 会议码进 URL:刷新、收藏、发给别人都是同一条链接。进出会议是大视图切换,故 push。
  const [roomParam, setRoomParam] = useQueryState('room', { history: 'push' });
  const pathname = usePathname();
  const user = useAuthUser();

  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [token, setToken] = useState<VideoToken | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** 首帧不能按登录态分叉渲染 —— 这页是静态预渲染的,分叉会 hydration 错配。 */
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let dead = false;
    void getVideoConfig().then((c) => { if (!dead) setCfg(c); });
    return () => { dead = true; };
  }, []);

  const maxParticipants = cfg?.meetMaxParticipants ?? 0;
  const code = roomParam ? normalizeMeetCode(roomParam) : '';
  const fail = useCallback(
    (reason: FailReason) => setErr(denyMessage(reason, maxParticipants)),
    [maxParticipants],
  );

  const join = useCallback((target: string) => {
    if (!isMeetCode(target)) return;
    setBusy(true);
    setErr(null);
    getMeetToken(target)
      .then(setToken)
      .catch((e: unknown) => fail(e instanceof VideoDeniedError ? e.reason : 'connect'))
      .finally(() => setBusy(false));
  }, [fail]);

  const leave = useCallback(() => { setToken(null); setErr(null); }, []);

  const copyInvite = useCallback(() => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => { /* 剪贴板被拒:链接就在地址栏里,不值得报错打断 */ });
  }, []);

  // 入会前那一屏挑的设备要真的用上,否则「选了摄像头却开了另一个」。
  const roomOptions = useMemo(() => ({
    ...LIVEKIT_ROOM_OPTIONS,
    videoCaptureDefaults: {
      ...LIVEKIT_ROOM_OPTIONS.videoCaptureDefaults,
      deviceId: choices?.videoDeviceId || undefined,
    },
    audioCaptureDefaults: {
      ...LIVEKIT_ROOM_OPTIONS.audioCaptureDefaults,
      deviceId: choices?.audioDeviceId || undefined,
    },
  }), [choices]);

  if (!mounted) return <main className="meet-page" />;

  if (cfg && !cfg.enabled) {
    return (
      <main className="meet-page">
        <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
        <p className="vc-err">{tr({ zh: '本站未启用视频', en: 'Video is not enabled on this site' })}</p>
      </main>
    );
  }

  // ── 未登录 ───────────────────────────────────────────────
  if (!user) {
    return (
      <main className="meet-page">
        <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
        <p className="meet-sub">
          {tr({ zh: '多人视频会议,支持屏幕共享和文字聊天。', en: 'Group video meetings with screen sharing and chat.' })}
        </p>
        <AppLink href={`/account${nextQuery(pathname)}`} className="meet-go" prefetch={false}>
          <LogIn size={15} />
          {tr({ zh: '登录后使用', en: 'Sign in to continue' })}
        </AppLink>
      </main>
    );
  }

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
          onError={() => fail('connect')}
          onMediaDeviceFailure={() => fail('media')}
          className="meet-room"
        >
          <VideoConference />
        </LiveKitRoom>
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
        <PreJoin
          // 名字来自账号,不给改 —— 输入框由 meet.css 藏掉,这里只是喂给它的校验。
          defaults={{ username: user.name, videoEnabled: true, audioEnabled: true }}
          onSubmit={(c) => { setChoices(c); join(code); }}
          onError={() => fail('media')}
          joinLabel={busy ? tr({ zh: '接入中…', en: 'Joining…' }) : tr({ zh: '进入会议', en: 'Join' })}
          micLabel={tr({ zh: '麦克风', en: 'Microphone' })}
          camLabel={tr({ zh: '摄像头', en: 'Camera' })}
        />
        {err && <p className="vc-err">{err}</p>}
      </main>
    );
  }

  // ── 大厅 ─────────────────────────────────────────────────
  return (
    <main className="meet-page">
      <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
      <p className="meet-sub">
        {maxParticipants
          ? tr({ zh: `最多 ${maxParticipants} 人,1080p,支持屏幕共享和文字聊天。`,
                 en: `Up to ${maxParticipants} people at 1080p, with screen sharing and chat.` })
          : tr({ zh: '多人视频会议,支持屏幕共享和文字聊天。',
                 en: 'Group video meetings with screen sharing and chat.' })}
      </p>

      <div className="meet-row">
        <button
          type="button"
          className="meet-go"
          disabled={busy}
          onClick={() => { const fresh = newMeetCode(); void setRoomParam(fresh); }}
        >
          <Video size={15} />
          {tr({ zh: '新建会议', en: 'New meeting' })}
        </button>
      </div>

      <div className="meet-row">
        <input
          type="text"
          className="meet-code-input"
          value={codeInput}
          // 粘整条邀请链接也认:normalizeMeetCode 会把 ?room= 挖出来。
          placeholder={tr({ zh: '会议码或邀请链接', en: 'Code or invite link' })}
          onChange={(e) => setCodeInput(normalizeMeetCode(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter' && codeInput.length === MEET_CODE_LEN) void setRoomParam(codeInput); }}
        />
        <button
          type="button"
          className="meet-join"
          disabled={codeInput.length !== MEET_CODE_LEN}
          onClick={() => void setRoomParam(codeInput)}
        >
          {tr({ zh: '加入', en: 'Join' })}
        </button>
      </div>

      {err && <p className="vc-err">{err}</p>}
    </main>
  );
}
