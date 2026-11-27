import { createVideoWorker } from "./worker-assets";
import type { FrameResult } from "./detector";
import type { FittedPose } from "./pose-types";
import { RECONSTRUCTION_TIMEOUT_MESSAGE, RECONSTRUCTION_TIMEOUT_MS, type MoveSearchConfig, type MoveSearchResult } from "./move-search-types";
import {videoFrameIdentity} from '../pose-fitter/runtime/reconstruction-policy.mjs';
import type {SearchAction} from '../pose-fitter/runtime/incremental-search.mjs';
import {ParallelMoveSearch} from './parallel-move-search';
const COLORS=["corner","corner-edge","corner-edge-center","white","yellow","orange","red","blue","green"];

/** Frame sequence is assigned on admission, before fitting promises finish.
 * Rust can precompute out-of-order arrivals while withholding missing depths. */
export class MoveSearch {
  readonly actions:SearchAction[]=[];
  private worker:Worker|ParallelMoveSearch;private sequence=0;private seen=new Set<number>();private lastSequence=-1;
  private lastVideoBucket=-1;
  private lastVideoFrame=-1;
  private pending=new Set<Promise<void>>();private closed=false;private ended=false;private endRequested=false;
  private solutionFound=false;
  private deadline:ReturnType<typeof setTimeout>|undefined;
  private terminal=false;
  private preview?: MoveSearch;
  get solved(){return this.solutionFound;}
  constructor(baseUrl:string,readonly config:MoveSearchConfig,onResult:(value:MoveSearchResult,ended:boolean)=>void,onError:(message:string)=>void,private video=false,
    onPreview?:(value:MoveSearchResult)=>void){
    this.onError=onError;
    this.worker=config.bidirectional?new ParallelMoveSearch(baseUrl):createVideoWorker("move-search");
    this.worker.onmessage=({data})=>{
      if(this.closed)return;
      if(data.type==="result"){
        if(["solved","already_solved","exhausted","state_limit"].includes(data.result.status)){
          this.terminal=true;clearTimeout(this.deadline);this.deadline=undefined;
        }
        if(data.result.status==="solved"||data.result.status==="already_solved")this.solutionFound=true;
        if(this.config.diagnostics!==false)this.actions.push(...(data.actions??[]));onResult(data.result,!!data.ended);
      }
      if(data.type==="error"){this.dispose();onError(data.message);}
    };
    this.worker.onerror=()=>{this.dispose();onError("The Rust move-search worker stopped");};
    this.worker.postMessage({type:"init",baseUrl,config});
    if (video && config.bidirectional && onPreview) {
      // The preview consumes admitted fits without changing the two-sided search
      // or its recorded actions. Give it a smaller budget and yield between batches.
      this.preview = new MoveSearch(baseUrl, {
        ...config, bidirectional: false, diagnostics: false, state_limit: Math.min(20_000, config.state_limit),
        postprocess_identity_loops: false, postprocess_pose_cleanup: false,
      }, value => {
        onPreview(value);
        if (this.preview?.terminal) this.stopPreview();
      }, () => this.stopPreview(), true);
      this.preview.setPacing(4);
    }
  }
  private onError:(message:string)=>void;
  submit(timestamp:number,frame:FrameResult,fitting:Promise<FittedPose>){
    if(this.closed||this.ended||this.solutionFound)return;
    const identity=videoFrameIdentity(timestamp,this.config),sourceFrame=identity.sourceFrame;
    const timestampedVideo = this.video && this.config.frame_clock === 'video_milliseconds';
    const denseVideo = this.video && (timestampedVideo || this.config.infer_scramble);
    if(denseVideo){
      // A VFR source can skip buckets. Keep motion timing in sourceFrame and
      // give each accepted observation a queue ordinal with no gaps.
      // Timestamped files have already been sampled by FrameSelector. Adjacent
      // decoded frames can share a nominal bucket while having distinct ticks.
      if(sourceFrame<=this.lastVideoFrame || (!timestampedVideo && identity.sequence<=this.lastVideoBucket))return;
      this.lastVideoBucket=identity.sequence;
      this.lastVideoFrame=sourceFrame;
    }
    const sequence=this.video&&!denseVideo?identity.sequence:this.sequence++;
    if(sequence<0)return;
    if(this.seen.has(sequence))return;
    this.seen.add(sequence);this.lastSequence=Math.max(this.lastSequence,sequence);
    this.preview?.submit(timestamp, frame, fitting);
    const task=fitting.then(pose=>{
      if(this.closed||this.ended||this.solutionFound)return;
      let landmarkCount=0;const colors:string[]=[];
      for(const point of frame.detections){if(point.classId<3)landmarkCount++;else colors.push(COLORS[point.classId]);}
      this.worker.postMessage({type:"frame",frame:{sequence,frame:sourceFrame,bank:pose.bank,
        ...(denseVideo?{timestamp_ms:Math.round(timestamp*1000)}:{}),
        landmark_count:landmarkCount,colors,
        flagged:pose.pose_flag_reason===undefined?undefined:pose.pose_flag_reason!==null,
        geometry_flagged:pose.pose_geometry_flag_reason===undefined?undefined:pose.pose_geometry_flag_reason!==null}});
    }).catch(cause=>{
      if(!this.closed&&!this.solutionFound){this.dispose();this.onError(cause instanceof Error?cause.message:String(cause));}
    });
    this.pending.add(task);void task.finally(()=>{this.pending.delete(task);this.maybeEnd();}).catch(()=>{});
  }
  async end(){
    if(this.closed||this.ended)return;this.endRequested=true;
    this.stopPreview();
    this.startDeadline();
    if(!this.solutionFound)await Promise.all([...this.pending]);this.maybeEnd();
  }
  startDeadline(){
    // Keep the deadline on the UI thread so a blocked worker or fitting promise
    // cannot prevent termination. Repeated closure attempts keep the same limit.
    if(this.video&&!this.closed&&!this.terminal&&this.deadline===undefined)this.deadline=setTimeout(()=>{
      this.dispose();this.onError(RECONSTRUCTION_TIMEOUT_MESSAGE);
    },RECONSTRUCTION_TIMEOUT_MS);
  }
  private maybeEnd(){
    if(!this.closed&&!this.ended&&this.endRequested&&
      (this.solutionFound||!this.pending.size&&this.seen.size===this.lastSequence+1)){
      this.ended=true;this.worker.postMessage({type:"end"});
    }
  }
  private stopPreview() {
    const preview = this.preview;
    this.preview = undefined;
    if (preview && !preview.closed) preview.dispose();
  }
  dispose(){clearTimeout(this.deadline);this.deadline=undefined;this.closed=true;this.stopPreview();this.worker.terminate();}
  pause(){if(!this.closed)this.worker.postMessage({type:'pause'});}
  resume(){if(!this.closed)this.worker.postMessage({type:'resume'});}
  setPacing(delayMs:number){if(!this.closed)this.worker.postMessage({type:'pace',delayMs});}
}
