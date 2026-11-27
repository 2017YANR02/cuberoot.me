import type { FrameResult } from "./detector";
import type { FittedPose, PoseObservations } from "./pose-types";
import { BufferedPosePipeline, type PipelineFrame } from "../pose-fitter/runtime/buffered-pipeline.mjs";
import { PoseWorkerPool } from "./pose-worker-pool";
import { centerColorsForScramble } from "./cube-colors";
import {videoFrameIdentity,MEDIA_CLOCK_HZ} from '../pose-fitter/runtime/reconstruction-policy.mjs';

export function poseObservations(frame: FrameResult): PoseObservations {
  const landmarks = frame.detections.filter(point => point.classId < 3);
  const stickers = frame.detections.filter(point => point.classId >= 3);
  return {
    width: frame.transform.sourceWidth, height: frame.transform.sourceHeight,
    observations: { points: landmarks.map(p => [p.x, p.y]), classes: landmarks.map(p => p.classId),
      stickers: stickers.map(p => [p.x, p.y]), uncertainties: stickers.map(() => 1) },
  };
}
const COLORS = ["corner", "corner-edge", "corner-edge-center", "white", "yellow", "orange", "red", "blue", "green"];
export interface PoseFittingOptions {scramble:string;turningStartFrame:number|null;originSeconds?:number;endSeconds?:number;camera?:boolean;video?:boolean}
export function pipelineFrame(frame: FrameResult, frameIndex: number): PipelineFrame {
  return { ...poseObservations(frame), frame: frameIndex,
    pixel_scale: Math.max(Math.max(frame.transform.cropWidth, frame.transform.cropHeight) / 400, 0.3),
    landmark_presence: frame.detections.filter(p => p.classId < 3).map(p => p.presence),
    colors: frame.detections.filter(p => p.classId >= 3).map(p => COLORS[p.classId]),
  };
}

/** Shared buffered scheduler; all numerical stages execute in the CPU pool. */
export class PoseFitter {
  private pool: Pick<PoseWorkerPool,'execute'|'dispose'>;
  private stream?: BufferedPosePipeline;
  private segments = new Set<BufferedPosePipeline>();
  private dimensions = "";
  private fps = 0;
  private segment = 0;
  private configKey = "";
  private activeConfig = {turningStartFrame:null as number|null,centers:centerColorsForScramble("")};
  constructor(baseUrl: string, pool?: Pick<PoseWorkerPool,'execute'|'dispose'>) { this.pool = pool ?? new PoseWorkerPool(baseUrl); }
  fit(frame: FrameResult, reset: boolean, timestamp = 0, sourceFps = 30,
      options:PoseFittingOptions={scramble:"",turningStartFrame:null}): Promise<FittedPose> {
    const fps = sourceFps > 0 ? sourceFps : 30;
    const frameClock = options.camera ? 'camera_milliseconds' : options.video ? 'video_milliseconds' : undefined;
    const clockFps = frameClock ? MEDIA_CLOCK_HZ : fps;
    const dimensions = frame.transform.sourceWidth + "x" + frame.transform.sourceHeight;
    const configKey=JSON.stringify(options);
    if (reset || !this.stream || this.stream.ended || dimensions !== this.dimensions || Math.abs(fps - this.fps) > 0.001 || configKey!==this.configKey) {
      if (this.stream && !this.stream.ended) void this.stream.flush().catch(() => {});
      this.activeConfig={turningStartFrame:options.turningStartFrame,centers:centerColorsForScramble(options.scramble)};
      this.configKey=configKey;
      this.stream = new BufferedPosePipeline(job => this.pool.execute(job), { fps:clockFps, ...this.activeConfig });
      this.segments.add(this.stream); this.dimensions = dimensions; this.fps = fps;
      this.segment++;
    }
    const sourceFrame = videoFrameIdentity(timestamp,{fps:clockFps}).sourceFrame, segment = this.segment,
      fittingConfig: NonNullable<FittedPose['fittingConfig']>={segment,fps:clockFps,...(frameClock?{sourceFps:fps,frameClock}:{}),...this.activeConfig};
    return this.stream.push(pipelineFrame(frame, sourceFrame)).then(value => ({ ...value, sourceFrame,
      fittingConfig }));
  }
  async flush() {
    const segments = [...this.segments];
    await Promise.all(segments.map(segment => segment.flush()));
    for (const segment of segments) this.segments.delete(segment);
    if(this.stream&&segments.includes(this.stream)&&this.stream.ended)this.stream=undefined;
  }
  dispose(cause?: Error) {
    for (const segment of this.segments) segment.cancel(cause); this.segments.clear(); this.pool.dispose();
  }
}
