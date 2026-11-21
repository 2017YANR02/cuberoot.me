import { FrameSelector } from "./frame-stream";
import {CameraFrameRate,CameraFrameBuffer} from './camera-metrics';

interface Processor {
  readable: ReadableStream<VideoFrame>;
  discardedFrames?: number;
}
type ProcessorConstructor = new (options: {
  track: MediaStreamTrack;
  maxBufferSize: number;
}) => Processor;
interface CaptureScope {
  MediaStreamTrackProcessor?: ProcessorConstructor;
  onmessage: (event: MessageEvent) => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}
const scope = self as unknown as CaptureScope;
let paused = false, stopped = false, resetRate=false, processing=true;
const buffer=new CameraFrameBuffer();
let track: MediaStreamTrack | undefined;
let reader: ReadableStreamDefaultReader<VideoFrame> | undefined;
let canvas: OffscreenCanvas | undefined;

scope.onmessage = async ({ data }) => {
  if (data.type === "ack") {
    buffer.acknowledge();
    return;
  }
  if (data.type === "pause") {
    paused = true;
    return;
  }
  if(data.type==='idle'){
    processing=false;
    return;
  }
  if (data.type === "resume") {
    paused = false;processing=true;resetRate=true;
    return;
  }
  if (data.type !== "start") return;
  track = data.track;
  try {
    let processor: Processor | undefined;
    if (data.readable)
      reader = (data.readable as ReadableStream<VideoFrame>).getReader();
    else {
      const Constructor = scope.MediaStreamTrackProcessor;
      if (!Constructor || !track)
        throw new Error(
          "This browser does not support frame-preserving camera capture. Use a supported Chromium browser or open a video file.",
        );
      processor = new Constructor({ track, maxBufferSize: 8 });
      reader = processor.readable.getReader();
    }
    const selector = new FrameSelector(data.sourceFps || 30);
    const rate=new CameraFrameRate();let lastStats=-Infinity;
    let firstTimestamp: number | undefined;
    let clockOriginMs: number | undefined;
    scope.postMessage({ type: "started" });
    while (!stopped) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      try {
        if (paused || !selector.accept(frame.timestamp / 1e6)) continue;
        firstTimestamp ??= frame.timestamp;
        // Anchor once at capture, before bitmap transfer or inference queues.
        // timeOrigin makes this clock comparable across worker/window realms.
        clockOriginMs ??= performance.timeOrigin + performance.now();
        const timestamp=(frame.timestamp-firstTimestamp)/1e6;
        if(resetRate){rate.reset();resetRate=false;}
        const captureFps=rate.observe(timestamp);
        if(!processing){
          if(timestamp-lastStats>=.5){lastStats=timestamp;scope.postMessage({type:'stats',metrics:{captureFps,
            skippedFrames:buffer.skipped,browserSkippedFrames:processor?.discardedFrames??0}});}
          continue;
        }
        if(!buffer.admit(timestamp)){
          if(timestamp-lastStats>=.5){lastStats=timestamp;scope.postMessage({type:'stats',metrics:{captureFps,
            skippedFrames:buffer.skipped,browserSkippedFrames:processor?.discardedFrames??0}});}
          continue;
        }
        if (
          !canvas ||
          canvas.width !== frame.displayWidth ||
          canvas.height !== frame.displayHeight
        ) {
          canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
        }
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Camera frame copying is unavailable.");
        // Copy out of the camera's native buffer pool before retaining a frame.
        const copyStart=performance.now();
        context.drawImage(frame, 0, 0);
        const bitmap = canvas.transferToImageBitmap();
        const copyMs=performance.now()-copyStart;
        scope.postMessage(
          {
            type: "frame",
            bitmap,
            timestamp,
            clockOriginMs,
            sentAtEpochMs:performance.timeOrigin+performance.now(),
            metrics:{captureFps,skippedFrames:buffer.skipped,browserSkippedFrames:processor?.discardedFrames??0,copyMs},
          },
          [bitmap],
        );
      } finally {
        frame.close();
      }
    }
  } catch (error) {
    scope.postMessage({
      type: "stopped",
      reason:'error',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    stopped = true;
    track?.stop();
    await reader?.cancel().catch(() => {});
    scope.postMessage({ type: "ended" });
  }
};
