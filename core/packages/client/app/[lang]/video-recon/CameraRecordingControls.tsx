import { Camera, CircleX, Download, Square, Video } from '@app-foundation/icons/lucide';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { downloadBlob } from '@/lib/scramble-dist/download';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

export function CameraDisconnectButton({ disabled, onDisconnect, textOnly = false }: {
  disabled: boolean;
  onDisconnect: () => void;
  textOnly?: boolean;
}) {
  const t = useT();
  const label = textOnly ? t('关闭摄像头', 'Close camera') : t('断开摄像头', 'Disconnect camera');
  return <button type="button" className="playback-bar-btn video-recon-camera-disconnect"
    data-text-only={textOnly || undefined} aria-label={label} disabled={disabled} onClick={onDisconnect}>
    {textOnly ? t('关闭', 'Close') : <CircleX size={18} aria-hidden />}
  </button>;
}

export function CameraRecordingAction({ connected, view, workspace }: {
  connected: boolean;
  view: ReturnType<VideoWorkspace['getSnapshot']> | null;
  workspace?: VideoWorkspace;
}) {
  const t = useT();
  const phase = view?.cameraRecordingPhase;
  const working = !!view?.timerBusy || !!view?.recordingReview;
  return <div className="video-recon-actions">
    {view?.recordingReview
      ? <button type="button" className="btn-secondary" onClick={workspace?.cancelRecordingReview}>
          {t('取消补读', 'Cancel reread')}
        </button>
      : phase === 'recording'
      ? <button type="button" className="btn-primary" onClick={workspace?.finishCameraRecording}>
          <Square size={16} aria-hidden />{t('停止录制', 'Stop recording')}
        </button>
      : phase === 'finalizing'
      ? <LoadingIndicator>{t('生成复盘...', 'Generating reconstruction...')}</LoadingIndicator>
      : connected
      ? <button type="button" className="btn-primary" disabled={!view?.timerReady || working} onClick={workspace?.recordCamera}>
          <Video size={16} aria-hidden />{t('开始录制', 'Start recording')}
        </button>
      : <button type="button" className="btn-primary" disabled={!workspace || view?.cameraConnecting || working}
          onClick={() => void workspace?.camera()}>
          <Camera size={16} aria-hidden />{view?.cameraConnecting ? t('正在连接…', 'Connecting…') : t('连接摄像头', 'Connect camera')}
        </button>}
    {connected && workspace && <CameraDisconnectButton disabled={working} onDisconnect={workspace.stopSource} />}
  </div>;
}

type CameraRecordingPhase = 'idle' | 'recording' | 'finalizing' | 'complete' | 'error';

interface CameraRecordingControlsProps {
  phase: CameraRecordingPhase;
  scramble: string;
  onScrambleChange: (value: string) => void;
  recordedFile?: File;
  searchError?: string;
  inferenceFailure?: 'no_solved_end' | 'no_supported_opening';
  recognizedMoves?: number;
  trackedFrames?: number;
  review?: 'opening' | 'ready' | 'range' | 'running';
  onReview: () => void;
}

export function CameraRecordingControls({
  phase, scramble, onScrambleChange, recordedFile, searchError, inferenceFailure,
  recognizedMoves, trackedFrames, review, onReview,
}: CameraRecordingControlsProps) {
  const t = useT();
  const recording = phase === 'recording';
  const finalizing = phase === 'finalizing';
  const busy = recording || finalizing || !!review;
  const latestStatus = recording ? scramble.trim()
    ? t('正在录制并识别动作', 'Recording and recognizing moves')
    : t('正在录制并跟踪魔方', 'Recording and tracking the cube')
    : phase === 'complete' ? t('复盘已完成', 'Reconstruction complete')
    : undefined;

  return <section className="video-recon-panel video-recon-timer-panel" data-site-surface="panel">
    <label className="video-recon-inline-label">
      {t('打乱（选填）', 'Scramble (optional)')}
      <input type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy}
        value={scramble} onChange={event => onScrambleChange(event.currentTarget.value)} />
    </label>
    {!busy && <p className="video-recon-muted">
      {t('开录后先拍清打乱局面，停录前保留清晰的还原画面。', 'Show the scrambled cube after starting, and the solved cube before stopping.')}
    </p>}
    {recordedFile && <div className="video-recon-actions">
      {!busy && phase === 'error' && <button type="button" className="btn-secondary" onClick={onReview}>
        {t('从录像重新复盘', 'Retry from recording')}
      </button>}
      <button type="button" className="btn-secondary" onClick={() => downloadBlob(recordedFile.name, recordedFile)}>
        <Download size={16} aria-hidden />{t('下载录像', 'Download recording')}
      </button>
    </div>}
    {review && <p role="status" className="video-recon-muted">{review === 'range'
      ? t('请选择这次还原的区间，再逐帧复盘。', 'Select the solve range to reconstruct it frame by frame.')
      : t('实时识别未完成，正在逐帧补读原录像。', 'Live tracking was incomplete. Reading the recording frame by frame.')}</p>}
    {!review && latestStatus && <p role="status" className="video-recon-muted">{latestStatus}</p>}
    {recording && (scramble.trim()
      ? recognizedMoves !== undefined && <p>{t(`已识别 ${recognizedMoves} 步`, `${recognizedMoves} moves recognized`)}</p>
      : trackedFrames !== undefined && <p>{t(`已跟踪 ${trackedFrames} 帧`, `Frames tracked: ${trackedFrames}`)}</p>)}
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
