'use client';

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { isTrackReference, LiveKitRoom, VideoTrack, useConnectionState, useLocalParticipant, useTracks } from '@livekit/components-react';
import { ConnectionState, Track, VideoPresets, type RoomOptions } from 'livekit-client';
import { COMPETITION_STREAM_MBPS } from '@cuberoot/shared/timer';
import { Download, Video } from '@app-foundation/icons/lucide';
import VideoTiles from '@/components/video/VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage } from '@/components/video/video-call';
import { getCompetitionVideoToken, VideoDeniedError, type VideoToken } from '@/lib/video-room-api';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';

function LocalRecording({ getStream, onRecordingChange, ownsStream = false, primaryStart = false, dock = false, finished = false, hint }: { getStream: () => Promise<MediaStream>; onRecordingChange?: (active: boolean) => void; ownsStream?: boolean; primaryStart?: boolean; dock?: boolean; finished?: boolean; hint?: string }) {
  const t = useT();
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [savedFile, setSavedFile] = useState<{ file: Blob; filename: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!preview) return;
    if (element) element.srcObject = preview;
    const since = performance.now();
    const interval = setInterval(() => setElapsed(Math.floor((performance.now() - since) / 1000)), 250);
    return () => { if (element) element.srcObject = null; clearInterval(interval); };
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
  function download(file: Blob, filename: string) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

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
        const file = new Blob(chunks, { type: next.mimeType });
        const filename = `competition-recording-${Date.now()}.${next.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        if (active.current && dock) setSavedFile({ file, filename });
        download(file, filename);
        if (active.current) setMessage(tr({zh:'已开始下载录像。',en:'Recording download started.'}));
      };
      next.onerror = () => setMessage(tr({zh:'录像出现错误，请检查已保存的文件并使用系统录像。',en:'Recording failed. Check the saved file and use your device recorder.'}));
      next.start(5000);
      recorder.current = next;
      if (ownsStream) {
        setElapsed(0);
        setPreview(stream);
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
          if (next.state === 'recording') next.stop();
        }, { once: true }));
      }
      setRecording(true);
      onRecordingChange?.(true);
      setMessage('');
      timer.current = setTimeout(() => {if(next.state==='recording') next.stop();},10*60_000);
    } catch {
      if (ownsStream) stream?.getTracks().forEach(track => track.stop());
      if (active.current) setMessage(tr({zh:'无法启动录像，请检查摄像头权限。',en:'Could not start recording. Check camera permissions.'}));
    } finally { pending.current = false; }
  }
  const clock = <><span className="competition-live-dot" aria-hidden />
    {t('录制中', 'Recording')} <time>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</time></>;
  const previewVideo = preview && <div className="competition-camera-preview">
    <video ref={video} muted playsInline autoPlay aria-label={t('本地摄像头取景', 'Local camera preview')} />
    <span className="competition-recording-indicator">{clock}</span>
  </div>;
  return <div className="competition-recording" data-recording={recording || undefined} data-dock={dock || undefined}>
    {dock && recording ? <>
      <details className="competition-recording-disclosure">
        <MoreToggle as="summary">{clock} · {t('预览', 'Preview')}</MoreToggle>
        {previewVideo}
      </details>
      <button type="button" className="competition-secondary competition-recording-save" onClick={() => recorder.current?.stop()}>
        <Download size={16} aria-hidden />{t('保存本场录像', 'Save match recording')}
      </button>
    </> : dock && finished ? (savedFile && <button type="button" className="competition-secondary" onClick={() => download(savedFile.file, savedFile.filename)}>
      <Download size={16} aria-hidden />{t('下载本场录像', 'Download match recording')}
    </button>) : <>
    {!dock && previewVideo}
    <button type="button" className={primaryStart && !recording ? `competition-primary${dock ? ' competition-focus-action' : ''}` : 'competition-secondary'} onClick={() => recording ? recorder.current?.stop() : void start()}>
      {recording ? tr({zh:'停止并保存录像',en:'Stop and save recording'}) : primaryStart ? t('开始本机录制', 'Start local recording') : tr({zh:'录制我的画面',en:'Record my camera'})}
    </button>
    <p className="competition-hint">{hint ?? (ownsStream ? t('仅将自己的摄像头画面保存到本机。每段最多 10 分钟，离开前请保存。', 'Saves only your camera video to this device. Each segment lasts up to 10 minutes. Save before leaving.') : tr({zh:'仅保存自己的画面和麦克风到本机，每段最多 10 分钟；离开前请保存。争议时再上传。',en:'Saves your own camera and microphone locally, up to 10 minutes per segment. Save before leaving; upload only for a dispute.'}))}</p>
    </>}
    {dock && !recording && !finished && savedFile && <button type="button" className="competition-secondary" onClick={() => download(savedFile.file, savedFile.filename)}>{t('下载已保存录像', 'Download saved recording')}</button>}
    {message && !(dock && recording) && <p role="status">{message}</p>}
  </div>;
}

function SupervisionRecording({ supervising }: { supervising: boolean }) {
  const t = useT();
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const hint = supervising ? t('裁判执场留档，每段最多 10 分钟。离开前请保存到本机。', 'For judging records. Each clip lasts up to 10 minutes. Save it locally before leaving.') : undefined;
  return <LocalRecording hint={hint} getStream={async () => {
    const camera = localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
    const microphone = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (!isCameraEnabled || !camera) throw new Error('Camera unavailable');
    return new MediaStream(microphone ? [camera, microphone] : [camera]);
  }} />;
}

export function CompetitionSelfRecording({ onRecordingChange, primaryStart, dock, finished }: {
  onRecordingChange: (active: boolean) => void; primaryStart?: boolean; dock?: boolean; finished?: boolean;
}) {
  return <LocalRecording ownsStream dock={dock} finished={finished} primaryStart={primaryStart} onRecordingChange={onRecordingChange} getStream={() => navigator.mediaDevices.getUserMedia({ video: true })} />;
}

export type CompetitionCameraState = 'disconnected' | 'connecting' | 'camera_off' | 'waiting_for_supervisor' | 'ready';

const COMPETITION_ROOM_OPTIONS: RoomOptions = {
  ...LIVEKIT_ROOM_OPTIONS,
  videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
  publishDefaults: {
    simulcast: false,
    videoEncoding: { maxBitrate: COMPETITION_STREAM_MBPS * 1_000_000, maxFramerate: 30 },
  },
};

const CAMERA_SOURCES = [Track.Source.Camera];

function SupervisionCameraState({ onChange, supervisorIdentity }: {
  onChange: (state: CompetitionCameraState) => void; supervisorIdentity?: string | null;
}) {
  const connection = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const cameras = useTracks(CAMERA_SOURCES).filter(({ publication }) => !publication.isMuted);
  const state = connection !== ConnectionState.Connected ? 'connecting'
    : !cameras.some(({ participant }) => participant === localParticipant) ? 'camera_off'
      : cameras.some(({ participant }) => participant !== localParticipant &&
        (supervisorIdentity === undefined || participant.identity === supervisorIdentity)) ? 'ready' : 'waiting_for_supervisor';
  useEffect(() => onChange(state), [state, onChange]);
  useEffect(() => () => onChange('disconnected'), [onChange]);
  return null;
}

export type SupervisionCameraGrid = (camera?: (identity: string) => ReactNode) => ReactNode;

function VideoCameraGrid({ render }: { render: SupervisionCameraGrid }) {
  const tracks = useTracks(CAMERA_SOURCES);
  return render(identity => {
    const track = tracks.find(item => item.participant.identity === identity && !item.publication.isMuted);
    return isTrackReference(track) ? <VideoTrack trackRef={track} /> : null;
  });
}

/** Leaving a supervision room disconnects its media tracks. */
export function CompetitionVideoRoom({ registrationId, matchId, supervisorIdentity, autoJoin = false, onJoin, onLeave, onCameraState, prominent = false, cameraGrid, supervising = false }: {
  registrationId?: string; matchId?: string; supervisorIdentity?: string | null; autoJoin?: boolean; onJoin?: () => void; onLeave?: () => void;
  onCameraState?: (state: CompetitionCameraState) => void; prominent?: boolean; cameraGrid?: SupervisionCameraGrid; supervising?: boolean;
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
  }, [registrationId, matchId]);

  const joinAutomatically = useEffectEvent(() => { if (!token && !joining) void join(); });
  useEffect(() => {
    if (autoJoin) joinAutomatically();
  }, [registrationId, matchId, autoJoin]);

  async function join() {
    if (!matchId && !registrationId) return;
    const current = ++request.current;
    setJoining(true);
    setError(null);
    onCameraState?.('connecting');
    try {
      const next = await getCompetitionVideoToken(matchId ? { matchId } : { registrationId: registrationId! });
      if (request.current === current) { setToken(next); onJoin?.(); }
    } catch (cause) {
      if (request.current === current) {
        onCameraState?.('disconnected');
        setError(cause instanceof VideoDeniedError && cause.reason === 'not in room'
          ? tr({ zh: '完成检录后，选手和指定监督员可在场次时间内进入。', en: 'After check-in, the entrant and assigned supervisor can join during the session.' })
          : denyMessage(cause instanceof VideoDeniedError ? cause.reason : 'connect', matchId ? 4 : 2));
      }
    } finally {
      if (request.current === current) setJoining(false);
    }
  }

  return <section aria-label={tr({ zh: '实时监督', en: 'Live supervision' })}>
    {error && <p role="alert">{error}</p>}
    {token ? <LiveKitRoom key={token.room} serverUrl={token.url} token={token.token}
      connect audio video options={COMPETITION_ROOM_OPTIONS}
      onDisconnected={reason => { setToken(null); setError(disconnectMessage(reason)); }}
      onError={() => { setToken(null); setError(denyMessage('connect', 2)); }}
      onMediaDeviceFailure={() => setError(denyMessage('media', 2))}>
      {onCameraState && <SupervisionCameraState onChange={onCameraState} supervisorIdentity={supervisorIdentity} />}
      {cameraGrid && <VideoCameraGrid render={cameraGrid} />}
      <VideoTiles showTiles={!cameraGrid} onLeave={() => { setToken(null); onLeave?.(); }} onCameraError={() => setError(denyMessage('camera', 2))} />
      <SupervisionRecording supervising={supervising} />
    </LiveKitRoom> : <>{cameraGrid?.()}<button type="button" className={prominent ? 'competition-primary' : 'competition-secondary'} disabled={joining} onClick={() => void join()}>
      <Video size={16} aria-hidden /> {joining ? tr({ zh: '连接中…', en: 'Connecting…' }) : prominent ? tr({ zh: '进入监督视频并开启摄像头', en: 'Join supervision video and turn on camera' })
        : tr({ zh: '进入监督视频', en: 'Join supervision video' })}
    </button></>}
  </section>;
}
