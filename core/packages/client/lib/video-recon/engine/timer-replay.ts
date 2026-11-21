import type {FrameResult} from './detector';
import {TIMER_TAIL_SECONDS,type TimerReconstructionResult} from './cube-timer';
import type {FittedPose} from './pose-types';

export interface TimerReplayFrame {timestamp:number;result:Pick<FrameResult,'fittedPose'>;image?:Blob}
export interface TimerReplay {id:string;start:number;end:number;clockFps:number;frames:readonly TimerReplayFrame[];missingImages:number;complete:boolean;reconstruction?:TimerReconstructionResult}
/** Historical replays retain geometry and source timing, never camera footage. */
export function replayWithoutImages(clip:TimerReplay):TimerReplay {
  if(!clip.frames.some(frame=>frame.image))return clip;
  return {...clip,frames:clip.frames.map(({image:_image,...frame})=>frame),missingImages:clip.frames.length};
}
interface Clip {id:string;start:number;end?:number;clockFps:number;closed:boolean;frames:Promise<TimerReplayFrame>[];
  ready:TimerReplayFrame[];published:number;timer?:ReturnType<typeof setTimeout>}

/** Only processed frames inside a timed solve are encoded. No camera images or
 * detections from idle time are retained, and encoding never blocks fitting. */
export class TimerReplayStore {
  private clips=new Map<string,Clip>();
  private latestId?:string;
  constructor(private publish:(clip:TimerReplay)=>void) {}
  start(id:string,start:number,clockFps:number){
    this.latestId=id;
    for(const previous of this.clips.values()){
      previous.ready=previous.ready.map(({image:_image,...frame})=>frame);
      previous.frames=previous.frames.map(promise=>promise.then(({image:_image,...frame})=>frame));
    }
    this.clips.set(id,{id,start,clockFps,closed:false,frames:[],ready:[],published:0});
  }
  stop(id:string,stop:number){const clip=this.clips.get(id);if(clip&&!clip.closed){clip.end=stop+TIMER_TAIL_SECONDS;this.emit(clip);}}
  capture(timestamp:number,result:FrameResult,encode:()=>Promise<Blob>){
    let image:Promise<Blob|undefined>|undefined;
    for(const clip of this.clips.values()){
      if(clip.closed||timestamp<clip.start)continue;
      if(clip.end!==undefined&&timestamp>=clip.end){void this.finish(clip);continue;}
      // convertToBlob snapshots pixels synchronously; the presenter's canvas
      // can then be reused while the browser encodes that snapshot off-thread.
      if(clip.id===this.latestId&&!image){try{image=encode().catch(()=>undefined);}catch{image=Promise.resolve(undefined);}}
      const index=clip.frames.length;
      const rendered=replayResult(result);
      clip.frames.push((clip.id===this.latestId?image!:Promise.resolve(undefined)).then(image=>{
        const frame={timestamp,result:rendered,image:clip.id===this.latestId?image:undefined};clip.ready[index]=frame;
        if(clip.end!==undefined&&!clip.closed&&this.clips.get(clip.id)===clip&&clip.timer===undefined)
          clip.timer=setTimeout(()=>{clip.timer=undefined;this.emit(clip);},100);
        return frame;
      }));
    }
  }
  closeInput(){for(const clip of this.clips.values())if(!clip.closed)void this.finish(clip);}
  finishThrough(timestamp:number){for(const clip of this.clips.values())if(!clip.closed&&clip.end!==undefined&&timestamp>=clip.end)void this.finish(clip);}
  remove(id:string){clearTimeout(this.clips.get(id)?.timer);this.clips.delete(id);}
  clear(){for(const clip of this.clips.values())clearTimeout(clip.timer);this.clips.clear();}
  private emit(clip:Clip){
    if(this.clips.get(clip.id)!==clip)return;
    let count=0;while(clip.ready[count])count++;
    if(!clip.closed&&count===clip.published)return;
    clip.published=count;const frames=clip.ready.slice(0,count);
    this.publish({id:clip.id,start:clip.start,end:clip.end??frames.at(-1)?.timestamp??clip.start,
      clockFps:clip.clockFps,frames,missingImages:frames.filter(frame=>!frame.image).length,complete:clip.closed});
  }
  private async finish(clip:Clip){
    clip.closed=true;clearTimeout(clip.timer);await Promise.all(clip.frames);
    if(this.clips.get(clip.id)!==clip)return;
    this.emit(clip);
    this.clips.delete(clip.id);
  }
}

/** Playback needs render geometry, not the detector outputs, assignments,
 * fitting metrics, recovery candidates or per-stage diagnostic arrays. */
export function replayResult(result:Pick<FrameResult,'fittedPose'>):Pick<FrameResult,'fittedPose'>{
  const pose=result.fittedPose;if(!pose)return {};
  const fittedPose:FittedPose={sourceFrame:pose.sourceFrame,pose:pose.pose,
    pose_flag_reason:pose.pose_flag_reason,pose_geometry_flag_reason:pose.pose_geometry_flag_reason,
    bank:pose.bank.map(fit=>({axis:fit.axis,params:fit.params,angles:fit.angles,flat_fallback:fit.flat_fallback,
      score:fit.score,nearest:[],valid:[]})),
    wireframe:pose.wireframe,wireframes:pose.wireframes,bootstrap:pose.bootstrap,message:pose.message,elapsedMs:0};
  return {fittedPose};
}

export function replayReconstruction(value:TimerReconstructionResult):TimerReconstructionResult{
  if(!value.result)return value;
  return {...value,result:{...value.result,unprocessed_steps:undefined,steps:value.result.steps.map(step=>({
    frame_index:step.frame_index,geometry_option_index:step.geometry_option_index,state_moves:step.state_moves,
    orientation_symmetry_index:step.orientation_symmetry_index,pose_flagged:step.pose_flagged,
  }))}};
}
