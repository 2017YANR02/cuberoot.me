import {CAMERA_CLOCK_HZ} from '../pose-fitter/runtime/reconstruction-policy.mjs';

/** A bounded source-time window measures delivered capture frames, independently
 * of the camera's advertised setting and delayed processing completions. */
export class CameraFrameRate {
  private times:number[]=[];
  observe(timestamp:number):number {
    if(!Number.isFinite(timestamp))return 0;
    if(this.times.length&&timestamp<=this.times.at(-1)!)this.times=[];
    this.times.push(timestamp);
    while(this.times.length>2&&timestamp-this.times[0]>2)this.times.shift();
    return this.times.length>1?(this.times.length-1)/(timestamp-this.times[0]):0;
  }
  reset(){this.times=[];}
}
export interface CameraCaptureMetrics {captureFps:number;skippedFrames:number;browserSkippedFrames:number;copyMs?:number;deliveryMs?:number}
/** Saturation limits admission, never stops the consumer or evicts queued work. */
export class CameraFrameBuffer {
  pending=0;skipped=0;
  private lastTick=-Infinity;
  constructor(readonly capacity=60) {}
  admit(timestamp?:number){
    // Camera drivers can deliver distinct images less than one clock tick
    // apart, or repeat/regress a timestamp. Reject them before inference;
    // never manufacture extra elapsed time to satisfy pose/search ordering.
    const tick=timestamp===undefined?undefined:Math.round(timestamp*CAMERA_CLOCK_HZ);
    if(tick!==undefined&&(!Number.isFinite(tick)||tick<=this.lastTick)){
      this.skipped++;return false;
    }
    if(this.pending>=this.capacity){this.skipped++;return false;}
    if(tick!==undefined)this.lastTick=tick;
    this.pending++;return true;
  }
  acknowledge(){this.pending=Math.max(0,this.pending-1);}
}
