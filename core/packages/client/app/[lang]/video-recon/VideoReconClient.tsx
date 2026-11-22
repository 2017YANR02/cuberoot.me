'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Camera, Film, HelpCircle, Maximize, Unplug, Upload } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import PageHeading from '@/components/PageHeading';
import HeaderToggles from '@/components/HeaderToggles';
import { VideoCropSelection } from '@/components/VideoCropSelection';
import { INITIAL_VIDEO_TRANSFORM, VideoImageTools, videoImageTransformCss, type VideoImageTransform } from '@/components/VideoImageTools';
import { useVideoViewport } from '@/hooks/useVideoViewport';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import { createVideoWorkspace, type VideoWorkspace, type WorkspaceTab } from '@/lib/video-recon/workspace';
import { prepareOfflineVideoRecon } from '@/lib/video-recon/offline';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { SolveRange as TimeRange } from '@/lib/video-recon/engine/solve-range';
import type { SourceCrop } from '@/lib/video-recon/engine/source-crop';
import { CameraTimer } from './CameraTimer';
import { ProjectedCube } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';
import { SolveRange } from './SolveRange';
import { TpsGraph } from './TpsGraph';
import type { VideoSolveAnalysisProps } from './VideoSolveAnalysis';
import './video-recon.css';

const NO_MOVES: readonly MoveStep[] = [];
const VIDEO_MODES: WorkspaceTab[] = ['detector', 'timer'];
const noWorkspace = () => null;
const noSubscription = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const AUTO_RECON_MAX_SECONDS = 30;

export interface VideoReconHandoff {
  file: File;
  range: TimeRange;
  crop?: SourceCrop;
  transform: VideoImageTransform;
}

function VideoReconProgress({ label, value, detail }: { label: string; value?: number; detail?: string }) {
  if (value === undefined) return <LoadingIndicator>{label}</LoadingIndicator>;
  return <div className="video-recon-progress">
    <div className="video-recon-section-heading">
      <span role="status">{label}</span>
      <strong aria-hidden="true">{detail ? `${detail} · ` : ''}{value}%</strong>
    </div>
    <progress aria-label={label} aria-valuetext={detail ? `${detail} · ${value}%` : undefined} max={100} value={value} />
  </div>;
}

export default function VideoReconClient() {
  const [requestedMode, setMode] = useQueryState('mode', parseAsStringEnum(VIDEO_MODES).withDefault('detector'));
  const mode = useSyncExternalStore(noSubscription, clientSnapshot, serverSnapshot) ? requestedMode : 'detector';
  return <VideoReconWorkspace mode={mode} onModeChange={next => void setMode(next)} />;
}

export function VideoReconWorkspace({ mode, handoff, submission, onModeChange, onTimerBusyChange }: {
  mode: WorkspaceTab | null;
  handoff?: VideoReconHandoff;
  submission?: NonNullable<VideoSolveAnalysisProps['draftTarget']> & { file: File; autoStart: boolean };
  onModeChange?: (mode: WorkspaceTab) => void;
  onTimerBusyChange?: (busy: boolean) => void;
}) {
  const t = useT();
  const stage = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  const [workspace, setWorkspace] = useState<VideoWorkspace>();
  const [dragOver, setDragOver] = useState(false);
  const view = useSyncExternalStore(workspace?.subscribe ?? noSubscription, workspace?.getSnapshot ?? noWorkspace, noWorkspace);
  const detector = (view?.activeTab ?? mode) === 'detector';
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
    if (!workspace) return;
    const current = workspace.getSnapshot();
    if (!mode || mode === 'detector' && current.activeTab === 'timer' && current.timerBusy) {
      if (current.activeTab === 'timer') workspace.stopSource();
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

  useEffect(() => { onTimerBusyChange?.(!!mode && timerBusy); }, [mode, timerBusy, onTimerBusyChange]);

  useEffect(() => {
    if (mode !== 'detector' || !detector || !handoff || !workspace || appliedHandoff.current === handoff) return;
    appliedHandoff.current = handoff;
    resetViewport();
    setImageTransform(handoff.transform);
    void workspace.openFile(handoff.file, handoff.crop, handoff.range);
  }, [mode, detector, handoff, workspace, resetViewport]);

  useEffect(() => {
    if (!workspace || !submissionFile || !submissionScramble) return;
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

  const stream = view?.stream;
  const showCamera = view?.showCameraPreview;
  useEffect(() => {
    const video = cameraPreview.current;
    if (!video || !stream || !showCamera) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => { video.srcObject = null; };
  }, [stream, showCamera]);

  const title = t('视频复盘', 'Video Reconstruction');
  const detectorLabel = t('视频检测', 'Video detector');
  const fitFrameLabel = t('适应画面', 'Fit frame');
  const timerLabel = t('摄像头计时', 'Camera timer');
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
  const frameProgress = reconstructing && !view.videoInputComplete && view.solveEnd > view.solveStart
    ? Math.max(0, Math.min(99, Math.floor(100 * (view.position - view.solveStart) / (view.solveEnd - view.solveStart))))
    : undefined;
  const cameraConnected = !detector && view?.sourceKind === 'camera';
  const mediaError = view?.mediaError || view?.poseError;
  function openMedia(file?: File) {
    if (!file) return;
    viewport.reset();
    setImageTransform(INITIAL_VIDEO_TRANSFORM);
    void workspace?.openFile(file);
  }
  const Container = onModeChange ? 'main' : 'section';
  return <Container className="video-recon-page" hidden={!mode}
    onKeyDown={submission ? event => workspace?.reviewKeydown(event.nativeEvent) : undefined}>
    {onModeChange && <header className="video-recon-heading">
      <div className="video-recon-title">
        <PageHeading backHref="/recon">{title}</PageHeading>
        {detector && <Link href="/video-recon-about" className="video-recon-title-help"
          aria-label={t('视频复盘说明', 'Video Reconstruction Guide')}>
          <HelpCircle size={18} strokeWidth={1.75} aria-hidden />
        </Link>}
      </div>
      <div className="video-recon-modes" role="group" aria-label={t('复盘工具', 'Reconstruction tools')}>
        <button type="button" className="btn-secondary" aria-pressed={detector} disabled={view?.timerBusy}
          onClick={() => onModeChange('detector')}><Film size={17} aria-hidden />{detectorLabel}</button>
        <button type="button" className="btn-secondary" aria-pressed={!detector} disabled={view?.timerBusy}
          onClick={() => onModeChange('timer')}><Camera size={17} aria-hidden />{timerLabel}</button>
      </div>
      <HeaderToggles />
    </header>}
    <div className={showResults ? 'video-recon-columns video-recon-results' : !detector ? 'video-recon-columns video-recon-camera-layout' : undefined}>
      <section className={detector ? 'video-recon-source-panel' : 'video-recon-source-panel video-recon-panel'}
        data-site-surface={detector ? undefined : 'panel'} aria-label={detector ? detectorLabel : timerLabel}>
        {detector && view?.sourceName && <span className="video-recon-file-name" dir="auto">{view.sourceName}</span>}
        {!detector && <div className="video-recon-section-heading">
          <h2>{t('摄像头画面', 'Camera preview')}</h2>
          {cameraConnected && workspace && <button type="button" className="btn-secondary" disabled={view.timerBusy} onClick={workspace.stopSource}>
            <Unplug size={16} aria-hidden />{t('断开摄像头', 'Disconnect camera')}
          </button>}
        </div>}
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
          {!submission && (!view || view.sourceKind === 'none') && <div className="video-recon-empty">
            {detector ? <Film size={34} strokeWidth={1.5} aria-hidden /> : <Camera size={34} strokeWidth={1.5} aria-hidden />}
            <strong>{detector ? t('拖放视频或图片', 'Drop a video or image') : t('摄像头尚未连接', 'Camera disconnected')}</strong>
            {detector
              ? <button type="button" className="btn-primary" disabled={!workspace} onClick={() => fileInput.current?.click()}>
                <Upload size={17} aria-hidden />{t('选择文件', 'Choose file')}
              </button>
              : <button type="button" className="btn-primary" disabled={!workspace || view?.status !== 'ready'} onClick={() => void workspace?.camera()}>
                <Camera size={17} aria-hidden />{t('连接摄像头', 'Connect camera')}
              </button>}
          </div>}
        </div>
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
        </div>}
        {workspace && view && reviewing && <ReviewControls label={t('视频播放控件', 'Video playback controls')}
          playing={view.running} speed={view.playbackSpeed}
          end={view.solveEnd} position={view.presentedTimestamp} index={view.currentReviewIndex} length={view.reviewLength}
          onPlay={() => void workspace.togglePlayback()} onSpeed={workspace.changePlaybackSpeed}
          onSeekIndex={workspace.seekReviewIndex} onStep={workspace.stepReview} />}
        {workspace && view?.trimming && <SolveRange view={view} workspace={workspace}
          fixedScramble={!!submission} onBegin={beginReconstruction} />}
        {submission?.autoStart && view?.trimming && view.duration > AUTO_RECON_MAX_SECONDS
          && <p className="video-recon-muted">{t('请选择一把还原的区间，再开始复盘。', 'Select the range of a single solve, then start reconstruction.')}</p>}
        {view?.status === 'loading' && <VideoReconProgress
          label={downloading ? t('正在下载识别模型', 'Downloading detector models')
            : downloadProgress === 100 ? t('正在初始化识别模型', 'Initializing detector models')
              : t('正在准备识别模型', 'Preparing detector models')}
          value={downloading ? downloadProgress : undefined} detail={downloadSize} />}
        {view?.status !== 'loading' && (reconstructing || view?.timerBuffering) && <VideoReconProgress
          label={frameProgress === undefined ? t('正在复盘 · 重建动作', 'Reconstructing · Recovering moves')
            : t('正在复盘 · 分析视频帧', 'Reconstructing · Analyzing video frames')}
          value={frameProgress} />}
        {reviewing && (!view.cubeSolved || submission && !hasMoves) && <div className="video-recon-muted" role="status">
          <strong>{t('未能完成复盘', 'Reconstruction incomplete')}</strong>
          <span> · {hasMoves ? t('已保留识别出的动作。', 'Recovered moves are available.') : t('未识别到可用动作。', 'No moves were recovered.')}</span>
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
        analysis={reviewing && workspace && view.reconstructedScramble && measured && hasMoves
          ? { scramble:view.reconstructedScramble, steps:searchSteps, measured,
            fps:view.sourceFps, start:view.solveStart, end:view.solveEnd, position:view.presentedTimestamp,
            onSeek:timestamp => void workspace.requestReview(timestamp), draftTarget: submission }
          : undefined} />}
      {workspace && view && showResults && <TpsGraph compact pending={pendingResult && resultTime <= view.solveStart}
        live={pendingResult} steps={shownSteps}
        fps={view.sourceFps} start={view.solveStart} end={view.solveEnd} cursor={resultTime} complete={reviewing && view.cubeSolved}
        onSeek={reviewing ? timestamp => void workspace.requestReview(timestamp) : undefined} />}
      {!submission && workspace && view && <CameraTimer active={!!mode && !detector} workspace={workspace} view={view} />}
    </div>
    {!submission && <input ref={fileInput} type="file" accept="image/*,video/*" aria-label={t('视频或图片', 'Video or image')} hidden
      onChange={event => {
        openMedia(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }} />}
  </Container>;
}
