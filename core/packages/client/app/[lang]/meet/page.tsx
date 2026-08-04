'use client';

/**
 * /meet — 会议室。多人视频通话,和 Zoom / 腾讯会议同一个用法:建一场会,把链接发出去。
 *
 * 与 /timer 对战房里那条视频的**唯一**区别是授权:对战房有在册名单(pid 必须在
 * battle_rooms.players 里),会议室没有 —— **链接就是凭证**。所以会议码取 9 位 45 bit
 * (见 lib/video-room-api.ts 的 MEET_CODE_ALPHABET),不像对战房那个 5 位码那样可猜。
 * 连上之后的画面宫格、控制条、前后置切换全部是同一个 components/video/VideoTiles。
 *
 * 本站不存任何会议记录:LiveKit 在第一个人进来时自动建房、没人了自动关。因此既没有
 * 「会议列表」可以被人翻,也不需要清理任务。刷新页面会带着 ?room= 回到同一场会。
 *
 * 人数上限 6 人 · 1080p:SFU 要把每人的流转发给其余 n-1 人,最坏出向 6*5*3 = 90 Mbps,
 * 在 140 的预算里还剩得下一间四人对战房。上限由服务端 /video/config 给,不在这里写死。
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryState } from 'nuqs';
import { LiveKitRoom } from '@livekit/components-react';
import { Copy, Check, Video } from 'lucide-react';

import VideoTiles from '@/components/video/VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, type FailReason } from '@/components/video/video-call';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import {
  MEET_CODE_LEN,
  VideoDeniedError,
  getMeetToken,
  getVideoConfig,
  isMeetCode,
  newMeetCode,
  newParticipantId,
  normalizeMeetCode,
  type VideoConfig,
  type VideoToken,
} from '@/lib/video-room-api';

import './meet.css';

const NAME_KEY = 'cr.meet.name';
const ID_KEY = 'cr.meet.id';
/** 服务端 PID_RE 的副本:存在本机的旧 id 要先验一遍,坏值不如重新生成一个。 */
const ID_RE = /^[a-z0-9]{6,16}$/;

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

export default function MeetPage() {
  // 会议码进 URL:刷新、收藏、发给别人都是同一条链接。进出会议是大视图切换,故 push。
  const [roomParam, setRoomParam] = useQueryState('room', { history: 'push' });

  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [name, setName] = useState('');
  /** 本机一次性身份。存下来,刷新后重连能被服务端认成同一个人而不是新增一人。 */
  const [id, setId] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [token, setToken] = useState<VideoToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dead = false;
    void getVideoConfig().then((c) => { if (!dead) setCfg(c); });
    return () => { dead = true; };
  }, []);

  // localStorage 只能在挂载后读:这页是静态预渲染的,渲染期读会让首帧和 hydration 不一致。
  useEffect(() => {
    setName(readLocal(NAME_KEY));
    const saved = readLocal(ID_KEY);
    if (ID_RE.test(saved)) { setId(saved); return; }
    const fresh = newParticipantId();
    persistItem(ID_KEY, fresh);
    setId(fresh);
  }, []);

  const maxParticipants = cfg?.meetMaxParticipants ?? 0;
  const code = roomParam ? normalizeMeetCode(roomParam) : '';
  const trimmedName = name.trim();
  const fail = useCallback(
    (reason: FailReason) => setErr(denyMessage(reason, maxParticipants)),
    [maxParticipants],
  );

  const join = useCallback((target: string) => {
    if (!isMeetCode(target) || !trimmedName || !id) return;
    setBusy(true);
    setErr(null);
    getMeetToken(target, id, trimmedName)
      .then(setToken)
      .catch((e: unknown) => fail(e instanceof VideoDeniedError ? e.reason : 'connect'))
      .finally(() => setBusy(false));
  }, [trimmedName, id, fail]);

  const startNew = useCallback(() => {
    const fresh = newMeetCode();
    void setRoomParam(fresh);
    join(fresh);
  }, [setRoomParam, join]);

  const joinTyped = useCallback(() => {
    const target = normalizeMeetCode(codeInput);
    void setRoomParam(target);
    join(target);
  }, [codeInput, setRoomParam, join]);

  const leave = useCallback(() => { setToken(null); setErr(null); }, []);

  const copyInvite = useCallback(() => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => { /* 剪贴板被拒:链接就在地址栏里,不值得报错打断 */ });
  }, []);

  // 名字改一次存一次 —— 下次开会不用重填。
  const changeName = useCallback((v: string) => {
    setName(v);
    persistItem(NAME_KEY, v.trim());
  }, []);

  if (cfg && !cfg.enabled) {
    return (
      <main className="meet-page">
        <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
        <p className="vc-err">{tr({ zh: '本站未启用视频', en: 'Video is not enabled on this site' })}</p>
      </main>
    );
  }

  if (token) {
    return (
      <main className="meet-page is-live">
        <LiveKitRoom
          serverUrl={token.url}
          token={token.token}
          connect
          video
          audio
          options={LIVEKIT_ROOM_OPTIONS}
          onDisconnected={leave}
          onError={() => fail('connect')}
          onMediaDeviceFailure={() => fail('media')}
        >
          <VideoTiles onLeave={leave} onCameraError={() => fail('camera')} />
        </LiveKitRoom>

        <div className="meet-invite">
          <span className="meet-code" title={tr({ zh: '会议码', en: 'Meeting code' })}>{code}</span>
          <button type="button" className="meet-copy" onClick={copyInvite}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制邀请链接', en: 'Copy invite link' })}
          </button>
        </div>

        {err && <p className="vc-err">{err}</p>}
      </main>
    );
  }

  const canJoin = !!trimmedName && !!id && !busy;

  return (
    <main className="meet-page">
      <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
      <p className="meet-sub">
        {maxParticipants
          ? tr({ zh: `最多 ${maxParticipants} 人,1080p。会议码就是凭证,发给谁谁就能进。`,
                 en: `Up to ${maxParticipants} people at 1080p. The code is the key — anyone with it can join.` })
          : tr({ zh: '多人视频通话。会议码就是凭证,发给谁谁就能进。',
                 en: 'Group video call. The code is the key — anyone with it can join.' })}
      </p>

      <label className="meet-field">
        <span>{tr({ zh: '你的名字', en: 'Your name' })}</span>
        <input
          type="text"
          className="meet-name-input"
          value={name}
          maxLength={24}
          autoComplete="nickname"
          placeholder={tr({ zh: '别人看到的名字', en: 'Shown to others' })}
          onChange={(e) => changeName(e.target.value)}
        />
      </label>

      {isMeetCode(code) ? (
        // 从邀请链接进来的:码已经定了,只差名字。
        <div className="meet-row">
          <button type="button" className="meet-go" disabled={!canJoin} onClick={() => join(code)}>
            <Video size={15} />
            {busy ? tr({ zh: '接入中…', en: 'Joining…' }) : tr({ zh: `加入 ${code}`, en: `Join ${code}` })}
          </button>
        </div>
      ) : (
        <>
          <div className="meet-row">
            <button type="button" className="meet-go" disabled={!canJoin} onClick={startNew}>
              <Video size={15} />
              {busy ? tr({ zh: '创建中…', en: 'Creating…' }) : tr({ zh: '新建会议', en: 'New meeting' })}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && canJoin) joinTyped(); }}
            />
            <button
              type="button"
              className="meet-join"
              disabled={!canJoin || codeInput.length !== MEET_CODE_LEN}
              onClick={joinTyped}
            >
              {tr({ zh: '加入', en: 'Join' })}
            </button>
          </div>
        </>
      )}

      {err && <p className="vc-err">{err}</p>}
    </main>
  );
}
