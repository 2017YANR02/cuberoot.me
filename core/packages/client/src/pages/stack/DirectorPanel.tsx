/**
 * DirectorPanel — 截图 + canvas 录像。
 * 截图: canvas → PNG 下载。
 * 录像: canvas.captureStream() + MediaRecorder → webm 下载。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Circle, Square } from 'lucide-react';
import './director-panel.css';

interface Props {
  getCanvas: () => HTMLCanvasElement | null;
}

function pickMimeType(): { mime: string; ext: string } | null {
  const candidates = [
    { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return null;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DirectorPanel({ getCanvas }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTickRef = useRef(0);
  const tickIntRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mimeInfo] = useState(() => pickMimeType());

  const snapshot = useCallback(() => {
    const cv = getCanvas();
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      download(blob, `stack-${Date.now()}.png`);
    }, 'image/png');
  }, [getCanvas]);

  const startRecord = useCallback(() => {
    const cv = getCanvas();
    if (!cv || !mimeInfo) return;
    const stream = (cv as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: mimeInfo.mime });
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeInfo.mime });
      download(blob, `stack-${Date.now()}.${mimeInfo.ext}`);
      chunksRef.current = [];
    };
    rec.start(250);
    recorderRef.current = rec;
    startTickRef.current = Date.now();
    setRecording(true);
    setElapsed(0);
    tickIntRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTickRef.current) / 1000));
    }, 250);
  }, [getCanvas, mimeInfo]);

  const stopRecord = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
    if (tickIntRef.current) {
      window.clearInterval(tickIntRef.current);
      tickIntRef.current = null;
    }
    setRecording(false);
  }, []);

  useEffect(() => () => stopRecord(), [stopRecord]);

  return (
    <div className="stack-director">
      <button className="stack-director-btn" onClick={snapshot}>
        <Camera size={14} />
        {t('截图 PNG', 'Snapshot PNG')}
      </button>
      {!recording ? (
        <button
          className="stack-director-btn"
          onClick={startRecord}
          disabled={!mimeInfo}
          title={!mimeInfo ? t('浏览器不支持录像', 'Recorder unsupported') : ''}
        >
          <Circle size={14} fill="currentColor" color="var(--destructive)" />
          {t('开始录像', 'Start recording')}
          {mimeInfo ? <span className="stack-director-ext">.{mimeInfo.ext}</span> : null}
        </button>
      ) : (
        <button className="stack-director-btn recording" onClick={stopRecord}>
          <Square size={14} fill="currentColor" />
          {t('停止', 'Stop')}
          <span className="stack-director-time">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
        </button>
      )}
      <span className="stack-director-hint">
        {t('录制画布交互;打乱 / 撤销 / 拖动都会进入视频。', 'Captures the cube canvas — scrambles, undos, drags all show up in the video.')}
      </span>
    </div>
  );
}
