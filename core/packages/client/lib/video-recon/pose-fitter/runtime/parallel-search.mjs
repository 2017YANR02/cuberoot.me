/** Two independent Rust instances. Only admitted-state records cross workers;
 * neither direction can mutate the other's queue or candidate admission. */
export class ParallelSearch {
  constructor({spawn,report,error,now=()=>performance.now()}) {
    Object.assign(this,{spawn,report,error,now});this.workers=[];this.stopped=false;
    this.frames=[];this.actions=[];this.snapshots=[];this.inflight=[null,null];this.reserved=[0,0];this.finished=[false,false];
    this.seen=[new Map(),new Map()];this.lastReport=0;this.prepareMs=0;this.searchStart=0;
  }
  request(request) {
    if(this.stopped)return;
    if(request.type==='init'){
      this.config=request.config;this.diagnostics=request.config.diagnostics!==false;
      this.version=request.version??'';this.publish(this.waiting(),true);return;
    }
    if(request.type==='frame'){
      if(this.ended)throw Error('Move search input is closed');
      if(this.frames[request.frame.sequence])throw Error('Duplicate move-search frame sequence');
      this.frames[request.frame.sequence]=request.frame;
      this.record({type:'frame',sequence:request.frame.sequence});this.publish(this.waiting(),true);return;
    }
    if(request.type==='end'&&!this.ended){
      this.ended=true;this.record({type:'end'});this.publish(this.waiting(),true);
      void this.start().catch(error=>this.fail(error));
    }
  }
  waiting(){return {status:'waiting_for_frames',search_direction:'bidirectional',parallel:true,
    frames_received:this.frames.length,frames_prepared:this.frames.filter(Boolean).length,frames_searchable:0,
    blocked:0,pending:0,deferred:0,furthest_admitted_frames:0,steps:[],solved_frame_index:null,ended:!!this.ended,
    stats:{evaluated_states:0,furthest_frames:0,branch_stage:0,forward_expanded:0,backward_expanded:0}};}
  record(action){if(this.diagnostics)this.actions.push(action);}
  publish(result,force=false){
    if(this.stopped)return;const now=this.now();
    if(force||now-this.lastReport>=100){
      this.lastReport=now;
      this.report({result:{...result,pipelineVersion:this.version,...(this.diagnostics?{timings:{prepareMs:this.prepareMs,
        searchMs:this.searchStart?now-this.searchStart:0}}:{})},ended:!!this.ended,actions:this.actions.splice(0)});
    }
  }
  async start(){
    if(Array.from({length:this.frames.length},(_,i)=>this.frames[i]).some(frame=>!frame))throw Error('Cannot close move search with a missing earlier frame');
    const start=this.now();this.workers=[this.spawn(0),this.spawn(1)];
    await Promise.all(this.workers.map(async(worker,direction)=>{
      try{
        await worker.request({type:'init',config:this.config});
        for(const frame of this.frames){if(this.stopped)return;await worker.request({type:'frame',frame});}
        this.snapshots[direction]=await worker.request({type:'end'});
      }catch(error){
        if(direction===0)throw error;
        this.finished[1]=true;this.fallback='Backward worker could not start; continuing forward';worker.dispose();
      }
    }));
    if(this.stopped)return;
    this.version=this.snapshots[0]?.pipelineVersion??this.version;
    this.prepareMs=this.now()-start;this.searchStart=this.now();
    if(this.snapshots[0]?.bidirectional_fallback){this.fallback=this.snapshots[0].bidirectional_fallback;this.finished[1]=true;this.workers[1].dispose();}
    // Preparing has finished even if the first expansion batch is expensive.
    // Do not leave the app displaying "Waiting for fitted frames" during it.
    this.publish(this.snapshot(),true);
    this.pump(0);this.pump(1);
  }
  stats(){
    const f=this.snapshots[0]?.stats??{},b=this.snapshots[1]?.stats??{},out={...f};
    for(const key of ['evaluated_states','attempted_transitions','dominated_pruned','reopened_states','improved_pending',
      'deferred_promoted','unsolved_endpoints','flagged_expanded_states'])out[key]=(f[key]??0)+(b[key]??0);
    out.branch_stage=Math.max(f.branch_stage??0,b.branch_stage??0);
    out.peak_pending=(f.peak_pending??0)+(b.peak_pending??0);
    out.forward_expanded=f.evaluated_states??0;out.backward_expanded=b.evaluated_states??0;return out;
  }
  snapshot(status='running'){
    return {...(this.snapshots[0]??this.waiting()),stats:this.stats(),status,search_direction:this.fallback?'forward':'bidirectional',parallel:true,
      ...(this.fallback?{bidirectional_fallback:this.fallback}:{}),
      pending:this.snapshots.reduce((n,s)=>n+(s?.pending??0),0),deferred:this.snapshots.reduce((n,s)=>n+(s?.deferred??0),0),ended:true};
  }
  pump(direction){
    if(this.stopped||this.finishing||this.finished[direction]||this.inflight[direction])return;
    // Each direction retains its full allowance. Reverse work must never spend
    // the original forward frontier's budget or stop it before its usual cap.
    const remaining=this.config.state_limit-(this.snapshots[direction]?.stats?.evaluated_states??0);
    if(remaining<=0){this.finished[direction]=true;if(this.finished.every(Boolean))this.finish(this.snapshot('state_limit'));return;}
    const budget=Math.min(128,remaining);this.reserved[direction]=budget;
    const request={type:'advance_side',direction,budget};
    const promise=this.workers[direction].request(request);this.inflight[direction]=promise;
    promise.then(result=>{
      this.inflight[direction]=null;this.reserved[direction]=0;
      if(this.stopped)return;
      this.snapshots[direction]=result;this.record(request);
      if(this.finishing)return;
      if(direction===0&&['solved','already_solved'].includes(result.status)){
        this.finishing=true;void this.directResult(result).catch(error=>this.fail(error));return;
      }
      const meeting=this.meet(direction,result.meeting_buffer,result.meeting_states);
      if(meeting){this.finishing=true;void this.join(meeting).catch(error=>this.fail(error));return;}
      if(['exhausted','state_limit'].includes(result.status)||result.stats.evaluated_states>=this.config.state_limit)this.finished[direction]=true;
      if(this.finished.every(Boolean)){this.finish(this.snapshot(this.snapshots.some(s=>s?.stats?.evaluated_states>=this.config.state_limit)?'state_limit':'exhausted'));return;}
      this.publish(this.snapshot());this.pump(direction);this.pump(1-direction);
    }).catch(error=>{
      this.inflight[direction]=null;this.reserved[direction]=0;
      if(this.stopped)return;
      if(direction===1){
        // A failed reverse worker must not take the independent forward search down with it.
        this.finished[1]=true;this.fallback='Backward worker stopped; continuing forward';
        this.workers[1].dispose();this.publish(this.snapshot(),true);
        if(this.finished[0])this.finish(this.snapshot('state_limit'));else this.pump(0);
      }else this.fail(error);
    });
  }
  meet(direction,buffer,records){
    if(buffer){
      const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);records=[];
      for(let offset=0;offset<bytes.length;offset+=64)records.push([view.getUint32(offset,true),view.getUint32(offset+4,true),bytes[offset+8]===255?null:bytes[offset+8],bytes.subarray(offset+9,offset+63)]);
    }
    for(const [id,depth,cue,state]of records??[]){
      const key=depth+':'+cue+':'+String.fromCharCode(...state);
      const other=this.seen[1-direction].get(key);if(other!==undefined){this.meetingKey=key;return direction===0?[id,other]:[other,id];}
      if(!this.seen[direction].has(key))this.seen[direction].set(key,id);
    }
  }
  async settle(){await Promise.allSettled(this.inflight.filter(Boolean));if(this.stopped)throw Error('Search disposed');}
  async directResult(result){
    await this.settle();this.finish({...result,stats:this.stats(),search_direction:this.fallback?'forward':'bidirectional',parallel:true,
      ...(this.fallback?{bidirectional_fallback:this.fallback}:{}),
      join_frame_index:null,solved_anchor_frame:this.snapshots[1]?.solved_anchor_frame});
  }
  async join([forward,backward]){
    const key=this.meetingKey;
    await this.settle();
    if(this.fallback){this.finishing=false;this.pump(0);return;}
    const fragment=await this.workers[1].request({type:'path',direction:1,node:backward});
    const request={type:'complete_join',forward_node:forward,backward_steps:fragment.steps,backward_state:fragment.state,stats:this.stats()};
    let result;
    try{result=await this.workers[0].request(request);}catch(error){
      if(!String(error).includes('Incompatible meeting basis'))throw error;
      this.rejectedJoins=(this.rejectedJoins??0)+1;this.lastRejectedJoin=String(error);
      if(this.seen[0].get(key)===forward)this.seen[0].delete(key);
      if(this.seen[1].get(key)===backward)this.seen[1].delete(key);
      this.finishing=false;this.pump(0);this.pump(1);return;
    }
    this.record(request);
    this.finish({...result,solved_anchor_frame:this.snapshots[1]?.solved_anchor_frame});
  }
  finish(result){this.publish(result,true);this.dispose();}
  fail(error){if(this.stopped)return;this.dispose();this.error(error);}
  dispose(){this.stopped=true;for(const worker of this.workers)worker.dispose();this.seen[0].clear();this.seen[1].clear();}
}

/** Fixed 64-byte records: node/depth u32, cue byte, 54 encoded stickers, pad. */
export function packMeetings(records){
  const bytes=new Uint8Array(records.length*64),view=new DataView(bytes.buffer);
  records.forEach(([id,depth,cue,state],index)=>{
    const offset=index*64;view.setUint32(offset,id,true);view.setUint32(offset+4,depth,true);
    bytes[offset+8]=cue??255;bytes.set(state,offset+9);
  });return bytes.buffer;
}
