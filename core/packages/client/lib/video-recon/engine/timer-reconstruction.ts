import type { FrameResult } from './detector';
import type { MoveSearchConfig, MoveSearchResult } from './move-search-types';
import type { FittedPose } from './pose-types';
import { createSearchConfig } from '../pose-fitter/runtime/reconstruction-policy.mjs';
import { TIMER_TAIL_SECONDS, TIMER_SEARCH_LIMIT_MS } from './cube-timer';
import type { TimerReconstructionResult } from './cube-timer';

export interface TimerSearch {
  submit(timestamp:number,frame:FrameResult,fitting:Promise<FittedPose>):void;
  end():Promise<void>;
  dispose():void;
  pause?():void;
  resume?():void;
}
export type TimerSearchFactory=(config:MoveSearchConfig,result:(value:MoveSearchResult,ended:boolean)=>void,
  error:(message:string)=>void,solveId:string)=>TimerSearch;
interface Window {
  id:string;start:number;end?:number;config:MoveSearchConfig;frames:number;
  submitted:Set<number>;
  search?:TimerSearch;failure?:string;result?:MoveSearchResult;closed:boolean;disposed:boolean;paused:boolean;
  searchReady:boolean; remainingMs:number; activeSince?:number;
  deadline?:ReturnType<typeof setTimeout>;
}

/** Fitting promises go straight to search, before the ordered display queue.
 * Source-time membership controls admission; input closes after stop + tail.
 * A newer solve pauses older search expansions rather than adding CPU workers. */
export class TimerReconstruction {
  private windows=new Map<string,Window>();
  constructor(private factory:TimerSearchFactory,private update:(id:string,value:TimerReconstructionResult)=>void,
    private finished:(id:string)=>void=()=>{}) {}
  start(id:string,scramble:string,start:number,fps:number,diagnostics=true,captureStart=start,recording=false) {
    const inferScramble = recording && !scramble.trim();
    const config=createSearchConfig({scramble,fps,camera:true,originSeconds:captureStart,startSeconds:start,
      openingHoldSeconds:inferScramble ? 0 : Math.max(0,start-captureStart),diagnostics,bidirectional:!recording,inferScramble});
    this.windows.set(id,{id,start:captureStart,config,frames:0,submitted:new Set(),closed:false,disposed:false,paused:false,
      searchReady:false,remainingMs:TIMER_SEARCH_LIMIT_MS});
    this.update(id,{status:'collecting'});this.prioritize();return config;
  }
  stop(id:string,stop:number,tailSeconds=TIMER_TAIL_SECONDS) {
    const window=this.windows.get(id);if(!window||window.closed)return;
    window.end=stop+tailSeconds;window.config.source_end_seconds=window.end;
    if(!window.failure&&!this.terminal(window.result))this.report(window,'waiting');
  }
  includes(timestamp:number){return this.solveIds(timestamp).length>0;}
  finishThrough(timestamp:number){
    for(const window of [...this.windows.values()])if(!window.closed&&window.end!==undefined&&timestamp>=window.end)this.close(window);
  }
  solveIds(timestamp:number):string[]{
    return [...this.windows.values()].filter(w=>!w.closed&&timestamp>=w.start&&
      (w.end===undefined||timestamp<w.end)).map(w=>w.id);
  }
  /** Called in source order at detector completion, before fits resolve. Search
   * assigns ordinals now and prepares each bank as soon as its promise resolves. */
  submit(timestamp:number,frame:FrameResult,fitting:Promise<FittedPose>) {
    for(const id of this.solveIds(timestamp)){
      const window=this.windows.get(id)!;
      if(!this.register(window,timestamp)||window.failure||window.disposed||this.terminal(window.result))continue;
      const observed=fitting.catch(error=>{
        if(!window.disposed&&!this.terminal(window.result))this.fail(window,
          `Pose fitting failed at ${timestamp.toFixed(3)}s: ${error instanceof Error?error.message:String(error)}`);
        throw error;
      });
      void observed.catch(()=>{});
      try{
        if(!window.search){this.open(window);this.prioritize();}
        window.search?.submit(timestamp,frame,observed);
      }catch(error){this.fail(window,error instanceof Error?error.message:String(error));}
    }
  }
  /** Ordered presentation acknowledges/records results and closes input only
   * after every earlier frame in the solve + tail has finished. */
  accept(timestamp:number,frame:FrameResult) {
    for(const window of [...this.windows.values()]){
      if(window.closed||timestamp<window.start)continue;
      if(window.end!==undefined&&timestamp>=window.end){this.close(window);continue;}
      if(!frame.fittedPose){
        this.register(window,timestamp);
        if(!this.terminal(window.result))this.fail(window,`Pose fitting failed at ${timestamp.toFixed(3)}s: ${frame.fittingError??'Fitted result missing; no fitter error was reported'}`);
        continue;
      }
      if(!window.submitted.has(timestamp))this.submit(timestamp,frame,Promise.resolve(frame.fittedPose));
    }
  }
  /** Disconnecting capture cannot invalidate an already closed, immutable solve. */
  closeInput(message='Camera ended before the complete solve window was processed') {
    for(const window of [...this.windows.values()]){
      if(window.closed)continue;
      window.closed=true;this.fail(window,message);this.remove(window);
    }
    this.prioritize();
  }
  cancel(message='Page closed; reconstruction cancelled') {
    for(const window of [...this.windows.values()]){
      window.closed=true;this.fail(window,message);this.remove(window);
    }
  }
  cancelSolve(id:string,message='Solve deleted'){
    const window=this.windows.get(id);if(!window)return;
    window.closed=true;this.fail(window,message);this.remove(window);this.prioritize();
  }
  private terminal(result:MoveSearchResult|undefined){return !!result&&['solved','already_solved','exhausted','state_limit'].includes(result.status);}
  private register(window:Window,timestamp:number){
    if(window.submitted.has(timestamp))return false;
    if(!window.frames)window.config.source_origin_seconds=timestamp;
    window.submitted.add(timestamp);window.frames++;return true;
  }
  private report(window:Window,status:TimerReconstructionResult['status'],message?:string) {
    const config=window.config;
    this.update(window.id,{status,message,frames:window.frames,result:window.result,
      moves:window.result?.steps.flatMap(step=>step.state_moves),
      config:{scramble:window.result?.inferred_scramble ?? config.scramble,fps:config.fps,source_fps:config.source_fps,frame_clock:config.frame_clock,
        turning_start_frame:config.turning_start_frame,
        requested_start_seconds:config.requested_start_seconds??window.start,source_origin_seconds:config.source_origin_seconds??window.start,
        source_end_seconds:window.end??config.source_origin_seconds??window.start}});
  }
  private open(window:Window) {
    window.search=this.factory(window.config,(result,ended)=>{
      if(window.disposed||window.failure)return;
      window.result=result;
      const solved=result.status==='solved'||result.status==='already_solved';
      // The parallel driver reports running only after both search sides have
      // prepared their frames. Fitting and search preparation use no budget.
      if(window.closed&&ended&&result.status==='running')window.searchReady=true;
      this.syncDeadline(window);
      if(this.terminal(result))this.report(window,solved?'solved':'failed',
        solved?undefined:`Search ${result.status.replaceAll('_',' ')}`);
      else this.reportProgress(window);
      if(ended&&this.terminal(result)&&window.closed){this.remove(window);this.prioritize();}
    },message=>this.fail(window,message),window.id);
    this.reportProgress(window);
  }
  private close(window:Window) {
    window.closed=true;
    this.prioritize();
    if(window.failure||!window.search){
      this.fail(window,window.failure??'No fitted camera frames in this solve');this.remove(window);this.prioritize();return;
    }
    void window.search.end().catch(error=>this.fail(window,error instanceof Error?error.message:String(error)));
  }
  private fail(window:Window,message:string) {
    if(window.disposed)return;
    this.pauseDeadline(window);
    window.failure??=message;window.search?.dispose();window.search=undefined;
    this.report(window,'failed',window.failure);
    if(window.closed){this.remove(window);this.prioritize();}
  }
  private remove(window:Window) {
    if(window.disposed)return;
    this.pauseDeadline(window);
    window.disposed=true;window.search?.dispose();this.windows.delete(window.id);
    this.finished(window.id);
  }
  private reportProgress(window:Window) {
    if(window.paused)this.report(window,'queued','Search paused for a newer solve');
    else this.report(window,window.searchReady?'searching':window.end===undefined?'collecting':'waiting');
  }
  private pauseDeadline(window:Window) {
    clearTimeout(window.deadline);
    window.deadline=undefined;
    if(window.activeSince!==undefined){
      window.remainingMs=Math.max(0,window.remainingMs-(performance.now()-window.activeSince));
      window.activeSince=undefined;
    }
  }
  private syncDeadline(window:Window) {
    if(!window.searchReady||window.paused||this.terminal(window.result)){
      this.pauseDeadline(window);
      return;
    }
    if(window.deadline!==undefined)return;
    window.activeSince=performance.now();
    window.deadline=setTimeout(()=>this.fail(window,'Reconstruction timed out after 30 seconds'),window.remainingMs);
  }
  private prioritize() {
    const runnable=[...this.windows.values()].filter(window=>!window.failure&&!window.disposed);
    const newest=runnable.at(-1);
    for(const window of runnable){
      if(!window.search)continue;
      const paused=window!==newest;
      if(paused===window.paused)continue;
      window.paused=paused;
      if(paused)window.search.pause?.();else window.search.resume?.();
      this.syncDeadline(window);
      if(!this.terminal(window.result))this.reportProgress(window);
    }
  }
}
