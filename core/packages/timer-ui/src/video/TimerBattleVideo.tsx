'use client';

import { useEffect, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { Video } from 'lucide-react';
import { VideoDeniedError, type BattleVideoClient, type VideoConfig, type VideoToken } from '@cuberoot/shared/video';
import VideoTiles from './VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage, type FailReason } from './video-call';
import './video-strip.css';

interface Intent { session: string; attempt: number }
interface Connection { key: string; token: VideoToken | null; busy: boolean; error: FailReason | null; disconnected?: DisconnectReason }
export interface VideoRoom {
  language: 'en' | 'zh'; enabled: boolean; wanted: boolean; token: VideoToken | null;
  busy: boolean; err: string | null; maxParticipants: number;
  toggle(): void;
  leave(reason?: DisconnectReason, disconnectedToken?: string): void;
  fail(reason: FailReason, failedToken?: string): void;
}

/** Room capability and generation bind every token and callback. Media always requires a click. */
export function useTimerBattleVideo(client: BattleVideoClient, code: string | null, pid: string | null,
  playerToken: string | null, generation: string | null, language: 'en' | 'zh'): VideoRoom {
  const session = JSON.stringify([code, pid, playerToken]);
  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const serial = useRef(0);
  const wanted = intent?.session === session && Boolean(code && pid && playerToken && generation);
  const key = JSON.stringify([session, generation, intent?.attempt]);
  const current = connection?.key === key && wanted ? connection : null;
  const token = current?.token ?? null;
  const currentRef = useRef({ key, token });
  currentRef.current = { key, token };
  const maxParticipants = config?.maxParticipants ?? 0;
  const available = config?.enabled !== false;
  const tr = (copy: { en: string; zh: string }) => copy[language];

  useEffect(() => {
    const controller = new AbortController();
    void client.getConfig(controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value); });
    return () => controller.abort();
  }, [client]);

  useEffect(() => {
    // Invalidate old intent permanently, including a later return to the same room.
    setIntent(null);
    setConnection(null);
  }, [session]);

  useEffect(() => {
    const stop = () => { setIntent(null); setConnection(null); };
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
    };
  }, []);

  useEffect(() => {
    if (!wanted || !code || !pid || !playerToken || !available) return;
    const controller = new AbortController();
    setConnection({ key, token: null, busy: true, error: null });
    async function connect() {
      try {
        let next: VideoToken | undefined;
        for (let retry = 0; retry < 3; retry++) {
          try { next = await client.getToken(code!, pid!, playerToken!, controller.signal); break; }
          catch (error) {
            if (controller.signal.aborted) return;
            if (!(error instanceof VideoDeniedError) || error.reason !== 'changed' || retry === 2) throw error;
          }
        }
        if (!controller.signal.aborted && next) setConnection({ key, token: next, busy: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setConnection({ key, token: null, busy: false,
          error: error instanceof VideoDeniedError ? error.reason : 'connect' });
      }
    }
    void connect();
    return () => controller.abort();
  }, [client, key, wanted, code, pid, playerToken, available]);

  return {
    language, enabled: available && Boolean(code && pid && playerToken && generation),
    wanted, token: available ? token : null, busy: current?.busy ?? false, maxParticipants,
    err: current?.error ? denyMessage(current.error, maxParticipants, tr)
      : current?.disconnected !== undefined ? disconnectMessage(current.disconnected, tr) : null,
    toggle() {
      if (current?.token || current?.busy) { setIntent(null); setConnection(null); }
      else setIntent({ session, attempt: ++serial.current });
    },
    leave(reason, disconnectedToken) {
      if (currentRef.current.key !== key || (disconnectedToken && currentRef.current.token?.token !== disconnectedToken)) return;
      // Retired rooms wait for a new generation, never rejoin the same retired room in a loop.
      if (reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.ROOM_CLOSED) {
        setConnection({ key, token: null, busy: false, error: null, disconnected: reason });
      } else if (reason !== undefined) {
        setConnection({ key, token: null, busy: false, error: null, disconnected: reason });
      } else {
        setIntent(null); setConnection(null);
      }
    },
    fail(reason, failedToken) {
      if (currentRef.current.key !== key || (failedToken && currentRef.current.token?.token !== failedToken)) return;
      setConnection(value => value?.key === key ? { ...value, error: reason } : value);
    },
  };
}

export function VideoToggle({ video }: { video: VideoRoom }) {
  if (!video.enabled) return null;
  const on = Boolean(video.token || video.busy);
  const label = (on ? { en: 'Stop video', zh: '关闭视频' } : { en: 'Start video', zh: '开视频' })[video.language];
  return <button type="button" className="vs-toggle" data-no-timer aria-pressed={on} aria-label={label}
    aria-busy={video.busy} title={label} onClick={video.toggle}><Video size={17} /></button>;
}

export default function VideoStrip({ video }: { video: VideoRoom }) {
  const token = video.token;
  if (!token) return video.err ? <div className="vs-strip is-idle surface-chrome" data-no-timer>
    <span className="vc-err">{video.err}</span></div> : null;
  return <div className="vs-strip surface-chrome" data-no-timer>
    <LiveKitRoom key={token.token} serverUrl={token.url} token={token.token} connect video={false} audio={false}
      options={LIVEKIT_ROOM_OPTIONS} onDisconnected={reason => video.leave(reason, token.token)}
      onError={() => video.fail('connect', token.token)} onMediaDeviceFailure={() => video.fail('media', token.token)}>
      <VideoTiles autoStart language={video.language} onLeave={() => video.leave(undefined, token.token)}
        onMediaError={() => video.fail('media', token.token)} onCameraError={() => video.fail('camera', token.token)} />
    </LiveKitRoom>
    {video.err && <span className="vc-err">{video.err}</span>}
  </div>;
}
