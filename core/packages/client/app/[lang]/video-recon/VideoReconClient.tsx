'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, Film, Maximize, Upload, Video } from '@app-foundation/icons/lucide';
import { VideoCropSelection } from '@/components/VideoCropSelection';
import { INITIAL_VIDEO_TRANSFORM, VideoImageTools, videoImageTransformCss, type VideoImageTransform } from '@/components/VideoImageTools';
import { useVideoViewport } from '@/hooks/useVideoViewport';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import { createVideoWorkspace, type VideoWorkspace, type WorkspaceTab } from '@/lib/video-recon/workspace';
import { prepareOfflineVideoRecon } from '@/lib/video-recon/offline';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { AUTO_RECON_MAX_SECONDS, type SolveRange as TimeRange } from '@/lib/video-recon/engine/solve-range';
import type { SourceCrop } from '@/lib/video-recon/engine/source-crop';
import { CameraDisconnectButton, CameraRecordingAction, CameraRecordingControls } from './CameraRecordingControls';
import { ProjectedCube } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';
import { SolveRange } from './SolveRange';
import { TpsGraph } from './TpsGraph';
import { TimerReplay } from './TimerReplay';
import { VideoReconAnalysisProgress, VideoReconProgress, videoFileFrameProgress } from './VideoReconProgress';
import type { VideoSolveAnalysisProps } from './VideoSolveAnalysis';
import './video-recon.css';

const NO_MOVES: readonly MoveStep[] = [];
const ignoreReplayPosition = () => {};
const noWorkspace = () => null;
const noSubscription = () => () => {};

export interface VideoReconHandoff {
  file: File;
  range: TimeRange;
  crop?: SourceCrop;
  transform: VideoImageTransform;
}

export function VideoReconWorkspace({ mode, handoff, submission, onModeChange, onTimerBusyChange, onWorkspace, simulatedCamera }: {
  mode: WorkspaceTab | null;
  handoff?: VideoReconHandoff;
  submission?: NonNullable<VideoSolveAnalysisProps['draftTarget']> & { file: File; autoStart: boolean };
  onModeChange?: (mode: Exclude<WorkspaceTab, 'timer'>) => void;
  onWorkspace?: (workspace: VideoWorkspace | undefined) => void;
  onTimerBusyChange?: (busy: boolean) => void;
  simulatedCamera?: { pick: () => void; disconnect: () => void };
}) {
  const t = useT();
  const stage = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  const [workspace, setWorkspace] = useState<VideoWorkspace>();
  const [dragOver, setDragOver] = useState(false);
  const view = useSyncExternalStore(workspace?.subscribe ?? noSubscription, workspace?.getSnapshot ?? noWorkspace, noWorkspace);
  const activeMode = view?.activeTab ?? mode;
  const detector = activeMode === 'detector';
  const filming = activeMode === 'record';
  const timerBusy = !!view?.timerBusy;
  const [imageTransform, setImageTransform] = useState(INITIAL_VIDEO_TRANSFORM);
  const fileSelected = detector && (view?.sourceKind === 'image' || view?.sourceKind === 'video');
  const viewport = useVideoViewport(viewportRef, !!mode && fileSelected, !!view?.cropPreview, 'modified');
  const resetViewport = viewport.reset;
  const initialMode = useRef(mode ?? 'detector');
  const appliedHandoff = useRef<VideoReconHandoff>(undefined);
  const [openedSubmission, setOpenedSubmission] = useState<VideoWorkspace>();
  const autoAttempted = useRef<VideoWorkspace>(undefined);
  const starting = useRef<VideoWorkspace>(undefined);
  const submissionFile = submission?.file;
  const submissionScramble = submission?.scramble;

  useEffect(() => {
    const canvas = stage.current;
    if (!canvas) return;
    const session = createVideoWorkspace(canvas, initialMode.current);
    setWorkspace(session);
    let mounted = true;
    void prepareOfflineVideoRecon().then(() => { if (mounted) void session.loadModel(); });
    const pagehide = (event: PageTransitionEvent) => { if (!event.persisted) session.cleanup(); };
    window.addEventListener('pagehide', pagehide);
    return () => {
      mounted = false;
      window.removeEventListener('pagehide', pagehide);
      session.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!workspace || !onWorkspace) return;
    onWorkspace(workspace);
    return () => onWorkspace(undefined);
  }, [workspace, onWorkspace]);

  useEffect(() => {
    if (!workspace) return;
    const current = workspace.getSnapshot();
    if (!mode || current.activeTab === 'record' && mode !== 'record' && (current.timerBusy || current.recordingReview) ||
      mode === 'detector' && current.activeTab === 'timer' && current.timerBusy) {
      if (current.activeTab !== 'detector') workspace.stopSource();
      else if (current.running && current.reconstructionComplete) void workspace.togglePlayback();
      workspace.closeCrop();
    }
  }, [mode, workspace]);

  useEffect(() => {
    if (mode && !timerBusy) workspace?.selectTab(mode);
  }, [mode, timerBusy, workspace]);

  useEffect(() => {
    if (mode !== 'detector' || !workspace || submissionFile) return;
    window.addEventListener('keydown', workspace.reviewKeydown);
    return () => window.removeEventListener('keydown', workspace.reviewKeydown);
  }, [mode, workspace, submissionFile]);

  useEffect(() => { onTimerBusyChange?.(!!mode && (timerBusy || !!view?.recordingReview)); }, [mode, timerBusy, view?.recordingReview, onTimerBusyChange]);

  useEffect(() => {
    if (mode !== 'detector' || !detector || !handoff || !workspace || appliedHandoff.current === handoff) return;
    appliedHandoff.current = handoff;
    resetViewport();
    setImageTransform(handoff.transform);
    void workspace.openFile(handoff.file, handoff.crop, handoff.range);
  }, [mode, detector, handoff, workspace, resetViewport]);

  useEffect(() => {
    if (!workspace || !submissionFile || submissionScramble === undefined) return;
    let active = true;
    workspace.setScramble(submissionScramble);
    void workspace.openFile(submissionFile).then(() => {
      if (active) setOpenedSubmission(workspace);
    });
    return () => { active = false; };
  }, [workspace, submissionFile, submissionScramble]);

  const beginReconstruction = useCallback(() => {
    if (!workspace || starting.current === workspace) return;
    autoAttempted.current = workspace;
    starting.current = workspace;
    resetViewport();
    void workspace.beginReconstruction().finally(() => {
      if (starting.current === workspace) starting.current = undefined;
    });
  }, [workspace, resetViewport]);

  useEffect(() => {
    if (!submission?.autoStart || !workspace || openedSubmission !== workspace ||
      autoAttempted.current === workspace || view?.status !== 'ready' || !view.trimming ||
      view.cropPreview || view.cropLoading || view.mediaError || view.duration <= 0 ||
      view.duration > AUTO_RECON_MAX_SECONDS) return;
    beginReconstruction();
  }, [submission?.autoStart, workspace, openedSubmission, view, beginReconstruction]);

  useEffect(() => {
    if (mode === 'record' && view?.activeTab === 'record' && view.cameraRecordingPhase === 'error' &&
      view.cameraRecordingFile && !view.cameraRecordingRetried) workspace?.reviewCameraRecording();
  }, [mode, view?.activeTab, view?.cameraRecordingPhase, view?.cameraRecordingFile, view?.cameraRecordingRetried, workspace]);

  const stream = view?.stream;
  const showCamera = view?.showCameraPreview;
  useEffect(() => {
    const video = cameraPreview.current;
    if (!video || !stream || !showCamera) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => { video.srcObject = null; };
  }, [stream, showCamera]);

  const detectorLabel = t('视频检测', 'Video detector');
  const fitFrameLabel = t('适应画面', 'Fit frame');
  const timerLabel = t('摄像头计时', 'Camera timer');
  const filmingLabel = t('边拍边复盘', 'Live reconstruction');
  const reviewing = detector && view?.sourceKind === 'video' && view.reconstructionComplete && !view.trimming;
  const reconstructing = detector && view?.sourceKind === 'video' && !view.trimming && !view.reconstructionComplete;
  const pendingResult = reconstructing && !view.mediaError && view.status !== 'error';
  const showResults = reviewing || pendingResult;
  const liveResult = pendingResult ? view.liveReconstruction : undefined;
  const resultTime = liveResult?.timestamp ?? view?.presentedTimestamp ?? 0;
  const fileCanCrop = view?.sourceKind === 'image' || view?.trimming;
  const searchSteps = view?.searchResult?.steps ?? NO_MOVES;
  const hasMoves = searchSteps.some(step => step.state_moves.length);
  const shownSteps = pendingResult ? liveResult?.steps ?? NO_MOVES : searchSteps;
  const measured = view?.measuredCubeTimeline;
  const modelDownload = view?.modelDownload;
  const downloadProgress = modelDownload && modelDownload.totalBytes > 0
    ? Math.floor(modelDownload.receivedBytes / modelDownload.totalBytes * 100) : undefined;
  const downloadSize = modelDownload
    ? `${(modelDownload.receivedBytes / 1_000_000).toFixed(1)} / ${(modelDownload.totalBytes / 1_000_000).toFixed(1)} MB` : undefined;
  const downloading = downloadProgress !== undefined && downloadProgress < 100;
  const frameProgress = reconstructing || view?.recordingReview === 'running' ? videoFileFrameProgress(view ?? undefined) : undefined;
  const cameraConnected = !detector && view?.sourceKind === 'camera' && !!view.stream;
  const mediaError = view?.mediaError || view?.poseError;
  const sourceOptions = [
    { mode: 'detector', label: t('导入文件', 'Import file'), Icon: Upload },
    { mode: 'record', label: t('摄像头录像', 'Camera recording'), Icon: Video },
  ] as const;
  const switchSourceActions = onModeChange && sourceOptions.filter(option => option.mode !== activeMode).map(({ mode: next, label, Icon }) =>
    <button key={next} type="button" className="btn-secondary" disabled={timerBusy || !!view?.recordingReview}
      onClick={() => onModeChange(next)}>
      <Icon size={16} aria-hidden />{label}
    </button>);
  function openMedia(file?: File) {
    if (!file) return;
    viewport.reset();
    setImageTransform(INITIAL_VIDEO_TRANSFORM);
    void workspace?.openFile(file);
  }
  return <section className="video-recon-page" hidden={!mode}
    onKeyDown={submission ? event => workspace?.reviewKeydown(event.nativeEvent) : undefined}>
    <div className={reviewing ? 'video-recon-columns video-recon-results'
      : pendingResult ? 'video-recon-columns' : !detector ? onWorkspace ? 'video-recon-camera-layout' : 'video-recon-columns video-recon-camera-layout' : undefined}>
      <section className={filming ? 'video-recon-source-panel video-recon-panel' : 'video-recon-source-panel'}
        data-site-surface={filming ? 'panel' : undefined} data-timer-camera-connected={activeMode === 'timer' && cameraConnected ? '' : undefined}
        aria-label={detector ? detectorLabel : filming ? filmingLabel : timerLabel}>
        {detector && view?.sourceName && <span className="video-recon-file-name" dir="auto">{view.sourceName}</span>}
        <div className="video-recon-stage" data-dragging={dragOver} onDragOver={event => {
          if (!detector || submission) return;
          event.preventDefault();
          setDragOver(true);
        }} onDragLeave={() => setDragOver(false)} onDrop={event => {
          if (!detector) return;
          event.preventDefault();
          if (submission) return;
          setDragOver(false);
          openMedia(event.dataTransfer.files[0]);
        }}>
          <div ref={viewportRef} className="video-recon-source-viewport"
            hidden={!view || view.sourceKind === 'none' || showCamera} data-zoomed={viewport.zoomed}
            style={viewport.style} {...viewport.interaction}>
            <canvas ref={stage} hidden={!!view?.cropPreview} style={fileSelected ? { transform: videoImageTransformCss(imageTransform) } : undefined}
              aria-label={t('检测后的源画面', 'Processed source frame')} />
          </div>
          {workspace && view?.cropPreview && <div className="video-recon-crop-frame">
            {/* eslint-disable-next-line @next/next/no-img-element -- Browser-generated frame. */}
            <img src={view.cropPreview.url} alt={t('待裁剪的画面', 'Frame to crop')} draggable={false} />
            <VideoCropSelection onCancel={workspace.closeCrop} onSelect={({ top, left, bottom, right }) => void workspace.applyCrop({
              x: left, y: top, width: right - left, height: bottom - top,
            })} />
          </div>}
          <video ref={cameraPreview} hidden={!showCamera} muted autoPlay playsInline aria-label={t('摄像头预览', 'Camera preview')} />
          {submission && !fileSelected && !mediaError && <div className="video-recon-empty">
            <LoadingIndicator>{t('正在读取视频', 'Reading video')}</LoadingIndicator>
          </div>}
          {!submission && (!view || view.sourceKind === 'none' || view.sourceKind === 'camera' && !cameraConnected) && <div className="video-recon-empty">
            {detector ? <>
              <Film size={34} strokeWidth={1.5} aria-hidden />
              <strong>
                {t('拖放视频进行复盘', 'Drop a video to reconstruct the solve')}<br />
                {t('拖放图片检测魔方', 'Drop an image to detect the cube')}
              </strong>
              <div className="video-recon-actions">
                <button type="button" className="btn-primary" disabled={!workspace} onClick={() => fileInput.current?.click()}>
                  <Upload size={17} aria-hidden />{t('选择文件', 'Choose file')}
                </button>
                {switchSourceActions}
              </div>
            </> : filming ? <Camera size={34} strokeWidth={1.5} aria-hidden />
            : <button type="button" className="btn-primary" disabled={!workspace || view?.cameraConnecting || timerBusy || !!view?.recordingReview}
              onClick={simulatedCamera?.pick ?? (() => void workspace?.camera())}>
              <Camera size={18} aria-hidden />{view?.cameraConnecting ? t('正在连接…', 'Connecting…')
                : simulatedCamera ? t('重新选择视频', 'Choose another video') : t('连接摄像头', 'Connect camera')}
            </button>}
          </div>}
        </div>
        {!detector && (filming || cameraConnected || onModeChange) && <div className="video-recon-actions">
          {filming ? <CameraRecordingAction connected={cameraConnected} view={view} workspace={workspace} />
            : cameraConnected && workspace && <CameraDisconnectButton
              textOnly={activeMode === 'timer'} disabled={timerBusy || !!view.recordingReview}
              onDisconnect={simulatedCamera?.disconnect ?? workspace.stopSource} />}
          {switchSourceActions}
        </div>}
        {detector && workspace && view && view.sourceKind !== 'none' && <div className="video-recon-actions">
          {!submission && <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={16} aria-hidden />{t('更换', 'Replace')}
          </button>}
          {fileSelected && <VideoImageTools transform={imageTransform} onTransform={setImageTransform} cropping={!!view.cropPreview}
            cropDisabled={view.cropLocked || view.cropLoading || !fileCanCrop} onCrop={() => {
              if (view.cropPreview) workspace.closeCrop();
              else {
                viewport.reset();
                void workspace.editCrop();
              }
            }} onResetCrop={view.cropPreview && view.sourceCrop ? () => void workspace.applyCrop(undefined) : undefined} />}
          {viewport.zoomed && <Tooltip content={fitFrameLabel}>{tip =>
            <button {...tip} type="button" className="video-image-tool" aria-label={fitFrameLabel} onClick={resetViewport}>
              <Maximize size={16} aria-hidden />
            </button>}</Tooltip>}
          {reviewing && <button type="button" className="btn-secondary" onClick={() => void workspace.editSolveRange()}>
            {t('调整还原区间', 'Adjust solve range')}
          </button>}
          {switchSourceActions}
        </div>}
        {workspace && view && reviewing && <ReviewControls label={t('视频播放控件', 'Video playback controls')}
          playing={view.running} speed={view.playbackSpeed}
          end={view.solveEnd} position={view.presentedTimestamp} index={view.currentReviewIndex} length={view.reviewLength}
          onPlay={() => void workspace.togglePlayback()} onSpeed={workspace.changePlaybackSpeed}
          onSeekIndex={workspace.seekReviewIndex} onStep={workspace.stepReview} />}
        {workspace && view?.trimming && (!filming || view.recordingReview === 'range') && <SolveRange view={view} workspace={workspace}
          fixedScramble={!!submission} onBegin={beginReconstruction} />}
        {submission?.autoStart && view?.trimming && view.duration > AUTO_RECON_MAX_SECONDS
          && <p className="video-recon-muted">{t('请选择一把还原的区间，再开始复盘。', 'Select the range of a single solve, then start reconstruction.')}</p>}
        {view?.status === 'loading' && <VideoReconProgress
          label={downloading ? t('正在下载识别模型', 'Downloading detector models')
            : downloadProgress === 100 ? t('正在初始化识别模型', 'Initializing detector models')
              : t('正在准备识别模型', 'Preparing detector models')}
          value={downloading ? downloadProgress : undefined} detail={downloadSize} />}
        {view?.status !== 'loading' && (reconstructing || view?.recordingReview === 'running') &&
          <VideoReconAnalysisProgress value={frameProgress} />}
        {reviewing && (!view.cubeSolved || submission && !hasMoves) && <div className="video-recon-muted" role="status">
          <strong>{t('未能完成复盘', 'Reconstruction incomplete')}</strong>
          <span> · {view.searchResult?.inference_failure === 'no_solved_end'
            ? t('请在区间末尾保留清晰的还原局面。', 'Include a clear view of the solved cube at the end.')
            : view.searchResult?.inference_failure === 'no_supported_opening'
              ? t('无法从画面确认起始局面和完整动作。', 'The opening state and full move sequence could not be verified from the video.')
              : hasMoves ? t('已保留识别出的动作。', 'Recovered moves are available.') : t('未识别到可用动作。', 'No moves were recovered.')}</span>
          {submissionScramble?.trim() && !view.cubeSolved && <p>{t(
            '请核对视频与表单打乱是否对应同一次还原。',
            'Check that the video and the scramble in the form match the same solve.',
          )}</p>}
          {view.searchError && <details><summary>{t('技术详情', 'Technical details')}</summary>{view.searchError}</details>}
        </div>}
        {mediaError && <div className="video-recon-error" role="alert">
          <strong>{t('无法处理当前画面。', 'Could not process the current source.')}</strong>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{mediaError}</details>
        </div>}
        {workspace && view?.status === 'error' && <div className="video-recon-error" role="alert">
          <strong>{t('无法初始化检测器。', 'Could not initialize the detector.')}</strong>
          <p>{t('请使用支持 WebGPU 的浏览器，并通过 HTTPS 或本地地址访问。', 'Use a browser with WebGPU over HTTPS or localhost.')}</p>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{view.error}</details>
          <button type="button" className="btn-secondary" onClick={() => void workspace.loadModel()}>{t('重新加载检测器', 'Reload detector')}</button>
        </div>}
      </section>
      {showResults && view && <ProjectedCube live={pendingResult}
        pose={pendingResult ? liveResult?.cube?.pose : view.coloredProjection} sourceTimestamp={resultTime}
        solved={view.cubeSolved} steps={shownSteps}
        timeline={view.projectedTimeline}
        sourceFrame={liveResult?.cube?.frame ?? (reviewing ? view.result?.fittedPose?.sourceFrame : undefined) ?? Math.round(resultTime * view.sourceFps)}
        sourceFps={view.sourceFps} playbackSpeed={view.running ? view.playbackSpeed : 1}
        analysis={reviewing && workspace && view.reconstructedScramble && measured && hasMoves && (!submission || view.cubeSolved)
          ? { scramble:view.reconstructedScramble, steps:searchSteps, measured,
            fps:view.sourceFps, start:view.solveStart, end:view.solveEnd, position:view.presentedTimestamp,
            onSeek:timestamp => void workspace.requestReview(timestamp), draftTarget: submission,
            inferredScramble: !!view.searchResult?.inferred_scramble }
          : undefined} />}
      {workspace && view && reviewing && <TpsGraph compact steps={searchSteps}
        fps={view.sourceFps} start={view.solveStart} end={view.solveEnd} cursor={resultTime} complete={view.cubeSolved}
        onSeek={timestamp => void workspace.requestReview(timestamp)} />}
      {filming && workspace && view && <CameraRecordingControls
        phase={view.cameraRecordingPhase} scramble={view.initialScramble}
        onScrambleChange={workspace.setScramble}
        review={view.recordingReview} onReview={workspace.reviewCameraRecording}
        recordedFile={view.cameraRecordingFile} searchError={view.cameraRecordingError}
        inferenceFailure={view.cameraRecordingResult?.result?.inference_failure}
        recognizedMoves={view.cameraRecordingResult?.moves?.length} trackedFrames={view.cameraRecordingResult?.frames} />}
    </div>
    {filming && !view?.recordingReview && view?.cameraRecordingReplay?.complete && view.cameraRecordingResult
      && (view.cameraRecordingPhase === 'complete' || view.cameraRecordingPhase === 'error')
      && <TimerReplay key={view.cameraRecordingReplay.id} clip={view.cameraRecordingReplay}
        reconstruction={view.cameraRecordingResult} onPosition={ignoreReplayPosition} tailSeconds={0}
        sourceFile={view.cameraRecordingRecovered ? view.cameraRecordingFile : undefined} />}
    {!submission && <input ref={fileInput} type="file" accept="image/*,video/*" aria-label={t('视频或图片', 'Video or image')} hidden
      onChange={event => {
        openMedia(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }} />}
  </section>;
}
