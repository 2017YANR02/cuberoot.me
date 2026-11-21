import { createVideoWorker } from "./worker-assets";
import {ParallelSearch} from '../pose-fitter/runtime/parallel-search.mjs';
/** Worker-shaped transport owned by MoveSearch, so disposal always terminates
 * both search workers, including source changes while fitting is outstanding. */
export class ParallelMoveSearch {
 onmessage:((event:MessageEvent)=>void)|null=null;
 onerror:((event:ErrorEvent)=>void)|null=null;
 private driver:ParallelSearch;
 constructor(baseUrl:string){
  this.driver=new ParallelSearch({
   spawn:()=>{
    const worker=createVideoWorker("move-search-side");
    const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();let next=0;
    worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);if(data.error)task.reject(Error(data.error));else task.resolve(data.result);};
    worker.onerror=()=>{for(const task of pending.values())task.reject(Error('Rust move-search worker stopped'));pending.clear();};
    return {request:(request:any)=>new Promise<any>((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});worker.postMessage({id,request,baseUrl});}),
     dispose:()=>{worker.terminate();for(const task of pending.values())task.reject(Error('Search disposed'));pending.clear();}};
   },
   report:message=>queueMicrotask(()=>this.onmessage?.({data:{type:'result',...message}} as MessageEvent)),
   error:cause=>queueMicrotask(()=>this.onmessage?.({data:{type:'error',message:cause instanceof Error?cause.message:String(cause)}} as MessageEvent)),
  });
 }
 postMessage(data:any){this.driver.request(data);}
 terminate(){this.driver.dispose();}
}
