import {loadCpuFitter,type OpenCvModule} from '../pose-fitter/runtime/wasm-host.mjs';
import {packMeetings} from '../pose-fitter/runtime/parallel-search.mjs';
let engine:Awaited<ReturnType<typeof loadCpuFitter>>;
let version='';
self.onmessage=async({data}:MessageEvent)=>{
 try {
  if(data.request.type==='init'){
   const base=new URL('pose/',data.baseUrl),manifest=await(await fetch(new URL('pipeline.json',base),{cache:'no-store'})).json();
   version=manifest.rust;
   const [binary,geometry]=await Promise.all([fetch(new URL(manifest.rust,base)),fetch(new URL(manifest.geometry,base))]);
   if(!binary.ok||!geometry.ok)throw Error('Move search runtime files are missing');
   engine=await loadCpuFitter(await binary.arrayBuffer(),new TextEncoder().encode(JSON.stringify({geometry:await geometry.json(),workloads:[],probes:[]})),
    {_pose_cv(){throw Error('Move search cannot run fitting');}} as unknown as OpenCvModule);
  }
  const value=engine.call('move_search_json',data.request);if(value.Err)throw Error(value.Err);
  const result={...value.Ok,pipelineVersion:version},meetings=result.meeting_states;delete result.meeting_states;
  if(meetings){const buffer=packMeetings(meetings);self.postMessage({id:data.id,result:{...result,meeting_buffer:buffer}},{transfer:[buffer]});}
  else self.postMessage({id:data.id,result});
 }catch(cause){self.postMessage({id:data.id,error:cause instanceof Error?cause.message:String(cause)});}
};
