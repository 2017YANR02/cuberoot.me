import { createVideoWorker } from "./worker-assets";
import type { SourceFrame } from "./frame-stream";
import type {CameraCaptureMetrics} from './camera-metrics';
import type { SimulatedVideoCamera } from './simulated-camera';

export type VideoCameraInput = MediaStream | SimulatedVideoCamera;
export function closeVideoCamera(input: VideoCameraInput) {
  if ('stream' in input) input.close();
  else input.getTracks().forEach(track => track.stop());
}

interface Processor {
  readable: ReadableStream<VideoFrame>;
  discardedFrames?: number;
}
type ProcessorConstructor = new (options: {
  track: MediaStreamTrack;
  maxBufferSize: number;
}) => Processor;
export type CameraStopReason='ended'|'error';

/** Request permission from the caller's click, before loading the detector. */
export async function requestVideoCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost.");
  return navigator.mediaDevices.getUserMedia({
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }),
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
}

export async function startCameraCapture(
  original: MediaStreamTrack,
  onFrame: (frame: SourceFrame & { clockOriginMs: number }) => void,
  onStopped: (message: string,reason:CameraStopReason) => void,
  onMetrics?: (metrics:CameraCaptureMetrics)=>void,
) {
  const worker = createVideoWorker("capture");
  const track = original.clone();
  let monitor: ReturnType<typeof setInterval> | undefined;
  let ended = false;
  let browserSkippedFrames=0;
  let metrics:CameraCaptureMetrics={captureFps:0,skippedFrames:0,browserSkippedFrames:0};
  const updateMetrics=(value:Partial<CameraCaptureMetrics>)=>{
    metrics={...metrics,...value,browserSkippedFrames:Math.max(value.browserSkippedFrames??0,browserSkippedFrames)};
    onMetrics?.(metrics);return metrics;
  };
  const stop = () => {
    ended = true;
    clearInterval(monitor);
    worker.terminate();
    track.stop();
  };
  const ready = new Promise<void>((resolve, reject) => {
    let started = false;
    let notified=false;
    worker.onmessage = ({ data }) => {
      if (ended) {
        data.bitmap?.close();
        return;
      }
      if (data.type === "started") {
        started = true;
        resolve();
      }
      if (data.type === "frame")
        onFrame({ bitmap: data.bitmap, timestamp: data.timestamp, clockOriginMs: data.clockOriginMs,captureMetrics:updateMetrics({...data.metrics,
          deliveryMs:Math.max(0,performance.timeOrigin+performance.now()-data.sentAtEpochMs)}) });
      if(data.type==='stats')updateMetrics(data.metrics);
      if (data.type === "stopped") {
        notified=true;
        if (!started) reject(new Error(data.message));
        else onStopped(data.message,data.reason??'error');
      }
      if (data.type === "ended") {
        clearInterval(monitor);
        if(!notified)onStopped('Camera stream ended.','ended');
      }
    };
    worker.onerror = () => {
      if (!started) reject(new Error("Camera frame capture could not start."));
      else
        onStopped(
          "Camera frame capture failed. Buffered frames will finish processing.",
          'error',
        );
    };
  });
  try {
    // Browsers expose TrackProcessor in different realms. Support both without
    // falling back to presentation callbacks, which may skip frames under load.
    const Constructor = (
      window as unknown as { MediaStreamTrackProcessor?: ProcessorConstructor }
    ).MediaStreamTrackProcessor;
    const sourceFps = original.getSettings().frameRate || 30;
    if (Constructor) {
      const processor = new Constructor({ track, maxBufferSize: 8 });
      const readable = processor.readable;
      worker.postMessage({ type: "start", readable, sourceFps }, [readable]);
      monitor = setInterval(() => {
        if ((processor.discardedFrames??0)>browserSkippedFrames) {
          browserSkippedFrames=processor.discardedFrames!;
          updateMetrics({});
        }
      }, 50);
    } else
      worker.postMessage({ type: "start", track, sourceFps }, [
        track as unknown as Transferable,
      ]);
    await ready;
    return {
      idle() {
        worker.postMessage({type:'idle'});
      },
      pause() {
        worker.postMessage({ type: "pause" });
      },
      resume(captureStart?: number) {
        worker.postMessage({ type: "resume", captureStart });
      },
      acknowledge() {
        if (!ended) worker.postMessage({ type: "ack" });
      },
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}
export type CameraCapture = Awaited<ReturnType<typeof startCameraCapture>>;
