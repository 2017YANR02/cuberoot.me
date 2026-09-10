'use client';

import { useEffect, useRef, useState } from 'react';
import { LiveKitRoom, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Video } from 'lucide-react';
import VideoTiles from '@/components/video/VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage } from '@/components/video/video-call';
import { getCompetitionVideoToken, VideoDeniedError, type VideoToken } from '@/lib/video-room-api';
import { tr } from '@/i18n/tr';

function LocalRecording() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
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
  function start() {
    const camera = localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
    const microphone = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (typeof MediaRecorder === 'undefined' || !camera || !isCameraEnabled) {
      setMessage(tr({zh:'请打开摄像头；不支持浏览器录像的设备可使用系统录像。',en:'Enable your camera. If browser recording is unavailable, use your device recorder.'}));
      return;
    }
    const mimeType = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {setMessage(tr({zh:'此设备请使用系统录像。',en:'Use your device recorder on this device.'}));return;}
    try {
      const next = new MediaRecorder(new MediaStream([camera,...(microphone ? [microphone] : [])]), {mimeType,videoBitsPerSecond:650_000,audioBitsPerSecond:32_000});
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
        setRecording(false);
        if (!chunks.length) return;
        const file = new Blob(chunks,{type:next.mimeType});
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url; link.download = `competition-recording-${Date.now()}.${next.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url),60_000);
        setMessage(tr({zh:'录像已开始下载，请确认保存成功。需要继续录像时再点开始。',en:'Recording download started. Check that it was saved; start again to record another segment.'}));
      };
      next.onerror = () => setMessage(tr({zh:'录像出现错误，请检查已保存的文件并使用系统录像。',en:'Recording failed. Check the saved file and use your device recorder.'}));
      next.start(5000);
      recorder.current = next;
      setRecording(true);
      setMessage('');
      timer.current = setTimeout(() => {if(next.state==='recording') next.stop();},10*60_000);
    } catch {setMessage(tr({zh:'无法启动录像，请使用系统录像。',en:'Could not start recording. Use your device recorder.'}));}
  }
  return <div className="competition-recording">
    <button type="button" className="competition-secondary" onClick={() => recording ? recorder.current?.stop() : start()}>
      {recording ? tr({zh:'停止并保存录像',en:'Stop and save recording'}) : tr({zh:'录制我的画面',en:'Record my camera'})}
    </button>
    <p className="competition-hint">{tr({zh:'仅保存自己的画面和麦克风到本机，每段最多 10 分钟；离开前请保存。争议时再上传。',en:'Saves your own camera and microphone locally, up to 10 minutes per segment. Save before leaving; upload only for a dispute.'})}</p>
    {message && <p role="status">{message}</p>}
  </div>;
}

/** A registration-scoped call. Leaving this component always disconnects its media tracks. */
export function CompetitionVideoRoom({ registrationId }: { registrationId: string }) {
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

  async function join() {
    const current = ++request.current;
    setJoining(true);
    setError(null);
    try {
      const next = await getCompetitionVideoToken(registrationId);
      if (request.current === current) setToken(next);
    } catch (cause) {
      if (request.current === current) setError(cause instanceof VideoDeniedError && cause.reason === 'not in room'
        ? tr({ zh: '完成签到后，选手和指定监督员可在场次时间内进入。', en: 'After check-in, the entrant and assigned supervisor can join during the session.' })
        : denyMessage(cause instanceof VideoDeniedError ? cause.reason : 'connect', 2));
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
      <VideoTiles onLeave={() => setToken(null)} onCameraError={() => setError(denyMessage('camera', 2))} />
      <LocalRecording />
    </LiveKitRoom> : <button type="button" className="competition-secondary" disabled={joining} onClick={() => void join()}>
      <Video size={16} aria-hidden /> {joining ? tr({ zh: '连接中…', en: 'Connecting…' }) : tr({ zh: '进入监督视频', en: 'Join supervision video' })}
    </button>}
  </section>;
}
