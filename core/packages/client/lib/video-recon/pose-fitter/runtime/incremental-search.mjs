import {SEARCH_CHUNK} from './reconstruction-policy.mjs';
/** Framework-free worker driver. The action journal permits exact replay with
 * freshly fitted banks, without waiting for decoding/inference or wall time. */
export class IncrementalSearch {
  constructor(call,{report,error,live=true,version='',now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}) {
    Object.assign(this,{call,report,error,live,version,now,schedule,cancel});
    this.timer=undefined;this.prepareMs=0;this.searchMs=0;this.lastReport=0;this.ended=false;this.actions=[];this.diagnostics=true;
    this.paused=false;this.delayMs=0;
  }
  request(request) {
    if(request.type==='init'){this.diagnostics=request.config?.diagnostics!==false;this.bidirectional=!!request.config?.bidirectional;}
    const start=this.diagnostics?this.now():0;
    const result=this.call(request);
    if(request.type==='init'){this.prepareMs=0;this.searchMs=0;this.ended=false;this.actions=[];}
    if(this.diagnostics&&request.type==='frame'){this.prepareMs+=this.now()-start;this.actions.push({type:'frame',sequence:request.frame.sequence});}
    if(this.diagnostics&&request.type==='advance'){this.searchMs+=this.now()-start;this.actions.push({type:'advance',budget:request.budget});}
    if(this.diagnostics&&request.type==='advance_side'){this.searchMs+=this.now()-start;this.actions.push({...request});}
    if(this.diagnostics&&request.type==='complete_join')this.actions.push({...request});
    if(request.type==='end'){this.ended=true;if(this.diagnostics)this.actions.push({type:'end'});}
    this.publish(result,request.type!=='advance');
    const canSearch=!this.bidirectional||this.ended;
    if(this.live&&canSearch&&request.type!=='init'&&result.status==='running')this.wake();
    // A newly pushed frame can wake an otherwise waiting live frontier.
    else if(this.live&&canSearch&&(request.type==='frame'||request.type==='end'))this.wake();
    return result;
  }
  publish(result,force) {
    const now=this.now();
    if(force||now-this.lastReport>=100||result.status!=='running') {
      this.lastReport=now;
      this.report({result:{...result,...(this.diagnostics?{timings:{prepareMs:this.prepareMs,searchMs:this.searchMs}}:{}),pipelineVersion:this.version},
        ended:this.ended,actions:this.actions.splice(0)});
    }
  }
  wake() {
    if(this.paused||this.timer!==undefined)return;
    this.timer=this.schedule.call(globalThis,()=>{
      this.timer=undefined;
      try{this.request({type:'advance',budget:SEARCH_CHUNK});}catch(error){this.dispose();this.error(error);}
    },this.delayMs);
  }
  pause(){this.paused=true;this.dispose();}
  resume(){if(!this.paused)return;this.paused=false;this.wake();}
  setPacing(delayMs){this.delayMs=Number.isFinite(delayMs)?Math.max(0,delayMs):0;}
  dispose(){if(this.timer!==undefined)this.cancel.call(globalThis,this.timer);this.timer=undefined;}
}
