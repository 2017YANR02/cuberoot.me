import { Camera, Download, Square, Unplug, Video } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { downloadBlob } from '@/lib/scramble-dist/download';

type CameraRecordingPhase = 'idle' | 'recording' | 'finalizing' | 'complete' | 'error';

interface CameraRecordingControlsProps {
  cameraConnected: boolean;
  cameraConnecting?: boolean;
  ready: boolean;
  phase: CameraRecordingPhase;
  scramble: string;
  onScrambleChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStart: () => void;
  onStop: () => void;
  recordedFile?: File;
  searchError?: string;
  inferenceFailure?: 'no_solved_end' | 'no_supported_opening';
  recognizedMoves?: number;
  review?: 'opening' | 'ready' | 'range' | 'running';
  onReview: () => void;
  onCancelReview: () => void;
}

export function CameraRecordingControls({
  cameraConnected, cameraConnecting, ready, phase, scramble, onScrambleChange,
  onConnect, onDisconnect, onStart, onStop, recordedFile, searchError, inferenceFailure, recognizedMoves, review, onReview, onCancelReview,
}: CameraRecordingControlsProps) {
  const t = useT();
  const recording = phase === 'recording';
  const finalizing = phase === 'finalizing';
  const busy = recording || finalizing || !!review;
  const latestStatus = recording ? scramble.trim()
    ? t('正在录制并识别动作', 'Recording and recognizing moves')
    : t('正在录制并跟踪魔方', 'Recording and tracking the cube')
    : finalizing ? t('正在整理复盘', 'Finalizing reconstruction')
    : phase === 'complete' ? t('复盘已完成', 'Reconstruction complete')
    : cameraConnected && !ready ? t('正在准备识别模型', 'Preparing recognition models')
    : undefined;

  return <section className="video-recon-panel video-recon-timer-panel" data-site-surface="panel">
    <div className="video-recon-section-heading">
      <h2>{t('边拍边复盘', 'Live reconstruction')}</h2>
      {cameraConnected
        ? <button type="button" className="btn-secondary" disabled={busy} onClick={onDisconnect}>
            <Unplug size={16} aria-hidden />{t('断开摄像头', 'Disconnect camera')}
          </button>
        : <button type="button" className="btn-secondary" disabled={cameraConnecting || busy} onClick={onConnect}>
            <Camera size={16} aria-hidden />{cameraConnecting ? t('正在连接', 'Connecting') : t('连接摄像头', 'Connect camera')}
          </button>}
    </div>
    <label className="video-recon-inline-label">
      {t('打乱（选填）', 'Scramble (optional)')}
      <input type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy}
        value={scramble} onChange={event => onScrambleChange(event.currentTarget.value)} />
    </label>
    {!busy && <p className="video-recon-muted">
      {t('开录后先拍清打乱局面，停录前保留清晰的还原画面。', 'Show the scrambled cube after starting, and the solved cube before stopping.')}
    </p>}
    <div className="video-recon-actions">
      {review
        ? <button type="button" className="btn-secondary" onClick={onCancelReview}>{t('取消补读', 'Cancel reread')}</button>
        : recording
        ? <button type="button" className="btn-primary" onClick={onStop}>
            <Square size={16} aria-hidden />{t('停止录制', 'Stop recording')}
          </button>
        : <button type="button" className="btn-primary" disabled={!cameraConnected || !ready || finalizing} onClick={onStart}>
            <Video size={16} aria-hidden />{t('开始录制', 'Start recording')}
          </button>}
      {recordedFile && !busy && phase === 'error' && <button type="button" className="btn-secondary" onClick={onReview}>
        {t('从录像重新复盘', 'Retry from recording')}
      </button>}
      {recordedFile && <button type="button" className="btn-secondary"
        onClick={() => downloadBlob(recordedFile.name, recordedFile)}>
        <Download size={16} aria-hidden />{t('下载录像', 'Download recording')}
      </button>}
    </div>
    {review && <p role="status" className="video-recon-muted">{review === 'range'
      ? t('请选择这次还原的区间，再逐帧复盘。', 'Select the solve range to reconstruct it frame by frame.')
      : t('实时识别未完成，正在逐帧补读原录像。', 'Live tracking was incomplete. Reading the recording frame by frame.')}</p>}
    {!review && latestStatus && <p role="status" className="video-recon-muted">{latestStatus}</p>}
    {recording && recognizedMoves !== undefined && <p>{t(`已识别 ${recognizedMoves} 步`, `${recognizedMoves} moves recognized`)}</p>}
    {!review && (searchError || phase === 'error') && <div className="video-recon-muted" role="alert">
      <p>{inferenceFailure === 'no_solved_end'
        ? t('录制结尾需要清晰的还原画面。', 'The recording needs a clear view of the solved cube at the end.')
        : inferenceFailure === 'no_supported_opening'
          ? t('无法从画面确认起始局面和完整动作。', 'The opening state and full move sequence could not be verified from the video.')
          : t('实时复盘未完成。', 'Live reconstruction did not finish.')}</p>
      {searchError && <details><summary>{t('技术详情', 'Technical details')}</summary>{searchError}</details>}
    </div>}
  </section>;
}
