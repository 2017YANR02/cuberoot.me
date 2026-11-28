'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Camera, Film, Maximize, Timer, Upload, Video } from '@app-foundation/icons/lucide';
import { VideoSourceFilmstrip } from '@/components/video/VideoSourceFilmstrip';
import { VideoCropSelection } from '@/components/VideoCropSelection';
import { INITIAL_VIDEO_TRANSFORM, VideoImageTools, videoImageTransformCss, type VideoImageTransform } from '@/components/VideoImageTools';
import { useVideoViewport } from '@/hooks/useVideoViewport';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MoreToggle from '@/components/MoreToggle';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import { createVideoWorkspace, type VideoWorkspace, type WorkspaceTab } from '@/lib/video-recon/workspace';
import { prepareOfflineVideoRecon } from '@/lib/video-recon/offline';
import { RECONSTRUCTION_TIMEOUT_MESSAGE, RECONSTRUCTION_TIMEOUT_MS, type MoveSearchResult, type MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { timecode, type SolveRange as TimeRange } from '@/lib/video-recon/engine/solve-range';
import type { SourceCrop } from '@/lib/video-recon/engine/source-crop';
import { CameraDisconnectButton, CameraRecordingAction, CameraRecordingControls, CameraSelector } from './CameraRecordingControls';
import type { VideoCubeEngine } from '@/lib/video-recon/timed-cubing-cube';
import { ProjectedCube, useVideoCubeEngine } from './ProjectedCube';
import { SolveRange } from './SolveRange';
import { VideoStatsStage } from './VideoStatsStage';
import { TpsGraph } from './TpsGraph';
import { TimerReplay } from './TimerReplay';
import { VideoFrameProgressRing, VideoReconAnalysisProgress, videoFileFrameProgress } from './VideoReconProgress';
import { VideoReconResultPet, videoReconReaction } from './VideoReconResultPet';
import type { VerifiedVideoDraft, VideoSolveAnalysisProps } from './VideoSolveAnalysis';
import './video-recon.css';

const NO_MOVES: readonly MoveStep[] = [];
const ignoreReplayPosition = () => {};
const noWorkspace = () => null;
const noSubscription = () => () => {};

function reconstructionFailure(result: MoveSearchResult | undefined, error: string, t: ReturnType<typeof useT>) {
  const timedOut = error === RECONSTRUCTION_TIMEOUT_MESSAGE;
  if (error && !timedOut) {
    return t('处理动作时出错，请重试。', 'An error interrupted move tracking. Try again.');
  }
  if (result?.inference_failure === 'no_solved_end' ||
      result?.bidirectional_fallback === 'No corroborated flat solved end frame') {
    return t('没能从收尾画面确认已还原的魔方。请把清晰的还原画面包含在区间内。',
      'The solved cube could not be confirmed. Include a clear view of the solved cube in the selected range.');
  }
  if (result?.inference_failure === 'no_supported_opening') {
    return t('看到了还原局面，但没能从视频追溯到打乱后的局面。',
      'The solved state was detected, but the moves could not be traced back to the scrambled state.');
  }
  if (timedOut) {
    const seconds = RECONSTRUCTION_TIMEOUT_MS / 1000;
    return result?.status === 'waiting_for_frames'
      ? t(`画面分析超时（${seconds} 秒），动作搜索未能开始。`, `Frame preparation timed out after ${seconds} seconds before move search could start.`)
      : t(`动作搜索超时（${seconds} 秒），没能验证完整还原。`, `Move search timed out after ${seconds} seconds before it could verify the complete solve.`);
  }
  if (result?.status === 'state_limit') {
    return t('动作搜索达到上限，仍没能验证完整还原。',
      'Move search reached its limit before it could verify the complete solve.');
  }
  if (result?.status === 'already_solved') {
    return t('区间内没有检测到还原动作。', 'No solve moves were detected in the selected range.');
  }
  return t('没能根据识别到的画面验证完整还原。', 'The detected frames did not yield a verified solve.');
}

export interface VideoReconHandoff {
  file: File;
  range: TimeRange;
  crop?: SourceCrop;
  transform: VideoImageTransform;
}

export interface VideoReviewSurface {
  cubeEngine: VideoCubeEngine;
  solidFoundation: boolean;
  setSolidFoundation: (solid: boolean) => void;
  workspace: VideoWorkspace;
  verifiedDraft?: VerifiedVideoDraft;
  settings: HTMLDivElement | null;
  playerMenu?: HTMLDivElement | null;
  overlay: HTMLDivElement | null;
  view: ReturnType<VideoWorkspace['getSnapshot']>;
}

export function VideoReconWorkspace({ mode, handoff, submission, onModeChange, onTimerBusyChange, onWorkspace, simulatedCamera, timerSource }: {
  mode: WorkspaceTab | null;
  handoff?: VideoReconHandoff;
  submission?: NonNullable<VideoSolveAnalysisProps['draftTarget']> & { file: File; captions?: (surface: VideoReviewSurface) => ReactNode };
  onModeChange?: (mode: Exclude<WorkspaceTab, 'timer'>) => void;
  onWorkspace?: (workspace: VideoWorkspace | undefined) => void;
  onTimerBusyChange?: (busy: boolean) => void;
  timerSource?: {
    scramble: string;
    file?: File;
    takeCamera?: () => Promise<MediaStream> | undefined;
    onTimedCapture?: (deviceId?: string) => void;
    onRecordedFile: (file: File) => void;
  };
  simulatedCamera?: { pick: () => void; disconnect: () => void };
}) {
  const t = useT();
  const stage = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nativeRecorder = useRef<HTMLInputElement>(null);
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
  const starting = useRef<VideoWorkspace>(undefined);
  const timerScramble = timerSource?.scramble;
  const timerFile = timerSource?.file;
  const takeCamera = timerSource?.takeCamera;
  useEffect(() => {
    if (!workspace || timerScramble === undefined) return;
    workspace.setScramble(timerScramble);
    if (timerFile) void workspace.openFile(timerFile);
    else {
      const request = takeCamera?.();
      if (request) void workspace.camera(request);
    }
  }, [workspace, timerScramble, timerFile, takeCamera]);
  const submissionFile = submission?.file;
  const submissionScramble = submission?.scramble;
  const [captionSettings, setCaptionSettings] = useState<HTMLDivElement | null>(null);
  const [verifiedDraft, setVerifiedDraft] = useState<VerifiedVideoDraft>();
  const fileReviewId = view?.fileReviewId;
  const [notationVerdict, setNotationVerdict] = useState<{ id: number; verified: boolean }>();
  const onAnalysisResolved = useCallback((verified: boolean) => {
    if (fileReviewId === undefined) return;
    setNotationVerdict(previous => previous?.id === fileReviewId ? previous : { id: fileReviewId, verified });
  }, [fileReviewId]);
  const [playerMenu, setPlayerMenu] = useState<HTMLDivElement | null>(null);
  const captions = submission?.captions;
  const [cubeEngine, setCubeEngine] = useVideoCubeEngine();
  const [solidFoundation, setSolidFoundation] = useState(false);
  const notifyDraftReady = submission?.onReady;
  const onDraftReady = useCallback((draft?: VerifiedVideoDraft) => {
    setVerifiedDraft(draft);
    notifyDraftReady?.(draft);
  }, [notifyDraftReady]);

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

  const fileAnalysisBusy = !!timerSource && detector && view?.sourceKind === 'video' && !view.trimming &&
    !view.reconstructionComplete && !view.mediaError && view.status !== 'error';
  useEffect(() => {
    onTimerBusyChange?.(!!mode && (timerBusy || !!view?.recordingReview || fileAnalysisBusy));
  }, [mode, timerBusy, view?.recordingReview, fileAnalysisBusy, onTimerBusyChange]);

  useEffect(() => {
    if (mode !== 'detector' || !detector || !handoff || !workspace || appliedHandoff.current === handoff) return;
    appliedHandoff.current = handoff;
    resetViewport();
    setImageTransform(handoff.transform);
    void workspace.openFile(handoff.file, handoff.crop, handoff.range);
  }, [mode, detector, handoff, workspace, resetViewport]);

  useEffect(() => {
    if (!workspace || !submissionFile || submissionScramble === undefined) return;
    workspace.setScramble(submissionScramble);
    void workspace.openFile(submissionFile);
  }, [workspace, submissionFile, submissionScramble]);

  const beginReconstruction = useCallback(() => {
    if (!workspace || starting.current === workspace) return;
    starting.current = workspace;
    onDraftReady?.(undefined);
    resetViewport();
    void workspace.beginReconstruction().finally(() => {
      if (starting.current === workspace) starting.current = undefined;
    });
  }, [workspace, resetViewport, onDraftReady]);

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
  const searchSteps = view?.searchResult?.steps ?? NO_MOVES;
  const hasMoves = searchSteps.some(step => step.state_moves.length);
  const lastMove = reviewing && !view.cubeSolved && view.sourceFps > 0
    ? searchSteps.findLast(step => step.state_moves.length > 0) : undefined;
  const lastMoveTime = lastMove && view ? timecode(lastMove.frame_index / view.clockFps) : undefined;
  const shownSteps = pendingResult ? liveResult?.steps ?? NO_MOVES : searchSteps;
  const measured = view?.measuredCubeTimeline;
  const modelDownload = view?.modelDownload;
  const downloadProgress = modelDownload && modelDownload.totalBytes > 0
    ? Math.floor(modelDownload.receivedBytes / modelDownload.totalBytes * 100) : undefined;
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
  const restartButton = workspace && showResults && <button type="button" className="btn-secondary"
    style={pendingResult ? { visibility: 'hidden' } : undefined} onClick={() => {
      onDraftReady?.(undefined);
      void workspace.editSolveRange();
    }}>
    {t('重试', 'Retry')}
  </button>;
  const showImageTools = fileSelected && (view?.sourceKind === 'image' || view?.trimming);
  function openMedia(file?: File) {
    if (!file) return;
    viewport.reset();
    setImageTransform(INITIAL_VIDEO_TRANSFORM);
    void workspace?.openFile(file);
  }
  const loadingModel = view?.status === 'loading';
  const analyzing = pendingResult || view?.recordingReview === 'running';
  const analysis = reviewing && workspace && view.reconstructedScramble && measured && hasMoves && (!submission || view.cubeSolved)
    ? { scramble: view.reconstructedScramble, steps: searchSteps, measured,
      fps: view.sourceFps, clockFps: view.clockFps, start: view.solveStart, end: view.solveEnd, position: view.presentedTimestamp,
      onSeek: (timestamp: number) => void workspace.requestReview(timestamp), onAnalysisResolved,
      draftTarget: submission && { scramble: submission.scramble, onReady: onDraftReady, onApply: captions ? undefined : submission.onApply },
      inferredScramble: !!view.searchResult?.inferred_scramble }
    : undefined;
  const verified = notationVerdict?.id === fileReviewId ? notationVerdict?.verified : undefined;
  const reaction = videoReconReaction(view, hasMoves, analysis ? verified : !submission);
  const frameDecoration = loadingModel
    ? <VideoFrameProgressRing progress={downloadProgress ?? 0} label={downloadProgress === undefined
      ? t('正在准备识别模型', 'Preparing detector models') : downloadProgress < 100
        ? t('正在下载识别模型', 'Downloading detector models') : t('正在初始化识别模型', 'Initializing detector models')} />
    : analyzing && <VideoReconAnalysisProgress onFrame value={frameProgress ?? (view?.videoInputComplete ? undefined : 0)} />;
  return <section className="video-recon-page" hidden={!mode}
    onKeyDown={submission ? event => workspace?.reviewKeydown(event.nativeEvent) : undefined}>
    <div className={showResults ? 'video-recon-columns video-recon-results'
      : !detector ? onWorkspace ? 'video-recon-camera-layout' : 'video-recon-columns video-recon-camera-layout' : submission ? 'video-recon-columns' : undefined}>
      <section className={filming ? 'video-recon-source-panel video-recon-panel' : 'video-recon-source-panel'}
        data-site-surface={filming ? 'panel' : undefined} data-timer-camera-connected={activeMode === 'timer' && cameraConnected ? '' : undefined}
        aria-label={detector ? detectorLabel : filming ? filmingLabel : timerLabel}>
        {detector && view?.sourceKind === 'image' && <span className="video-recon-file-name" dir="auto">{view.sourceName}</span>}
        <VideoStatsStage frameDecoration={frameDecoration}
          className="video-recon-stage" settingsAvailable={reviewing} settingsSlotRef={captions ? setPlayerMenu : undefined}
          fileName={detector ? submissionFile?.name ?? (view?.sourceKind === 'video' ? view.sourceName : undefined) : undefined}
          playback={reviewing && workspace ? {
            filmstrip: <VideoSourceFilmstrip source={view.sourceFile} start={view.solveStart} end={view.solveEnd}
              thumbnails={view.solveStart === 0 && view.solveEnd === view.duration ? view.thumbnails : undefined} />,
            playing: view.running, speed: view.playbackSpeed, end: view.solveEnd, position: view.presentedTimestamp,
            index: view.currentReviewIndex, length: view.reviewLength, onPlay: () => void workspace.togglePlayback(),
            onSpeed: workspace.changePlaybackSpeed, onSeekIndex: workspace.seekReviewIndex, onStep: workspace.stepReview,
          } : undefined}
          stats={workspace && reviewing && <TpsGraph compact steps={searchSteps}
            fps={view.clockFps} start={view.solveStart} end={view.solveEnd} cursor={resultTime} complete={view.cubeSolved}
            onSeek={timestamp => void workspace.requestReview(timestamp)} />}
          data-dragging={dragOver} onDragOver={event => {
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
          <VideoReconResultPet result={reaction} />
          {(submission || timerFile) && !fileSelected && !mediaError && <div className="video-recon-empty">
            <LoadingIndicator>{t('正在读取视频', 'Reading video')}</LoadingIndicator>
          </div>}
          {!submission && (!timerFile || mediaError) && (!view || view.sourceKind === 'none' || view.sourceKind === 'camera' && !cameraConnected) && <div className="video-recon-empty">
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
        </VideoStatsStage>
        {!detector && (filming || cameraConnected || onModeChange) && <div className="video-recon-actions">
          {filming ? <CameraRecordingAction connected={cameraConnected} view={view} workspace={workspace} />
            : cameraConnected && workspace && <CameraDisconnectButton
              textOnly={activeMode === 'timer'} disabled={timerBusy || !!view.recordingReview}
              onDisconnect={simulatedCamera?.disconnect ?? workspace.stopSource} />}
          {cameraConnected && !simulatedCamera && workspace && view?.stream && <CameraSelector stream={view.stream}
            workspace={workspace} disabled={view.cameraConnecting || timerBusy || view.cameraSwitchLocked} />}
          {filming && timerSource?.onTimedCapture && cameraConnected && view?.timerReady && !view.cameraRecordFileOnly &&
            <button type="button" className="btn-secondary" disabled={timerBusy || view.cameraSwitchLocked}
              onClick={() => {
                const id = view.stream?.getVideoTracks()[0]?.getSettings().deviceId;
                workspace?.stopSource();
                timerSource.onTimedCapture?.(id);
              }}><Timer size={16} aria-hidden />{t('跟随计时器录制', 'Record with the timer')}</button>}
          {filming && timerSource && mediaError && !cameraConnected &&
            <button type="button" className="btn-secondary video-recon-system-camera" onClick={() => nativeRecorder.current?.click()}>
              <Video size={16} aria-hidden />{t('用系统相机录制', 'Record with device camera')}
            </button>}
          {switchSourceActions}
        </div>}
        {detector && workspace && view && view.sourceKind !== 'none' &&
          (!submission || showImageTools || viewport.zoomed || (!captions && restartButton) || switchSourceActions) && <div className="video-recon-actions">
          {!submission && <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={16} aria-hidden />{t('更换', 'Replace')}
          </button>}
          {showImageTools && <VideoImageTools transform={imageTransform} onTransform={setImageTransform} cropping={!!view.cropPreview}
            cropDisabled={view.cropLocked || view.cropLoading} onCrop={() => {
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
          {!captions && restartButton}
          {switchSourceActions}
        </div>}
        {workspace && view?.trimming && (!filming || view.recordingReview === 'range') && <SolveRange view={view} workspace={workspace}
          showScramble={!submission && !timerSource} timerScramble={detector ? timerScramble : undefined} onBegin={beginReconstruction} />}
        {mediaError && !(reviewing && view.searchError === mediaError) && <div className="video-recon-error" role="alert">
          <strong>{!detector && !cameraConnected
            ? t('无法使用摄像头。请检查相机权限，或选择已有视频。', 'Camera unavailable. Check camera permission or choose an existing video.')
            : t('无法处理当前画面。', 'Could not process the current source.')}</strong>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{mediaError}</details>
        </div>}
        {workspace && view?.status === 'error' && <div className="video-recon-error" role="alert">
          <strong>{t('无法初始化检测器。', 'Could not initialize the detector.')}</strong>
          <p>{t('请检查模型资源是否可以加载，然后重试。', 'Check that the model files can be loaded, then try again.')}</p>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{view.error}</details>
          <button type="button" className="btn-secondary" onClick={() => void workspace.loadModel()}>{t('重新加载检测器', 'Reload detector')}</button>
        </div>}
      </section>
      {showResults && view && <ProjectedCube engine={cubeEngine} onEngineChange={setCubeEngine} solidFoundation={solidFoundation} live={pendingResult} liveScramble={liveResult?.scramble} solveStart={view.solveStart}
        pose={pendingResult ? liveResult?.cube?.pose : view.coloredProjection} sourceTimestamp={resultTime}
        reviewPlayback={reviewing && workspace ? { playing: view.running, readTime: workspace.readReviewPlaybackTime } : undefined}
        solved={view.cubeSolved} steps={shownSteps}
        timeline={view.projectedTimeline}
        sourceFrame={liveResult?.cube?.frame ?? Math.round(resultTime * view.clockFps)}
        sourceFps={view.sourceFps} clockFps={view.clockFps} playbackSpeed={view.running ? view.playbackSpeed : 1}
        analysis={analysis}>
        {reviewing && (!view.cubeSolved || submission && !hasMoves) && <div className="video-recon-muted" role="status">
          <strong>{t('未能完成复盘', 'Reconstruction incomplete')}</strong>
          <p>{reconstructionFailure(view.searchResult, view.searchError, t)}</p>
          {lastMoveTime && <p>{t(`已保留候选动作，最后一步位于 ${lastMoveTime}。`,
            `Candidate moves retained up to ${lastMoveTime}.`)}</p>}
          {view.searchError && <details>
            <MoreToggle as="summary">{t('技术详情', 'Technical details')}</MoreToggle>
            {view.searchError}
          </details>}
        </div>}
        {reviewing && captions && <div className="video-recon-actions video-recon-caption-actions">
          <div ref={setCaptionSettings} />
          {restartButton}
        </div>}
      </ProjectedCube>}
      {filming && workspace && view && <CameraRecordingControls
        phase={view.cameraRecordingPhase} fileOnly={view.cameraRecordFileOnly} scramble={view.initialScramble}
        onScrambleChange={timerSource ? undefined : workspace.setScramble}
        review={view.recordingReview} onReview={workspace.reviewCameraRecording}
        recordedFile={view.cameraRecordingFile} searchError={view.cameraRecordingError}
        inferenceFailure={view.cameraRecordingResult?.result?.inference_failure}
        recognizedMoves={view.cameraRecordingResult?.moves?.length} trackedFrames={view.cameraRecordingResult?.frames} />}
    </div>
    {captions && workspace && view && captions({ workspace, view, cubeEngine, solidFoundation, setSolidFoundation, verifiedDraft: reviewing ? verifiedDraft : undefined, settings: captionSettings, playerMenu,
      overlay: fileSelected && !view.cropPreview && (reviewing || view.trimming) ? viewportRef.current : null })}
    {filming && !view?.recordingReview && view?.cameraRecordingReplay?.complete && view.cameraRecordingResult
      && (view.cameraRecordingPhase === 'complete' || view.cameraRecordingPhase === 'error')
      && <TimerReplay key={view.cameraRecordingReplay.id} clip={view.cameraRecordingReplay}
        reconstruction={view.cameraRecordingResult} onPosition={ignoreReplayPosition} tailSeconds={0}
        sourceFile={view.cameraRecordingRecovered ? view.cameraRecordingFile : undefined} />}
    {filming && timerSource && <input ref={nativeRecorder} type="file" accept="video/*" capture="environment" hidden
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) timerSource.onRecordedFile(file);
      }} />}
    {!submission && <input ref={fileInput} type="file" accept="image/*,video/*" aria-label={t('视频或图片', 'Video or image')} hidden
      onChange={event => {
        openMedia(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }} />}
  </section>;
}
