import { FramePresenter } from "./engine/frame-presenter";
import { compactDetectionCapture } from "./engine/diagnostic-capture";
import { DetectionRecording } from "./engine/detection-recording";
import type { RecordingContext } from "./engine/detection-recording";
import type {
  FrameResult,
  ModelManifest,
  Settings,
  WorkerRequest,
  WorkerResponse,
} from "./engine/detector";
import { FrameQueue, openVideoFile } from "./engine/frame-stream";
import type { SourceFrame, VideoFileSource } from "./engine/frame-stream";
import { startCameraCapture } from "./engine/camera-source";
import type { CameraCapture } from "./engine/camera-source";
import { PoseFitter } from "./engine/pose-fitter";
import type { FittedPose } from "./engine/pose-types";
import { OrderedStage } from "./engine/ordered-stage";
import { VideoResultCache, videoResultKey } from "./engine/video-result-cache";
import type { SavedVideoResult } from "./engine/video-result-cache";
import { MoveSearch } from "./engine/move-search";
import type { MoveSearchResult } from "./engine/move-search-types";
import { trimRange } from "./engine/solve-range";
import { projectedWireframe, poseIsFlagged } from "./engine/reconstruction-view";
import { buildColorTimeline } from "./engine/cube-colors";
import { buildCubeReplayTimelines, measuredCubeFrame, projectedCubeAtFrame } from "./engine/projected-cube";
import { reviewIndex, steppedTimestamp, frameArrow } from "./engine/frame-review";
import { PLAYBACK_SPEEDS, playbackTiming } from "./engine/playback-timing";
import type { PlaybackSpeed } from "./engine/playback-timing";
import {createSearchConfig,ADMISSION_CAPACITY,poseWorkerCount,POLICY_VERSION,CAMERA_CLOCK_HZ} from "./pose-fitter/runtime/reconstruction-policy.mjs";
import { TimerReconstruction } from './engine/timer-reconstruction';
import type { TimerReconstructionResult } from './engine/cube-timer';
import { TimerDiagnostics } from './engine/timer-diagnostics';
import type {CameraCaptureMetrics} from './engine/camera-metrics';
import {TimerReplayStore,replayReconstruction,type TimerReplay} from './engine/timer-replay';
import {LocalReplayStorage,TimerReplayCache} from './engine/timer-replay-cache';
import {TimerCaptureGate} from './engine/timer-capture';
import {hasWebGpuAdapter} from './engine/runtime-config';
import {cropPixels} from './engine/source-crop';
import type {SourceCrop, PixelCrop} from './engine/source-crop';
import { createVideoWorker, VIDEO_RECON_ASSETS } from './engine/worker-assets';
import type { RunMetadata } from './engine/run-provenance';

export type WorkspaceTab = 'detector' | 'timer';

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
  const state = new Proxy({
    activeTab: initialTab,
    timerBusy: false,
    timerCamera: false,
    cameraClockOriginMs: undefined as number | undefined,
    timerReconstructions: {} as Record<string, TimerReconstructionResult>,
    timerReplays: {} as Record<string,TimerReplay>,
    latestTimerSolveId: undefined as string | undefined,
    latestReplayPosition: undefined as number | undefined,
    latestTimerReplay: undefined as TimerReplay | undefined,
    latestReplaySeek: undefined as {timestamp:number;revision:number} | undefined,
    replayLoading: false,
    replayStorageError: '',
    timerCapturePhase: 'idle' as 'idle'|'capturing'|'draining',
    manifest: undefined as ModelManifest | undefined,
    status: "loading" as "loading" | "ready" | "error",
    modelProgress: undefined as number | undefined,
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
    trimming: false,
    solveStart: 0,
    solveEnd: 0,
    uploadedFile: undefined as File | undefined,
    sourceCrop: undefined as SourceCrop | undefined,
    cropLocked: false,
    cropLoading: false,
    cropPreview: undefined as {url: string; width: number; height: number; kind: 'image' | 'video'} | undefined,
    thumbnails: [] as string[],
    reviewInitialized: false,
    captureFps: 0,
    savedFrames: 0,
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


  let latestReplaySeekRevision=0;

  function seekLatestTimerReplay(id:string,timestamp:number){
    if(id!==state.latestTimerSolveId||!state.latestTimerReplay)return false;
    state.latestReplaySeek={timestamp,revision:++latestReplaySeekRevision};return true;
  }

  const timerReplayCache=new TimerReplayCache(new LocalReplayStorage(),(clip,loading=false,error='')=>{
    state.timerReplays=clip?{[clip.id]:clip}:{};state.replayLoading=loading;state.replayStorageError=error;
  });
  const timerReplayStore=new TimerReplayStore(clip=>{
    timerReplayCache.publish(clip);
    if(clip.id===state.latestTimerSolveId)state.latestTimerReplay=clip;
  });
  const timerCaptureGate=new TimerCaptureGate();
  const archivedDiagnostics = new Map<string, Promise<Blob>>();

  const timerReconstruction = new TimerReconstruction(
    (config, onResult, onError, id) => {
      const search = new MoveSearch(baseUrl, config, (value, ended) => {
        timerDiagnostics.search(id, config, value, search.actions, ended);
        onResult(value, ended);
      }, onError);
      return search;
    },
    (id, value) => { state.timerReconstructions = { ...state.timerReconstructions, [id]: timerDiagnostics.update(id, value) }; },
    id=>{
      const playback=replayReconstruction(state.timerReconstructions[id]);
      timerReplayCache.finish(id, playback);
      state.timerReconstructions = { ...state.timerReconstructions, [id]: playback };
      if (disposed) return;
      const pending = timerDiagnosticBlob(id);
      archivedDiagnostics.set(id, pending);
      void pending.then(async () => {
        if (disposed || archivedDiagnostics.get(id) !== pending) return;
        await timerDiagnostics.finish(id);
        state.savedFrames = recording.length;
      }).catch(() => {
        if (archivedDiagnostics.get(id) === pending) archivedDiagnostics.delete(id);
      });
    });
  function selectTab(tab: WorkspaceTab) {
    if (state.timerBusy || tab === state.activeTab) return;
    if (tab === 'timer') {
      if (state.sourceKind !== 'none' && state.sourceKind !== 'camera') stopSource();
      moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = '';
      activeRunId = undefined;
      if (state.sourceKind === 'camera') state.timerCamera = true;
    }
    if (tab === 'detector' && (state.timerCamera || state.sourceKind === 'camera')) stopSource();
    state.activeTab = tab;
  }
  function startTimerSolve(id: string, scramble: string, clockMs: number) {
    if (state.cameraClockOriginMs === undefined) return;
    const config = timerReconstruction.start(id, scramble, (clockMs - state.cameraClockOriginMs) / 1000, state.sourceFps || 30, state.searchDiagnostics);
    state.latestTimerSolveId=id;state.latestTimerReplay=undefined;state.latestReplayPosition=undefined;state.latestReplaySeek=undefined;
    timerReplayCache.begin(id);
    timerReplayStore.start(id,config.requested_start_seconds!,config.fps);
    timerCaptureGate.start(id,config.requested_start_seconds!);state.timerCapturePhase='capturing';capture?.resume();
    const runId = timerDiagnostics.start(id, generation, config, {
      policyVersion: POLICY_VERSION, appOrigin: location.origin, poseWorkers: poseWorkerCount(navigator.hardwareConcurrency),
      admissionCapacity: ADMISSION_CAPACITY,
      detector: { poseSize: size, backend, preprocessing: detectorPreprocessing, settings: settings(), models: detectorIdentity },
      timer: { solveId: id, startClockMs: clockMs, cameraClockOriginMs: state.cameraClockOriginMs },
    });
    if (config.diagnostics !== false) void recording.setFingerprints(runId, runtimeFingerprints()).catch(() => {});
    state.timerReconstructions = { ...state.timerReconstructions, [id]: { status: 'collecting', diagnosticRunId: runId } };
  }
  function stopTimerSolve(id: string, clockMs: number) {
    if (state.cameraClockOriginMs !== undefined) {
      const timestamp=(clockMs-state.cameraClockOriginMs)/1000;
      timerReconstruction.stop(id,timestamp);timerReplayStore.stop(id,timestamp);
      timerCaptureGate.stop(id,timestamp);
    }
  }
  function deleteTimerSolve(id:string){
    if(state.latestTimerSolveId===id){state.latestTimerSolveId=undefined;state.latestTimerReplay=undefined;state.latestReplayPosition=undefined;state.latestReplaySeek=undefined;}
    archivedDiagnostics.delete(id);
    timerReconstruction.cancelSolve(id);timerReplayStore.remove(id);timerReplayCache.remove(id);
    void timerDiagnostics.forget(id).catch(error=>{state.mediaError=String(error);});
    const remaining={...state.timerReconstructions};delete remaining[id];state.timerReconstructions=remaining;
  }
  function clearTimerSession(ids:string[]){
    state.latestTimerSolveId=undefined;state.latestTimerReplay=undefined;state.latestReplayPosition=undefined;state.latestReplaySeek=undefined;
    timerReconstruction.cancel('Session cleared');timerReplayStore.clear();timerReplayCache.clear();
    archivedDiagnostics.clear();
    for (const id of ids) { timerReplayCache.remove(id); void timerDiagnostics.forget(id); }
    state.timerReconstructions={};
  }


  const size = 256;
  const backend = "webgpu";
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
  let seekVersion = 0;
  let seekResume = false,
    seeking = false;


  let fileEnded = false;
  type CameraEnd={timerEnd:true;id:string;timestamp:number;close():void};
  type CameraFrame=SourceFrame&{close():void;timerReset?:boolean};
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
  const poseFittingOptions = () => state.timerCamera ? {scramble:'',turningStartFrame:null,originSeconds:0,camera:true} : ({scramble:moveSearch?.config.scramble ?? state.initialScramble.trim(),
    camera:state.sourceKind==='camera',
    turningStartFrame:moveSearch ? moveSearch.config.turning_start_frame : state.openingHoldSeconds>0 ? Math.floor((searchOriginTimestamp+state.openingHoldSeconds)*(state.sourceKind==='camera'?CAMERA_CLOCK_HZ:state.sourceFps||30)) : null,
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
    if (state.timerCamera || state.activeTab === 'timer' || !state.searchEnabled || state.sourceKind === "none") return;
    if (!state.initialScramble.trim()) { state.searchError = "Enter the initial scramble to start move search."; return; }
    if(state.searchCleanup&&(!Number.isFinite(state.searchCleanupTolerance)||state.searchCleanupTolerance<0||state.searchCleanupTolerance>1)){
      state.searchError="Cleanup color tolerance must be between 0 and 1.";return;
    }
    const token = generation;
    const config = createSearchConfig({scramble:state.initialScramble,fps:state.sourceFps||30,camera:state.sourceKind==='camera',
      openingHoldSeconds: state.openingHoldSeconds,diagnostics:state.searchDiagnostics,bidirectional:state.searchBidirectional&&state.sourceKind==="video",originSeconds:state.sourceKind==="video"?searchOriginTimestamp:0,
      postprocessIdentityLoops:state.searchCleanup,postprocessColorTolerance:state.searchCleanup?state.searchCleanupTolerance:0.08,
      startSeconds:state.sourceKind==="video"?state.solveStart:undefined,endSeconds:state.sourceKind==="video"?state.solveEnd:undefined});
    const runId=recording.startRun(token,config,{policyVersion:POLICY_VERSION,appOrigin:location.origin,
      poseWorkers:poseWorkerCount(navigator.hardwareConcurrency),admissionCapacity:ADMISSION_CAPACITY,
      detector:{poseSize:size,backend,preprocessing:detectorPreprocessing,settings:settings(),models:detectorIdentity}});
    activeRunId=runId;
    if(config.diagnostics!==false)void recording.setFingerprints(runId,runtimeFingerprints()).catch(()=>{});
    moveSearch = new MoveSearch(baseUrl, config, (value) => {
      if (token !== generation || disposed) return;
      const wasSolved=state.searchResult?.status==="solved"||state.searchResult?.status==="already_solved";
      state.searchResult = value; recording.saveSearch(token, config, value,runId,moveSearch?.actions);
      if(!wasSolved&&(value.status==="solved"||value.status==="already_solved")){
        state.running=false;seekResume=false;refreshPending=false;cancelScheduled();
        if(state.sourceKind==="video")fileEnded=true;
        if(state.sourceKind==="camera"){
          state.captureStopped=true;capture?.stop();capture=undefined;
          state.stream?.getTracks().forEach(track=>track.stop());state.stream=undefined;
          cameraQueue.clear();state.queuedFrames=0;
        }
        void finishMoveSearch();
      }
    }, message => { if (token === generation) {
      state.searchError = message;
      if(state.sourceKind === 'video'){
        state.running=false;seekResume=false;state.videoInputComplete=true;fileEnded=true;cancelScheduled();
      }
      recording.saveError(runId,message,moveSearch?.actions??[]);
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
    if (state.timerCamera && state.captureStopped) {timerReplayStore.closeInput();timerReconstruction.closeInput();}
    if (state.sourceKind === "video") state.videoInputComplete = true;
    try { await activeSearch?.end(); } catch (cause) { if (token === generation) state.searchError = cause instanceof Error ? cause.message : String(cause); }
  }
  function seedCachedSearch() {
    const rows = videoResults.entries(currentCacheKey(true));
    const target = Math.min(30, state.sourceFps || 30), origin = searchOriginTimestamp;
    let count = 0, last: SavedVideoResult | undefined;
    for (const row of rows) {
      if (row.timestamp < origin - 0.00001 || row.timestamp >= state.solveEnd) continue;
      const offset = state.sourceFps > 30.001 ? Math.ceil(count * state.sourceFps / target - 0.0001) : count;
      const expected = origin + offset / (state.sourceFps || 30);
      if (row.timestamp < expected - 0.00001) continue;
      if (row.timestamp > expected + 0.00001 || !row.result.fittedPose) break;
      if(activeRunId)recording.linkCachedFrame(activeRunId,row.timestamp,row.result);
      moveSearch?.submit(row.timestamp, row.result, Promise.resolve(row.result.fittedPose)); count++; last = row;
    }
    return { last, complete: count >= Math.ceil((state.solveEnd - origin) * target - 0.00001) };
  }
  function inputCrop(source: HTMLImageElement | ImageBitmap | OffscreenCanvas) {
    if (state.sourceKind === 'camera') return;
    return cropPixels(state.sourceCrop, source instanceof HTMLImageElement ? source.naturalWidth : source.width,
      source instanceof HTMLImageElement ? source.naturalHeight : source.height);
  }
  function closeCrop() {
    if (state.cropPreview) URL.revokeObjectURL(state.cropPreview.url);
    state.cropPreview = undefined;
  }
  async function editCrop() {
    if (!state.uploadedFile || state.cropLocked || state.cropLoading || (state.sourceKind === 'video' && !state.trimming)) return;
    const token = generation;
    state.running = false; seekResume = false; cancelScheduled(); state.cropLoading = true;
    let frame: SourceFrame | null | undefined;
    try {
      await waitForPipelineIdle();
      if (token !== generation || disposed) return;
      const kind = state.sourceKind;
      if (kind !== 'image' && kind !== 'video') return;
      const source = kind === 'image' ? still : (frame = await fileSource?.preview(state.position))?.bitmap;
      if (!source) throw new Error('A source frame could not be loaded for cropping.');
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      const scale = Math.min(1, 1280 / Math.max(width, height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({type: 'image/png'});
      if (token !== generation || disposed) return;
      closeCrop(); state.cropPreview = {url: URL.createObjectURL(blob), width, height, kind};
    } catch (cause) {
      if (token === generation) state.mediaError = cause instanceof Error ? cause.message : String(cause);
    } finally {frame?.bitmap.close(); if (token === generation) state.cropLoading = false;}
  }
  async function applyCrop(crop: SourceCrop | undefined) {
    if (!state.uploadedFile || state.cropLocked) return;
    const file = state.uploadedFile;
    const range = state.sourceKind === 'video' ? {start: state.solveStart, end: state.solveEnd} : undefined;
    closeCrop();
    // Reopen as a new input generation: discard tracking, fitting and cached
    // results from the old crop before any new cropped frame can be admitted.
    await openFile(file, crop, range);
  }
  let pendingPreview: { timestamp: number; direction?: -1 | 1 } | undefined;
  let previewing = false;
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
    if (state.searchEnabled && !state.initialScramble.trim()) { state.searchError = "Enter the initial scramble."; return; }
    state.cropLocked = true;
    const token = generation; state.mediaError = ""; previewVersion++; busy = true;
    try {
      fileSource.seek(state.solveStart); const frame = await fileSource.next();
      if (!frame) throw new Error("There are no video frames in this solve range.");
      if (token !== generation || disposed) { frame.bitmap.close(); return; }
      if (frame.timestamp >= state.solveEnd) { frame.bitmap.close(); throw new Error("There are no video frames in this solve range."); }
      searchOriginTimestamp = frame.timestamp; startMoveSearch();
      // Existing completed fits can be prepared immediately, even while the
      // viewer has not yet presented those cached frames again.
      const cached = seedCachedSearch();
      state.trimming = false; state.videoInputComplete = false; fileEnded = false; state.running = true;
      state.reviewInitialized = false;
      resetTracking = true; resetPose = true; seekVersion++; state.processedFrames = 0; state.fps = 0;
      lastResultTime = 0; previousFrameStart = 0; lastStarted = performance.now(); acquireMs = 0; pacingMs = 0;
      const firstSaved = findSavedResult(frame.timestamp);
      if (cached.complete && firstSaved?.result.fittedPose) {
        presentSavedFrame(frame.bitmap, firstSaved); markIdle(); state.running = false; fileEnded = true;
        void finishMoveSearch(); return;
      }
      admitFrame(frame);
    } catch (cause) { if (token === generation) { markIdle(); state.mediaError = cause instanceof Error ? cause.message : String(cause); } }
  }
  async function editSolveRange() {
    if (!derived.reconstructionComplete) return;
    state.running = false; cancelScheduled(); await waitForPipelineIdle();
    moveSearch?.dispose(); moveSearch = undefined; state.searchResult = undefined; state.searchError = "";
    state.previewSearch = undefined;
    state.trimming = true; state.videoInputComplete = false; await previewTrim(state.solveStart);
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
    updateSearchPressure();
    if(!inferenceAllowed())refreshPending=false;
    if (!busy && (refreshPending || !state.running || state.status !== "ready")) void flushPose();
    if (refreshPending && !busy && !completionQueue.size && !seeking && state.status === "ready") {
      refreshPending = false;
      void inferFrame();
    } else scheduleNext();
  }
  function updateSearchPressure(){
    if(!state.timerCamera||state.queuedFrames<=2)timerReconstruction.setBackpressure(false);
    else if(state.queuedFrames>=8)timerReconstruction.setBackpressure(true);
  }
  async function completeFrame(packet: DetectedFrame | CachedFrame | TimerEnd) {
    if('timerEnd' in packet){
      if(packet.generation===generation&&!disposed){
        timerReplayStore.finishThrough(packet.timestamp);timerReconstruction.finishThrough(packet.timestamp);
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
            poseFitter?.dispose();
            poseFitter = undefined;
            resetPose = true;
          }
        }
      }
    }
    if (token !== generation || disposed) return;
    const overlayStart = performance.now();
    presenter.presentFrame(stage, completed.snapshot, state.showRoi || displayPose()
      ? (context, width, height) => drawOverlay(context, width, height, packet.result) : undefined);
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
    const retainDetection = completed.recording.sourceKind !== 'camera' || !state.timerCamera || timerReconstruction.includes(completed.timestamp);
    if (retainDetection && (completed.counted || completed.recording.sourceKind === "image" || completed.recording.sourceKind === "video")) {
      const sequence = recording.append(packet.result, completed.recording);
      if (completed.camera && state.timerCamera) {
        for (const id of timerReconstruction.solveIds(completed.timestamp)) timerDiagnostics.frame(id, sequence);
      }
      state.savedFrames = recording.length;
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

  async function loadModel() {
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
    if (backend === "webgpu" && !window.isSecureContext) {
      state.error =
        "Open this app over HTTPS or localhost to use WebGPU and the camera.";
      state.status = "error";
      return;
    }
    if (backend === "webgpu" && !("gpu" in navigator)) {
      state.error =
        "WebGPU is required. Open this app in a browser that supports WebGPU.";
      state.status = "error";
      return;
    }
    state.modelProgress = undefined;
    try {
      if (backend === "webgpu") {
        const available = await hasWebGpuAdapter(navigator.gpu);
        if (disposed || request !== modelGeneration) return;
        if (!available) throw new Error("WebGPU is unavailable on this device or browser.");
      }
      if (disposed || request !== modelGeneration) return;
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
      currentWorker.onmessage = async ({ data }: MessageEvent<WorkerResponse>) => {
        if (currentWorker !== worker) return;
        if (data.type === "progress") {
          const bboxBytes = state.manifest?.bbox.bytes ?? 0;
          const poseBytes = state.manifest?.variants.find(variant => variant.size === size)?.bytes ?? 0;
          const bytes = data.stage === 'Cube detector' ? bboxBytes * data.fraction : bboxBytes + poseBytes * data.fraction;
          state.modelProgress = Math.round(bytes / Math.max(1, bboxBytes + poseBytes) * 100);
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
          state.status = "error";
          state.error = data.message;
          capture?.pause();
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
                  completed.timestamp, completed.recording.sourceFps, poseFittingOptions()).finally(() => {
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
        state.status = "error";
        state.error = "The detector worker could not start. Reload the detector.";
        capture?.pause();
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
    closeCrop(); state.uploadedFile = undefined; state.sourceCrop = undefined; state.cropLocked = false; state.cropLoading = false;
    timerCaptureGate.clear();state.timerCapturePhase='idle';
    timerReplayStore.closeInput();
    timerReconstruction.closeInput('Camera disconnected before the complete solve window was processed');
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
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = undefined;
    fileSource?.close();
    fileSource = undefined;
    videoResults.clear();
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

  async function camera() {
    stopSource();
    state.timerCamera = state.activeTab === 'timer';
    state.mediaError = "";
    const token = generation;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access requires HTTPS or localhost.");
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (token !== generation || disposed) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
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
          let timerReset=false;
          if(state.timerCamera){
            const admission=timerCaptureGate.admit(frame.timestamp);
            if(admission.type!=='frame'){
              frame.bitmap.close();capture?.acknowledge();
              if(admission.type==='end'){
                capture?.idle();state.timerCapturePhase='draining';
                cameraQueue.push({timerEnd:true,id:admission.id,timestamp:admission.timestamp,close(){}});
                state.queuedFrames=cameraQueue.length;scheduleNext();
              }else if(state.timerCapturePhase==='idle')capture?.idle();
              return;
            }
            timerReset=admission.reset;
          }
          cameraQueue.push({ ...frame,timerReset, close: () => frame.bitmap.close() });
          state.queuedFrames = cameraQueue.length;
          updateSearchPressure();
          scheduleNext();
        },
        (message) => {
          if (token !== generation || disposed) return;
          state.captureStopped = true;
          state.stream?.getTracks().forEach((track) => track.stop());
          if (message) state.mediaError = message;
          if (!cameraQueue.length && !busy) state.running = false;
        },
        metrics=>{if(token===generation&&!disposed){state.captureFps=metrics.captureFps;}},
      );
      if (token !== generation || disposed) {
        activeCapture.stop();
        return;
      }
      capture = activeCapture;
      state.sourceKind = "camera";
      state.sourceName = "Camera";
      startMoveSearch();
      state.running = true;
      scheduleNext();
    } catch (cause) {
      if (token !== generation) return;
      capture?.stop();
      state.stream?.getTracks().forEach((track) => track.stop());
      state.stream = undefined;
      state.mediaError =
        cause instanceof Error ? cause.message : "Unable to open the camera.";
    }
  }

  async function openFile(file?: File, crop?: SourceCrop, range?: {start: number; end: number}) {
    if (!file || disposed) return;
    stopSource();
    state.uploadedFile = file; state.sourceCrop = crop;
    state.mediaError = "";
    const token = generation;
    recording.setSourceFile(token,file);
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
      } else if (file.type.startsWith("video/")) {
        const decoded = await openVideoFile(file);
        if (token !== generation || disposed) {
          decoded.close();
          return;
        }
        fileSource = decoded;
        state.duration = decoded.duration;
        state.sourceFps = decoded.sourceFps;
        state.sourceKind = "video";
        state.sourceName = file.name;
        state.solveStart = Math.max(0, Math.min(range?.start ?? 0, state.duration));
        state.solveEnd = Math.max(state.solveStart, Math.min(range?.end ?? state.duration, state.duration)); state.trimming = true;
        await previewTrim(state.solveStart); void makeThumbnails(token);
      } else throw new Error("Choose an image or a video file.");
    } catch (cause) {
      if (token === generation)
        state.mediaError =
          cause instanceof Error ? cause.message : "Unable to read this file.";
    }
  }

  function dispatch(bitmap: ImageBitmap, timestamp: number, counted: boolean,captureMetrics?:CameraCaptureMetrics, crop?:PixelCrop) {
    // Recheck after asynchronous decoding/bitmap creation: search can finish
    // while a frame is being acquired, before it reaches the neural worker.
    if(!inferenceAllowed()){
      bitmap.close();markIdle();continuePipeline();return;
    }
    const drawStart = performance.now();
    const snapshot = presenter.captureFrame(bitmap, crop);
    const sentAt = performance.now();
    const appliedSettings = settings();
    currentFrame = {
      snapshot,
      generation,
      fitPose: needsPose(),
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
      cacheKey: videoResultKey(size, backend, appliedSettings, needsPose(), poseFittingOptions()),
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
    }
  }
  function admitFrame(frame: SourceFrame) {
      const crop = inputCrop(frame.bitmap);
      const saved = state.sourceKind === "video" ? findSavedResult(frame.timestamp) : undefined;
      if (saved) {
        if (saved.result.fittedPose) moveSearch?.submit(saved.timestamp, saved.result, Promise.resolve(saved.result.fittedPose));
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
      } else dispatch(frame.bitmap, frame.timestamp, true,frame.captureMetrics, crop);
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
    // Camera timestamps already pace frame admission. Drain its FIFO as fast as
    // inference/backpressure permit, so short UI stalls can be caught up.
    const interval = state.sourceKind==='camera'?0:playbackTiming(state.sourceFps,state.sourceKind==="video"&&derived.reconstructionComplete?state.playbackSpeed:1).frameIntervalMs;
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
    const sourceFrame = frame.fittedPose.sourceFrame ?? Math.round(state.position * state.sourceFps);
    if (poseIsFlagged(frame.fittedPose,derived.reconstructionFlags.get(sourceFrame))) return [];
    const staticEnd = moveSearch?.config.turning_start_frame;
    return projectedWireframe(frame.fittedPose, derived.reconstructionChoices.get(sourceFrame),
      staticEnd != null && sourceFrame <= staticEnd);
  }
  function drawOverlay(
    ctx: OffscreenCanvasRenderingContext2D,
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
  async function downloadDetections() {
    if (!recording.length) return;
    try { await recording.readyAll(); }
    catch (cause) { state.mediaError = `Unable to prepare diagnostic metadata: ${String(cause)}`; return; }
    const blob = new Blob(
      [
        JSON.stringify({
          ...compactDetectionCapture(recording.toJSON()),
          model: state.manifest,
        }),
      ],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cube-detections.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  function stepReview(direction:-1|1) {
    if(state.sourceKind!=="video"||!derived.reconstructionComplete||state.trimming)return;
    const timestamp=steppedTimestamp(derived.reviewRows,requestedReviewTimestamp??state.presentedTimestamp,direction);
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
    const saved = findSavedResult(timestamp, 0.5 / Math.min(30, state.sourceFps || 30) + 0.001);
    fileSource.seek(saved?.timestamp ?? timestamp);
    state.position = saved?.timestamp ?? timestamp;
    state.processedFrames = 0;
    lastResultTime = 0;
    lastStarted = -Infinity;
    previousFrameStart = 0;
    state.fps = 0;
    fileEnded = false;
    resetTracking = true;
    resetPose = true;
    if (saved) {
      busy = true;
      try {
        const frame = await fileSource.next();
        if (token !== generation || request !== seekVersion || !fileSource) { frame?.bitmap.close(); return; }
        if (frame && Math.abs(frame.timestamp - saved.timestamp) < 0.00001) {
          if (saved.result.fittedPose) moveSearch?.submit(saved.timestamp, saved.result, Promise.resolve(saved.result.fittedPose));
          presentSavedFrame(frame.bitmap, saved);
        }
        else {
          frame?.bitmap.close();
          fileSource.seek(timestamp);
          throw new Error("The saved frame could not be decoded at its original timestamp.");
        }
      } catch (cause) {
        if (token === generation && request === seekVersion) state.mediaError = cause instanceof Error ? cause.message : String(cause);
      } finally { if (token === generation) markIdle(); }
      if (token !== generation || request !== seekVersion) return;
      state.running = seekResume; seeking = false; scheduleNext();
      return;
    }
    // Display/process the first selected frame at the seek point even when paused.
    state.running = true;
    await processNext();
    if (request !== seekVersion) return;
    state.running = seekResume;
    seeking = false;
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
    if (state.sourceKind === "video" &&
      (fileEnded || state.presentedTimestamp === derived.reviewRows.at(-1)?.timestamp)) {
      await seekFile(state.solveStart);
    }
    state.running = true;
    lastResultTime = 0;
    capture?.resume();
    scheduleNext();
  }
  function changePlaybackSpeed(speed: number) {
    if(!PLAYBACK_SPEEDS.includes(speed as PlaybackSpeed))return;
    state.playbackSpeed=speed as PlaybackSpeed;
    cancelScheduled();scheduleNext();
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    closeCrop();
    timerReconstruction.cancel('Page closed before reconstruction finished');
    timerReplayStore.clear();timerReplayCache.clear();state.latestTimerReplay=undefined;
    timerCaptureGate.clear();
    archivedDiagnostics.clear();
    generation++;
    cancelScheduled();
    previewVersion++; state.thumbnails.forEach(url => URL.revokeObjectURL(url));
    capture?.stop();
    cameraQueue.clear();
    fileSource?.close();
    worker?.terminate();
    poseFitter?.dispose();
    moveSearch?.dispose();
    completionQueue.clear();
    state.stream?.getTracks().forEach((track) => track.stop());
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

  function liveReconstruction() {
    if (state.sourceKind !== 'video' || state.trimming || derived.reconstructionComplete || !moveSearch) return;
    const { fps, scramble, turning_start_frame } = moveSearch.config;
    const search = state.previewSearch ?? state.searchResult;
    const { steps, colors } = previewMetadata(search, scramble);
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
    return { steps, timestamp, cube };
  }

  const derived = {
    get latestReplayReconstruction() {
      const id = state.latestTimerSolveId;
      return id ? state.timerReconstructions[id] ?? state.latestTimerReplay?.reconstruction : undefined;
    },
    get reconstructionChoices() { return searchMetadata(state.searchResult, moveSearch?.config.scramble ?? '').choices; },
    get reconstructionFlags() { return searchMetadata(state.searchResult, moveSearch?.config.scramble ?? '').flags; },
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
        state.result?.fittedPose?.sourceFrame ?? Math.round(state.presentedTimestamp * state.sourceFps)));
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
      return projection(derived.reviewRows, searchMetadata(state.searchResult, moveSearch?.config.scramble ?? '').colors,
        state.sourceFps, derived.cubeSolved, state.searchResult, moveSearch?.config.turning_start_frame);
    },
    get projectedTimeline() { return derived.cubeReplayTimelines?.projected ?? []; },
    get coloredProjection() {
      return projectedCubeAtFrame(derived.projectedTimeline,
        state.result?.fittedPose?.sourceFrame ?? Math.round(state.presentedTimestamp * state.sourceFps));
    },
    get showCameraPreview() { return state.sourceKind === 'camera' && state.timerCamera && state.timerCapturePhase === 'idle' && !state.captureStopped; },
  };
  function getView() {
    const reviewing = derived.reconstructionComplete && !state.trimming;
    return {
      activeTab: state.activeTab,
      timerBusy: state.timerBusy,
      timerBuffering: derived.timerBuffering,
      timerReconstructions: state.timerReconstructions,
      timerReplays: state.timerReplays,
      latestTimerReplay: state.latestTimerReplay,
      latestReplayReconstruction: derived.latestReplayReconstruction,
      latestReplayPosition: state.latestReplayPosition,
      latestReplaySeek: state.latestReplaySeek,
      replayLoading: state.replayLoading,
      replayStorageError: state.replayStorageError,
      status: state.status,
      modelProgress: state.modelProgress,
      error: state.error,
      mediaError: state.mediaError,
      sourceName: state.sourceName,
      timerReady: state.sourceKind === "camera" && state.running && !state.captureStopped && state.status === "ready" && state.cameraClockOriginMs !== undefined,
      sourceKind: state.sourceKind,
      running: state.running,
      playbackSpeed: state.playbackSpeed,
      sourceFps: state.sourceFps,
      searchError: state.searchError,
      searchResult: state.searchResult,
      poseError: state.poseError,
      savedFrames: state.savedFrames,
      fps: state.fps,
      captureFps: state.captureFps,
      duration: state.duration,
      position: state.position,
      trimming: state.trimming,
      solveStart: state.solveStart,
      solveEnd: state.solveEnd,
      initialScramble: state.initialScramble,
      reconstructedScramble: moveSearch?.config.scramble ?? '',
      cropLocked: state.cropLocked,
      cropLoading: state.cropLoading,
      cropPreview: state.cropPreview,
      sourceCrop: state.sourceCrop,
      thumbnails: state.thumbnails,
      showCameraPreview: derived.showCameraPreview,
      stream: state.stream,
      reconstructionComplete: derived.reconstructionComplete,
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
    selectTab, camera, startTimerSolve, stopTimerSolve, deleteTimerSolve, clearTimerSession, seekLatestTimerReplay, openFile, stopSource, editCrop, applyCrop, closeCrop, changeTrim, previewSelection, stepPreview, beginReconstruction, editSolveRange, togglePlayback, changePlaybackSpeed, requestReview, seekReviewIndex, stepReview, downloadDetections, downloadTimerDiagnostics, loadModel, cleanup, reviewKeydown,
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setScramble: (value: string) => { state.initialScramble = value; },
    setTimerBusy: (value: boolean) => { state.timerBusy = value; },
    selectTimerReplay: (id?: string) => { timerReplayCache.select(id); },
    setLatestReplayPosition: (value: number) => { state.latestReplayPosition = value; },
  };
}

export type VideoWorkspace = ReturnType<typeof createVideoWorkspace>;
