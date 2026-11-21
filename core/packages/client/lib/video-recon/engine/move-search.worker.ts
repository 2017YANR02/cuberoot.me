import { loadCpuFitter, type OpenCvModule } from "../pose-fitter/runtime/wasm-host.mjs";
import {IncrementalSearch} from "../pose-fitter/runtime/incremental-search.mjs";
let engine: Awaited<ReturnType<typeof loadCpuFitter>>;
let initialized: Promise<void>;
let driver:IncrementalSearch;
function fail(cause:unknown){driver?.dispose();
  self.postMessage({type:"error",message:cause instanceof Error?cause.message:String(cause)});}
self.onmessage=({data}:MessageEvent)=>{
  if(data.type==="init"){
    initialized=(async()=>{
      const base=new URL("pose/",data.baseUrl),response=await fetch(new URL("pipeline.json",base),{cache:"no-store"});
      if(!response.ok)throw new Error("Complete Rust/WASM runtime is missing. Run npm run sync:runtime.");
      const manifest=await response.json();
      const [binary,geometry]=await Promise.all([fetch(new URL(manifest.rust,base)),fetch(new URL(manifest.geometry,base))]);
      if(!binary.ok||!geometry.ok)throw new Error("Move search runtime files are missing");
      // Move search imports no camera kernels and downloads no OpenCV module.
      const noCamera={_pose_cv(){throw new Error("Move search attempted camera inference");}} as unknown as OpenCvModule;
      engine=await loadCpuFitter(await binary.arrayBuffer(),new TextEncoder().encode(JSON.stringify({geometry:await geometry.json(),workloads:[],probes:[]})),noCamera);
      driver=new IncrementalSearch(request=>{
        const result=engine.call("move_search_json",request);if(result.Err)throw new Error(result.Err);return result.Ok;
      },{version:manifest.rust,report:message=>self.postMessage({type:"result",...message}),error:fail});
      driver.request({type:"init",config:data.config});
    })();void initialized.catch(fail);return;
  }
  void initialized?.then(()=>{
    if(data.type==="frame")driver.request({type:"frame",frame:data.frame});
    else if(data.type==="end")driver.request({type:"end"});
    else if(data.type==='pause')driver.pause();
    else if(data.type==='resume')driver.resume();
    else if(data.type==='pace')driver.setPacing(data.delayMs);
  }).catch(fail);
};
