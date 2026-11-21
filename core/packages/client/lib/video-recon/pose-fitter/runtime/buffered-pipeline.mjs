// Framework-independent scheduling over the CPU pipeline's numerical jobs.
// Initial priors and orientation advance in source order. Neighbor cameras are
// immutable initial winners; final recovery waits for its complete 180ms window.
const pose = fit => fit ? {rvec:fit.params.slice(0,3),tvec:fit.params.slice(3,6)} : null;
const emptyFrame = meta => ({...meta,observations:{points:[],classes:[],stickers:[],uncertainties:[]},landmark_presence:[],colors:[]});

export class BufferedPosePipeline {
  constructor(execute,config) {
    this.execute=execute;this.config=config;this.entries=[];this.startupCursor=0;this.initialCursor=0;this.orientCursor=0;
    this.startupBusy=false;this.referenceCursor=0;this.startupReferences=[];this.hasStartup=false;
    this.initialBusy=false;this.orientBusy=false;this.ended=false;this.closed=false;
    this.previous=null;this.reference=null;this.finished=0;this.waiters=[];this.finalScan=0;
  }
  push(frame) {
    if(this.closed||this.ended)throw new Error('Pose segment is closed');
    if(this.entries.length&&frame.frame<=this.entries.at(-1).meta.frame)throw new Error('Pose frame indices must increase');
    const entry={frame,meta:{frame:frame.frame,width:frame.width,height:frame.height,pixel_scale:frame.pixel_scale},elapsedMs:0,stageMs:{},workerQueueMs:0,prepared:false};
    const result=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});
    entry.result=result;
    result.catch(()=>{}); // A later ordered presenter still receives the error.
    this.entries.push(entry);
    // Arrival can close an older recovery window before this frame's startup
    // is selected; release it before waiting for its finalized reference.
    this.scheduleFinals();
    this.job({type:'prepare',frame},entry).then(value=>{
      if(this.closed)return;
      entry.candidates=value.candidates;entry.candidatesReady=true;
      void this.pumpStartup();
    }).catch(error=>this.cancel(error));
    return result;
  }
  isStatic(entry){return this.config.turningStartFrame!=null&&entry.meta.frame<=this.config.turningStartFrame;}
  async job(request,entry) {
    const value=await this.execute(request);
    entry.elapsedMs+=value.elapsedMs??0;
    entry.stageMs[request.type]=(entry.stageMs[request.type]??0)+(value.elapsedMs??0);
    entry.workerQueueMs+=value.queueMs??0;
    return value;
  }
  async pumpStartup() {
    if(this.closed||this.startupBusy)return;
    this.startupBusy=true;
    try {
      while(this.startupCursor<this.entries.length&&!this.closed) {
        const entry=this.entries[this.startupCursor];if(!entry.candidatesReady)break;
        // Only use the fixed eligible prefix, even if faster workers already
        // finalized newer poses. Recovery needs <=180ms plus the next initial
        // neighbor, so eligible frames cannot depend on this startup selection.
        while(this.hasStartup&&this.referenceCursor+1<this.startupCursor&&
          entry.meta.frame/this.config.fps-this.entries[this.referenceCursor].meta.frame/this.config.fps>0.18) {
          const value=await this.entries[this.referenceCursor].result;
          if(this.closed)return;
          if(value.continuity_core) {
            this.startupReferences.push({frame:this.entries[this.referenceCursor].meta.frame,core:value.continuity_core});
            if(this.startupReferences.length>2)this.startupReferences.shift();
          }
          this.referenceCursor++;
        }
        const value=await this.job({type:'select_startup',frame:entry.frame,candidates:entry.candidates,
          references:[...this.startupReferences]},entry);
        if(this.closed)return;
        entry.source=value.source;entry.anchor=value.anchor;entry.prepared=true;
        entry.startupReferenceCore=value.reference_core??null;
        entry.startupMotionAllowance=value.motion_allowance??0;
        if(value.source)this.hasStartup=true;
        entry.candidates=undefined;this.startupCursor++;
        void this.pumpInitial();this.scheduleFinals();
      }
    }catch(error){this.cancel(error);}
    finally{this.startupBusy=false;this.notify();}
  }
  async pumpInitial() {
    if(this.closed||this.initialBusy)return;
    this.initialBusy=true;
    try {
      while(this.initialCursor<this.entries.length&&!this.closed) {
        const entry=this.entries[this.initialCursor];if(!entry.prepared)break;
        let source=entry.source??this.previous;
        const needsPose=entry.frame.observations.points.length>=3&&entry.frame.observations.stickers.length>0;
        if(!source&&needsPose) {
          for(const future of this.entries.slice(this.initialCursor+1)) {
            if(!future.prepared)break;
            if(future.source){source=future.source;break;}
          }
          if(!source&&!this.ended)break;
          // At EOF wait for outstanding startup jobs before declaring no seed.
          if(!source&&this.entries.some(e=>!e.prepared))break;
        }
        const result=await this.job({type:'initial',frame:entry.frame,source,prior:this.previous,static_mode:this.isStatic(entry)},entry);
        if(this.closed)return;
        entry.initial=result.bank;entry.initialPose=pose(result.bank[0]);entry.initialDone=true;
        if(entry.initialPose)this.previous=entry.initialPose;
        this.initialCursor++;
        this.scheduleNeighbor(this.initialCursor-2);
      }
      if(this.ended&&this.initialCursor===this.entries.length)this.scheduleNeighbor(this.entries.length-1);
    }catch(error){this.cancel(error);}
    finally{this.initialBusy=false;this.notify();}
  }
  scheduleNeighbor(index) {
    const entry=this.entries[index];if(!entry||entry.neighborRequested||!entry.initialDone)return;
    const next=this.entries[index+1];if(next?!next.initialDone:!this.ended)return;
    entry.neighborRequested=true;
    const neighbors=[this.entries[index-1]?.initialPose,next?.initialPose].filter(Boolean);
    this.job({type:'neighbors',frame:entry.frame,bank:entry.initial,neighbors,static_mode:this.isStatic(entry)},entry).then(value=>{
      if(this.closed)return;
      entry.temporal=value.bank;entry.temporalDone=true;entry.initial=undefined;
      void this.pumpOrientation();
    }).catch(error=>this.cancel(error));
  }
  async pumpOrientation() {
    if(this.closed||this.orientBusy)return;
    this.orientBusy=true;
    try {
      while(this.orientCursor<this.entries.length&&!this.closed) {
        const entry=this.entries[this.orientCursor];if(!entry.temporalDone)break;
        const value=await this.job({type:'orient',frame:entry.frame,bank:entry.temporal,centers:this.config.centers,
          reference:this.reference,fps:this.config.fps},entry);
        if(this.closed)return;
        this.reference=value.reference;entry.oriented=value.bank;entry.orientedDone=true;
        entry.temporal=undefined;this.orientCursor++;
        this.scheduleFinals();
      }
    }catch(error){this.cancel(error);}
    finally{this.orientBusy=false;this.notify();}
  }
  scheduleFinals() {
    if(this.closed)return;
    for(let index=this.finalScan;index<this.orientCursor;index++) {
      const entry=this.entries[index];if(entry.finalRequested)continue;
      const time=entry.meta.frame/this.config.fps;
      const needsTarget=entry.oriented.length&&entry.source&&!this.isStatic(entry);
      if(needsTarget&&!this.ended&&this.entries.at(-1).meta.frame/this.config.fps<time+0.18)continue;
      let lo=index,hi=index;
      while(lo>0&&time-this.entries[lo-1].meta.frame/this.config.fps<=0.18)lo--;
      while(hi+1<this.entries.length&&this.entries[hi+1].meta.frame/this.config.fps-time<=0.18)hi++;
      const window=this.entries.slice(lo,hi+1);
      if(needsTarget&&window.some(e=>!e.prepared))continue;
      entry.finalRequested=true;
      const target=needsTarget?this.job({type:'target',frames:window.map(e=>emptyFrame(e.meta)),startups:window.map(e=>e.source),
        anchors:window.flatMap((e,i)=>e.anchor?[i]:[]),index:index-lo,fps:this.config.fps},entry):Promise.resolve({target:null});
      target.then(value=>this.job({type:'finalize',frame:entry.frame,source:entry.source,bank:entry.oriented,
        target:value.target,static_mode:this.isStatic(entry)},entry)).then(value=>{
        if(this.closed)return;
        entry.finalized=true;this.finished++;
        entry.resolve({...value,elapsedMs:entry.elapsedMs,stageMs:entry.stageMs,workerQueueMs:entry.workerQueueMs,startup_reference_core:entry.startupReferenceCore,
          startup_motion_allowance:entry.startupMotionAllowance});
        // Startup only needs the finalized core. Keeping the fulfilled promise
        // retained every full bank/mesh for an indefinitely connected camera.
        entry.result=Promise.resolve({continuity_core:value.continuity_core??null});
        entry.resolve=entry.reject=undefined;entry.frame=null;entry.oriented=undefined;
        this.notify();
      }).catch(error=>this.cancel(error));
    }
    while(this.finalScan<this.orientCursor&&this.entries[this.finalScan].finalRequested)this.finalScan++;
  }
  flush() {
    if(this.closed)return Promise.reject(new Error('Pose pipeline cancelled'));
    this.ended=true;void this.pumpInitial();this.scheduleFinals();
    if(this.finished===this.entries.length)return Promise.resolve();
    const promise=new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));
    promise.catch(()=>{});return promise;
  }
  notify() {
    if(this.ended&&this.finished===this.entries.length)for(const waiter of this.waiters.splice(0))waiter.resolve();
  }
  cancel(error=new Error('Pose pipeline cancelled')) {
    if(this.closed)return;this.closed=true;
    for(const entry of this.entries)if(!entry.finalized){entry.reject?.(error);entry.resolve=entry.reject=undefined;}
    for(const waiter of this.waiters.splice(0))waiter.reject(error);
  }
}
