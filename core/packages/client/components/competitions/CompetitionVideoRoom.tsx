'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { LiveKitRoom, useConnectionState, useLocalParticipant, useTracks } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { Video } from '@app-foundation/icons/lucide';
import VideoTiles from '@/components/video/VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage } from '@/components/video/video-call';
import { getCompetitionVideoToken, VideoDeniedError, type VideoToken } from '@/lib/video-room-api';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';

function LocalRecording({ getStream, onRecordingChange, ownsStream = false, primaryStart = false }: { getStream: () => Promise<MediaStream>; onRecordingChange?: (active: boolean) => void; ownsStream?: boolean; primaryStart?: boolean }) {
  const t = useT();
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!preview || !element) return;
    element.srcObject = preview;
    const since = performance.now();
    const interval = setInterval(() => setElapsed(Math.floor((performance.now() - since) / 1000)), 250);
    return () => { element.srcObject = null; clearInterval(interval); };
  }, [preview]);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording,setRecording] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);
  useEffect(() => {
    if (!recording) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  }, [recording]);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  async function start() {
    if (pending.current || recorder.current) return;
    if (typeof MediaRecorder === 'undefined') {
      setMessage(tr({zh:'当前浏览器无法录像，请使用支持录像的浏览器。',en:'Use a browser that supports local recording.'}));
      return;
    }
    const mimeType = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {setMessage(tr({zh:'此设备请使用系统录像。',en:'Use your device recorder on this device.'}));return;}
    pending.current = true;
    let stream: MediaStream | undefined;
    try {
      stream = await getStream();
      if (!active.current) {
        if (ownsStream) stream.getTracks().forEach(track => track.stop());
        return;
      }
      const next = new MediaRecorder(stream, {mimeType,videoBitsPerSecond:650_000,audioBitsPerSecond:32_000});
      const chunks: Blob[] = [];
      let bytes = 0;
      next.ondataavailable = event => {
        if (!event.data.size) return;
        chunks.push(event.data); bytes += event.data.size;
        if (bytes >= 58 * 1024 * 1024 && next.state === 'recording') next.stop();
      };
      next.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        recorder.current = null;
        if (ownsStream) stream?.getTracks().forEach(track => track.stop());
        if (active.current) { setRecording(false); setPreview(null); }
        onRecordingChange?.(false);
        if (!chunks.length) return;
        const file = new Blob(chunks,{type:next.mimeType});
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url; link.download = `competition-recording-${Date.now()}.${next.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url),60_000);
        if (active.current) setMessage(tr({zh:'录像已开始下载，请确认保存成功。需要继续录像时再点开始。',en:'Recording download started. Check that it was saved; start again to record another segment.'}));
      };
      next.onerror = () => setMessage(tr({zh:'录像出现错误，请检查已保存的文件并使用系统录像。',en:'Recording failed. Check the saved file and use your device recorder.'}));
      next.start(5000);
      recorder.current = next;
      if (ownsStream) { setElapsed(0); setPreview(stream); }
      setRecording(true);
      onRecordingChange?.(true);
      setMessage('');
      timer.current = setTimeout(() => {if(next.state==='recording') next.stop();},10*60_000);
    } catch {
      if (ownsStream) stream?.getTracks().forEach(track => track.stop());
      if (active.current) setMessage(tr({zh:'无法启动录像，请检查摄像头权限。',en:'Could not start recording. Check camera permissions.'}));
    } finally { pending.current = false; }
  }
  return <div className="competition-recording">
    {preview && <div className="competition-camera-preview">
      <video ref={video} muted playsInline autoPlay aria-label={t('本地摄像头取景', 'Local camera preview')} />
      <span className="competition-recording-indicator"><span className="competition-live-dot" aria-hidden />
        {t('录制中', 'Recording')} <time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</time>
      </span>
    </div>}
    <button type="button" className={primaryStart && !recording ? 'competition-primary' : 'competition-secondary'} onClick={() => recording ? recorder.current?.stop() : void start()}>
      {recording ? tr({zh:'停止并保存录像',en:'Stop and save recording'}) : primaryStart ? t('开始本机录制', 'Start local recording') : tr({zh:'录制我的画面',en:'Record my camera'})}
    </button>
    <p className="competition-hint">{tr({zh:'仅保存自己的画面和麦克风到本机，每段最多 10 分钟；离开前请保存。争议时再上传。',en:'Saves your own camera and microphone locally, up to 10 minutes per segment. Save before leaving; upload only for a dispute.'})}</p>
    {message && <p role="status">{message}</p>}
  </div>;
}

function SupervisionRecording() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  return <LocalRecording getStream={async () => {
    const camera = localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
    const microphone = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (!isCameraEnabled || !camera) throw new Error('Camera unavailable');
    return new MediaStream(microphone ? [camera, microphone] : [camera]);
  }} />;
}

export function CompetitionSelfRecording({ onRecordingChange, primaryStart }: {
  onRecordingChange: (active: boolean) => void; primaryStart?: boolean;
}) {
  return <LocalRecording ownsStream primaryStart={primaryStart} onRecordingChange={onRecordingChange} getStream={() => navigator.mediaDevices.getUserMedia({ video: true })} />;
}

export type CompetitionCameraState = 'disconnected' | 'connecting' | 'camera_off' | 'waiting_for_supervisor' | 'ready';

const CAMERA_SOURCES = [Track.Source.Camera];

function SupervisionCameraState({ onChange }: { onChange: (state: CompetitionCameraState) => void }) {
  const connection = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const cameras = useTracks(CAMERA_SOURCES).filter(({ publication }) => !publication.isMuted);
  const state = connection !== ConnectionState.Connected ? 'connecting'
    : !cameras.some(({ participant }) => participant === localParticipant) ? 'camera_off'
      : cameras.some(({ participant }) => participant !== localParticipant) ? 'ready' : 'waiting_for_supervisor';
  useEffect(() => onChange(state), [state, onChange]);
  useEffect(() => () => onChange('disconnected'), [onChange]);
  return null;
}

/** A registration-scoped call. Leaving this component always disconnects its media tracks. */
export function CompetitionVideoRoom({ registrationId, autoJoin = false, onJoin, onLeave, onCameraState, prominent = false }: {
  registrationId: string; autoJoin?: boolean; onJoin?: () => void; onLeave?: () => void;
  onCameraState?: (state: CompetitionCameraState) => void; prominent?: boolean;
}) {
  const [token, setToken] = useState<VideoToken | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(() => {
    request.current += 1;
    setToken(null);
    setError(null);
    setJoining(false);
    return () => { request.current += 1; };
  }, [registrationId]);

  const joinAutomatically = useEffectEvent(() => { if (!token && !joining) void join(); });
  useEffect(() => {
    if (autoJoin) joinAutomatically();
  }, [registrationId, autoJoin]);

  async function join() {
    const current = ++request.current;
    setJoining(true);
    setError(null);
    onCameraState?.('connecting');
    try {
      const next = await getCompetitionVideoToken(registrationId);
      if (request.current === current) { setToken(next); onJoin?.(); }
    } catch (cause) {
      if (request.current === current) {
        onCameraState?.('disconnected');
        setError(cause instanceof VideoDeniedError && cause.reason === 'not in room'
          ? tr({ zh: '完成检录后，选手和指定监督员可在场次时间内进入。', en: 'After check-in, the entrant and assigned supervisor can join during the session.' })
          : denyMessage(cause instanceof VideoDeniedError ? cause.reason : 'connect', 2));
      }
    } finally {
      if (request.current === current) setJoining(false);
    }
  }

  return <section aria-label={tr({ zh: '实时监督', en: 'Live supervision' })}>
    {error && <p role="alert">{error}</p>}
    {token ? <LiveKitRoom key={token.room} serverUrl={token.url} token={token.token}
      connect audio video options={LIVEKIT_ROOM_OPTIONS}
      onDisconnected={reason => { setToken(null); setError(disconnectMessage(reason)); }}
      onError={() => { setToken(null); setError(denyMessage('connect', 2)); }}
      onMediaDeviceFailure={() => setError(denyMessage('media', 2))}>
      {onCameraState && <SupervisionCameraState onChange={onCameraState} />}
      <VideoTiles onLeave={() => { setToken(null); onLeave?.(); }} onCameraError={() => setError(denyMessage('camera', 2))} />
      <SupervisionRecording />
    </LiveKitRoom> : <button type="button" className={prominent ? 'competition-primary' : 'competition-secondary'} disabled={joining} onClick={() => void join()}>
      <Video size={16} aria-hidden /> {joining ? tr({ zh: '连接中…', en: 'Connecting…' }) : prominent ? tr({ zh: '进入监督视频并开启摄像头', en: 'Join supervision video and turn on camera' })
        : tr({ zh: '进入监督视频', en: 'Join supervision video' })}
    </button>}
  </section>;
}
