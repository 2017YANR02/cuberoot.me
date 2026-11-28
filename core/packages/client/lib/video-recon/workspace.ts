import { FramePresenter } from "./engine/frame-presenter";
import { compactDetectionCapture } from "./engine/diagnostic-capture";
import { DetectionRecording } from "./engine/detection-recording";
import type { RecordingContext } from "./engine/detection-recording";
import type {
  FrameResult,
  InferenceBackend,
  ModelManifest,
  Settings,
  WorkerRequest,
  WorkerResponse,
} from "./engine/detector";
import { FrameQueue, openVideoFile } from "./engine/frame-stream";
import type { SourceFrame, VideoFileSource } from "./engine/frame-stream";
import { closeVideoCamera, requestVideoCamera, startCameraCapture } from "./engine/camera-source";
import type { CameraCapture, VideoCameraInput } from "./engine/camera-source";
import type { SimulatedVideoCamera } from './engine/simulated-camera';
import { startCameraRecording } from "./engine/camera-recording";
import { PoseFitter, type PoseFittingOptions } from "./engine/pose-fitter";
import type { FittedPose } from "./engine/pose-types";
import { OrderedStage } from "./engine/ordered-stage";
import { VideoResultCache, videoResultKey } from "./engine/video-result-cache";
import type { SavedVideoResult } from "./engine/video-result-cache";
import { MoveSearch } from "./engine/move-search";
import type { MoveSearchResult } from "./engine/move-search-types";
import { AUTO_RECON_MAX_SECONDS, trimRange } from "./engine/solve-range";
import { projectedWireframe, poseIsFlagged } from "./engine/reconstruction-view";
import { buildColorTimeline } from "./engine/cube-colors";
import { buildCubeReplayTimelines, measuredCubeFrame, projectedCubeAtFrame } from "./engine/projected-cube";
import { reviewIndex, steppedTimestamp, frameArrow } from "./engine/frame-review";
import { PLAYBACK_SPEEDS, ReviewPlaybackClock, playbackTiming } from "./engine/playback-timing";
import type { PlaybackSpeed } from "./engine/playback-timing";
import {createSearchConfig,ADMISSION_CAPACITY,poseWorkerCount,POLICY_VERSION,MEDIA_CLOCK_HZ} from "./pose-fitter/runtime/reconstruction-policy.mjs";
import { TimerReconstruction } from './engine/timer-reconstruction';
import { TIMER_CAMERA_END_VIEW_SECONDS, type TimerReconstructionResult } from './engine/cube-timer';
import { TimerDiagnostics } from './engine/timer-diagnostics';
import type {CameraCaptureMetrics} from './engine/camera-metrics';
import {TimerReplayStore,replayReconstruction,recordedFileReplay,type TimerReplay} from './engine/timer-replay';
import {LocalReplayStorage,TimerReplayCache} from './engine/timer-replay-cache';
import {TimerCaptureGate} from './engine/timer-capture';
import {hasWebGpuAdapter} from './engine/runtime-config';
import {cropPixels, detectVideoBars} from './engine/source-crop';
import type {SourceCrop, PixelCrop} from './engine/source-crop';
import { createVideoWorker, VIDEO_RECON_ASSETS } from './engine/worker-assets';
import type { RunMetadata } from './engine/run-provenance';

export type WorkspaceTab = 'detector' | 'timer' | 'record';
const RECORDING_LIMIT_MS = 5 * 60 * 1000;

let pendingFingerprints: Promise<NonNullable<RunMetadata['fingerprints']>> | undefined;
function fingerprints(base: string) {
  return pendingFingerprints ??= fetch(new URL('workers/fingerprints.json', base)).then(response => {
    if (!response.ok) throw new Error('Unable to load reconstruction fingerprints');
    return response.json();
  }).catch(error => {
    pendingFingerprints = undefined;
    throw error;
  });
}

function memoizeLast<Args extends unknown[], Result>(calculate: (...args: Args) => Result) {
  let previous: Args | undefined;
  let result: Result;
  return (...args: Args) => {
    if (!previous || args.some((value, index) => !Object.is(value, previous![index]))) {
      result = calculate(...args);
      previous = args;
    }
    return result;
  };
}

/** Browser-side detector and timer session. The workers and ordered pipeline
 * keep ownership of admitted frames. React observes immutable UI snapshots. */
export function createVideoWorkspace(stage: HTMLCanvasElement, initialTab: WorkspaceTab) {
  const listeners = new Set<() => void>();
  let publishPending = false;
  let fileReviewSequence = 0;
  const state = new Proxy({
    activeTab: initialTab,
    timerBusy: false,
    timerCamera: false,
    cameraClockOriginMs: undefined as number | undefined,
    cameraConnecting: false,
    cameraRecording: undefined as {
      id: string; scramble: string; phase: 'recording' | 'finalizing' | 'error'; fileOnly?: boolean; file?: File; error?: string; reviews?: number; recovered?: boolean;
    } | undefined,
    cameraRecordingError: '',
    recordingReview: undefined as 'opening' | 'ready' | 'range' | 'running' | undefined,
    cameraRecordingReplay: undefined as TimerReplay | undefined,
    timerReconstructions: {} as Record<string, TimerReconstructionResult>,
    timerReplays: {} as Record<string,TimerReplay>,
    replayLoading: false,
    replayStorageError: '',
    timerCapturePhase: 'idle' as 'idle'|'capturing'|'draining',
    manifest: undefined as ModelManifest | undefined,
    status: "loading" as "loading" | "ready" | "error",
    modelDownload: undefined as { receivedBytes: number; totalBytes: number } | undefined,
    error: "",
    mediaError: "",
    sourceName: "",
    sourceKind: "none" as "none" | "image" | "video" | "camera",
    running: false,
    playbackSpeed: 1 as PlaybackSpeed,
    processedFrames: 0,
    queuedFrames: 0,
    sourceFps: 0,
    bboxThreshold: 0.25,
    roiPadding: 0.4,
    showRoi: false,
    searchEnabled: true,
    initialScramble: "",
    openingHoldSeconds: 0,
    searchDiagnostics: true,
    searchBidirectional: true,
    searchCleanup: true,
    searchCleanupTolerance: 0.08,
    searchResult: undefined as MoveSearchResult | undefined,
    previewSearch: undefined as MoveSearchResult | undefined,
    searchError: "",
    poseError: "",
    fitBufferedFrames: 0,
    presentedTimestamp: 0,
    videoInputComplete: false,
    fileReviewId: undefined as number | undefined,
    trimming: false,
    solveStart: 0,
    solveEnd: 0,
    uploadedFile: undefined as File | undefined,
    sourceCrop: undefined as SourceCrop | undefined,
    videoSize: undefined as {width: number; height: number} | undefined,
    cropLocked: false,
    cropLoading: false,
    cropPreview: undefined as {url: string; width: number; height: number; kind: 'image' | 'video'} | undefined,
    thumbnails: [] as string[],
    reviewInitialized: false,
    captureFps: 0,
    thresholds: [0.25, 0.4, 0.25, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    presenceThreshold: 0.05,
    result: undefined as FrameResult | undefined,
    fps: 0,
    duration: 0,
    position: 0,
    stream: undefined as MediaStream | undefined,
    captureStopped: false,
  }, {
    set(target, key, value) {
      if (!Object.is(Reflect.get(target, key), value)) {
        Reflect.set(target, key, value);
        if (!publishPending) {
          publishPending = true;
          queueMicrotask(publish);
        }
      }
      return true;
    },
  });


  const timerReplayCache=new TimerReplayCache(new LocalReplayStorage(),(clip,loading=false,error='')=>{
    state.timerReplays=clip?{[clip.id]:clip}:{};state.replayLoading=loading;state.replayStorageError=error;
  });
  const timerReplayStore=new TimerReplayStore(clip=>{
    if (clip.id === state.cameraRecording?.id) state.cameraRecordingReplay = clip;
    else timerReplayCache.publish(clip);
  });
  const timerCaptureGate=new TimerCaptureGate();
  const timerPoseOptions = new Map<string, PoseFittingOptions>();
  const archivedDiagnostics = new Map<string, Promise<Blob>>();

  const timerReconstruction = new TimerReconstruction(
    (config, onResult, onError, id) => {
      const search = new MoveSearch(baseUrl, config, (value, ended) => {
        timerDiagnostics.search(id, config, value, search.actions, ended);
        onResult(value, ended);
      }, onError);
      return search;
    },
    (id, value) => {
      state.timerReconstructions = {
        ...state.timerReconstructions, [id]: id === state.cameraRecording?.id ? value : timerDiagnostics.update(id, value),
      };
    },
    id=>{
      const playback=replayReconstruction(state.timerReconstructions[id]);
      if (id === state.cameraRecording?.id) {
        clearTimeout(recordingDrainDeadline);
        state.timerReconstructions = { ...state.timerReconstructions, [id]: playback };
        return;
      }
      timerReplayCache.finish(id, playback);
      state.timerReconstructions = { ...state.timerReconstructions, [id]: playback };
      if (disposed) return;
      const pending = timerDiagnosticBlob(id);
      archivedDiagnostics.set(id, pending);
      void pending.then(async () => {
        if (disposed || archivedDiagnostics.get(id) !== pending) return;
        await timerDiagnostics.finish(id);
      }).catch(() => {
        if (archivedDiagnostics.get(id) === pending) archivedDiagnostics.delete(id);
      });
    });
  function selectTab(tab: WorkspaceTab) {
    if (state.timerBusy || tab === state.activeTab) return;
    // Both camera modes share the same capture pipeline, including pending solve tails.
    if (state.activeTab !== 'detector' && tab !== 'detector' &&
      (state.sourceKind === 'camera' || state.cameraConnecting)) {
      state.activeTab = tab;
      return;
    }
    if (state.activeTab === 'record' || tab === 'record') stopSource();
    if (tab !== 'detector') {
      if (state.uploadedFile) stopSource();
      moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = '';
      activeRunId = undefined;
      if (state.sourceKind === 'camera') state.timerCamera = true;
    }
    if (tab === 'detector' && (state.timerCamera || state.sourceKind === 'camera')) stopSource();
    state.activeTab = tab;
  }
  const cameraReady = () => state.sourceKind === 'camera' && state.running && !state.captureStopped &&
    state.status === 'ready' && state.cameraClockOriginMs !== undefined;
  let timerPreviewStart = 0;
  function recordingPhase(): 'idle' | 'recording' | 'finalizing' | 'complete' | 'error' {
    const attempt = state.cameraRecording;
    if (!attempt) return state.cameraRecordingError ? 'error' : 'idle';
    if (attempt.phase !== 'finalizing') return attempt.phase;
    if (!attempt.file && !attempt.error) return 'finalizing';
    const reconstruction = state.timerReconstructions[attempt.id];
    if (reconstruction?.status === 'failed') return 'error';
    if (reconstruction?.status !== 'solved' || !state.cameraRecordingReplay?.complete) return 'finalizing';
    return attempt.error || !reconstruction.moves?.length ? 'error' : 'complete';
  }
  const recordingBusy = () => ['recording', 'finalizing'].includes(recordingPhase());
  function startTimerSolve(id: string, scramble: string, clockMs: number) {
    if (state.cameraClockOriginMs === undefined) return;
    const start = (clockMs - state.cameraClockOriginMs) / 1000;
    const filming = id === state.cameraRecording?.id;
    const precedingTail = timerCaptureGate.shortenTailBefore(start);
    if (precedingTail) {
      timerReconstruction.stop(precedingTail.id, precedingTail.stop, precedingTail.tail);
      timerReplayStore.stop(precedingTail.id, precedingTail.stop, precedingTail.tail);
    }
    const captureStart = timerCaptureGate.start(id, start, filming ? 0 : undefined);
    const config = timerReconstruction.start(
      id, scramble, start, state.sourceFps || 30, !filming && state.searchDiagnostics,
      captureStart, filming, filming || !!simulatedCamera, !filming,
    );
    timerPoseOptions.set(id, { scramble: config.scramble, turningStartFrame: config.turning_start_frame, camera: true });
    if (!filming) timerReplayCache.begin(id, !simulatedCamera);
    timerReplayStore.start(id,start,config.fps,captureStart);
    timerPreviewStart = captureStart;
    state.timerCapturePhase='capturing';capture?.resume(captureStart);
    const simulation = simulatedCamera;
    if (simulation) void simulation.play().catch(error => {
      if (simulation === simulatedCamera) state.mediaError = error instanceof Error ? error.message : String(error);
    });
    if (filming) return;
    const runId = timerDiagnostics.start(id, generation, config, {
      policyVersion: POLICY_VERSION, appOrigin: location.origin, poseWorkers: poseWorkerCount(navigator.hardwareConcurrency),
      admissionCapacity: ADMISSION_CAPACITY,
      detector: { poseSize: size, backend, preprocessing: detectorPreprocessing, settings: settings(), models: detectorIdentity },
      timer: { solveId: id, startClockMs: clockMs, cameraClockOriginMs: state.cameraClockOriginMs },
    });
    if (config.diagnostics !== false) void recording.setFingerprints(runId, runtimeFingerprints()).catch(() => {});
    state.timerReconstructions = { ...state.timerReconstructions, [id]: { status: 'collecting', diagnosticRunId: runId } };
  }
  function stopTimerSolve(id: string, clockMs: number, tail = id === state.cameraRecording?.id ? 0 : TIMER_CAMERA_END_VIEW_SECONDS) {
    if (state.cameraClockOriginMs !== undefined) {
      const timestamp = (clockMs - state.cameraClockOriginMs) / 1000;
      timerReconstruction.stop(id, timestamp, tail);
      timerReplayStore.stop(id, timestamp, tail);
      timerCaptureGate.stop(id, timestamp, tail);
    }
  }
  let cameraRecorder: ReturnType<typeof startCameraRecording> | undefined;
  let recordingDeadline: ReturnType<typeof setTimeout> | undefined;
  let recordingDrainDeadline: ReturnType<typeof setTimeout> | undefined;
  let recordingFinishDeadline: ReturnType<typeof setTimeout> | undefined;

  function clearCameraRecording() {
    clearTimeout(recordingDeadline);
    clearTimeout(recordingDrainDeadline);
    clearTimeout(recordingFinishDeadline);
    cameraRecorder?.cancel();
    cameraRecorder = undefined;
    const id = state.cameraRecording?.id;
    if (id) {
      timerReconstruction.cancelSolve(id);
      timerReplayStore.remove(id);
      const remaining = { ...state.timerReconstructions };
      delete remaining[id];
      state.timerReconstructions = remaining;
    }
    state.cameraRecording = undefined;
    state.cameraRecordingReplay = undefined;
    state.cameraRecordingError = '';
  }

  function finishCameraRecording() {
    const attempt = state.cameraRecording;
    const recorder = cameraRecorder;
    if (!attempt || attempt.phase !== 'recording' || !recorder) return;
    clearTimeout(recordingDeadline);
    state.cameraRecording = { ...attempt, phase: 'finalizing' };
    if (attempt.fileOnly) {
      void recorder.stop().then(file => {
        if (disposed || state.cameraRecording?.id !== attempt.id) return;
        state.cameraRecording = { ...attempt, file, phase: 'error' };
        reviewCameraRecording();
      }, cause => {
        if (!disposed && state.cameraRecording?.id === attempt.id) {
          state.cameraRecording = { ...attempt, phase: 'error', error: String(cause) };
        }
      }).finally(() => { if (cameraRecorder === recorder) cameraRecorder = undefined; });
      return;
    }
    stopTimerSolve(attempt.id, performance.timeOrigin + performance.now());
    recordingDrainDeadline = setTimeout(() => {
      if (attempt.id !== state.cameraRecording?.id || state.timerCapturePhase !== 'capturing') return;
      closeTimerInput('The camera stopped delivering frames.');
      capture?.idle();
      state.timerCapturePhase = 'idle';
    }, 2500);
    recordingFinishDeadline = setTimeout(() => {
      const current = state.cameraRecording;
      if (current?.id !== attempt.id || !recordingBusy()) return;
      timerReconstruction.cancelSolve(current.id, 'Live reconstruction timed out.');
      timerReplayStore.closeInput();
      state.cameraRecording = { ...current, phase: 'error', error: current.error || 'Live reconstruction timed out.' };
      recorder.cancel();
      stopSource();
    }, 45_000);
    void recorder.stop().then(file => {
      if (attempt.id === state.cameraRecording?.id && state.cameraRecording.phase === 'finalizing' && !disposed)
        state.cameraRecording = { ...state.cameraRecording, file };
    }, cause => {
      if (attempt.id === state.cameraRecording?.id && state.cameraRecording.phase === 'finalizing' && !disposed)
        state.cameraRecording = { ...state.cameraRecording, error: cause instanceof Error ? cause.message : String(cause) };
    }).finally(() => { if (cameraRecorder === recorder) cameraRecorder = undefined; });
  }

  // A recorded file owns its own timeline (starting at zero), independent of
  // the live camera clock and the subset of frames admitted during capture.
  let recordingReviewDeadline: ReturnType<typeof setTimeout> | undefined;
  function armRecordingReviewTimeout() {
    clearTimeout(recordingReviewDeadline);
    const token = generation;
    recordingReviewDeadline = setTimeout(() => {
      if (token === generation && state.recordingReview) finishRecordingReview('Reading the recorded video timed out.');
    }, 120_000);
  }
  function reviewCameraRecording() {
    const attempt = state.cameraRecording;
    if (disposed || state.activeTab !== 'record' || !attempt?.file || recordingPhase() !== 'error' || state.recordingReview) return;
    clearTimeout(recordingDrainDeadline);
    clearTimeout(recordingFinishDeadline);
    timerReplayStore.remove(attempt.id);
    state.cameraRecording = { ...attempt, reviews: (attempt.reviews ?? 0) + 1, recovered: undefined };
    state.initialScramble = attempt.scramble;
    const opening = openFile(attempt.file);
    const token = generation;
    state.recordingReview = 'opening';
    armRecordingReviewTimeout();
    void opening.then(() => {
      if (token === generation && !disposed && state.recordingReview === 'opening') state.recordingReview = 'ready';
    }).catch(cause => {
      if (token === generation && !disposed) finishRecordingReview(String(cause));
    });
  }
  function reviewSimulatedCameraFile(id: string, file: File) {
    if (state.activeTab !== 'record' || state.cameraRecording) return;
    state.cameraRecording = { id, scramble: '', phase: 'error', file };
    reviewCameraRecording();
  }
  function updateRecordingReview() {
    const error = state.mediaError || state.poseError || state.searchError || (state.status === 'error' && state.error);
    if (error) {
      finishRecordingReview(error);
    } else if (state.recordingReview === 'ready' && state.trimming && state.status === 'ready') {
      if (state.duration <= AUTO_RECON_MAX_SECONDS) void beginReconstruction();
      else {
        clearTimeout(recordingReviewDeadline);
        state.recordingReview = 'range';
      }
    } else if (state.recordingReview === 'running' && derived.reconstructionComplete) {
      finishRecordingReview();
    }
  }
  function finishRecordingReview(error?: string) {
    const attempt = state.cameraRecording;
    if (!attempt?.file || !state.recordingReview) return;
    const result = state.searchResult;
    const rows = derived.reviewRows;
    if (!error && derived.cubeSolved && result && rows.length && result.steps.some(step => step.state_moves.length)) {
      const clip = recordedFileReplay(attempt.id, rows, result, {
        scramble: reconstructedScramble(), fps: clockFps(), source_fps: state.sourceFps, frame_clock: moveSearch?.config.frame_clock,
        turning_start_frame: moveSearch?.config.turning_start_frame, requested_start_seconds: state.solveStart,
        source_origin_seconds: searchOriginTimestamp, source_end_seconds: state.solveEnd,
      });
      state.timerReconstructions = { ...state.timerReconstructions, [attempt.id]: clip.reconstruction };
      state.cameraRecordingReplay = clip;
      state.cameraRecording = { ...attempt, phase: 'finalizing', error: undefined, recovered: true };
    } else {
      const reason = result?.inference_failure;
      const live = state.timerReconstructions[attempt.id];
      if (reason && live?.result) {
        state.timerReconstructions = { ...state.timerReconstructions, [attempt.id]: { ...live,
          result: { ...live.result, inference_failure: reason } } };
      }
      state.cameraRecording = { ...attempt, phase: 'error', recovered: false, error: error || 'The full recording could not be reconstructed.' };
    }
    stopSource();
    readReview('none', '', 0, 0, videoResults.revision);
  }
  // A browser may support camera recording but not transferable camera frames.
  // Keep the original recording and pass it to the same file review pipeline.
  const canRecordFileOnly = () => state.activeTab === 'record' && state.sourceKind === 'camera' &&
    !!state.stream?.active && typeof MediaRecorder !== 'undefined' && (!capture || state.status === 'error');
  function recordCamera() {
    if (state.activeTab !== 'record' || !state.stream || (!cameraReady() && !canRecordFileOnly()) || recordingBusy()) return;
    let recorder: ReturnType<typeof startCameraRecording>;
    try {
      state.sourceFps = state.stream.getVideoTracks()[0]?.getSettings().frameRate || state.sourceFps;
      recorder = startCameraRecording(state.stream);
    } catch (cause) {
      state.cameraRecordingError = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    clearCameraRecording();
    cameraRecorder = recorder;
    try {
      const id = crypto.randomUUID();
      const fileOnly = canRecordFileOnly();
      state.cameraRecording = { id, scramble: state.initialScramble.trim(), phase: 'recording', fileOnly };
      if (!fileOnly) startTimerSolve(id, state.initialScramble.trim(), performance.timeOrigin + performance.now());
      const ended = () => { if (cameraRecorder === recorder) finishCameraRecording(); };
      void recorder.result.then(ended, ended);
      recordingDeadline = setTimeout(finishCameraRecording, RECORDING_LIMIT_MS);
    } catch (cause) {
      clearCameraRecording();
      state.cameraRecordingError = cause instanceof Error ? cause.message : String(cause);
    }
  }
  function closeTimerInput(message?: string) {
    if (!state.timerCamera) return;
    finishCameraRecording();
    timerCaptureGate.clear();
    timerPoseOptions.clear();
    timerReplayStore.closeInput();
    timerReconstruction.closeInput(message);
  }
  function deleteTimerSolve(id:string){
    archivedDiagnostics.delete(id);
    timerReconstruction.cancelSolve(id);timerReplayStore.remove(id);timerReplayCache.remove(id);
    void timerDiagnostics.forget(id).catch(error=>{state.mediaError=String(error);});
    const remaining={...state.timerReconstructions};delete remaining[id];state.timerReconstructions=remaining;
  }
  function clearTimerSession(ids:string[]){
    timerReconstruction.cancel('Session cleared');timerReplayStore.clear();timerReplayCache.clear();
    archivedDiagnostics.clear();
    for (const id of ids) { timerReplayCache.remove(id); void timerDiagnostics.forget(id); }
    state.timerReconstructions={};
  }


  const size = 256;
  let backend: InferenceBackend = "webgpu";
  let detectorIdentity:Extract<WorkerResponse,{type:'ready'}>['models'],detectorPreprocessing='gpu';
  let activeRunId:string|undefined;


  let busy = false,
    refreshPending = false,
    resetTracking = true;


  const showPose = true;


  let moveSearch: MoveSearch | undefined;


  let poseFitter: PoseFitter | undefined;
  let resetPose = true;

  const videoResults = new VideoResultCache();


  let requestedReviewTimestamp:number|undefined,reviewInProgress=false;


  let previewVersion = 0, searchOriginTimestamp = 0;


  const recording = new DetectionRecording();
  const timerDiagnostics = new TimerDiagnostics(recording, async () => {});


  let acquireMs = 0,
    pacingMs = 0,
    scheduledAt = 0;
  let previousFrameStart = 0;


  let still: HTMLImageElement | undefined;
  let worker: Worker | undefined;

  let fileSource: VideoFileSource | undefined;
  let capture: CameraCapture | undefined;
  let simulatedCamera: SimulatedVideoCamera | undefined;
  function releaseCameraInput() {
    const input = simulatedCamera ?? state.stream;
    simulatedCamera = undefined;
    state.stream = undefined;
    if (input) closeVideoCamera(input);
  }
  let seekVersion = 0;
  let seekResume = false,
    seeking = false;


  let fileEnded = false;
  let reviewFrame: SourceFrame | undefined;
  let reviewEof = false;
  const reviewClock = new ReviewPlaybackClock();
  let decodedRange: { key: string; timestamps: number[]; complete: boolean } | undefined;
  type CameraEnd={timerEnd:true;id:string;timestamp:number;close():void};
  type CameraFrame=SourceFrame&{close():void;timerReset?:boolean;timerPose?:PoseFittingOptions};
  const cameraQueue = new FrameQueue<CameraFrame|CameraEnd>();
  const presenter = new FramePresenter();
  let timer = 0,
    generation = 0,
    lastResultTime = 0,
    lastStarted = -Infinity;
  let disposed = false;
  let presentationTimes: number[] = [];
  let modelGeneration = 0;
  let currentFrame:
    | {
        snapshot: OffscreenCanvas;
        generation: number;
        fitPose: boolean;
        fittingOptions: PoseFittingOptions;
        resetPose: boolean;
        timestamp: number;
        counted: boolean;
        camera: boolean;
        captureMetrics?:CameraCaptureMetrics;
        sentAt: number;
        drawMs: number;
        acquireMs: number;
        pacingMs: number;
        intervalMs: number;
        recording: RecordingContext;
        cacheKey: string;
      }
    | undefined;
  type FrameContext = NonNullable<typeof currentFrame>;
  type DetectedFrame = { context: FrameContext; result: FrameResult; detectorCompletedAt: number;
    fitting?: Promise<FittedPose>; fitter?: PoseFitter; fitStartedAtMs?: number; fitCompletedAtMs?: number };
  type CachedFrame = { saved: SavedVideoResult; context: Pick<FrameContext, "snapshot" | "generation" | "timestamp"> };
  type TimerEnd={timerEnd:true;id:string;timestamp:number;generation:number};
  // Recovery needs 180ms of future source context, plus the adjacent initial fit.
  const completionQueue = new OrderedStage<DetectedFrame | CachedFrame | TimerEnd>(ADMISSION_CAPACITY, completeFrame,
    (packet) => {if('context' in packet)presenter.releaseFrame(packet.context.snapshot);},
    (size) => { state.fitBufferedFrames = size; continuePipeline(); },
    (cause) => {
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
      state.running = false;
      capture?.pause();
    });
  const idleWaiters: (() => void)[] = [];
  const baseUrl = new URL(VIDEO_RECON_ASSETS, location.origin).href;
  const runtimeFingerprints = () => fingerprints(baseUrl);
  const settings = (): Settings => ({
    thresholds: state.thresholds.map((value, id) =>
      Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : (state.manifest?.classThresholds[id] ?? 1),
    ),
    presenceThreshold: Number.isFinite(state.presenceThreshold)
      ? Math.max(0, Math.min(1, state.presenceThreshold))
      : 0.05,
    bboxThreshold: Number.isFinite(state.bboxThreshold)
      ? Math.max(0, Math.min(1, state.bboxThreshold))
      : 0.25,
    roiPadding: Number.isFinite(state.roiPadding)
      ? Math.max(0, Math.min(2, state.roiPadding))
      : 0.4,
  });
  const needsPose = () => state.timerCamera || state.activeTab === 'timer' || showPose || state.searchEnabled;
  const inferenceAllowed = () => (state.timerCamera || !moveSearch?.solved) && !(state.sourceKind === "video" && state.videoInputComplete);
  const displayPose = () => showPose && (state.sourceKind !== "video" || !state.trimming);
  const clockFps = () => state.sourceKind === 'video' || state.sourceKind === 'camera' ? MEDIA_CLOCK_HZ : state.sourceFps || 30;
  const poseFittingOptions = () => state.timerCamera ? {scramble:'',turningStartFrame:null,originSeconds:0,camera:true} : ({scramble:moveSearch?.config.scramble ?? state.initialScramble.trim(),
    camera:state.sourceKind==='camera',video:state.sourceKind==='video',
    turningStartFrame:moveSearch ? moveSearch.config.turning_start_frame : state.openingHoldSeconds>0 ? Math.floor((searchOriginTimestamp+state.openingHoldSeconds)*clockFps()) : null,
    originSeconds:moveSearch?.config.source_origin_seconds??searchOriginTimestamp,
    endSeconds:state.sourceKind==="video"?(moveSearch?.config.source_end_seconds??state.solveEnd):undefined});
  const currentCacheKey = (fitPose = needsPose()) => videoResultKey(size, backend, settings(), fitPose, poseFittingOptions());
  function findSavedResult(timestamp: number, tolerance = 0.00001) {
    return videoResults.get(currentCacheKey(), timestamp, tolerance) ??
      (!needsPose() ? videoResults.get(currentCacheKey(true), timestamp, tolerance) : undefined);
  }
  function startMoveSearch() {
    moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = "";
    state.previewSearch = undefined;
    if (state.timerCamera || (state.activeTab !== 'detector' && !state.recordingReview) || !state.searchEnabled || state.sourceKind === "none") return;
    const inferScramble = state.sourceKind === "video" && !state.initialScramble.trim();
    if (!inferScramble && !state.initialScramble.trim()) return;
    if(state.searchCleanup&&(!Number.isFinite(state.searchCleanupTolerance)||state.searchCleanupTolerance<0||state.searchCleanupTolerance>1)){
      state.searchError="Cleanup color tolerance must be between 0 and 1.";return;
    }
    const token = generation;
    const config = createSearchConfig({scramble:state.initialScramble,fps:state.sourceFps||30,camera:state.sourceKind==='camera',video:state.sourceKind==='video',
      openingHoldSeconds: state.openingHoldSeconds,diagnostics:!state.recordingReview && state.searchDiagnostics,bidirectional:state.searchBidirectional&&state.sourceKind==="video",originSeconds:state.sourceKind==="video"?searchOriginTimestamp:0,
      postprocessIdentityLoops:state.searchCleanup,postprocessColorTolerance:state.searchCleanup?state.searchCleanupTolerance:0.08,inferScramble,
      startSeconds:state.sourceKind==="video"?state.solveStart:undefined,endSeconds:state.sourceKind==="video"?state.solveEnd:undefined});
    const runId=state.recordingReview ? undefined : recording.startRun(token,config,{policyVersion:POLICY_VERSION,appOrigin:location.origin,
      poseWorkers:poseWorkerCount(navigator.hardwareConcurrency),admissionCapacity:ADMISSION_CAPACITY,
      detector:{poseSize:size,backend,preprocessing:detectorPreprocessing,settings:settings(),models:detectorIdentity}});
    activeRunId=runId;
    if(runId && config.diagnostics!==false)void recording.setFingerprints(runId,runtimeFingerprints()).catch(()=>{});
    moveSearch = new MoveSearch(baseUrl, config, (value) => {
      if (token !== generation || disposed) return;
      const wasSolved=state.searchResult?.status==="solved"||state.searchResult?.status==="already_solved";
      state.searchResult = value;
      if (runId) recording.saveSearch(token, config, value,runId,moveSearch?.actions);
      if(!wasSolved&&(value.status==="solved"||value.status==="already_solved")){
        state.running=false;seekResume=false;refreshPending=false;cancelScheduled();
        if(state.sourceKind==="video")fileEnded=true;
        if(state.sourceKind==="camera"){
          state.captureStopped=true;capture?.stop();capture=undefined;
          releaseCameraInput();
          cameraQueue.clear();state.queuedFrames=0;
        }
        void finishMoveSearch();
      }
    }, message => { if (token === generation) {
      state.searchError = message;
      if(state.sourceKind === 'video'){
        state.running=false;seekResume=false;state.videoInputComplete=true;fileEnded=true;cancelScheduled();
      }
      if (runId) recording.saveError(runId,message,moveSearch?.actions??[]);
    } }, state.sourceKind === "video", value => {
      if (token === generation && !disposed && (value.steps.length || state.previewSearch?.steps.length))
        state.previewSearch = value;
    });
  }
  async function finishMoveSearch() {
    const token = generation, activeSearch = moveSearch;
    activeSearch?.startDeadline();
    await waitForPipelineIdle();
    if (token !== generation || disposed || activeSearch !== moveSearch) return;
    if (state.captureStopped) closeTimerInput();
    if (state.sourceKind === "video") state.videoInputComplete = true;
    try { await activeSearch?.end(); } catch (cause) { if (token === generation) state.searchError = cause instanceof Error ? cause.message : String(cause); }
  }
  function submitCachedFrame(row: SavedVideoResult) {
    if (!row.result.fittedPose || !moveSearch || state.videoInputComplete) return;
    if (activeRunId) recording.linkCachedFrame(activeRunId, row.timestamp, row.result);
    moveSearch.submit(row.timestamp, row.result, Promise.resolve(row.result.fittedPose));
  }
  // Only a completed decode establishes which timestamps a variable-rate range contains.
  function seedCachedSearch() {
    const key = currentCacheKey(true);
    if (decodedRange?.key === key && decodedRange.complete) {
      const rows = decodedRange.timestamps.map(time => videoResults.get(key, time));
      if (rows.length && rows.every((row): row is SavedVideoResult => !!row?.result.fittedPose)) {
        for (const row of rows) submitCachedFrame(row);
        return true;
      }
    }
    decodedRange = { key, timestamps: [], complete: false };
    return false;
  }
  function inputCrop(source: HTMLImageElement | ImageBitmap | OffscreenCanvas) {
    if (state.sourceKind === 'camera') return;
    return cropPixels(state.sourceCrop, source instanceof HTMLImageElement ? source.naturalWidth : source.width,
      source instanceof HTMLImageElement ? source.naturalHeight : source.height);
  }
  let cropRequest = 0;
  function closeCrop() {
    cropRequest++;
    if (state.cropPreview) URL.revokeObjectURL(state.cropPreview.url);
    state.cropPreview = undefined;
    state.cropLoading = false;
  }
  async function editCrop() {
    if (!state.uploadedFile || state.cropLocked || state.cropLoading || state.cropPreview || (state.sourceKind === 'video' && !state.trimming)) return;
    const token = generation;
    const request = ++cropRequest;
    state.running = false; seekResume = false; cancelScheduled(); state.cropLoading = true;
    let frame: SourceFrame | null | undefined;
    try {
      await waitForPipelineIdle();
      if (token !== generation || request !== cropRequest || disposed) return;
      const kind = state.sourceKind;
      if (kind !== 'image' && kind !== 'video') return;
      const source = kind === 'image' ? still : (frame = await fileSource?.preview(state.position))?.bitmap;
      if (token !== generation || request !== cropRequest || disposed) return;
      if (!source) throw new Error('A source frame could not be loaded for cropping.');
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      const scale = Math.min(1, 1280 / Math.max(width, height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({type: 'image/png'});
      if (token !== generation || request !== cropRequest || disposed) return;
      state.cropPreview = {url: URL.createObjectURL(blob), width, height, kind};
    } catch (cause) {
      if (token === generation && request === cropRequest) state.mediaError = cause instanceof Error ? cause.message : String(cause);
    } finally {frame?.bitmap.close(); if (request === cropRequest) state.cropLoading = false;}
  }
  async function applyCrop(crop: SourceCrop | undefined) {
    if (!state.uploadedFile || state.cropLocked) return;
    const file = state.uploadedFile;
    const range = state.sourceKind === 'video' ? {start: state.solveStart, end: state.solveEnd, position: state.position} : undefined;
    closeCrop();
    // Reopen as a new input generation: discard tracking, fitting and cached
    // results from the old crop before any new cropped frame can be admitted.
    await openFile(file, crop, range);
  }
  let pendingPreview: { timestamp: number; direction?: -1 | 1 } | undefined;
  let previewing = false;
  let checkedVideoBars = false;
  async function previewTrim(timestamp: number, direction?: -1 | 1) {
    const source = fileSource;
    if (!source || !state.trimming || !Number.isFinite(timestamp)) return;
    const job = { timestamp, direction };
    pendingPreview = job;
    const request = ++previewVersion, token = generation;
    if (previewing) return;
    previewing = true;
    try {
      const frame = direction ? await source.previewAdjacent(timestamp, direction) : await source.preview(timestamp);
      if (!frame) return;
      try {
        if (request !== previewVersion || token !== generation || !state.trimming) return;
        if (direction && (frame.timestamp >= state.solveEnd || frame.timestamp < state.solveStart)) return;
        if (!checkedVideoBars && !state.sourceCrop) {
          checkedVideoBars = true;
          presenter.previewCrop = detectVideoBars(frame.bitmap);
        }
        presenter.presentFrame(stage, presenter.captureFrame(frame.bitmap, inputCrop(frame.bitmap)));
        state.position = frame.timestamp; state.result = undefined;
      } finally { frame.bitmap.close(); }
    } catch (cause) { if (token === generation) state.mediaError = cause instanceof Error ? cause.message : String(cause); }
    finally {
      previewing = false;
      const next = pendingPreview;
      pendingPreview = undefined;
      if (next && next !== job) {
        void previewTrim(next.timestamp, next.direction);
      }
    }
  }
  function previewSelection(timestamp: number) {
    void previewTrim(Math.max(state.solveStart, Math.min(timestamp, state.solveEnd - 1 / 1_000_000)));
  }
  function stepPreview(direction: -1 | 1) {
    void previewTrim(state.position, direction);
  }
  function changeTrim(edge: "start" | "end", value: number) {
    const range = trimRange({ start: state.solveStart, end: state.solveEnd }, edge, value, state.duration, state.sourceFps);
    state.solveStart = range.start; state.solveEnd = range.end;
    void previewTrim(edge === "start" ? state.solveStart : Math.max(state.solveStart, state.solveEnd - 1 / 1_000_000));
  }
  async function makeThumbnails(token: number) {
    const source = fileSource; if (!source) return;
    for (let index = 0; index < 10 && token === generation; index++) {
      try {
        const frame = await source.preview(state.duration * (index + 0.5) / 10, true); if (!frame) continue;
        let url = "";
        try {
          const canvas = new OffscreenCanvas(frame.bitmap.width, frame.bitmap.height);
          canvas.getContext("2d")!.drawImage(frame.bitmap, 0, 0);
          url = URL.createObjectURL(await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 }));
        } finally { frame.bitmap.close(); }
        if (token !== generation) { URL.revokeObjectURL(url); return; }
        state.thumbnails = Object.assign(state.thumbnails.slice(), { [index]: url });
      } catch { /* The range remains usable if an optional thumbnail cannot decode. */ }
    }
  }
  async function beginReconstruction() {
    if (!fileSource || !state.trimming || state.status !== "ready" || state.cropPreview || state.cropLoading) return;
    state.fileReviewId = ++fileReviewSequence;
    releaseReviewFrame();
    state.cropLocked = true;
    if (state.recordingReview) {
      if (state.recordingReview === 'range') armRecordingReviewTimeout();
      state.recordingReview = 'running';
    }
    const token = generation; state.mediaError = ""; previewVersion++; busy = true;
    try {
      fileSource.seek(state.solveStart); const frame = await fileSource.next();
      if (!frame) throw new Error("There are no video frames in this solve range.");
      if (token !== generation || disposed) { frame.bitmap.close(); return; }
      if (frame.timestamp >= state.solveEnd) { frame.bitmap.close(); throw new Error("There are no video frames in this solve range."); }
      searchOriginTimestamp = frame.timestamp; startMoveSearch();
      state.trimming = false; state.videoInputComplete = false; fileEnded = false; state.running = true;
      state.reviewInitialized = false;
      resetTracking = true; resetPose = true; seekVersion++; state.processedFrames = 0; state.fps = 0;
      lastResultTime = 0; previousFrameStart = 0; lastStarted = performance.now(); acquireMs = 0; pacingMs = 0;
      const firstSaved = findSavedResult(frame.timestamp);
      if (seedCachedSearch() && firstSaved?.result.fittedPose) {
        presentSavedFrame(frame.bitmap, firstSaved); markIdle(); state.running = false; fileEnded = true;
        void finishMoveSearch(); return;
      }
      admitFrame(frame);
    } catch (cause) {
      if (token !== generation) return;
      markIdle();
      if (state.trimming) state.cropLocked = false;
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
    }
  }
  async function editSolveRange() {
    if (!derived.reconstructionComplete) return;
    state.fileReviewId = undefined;
    state.running = false; cancelScheduled(); await waitForPipelineIdle();
    releaseReviewFrame();
    moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = "";
    state.previewSearch = undefined;
    state.trimming = true; state.cropLocked = false; state.videoInputComplete = false; await previewTrim(state.solveStart);
  }
  function send(message: WorkerRequest, transfer: Transferable[] = []) {
    worker?.postMessage(message, transfer);
  }
  function markIdle() {
    busy = false;
    for (const resolve of idleWaiters.splice(0)) resolve();
  }
  async function waitForPipelineIdle() {
    if (busy) await new Promise<void>((resolve) => idleWaiters.push(resolve));
    await flushPose();
    await completionQueue.whenIdle();
  }
  async function flushPose() {
    try { await poseFitter?.flush(); }
    catch { /* The ordered frame promise reports the fitting error. */ }
  }
  function continuePipeline() {
    if (disposed) return;
    if(!inferenceAllowed())refreshPending=false;
    if (!busy && (refreshPending || !state.running || state.status !== "ready")) void flushPose();
    if (refreshPending && !busy && !completionQueue.size && !seeking && state.status === "ready") {
      refreshPending = false;
      void inferFrame();
    } else scheduleNext();
  }
  async function completeFrame(packet: DetectedFrame | CachedFrame | TimerEnd) {
    if('timerEnd' in packet){
      if(packet.generation===generation&&!disposed){
        timerReplayStore.finishThrough(packet.timestamp);timerReconstruction.finishThrough(packet.timestamp);
        timerPoseOptions.delete(packet.id);
        if(timerCaptureGate.finish(packet.id)){
          state.timerCapturePhase='idle';presentationTimes=[];lastResultTime=0;state.fps=0;previousFrameStart=0;
        }
      }
      return;
    }
    if ("saved" in packet) {
      if (packet.context.generation === generation && !disposed)
        presentSavedSnapshot(packet.context.snapshot, packet.saved);
      return;
    }
    const completed = packet.context;
    const token = completed.generation;
    if (token !== generation || disposed) return;
    if (packet.fitting) {
      try {
        packet.result.fittedPose = await packet.fitting;
        if (token === generation) state.poseError = "";
      } catch (cause) {
        if (token === generation) {
          state.poseError = cause instanceof Error ? cause.message : String(cause);
          packet.result.fittingError = state.poseError;
          // Old queued rejections must not dispose a newly recovered fitter.
          if (poseFitter === packet.fitter) {
            poseFitter?.dispose(cause instanceof Error ? cause : new Error(state.poseError));
            poseFitter = undefined;
            resetPose = true;
          }
        }
      }
    }
    if (token !== generation || disposed) return;
    const overlayStart = performance.now();
    presenter.presentFrame(stage, completed.snapshot, state.showRoi || displayPose()
      ? (context, width, height) => drawOverlay(context, width, height, packet.result) : undefined, state.sourceKind === 'camera' && state.activeTab === 'record');
    const presentedAtMs = performance.now();
    packet.result.pipeline = {
      detectorStartedAtMs: completed.sentAt,
      detectorCompletedAtMs: packet.detectorCompletedAt,
      fitStartedAtMs: packet.fitStartedAtMs, fitCompletedAtMs: packet.fitCompletedAtMs, presentedAtMs,
      presentationMs: presentedAtMs - overlayStart,
      ...(completed.camera&&state.cameraClockOriginMs!==undefined?{camera:{captureFps:completed.captureMetrics?.captureFps??state.captureFps,
        copyMs:completed.captureMetrics?.copyMs,deliveryMs:completed.captureMetrics?.deliveryMs,
        skippedFrames:completed.captureMetrics?.skippedFrames??0,browserSkippedFrames:completed.captureMetrics?.browserSkippedFrames??0,
        queuedFrames: state.queuedFrames,bufferedFits:state.fitBufferedFrames,
        sourceAgeMs:Math.max(0,performance.timeOrigin+presentedAtMs-state.cameraClockOriginMs-completed.timestamp*1000)}}:{}),
    };
    state.result = packet.result;
    state.presentedTimestamp=completed.timestamp;
    if (completed.recording.sourceKind === "video" && (!completed.fitPose || packet.result.fittedPose))
      videoResults.put(completed.cacheKey, completed.timestamp, packet.result);
    const retainDetection = state.activeTab !== 'record' &&
      (completed.recording.sourceKind !== 'camera' || !state.timerCamera || timerReconstruction.includes(completed.timestamp));
    if (retainDetection && (completed.counted || completed.recording.sourceKind === "image" || completed.recording.sourceKind === "video")) {
      const sequence = recording.append(packet.result, completed.recording);
      if (completed.camera && state.timerCamera) {
        for (const id of timerReconstruction.solveIds(completed.timestamp)) timerDiagnostics.frame(id, sequence);
      }
    }
    if (completed.camera && state.timerCamera) {
      timerReplayStore.capture(completed.timestamp,packet.result,()=>completed.snapshot.convertToBlob({type:'image/jpeg',quality:.8}));
      timerReconstruction.accept(completed.timestamp, packet.result);
    }
    if (completed.counted) {
      if (!state.processedFrames || !lastResultTime) presentationTimes = [];
      state.processedFrames++;
      state.position = completed.timestamp;
      // Buffered fits may finish together. Measure a window instead of the
      // instantaneous dispatch rate of two adjacent ready frames.
      presentationTimes.push(presentedAtMs);
      while (presentationTimes.length > 2 && presentationTimes[1] < presentedAtMs - 1000) presentationTimes.shift();
      if (presentationTimes.length > 1) state.fps = (presentationTimes.length - 1) * 1000 / (presentedAtMs - presentationTimes[0]);
      lastResultTime = presentedAtMs;
      if (completed.camera) capture?.acknowledge();
    }
  }
  function cancelScheduled() {
    clearTimeout(timer);
    timer = 0;
    scheduledAt = 0;
  }

  async function loadModel(forceWasm = false) {
    const request = ++modelGeneration;
    state.status = "loading";
    cancelScheduled();
    // Finish an admitted frame before restarting the model; keep the file cursor
    // and camera FIFO intact while the new sessions initialize.
    await waitForPipelineIdle();
    if (disposed || request !== modelGeneration) return;
    if (moveSearch) { moveSearch.dispose(); moveSearch = undefined; state.searchError = "Model changed. Restart move search to use the new results."; }
    state.error = "";
    state.result = undefined;
    refreshPending = false;
    state.fps = 0;
    resetTracking = true;
    resetPose = true;
    worker?.terminate();
    worker = undefined;
    state.modelDownload = undefined;
    try {
      const gpuAvailable = !forceWasm && window.isSecureContext && await hasWebGpuAdapter(navigator.gpu);
      if (disposed || request !== modelGeneration) return;
      backend = gpuAvailable ? 'webgpu' : 'wasm';
      if (!state.manifest) {
        const response = await fetch(new URL("models/detector.json", baseUrl));
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("json")
        )
          throw new Error(
            "The detector manifest could not be loaded.",
          );
        state.manifest = await response.json();
        if (
          !state.manifest ||
          state.manifest.version !== 3 ||
          !state.manifest.bbox ||
          !state.manifest.tracking ||
          state.manifest.layout !== "NCHW-xywh-classes-keypoint" ||
          state.manifest.classes.length !== 9 ||
          state.manifest.keypointShape.join(",") !== "1,3"
        )
          throw new Error(
            "The deployed detector manifest is incompatible with this engine.",
          );
        state.thresholds = [...state.manifest.classThresholds];
        state.presenceThreshold = state.manifest.presenceThreshold;
        state.bboxThreshold = state.manifest.bbox.threshold;
        state.roiPadding = state.manifest.tracking.roiPadding;
      }
      if (disposed || request !== modelGeneration) return;
      const currentWorker = createVideoWorker("inference");
      worker = currentWorker;
      const retryGpuInitializationOnCpu = () => {
        if (state.status !== 'loading' || backend !== 'webgpu') return false;
        currentWorker.terminate();
        worker = undefined;
        void loadModel(true);
        return true;
      };
      currentWorker.onmessage = async ({ data }: MessageEvent<WorkerResponse>) => {
        if (currentWorker !== worker) return;
        if (data.type === "progress") {
          state.modelDownload = { receivedBytes: data.receivedBytes, totalBytes: data.totalBytes };
        }
        if (data.type === "ready") {
          detectorIdentity=data.models;detectorPreprocessing=data.preprocessing;
          state.status = "ready";
          lastResultTime = 0;
          if (state.sourceKind === "image") void inferFrame();
          else if (state.running) scheduleNext();
          else if (presenter.snapshot) void inferFrame();
        }
        if (data.type === "error") {
          if (retryGpuInitializationOnCpu()) return;
          state.status = "error";
          state.error = data.message;
          capture?.pause();
          closeTimerInput(data.message);
          if (currentFrame) presenter.releaseFrame(currentFrame.snapshot);
          currentFrame = undefined;
          markIdle();
          void flushPose();
        }
        if (data.type === "result") {
          const completed = currentFrame;
          currentFrame = undefined;
          if (completed) {
            const packet: DetectedFrame = { context: completed, result: data.result,
              detectorCompletedAt: performance.now() };
            if (completed.fitPose) {
              poseFitter ??= new PoseFitter(baseUrl);
              packet.fitter = poseFitter;
              packet.fitStartedAtMs = performance.now();
              try {
                packet.fitting = poseFitter.fit(data.result, completed.resetPose,
                  completed.timestamp, completed.recording.sourceFps, completed.fittingOptions).finally(() => {
                    packet.fitCompletedAtMs = performance.now();
                  });
              } catch (cause) { packet.fitting = Promise.reject(cause); }
              // Admission continues while the ordered presenter awaits an earlier fit.
              void packet.fitting.catch(() => {});
              moveSearch?.submit(completed.timestamp, data.result, packet.fitting);
              if(completed.camera&&state.timerCamera&&completed.generation===generation)
                timerReconstruction.submit(completed.timestamp,data.result,packet.fitting);
            }
            completionQueue.enqueue(packet);
          }
          // GPU admission is released at detector completion, independently of
          // the ordered fitting/presentation stage.
          markIdle();
          continuePipeline();
        }

      };
      currentWorker.onerror = () => {
        if (currentWorker !== worker || retryGpuInitializationOnCpu()) return;
        state.status = "error";
        state.error = "The detector worker could not start. Reload the detector.";
        capture?.pause();
        closeTimerInput(state.error);
        if (currentFrame) presenter.releaseFrame(currentFrame.snapshot);
        currentFrame = undefined;
        markIdle();
        void flushPose();
      };
      send({
        type: "init",
        baseUrl,
        manifest: state.manifest,
        size,
        backend,
      });
    } catch (cause) {
      state.status = "error";
      state.error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function stopSource() {
    state.fileReviewId = undefined;
    clearTimeout(recordingReviewDeadline);
    state.recordingReview = undefined;
    if (recordingBusy()) clearCameraRecording();
    state.cameraConnecting = false;
    closeCrop(); state.uploadedFile = undefined; state.sourceCrop = undefined; state.cropLocked = false; state.cropLoading = false;
    closeTimerInput('Camera disconnected before the complete solve window was processed');
    state.timerCapturePhase='idle';
    state.captureFps=0;
    state.timerCamera = false; state.cameraClockOriginMs = undefined;
    activeRunId=undefined;
    generation++;
    seekVersion++;
    seeking = false;
    state.running = false;
    refreshPending = false;
    cancelScheduled();
    resetTracking = true;
    resetPose = true;
    poseFitter?.dispose();
    poseFitter = undefined;
    moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = "";
    state.previewSearch = undefined;
    completionQueue.clear();
    state.poseError = "";
    capture?.stop();
    capture = undefined;
    releaseCameraInput();
    releaseReviewFrame();
    fileSource?.close();
    fileSource = undefined;
    videoResults.clear();
    decodedRange = undefined;
    state.presentedTimestamp=0;requestedReviewTimestamp=undefined;reviewInProgress=false;
    state.videoInputComplete = false;
    state.reviewInitialized = false;
    state.trimming = false; state.solveStart = 0; state.solveEnd = 0; previewVersion++; searchOriginTimestamp = 0;
    state.thumbnails.forEach(url => URL.revokeObjectURL(url)); state.thumbnails = [];
    cameraQueue.clear();
    state.queuedFrames = 0;
    state.captureStopped = false;
    fileEnded = false;
    still = undefined;
    presenter.clear(stage);
    checkedVideoBars = false;
    state.videoSize = undefined;
    state.sourceKind = "none";
    state.sourceName = "";
    state.result = undefined;
    state.processedFrames = 0;
    state.sourceFps = 0;
    state.position = 0;
    state.duration = 0;
    lastResultTime = 0;
    lastStarted = -Infinity;
    previousFrameStart = 0;
    state.fps = 0;
    if (busy) {
      worker?.terminate();
      worker = undefined;
      if (currentFrame) presenter.releaseFrame(currentFrame.snapshot);
      currentFrame = undefined;
      markIdle();
      void loadModel();
    }
  }

  async function camera(request?: Promise<VideoCameraInput>) {
    stopSource();
    state.timerCamera = state.activeTab !== 'detector';
    state.cameraConnecting = true;
    state.mediaError = "";
    const token = generation;
    try {
      const input = await (request ?? requestVideoCamera(undefined, state.activeTab === 'record'));
      if (token !== generation || disposed) {
        closeVideoCamera(input);
        return;
      }
      const simulation = 'stream' in input ? input : undefined;
      if (simulation && state.activeTab !== 'timer') {
        closeVideoCamera(input);
        return;
      }
      simulatedCamera = simulation;
      const acquired = 'stream' in input ? input.stream : input;
      state.stream = acquired;
      state.sourceFps = acquired.getVideoTracks()[0].getSettings().frameRate || 30;
      const activeCapture = await startCameraCapture(
        acquired.getVideoTracks()[0],
        (frame) => {
          if (token !== generation || disposed) {
            frame.bitmap.close();
            return;
          }
          state.cameraClockOriginMs = frame.clockOriginMs;
          const admission = state.timerCamera ? timerCaptureGate.admit(frame.timestamp) : undefined;
          for (const end of admission?.ends ?? []) {
            cameraQueue.push({timerEnd:true,id:end.id,timestamp:end.timestamp,close(){}});
            if (end.latest) {
              capture?.idle();
              simulatedCamera?.rewind();
              state.timerCapturePhase='draining';
            }
          }
          if (admission && !admission.frame) {
            frame.bitmap.close();
            capture?.acknowledge();
            if (state.timerCapturePhase==='idle') capture?.idle();
          } else {
            const attempt = admission?.frame;
            cameraQueue.push({ ...frame, timerReset:attempt?.reset,
              timerPose:attempt ? timerPoseOptions.get(attempt.id) : undefined, close:() => frame.bitmap.close() });
          }
          state.queuedFrames = cameraQueue.length;
          scheduleNext();
        },
        (message) => {
          if (token !== generation || disposed) return;
          state.captureStopped = true;
          finishCameraRecording();
          releaseCameraInput();
          if (message) state.mediaError = message;
          scheduleNext();
        },
        metrics=>{if(token===generation&&!disposed){state.captureFps=metrics.captureFps;}},
        state.activeTab === 'record' && !simulation ? 640 : undefined,
      );
      if (token !== generation || disposed) {
        activeCapture.stop();
        return;
      }
      capture = activeCapture;
      state.sourceKind = "camera";
      state.sourceName = simulation?.name ?? "Camera";
      startMoveSearch();
      state.running = true;
      scheduleNext();
    } catch (cause) {
      if (token !== generation) return;
      capture?.stop();
      if (state.activeTab === 'record' && state.stream?.active && typeof MediaRecorder !== 'undefined') {
        state.sourceKind = 'camera';
        state.sourceName = 'Camera';
        return;
      }
      releaseCameraInput();
      state.mediaError =
        cause instanceof Error ? cause.message : "Unable to open the camera.";
    } finally {
      if (token === generation) state.cameraConnecting = false;
    }
  }

  async function openFile(file?: File, crop?: SourceCrop, range?: {start: number; end: number; position?: number}) {
    if (!file || disposed) return;
    stopSource();
    state.uploadedFile = file; state.sourceCrop = crop;
    state.mediaError = "";
    const token = generation;
    if (state.activeTab !== 'record') recording.setSourceFile(token,file);
    try {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        const image = new Image();
        try {
          image.src = url;
          await image.decode();
        } finally {
          URL.revokeObjectURL(url);
        }
        if (token !== generation || disposed) return;
        still = image;
        state.sourceKind = "image";
        state.sourceName = file.name;
        presenter.presentFrame(stage, presenter.captureFrame(image, inputCrop(image)));
        startMoveSearch();
        await inferFrame();
      } else if (range || file.type.startsWith("video/") || !file.type || /\.(mp4|webm|mov)$/i.test(file.name)) {
        const decoded = await openVideoFile(file);
        if (token !== generation || disposed) {
          decoded.close();
          return;
        }
        fileSource = decoded;
        state.duration = decoded.duration;
        state.videoSize = decoded.videoSize;
        state.sourceFps = decoded.sourceFps;
        state.sourceKind = "video";
        state.sourceName = file.name;
        state.solveStart = Math.max(0, Math.min(range?.start ?? 0, state.duration));
        state.solveEnd = Math.max(state.solveStart, Math.min(range?.end ?? state.duration, state.duration)); state.trimming = true;
        await previewTrim(range?.position ?? state.solveStart);
        if (state.activeTab !== 'record' || state.duration > AUTO_RECON_MAX_SECONDS) void makeThumbnails(token);
      } else throw new Error("Choose an image or a video file.");
    } catch (cause) {
      if (token === generation)
        state.mediaError =
          cause instanceof Error ? cause.message : "Unable to read this file.";
    }
  }

  function dispatch(bitmap: ImageBitmap, timestamp: number, counted: boolean,captureMetrics?:CameraCaptureMetrics, crop?:PixelCrop, timerPose?:PoseFittingOptions) {
    // Recheck after asynchronous decoding/bitmap creation: search can finish
    // while a frame is being acquired, before it reaches the neural worker.
    if(!inferenceAllowed()){
      bitmap.close();markIdle();continuePipeline();return;
    }
    const drawStart = performance.now();
    const snapshot = presenter.captureFrame(bitmap, crop);
    const sentAt = performance.now();
    const appliedSettings = settings();
    const fittingOptions = timerPose ?? poseFittingOptions();
    currentFrame = {
      snapshot,
      generation,
      fitPose: needsPose(),
      fittingOptions,
      resetPose,
      timestamp,
      counted,
      camera: state.sourceKind === "camera" && counted,
      captureMetrics,
      recording: {
        sourceId: generation,
        sourceName: state.sourceName,
        sourceKind: state.sourceKind as "image" | "video" | "camera",
        sourceFps: state.sourceFps,
        segment: seekVersion,
        timestampSeconds: timestamp,
        backend,
        settings: appliedSettings,
        runId:activeRunId,
      },
      cacheKey: videoResultKey(size, backend, appliedSettings, needsPose(), fittingOptions),
      sentAt,
      drawMs: sentAt - drawStart,
      acquireMs: counted ? acquireMs : 0,
      pacingMs: counted ? pacingMs : 0,
      intervalMs:
        counted && previousFrameStart ? lastStarted - previousFrameStart : 0,
    };
    send(
      {
        type: "frame",
        bitmap,
        crop,
        settings: appliedSettings,
        resetTracking: resetTracking || state.sourceKind === "image",
        preserveAlpha: state.sourceKind === "image",
      },
      [bitmap],
    );
    resetTracking = false;
    if (needsPose()) resetPose = false;
    if (counted) previousFrameStart = lastStarted;
  }

  async function inferFrame() {
    if(state.timerCamera)return;
    if (state.trimming || !inferenceAllowed()) { refreshPending=false;return; }
    if (busy || completionQueue.size || disposed || state.sourceKind === "none") {
      if (!disposed && state.sourceKind !== "none") refreshPending = true;
      return;
    }
    const source = state.sourceKind === "image" ? still : presenter.snapshot;
    if (!source) {
      scheduleNext();
      return;
    }
    if (state.status !== "ready") return;
    busy = true;
    const token = generation;
    const activeWorker = worker;
    try {
      const bitmap = await createImageBitmap(source);
      if (token !== generation || activeWorker !== worker || disposed) {
        bitmap.close();
        return;
      }
      dispatch(bitmap, state.position, false, undefined, state.sourceKind === 'image' ? inputCrop(bitmap) : undefined);
    } catch (cause) {
      if (token !== generation) return;
      markIdle();
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function processNext() {
    timer = 0;
    if (busy || !completionQueue.canAdmit || !state.running || state.status !== "ready" || disposed) return;
    busy = true;
    // Pace from the start of the whole frame, including source acquisition and
    // drawing. Pacing from post-draw dispatch adds those costs to every interval.
    lastStarted = performance.now();
    pacingMs = scheduledAt ? lastStarted - scheduledAt : 0;
    scheduledAt = 0;
    const acquireStart = lastStarted;
    const token = generation;
    const activeWorker = worker;
    try {
      const frame =
        state.sourceKind === "video" ? await fileSource?.next() : cameraQueue.shift();
      acquireMs = performance.now() - acquireStart;
      state.queuedFrames = cameraQueue.length;
      if(frame&&'timerEnd' in frame){
        if(token===generation&&activeWorker===worker&&!disposed){
          // No later idle-camera work enters the fitter. Flush its remaining
          // lookahead and close the solve after ordered presentation drains.
          void flushPose();completionQueue.enqueue({timerEnd:true,id:frame.id,timestamp:frame.timestamp,generation:token});
        }
        markIdle();continuePipeline();return;
      }
      if (token !== generation || activeWorker !== worker || disposed) {
        frame?.bitmap.close();
        return;
      }
      if(!state.running&&!inferenceAllowed()){
        frame?.bitmap.close();markIdle();return;
      }
      if (state.sourceKind === "video" && !state.videoInputComplete && decodedRange && (!frame || frame.timestamp >= state.solveEnd))
        decodedRange.complete = true;
      if (frame && state.sourceKind === "video" && frame.timestamp >= state.solveEnd) {
        frame.bitmap.close(); markIdle(); fileEnded = true; state.running = false; void finishMoveSearch(); return;
      }
      if (!frame) {
        markIdle();
        if (state.sourceKind === "video") {
          fileEnded = true;
          state.running = false;
        } else if (state.captureStopped) state.running = false;
        if (!state.running) void finishMoveSearch();
        return;
      }
      if('timerReset' in frame&&frame.timerReset){resetPose=true;resetTracking=true;}
      admitFrame(frame);
    } catch (cause) {
      if (token !== generation) return;
      markIdle();
      state.running = false;
      capture?.pause();
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
      closeTimerInput(state.mediaError);
    }
  }
  function admitFrame(frame: SourceFrame & Pick<CameraFrame,'timerPose'>) {
      if (state.sourceKind === 'video' && !state.videoInputComplete && decodedRange)
        decodedRange.timestamps.push(frame.timestamp);
      const crop = inputCrop(frame.bitmap);
      const saved = state.sourceKind === "video" ? findSavedResult(frame.timestamp) : undefined;
      if (saved) {
        submitCachedFrame(saved);
        // A cached island closes the preceding numerical segment. Present it
        // through the same queue so it cannot overtake an earlier pending fit.
        void flushPose(); resetTracking = true; resetPose = true;
        const snapshot = presenter.captureFrame(frame.bitmap, crop);
        frame.bitmap.close();
        completionQueue.enqueue({ saved, context: { snapshot, generation, timestamp: frame.timestamp } });
        markIdle();
        continuePipeline();
      } else if(!inferenceAllowed()){
        // Completed-video playback is decoding only. An uncached frame (for
        // example after an early solution) must never restart neural inference.
        try {
          presenter.presentFrame(stage,presenter.captureFrame(frame.bitmap, crop));
          state.result=undefined;state.position=frame.timestamp;state.presentedTimestamp=frame.timestamp;
        } finally {frame.bitmap.close();markIdle();}
        continuePipeline();
      } else dispatch(frame.bitmap, frame.timestamp, true,frame.captureMetrics, crop, frame.timerPose);
  }

  function presentSavedFrame(bitmap: ImageBitmap, saved: SavedVideoResult) {
    try {
      const snapshot = presenter.captureFrame(bitmap, inputCrop(bitmap));
      presentSavedSnapshot(snapshot, saved);
    } finally { bitmap.close(); }
  }
  function presentSavedSnapshot(snapshot: OffscreenCanvas, saved: SavedVideoResult) {
    presenter.presentFrame(stage, snapshot, state.showRoi || displayPose()
      ? (ctx, width, height) => drawOverlay(ctx, width, height, saved.result) : undefined);
    state.result = saved.result; state.position = saved.timestamp;
    state.presentedTimestamp=saved.timestamp;

  }

  function releaseReviewFrame() {
    reviewFrame?.bitmap.close();
    reviewFrame = undefined;
    reviewEof = false;
  }

  function presentReviewFrame(frame: SourceFrame) {
    try {
      // The full-rate video has frames that were never sent to the detector.
      // Use a nearby cached result for the wireframe and keep the video timestamp.
      const saved = findSavedResult(frame.timestamp, 1 / 30 + 0.001);
      const snapshot = presenter.captureFrame(frame.bitmap, inputCrop(frame.bitmap));
      presenter.presentFrame(stage, snapshot, saved && (state.showRoi || displayPose())
        ? (ctx, width, height) => drawOverlay(ctx, width, height, saved.result) : undefined);
      state.result = saved?.result;
      state.position = state.presentedTimestamp = frame.timestamp;
    } finally {
      frame.bitmap.close();
    }
  }

  function readReviewPlaybackTime(now = performance.now()) {
    if (!state.running || seeking) return state.presentedTimestamp;
    // Keep animations aligned even if decoding falls behind the wall clock.
    const readyThrough = reviewFrame?.timestamp ?? (reviewEof ? state.solveEnd
      : state.presentedTimestamp + 1 / (state.sourceFps || 30));
    return Math.max(state.presentedTimestamp, Math.min(reviewClock.time(now), readyThrough, state.solveEnd));
  }

  async function loadNextReviewFrame() {
    const source = fileSource;
    if (!source) return;
    busy = true;
    const token = generation;
    const request = seekVersion;
    try {
      const frame = await source.next();
      if (token !== generation || request !== seekVersion || disposed) {
        frame?.bitmap.close();
        return;
      }
      if (frame && frame.timestamp < state.solveEnd) reviewFrame = frame;
      else {
        frame?.bitmap.close();
        reviewEof = true;
      }
    } catch (cause) {
      if (token !== generation || request !== seekVersion || disposed) return;
      state.running = false;
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === generation && !disposed) {
        markIdle();
        scheduleNext();
      }
    }
  }

  function scheduleReview() {
    if (seeking) return;
    if (!reviewFrame && !reviewEof) {
      void loadNextReviewFrame();
      return;
    }
    const delay = reviewClock.delayUntil(reviewFrame?.timestamp ?? state.solveEnd, performance.now());
    if (delay > 0) {
      timer = window.setTimeout(() => { timer = 0; scheduleNext(); }, Math.ceil(delay));
      return;
    }
    if (!reviewFrame) {
      fileEnded = true;
      state.running = false;
      return;
    }
    const frame = reviewFrame;
    reviewFrame = undefined;
    try {
      presentReviewFrame(frame);
      void loadNextReviewFrame();
    } catch (cause) {
      state.running = false;
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function scheduleNext() {
    if (
      timer ||
      busy ||
      !completionQueue.canAdmit ||
      refreshPending ||
      !state.running ||
      state.status !== "ready" ||
      disposed ||
      state.trimming ||
      state.sourceKind === "none" ||
      state.sourceKind === "image"
    )
      return;
    if (state.sourceKind === "camera" && !cameraQueue.length) {
      if (state.captureStopped) { state.running = false; void finishMoveSearch(); }
      return;
    }
    if (state.sourceKind === "video" && derived.reconstructionComplete) {
      scheduleReview();
      return;
    }
    // Camera timestamps already pace frame admission. Drain its FIFO as fast as
    // inference/backpressure permit, so short UI stalls can be caught up.
    const interval = state.sourceKind === "camera" ? 0 : playbackTiming(state.sourceFps).frameIntervalMs;
    scheduledAt = performance.now();
    const remaining = interval - (scheduledAt - lastStarted);
    if (remaining <= 0) {
      // A completed worker message already gives the browser an asynchronous
      // boundary. An overdue frame needs no additional zero-delay timer task.
      void processNext();
      return;
    }
    timer = window.setTimeout(() => void processNext(), Math.ceil(remaining));
  }

  function projectionForFrame(frame?: FrameResult): [number, number][][] {
    if (!frame?.fittedPose?.pose) return [];
    const sourceFrame = frame.fittedPose.sourceFrame ?? Math.round(state.position * clockFps());
    if (poseIsFlagged(frame.fittedPose,derived.reconstructionFlags.get(sourceFrame))) return [];
    const staticEnd = moveSearch?.config.turning_start_frame;
    return projectedWireframe(frame.fittedPose, derived.reconstructionChoices.get(sourceFrame),
      staticEnd != null && sourceFrame <= staticEnd);
  }
  function drawOverlay(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    frame = state.result,
  ) {
    if (!frame) return;
    const sx = width / frame.transform.sourceWidth,
      sy = height / frame.transform.sourceHeight;
    const radius = Math.max(3.5, width / 230);
    if (state.showRoi && frame.roi) {
      const t = frame.transform;
      ctx.strokeStyle = "#c6f69bcc";
      ctx.lineWidth = (1.5 * radius) / 3.5;
      ctx.setLineDash([radius * 2, radius * 2]);
      ctx.strokeRect(
        t.cropX * sx,
        t.cropY * sy,
        t.cropWidth * sx,
        t.cropHeight * sy,
      );
      ctx.setLineDash([]);
    }
    if (displayPose() && frame.fittedPose?.pose) {
      ctx.strokeStyle = "#64f6dd";
      ctx.lineWidth = Math.max(1.5, width / 650);
      ctx.lineJoin = "round";
      const polygons = projectionForFrame(frame);
      for (const polygon of polygons) {
        if (!polygon.length) continue;
        ctx.beginPath();
        ctx.moveTo(polygon[0][0] * sx, polygon[0][1] * sy);
        for (const point of polygon.slice(1)) ctx.lineTo(point[0] * sx, point[1] * sy);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function redrawOverlay() {
    if (state.result) presenter.redraw(stage, state.showRoi || displayPose() ? drawOverlay : undefined);
  }
  async function timerDiagnosticBlob(id: string) {
    const run = timerDiagnostics.runId(id);
    if (!run) throw new Error('Diagnostics are unavailable for this solve');
    await recording.ready(run);
    const capture = compactDetectionCapture(timerDiagnostics.export(id));
    return new Blob([JSON.stringify({ ...capture, model: state.manifest })], { type: 'application/json' });
  }

  async function downloadTimerDiagnostics(id: string) {
    try {
      const blob = await (archivedDiagnostics.get(id) ?? timerDiagnosticBlob(id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cube-timer-diagnostics-${id}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      state.mediaError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function requestReview(timestamp:number) {
    if(!derived.reconstructionComplete||state.trimming)return;
    requestedReviewTimestamp=timestamp;
    state.running=false;seekResume=false;cancelScheduled();
    if(reviewInProgress)return;
    reviewInProgress=true;const token=generation;
    try {
      while(requestedReviewTimestamp!=null&&token===generation){
        const target:number=requestedReviewTimestamp;
        await seekFile(target);
        if(requestedReviewTimestamp===target)requestedReviewTimestamp=undefined;
      }
    } finally { if(token===generation)reviewInProgress=false; }
  }
  function seekReviewIndex(index: number) {
    const row = derived.reviewRows[index];
    if (row) void requestReview(row.timestamp);
  }
  function stepReview(delta: number) {
    if(state.sourceKind!=="video"||!derived.reconstructionComplete||state.trimming)return;
    const timestamp=steppedTimestamp(derived.reviewRows,requestedReviewTimestamp??state.presentedTimestamp,delta);
    if(timestamp!=null)void requestReview(timestamp);
  }
  function reviewKeydown(event:KeyboardEvent) {
    if(state.sourceKind!=="video"||!derived.reconstructionComplete||state.trimming||event.defaultPrevented)return;
    const direction=frameArrow(event,event.target instanceof Element?event.target:null);
    if(direction){event.preventDefault();stepReview(direction);}
  }
  async function seekFile(timestamp: number) {
    if (!fileSource) return;
    timestamp = Math.max(state.solveStart, Math.min(timestamp, derived.reviewRows.at(-1)?.timestamp ?? state.solveEnd));
    const request = ++seekVersion;
    if (!seeking) {
      seekResume = state.running;
      seeking = true;
    }
    state.running = false;
    cancelScheduled();
    const token = generation;
    await waitForPipelineIdle();
    if (token !== generation || request !== seekVersion || !fileSource) return;
    refreshPending = false;
    releaseReviewFrame();
    fileSource.seek(timestamp, { fullRate: true });
    state.processedFrames = 0;
    lastResultTime = 0;
    lastStarted = -Infinity;
    previousFrameStart = 0;
    state.fps = 0;
    fileEnded = false;
    busy = true;
    try {
      const frame = await fileSource.next();
      if (token !== generation || request !== seekVersion || disposed) {
        frame?.bitmap.close();
        return;
      }
      if (frame && frame.timestamp < state.solveEnd) presentReviewFrame(frame);
      else {
        frame?.bitmap.close();
        fileEnded = true;
      }
    } catch (cause) {
      if (token === generation && request === seekVersion)
        state.mediaError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === generation) markIdle();
    }
    if (token !== generation || request !== seekVersion || disposed) return;
    seeking = false;
    state.running = seekResume && !fileEnded;
    if (state.running) reviewClock.start(state.presentedTimestamp, state.playbackSpeed, performance.now());
    scheduleNext();
  }
  async function togglePlayback() {
    if (state.sourceKind === "video" && !derived.reconstructionComplete) return;
    if (state.running) {
      state.running = false;
      cancelScheduled();
      capture?.pause();
      if (!busy) void flushPose();
      return;
    }
    if (state.sourceKind === "camera" && state.captureStopped) {
      await camera();
      return;
    }
    if (state.sourceKind === "video") {
      if (seeking) return;
      if (fileEnded) await seekFile(state.solveStart);
      if (disposed || state.sourceKind !== "video" || seeking || fileEnded) return;
      reviewClock.start(state.presentedTimestamp, state.playbackSpeed, performance.now());
    }
    state.running = true;
    lastResultTime = 0;
    capture?.resume();
    scheduleNext();
  }
  function changePlaybackSpeed(speed: number) {
    if(!PLAYBACK_SPEEDS.includes(speed as PlaybackSpeed))return;
    const now = performance.now();
    const time = readReviewPlaybackTime(now);
    state.playbackSpeed = speed as PlaybackSpeed;
    reviewClock.start(time, state.playbackSpeed, now);
    cancelScheduled();
    scheduleNext();
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    clearTimeout(recordingReviewDeadline);
    clearCameraRecording();
    closeCrop();
    timerReconstruction.cancel('Page closed before reconstruction finished');
    timerReplayStore.clear();timerReplayCache.clear();
    timerCaptureGate.clear();
    timerPoseOptions.clear();
    archivedDiagnostics.clear();
    generation++;
    cancelScheduled();
    previewVersion++; state.thumbnails.forEach(url => URL.revokeObjectURL(url));
    capture?.stop();
    cameraQueue.clear();
    releaseReviewFrame();
    fileSource?.close();
    worker?.terminate();
    poseFitter?.dispose();
    moveSearch?.dispose();
    completionQueue.clear();
    releaseCameraInput();
    markIdle();
  }

  // The live pipeline can update several times per frame. Build the review
  // timeline only when its inputs change, and only once review is available.
  const searchMetadata = memoizeLast((search: MoveSearchResult | undefined, scramble: string) => {
    const steps = search?.steps ?? [];
    let colors: ReturnType<typeof buildColorTimeline> | undefined;
    if (search) {
      try { colors = buildColorTimeline(scramble, steps); } catch { /* Partial result can lack a valid state. */ }
    }
    return {
      choices: new Map(steps.map(step => [step.frame_index, step.geometry_option_index])),
      flags: new Map(steps.map(step => [step.frame_index, step.pose_flagged === true])),
      colors,
    };
  });
  const readReview = memoizeLast((kind: typeof state.sourceKind, key: string, start: number, end: number, _revision: number) =>
    kind === 'video' ? videoResults.entries(key).filter(row => row.timestamp >= start - 0.00001 && row.timestamp < end) : []);
  const projection = memoizeLast((
    rows: readonly SavedVideoResult[],
    colors: ReturnType<typeof buildColorTimeline> | undefined,
    fps: number,
    solved: boolean,
    search: MoveSearchResult | undefined,
    turningStartFrame: number | null | undefined,
  ) => colors ? buildCubeReplayTimelines(rows, colors, {
    fps, solved, steps: search?.steps ?? [], turningStartFrame,
  }) : undefined);
  const previewMetadata = memoizeLast((search: MoveSearchResult | undefined, scramble: string) => {
    const steps = (search?.steps ?? []).filter(step => step.state_moves.length > 0);
    try { return { steps, colors: buildColorTimeline(scramble, steps) }; }
    catch { return { steps, colors: undefined }; }
  });
  const previewFrame = memoizeLast((
    timestamp: number, result: FrameResult, colors: NonNullable<ReturnType<typeof previewMetadata>['colors']>,
    fps: number, turningStartFrame: number | null, step: MoveSearchResult['steps'][number] | undefined,
  ) => measuredCubeFrame({ timestamp, result }, colors, { fps, solved: true, turningStartFrame }, step));
  const reconstructedScramble = () => state.searchResult?.inferred_scramble ?? moveSearch?.config.scramble ?? '';

  function liveReconstruction() {
    if (state.sourceKind !== 'video' || state.trimming || derived.reconstructionComplete || !moveSearch) return;
    const { fps, scramble, turning_start_frame } = moveSearch.config;
    const search = state.previewSearch ?? state.searchResult;
    const openingScramble = search?.inferred_scramble ?? scramble;
    const { steps, colors } = previewMetadata(search, openingScramble);
    const current = state.result;
    const currentFrame = current?.fittedPose?.sourceFrame ?? Math.round(state.presentedTimestamp * fps);
    const step = search?.steps.findLast(candidate => candidate.frame_index <= currentFrame);
    // The forward search can be behind the detector. Render the frame that
    // owns its sticker state instead of applying that state to a later fit.
    const earlier = step && step.frame_index < currentFrame;
    const saved = earlier ? videoResults.get(currentCacheKey(true), step.frame_index / fps, 0.5 / fps + 0.00001) : undefined;
    const timestamp = saved?.timestamp ?? (earlier ? step.frame_index / fps : state.presentedTimestamp);
    const result = earlier ? saved?.result : current;
    const cube = result && colors ? previewFrame(timestamp, result, colors, fps, turning_start_frame, step) : undefined;
    return { steps, timestamp, cube, scramble: openingScramble };
  }

  const derived = {
    get reconstructionChoices() { return searchMetadata(state.searchResult, reconstructedScramble()).choices; },
    get reconstructionFlags() { return searchMetadata(state.searchResult, reconstructedScramble()).flags; },
    get reconstructionComplete() {
      return state.videoInputComplete && (!state.searchEnabled || !!state.searchError ||
        !!state.searchResult && ["solved", "already_solved", "exhausted", "state_limit"].includes(state.searchResult.status));
    },
    get timerBuffering() {
      const latest = Object.values(state.timerReconstructions).at(-1);
      return state.timerCamera && state.timerCapturePhase !== 'capturing' &&
        !!latest && ['waiting', 'queued', 'searching'].includes(latest.status);
    },
    get displayedPoseFlagged() {
      return poseIsFlagged(state.result?.fittedPose, derived.reconstructionFlags.get(
        state.result?.fittedPose?.sourceFrame ?? Math.round(state.presentedTimestamp * clockFps())));
    },
    get cubeSolved() { return state.searchResult?.status === "solved" || state.searchResult?.status === "already_solved"; },
    get reviewRows() {
      const normal = currentCacheKey();
      const key = needsPose() || videoResults.count(normal) ? normal : currentCacheKey(true);
      return readReview(state.sourceKind, key, state.solveStart, state.solveEnd, videoResults.revision);
    },
    get currentReviewIndex() { return reviewIndex(derived.reviewRows, state.presentedTimestamp); },
    get cubeReplayTimelines() {
      if (!derived.reconstructionComplete || state.trimming || state.sourceKind !== 'video') return undefined;
      return projection(derived.reviewRows, searchMetadata(state.searchResult, reconstructedScramble()).colors,
        clockFps(), derived.cubeSolved, state.searchResult, moveSearch?.config.turning_start_frame);
    },
    get projectedTimeline() { return derived.cubeReplayTimelines?.projected ?? []; },
    get coloredProjection() {
      return projectedCubeAtFrame(derived.projectedTimeline, Math.round(state.presentedTimestamp * clockFps()));
    },
    get showCameraPreview() {
      return state.sourceKind === 'camera' && state.timerCamera && !state.captureStopped &&
        (state.timerCapturePhase === 'idle' || !state.result || state.presentedTimestamp < timerPreviewStart);
    },
  };
  function getView() {
    const reviewing = derived.reconstructionComplete && !state.trimming;
    const recording = state.cameraRecording;
    const recordingResult = recording && state.timerReconstructions[recording.id];
    return {
      activeTab: state.activeTab,
      timerBusy: state.timerBusy || recordingBusy(),
      timerBuffering: derived.timerBuffering,
      timerReconstructions: state.timerReconstructions,
      timerReplays: state.timerReplays,
      replayLoading: state.replayLoading,
      replayStorageError: state.replayStorageError,
      status: state.status,
      modelDownload: state.modelDownload,
      error: state.error,
      mediaError: state.mediaError,
      sourceName: state.sourceName,
      sourceFile: state.uploadedFile,
      timerReady: cameraReady() || canRecordFileOnly(),
      cameraRecordFileOnly: canRecordFileOnly(),
      cameraSwitchLocked: state.timerCapturePhase !== 'idle' || recordingBusy() || !!state.recordingReview,
      cameraConnecting: state.cameraConnecting,
      cameraRecordingPhase: recordingPhase(),
      cameraRecordingAttempt: recording && `${recording.id}:${recording.reviews ?? 0}`,
      cameraRecordingFile: recording?.file,
      cameraRecordingRetried: !!recording?.reviews,
      cameraRecordingRecovered: recording?.recovered,
      recordingReview: state.recordingReview,
      cameraRecordingError: recording?.error || state.cameraRecordingError || (recordingResult?.status === 'failed' ? recordingResult.message : undefined),
      cameraRecordingResult: recordingResult,
      cameraRecordingReplay: state.cameraRecordingReplay,
      sourceKind: state.sourceKind,
      running: state.running,
      playbackSpeed: state.playbackSpeed,
      sourceFps: state.sourceFps,
      clockFps: clockFps(),
      searchError: state.searchError,
      searchResult: state.searchResult,
      poseError: state.poseError,
      fps: state.fps,
      captureFps: state.captureFps,
      duration: state.duration,
      position: state.position,
      trimming: state.trimming,
      solveStart: state.solveStart,
      solveEnd: state.solveEnd,
      initialScramble: state.initialScramble,
      reconstructedScramble: reconstructedScramble(),
      cropLocked: state.cropLocked,
      cropLoading: state.cropLoading,
      cropPreview: state.cropPreview,
      sourceCrop: state.sourceCrop,
      videoSize: state.videoSize,
      presentedAspect: presenter.snapshot && stage.height ? stage.width / stage.height : undefined,
      thumbnails: state.thumbnails,
      showCameraPreview: derived.showCameraPreview,
      stream: state.stream,
      reconstructionComplete: derived.reconstructionComplete,
      fileReviewId: state.fileReviewId,
      videoInputComplete: state.videoInputComplete,
      liveReconstruction: liveReconstruction(),
      cubeSolved: derived.cubeSolved,
      coloredProjection: derived.coloredProjection,
      projectedTimeline: derived.projectedTimeline,
      measuredCubeTimeline: derived.cubeReplayTimelines?.measured,
      currentReviewIndex: reviewing ? derived.currentReviewIndex : -1,
      reviewLength: reviewing ? derived.reviewRows.length : 0,
      presentedTimestamp: state.presentedTimestamp,
      result: state.result,
    };
  }

  let view = getView();
  let displayedPoseFlagged = derived.displayedPoseFlagged;
  let displayedChoice = derived.reconstructionChoices.get(view.result?.fittedPose?.sourceFrame ?? -1);
  function publish() {
    publishPending = false;
    if (disposed) return;
    if (state.recordingReview) updateRecordingReview();
    const flagged = derived.displayedPoseFlagged;
    const choice = derived.reconstructionChoices.get(state.result?.fittedPose?.sourceFrame ?? -1);
    if (flagged !== displayedPoseFlagged || choice !== displayedChoice) {
      displayedPoseFlagged = flagged;
      displayedChoice = choice;
      redrawOverlay();
    }
    if (!state.reviewInitialized && state.sourceKind === 'video' && derived.reconstructionComplete && !state.trimming) {
      state.reviewInitialized = true;
      void requestReview(derived.reviewRows[0]?.timestamp ?? state.solveStart);
    }
    view = getView();
    listeners.forEach(listener => listener());
  }

  return {
    selectTab, camera, startTimerSolve, stopTimerSolve, deleteTimerSolve, clearTimerSession, openFile, stopSource, editCrop, applyCrop, closeCrop, changeTrim, previewSelection, stepPreview, beginReconstruction, editSolveRange, togglePlayback, changePlaybackSpeed, requestReview, seekReviewIndex, stepReview, downloadTimerDiagnostics, loadModel, cleanup, reviewKeydown,
    setPreviewFraming(crop: SourceCrop | null | undefined) {
      if (disposed) return;
      presenter.displayCropOverride = crop;
      presenter.redraw(stage, state.result && (state.showRoi || displayPose()) ? drawOverlay : undefined);
    },
    getTimerFrameProgress: (id: string) => timerReconstruction.frameProgress(id),
    isCapturingTimerTail: (id: string) => timerCaptureGate.capturingTail(id),
    readReviewPlaybackTime,
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    recordCamera, reviewCameraRecording, cancelRecordingReview: () => stopSource(), finishCameraRecording: () => finishCameraRecording(),
    reviewSimulatedCameraFile,
    setScramble: (value: string) => { state.initialScramble = value; },
    setTimerBusy: (value: boolean) => { state.timerBusy = value; },
    selectTimerReplay: (id?: string) => { timerReplayCache.select(id); },
  };
}

export type VideoWorkspace = ReturnType<typeof createVideoWorkspace>;
